import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import { withTenant } from './tenantContext';
import type { AgendaBallot } from './types';

const BALLOT_STORAGE_KEY = 'skgrove:ballots';
const BALLOT_TABLE = 'agenda_ballots';
const BALLOT_WRITE_KEYS = ['agenda_id','voter_key','created_at'];
const ballotId = (r: Record<string, unknown>) => `${r.agenda_id}|${r.voter_key}`;

type BallotRow = {
  agenda_id: string;
  voter_key: string;
  created_at?: string;
};

/**
 * 투표자 식별용 단방향 키.
 *
 * 안건 id를 함께 섞기 때문에 같은 사람이라도 안건마다 다른 키가 나온다.
 * 덕분에 저장된 투표용지만 봐서는 "이 사람이 어떤 안건들에 투표했는지"를 이을 수 없다.
 *
 * 한계: 브라우저는 비밀을 지킬 수 없다. 팀 명단이 알려진 상태에서 후보 메일 주소를
 * 전수 대입하면 특정 안건의 투표 여부까지는 밝혀낼 수 있다. 선택(찬성/반대)은
 * 어디에도 신원과 함께 저장되지 않으므로 그 경우에도 드러나지 않는다.
 */
export async function makeVoterKey(email: string, agendaId: string) {
  const source = `${agendaId}:${email.trim().toLowerCase()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function loadBallots() {
  if (supabase) {
    const { data, error } = await withTenant(supabase.from(BALLOT_TABLE).select('*'));

    if (!error && data) {
      const ballots = data.map(ballotFromRow);
      rememberRemote(BALLOT_TABLE, data as unknown as Record<string, unknown>[], BALLOT_WRITE_KEYS, ballotId);
      window.localStorage.setItem(BALLOT_STORAGE_KEY, JSON.stringify(ballots));
      return ballots;
    }
  }

  try {
    const saved = window.localStorage.getItem(BALLOT_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as AgendaBallot[]) : [];
  } catch {
    return [];
  }
}

/** 서버 저장 성공 여부. false는 "이 기기에만 남았다"는 뜻이다(issueStore와 같은 규약). */
export async function saveBallots(ballots: AgendaBallot[]): Promise<boolean> {
  window.localStorage.setItem(BALLOT_STORAGE_KEY, JSON.stringify(ballots));

  return syncRows(BALLOT_TABLE, ballots.map(ballotToRow),
                  { onConflict: 'agenda_id,voter_key', idOf: ballotId });
}

export function hasVoted(ballots: AgendaBallot[], agendaId: string, voterKey: string) {
  return ballots.some((ballot) => ballot.agendaId === agendaId && ballot.voterKey === voterKey);
}

function ballotFromRow(row: BallotRow): AgendaBallot {
  return {
    agendaId: row.agenda_id,
    voterKey: row.voter_key,
    createdAt: row.created_at?.slice(0, 10) ?? '',
  };
}

function ballotToRow(ballot: AgendaBallot): BallotRow {
  return {
    agenda_id: ballot.agendaId,
    voter_key: ballot.voterKey,
    created_at: ballot.createdAt || undefined,
  };
}
