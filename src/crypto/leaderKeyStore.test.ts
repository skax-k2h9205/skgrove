import { describe, it, expect } from 'vitest';
import { recordToRow, rowToRecord, type LeaderKeyRecord } from './leaderKeyStore';

const rec: LeaderKeyRecord = {
  accountId: 'USR-1',
  publicJwk: { kty: 'EC', crv: 'P-256', x: 'xx', y: 'yy' },
  encPrivPassphrase: { salt: 'sp', iv: 'ip', ciphertext: 'cp' },
  encPrivRecovery: { salt: 'sr', iv: 'ir', ciphertext: 'cr' },
  alg: 'v1:test',
};

describe('leaderKeyStore mapping', () => {
  it('record→row→record 라운드트립', () => {
    const back = rowToRecord(recordToRow(rec));
    expect(back).toEqual(rec);
  });

  it('row 는 감싼 개인키를 문자열(암호문)로만 담는다 — 평문 개인키 성분 없음', () => {
    const row = recordToRow(rec);
    expect(typeof row.enc_priv_passphrase).toBe('string');
    expect(row.salt_pass).toBe('sp');
    expect(row.salt_recovery).toBe('sr');
    // public_key 는 공개값이라 그대로. 개인키 d 는 애초에 감싼 문자열 안에만.
    expect(JSON.stringify(row)).not.toContain('"d"');
  });
});
