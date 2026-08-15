// 성장 카드 저장소 — 웹·iOS 공유 Supabase. 낙관적 쓰기(로컬 먼저, 원격 syncRows).
// 목표·역량 레벨은 수정형(syncRows), 이력 로그는 추가형(insert). actionItemStore 패턴을 따른다.
import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import type { CompetencyLevel, CompetencyLogEntry, GrowthGoal } from './types';

const GOALS_KEY = 'skgrove:growthGoals';
const LEVELS_KEY = 'skgrove:growthLevels';
const LOG_KEY = 'skgrove:growthLog';
const GOALS_TABLE = 'growth_goals';
const LEVELS_TABLE = 'growth_competencies';
const LOG_TABLE = 'growth_competency_log';

const GOAL_KEYS = ['id', 'owner_email', 'title', 'detail', 'due', 'progress', 'status', 'leader_comment', 'created_at', 'updated_at'];
const LEVEL_KEYS = ['id', 'owner_email', 'competency', 'self_level', 'leader_level', 'evidence', 'updated_at'];

type GoalRow = {
  id: string; owner_email: string; title: string; detail?: string | null; due?: string | null;
  progress?: number | null; status?: GrowthGoal['status'] | null; leader_comment?: string | null;
  created_at?: string | null; updated_at?: string | null;
};
type LevelRow = {
  id: string; owner_email: string; competency: string; self_level?: number | null;
  leader_level?: number | null; evidence?: string | null; updated_at?: string | null;
};
type LogRow = {
  id: string; owner_email: string; competency: string; level: number; by: 'self' | 'leader'; at?: string | null;
};

// ── row <-> model (테스트 대상) ──
export function goalToRow(g: GrowthGoal): GoalRow {
  return {
    id: g.id, owner_email: g.ownerEmail, title: g.title, detail: g.detail,
    due: g.due || null, progress: g.progress, status: g.status,
    leader_comment: g.leaderComment, created_at: g.createdAt || undefined, updated_at: g.updatedAt || undefined,
  };
}
export function goalFromRow(r: GoalRow): GrowthGoal {
  return {
    id: r.id, ownerEmail: r.owner_email, title: r.title ?? '', detail: r.detail ?? '',
    due: r.due ?? '', progress: r.progress ?? 0, status: r.status ?? '진행중',
    leaderComment: r.leader_comment ?? '', createdAt: r.created_at ?? '', updatedAt: r.updated_at ?? '',
  };
}
export function levelToRow(l: CompetencyLevel): LevelRow {
  return {
    id: l.id, owner_email: l.ownerEmail, competency: l.competency, self_level: l.selfLevel,
    leader_level: l.leaderLevel ?? null, evidence: l.evidence, updated_at: l.updatedAt || undefined,
  };
}
export function levelFromRow(r: LevelRow): CompetencyLevel {
  return {
    id: r.id, ownerEmail: r.owner_email, competency: r.competency as CompetencyLevel['competency'],
    selfLevel: r.self_level ?? 1, leaderLevel: r.leader_level ?? undefined,
    evidence: r.evidence ?? '', updatedAt: r.updated_at ?? '',
  };
}
export function logToRow(e: CompetencyLogEntry): LogRow {
  return { id: e.id, owner_email: e.ownerEmail, competency: e.competency, level: e.level, by: e.by, at: e.at || undefined };
}
export function logFromRow(r: LogRow): CompetencyLogEntry {
  return {
    id: r.id, ownerEmail: r.owner_email, competency: r.competency as CompetencyLogEntry['competency'],
    level: r.level, by: r.by, at: r.at ?? '',
  };
}

// ── I/O ──
export function makeGrowthId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function loadGrowth(): Promise<{ goals: GrowthGoal[]; levels: CompetencyLevel[]; log: CompetencyLogEntry[] }> {
  if (supabase) {
    const [g, l, lg] = await Promise.all([
      supabase.from(GOALS_TABLE).select('*'),
      supabase.from(LEVELS_TABLE).select('*'),
      supabase.from(LOG_TABLE).select('*').order('at', { ascending: true }),
    ]);
    const goals = !g.error && g.data ? (g.data as GoalRow[]).map(goalFromRow) : readLocal<GrowthGoal>(GOALS_KEY);
    const levels = !l.error && l.data ? (l.data as LevelRow[]).map(levelFromRow) : readLocal<CompetencyLevel>(LEVELS_KEY);
    const log = !lg.error && lg.data ? (lg.data as LogRow[]).map(logFromRow) : readLocal<CompetencyLogEntry>(LOG_KEY);
    if (!g.error && g.data) rememberRemote(GOALS_TABLE, g.data as unknown as Record<string, unknown>[], GOAL_KEYS);
    if (!l.error && l.data) rememberRemote(LEVELS_TABLE, l.data as unknown as Record<string, unknown>[], LEVEL_KEYS);
    window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    window.localStorage.setItem(LEVELS_KEY, JSON.stringify(levels));
    window.localStorage.setItem(LOG_KEY, JSON.stringify(log));
    return { goals, levels, log };
  }
  return { goals: readLocal(GOALS_KEY), levels: readLocal(LEVELS_KEY), log: readLocal(LOG_KEY) };
}

function readLocal<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as T[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveGoals(goals: GrowthGoal[]): Promise<boolean> {
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  return syncRows(GOALS_TABLE, goals.map(goalToRow));
}
export async function saveLevels(levels: CompetencyLevel[]): Promise<boolean> {
  window.localStorage.setItem(LEVELS_KEY, JSON.stringify(levels));
  return syncRows(LEVELS_TABLE, levels.map(levelToRow));
}
/** 이력은 추가형 — 곧바로 insert 하고 로컬 캐시에 덧붙인다. */
export async function appendLog(entry: CompetencyLogEntry): Promise<void> {
  const cache = readLocal<CompetencyLogEntry>(LOG_KEY);
  window.localStorage.setItem(LOG_KEY, JSON.stringify([...cache, entry]));
  if (supabase) {
    const { error } = await supabase.from(LOG_TABLE).insert(logToRow(entry));
    if (error) console.warn('growth_competency_log insert 실패.', error);
  }
}
