# 번개 안 커피뽑기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 번개(flash) 상세 화면에서 주최자가 확정 인원 중 "오늘 커피 담당" 한 명을 뽑아 모두에게 공유되도록 저장한다.

**Architecture:** 순수 판단 로직(뽑기 자격·후보)은 `gatheringRules.ts`에 추출해 Vitest로 TDD한다. 결과는 `Gathering` 레코드의 컬럼 2개(`coffeePick`, `coffeePickedAt`)로 저장하며 기존 `saveGatherings` upsert 경로를 그대로 쓴다 — 새 store 함수 없음. UI는 `GatheringBoard` 상세 뷰에 카드 하나를 더한다.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest, Supabase(폴백 localStorage), lucide-react.

## Global Constraints

- 뽑기 대상은 **확정 로스터만**(대기 제외). `splitRoster(g, signups).confirmed` 사용.
- **번개(flash)만**. `kind === 'callup'` 에는 절대 노출 안 함.
- **주최자만** 뽑고 초기화한다. `gathering.host === currentUser.name`.
- **1회 확정(잠김)**: `coffeePick` 이 이미 있으면 다시 뽑지 않는다. `초기화`로만 리셋.
- 저장값은 **실명(name)** 하나. 로스터/신청과 동일 키(`unique(gathering_id, name)`).
- 새 파일 만들지 않는다. 기존 파일만 수정한다.
- 커밋 메시지는 한국어, 기존 저장소 관례(무엇을·왜)를 따른다.

---

### Task 1: 데이터 모델 + 뽑기 판단 로직 (TDD)

**Files:**
- Modify: `src/types.ts` (`Gathering` 타입에 필드 2개)
- Modify: `src/gatheringRules.ts` (순수 함수 2개 추가)
- Test: `src/gatheringRules.test.ts` (테스트 추가)

**Interfaces:**
- Consumes: `splitRoster(gathering, signups): { confirmed: GatheringSignup[]; waiting: GatheringSignup[] }`, `Gathering`, `GatheringSignup` (기존).
- Produces:
  - `Gathering.coffeePick?: string | null`, `Gathering.coffeePickedAt?: string | null`
  - `coffeeCandidates(gathering: Gathering, signups: GatheringSignup[]): GatheringSignup[]`
  - `canDrawCoffee(gathering: Gathering, signups: GatheringSignup[]): boolean`

- [ ] **Step 1: `Gathering` 타입에 필드 추가**

`src/types.ts` 의 `Gathering` 타입에서 `canceled: boolean;` 바로 위에 추가:

```ts
  // 번개에서 뽑은 '오늘 커피 담당' 실명. 없음/undefined = 아직 안 뽑음. 번개(flash)에서만 쓴다.
  coffeePick?: string | null;
  coffeePickedAt?: string | null; // ISO. 언제 뽑았는지(표시용)
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/gatheringRules.test.ts` 의 import 목록에 `coffeeCandidates`, `canDrawCoffee` 를 추가하고, 파일 끝에 아래 블록을 붙인다. (`meetup` 헬퍼와 `NOW` 는 파일 상단에 이미 있다.)

```ts
describe('coffeeCandidates / canDrawCoffee', () => {
  const signups = (names: string[], gatheringId = 'GAT-1'): GatheringSignup[] =>
    names.map((name, index) => ({
      id: `S-${index}`,
      gatheringId,
      name,
      createdAt: `2026-08-05T10:0${index}`,
    }));

  it('확정 로스터만 후보로 돌려준다 (대기 제외)', () => {
    const g = meetup({ capacity: 2 });
    const list = coffeeCandidates(g, signups(['가', '나', '다']));
    expect(list.map((s) => s.name)).toEqual(['가', '나']);
  });

  it('flash + 확정 2명 이상 + 아직 안 뽑음이면 뽑을 수 있다', () => {
    const g = meetup({ kind: 'flash', capacity: null });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(true);
  });

  it('확정이 1명이면 뽑을 수 없다', () => {
    const g = meetup({ kind: 'flash', capacity: null });
    expect(canDrawCoffee(g, signups(['가']))).toBe(false);
  });

  it('callup(일정공모)에서는 뽑을 수 없다', () => {
    const g = meetup({ kind: 'callup', capacity: null });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(false);
  });

  it('이미 뽑았으면(잠김) 다시 뽑을 수 없다', () => {
    const g = meetup({ kind: 'flash', capacity: null, coffeePick: '가' });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(false);
  });

  it('취소된 모임에서는 뽑을 수 없다', () => {
    const g = meetup({ kind: 'flash', capacity: null, canceled: true });
    expect(canDrawCoffee(g, signups(['가', '나']))).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm test -- gatheringRules`
