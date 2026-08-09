// 원격 테이블 동기화 — "내가 실제로 바꾼 것만" 쓴다.
//
// 예전 방식은 저장할 때마다 메모리에 있는 배열 전체를 upsert 하고, 그 목록에 없는
// DB 행을 전부 지웠다(prune). 그러면 **DB가 그 브라우저의 메모리 상태로 통째로 맞춰진다.**
// 문제는 이것이다:
//
//   1. admin 이 정제 화면에서 데이터를 지운다 → DB 비워짐
//   2. 그런데 다른 사람 탭에는 옛 목록이 localStorage 에 그대로 남아 있다
//   3. 그 사람이 글 하나만 써도 옛 목록 전체가 upsert 되어 **지운 게 되살아난다**
//
// 게다가 Supabase 읽기가 한 번만 실패해도 스토어가 시드(mockData)로 떨어지는데,
// 그 상태에서 저장하면 **시드가 프로덕션 DB 로 올라간다.**
//
// 그래서 여기서는 이 클라이언트가 **원격에서 마지막으로 본 스냅샷**과 비교해서
//   · 새로 생겼거나 내용이 바뀐 행만 upsert
//   · 내가 목록에서 뺀 행만 delete
// 만 한다. 건드리지 않은 행은 아예 쓰지 않으므로, 남이 지운 데이터를 되살리지 않는다.
//
// 원격 상태를 한 번도 못 봤다면(오프라인·읽기 실패) **원격에는 아무것도 쓰지 않는다.**
// 모르는 상태에서 덮어쓰는 것보다 로컬에만 두는 편이 안전하다.
import { supabase } from './supabaseClient';

type Row = Record<string, unknown>;

/** 테이블별 스냅샷: id → 우리가 쓰는 컬럼만 추린 직렬화 문자열. */
const snapshots = new Map<string, Map<string, string>>();

/** 키 순서에 흔들리지 않는 비교용 직렬화. */
function stable(row: Row): string {
  return JSON.stringify(Object.keys(row).sort().map((k) => [k, row[k] ?? null]));
}

/** 원격 행에서 우리가 쓰는 컬럼만 남긴다(created_at 기본값 등 때문에 항상 다르게 보이는 걸 막는다). */
function pick(row: Row, keys: string[]): Row {
  const out: Row = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

/**
 * 원격에서 방금 읽은 행들을 스냅샷으로 기억한다. load 성공 직후에 부른다.
 * writeKeys 는 우리가 저장할 때 쓰는 컬럼 목록.
 */
export function rememberRemote(
  table: string,
  rows: Row[],
  writeKeys: string[],
  idOf: (row: Row) => string = (r) => String(r.id ?? ''),
) {
  const m = new Map<string, string>();
  for (const r of rows) {
    const id = idOf(r);
    if (id) m.set(id, stable(pick(r, writeKeys)));
  }
  snapshots.set(table, m);
}

/**
 * 현재 목록을 원격에 반영한다. **바뀐 것만** 쓰고, (deletes 를 켠 경우) **내가 뺀 것만** 지운다.
 *
 * 스냅샷이 없으면(=이번 세션에 원격을 성공적으로 읽은 적이 없으면) **아무것도 쓰지 않는다.**
 * 여기서 원격을 새로 읽어 스냅샷을 만들면 안 된다 — 그러면 "원격엔 없고 내 로컬엔 있는" 행이
 * 전부 '새 행'으로 보여서, 남이 지운 데이터를 그대로 되살려 넣게 된다.
 */
export async function syncRows(
  table: string,
  rows: Row[],
  options: { onConflict?: string; idOf?: (row: Row) => string; deletes?: boolean } = {},
): Promise<boolean> {
  if (!supabase) return true; // 서버 미연동은 실패가 아니다(로컬 전용 모드)
  const idOf = options.idOf ?? ((r: Row) => String(r.id ?? ''));
  const onConflict = options.onConflict ?? 'id';
  // 목록에서 빠진 행까지 지울지. 기본은 끔 — 대부분의 스토어는 전용 delete 함수가 따로 있고,
  // save 가 부분 목록으로 불릴 때 남의 데이터를 지워버리면 안 된다.
  const deletes = options.deletes ?? false;

  const prev = snapshots.get(table);
  if (!prev) {
    // 원격 상태를 모른다 → 로컬에만 남긴다. 다음 로드가 성공하면 그때부터 동기화된다.
    console.warn(`Supabase ${table} — 원격 스냅샷이 없어 저장을 건너뜁니다(로컬만 갱신).`);
    return false;
  }

  const next = new Map<string, Row>();
  for (const r of rows) {
    const id = idOf(r);
    if (id) next.set(id, r);
  }

  // 1) 새로 생겼거나 내용이 바뀐 것만
  const changed: Row[] = [];
  for (const [id, row] of next) {
    if (prev.get(id) !== stable(row)) changed.push(row);
  }
  if (changed.length) {
    const { error } = await supabase.from(table).upsert(changed, { onConflict });
    if (error) {
      console.warn(`Supabase ${table} 저장 실패.`, error);
      return false; // 스냅샷을 갱신하지 않는다 — 다음에 다시 시도된다
    }
  }

  // 2) 내가 목록에서 뺀 것만 삭제(남이 추가한 행은 건드리지 않는다)
  if (deletes) {
    const gone = [...prev.keys()].filter((id) => !next.has(id));
    if (gone.length) {
      const { error } = await supabase.from(table).delete().in('id', gone);
      if (error) console.warn(`Supabase ${table} 삭제 실패.`, error);
    }
  }

  // 3) 스냅샷 갱신
  const m = new Map<string, string>();
  for (const [id, row] of next) m.set(id, stable(row));
  if (!deletes) {
    // 삭제를 안 했으면 내가 안 건드린 원격 행은 그대로 있다 — 스냅샷에도 남겨둔다.
    for (const [id, sig] of prev) if (!m.has(id)) m.set(id, sig);
  }
  snapshots.set(table, m);
  return true;
}

/** 테스트·로그아웃 등에서 스냅샷을 비운다. */
export function forgetRemote(table?: string) {
  if (table) snapshots.delete(table);
  else snapshots.clear();
}
