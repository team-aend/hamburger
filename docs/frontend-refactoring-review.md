# Frontend 리팩토링 우선순위

분석일: 2026-10-03. 소스와 백엔드 연결 구조를 검토했다. 실제 브라우저/API 연동 재현은 수행하지 않았으며, 아래의 비동기 위험은 코드에 근거한 판단이다. 구현 코드는 변경하지 않았다.

우선순위는 사용자 데이터의 일관성, 비동기 동작 위험, 변경 범위와 유지보수 효과 순으로 정했다. 기능 연결 문제는 순수 리팩토링과 구분해 별도 작업으로 진행해야 한다.

## 1. P1 — 상품 데이터와 월드컵 결과 계약 정리

- 근거: `frontend/src/app/compare/page.tsx:3`은 샘플 PRODUCTS를 사용하지만 좋아요와 마이페이지는 실제 API 상품 ID를 사용한다. `frontend/src/components/ProductExplorer.tsx:60`은 URL의 ID를 샘플 목록에서 찾기 때문에 실제 상품이 누락되거나 같은 숫자의 다른 샘플 상품이 선택될 수 있다.
- 근거: 홈은 `frontend/src/lib/worldcupSession.ts:4`의 실제 productId 기반 세션을 사용하지만 랭킹은 `frontend/src/data/rankings.ts:18`, 마이페이지 기록은 `frontend/src/app/mypage/page.tsx:56`의 정적 burgers에 의존한다. 새 게임 완료는 worldcup_sessions에 저장되고 기존 랭킹/회원 기록은 worldcup_results를 읽는다. 현재 홈에는 기존 결과 제출 호출이 없다.
- 제안: 화면별 API DTO와 표시용 모델을 분리하고 명시적인 변환 함수를 둔다. 비교 화면은 실제 상품 조회로 연결한다. 월드컵 기록/랭킹은 세션 기반 집계 계약을 백엔드와 먼저 확정한 뒤 정적 카탈로그 의존성을 제거한다. 큰 정수 문자열을 사용하는 월드컵 ID를 무조건 number로 통일하지 않는다.
- 효과: 화면 간 상품 오매칭과 완료 기록 누락을 예방한다.
- 범위: 큼. API 연결 및 백엔드 집계 변경을 포함할 수 있어 순수 리팩토링과 별도 PR로 진행한다.
- 검증: 실제 좋아요 상품의 비교 링크, 샘플 목록에 없는 상품, 로그인 회원의 새 월드컵 완주 후 기록/랭킹 반영.

## 2. P1 — 추천 요청·랜덤 추첨의 수명과 경합 관리

- 근거: `frontend/src/app/recommend/page.tsx:201`의 강제 동기화와 `:235`의 조건 조회가 items/metadata/loading을 공유하지만 동기화 요청은 같은 취소 관리에 포함되지 않는다. 늦게 끝난 이전 조건의 응답이 최신 결과를 덮을 수 있다.
- 근거: `:273`의 랜덤 추첨은 요청 취소와 unmount interval 정리가 없다. 타이머 ref를 여러 추첨이 공유하며 메인 버튼의 disabled 조건에는 isRolling이 없다.
- 제안: `useRecommendations`로 조회·동기화 경로를 합치고 AbortController와 요청 버전으로 최신 요청만 상태를 갱신한다. `useRandomDraw`에서 중복 실행 차단, 요청/interval/timeout 정리를 담당한다. 검색어 debounce는 요청 경합을 해결한 뒤 추가한다.
- 효과: 필터 변경 및 화면 이동 시 오래된 결과 반영과 타이머 잔류를 줄인다.
- 범위: 중간.
- 검증: 느린 이전 요청과 빠른 최신 요청, 동기화 중 필터 변경, 연속 추첨, 추첨 중 화면 이동.

## 3. P1 — 좋아요 변경 상태와 실패 복구 정리

- 근거: `frontend/src/hooks/useProductLikes.ts:61`의 중복 요청 차단은 렌더 시점 pendingIds에 의존한다. 재렌더 전 같은 핸들러가 재호출되면 차단이 늦을 수 있다. `:71`과 `:94`의 복구는 이전 값 복원 대신 증감 역연산이어서 조회 응답과 경합하거나 0에서 감소를 보정한 경우 원래 값과 달라질 수 있다. 성공 응답의 liked 값도 반영하지 않는다.
- 근거: `frontend/src/app/mypage/page.tsx:232`는 여러 상품 취소 요청의 pending 상태를 단일 ID로 관리한다. 다른 요청의 finally가 진행 중 표시를 해제할 수 있다.
- 제안: 상품별 동기적 요청 잠금과 사용자별 요청 버전을 관리한다. 서버의 liked/count를 함께 반영하고 실패 시 변경 전 snapshot 복원 또는 재조회 정책을 명시한다. 마이페이지도 상품별 pending Set을 사용한다.
- 효과: 빠른 연속 입력, 계정 전환 및 요청 실패에서 표시 일관성을 높인다.
- 범위: 중간.
- 검증: 동일 상품 연속 호출, 서로 다른 상품 동시 취소, 초기 조회와 변경의 경합, 실패 복구, 요청 중 로그아웃.

