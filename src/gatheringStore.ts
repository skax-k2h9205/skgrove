// 번개 모임 / 일정공모 영속화 — Supabase 있으면 DB, 없으면 localStorage.
// canStore 와 같은 규약(load*/save*)을 따르되, 신청(signup)만은 다르게 다룬다.
//
// 신청은 통째로 upsert 하지 않고 한 건씩 insert/delete 한다. 선착순에서 배열을
// 통째로 덮어쓰면 두 사람이 같은 순간에 신청할 때 나중 쓰기가 앞 쓰기를 지워
// 한 명이 조용히 사라진다. 그 버그는 재현도 어렵고 신뢰를 가장 크게 깬다.
import { normalizeTeamPart } from './auth';
import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import type { Gathering, GatheringCost, GatheringKind, GatheringPoster, GatheringSignup, TeamPart } from './types';
import { getCurrentTenantId } from './tenantContext';

const GATHERINGS_KEY = 'skgrove:gatherings';
const SIGNUPS_KEY = 'skgrove:gatheringSignups';
const GATHERINGS_TABLE = 'gatherings';
const GATHERING_WRITE_KEYS = ['id', 'kind', 'title', 'start_at', 'place', 'capacity', 'close_at',
  'min_people', 'description', 'part', 'cost', 'image_url', 'poster', 'host', 'created_at',
  'canceled', 'coffee_draw', 'coffee_pick', 'coffee_picked_at', 'coffee_pool'];
const SIGNUPS_TABLE = 'gathering_signups';
const POSTER_BUCKET = 'gathering-images';

type GatheringRow = {
  id: string;
  kind?: string | null;
  title?: string | null;
  start_at?: string | null;
  place?: string | null;
  capacity?: number | null;
  close_at?: string | null;
  min_people?: number | null;
  description?: string | null;
  part?: string | null;
  cost?: string | null;
  image_url?: string | null;
  poster?: unknown;
  host?: string | null;
  created_at?: string | null;
  canceled?: boolean | null;
  coffee_draw?: boolean | null;
  coffee_pick?: string | null;
  coffee_picked_at?: string | null;
  coffee_pool?: string[] | null;
};

type SignupRow = {
  id: string;
  gathering_id: string;
  name: string;
  created_at?: string | null;
};

function readLocal<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과 등. 저장이 안 돼도 화면은 계속 돌아야 한다.
  }
}

function gatheringFromRow(row: GatheringRow): Gathering {
  return {
    id: row.id,
    kind: (row.kind === 'callup' ? 'callup' : 'flash') as GatheringKind,
    title: row.title ?? '',
    startAt: row.start_at ?? '',
    place: row.place ?? '',
    // 0 은 정원으로 의미가 없다. null(제한 없음)과 구분해 안전하게 접는다.
    capacity: typeof row.capacity === 'number' && row.capacity > 0 ? row.capacity : null,
    closeAt: row.close_at || row.start_at || '',
    minPeople: typeof row.min_people === 'number' && row.min_people > 0 ? row.min_people : null,
    desc: row.description ?? '',
    part: normalizeTeamPart(row.part),
    cost: (row.cost ?? '없음') as GatheringCost,
    imageUrl: row.image_url ?? undefined,
    poster: (row.poster as GatheringPoster | null) ?? undefined,
    host: row.host ?? '',
    createdAt: row.created_at?.slice(0, 10) ?? '',
    canceled: Boolean(row.canceled),
    coffeeDraw: row.coffee_draw ?? false,
    coffeePick: row.coffee_pick ?? null,
    coffeePickedAt: row.coffee_picked_at ?? null,
    coffeePool: (row.coffee_pool as string[] | null) ?? null,
  };
}

function gatheringToRow(gathering: Gathering): GatheringRow {
  return {
    id: gathering.id,
    kind: gathering.kind,
    title: gathering.title,
    start_at: gathering.startAt,
    place: gathering.place,
    capacity: gathering.capacity,
    close_at: gathering.closeAt,
    min_people: gathering.minPeople,
    description: gathering.desc,
    part: gathering.part,
    cost: gathering.cost,
    image_url: gathering.imageUrl ?? null,
    poster: gathering.poster ?? null,
    host: gathering.host,
    created_at: gathering.createdAt,
    canceled: gathering.canceled,
    coffee_draw: gathering.coffeeDraw ?? false,
    coffee_pick: gathering.coffeePick ?? null,
    coffee_picked_at: gathering.coffeePickedAt ?? null,
    coffee_pool: gathering.coffeePool ?? null,
  };
}

