import { describe, it, expect } from 'vitest';
import { clampProgress, clampLevel, isValidCompetency, curveSeries, nextStatus } from './growthRules';
import type { CompetencyLogEntry } from './types';

describe('growthRules', () => {
  it('clampProgress: 0–100 정수', () => {
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(150)).toBe(100);
    expect(clampProgress(33.7)).toBe(34);
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(100)).toBe(100);
    expect(clampProgress(Number.NaN)).toBe(0);
  });

  it('clampLevel: 1–5 정수', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(9)).toBe(5);
    expect(clampLevel(3)).toBe(3);
    expect(clampLevel(2.6)).toBe(3);
  });

  it('isValidCompetency: 세트 내만 true', () => {
    expect(isValidCompetency('실행·개발')).toBe(true);
    expect(isValidCompetency('없는역량')).toBe(false);
  });

  it('nextStatus: 100이면 완료, 그 외 진행중', () => {
    expect(nextStatus(100)).toBe('완료');
    expect(nextStatus(50)).toBe('진행중');
    expect(nextStatus(0)).toBe('진행중');
  });

  it('curveSeries: 특정 역량·by 만 골라 시간순 정렬', () => {
    const log: CompetencyLogEntry[] = [
      { id: '3', ownerEmail: 'a', competency: '실행·개발', level: 4, by: 'self', at: '2026-03-01' },
      { id: '1', ownerEmail: 'a', competency: '실행·개발', level: 2, by: 'self', at: '2026-01-01' },
      { id: '2', ownerEmail: 'a', competency: '실행·개발', level: 5, by: 'leader', at: '2026-02-01' },
      { id: '4', ownerEmail: 'a', competency: '협업·소통', level: 1, by: 'self', at: '2026-01-01' },
    ];
    const s = curveSeries(log, '실행·개발', 'self');
    expect(s.map((p) => p.level)).toEqual([2, 4]); // 시간순, self·실행·개발만
    expect(s.map((p) => p.at)).toEqual(['2026-01-01', '2026-03-01']);
  });
});
