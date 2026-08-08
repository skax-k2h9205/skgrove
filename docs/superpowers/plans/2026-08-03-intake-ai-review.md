# 대나무숲 접수 AI 사전 검토 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 접수 제출 직전에 LLM이 욕설·인신공격을 검토하고, 지적된 항목은 수정해야 제출되게 한다.

**Architecture:** 기존 캔미팅 AI 요약과 같은 이음새 구조를 쓴다 — 프론트(`src/intakeReview.ts`)는 URL과 규격만 알고, OpenRouter 키는 프록시에만 둔다. 프록시는 서버리스(`api/review.ts`)와 로컬(`scripts/review-proxy.mjs`) 두 벌이며, 이는 `api/ai.ts` / `scripts/ai-proxy.mjs`가 이미 따르고 있는 기존 패턴이다. UI는 `ReviewGate` 컴포넌트로 분리해 `Intake.tsx`가 더 커지지 않게 한다.

**Tech Stack:** React 18 + TypeScript + Vite, vitest, OpenRouter(anthropic/claude-haiku-4.5), Node 18+ 로컬 프록시

설계 근거는 `docs/superpowers/specs/2026-08-03-intake-ai-review-design.md` 참조.

## Global Constraints

- 모든 UI 문구는 한국어. 해요체로 통일한다(기존 화면과 동일).
- 주석은 "무엇을"이 아니라 **"왜"**를 적는다. 기존 코드 스타일을 따른다.
- CSS는 새 색·간격 값을 만들지 말고 기존 토큰(`var(--color-*)`, `var(--space-*)`, `var(--radius)`)을 쓴다.
- **접수자 정보(이름·사내메일·소속 파트·익명 여부)를 검토 요청에 넣지 않는다.**
- **검토 결과를 저장하지 않는다.** `Issue` 타입에 필드를 추가하지 않는다. 브라우저 메모리에만 둔다.
- 커밋 메시지는 한국어. 무엇을 왜 바꿨는지 적는다.
- 순수 함수는 테스트를 동반한다(팀 관례).
- OpenRouter 모델 기본값: `anthropic/claude-haiku-4.5`

---

### Task 1: 검토 이음새와 응답 정제

프론트에서 프록시를 호출하고 응답을 방어적으로 정제하는 순수 모듈. UI 없이 단독으로 테스트 가능하다.

**Files:**
- Create: `src/intakeReview.ts`
- Create: `src/intakeReview.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type ReviewField = 'title' | 'body' | 'expectedChange'`
  - `type ReviewKind = 'profanity' | 'personal-attack'`
  - `type ReviewFinding = { field: ReviewField; kind: ReviewKind; reason: string; rewritten: string }`
  - `type ReviewInput = { title: string; body: string; expectedChange: string }`
  - `type ReviewResult = { ok: boolean; findings?: ReviewFinding[]; reason?: string }`
  - `function sanitizeFindings(raw: unknown): ReviewFinding[]`
  - `async function reviewIntake(input: ReviewInput): Promise<ReviewResult>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/intakeReview.test.ts` 생성:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewIntake, sanitizeFindings } from './intakeReview';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const finding = (patch: Record<string, unknown> = {}) => ({
  field: 'body',
  kind: 'personal-attack',
  reason: '인격을 평가하는 표현으로 읽혀요.',
  rewritten: '회의가 자주 길어져 다른 일정에 영향을 줍니다.',
  ...patch,
});

describe('sanitizeFindings', () => {
  it('정상 항목은 그대로 통과시킨다', () => {
    expect(sanitizeFindings([finding()])).toHaveLength(1);
  });

  it('배열이 아니면 빈 배열이다', () => {
    expect(sanitizeFindings(null)).toEqual([]);
    expect(sanitizeFindings({ findings: [] })).toEqual([]);
  });

  it('field 가 세 값 중 하나가 아니면 버린다', () => {
    expect(sanitizeFindings([finding({ field: 'summary' })])).toEqual([]);
    expect(sanitizeFindings([finding({ field: 123 })])).toEqual([]);
  });

  it('rewritten 이 비어 있으면 버린다', () => {
    expect(sanitizeFindings([finding({ rewritten: '   ' })])).toEqual([]);
    expect(sanitizeFindings([finding({ rewritten: undefined })])).toEqual([]);
  });

  it('kind 가 모르는 값이면 안전한 쪽(personal-attack)으로 강등한다', () => {
    const [item] = sanitizeFindings([finding({ kind: 'style' })]);
    expect(item.kind).toBe('personal-attack');
  });

  it('profanity 는 그대로 유지한다', () => {
    const [item] = sanitizeFindings([finding({ kind: 'profanity' })]);
    expect(item.kind).toBe('profanity');
  });

  it('reason 이 없어도 항목을 버리지 않는다', () => {
    const [item] = sanitizeFindings([finding({ reason: undefined })]);
    expect(item.reason).toBe('');
  });
});

