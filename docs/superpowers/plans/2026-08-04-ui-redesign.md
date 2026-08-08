# UI/UX 전면 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** skgrove 13개 화면을 Moss & Clay 팔레트와 업무면/문화면 하이브리드 문법으로 전면 리디자인하고, `styles.css`의 하드코딩 색상값을 전량 토큰으로 흡수한다.

**Architecture:** `src/styles.css` 단일 파일 구조를 유지한 채 `:root` 토큰을 역할 기반으로 재정의하고, 기능별 클래스 접두사(`agenda-`, `memory-`, `can-` 등) 단위로 하드코딩 값을 토큰으로 치환한다. 진행 상태는 `src/designTokens.test.ts`의 래칫 테스트가 기계적으로 강제한다 — 하드코딩 잔량이 정해진 상한을 넘으면 테스트가 실패한다.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 4, Pretendard, lucide-react. 빌드 설정 변경 없음.

## Global Constraints

- CSS는 `src/styles.css` 한 파일 유지. CSS Modules / Tailwind / 파일 분리 모두 범위 밖이다.
- 새로 작성하는 CSS에 하드코딩 색상값(hex, rgb, rgba, hsl)을 넣지 않는다. 예외는 `:root` 블록 내부뿐이다.
- 모든 역할색은 `--color-surface` `--color-page` `--color-sunken` 세 표면 전부에서 WCAG AA(4.5:1) 이상이어야 한다.
- 다크모드는 범위 밖. 단 토큰 이름은 역할 기준으로만 짓는다(`--color-shell` 같은 생김새 이름 금지).
- 내비게이션 항목 구성과 그룹핑(`src/navigation.ts`)은 변경하지 않는다. 사이드바의 표현만 바꾼다.
- 기능 동작 변경 금지. 순수 표현 계층 작업이다. 기존 테스트 8개 파일은 전 과정에서 계속 통과해야 한다.
- 업무면 행 높이는 `--row-h`(44px) 고정. 화면마다 다른 값을 쓰지 않는다.
- 한국어 텍스트에는 `word-break: keep-all`과 `overflow-wrap: anywhere`를 반드시 짝으로 적용한다.
- 커밋 메시지는 한국어, 기존 저장소 관례를 따른다.

## 스펙 대비 추가된 결정

스펙 작성 후 코드 실측에서 드러난 공백을 다음과 같이 메운다.

**파랑 토큰 추가.** `styles.css`에 파랑 계열이 68회 사용된다(링크, 정보 배지, 액션아이템 생성 대상 칩, 역할 구분). 팔레트 C에 파랑이 없어 그대로 두면 68곳이 토큰 밖에 남는다. 기존 `#2f74c0`은 `--color-sunken` 위에서 4.06:1로 AA 미달이므로 `#39628f`(5.36:1 이상)로 대체한다.

**아바타/역할 틴트.** 현재 아바타와 역할 구분에 `#e35d4f` `#bc7a12` 등이 직접 쓰인다. 신규 색을 만들지 않고 기존 4개 틴트 짝(moss/clay/pending/info)을 순환 사용한다. 역할 구분은 상태 의미와 충돌하지 않도록 배경 틴트에만 쓰고 글자색·테두리에는 쓰지 않는다.

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `src/styles.css` | 전역 스타일 단일 소스 | 전 과정 수정 |
| `src/designTokens.test.ts` | 토큰 대비 검증 + 하드코딩 래칫 | 신규 |
| `src/components/EmptyState.tsx` | 빈 상태 단일 컴포넌트 | 신규 |
| `src/components/AppShell.tsx` | 셸 레이아웃 | 수정 |
| `src/features/agenda/AgendaBoard.tsx` | 안건 목록 (카드→행) | 수정 |
| `src/features/actions/ActionBoard.tsx` | 액션 목록 (카드→행) | 수정 |
| `src/features/leader/LeaderInbox.tsx` | 리더 관리함 | 수정 |
| `src/features/notifications/NotificationCenter.tsx` | 알림 목록 | 수정 |
| `src/features/auth/AccountManagement.tsx` | 계정 관리 | 수정 |
| `src/features/auth/LoginScreen.tsx` | 로그인 (문화면) | 수정 |
| `src/features/metrics/Metrics.tsx` | 리포트 | 수정 |
| `src/features/intake/Intake.tsx` | 대나무숲 접수 (문화면) | 수정 |
| `src/features/memory/Memory.tsx` | 팀 추억 (문화면) | 수정 |
| `src/features/humor/HumorBoard.tsx` | 유머게시판 (문화면) | 수정 |
| `src/features/profiles/Profiles.tsx` | 동료 성향 (문화면) | 수정 |
| `src/features/connect/Connect.tsx` | 커피뽑기 (문화면) | 수정 |
| `src/features/dashboard/Dashboard.tsx` | 홈 (혼합) | 수정 |
| `src/features/meetings/Meetings.tsx` | 캔미팅/티미팅 (혼합) | 수정 |
| `docs/superpowers/specs/2026-08-04-color-mapping.md` | 199색 → 토큰 매핑표 | 신규 |

`Meetings.tsx`는 1533줄로 가장 크다. 이번 범위에서 분할하지 않는다 — 시각 변경과 파일 분할을 겹치면 회귀 원인 분리가 불가능해진다. 분할이 필요하면 별도 라운드로 다룬다.

---

### Task 1: 토큰 정의와 가드 테스트

**Files:**
- Create: `src/designTokens.test.ts`
- Modify: `src/styles.css:7-49` (`:root` 블록 전체 교체)
- Modify: `src/styles.css:7771` 근방 (`.toast` — `--color-shell` 유일 참조처)

**Interfaces:**
- Produces: `:root`에 정의된 토큰 이름 전체. 이후 모든 태스크가 이 이름만 사용한다.
- Produces: `MAX_HARDCODED_HEX` / `MAX_HARDCODED_RGBA` / `MAX_DANGLING_VAR` 상수. 이후 태스크가 값을 낮춘다.

- [ ] **Step 1: 가드 테스트를 먼저 작성한다**

`src/designTokens.test.ts` 생성:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

// :root 블록은 토큰 정의처다. 하드코딩 검사에서 제외할 유일한 영역이다.
const rootStart = css.indexOf(':root {');
const rootEnd = css.indexOf('\n}', rootStart);
const outsideRoot = css.slice(0, rootStart) + css.slice(rootEnd);

// 래칫. 태스크가 진행될수록 낮춘다. 절대 올리지 않는다.
const MAX_HARDCODED_HEX = 776;
const MAX_HARDCODED_RGBA = 103;

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`토큰 ${name} 을 :root 에서 찾지 못했다`);
  return match[1];
}

const SURFACES = ['--color-surface', '--color-page', '--color-sunken'];
const FOREGROUNDS = [
  '--color-ink',
  '--color-muted',
  '--color-moss',
  '--color-clay',
  '--color-danger',
  '--color-pending',
  '--color-info',
];

