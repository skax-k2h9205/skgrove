import { initialAgendas } from './data/mockData';
import { normalizeTeamPart } from './auth';
import { supabase } from './supabaseClient';
import type { Agenda, AgendaOption } from './types';

const AGENDA_STORAGE_KEY = 'skgrove:agendas';
const AGENDA_TABLE = 'agendas';

type AgendaRow = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  source: string;
  part: Agenda['part'];
  author: Agenda['author'];
  author_name?: string | null;
  approve: number;
  reject: number;
  // 마이그레이션 전 스키마에서 읽어오면 통째로 빠져 있다. 전부 옵셔널로 두고 기본값으로 채운다.
  vote_type?: string | null;
  options?: unknown;
  multi_select?: boolean | null;
  voter_count?: number | null;
  status: Agenda['status'];
  created_at?: string;
  eligible_count?: number | null;
  deadline?: string | null;
  closed_at?: string | null;
};

export async function loadAgendas() {
  if (supabase) {
    const { data, error } = await supabase.from(AGENDA_TABLE).select('*').order('created_at', { ascending: false });

    if (!error && data) {
      const agendas = data.map(agendaFromRow);
      window.localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(agendas));
      return agendas.length > 0 ? agendas : initialAgendas;
    }
  }

  try {
    const saved = window.localStorage.getItem(AGENDA_STORAGE_KEY);
    if (!saved) return initialAgendas;
    const parsed = JSON.parse(saved) as Agenda[];
    // 로컬 캐시에도 옛 파트 이름이 남아 있다. DB 경로와 같은 정규화를 태운다.
    // 객관식 필드가 생기기 전에 저장된 캐시에는 options 자체가 없다.
    // 이 값들이 undefined인 채로 화면에 닿으면 목록이 통째로 죽으므로 여기서 채운다.
    const fixed = parsed.map((agenda) => ({
      ...agenda,
      part: normalizeTeamPart(agenda.part),
      voteType: agenda.voteType === '객관식' ? ('객관식' as const) : ('찬반' as const),
      options: parseOptions(agenda.options),
      multiSelect: agenda.multiSelect ?? false,
      voterCount: agenda.voterCount ?? 0,
    }));
    return fixed.length > 0 ? fixed : initialAgendas;
  } catch {
    return initialAgendas;
  }
}

/** 서버 저장 성공 여부. false는 "이 기기에만 남았다"는 뜻이다(issueStore와 같은 규약). */
export async function saveAgendas(agendas: Agenda[]): Promise<boolean> {
  window.localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(agendas));

  if (!supabase) return true;

  const { error } = await supabase.from(AGENDA_TABLE).upsert(agendas.map(agendaToRow), { onConflict: 'id' });

  if (error) {
    console.warn('Supabase agenda save failed. Local fallback is still updated.', error);
    return false;
  }

  return true;
}

// 캔미팅 후속 조치는 안건을 한 번에 여러 건 만든다.
// Date.now()만 쓰면 같은 밀리초에 생성된 안건끼리 id가 겹치므로 세션 카운터를 덧붙인다.
let agendaSequence = 0;

export function makeAgendaId() {
  agendaSequence += 1;
  return `AGD-${Date.now().toString(36).toUpperCase()}-${agendaSequence.toString(36).toUpperCase()}`;
}

/**
 * 라벨 목록을 집계 가능한 선택지로 만든다.
 *
 * id는 안건 안에서만 고유하면 되므로 순번을 쓴다. 라벨을 키로 삼으면 나중에 오타를 고치는 순간
 * 그 선택지에 쌓인 표가 사라지고, 같은 글자를 두 번 넣었을 때 집계가 한쪽으로 합쳐진다.
 */
export function makeAgendaOptions(labels: string[]): AgendaOption[] {
  return labels.map((label, index) => ({ id: `OPT-${index + 1}`, label, count: 0 }));
}

/**
 * jsonb 컬럼과 로컬 캐시에서 온 선택지를 앱 모델로 걸러낸다.
 *
 * 이 값은 스키마 검증을 거치지 않고 들어온다. 라벨이 없거나 count가 숫자가 아닌 항목이
 * 섞이면 집계와 정렬이 조용히 틀어지므로, 모양이 맞는 것만 통과시킨다.
 */
function parseOptions(value: unknown): AgendaOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { id, label, count } = item as Partial<AgendaOption>;
    if (typeof id !== 'string' || typeof label !== 'string' || !id || !label) return [];
    return [{ id, label, count: typeof count === 'number' && count > 0 ? Math.floor(count) : 0 }];
  });
}

function agendaFromRow(row: AgendaRow): Agenda {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category,
    source: row.source,
    part: normalizeTeamPart(row.part),
    author: row.author,
    authorName: row.author_name ?? '',
    approve: row.approve,
    reject: row.reject,
    // 저장된 값이 무엇이든 두 가지 중 하나로만 읽는다. 알 수 없는 값은 기존 안건과 같은 찬반이다.
    voteType: row.vote_type === '객관식' ? '객관식' : '찬반',
    options: parseOptions(row.options),
    multiSelect: row.multi_select ?? false,
    voterCount: row.voter_count ?? 0,
    status: row.status,
    createdAt: row.created_at?.slice(0, 10) ?? '',
    eligibleCount: row.eligible_count ?? 0,
    deadline: row.deadline?.slice(0, 10) ?? '',
    closedAt: row.closed_at?.slice(0, 10) ?? '',
  };
}

function agendaToRow(agenda: Agenda): AgendaRow {
  return {
    id: agenda.id,
    title: agenda.title,
    description: agenda.description,
    category: agenda.category,
    source: agenda.source,
    part: agenda.part,
    author: agenda.author,
    author_name: agenda.authorName,
    approve: agenda.approve,
    reject: agenda.reject,
    vote_type: agenda.voteType,
    options: agenda.options,
    multi_select: agenda.multiSelect,
    voter_count: agenda.voterCount,
    status: agenda.status,
    created_at: agenda.createdAt || undefined,
    eligible_count: agenda.eligibleCount,
    // 날짜 컬럼에 빈 문자열을 넣으면 Postgres가 거부한다. 없으면 null로 보낸다.
    deadline: agenda.deadline || null,
    closed_at: agenda.closedAt || null,
  };
}
