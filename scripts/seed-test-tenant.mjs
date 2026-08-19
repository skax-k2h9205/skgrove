// 테넌트 격리 확인용 테스트 데이터 생성 — '테스트팀' 테넌트 + 임시 계정 몇 개.
// 이 계정으로 로그인하면 SK(tenant#1) 데이터가 안 보이고, 접수·안건·모임 등이 비어야 정상.
//
// 멱등: 테넌트(초대코드 TEST-01)·계정이 이미 있으면 재사용/스킵.
//
// 실행(오너, secret[service_role] 키 필요 — 공유/커밋 금지):
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<secret_key> \
//   node scripts/seed-test-tenant.mjs
//   node scripts/seed-test-tenant.mjs --clean   # 테스트팀+계정 정리(삭제)
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLEAN = process.argv.includes('--clean');
if (!URL || !KEY) {
  console.error('❌ SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const JOIN_CODE = 'TEST-01';
const TENANT_NAME = '테스트팀';
const PARTS = ['개발파트', '기획파트'];
const PASSWORD = 'test1234';
const TEST_USERS = [
  { email: 'test1@sk.com', name: '테스트유저1', part: '개발파트' },
  { email: 'test2@sk.com', name: '테스트유저2', part: '기획파트' },
];

// 계정 id 를 이메일로 예측 가능하게 — 재실행/정리에서 찾기 쉽게.
const accId = (email) => `USR-TEST-${email.split('@')[0].toUpperCase()}`;

async function findAuthUser(email) {
  const { data } = await admin.auth.admin.listUsers();
  return data?.users?.find((u) => (u.email || '').toLowerCase() === email) ?? null;
}

if (CLEAN) {
  console.log('🧹 테스트 데이터 정리…');
  for (const u of TEST_USERS) {
    const email = u.email.toLowerCase();
    const au = await findAuthUser(email);
    if (au) {
      await admin.auth.admin.deleteUser(au.id);
      console.log(`- Auth 삭제 ${email}`);
    }
    await admin.from('accounts').delete().eq('id', accId(email));
  }
  await admin.from('tenants').delete().eq('join_code', JOIN_CODE);
  console.log('완료 — 테스트팀·계정 삭제됨.');
  process.exit(0);
}

// 1) 테넌트 확보(있으면 재사용).
let { data: tenant } = await admin.from('tenants').select('*').eq('join_code', JOIN_CODE).maybeSingle();
if (!tenant) {
  const { data, error } = await admin
    .from('tenants')
    .insert({ name: TENANT_NAME, join_code: JOIN_CODE, parts: PARTS, active: true })
    .select()
    .single();
  if (error) {
    console.error('❌ 테넌트 생성 실패:', error.message);
    process.exit(1);
  }
  tenant = data;
  console.log(`✅ 테넌트 생성: ${TENANT_NAME} (${JOIN_CODE})  id=${tenant.id}`);
} else {
  console.log(`↺ 테넌트 재사용: ${tenant.name} (${JOIN_CODE})  id=${tenant.id}`);
}

// 2) 임시 계정(Auth + accounts) 생성.
for (const u of TEST_USERS) {
  const email = u.email.toLowerCase();
  let authUid;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.name, part: u.part, tenant_id: tenant.id },
  });
  if (cErr) {
    if (/registered|already/i.test(cErr.message)) {
      authUid = (await findAuthUser(email))?.id;
      console.log(`- (이미 있음) ${email}`);
    } else {
      console.log(`- ❌ Auth 실패 ${email}: ${cErr.message}`);
      continue;
    }
  } else {
    authUid = created.user.id;
    console.log(`- ✅ Auth 생성 ${email}`);
  }

  const { error: aErr } = await admin.from('accounts').upsert(
    {
      id: accId(email),
      name: u.name,
      email,
      role: '팀원',
      part: u.part,
      status: '활성',
      joined_at: new Date().toISOString().slice(0, 10),
      tenant_id: tenant.id,
      auth_uid: authUid ?? null,
      is_connectioner: false,
    },
    { onConflict: 'id' },
  );
  if (aErr) console.log(`   (accounts 실패: ${aErr.message})`);
  else console.log(`   accounts 연결 → 테스트팀`);
}

console.log(`\n완료. 로그인: 이메일 test1@sk.com / test2@sk.com · 비번 "${PASSWORD}"`);
console.log('이 계정으로 로그인하면 접수·안건·모임 등이 비어 있어야(SK 데이터 안 보임) 정상입니다.');
console.log('정리하려면: node scripts/seed-test-tenant.mjs --clean');
