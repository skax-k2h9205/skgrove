import type { ManagedAccount } from './types';
import { normalizeTeamPart } from './auth';
import { supabase } from './supabaseClient';

const ACCOUNT_STORAGE_KEY = 'skgrove:accounts';
const ACCOUNT_TABLE = 'accounts';

const adminAccount: ManagedAccount = {
  id: 'USR-ADMIN',
  name: '이선민',
  email: 'sunmin.l@sk.com',
  role: '팀리더',
  part: '전체',
  status: '활성',
  joinedAt: '2026-07-24',
  connectioner: true,
};

export const seedAccounts: ManagedAccount[] = [
  adminAccount,
  {
    id: 'USR-02',
    name: '김승현',
    email: 'k2h9205@sk.com',
    role: '파트리더',
    part: 'ITS혁신파트',
    status: '활성',
    joinedAt: '2026-07-24',
    connectioner: true,
  },
  {
    id: 'USR-03',
    name: '김수정',
    email: 'crystalk@sk.com',
    role: '팀원',
    part: 'PM혁신파트',
    status: '활성',
    joinedAt: '2026-07-24',
    connectioner: true,
  },
  {
    id: 'USR-04',
    name: '이두민',
    email: 'dumin@sk.com',
    role: '팀원',
    part: 'TEST혁신파트',
    status: '활성',
    joinedAt: '2026-07-24',
  },
];

type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: ManagedAccount['role'];
  part: ManagedAccount['part'];
  status: ManagedAccount['status'];
  joined_at: string;
  photo_url?: string | null;
  is_connectioner?: boolean | null;
  slack_email?: string | null;
  password_hash?: string | null;
};

export async function loadAccounts() {
  if (supabase) {
    const { data, error } = await supabase.from(ACCOUNT_TABLE).select('*').order('joined_at', { ascending: true });

    if (!error && data) {
      const accounts = ensureAdminAccount(data.map(accountFromRow));
      // 읽기는 DB를 다시 쓰지 않는다. 예전엔 saveAccounts로 전체 재저장했는데,
      // 옛 번들이 뜬 클라이언트가 photo_url 등을 못 읽은 채 저장하면 공유 데이터가 손상됐다.
      // (계정 사진이 통째로 NULL로 덮어써지던 원인) 로컬 캐시만 갱신한다.
      try {
        window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
      } catch {
        // localStorage 접근 불가 시 무시
      }
      return accounts;
    }
  }

  try {
    const saved = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!saved) return seedAccounts;
    const parsed = JSON.parse(saved) as ManagedAccount[];
    // 로컬 캐시에도 옛 파트 이름이 남아 있다. DB 경로와 같은 정규화를 태운다.
    const fixed = parsed.map((account) => ({ ...account, part: normalizeTeamPart(account.part) }));
    return fixed.length > 0 ? ensureAdminAccount(fixed) : seedAccounts;
  } catch {
    return seedAccounts;
  }
}

export async function saveAccounts(accounts: ManagedAccount[]) {
  const nextAccounts = ensureAdminAccount(accounts);
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(nextAccounts));

  if (!supabase) return;

  const { error } = await supabase.from(ACCOUNT_TABLE).upsert(nextAccounts.map(accountToRow), { onConflict: 'id' });

  if (error) {
    console.warn('Supabase account save failed. Local fallback is still updated.', error);
  }
}

export function makeAccountId() {
  return `USR-${Date.now().toString(36).toUpperCase()}`;
}

function ensureAdminAccount(accounts: ManagedAccount[]) {
  // 레거시 관리자 이메일(sunmin@sk.com) 정리.
  const withoutLegacyAdmin = accounts.filter((account) => account.email.toLowerCase() !== 'sunmin@sk.com');
  const hasAdmin = withoutLegacyAdmin.some((account) => account.email.toLowerCase() === adminAccount.email);
  // 관리자 계정이 아예 없을 때만 시드로 보장(최초 실행). 이미 있으면 DB 값을 그대로 존중한다.
  // (예전엔 매번 role/part를 팀리더/전체로 덮어써서 계정 관리에서 역할을 바꿔도 원복됐다.
  //  전권은 커넥셔너 플래그로 별도 보장되므로 역할을 강제할 필요가 없다.)
  return hasAdmin ? withoutLegacyAdmin : [adminAccount, ...withoutLegacyAdmin];
}

function accountFromRow(row: AccountRow): ManagedAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    // 옛 파트 이름('혁신도구파트')이 저장돼 있으면 지금 이름으로 갈아끼운다.
    part: normalizeTeamPart(row.part),
    status: row.status,
    joinedAt: row.joined_at,
    photoUrl: row.photo_url ?? undefined,
    connectioner: row.is_connectioner ?? false,
    slackEmail: row.slack_email ?? undefined,
    passwordHash: row.password_hash ?? undefined,
  };
}

function accountToRow(account: ManagedAccount): AccountRow {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    part: account.part,
    status: account.status,
    joined_at: account.joinedAt,
    photo_url: account.photoUrl || null,
    is_connectioner: account.connectioner ?? false,
    slack_email: account.slackEmail || null,
    password_hash: account.passwordHash || null,
  };
}
