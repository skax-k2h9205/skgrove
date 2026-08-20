# App Review 회신 — Guideline 1.2 (Safety: User-Generated Content)

Submission ID: 8b0b3b14-5285-4631-b14a-9e9c08a7f6ff
대상 빌드: **1.0.0 (28)** — 이 빌드에 아래 다섯 가지가 모두 들어 있습니다.
첨부: `appstore-1.2-demo.mp4` (약관 동의 → 신고 → 차단 → 차단 해제 순서로 시연)

---

## 영문 회신 (Resolution Center 붙여넣기용)

Thank you for the review. Build 28 implements all five requirements of Guideline 1.2.

**1. Terms of use (EULA) with zero tolerance, shown before account creation or sign-in**
On first launch the app presents a full-screen terms gate **before the login/registration
screen**. The user cannot reach any part of the app without explicitly accepting. The terms
state a zero-tolerance policy for objectionable content and for abusive users, and commit to
removing reported content and ejecting the author within 24 hours. Acceptance is recorded with
a version number, so an updated policy is re-presented.
Demo video: 0:00–0:30.

**2. A method for filtering objectionable content**
Every content-creation path (humor posts and comments, marketplace listings, gathering posts,
and the anonymous suggestion box) runs a profanity/abuse filter before submission. Content that
matches is rejected at submission time with an explanation, so it is never published.
The filter runs on-device, so it cannot be disabled by a network or server-side failure.

**3. A mechanism for users to flag objectionable content**
Every post and comment can be reported. The report action is available in two places:
a visible "•••" button in the top-right of every detail screen, and a long-press context menu
on every list tile. Reporting requires choosing a reason (abuse / sexual content / spam /
privacy / other) with an optional note, and the report is stored server-side for the operator.
Demo video: 0:30–2:30.

**4. A mechanism for users to block abusive users**
Any post or comment offers "Block <user>". Blocking immediately removes **all** content from
that user across every screen — home feed, stories, humor board, marketplace, and gatherings —
without waiting for any server round trip. Blocks are also recorded server-side so the
developer is notified. Blocked users can be reviewed and unblocked at
**More › Safety › Blocked people**.
Demo video: 2:30–5:00.

**5. Acting on reports within 24 hours**
Reports are written to a `content_reports` table with a `status` field (received / actioned /
dismissed) and `handled_at` / `handled_by` columns, so our operator reviews the queue and
removes the content and suspends the author within 24 hours. This commitment is stated both in
the terms gate and in the report confirmation screen.

The app is an internal team-communication tool for a single company; all accounts are
company email addresses.

Demo account: (App Store Connect의 "로그인 정보"에 등록된 계정 그대로 사용)

---

## 한국어 요약 (내부 확인용)

| Apple 요구사항 | 구현 | 영상 구간 |
|---|---|---|
| 가입·로그인 전 약관 동의(무관용 명시) | `TermsGateView` — 로그인 화면보다 앞. 버전 기록 | 0:00–0:30 |
| 콘텐츠 필터 | `ContentFilter` — 유머 글·댓글, 장터, 모임, 대나무숲 전 경로. 기기 내 동작 | (등록 시 거부) |
| 신고 | 상세 우상단 ⋯ + 목록 길게 누르기. 사유 선택 필수, 서버 기록 | 0:30–2:30 |
| 차단 | 즉시 전 화면에서 제거 + 서버 기록. 더보기 › 안전 › 차단한 사람에서 해제 | 2:30–5:00 |
| 24시간 내 조치 | `content_reports.status/handled_at/handled_by` 로 처리 추적 | 약관·신고 화면에 명시 |

**주의**: 영상에는 로그인 장면이 없습니다(이미 로그인된 상태에서 촬영). 약관 게이트가
로그인보다 앞이라는 점은 영상 첫 화면(앱 실행 직후 약관)으로 드러납니다. 심사자가 신규
설치로 확인하면 약관 → 로그인 순서를 그대로 보게 됩니다.
