// 캔미팅 세션 삭제가 DB 까지 가는지.
//
// 실제 사고: 삭제 버튼을 누르면 화면에서는 사라지는데 새로고침하면 다시 생겼다.
// save 가 syncRows(deletes 기본 끔)라 목록에서 뺀 행을 지우지 않았기 때문이다.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deletes: { table: string; column: string; value: string }[] = [];

vi.mock('./supabaseClient', () => ({
  supabase: {
    from(table: string) {
      return {
        delete: () => ({
          eq: async (column: string, value: string) => {
            deletes.push({ table, column, value });
            return { error: null };
          },
        }),
      };
    },
  },
}));

const { deleteCanSessionRecord } = await import('./canStore');

beforeEach(() => {
  deletes.length = 0;
});

describe('deleteCanSessionRecord', () => {
  it('세션 행과 그 세션의 의견 행을 DB 에서 지운다 (의견 먼저)', async () => {
    await deleteCanSessionRecord('CAN-S-X');
    expect(deletes).toEqual([
      { table: 'can_opinions', column: 'session_id', value: 'CAN-S-X' },
      { table: 'can_sessions', column: 'id', value: 'CAN-S-X' },
    ]);
  });
});
