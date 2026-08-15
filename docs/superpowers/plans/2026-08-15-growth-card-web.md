# 성장 카드(Growth Card) 웹 v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. 체크박스(`- [ ]`)로 추적.

**Goal:** 팀원이 성장 목표(단기)와 역량 레벨(장기)을 한 카드에서 관리하고, 리더가 코멘트·레벨 합의로 성장 정렬하는 웹 기능.

**Architecture:** 기존 스토어 패턴(remoteTable syncRows + Supabase + localStorage 캐시)으로 3테이블을 다루고, `active === 'growth'` 섹션에 개인/리더 화면을 라우팅. 순수 규칙은 growthRules로 분리·테스트.

**Tech Stack:** TypeScript, React, Vite, Vitest, Supabase(supabase-js). 새 의존성 없음.

## Global Constraints
- 새 npm 의존성 금지. 차트는 기존 Metrics 패턴(인라인 SVG) 재사용.
- 계정 식별 `owner_email`(소문자). 리더 판정 `isLeader`/`leadersFor` 재사용.
- v1 역량 세트 고정: `문제정의·기획`, `실행·개발`, `협업·소통`, `도메인 전문성`, `AI 활용`, `학습·성장`.
- 진척 0–100 클램프, 레벨 1–5. 커리어는 사적 데이터 — 화면은 본인/리더만(게이트).
- 낙관적 쓰기(로컬 먼저, 원격 syncRows). 스토어 패턴은 actionItemStore.ts 를 따른다.

---

### Task 1: 타입 + growthRules (TDD)
**Files:** Create `src/growthRules.ts`, `src/growthRules.test.ts`; Modify `src/types.ts`.

**types.ts 추가:**
```ts
export const competencies = ['문제정의·기획','실행·개발','협업·소통','도메인 전문성','AI 활용','학습·성장'] as const;
export type Competency = typeof competencies[number];
export type GoalStatus = '진행중' | '완료' | '보류';
export type GrowthGoal = { id: string; ownerEmail: string; title: string; detail: string;
  due: string; progress: number; status: GoalStatus; leaderComment: string; createdAt: string; updatedAt: string; };
export type CompetencyLevel = { id: string; ownerEmail: string; competency: Competency;
  selfLevel: number; leaderLevel?: number; evidence: string; updatedAt: string; };
export type CompetencyLogEntry = { id: string; ownerEmail: string; competency: Competency;
  level: number; by: 'self' | 'leader'; at: string; };
```

**growthRules.ts (Produces):**
- `clampProgress(n): number` (0–100 정수)
- `clampLevel(n): number` (1–5 정수)
- `isValidCompetency(s): boolean`
- `curveSeries(log: CompetencyLogEntry[], competency, by): {at:string; level:number}[]` (시간순 정렬)
- `nextStatus(progress): GoalStatus` (100이면 완료, 아니면 진행중 유지 — 보류는 명시 전환만)

- [ ] Step 1: `growthRules.test.ts` 작성 — clampProgress(-5→0,150→100,33.7→34), clampLevel(0→1,9→5), isValidCompetency, curveSeries 정렬·필터(by=self만), nextStatus(100→완료).
- [ ] Step 2: 실패 확인 `npx vitest run src/growthRules.test.ts`.
- [ ] Step 3: types + growthRules 구현.
- [ ] Step 4: 통과 확인.
- [ ] Step 5: 커밋 `feat(성장): 타입 + growthRules + 테스트`.

---

### Task 2: DB 마이그레이션 SQL
**Files:** Create `docs/sql/2026-08-15-growth-card.sql`.
```sql
create table if not exists public.growth_goals (
  id text primary key, owner_email text not null, title text not null, detail text default '',
  due date, progress int not null default 0, status text not null default '진행중',
  leader_comment text default '', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.growth_competencies (
  id text primary key, owner_email text not null, competency text not null,
  self_level int not null default 1, leader_level int, evidence text default '',
  updated_at timestamptz default now(), unique(owner_email, competency));
create table if not exists public.growth_competency_log (
  id text primary key, owner_email text not null, competency text not null,
  level int not null, by text not null, at timestamptz default now());
-- 프라이버시(후속 강화): 지금은 anon 읽기 허용(앱 게이트). RLS 초안은 주석으로 남기고 후속에 owner+leaders 제한.
```
- [ ] Step 1: SQL 작성. Step 2: Supabase 적용(배포 단계). Step 3: 커밋 `db(스키마): growth 3테이블`.

