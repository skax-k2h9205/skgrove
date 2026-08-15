// Supabase Auth 세션 → 앱 계정 매칭/신규 provisioning.
//
// 로그인 수단(이메일+비번 / Slack OIDC)과 무관하게, Supabase 세션의 신원(이메일·이름·파트)만
// 뽑아 accounts 와 잇는다. 역할·상태·커넥셔너 같은 권한은 앱의 accounts 가 단일 소스.
// 매칭은 이메일(또는 slackEmail)로, 신규 @sk.com 은 자동 활성 팀원으로.
import type { Session, User } from '@supabase/supabase-js';
import type { CurrentUser, ManagedAccount, TeamPart } from './types';
import { isCompanyEmail } from './auth';

export type AuthIdentity = {
  uid: string; // Supabase auth.users.id — 향후 RLS/테넌트 키
  email: string; // 로그인 이메일(소문자)
  name: string; // 표시 이름
  part?: TeamPart; // 가입 시 고른 소속 파트(이메일 가입은 user_metadata 로 넘어옴)
  tenantId?: string; // 가입 시 초대코드로 정해진 테넌트(user_metadata 로 넘어옴)
  slackUserId?: string; // Slack 사용자 id(Slack 로그인일 때만) — 향후 DM 을 id 로
};

export type AuthResolution =
  | { kind: 'login'; account: ManagedAccount; user: CurrentUser }
  | { kind: 'newUser'; identity: AuthIdentity }
  | { kind: 'blocked'; reason: string };

const toCurrentUser = (a: ManagedAccount): CurrentUser => ({
  name: a.name,
  email: a.email,
  role: a.role,
  part: a.part,
  connectioner: a.connectioner ?? false,
  tenantId: a.tenantId,
  platformOwner: a.platformOwner ?? false,
});

/** Supabase 유저에서 신원만 뽑는다. 이메일 가입은 user_metadata 에 full_name·part 를 담아둔다. */
export function extractIdentity(user: User): AuthIdentity {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const email = (str(user.email) ?? str(meta.email) ?? '').trim().toLowerCase();
  const name =
    str(meta.full_name) ??
    str(meta.name) ??
    str(meta.preferred_username) ??
    (email ? email.split('@')[0] : '팀원');
  const part = str(meta.part) as TeamPart | undefined;
  const tenantId = str(meta.tenant_id);
  const slackUserId = str(meta.provider_id) ?? str(meta.sub) ?? str(user.identities?.[0]?.id);
  return { uid: user.id, email, name, part, tenantId, slackUserId };
}

/** onAuthStateChange/getSession 세션에서 신원을 뽑는다. 세션·유저가 없으면 null. */
export function identityFromSession(session: Session | null): AuthIdentity | null {
  return session?.user ? extractIdentity(session.user) : null;
}

/** 신원 → 앱 계정. 매칭 있으면 상태 확인 후 로그인, @sk.com 신규면 자동가입으로. */
export function resolveAccount(identity: AuthIdentity, accounts: ManagedAccount[]): AuthResolution {
  const email = identity.email;
  if (!email) return { kind: 'blocked', reason: '계정 이메일이 없어 로그인할 수 없어요.' };

  const match = accounts.find(
    (a) => a.email.toLowerCase() === email || a.slackEmail?.toLowerCase() === email,
  );
  if (match) {
    if (match.status === '비활성')
      return { kind: 'blocked', reason: '비활성 계정이에요. 팀리더에게 계정 상태 확인을 요청해주세요.' };
    if (match.status === '승인 대기')
      return { kind: 'blocked', reason: '아직 승인 대기 중인 계정이에요. 팀리더가 활성 처리하면 로그인할 수 있어요.' };
    return { kind: 'login', account: match, user: toCurrentUser(match) };
  }

  // 매칭 없음 = 신규. 이메일 가입은 클라이언트에서 이미 @sk.com 을 거르지만, 방어적으로 한 번 더.
  if (!isCompanyEmail(email))
    return { kind: 'blocked', reason: '사내(@sk.com) 계정만 로그인할 수 있어요.' };
  return { kind: 'newUser', identity };
}
