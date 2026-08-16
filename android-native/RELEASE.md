# SKonnection Android — Play Console 출시 핸드오프

SK ITS 혁신팀 팀 문화 앱. iOS(App Store)·웹(Vercel)과 같은 Supabase 백엔드를 공유하는
Kotlin/Compose 네이티브 앱.

## 산출물
- **서명된 AAB**: `app/build/outputs/bundle/release/app-release.aab` (약 13MB, `jar verified`)
- 재빌드: `JAVA_HOME=<Android Studio JBR> ANDROID_HOME=<sdk> ./gradlew :app:bundleRelease`

## 앱 식별자
| 항목 | 값 |
|---|---|
| applicationId | `com.hyubs.skonnection` |
| versionName / versionCode | `1.0.0` / `1` |
| minSdk / targetSdk | 26 (Android 8.0) / 35 (Android 15) |
| 표시 이름 | SKonnection |

## 서명 (업로드 키)
- 키스토어: `/Users/mac_al03256439/.androidsigning/skonnection-upload.jks` (저장소 밖, **백업 필수**)
- 자격: `keystore.properties` (gitignore — 저장소에 없음). alias `skonnection`.
- Play App Signing 사용 권장: Google이 앱 서명 키를 관리하고, 이 키는 **업로드 키**로 등록.
  분실 시 Play Console에서 업로드 키 재설정 가능.

## 법적 페이지 (iOS와 공유 — 이미 게시됨)
| 필드 | URL |
|---|---|
| 개인정보처리방침 | https://hyub0216.github.io/app-legal-pages/skonnection/privacy.html |
| 지원 | https://hyub0216.github.io/app-legal-pages/skonnection/support.html |

## 스토어 그래픽 자산 (Play Console 업로드용)
| 자산 | 파일 | 규격 |
|---|---|---|
| 앱 아이콘(하이라이트) | `store/play-icon-512.png` | 512×512 PNG (iOS 앱 아이콘과 동일 브랜드) |
| 피처 그래픽 | `store/play-feature-graphic-1024x500.png` | 1024×500 PNG |
| 스크린샷 | `store/screenshots/` | 네이티브 1080×2400 8종(로그인·홈·성장·진단·조뽑기·마이페이지·시스템·커피게임) |

## 릴리스 규정 준수 감사 (통과)
- `targetSdk=35`(Play 최소 34 충족), `minSdk=26`.
- release 빌드에 `android:debuggable` 없음, `extractNativeLibs=false`, 네이티브 라이브러리 없음.
- 권한: `INTERNET`만(+androidx 자동 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`).
- `allowBackup=false`(로그인 세션 앱 — 기기 이전 시 stale 세션 유입 방지).
- adaptive 아이콘(background+foreground+monochrome). minSdk26이라 레거시 PNG 폴백 불필요.

## 스토어 등록 정보 (한국어)
- **앱 이름(30자)**: SKonnection — 팀을 잇는 곳
- **간단한 설명(80자)**: 대나무숲·안건투표·성장카드·조뽑기까지, 팀 문화를 한 곳에서. SK ITS 혁신팀 전용.
- **자세한 설명**: `store/play-listing.md` 참조
- **카테고리**: 비즈니스 (또는 생산성)
- **콘텐츠 등급 설문**: 폭력/성적 콘텐츠 없음 — 전체이용가 예상
- **데이터 보안(Data safety)**: 이름·이메일·사용자 콘텐츠 수집(계정/앱 기능 목적), 제3자 공유 없음,
  전송 중 암호화, 익명 대나무숲·실명 리더열람 글은 **단대단 암호화(E2E)**. (iOS App Privacy와 동일 취지)

## 데모 계정 (심사용)
- iOS 심사에 쓴 `appreview@sk.com` 재사용 가능(같은 Supabase). 로그인 화면에서 이메일+비번.

## 남은 일 = 사용자만 가능 (Google Play Console)
1. **개발자 계정** ($25 1회) 및 **앱 생성** (Play Console → 앱 만들기, 패키지 `com.hyubs.skonnection`).
2. **내부 테스트 트랙**에 `app-release.aab` 업로드 → 테스터 이메일 추가 → 링크 공유.
3. 스토어 등록정보·데이터 보안·콘텐츠 등급·법적 URL 입력(위 표 그대로).
4. (Slack 로그인 쓰려면) Supabase 대시보드 Auth → **Redirect URLs에 `skonnection://login-callback` 추가** + slack_oidc provider 활성화.
5. 프로덕션 승격은 내부 테스트 확인 후.

> 참고: iOS의 `testflight-deploy`처럼 자동 업로드하려면 Play Developer API **서비스 계정 JSON**이
> 필요합니다(현재 이 맥에 없음). 발급해 주시면 이후 업로드도 자동화할 수 있습니다.