describe('reviewIntake', () => {
  const input = { title: '제목', body: '본문', expectedChange: '' };

  it('엔드포인트가 없으면 disabled 를 돌려준다', async () => {
    vi.stubEnv('VITE_REVIEW_ENDPOINT', '');
    const result = await reviewIntake(input);
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });

  it('성공하면 정제된 findings 를 돌려준다', async () => {
    vi.stubEnv('VITE_REVIEW_ENDPOINT', 'http://localhost/api/review');
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ ok: true, findings: [finding(), finding({ field: 'nope' })] }),
    })));
    const result = await reviewIntake(input);
    expect(result.ok).toBe(true);
    expect(result.findings).toHaveLength(1);
  });

  it('지적이 없으면 ok:true 에 빈 배열이다', async () => {
    vi.stubEnv('VITE_REVIEW_ENDPOINT', 'http://localhost/api/review');
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ ok: true, findings: [] }) })));
    const result = await reviewIntake(input);
    expect(result).toEqual({ ok: true, findings: [] });
  });

  it('실패하면 한 번 재시도하고, 재시도가 성공하면 그 결과를 쓴다', async () => {
    vi.stubEnv('VITE_REVIEW_ENDPOINT', 'http://localhost/api/review');
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ json: async () => ({ ok: true, findings: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await reviewIntake(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it('응답이 JSON이 아니면 ok:false 다', async () => {
    vi.stubEnv('VITE_REVIEW_ENDPOINT', 'http://localhost/api/review');
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => {
        throw new Error('not json');
      },
    })));
    const result = await reviewIntake(input);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad json');
  });

  it('두 번 다 실패하면 ok:false 다', async () => {
    vi.stubEnv('VITE_REVIEW_ENDPOINT', 'http://localhost/api/review');
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await reviewIntake(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
  });

  it('접수자 정보를 요청 본문에 넣지 않는다', async () => {
    vi.stubEnv('VITE_REVIEW_ENDPOINT', 'http://localhost/api/review');
    const fetchMock = vi.fn(async () => ({ json: async () => ({ ok: true, findings: [] }) }));
    vi.stubGlobal('fetch', fetchMock);
    await reviewIntake({ title: '제목', body: '본문', expectedChange: '기대' });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(sent).sort()).toEqual(['body', 'expectedChange', 'title']);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/intakeReview.test.ts`
Expected: FAIL — `Failed to resolve import "./intakeReview"`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/intakeReview.ts` 생성:

```ts
// 접수 검토 이음새(seam): 제출 직전 본문을 LLM으로 검토해 욕설·인신공격을 걸러낸다.
// VITE_REVIEW_ENDPOINT가 설정되면 프록시로 POST하고, 없으면 disabled를 돌려줘 호출부가 그냥 통과시킨다.
// 프론트는 "어느 LLM/키냐"를 모르고 URL·규격에만 의존한다(키는 프록시에만 존재).
export type ReviewField = 'title' | 'body' | 'expectedChange';
export type ReviewKind = 'profanity' | 'personal-attack';

export type ReviewFinding = {
  field: ReviewField;
  kind: ReviewKind;
  reason: string;
  rewritten: string;
};

export type ReviewInput = { title: string; body: string; expectedChange: string };
export type ReviewResult = { ok: boolean; findings?: ReviewFinding[]; reason?: string };

const FIELDS: ReviewField[] = ['title', 'body', 'expectedChange'];
const TIMEOUT_MS = 8000;

// 모듈 로드 시점이 아니라 호출 시점에 읽는다. 테스트에서 환경변수를 갈아끼울 수 있어야 한다.
function endpoint(): string | undefined {
  return (import.meta.env as Record<string, string | undefined>).VITE_REVIEW_ENDPOINT || undefined;
}

// 응답이 신뢰할 수 없는 형태여도 앱이 깨지지 않게 방어적으로 정제한다.
// 정제 후 0개면 "지적할 것 없음"과 같게 취급된다.
export function sanitizeFindings(raw: unknown): ReviewFinding[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const f = item as { field?: unknown; kind?: unknown; reason?: unknown; rewritten?: unknown };
      const field = FIELDS.find((name) => name === f.field);
      const rewritten = typeof f.rewritten === 'string' ? f.rewritten.trim() : '';
      const reason = typeof f.reason === 'string' ? f.reason.trim() : '';
      // 모르는 kind는 안전한 쪽으로 내린다. 욕설이라고 잘못 단정하면 문구가 과해진다.
      const kind: ReviewKind = f.kind === 'profanity' ? 'profanity' : 'personal-attack';

      if (!field || !rewritten) return null;
      return { field, kind, reason, rewritten };
    })
    .filter((item): item is ReviewFinding => item !== null);
}

async function postOnce(url: string, input: ReviewInput): Promise<ReviewResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 접수자 정보는 검토에 필요 없다. 보내지 않는다.
      body: JSON.stringify({ title: input.title, body: input.body, expectedChange: input.expectedChange }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; findings?: unknown; reason?: string }
      | null;

    if (!data) return { ok: false, reason: 'bad json' };
    if (!data.ok) return { ok: false, reason: data.reason || 'failed' };
    return { ok: true, findings: sanitizeFindings(data.findings) };
  } catch (error) {
    return { ok: false, reason: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** 검토를 요청한다. 실패하면 한 번만 자동 재시도한다(일시적 오류가 접수를 막지 않도록). */
export async function reviewIntake(input: ReviewInput): Promise<ReviewResult> {
  const url = endpoint();
  if (!url) return { ok: false, reason: 'disabled' };

  const first = await postOnce(url, input);
  if (first.ok) return first;

  return postOnce(url, input);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/intakeReview.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: 전체 테스트와 타입 검사**

Run: `npx tsc --noEmit && npm test`
Expected: 타입 오류 없음, 기존 88 + 신규 14 = 102 tests PASS

- [ ] **Step 6: 커밋**

```bash
git add src/intakeReview.ts src/intakeReview.test.ts
git commit -m "접수 검토 이음새 추가

제출 직전 본문을 LLM 프록시로 보내 욕설·인신공격을 검토한다.
응답은 방어적으로 정제해 스키마가 어긋나도 앱이 깨지지 않게 한다.
일시적 실패가 접수를 막지 않도록 1회 자동 재시도한다.

요청 본문에 접수자 정보(이름·메일·소속)를 넣지 않는다. 검토에 필요 없다."
```

---

### Task 2: 검토 프록시 (서버리스 + 로컬)

OpenRouter를 호출하고 프롬프트를 보유한다. 키는 여기에만 있다. `api/ai.ts` / `scripts/ai-proxy.mjs`와 같은 구조이며, 프롬프트가 다르므로 파일을 분리한다(기존 패턴과 동일하게 두 벌을 유지한다).

**Files:**
- Create: `api/review.ts`
- Create: `scripts/review-proxy.mjs`
- Modify: `scripts/proxy.mjs` (라우팅 추가)
- Modify: `package.json` (스크립트 추가)
- Modify: `.env.example` (프론트 변수 추가)

**Interfaces:**
- Consumes: Task 1의 응답 규격 — `{ ok: boolean, findings?: [{ field, kind, reason, rewritten }], reason?: string }`
- Produces: `POST /api/review` 엔드포인트, `export function handleReview(req, res)` (proxy.mjs가 라우팅에 사용)

- [ ] **Step 1: 서버리스 핸들러를 만든다**

`api/review.ts` 생성:

```ts
// 접수 검토 프록시 — 대나무숲 접수 본문에서 욕설·인신공격을 찾아 다듬은 문장을 제안한다.
//
// 프론트(intakeReview.ts)는 VITE_REVIEW_ENDPOINT로 아래 규격을 POST한다:
//   { title: string, body: string, expectedChange: string }
// 응답: { ok: boolean, findings?: [{ field, kind, reason, rewritten }], reason?: string }
//
// 서버 환경변수(비밀은 서버에만):
//   OPENROUTER_API_KEY : OpenRouter 키(sk-or-...). 없으면 휴면 → 프론트는 검토 없이 통과.
//   OPENROUTER_MODEL   : 모델 슬러그(기본 anthropic/claude-haiku-4.5)

type ReviewPayload = { title?: string; body?: string; expectedChange?: string };

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

export const REVIEW_SYSTEM_PROMPT = [
  '당신은 사내 익명 의견 접수 글을 검토합니다.',
  '목적은 검열이 아니라, 읽는 리더가 사안에 집중할 수 있게 만드는 것입니다.',
  '',
  '지적할 것은 두 가지뿐입니다.',
  '1) 욕설·비속어 → kind: "profanity"',
  '2) 특정인의 인격·능력에 대한 평가·비하 → kind: "personal-attack"',
  '',
  '반드시 지킬 것:',
  '- 사실 주장과 개선 요구는 절대 삭제하거나 완곡하게 만들지 않습니다. 강도를 낮추지 않습니다.',
  '- 행동·영향·요구는 그대로 둡니다. 사람에 대한 평가 표현만 바꿉니다.',
  '- 본인이 겪은 피해 진술은 인신공격이 아닙니다.',
  '    "저 사람은 무능하다" → 인격 평가 → 지적합니다',
  '    "저 사람이 저에게 욕설을 했습니다" → 사실 진술 → 지적하지 않습니다',
  '- 없는 내용을 지어내지 않습니다.',
  '- 문체·어투·맞춤법은 지적하지 않습니다.',
  '- 지적할 것이 없으면 findings 를 빈 배열로 둡니다. 억지로 찾지 않습니다.',
  '',
  '반드시 아래 JSON 스키마로만 답하세요. 설명·인사말·코드펜스 없이 JSON 객체 하나만 출력합니다.',
  '{"findings":[{"field":"title|body|expectedChange","kind":"profanity|personal-attack","reason":"<한 문장>","rewritten":"<완성 문장>"}]}',
  '- field 는 문제가 있는 항목의 키입니다.',
  '- rewritten 은 그 항목 전체를 대체할 완성된 한국어 문장입니다. 문제 부분만 잘라내지 않습니다.',
  '- reason 은 접수자에게 그대로 보여집니다. 비난하지 말고 담담하게 한 문장으로 씁니다.',
].join('\n');

// LLM 출력에서 코드펜스를 걷어내고 JSON만 파싱.
function parseJson(content: string): { findings?: unknown } | null {
  const stripped = String(content || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = env('OPENROUTER_API_KEY');
  if (!apiKey) {
    // 키 미주입 → 휴면. 프론트는 검토 없이 통과시킨다.
    return Response.json({ ok: false, reason: 'OPENROUTER_API_KEY not configured' });
  }

  let payload: ReviewPayload;
  try {
    payload = (await request.json()) as ReviewPayload;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  const expectedChange = String(payload.expectedChange ?? '').trim();
  if (!title && !body) {
    return Response.json({ ok: false, reason: 'empty input' });
  }

  const model = env('OPENROUTER_MODEL') || 'anthropic/claude-haiku-4.5';
  try {
    const upstream = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'SK Grove',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ title, body, expectedChange }) },
        ],
        temperature: 0,
      }),
    });
    const data = (await upstream.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!upstream.ok || !data) {
      return Response.json({ ok: false, reason: data?.error?.message || `openrouter ${upstream.status}` });
    }
    const parsed = parseJson(data.choices?.[0]?.message?.content ?? '');
    if (!parsed || !Array.isArray(parsed.findings)) {
      return Response.json({ ok: false, reason: 'parse failed' });
    }
    return Response.json({ ok: true, findings: parsed.findings });
  } catch (error) {
    return Response.json({ ok: false, reason: String(error) });
  }
}
```

- [ ] **Step 2: 로컬 프록시를 만든다**

`scripts/review-proxy.mjs` 생성. `.env.ai.local`을 그대로 공유한다(같은 OpenRouter 키다):

```js
// 로컬 접수 검토 프록시 (OpenRouter) — 접수 본문에서 욕설·인신공격을 찾아 다듬은 문장을 제안.
// 단독 실행: node scripts/review-proxy.mjs   |   통합 실행: scripts/proxy.mjs 가 handleReview 를 /api/review 로 라우팅.
// 키는 .env.ai.local 에만 존재(AI 취합 프록시와 같은 파일을 공유). Node 18+.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const env = {};
try {
  const text = readFileSync(new URL('../.env.ai.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch {
  console.warn('⚠️  .env.ai.local 없음 — 접수 검토 휴면. 설정: cp .env.ai.example .env.ai.local');
}

const PORT = Number(env.REVIEW_PORT || 8789);
const API_KEY = env.OPENROUTER_API_KEY;
const MODEL = env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM = [
  '당신은 사내 익명 의견 접수 글을 검토합니다.',
  '목적은 검열이 아니라, 읽는 리더가 사안에 집중할 수 있게 만드는 것입니다.',
  '',
  '지적할 것은 두 가지뿐입니다.',
  '1) 욕설·비속어 → kind: "profanity"',
  '2) 특정인의 인격·능력에 대한 평가·비하 → kind: "personal-attack"',
  '',
  '반드시 지킬 것:',
  '- 사실 주장과 개선 요구는 절대 삭제하거나 완곡하게 만들지 않습니다. 강도를 낮추지 않습니다.',
  '- 행동·영향·요구는 그대로 둡니다. 사람에 대한 평가 표현만 바꿉니다.',
  '- 본인이 겪은 피해 진술은 인신공격이 아닙니다.',
  '    "저 사람은 무능하다" → 인격 평가 → 지적합니다',
  '    "저 사람이 저에게 욕설을 했습니다" → 사실 진술 → 지적하지 않습니다',
  '- 없는 내용을 지어내지 않습니다.',
  '- 문체·어투·맞춤법은 지적하지 않습니다.',
  '- 지적할 것이 없으면 findings 를 빈 배열로 둡니다. 억지로 찾지 않습니다.',
  '',
  '반드시 아래 JSON 스키마로만 답하세요. 설명·인사말·코드펜스 없이 JSON 객체 하나만 출력합니다.',
  '{"findings":[{"field":"title|body|expectedChange","kind":"profanity|personal-attack","reason":"<한 문장>","rewritten":"<완성 문장>"}]}',
  '- field 는 문제가 있는 항목의 키입니다.',
  '- rewritten 은 그 항목 전체를 대체할 완성된 한국어 문장입니다. 문제 부분만 잘라내지 않습니다.',
  '- reason 은 접수자에게 그대로 보여집니다. 비난하지 말고 담담하게 한 문장으로 씁니다.',
].join('\n');

function parseJson(content) {
  const stripped = String(content || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

// 통합/단독 공용 요청 핸들러 (/api/review).
export function handleReview(req, res) {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(405, { ok: false, reason: 'method' });
    return;
  }
  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', async () => {
    if (!API_KEY) {
      send(200, { ok: false, reason: 'OPENROUTER_API_KEY 미설정' });
      return;
    }
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      send(400, { ok: false, reason: 'bad json' });
      return;
    }
    const title = String(p.title || '').trim();
    const body = String(p.body || '').trim();
    const expectedChange = String(p.expectedChange || '').trim();
    if (!title && !body) {
      send(200, { ok: false, reason: 'empty input' });
      return;
    }
    try {
      const upstream = await fetch(OPENROUTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'X-Title': 'SK Grove',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: JSON.stringify({ title, body, expectedChange }) },
          ],
          temperature: 0,
        }),
      });
      const data = await upstream.json().catch(() => null);
      if (!upstream.ok || !data) {
        const reason = data?.error?.message || `openrouter ${upstream.status}`;
        console.error('[review] upstream error:', reason);
        send(200, { ok: false, reason });
        return;
      }
      const parsed = parseJson(data.choices?.[0]?.message?.content);
      if (!parsed || !Array.isArray(parsed.findings)) {
        send(200, { ok: false, reason: 'parse failed' });
        return;
      }
      send(200, { ok: true, findings: parsed.findings });
    } catch (error) {
      console.error('[review] error:', error);
      send(200, { ok: false, reason: String(error) });
    }
  });
}

