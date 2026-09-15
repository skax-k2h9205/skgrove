/*
  세대 구간 — 프로필 입력(Profiles)과 자리배치(seatingRules)가 같은 기준을 써야 해서 여기 모았다.

  조뽑기 균형은 Connect.tsx 의 getAgeMood 가 연도 구간(>=1997 / >=1990 / 그 외)으로 판정한다.
  사용자에게 정확한 연도를 받을 이유가 없으므로 구간을 직접 고르게 하고, 저장은 각 구간의
  대표 연도로 한다. 스키마와 조뽑기 로직을 건드리지 않으면서 수집하는 개인정보만 줄인다.
*/

export type GenerationLabel = '새싹' | '브릿지' | '든든한';

export const generationChoices: { label: GenerationLabel; value: string; hint: string }[] = [
  { label: '새싹', value: '1999', hint: '1997년생 이후' },
  { label: '브릿지', value: '1993', hint: '1990~1996년생' },
  { label: '든든한', value: '1985', hint: '1989년생 이전' },
];

/**
 * 생년 → 그 구간의 대표 연도. 기존 프로필은 임의 연도(1994, 1988…)를 갖고 있어
 * 대표값과 === 로 비교하면 아무것도 선택되지 않는다. 어느 구간에 드는지로 판정한다.
 * 비었거나 숫자가 아니면 빈 문자열.
 */
export function generationValueOf(birthYear: string): string {
  const year = Number(birthYear);
  if (!birthYear || !Number.isFinite(year)) return '';
  if (year >= 1997) return '1999';
  if (year >= 1990) return '1993';
  return '1985';
}

/** 생년 → 구간 이름. 모르면 빈 문자열(자리배치에서 '조건 제외'로 쓴다). */
export function generationLabelOf(birthYear: string): GenerationLabel | '' {
  const value = generationValueOf(birthYear);
  return generationChoices.find((choice) => choice.value === value)?.label ?? '';
}
