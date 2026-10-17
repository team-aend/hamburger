'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { loginHref, useAuth } from '@/components/auth/AuthProvider';
import SiteHeader from '@/components/SiteHeader';
import { formatCalories, formatPrice, formatProtein } from '@/lib/format';
import type { WorldcupProduct } from '@/lib/worldcupSession';
import { MAX_COMPARE_COUNT } from '@/types/product';
import './mypage.css';

type TabKey = 'likes' | 'worldcup' | 'taste' | 'account';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'likes', label: '좋아요한 버거' },
  { key: 'worldcup', label: '월드컵 기록' },
  { key: 'taste', label: '취향 리포트' },
  { key: 'account', label: '회원 정보' },
];

interface Profile {
  id: number;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  nickname: string | null;
  socialName: string;
  createdAt: string;
  identities: { provider: string; email: string | null; connectedAt: string }[];
  stats: { likes: number; worldcups: number };
}

interface PriceChange {
  previousPrice: number;
  currentPrice: number;
  changedAt: string;
  /** 마이페이지에서 마지막으로 확인한 뒤에 바뀌었는지 */
  isNew: boolean;
}

interface LikedItem {
  productId: number;
  likedAt: string;
  /** 좋아요 후 단품 매장가가 바뀌었으면 값이 있다 */
  priceChange: PriceChange | null;
  product: {
    id: number;
    name: string;
    description: string;
    brand: { name: string; slug: string };
    singlePrice: number | null;
    setPrice: number | null;
    calories: number | null;
    protein: number | null;
  } | null;
}

interface WorldcupHistory {
  total: number;
  championships: { product: WorldcupProduct; count: number }[];
  results: { sessionId: string; roundSize: number; winner: WorldcupProduct; createdAt: string }[];
}

const PROVIDER_LABEL: Record<string, string> = { GOOGLE: 'Google', DEV: '테스트 계정' };

function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** undefined 를 formatPrice 등에 넘기면 '-' 로 표시된다. */
const orUndefined = (value: number | null) => value ?? undefined;

export default function MyPage() {
  return (
    <main className="worldcup-shell mypage-shell">
      <SiteHeader />
      <Suspense fallback={null}>
        <MyPageContent />
      </Suspense>
      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>취향에는 정답이 없습니다.</span>
      </footer>
    </main>
  );
}

function MyPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading, refresh, logout } = useAuth();
  const requestedTab = searchParams.get('tab') as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.key === requestedTab) ? requestedTab! : 'likes';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  // 로그아웃/탈퇴로 화면을 떠나는 중에는 로그인 화면으로 보내지 않는다.
  const leavingRef = useRef(false);

  // 로그인 회원 전용: 비로그인이면 로그인 후 이 화면으로 돌아오게 한다.
  useEffect(() => {
    if (!loading && !user && !leavingRef.current) {
      router.replace(loginHref(`${pathname}?${searchParams.toString()}`));
    }
  }, [loading, user, router, pathname, searchParams]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setProfile((await res.json()).profile);
      setProfileError(false);
    } catch {
      setProfileError(true);
    }
  }, []);

  useEffect(() => {
    if (user) void loadProfile();
  }, [user, loadProfile]);

  const leaveToHome = async (action: () => Promise<void>) => {
    leavingRef.current = true;
    router.replace('/');
    await action();
  };

  const selectTab = (key: TabKey) => {
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  };

  if (loading || !user) {
    return <section className="mp-content"><p className="mp-state">불러오는 중...</p></section>;
  }

  return (
    <section className="mp-content" aria-labelledby="mypage-title">
      <div className="mp-heading">
        <span className="eyebrow">BURGER PICK · MY PAGE</span>
        <h1 id="mypage-title">
          {user.displayName}님의
          <br />
          <strong>버거 기록.</strong>
        </h1>
      </div>

      <div className="mp-summary">
        <div className="mp-summary-profile">
          <Avatar name={user.displayName} url={user.avatarUrl} size={56} />
          <div>
            <strong>{user.displayName}</strong>
            {user.email && <small>{user.email}</small>}
          </div>
        </div>
        <dl className="mp-summary-stats">
          <div>
            <dt>좋아요</dt>
            <dd>{profile?.stats.likes ?? '-'}</dd>
          </div>
          <div>
            <dt>월드컵 완주</dt>
            <dd>{profile?.stats.worldcups ?? '-'}</dd>
          </div>
          <div>
            <dt>가입일</dt>
            <dd className="mp-summary-date">{profile ? new Date(profile.createdAt).toLocaleDateString('ko-KR') : '-'}</dd>
          </div>
        </dl>
      </div>

      {profileError && (
        <p className="mp-error" role="alert">회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      )}

      <div className="mp-tabs" role="tablist" aria-label="마이페이지 메뉴">
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`mp-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`mp-panel-${t.key}`}
            className={tab === t.key ? 'selected' : ''}
            onClick={() => selectTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`mp-panel-${tab}`} role="tabpanel" aria-labelledby={`mp-tab-${tab}`} className="mp-panel">
        {tab === 'likes' && <LikesTab onChanged={loadProfile} />}
        {tab === 'worldcup' && <WorldcupTab />}
        {tab === 'taste' && <TasteTab name={user.displayName} />}
        {tab === 'account' && profile && (
          <AccountTab
            profile={profile}
            onProfileChanged={async (next) => {
              setProfile(next);
              await refresh();
            }}
            onLogout={() => leaveToHome(logout)}
            onWithdrawn={() => leaveToHome(refresh)}
          />
        )}
      </div>
    </section>
  );
}

// ── 좋아요한 버거 ──────────────────────────────────────────────

function LikesTab({ onChanged }: { onChanged: () => void }) {
  const { refresh } = useAuth();
  const [items, setItems] = useState<LikedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  useEffect(() => {
    fetch('/api/me/likes', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(async (data: { items: LikedItem[] }) => {
        setItems(data.items);
        // 새 가격 변동을 보여줬으면 확인 처리 → 헤더 알림 배지가 사라진다. (이번 화면의 NEW 표시는 유지)
        if (data.items.some((item) => item.priceChange?.isNew)) {
          await fetch('/api/me/price-alerts/seen', { method: 'POST' }).catch(() => undefined);
          await refresh();
        }
      })
      .catch(() => setError('좋아요 목록을 불러오지 못했습니다.'));
  }, [refresh]);

  const unlike = async (productId: number) => {
    setPendingId(productId);
    try {
      const res = await fetch(`/api/likes/${productId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setItems((prev) => prev?.filter((item) => item.productId !== productId) ?? null);
      setCompareIds((prev) => prev.filter((id) => id !== productId));
      onChanged();
    } catch {
      setError('좋아요를 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPendingId(null);
    }
  };

  const toggleCompare = (productId: number) => {
    setCompareIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= MAX_COMPARE_COUNT) return prev;
      return [...prev, productId];
    });
  };

  if (error && !items) return <p className="mp-error" role="alert">{error}</p>;
  if (!items) return <p className="mp-state">좋아요 목록을 불러오는 중...</p>;
  if (items.length === 0) {
    return (
      <div className="mp-empty">
        <h3>아직 좋아요한 버거가 없어요.</h3>
        <p>햄버거 비교 화면에서 마음에 드는 버거에 ♥를 눌러 보세요.</p>
        <Link href="/compare">햄버거 비교 보러 가기</Link>
      </div>
    );
  }

  return (
    <>
      <div className="mp-list-header">
        <p className="mp-count">
          좋아요 <strong>{items.length}</strong>개
        </p>
        <div className="mp-compare-action">
          <span>
            비교할 버거 {compareIds.length}/{MAX_COMPARE_COUNT}
          </span>
          {compareIds.length >= 2 ? (
            <Link className="mp-compare-link" href={`/compare?compare=${compareIds.join(',')}`}>
              선택한 {compareIds.length}개 비교하기 →
            </Link>
          ) : (
            <span className="mp-compare-link disabled" aria-disabled="true">
              2개 이상 선택하세요
            </span>
          )}
        </div>
      </div>
      {error && <p className="mp-error" role="alert">{error}</p>}

      <PriceChangeBanner items={items} />

      <div className="mp-grid">
        {items.map(({ productId, likedAt, product, priceChange }) => {
          const inCompare = compareIds.includes(productId);
          return (
            <article key={productId} className={`mp-card ${inCompare ? 'selected' : ''}`}>
              <div className="mp-card-body">
                {product ? (
                  <>
                    <small className="mp-card-brand">{product.brand.name}</small>
                    <h3 className="mp-card-name">
                      <Link href={`/products/${productId}`}>{product.name}</Link>
                    </h3>
                    {priceChange && <PriceChangeTag change={priceChange} />}
                    <dl className="mp-card-prices">
                      <div>
                        <dt>단품</dt>
                        <dd className="mp-card-price">{formatPrice(orUndefined(product.singlePrice))}</dd>
                      </div>
                      <div>
                        <dt>세트</dt>
                        <dd>{formatPrice(orUndefined(product.setPrice))}</dd>
                      </div>
                    </dl>
                    <p className="mp-card-meta">
                      {formatCalories(orUndefined(product.calories))} · 단백질{' '}
                      {formatProtein(orUndefined(product.protein))}
                    </p>
                  </>
                ) : (
                  <>
                    <small className="mp-card-brand">판매 종료</small>
                    <h3 className="mp-card-name">더 이상 판매하지 않는 메뉴</h3>
                  </>
                )}
                <p className="mp-card-date">{formatDate(likedAt)} 좋아요</p>
              </div>

              <div className="mp-card-actions">
                {product && (
                  <button
                    type="button"
                    aria-pressed={inCompare}
                    className={`mp-card-compare ${inCompare ? 'selected' : ''}`}
                    disabled={!inCompare && compareIds.length >= MAX_COMPARE_COUNT}
                    onClick={() => toggleCompare(productId)}
                  >
                    {inCompare ? '✓ 비교 담김' : '+ 비교 담기'}
                  </button>
                )}
                <button
                  type="button"
                  className="mp-card-unlike"
                  disabled={pendingId === productId}
                  onClick={() => unlike(productId)}
                  aria-label={`${product?.name ?? '메뉴'} 좋아요 취소`}
                >
                  ♥ 취소
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function PriceChangeTag({ change }: { change: PriceChange }) {
  const diff = change.currentPrice - change.previousPrice;
  const up = diff > 0;
  return (
    <p className={`mp-price-change ${up ? 'up' : 'down'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      좋아요 후 {Math.abs(diff).toLocaleString('ko-KR')}원 {up ? '올랐어요' : '내렸어요'}
      <small>
        {change.previousPrice.toLocaleString('ko-KR')}원 → {change.currentPrice.toLocaleString('ko-KR')}원
      </small>
      {change.isNew && <b className="mp-new">NEW</b>}
    </p>
  );
}

/** 좋아요한 버거 중 가격이 바뀐 버거 요약 (가격 변동 알림) */
function PriceChangeBanner({ items }: { items: LikedItem[] }) {
  const changed = items.filter((item) => item.priceChange && item.product);
  if (changed.length === 0) return null;
  const newCount = changed.filter((item) => item.priceChange!.isNew).length;
  return (
    <section className="mp-price-alert" aria-labelledby="mp-price-alert-title">
      <h3 id="mp-price-alert-title">
        🔔 좋아요한 버거 중 {changed.length}개의 가격이 바뀌었어요
        {newCount > 0 && <small>새 소식 {newCount}개</small>}
      </h3>
      <ul>
        {changed.map(({ productId, product, priceChange }) => {
          const diff = priceChange!.currentPrice - priceChange!.previousPrice;
          return (
            <li key={productId}>
              <Link href={`/products/${productId}`}>{product!.name}</Link>
              <span className={diff > 0 ? 'up' : 'down'}>
                {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString('ko-KR')}원
              </span>
              <small>{formatDate(priceChange!.changedAt)}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── 취향 리포트 ────────────────────────────────────────────────

interface TasteReport {
  enough: boolean;
  sources: { likes: number; worldcupWins: number; highRatings: number };
  patties: { label: string; share: number }[];
  brands: { label: string; share: number }[];
  averagePrice: number | null;
  priceBand: string | null;
  averageCalories: number | null;
  summary: string | null;
  recommendations: { productId: string; name: string; brandName: string; singlePrice: number | null; reasons: string[] }[];
}

/** 막대 하나에 비율(%)을 글자로 함께 적어, 색 없이도 읽을 수 있게 한다. */
function ShareBars({ title, items }: { title: string; items: { label: string; share: number }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mp-taste-bars">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <span className="mp-taste-label">{item.label}</span>
            <span className="mp-champion-bar" aria-hidden="true">
              <i style={{ width: `${item.share}%` }} />
            </span>
            <strong>{item.share}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TasteTab({ name }: { name: string }) {
  const [report, setReport] = useState<TasteReport | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/me/taste', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setReport)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="mp-error" role="alert">취향 리포트를 불러오지 못했습니다.</p>;
  if (!report) return <p className="mp-state">취향을 분석하는 중...</p>;

  const { sources } = report;
  const basis = `좋아요 ${sources.likes}개 · 월드컵 우승 ${sources.worldcupWins}회 · 높은 별점 ${sources.highRatings}개`;

  if (!report.enough) {
    return (
      <div className="mp-empty">
        <h3>취향을 알려면 기록이 조금 더 필요해요.</h3>
        <p>
          좋아요를 3개 이상 누르거나, 월드컵을 2번 이상 완주하면 취향 리포트가 만들어져요.
          <br />
          지금까지: {basis}
        </p>
        <Link href="/">월드컵 하러 가기</Link>
      </div>
    );
  }

  return (
    <div className="mp-taste">
      <section className="mp-taste-hero" aria-labelledby="mp-taste-title">
        <span className="winner-label">MY BURGER TASTE</span>
        <h3 id="mp-taste-title">
          {name}님은
          <br />
          <strong>{report.summary}</strong>
        </h3>
        <p>{basis}을 바탕으로 분석했어요.</p>
      </section>

      <dl className="mp-taste-stats">
        <div>
          <dt>자주 고르는 가격대</dt>
          <dd>{report.priceBand ?? '-'}</dd>
          {report.averagePrice !== null && <small>평균 {report.averagePrice.toLocaleString('ko-KR')}원</small>}
        </div>
        <div>
          <dt>평균 열량</dt>
          <dd>{report.averageCalories !== null ? `${report.averageCalories.toLocaleString('ko-KR')}kcal` : '-'}</dd>
        </div>
      </dl>

      <div className="mp-taste-grid">
        <ShareBars title="좋아하는 패티" items={report.patties} />
        <ShareBars title="좋아하는 브랜드" items={report.brands} />
      </div>

      {report.recommendations.length > 0 && (
        <section aria-labelledby="mp-taste-reco-title">
          <h3 id="mp-taste-reco-title" className="mp-section-title mp-history-title">
            취향 저격 버거 <small>아직 고르지 않은 버거 중 취향에 맞는 버거</small>
          </h3>
          <ul className="mp-taste-reco">
            {report.recommendations.map((item) => (
              <li key={item.productId}>
                <Link href={`/products/${item.productId}`}>
                  <small>{item.brandName}</small>
                  <strong>{item.name}</strong>
                  <span className="mp-taste-price">{formatPrice(orUndefined(item.singlePrice))}</span>
                  <span className="mp-taste-reasons">
                    {item.reasons.map((reason) => <em key={reason}>{reason}</em>)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── 월드컵 기록 ────────────────────────────────────────────────

function WorldcupTab() {
  const [history, setHistory] = useState<WorldcupHistory | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/me/worldcup', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setHistory)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="mp-error" role="alert">월드컵 기록을 불러오지 못했습니다.</p>;
  if (!history) return <p className="mp-state">월드컵 기록을 불러오는 중...</p>;
  if (history.total === 0) {
    return (
      <div className="mp-empty">
        <h3>아직 완주한 월드컵이 없어요.</h3>
        <p>로그인한 상태에서 시작한 월드컵을 완주하면 여기에 기록돼요.</p>
        <Link href="/">월드컵 하러 가기</Link>
      </div>
    );
  }

  const favorite = history.championships[0];
  const favoriteBurger = favorite.product;

  return (
    <>
      <div className="mp-worldcup-top">
        <article className="mp-favorite">
          <span className="winner-label">MY NO.1</span>
          <div className="mp-favorite-art" aria-hidden="true">
            🍔
          </div>
          <small>{favoriteBurger.brandName}</small>
          <h3>
            <Link className="mp-product-link" href={`/products/${favoriteBurger.productId}`}>{favoriteBurger.name}</Link>
          </h3>
          <p>
            <strong>{favorite.count}회</strong> 우승시킨 최애 버거
          </p>
        </article>

        <div className="mp-champions">
          <h3 className="mp-section-title">
            우승 횟수 <small>총 {history.total}회 완주</small>
          </h3>
          <ol>
            {history.championships.slice(0, 5).map(({ product: burger, count }) => {
              return (
                <li key={burger.productId}>
                  <span className="mp-burger-icon" aria-hidden="true">
                    🍔
                  </span>
                  <Link className="mp-champion-name mp-product-link" href={`/products/${burger.productId}`}>{burger.name}</Link>
                  <span className="mp-champion-bar" aria-hidden="true">
                    <i style={{ width: `${(count / favorite.count) * 100}%` }} />
                  </span>
                  <strong>{count}회</strong>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <h3 className="mp-section-title mp-history-title">
        최근 기록 <small>최근 {history.results.length}개</small>
      </h3>
      <table className="ranking-table mp-history">
        <caption className="visually-hidden">월드컵 완주 기록, 최근 순</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">우승 버거</th>
            <th scope="col">강수</th>
          </tr>
        </thead>
        <tbody>
          {history.results.map((result) => {
            const burger = result.winner;
            return (
              <tr key={result.sessionId}>
                <td className="mp-history-date">{formatDate(result.createdAt, true)}</td>
                <th scope="row">
                  <div className="ranking-burger">
                    <span aria-hidden="true">
                      🍔
                    </span>
                    <div>
                      <small>{burger.brandName}</small>
                      <strong>
                        <Link className="mp-product-link" href={`/products/${burger.productId}`}>{burger.name}</Link>
                      </strong>
                    </div>
                  </div>
                </th>
                <td>{result.roundSize}강</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mp-footnote">
        <Link href="/ranking">전체 랭킹 보기 →</Link>
      </p>
    </>
  );
}

// ── 회원 정보 ──────────────────────────────────────────────────

const WITHDRAW_CONFIRM_TEXT = '탈퇴';

function AccountTab({
  profile,
  onProfileChanged,
  onLogout,
  onWithdrawn,
}: {
  profile: Profile;
  onProfileChanged: (profile: Profile) => Promise<void>;
  onLogout: () => Promise<void>;
  onWithdrawn: () => Promise<void>;
}) {
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const saveNickname = async (value: string | null) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNickname(data.profile.nickname ?? '');
      await onProfileChanged(data.profile);
      setMessage({ type: 'ok', text: value === null ? 'Google 이름을 사용합니다.' : '닉네임을 저장했어요.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error && error.message ? error.message : '닉네임을 저장하지 못했습니다.',
      });
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void saveNickname(nickname.trim() === '' ? null : nickname);
  };

  const withdraw = async () => {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const res = await fetch('/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message);
      await onWithdrawn();
    } catch (error) {
      setWithdrawError(
        error instanceof Error && error.message ? error.message : '탈퇴 처리 중 문제가 발생했습니다.'
      );
      setWithdrawing(false);
    }
  };

  return (
    <div className="mp-account">
      <section className="mp-box" aria-labelledby="mp-profile-title">
        <h3 id="mp-profile-title" className="mp-section-title">기본 정보</h3>
        <dl className="mp-info">
          <div>
            <dt>이름</dt>
            <dd>{profile.displayName}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            <dd>{profile.email ?? '-'}</dd>
          </div>
          <div>
            <dt>가입일</dt>
            <dd>{formatDate(profile.createdAt)}</dd>
          </div>
          <div>
            <dt>로그인 수단</dt>
            <dd className="mp-identities">
              {profile.identities.map((identity) => (
                <span key={identity.provider} className="mp-provider">
                  {PROVIDER_LABEL[identity.provider] ?? identity.provider}
                  <small>{formatDate(identity.connectedAt)} 연결</small>
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mp-box" aria-labelledby="mp-nickname-title">
        <h3 id="mp-nickname-title" className="mp-section-title">
          닉네임 <small>설정하지 않으면 Google 이름({profile.socialName})을 씁니다.</small>
        </h3>
        <form className="mp-nickname-form" onSubmit={onSubmit}>
          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder={profile.socialName}
            maxLength={20}
            aria-label="닉네임"
            aria-describedby="mp-nickname-help"
          />
          <button type="submit" className="mp-primary-button" disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
          {profile.nickname && (
            <button
              type="button"
              className="mp-link-button"
              disabled={saving}
              onClick={() => void saveNickname(null)}
            >
              Google 이름으로 되돌리기
            </button>
          )}
        </form>
        <p id="mp-nickname-help" className="mp-help">2~20자 · 한글, 영문, 숫자, 공백, _, - 사용 가능</p>
        {message && (
          <p className={message.type === 'ok' ? 'mp-success' : 'mp-error'} role="status">
            {message.text}
          </p>
        )}
      </section>

      <section className="mp-box mp-danger" aria-labelledby="mp-withdraw-title">
        <h3 id="mp-withdraw-title" className="mp-section-title">계정</h3>
        <div className="mp-account-actions">
          <button type="button" className="mp-outline-button" onClick={() => void onLogout()}>
            로그아웃
          </button>
          {!showWithdraw && (
            <button type="button" className="mp-link-button" onClick={() => setShowWithdraw(true)}>
              회원 탈퇴
            </button>
          )}
        </div>

        {showWithdraw && (
          <div className="mp-withdraw">
            <h4>정말 탈퇴하시겠어요?</h4>
            <ul>
              <li>회원 정보(이름, 이메일, 프로필 사진)와 Google 계정 연결이 즉시 삭제됩니다.</li>
              <li>좋아요 {profile.stats.likes}개가 모두 삭제됩니다.</li>
              <li>
                월드컵 기록 {profile.stats.worldcups}개는 누가 참여했는지 알 수 없도록 처리되어 랭킹 통계에만
                남습니다.
              </li>
              <li>삭제된 정보는 되돌릴 수 없습니다. 같은 Google 계정으로 다시 가입하면 새 회원으로 시작합니다.</li>
            </ul>
            <label>
              <span>
                확인을 위해 <b>{WITHDRAW_CONFIRM_TEXT}</b>를 입력해 주세요.
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={WITHDRAW_CONFIRM_TEXT}
              />
            </label>
            {withdrawError && <p className="mp-error" role="alert">{withdrawError}</p>}
            <div className="mp-account-actions">
              <button
                type="button"
                className="mp-danger-button"
                disabled={confirmText !== WITHDRAW_CONFIRM_TEXT || withdrawing}
                onClick={() => void withdraw()}
              >
                {withdrawing ? '탈퇴 처리 중...' : '탈퇴하기'}
              </button>
              <button
                type="button"
                className="mp-link-button"
                onClick={() => {
                  setShowWithdraw(false);
                  setConfirmText('');
                  setWithdrawError(null);
                }}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({ name, url, size }: { name: string; url: string | null; size: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="account-avatar" src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="account-avatar" style={{ width: size, height: size, fontSize: size / 2.4 }} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
