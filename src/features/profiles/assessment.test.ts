import { describe, expect, it } from 'vitest';
import {
  DISC_COLOR,
  DISC_QUESTIONS,
  MBTI_QUESTIONS,
  scoreDisc,
  scoreMbti,
  summaryFrom,
} from './assessment';
import type { DiscKey } from '../../types';

describe('scoreMbti', () => {
  it('모든 a 응답이면 ESTJ, 각 축 100', () => {
    const answers = Object.fromEntries(MBTI_QUESTIONS.map((q) => [q.id, 'a' as const]));
    const { type, scores } = scoreMbti(answers);
    expect(type).toBe('ESTJ');
    expect(scores).toEqual({ EI: 100, SN: 100, TF: 100, JP: 100 });
  });

  it('모든 b 응답이면 INFP, 각 축 0', () => {
    const answers = Object.fromEntries(MBTI_QUESTIONS.map((q) => [q.id, 'b' as const]));
    const { type, scores } = scoreMbti(answers);
    expect(type).toBe('INFP');
    expect(scores).toEqual({ EI: 0, SN: 0, TF: 0, JP: 0 });
  });

  it('미응답은 중립 50 → 첫 글자 쪽으로 기운다', () => {
    const { scores } = scoreMbti({});
    expect(scores.EI).toBe(50);
  });

  it('한 축에서 3:1 이면 lean 75', () => {
    const ei = MBTI_QUESTIONS.filter((q) => q.axis === 'EI');
    const answers: Record<string, 'a' | 'b'> = {
      [ei[0].id]: 'a', [ei[1].id]: 'a', [ei[2].id]: 'a', [ei[3].id]: 'b',
    };
    expect(scoreMbti(answers).scores.EI).toBe(75);
  });
});

describe('scoreDisc', () => {
  it('최다 득표가 1차 유형', () => {
    const answers: Record<string, DiscKey> = {};
    DISC_QUESTIONS.forEach((q, i) => { answers[q.id] = i < 8 ? 'C' : 'D'; });
    const { type, secondary, scores } = scoreDisc(answers);
    expect(type).toBe('C');
    expect(secondary).toBe('D');
    expect(scores.C).toBe(8);
    expect(scores.D).toBe(4);
  });

  it('동점은 D>I>S>C 순으로 1차', () => {
    const { type } = scoreDisc({ a: 'S', b: 'I' });
    expect(type).toBe('I'); // I 가 S 보다 우선
  });
});

describe('매핑', () => {
  it('DISC → 색 (D=red,I=yellow,S=green,C=blue)', () => {
    expect(DISC_COLOR).toEqual({ D: 'red', I: 'yellow', S: 'green', C: 'blue' });
  });

  it('summaryFrom 은 character 에 MBTI·DISC 라벨을 담는다', () => {
    const s = summaryFrom('INFP', 'C');
    expect(s.character).toBe('INFP · 신중형');
    expect(s.trait).toBe('기준형 설계자');
  });

  it('MBTI 16문항·DISC 12문항 구성', () => {
    expect(MBTI_QUESTIONS).toHaveLength(16);
    expect(DISC_QUESTIONS).toHaveLength(12);
    // 각 DISC 문항은 D/I/S/C 4보기
    expect(DISC_QUESTIONS.every((q) => q.options.length === 4)).toBe(true);
  });
});
