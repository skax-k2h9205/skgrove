# 홈 통합 피드 (인스타 3열) — 설계

작성일: 2026-08-07
상태: 승인됨 (구현 계획 대기)

## 배경 · 목적

지금 홈(`Dashboard`, `ig-home`)은 인스타風이지만 **풀폭 포스트(`ig-post`)를 세로로
쌓는** 형태다: 투표 안건(진행바), 액션아이템(인라인 목록), 내 모임 카드가 각각 세로로
쌓인다.

요청: 홈에 5개 도메인의 항목을 **하나의 피드로 합쳐 · 최신순 · 한 줄에 3개**(인스타
피드 격자)로 보여준다. 카드 크기를 통일한다.

## 확정된 결정 (사용자 검토 완료)

- **대상 도메인 5개**: 안건함/투표(`agenda`, 안건함과 투표는 한 도메인), 액션아이템
  (`actions`), 모임·번개(`gatherings`), 유머게시판(`humor`), 이음장터(`market`).
- **레이아웃 범위**: 상단 스토리 트레이(`ig-tray`)·작성창(`ig-composer`)·통계(`ig-stats`)는
  **유지**. 그 아래 세로로 쌓이던 **풀폭 포스트(`ig-post`) 블록을 3열 격자로 교체**.
  (투표 진행바·액션 인라인 토글 같은 인라인 리치 UI는 사라지고 타일+이동 방식이 된다 —
  사용자 확인 완료.)
- **카드 비율(크기 기준)**: **4:5 세로 타일**로 통일. 기존 유머 `ig-reel`(4:5)을 베이스로
  삼고 번개·유머·장터·안건·액션 카드를 모두 이 비율로 맞춘다.
- **무이미지 카드(안건·액션)**: **도메인 색 타일 + 아이콘 + 제목 + 메타**로 채운다.
- **항목 범위**: **상태 무관 최신순 최근 30개**. 완료·종료·취소된 것도 최근이면 뜬다
  (단, 메타에 상태를 적어 활성처럼 오해되지 않게).
- 클릭 → 해당 메뉴로 이동(`onSectionChange(section)`).

## 통합 로직 — 순수 함수로 분리

이질적인 5타입을 하나의 공통 shape로 접는 매핑이 핵심이다. 화면 없이 정렬·개수·매핑을
테스트할 수 있도록 순수 함수로 뺀다.

새 파일 `src/homeFeed.ts`:

```ts
import type { Section } from './types';

export type HomeFeedKind = 'agenda' | 'action' | 'gathering' | 'humor' | 'market';

export type HomeFeedItem = {
  id: string;              // 도메인 접두어, 예: 'gathering:GAT-1'
  section: Section;        // 클릭 시 이동할 섹션
  kind: HomeFeedKind;
  title: string;
  createdAt: string;       // 정렬 키(원본 createdAt)
  imageUrl?: string;       // 있으면 사진 타일, 없으면 색 타일
  tone: string;            // 도메인 색 토큰 클래스(색 타일/배지 색)
  meta?: string;           // 작은 메타: 투표수 / 마감 / N자리 / 상태 / 가격
};

export const HOME_FEED_LIMIT = 30;

export function buildHomeFeed(sources: {
  agendas: Agenda[];
  actionItems: ActionItem[];
  gatherings: Gathering[];
  humorPosts: HumorPost[];
  marketItems: MarketItem[];
}): HomeFeedItem[];
```

- 각 도메인을 `HomeFeedItem`으로 매핑 → 하나로 합쳐 `createdAt` **내림차순** 정렬 →
  `HOME_FEED_LIMIT`(30)개 slice.
- **정렬 정규화**: 번개·유머·장터의 `createdAt`은 날짜만(`YYYY-MM-DD`), 안건·액션은
  시각까지 있을 수 있다. 날짜 부분(앞 10자)까지는 정확히 최신순이 되지만 **같은 날 안에서의
  정확한 순서는 보장하지 않는다**(원본 데이터 한계). 구현은 `createdAt` 문자열 내림차순으로
  단순 비교하되, 이 한계를 주석으로 남긴다.
