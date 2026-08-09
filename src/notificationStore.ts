// 알림/메시지 영속화 — Supabase(notifications) 있으면 DB, 없으면 localStorage (agendaStore 등과 동일 듀얼모드).
// 저장된 배열 자체가 "발송 이력"(SKSOOP-116). 개별 삭제는 없고 read 토글/추가만 있어 upsert로 충분.
import { initialNotifications } from './data/mockData';
import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import type { AppNotification, NotificationKind, Section } from './types';

const NOTIFICATION_STORAGE_KEY = 'skgrove:notifications';
const NOTIFICATION_TABLE = 'notifications';
const NOTIFICATION_WRITE_KEYS = ['id', 'kind', 'recipient_name', 'from_name', 'title', 'body',
  'section', 'source_id', 'dedupe_key', 'created_at', 'read'];

type NotificationRow = {
  id: string;
  kind: string;
  recipient_name: string;
  from_name?: string | null;
  title?: string | null;
  body?: string | null;
  section: string;
  source_id?: string | null;
  dedupe_key?: string | null;
  created_at?: string | null;
  read?: boolean | null;
};

export async function loadNotifications(): Promise<AppNotification[]> {
  if (supabase) {
    const { data, error } = await supabase.from(NOTIFICATION_TABLE).select('*').order('created_at', { ascending: false });
    if (!error && data) {
      const items = (data as NotificationRow[]).map(notificationFromRow);
      rememberRemote(NOTIFICATION_TABLE, data as unknown as Record<string, unknown>[], NOTIFICATION_WRITE_KEYS);
      window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));
      return items;
    }
  }
  try {
    const saved = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!saved) return supabase ? [] : initialNotifications;
    const parsed = JSON.parse(saved) as AppNotification[];
    // 모두 비운 상태(빈 배열)는 존중 — 시드로 되돌리지 않음.
    if (!Array.isArray(parsed)) return supabase ? [] : initialNotifications;
    return parsed;
  } catch {
    return supabase ? [] : initialNotifications;
  }
}

export async function saveNotifications(items: AppNotification[]) {
  try {
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // 저장 실패는 무시 (메모리 상태는 유지)
  }
  await syncRows(NOTIFICATION_TABLE, items.map(notificationToRow));
}

// 한 이벤트가 여러 수신자에게 fan-out될 때 같은 밀리초 충돌을 막는 세션 카운터.
let notificationSequence = 0;

export function makeNotificationId() {
  notificationSequence += 1;
  return `NTF-${Date.now().toString(36).toUpperCase()}-${notificationSequence.toString(36).toUpperCase()}`;
}

function notificationFromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    recipientName: row.recipient_name,
    fromName: row.from_name ?? '시스템',
    title: row.title ?? '',
    body: row.body ?? '',
    section: row.section as Section,
    sourceId: row.source_id ?? '',
    dedupeKey: row.dedupe_key ?? '',
    createdAt: row.created_at ?? '',
    read: Boolean(row.read),
  };
}

function notificationToRow(item: AppNotification): NotificationRow {
  return {
    id: item.id,
    kind: item.kind,
    recipient_name: item.recipientName,
    from_name: item.fromName || null,
    title: item.title || null,
    body: item.body || null,
    section: item.section,
    source_id: item.sourceId || null,
    dedupe_key: item.dedupeKey || null,
    created_at: item.createdAt || null,
    read: item.read,
  };
}