// 단독 실행일 때만 서버를 띄운다(import 되면 핸들러만 제공).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  createServer(handleReview).listen(PORT, () => {
    console.log(`🧐 review-proxy 실행 중 → http://127.0.0.1:${PORT}/api/review`);
  });
}
```

- [ ] **Step 3: 통합 프록시에 라우팅을 추가한다**

`scripts/proxy.mjs`를 아래 내용으로 교체:

```js
// 통합 로컬 프록시 — notify(슬랙) + ai(OpenRouter 취합) + review(접수 검토)를 한 포트에서 경로로 분기한다.
// 실행: node scripts/proxy.mjs  (또는 npm run proxy)
//   POST /api/ai      → AI 취합 (ai-proxy)
//   POST /api/review  → 접수 검토 (review-proxy)
//   POST /api/notify  → 슬랙 전송 (notify-proxy)
// 설정은 .env.ai.local / .env.notify.local 에서 읽는다(없으면 해당 기능만 휴면).
import { createServer } from 'node:http';
import { handleAi } from './ai-proxy.mjs';
import { handleReview } from './review-proxy.mjs';
import { handleNotify } from './notify-proxy.mjs';

const PORT = Number(process.env.PROXY_PORT || 8787);

createServer((req, res) => {
  const url = req.url || '';
  if (url.includes('/api/review')) {
    handleReview(req, res);
    return;
  }
  if (url.includes('/api/ai')) {
    handleAi(req, res);
    return;
  }
  handleNotify(req, res); // 기본: 슬랙(경로 미지정 포함, 하위호환)
}).listen(PORT, () => {
  console.log(`🔗 proxy (notify+ai+review) 실행 중 → http://127.0.0.1:${PORT}`);
  console.log(`   • POST /api/ai      (OpenRouter 취합)`);
  console.log(`   • POST /api/review  (접수 검토)`);
  console.log(`   • POST /api/notify  (슬랙 전송)`);
});
```

경로가 서로 겹치지 않아 순서 자체는 결과에 영향이 없다. 다만 가장 구체적인 경로를 위에 두는 편이 나중에 `/api/ai-*` 같은 경로가 늘어도 안전하다.

- [ ] **Step 4: package.json 스크립트와 .env.example 을 갱신한다**

`package.json`의 `scripts`에 추가(`ai-proxy` 다음 줄):

```json
    "review-proxy": "node scripts/review-proxy.mjs",
