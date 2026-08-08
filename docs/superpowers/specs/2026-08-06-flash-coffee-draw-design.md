# 번개 안 커피뽑기 — 설계

작성일: 2026-08-06
상태: 승인됨 (구현 계획 대기)

## 배경 · 목적

커피뽑기(`connect`)는 전체 팀 명단(`Profile[]`)에서 아무나 골라 뽑는 독립 놀이 화면이다.
"누구와 실제로 만나느냐"는 개념이 없다. 반면 번개(`gatherings`)는 실제로 모인 사람(신청
로스터 = 확정/대기)이 핵심이다.

이 둘을 잇는다: **번개(flash) 상세 화면에서, 그 번개에 실제로 온 확정 인원 중 "오늘 커피
담당" 한 명을 뽑는다.** 커피뽑기가 추상 명단이 아니라 "지금 이 모임에 온 사람" 위에서
돌아가 의미가 살아난다.

## 확정된 결정 (사용자 검토 완료)

- **방향**: 번개 상세 화면에서 확정 로스터 중 커피 살 사람을 뽑는다.
- **결과 성격**: 공유된 진실로 **저장**한다. 모두가 "이 번개 커피 담당 = OO"를 똑같이 본다.
- **권한 · 재추첨**: **주최자만** 뽑는다. **1회 확정(잠김)**. `초기화`로만 다시 뽑을 수 있다.
- **적용 범위**: **번개(flash)만**. 일정공모(callup)에는 붙이지 않는다.
- **대상**: **확정 로스터만**. 대기자는 아직 오는 사람이 아니라 제외한다.
- **조뽑기**: 붙이지 않는다. 요청이 커피뽑기라 번개엔 커피만.

## 데이터 모델

`Gathering` 하나당 커피 담당은 한 명(1:1)이라 새 테이블이 아니라 컬럼 2개를 더한다.
로스터·신청이 이미 실명(name)을 키로 쓰므로(`unique(gathering_id, name)`) 저장값도 name 하나면
충분하다. id 참조를 새로 들 필요가 없다.

`src/types.ts` — `Gathering` 타입에 추가:

```ts
coffeePick?: string | null;      // 뽑힌 사람 실명. 없음/undefined = 아직 안 뽑음
coffeePickedAt?: string | null;  // ISO. 언제 뽑았는지(표시용)
```

## 저장 계층 (`src/gatheringStore.ts`)

signup처럼 동시성 경쟁(두 사람 동시 신청)이 없다 — 주최자 1명이 1회 확정 — 이므로
기존 `saveGatherings` upsert 경로를 그대로 쓴다. **새 store 함수는 만들지 않는다.**

- `GatheringRow`에 `coffee_pick?: string | null`, `coffee_picked_at?: string | null` 추가.
- `gatheringFromRow`: `coffeePick: row.coffee_pick ?? null`, `coffeePickedAt: row.coffee_picked_at ?? null`.
- `gatheringToRow`: `coffee_pick: gathering.coffeePick ?? null`, `coffee_picked_at: gathering.coffeePickedAt ?? null`.

## Supabase 마이그레이션 (`supabase-schema.sql`)

기존 레코드는 null → "아직 안 뽑음"으로 자연스럽게 떨어진다(안전).

```sql
alter table public.gatherings add column if not exists coffee_pick text;
alter table public.gatherings add column if not exists coffee_picked_at timestamptz;
```

## 동작 (`src/App.tsx`)

핸들러 2개를 만들고 `cancelGathering`과 똑같이 props로 `GatheringBoard`에 내려준다.

### `drawCoffeePick(gathering)`

1. 주최자 확인: `gathering.host === currentUser?.name` 아니면 무시.
2. 잠김 확인: `gathering.coffeePick` 이미 있으면 무시.
3. 대상 확인: `splitRoster(gathering, gatheringSignups).confirmed` 가 2명 미만이면 무시.
4. 당첨자 = confirmed 중 랜덤 1명의 name.
5. `persistGatherings`로 해당 모임만 `{ coffeePick, coffeePickedAt: new Date().toISOString() }` 저장.

