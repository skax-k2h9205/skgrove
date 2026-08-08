import { describe, expect, it } from 'vitest';
import { MIN_MEMBERS_TO_REVEAL, isRevealable } from './metricsPrivacy';

describe('isRevealable', () => {
  it('기준 인원을 채우면 공개한다', () => {
    expect(isRevealable({ members: MIN_MEMBERS_TO_REVEAL })).toBe(true);
    expect(isRevealable({ members: MIN_MEMBERS_TO_REVEAL + 5 })).toBe(true);
  });

  it('기준에 한 명이라도 모자라면 공개하지 않는다', () => {
    expect(isRevealable({ members: MIN_MEMBERS_TO_REVEAL - 1 })).toBe(false);
  });

  it('인원이 없는 파트도 공개하지 않는다', () => {
    expect(isRevealable({ members: 0 })).toBe(false);
  });

  // 임계값을 낮추면 소수 인원 파트가 노출된다. 값을 바꾸려면 이 테스트를 먼저 보게 한다.
  it('기준은 익명 설문 도구들의 통용 범위(5~10) 안에 있어야 한다', () => {
    expect(MIN_MEMBERS_TO_REVEAL).toBeGreaterThanOrEqual(5);
    expect(MIN_MEMBERS_TO_REVEAL).toBeLessThanOrEqual(10);
  });
});
