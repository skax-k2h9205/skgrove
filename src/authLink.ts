// Slack(OIDC) 로그인 → 앱 계정 매칭/신규 provisioning.
//
// Slack 은 '신원'만 담당한다(이메일·이름·slack user id). 역할·파트·상태·커넥셔너 같은
// 권한은 앱의 accounts 가 계속 단일 소스다. 매칭은 이메일(또는 slackEmail)로 하고,
// 매칭 실패(신규)면 첫 로그인 = 자동 활성 팀원으로 만든다(파트만 1회 물어봄).
//
// 접근 통제는 '워크스페이스 멤버십'이 한다: 이 Slack 앱은 팀 워크스페이스 내부 전용이라,
// 그 워크스페이스 멤버만 OIDC 인증을 통과한다. 그래서 이메일 도메인(@sk.com)으로 거르지 않는다
// — 팀원의 연동 Slack 이메일이 @sk.com 이 아닐 수도 있어(개인메일 등), 도메인으로 막으면
// 정상 팀원이 차단된다. (멀티테넌트로 가면 여기서 Slack team_id 로 테넌트 스코핑을 건다.)
import type { Session, User } from '@supabase/supabase-js';
import type { CurrentUser, ManagedAccount } from './types';

export type SlackIdentity = {
  uid: string; // Supabase auth user id(auth.users.id) — 향후 RLS 키
  email: string; // Slack 계정 이메일(소문자)
  name: string; // 표시 이름
  slackUserId?: string; // Slack 사용자 id(Uxxxx) — 향후 DM 을 이메일 대신 id 로
};

export type SlackResolution =
  | { kind: 'login'; account: ManagedAccount; user: CurrentUser }
  | { kind: 'newUser'; identity: SlackIdentity }
  | { kind: 'blocked'; reason: string };

const toCurrentUser = (a: ManagedAccount): CurrentUser => ({
  name: a.name,
  email: a.email,
  role: a.role,
  part: a.part,
  connectioner: a.connectioner ?? false,
});

/** Supabase 유저에서 우리에게 필요한 신원만 뽑는다. slack_oidc 메타데이터 형태에 방어적으로 접근한다. */
export function extractSlackIdentity(user: User): SlackIdentity {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const email = (str(user.email) ?? str(meta.email) ?? '').trim().toLowerCase();
  const name =
    str(meta.full_name) ??
    str(meta.name) ??
    str(meta.preferred_username) ??
    (email ? email.split('@')[0] : '팀원');
  const slackUserId = str(meta.provider_id) ?? str(meta.sub) ?? str(user.identities?.[0]?.id);
  return { uid: user.id, email, name, slackUserId };
}

/** onAuthStateChange/getSession 이 준 세션에서 신원을 뽑는다. 세션·유저가 없으면 null. */
export function identityFromSession(session: Session | null): SlackIdentity | null {
  return session?.user ? extractSlackIdentity(session.user) : null;
}

/** 신원 → 앱 계정. 매칭 있으면 상태 확인 후 로그인, @sk.com 신규면 파트 선택으로. */
export function resolveSlackAccount(identity: SlackIdentity, accounts: ManagedAccount[]): SlackResolution {
  const email = identity.email;
  if (!email) return { kind: 'blocked', reason: '슬랙 계정에 이메일이 없어 로그인할 수 없어요.' };

  // 로그인 이메일 또는 슬랙 DM 이메일(slackEmail) 어느 쪽과 일치해도 같은 사람으로 본다.
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

  // 매칭 없음 = 신규. 워크스페이스 멤버만 여기까지 오므로 도메인 검사 없이 자동가입으로 보낸다.
  return { kind: 'newUser', identity };
}