- 매핑 규칙:
  - agenda → { section:'agenda', kind:'agenda', title:agenda.title, tone(안건색), meta: 투표 상태/표수, imageUrl 없음 }
  - action → { section:'actions', kind:'action', title, tone(액션색), meta: 마감/상태, imageUrl 없음 }
  - gathering → { section:'gatherings', kind:'gathering', title, imageUrl: 사진 있으면, tone, meta: 상태/자리 }
  - humor → { section:'humor', kind:'humor', title: 본문 요약, imageUrl: 미디어 썸네일, tone, meta }
  - market → { section:'market', kind:'market', title, imageUrl: 사진/포스터, tone, meta: 상태/가격 }

## 카드 렌더 (Dashboard 안)

4:5 타일 하나로 통일한다.

- **사진 있는 도메인**(번개·유머·장터): 배경 사진(`object-fit: cover`) + 하단 그라데이션 +
  좌상단 종류 배지(번개/유머/장터) + 제목 + 메타.
- **사진 없는 도메인**(안건·액션): 도메인 색 타일 + 아이콘 + 제목 + 메타.
- 좌상단 종류 배지로 어느 메뉴 소식인지 구분.
- 클릭 → `onSectionChange(item.section)`.
- 기존 썸네일 로직 재사용: 번개=`Gathering.imageUrl`/포스터, 장터=`MarketItem.imageUrl`/
  포스터, 유머=미디어 썸네일(`HumorBoard`의 bgSrc 판별 로직과 동일 규칙).

## 데이터 흐름 (App → Dashboard)

- 현재 Dashboard props: `agendas, actionItems, gatherings, signups, ...`.
- **추가**: `humorPosts: HumorPost[]`, `marketItems: MarketItem[]` (App이 이미 state 보유).
- Dashboard가 `buildHomeFeed(...)`로 피드를 만들어 격자로 렌더.

## CSS

- `.home-feed` — 3열 격자(`repeat(3, minmax(0,1fr))`), 기존 격자 간격과 일관.
- `.home-feed-card` — `aspect-ratio: 4/5`(유머 `ig-reel` 기준), 사진 변형/색 타일 변형.
- 색은 기존 디자인 토큰만 사용(하드코딩 hex 금지 — `designTokens.test.ts`).

## 손대는 파일

- `src/homeFeed.ts` (신규, 순수 빌더)
- `src/homeFeed.test.ts` (신규, 정렬·개수·매핑 테스트)
- `src/features/dashboard/Dashboard.tsx` (props 2개 추가, `ig-post` 블록 → 피드 격자)
- `src/App.tsx` (Dashboard에 `humorPosts`, `marketItems` 전달)
- `src/styles.css` (`.home-feed`, `.home-feed-card`)

## YAGNI 컷

- 필터 UI·무한스크롤 없음(상위 30개 고정).
- 새 이미지 파이프라인 없음(기존 썸네일 재사용).
- 도메인별 실시간 상태 재계산은 간단한 메타 수준까지만.

## 유지

- 상단 스토리 트레이(`ig-tray`), 작성창(`ig-composer`), 통계(`ig-stats`)는 그대로.
- 기존 `ig-post` 블록(투표 안건 포스트·액션 목록 포스트·내 모임 포스트)만 제거하고
  통합 격자로 대체.

## 엣지케이스

- 피드가 비면 → EmptyState("아직 소식이 없어요").
- 사진 로드 실패/없음 → 색 타일 폴백.
- 혼합 날짜 포맷 → 날짜 단위 최신순까지 정확(같은 날 순서 근사).
- 취소된 번개·완료된 장터 등도 최근이면 노출 → 메타에 상태 표기로 오해 방지.

## 검증

- `buildHomeFeed`: 5도메인 혼합 입력 → 최신순 정렬·30개 제한·도메인별 매핑(section/kind/
  imageUrl 유무)·빈 입력 안전을 단위 테스트로.
- 홈 화면: 트레이·작성창·통계 유지, 그 아래 3열 4:5 타일 격자, 클릭 이동, 빈 상태.
- `npm run build`(tsc+vite) 통과, `npm test` 전체 통과(designTokens 포함).
