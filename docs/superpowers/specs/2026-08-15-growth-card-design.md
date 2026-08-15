# 커리어 관리 — 성장 카드(Growth Card) 설계

- 날짜: 2026-08-15
- 브랜치: `feature/growth-card` (base: `origin/dev`)
- 상태: 설계 승인됨 (사용자)
- 대상: 웹(dev) 먼저 → iOS(feature/ios-native) 포팅. 웹·iOS 공유 Supabase.

## 배경 / 목적

SKonnection(SK ITS혁신팀 ~30명, 팀 문화·연결 플랫폼)에 **커리어 관리** 기능을 더한다.
무거운 HR 시스템이 아니라 앱 결(가볍고·연결지향·성장 대화)에 맞춘 **자기주도 성장 도구**.

**핵심(확정):** 성장 목표(단기) + 역량 레벨(장기)을 한 카드에. 리더와 공유해 "성장 정렬".

## 결정 사항 (확정)

1. **핵심**: 성장 목표(단기) + 역량 레벨 트래킹(장기) 결합.
2. **공개·참여**: **리더와 공유(성장 정렬)** — 본인이 세우면 그 사람의 리더가 보고 코멘트/레벨 합의. 동료 비공개.
3. **구조**: 자유 성장 목표 + 정의된 역량 세트에 자가·리더 레벨.

## 기능 구성

### ① 개인 성장 카드
- **성장 목표(단기)**: `제목 · 설명 · 기한(due) · 진척(0–100) · 상태(진행중/완료/보류)`. 개인이 추가·수정·진척 갱신.
- **역량 레벨(장기)**: 팀 공용 역량 6개에 `자가 레벨(1–5) + 근거 한 줄`. 분기 갱신 권장.
  - v1 고정 세트: `문제정의·기획`, `실행·개발`, `협업·소통`, `도메인 전문성`, `AI 활용`, `학습·성장`.
- **성장 곡선**: 역량 레벨 변화를 시간축으로(기존 파트지수 차트 인프라 재사용).

### ② 리더 정렬(공유 모델)
- 리더(팀리더/파트리더)가 **팀 성장 뷰**에서 팀원 카드 열람.
- **목표 코멘트**(대나무숲 leaderReply 패턴 재사용), **역량 레벨 합의**(자가 레벨을 확인/조정 → 합의 레벨 저장 + 이력 기록).
- 기존 **1:1 제안**과 링크(성장 대화 맥락).

### ③ 알림(기존 알림센터 재사용)
- 목표 완료, 리더 코멘트 도착, 분기 역량 갱신 리마인드.

## 데이터 모델 (Supabase, 3테이블)

계정 식별은 앱 관례대로 `owner_email`(소문자) 사용(기존 issues.submitter_email 등과 동일).

### `growth_goals`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text (PK) | `GRW-...` |
| owner_email | text | 소유자 |
| title | text | |
| detail | text | |
| due | date | 없으면 무기한 |
| progress | int (0–100) | 진척 |
| status | text | 진행중/완료/보류 |
| leader_comment | text | 리더 정렬 코멘트 |
| created_at / updated_at | timestamptz | |

### `growth_competencies` (현재 레벨)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text (PK) | `owner+competency` 유일 |
| owner_email | text | |
| competency | text | 고정 세트 중 하나 |
| self_level | int (1–5) | 자가 |
| leader_level | int (1–5, nullable) | 리더 합의 |
| evidence | text | 근거 한 줄 |
| updated_at | timestamptz | |

### `growth_competency_log` (성장 곡선용 이력)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text (PK) | |
| owner_email | text | |
| competency | text | |
| level | int (1–5) | |
| by | text | self / leader |
| at | timestamptz | |

## 공개 · 프라이버시

- 개인 성장 카드 = **본인 + 그 사람의 리더**만. 동료·운영자 열람 최소화.
- ⚠️ **중요**: 현 앱은 대부분 테이블을 공개 anon 키로 읽는다. 커리어는 사적 데이터라 그대로 두면 노출된다(대나무숲 평문 노출과 같은 계열). v1은 **앱 레벨 게이트**(리더/본인만 화면 노출)로 시작하되, **RLS(owner + 그 사람의 leaders 로 SELECT 제한)를 후속 필수**로 명시한다. (대나무숲처럼 운영자-불가독 암호화까지는 v1 범위 아님 — 리더 공유가 목적이라 E2E와 상충.)

## 컴포넌트 (파일)

### 웹 (dev)
- `src/growthStore.ts` — Supabase I/O(load/save, 3테이블), 낙관적 쓰기(remoteTable syncRows 패턴).
- `src/features/growth/GrowthCard.tsx` — 개인 화면(목표 CRUD + 진척, 역량 레벨 편집, 성장 곡선).
- `src/features/growth/TeamGrowth.tsx` — 리더 화면(팀원 카드 열람 + 코멘트/레벨 합의).
- `src/types.ts` — GrowthGoal / Competency / CompetencyLevel 타입.
- `src/growthRules.ts` (+ test) — 진척 클램프(0–100), 레벨 범위(1–5), 상태 전이 등 순수 규칙.
- 라우팅: 더보기/마이페이지 근처에 "내 성장", 리더 관리함 근처에 "팀 성장".
- `docs/sql/2026-08-15-growth-card.sql` — 3테이블 DDL(+RLS 초안).

### iOS (feature/ios-native, 후속)
- `Models/Growth.swift` + `GrowthStore`(Supabase.swift 재사용).
- `Features/Growth/GrowthView.swift`(개인), 리더 뷰는 LeaderView 탭 또는 별도.

## 에러 처리 / 엣지
- 진척 0–100, 레벨 1–5 밖 값은 클램프/거부(growthRules).
- 역량 세트에 없는 competency는 무시(스키마 드리프트 방어).
- Supabase 미설정(로컬)엔 시드/로컬 캐시로 동작(기존 스토어 패턴).
- 리더가 아닌 사용자가 팀 성장 뷰 접근 → 게이트로 차단(isLeader).

## 테스트
- `growthRules.test.ts`: 진척 클램프, 레벨 범위, 상태 전이, 역량 세트 검증, 성장 곡선 데이터 정렬.
- 통합(수동): 개인 목표 생성→진척→완료, 역량 자가레벨→리더 합의→로그 적재→곡선 표시, 비리더 접근 차단.

## 배포
1. SQL 적용(Supabase). 2. 웹 구현+테스트 → dev 병합 → 자동 배포. 3. iOS 포팅.

## 범위 밖 (후속)
- 역량 세트 팀 커스터마이즈, 동료 응원/엔도스(팀 공개), 학습·자격 트래킹, 팀 캘리브레이션, 포트폴리오/이력, RLS 강화(위 프라이버시 항목).
