# 익명 대나무숲 글 E2E 암호화 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 익명 접수 본문을 대상 리더 공개키로 E2E 암호화해, anon 키로 DB를 덤프해도(운영자 포함) 본문을 못 읽게 한다.

**Architecture:** Web Crypto(SubtleCrypto)만으로 ECDH P-256 + AES-256-GCM 하이브리드 암호화. 리더 키페어의 개인키는 패스프레이즈·복구코드로 이중 감싸 `leader_keys` 테이블에 저장(암호문만). 익명 제출 시 대상 리더 공개키로 본문 암호화, 리더는 관리함에서 패스프레이즈로 복호화. 리더 키 없으면 평문 폴백(비반적).

**Tech Stack:** TypeScript, React, Vite, Vitest, Supabase(REST via supabase-js), Web Crypto API(무의존성).

## Global Constraints

- 새 npm 의존성 금지 — Web Crypto만 사용(`passwordHash.ts` 선례).
- v1 적용 범위: `author === '익명'` 신규 접수만. 실명·기존글 미변경.
- 암호화 글은 AI 검토(`/api/review`) 생략.
- 복호화 가능자 = 대상 리더뿐. admin/커넥셔너 열람 불가(삭제만).
- 알고리즘 태그: `enc_alg = "v1:ecdh-p256+aesgcm256+hkdf-sha256+pbkdf2-210k"`.
- 평문 폴백: 대상 리더 공개키가 하나도 없으면 현행처럼 평문 저장 + "암호화 미적용" 표시.

---

### Task 1: 암호 코어 `issueCrypto.ts` (TDD)

**Files:**
- Create: `src/crypto/issueCrypto.ts`
- Test: `src/crypto/issueCrypto.test.ts`

**Interfaces (Produces):**
- `generateRecipientKeypair(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }>`
- `wrapPrivateKey(privateJwk, secret: string): Promise<WrappedKey>` — `WrappedKey = { salt: string; iv: string; ciphertext: string }` (모두 base64)
- `unwrapPrivateKey(wrapped: WrappedKey, secret: string): Promise<JsonWebKey>` — 실패 시 throw
- `encryptForRecipients(plaintext: string, recipients: {accountId: string; publicJwk: JsonWebKey}[]): Promise<EncryptedIssue>`
  - `EncryptedIssue = { alg: string; payload: string; keys: RecipientKey[] }`
  - `RecipientKey = { accountId: string; ephemeralPub: JsonWebKey; wrappedCK: string; iv: string }`
- `decryptAsRecipient(enc: EncryptedIssue, accountId: string, privateJwk: JsonWebKey): Promise<string>` — 실패 시 throw
- `generateRecoveryCode(): string` — 고엔트로피 base32 그룹 문자열(예: `A1B2-C3D4-...`)

**Notes:** Node 환경 vitest는 `globalThis.crypto.subtle`(Node 20+) 사용. base64는 `btoa/atob` 대신 Buffer 미사용 — `Uint8Array`↔base64 헬퍼를 파일 내 구현(브라우저/Node 공통). `passwordHash.ts`의 `toB64/fromB64` 패턴 재사용.

- [ ] **Step 1: 실패 테스트 작성** — `src/crypto/issueCrypto.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  generateRecipientKeypair, wrapPrivateKey, unwrapPrivateKey,
  encryptForRecipients, decryptAsRecipient, generateRecoveryCode,
} from './issueCrypto';

describe('issueCrypto', () => {
  it('라운드트립: 수신자 개인키로 복호화되고 평문이 같다', async () => {
    const leader = await generateRecipientKeypair();
    const enc = await encryptForRecipients('민감한 익명 제보', [
      { accountId: 'USR-1', publicJwk: leader.publicJwk },
    ]);
    expect(enc.payload).not.toContain('민감한'); // 평문 미포함
    const out = await decryptAsRecipient(enc, 'USR-1', leader.privateJwk);
    expect(out).toBe('민감한 익명 제보');
  });

  it('다중 수신자: 각자 자기 것만 복호화, 남의 개인키론 실패', async () => {
    const a = await generateRecipientKeypair();
    const b = await generateRecipientKeypair();
    const enc = await encryptForRecipients('내용', [
      { accountId: 'A', publicJwk: a.publicJwk },
      { accountId: 'B', publicJwk: b.publicJwk },
    ]);
    expect(await decryptAsRecipient(enc, 'A', a.privateJwk)).toBe('내용');
    expect(await decryptAsRecipient(enc, 'B', b.privateJwk)).toBe('내용');
    await expect(decryptAsRecipient(enc, 'A', b.privateJwk)).rejects.toThrow();
  });

  it('패스프레이즈 감싸기/풀기 라운드트립, 틀린 비번은 실패', async () => {
    const { privateJwk } = await generateRecipientKeypair();
    const wrapped = await wrapPrivateKey(privateJwk, 'pass1234');
    const back = await unwrapPrivateKey(wrapped, 'pass1234');
    expect(back.d).toBe(privateJwk.d);
    await expect(unwrapPrivateKey(wrapped, 'wrong')).rejects.toThrow();
  });

  it('payload 변조 시 GCM 인증 실패', async () => {
    const leader = await generateRecipientKeypair();
    const enc = await encryptForRecipients('x', [{ accountId: 'U', publicJwk: leader.publicJwk }]);
    const tampered = { ...enc, payload: enc.payload.slice(0, -4) + 'AAAA' };
    await expect(decryptAsRecipient(tampered, 'U', leader.privateJwk)).rejects.toThrow();
  });

  it('복구코드는 그룹 표기의 충분한 길이', () => {
    const code = generateRecoveryCode();
    expect(code.replace(/-/g, '').length).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/crypto/issueCrypto.test.ts` → FAIL(모듈 없음)
