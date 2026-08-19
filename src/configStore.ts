// 팀 공용 설정 영속화 — Supabase(app_config) 있으면 DB, 없으면 localStorage.
// 캔미팅 단계·티미팅 세션 유형처럼 "모든 참여자에게 같아야 하는" 설정을 다룬다.
// 기기별 localStorage에만 두면 진행자가 바꾼 단계가 참여자 화면엔 반영되지 않는다.
import { supabase } from './supabaseClient';
import { getCurrentTenantId } from './tenantContext';

const CONFIG_TABLE = 'app_config';

// app_config 는 팀마다 같은 key 를 따로 갖는다(PK (tenant_id,key)). 로컬 캐시 키도 팀별로.
const localKey = (key: string) => {
  const tid = getCurrentTenantId();
  return tid ? `${key}:${tid}` : key;
};

// DB가 없을 때 쓰는 로컬 키. 기존 저장분을 그대로 이어받도록 예전 키를 유지한다.
export const CAN_STEPS_KEY = 'skgrove:cansteps';
export const TEA_SESSION_TYPES_KEY = 'skgrove:teasessiontypes';
export const NOTIFY_SETTINGS_KEY = 'skgrove:notifysettings';

// DB 없거나 값이 없으면 fallback. 로컬 캐시는 항상 갱신해 다음 오프라인 로드에 대비한다.
export async function loadConfig<T>(key: string, fallback: T): Promise<T> {
  const tid = getCurrentTenantId();
  // 테넌트가 정해졌을 때만 원격을 읽는다(로그인 후). 이 설정들은 로그인 후 로드된다.
  if (supabase && tid) {
    const { data, error } = await supabase
      .from(CONFIG_TABLE)
      .select('value')
      .eq('tenant_id', tid)
      .eq('key', key)
      .maybeSingle();
    if (!error && data?.value !== undefined && data.value !== null) {
      const value = data.value as T;
      writeLocal(key, value);
      return value;
    }
  }
  try {
    const saved = window.localStorage.getItem(localKey(key));
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

export async function saveConfig<T>(key: string, value: T) {
  writeLocal(key, value);

  const tid = getCurrentTenantId();
  if (!supabase || !tid) return;

  const { error } = await supabase
    .from(CONFIG_TABLE)
    .upsert({ tenant_id: tid, key, value, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,key' });

  if (error) {
    console.warn(`Supabase config save failed (${key}). Local fallback is still updated.`, error);
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(localKey(key), JSON.stringify(value));
  } catch {
    // 저장 실패는 무시 (메모리 상태는 유지)
  }
}
