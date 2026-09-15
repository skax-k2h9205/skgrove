// 캔미팅 권한 규칙.
//
// 세션은 파트 단위로 열린다(session.parts). 참여 파트가 아닌 사람이 들어오면 읽기만 한다 —
// 의견 제출도, 진행·수정·삭제도 못 한다. '전체' 파트와 팀리더(커넥셔너 포함)는 팀 전체를
// 보는 자리라 예외다.
import { isTeamLeader } from './auth';
import type { CanOpinion, CanSession, CurrentUser } from './types';

/** 이 사람이 이 세션에 쓸 수 있는가(참여 파트인가). */
export function canWriteCanSession(user: CurrentUser, session: Pick<CanSession, 'parts' | 'stage'>): boolean {
  // 준비 단계는 진행자가 파트를 고르는 중이라 아직 판정하지 않는다(자기 파트를 뺐다가 잠기지 않게).
  if (session.stage === 'setup') return true;
  return session.parts.includes(user.part) || user.part === '전체' || isTeamLeader(user);
}

/**
 * 본인이 낸 의견인가.
 *
 * 익명 제출은 DB 에 작성자가 없다(있으면 명단 대입으로 역추적된다). 그래서 이 브라우저가
 * 기억하는 제출 목록으로 판별한다. 실명 제출은 이름이 이미 화면에 보이므로 이름으로도 맞춘다.
 */
export function isMyOpinion(user: CurrentUser, opinion: CanOpinion, myIds: readonly string[]): boolean {
  if (myIds.includes(opinion.id)) return true;
  return opinion.author === '실명' && !!opinion.authorName && opinion.authorName === user.name;
}

/**
 * 본인 의견을 지울 수 있는 때인가.
 *
 * 수집 중에만, 그리고 진행자가 아직 고르지 않은 것만. 선정된 뒤에 지우면 결과·PPT·후속조치가
 * 이미 그 의견을 쓰고 있어 숫자와 내용이 어긋난다.
 */
export function canDeleteOwnOpinion(
  user: CurrentUser,
  opinion: CanOpinion,
  session: Pick<CanSession, 'parts' | 'stage'>,
  myIds: readonly string[],
): boolean {
  if (session.stage !== 'collect') return false;
  if (opinion.selected) return false;
  if (!canWriteCanSession(user, session)) return false;
  return isMyOpinion(user, opinion, myIds);
}
