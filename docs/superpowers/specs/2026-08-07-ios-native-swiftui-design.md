# SKonnection 네이티브 iOS (SwiftUI) — 설계 & 로드맵

작성일: 2026-08-07 · 브랜치: `feature/ios-native` (dev 분기)

## 배경 / 결정

Capacitor 래핑(웹뷰)은 "네이티브 감각이 없다"는 판단으로 접었다(작업은 `feature/ios-testflight`에 보존). **SwiftUI 네이티브 앱**으로 전체 기능을 다시 짓는다. 시간이 걸려도 퀄리티 우선. iOS 전용.

## 공유 vs 재작성

| 계층 | 전략 |
|---|---|
| 백엔드 (`connectioner.vercel.app/api/*`, Supabase, DB) | **공유** — 웹·앱 동일 |
| 순수 로직 (agendaRules·actionRules·humorRules …) | Swift 로 이식 |
| UI | SwiftUI 로 신규 작성 (웹 CSS 재사용 안 함) |

웹앱(`connectioner`)은 그대로 유지된다. 앱은 같은 백엔드를 쓰는 별도 프론트엔드.

## 아키텍처

- **SwiftUI + MVVM**, iOS 17+, XcodeGen(`project.yml`), 팀 `S9F62N3WJA`, `com.hyubs.skonnection`, Portrait
- **디자인 시스템** `Theme.swift` — 웹 :root 토큰(색·간격·모서리) 이식. 브랜드 `#006BB8`.
- **세션** `SessionStore` — UserDefaults, 14일 만료(웹 session.ts 규약)
- **네트워킹** `APIClient` — 프로덕션 `/api/*` 절대경로 호출(네이티브라 CORS 무관)
- **데이터** Supabase Swift SDK (Phase 1에서 추가) — 인증·영속화
- **네비게이션** 네이티브 `TabView` (홈·대나무숲·안건/투표·액션·더보기) + `NavigationStack`

## 단계 로드맵

- **Phase 0 — 토대 ✅(이 세션)**: XcodeGen 프로젝트, 디자인 토큰, 세션, APIClient, 네이티브 로그인, 탭 셸 + 플레이스홀더. 시뮬레이터 빌드·실행 확인(18s). 앱 아이콘(HeartHandshake) 적용.
- **Phase 1 — 인증·데이터 토대**: Supabase SDK 연동, 실제 로그인(시드 계정·비번), 데이터 모델·리포지토리, 홈 피드 실구현.
- **Phase 2 — 핵심 루프**: 대나무숲 접수 → 안건/투표 → 액션아이템 (READMEの 중심 흐름). 규칙 모듈 Swift 이식.
- **Phase 3 — 나머지**: 리더관리함·유머·성향(3기둥)·모임·조뽑기·팀추억·파트지수·마켓·알림·회의.
- **Phase 4 — 네이티브 마감**: 햅틱, 네이티브 공유 시트, 기기 캘린더(EventKit) 연동, 푸시(선택), 다크모드, 접근성.
- **Phase 5 — 출시**: TestFlight(testflight-deploy 스킬), App Store Connect 앱 레코드(사용자), 스크린샷·메타데이터.

## Phase 0 산출물 (이 세션)

`ios-native/`:
- `project.yml`, `Sources/SKonnection/` (Info.plist, SKonnectionApp, Theme, Models, SessionStore, APIClient, LoginView, RootView, Assets)
- 빌드 성공(18s)·시뮬레이터 실행·네이티브 로그인 렌더 확인.

## 알려진 TODO / 리스크

- **브랜드 마크**: 인앱은 SF Symbol `heart.fill` 근사. 정확한 heart-handshake 글리프를 SwiftUI Path/에셋으로 교체 예정(앱 아이콘은 정확한 글리프 사용).
- **로그인**: Phase 0는 클라이언트 검증만. Supabase 실인증은 Phase 1.
- **시뮬레이터 입력 자동화**: 한글 IME·SwiftUI TextField 하드웨어 입력이 자동화로 잘 안 들어감 → 로그인 후 흐름은 실기기/수동 확인 권장.
- **규모**: 전체 완성은 여러 세션. 단계별 커밋·검증으로 진행.
