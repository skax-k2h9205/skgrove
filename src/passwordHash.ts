// 계정 비밀번호 해싱(PBKDF2-SHA256). 이 앱은 클라이언트가 anon key로 accounts 를
// 읽으므로 저장된 해시가 노출될 수 있다 — 반복 연산(iterations)을 걸어 오프라인
// 대입 공격을 느리게 만든다. 완전한 보안은 서버 인증(Supabase Auth)이 필요하지만,
// '비밀번호 없음' 대비 문턱을 크게 올리는 실용적 절충이다.
//
// 저장 형식: `pbkdf2$<iterations>$<saltB64>$<hashB64>` (한 문자열, DB 컬럼 하나).

const ALGO = 'pbkdf2';
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toB64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromB64(b64: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: BufferSource, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return toB64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${ALGO}$${ITERATIONS}$${toB64(salt.buffer)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== ALGO) return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const hash = await derive(password, fromB64(parts[2]), iterations);
  // 길이가 다르면 즉시 불일치. 같으면 상수 시간 비교로 타이밍 노출을 줄인다.
  if (hash.length !== parts[3].length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i += 1) diff |= hash.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return diff === 0;
}
