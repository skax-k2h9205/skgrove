import { describe, it, expect } from 'vitest';
import { issueToRow, issueFromRow } from './issueStore';
import type { Issue } from './types';

const base: Issue = {
  id: 'SOOP-1',
  title: '제목',
  category: '회의문화',
  author: '익명',
  target: '팀리더',
  status: '접수',
  urgency: '보통',
  body: '민감한 본문',
  expectedChange: '이렇게 바뀌면',
  visibility: '리더만 보기',
  createdAt: '2026-08-15',
};

describe('issueStore row mapping', () => {
  it('암호화 글: 평문(body/expected_change)을 절대 내보내지 않는다', () => {
    const enc: Issue = {
      ...base,
      encrypted: true,
      encPayload: 'BASE64PAYLOAD',
      encKeys: [{ accountId: 'USR-1', ephemeralPub: {}, wrappedCK: 'w', iv: 'i' }],
      encAlg: 'v1:test',
    };
    const row = issueToRow(enc);
    expect(row.body).toBe('');
    expect(row.expected_change).toBe('');
    expect(row.encrypted).toBe(true);
    expect(row.enc_payload).toBe('BASE64PAYLOAD');
    expect(row.enc_keys).toHaveLength(1);
    expect(JSON.stringify(row)).not.toContain('민감한'); // 평문 유출 없음
  });

  it('암호화 글 라운드트립: from(to(x)) 가 암호화 필드를 보존', () => {
    const enc: Issue = { ...base, encrypted: true, encPayload: 'P', encKeys: [], encAlg: 'v1' };
    const back = issueFromRow(issueToRow(enc));
    expect(back.encrypted).toBe(true);
    expect(back.encPayload).toBe('P');
    expect(back.encAlg).toBe('v1');
    expect(back.body).toBe(''); // 암호화 글은 평문 본문이 비어 있다
  });

  it('평문 글: body 보존, encrypted 는 false', () => {
    const row = issueToRow(base);
    expect(row.body).toBe('민감한 본문');
    expect(row.encrypted).toBe(false);
    const back = issueFromRow(row);
    expect(back.body).toBe('민감한 본문');
  });
});