- [ ] **Step 3: 구현** — `src/crypto/issueCrypto.ts`
  - base64 헬퍼(`u8ToB64`/`b64ToU8`), `getRandomBytes`.
  - `generateRecipientKeypair`: `crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'}, true, ['deriveBits'])` → export public/private JWK.
  - `wrap/unwrap`: PBKDF2(secret, salt, 210_000, SHA-256)→AES-GCM 256으로 `JSON.stringify(privateJwk)` 암호화/복호화.
  - `encryptForRecipients`: 랜덤 32B CK → AES-GCM으로 payload 암호화. 각 수신자: ephemeral ECDH 키 생성 → `deriveBits(recipientPub)` → HKDF-SHA256 → AES-GCM으로 CK 감쌈.
  - `decryptAsRecipient`: `keys`에서 accountId 항목 찾기 → ephemeralPub+privateJwk로 ECDH → HKDF → CK 복호화 → payload 복호화.
  - `generateRecoveryCode`: 16B 랜덤 → base32(Crockford) → 4자 그룹.
  - `alg` 상수 export.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/crypto/issueCrypto.test.ts` → PASS
- [ ] **Step 5: 커밋** — `feat(암호): 익명글 E2E 암호 코어(issueCrypto) + 테스트`

---

### Task 2: DB 마이그레이션 SQL

**Files:**
- Create: `docs/sql/2026-08-15-anon-encryption.sql`

**Interfaces (Produces):** `leader_keys` 테이블, `issues`에 `encrypted/enc_payload/enc_keys/enc_alg` 컬럼.

- [ ] **Step 1: SQL 작성**

```sql
-- 리더 키페어(개인키는 암호문만)
create table if not exists public.leader_keys (
  account_id text primary key references public.accounts(id) on delete cascade,
  public_key text not null,
  enc_priv_passphrase text not null,
  enc_priv_recovery text not null,
  salt_pass text not null,
  salt_recovery text not null,
  alg text not null,
  created_at timestamptz not null default now()
);
alter table public.leader_keys enable row level security;
-- 공개키는 누구나 읽어야 암호화 가능. 감싼 개인키도 암호문이라 노출돼도 무의미하나,
-- 최소권한으로 전체 SELECT는 허용하되 UPDATE/DELETE는 서비스 롤로 제한(anon은 INSERT/SELECT만).
create policy leader_keys_read on public.leader_keys for select using (true);
create policy leader_keys_insert on public.leader_keys for insert with check (true);

