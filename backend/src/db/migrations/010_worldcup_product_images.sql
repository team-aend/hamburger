-- 공식 상품 사진을 참고해 생성한 월드컵 상품 이미지 17종을 연결한다.
-- 기존 이미지 URL과 이미 시작된 월드컵의 참가 상품 스냅샷은 보존한다.
-- 프론트엔드 public 경로를 사용해 로컬·운영 환경의 호스트에 종속되지 않는다.
UPDATE products AS p
SET image_url = images.image_url,
    updated_at = NOW()
FROM brands AS b,
     (VALUES
       ('mcdonalds', 'big-mac', '/images/burgers/mcdonalds-big-mac-ai.png'),
       ('mcdonalds', 'mcspicy-shanghai-burger', '/images/burgers/mcdonalds-mcspicy-shanghai-burger-ai.png'),
       ('mcdonalds', 'mcchicken-mozzarella', '/images/burgers/mcdonalds-mcchicken-mozzarella-ai.png'),
       ('mcdonalds', 'bacon-tomato-deluxe', '/images/burgers/mcdonalds-bacon-tomato-deluxe-ai.png'),
       ('burgerking', 'whopper', '/images/burgers/burgerking-whopper-ai.png'),
       ('burgerking', 'quattro-cheese-whopper', '/images/burgers/burgerking-quattro-cheese-whopper-ai.png'),
       ('burgerking', 'long-chicken-burger', '/images/burgers/burgerking-long-chicken-burger-ai.png'),
       ('burgerking', 'shrimp-whopper', '/images/burgers/burgerking-shrimp-whopper-ai.png'),
       ('momstouch', 'deep-cheese-burger', '/images/burgers/momstouch-deep-cheese-burger-ai.png'),
       ('momstouch', 'white-garlic-burger', '/images/burgers/momstouch-white-garlic-burger-ai.png'),
       ('momstouch', 'incredible-burger', '/images/burgers/momstouch-incredible-burger-ai.png'),
       ('lotteria', 'shrimp-burger', '/images/burgers/lotteria-shrimp-burger-ai.png'),
       ('lotteria', 'ria-bulgogi-burger', '/images/burgers/lotteria-ria-bulgogi-burger-ai.png'),
       ('kfc', 'zinger-burger', '/images/burgers/kfc-zinger-burger-ai.png'),
       ('kfc', 'kernel-goldmoon-burger', '/images/burgers/kfc-kernel-goldmoon-burger-ai.png'),
       ('frankburger', 'frank-burger', '/images/burgers/frankburger-frank-burger-ai.png'),
       ('frankburger', 'jg-cheese-burger', '/images/burgers/frankburger-jg-cheese-burger-ai.png')
     ) AS images(brand_slug, product_slug, image_url)
WHERE p.brand_id = b.id
  AND b.slug = images.brand_slug
  AND p.slug = images.product_slug
  AND (p.image_url IS NULL OR p.image_url = '');
