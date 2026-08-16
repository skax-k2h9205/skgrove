// 기존 팀원 온보딩 부담 완화 — accounts 테이블의 기존 계정들을 Supabase Auth 사용자로
// 일괄 생성한다(임시 비밀번호). 이러면 팀원은 '가입' 없이 임시 비번으로 바로 로그인하고,
// 로그인 시 앱이 이메일로 기존 accounts 행을 매칭해 프로필·역할·테넌트가 그대로 유지된다.
//
// 멱등: 이미 Auth 에 있는 이메일은 건너뛴다. 생성 성공 시 accounts.auth_uid 를 채워
// RLS(Stage 2b)에서도 바로 인식되게 한다.
//
// 실행(오너, service_role 키 필요 — 절대 공유/커밋 금지):
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   TEMP_PASSWORD='skonnect2026!' \
//   node scripts/bulk-provision-auth.mjs            # 실제 실행
//   node scripts/bulk-provision-auth.mjs --dry      # 미리보기(생성 안 함)
//   ONLY_ACTIVE=1 node scripts/bulk-provision-auth.mjs   # '활성' 계정만
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEMP = process.env.TEMP_PASSWORD || 'skonnect2026!';
const DRY = process.argv.includes('--dry');
const ONLY_ACTIVE = process.env.ONLY_ACTIVE === '1';

if (!URL || !KEY) {
  console.error('❌ SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}
if (TEMP.length < 6) {
  console.error('❌ TEMP_PASSWORD 는 6자 이상이어야 합니다.');
  process.exit(1);
}

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) 기존 계정 읽기(service_role 이라 RLS 무시).
let query = admin.from('accounts').select('id,email,name,part,status,tenant_id,auth_uid');
if (ONLY_ACTIVE) query = query.eq('status', '활성');
const { data: accounts, error } = await query;
if (error) {
  console.error('❌ accounts 조회 실패:', error.message);
  process.exit(1);
}

console.log(`대상 계정 ${accounts.length}명 · 임시비번 "${TEMP}"${DRY ? ' · [DRY-RUN]' : ''}${ONLY_ACTIVE ? ' · 활성만' : ''}\n`);

const summary = { created: 0, existed: 0, linked: 0, skipped: 0, failed: 0 };

for (const a of accounts) {
  const email = (a.email || '').trim().toLowerCase();
  if (!email) {
    console.log(`- (건너뜀) 이메일 없음: ${a.name}`);
    summary.skipped++;
    continue;
  }
  if (DRY) {
    console.log(`- [dry] 생성 예정: ${email} (${a.name})`);
    summary.created++;
    continue;
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: TEMP,
    email_confirm: true, // 메일 인증 스킵 — 바로 로그인 가능
    user_metadata: { full_name: a.name, part: a.part, tenant_id: a.tenant_id },
  });

  let authUid = created?.user?.id;

  if (cErr) {
    // 이미 가입돼 있으면 건너뛴다(멱등). 그 외는 실패로 집계.
    if (/registered|already/i.test(cErr.message)) {
      console.log(`- (이미 있음) ${email}`);
      summary.existed++;
      // 이미 있는 사용자의 uid 를 찾아 accounts.auth_uid 보정(비어 있을 때만).
      if (!a.auth_uid) {
        const { data: list } = await admin.auth.admin.listUsers();
        authUid = list?.users?.find((u) => (u.email || '').toLowerCase() === email)?.id;
      } else {
        continue;
      }
    } else {
      console.log(`- ❌ 실패 ${email}: ${cErr.message}`);
      summary.failed++;
      continue;
    }
  } else {
    console.log(`- ✅ 생성 ${email}`);
    summary.created++;
  }

  // accounts.auth_uid 연결(비어 있고 uid 를 알 때만).
  if (authUid && !a.auth_uid) {
    const { error: uErr } = await admin.from('accounts').update({ auth_uid: authUid }).eq('id', a.id);
    if (uErr) console.log(`   (auth_uid 연결 실패: ${uErr.message})`);
    else summary.linked++;
  }
}

console.log(
  `\n완료 — 생성 ${summary.created} · 기존 ${summary.existed} · auth_uid연결 ${summary.linked} · 건너뜀 ${summary.skipped} · 실패 ${summary.failed}`,
);
if (!DRY) {
  console.log(`\n📣 팀 공지 예시:\n"SKonnection 로그인이 새로워졌어요. 본인 @sk.com 이메일 + 임시비번 '${TEMP}' 로 로그인 후, 마이페이지에서 비밀번호를 바꿔주세요."`);
}