Expected: FAIL — `coffeeCandidates is not a function` / `canDrawCoffee is not a function`

- [ ] **Step 4: 최소 구현 작성**

`src/gatheringRules.ts` 의 `splitRoster` 정의 바로 아래에 추가:

```ts
/** 커피뽑기 후보 = 확정 로스터. 대기자는 아직 오는 사람이 아니라 제외한다. */
export function coffeeCandidates(gathering: Gathering, signups: GatheringSignup[]) {
  return splitRoster(gathering, signups).confirmed;
}

/**
 * 커피 담당을 뽑을 수 있는가.
 * 번개(flash) · 취소 아님 · 아직 안 뽑음 · 확정 2명 이상.
 * (주최자 여부는 UI 관심사라 여기서 보지 않는다 — currentUser 를 규칙에 들이지 않는다.)
 */
export function canDrawCoffee(gathering: Gathering, signups: GatheringSignup[]) {
  if (gathering.kind !== 'flash') return false;
  if (gathering.canceled) return false;
  if (gathering.coffeePick) return false;
  return coffeeCandidates(gathering, signups).length >= 2;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- gatheringRules`
Expected: PASS (신규 6건 포함, 기존 테스트도 그대로 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/types.ts src/gatheringRules.ts src/gatheringRules.test.ts
git commit -m "번개 커피뽑기 모델·판단 로직 — 확정 로스터에서 뽑을 자격을 순수 함수로"
```

---

### Task 2: 저장 계층 + Supabase 마이그레이션

**Files:**
- Modify: `src/gatheringStore.ts` (`GatheringRow` +2, `gatheringFromRow`/`gatheringToRow` 매핑)
- Modify: `supabase-schema.sql` (컬럼 2개 추가)

**Interfaces:**
- Consumes: `Gathering.coffeePick`, `Gathering.coffeePickedAt` (Task 1).
- Produces: DB row ↔ `Gathering` 왕복에 커피 필드 보존. 새 export 함수 없음 — `saveGatherings` upsert 를 그대로 탄다.

- [ ] **Step 1: `GatheringRow` 에 컬럼 추가**

`src/gatheringStore.ts` 의 `type GatheringRow` 에서 `canceled?: boolean | null;` 아래에 추가:

```ts
  coffee_pick?: string | null;
  coffee_picked_at?: string | null;
```

- [ ] **Step 2: `gatheringFromRow` 매핑 추가**

`gatheringFromRow` 의 반환 객체에서 `canceled: Boolean(row.canceled),` 아래에 추가:

```ts
    coffeePick: row.coffee_pick ?? null,
    coffeePickedAt: row.coffee_picked_at ?? null,
```

- [ ] **Step 3: `gatheringToRow` 매핑 추가**

`gatheringToRow` 의 반환 객체에서 `canceled: gathering.canceled,` 아래에 추가:

```ts
    coffee_pick: gathering.coffeePick ?? null,
    coffee_picked_at: gathering.coffeePickedAt ?? null,
```

- [ ] **Step 4: Supabase 스키마에 컬럼 추가**

`supabase-schema.sql` 의 `create table if not exists public.gatherings (...)` 문 바로 아래(같은 gatherings 블록의 RLS 정책 줄들 앞이 읽기 좋다)에 추가:

```sql
-- 번개 커피뽑기: 모임당 커피 담당 한 명(1:1)이라 컬럼으로 둔다. 기존 행은 null = 아직 안 뽑음.
alter table public.gatherings add column if not exists coffee_pick text;
alter table public.gatherings add column if not exists coffee_picked_at timestamptz;
```

- [ ] **Step 5: 타입체크 + 기존 테스트 확인**

Run: `npm run build`
Expected: PASS (tsc 통과, vite 빌드 성공)

Run: `npm test`
Expected: PASS (전체 그대로 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/gatheringStore.ts supabase-schema.sql
git commit -m "번개 커피뽑기 저장 — gatherings 컬럼 2개로 결과를 공유 저장"
```

---

### Task 3: App 핸들러 + GatheringBoard 배선

**Files:**
- Modify: `src/App.tsx` (`drawCoffeePick`/`resetCoffeePick` 핸들러 + `GatheringBoard` props)

**Interfaces:**
- Consumes: `coffeeCandidates` (Task 1), `persistGatherings`, `gatherings`, `gatheringSignups`, `currentUser` (기존 App 스코프).
- Produces: `GatheringBoard` 에 내려줄 `onDrawCoffee: (g: Gathering) => void`, `onResetCoffee: (g: Gathering) => void`.

- [ ] **Step 1: `coffeeCandidates` import 추가**

`src/App.tsx` 상단에서 `gatheringRules` 를 가져오는 import 구문에 `coffeeCandidates` 를 추가한다. (파일에서 `from './gatheringRules'` 를 찾아 목록에 넣는다. 없으면 새 import 를 추가.)

- [ ] **Step 2: 핸들러 2개 추가**

`src/App.tsx` 의 `cancelGathering` 정의(파일 내 `const cancelGathering = (gathering: Gathering) => {`) 바로 아래에 추가:

```ts
  // 번개 커피뽑기: 주최자만, 1회 확정(잠김). 당첨자는 여기서 뽑아 즉시 저장한다 —
  // 도는 연출과 결정을 분리해 모두가 같은 결과(저장값)를 본다.
  const drawCoffeePick = (gathering: Gathering) => {
    if (!currentUser || gathering.host !== currentUser.name) return;
    if (gathering.coffeePick) return; // 잠김
    const candidates = coffeeCandidates(gathering, gatheringSignups);
    if (candidates.length < 2) return;
    const winner = candidates[Math.floor(Math.random() * candidates.length)].name;
    persistGatherings(
      gatherings.map((item) =>
        item.id === gathering.id
          ? { ...item, coffeePick: winner, coffeePickedAt: new Date().toISOString() }
          : item,
      ),
    );
  };

  const resetCoffeePick = (gathering: Gathering) => {
    if (!currentUser || gathering.host !== currentUser.name) return;
    persistGatherings(
      gatherings.map((item) =>
        item.id === gathering.id ? { ...item, coffeePick: null, coffeePickedAt: null } : item,
      ),
    );
  };
```

- [ ] **Step 3: `GatheringBoard` 에 props 배선**

`src/App.tsx` 의 `<GatheringBoard ... />` 에서 `onCancelGathering={cancelGathering}` 아래에 추가:

```tsx
          onDrawCoffee={drawCoffeePick}
          onResetCoffee={resetCoffeePick}
```

- [ ] **Step 4: 타입체크 확인**

Run: `npm run build`
Expected: FAIL — `GatheringBoard` 가 아직 `onDrawCoffee`/`onResetCoffee` prop 을 받지 않아 타입 에러. (Task 4에서 해소한다. 이 시점의 실패는 예상된 것이다.)

- [ ] **Step 5: 커밋**

```bash
git add src/App.tsx
git commit -m "번개 커피뽑기 핸들러 — 주최자가 확정 인원 중 한 명을 뽑고 초기화"
```

---

### Task 4: GatheringBoard 상세 UI

**Files:**
- Modify: `src/features/gatherings/GatheringBoard.tsx` (props 타입 + 상세 뷰 카드)

**Interfaces:**
- Consumes: `onDrawCoffee`, `onResetCoffee` (Task 3), `canDrawCoffee`, `coffeeCandidates` (Task 1), `splitRoster`(기존).
- Produces: 상세 뷰에 커피 카드. flash·비취소일 때만.

- [ ] **Step 1: import 에 규칙·아이콘 추가**

`src/features/gatherings/GatheringBoard.tsx` 상단 `from '../../gatheringRules'` import 목록에 `canDrawCoffee`, `coffeeCandidates` 를 추가한다. lucide-react import 목록에 `Coffee` 를 추가한다.

- [ ] **Step 2: props 타입 추가**

`type GatheringBoardProps` 에서 `onCancelGathering: (gathering: Gathering) => void;` 아래에 추가:

```ts
  onDrawCoffee: (gathering: Gathering) => void;
  onResetCoffee: (gathering: Gathering) => void;
```

그리고 컴포넌트 함수의 props 구조분해에 `onDrawCoffee`, `onResetCoffee` 를 추가한다.

- [ ] **Step 3: 상세 뷰에 커피 카드 삽입**

`src/features/gatherings/GatheringBoard.tsx` 상세 뷰(`view === 'detail'`)에서 `<div className="roster">` **바로 위**에 아래 블록을 넣는다. (`selected`, `status`, `confirmed`, `isHost` 는 그 스코프에 이미 있다.)

```tsx
            {selected.kind === 'flash' && !selected.canceled && (
              <div className="coffee-pick">
                {selected.coffeePick ? (
                  <div className="coffee-pick-result">
                    <Coffee size={18} />
                    <div>
                      <span>오늘 커피 담당</span>
                      <strong>{selected.coffeePick}</strong>
                    </div>
                    {isHost && (
                      <button className="btn-ghost" onClick={() => onResetCoffee(selected)} type="button">
                        다시 뽑기
                      </button>
                    )}
                  </div>
                ) : isHost ? (
                  canDrawCoffee(selected, signups) ? (
                    <button className="primary-button coffee" onClick={() => onDrawCoffee(selected)} type="button">
                      <Coffee size={18} />
                      커피 살 사람 뽑기
                    </button>
                  ) : (
                    <p className="coffee-pick-hint">확정 2명부터 커피 담당을 뽑을 수 있어요</p>
                  )
                ) : null}
              </div>
            )}
```

- [ ] **Step 4: 타입체크 + 빌드 확인**

Run: `npm run build`
Expected: PASS (Task 3의 타입 에러가 해소되고 tsc·vite 빌드 성공)

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/gatherings/GatheringBoard.tsx
git commit -m "번개 상세에 커피뽑기 카드 — 주최자 뽑기·결과·초기화, flash 전용"
```

---

### Task 5: 스타일

**Files:**
- Modify: `src/styles.css` (`.coffee-pick*` 규칙)

**Interfaces:**
- Consumes: 기존 색 토큰·버튼 스타일.
- Produces: 커피 카드 시각.

- [ ] **Step 1: CSS 추가**

`src/styles.css` 끝(또는 gathering-detail 관련 규칙 근처)에 추가. 기존 토큰을 재사용하되, 없으면 값이 자연스럽게 떨어지도록 표준 속성으로 둔다.

```css
/* 번개 상세 커피뽑기 */
.coffee-pick {
  margin: 12px 0;
}
.coffee-pick .primary-button.coffee {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.coffee-pick-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-2, #f4efe7);
  border: 1px solid var(--border, #e3dccf);
}
.coffee-pick-result > div {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.coffee-pick-result span {
  font-size: 12px;
  opacity: 0.7;
}
.coffee-pick-result strong {
  font-size: 18px;
}
.coffee-pick-result .btn-ghost {
  margin-left: auto;
}
.coffee-pick-hint {
  font-size: 13px;
  opacity: 0.7;
  margin: 0;
}
```

> 참고: `--surface-2`/`--border` 토큰명이 저장소와 다르면(디자인 토큰은 `src/designTokens*` 참고) 그에 맞춰 바꾼다. fallback 값이 있어 토큰이 없어도 깨지진 않는다.

- [ ] **Step 2: 개발 서버로 눈으로 확인**

Run: `npm run dev` 후 브라우저에서 flash 번개 상세를 연다(확정 2명 이상). 주최자 계정에서 `커피 살 사람 뽑기` → 결과 카드 전환 → `다시 뽑기` 로 초기화되는지 확인. callup 상세엔 카드가 없어야 한다.
Expected: 위 흐름이 모두 동작.

- [ ] **Step 3: 커밋**

```bash
git add src/styles.css
git commit -m "번개 커피뽑기 카드 스타일"
```

---

## 검증 (플랜 전체 완료 후)

- [ ] flash 번개 상세 · 확정 2명 이상 → 주최자에게 뽑기 버튼, 뽑으면 결과 카드로 전환·잠김.
- [ ] 다른 사용자 화면에서 같은 결과가 보임(저장 반영 — 새로고침/다른 계정).
- [ ] callup(일정공모) 상세엔 커피 카드 없음.
- [ ] 확정 <2명이면 힌트 문구.
- [ ] 초기화 → 다시 뽑기 가능.
- [ ] Supabase 없이(로컬 폴백)도 동일 동작.
- [ ] `npm test` 전체 통과, `npm run build` 성공.
