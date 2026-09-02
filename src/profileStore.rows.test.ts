import { describe, expect, it } from 'vitest';
import { dedupeProfileRows } from './profileStore';

// profiles 테이블 행을 이름/owner_email 만 채워 흉내낸다(나머지 필드는 dedupe 와 무관).
const row = (name: string, ownerEmail: string | null, key: string) =>
  ({ name, owner_email: ownerEmail, profile_key: key }) as never;

describe('dedupeProfileRows', () => {
  it('같은 이름에 이름키 시드 행 + 이메일키 본인 행이면 본인 행만 남긴다', () => {
    const rows = [
      row('김승현', null, '김승현'), // 시드(이름키)
      row('김승현', 'k2h9205@sk.com', 'k2h9205@sk.com'), // 본인 진단(이메일키)
    ];
    const kept = dedupeProfileRows(rows);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ owner_email: 'k2h9205@sk.com' });
  });

  it('본인 저장이 없는 시드 전용 행은 그대로 남긴다', () => {
    const rows = [row('나윤서', null, '나윤서')];
    expect(dedupeProfileRows(rows)).toHaveLength(1);
  });

  it('둘 다 주인이 있는 동명이인은 합치지 않는다', () => {
    const rows = [
      row('김승현', 'a@sk.com', 'a@sk.com'),
      row('김승현', 'b@sk.com', 'b@sk.com'),
    ];
    expect(dedupeProfileRows(rows)).toHaveLength(2);
  });

  it('앞뒤 공백만 다른 이름도 같은 사람으로 본다', () => {
    const rows = [
      row('김승현 ', null, '김승현 '),
      row('김승현', 'k2h9205@sk.com', 'k2h9205@sk.com'),
    ];
    const kept = dedupeProfileRows(rows);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ owner_email: 'k2h9205@sk.com' });
  });
});
