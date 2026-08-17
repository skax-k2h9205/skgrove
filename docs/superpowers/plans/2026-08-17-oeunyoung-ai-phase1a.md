# 오은영AI 오케스트레이션 Phase 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오은영AI를 인프라 변경 없이 즉시 고도화한다 — 답변 모델을 GLM-5.2로 교체, 페르소나(상담 골격)를 강화, 자·타해 위기 신호를 실제 게이트로 단락(short-circuit), 서버/로컬 두 벌로 흩어진 페르소나를 단일 출처로 통합.

**Architecture:** 상담 파이프라인의 앞단(위기 triage)과 프롬프트 조립을 순수함수 공유 모듈(`lib/counsel/*.js`)로 뽑아 `api/chat.ts`(Vercel 서버리스)와 `scripts/chat-proxy.mjs`(로컬 SSE 프록시)가 함께 쓰게 한다. 위기 감지는 정규식/키워드(0 LLM콜)로, 감지 시 OpenRouter 호출 없이 고정 안전 응답을 반환한다. RAG·자동 라우터·툴콜은 이 계획 범위 밖(후속 계획).

**Tech Stack:** ESM(Node type:module), TypeScript(api/프론트), 순수 `.js` 공유 모듈, vitest, OpenRouter(모델 GLM-5.2, `OPENROUTER_MODEL` env).

**Spec:** `docs/superpowers/specs/2026-08-17-oeunyoung-ai-orchestration-design.md`

## Global Constraints

- 프로덕션은 **비스트리밍 JSON** 유지(`api/chat.ts`), `maxDuration = 60`. 스트리밍 전환 금지(504 이력).
- **새 외부 비밀키 0.** Phase 1a는 인프라 추가가 전혀 없다(Supabase/임베딩/Edge Function 없음).
- **서식 규칙(`FORMAT_RULES`) 목록을 늘리지 않는다.** 웹 `Markdownish`·iOS `ChatMarkdown`·안드 `chatAnnotated` 세 렌더러가 아는 서식만 허용.
- 공유 모듈은 **순수 ESM `.js`** — `api/`(esbuild), `scripts/*.mjs`(node), vitest 셋 다에서 import 가능해야 함. import 시 확장자 명시(`'../lib/counsel/persona.js'`).
- 페르소나·시스템 프롬프트 조립은 **단일 출처**(`lib/counsel/persona.js`). 서버와 로컬 프록시가 동일 결과를 내야 한다.
- 모델은 코드에 하드코딩하지 않고 `OPENROUTER_MODEL` env로 주입. 폴백 기본값(`anthropic/claude-haiku-4.5`)은 유지.
- 위기 감지는 **미탐(false negative)을 오탐보다 위험**하게 취급한다 — 애매하면 안전 응답 쪽으로.

---

## File Structure

- Create: `lib/counsel/route.js` — 위기 감지 순수함수 + 고정 안전 응답.
- Create: `lib/counsel/route.test.ts` — 위기 감지 테스트.
- Create: `lib/counsel/persona.js` — 강화된 PERSONA/RULE_PERSONA/FORMAT_RULES + `buildSystemContent()`.
- Create: `lib/counsel/persona.test.ts` — 시스템 프롬프트 조립 테스트.
- Modify: `api/chat.ts` — 공유 모듈 import, 위기 단락, 중복 상수·조립 로직 제거.
- Modify: `scripts/chat-proxy.mjs` — 공유 모듈 import, 위기 단락, 중복 상수·조립 로직 제거.
- Config: `OPENROUTER_MODEL`(Vercel 환경변수) + `.env.ai.example`(로컬 안내).

---

### Task 1: 위기 감지 순수함수 (`lib/counsel/route.js`)

가장 독립적이고 안전 가치가 큰 조각부터. 순수함수라 완전 단위테스트 가능.

**Files:**
- Create: `lib/counsel/route.js`
- Test: `lib/counsel/route.test.ts`

**Interfaces:**
- Produces:
  - `detectCrisis(text: string): boolean` — 자·타해 위기 신호면 true.
  - `CRISIS_RESPONSE: string` — 위기 시 반환할 고정 안전 응답.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/counsel/route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectCrisis, CRISIS_RESPONSE } from './route.js';

