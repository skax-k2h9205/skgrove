# SKonnection 안드로이드 네이티브 앱 설계

- 작성일: 2026-08-08
- 상태: 승인됨(설계) → 구현 계획 대기
- 브랜치(예정): `feature/android-native`

## 1. 목표와 배경

SKonnection은 팀 문화 앱으로 세 갈래가 있다:
- **웹**: React + Vite + TypeScript, `connectioner.vercel.app`
- **iOS**: SwiftUI 네이티브 앱(`ios-native/`, 브랜치 `feature/ios-native`, Swift 50개 파일). 모든 웹 기능 반영, `URLSession` REST로 Supabase 연동.
- **백엔드**: Supabase(프로젝트 `sjymcpjbmsqapsptvlml`), anon key 공개, REST 접근.

이번 작업은 **안드로이드 네이티브 앱을 새로 구축**한다. Capacitor/웹 래핑이 아니라, iOS와 동일한 품질 기준("고수가 만든 앱")의 네이티브 앱을 만든다. iOS SwiftUI 앱이 사실상 완성된 설계도이므로 아키텍처를 새로 발명하지 않고 **이식(port)**에 가깝게 진행한다.

### 성공 기준
- 웹/iOS와 **같은 Supabase 백엔드**를 공유하여 데이터가 실시간으로 일치한다(백엔드 변경 0).
- 로그인 규칙이 웹/모바일과 동일하다(이메일 + 비밀번호, 첫 로그인 시 비밀번호 설정, PBKDF2 검증).
- 안드로이드 사용자에게 자연스러운 Material 3 UI(플랫폼 관례 준수).
- 각 마일스톤 끝에서 에뮬레이터 빌드·실행·검증이 가능하다.

## 2. 접근 방식 결정(확정)

| 결정 | 선택 | 비고 |
|---|---|---|
| 개발 방식 | **네이티브 Kotlin + Jetpack Compose** | Capacitor/TWA 아님. iOS 네이티브 결정과 일관 |
| 진행 방식 | **워킹 스켈레톤 → 단계별 확장** | 빅뱅 회피, 각 단계 검증 가능 |
| 디자인 언어 | **Material 3(안드로이드 네이티브) + 브랜드 컬러** | 웹/iOS와 세부 UI는 다를 수 있음 |

## 3. 아키텍처 & 기술 스택

각 iOS 구성요소에 가장 가까운 표준 Android 대응물을 고른다.

| 레이어 | iOS(현재) | 안드로이드(제안) | 이유 |
|---|---|---|---|
| UI | SwiftUI `View` | Jetpack **Compose** + **Material 3** | 선언형 1:1 대응 |
| 상태 | `ObservableObject` + `@Published` | **ViewModel** + `StateFlow` | 표준·수명주기 안전 |
| DI/주입 | 루트 `@StateObject` + `.environmentObject` | 수동 **AppContainer**(싱글턴 스토어) | iOS와 동일한 단순 패턴, Hilt는 오버킬 |
| 네트워크 | `URLSession` REST | **Ktor client** + `kotlinx.serialization` | `Codable` ↔ `@Serializable` 대응 |
| 영속화 | `UserDefaults`(Persist.swift) | **DataStore**(+ JSON) | 앱 재시작 시 캐시 복원 |
| 백엔드 | Supabase REST(anon key) | **동일 Supabase** 그대로 | 백엔드 작업 0 — 같은 테이블 공유 |

### 프로젝트 형상
- 위치: 리포 안 `android-native/` (iOS의 `ios-native/`와 대칭)
- 패키지: `com.hyubs.skonnection`
- minSdk 26(Android 8, 기기 커버리지 ~99%), targetSdk 최신(컴파일 시점 기준)
- 빌드: Gradle Kotlin DSL + 버전 카탈로그(`libs.versions.toml`)
- JDK: Android Studio 번들 JBR 사용(전역 JDK 미설치 대비)

