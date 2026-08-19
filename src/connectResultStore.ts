import { rememberRemote, syncRows } from './remoteTable';
import { supabase } from './supabaseClient';
import { withTenant } from './tenantContext';
import type { ConnectResultMode, SavedDrawResult } from './types';

const CONNECT_RESULT_STORAGE_KEY = 'skgrove:connect-results';
const CONNECT_RESULT_TABLE = 'connect_results';
const CONNECT_WRITE_KEYS = ['id','mode','title','created_at','summary','share_text','share_url'];

type ConnectResultRow = {
  id: string;
  mode: ConnectResultMode;
  title: string;
  created_at: string;
  summary: string;
  share_text: string;
  share_url: string;
};

export async function loadConnectResults() {
  if (supabase) {
    const { data, error } = await withTenant(supabase.from(CONNECT_RESULT_TABLE).select('*'))
      .order('created_at', { ascending: false })
      .limit(12);

    if (!error && data) {
      const results = (data as ConnectResultRow[]).map(resultFromRow);
      rememberRemote(CONNECT_RESULT_TABLE, data as unknown as Record<string, unknown>[], CONNECT_WRITE_KEYS);
      window.localStorage.setItem(CONNECT_RESULT_STORAGE_KEY, JSON.stringify(results));
      return results;
    }
  }

  try {
    const saved = window.localStorage.getItem(CONNECT_RESULT_STORAGE_KEY);
    return saved ? JSON.parse(saved) as SavedDrawResult[] : [];
  } catch {
    return [];
  }
}

export async function saveConnectResults(results: SavedDrawResult[]) {
  window.localStorage.setItem(CONNECT_RESULT_STORAGE_KEY, JSON.stringify(results));

  await syncRows(CONNECT_RESULT_TABLE, results.map(resultToRow));
}

export async function clearConnectResults() {
  window.localStorage.setItem(CONNECT_RESULT_STORAGE_KEY, JSON.stringify([]));

  if (!supabase) return;

  const { error } = await supabase.from(CONNECT_RESULT_TABLE).delete().neq('id', '');
  if (error) {
    console.warn('Supabase connect result clear failed. Local fallback is still updated.', error);
  }
}

export function makeConnectResultId(mode: ConnectResultMode) {
  return `${mode}-${Date.now().toString(36).toUpperCase()}`;
}

export function makeConnectShareUrl(resultId: string) {
  if (typeof window === 'undefined') return `#connect-result-${resultId}`;
  return `${window.location.origin}${window.location.pathname}#connect-result-${resultId}`;
}

function resultFromRow(row: ConnectResultRow): SavedDrawResult {
  return {
    id: row.id,
    mode: row.mode,
    title: row.title,
    createdAt: row.created_at,
    summary: row.summary,
    shareText: row.share_text,
    shareUrl: row.share_url,
  };
}

function resultToRow(result: SavedDrawResult): ConnectResultRow {
  return {
    id: result.id,
    mode: result.mode,
    title: result.title,
    created_at: result.createdAt,
    summary: result.summary,
    share_text: result.shareText,
    share_url: result.shareUrl,
  };
}
