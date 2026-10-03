# 백엔드 개발 규칙

## 기능별 계층 구조

백엔드의 모든 신규 기능과 기존 기능의 구조 변경은 `src/<도메인>/` 아래 다음 구조를 따른다. 예: `src/worldcup/`, `src/auth/`, `src/recommend/`. 기능 이름은 실제 비즈니스 용어를 사용한다.

```text
src/<도메인>/
├── presentation/       # Express 라우터, 요청 검증, 쿠키, HTTP 응답
├── application/        # 유스케이스, 저장소·트랜잭션 포트, 입출력 타입
├── domain/             # 모델, 값 타입, 비즈니스 규칙, 도메인 오류
├── infrastructure/     # pg 저장소, 외부 서비스, 환경 설정·난수 등의 어댑터
└── composition.ts      # 구체 구현을 조립하고 라우터를 제공하는 진입점
```

필요한 계층만 구현한다. 디렉터리를 채우기 위한 빈 클래스, 범용 BaseRepository, 과도한 인터페이스는 추가하지 않는다. 폴더 분리만으로 DDD를 구현했다고 표현하지 않는다. 비즈니스 규칙의 위치와 의존 방향을 함께 개선한다.

## 의존 방향과 책임

- `domain`은 같은 도메인의 코드만 참조한다. Express, pg, SQL, 환경 변수, 파일·네트워크 IO, presentation/application/infrastructure에 의존하지 않는다. 시각·난수·ID 생성이 필요하면 인자로 받는다. 도메인 오류에는 HTTP 상태 코드를 넣지 않는다.
- `application`은 domain과 자신의 포트에 의존한다. 유스케이스가 처리 순서와 트랜잭션 범위를 결정한다. Express Request/Response, pg Pool/Client, SQL, 구체 저장소, process.env는 사용하지 않는다.
- `presentation`은 application/domain을 사용해 HTTP 계약을 처리한다. 요청 형식·헤더·Origin·쿠키·HTTP 제한과 상태 코드 변환을 담당하며 SQL이나 구체 저장소를 직접 호출하지 않는다. 유스케이스는 의존성으로 주입한다.
- `infrastructure`는 application의 포트를 구현한다. SQL·DB 타입 변환·연결·BEGIN/COMMIT/ROLLBACK·외부 기술 오류 처리를 담당한다. 도메인 판단과 유스케이스 흐름은 넣지 않는다. presentation은 import하지 않는다.
- `composition.ts`만 presentation과 infrastructure를 함께 알고 조립한다. 전역 라우터는 이 진입점으로 기능 라우터를 연결한다. 모듈 import만으로 DB 연결·조회·쓰기가 발생하지 않도록 한다.
- 다른 도메인의 내부 저장소·테이블 접근 구현을 직접 재사용하지 않는다. 필요한 협력은 공개 application 계약이나 포트로 표현한다. 기존 공유 DB 풀·환경 로더·쿠키 파서는 점진적 이관 동안 사용 가능하나 domain/application에서는 참조하지 않는다.

## 모델과 저장

- 경기 선택·라운드 진출처럼 비즈니스 의미가 있는 행동은 도메인 모델 또는 순수 도메인 함수로 표현한다. 단순 조회에 불필요한 aggregate를 만들지 않는다.
- SQL 행 타입과 도메인 타입을 구분하고 DB 타입 변환은 infrastructure에서 수행한다. PostgreSQL BIGINT 상품 ID는 문자열로 보존한다.
- 트랜잭션 포트는 유스케이스가 원자적으로 처리할 작업을 표현한다. 구현은 한 연결에서 실행하고 실패 시 전체 롤백한다. 중복 요청·동시성 보장은 DB 제약·잠금과 함께 검증한다.
- DB 구조 변경은 별도 마이그레이션으로 관리한다. 아키텍처 리팩터링만 하는 경우 기존 테이블·데이터·HTTP 계약을 변경하지 않는다.
- 기존 합의된 동작을 유지한다. 월드컵 시작 API의 참가 상품 수 재검증 제외 정책을 구조 변경 중 임의로 바꾸지 않는다.

## 기존 기능 이관

현재 `routes/`, `services/`, `repositories/`, `db/`, `auth/`에는 기존 기능이 남아 있다. 새 기능은 계층 구조에 작성하고, 기존 기능은 요청받은 범위 또는 해당 기능을 변경하는 작업에서 점진적으로 이관한다. 사용자 요청 없이 전체 백엔드를 한 번에 재작성하지 않는다.

월드컵 참가 옵션·시작·진행 조회·경기 선택 API는 `src/worldcup/`에서 관리한다. 기존 회원 결과 저장·랭킹은 아직 `routes/worldcup.ts`, `db/worldcup.ts`에 있으며 별도 이관 대상이다. 기존 로그인·회원·좋아요·추천 기능도 아직 이관 대상이다.

## 검증과 완료

- domain 테스트는 DB·HTTP 없이 고정 난수·시각으로 규칙을 검증한다.
- application 테스트는 포트를 대체해 처리 순서, 재요청, 실패 시 저장 여부를 검증한다.
- presentation 테스트는 HTTP 계약과 쿠키·상태 코드를 검증한다.
- infrastructure 통합 테스트는 `TEST_DATABASE_URL`의 분리된 스키마에서 SQL, 제약, 동시성, 롤백을 검증한다. 운영 DB를 테스트 DB로 사용하지 않는다.
- 수정 후 `npm run test --workspace=backend`, `npm run build --workspace=backend`, `git diff --check`를 실행한다. 통합 테스트 skip은 통과와 구분해 보고한다.
- 완료 시 변경사항을 커밋한다. 메시지는 `status: 한글 커밋 메시지` 형식으로 작성한다.
