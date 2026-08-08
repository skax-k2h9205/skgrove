import { beforeEach, describe, expect, it } from 'vitest';
import {
  TOKEN_SAFETY_MARGIN_MS,
  cachedToken,
  forgetToken,
  rememberToken,
} from './calendarSession';

// 모듈 안의 값이 테스트끼리 새지 않게 매번 지운다.
beforeEach(() => forgetToken());

const NOW = 1_800_000_000_000;

describe('rememberToken / cachedToken', () => {
  it('기억한 토큰을 만료 전까지 돌려준다', () => {
    rememberToken('tok-1', 3600, NOW);
    expect(cachedToken(NOW)).toBe('tok-1');
    expect(cachedToken(NOW + 3000_000)).toBe('tok-1');
  });

  it('아무것도 기억하지 않았으면 null', () => {
    expect(cachedToken(NOW)).toBeNull();
  });

  it('만료된 토큰은 주지 않는다', () => {
    rememberToken('tok-1', 3600, NOW);
    expect(cachedToken(NOW + 3600_000)).toBeNull();
  });

  it('만료 직전에도 주지 않는다 — 조회 도중 죽는 것을 막는다', () => {
    rememberToken('tok-1', 3600, NOW);
    const justInsideMargin = NOW + 3600_000 - TOKEN_SAFETY_MARGIN_MS + 1;
    expect(cachedToken(justInsideMargin)).toBeNull();
  });

  it('여유 시간보다 더 남았으면 준다', () => {
    rememberToken('tok-1', 3600, NOW);
    const justOutsideMargin = NOW + 3600_000 - TOKEN_SAFETY_MARGIN_MS - 1;
    expect(cachedToken(justOutsideMargin)).toBe('tok-1');
  });

  it('만료 시간을 모르는 토큰(expiresIn 0)은 기억하지 않는다', () => {
    // 언제 죽는지 모르는 채로 재사용하면 조회가 조용히 401 이 된다.
    rememberToken('tok-1', 0, NOW);
    expect(cachedToken(NOW)).toBeNull();
  });

  it('빈 토큰은 기억하지 않는다', () => {
    rememberToken('', 3600, NOW);
    expect(cachedToken(NOW)).toBeNull();
  });

  it('새 토큰이 이전 토큰을 밀어낸다', () => {
    rememberToken('tok-1', 3600, NOW);
    rememberToken('tok-2', 3600, NOW);
    expect(cachedToken(NOW)).toBe('tok-2');
  });

  it('한 번 만료로 판정되면 그 뒤 더 이른 시각으로 물어도 살아나지 않는다', () => {
    rememberToken('tok-1', 3600, NOW);
    expect(cachedToken(NOW + 3600_000)).toBeNull();
    expect(cachedToken(NOW)).toBeNull();
  });
});

describe('forgetToken', () => {
  it('연결을 끊으면 토큰이 남지 않는다', () => {
    rememberToken('tok-1', 3600, NOW);
    forgetToken();
    expect(cachedToken(NOW)).toBeNull();
  });
});
