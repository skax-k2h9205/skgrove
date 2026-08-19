import { initialIssues } from './data/mockData';
import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import { withTenant } from './tenantContext';
import type { Issue } from './types';

const ISSUE_STORAGE_KEY = 'skgrove:issues';
const ISSUE_TABLE = 'issues';

type IssueRow = {
  id: string;
  title: string;
  category: string;
  author: Issue['author'];
  anonymous_access_code?: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  submitter_part?: Issue['submitterPart'] | null;
  target: string;
  status: Issue['status'];
  urgency: Issue['urgency'];
  body?: string | null;
  expected_change?: string | null;
  visibility?: Issue['visibility'] | null;
  leader_reply?: string | null;
  one_on_one_note?: string | null;
  action_item?: string | null;
  leader_memo?: string | null;
  submitter_response?: string | null;
  one_on_one_response?: Issue['oneOnOneResponse'] | null;
  status_reason?: string | null;
  created_at?: string;
  // E2E 암호화(익명 전용) 컬럼
  encrypted?: boolean | null;
  enc_payload?: string | null;
  enc_keys?: Issue['encKeys'] | null;
  enc_alg?: string | null;
};

const ISSUE_WRITE_KEYS = [
  'id', 'title', 'body', 'category', 'urgency', 'visibility', 'target',
  'author', 'anonymous', 'status', 'answer', 'created_at',
  'encrypted', 'enc_payload', 'enc_keys', 'enc_alg',
];

export async function loadIssues() {
  if (supabase) {
    const { data, error } = await withTenant(supabase.from(ISSUE_TABLE).select('*')).order('created_at', { ascending: false });

    if (!error && data) {
      const issues = data.map(issueFromRow);
      rememberRemote(ISSUE_TABLE, data as unknown as Record<string, unknown>[], ISSUE_WRITE_KEYS);
      window.localStorage.setItem(ISSUE_STORAGE_KEY, JSON.stringify(issues));
      // **비어 있으면 비어 있는 것이다.** 예전엔 여기서 시드를 돌려줬는데,
      // 그러면 전부 삭제한 다음 아무 저장이나 해도 시드가 DB 로 되돌아간다.
      return issues;
    }
    // 읽기 실패 — 로컬 캐시만. 시드로 떨어지면 그게 저장을 타고 프로덕션에 올라간다.
    return readLocalIssues();
  }

  // Supabase 미설정(로컬 전용 데모)일 때만 시드를 쓴다.
  const local = readLocalIssues();
  return local.length ? local : initialIssues;
}

function readLocalIssues(): Issue[] {
  try {
    const saved = window.localStorage.getItem(ISSUE_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as Issue[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 서버 저장까지 성공했는지 돌려준다.
 * 예전에는 실패를 console.warn으로만 남겨서, 접수자는 저장이 안 된 사실을 알 수 없었다.
 * false는 "이 기기에만 남았다"는 뜻이고, 호출부가 그것을 사용자에게 알린다.
 */
export async function saveIssues(issues: Issue[]): Promise<boolean> {
  window.localStorage.setItem(ISSUE_STORAGE_KEY, JSON.stringify(issues));
  // 배열 전체가 아니라 **바뀐 접수만** 쓴다. 삭제는 deleteIssue 가 따로 한다.
  return syncRows(ISSUE_TABLE, issues.map(issueToRow));
}

/** 접수 삭제(admin@sk.com 전용). Supabase issues 에서 제거한다. */
export async function deleteIssue(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from(ISSUE_TABLE).delete().eq('id', id);
  if (error) console.warn('Supabase issue delete failed.', error);
}

export function makeIssueId() {
  return `SOOP-${Date.now().toString(36).toUpperCase()}`;
}

export function issueFromRow(row: IssueRow): Issue {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    author: row.author,
    anonymousAccessCode: row.anonymous_access_code ?? undefined,
    submitterName: row.submitter_name ?? undefined,
    submitterEmail: row.submitter_email ?? undefined,
    submitterPart: row.submitter_part ?? undefined,
    target: row.target,
    status: row.status,
    urgency: row.urgency,
    body: row.body ?? '',
    expectedChange: row.expected_change ?? '',
    // 공개 범위가 기록되지 않은 과거 데이터는 접수자의 선택을 알 수 없다.
    // 모르면 공개하지 않는 쪽으로 기운다.
    visibility: row.visibility ?? '리더만 보기',
    leaderReply: row.leader_reply ?? undefined,
    oneOnOneNote: row.one_on_one_note ?? undefined,
    actionItem: row.action_item ?? undefined,
    leaderMemo: row.leader_memo ?? undefined,
    submitterResponse: row.submitter_response ?? undefined,
    oneOnOneResponse: row.one_on_one_response ?? undefined,
    statusReason: row.status_reason ?? undefined,
    // 과거 데이터에는 값이 없을 수 있다. 없으면 경과일을 계산하지 않는다(빈 문자열).
    createdAt: row.created_at ?? '',
    encrypted: row.encrypted ?? undefined,
    encPayload: row.enc_payload ?? undefined,
    encKeys: row.enc_keys ?? undefined,
    encAlg: row.enc_alg ?? undefined,
  };
}

export function issueToRow(issue: Issue): IssueRow {
  // 암호화 글은 평문(body/expected_change)을 절대 내보내지 않는다 — 암호문만 저장한다.
  const isEncrypted = issue.encrypted === true;
  return {
    id: issue.id,
    title: issue.title,
    category: issue.category,
    author: issue.author,
    anonymous_access_code: issue.anonymousAccessCode ?? null,
    submitter_name: issue.submitterName ?? null,
    submitter_email: issue.submitterEmail ?? null,
    submitter_part: issue.submitterPart ?? null,
    target: issue.target,
    status: issue.status,
    urgency: issue.urgency,
    body: isEncrypted ? '' : issue.body,
    expected_change: isEncrypted ? '' : issue.expectedChange,
    visibility: issue.visibility,
    leader_reply: issue.leaderReply ?? null,
    one_on_one_note: issue.oneOnOneNote ?? null,
    action_item: issue.actionItem ?? null,
    leader_memo: issue.leaderMemo ?? null,
    submitter_response: issue.submitterResponse ?? null,
    one_on_one_response: issue.oneOnOneResponse ?? null,
    status_reason: issue.statusReason ?? null,
    created_at: issue.createdAt || undefined,
    encrypted: isEncrypted,
    enc_payload: issue.encPayload ?? null,
    enc_keys: issue.encKeys ?? null,
    enc_alg: issue.encAlg ?? null,
  };
}
