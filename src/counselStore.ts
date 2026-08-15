// AI 상담 대화 영속화 — Supabase(counsel_messages) 있으면 DB, 없으면 localStorage.
//
// 프라이버시 주의: 이 앱은 실제 인증(Supabase Auth)이 없고 anon 키 + prototype RLS다.
// 따라서 author 필터는 "소프트 스코핑"이며 DB 차원에서 남의 상담 열람을 강제 차단하지
// 못한다(대나무숲·안건과 같은 신뢰 모델). 사용자가 이 한계를 인지하고 DB 저장을 택함.
import { supabase } from './supabaseClient';
import type { CounselMessage } from './types';
import { getCurrentTenantId } from './tenantContext';

const KEY = 'skgrove:counselMessages';
const TABLE = 'counsel_messages';

type Row = {
  id: string;
  session_id?: string | null;
  author?: string | null;
  mode?: string | null;
  role?: string | null;
  content?: string | null;
  partner_name?: string | null;
  created_at?: string | null;
};

function fromRow(row: Row): CounselMessage {
  return {
    id: row.id,
    sessionId: row.session_id ?? '',
    author: row.author ?? '',
    mode: row.mode === 'rule' ? 'rule' : 'counsel',
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content ?? '',
    partnerName: row.partner_name ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function toRow(m: CounselMessage): Row {
  return {
    id: m.id,
    session_id: m.sessionId,
    author: m.author,
    mode: m.mode,
    role: m.role,
    content: m.content,
    partner_name: m.partnerName ?? null,
    created_at: m.createdAt,
  };
}

function readLocal(): CounselMessage[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CounselMessage[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(all: CounselMessage[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* 용량 초과 등은 무시 — 저장 실패가 대화를 막지는 않는다. */
  }
}

/** 특정 사용자의 상담 기록을 시간순으로. */
export async function loadCounselMessages(author: string): Promise<CounselMessage[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('author', author)
      .order('created_at', { ascending: true });
    if (!error && data) {
      const msgs = (data as Row[]).map(fromRow);
      // 로컬 캐시는 이 사용자분만 유지한다(다른 사용자 기록을 이 기기에 굳이 남기지 않는다).
      writeLocal(msgs);
      return msgs;
    }
  }
  return readLocal().filter((m) => m.author === author);
}

/** 메시지 한 건 추가. 로컬은 즉시 반영하고, DB가 있으면 insert(실패해도 로컬은 유지). */
export async function insertCounselMessage(message: CounselMessage): Promise<void> {
  writeLocal([...readLocal(), message]);
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).insert({ ...toRow(message), tenant_id: getCurrentTenantId() });
  if (error) {
    console.warn('Supabase counsel insert failed. Local fallback is still updated.', error);
  }
}
