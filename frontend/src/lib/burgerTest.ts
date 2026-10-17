import { AXIS_LABELS } from '@/data/burgerTest';
import type { ResultCode, TestAxis, TestLetter, TestQuestion } from '@/types/burgerTest';

/** 축마다 [앞 글자, 뒤 글자]. 결과 코드는 AXIS_ORDER 순서로 한 글자씩 이어 붙인다. */
export const AXIS_LETTERS: Record<TestAxis, [TestLetter, TestLetter]> = {
  appetite: ['H', 'L'],
  adventure: ['A', 'C'],
  texture: ['K', 'J'],
};
export const AXIS_ORDER: TestAxis[] = ['appetite', 'adventure', 'texture'];

/** 축마다 더 많이 고른 글자를 이어 붙여 결과 코드를 만든다. 동점이면 앞 글자(H·A·K). */
export function calculateResult(questions: TestQuestion[], answers: TestLetter[]): ResultCode {
  if (answers.length !== questions.length) throw new Error('모든 질문에 답해야 결과를 계산할 수 있습니다.');
  return AXIS_ORDER.map((axis) => {
    const [first, second] = AXIS_LETTERS[axis];
    const picked = answers.filter((letter, index) => questions[index].axis === axis);
    const firstCount = picked.filter((letter) => letter === first).length;
    return firstCount >= picked.length - firstCount ? first : second;
  }).join('') as ResultCode;
}

/** 결과 코드 풀이: HCK → [{ letter: 'H', label: '든든' }, { letter: 'C', label: '클래식' }, { letter: 'K', label: '바삭' }] */
export function describeCode(code: ResultCode): { letter: TestLetter; label: string }[] {
  return AXIS_ORDER.map((axis, index) => {
    const letter = code[index] as TestLetter;
    return { letter, label: AXIS_LABELS[axis][AXIS_LETTERS[axis].indexOf(letter)] };
  });
}

/** 공유 링크의 ?result= 값이 올바른 결과 코드인지 확인한다. */
export function parseResultCode(value: string | null): ResultCode | null {
  const code = value?.trim().toUpperCase() ?? '';
  return /^[HL][AC][KJ]$/.test(code) ? (code as ResultCode) : null;
}

/** 축마다 앞 글자 쪽으로 기운 비율(0~100). 결과 화면의 성향 막대에 쓴다. */
export function axisPercents(questions: TestQuestion[], answers: TestLetter[]): Record<TestAxis, number> {
  return Object.fromEntries(AXIS_ORDER.map((axis) => {
    const picked = answers.filter((letter, index) => questions[index]?.axis === axis);
    const firstCount = picked.filter((letter) => letter === AXIS_LETTERS[axis][0]).length;
    return [axis, picked.length === 0 ? 50 : Math.round((firstCount / picked.length) * 100)];
  })) as Record<TestAxis, number>;
}