---

### Task 3: growthStore.ts (+test)
**Files:** Create `src/growthStore.ts`, `src/growthStore.rows.test.ts`.
**Interfaces (Produces):**
- `loadGrowth(): Promise<{goals:GrowthGoal[]; levels:CompetencyLevel[]; log:CompetencyLogEntry[]}>`
- `saveGoals(goals)`, `saveLevels(levels)`, `appendLog(entry)` — syncRows 패턴.
- `makeGrowthId(prefix): string` (`GRW-...`).
- row↔model 매핑 함수 export(테스트용).
- [ ] Step 1: rows 왕복 테스트(goal/level/log). Step 2: 실패. Step 3: 구현(actionItemStore.ts 미러 — 3테이블). Step 4: 통과. Step 5: 커밋 `feat(성장): growthStore + row 매핑`.

---

### Task 4: 라우팅 + 내비 등록
**Files:** Modify `src/types.ts`(Section에 `'growth'`), `src/App.tsx`(스토어 로드·상태·`active==='growth'` 렌더·changeSection), `src/components/AppShell.tsx`(내비 항목 "내 성장").
- 개인은 누구나, 리더 뷰는 화면 내 탭으로(팀 성장) `isLeader` 게이트.
- [ ] 구현 후 로컬 구동으로 섹션 진입 확인. 커밋 `feat(성장): growth 섹션 라우팅`.

---

### Task 5: GrowthCard.tsx (개인)
**Files:** Create `src/features/growth/GrowthCard.tsx`; Modify `src/features/growth/GrowthCard.css` 또는 styles.css(토큰만, 하드코딩 hex 금지 — designTokens.test 통과).
- 성장 목표: 목록 + 추가/수정 폼 + 진척 슬라이더 + 완료 토글.
- 역량 레벨: competencies 6개 각 자가 레벨(1–5) 선택 + 근거 입력 → 변경 시 appendLog(by:self).
- 성장 곡선: curveSeries 로 인라인 SVG(Metrics 패턴).
- [ ] 로컬 구동 검증. 커밋 `feat(성장): 개인 성장 카드(목표·역량·곡선)`.

---

### Task 6: TeamGrowth.tsx (리더)
**Files:** Create `src/features/growth/TeamGrowth.tsx`.
- `isLeader` 게이트. 팀원 선택 → 그 사람 goals/levels 열람.
- 목표 `leaderComment` 편집(대나무숲 패턴), 역량 `leaderLevel` 합의 → appendLog(by:leader).
- 1:1 제안 링크(기존 흐름 재사용, 있으면).
- [ ] 로컬 구동(리더 세션) 검증. 커밋 `feat(성장): 팀 성장 뷰(리더 정렬)`.

---

### Task 7: 알림 연결(가벼움)
**Files:** Modify 알림 규칙(notificationRules) — 목표 완료·리더 코멘트 도착 시 알림 생성(기존 패턴). 과설계 금지, 2종만.
- [ ] 커밋 `feat(성장): 목표 완료·리더 코멘트 알림`.

---

### Task 8: 배포
- [ ] SQL 적용. `npx vitest run` 전체 통과 + `npm run build`.
- [ ] `feature/growth-card` → dev 병합 → 자동 배포. 스모크(개인 목표·리더 합의·곡선).
- [ ] (후속 플랜) iOS 포팅 + RLS 강화.

## Self-Review
- 스펙 커버리지: 목표(Task5)·역량레벨(Task5)·리더정렬(Task6)·곡선(Task1/5)·데이터(Task2/3)·알림(Task7)·프라이버시(게이트 Task4/6, RLS 후속)·배포(Task8) 매핑됨.
- 타입 일관성: GrowthGoal/CompetencyLevel/CompetencyLogEntry/Competency 전 태스크 동일.
- 애매성 해소: 성장 곡선은 자가 레벨(by:self) 라인 기본, 리더 라인은 선택 표시. 역량 세트 v1 고정.