```

`.env.example` 끝에 추가:

```
# 접수 AI 사전 검토 프록시 주소. 비워두면 검토 없이 접수된다(기능 없음 상태).
# 로컬 통합 프록시 사용 시: npm run proxy 실행 후 아래 값을 쓴다.
VITE_REVIEW_ENDPOINT=http://127.0.0.1:8787/api/review
```

`.env.ai.example` 끝에 추가:

```
# 접수 검토 프록시를 단독 실행할 때의 포트 (node scripts/review-proxy.mjs)
# REVIEW_PORT=8789
```

- [ ] **Step 5: 프록시가 뜨는지 확인한다**

Run:
```bash
node scripts/proxy.mjs &
sleep 2
curl -s -X POST http://127.0.0.1:8787/api/review \
  -H 'Content-Type: application/json' \
  -d '{"title":"테스트","body":"본문","expectedChange":""}'
```

Expected: `.env.ai.local`이 없으면 `{"ok":false,"reason":"OPENROUTER_API_KEY 미설정"}`. 키가 있으면 `{"ok":true,"findings":[]}`.
둘 다 정상이다 — 키가 없어도 **500이 아니라 `ok:false`** 가 나와야 한다. 확인 후 프로세스를 종료한다.

- [ ] **Step 6: 타입 검사와 커밋**

Run: `npx tsc --noEmit && npm test`
Expected: 통과 (프록시는 테스트 대상 아님 — 기존 `api/ai.ts`와 동일)

```bash
git add api/review.ts scripts/review-proxy.mjs scripts/proxy.mjs package.json .env.example .env.ai.example
git commit -m "접수 검토 프록시 추가

