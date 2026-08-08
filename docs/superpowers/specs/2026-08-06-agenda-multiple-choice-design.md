# 안건 객관식 투표

작성일 2026-08-06 · 브랜치 `feature/agenda-multiple-choice`

## 문제

안건함의 투표는 찬성/반대 두 갈래뿐이다. "회식 장소를 어디로 할까", "티미팅을 몇 시로 옮길까"처럼
답이 둘이 아닌 안건은 지금 구조로 물을 수 없다. 안건을 여러 개로 쪼개 각각 찬반을 묻는 우회는
표가 갈려 어느 것도 정족수를 못 채운다.

## 하기로 한 것

안건을 등록할 때 **찬반**과 **객관식** 중 고른다. 객관식이면 선택지를 직접 써 넣고,
원하면 여러 개를 고를 수 있게 열어둔다.

## 하지 않는 것

- 기존 찬반 안건의 데이터 구조 변경. 이미 쌓인 안건과 대시보드·지표는 그대로 둔다.
- 선택지별 코멘트, 순위 투표, 가중치 투표.
- 투표 후 변경/취소. 지금과 같이 확정하면 되돌릴 수 없다.

## 데이터 모델

```ts
export type VoteType = '찬반' | '객관식';
export type AgendaOption = { id: string; label: string; count: number };

export type Agenda = {
  // ...기존 필드...
  voteType: VoteType;      // 기본 '찬반'
  options: AgendaOption[]; // 찬반이면 빈 배열
  multiSelect: boolean;    // 객관식에서 여러 개 고르기 허용
  voterCount: number;      // 실제로 투표한 '사람' 수
};
```

`voterCount`를 따로 두는 이유: 복수 선택이면 `options[].count`의 합이 사람 수보다 커진다.
정족수와 참여율은 사람 수로 재야 하므로 득표 합계와 분리한다. 찬반은 `approve + reject`가
곧 사람 수라 새 필드를 쓰지 않는다.

투표 전달값:

```ts
export type VoteSelection =
  | { kind: '찬반'; choice: VoteChoice }
  | { kind: '객관식'; optionIds: string[] };
```

### 익명성

기존 규약을 그대로 지킨다. 무엇을 골랐는지는 `agendas.options[].count` 집계에만 반영되고,
투표용지(`agenda_ballots`)에는 여전히 "이 사람이 이 안건에 투표했다"만 남는다.
어떤 행 하나도 사람과 선택을 잇지 못한다.

## 결과 판정

`AgendaStatus`에 `'결정됨'`을 더한다 (`'투표중' | '통과' | '부결' | '결정됨'`).

| 상황 | 결과 |
| --- | --- |
| 1위 득표 > 2위 득표 + 남은 인원 | `결정됨` (조기 확정) |
| 마감 · 정족수 충족 | `결정됨` |
| 마감 · 정족수 미달 | `부결` (성립하지 않음) |
| 1위가 동점 | `결정됨` + "동점 — 하나로 결정되지 않았습니다" |

조기 확정 조건은 찬반과 같은 철학이다. 남은 사람이 전부 2위로 몰려도 뒤집히지 않을 때만 닫는다.
복수 선택이어도 한 사람이 한 선택지에 더할 수 있는 표는 최대 1이므로 같은 식이 성립한다.

`voteTotal()`의 의미를 "참여 인원"으로 통일한다 (찬반 = `approve + reject`, 객관식 = `voterCount`).
정족수·참여율·남은 인원 계산은 분기 없이 그대로 재사용된다.

새 헬퍼 `winningOptions(agenda)`는 최다 득표 선택지를 배열로 준다. 동점이면 여러 개가 나온다.

## 화면

- **AgendaForm** — 투표 방식 카드 2개. 객관식이면 선택지 입력 줄(기본 2칸, 최대 6개, 추가·삭제)과
  "여러 개 고르기 허용" 체크박스가 붙는다. 검증: 2개 이상 / 공백 불가 / 중복 불가.
  선택 카드(익명/실명 · 찬반/객관식)의 설명 문구는 뺀다. 이 화면에서만 고를 것이 넷이라
  카드마다 설명이 붙으면 정작 채워야 할 제목·배경 설명이 화면 밖으로 밀려난다.
  다른 화면의 `.choice-card`는 그대로 둔다.
- **AgendaDetail** — 객관식은 선택지 목록에서 고른다. 확정 **전에** 무엇을 골랐는지 되짚어주고
  되돌릴 수 없다는 경고를 띄우는 기존 흐름을 유지한다. 결과는 선택지별 막대와 표 수.
- **AgendaBoard 카드 / Dashboard 카드** — `.ig-poll`은 이미 선택지 N개를 받는 grid라 그대로 쓴다.
  1위에 `win` 클래스. CSS 추가 없음.
- **정렬** — `'찬성률순'`을 `'우세율순'`으로 바꾼다. 찬반은 찬성률, 객관식은 1위 득표율을 쓴다.
  이름을 그대로 두면 객관식이 항상 0%로 계산되어 목록 맨 아래에 깔린다.

## 액션아이템

생성 조건을 `status === '통과'`에서 `'통과' || '결정됨'`으로 넓힌다.
객관식에서 넘어오면 1위 선택지 라벨이 첫 액션의 기본 제목으로 채워진다. 동점이면 비운다.

## DB

```sql
alter table public.agendas
  add column if not exists vote_type text not null default '찬반',
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists multi_select boolean not null default false,
  add column if not exists voter_count integer not null default 0;
```

`status` check 제약에 `'결정됨'`을 더한다. 전부 default가 있는 `add column if not exists`라
기존 행은 손대지 않아도 찬반 안건으로 읽힌다.

## 테스트

`agendaRules.test.ts` / `agendaSort.test.ts`에 객관식 케이스를 더한다.

- 조기 확정: 1위가 2위 + 남은 인원을 넘을 때만 닫힌다
- 마감 시 정족수 미달이면 부결
- 동점이면 `winningOptions`가 여러 개를 준다
- 복수 선택에서 득표 합계가 참여 인원을 넘어도 참여율이 100%를 넘지 않는다
- `leadRate` 기준 정렬

`mockData.ts`에 객관식 샘플 안건 1건을 넣는다.
