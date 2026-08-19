// 캔미팅 영속화 — Supabase(can_sessions/can_opinions) 있으면 DB, 없으면 localStorage.
// 세션·의견 모두 삭제 기능이 없으므로 upsert만 하고 prune은 두지 않는다(humorStore와 다른 점).
import { initialCanOpinions, initialCanSessions } from './data/mockData';
import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import { withTenant } from './tenantContext';
import type { CanFollowUp, CanMethod, CanOpinion, CanResultGroup, CanSession, CanStage, Identity, TeamPart } from './types';

const SESSIONS_KEY = 'skgrove:cansessions';
const OPINIONS_KEY = 'skgrove:canopinions';
const SESSIONS_TABLE = 'can_sessions';
const SESSION_WRITE_KEYS = ['id','topic','team_name','held_at','method','parts','stage','result_summary','result_groups','follow_up'];
const OPINION_WRITE_KEYS = ['id','session_id','part','step','content','author','author_name','selected'];
const OPINIONS_TABLE = 'can_opinions';

type CanSessionRow = {
  id: string;
  topic?: string | null;
  team_name?: string | null;
  held_at?: string | null;
  method?: string | null;
  parts?: unknown;
  stage?: string | null;
  result_summary?: string | null;
  result_groups?: unknown;
  follow_up?: unknown;
};

type CanOpinionRow = {
  id: string;
  session_id: string;
  part: string;
  step: string;
  content?: string | null;
  author: string;
  author_name?: string | null;
  selected?: boolean | null;
};

export async function loadCanSessions(): Promise<CanSession[]> {
  if (supabase) {
    const { data, error } = await withTenant(supabase.from(SESSIONS_TABLE).select('*')).order('held_at', { ascending: false });
    if (!error && data) {
      const sessions = (data as CanSessionRow[]).map(sessionFromRow);
      rememberRemote(SESSIONS_TABLE, data as unknown as Record<string, unknown>[], SESSION_WRITE_KEYS);
      writeLocal(SESSIONS_KEY, sessions);
      return sessions;   // 비어 있으면 비어 있는 것이다
    }
  }
  return readLocal(SESSIONS_KEY, supabase ? [] : initialCanSessions);
}

export async function saveCanSessions(sessions: CanSession[]) {
  writeLocal(SESSIONS_KEY, sessions);

  await syncRows(SESSIONS_TABLE, sessions.map(sessionToRow));
}

export async function loadCanOpinions(): Promise<CanOpinion[]> {
  if (supabase) {
    const { data, error } = await withTenant(supabase.from(OPINIONS_TABLE).select('*'));
    if (!error && data) {
      const opinions = (data as CanOpinionRow[]).map(opinionFromRow);
      rememberRemote(OPINIONS_TABLE, data as unknown as Record<string, unknown>[], OPINION_WRITE_KEYS);
      writeLocal(OPINIONS_KEY, opinions);
      return opinions;
    }
  }
  return readLocal(OPINIONS_KEY, supabase ? [] : initialCanOpinions);
}

export async function saveCanOpinions(opinions: CanOpinion[]) {
  writeLocal(OPINIONS_KEY, opinions);

  await syncRows(OPINIONS_TABLE, opinions.map(opinionToRow));
}

// 공용 DB에서는 여러 사람이 동시에 만들 수 있어 목록 길이 기반 id(CAN-S-3)는 충돌한다.
// 다른 스토어와 같은 방식(시각 + 세션 내 순번)으로 고유 id를 만든다.
let sessionSequence = 0;
export function makeCanSessionId() {
  sessionSequence += 1;
  return `CAN-S-${Date.now().toString(36).toUpperCase()}-${sessionSequence.toString(36).toUpperCase()}`;
}

let opinionSequence = 0;
export function makeCanOpinionId() {
  opinionSequence += 1;
  return `CAN-O-${Date.now().toString(36).toUpperCase()}-${opinionSequence.toString(36).toUpperCase()}`;
}

function readLocal<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as T[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시 (메모리 상태는 유지)
  }
}

function sessionFromRow(row: CanSessionRow): CanSession {
  return {
    id: row.id,
    topic: row.topic ?? '',
    teamName: row.team_name ?? '',
    heldAt: row.held_at ?? '',
    method: (row.method as CanMethod) ?? '오프라인',
    parts: Array.isArray(row.parts) ? (row.parts as TeamPart[]) : [],
    stage: (row.stage as CanStage) ?? 'setup',
    resultSummary: row.result_summary ?? '',
    resultGroups: Array.isArray(row.result_groups) ? (row.result_groups as CanResultGroup[]) : undefined,
    followUp: (row.follow_up as CanFollowUp | null) ?? null,
  };
}

function sessionToRow(session: CanSession): CanSessionRow {
  return {
    id: session.id,
    topic: session.topic,
    team_name: session.teamName,
    held_at: session.heldAt,
    method: session.method,
    parts: session.parts,
    stage: session.stage,
    result_summary: session.resultSummary,
    result_groups: session.resultGroups ?? null,
    follow_up: session.followUp,
  };
}

function opinionFromRow(row: CanOpinionRow): CanOpinion {
  return {
    id: row.id,
    sessionId: row.session_id,
    part: row.part as TeamPart,
    step: row.step,
    content: row.content ?? '',
    author: row.author as Identity,
    authorName: row.author_name ?? '',
    selected: row.selected ?? false,
  };
}

function opinionToRow(opinion: CanOpinion): CanOpinionRow {
  return {
    id: opinion.id,
    session_id: opinion.sessionId,
    part: opinion.part,
    step: opinion.step,
    content: opinion.content,
    author: opinion.author,
    author_name: opinion.authorName,
    selected: opinion.selected,
  };
}
