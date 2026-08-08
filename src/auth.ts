import type { CurrentUser, TeamPart, UserRole } from './types';

export const userRoles: UserRole[] = ['팀원', '파트리더', '팀리더'];

export const teamParts = ['TEST혁신파트', 'ITS혁신파트', 'PM혁신파트'] as const;

/*
  옛 파트 이름 → 지금 이름.
  'PM혁신파트'가 실제 조직 이름인데 앱에는 '혁신도구파트'로 들어가 있었다.
  코드만 고치면 이미 저장된 계정·안건·모임의 part 가 어느 목록에도 없는 값이 되어,
  파트 필터에서 조용히 빠지고 파트지수에서도 사라진다. 읽는 길목에서 갈아끼운다.
  (mockData 의 티미팅 조 편성은 예전부터 실제 조직명 'PM혁신'을 따로 쓰고 있었다.)
*/
const LEGACY_PART: Record<string, TeamPart> = {
  혁신도구파트: 'PM혁신파트',
};

/** 저장소에서 올라온 파트 문자열을 지금 이름으로 맞춘다. 모르는 값은 그대로 둔다. */
export function normalizeTeamPart(value: string | null | undefined): TeamPart {
  if (!value) return '전체';
  return LEGACY_PART[value] ?? (value as TeamPart);
}

// 커넥셔너 = 이 시스템을 구축하는 슈퍼관리자. 팀 역할(팀원/파트리더/팀리더)과 별개인
// 전권 플래그(accounts.is_connectioner). 리더/팀리더 게이트를 전부 통과시켜 모든 기능에 접근.
// 팀 역할·알림 라우팅은 그대로 두므로 기존 동작을 깨지 않는다. 계정 관리에서 토글한다.
export function isConnectioner(user: CurrentUser) {
  return user.connectioner === true;
}

export function isLeader(user: CurrentUser) {
  return isConnectioner(user) || user.role === '파트리더' || user.role === '팀리더';
}

export function isTeamLeader(user: CurrentUser) {
  return isConnectioner(user) || user.role === '팀리더';
}

// 커넥셔너 전권을 적용하지 않는 '순수 팀리더 역할' 체크.
// 캔미팅처럼 커넥셔너도 참여자로 의견을 내야 하는 화면에서 쓴다
// (전권으로 진행자 화면이 열리면 정작 본인 의견을 낼 수가 없다).
export function hasTeamLeaderRole(user: CurrentUser) {
  return user.role === '팀리더';
}

// 커넥셔너 전권을 적용하지 않는 '리더 역할'(파트리더·팀리더) 체크.
// 리더 관리함처럼 실제 사람-리더에게만 열려야 하는 화면에 쓴다 — 커넥셔너는
// 시스템 관리자일 뿐 사람들의 리더가 아니라, 리더에게 온 접수를 봐선 안 된다.
export function hasLeaderRole(user: CurrentUser) {
  return user.role === '파트리더' || user.role === '팀리더';
}

export function isCompanyEmail(email: string) {
  return /^[^\s@]+@sk\.com$/i.test(email.trim());
}
