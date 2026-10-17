/** 성향 축. 각 축은 두 글자 중 하나로 정해진다. */
export type TestAxis = 'appetite' | 'adventure' | 'texture';

/** H 든든 / L 산뜻 · A 모험 / C 클래식 · K 바삭 / J 육즙 */
export type TestLetter = 'H' | 'L' | 'A' | 'C' | 'K' | 'J';

/** 결과 코드: 축 순서대로 세 글자 (예: HAK) */
export type ResultCode = `${'H' | 'L'}${'A' | 'C'}${'K' | 'J'}`;

export interface TestChoice {
  label: string;
  letter: TestLetter;
}

export interface TestQuestion {
  id: string;
  axis: TestAxis;
  text: string;
  choices: [TestChoice, TestChoice];
}

export interface TestResult {
  code: ResultCode;
  title: string;
  /** 한 줄 요약 */
  summary: string;
  /** 해시태그로 보여줄 짧은 특징 */
  traits: string[];
  /** 이런 사람이에요 (5개) */
  personality: string[];
  /** 이런 점이 멋져요 (3개) */
  strengths: string[];
  /** 이럴 땐 조심해요 (3개) */
  cautions: string[];
  /** 연애·친구 스타일 */
  relationship: string;
  /** DB products.slug. 실제 가격·상세 링크를 찾는 데 쓴다. */
  burgerSlug: string;
  /** DB 조회에 실패해도 보여줄 이름 */
  burgerName: string;
  /** 왜 이 버거인지 */
  burgerReason: string;
  /** 찰떡궁합: 모든 글자가 반대인 유형 (서로 없는 걸 채워 준다) */
  bestMatch: ResultCode;
  /** 상극: 가운데 글자(모험/클래식)만 다른 유형 (비슷한 듯 속도가 안 맞는다) */
  worstMatch: ResultCode;
}