### `resetCoffeePick(gathering)`

1. 주최자 확인.
2. `persistGatherings`로 해당 모임만 `{ coffeePick: null, coffeePickedAt: null }` 저장.

### 핵심: 당첨자 결정과 애니메이션 분리

당첨자는 핸들러에서 뽑아 즉시 저장 → 모두 같은 값을 본다. 도는 연출은 "버튼 누른
주최자 화면에서만" 잠깐 보이는 장식이고 결과는 저장된 값으로 착지한다. 다른 사람은 저장된
결과만 본다. 그래서 기존 three.js `DrawCanvas`(무거운 3D 무대)는 **재사용하지 않는다** —
상세 화면엔 과하다. Connect의 가벼운 CSS 커피컵 연출 정도만 인라인으로 둔다(선택).

## UI (`src/features/gatherings/GatheringBoard.tsx` 상세 뷰)

`selected.kind === 'flash'` 이고 취소가 아닐 때만, 로스터 블록 근처에 커피 카드 하나를 둔다.

- **이미 뽑힘**: `☕ 오늘 커피 담당: OO` 결과 카드. 주최자에게만 작은 `다시 뽑기(초기화)` 고스트 버튼.
- **아직 + 주최자 + 확정 ≥ 2명**: `커피 살 사람 뽑기` 버튼.
- **아직 + 주최자 + 확정 < 2명**: 비활성 + 이유 "확정 2명부터 뽑을 수 있어요".
- **아직 + 비주최자**: 표시 안 함. 뽑히면 그때 결과가 모두에게 보인다.

props 추가: `onDrawCoffee: (g: Gathering) => void`, `onResetCoffee: (g: Gathering) => void`.

## 상태 게이팅

모집중/마감/진행함 상관없이 "확정 2명 이상"이면 허용한다(관대하게). 커피는 보통 만나서
정하니까. 좁히고 싶으면 나중에.

## 엣지케이스 · 리스크

1. **뽑힌 뒤 그 사람이 신청 취소**: 저장된 이름이 stale 로 남을 수 있다.
   - 권장(옵션): `leaveGathering`에서 "취소자 name === coffeePick 이면 coffeePick/coffeePickedAt 자동 초기화" 한 줄. v1 필수는 아님.
2. **모임 취소(canceled)**: 커피 카드를 숨긴다. 활성 모임에서만 의미.
3. **알림**: 뽑힌 사람에게 "오늘 커피는 당신!" 알림 — 시스템은 있으나 v1 범위에서 뺀다(YAGNI). 원하면 추가.
4. **이름 충돌**: 로스터는 실명이 모임 내 unique 이므로 name 저장이 기존 로스터/신청과 일관.

## 손대는 파일

- `src/types.ts` — `Gathering`에 필드 2개.
- `src/gatheringStore.ts` — `GatheringRow` +2, from/toRow 매핑.
- `src/App.tsx` — `drawCoffeePick`/`resetCoffeePick` 핸들러 + `GatheringBoard` 배선.
- `src/features/gatherings/GatheringBoard.tsx` — props 2개 + 상세 UI 블록.
- `supabase-schema.sql` — 컬럼 2개(alter add if not exists).
- CSS — 결과 카드/버튼 소량(Connect의 커피 토큰 재사용).

## YAGNI 컷

- 무거운 three.js `DrawCanvas` 재사용 안 함.
- 별도 테이블 안 만듦(컬럼 2개로).
- 번개에 조뽑기 안 붙임(커피만).
- 알림 v1에서 뺌.

## 검증

- flash 번개 상세에서 확정 2명 이상 → 주최자에게 뽑기 버튼 노출, 뽑으면 결과 카드로 전환·잠김.
- 다른 사용자 화면에서 같은 결과가 보임(저장 반영).
- callup(일정공모) 상세에는 커피 카드가 없음.
- 확정 <2명이면 비활성 + 이유 문구.
- 초기화 → 다시 뽑기 가능.
- Supabase 없이(로컬 폴백) 동일하게 동작.
