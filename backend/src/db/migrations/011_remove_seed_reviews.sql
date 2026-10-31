-- 006에서 삽입했던 샘플 한 줄 평만 제거한다.
-- 회원 리뷰 및 내용이 변경된 리뷰는 보존하며, 재실행해도 안전하다.
DELETE FROM product_reviews AS review
USING (VALUES
    (1, '버거박사', 5, '클래식한 특제 소스와 두툼한 더블 패티의 조화가 역시 근본입니다! 🍔'),
    (1, '헬스러버', 4, '단백질 27g 든든하게 챙기기 딱 좋아요. 단성비도 훌륭합니다.'),
    (4, '불맛매니아', 5, '직화 패티 향이 제대로 느껴집니다. 크기도 커서 하나만 먹어도 든든해요.'),
    (4, '치즈러버', 4, '치즈 한 장 추가해서 먹으면 불맛과 치즈 조화가 최고예요!'),
    (13, '치킨버거원탑', 5, '바삭하고 육즙 가득한 통다리살 패티... 가성비와 맛 모두 압도적입니다.')
) AS seed(product_id, author_name, rating, content)
WHERE review.user_id IS NULL
  AND review.product_id = seed.product_id
  AND review.author_name = seed.author_name
  AND review.rating = seed.rating
  AND review.content = seed.content;
