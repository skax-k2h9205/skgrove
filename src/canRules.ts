// 캔미팅 권한 규칙.
//
// 세션은 파트 단위로 열린다(session.parts). 참여 파트가 아닌 사람이 들어오면 읽기만 한다 —
// 의견 제출도, 진행·수정·삭제도 못 한다. '전체' 파트와 팀리더(커넥셔너 포함)는 팀 전체를
// 보는 자리라 예외다.
import { isTeamLeader } from './auth';
import type { CanSession, CurrentUser } from './types';

/** 이 사람이 이 세션에 쓸 수 있는가(참여 파트인가). */
export function canWriteCanSession(user: CurrentUser, session: Pick<CanSession, 'parts' | 'stage'>): boolean {
  // 준비 단계는 진행자가 파트를 고르는 중이라 아직 판정하지 않는다(자기 파트를 뺐다가 잠기지 않게).
  if (session.stage === 'setup') return true;
  return session.parts.includes(user.part) || user.part === '전체' || isTeamLeader(user);
}