OpenRouter 키를 서버에만 두고 접수 본문을 검토한다. 서버리스(api/review.ts)와
로컬(scripts/review-proxy.mjs) 두 벌을 두는 것은 api/ai.ts 와 같은 기존 패턴이다.

프롬프트에 '본인이 겪은 피해 진술은 인신공격이 아니다'를 명시했다.
이 예외가 없으면 괴롭힘 제보가 통째로 막힌다.

키가 없으면 500이 아니라 ok:false 로 응답해 프론트가 통과시킬 수 있게 한다."
```

---

### Task 3: ReviewGate 컴포넌트

검토 상태 네 가지를 그리는 UI. `Intake.tsx`에 연결하기 전에 단독으로 완성한다.

**Files:**
- Create: `src/features/intake/ReviewGate.tsx`
- Modify: `src/styles.css` (파일 끝에 추가)

**Interfaces:**
- Consumes: Task 1의 `reviewIntake`, `ReviewFinding`, `ReviewInput`
- Produces:
  - `type ReviewGateProps = { title: string; body: string; expectedChange: string; onApplyFix: (field: ReviewField, rewritten: string) => void; onEditManually: () => void; onReadyChange: (ready: boolean) => void }`
  - **주의:** 검토 입력을 객체 prop(`input={{...}}`)으로 받으면 매 렌더마다 새 객체라 `useCallback` 의존성이 계속 바뀌어 무한 재검토에 빠진다. 그래서 문자열 셋을 따로 받는다. `onReadyChange`도 부모가 인라인 화살표가 아니라 안정된 참조(`setReviewReady`)를 넘겨야 한다.
  - `function ReviewGate(props: ReviewGateProps): JSX.Element`
  - `onReadyChange(true)` = 제출 가능, `false` = 제출 불가. `Intake.tsx`가 이 값으로 제출 버튼을 잠근다.

- [ ] **Step 1: 컴포넌트를 만든다**

`src/features/intake/ReviewGate.tsx` 생성:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, PenLine, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { reviewIntake, type ReviewField, type ReviewFinding } from '../../intakeReview';

// 검토 입력을 객체로 받지 않는다. 매 렌더마다 새 객체가 되어 재검토가 무한히 돈다.
type ReviewGateProps = {
  title: string;
  body: string;
  expectedChange: string;
  onApplyFix: (field: ReviewField, rewritten: string) => void;
  onEditManually: () => void;
  onReadyChange: (ready: boolean) => void;
};

type GateState =
  | { phase: 'checking' }
  | { phase: 'clear' }
  | { phase: 'blocked'; findings: ReviewFinding[] }
  | { phase: 'unavailable' };

const FIELD_LABEL: Record<ReviewField, string> = {
  title: '제목',
  body: '내용',
  expectedChange: '기대 변화',
};

export function ReviewGate({
  title,
  body,
  expectedChange,
  onApplyFix,
  onEditManually,
  onReadyChange,
}: ReviewGateProps) {
  const [state, setState] = useState<GateState>({ phase: 'checking' });

  // 의존성은 원시값 셋이다. 값이 실제로 바뀔 때만 다시 검토한다.
  const runReview = useCallback(async () => {
    setState({ phase: 'checking' });
    const result = await reviewIntake({ title, body, expectedChange });

    // 엔드포인트 미설정은 "기능 없음"이지 "검사 실패"가 아니다. 조용히 통과시킨다.
    if (!result.ok) {
      setState({ phase: result.reason === 'disabled' ? 'clear' : 'unavailable' });
      return;
    }

    const findings = result.findings ?? [];
    setState(findings.length > 0 ? { phase: 'blocked', findings } : { phase: 'clear' });
  }, [title, body, expectedChange]);

  useEffect(() => {
    void runReview();
  }, [runReview]);

  // 제출 가능 여부를 부모에게 알린다. 지적이 남아 있는 동안에만 잠근다.
  useEffect(() => {
    onReadyChange(state.phase === 'clear' || state.phase === 'unavailable');
  }, [state.phase, onReadyChange]);

  if (state.phase === 'checking') {
    return (
      <div className="review-gate checking">
        <Sparkles size={18} />
        <p>내용을 검토하고 있어요. 잠시만 기다려주세요.</p>
      </div>
    );
  }

  if (state.phase === 'unavailable') {
    return (
      <div className="review-gate unavailable">
        <AlertTriangle size={18} />
        <div>
          <strong>AI 검토를 받지 못한 상태로 접수됩니다</strong>
          <span>특정인을 향한 표현이 없는지 직접 확인해주세요.</span>
        </div>
        <button className="secondary-button" onClick={() => void runReview()}>
          <RefreshCw size={16} />
          다시 검토
        </button>
      </div>
    );
  }

  if (state.phase === 'clear') {
    return (
      <div className="review-gate clear">
        <ShieldCheck size={18} />
        <p>검토를 마쳤어요. 이대로 접수할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="review-gate blocked">
      <div className="review-gate-head">
        <AlertTriangle size={18} />
        <strong>다듬어야 접수할 수 있어요</strong>
      </div>

      {state.findings.map((finding, index) => (
        <article className="review-finding" key={`${finding.field}-${index}`}>
          <span className={`review-kind ${finding.kind}`}>
            {finding.kind === 'profanity' ? '욕설' : '인신공격'} · {FIELD_LABEL[finding.field]}
          </span>
          {finding.reason && <p className="review-reason">{finding.reason}</p>}
          <p className="review-rewritten">{finding.rewritten}</p>
          <button className="primary-button" onClick={() => onApplyFix(finding.field, finding.rewritten)}>
            제안대로 수정
          </button>
        </article>
      ))}

      <div className="review-gate-foot">
        <button className="secondary-button" onClick={onEditManually}>
          <PenLine size={16} />
          내가 직접 고치기
        </button>
        {/* 앱이 받지 못하는 말도 사람은 받을 수 있어야 한다. 막다른 길을 만들지 않는다. */}
        <p className="field-note">
          이 내용이 꼭 그대로 전달되어야 하는 사안이라면, 리더에게 1on1을 요청해주세요. 접수 화면 대신 직접 이야기하는
          편이 나은 일도 있습니다.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 스타일을 추가한다**

`src/styles.css` 파일 끝에 추가:

```css

