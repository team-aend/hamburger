-- 싸이버거 AI 재현 이미지 1종만 연결한다.
-- 기존 이미지와 이미 시작된 월드컵의 참가 상품 스냅샷은 보존한다.
-- 새 DB에서는 db:init 후 db:migrate를 실행한다.
UPDATE products AS p
SET image_url = '/images/burgers/momstouch-thigh-burger-ai.png',
    updated_at = NOW()
FROM brands AS b
WHERE p.brand_id = b.id
  AND b.slug = 'momstouch'
  AND p.slug = 'thigh-burger'
  AND (p.image_url IS NULL OR p.image_url = '');
