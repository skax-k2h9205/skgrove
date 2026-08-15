// 리더 키페어의 원격 저장/로드 + 세션 내 개인키 메모리 캐시.
// leader_keys 테이블: 공개키(누구나 읽음) + 패스프레이즈/복구코드로 감싼 개인키(암호문).
import { supabase } from '../supabaseClient';
import { ISSUE_ENC_ALG, type WrappedKey } from './issueCrypto';

export type LeaderKeyRecord = {
  accountId: string;
  publicJwk: JsonWebKey;
  encPrivPassphrase: WrappedKey;
  encPrivRecovery: WrappedKey;
  alg: string;
};

type LeaderKeyRow = {
  account_id: string;
  public_key: string; // JSON(JsonWebKey)
  enc_priv_passphrase: string; // JSON(WrappedKey)
  enc_priv_recovery: string; // JSON(WrappedKey)
  salt_pass: string;
  salt_recovery: string;
  alg: string;
};

// ── row <-> record (순수 변환, 테스트 대상) ──
export function recordToRow(rec: LeaderKeyRecord): LeaderKeyRow {
  return {
    account_id: rec.accountId,
    public_key: JSON.stringify(rec.publicJwk),
    enc_priv_passphrase: JSON.stringify(rec.encPrivPassphrase),
    enc_priv_recovery: JSON.stringify(rec.encPrivRecovery),
    // salt 는 WrappedKey 안에도 있지만, 조회/디버깅 편의로 상단 컬럼에도 복제해 둔다.
    salt_pass: rec.encPrivPassphrase.salt,
    salt_recovery: rec.encPrivRecovery.salt,
    alg: rec.alg,
  };
}

export function rowToRecord(row: LeaderKeyRow): LeaderKeyRecord {
  return {
    accountId: row.account_id,
    publicJwk: JSON.parse(row.public_key) as JsonWebKey,
    encPrivPassphrase: JSON.parse(row.enc_priv_passphrase) as WrappedKey,
    encPrivRecovery: JSON.parse(row.enc_priv_recovery) as WrappedKey,
    alg: row.alg || ISSUE_ENC_ALG,
  };
}

// ── 원격 I/O ──
const TABLE = 'leader_keys';

/** 여러 계정의 공개키를 한 번에 조회(암호화 제출용). 없으면 그 계정은 결과에서 빠진다. */
export async function loadLeaderPublicKeys(accountIds: string[]): Promise<Record<string, JsonWebKey>> {
  const out: Record<string, JsonWebKey> = {};
  if (!supabase || accountIds.length === 0) return out;
  const { data, error } = await supabase
    .from(TABLE)
    .select('account_id, public_key')
    .in('account_id', accountIds);
  if (error || !data) return out;
  for (const row of data as { account_id: string; public_key: string }[]) {
    try {
      out[row.account_id] = JSON.parse(row.public_key) as JsonWebKey;
    } catch {
      /* 손상된 행은 건너뛴다 */
    }
  }
  return out;
}

/** 한 리더의 전체 키 레코드(감싼 개인키 포함) 조회. 열람 복호화 시 사용. */
export async function loadLeaderKeyRecord(accountId: string): Promise<LeaderKeyRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select('*').eq('account_id', accountId).limit(1);
  if (error || !data || data.length === 0) return null;
  return rowToRecord(data[0] as LeaderKeyRow);
}

/** 리더 키 최초 등록. 이미 있으면 upsert(키 재설정). */
export async function saveLeaderKeyRecord(rec: LeaderKeyRecord): Promise<boolean> {
  if (!supabase) return true; // 로컬 전용 모드는 실패가 아니다
  const { error } = await supabase.from(TABLE).upsert(recordToRow(rec), { onConflict: 'account_id' });
  if (error) {
    console.warn('leader_keys 저장 실패.', error);
    return false;
  }
  return true;
}

// ── 세션 내 개인키 캐시(메모리만, 새로고침하면 사라짐 → 패스프레이즈 재입력) ──
const privateKeyCache = new Map<string, JsonWebKey>();
export function cachePrivateKey(accountId: string, jwk: JsonWebKey) {
  privateKeyCache.set(accountId, jwk);
}
export function getCachedPrivateKey(accountId: string): JsonWebKey | undefined {
  return privateKeyCache.get(accountId);
}
export function clearPrivateKeyCache() {
  privateKeyCache.clear();
}
