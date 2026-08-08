// 팀 공용 설정 영속화 — Supabase(app_config) 있으면 DB, 없으면 localStorage.
// 캔미팅 단계·티미팅 세션 유형처럼 "모든 참여자에게 같아야 하는" 설정을 다룬다.
// 기기별 localStorage에만 두면 진행자가 바꾼 단계가 참여자 화면엔 반영되지 않는다.
import { supabase } from './supabaseClient';

const CONFIG_TABLE = 'app_config';

// DB가 없을 때 쓰는 로컬 키. 기존 저장분을 그대로 이어받도록 예전 키를 유지한다.
export const CAN_STEPS_KEY = 'skgrove:cansteps';
export const TEA_SESSION_TYPES_KEY = 'skgrove:teasessiontypes';
export const NOTIFY_SETTINGS_KEY = 'skgrove:notifysettings';

// DB 없거나 값이 없으면 fallback. 로컬 캐시는 항상 갱신해 다음 오프라인 로드에 대비한다.
export async function loadConfig<T>(key: string, fallback: T): Promise<T> {
  if (supabase) {
    const { data, error } = await supabase.from(CONFIG_TABLE).select('value').eq('key', key).maybeSingle();
    if (!error && data?.value !== undefined && data.value !== null) {
      const value = data.value as T;
      writeLocal(key, value);
      return value;
    }
  }
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

export async function saveConfig<T>(key: string, value: T) {
  writeLocal(key, value);

  if (!supabase) return;

  const { error } = await supabase
    .from(CONFIG_TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) {
    console.warn(`Supabase config save failed (${key}). Local fallback is still updated.`, error);
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시 (메모리 상태는 유지)
  }
}