-- issues 암호화 컬럼
alter table public.issues add column if not exists encrypted boolean not null default false;
alter table public.issues add column if not exists enc_payload text;
alter table public.issues add column if not exists enc_keys jsonb;
alter table public.issues add column if not exists enc_alg text;
```

- [ ] **Step 2: Supabase 적용** — REST/psql로 실행(배포 단계에서). 로컬 테스트는 스킵 가능(코드가 컬럼 부재에 방어적).
- [ ] **Step 3: 커밋** — `db(스키마): leader_keys + issues 암호화 컬럼`

---

### Task 3: `leaderKeyStore.ts` — 키 로드/저장 + 세션 캐시

**Files:**
- Create: `src/crypto/leaderKeyStore.ts`
- Test: `src/crypto/leaderKeyStore.test.ts` (순수 변환 함수만; 네트워크는 제외)

**Interfaces:**
- Consumes: Task1 전부, `supabase`(supabaseClient), `WrappedKey`.
- Produces:
  - `loadLeaderPublicKeys(accountIds: string[]): Promise<Record<string, JsonWebKey>>`
  - `loadLeaderKeyRecord(accountId): Promise<LeaderKeyRecord | null>`
  - `saveLeaderKeyRecord(rec: LeaderKeyRecord): Promise<void>`
  - `LeaderKeyRecord = { accountId; publicJwk; encPrivPassphrase: WrappedKey; encPrivRecovery: WrappedKey; alg }`
  - 메모리 캐시: `cachePrivateKey(accountId, jwk)`, `getCachedPrivateKey(accountId)`

- [ ] Step 1~5: row↔record 매핑 단위테스트(라운드트립) → 구현(supabase from('leader_keys')) → 통과 → 커밋 `feat(암호): leader_keys 스토어 + 세션 캐시`.

---

### Task 4: 타입·이슈 스토어 확장

**Files:**
- Modify: `src/types.ts` (Issue에 `encrypted?, encPayload?, encKeys?, encAlg?`)
- Modify: `src/issueStore.ts` (`IssueRow`에 4컬럼, `issueFromRow`/`issueToRow` 매핑, 암호화 시 `body/expected_change`는 빈 문자열)

**Interfaces (Produces):** `Issue.encrypted` 등 4필드, row 왕복 매핑.

- [ ] Step 1: `issueStore.test.ts`에 암호화 이슈 row 왕복 테스트 추가(encrypted=true면 enc_* 보존, body 빈값).
- [ ] Step 2: 실패 확인.
- [ ] Step 3: types + issueStore 수정.
- [ ] Step 4: 통과 확인(`npx vitest run src/issueStore*.test.ts` 있으면; 없으면 새 파일).
- [ ] Step 5: 커밋 `feat(스키마): Issue 암호화 필드 + row 매핑`.

---

### Task 5: 리더 키 설정 모달 `LeaderKeySetup.tsx`

**Files:**
- Create: `src/features/leader/LeaderKeySetup.tsx`
- Modify: `src/features/leader/LeaderInbox.tsx` (키 없으면 설정 유도)
- Modify: `src/styles.css` (모달 톤)

**Interfaces:** props `{ account: CurrentUser; onDone: () => void }`. 패스프레이즈 입력 → `generateRecipientKeypair` → `wrapPrivateKey`(패스프레이즈), `generateRecoveryCode`+`wrapPrivateKey`(복구코드) → `saveLeaderKeyRecord` → 복구코드 1회 표시(복사 확인 체크 후 완료).

- [ ] 수동 검증(로컬 구동): 리더로 키 설정 → `leader_keys`에 공개키+감싼 개인키 저장, 평문 개인키/패스프레이즈 미전송(네트워크 탭 확인).
- [ ] 커밋 `feat(리더): 키 설정 모달 + 복구코드`.

---

### Task 6: 익명 제출 암호화 배선

**Files:**
- Modify: `src/features/intake/Intake.tsx` (submit 시 `identity==='익명'`이면 대상 리더 공개키 조회→`encryptForRecipients`→enc 필드 채우고 body/expectedChange 비움; 키 없으면 평문 폴백+배지)
- Modify: `src/App.tsx:390` `submitIssue` (enc 필드 통과)
- Modify: AI 검토 트리거 지점 — 암호화 글이면 스킵

**Interfaces:** 대상 리더 결정: `target==='팀리더'`→role 팀리더 계정들, `target==='파트리더'`→작성자 파트의 파트리더. `loadLeaderPublicKeys`로 공개키 조회.

- [ ] 수동 검증: 익명 제출 → DB row에 `enc_payload` 존재·`body` 빈값. anon SELECT로 평문 부재 확인.
- [ ] 커밋 `feat(대나무숲): 익명 제출 E2E 암호화 + 평문 폴백`.

---

### Task 7: 리더 관리함 복호화 열람

**Files:**
- Modify: `src/features/leader/LeaderInbox.tsx:382` (issue.encrypted면 캐시된 개인키로 `decryptAsRecipient`; 없으면 패스프레이즈 입력 프롬프트)

**Interfaces:** Consumes Task1/3. 세션당 1회 패스프레이즈→`unwrapPrivateKey`→`cachePrivateKey`.

- [ ] 수동 검증: 리더가 암호화 글 열람→복호화 표시. 대상 아닌 리더/키 미설정은 "복호화 불가" 안내.
- [ ] 커밋 `feat(리더): 암호화 접수 복호화 열람`.

---

### Task 8: 배포

- [ ] SQL을 Supabase에 적용(Task2).
- [ ] `npx vitest run` 전체 통과 + `npm run build` 성공.
- [ ] `feature/anon-encryption` → dev 병합(또는 PR) → GitHub Action Deploy Hook 자동 배포.
- [ ] 배포 후 스모크: 리더 키설정→익명 제출→열람→anon SELECT 평문 부재 확인.

## Self-Review

- 스펙 커버리지: 위협모델·복구코드·AI스킵·평문폴백·데이터모델·플로우·테스트·배포 모두 태스크에 매핑됨(Task1 crypto, Task2 DB, Task3 store, Task4 types, Task5 키설정, Task6 제출, Task7 열람, Task8 배포).
- 타입 일관성: `EncryptedIssue{alg,payload,keys}`, `RecipientKey{accountId,ephemeralPub,wrappedCK,iv}`, `WrappedKey{salt,iv,ciphertext}`, `LeaderKeyRecord` 전 태스크 동일 명칭.
- 익명 작성자 본인 조회 시 본문 미재표시(스펙 반영) → Task6/Intake 조회 경로에서 encrypted면 "암호화 보관 중" 처리(구현 시 반영).
