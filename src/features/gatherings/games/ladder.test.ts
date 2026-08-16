// src/features/gatherings/games/ladder.test.ts
import { describe, expect, it } from 'vitest';
import { generateLadder, traceColumn } from './ladder';

// 결정적 테스트를 위한 가짜 rng: 정해진 수열을 순환.
function seededRng(seq: number[]) {
  let i = 0;
  return () => seq[i++ % seq.length];
}

describe('generateLadder', () => {
  const names = ['민수', '지연', '현우', '보검'];

  it('패자의 열이 커피칸(coffeeSlot)에 도달한다 — 여러 rng 에서', () => {
    for (const seq of [[0.1, 0.9, 0.3, 0.7, 0.5], [0.42], [0.05, 0.95, 0.5]]) {
      const loserIndex = 2; // 현우
      const ladder = generateLadder(names, loserIndex, seededRng(seq));
      const loserCol = ladder.columns.indexOf('현우');
      expect(loserCol).toBeGreaterThanOrEqual(0);
      expect(traceColumn(ladder, loserCol)).toBe(ladder.coffeeSlot);
    }
  });

  it('columns 는 입력 이름 전원을 정확히 한 번씩 포함한다', () => {
    const ladder = generateLadder(names, 0, seededRng([0.3, 0.6, 0.1]));
    expect([...ladder.columns].sort()).toEqual([...names].sort());
  });

  it('traceColumn 은 항상 유효한 슬롯(0..n-1)을 돌려주고, 열↔슬롯은 전단사다', () => {
    const ladder = generateLadder(names, 1, seededRng([0.2, 0.8, 0.4, 0.6]));
    const landed = names.map((_, col) => traceColumn(ladder, col));
    expect([...landed].sort()).toEqual([0, 1, 2, 3]); // 순열이어야 함(두 사람이 같은 칸에 못 감)
  });
});
