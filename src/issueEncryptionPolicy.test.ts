import { describe, expect, it } from 'vitest';
import { encryptionPlan } from './issueEncryptionPolicy';

describe('encryptionPlan', () => {
  it('익명글은 암호화하되 작성자는 수신자에 넣지 않는다(작성자 불명)', () => {
    expect(encryptionPlan('익명', '리더만 보기')).toEqual({ encrypt: true, includeAuthor: false });
    // 익명은 공개범위와 무관하게 항상 암호화.
    expect(encryptionPlan('익명', '안건 후보로 공개 가능')).toEqual({ encrypt: true, includeAuthor: false });
  });

  it('실명 + 리더만 보기는 암호화하고 작성자도 수신자에 포함한다(본인 재열람)', () => {
    expect(encryptionPlan('실명', '리더만 보기')).toEqual({ encrypt: true, includeAuthor: true });
  });

  it('실명 + 공개 가능(안건 후보)은 암호화하지 않는다(공개될 수 있어야 함)', () => {
    expect(encryptionPlan('실명', '안건 후보로 공개 가능')).toEqual({ encrypt: false, includeAuthor: false });
  });
});