export async function loadGatherings(): Promise<Gathering[]> {
  if (supabase) {
    const { data, error } = await supabase.from(GATHERINGS_TABLE).select('*').order('start_at', { ascending: false });
    if (!error && data) {
      const rows = (data as GatheringRow[]).map(gatheringFromRow);
      rememberRemote(GATHERINGS_TABLE, data as unknown as Record<string, unknown>[], GATHERING_WRITE_KEYS);
      writeLocal(GATHERINGS_KEY, rows);
      return rows;
    }
  }
  // 로컬 캐시에도 옛 파트 이름이 남아 있을 수 있다.
  return readLocal<Gathering>(GATHERINGS_KEY, []).map((item) => ({ ...item, part: normalizeTeamPart(item.part) }));
}

export async function saveGatherings(items: Gathering[]) {
  writeLocal(GATHERINGS_KEY, items);
  await syncRows(GATHERINGS_TABLE, items.map(gatheringToRow));
}

export async function deleteGatheringRecord(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from(GATHERINGS_TABLE).delete().eq('id', id);
  if (error) {
    console.warn('Supabase gathering delete failed. Local fallback is still updated.', error);
  }
}

export async function loadSignups(): Promise<GatheringSignup[]> {
  if (supabase) {
    const { data, error } = await supabase.from(SIGNUPS_TABLE).select('*').order('created_at', { ascending: true });
    if (!error && data) {
      const rows = (data as SignupRow[]).map((row) => ({
        id: row.id,
        gatheringId: row.gathering_id,
        name: row.name,
        createdAt: row.created_at ?? '',
      }));
      writeLocal(SIGNUPS_KEY, rows);
      return rows;
    }
  }
  return readLocal<GatheringSignup>(SIGNUPS_KEY, []);
}

/** 로컬 미러. DB 를 단일 소스로 두되 오프라인에서도 목록이 보이게 한다. */
export function cacheSignups(signups: GatheringSignup[]) {
  writeLocal(SIGNUPS_KEY, signups);
}

/*
  신청 한 건만 넣는다. 배열 통째로 저장하지 않는 이유는 파일 머리말에 적었다.
  insert 가 실패하면 화면에도 반영하지 않아야 "신청됐다고 나오는데 명단에 없는"
  상태를 만들지 않는다 — 그래서 성공 여부를 돌려준다.
*/
export async function insertSignup(signup: GatheringSignup): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from(SIGNUPS_TABLE).insert({
    id: signup.id,
    gathering_id: signup.gatheringId,
    name: signup.name,
    created_at: signup.createdAt,
    tenant_id: getCurrentTenantId(),
  });
  if (error) {
    console.warn('Supabase signup insert failed.', error);
    return false;
  }
  return true;
}

export async function deleteSignup(id: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from(SIGNUPS_TABLE).delete().eq('id', id);
  if (error) {
    console.warn('Supabase signup delete failed.', error);
    return false;
  }
  return true;
}

/**
 * 첨부 사진 업로드. Supabase 가 없으면 브라우저 안에서만 보이는 objectURL 로 폴백한다.
 * 로컬 개발에서도 첨부 흐름을 끝까지 확인할 수 있어야 한다.
 */
export async function uploadGatheringImage(gatheringId: string, file: File) {
  if (!supabase) return { imageUrl: URL.createObjectURL(file), storagePath: '' };

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const storagePath = `${gatheringId}/${safeName}`;
  const { error } = await supabase.storage.from(POSTER_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.warn('Supabase gathering image upload failed. The gathering is saved without a photo.', error);
    // 업로드가 실패했는데 objectURL 을 돌려주면 그 값이 그대로 DB 에 저장된다.
    // blob: 은 만든 탭에서만 열리는 주소라, 다른 사람에게는 영영 깨진 이미지가 된다.
    // 저장할 값이 없을 때는 없다고 말한다 — 화면은 이미지 없이도 성립한다.
    return { imageUrl: '', storagePath: '' };
  }

  const { data } = supabase.storage.from(POSTER_BUCKET).getPublicUrl(storagePath);
  return { imageUrl: data.publicUrl, storagePath };
}