### 모듈/패키지 구조(초안)
```
android-native/
  settings.gradle.kts, build.gradle.kts, gradle/libs.versions.toml
  app/
    build.gradle.kts
    src/main/AndroidManifest.xml
    src/main/java/com/hyubs/skonnection/
      SKonnectionApp.kt            // Application + AppContainer 생성
      AppContainer.kt              // 스토어 싱글턴 컨테이너(수동 DI)
      MainActivity.kt              // setContent { SkTheme { RootScreen() } }
      ui/theme/                    // Color/Type/Theme (Material 3, 브랜드)
      net/SupabaseClient.kt        // Ktor 공용 select/insert/patch/delete
      data/                        // 모델(@Serializable) + 스토어(ViewModel/StateFlow)
      feature/                     // 화면별 Composable + ViewModel (iOS Views 대응)
      core/Persist.kt              // DataStore 래퍼
```

## 4. 마일스톤

### M0 — 워킹 스켈레톤(첫 목표)
에뮬레이터에서 **실제 로그인 → 홈 렌더**까지.
1. Gradle 프로젝트 스캐폴드 + Material 3 브랜드 테마(라이트/다크)
2. `SupabaseClient`(Ktor): 공용 select/insert/patch/delete + anon key 헤더
3. 모델·스토어: `Account`(+세션), 로그인/첫 로그인(이메일+비밀번호, PBKDF2 검증) — 웹/모바일과 동일 규칙
4. `Scaffold` + 하단 네비 뼈대 + **홈 피드 1종**을 Supabase 실데이터로 렌더
5. 에뮬레이터 빌드·실행·스크린샷 검증

### M1 — 함께하기
모임·번개 / 팀추억 / 유머게시판 / 이음장터

### M2 — 말하고정하기
대나무숲 접수 / 리더 관리함 / 안건·투표 / 액션아이템 / 캔·티미팅

### M3 — 살펴보기·관리
파트지수·리포트 / 동료성향 / 알림·메시지 / 계정관리(삭제 권한 = admin@sk.com 전용, 웹과 동일)

### M4 — 마감
스플래시 · 햅틱 · 푸시(선택) · Play 내부 테스트 배포

각 마일스톤 종료 시: 에뮬레이터 검증 + 커밋.

## 5. 백엔드/데이터 계약(재사용)

- Supabase URL: `https://sjymcpjbmsqapsptvlml.supabase.co`
- anon key: 웹/iOS와 동일한 공개 anon JWT를 클라이언트에 내장(웹 번들·iOS `Supabase.swift`와 동일한 값).
- 테이블: `accounts`, `issues`, `agendas`, `agenda_ballots`, `action_items`, `gatherings`, `gathering_signups`, `market_items`, `market_bids`, `humor_posts`, `humor_comments`, `notifications`, `profiles`, `can_sessions`, `can_opinions`, `tea_sessions`, `memories`(웹/iOS 스토어와 동일) 등.
- 컬럼 매핑은 iOS 모델(`Account.swift` 등) 및 웹 store `*Row` 타입을 그대로 참조한다.
- 비밀번호: `pbkdf2$<iterations>$<saltB64>$<hashB64>` 형식(웹 `passwordHash.ts`와 동일). 안드로이드는 `javax.crypto`(PBKDF2WithHmacSHA256, 100,000회, 256bit)로 검증/생성.

## 6. 검증 전략

- 빌드/실행: Android Studio 번들 JBR + Gradle wrapper, Android SDK(`~/Library/Android/sdk`).
- 에뮬레이터(AVD)로 실행, 스크린샷/로그로 화면·데이터 확인. AVD가 없으면 생성한다.
- Supabase 실데이터 읽기/쓰기가 웹/iOS와 일치하는지 대조.
- 각 마일스톤 완료를 코드가 아니라 **동작 증거**(스크린샷/로그)로 확인.

## 7. 범위 밖(비목표)

- 백엔드 스키마 변경(공유 백엔드 그대로 사용).
- 크로스플랫폼 리라이트(React Native/Flutter/KMP) — 네이티브 유지.
- Play 스토어 정식 출시(초기에는 내부 테스트까지만 고려, M4 선택).

## 8. 위험과 완화

| 위험 | 완화 |
|---|---|
| 전역 JDK 미설치 | Android Studio 번들 JBR로 `JAVA_HOME` 지정 |
| 50개 화면 규모 | 워킹 스켈레톤 후 마일스톤 단위 이식, 각 단계 검증 |
| anon key 클라이언트 노출 | 웹/iOS와 동일한 기존 리스크 수준(공개 anon + RLS). 신규 위험 없음 |
| 웹/iOS와 데이터 규칙 불일치 | iOS 모델·웹 store row 타입을 단일 출처로 삼아 매핑 |
