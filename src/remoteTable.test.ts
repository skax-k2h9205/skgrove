// remoteTable — "지운 데이터가 되살아나지 않는다"를 지키는 규칙들.
//
// 이 파일이 지키려는 실제 사고: admin 이 정제 화면에서 데이터를 지웠는데,
// 옛 목록을 들고 있던 다른 탭이 저장 한 번으로 전부 되살려 놓던 일.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

// supabase 클라이언트를 최소한으로 흉내낸다. 실제로 어떤 쿼리가 나갔는지만 본다.
const calls: { upserts: Row[][]; deletes: string[][] } = { upserts: [], deletes: [] };
let selectRows: Row[] | null = [];

vi.mock('./supabaseClient', () => ({
  supabase: {
    from() {
      return {
        select: async () => ({ data: selectRows, error: selectRows ? null : new Error('down') }),
        upsert: async (rows: Row[]) => {
          calls.upserts.push(rows);
          return { error: null };
        },
        delete: () => ({
          in: async (_col: string, ids: string[]) => {
            calls.deletes.push(ids);
            return { error: null };
          },
        }),
      };
    },
  },
}));

const { rememberRemote, syncRows, forgetRemote } = await import('./remoteTable');

const post = (id: string, body: string) => ({ id, body });

beforeEach(() => {
  calls.upserts = [];
  calls.deletes = [];
  selectRows = [];
  forgetRemote();
});

describe('syncRows', () => {
  it('안 바뀐 행은 쓰지 않는다 — 남이 지운 데이터를 되살리지 않는 핵심', async () => {
    rememberRemote('t', [post('A', 'a'), post('B', 'b')], ['id', 'body']);

    await syncRows('t', [post('A', 'a'), post('B', 'b')]);

    expect(calls.upserts).toEqual([]);
  });

  it('새로 생긴 행과 바뀐 행만 쓴다', async () => {
    rememberRemote('t', [post('A', 'a'), post('B', 'b')], ['id', 'body']);

    await syncRows('t', [post('A', 'a'), post('B', 'CHANGED'), post('C', 'c')]);

    expect(calls.upserts).toHaveLength(1);
    expect(calls.upserts[0]).toEqual([post('B', 'CHANGED'), post('C', 'c')]);
  });

  it('원격을 한 번도 못 읽었으면 아무것도 쓰지 않는다 — 시드가 DB 로 올라가는 경로 차단', async () => {
    // rememberRemote 를 부르지 않은 상태 = 이번 세션에 원격 로드 성공 이력 없음
    await syncRows('t', [post('SEED-1', '목업'), post('SEED-2', '목업')]);

    expect(calls.upserts).toEqual([]);
    expect(calls.deletes).toEqual([]);
  });

  it('기본값은 삭제하지 않는다 — save 가 부분 목록으로 불려도 남의 행이 지워지지 않게', async () => {
    rememberRemote('t', [post('A', 'a'), post('B', 'b')], ['id', 'body']);

    await syncRows('t', [post('A', 'a')]);

    expect(calls.deletes).toEqual([]);
  });

  it('deletes 를 켜면 내가 뺀 행만 지운다', async () => {
    rememberRemote('t', [post('A', 'a'), post('B', 'b')], ['id', 'body']);

    await syncRows('t', [post('A', 'a')], { deletes: true });

    expect(calls.deletes).toEqual([['B']]);
  });

  it('삭제 후 다시 저장해도 지운 행이 되돌아오지 않는다', async () => {
    rememberRemote('t', [post('A', 'a'), post('B', 'b')], ['id', 'body']);
    await syncRows('t', [post('A', 'a')], { deletes: true });
    calls.upserts = [];
    calls.deletes = [];

    // 같은 목록으로 한 번 더 저장 — B 는 어디에도 다시 나타나면 안 된다
    await syncRows('t', [post('A', 'a')], { deletes: true });

    expect(calls.upserts).toEqual([]);
    expect(calls.deletes).toEqual([]);
  });

  it('복합키 테이블은 idOf 로 구분한다(투표: agenda_id + voter_key)', async () => {
    const ballot = (a: string, v: string) => ({ agenda_id: a, voter_key: v });
    const idOf = (r: Row) => `${r.agenda_id}|${r.voter_key}`;
    rememberRemote('b', [ballot('AGD-1', 'x')], ['agenda_id', 'voter_key'], idOf);

    await syncRows('b', [ballot('AGD-1', 'x'), ballot('AGD-1', 'y')],
                   { onConflict: 'agenda_id,voter_key', idOf });

    expect(calls.upserts[0]).toEqual([ballot('AGD-1', 'y')]);
  });

  it('우리가 쓰지 않는 컬럼이 원격에 더 있어도 "바뀐 것"으로 보지 않는다', async () => {
    // created_at 같은 DB 기본값이 매번 diff 를 만들면 전체가 다시 upsert 된다
    rememberRemote('t', [{ id: 'A', body: 'a', server_only: 123 }], ['id', 'body']);

    await syncRows('t', [post('A', 'a')]);

    expect(calls.upserts).toEqual([]);
  });
});
