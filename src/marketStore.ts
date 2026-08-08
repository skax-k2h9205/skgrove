// 이음장터 영속화 — Supabase 있으면 DB, 없으면 localStorage.
// gatheringStore 와 같은 규약(load*/save*)을 따르고, 입찰은 신청과 같은 이유로 다르게 다룬다.
//
// 입찰은 통째로 upsert 하지 않고 한 건씩 insert 한다. 배열을 덮어쓰면 두 사람이 같은
// 순간에 입찰할 때 나중 쓰기가 앞 쓰기를 지워 한 건이 조용히 사라진다.
// 경매에서 그 버그는 "분명 넣었는데 없다"가 되어 신뢰를 가장 크게 깬다.
import { supabase } from './supabaseClient';
import type { GatheringPoster, MarketBid, MarketItem, MarketKind } from './types';

const ITEMS_KEY = 'skgrove:marketItems';
const BIDS_KEY = 'skgrove:marketBids';
const ITEMS_TABLE = 'market_items';
const BIDS_TABLE = 'market_bids';
const IMAGE_BUCKET = 'market-images';

type ItemRow = {
  id: string;
  kind?: string | null;
  title?: string | null;
  description?: string | null;
  start_price?: number | null;
  min_step?: number | null;
  close_at?: string | null;
  extended_to?: string | null;
  place?: string | null;
  image_url?: string | null;
  poster?: unknown;
  seller?: string | null;
  created_at?: string | null;
  canceled?: boolean | null;
  seller_done?: boolean | null;
  buyer_done?: boolean | null;
};

type BidRow = {
  id: string;
  item_id: string;
  name: string;
  amount?: number | null;
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

function itemFromRow(row: ItemRow): MarketItem {
  return {
    id: row.id,
    kind: (row.kind === 'giveaway' ? 'giveaway' : 'auction') as MarketKind,
    title: row.title ?? '',
    desc: row.description ?? '',
    // 음수 가격은 뜻이 없다. 값이 깨져도 화면이 이상해지지 않도록 여기서 접는다.
    startPrice: typeof row.start_price === 'number' && row.start_price > 0 ? row.start_price : 0,
    minStep: typeof row.min_step === 'number' && row.min_step > 0 ? row.min_step : 0,
    closeAt: row.close_at ?? '',
    extendedTo: row.extended_to ?? undefined,
    place: row.place ?? '',
    imageUrl: row.image_url ?? undefined,
    poster: (row.poster as GatheringPoster | null) ?? undefined,
    seller: row.seller ?? '',
    createdAt: row.created_at?.slice(0, 10) ?? '',
    canceled: Boolean(row.canceled),
    sellerDone: Boolean(row.seller_done),
    buyerDone: Boolean(row.buyer_done),
  };
}

function itemToRow(item: MarketItem): ItemRow {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    description: item.desc,
    start_price: item.startPrice,
    min_step: item.minStep,
    close_at: item.closeAt,
    extended_to: item.extendedTo ?? null,
    place: item.place,
    image_url: item.imageUrl ?? null,
    poster: item.poster ?? null,
    seller: item.seller,
    created_at: item.createdAt,
    canceled: item.canceled,
    seller_done: item.sellerDone,
    buyer_done: item.buyerDone,
  };
}

export async function loadMarketItems(): Promise<MarketItem[]> {
  if (supabase) {
    const { data, error } = await supabase.from(ITEMS_TABLE).select('*').order('close_at', { ascending: false });
    if (!error && data) {
      const rows = (data as ItemRow[]).map(itemFromRow);
      writeLocal(ITEMS_KEY, rows);
      return rows;
    }
  }
  return readLocal<MarketItem>(ITEMS_KEY, []);
}

export async function saveMarketItems(items: MarketItem[]) {
  writeLocal(ITEMS_KEY, items);
  if (!supabase || items.length === 0) return;

  const { error } = await supabase.from(ITEMS_TABLE).upsert(items.map(itemToRow), { onConflict: 'id' });
  if (error) {
    console.warn('Supabase market item save failed. Local fallback is still updated.', error);
  }
}

export async function deleteMarketItemRecord(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from(ITEMS_TABLE).delete().eq('id', id);
  if (error) {
    console.warn('Supabase market item delete failed. Local fallback is still updated.', error);
  }
}

/**
 * 물건에 딸린 입찰을 통째로 지운다. market_bids 는 item 에 FK 가 없어(스키마상 item_id 는 text)
 * 물건을 지워도 입찰이 남는다. 물건 완전 삭제 때 호출해 함께 정리한다.
 */
export async function deleteMarketBidsForItem(itemId: string) {
  if (!supabase) return;
  const { error } = await supabase.from(BIDS_TABLE).delete().eq('item_id', itemId);
  if (error) {
    console.warn('Supabase market bids delete failed. Local fallback is still updated.', error);
  }
}

export async function loadMarketBids(): Promise<MarketBid[]> {
  if (supabase) {
    const { data, error } = await supabase.from(BIDS_TABLE).select('*').order('created_at', { ascending: true });
    if (!error && data) {
      const rows = (data as BidRow[]).map((row) => ({
        id: row.id,
        itemId: row.item_id,
        name: row.name,
        amount: typeof row.amount === 'number' ? row.amount : 0,
        createdAt: row.created_at ?? '',
      }));
      writeLocal(BIDS_KEY, rows);
      return rows;
    }
  }
  return readLocal<MarketBid>(BIDS_KEY, []);
}

/** 로컬 미러. DB 를 단일 소스로 두되 오프라인에서도 목록이 보이게 한다. */
export function cacheMarketBids(bids: MarketBid[]) {
  writeLocal(BIDS_KEY, bids);
}

/*
  입찰 한 건만 넣는다. 배열 통째로 저장하지 않는 이유는 파일 머리말에 적었다.
  insert 가 실패하면 화면에도 반영하지 않아야 "입찰됐다고 나오는데 목록에 없는"
  상태를 만들지 않는다 — 그래서 성공 여부를 돌려준다.
*/
export async function insertMarketBid(bid: MarketBid): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from(BIDS_TABLE).insert({
    id: bid.id,
    item_id: bid.itemId,
    name: bid.name,
    amount: bid.amount,
    created_at: bid.createdAt,
  });
  if (error) {
    console.warn('Supabase market bid insert failed.', error);
    return false;
  }
  return true;
}

/**
 * 사진 업로드. Supabase 가 없으면 브라우저 안에서만 보이는 objectURL 로 폴백한다.
 * 로컬 개발에서도 첨부 흐름을 끝까지 확인할 수 있어야 한다.
 */
export async function uploadMarketImage(itemId: string, file: File) {
  if (!supabase) return { imageUrl: URL.createObjectURL(file) };

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const storagePath = `${itemId}/${safeName}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.warn('Supabase market image upload failed. Browser preview is still available.', error);
    return { imageUrl: URL.createObjectURL(file) };
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
  return { imageUrl: data.publicUrl };
}