/* ===== 접수 AI 사전 검토 ===== */
.review-gate {
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
}

.review-gate p {
  margin: 0;
}

.review-gate.checking {
  background: #f7faf5;
  color: var(--color-muted);
}

.review-gate.clear {
  background: #f2f7f0;
  color: var(--color-primary);
}

.review-gate.unavailable {
  background: #fdf8ec;
  border-color: #e4d5a8;
}

.review-gate.unavailable div {
  display: grid;
  flex: 1;
  gap: 2px;
}

.review-gate.unavailable span {
  color: var(--color-muted);
  font-size: 13px;
}

.review-gate.blocked {
  align-items: stretch;
  background: #fdf4f2;
  border-color: #edc9c2;
  display: grid;
  gap: var(--space-3);
}

.review-gate-head {
  align-items: center;
  color: #a3453c;
  display: flex;
  font-weight: 700;
  gap: var(--space-2);
}

.review-finding {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
}

.review-kind {
  background: #fbeee7;
  border-radius: 999px;
  color: #a3453c;
  font-size: 12px;
  font-weight: 700;
  padding: var(--space-1) var(--space-2);
  width: fit-content;
}

.review-kind.profanity {
  background: #f6dedb;
}

.review-reason {
  color: var(--color-muted);
  font-size: 13px;
}

