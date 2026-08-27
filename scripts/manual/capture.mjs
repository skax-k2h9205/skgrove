// SKonnection 매뉴얼용 화면 캡처. 배포된 웹앱을 권한별 계정으로 열어 사이드바
// 이동만으로 각 화면을 PNG로 남긴다. full:true 는 스크롤 전체 캡처,
// open:'버튼텍스트' 는 읽기 전용 하위 화면(폼 다음 단계·탭 전환 등, 데이터 미생성).
//
// 실행: node scripts/manual/capture.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.MANUAL_URL || 'https://skonnection.vercel.app';
const PW = process.env.MANUAL_PW || '486486';
const OUT = process.env.MANUAL_OUT || '/private/tmp/claude-503/-Users-a09253-other-projects-skgrove/586d0b59-1833-45b8-9c92-72fbe557652d/scratchpad/manual';

const PERSONAS = [
  {
    id: 'member',
    name: '박창헌',
    email: 'chang.p@sk.com',
    shots: [
      { key: 'dashboard', label: '홈' },
      { key: 'intake', label: '대나무숲 접수' },
      { key: 'intake_write', label: '대나무숲 접수', open: '내용 작성하기' },
      { key: 'agenda', label: '안건함 / 투표' },
      { key: 'actions', label: '액션아이템' },
      { key: 'meetings', label: '캔미팅 / 티미팅' },
      { key: 'gatherings', label: '모임 · 번개' },
      { key: 'profiles', label: '동료 성향' },
      { key: 'memory', label: '팀 추억' },
      { key: 'memory_calendar', label: '팀 추억', open: '캘린더' },
      { key: 'humor', label: '유~머게시판' },
      { key: 'market', label: '이음장터' },
      { key: 'notifications', label: '알림 / 메시지' },
    ],
  },
  {
    id: 'connectioner',
    name: '이선민',
    email: 'sunmin.l@sk.com',
    shots: [
      { key: 'system', label: '시스템 관리' },
      { key: 'accounts', label: '계정 관리' },
      { key: 'connect', label: '조뽑기' },
      { key: 'metrics', label: '파트지수 / 리포트' },
    ],
  },
  {
    id: 'leader',
    name: '심상준',
    email: 'simair@sk.com',
    shots: [{ key: 'leader', label: '리더 관리함' }],
  },
];

async function login(page, name, email) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login-panel', { timeout: 30000 });
  const panel = page.locator('.login-panel');
  await panel.locator('input').first().fill(name);
  await panel.locator('input[type="email"]').fill(email);
  await panel.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForSelector('.nav-item', { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function shoot(page, dir, spec) {
  await page.locator('.nav-item', { hasText: spec.label }).first().click();
  await page.waitForTimeout(1600);
  if (spec.open) {
    await page.getByRole('button', { name: spec.open }).first().click().catch(() => {});
    await page.waitForTimeout(1400);
  }
  // 스크롤 전체 캡처 전 맨 위로.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${dir}/${spec.key}.jpg`, type: 'jpeg', quality: 82, fullPage: !!spec.full });
  console.log('  ✔', dir, spec.key, spec.full ? '(full)' : '', spec.open ? `· ${spec.open}` : '');
}

async function main() {
  for (const p of ['common', 'member', 'connectioner', 'leader']) {
    await mkdir(`${OUT}/${p}`, { recursive: true });
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login-panel', { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/common/login.jpg`, type: 'jpeg', quality: 82 });
  console.log('✔ common login');

  for (const persona of PERSONAS) {
    console.log('· 로그인:', persona.name, `(${persona.id})`);
    await login(page, persona.name, persona.email);
    for (const spec of persona.shots) {
      try {
        await shoot(page, persona.id, spec);
      } catch (err) {
        console.log('  ✗', persona.id, spec.key, '—', String(err).split('\n')[0]);
      }
    }
  }

  await browser.close();
  console.log('완료. 출력:', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
