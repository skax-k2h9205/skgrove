import { describe, expect, it } from 'vitest';
import { generationChoices, generationLabelOf, generationValueOf } from './generation';

/*
  Profiles(프로필 입력)와 seatingRules(자리배치)가 같은 구간을 봐야 한다.
  구간을 옮기거나 바꾸면 조뽑기 균형(Connect.getAgeMood)과도 어긋나므로 여기서 고정한다.
*/

describe('generationValueOf — 생년 → 구간 대표 연도', () => {
  it.each([
    ['2001', '1999'],
    ['1997', '1999'],
    ['1996', '1993'],
    ['1990', '1993'],
    ['1989', '1985'],
    ['1975', '1985'],
  ])('%s 년생은 %s 구간', (birth, expected) => {
    expect(generationValueOf(birth)).toBe(expected);
  });

  it('경계는 1997 과 1990 이다', () => {
    expect(generationValueOf('1997')).not.toBe(generationValueOf('1996'));
    expect(generationValueOf('1990')).not.toBe(generationValueOf('1989'));
  });

  it('비었거나 숫자가 아니면 빈 문자열', () => {
    expect(generationValueOf('')).toBe('');
    expect(generationValueOf('몰라요')).toBe('');
  });

  it('대표 연도를 다시 넣어도 같은 구간이다 (저장값 왕복)', () => {
    generationChoices.forEach((choice) => {
      expect(generationValueOf(choice.value)).toBe(choice.value);
    });
  });
});

describe('generationLabelOf — 생년 → 구간 이름', () => {
  it.each([
    ['2001', '새싹'],
    ['1994', '브릿지'],
    ['1988', '든든한'],
  ])('%s 년생은 %s', (birth, label) => {
    expect(generationLabelOf(birth)).toBe(label);
  });

  it('모르면 빈 문자열 — 자리배치에서 조건 제외로 쓰인다', () => {
    expect(generationLabelOf('')).toBe('');
  });
});