.review-rewritten {
  background: #f7faf5;
  border-left: 3px solid var(--color-primary);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: var(--space-2) var(--space-3);
  white-space: pre-wrap;
}

.review-finding .primary-button {
  justify-self: start;
}

.review-gate-foot {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
}
```

- [ ] **Step 3: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 오류 없음 (`ReviewGate`는 아직 import되지 않지만 타입은 맞아야 한다)

- [ ] **Step 4: 커밋**

```bash
git add src/features/intake/ReviewGate.tsx src/styles.css
git commit -m "접수 검토 UI 컴포넌트 추가

검토 상태 네 가지(검토 중·통과·지적·검토 실패)를 그린다.
Intake.tsx 가 이미 500줄 근처라 별도 컴포넌트로 분리했다.

지적 화면에는 출구를 둘 둔다 — 제안 수용과 직접 수정. AI 제안이 작성자
의도와 다를 수 있어서 직접 고치는 길이 반드시 있어야 한다. 계속 막히는
경우를 위해 1on1 안내도 함께 둔다."
```

---

### Task 4: Intake 연결

`ReviewGate`를 제출 전 확인 단계에 넣고, 검토를 통과해야 제출되게 한다.

**Files:**
- Modify: `src/features/intake/Intake.tsx`

**Interfaces:**
- Consumes: Task 3의 `ReviewGate`, Task 1의 `ReviewField`
- Produces: 없음 (최종 태스크)

- [ ] **Step 1: import 와 상태를 추가한다**

`src/features/intake/Intake.tsx` 상단 import 블록에 추가:

```tsx
import { ReviewGate } from './ReviewGate';
import type { ReviewField } from '../../intakeReview';
```

`const [anonymousIssueId, setAnonymousIssueId] = useState('');` 다음 줄에 추가:

```tsx
  // 검토를 통과하기 전에는 제출할 수 없다. 검토 중에도 잠근다.
  const [reviewReady, setReviewReady] = useState(false);
