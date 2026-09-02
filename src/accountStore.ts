import type { ManagedAccount } from './types';
import { normalizeTeamPart } from './auth';
import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import { getCurrentTenantId, withTenant } from './tenantContext';

const ACCOUNT_STORAGE_KEY = 'skgrove:accounts';
const ACCOUNT_TABLE = 'accounts';
// password_hash·must_change_password 는 이 목록에 없다 — 계정 관리(이름·역할 수정)는
// anon 으로 돌지만, 비번 컬럼 쓰기 권한은 REVOKE 로 회수했다(오직 서버 함수만 만진다).
// 여기 넣으면 계정 편집 PATCH 에 비번 컬럼이 섞여 403 이 난다.
const ACCOUNT_WRITE_KEYS = ['id','name','email','role','part','status','joined_at','photo_url',
  'is_connectioner','slack_email','auth_uid','slack_user_id','tenant_id','is_platform_owner'];

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
  // 데이터 정제 전용 관리자. 오직 이 계정(admin@sk.com)만 게시글·안건·계정을
  // 삭제할 수 있다(isAdmin). 프로덕션에는 이미 Supabase accounts 에 존재하며,
  // 여기 시드는 Supabase 미연결(로컬) 환경 폴백용이다. 비밀번호는 첫 로그인 때 설정.
  {
    id: 'ACC-SYS-ADMIN',
    name: '관리자',
    email: 'admin@sk.com',
    role: '팀리더',
    part: '전체',
    status: '활성',
    joinedAt: '2026-08-08',
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
  must_change_password?: boolean | null;
  auth_uid?: string | null;
  slack_user_id?: string | null;
  tenant_id?: string | null;
  is_platform_owner?: boolean | null;
};

// 로그인 후(테넌트 확정)에는 결과를 반드시 현재 테넌트로 좁힌다. mount 의 전체 로드가
// localStorage 에 남긴 '전 테넌트 명단'이나 스코프 조회 실패 시의 폴백을 통해 다른 팀
// 계정(데모 등)이 계정관리에 새던 것을 막는다. 테넌트 없는 시스템 계정(관리자 시드)은 남긴다.
// 로그인 전(currentTenantId=null)에는 로그인 매칭을 위해 전체를 그대로 둔다.
export function scopeAccountsToTenant(accounts: ManagedAccount[]): ManagedAccount[] {
  const tenantId = getCurrentTenantId();
  if (!tenantId) return accounts;
  return accounts.filter((account) => !account.tenantId || account.tenantId === tenantId);
}

export async function loadAccounts() {
  if (supabase) {
    const { data, error } = await withTenant(supabase.from(ACCOUNT_TABLE).select('*')).order('joined_at', { ascending: true });

    if (!error && data) {
      const accounts = scopeAccountsToTenant(ensureAdminAccount(data.map(accountFromRow)));
      rememberRemote(ACCOUNT_TABLE, data as unknown as Record<string, unknown>[], ACCOUNT_WRITE_KEYS);
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
    return fixed.length > 0 ? scopeAccountsToTenant(ensureAdminAccount(fixed)) : seedAccounts;
  } catch {
    return seedAccounts;
  }
}

export async function saveAccounts(accounts: ManagedAccount[]) {
  const nextAccounts = ensureAdminAccount(accounts);
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(nextAccounts));

  await syncRows(ACCOUNT_TABLE, nextAccounts.map(accountToRow));
}

/** 계정(등록한 사람) 삭제 — admin@sk.com 전용. Supabase accounts 에서 제거한다. */
export async function deleteAccount(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from(ACCOUNT_TABLE).delete().eq('id', id);
  if (error) {
    console.warn('Supabase account delete failed.', error);
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
    mustChangePassword: row.must_change_password ?? false,
    authUid: row.auth_uid ?? undefined,
    slackUserId: row.slack_user_id ?? undefined,
    tenantId: row.tenant_id ?? undefined,
    platformOwner: row.is_platform_owner ?? false,
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
    auth_uid: account.authUid || null,
    slack_user_id: account.slackUserId || null,
    tenant_id: account.tenantId || null,
    is_platform_owner: account.platformOwner ?? false,
    // password_hash·must_change_password 는 여기서 내보내지 않는다(서버 함수 전용 컬럼).
  };
}

/**
 * 비밀번호 해시 직접 저장 — **서버 인증이 없을 때의 폴백 전용.**
 * 서버(api/auth)가 켜지면 이 경로는 쓰이지 않는다. REVOKE 적용 후엔 403 이 나므로,
 * 서버가 없고 REVOKE 도 안 한 초기 상태에서만 동작한다(브라우저에서 해시 저장).
 */
export async function setPasswordHashRemote(email: string, hash: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from(ACCOUNT_TABLE)
    .update({ password_hash: hash, must_change_password: false })
    .eq('email', email.toLowerCase());
  if (error) console.warn('Fallback password write failed (expected after REVOKE).', error);
}
