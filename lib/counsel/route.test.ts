import { describe, expect, it } from 'vitest';
import { detectCrisis, CRISIS_RESPONSE } from './route.js';

describe('detectCrisis', () => {
  it('직접적 위기 표현을 감지한다', () => {
    expect(detectCrisis('요즘 너무 힘들어서 죽고 싶어요')).toBe(true);
    expect(detectCrisis('그냥 다 끝내고 싶다')).toBe(true);
    expect(detectCrisis('어제 자해했어요')).toBe(true);
    expect(detectCrisis('살고 싶지 않아')).toBe(true);
  });

  it('부정문·강조 관용구는 위기로 오탐하지 않는다', () => {
    expect(detectCrisis('죽고 싶지 않아, 그냥 좀 지칠 뿐이야')).toBe(false);
    expect(detectCrisis('배고파 죽겠다')).toBe(false);
    expect(detectCrisis('오늘 팀장님 때문에 힘들었어요')).toBe(false);
  });

  it('부정구절과 독립 위기신호가 섞이면 감지한다(전체 무효화 금지)', () => {
    expect(detectCrisis('죽고 싶지 않아요. 근데 어제 자해했어요.')).toBe(true);
  });

  it('빈 입력은 false', () => {
    expect(detectCrisis('')).toBe(false);
    expect(detectCrisis(undefined as unknown as string)).toBe(false); // 방어적: undefined 도 안전
  });

  it('CRISIS_RESPONSE 는 109 와 EAP 안내를 포함한다', () => {
    expect(CRISIS_RESPONSE).toContain('109');
    expect(CRISIS_RESPONSE).toContain('EAP');
  });
});