describe('detectCrisis', () => {
  it('직접적 위기 표현을 감지한다', () => {
    expect(detectCrisis('요즘 너무 힘들어서 죽고 싶어요')).toBe(true);
    expect(detectCrisis('그냥 다 끝내고 싶다')).toBe(true);
    expect(detectCrisis('어제 자해했어요')).toBe(true);
    expect(detectCrisis('살고 싶지 않아')).toBe(true);
  });

  it('부정문·강조 관용구는 위기로 오탐하지 않는다', () => {
    expect(detectCrisis('죽고 싶지 않아, 그냥 좀 지칠 뿐이야')).toBe(false);
    expect(detectCrisis('배고파 죽겠다')).toBe(false);
    expect(detectCrisis('오늘 팀장님 때문에 힘들었어요')).toBe(false);
  });

  it('빈 입력은 false', () => {
    expect(detectCrisis('')).toBe(false);
    expect(detectCrisis(undefined as unknown as string)).toBe(false); // 방어적: undefined 도 안전
  });

  it('CRISIS_RESPONSE 는 109 와 EAP 안내를 포함한다', () => {
    expect(CRISIS_RESPONSE).toContain('109');
    expect(CRISIS_RESPONSE).toContain('EAP');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/counsel/route.test.ts`
Expected: FAIL — `Cannot find module './route.js'`.

- [ ] **Step 3: 최소 구현 작성**

`lib/counsel/route.js`:

```js
// 상담 파이프라인의 위기 triage. LLM 을 쓰지 않는 정규식/키워드 게이트다(0 콜, 즉시).
// 미탐(진짜 위기를 놓침)이 오탐보다 위험하므로, 애매하면 감지하는 쪽으로 기운다.
// 대신 명백한 부정문("죽고 싶지 않")과 강조 관용구("배고파 죽겠다")만 배제한다.
// 정교한 분류(상담/룰/잡담 라우팅)는 후속(Phase 2)의 LLM 라우터로.

/** 위기로 볼 표현들. */
const CRISIS = [
  /자살/, /죽고\s*싶/, /죽어\s*버리/, /목숨을?\s*끊/, /자해/, /손목을?\s*긋/,
  /뛰어내리/, /살고\s*싶지\s*않/, /사라지고\s*싶/, /없어지고\s*싶/, /다\s*끝내고\s*싶/,
  /죽여\s*버리/, /해치고\s*싶/,
];

/** 위기 패턴과 겹쳐 보여도 위기가 아닌 것들(부정문 등). 먼저 걸러낸다. */
const NEGATION = [/죽고\s*싶지\s*않/, /죽고\s*싶진\s*않/, /죽고\s*싶은\s*건\s*아니/];

/**
 * 자·타해 위기 신호 여부. 순수함수.
 * @param {string} text
 * @returns {boolean}
 */
export function detectCrisis(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.replace(/\s+/g, ' ');
  if (NEGATION.some((r) => r.test(t))) return false;
  return CRISIS.some((r) => r.test(t));
}

// 위기 시 상담·조언 대신 반환하는 고정 문구. 비판단·따뜻함 + 즉시 연결 가능한 자원.
// NOTE: 사내 EAP 의 실제 연락처/채널이 확정되면 아래 문구를 그 값으로 교체할 것.
export const CRISIS_RESPONSE = [
  '많이 힘드셨겠어요. 지금 느끼는 감정을 혼자 감당하지 않으셨으면 해요.',
  '',
  '지금 바로 이야기 나눌 수 있는 곳이 있어요.',
  '- 자살예방상담전화 109 (24시간, 전화·문자)',
  '- 사내 EAP 상담 (익명·무료)',
  '',
  '제가 상담봇으로 드릴 수 있는 것보다, 훈련된 상담사와 바로 연결되는 게 더 도움이 될 거예요. 괜찮으시다면 위로 먼저 연락해 보시겠어요? 저도 여기 있을게요.',
].join('\n');
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/counsel/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/counsel/route.js lib/counsel/route.test.ts
git commit -m "feat(counsel): 위기 감지 게이트 + 고정 안전 응답(순수함수)"
```

---

### Task 2: 공유 페르소나 + 시스템 프롬프트 조립 (`lib/counsel/persona.js`)

서버(`api/chat.ts`)와 로컬 프록시(`chat-proxy.mjs`)에 복붙된 페르소나·조립 로직을 단일 출처로 통합하고, 상담 골격을 강화한다.

**Files:**
- Create: `lib/counsel/persona.js`
- Test: `lib/counsel/persona.test.ts`

**Interfaces:**
- Produces:
  - `PERSONA: string`, `RULE_PERSONA: string`, `FORMAT_RULES: string`
  - `buildSystemContent(body: { mode?: 'counsel'|'rule', self?, partner?, cases?, knowledge? }): string` — 시스템 프롬프트 본문 조립.
- Consumes: 없음(순수).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/counsel/persona.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PERSONA, RULE_PERSONA, FORMAT_RULES, buildSystemContent } from './persona.js';

describe('buildSystemContent', () => {
  it('상담 모드: 페르소나 + 성향 + 사례를 주입하고 서식 규칙으로 끝난다', () => {
    const out = buildSystemContent({
      mode: 'counsel',
      self: { name: '지훈' },
      partner: { name: '민수' },
      cases: [{ source: '대나무숲', id: 'SOOP-1', title: '회의 갈등', status: '검토중', snippet: '요약' }],
    });
    expect(out).toContain(PERSONA);
    expect(out).toContain('지훈');
    expect(out).toContain('민수');
    expect(out).toContain('대나무숲 SOOP-1'); // 사례가 id 와 함께 인용됨
    expect(out).toContain(FORMAT_RULES);
  });

  it('상담 모드: 사례가 없으면 사례 섹션을 넣지 않는다', () => {
    const out = buildSystemContent({ mode: 'counsel', self: { name: '지훈' } });
    expect(out).not.toContain('[팀의 유사 사례');
  });

  it('룰 모드: 룰 페르소나 + 제공된 지식 문서를 쓴다', () => {
    const out = buildSystemContent({ mode: 'rule', knowledge: '전표 승인 기한은 7일' });
    expect(out).toContain(RULE_PERSONA);
    expect(out).toContain('전표 승인 기한은 7일');
    expect(out).toContain(FORMAT_RULES);
  });

  it('룰 모드: 지식이 없으면 안내 문구로 대체한다', () => {
    const out = buildSystemContent({ mode: 'rule' });
    expect(out).toContain('지식 문서가 제공되지 않았습니다');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/counsel/persona.test.ts`
Expected: FAIL — `Cannot find module './persona.js'`.

- [ ] **Step 3: 최소 구현 작성**

`lib/counsel/persona.js`:

```js
// 오은영AI 상담·룰 챗봇의 페르소나와 시스템 프롬프트 조립 — 단일 출처.
// api/chat.ts(Vercel 서버리스)와 scripts/chat-proxy.mjs(로컬 SSE 프록시)가 함께 import 한다.
// 예전엔 두 벌로 복붙돼 표류 위험이 있었다(2026-08 확인). 여기 한 곳만 고치면 둘 다 반영된다.

export const PERSONA = [
  '너는 SK의 팀 문화 서비스 "SKonnection" 안의 마음상담 챗봇이다.',
  '오은영 선생님처럼 따뜻하되 직설적인 관계 코칭을 한다. 한국어로, 존댓말로 답한다.',
  '항상 이 골격을 따른다: (1) 감정을 인정·요약한다 (2) 나와 상대의 성향을 상대의 언어로',
  '번역해 오해를 풀어준다 — 성향(MBTI·DISC·협업가이드)이 있으면 "상대는 무례한 게 아니라',
  'OO성향이라 이렇게 말한다"처럼 오해를 구체적으로 풀어라 (3) 오늘 할 수 있는 작은 다음',
  '한 걸음을 딱 1개, 구체적으로(누구에게 무슨 말을) 제안한다.',
  '일반론·상투적 위로는 피하고 이름과 상황에 밀착해 답한다. 상황 판단에 정보가 부족하면',
  '조언을 서두르지 말고 딱 한 가지만 되물어라.',
  '특정인을 깎아내리지 않는다. 의료·심리 진단은 하지 않는다. 자·타해 등 위기 신호가',
  '보이면 조언 대신 전문 상담창구(자살예방상담 109, 사내 EAP) 안내로 전환한다.',
  '답 끝에 근거를 짧게 밝힌다 — 예: "(근거: OO님 성향 \'기준형 설계자\', 유사사례 SOOP-142)".',
  '단, 아래 [팀의 유사 사례]에 실제로 제시된 건만 인용한다. 사례가 제공되지 않았으면',
  '사례 번호를 지어내지 말고 성향 근거만 밝히거나 근거 표기를 생략한다.',
].join(' ');

export const RULE_PERSONA = [
  '너는 팀 운영·예산·근태·AI 도구·KPI 규칙과 SK하이닉스 출입·보안 절차를 안내하는 챗봇이다.',
  '한국어 존댓말로 답한다. 아래 제공된 문서들에 근거해서만 답한다.',
  '팀 운영 문서의 "챗봇 답변 규칙"을 지킨다: 관련 규정부터, 금액·기간·절차는 정확한 수치와',
  '함께, 원칙/권고/가능/필수를 구분, 문서에 없는 승인·예외를 지어내지 말고 승인권자(팀장/',
  '파트장/담당 BR) 협의가 필요하다고 안내, 프로젝트비/조직비·개인 L/A·팀 CL/AI·프로젝트코드·',
  '공통 KPI/파트 KPI 를 혼동하지 않는다. 하이닉스 절차는 일정·담당자·URL 이 바뀔 수 있으므로',
  '정확한 내용은 담당자 확인이 필요하다고 덧붙인다. 어느 문서에서 왔는지 간단히 밝힌다.',
].join(' ');

// 세 렌더러(웹 Markdownish, iOS ChatMarkdown, 안드 chatAnnotated)가 아는 서식만 허용.
// 여기 목록을 늘리려면 세 렌더러도 같이 늘려야 한다 — 그 전엔 추가 금지.
export const FORMAT_RULES = [
  '\n\n[답변 서식]',
  '아래 서식만 쓴다. 여기 없는 표기는 앱에서 기호가 글자로 그대로 보인다.',
  '- 문단은 빈 줄로 나눈다',
  '- 목록은 "- " 또는 "1. " 로 시작한다',
  '- 강조는 **굵게** 와 *기울임* 만 쓴다',
  '표, 제목(#), 인용(>), 링크([]()), 코드블록(```)은 쓰지 않는다.',
  '한 답변에 강조는 3개를 넘기지 않는다 — 다 굵으면 아무것도 강조되지 않는다.',
].join('\n');

/**
 * 시스템 프롬프트 본문을 조립한다. knowledge 는 호출부가 이미 해석해 넘긴다
 * (서버리스는 body.knowledge, 로컬 프록시는 body.knowledge || 디스크 읽기).
 * @param {{ mode?: 'counsel'|'rule', self?: unknown, partner?: unknown,
 *   cases?: Array<{source:string,id:string,title:string,status:string,snippet:string}>,
 *   knowledge?: string }} body
 * @returns {string}
 */
export function buildSystemContent(body = {}) {
  const { mode, self, partner, cases, knowledge } = body;
  const system = [];
  if (mode === 'rule') {
    system.push(RULE_PERSONA);
    system.push('\n\n[지식 문서]\n' + (knowledge || '(지식 문서가 제공되지 않았습니다.)'));
  } else {
    system.push(PERSONA);
    if (self) system.push('\n\n[상담을 요청한 사람의 성향]\n' + JSON.stringify(self, null, 2));
    if (partner) system.push('\n\n[갈등 상대의 성향]\n' + JSON.stringify(partner, null, 2));
    if (Array.isArray(cases) && cases.length) {
      system.push(
        '\n\n[팀의 유사 사례(대나무숲·안건)]\n' +
          cases.map((c) => `- [${c.source} ${c.id}] ${c.title} (${c.status}): ${c.snippet}`).join('\n'),
      );
    }
  }
  system.push(FORMAT_RULES);
  return system.join('');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/counsel/persona.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/counsel/persona.js lib/counsel/persona.test.ts
git commit -m "feat(counsel): 페르소나·시스템 프롬프트 조립 단일 출처화 + 상담 골격 강화"
```

---

### Task 3: `api/chat.ts`를 공유 모듈에 배선 + 위기 단락

**Files:**
- Modify: `api/chat.ts`

**Interfaces:**
- Consumes: `buildSystemContent`(Task 2), `detectCrisis`·`CRISIS_RESPONSE`(Task 1).

- [ ] **Step 1: import 추가**

`api/chat.ts` 상단 import 블록(파일 맨 위, 타입 선언 앞)에 추가:

```ts
import { buildSystemContent } from '../lib/counsel/persona.js';
import { detectCrisis, CRISIS_RESPONSE } from '../lib/counsel/route.js';
```

- [ ] **Step 2: 중복 상수·조립 로직 제거**

`api/chat.ts`에서 `const PERSONA = [...]`, `const RULE_PERSONA = [...]`, `const FORMAT_RULES = [...]`(현재 34–69행)와 기존 `function buildMessages(body)`(현재 71–93행)를 삭제하고, 아래 얇은 `buildMessages`로 대체:

```ts
function buildMessages(body: ChatBody) {
  const { messages = [] } = body;
  return [
    { role: 'system', content: buildSystemContent(body) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}
```

- [ ] **Step 3: 위기 단락 추가**

`POST` 핸들러에서 body 파싱 성공 직후(현재 106행 `}` 다음, `const model =` 앞)에 삽입:

```ts
  // 위기 신호는 OpenRouter 호출 없이 즉시 안전 응답으로 단락한다(0 콜).
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (detectCrisis(lastUser)) {
    return Response.json({ ok: true, text: CRISIS_RESPONSE });
  }
```

- [ ] **Step 4: 전체 유닛 테스트가 여전히 통과하는지 확인**

Run: `npx vitest run`
Expected: PASS — 기존 테스트 + Task 1·2 신규 테스트 모두 통과(회귀 없음).

- [ ] **Step 5: 로컬 통합 확인(선택이지만 권장)**

`.env.ai.local`에 `OPENROUTER_API_KEY` 설정 후 로컬 프록시 대신 이 함수 로직은 Task 4에서 함께 검증한다(여기선 유닛/타입만 확인). 스킵 가능.

- [ ] **Step 6: 커밋**

```bash
git add api/chat.ts
git commit -m "refactor(counsel): api/chat.ts 공유 모듈 배선 + 위기 단락"
```

---

### Task 4: `scripts/chat-proxy.mjs`를 공유 모듈에 배선 + 위기 단락

로컬 개발 SSE 프록시. 페르소나 복붙 제거 + 위기 단락을 서버와 동일하게.

**Files:**
- Modify: `scripts/chat-proxy.mjs`

**Interfaces:**
- Consumes: `buildSystemContent`(Task 2), `detectCrisis`·`CRISIS_RESPONSE`(Task 1).

- [ ] **Step 1: import 추가**

`scripts/chat-proxy.mjs`의 import 블록(현재 13–16행) 아래에 추가:

```js
import { buildSystemContent } from '../lib/counsel/persona.js';
import { detectCrisis, CRISIS_RESPONSE } from '../lib/counsel/route.js';
```

- [ ] **Step 2: 중복 상수·조립 로직 제거·대체**

`const PERSONA = [...]`(53–64행), `const RULE_PERSONA = [...]`(66–74행)를 삭제한다. `knowledge()` 함수(40–51행)는 **유지**한다. 기존 `function buildMessages(body)`(76–92행)를 아래로 대체(디스크 지식 폴백을 여기서 해석해 넘김):

```js
function buildMessages(body) {
  const { messages = [] } = body;
  const knowledge = body.mode === 'rule' ? (body.knowledge || knowledge()) : body.knowledge;
  const content = buildSystemContent({ ...body, knowledge });
  return [{ role: 'system', content }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
}
```

주의: 지역변수 `knowledge`가 함수 `knowledge()`와 이름이 겹친다. 함수를 `loadKnowledge`로 rename 하거나 지역변수를 `knowledgeText`로 바꾼다. 아래처럼 지역변수명을 바꾼다:

```js
function buildMessages(body) {
  const { messages = [] } = body;
  const knowledgeText = body.mode === 'rule' ? (body.knowledge || knowledge()) : body.knowledge;
  const content = buildSystemContent({ ...body, knowledge: knowledgeText });
  return [{ role: 'system', content }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
}
```

- [ ] **Step 3: 위기 단락 추가**

`createServer` 핸들러에서 body 파싱 성공 직후(현재 123행 `}` 다음, `try {` 앞)에 삽입:

```js
  // 위기 신호는 LLM 호출 없이 즉시 안전 응답을 흘려보내고 종료(서버리스와 동일 동작).
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (detectCrisis(lastUser)) {
    sse({ token: CRISIS_RESPONSE });
    sse({ done: true });
    return res.end();
  }
```

- [ ] **Step 4: 프록시 기동 확인(위기 경로 — 키 불필요)**

Run(별도 터미널):
```bash
node scripts/chat-proxy.mjs
```
Expected: `chat-proxy on http://localhost:8790 ...` 출력.

다른 터미널에서 위기 입력 전송:
```bash
curl -s -N -X POST http://localhost:8790/ -H 'Content-Type: application/json' \
  -d '{"mode":"counsel","messages":[{"role":"user","content":"죽고 싶어요"}]}'
```
Expected: `data: {"token": "...109..."}` 후 `data: {"done":true}`. (OpenRouter 미호출 — 키 없어도 동작.)

- [ ] **Step 5: 일반 경로 회귀 확인(키 있으면)**

`.env.ai.local`에 `OPENROUTER_API_KEY` 있으면:
```bash
curl -s -N -X POST http://localhost:8790/ -H 'Content-Type: application/json' \
  -d '{"mode":"counsel","messages":[{"role":"user","content":"팀장님과 회의에서 부딪혔어요"}]}'
```
Expected: 토큰 스트림이 정상 수신되고 `done:true`로 끝남(페르소나 조립 정상).

- [ ] **Step 6: 커밋**

```bash
git add scripts/chat-proxy.mjs
git commit -m "refactor(counsel): chat-proxy 공유 모듈 배선 + 위기 단락"
```

---

### Task 5: 답변 모델 GLM-5.2로 교체 (설정)

코드 변경 없음 — `OPENROUTER_MODEL` 환경변수만 바꾼다. `api/chat.ts:108`·`chat-proxy.mjs:35`가 이미 이 env를 읽는다.

**Files:**
- Config: Vercel 환경변수 `OPENROUTER_MODEL`
- Modify: `.env.ai.example`(로컬 안내 주석)

- [ ] **Step 1: GLM-5.2 의 OpenRouter 정확한 슬러그 확인**

https://openrouter.ai/models 에서 "GLM" 검색해 5.2 계열의 정확한 모델 슬러그를 확인한다(예: `z-ai/glm-...` 형태). 슬러그를 아래 `<GLM_5_2_SLUG>` 자리에 사용.

- [ ] **Step 2: Vercel 프로덕션 env 설정**

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables 에서 `OPENROUTER_MODEL = <GLM_5_2_SLUG>` (Production) 추가. 또는 CLI:
```bash
vercel env add OPENROUTER_MODEL production
# 값 입력: <GLM_5_2_SLUG>
```

- [ ] **Step 3: 로컬 안내 갱신**

`.env.ai.example`에 아래 줄이 있는지 확인하고 없으면 추가:
```
# 답변 모델(미지정 시 anthropic/claude-haiku-4.5 폴백). GLM-5.2 예: OPENROUTER_MODEL=<GLM_5_2_SLUG>
OPENROUTER_MODEL=
```

- [ ] **Step 4: 배포 후 실측 검증**

`dev` 브랜치 푸시 → 배포 후(메모리: dev push → GitHub Action → Deploy Hook, connectioner.vercel.app) 실제 상담 1건을 앱에서 보내 응답이 정상 수신되는지, 서식 규칙 위반(별표 노출 등)이 없는지 눈으로 확인. 이상하면 `OPENROUTER_MODEL` 되돌려 즉시 롤백.

- [ ] **Step 5: 커밋**

```bash
git add .env.ai.example
git commit -m "chore(counsel): 답변 모델 GLM-5.2 전환 안내(env)"
```

---

## Self-Review

**Spec coverage (Phase 1a 범위):**
- 모델 GLM-5.2 교체 → Task 5 ✓
- 페르소나/골격 강화(G1) → Task 2 ✓
- 위기 휴리스틱 단락 → Task 1(로직) + Task 3·4(배선) ✓
- 페르소나 단일 출처화 → Task 2·3·4 ✓
- (범위 밖, 후속 계획): 룰 RAG=Phase 1b, 상담 RAG+라우터=Phase 2, 툴콜=Phase 3.

**Placeholder scan:** `<GLM_5_2_SLUG>`는 Task 5 Step 1에서 실제 값을 조회해 채우는 명시적 조회 단계이며(스펙 리스크에 기록된 알려진 미확정), 모호한 지시가 아님. 그 외 TBD/TODO 없음.

**Type/이름 일관성:** `detectCrisis`, `CRISIS_RESPONSE`, `buildSystemContent`가 정의(Task 1·2)와 사용(Task 3·4)에서 동일. `knowledge()` 함수와 지역변수 충돌은 Task 4 Step 2에서 `knowledgeText`로 명시 회피.

---

## 후속 계획(이 문서 범위 밖)

- **Phase 1b — 룰 RAG**: `pgvector` + `rule_chunks` + Supabase Edge Function `rag-search`(gte-small) → 룰 전체 주입 폐기. RAG 인프라 서브시스템을 처음 세우는 별도 계획.
- **Phase 2 — 상담 RAG + (옵션)LLM 라우터**: `case_embeddings` + 준자동 임베딩, 검색을 클라→서버로 이전.
- **Phase 3 — 실데이터 툴콜**: GLM-5.2 함수콜, 1라운드 한정.
