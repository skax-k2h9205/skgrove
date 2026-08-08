import { initialActionItems } from './data/mockData';
import { supabase } from './supabaseClient';
import type { ActionItem } from './types';

const ACTION_STORAGE_KEY = 'skgrove:actionItems';
const ACTION_TABLE = 'action_items';

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
      window.localStorage.setItem(ACTION_STORAGE_KEY, JSON.stringify(items));
      return items.length > 0 ? items : initialActionItems;
    }
  }

  try {
    const saved = window.localStorage.getItem(ACTION_STORAGE_KEY);
    if (!saved) return initialActionItems;
    const parsed = JSON.parse(saved) as ActionItem[];
    return parsed.length > 0 ? parsed : initialActionItems;
  } catch {
    return initialActionItems;
  }
}

export async function saveActionItems(items: ActionItem[]) {
  window.localStorage.setItem(ACTION_STORAGE_KEY, JSON.stringify(items));

  if (!supabase) return;

  const { error } = await supabase.from(ACTION_TABLE).upsert(items.map(actionToRow), { onConflict: 'id' });

  if (error) {
    console.warn('Supabase action item save failed. Local fallback is still updated.', error);
  }
}

// 안건 통과 시 여러 액션이 한 번에 만들어질 수 있어 세션 카운터로 같은 밀리초 충돌을 막는다.
let actionSequence = 0;

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
