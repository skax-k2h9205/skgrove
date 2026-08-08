# 팀 공용 dev DB (Supabase) 연결 가이드

## 배경
다음 주 오픈 대비, 팀이 **같은 데이터**로 개발·통합·데모하기 위해 **공용 dev Supabase 프로젝트 하나**를 사용합니다.
각자 프로젝트나 localStorage로만 개발하면 데이터가 안 섞여 팀 기능(투표·알림·공유 보드 등) 통합 테스트가 안 됩니다.

> 앱은 **듀얼 모드**입니다. `.env.local`에 Supabase 값이 있으면 그 DB를, 없으면 브라우저 localStorage를 씁니다.

---

## (A) 최초 1회 — 프로젝트 소유자(김승현)만
1. supabase.com → **New project** (Free 플랜, 리전 Seoul/Tokyo), 이름 예: `skgrove-dev`
2. **SQL Editor** → `supabase-schema.sql` **전체 실행** (15개 테이블 생성, idempotent)
3. **Settings → API** → **Project URL** + **anon public key** 확보
4. (선택) 대시보드 관리가 필요한 사람은 **Settings → Team → Invite** 로 초대
5. **URL + anon key 를 팀 채널/DM으로 공유** — ⚠️ 레포엔 커밋하지 않음

---

## (B) 팀원 — 공용 dev에 연결
1. 최신 `dev` 브랜치 pull 후 `npm install`
2. 프로젝트 루트 `.env.local` 에 아래 추가 (숨김파일 — `code .env.local` 로 열기):
   ```bash
   VITE_SUPABASE_URL=<공유받은 URL>
   VITE_SUPABASE_ANON_KEY=<공유받은 anon key>
   ```
3. **연결 검증**:
   ```bash
   node scripts/verify-supabase.mjs
   ```
   → 15개 테이블 ✅ + humor_posts 쓰기/삭제 왕복 성공이 나오면 정상
4. `npm run dev` — env를 바꿨으니 **개발 서버 재시작 필수**

→ 이제 팀 전원이 같은 DB. 내가 올린 글/투표/알림이 서로에게 보입니다.

---

## 주의사항
- **`.env.local` 커밋 금지** (gitignore 대상). anon key는 프론트 공개 전제 키라 **팀 내부 공유는 OK, 팀 밖 유출 금지**.
- 공용 dev는 **RLS 개방(프로토타입)** 상태 — 누구나 전체 데이터 수정/삭제 가능.
  **실수로 전체 삭제 주의**, 진짜 개인정보/실데이터는 넣지 말 것(테스트 데이터만).
- **스키마 변경 시**: 레포의 `supabase-schema.sql` 을 소스로 수정 → 소유자가 공용 프로젝트에 반영 → 팀 공지. 각자 임의로 테이블 바꾸지 않기.

---

## 개인 실험만 하고 싶다면
`.env.local` 에 Supabase 값을 **안 넣으면 localStorage로 동작**(완전 격리). 혼자 UI/기능 실험엔 이걸로 충분합니다.

---

## 오픈(prod) 전 체크리스트 — 별도 작업
- [ ] **prod 프로젝트를 dev와 별도로** 생성 (dev ≠ prod, 실데이터 격리)
- [ ] **RLS를 인증 기반으로 강화** (지금은 전면 개방)
- [ ] **자동 백업** 확보 (무료는 백업 없음 → 필요 시 Pro)
- [ ] 프론트 배포 시 `VITE_SUPABASE_URL/ANON_KEY` 를 **prod 값**으로 주입
- [ ] (권장) 개인 계정 소유 → **팀 소유 org**로 이전
