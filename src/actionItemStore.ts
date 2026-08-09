import { initialActionItems } from './data/mockData';
import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import type { ActionItem } from './types';

const ACTION_STORAGE_KEY = 'skgrove:actionItems';
const ACTION_TABLE = 'action_items';
const ACTION_WRITE_KEYS = ['id', 'title', 'owner', 'due', 'status', 'source_kind', 'source_id',
  'source_label', 'created_at', 'outcome', 'review_reason'];

type ActionRow = {
  id: string;
  title: string;
  owner: string;
  due?: string | null;
  status: ActionItem['status'];
  source_kind: ActionItem['sourceKind'];
  source_id?: string | null;
  source_label?: string | null;
  created_at?: string;
  outcome?: string | null;
  review_reason?: string | null;
};

export async function loadActionItems() {
  if (supabase) {
    const { data, error } = await supabase.from(ACTION_TABLE).select('*').order('created_at', { ascending: false });

    if (!error && data) {
      const items = data.map(actionFromRow);
      rememberRemote(ACTION_TABLE, data as unknown as Record<string, unknown>[], ACTION_WRITE_KEYS);
      window.localStorage.setItem(ACTION_STORAGE_KEY, JSON.stringify(items));
      // 비어 있으면 비어 있는 것이다 — 시드를 돌려주면 저장을 타고 DB 로 되돌아간다.
      return items;
    }
  }

  try {
    const saved = window.localStorage.getItem(ACTION_STORAGE_KEY);
    if (!saved) return supabase ? [] : initialActionItems;
    const parsed = JSON.parse(saved) as ActionItem[];
    if (!Array.isArray(parsed)) return supabase ? [] : initialActionItems;
    return parsed.length > 0 || supabase ? parsed : initialActionItems;
  } catch {
    return supabase ? [] : initialActionItems;
  }
}

export async function saveActionItems(items: ActionItem[]) {
  window.localStorage.setItem(ACTION_STORAGE_KEY, JSON.stringify(items));

  await syncRows(ACTION_TABLE, items.map(actionToRow));
}

// 안건 통과 시 여러 액션이 한 번에 만들어질 수 있어 세션 카운터로 같은 밀리초 충돌을 막는다.
let actionSequence = 0;

/** 액션아이템 삭제(admin@sk.com 전용). Supabase action_items 에서 제거한다. */
export async function deleteActionItem(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from(ACTION_TABLE).delete().eq('id', id);
  if (error) console.warn('Supabase action item delete failed.', error);
}

export function makeActionItemId() {
  actionSequence += 1;
  return `ACT-${Date.now().toString(36).toUpperCase()}-${actionSequence.toString(36).toUpperCase()}`;
}

function actionFromRow(row: ActionRow): ActionItem {
  return {
    id: row.id,
    title: row.title,
    owner: row.owner,
    due: row.due?.slice(0, 10) ?? '',
    status: row.status,
    sourceKind: row.source_kind,
    sourceId: row.source_id ?? '',
    sourceLabel: row.source_label ?? '',
    createdAt: row.created_at?.slice(0, 10) ?? '',
    outcome: row.outcome ?? '',
    reviewReason: row.review_reason ?? '',
  };
}

function actionToRow(item: ActionItem): ActionRow {
  return {
    id: item.id,
    title: item.title,
    owner: item.owner,
    // 날짜 컬럼에 빈 문자열을 넣으면 Postgres가 거부한다.
    due: item.due || null,
    status: item.status,
    source_kind: item.sourceKind,
    source_id: item.sourceId || null,
    source_label: item.sourceLabel || null,
    created_at: item.createdAt || undefined,
    outcome: item.outcome || null,
    review_reason: item.reviewReason || null,
  };
}
