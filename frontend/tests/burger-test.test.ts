import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, RESULTS } from '../src/data/burgerTest';
import { AXIS_LETTERS, AXIS_ORDER, axisPercents, calculateResult, describeCode, parseResultCode } from '../src/lib/burgerTest';
import type { TestLetter } from '../src/types/burgerTest';

/** 질문마다 고를 글자를 축별로 정해 답안을 만든다. */
const answersFor = (pick: (axis: (typeof AXIS_ORDER)[number], nth: number) => TestLetter) => {
  const seen = { appetite: 0, adventure: 0, texture: 0 };
  return QUESTIONS.map((question) => pick(question.axis, seen[question.axis]++));
};

test('축마다 홀수 개의 질문이 있고, 선택지는 그 축의 두 글자다', () => {
  for (const axis of AXIS_ORDER) {
    const questions = QUESTIONS.filter((question) => question.axis === axis);
    assert.equal(questions.length % 2, 1, `${axis} 축 질문 수가 짝수면 동점이 생긴다`);
    for (const question of questions) {
      assert.deepEqual(question.choices.map((choice) => choice.letter), AXIS_LETTERS[axis]);
    }
  }
  assert.equal(new Set(QUESTIONS.map((question) => question.id)).size, QUESTIONS.length);
});

test('8가지 결과가 모두 있고, 궁합 결과도 존재한다', () => {
  const codes = ['H', 'L'].flatMap((a) => ['A', 'C'].flatMap((b) => ['K', 'J'].map((c) => a + b + c)));
  assert.deepEqual(Object.keys(RESULTS).sort(), codes.sort());
  for (const [code, result] of Object.entries(RESULTS)) {
    assert.equal(result.code, code);
    assert.ok(RESULTS[result.bestMatch], `${code} 의 궁합 ${result.bestMatch} 가 없다`);
    assert.notEqual(result.bestMatch, code);
  }
  assert.equal(new Set(Object.values(RESULTS).map((result) => result.burgerSlug)).size, 8);
});

test('축마다 더 많이 고른 글자로 결과 코드를 만든다', () => {
  assert.equal(calculateResult(QUESTIONS, answersFor((axis) => AXIS_LETTERS[axis][0])), 'HAK');
  assert.equal(calculateResult(QUESTIONS, answersFor((axis) => AXIS_LETTERS[axis][1])), 'LCJ');
  // 축마다 2:1 → 다수 쪽 글자
  const mixed = answersFor((axis, nth) => AXIS_LETTERS[axis][axis === 'adventure' ? (nth === 0 ? 0 : 1) : (nth === 0 ? 1 : 0)]);
  assert.equal(calculateResult(QUESTIONS, mixed), 'HCK');
});

test('답이 모자라면 결과를 계산하지 않는다', () => {
  assert.throws(() => calculateResult(QUESTIONS, ['H', 'A']));
});

test('공유 링크의 결과 코드는 올바른 세 글자만 받는다', () => {
  assert.equal(parseResultCode('HAK'), 'HAK');
  assert.equal(parseResultCode(' lcj '), 'LCJ');
  for (const value of [null, '', 'HAX', 'HAKK', 'AHK', '<script>']) {
    assert.equal(parseResultCode(value), null, String(value));
  }
});

test('성향 막대는 앞 글자를 고른 비율이다', () => {
  const answers = answersFor((axis, nth) => AXIS_LETTERS[axis][axis === 'appetite' && nth === 2 ? 1 : 0]);
  assert.deepEqual(axisPercents(QUESTIONS, answers), { appetite: 67, adventure: 100, texture: 100 });
  assert.deepEqual(axisPercents(QUESTIONS, []), { appetite: 50, adventure: 50, texture: 50 });
});

test('결과마다 해석 항목이 모두 채워져 있고, 궁합·상극 규칙을 지킨다', () => {
  const flip: Record<string, string> = { H: 'L', L: 'H', A: 'C', C: 'A', K: 'J', J: 'K' };
  for (const [code, result] of Object.entries(RESULTS)) {
    assert.equal(result.personality.length, 5, `${code} personality`);
    assert.equal(result.strengths.length, 3, `${code} strengths`);
    assert.equal(result.cautions.length, 3, `${code} cautions`);
    assert.ok(result.relationship.length > 20 && result.burgerReason.length > 20, `${code} 설명이 비어 있다`);
    assert.equal(result.bestMatch, [...code].map((letter) => flip[letter]).join(''), `${code} 찰떡궁합은 전부 반대 글자`);
    assert.equal(result.worstMatch, code[0] + flip[code[1]] + code[2], `${code} 상극은 가운데 글자만 반대`);
  }
});

test('결과 코드를 글자별 한글 성향으로 풀이한다', () => {
  assert.deepEqual(describeCode('HCK'), [
    { letter: 'H', label: '든든' },
    { letter: 'C', label: '클래식' },
    { letter: 'K', label: '바삭' },
  ]);
  assert.deepEqual(describeCode('LAJ').map((part) => part.label), ['산뜻', '모험', '육즙']);
});