## 4. P2 — 추천 페이지를 기능 단위로 분리

- 근거: `frontend/src/app/recommend/page.tsx`는 1,189줄이며 타입 선언, 다수의 필터 상태, 프리셋, API 조회, 랜덤 추첨, 카드와 모달을 모두 포함한다.
- 제안: DTO를 별도 타입 파일로 옮기고 필터 상태/프리셋/초기화를 reducer로 관리한다. 쿼리 생성은 순수 함수로 추출한다. FilterPanel, RecommendationCard, RandomDrawModal로 UI를 나눈다. 범용 스키마 기반 필터 엔진까지 확장할 필요는 없다.
- 효과: 필터 정책 변경과 카드/모달 수정의 영향 범위가 작아진다.
- 범위: 중간~큼. 2번의 요청 관리와 이어서 수행한다.
- 검증: 포함/제외 재료의 상호 배타성, 프리셋 및 초기화, 동일 조건의 목록/랜덤 쿼리 일치.

## 5. P2 — 월드컵과 마이페이지의 상태 로직 분리

- 근거: `frontend/src/app/page.tsx:33`은 복원, 저장소, 재시도, 멱등 키와 투표 잠금을 UI와 함께 관리한다. `frontend/src/app/mypage/page.tsx`는 686줄이며 세 탭과 회원 데이터 조회를 모두 포함한다. profile/탭 조회에는 요청 취소가 없다.
- 제안: 홈은 기존 worldcupSession API 모듈 위에 useWorldcupGame을 두고 상태 전이와 저장소 파싱을 분리한다. 저장소 read의 any를 unknown으로 바꾸고 경계에서 검증한다. 마이페이지는 이미 존재하는 LikesTab/WorldcupTab/AccountTab을 파일로 추출하고 데이터 조회를 훅으로 옮긴다.
- 효과: 오류·복원 동작을 UI와 독립적으로 검증하고, 계정 전환/탭 이동 시 요청 처리를 관리하기 쉬워진다.
- 범위: 중간~큼. 홈의 기존 멱등성·재시도 보장을 유지하는 작은 단계로 진행한다.
- 검증: 저장소 손상, 시작 요청 재시도, 투표 실패 후 재시도, 다른 탭 진행, 탭 이동 및 계정 전환.

## 6. P2 — 비교 선택을 순수한 상태 전이로 정리

- 근거: `frontend/src/components/ProductExplorer.tsx:77`과 `:97`은 setSelectedProducts updater 내부에서 다른 상태 setter를 호출한다. 선택 목록·표 표시·안내가 분산되어 있다. URL 초기화 effect는 빈 의존성 배열로 products를 캡처한다.
- 제안: 선택 ID, 표 열림, 안내를 reducer 또는 useCompareSelection으로 관리하고 updater에서 부수효과를 제거한다. MIN/MAX 규칙을 마이페이지와 공유한다. URL의 선택 순서와 동일 경로 내 URL 변경을 반영할 정책을 정하고, API 상품 도입 시 로딩 완료 후 초기화하도록 설계한다.
- 효과: 최대 개수와 최소 비교 개수 규칙을 한 곳에서 관리한다.
- 범위: 작음~중간.
- 검증: 4개 제한, 2개 미만에서 표 닫힘, 중복/없는 URL ID, 비동기 상품 로딩 후 URL 선택 복원.

## 7. P2 — 리팩토링을 보호하는 검증 명령 정비

- 근거: `frontend/package.json:10`의 lint는 next lint지만 ESLint 의존성/설정이 없어 설정 프롬프트에서 실패한다. 기존 테스트 파일은 있지만 frontend test/typecheck 스크립트가 없다.
- 제안: 비대화형 lint와 typecheck/test 명령을 추가한다. 현재 테스트는 backend의 tsx 의존성을 활용해 실행할 수 있으나 frontend 자체 실행 환경을 명시한다. 요청 경합·실패 복구·필터 상태 전이처럼 동작 위험이 있는 부분부터 테스트한다.
- 효과: 이후 코드 이동과 상태 로직 변경의 회귀를 검출한다.
- 범위: 작음. 실제 구현에 착수할 때 먼저 진행할 것을 권장한다.

## 검증 결과

- `npx tsc --project frontend/tsconfig.json --noEmit --incremental false`: 통과.
- `node --import tsx --test frontend/tests/worldcup-session.test.ts`: 5/5 통과.
- `npm run lint --workspace=frontend`: 실패. ESLint 미설정으로 초기 설정 프롬프트가 표시됨.
- 빌드와 실제 서버/브라우저 연동은 실행하지 않았다. 위 검증은 기존 코드의 타입과 기존 테스트에 한정된다.

실행 순서 제안: 검증 명령 정비 → 요청/좋아요 경합 관리 → 추천·마이페이지·비교 상태 분리. 상품 및 월드컵 결과 계약 정리는 사용자 영향이 가장 크므로 우선 설계하되, 백엔드와 함께 별도 작업으로 진행한다. 공통 fetch 유틸리티, footer, 포맷/CSS 중복 정리는 위 작업 이후 필요성이 확인된 범위만 추출한다.
