-- ============================================================================
-- brands 테이블 데이터 INSERT (Upsert) 쿼리
-- Supabase 대시보드 -> SQL Editor에 그대로 복사하여 실행(Run)할 수 있습니다.
-- ============================================================================

INSERT INTO brands (name, slug, logo_url, homepage_url, is_active)
VALUES
  -- 1. 주요 햄버거 프랜차이즈 (활성)
  ('맥도날드', 'mcdonalds', 'https://www.mcdonalds.co.kr/kor/images/common/logo.png', 'https://www.mcdonalds.co.kr', TRUE),
  ('버거킹', 'burgerking', 'https://www.burgerking.co.kr/dist/img/logo_header.51e1a8b7.gif', 'https://www.burgerking.co.kr', TRUE),
  ('맘스터치', 'momstouch', 'https://www.momstouch.co.kr/assets/images/common/logo.png', 'https://www.momstouch.co.kr', TRUE),
  ('롯데리아', 'lotteria', 'https://www.lotseeatz.com/assets/images/common/logo_lotteria.png', 'https://www.lotseeatz.com/brand/ria', TRUE),
  ('KFC', 'kfc', 'https://www.kfckorea.com/static/images/common/logo.png', 'https://www.kfckorea.com', TRUE),
  ('프랭크버거', 'frankburger', 'https://frankburger.co.kr/img/common/logo.png', 'https://frankburger.co.kr', TRUE),
  ('노브랜드버거', 'nobrandburger', NULL, 'https://www.shinsegaefood.com/nobrandburger/index.sf', TRUE),
  ('쉐이크쉑', 'shakeshack', NULL, 'https://www.shakeshack.kr', TRUE),
  ('파이브가이즈', 'fiveguys', NULL, 'https://fiveguys.co.kr', TRUE),
  ('크라이치즈버거', 'crycheeseburger', NULL, 'https://crycheeseburger.com', TRUE),

  -- 2. 향후 피자/치킨 확장용 브랜드 (필요 시 TRUE로 변경하여 활성화)
  ('도미노피자', 'dominos', NULL, 'https://web.dominos.co.kr', FALSE),
  ('피자헛', 'pizzahut', NULL, 'https://www.pizzahut.co.kr', FALSE),
  ('피자스쿨', 'pizzaschool', NULL, 'http://pizzaschool.net', FALSE),
  ('교촌치킨', 'kyochon', NULL, 'https://www.kyochon.com', FALSE),
  ('BHC', 'bhc', NULL, 'https://www.bhc.co.kr', FALSE),
  ('BBQ', 'bbq', NULL, 'https://bbq.co.kr', FALSE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = COALESCE(EXCLUDED.logo_url, brands.logo_url),
  homepage_url = EXCLUDED.homepage_url,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 시퀀스(ID 자동증가 값) 최신화
SELECT setval(
  pg_get_serial_sequence('brands', 'id'),
  COALESCE((SELECT MAX(id) FROM brands), 1),
  true
);

-- 결과 확인 조회
SELECT id, name, slug, homepage_url, is_active
FROM brands
ORDER BY id;
