import type { Identity, IssueVisibility } from './types';

// 접수 본문을 E2E 암호화할지, 그리고 작성자 본인을 수신자에 포함할지 결정한다.
// - 익명글: 항상 암호화(운영자 불가독). 작성자는 불명이라 수신자에서 제외.
// - 실명 + '리더만 보기': 암호화하되 작성자도 수신자에 포함 → 본인이 '내 접수'에서 재열람.
// - 실명 + '안건 후보로 공개 가능': 공개될 수 있어야 하므로 암호화하지 않는다.
export function encryptionPlan(
  author: Identity,
  visibility: IssueVisibility,
): { encrypt: boolean; includeAuthor: boolean } {
  if (author === '익명') return { encrypt: true, includeAuthor: false };
  if (author === '실명' && visibility === '리더만 보기') return { encrypt: true, includeAuthor: true };
  return { encrypt: false, includeAuthor: false };
}
