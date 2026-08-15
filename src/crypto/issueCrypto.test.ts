import { describe, it, expect } from 'vitest';
import {
  generateRecipientKeypair,
  wrapPrivateKey,
  unwrapPrivateKey,
  encryptForRecipients,
  decryptAsRecipient,
  generateRecoveryCode,
  ISSUE_ENC_ALG,
} from './issueCrypto';

describe('issueCrypto', () => {
  it('라운드트립: 수신자 개인키로 복호화되고 평문이 같다 + payload에 평문 미포함', async () => {
    const leader = await generateRecipientKeypair();
    const enc = await encryptForRecipients('민감한 익명 제보 내용', [
      { accountId: 'USR-1', publicJwk: leader.publicJwk },
    ]);
    expect(enc.alg).toBe(ISSUE_ENC_ALG);
    expect(JSON.stringify(enc)).not.toContain('민감한'); // 어디에도 평문 없음
    const out = await decryptAsRecipient(enc, 'USR-1', leader.privateJwk);
    expect(out).toBe('민감한 익명 제보 내용');
  });

  it('다중 수신자: 각자 자기 것만 복호화, 남의 개인키론 실패', async () => {
    const a = await generateRecipientKeypair();
    const b = await generateRecipientKeypair();
    const enc = await encryptForRecipients('공유 내용', [
      { accountId: 'A', publicJwk: a.publicJwk },
      { accountId: 'B', publicJwk: b.publicJwk },
    ]);
    expect(await decryptAsRecipient(enc, 'A', a.privateJwk)).toBe('공유 내용');
    expect(await decryptAsRecipient(enc, 'B', b.privateJwk)).toBe('공유 내용');
    // A 항목을 B의 개인키로 풀면 실패
    await expect(decryptAsRecipient(enc, 'A', b.privateJwk)).rejects.toThrow();
    // 존재하지 않는 수신자
    await expect(decryptAsRecipient(enc, 'NOPE', a.privateJwk)).rejects.toThrow();
  });

  it('개인키 감싸기/풀기 라운드트립, 틀린 비번은 실패', async () => {
    const { privateJwk } = await generateRecipientKeypair();
    const wrapped = await wrapPrivateKey(privateJwk, 'pass1234');
    // 저장 형태에 평문 개인키 성분(d)이 노출되지 않아야 한다
    expect(JSON.stringify(wrapped)).not.toContain(privateJwk.d!);
    const back = await unwrapPrivateKey(wrapped, 'pass1234');
    expect(back.d).toBe(privateJwk.d);
    await expect(unwrapPrivateKey(wrapped, 'wrongpass')).rejects.toThrow();
  });

  it('복구코드로도 개인키 복원 가능', async () => {
    const { privateJwk } = await generateRecipientKeypair();
    const code = generateRecoveryCode();
    const wrapped = await wrapPrivateKey(privateJwk, code);
    const back = await unwrapPrivateKey(wrapped, code);
    expect(back.d).toBe(privateJwk.d);
  });

  it('payload 변조 시 GCM 인증 실패', async () => {
    const leader = await generateRecipientKeypair();
    const enc = await encryptForRecipients('x', [{ accountId: 'U', publicJwk: leader.publicJwk }]);
    const tampered = { ...enc, payload: enc.payload.slice(0, -4) + 'AAAA' };
    await expect(decryptAsRecipient(tampered, 'U', leader.privateJwk)).rejects.toThrow();
  });

  it('복구코드는 그룹 표기의 충분한 엔트로피 길이', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4})+$/);
    expect(code.replace(/-/g, '').length).toBeGreaterThanOrEqual(20);
    // 두 번 생성하면 다르다(랜덤)
    expect(code).not.toBe(generateRecoveryCode());
  });
});
