# 비밀번호 보안 활성화 — 사람이 해야 할 2가지

코드는 배포돼 있지만, 아래 두 가지를 하기 전에는 **지금과 똑같이(안전장치 없이)** 동작합니다.
둘을 하는 순간부터 서버 인증이 켜지고 계정 탈취 구멍이 막힙니다.

## 1) Vercel 환경변수에 service_role 키 추가  ← 먼저
1. Supabase 대시보드 → Project Settings → API → **service_role** 키 복사 (secret, 절대 공유 금지)
2. Vercel → 해당 프로젝트 → Settings → Environment Variables
3. 이름 `SUPABASE_SERVICE_ROLE_KEY`, 값 붙여넣기, Production 체크 → Save
4. (선택) `SUPABASE_URL` = `https://sjymcpjbmsqapsptvlml.supabase.co` — 없어도 기본값으로 동작
5. 재배포(다음 push 때 자동 반영)

## 2) SQL 실행  ← 키를 넣은 뒤
`supabase-auth-security.sql` 을 Supabase SQL Editor 에 통째로 실행.
- must_change_password 컬럼 + 초기화 코드 테이블
- **anon 의 password_hash 쓰기 권한 회수(탈취 구멍 차단)**
- 기존 32계정을 "변경 필요"로 표시

## 순서가 중요합니다
키 없이 SQL만 돌리면: 비번 쓰기가 서버로만 가능한데 서버가 꺼져 있어 → 비번 변경/초기화가 안 됨(로그인은 됨).
그래서 **키 먼저, SQL 나중.**

## 확인
- 로그인 → 처음이면 "새 비밀번호를 정해 주세요" 강제 화면이 뜬다.
- 로그인 화면 "비밀번호를 잊으셨나요?" → 사내메일 → 슬랙 DM으로 6자리 인증번호 → 새 비번.
- anon 키로 password_hash PATCH 시도 → 이제 403(막힘).

## 아직 남은 것 (다음 단계)
iOS·안드로이드도 아직 클라이언트에서 로그인 검증을 한다(해시를 읽음). 지금은 읽기를 막지
않았으므로 네이티브 로그인은 그대로 동작한다. 세 앱이 전부 서버 로그인(api/auth)으로 옮겨간 뒤,
`REVOKE SELECT (password_hash)` 까지 하면 해시 자체도 안 보이게 된다.