describe('디자인 토큰 대비', () => {
  // 색을 바꾸려는 사람이 이 테스트를 먼저 보게 한다.
  it.each(FOREGROUNDS)('%s 는 세 표면 모두에서 AA(4.5:1) 이상이다', (fg) => {
    for (const surface of SURFACES) {
      expect(contrast(token(fg), token(surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ['--tint-moss-ink', '--tint-moss'],
    ['--tint-clay-ink', '--tint-clay'],
    ['--tint-danger-ink', '--tint-danger'],
    ['--tint-pending-ink', '--tint-pending'],
    ['--tint-info-ink', '--tint-info'],
  ])('%s / %s 배지 짝은 AAA(7:1) 이상이다', (ink, bg) => {
    expect(contrast(token(ink), token(bg))).toBeGreaterThanOrEqual(7);
  });
});

describe('토큰 경유율', () => {
  it('하드코딩 hex 는 상한을 넘지 않는다', () => {
    const found = outsideRoot.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(found.length).toBeLessThanOrEqual(MAX_HARDCODED_HEX);
  });

  it('하드코딩 rgb/rgba 는 상한을 넘지 않는다', () => {
    const found = outsideRoot.match(/rgba?\(/g) ?? [];
    expect(found.length).toBeLessThanOrEqual(MAX_HARDCODED_RGBA);
  });

  // 생김새 기준 토큰명은 다크모드 도입 시 의미가 깨진다.
  it('생김새 기준 토큰명을 쓰지 않는다', () => {
    expect(css).not.toMatch(/--color-shell/);
  });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — `토큰 --color-info 을 :root 에서 찾지 못했다`, 그리고 `--color-shell` 검사 실패

- [ ] **Step 3: `:root` 블록을 교체한다**

`src/styles.css` 7행부터 49행까지(`:root {` 부터 닫는 `}` 직전 `font-synthesis`/`text-rendering` 포함)를 다음으로 교체한다. `color` / `background` / `font-family` / `font-synthesis` / `text-rendering` 선언은 그대로 유지하되 값만 새 토큰을 참조하게 바꾼다.

```css
:root {
  /* 표면 — 모래빛 3단. 사이드바는 딥그린이 아니라 page 로 내려앉는다. */
  --color-page: #f6f4ef;
  --color-surface: #fffdf9;
  --color-sunken: #efece4;

  /* 글자 — 위계는 색이 아니라 명도로 만든다. */
  --color-ink: #1f2420;
  --color-muted: #5a5f56;

  /* 역할색 — 전부 세 표면에서 AA 통과. designTokens.test.ts 가 강제한다. */
  --color-moss: #4f7350;
  --color-moss-strong: #3c5a3d;
  --color-clay: #96502f;
  --color-danger: #a33a3a;
  --color-pending: #77642f;
  /* 기존 #2f74c0 은 sunken 위에서 4.06:1 로 미달이었다. */
  --color-info: #39628f;

  /* 틴트 — 배지 배경과 짝 글자색. */
  --tint-moss: #e8efe6;
  --tint-moss-ink: #2f4a30;
  --tint-clay: #f5e9e1;
  --tint-clay-ink: #5c3018;
  --tint-danger: #f6e5e5;
  --tint-danger-ink: #6b2020;
  --tint-pending: #f2eddc;
  --tint-pending-ink: #4a3d15;
  --tint-info: #e4ecf4;
  --tint-info-ink: #1f3f5e;

  --color-border: #e2ddd1;
  --color-border-strong: #cfc8b8;

  /* 라운드 — 기존에는 8px 단일값이라 배지와 패널이 같은 곡률을 썼다. */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-full: 999px;

  /* 그림자 — 떠 있는 것에만. 나머지 분리는 경계선으로 한다. */
  --shadow-float: 0 8px 24px rgba(31, 36, 32, 0.1);

  /* 간격 4px 스케일 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* 밀도 — 업무면 행 높이. 화면 간 공통 상수여야 한다. */
  --row-h: 44px;

  --ease-ui: 150ms ease-out;
  --ease-enter: 280ms cubic-bezier(0.22, 1, 0.36, 1);

  color: var(--color-ink);
  background: var(--color-page);
  font-family:
    "Pretendard Variable", Pretendard, "Noto Sans KR", ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 4: `.toast`의 `--color-shell` 참조를 끊는다**

`--color-shell`은 `:root` 정의 외에 `.toast`에서 딱 한 번 참조된다(7773행). 토큰을 지우면 이 배경이 투명해지므로 함께 고쳐야 한다. 팔레트 C에는 어두운 표면 토큰이 없다 — 새로 만들지 않고 반전 토스트로 처리한다(`--color-ink` 위 `--color-surface` = 15.5:1).

```css
.toast {
  align-items: center;
  background: var(--color-ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
  color: var(--color-surface);
  display: flex;
  font-size: 14px;
  gap: var(--space-2);
  max-width: min(90vw, 460px);
```

이하 선언은 기존 그대로 둔다.

- [ ] **Step 5: 테스트를 실행해 통과를 확인한다**

Run: `npm test -- designTokens`
Expected: PASS (전 항목)

주의: 이 시점에서 화면은 대부분 깨져 보인다. 776곳이 아직 옛 색을 하드코딩하고 있고 `--radius`가 8px에서 10px로 바뀌었기 때문이다. 정상이다. Task 4부터 순차 복구한다.

- [ ] **Step 6: 전체 테스트와 빌드를 확인한다**

Run: `npm test && npm run build`
Expected: 기존 8개 테스트 파일 전부 PASS, 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add src/designTokens.test.ts src/styles.css
git commit -m "디자인 토큰 재정의 + 대비·경유율 가드 테스트

역할색 7개를 세 표면 모두에서 AA 통과하도록 계산해 선정했다.
기존 #2f74c0 은 sunken 위에서 4.06:1 로 미달이라 #39628f 로 바꿨다.

하드코딩 잔량은 테스트의 래칫 상수로 강제한다. 상한을 올리는
방향의 수정은 금지다."
```

---

### Task 2: 한국어 타이포그래피 전역 규칙

**Files:**
- Modify: `src/styles.css` (전역 요소 규칙 구간, `* { box-sizing }` 직후)
- Modify: `src/designTokens.test.ts` (검증 추가)

**Interfaces:**
- Consumes: Task 1의 토큰.
- Produces: `.num` 클래스와 `[data-num]` 속성 — 이후 태스크가 숫자 표기에 사용한다.

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`src/designTokens.test.ts` 끝에 추가:

```ts
describe('한국어 타이포그래피', () => {
  // "작게" 가 "작 / 게" 로 쪼개지던 문제. keep-all 단독은 가로 넘침을 만든다.
  it('keep-all 과 overflow-wrap 을 짝으로 선언한다', () => {
    const rule = css.match(/word-break:\s*keep-all[^}]*}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('제목에 text-wrap: balance 를 준다', () => {
    expect(css).toMatch(/text-wrap:\s*balance/);
  });

  it('숫자에 tabular-nums 를 준다', () => {
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — 세 항목 모두 (현재 `word-break` 선언 0건)

- [ ] **Step 3: 전역 규칙을 추가한다**

`src/styles.css`의 `* { box-sizing: border-box; }` 바로 아래에 추가:

```css
/*
  이 앱은 전부 한국어다. 기본 word-break 는 음절 단위로 끊어서
  "작게" 가 "작 / 게" 로 갈린다. keep-all 로 어절을 지키되,
  단독으로 쓰면 공백 없는 긴 문자열(URL 등)이 컨테이너를 뚫으므로
  overflow-wrap 을 반드시 짝으로 둔다.
*/
h1, h2, h3, h4, h5, h6,
p, li, dt, dd, th, td,
button, label, legend, figcaption {
  word-break: keep-all;
  overflow-wrap: anywhere;
}

h1, h2, h3 {
  text-wrap: balance;
}

/* 숫자가 세로로 정렬되어야 목록에서 자릿수를 비교할 수 있다. */
.num,
[data-num] {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: 테스트를 실행해 통과를 확인한다**

Run: `npm test -- designTokens`
Expected: PASS

- [ ] **Step 5: 로그인 화면에서 육안 확인**

Run: `npm run dev` 후 `http://127.0.0.1:5173/` 접속
Expected: 히어로 문구 "편하게 말하고, 함께 정하고, 작게 바꿔요"에서 "작게"가 한 줄에 붙어 있다

- [ ] **Step 6: 커밋**

```bash
git add src/styles.css src/designTokens.test.ts
git commit -m "한국어 줄바꿈 규칙 전역 적용

keep-all 선언이 한 줄도 없어서 제목이 음절 단위로 갈렸다.
로그인 히어로의 '작게' 가 '작 / 게' 로 쪼개지던 것이 대표 사례다.
keep-all 단독은 긴 URL 에서 가로 넘침을 만들므로 overflow-wrap 을
짝으로 둔다."
```

---

### Task 3: 색 매핑표 확정

**Files:**
- Create: `docs/superpowers/specs/2026-08-04-color-mapping.md`
- Create: `scripts/classify-colors.mjs`

**Interfaces:**
- Consumes: Task 1의 토큰 이름.
- Produces: 199개 색상값 각각에 대한 목표 토큰. Task 4~13이 이 표만 참조하고 개별 판단하지 않는다.

이 태스크는 코드를 바꾸지 않는다. 이후 10개 태스크가 같은 판단을 반복하지 않도록 결정을 한곳에 고정하는 것이 목적이다.

- [ ] **Step 1: 분류 스크립트를 작성한다**

`scripts/classify-colors.mjs` 생성:

```js
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const rootStart = css.indexOf(':root {');
const rootEnd = css.indexOf('\n}', rootStart);
const body = css.slice(0, rootStart) + css.slice(rootEnd);

const counts = new Map();
for (const raw of body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
  let h = raw.slice(1).toLowerCase();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  h = h.slice(0, 6);
  counts.set(h, (counts.get(h) ?? 0) + 1);
}

function hsl(h) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [((hue * 60) + 360) % 360, s * 100, l * 100];
}

// 채도가 낮은 색은 색상값과 무관하게 중립면이다. 기존 팔레트가
// 녹색을 표면에 썼기 때문에 저채도 '녹색' 이 다수 섞여 있다.
function propose(h) {
  const [hue, sat, light] = hsl(h);
  if (sat <= 18) {
    if (light >= 96) return '--color-surface';
    if (light >= 88) return '--color-page';
    if (light >= 78) return '--color-sunken';
    if (light >= 60) return '--color-border-strong';
    if (light >= 34) return '--color-muted';
    return '--color-ink';
  }
  if (light >= 88) {
    if (hue >= 85 && hue <= 175) return '--tint-moss';
    if (hue > 175 && hue <= 260) return '--tint-info';
    if (hue > 330 || hue <= 15) return '--tint-danger';
    if (hue > 15 && hue <= 45) return '--tint-clay';
    return '--tint-pending';
  }
  if (hue >= 85 && hue <= 175) return light <= 25 ? '--color-moss-strong' : '--color-moss';
  if (hue > 175 && hue <= 260) return '--color-info';
  if (hue > 330 || hue <= 15) return '--color-danger';
  if (hue > 15 && hue <= 45) return '--color-clay';
  return '--color-pending';
}

const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log('| 횟수 | 기존 | H/S/L | 제안 토큰 | 확정 |');
console.log('|---:|---|---|---|---|');
for (const [h, c] of rows) {
  const [hu, sa, li] = hsl(h).map(Math.round);
  console.log(`| ${c} | \`#${h}\` | ${hu}/${sa}/${li} | \`${propose(h)}\` | |`);
}
console.error(`총 ${rows.length}색 / ${[...counts.values()].reduce((a, b) => a + b, 0)}회`);
```

- [ ] **Step 2: 스크립트를 실행해 표를 생성한다**

Run: `node scripts/classify-colors.mjs > /tmp/mapping.md`
Expected: 표준에러에 `총 199색 / 776회`, `/tmp/mapping.md`에 199행 표

- [ ] **Step 3: 매핑 문서를 작성한다**

`docs/superpowers/specs/2026-08-04-color-mapping.md`를 만들고, 다음 머리말 뒤에 `/tmp/mapping.md` 내용을 붙인다.

```markdown
# 색 매핑표 — 기존 199색 → Moss & Clay 토큰

`scripts/classify-colors.mjs`가 채도·명도·색상으로 1차 제안한 표다.
"확정" 열이 비어 있으면 제안을 그대로 채택한다는 뜻이고,
값이 적혀 있으면 그 값이 제안을 덮어쓴다.

## 자동 분류가 틀리는 경우

1차 제안은 색 자체만 본다. 다음은 사람이 확정해야 한다.

- **저채도 녹색**: 기존 팔레트가 녹색을 표면에 썼기 때문에 `#1d2522`(S=12)
  `#e9eee8`(S=15) 처럼 사실상 중립인 색이 녹색으로 잡힌다. 스크립트는
  채도 18 이하를 중립으로 보내 이를 처리한다.
- **라임 `#d8f06a`(22회)**: 브랜드 마크와 히어로 강조에 쓰였다. 팔레트 C에
  대응색이 없다. 마크는 Task 4에서 `--color-moss` 채움으로 바꾸고,
  강조 용도는 `--tint-pending`으로 보낸다.
- **역할/아바타 색 `#e35d4f` `#bc7a12` 등**: 상태 의미가 아니라 사람 구분용이다.
  4개 틴트(moss/clay/pending/info)를 순환 배정하고 글자색·테두리에는 쓰지 않는다.
- **`rgba()` 103곳**: 대부분 그림자다. `--shadow-float` 하나로 통합하고,
  경계 표현이던 것은 `--color-border`로 바꾼다.

## 확정 표
```

그리고 다음 4개 행의 "확정" 열을 직접 채운다:

| 기존 | 확정 토큰 | 이유 |
|---|---|---|
| `#d8f06a` | `--color-moss` (마크) / `--tint-pending` (강조) | 팔레트 C에 라임 없음. 용도별 분리 |
| `#e35d4f` | `--tint-clay` | 아바타 배경. 상태색 아님 |
| `#bc7a12` | `--tint-pending` | 아바타 배경. 상태색 아님 |
| `#ffffff` | `--color-surface` | 순백은 모래빛 베이스에서 튄다 |

- [ ] **Step 4: 표가 199행인지 확인한다**

Run: `grep -c '^| [0-9]' docs/superpowers/specs/2026-08-04-color-mapping.md`
Expected: `199`

- [ ] **Step 5: 커밋**

```bash
git add scripts/classify-colors.mjs docs/superpowers/specs/2026-08-04-color-mapping.md
git commit -m "색 매핑표 — 기존 199색을 토큰으로 보내는 기준 고정

이후 화면별 치환 태스크가 같은 판단을 반복하지 않게 한곳에 모은다.
자동 분류가 틀리는 네 경우(라임, 아바타색 2종, 순백)는 직접 확정했다."
```

---

### Task 4: 셸 전환 — 사이드바와 헤더

**Files:**
- Modify: `src/styles.css:71-140` 근방 (`.app`, `.sidebar`, `.brand`, `.brand-mark`, 내비 항목 규칙)
- Modify: `src/styles.css` (상단 바 / 헤더 관련 규칙)
- Modify: `src/designTokens.test.ts` (래칫 하향)

**Interfaces:**
- Consumes: Task 1 토큰, Task 3 매핑표.
- Produces: 셸 레이아웃 클래스(`.app` `.sidebar` `.topbar`)의 토큰화된 규칙.

시각적으로 가장 큰 변화 지점이다. 사이드바가 딥그린에서 모래빛으로 내려앉고, 본문이 흰 표면으로 올라온다.

- [ ] **Step 1: 래칫을 낮춘 테스트를 먼저 커밋 없이 수정한다**

`src/designTokens.test.ts`에서:

```ts
const MAX_HARDCODED_HEX = 770;
const MAX_HARDCODED_RGBA = 103;
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — `expected 776 to be less than or equal to 770`

- [ ] **Step 3: 셸 규칙을 토큰으로 치환한다**

`.sidebar`를 다음으로 교체한다. 기존의 `background: #17352f` / `color: #eff8ef`가 반전된다.

```css
.sidebar {
  align-self: start;
  background: var(--color-page);
  border-right: 1px solid var(--color-border);
  color: var(--color-ink);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  height: 100vh;
  overflow-y: auto;
  padding: var(--space-6) var(--space-4);
  position: sticky;
  top: 0;
}

.brand-mark {
  align-items: center;
  background: var(--color-moss);
  border-radius: var(--radius);
  color: var(--color-surface);
  display: flex;
  height: 44px;
  justify-content: center;
  width: 44px;
}
```

본문 영역은 `--color-surface`로 올린다. 사이드바와 본문의 관계가 뒤집히는 것이 이 태스크의 핵심이다.

`.sidebar` 하위의 내비 항목, 그룹 제목, 활성 상태 규칙에서 하드코딩 색을 전부 매핑표에 따라 치환한다. 활성 항목은 `background: var(--tint-moss); color: var(--tint-moss-ink);`로 한다.

- [ ] **Step 4: 테스트를 실행해 통과를 확인한다**

Run: `npm test -- designTokens && npm run build`
Expected: PASS, 빌드 성공

- [ ] **Step 5: 셸을 육안 확인한다**

Run: `npm run dev` 후 로그인(`이선민` / `sunmin.l@sk.com`)
Expected: 사이드바가 모래빛, 활성 항목이 이끼 틴트, 브랜드 마크가 이끼 채움. 흰 글씨가 밝은 배경에 남아 안 보이는 곳이 없다

- [ ] **Step 6: 커밋**

```bash
git add src/styles.css src/designTokens.test.ts
git commit -m "셸 반전 — 사이드바를 딥그린에서 모래빛으로

브랜드색이 표면을 점유하던 구조를 뒤집는다. 사이드바는 page 로
내려앉고 본문이 surface 로 올라온다. 활성 항목만 이끼 틴트를 쓴다.

하드코딩 hex 776 → 770. 셸 구간의 실측 잔량은 11곳뿐이다."
```

---

### Task 5: 공통 UI — 버튼·배지·입력

**Files:**
- Modify: `src/styles.css` (`button`, `.btn-*`, `.badge`, `.chip`, `input`, `select`, `textarea` 규칙)
- Modify: `src/styles.css` — 아래 공용 프리미티브 90개 규칙도 이 태스크가 소유한다
- Modify: `src/designTokens.test.ts` (래칫 하향)

**이 태스크가 소유하는 공용 프리미티브** (기능 접두사가 없어 다른 태스크에 안 잡히는 것들, hex 129곳 · rgba 18곳):

`.status-dot.통과` `.status-dot.부결` `.status-dot.투표중` · `.waiting-badge` `.reward-badge` `.public-scope-badge` · `.priority.높음` `.priority.보통` · `.notice-line` `.role-note` `.privacy-promotion-note` `.passed-box` · `.form-error` `.form-success` · `.segmented` `.toolbar` `.step` · `.error-boundary` · `.user-chip` `.user-photo-edit` `.status-reason-editor` `.saved-result-list`

`.status-dot.*`는 Task 7의 `.work-row-dot`과 역할이 같다. 클래스를 합치지는 말고(호출처가 많다) 색만 같은 토큰을 쓰게 한다. `.waiting-badge` `.reward-badge` `.public-scope-badge` `.priority.*`는 Task 5에서 만드는 `.badge-*` 틴트 짝을 재사용한다 — 새 색을 만들지 않는다.

`.login-*`은 이 태스크가 아니라 Task 10이 문화면으로 다룬다.

**Interfaces:**
- Produces: `.btn-primary` `.btn-secondary` `.btn-ghost` 3단 버튼 클래스.
- Produces: `.badge` + `.badge-moss` `.badge-clay` `.badge-danger` `.badge-pending` `.badge-info` 배지 클래스. 이후 모든 화면이 이 클래스만 쓴다.

- [ ] **Step 1: 래칫을 낮추고 배지 클래스 존재를 검증하는 테스트를 추가한다**

`src/designTokens.test.ts`에서 상한을 `MAX_HARDCODED_HEX = 503`, `MAX_HARDCODED_RGBA = 78`으로 낮추고 다음을 추가:

```ts
describe('공통 UI 클래스', () => {
  it.each(['moss', 'clay', 'danger', 'pending', 'info'])(
    '.badge-%s 는 짝 틴트를 쓴다',
    (role) => {
      const rule = css.match(new RegExp(`\\.badge-${role}\\s*{[^}]*}`));
      expect(rule).not.toBeNull();
      expect(rule![0]).toContain(`var(--tint-${role})`);
      expect(rule![0]).toContain(`var(--tint-${role}-ink)`);
    },
  );

  it.each(['primary', 'secondary', 'ghost'])('.btn-%s 가 정의되어 있다', (kind) => {
    expect(css).toMatch(new RegExp(`\\.btn-${kind}\\s*{`));
  });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — 배지·버튼 클래스 없음, 래칫 초과

- [ ] **Step 3: 공통 클래스를 작성한다**

```css
.btn-primary,
.btn-secondary,
.btn-ghost {
  align-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius);
  display: inline-flex;
  font-size: 14px;
  font-weight: 500;
  gap: var(--space-2);
  justify-content: center;
  padding: 10px var(--space-4);
  transition: background var(--ease-ui), border-color var(--ease-ui);
}

.btn-primary {
  background: var(--color-moss);
  color: var(--color-surface);
}

.btn-primary:hover {
  background: var(--color-moss-strong);
}

.btn-secondary {
  background: var(--color-sunken);
  color: var(--color-ink);
}

.btn-secondary:hover {
  border-color: var(--color-border-strong);
}

.btn-ghost {
  background: transparent;
  color: var(--color-muted);
}

.btn-ghost:hover {
  background: var(--color-sunken);
  color: var(--color-ink);
}

.badge {
  border-radius: var(--radius-sm);
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  gap: var(--space-1);
  padding: 3px var(--space-2);
}

.badge-moss { background: var(--tint-moss); color: var(--tint-moss-ink); }
.badge-clay { background: var(--tint-clay); color: var(--tint-clay-ink); }
.badge-danger { background: var(--tint-danger); color: var(--tint-danger-ink); }
.badge-pending { background: var(--tint-pending); color: var(--tint-pending-ink); }
.badge-info { background: var(--tint-info); color: var(--tint-info-ink); }
```

입력 요소는 `background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm);`로 통일하고, 포커스 링은 `outline: 2px solid var(--color-moss); outline-offset: 2px;`로 한다.

- [ ] **Step 4: 테스트와 빌드를 확인한다**

Run: `npm test && npm run build`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/styles.css src/designTokens.test.ts
git commit -m "버튼 3단·배지 5종 공통 클래스

통과·부결·투표중·대기 배지가 화면마다 다른 스타일이었다.
틴트 짝 하나로 묶고, 이후 화면은 이 클래스만 쓴다.

하드코딩 hex 770 → 503. 공용 프리미티브 129곳을 함께 처리한 결과다."
```

---

### Task 6: 빈 상태 컴포넌트

**Files:**
- Create: `src/components/EmptyState.tsx`
- Modify: `src/styles.css` (`.empty-state` 규칙)
- Modify: `src/features/agenda/AgendaBoard.tsx` (첫 적용처)

**Interfaces:**
- Produces: `EmptyState` 컴포넌트.
  ```ts
  type EmptyStateProps = {
    icon: ElementType;      // lucide-react 아이콘
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
  ```
  Task 7~13이 이 시그니처를 그대로 쓴다.

- [ ] **Step 1: 컴포넌트를 작성한다**

`src/components/EmptyState.tsx`:

```tsx
import type { ElementType } from 'react';

export type EmptyStateProps = {
  icon: ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

/*
  빈 상태가 화면마다 맨 텍스트였다. "지금 투표 중인 안건이 없어요" 로
  끝나면 다음에 뭘 해야 하는지가 없다. 다음 행동을 함께 둔다.
*/
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon aria-hidden size={28} />
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-desc">{description}</p> : null}
      {action ? (
        <button type="button" className="btn-secondary" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: 스타일을 추가한다**

```css
.empty-state {
  align-items: center;
  color: var(--color-muted);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state-title {
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 500;
  margin: 0;
}

.empty-state-desc {
  font-size: 13px;
  line-height: 1.7;
  margin: 0;
  max-width: 36ch;
}
```

- [ ] **Step 3: 안건함의 빈 상태를 교체한다**

`src/features/agenda/AgendaBoard.tsx`에서 "지금 투표 중인 안건이 없어요…" 맨 텍스트를 다음으로 바꾼다:

```tsx
<EmptyState
  icon={Vote}
  title="진행 중인 안건 투표가 없어요"
  description="접수된 의견이 안건이 되면 여기에서 바로 투표할 수 있습니다."
  action={{ label: '안건 등록', onClick: onCreateAgenda }}
/>
```

`onCreateAgenda`는 해당 파일에 이미 존재하는 안건 등록 핸들러를 쓴다. 이름이 다르면 실제 이름에 맞춘다.

- [ ] **Step 4: 빌드와 육안 확인**

Run: `npm run build && npm run dev`
Expected: 빌드 성공. 안건함에서 필터를 "투표중"으로 바꾸면 아이콘 + 제목 + 설명 + 버튼이 보인다

- [ ] **Step 5: 커밋**

```bash
git add src/components/EmptyState.tsx src/styles.css src/features/agenda/AgendaBoard.tsx
git commit -m "빈 상태 컴포넌트 신설 + 안건함 적용

빈 상태가 맨 텍스트라 다음 행동이 없었다. 아이콘·제목·설명·행동을
한 컴포넌트로 묶고 안건함부터 적용한다."
```

---

### Task 7: 안건함 카드 → 행

**Files:**
- Modify: `src/features/agenda/AgendaBoard.tsx`
- Modify: `src/styles.css` (`.agenda-*` 규칙, 34개 클래스)
- Modify: `src/designTokens.test.ts` (래칫 하향)

**Interfaces:**
- Consumes: Task 5 배지 클래스, Task 6 `EmptyState`.
- Produces: `.work-row` 계열 공통 행 클래스. Task 8·9가 재사용한다.
  ```
  .work-list        목록 컨테이너 (경계선 + 라운드)
  .work-row         고정 높이 --row-h 행
  .work-row-dot     상태 색점 7px
  .work-row-title   제목 (ellipsis + title 속성 필요)
  .work-row-bar     진행바 64px × 4px
  .work-row-pct     퍼센트 (ink 600, tabular-nums, 우측 정렬)
  .work-row-meta    날짜 등 (muted 11px)
  ```

업무면 문법의 기준 구현이다. 이후 업무면 화면들이 여기서 만든 클래스를 그대로 쓴다.

- [ ] **Step 1: 래칫을 낮추고 행 클래스 검증을 추가한다**

`MAX_HARDCODED_HEX = 478`로 낮추고 추가:

```ts
describe('업무면 행 문법', () => {
  it('행 높이는 --row-h 토큰을 쓴다', () => {
    const rule = css.match(/\.work-row\s*{[^}]*}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain('var(--row-h)');
  });

  // 색이 아니라 명도로 위계를 만든다는 결정이 여기서 강제된다.
  it('퍼센트는 ink 를 쓴다 (이끼색이 아니다)', () => {
    const rule = css.match(/\.work-row-pct\s*{[^}]*}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain('var(--color-ink)');
    expect(rule![0]).toContain('tabular-nums');
  });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — `.work-row` 없음

- [ ] **Step 3: 행 클래스를 작성한다**

```css
.work-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.work-row {
  align-items: center;
  border-bottom: 1px solid var(--color-sunken);
  display: flex;
  gap: var(--space-3);
  height: var(--row-h);
  padding: 0 var(--space-4);
  width: 100%;
}

.work-row:last-child {
  border-bottom: none;
}

.work-row:hover {
  background: var(--color-page);
}

.work-row-dot {
  border-radius: var(--radius-full);
  flex: none;
  height: 7px;
  width: 7px;
}

/*
  행은 높이가 고정이라 긴 한글 제목이 반드시 잘린다.
  자르되 title 속성으로 전문을 남긴다 (TSX 쪽에서 부여).
*/
.work-row-title {
  color: var(--color-ink);
  flex: 1;
  font-size: 14px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-row-bar {
  background: var(--color-sunken);
  border-radius: var(--radius-full);
  flex: none;
  height: 4px;
  overflow: hidden;
  width: 64px;
}

.work-row-bar > span {
  display: block;
  height: 100%;
}

.work-row-pct {
  color: var(--color-ink);
  flex: none;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: right;
  width: 38px;
}

.work-row-meta {
  color: var(--color-muted);
  flex: none;
  font-size: 11px;
  text-align: right;
  width: 46px;
}
```

- [ ] **Step 4: `AgendaBoard.tsx`를 행 구조로 바꾼다**

카드 그리드 렌더링을 다음 구조로 교체한다. `title` 속성 부여가 필수다.

```tsx
<div className="work-list">
  {visibleAgendas.map((agenda) => {
    const total = agenda.yes + agenda.no;
    const pct = total === 0 ? 0 : Math.round((agenda.yes / total) * 100);
    const tone =
      agenda.status === 'passed' ? 'moss'
      : agenda.status === 'rejected' ? 'danger'
      : 'pending';
    return (
      <button
        type="button"
        key={agenda.id}
        className="work-row"
        onClick={() => onSelect(agenda.id)}
      >
        <span className="work-row-dot" style={{ background: `var(--color-${tone})` }} />
        <span className="work-row-title" title={agenda.title}>
          {agenda.title}
        </span>
        <span className="work-row-bar">
          <span style={{ width: `${pct}%`, background: `var(--color-${tone})` }} />
        </span>
        <span className="work-row-pct">{pct}%</span>
        <span className="work-row-meta">{formatShortDate(agenda.date)}</span>
      </button>
    );
  })}
</div>
```

`onSelect` / `formatShortDate` / `agenda.status` 값은 해당 파일의 기존 이름에 맞춘다. 상태값이 `'passed'|'rejected'` 가 아니면 실제 값으로 바꾼다.

- [ ] **Step 5: 테스트·빌드·육안 확인**

Run: `npm test && npm run build && npm run dev`
Expected: 전부 PASS. 안건함에서 안건이 행으로 나오고 1280px에서 3건이 아니라 화면 높이만큼 보인다. 긴 제목에 마우스를 올리면 전문이 툴팁으로 뜬다

- [ ] **Step 6: 커밋**

```bash
git add src/features/agenda/AgendaBoard.tsx src/styles.css src/designTokens.test.ts
git commit -m "안건함 카드 → 행 · 퍼센트를 주인공으로

투표 앱인데 집계가 12px 회색으로 다른 메타데이터와 동등했다.
퍼센트를 ink 굵은 숫자로 올리고 이끼색은 상태 점과 진행바에만 쓴다.
1280px 기준 표시 건수 3 → 12.

행은 고정 높이라 긴 한글 제목이 잘린다. title 속성으로 전문을 남긴다.

하드코딩 hex 503 → 478."
```

---

### Task 8: 액션아이템·리더 관리함 행 전환

**Files:**
- Modify: `src/features/actions/ActionBoard.tsx`
- Modify: `src/features/leader/LeaderInbox.tsx`
- Modify: `src/styles.css` (`.action-*` 25개, `.leader-*` 28개 클래스)
- Modify: `src/designTokens.test.ts` (래칫 하향)

**Interfaces:**
- Consumes: Task 7의 `.work-*` 클래스, Task 5 배지, Task 6 `EmptyState`.
- Produces: 없음 (기존 클래스 재사용).

- [ ] **Step 1: 래칫을 `MAX_HARDCODED_HEX = 438`로 낮춘다**

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — 래칫 초과

- [ ] **Step 3: 두 화면을 행 구조로 바꾼다**

Task 7의 `.work-list` / `.work-row` 구조를 그대로 쓴다. 두 화면은 퍼센트가 없으므로 `.work-row-pct` 자리에 상태 배지를 넣는다:

```tsx
<span className="badge badge-pending">진행중</span>
```

상태 → 배지 대응은 다음으로 고정한다. 화면마다 다르게 정하지 않는다.

| 상태 | 배지 클래스 |
|---|---|
| 통과 · 완료 · 찬성 | `badge-moss` |
| 부결 · 반려 · 반대 | `badge-danger` |
| 투표중 · 진행중 · 대기 | `badge-pending` |
| 정보 · 참고 | `badge-info` |
| 문화면 강조 | `badge-clay` |

빈 상태는 Task 6의 `EmptyState`로 교체한다. `.action-*` `.leader-*` 규칙의 하드코딩 색은 Task 3 매핑표에 따라 치환한다.

- [ ] **Step 4: 테스트·빌드·육안 확인**

Run: `npm test && npm run build && npm run dev`
Expected: 전부 PASS. 액션아이템과 리더 관리함이 안건함과 같은 행 높이·같은 배지를 쓴다

- [ ] **Step 5: 커밋**

```bash
git add src/features/actions/ActionBoard.tsx src/features/leader/LeaderInbox.tsx src/styles.css src/designTokens.test.ts
git commit -m "액션아이템·리더 관리함 행 전환

안건함과 같은 --row-h·같은 배지를 쓴다. 목록 사이를 옮겨다닐 때
눈이 다시 적응하지 않아도 되게 한다.

하드코딩 hex 478 → 438."
```

---

### Task 9: 알림·계정관리·리포트

**Files:**
- Modify: `src/features/notifications/NotificationCenter.tsx`
- Modify: `src/features/auth/AccountManagement.tsx`
- Modify: `src/features/metrics/Metrics.tsx`
- Modify: `src/styles.css` (`.notif-*` 18개, `.account-*` 16개, `.metrics-*` 80개 클래스)
- Modify: `src/designTokens.test.ts` (래칫 하향)

**Interfaces:**
- Consumes: Task 5·6·7 클래스.

`Metrics.tsx`에는 인라인 `style={{}}`이 있다(막대 폭 등 계산값). 계산값은 유지하고 색만 `var(--color-*)` 참조로 바꾼다.

- [ ] **Step 1: 래칫을 `MAX_HARDCODED_HEX = 361`, `MAX_HARDCODED_RGBA = 52`으로 낮춘다**

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — 래칫 초과

- [ ] **Step 3: 세 화면을 치환한다**

알림·계정관리는 `.work-*` 행 구조로 바꾼다. 리포트는 지표 카드 구조를 유지하되:

- 지표 숫자: `--color-ink`, 24px, 600, `tabular-nums`
- 지표 라벨: `--color-muted`, 12px
- 막대 채움: 상태에 따라 `--color-moss` / `--color-danger` / `--color-pending`
- 막대 트랙: `--color-sunken`
- 카드: `--color-surface` + `--color-border` 1px + `--radius-lg`, 그림자 없음

예산 초과 등 색으로 나르는 정보는 기존 주석대로 숫자와 함께 읽히게 유지한다(색 단독 전달 금지).

- [ ] **Step 4: 테스트·빌드·육안 확인**

Run: `npm test && npm run build && npm run dev`
Expected: 전부 PASS. 세 화면에 옛 딥그린/라임이 남아 있지 않다

- [ ] **Step 5: 커밋**

```bash
git add src/features/notifications src/features/auth/AccountManagement.tsx src/features/metrics src/styles.css src/designTokens.test.ts
git commit -m "알림·계정관리·리포트 업무면 전환

리포트의 인라인 style 은 계산값만 남기고 색은 토큰 참조로 바꾼다.
예산 초과 표시는 색 단독으로 나르지 않는 기존 처리를 유지한다.

하드코딩 hex 438 → 361."
```

---

### Task 10: 대나무숲 접수 문화면 전환

**Files:**
- Modify: `src/features/intake/Intake.tsx`
- Modify: `src/features/intake/ReviewGate.tsx`
- Modify: `src/features/auth/LoginScreen.tsx`
- Modify: `src/styles.css` (`.submission-*` 18개, `.review-*` 36개, `.issue-*` 18개, `.login-*` 클래스)
- Modify: `src/designTokens.test.ts` (래칫 하향)

**Interfaces:**
- Produces: `.culture-*` 문화면 공통 클래스. Task 11·12가 재사용한다.
  ```
  .culture-display   28px / 1.35 / 600 / -0.02em 한글 디스플레이
  .culture-lede      14px / 1.75 muted 본문
  .culture-mark      틴트 하이라이트 (어절 강조)
  .culture-avatars   겹침 아바타 묶음
  .culture-avatar    32px 원형, 틴트 배경 + 짝 글자색
  ```

문화면 문법의 기준 구현이다.

- [ ] **Step 1: 래칫을 `MAX_HARDCODED_HEX = 326`으로 낮추고 문화면 클래스 검증을 추가한다**

```ts
describe('문화면 문법', () => {
  it('디스플레이는 28px 이상이고 keep-all 을 상속한다', () => {
    const rule = css.match(/\.culture-display\s*{[^}]*}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toMatch(/font-size:\s*(2[89]|[3-9]\d)px/);
  });

  // 아바타는 사람 구분용이다. 상태 의미를 갖는 글자색·테두리에 쓰지 않는다.
  it('아바타는 틴트 배경만 쓴다', () => {
    const rule = css.match(/\.culture-avatar\s*{[^}]*}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).not.toMatch(/border-color:\s*var\(--color-(moss|clay|danger|pending)\)/);
  });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — `.culture-display` 없음

- [ ] **Step 3: 문화면 클래스를 작성한다**

```css
.culture-display {
  color: var(--color-ink);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.35;
  margin: 0 0 var(--space-3);
}

.culture-lede {
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.75;
  margin: 0 0 var(--space-5);
  max-width: 52ch;
}

.culture-mark {
  background: var(--tint-moss);
  border-radius: var(--radius-sm);
  padding: 1px var(--space-2);
}

.culture-avatars {
  display: flex;
  margin-bottom: var(--space-4);
}

.culture-avatar {
  align-items: center;
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-full);
  display: flex;
  font-size: 12px;
  height: 32px;
  justify-content: center;
  width: 32px;
}

.culture-avatar + .culture-avatar {
  margin-left: -9px;
}
```

- [ ] **Step 4: 접수 화면을 문화면 문법으로 재작성한다**

히어로 문구를 `.culture-display` + `.culture-lede`로 바꾸고, 익명성 안내를 `.culture-mark`로 강조한다. 예:

```tsx
<h1 className="culture-display">
  여기서 한 말은 <span className="culture-mark">이름 없이</span> 전해집니다
</h1>
<p className="culture-lede">
  작성자 정보는 본문과 분리해서 저장돼요. 리더에게도 누가 썼는지 보이지 않습니다.
</p>
```

문구는 기존 화면의 실제 카피를 유지하되 위계만 바꾼다. 새 문구를 지어내지 않는다 — 익명성 보장 범위는 제품 약속이라 임의로 바꾸면 안 된다. 기존 카피가 위 예시와 다르면 기존 것을 쓴다.

`ReviewGate`의 경고색은 `--color-danger` + `--tint-danger`로 통일한다.

- [ ] **Step 5: 로그인 화면을 문화면으로 바꾼다**

`LoginScreen.tsx`는 앱의 첫인상이고 히어로 구조라 문화면에 속한다. 히어로 제목을 `.culture-display`, 설명을 `.culture-lede`로 바꾼다. 좌측 딥그린 패널은 `--color-page` + 우측 경계선으로 내려앉히고, 우측 로그인 카드는 `--color-surface` + `--color-border` + `--radius-lg`로 한다.

Task 2에서 고친 `word-break: keep-all`이 이 화면의 "작게" 잘림을 이미 해결했는지 확인한다 — 이 화면이 그 버그의 최초 발견처다.

- [ ] **Step 6: 테스트·빌드·육안 확인**

Run: `npm test && npm run build && npm run dev`
Expected: 전부 PASS. 접수 화면 제목이 28px, 강조 어절에 이끼 틴트. 로그인 화면의 "작게"가 한 줄에 붙어 있다

- [ ] **Step 7: 커밋**

```bash
git add src/features/intake src/features/auth/LoginScreen.tsx src/styles.css src/designTokens.test.ts
git commit -m "대나무숲 접수·로그인 문화면 전환 + 문화면 공통 클래스

익명성 안내가 본문에 묻혀 있었다. 28px 디스플레이와 틴트 강조로
올린다. 익명성 보장 범위 문구 자체는 제품 약속이라 바꾸지 않았다.

하드코딩 hex 361 → 326."
```

---

### Task 11: 팀 추억·유머게시판

**Files:**
- Modify: `src/features/memory/Memory.tsx`
- Modify: `src/features/humor/HumorBoard.tsx`
- Modify: `src/styles.css` (`.memory-*` 125개, `.humor-*` 84개, `.share-*` 29개 클래스)
- Modify: `src/designTokens.test.ts` (래칫 하향)

**Interfaces:**
- Consumes: Task 10의 `.culture-*` 클래스.

`.memory-*`는 125개로 단일 기능 중 가장 많다. 치환량이 크므로 이 태스크만 별도로 둔다.

- [ ] **Step 1: 래칫을 `MAX_HARDCODED_HEX = 191`, `MAX_HARDCODED_RGBA = 33`으로 낮춘다**

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — 래칫 초과

- [ ] **Step 3: 두 화면을 문화면 문법으로 바꾼다**

- 제목: `.culture-display`
- 설명: `.culture-lede`
- 작성자 표기: `.culture-avatars` + `.culture-avatar`
- 카드: `--color-surface` + `--color-border` + `--radius-lg`, 패딩 `var(--space-6) var(--space-5)`
- 빈 상태: `EmptyState`
- 나머지 하드코딩 색: Task 3 매핑표대로 치환

`.memory-*`의 사진/미디어 관련 규칙은 색만 바꾸고 레이아웃 계산값(그리드 비율, aspect-ratio)은 건드리지 않는다.

- [ ] **Step 4: 테스트·빌드·육안 확인**

Run: `npm test && npm run build && npm run dev`
Expected: 전부 PASS. 두 화면에 옛 색이 없고 사진 그리드가 깨지지 않았다

- [ ] **Step 5: 커밋**

```bash
git add src/features/memory src/features/humor src/styles.css src/designTokens.test.ts
git commit -m "팀 추억·유머게시판 문화면 전환

미디어 그리드의 레이아웃 계산값은 건드리지 않고 색만 바꿨다.

하드코딩 hex 326 → 191."
```

---

### Task 12: 동료 성향·커피뽑기

**Files:**
- Modify: `src/features/profiles/Profiles.tsx`
- Modify: `src/features/connect/Connect.tsx`
- Modify: `src/styles.css` (`.profile-*` 78개, `.coffee-*` 62개, `.draw-*` 13개, `.connect-*` 14개 클래스, `@keyframes` 8개)
- Modify: `src/designTokens.test.ts` (래칫 하향)

**Interfaces:**
- Consumes: Task 10의 `.culture-*` 클래스.

커피뽑기에는 `@keyframes` 8개(`spin-board` `float-token` `coffee-pulse` `cup-left` `cup-main` `cup-right` `winner-pop` `name-flash` `confetti-burst`)가 몰려 있다. 애니메이션 자체는 유지하고 색만 토큰으로 바꾼다. 이 화면의 즐거움이 앱에서 유일하게 살아 있는 모션이다.

- [ ] **Step 1: 래칫을 `MAX_HARDCODED_HEX = 124`, `MAX_HARDCODED_RGBA = 14`로 낮춘다**

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — 래칫 초과

- [ ] **Step 3: 두 화면을 치환한다**

- 성향 카드·뽑기 결과 카드: `--color-surface` + `--color-border` + `--radius-lg`
- 사람 구분 색: `.culture-avatar` + 4개 틴트 순환
- `@keyframes` 내부의 색: 토큰 참조로 교체. 키프레임에서 `var()`는 정상 동작한다
- 축하 연출(`confetti-burst` `winner-pop`)의 다색 표현: 4개 틴트를 순환 사용한다. 새 색을 만들지 않는다
- `prefers-reduced-motion` 처리는 기존 것을 유지한다

- [ ] **Step 4: 테스트·빌드·육안 확인**

Run: `npm test && npm run build && npm run dev`
Expected: 전부 PASS. 커피뽑기 애니메이션이 그대로 돌고 색만 바뀌었다

- [ ] **Step 5: 커밋**

```bash
git add src/features/profiles src/features/connect src/styles.css src/designTokens.test.ts
git commit -m "동료 성향·커피뽑기 문화면 전환

커피뽑기 애니메이션 8종은 유지하고 색만 토큰으로 바꿨다.
축하 연출의 다색 표현은 새 색을 만들지 않고 4개 틴트를 순환한다.

하드코딩 hex 191 → 124."
```

---

### Task 13: 혼합 화면과 반응형 통일

**Files:**
- Modify: `src/features/dashboard/Dashboard.tsx`
- Modify: `src/features/meetings/Meetings.tsx`
- Modify: `src/styles.css` (`.home-*` 18개, `.can-*` 115개, `.tea-*` 36개, `.meeting-*` 15개, `.calendar-*` 14개 클래스 + 미디어쿼리 전체)
- Modify: `src/designTokens.test.ts` (래칫 0으로)

**Interfaces:**
- Consumes: 앞선 모든 태스크의 클래스.

- [ ] **Step 1: 래칫을 0으로 낮추고 브레이크포인트 검증을 추가한다**

```ts
const MAX_HARDCODED_HEX = 0;
const MAX_HARDCODED_RGBA = 0;
const MAX_DANGLING_VAR = 0;
```

`MAX_DANGLING_VAR`는 Task 1에서 17로 시작한다. 옛 토큰(`--color-primary` 9곳, `--shadow-raised` 7곳, `--color-primary-strong` 1곳)을 가리키는 `var()` 참조 수다. 정의 없는 `var()`는 오류가 아니라 조용히 빈 값이 되므로 화면만 깨지고 테스트는 통과한다. Task 5·7·9·10·11·12가 자기 구간을 옮기면서 자연히 줄어들고, 여기서 0이 되어야 한다. 0이 안 되면 어느 태스크가 자기 셀렉터를 빠뜨린 것이다 — 상한을 올리지 말고 그 셀렉터를 찾는다.

추가:

```ts
describe('반응형', () => {
  // 화면마다 520/720/900/1100 이 뒤섞여 있었다. 두 개로 고정한다.
  it('브레이크포인트는 720px 과 1100px 두 개뿐이다', () => {
    const widths = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => m[1]);
    expect([...new Set(widths)].sort()).toEqual(['1100', '720']);
  });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인한다**

Run: `npm test -- designTokens`
Expected: FAIL — 래칫 초과, 브레이크포인트 4종

- [ ] **Step 3: 홈을 혼합 문법으로 바꾼다**

상단 히어로는 문화면(`.culture-display` + `.culture-lede`), 하단 지표·목록은 업무면(`.work-*`)으로 한다. 히어로 세로 높이를 줄여 지표 카드가 첫 화면에 들어오게 한다 — 현재는 히어로가 약 350px를 점유해 지표가 접힘 아래로 밀린다.

- [ ] **Step 4: 캔미팅/티미팅을 바꾼다**

일정·단계 목록은 업무면 행, 참여 유도 영역은 문화면으로 한다. `Meetings.tsx`는 1533줄이므로 파일 분할 없이 색·클래스 치환만 한다.

- [ ] **Step 5: 미디어쿼리를 720/1100 두 개로 통합한다**

기존 520 / 900 브레이크포인트의 규칙을 720 또는 1100 블록으로 옮긴다. 사이드바는 1100px 이하에서 접힌다:

```css
@media (max-width: 1100px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    border-bottom: 1px solid var(--color-border);
    border-right: none;
    flex-direction: row;
    height: auto;
    overflow-x: auto;
    position: static;
  }
}
```

- [ ] **Step 6: 테스트·빌드 확인**

Run: `npm test && npm run build`
Expected: 전부 PASS. 래칫 0 통과 = `styles.css`에 하드코딩 색상값이 `:root` 밖에 하나도 없다

- [ ] **Step 7: 커밋**

```bash
git add src/features/dashboard src/features/meetings src/styles.css src/designTokens.test.ts
git commit -m "홈·캔미팅 혼합 문법 + 브레이크포인트 통일

홈 히어로가 350px 를 먹어 지표가 접힘 아래로 밀려 있었다. 줄인다.
브레이크포인트가 520/720/900/1100 네 종류로 뒤섞여 있던 것을
720/1100 두 개로 통합한다.

하드코딩 hex 124 → 0. 토큰 경유율 100% 달성."
```

---

### Task 14: 전 화면 검증

**Files:**
- Modify: 검증에서 발견된 결함이 있는 파일

**Interfaces:**
- Consumes: 전체.

UI 변경은 단위 테스트가 잡지 못하는 영역이 대부분이다. 순회 캡처가 유일한 증거다.

- [ ] **Step 1: 전체 테스트와 빌드**

Run: `npm test && npm run build`
Expected: 전부 PASS

- [ ] **Step 2: 13개 화면을 1440px에서 순회 캡처한다**

dev 서버를 띄우고 `이선민` / `sunmin.l@sk.com`으로 로그인한 뒤, 사이드바 13개 항목을 순서대로 눌러 각 화면을 캡처한다.

확인 항목 — 화면마다 전부:
- 텍스트 잘림 없음 (특히 행 제목, 배지 안 글자)
- 가로 스크롤 없음
- 요소 겹침 없음
- 밝은 배경에 흰 글씨가 남아 안 보이는 곳 없음
- 빈 상태가 맨 텍스트로 남은 곳 없음
- 배지가 Task 8의 상태 대응표를 따름

- [ ] **Step 3: 720px과 1100px에서 재순회한다**

각 폭에서 13개 화면을 다시 캡처한다. 1100px에서 사이드바가 가로 스크롤 바로 접히는지 확인한다.

- [ ] **Step 4: 발견된 결함을 수정한다**

결함마다 원인이 어느 태스크에서 왔는지 적고 수정한다. 수정 후 `npm test`를 다시 돌린다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "전 화면 순회 검증 — 발견 결함 수정

1440/1100/720 세 폭에서 13개 화면을 순회 캡처해 확인했다."
```

---

## Self-Review

**스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| 3절 토큰 체계 | Task 1 |
| 3절 대비 계산 근거 | Task 1 (테스트로 강제) |
| 3절 토큰 명명 원칙 | Task 1 (`--color-shell` 금지 테스트) |
| 4절 한국어 타이포 | Task 2 |
| 4절 타입 스케일 | Task 7 (업무면), Task 10 (문화면) |
| 5절 문법 분리 규칙 | Task 7 (업무면 기준), Task 10 (문화면 기준) |
| 6절 (1) 안건 카드→행 | Task 7 |
| 6절 (2) 사이드바 반전 | Task 4 |
| 6절 (3) 홈 히어로 축소 | Task 13 |
| 6절 (4) 빈 상태 | Task 6 (+ Task 8·11에서 적용) |
| 6절 (5) 배지 통일 | Task 5 (+ Task 8 대응표) |
| 6절 (6) 버튼 계층 | Task 5 |
| 6절 (7) 반응형 보강 | Task 13 |
| 7절 실행 순서 | Task 1→14 배치가 스펙 7절 1~7단계에 대응 |
| 8절 검증 기준 | Task 14 (+ 각 태스크 말미) |
| 2절 파랑 토큰 공백 | Task 1 (`--color-info` 추가) |
| 로그인 화면 | Task 10 (초안에서 누락되어 있었다) |
| 공용 프리미티브 90개 규칙 | Task 5 (초안에서 어느 태스크에도 없었다) |

누락 없음. 사전 점검에서 로그인 화면과 공용 프리미티브 두 건이 무주공산이었던 것을 찾아 배정했다.

**플레이스홀더 점검**

"TBD" / "적절히 처리" / "비슷하게" 없음. 다만 Task 7 Step 4와 Task 6 Step 3은 기존 코드의 식별자 이름(`onSelect`, `onCreateAgenda`, `agenda.status` 값)에 맞추라고 지시한다. 이는 플레이스홀더가 아니라, 계획 작성 시점에 해당 파일을 열지 않았으므로 실제 이름을 확인하고 쓰라는 지시다. 구현자는 파일을 열어 확인할 수 있다.

**타입 일관성**

- `EmptyStateProps`는 Task 6에서 정의하고 Task 7·8·11이 같은 필드명(`icon` `title` `description` `action`)으로 소비한다. 일치.
- `.work-*` 클래스는 Task 7에서 정의하고 Task 8·9·13이 같은 이름으로 소비한다. 일치.
- `.culture-*` 클래스는 Task 10에서 정의하고 Task 11·12·13이 같은 이름으로 소비한다. 일치.
- 래칫 상수 `MAX_HARDCODED_HEX`는 Task 1에서 776으로 시작해 770→503→478→438→361→326→191→124→0으로 단조 감소한다. 역전 없음.
- 각 상한은 셀렉터 접두사별 실측 잔량에서 계산했고 여유 5를 뒀다. 초안의 추정값은 6개 구간에서 도달 불가능했다(예: 셸 구간은 hex가 11곳뿐인데 116곳 제거를 요구했다).

## 래칫 요약

| Task | 구간 | 구간 실측 hex | hex 상한 | rgba 상한 |
|---:|---|---:|---:|---:|
| 1 | 기준선 | — | 776 | 103 |
| 4 | 셸 | 11 | 770 | 103 |
| 5 | 공통 UI + 공용 프리미티브 | 267 | 503 | 78 |
| 7 | 안건 | 25 | 478 | 77 |
| 8 | 액션·리더 | 40 | 438 | 76 |
| 9 | 알림·계정·리포트 | 77 | 361 | 52 |
| 10 | 접수·로그인 | 35 | 326 | 52 |
| 11 | 추억·유머 | 135 | 191 | 33 |
| 12 | 성향·커피 | 67 | 124 | 14 |
| 13 | 홈·미팅·미디어쿼리 | 114 | 0 | 0 |

상한은 셀렉터 접두사별 실측 잔량(합계 771 + 셀렉터·주석 내 잔여 5)에서 계산하고 여유 5를 뒀다. 실제 치환 결과가 상한보다 낮으면 그 태스크에서 상한을 실제값으로 더 낮춰 커밋한다. **상한을 올리는 방향의 수정은 금지다.**

상한에 도달하지 못하는 태스크가 생기면 그것은 구간 분류가 틀렸다는 신호다. 상한을 올리지 말고 보고한다 — 누락된 규칙이 어느 구간에 속하는지 다시 정해야 한다.
