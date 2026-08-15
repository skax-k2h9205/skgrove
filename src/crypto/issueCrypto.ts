// 익명 대나무숲 글 종단간(E2E) 암호화 코어 — Web Crypto(SubtleCrypto)만 사용(무의존성).
//
// 모델: 대상 리더 공개키로만 복호화되는 하이브리드 암호화.
//  - 본문은 랜덤 콘텐츠키 CK(AES-256-GCM)로 1회 암호화.
//  - CK 를 각 대상 리더의 공개키로 감싼다: ephemeral ECDH → HKDF-SHA256 → AES-256-GCM.
//  - 리더 개인키(JWK)는 패스프레이즈/복구코드로 각각 감싸(PBKDF2→AES-GCM) 서버에 암호문만 저장.
// 운영자(서버)는 공개키·암호문만 보므로 본문을 복호화할 수 없다.

const ALG = 'v1:ecdh-p256+aesgcm256+hkdf-sha256+pbkdf2-210k';
export const ISSUE_ENC_ALG = ALG;

const PBKDF2_ITERATIONS = 210_000;
const subtle = globalThis.crypto.subtle;

// ── base64 <-> bytes (브라우저/Node 공통, passwordHash.ts 패턴) ──
function u8ToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── 타입 ──
export type WrappedKey = { salt: string; iv: string; ciphertext: string };
export type RecipientKey = {
  accountId: string;
  ephemeralPub: JsonWebKey;
  wrappedCK: string; // base64 (iv 포함 아님 — 별도)
  iv: string;
};
export type EncryptedIssue = { alg: string; payload: string; keys: RecipientKey[] };

// ── 리더 키페어 ──
export async function generateRecipientKeypair(): Promise<{
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}> {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicJwk = await subtle.exportKey('jwk', pair.publicKey);
  const privateJwk = await subtle.exportKey('jwk', pair.privateKey);
  return { publicJwk, privateJwk };
}

// ── 개인키 감싸기(패스프레이즈/복구코드 공통) ──
async function deriveWrapKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapPrivateKey(privateJwk: JsonWebKey, secret: string): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveWrapKey(secret, salt);
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(privateJwk)),
  );
  return { salt: u8ToB64(salt), iv: u8ToB64(iv), ciphertext: u8ToB64(new Uint8Array(ct)) };
}

export async function unwrapPrivateKey(wrapped: WrappedKey, secret: string): Promise<JsonWebKey> {
  const key = await deriveWrapKey(secret, b64ToU8(wrapped.salt));
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToU8(wrapped.iv) as BufferSource },
    key,
    b64ToU8(wrapped.ciphertext) as BufferSource,
  );
  return JSON.parse(dec.decode(pt)) as JsonWebKey;
}

// ── 콘텐츠키를 수신자 공개키로 감싸기(ECDH → HKDF → AES-GCM) ──
async function deriveSharedAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const bits = await subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdfBase = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(ALG) },
    hkdfBase,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

export async function encryptForRecipients(
  plaintext: string,
  recipients: { accountId: string; publicJwk: JsonWebKey }[],
): Promise<EncryptedIssue> {
  if (recipients.length === 0) throw new Error('수신자가 없습니다');
  // 1) 랜덤 콘텐츠키로 본문 암호화
  const ck = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const payloadIv = randomBytes(12);
  const payloadCt = await subtle.encrypt(
    { name: 'AES-GCM', iv: payloadIv as BufferSource },
    ck,
    enc.encode(plaintext),
  );
  // payload = iv(12B) || ciphertext, base64
  const rawCk = new Uint8Array(await subtle.exportKey('raw', ck));
  const payloadBytes = new Uint8Array(payloadIv.length + payloadCt.byteLength);
  payloadBytes.set(payloadIv, 0);
  payloadBytes.set(new Uint8Array(payloadCt), payloadIv.length);

  // 2) 각 수신자 공개키로 CK 감싸기
  const keys: RecipientKey[] = [];
  for (const r of recipients) {
    const recipientPub = await subtle.importKey(
      'jwk',
      r.publicJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const wrapKey = await deriveSharedAesKey(eph.privateKey, recipientPub, ['encrypt']);
    const iv = randomBytes(12);
    const wrappedCK = await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, wrapKey, rawCk as BufferSource);
    keys.push({
      accountId: r.accountId,
      ephemeralPub: await subtle.exportKey('jwk', eph.publicKey),
      wrappedCK: u8ToB64(new Uint8Array(wrappedCK)),
      iv: u8ToB64(iv),
    });
  }

  return { alg: ALG, payload: u8ToB64(payloadBytes), keys };
}

export async function decryptAsRecipient(
  encIssue: EncryptedIssue,
  accountId: string,
  privateJwk: JsonWebKey,
): Promise<string> {
  const entry = encIssue.keys.find((k) => k.accountId === accountId);
  if (!entry) throw new Error('이 계정으로 암호화된 항목이 없습니다');

  const privateKey = await subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const ephPub = await subtle.importKey(
    'jwk',
    entry.ephemeralPub,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const wrapKey = await deriveSharedAesKey(privateKey, ephPub, ['decrypt']);
  const rawCk = await subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToU8(entry.iv) as BufferSource },
    wrapKey,
    b64ToU8(entry.wrappedCK) as BufferSource,
  );
  const ck = await subtle.importKey('raw', rawCk, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);

  const payloadBytes = b64ToU8(encIssue.payload);
  const iv = payloadBytes.slice(0, 12);
  const ct = payloadBytes.slice(12);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, ck, ct as BufferSource);
  return dec.decode(pt);
}

// ── 복구코드: 16B 랜덤 → Crockford base32 → 4자 그룹(예: A1B2-C3D4-...) ──
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford (I,L,O,U 제외)
export function generateRecoveryCode(): string {
  const bytes = randomBytes(16);
  let out = '';
  for (const b of bytes) out += BASE32[b & 31] + BASE32[(b >> 3) & 31];
  // 32자 → 4자씩 8그룹
  return (out.match(/.{1,4}/g) ?? []).join('-');
}
