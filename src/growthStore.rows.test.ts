import { describe, it, expect } from 'vitest';
import { goalToRow, goalFromRow, levelToRow, levelFromRow, logToRow, logFromRow, makeGrowthId } from './growthStore';
import type { CompetencyLevel, CompetencyLogEntry, GrowthGoal } from './types';

describe('growthStore row mapping', () => {
  it('goal 라운드트립 + 빈 due 는 null', () => {
    const g: GrowthGoal = {
      id: 'GRW-1', ownerEmail: 'a@sk.com', title: '리팩터링', detail: '모듈 분리',
      due: '', progress: 40, status: '진행중', leaderComment: '좋아요', createdAt: '2026-08-15', updatedAt: '2026-08-15',
    };
    const row = goalToRow(g);
    expect(row.due).toBeNull();
    expect(row.owner_email).toBe('a@sk.com');
    expect(goalFromRow(row)).toEqual(g);
  });

  it('level 라운드트립 + leaderLevel 없으면 null↔undefined', () => {
    const l: CompetencyLevel = {
      id: 'GRC-1', ownerEmail: 'a@sk.com', competency: '실행·개발', selfLevel: 3, evidence: '근거', updatedAt: '2026-08-15',
    };
    const back = levelFromRow(levelToRow(l));
    expect(back.leaderLevel).toBeUndefined();
    expect(back).toEqual(l);
  });

  it('log 라운드트립', () => {
    const e: CompetencyLogEntry = { id: 'GLG-1', ownerEmail: 'a@sk.com', competency: 'AI 활용', level: 4, by: 'leader', at: '2026-08-15' };
    expect(logFromRow(logToRow(e))).toEqual(e);
  });

  it('makeGrowthId: prefix 유지', () => {
    expect(makeGrowthId('GRW')).toMatch(/^GRW-[0-9A-Z]+$/);
  });
});