```

- [ ] **Step 2: 제안 반영 핸들러를 추가한다**

`const submit = () => {` 바로 위에 추가:

```tsx
  // AI 제안을 해당 필드에 반영한다. 반영하면 ReviewGate가 바뀐 값으로 자동 재검토한다.
  const applyReviewFix = (field: ReviewField, rewritten: string) => {
    if (field === 'title') setTitle(rewritten);
    if (field === 'body') setBody(rewritten);
    if (field === 'expectedChange') setExpectedChange(rewritten);
  };
```

- [ ] **Step 3: review 단계에 ReviewGate 를 넣고 제출을 잠근다**

`{step === 'review' && (` 블록 안에서, `<div className="notice-line">` 로 시작하는 개인정보 안내 **바로 위**에 추가:

```tsx
            <ReviewGate
              title={title}
              body={body}
              expectedChange={expectedChange}
              onApplyFix={applyReviewFix}
              onEditManually={() => setStep('content')}
              onReadyChange={setReviewReady}
            />

            {/* 외부 전송 고지는 검토 결과와 무관하게 항상 보인다. */}
            <p className="field-note">
              다듬기 검토를 위해 작성 내용이 외부 AI로 전송됩니다. 이름·메일·소속은 보내지 않습니다.
            </p>
```

같은 블록의 접수 버튼에 `disabled`를 추가:

```tsx
              <button className="primary-button" disabled={!reviewReady} onClick={submit}>
                <Send size={18} />
                접수하기
              </button>
```

- [ ] **Step 4: submit 에도 안전장치를 건다**

`const submit = () => {` 의 첫 줄 가드를 교체:

```tsx
  const submit = () => {
    // 버튼이 잠겨 있어도 다른 경로로 호출될 수 있으니 여기서 한 번 더 막는다.
    if (!reviewReady || !title.trim() || !body.trim()) return;
```

- [ ] **Step 5: 단계 이동 시 검토 상태를 초기화한다**

`content` 단계의 `제출 전 확인` 버튼 onClick 을 교체:

```tsx
              <button
                className="primary-button"
                disabled={!title.trim() || !body.trim()}
                onClick={() => {
                  // 내용이 바뀌었으니 이전 검토 결과를 물려받지 않는다.
                  setReviewReady(false);
                  setStep('review');
                }}
              >
                제출 전 확인
              </button>
```

- [ ] **Step 6: 빌드와 테스트**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: 전부 통과

- [ ] **Step 7: 브라우저에서 확인한다**

```bash
npm run dev -- --port 5199
```

`http://127.0.0.1:5199/` 에서 빠른 로그인 → 대나무숲 접수 → 내용 작성 → 제출 전 확인.

`VITE_REVIEW_ENDPOINT` 미설정 상태에서 확인할 것:
- 검토 UI가 "검토를 마쳤어요"로 뜨고 **접수 버튼이 활성**인지 (기능 없음 = 통과)
- 외부 전송 고지 문구가 보이는지

`.env` 에 `VITE_REVIEW_ENDPOINT=http://127.0.0.1:8787/api/review` 를 넣고 `npm run proxy` 를 함께 띄운 뒤, `.env.ai.local` 에 유효한 키가 있는 상태에서 아래 네 문장으로 프롬프트 품질을 확인한다(스펙의 수동 확인표):

| 내용 필드에 넣을 문장 | 기대 |
|---|---|
| `팀장이 회의에서 발언을 자주 끊습니다` | 지적 없음 → 접수 가능 |
| `김OO 과장은 무능해서 팀에 민폐다` | 지적됨 → 접수 불가 |
| `김OO 과장이 저에게 욕설을 했습니다` | **지적 없음** → 접수 가능 |
| `아 진짜 XX 짜증나서 못 해먹겠다` | 지적됨(욕설) → 접수 불가 |

세 번째 줄이 지적되면 프롬프트의 "피해 진술" 예외가 작동하지 않는 것이다. `api/review.ts`와 `scripts/review-proxy.mjs`의 해당 문구를 함께 강화하고 다시 확인한다.

확인이 끝나면 dev 서버와 프록시를 종료한다.

- [ ] **Step 8: 커밋**

```bash
git add src/features/intake/Intake.tsx
git commit -m "접수 제출 전 AI 검토 연결

제출 전 확인 단계에서 검토를 실행하고, 지적이 남아 있으면 접수 버튼을 잠근다.
제안을 반영하면 바뀐 값으로 자동 재검토된다.

내용을 고치러 돌아갔다 오면 이전 검토 결과를 물려받지 않도록 초기화한다.
버튼이 잠겨 있어도 submit 안에서 한 번 더 막는다."
```

---

## 완료 조건

- `npm test` 통과 (기존 88 + 신규 14 = 102)
- `npx tsc --noEmit` 오류 없음
- `npm run build` 성공
- `VITE_REVIEW_ENDPOINT` 미설정 시 접수가 정상 동작한다(검토 없이 통과)
- 프록시 연결 시 수동 확인표 4줄이 기대대로 동작한다
- `Issue` 타입과 DB 스키마에 변경이 없다(검토 결과를 저장하지 않는다)
