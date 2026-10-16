import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { clearSessionCookie } from '../auth/session.js';
import { getCachedDataset } from '../db/datasetCache.js';
import { getUserLikes } from '../db/likes.js';
import { priceAlerts, priceAlertsHandlers } from '../priceAlerts/composition.js';
import { deleteUser, getUserProfile, updateNickname } from '../db/users.js';
import { worldcupRecordsHandlers } from '../worldcup/composition.js';

/**
 * 마이페이지 API. 모두 로그인 필수.
 *   GET    /api/me           회원 정보 + 통계
 *   PATCH  /api/me           닉네임 변경 { nickname: string | null }
 *   DELETE /api/me           회원 탈퇴 { confirm: '탈퇴' }
 *   GET    /api/me/likes     좋아요한 버거 목록
 *   GET    /api/me/worldcup  월드컵 기록
 */
const router = Router();
router.use(requireAuth);

const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9 _-]{2,20}$/;
export const WITHDRAW_CONFIRM_TEXT = '탈퇴';

function serverError(res: Response, label: string, error: unknown) {
  console.error(`❌ ${label}:`, error);
  res.status(500).json({ message: `${label} 중 오류가 발생했습니다.` });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const profile = await getUserProfile(req.user!.id);
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ profile });
  } catch (error) {
    serverError(res, '회원 정보 조회', error);
  }
});

router.patch('/', async (req: Request, res: Response) => {
  const raw = req.body?.nickname;
  let nickname: string | null = null;

  if (raw !== null) {
    if (typeof raw !== 'string') {
      res.status(400).json({ message: '닉네임을 입력해 주세요.' });
      return;
    }
    nickname = raw.trim().replace(/\s+/g, ' ');
    if (!NICKNAME_PATTERN.test(nickname)) {
      res.status(400).json({
        message: '닉네임은 2~20자의 한글, 영문, 숫자, 공백, _, - 만 사용할 수 있습니다.',
      });
      return;
    }
  }

  try {
    await updateNickname(req.user!.id, nickname);
    res.status(200).json({ profile: await getUserProfile(req.user!.id) });
  } catch (error) {
    serverError(res, '닉네임 변경', error);
  }
});

router.delete('/', async (req: Request, res: Response) => {
  if (req.body?.confirm !== WITHDRAW_CONFIRM_TEXT) {
    res.status(400).json({ message: `확인을 위해 '${WITHDRAW_CONFIRM_TEXT}'를 입력해 주세요.` });
    return;
  }

  try {
    await deleteUser(req.user!.id);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    serverError(res, '회원 탈퇴', error);
  }
});

router.get('/likes', async (req: Request, res: Response) => {
  try {
    const [likes, { dataset }, priceChanges] = await Promise.all([
      getUserLikes(req.user!.id),
      getCachedDataset(),
      priceAlerts().changes(req.user!.id),
    ]);
    const productById = new Map(dataset.baseEnrichedProducts.map((p) => [p.id, p]));
    const changeByProductId = new Map(priceChanges.map((change) => [Number(change.productId), change]));

    const items = likes.map(({ productId, likedAt }) => {
      const product = productById.get(productId);
      if (!product) {
        // 판매 종료 등으로 목록에서 빠진 상품도 좋아요 기록은 보여준다.
        return { productId, likedAt, product: null, priceChange: null };
      }
      const single =
        product.variants.find((v) => v.variantType === 'SINGLE') ??
        product.variants.find((v) => v.isDefault) ??
        product.variants[0];
      const set = product.variants.find((v) => v.variantType === 'SET');
      // 가격 변동은 DB 에서 바로 읽으므로, 상품 캐시(최대 10분)보다 최신일 수 있다 → 같은 값을 보여준다.
      const change = changeByProductId.get(productId) ?? null;
      return {
        productId,
        likedAt,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          brand: { name: product.brand.name, slug: product.brand.slug },
          singlePrice: change?.currentPrice ?? single?.prices.store ?? null,
          setPrice: set?.prices.store ?? null,
          calories: single?.nutrition.caloriesKcal ?? null,
          protein: single?.nutrition.proteinG ?? null,
        },
        // 좋아요 후 단품 매장가가 바뀌었으면 { previousPrice, currentPrice, changedAt, isNew }
        priceChange: change,
      };
    });

    res.set('Cache-Control', 'no-store');
    res.status(200).json({ items });
  } catch (error) {
    serverError(res, '좋아요 목록 조회', error);
  }
});

/**
 * POST /api/me/price-alerts/seen
 * 가격 변동 알림을 확인한 것으로 표시 (헤더의 알림 배지가 사라진다)
 */
router.post('/price-alerts/seen', priceAlertsHandlers().markSeen);

router.get('/worldcup', worldcupRecordsHandlers().history);

export default router;
