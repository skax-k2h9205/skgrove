// 상세(친절) 매뉴얼 — 화면 위에 번호 마커를 얹어 버튼/흐름을 짚어준다.
// 캡처하며 각 대상 버튼의 좌표를 수집(boundingBox) → 그 %위치에 ①②③ 오버레이.
// 데이터 미변경(제출 버튼은 짚기만 하고 누르지 않음). 캡처+빌드를 한 번에 실행.
//
// 실행: node scripts/manual/detailed.mjs
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// 인앱 가이드(스크린용 HTML)를 앱 정적 자산으로 내보낸다 — /guides/{member,operator}.html
const GUIDE_OUT = process.env.MANUAL_GUIDE_OUT || `${REPO}/public/guides`;

const URL = process.env.MANUAL_URL || 'https://skonnection.vercel.app';
// 계정별 자격증명은 환경변수로만 받는다(스크립트에 비번을 남기지 않음).
//   MANUAL_CREDS='email1:pw1,email2:pw2'
const CREDS = Object.fromEntries(
  (process.env.MANUAL_CREDS || '').split(',').filter(Boolean).map((pair) => {
    const i = pair.indexOf(':');
    return [pair.slice(0, i).trim().toLowerCase(), pair.slice(i + 1)];
  }),
);
const OUT = process.env.MANUAL_OUT || '/private/tmp/claude-503/-Users-a09253-other-projects-skgrove/586d0b59-1833-45b8-9c92-72fbe557652d/scratchpad/manual';
const DATE = process.env.MANUAL_DATE || '2026-08-07';
const VW = 1440, VH = 1024;

// ── 대상(버튼) 위치를 찾는 로케이터 ──
function loc(page, t) {
  if (t.button) return page.getByRole('button', { name: t.button, exact: false }).first();
  if (t.labelText) return page.locator('label', { hasText: t.labelText }).locator('select, input, textarea').first();
  if (t.choice != null) return page.locator('.choice-card').nth(t.choice);
  if (t.css) return page.locator(t.css).nth(t.nth || 0);
  return null;
}

async function collect(page, targets) {
  const callouts = [];
  // boundingBox 는 문서 기준 좌표라, 스크롤된 화면에선 뷰포트 기준으로 보정한다.
  const sx = await page.evaluate(() => window.scrollX);
  const sy = await page.evaluate(() => window.scrollY);
  let n = 0;
  for (const t of targets) {
    try {
      const el = loc(page, t);
      const box = await el.boundingBox({ timeout: 800 });
      if (!box) continue;
      const bx0 = box.x - sx;
      const by0 = box.y - sy;
      const cx = bx0 + box.width / 2;
      const cy = by0 + box.height / 2;
      if (cx < 0 || cx > VW || cy < 0 || cy > VH) continue; // 뷰포트 밖(스크롤 필요) 제외
      // 요소 둘레에 살짝 여백을 준 네모박스 + 번호뱃지를 얹는다(동작 단위 강조).
      const pad = 5;
      const x1 = Math.max(2, bx0 - pad);
      const y1 = Math.max(2, by0 - pad);
      const x2 = Math.min(VW - 2, bx0 + box.width + pad);
      const y2 = Math.min(VH - 2, by0 + box.height + pad);
      n += 1;
      callouts.push({
        n,
        bx: +(x1 / VW * 100).toFixed(2), by: +(y1 / VH * 100).toFixed(2),
        bw: +((x2 - x1) / VW * 100).toFixed(2), bh: +((y2 - y1) / VH * 100).toFixed(2),
        label: t.label,
      });
    } catch {
      /* 못 찾으면 건너뜀 */
    }
  }
  return callouts;
}

// ── 액션 러너: 캡처 지점에 도달하기 위한 '안전한' 조작만 수행(클릭/입력/선택/스크롤). ──
// 데이터를 쓰는 버튼(제출/등록/신청/열람/저장 등)은 절대 여기에 넣지 않는다 — 박스로 짚기만 한다.
function fieldLoc(page, f) {
  if (typeof f === 'string') return page.locator(f).first();
  if (f.label) return page.locator('label', { hasText: f.label }).locator('select, input, textarea').first();
  if (f.placeholder) return page.getByPlaceholder(f.placeholder).first();
  if (f.css) return page.locator(f.css).nth(f.nth || 0);
  return page.locator(String(f)).first();
}
async function runActions(page, actions = []) {
  for (const a of actions) {
    try {
      if (a.tab) {
        const t = page.getByRole('tab', { name: a.tab }).first();
        if (await t.count()) await t.click(); else await page.getByRole('button', { name: a.tab }).first().click();
      } else if (a.card != null) {
        await page.locator('.choice-card', { hasText: a.card }).first().click();
      } else if (a.click) {
        await page.getByRole('button', { name: a.click, exact: a.exact ?? false }).first().click();
      } else if (a.clickCss) {
        await page.locator(a.clickCss).nth(a.nth || 0).click();
      } else if (a.fill) {
        await fieldLoc(page, a.fill).fill(a.value ?? '');
      } else if (a.select) {
        await fieldLoc(page, a.select).selectOption(a.value);
      } else if (a.scrollTo != null) {
        await page.evaluate((y) => window.scrollTo(0, y), a.scrollTo);
      }
    } catch (e) {
      console.log('      · 액션 스킵:', JSON.stringify(a), '—', String(e).split('\n')[0]);
    }
    await page.waitForTimeout(a.wait || 800);
  }
}
// 한 번 진입한 화면에서 여러 캡처 지점을 순차로 촬영(상태가 누적됨).
async function captureFlow(page, step) {
  if (step.nav) {
    const nav = page.locator('.nav-item', { hasText: step.nav });
    if (await nav.count() === 0) throw new Error(`메뉴 없음: ${step.nav}`);
    await nav.first().click();
    await page.waitForTimeout(1500);
  }
  const sections = [];
  for (const cp of step.sequence) {
    await runActions(page, cp.actions || []);
    if (!cp.scroll) await page.evaluate(() => window.scrollTo(0, 0));
    const shot = await page.screenshot({ type: 'jpeg', quality: 82 });
    const callouts = await collect(page, cp.targets || []);
    sections.push({ title: cp.title, desc: cp.desc, _img: `data:image/jpeg;base64,${shot.toString('base64')}`, _callouts: callouts });
    console.log('    ▸', cp.title, `— 마커 ${callouts.length}개`);
  }
  return sections;
}

const MEMBER = {
  file: 'SKonnection_팀원_상세안내.pdf', title: '팀원용 상세 안내', subtitle: '버튼·흐름을 짚어주는 안내',
  accent: '#006bb8', accent2: '#2a8fd4',
  intro: '자주 쓰는 흐름을 화면 위 번호로 짚어드립니다. 번호 설명을 따라가면 됩니다.',
  login: { email: 'k2h9205@sk.com' },
  steps: [
    { key: 'login', title: '로그인', common: true, desc: '사내메일(@sk.com)과 비밀번호로 로그인합니다. 계정이 없으면 "가입"에서 팀 초대코드로 가입하세요. 비밀번호를 잊었다면 "비밀번호를 잊으셨나요?"로 재설정합니다.',
      targets: [
        { css: '.login-panel input[type="email"]', label: '사내메일(@sk.com)' },
        { css: '.login-panel input[type="password"]', label: '비밀번호' },
        { button: '로그인', label: '로그인' },
        { button: '가입', label: '계정이 없으면 가입(팀 초대코드 필요)' },
      ] },
    { key: 'dashboard', title: '홈', nav: '홈', desc: '팀 활동 요약과 자주 가는 곳으로 이동하는 시작 화면입니다.', targets: [] },
    { key: 'intake', nav: '대나무숲 접수', sequence: [
      { title: '대나무숲 접수 ① 방식 선택', desc: '익명/실명과 전달 대상·공개 범위를 고릅니다. (예시는 실명 · 공개 가능 경로)',
        actions: [{ tab: '말하기' }, { card: '실명' }, { select: { label: '공개 범위' }, value: '안건 후보로 공개 가능' }],
        targets: [
          { css: '.choice-card', nth: 0, label: '익명 / 실명 선택' },
          { labelText: '전달 대상', label: '전달 대상(리더) 고르기 — 특정 파트리더도 지정 가능' },
          { labelText: '공개 범위', label: '공개 범위 설정' },
          { button: '내용 작성하기', label: '눌러서 내용 작성 단계로' },
        ] },
      { title: '대나무숲 접수 ② 내용 작성', desc: '제목과 내용을 적습니다(필수). 카테고리·긴급도·기대 변화도 정할 수 있어요.',
        actions: [
          { click: '내용 작성하기' },
          { fill: { css: '.ig-create-main textarea' }, value: '(예시) 매주 회의가 길어 집중이 어려워요. 30분으로 줄이면 좋겠습니다.' },
          { fill: { placeholder: '팀 티미팅' }, value: '(예시) 팀 티미팅 시간을 줄이고 싶어요' },
        ],
        targets: [
          { css: '.ig-create-main textarea', label: '내용(필수)' },
          { css: '.ig-create-side input', nth: 0, label: '제목(필수)' },
          { labelText: '카테고리', label: '카테고리 선택' },
          { button: '제출 전 확인', label: '제출 전 확인 단계로' },
        ] },
      { title: '대나무숲 접수 ③ 제출 확인', desc: '입력 내용을 확인하고 접수합니다. "접수하기"를 누르면 완료 화면에서 익명은 확인 코드가 발급돼요.',
        actions: [{ click: '제출 전 확인' }],
        targets: [
          { css: '.review-flags', nth: 0, label: '익명/공개 설정 확인' },
          { button: '수정하기', label: '수정하기(내용 단계로)' },
          { button: '접수하기', label: '접수하기 — 누르면 제출·접수 완료' },
        ] },
    ] },
    { key: 'agenda', title: '안건함 / 투표', nav: '안건함 / 투표', desc: '열린 안건에 마감 전 투표합니다. 투표는 익명으로 집계돼요.',
      targets: [
        { css: 'main article', nth: 0, label: '안건 카드 — 제목·설명 확인' },
        { button: '찬성', label: '찬성 / 반대(또는 선택지)로 투표' },
      ] },
    { key: 'actions', title: '액션아이템', nav: '액션아이템', desc: '안건·캔미팅에서 정해진 후속 조치(할 일)를 관리합니다.',
      targets: [
        { css: 'main article', nth: 0, label: '액션 카드 — 담당·기한 확인' },
        { css: 'main select', nth: 0, label: '상태 변경(진행/완료)' },
      ] },
    { key: 'meetings', title: '캔미팅 / 티미팅', nav: '캔미팅 / 티미팅', desc: '회고·주제 수집(캔미팅)과 티타임 세션(티미팅)에 참여합니다.',
      targets: [{ css: '.segmented button, .ig-tabs button', nth: 0, label: '캔미팅 / 티미팅 전환' }] },
    { key: 'gatherings', nav: '모임 · 번개', sequence: [
      { title: '모임 · 번개 — 목록', desc: '열린 모임을 둘러봅니다. 카드를 누르면 상세로 들어가요.',
        actions: [{ click: '전체', exact: true }],
        targets: [
          { css: '.poster-cell', nth: 0, label: '모임 카드 — 눌러서 상세로' },
          { button: '모임 열기', label: '새 모임 열기' },
        ] },
      { title: '모임 · 번개 — 상세 · 신청', desc: '시간·장소·정원을 확인하고 신청합니다. 정원이 차면 대기로 잡혀요. (신청은 한 번 누르면 바로 접수됩니다)',
        actions: [{ click: '전체', exact: true }, { clickCss: '.poster-cell', nth: 0 }],
        targets: [
          { css: '.gathering-facts', nth: 0, label: '언제·어디서·인원 확인' },
          { button: '신청', label: '신청하기 / 대기 걸기(누르면 바로 접수)' },
          { css: '.back-link', nth: 0, label: '목록으로' },
        ] },
    ] },
    { key: 'profiles', title: '동료 성향', nav: '동료 성향', desc: '동료의 일하는 방식·협업 성향을 카드로 봅니다. 내 성향은 마이페이지에서 관리해요.', targets: [] },
    { key: 'memory', nav: '팀 추억', sequence: [
      { title: '팀 추억 — 앨범 목록', desc: '게시물 탭에서 행사 앨범을 봅니다. 캘린더 탭에서 새 행사를 만들 수 있어요.',
        targets: [
          { css: '.ig-tabs button', nth: 0, label: '게시물 / 캘린더 탭 전환' },
          { css: '.ig-cell', nth: 0, label: '앨범 — 눌러서 열기' },
        ] },
      { title: '팀 추억 — 사진 올리기', desc: '앨범 안에서 "사진/동영상 선택"으로 여러 장을 한 번에 올립니다. 파일을 고르면 바로 업로드돼요.',
        actions: [{ clickCss: '.ig-cell.memory-album-cell', nth: 0 }],
        targets: [
          { css: '.memory-file-drop', nth: 0, label: '사진/동영상 선택(고르면 즉시 업로드)' },
          { css: '.memory-detail-actions button', nth: 0, label: '행사명 수정' },
          { css: '.memory-back', nth: 0, label: '앨범 목록으로' },
        ] },
    ] },
    { key: 'humor', title: '유~머게시판', nav: '유~머게시판', desc: '가볍게 웃을 글을 올리고 반응·댓글로 소통합니다. 내 글은 수정·삭제할 수 있어요.',
      targets: [{ button: '글쓰기', label: '글 작성' }] },
    { key: 'market', nav: '이음장터', sequence: [
      { title: '이음장터 — 목록', desc: '팀 안에서 나눔하거나 경매로 물건을 주고받습니다.',
        targets: [
          { button: '물건 내놓기', label: '물건 등록(나눔/경매)' },
          { css: 'main article', nth: 0, label: '물건 카드 — 신청/입찰' },
        ] },
      { title: '이음장터 — 물건 등록', desc: '경매/나눔을 고르고 이름·장소·마감을 정합니다. (등록 버튼을 누르기 전까지는 저장되지 않아요)',
        actions: [
          { click: '물건 내놓기' },
          { fill: { placeholder: '기계식' }, value: '(예시) 기계식 키보드' },
          { fill: { placeholder: '라운지' }, value: '9층 라운지' },
        ],
        targets: [
          { css: '.choice-row .choice-card', nth: 0, label: '경매 / 나눔 선택' },
          { css: 'main .field input', nth: 0, label: '무엇을 내놓나요' },
          { css: '.chip-row .chip', nth: 0, label: '마감 시간' },
          { button: '경매 시작', label: '등록 — 누르면 저장' },
        ] },
    ] },
    { key: 'metrics', title: '파트지수 / 리포트', nav: '파트지수 / 리포트', desc: '회의 건강도 등 파트 지표를 보는 리포트 화면입니다.', targets: [] },
    { key: 'notifications', title: '알림 / 메시지', nav: '알림 / 메시지', desc: '나에게 온 알림과 개인 메시지를 확인합니다.',
      targets: [{ css: '.segmented button', nth: 0, label: '읽음 / 안읽음 전환' }] },
  ],
};

const OPERATOR = {
  file: 'SKonnection_운영자_상세안내.pdf', title: '운영자용 상세 안내', subtitle: '리더·커넥셔너 · 버튼/흐름 안내',
  accent: '#0a4d8c', accent2: '#1f7a52',
  intro: '관리 화면의 주요 버튼을 화면 위 번호로 짚어드립니다.',
  steps: [
    { key: 'leader', login: { email: 'sunmin.l@sk.com' }, nav: '리더 관리함', sequence: [
      { title: '리더 관리함 — 접수 목록', desc: '내가 전달 대상인 접수만 보입니다. 상단 배너로 암호화 키 상태를 확인하고, 건을 골라 처리해요.',
        targets: [
          { css: '.leader-toolbar .filter', nth: 0, label: '상태 필터' },
          { css: '.issue-card', nth: 0, label: '접수 카드 — 눌러서 열람' },
          { css: '.issue-actions select', nth: 0, label: '건별 상태 변경' },
        ] },
      { title: '리더 관리함 — 암호화 접수 열람', desc: '암호화 접수는 대상 리더 본인만 비밀번호로 잠금을 해제할 수 있어요. (관리자·서버·개발자도 못 봄) 비밀번호를 잊으면 복구코드로 엽니다.',
        actions: [{ clickCss: '.issue-card button.issue-select', nth: 0 }],
        targets: [
          { css: '.issue-body-box strong', nth: 0, label: '암호화 접수 표시' },
          { css: '.issue-body-box input', nth: 0, label: '비밀번호 입력' },
          { button: '열람', label: '열람(복호화)' },
          { button: '복구코드로 열기', label: '비밀번호 분실 시 복구코드' },
        ] },
      { title: '리더 관리함 — 정제 후 안건화', desc: '접수를 다듬어 찬반/객관식 안건 후보로 만듭니다. 익명 접수는 익명화된 채로 공개돼요.',
        actions: [{ clickCss: '.leader-action-tabs button', nth: 2 }],
        targets: [
          { css: '.agenda-refine-form input', nth: 0, label: '안건 제목' },
          { css: '.agenda-refine-form textarea', nth: 0, label: '안건 설명' },
          { css: '.intake-choice-grid', nth: 0, label: '투표 방식(찬반/객관식)' },
          { css: '.agenda-publish-preview', nth: 0, label: '공개될 내용 미리보기' },
        ] },
    ] },
    { key: 'connect', login: { name: '이선민', email: 'sunmin.l@sk.com' }, title: '조뽑기 (커넥셔너 도구)', nav: '조뽑기',
      desc: '팀을 무작위로 섞어 조를 나누는 커넥셔너 전용 도구입니다.',
      targets: [
        { css: 'main select', nth: 0, label: '섞기 조건' },
        { button: '조 쉬기 시작', label: '조 뽑기 실행' },
      ] },
    { key: 'metrics', login: { name: '이선민', email: 'sunmin.l@sk.com' }, title: '파트지수 / 리포트', nav: '파트지수 / 리포트',
      desc: '회의 건강도 등 파트 지표를 보는 리포트 화면입니다.', targets: [] },
    { key: 'accounts', login: { email: 'sunmin.l@sk.com' }, title: '계정 관리', nav: '계정 관리',
      desc: '가입 승인·권한·파트·커넥셔너·슬랙 이메일을 관리합니다. 각 행에서 값을 바꾸면 즉시 반영돼요.',
      targets: [
        { css: 'select[aria-label$="권한"]', nth: 0, label: '권한(팀원/파트리더/팀리더)' },
        { css: 'select[aria-label$="계정 상태"]', nth: 0, label: '상태(승인 대기 → 활성)' },
        { css: '.account-slack-email', nth: 0, label: '슬랙 이메일' },
        { css: '.connectioner-toggle', nth: 0, label: '커넥셔너 지정(전권) — 꼭 필요한 사람만' },
      ] },
    { key: 'system', login: { email: 'sunmin.l@sk.com' }, nav: '시스템 관리', sequence: [
      { title: '시스템 관리 — 알림 발송', desc: '슬랙 알림을 화면에서 제어합니다. 값을 바꾸면 저장 즉시 팀 전체에 적용돼요.',
        targets: [
          { css: '.system-toggle-row', nth: 0, label: '슬랙 알림 전체 on/off' },
          { css: '.system-toggle-row', nth: 1, label: '개인 DM 발송 on/off' },
          { css: '.form-grid', nth: 0, label: '슬랙 채널 ID(비우면 기본값)' },
        ] },
      { title: '시스템 관리 — 알림 종류별 발송 위치', desc: '알림 종류마다 어디로 보낼지(팀 채널 / 커넥셔너 채널 / 개인 DM / 끔) 정합니다.',
        actions: [{ scrollTo: 760 }], scroll: true,
        targets: [
          { css: '.system-route-row', nth: 0, label: '알림 종류 · 시점' },
          { css: '.system-route-row select', nth: 0, label: '발송 위치 선택' },
        ] },
    ] },
  ],
};

async function login(page, email) {
  const pw = CREDS[email.toLowerCase()];
  if (!pw) throw new Error(`자격증명 없음: ${email} — MANUAL_CREDS 에 넣어주세요`);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // 이전 계정 세션을 정리해야 로그인 화면이 다시 뜬다(Supabase 세션은 localStorage 에 남음).
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
      await page.context().clearCookies();
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.login-panel', { timeout: 30000 });
      const panel = page.locator('.login-panel');
      await panel.locator('input[type="email"]').fill(email);
      await panel.locator('input[type="password"]').fill(pw);
      await page.getByRole('button', { name: '로그인', exact: true }).click();
      await page.waitForSelector('.nav-item', { timeout: 25000 });
      await page.waitForTimeout(1500);
      const navs = await page.locator('.nav-item').allInnerTexts();
      console.log(`    · ${email} 메뉴: ${navs.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ')}`);
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      await page.waitForTimeout(2000);
    }
  }
}

async function captureStep(page, step) {
  if (step.nav) {
    const nav = page.locator('.nav-item', { hasText: step.nav });
    if (await nav.count() === 0) throw new Error(`메뉴 없음: ${step.nav}`);
    await nav.first().click();
    await page.waitForTimeout(1500);
  }
  if (step.opens) for (const b of step.opens) { await page.getByRole('button', { name: b }).first().click().catch(() => {}); await page.waitForTimeout(1200); }
  await page.evaluate(() => window.scrollTo(0, 0));
  const shot = await page.screenshot({ type: 'jpeg', quality: 82 });
  const callouts = await collect(page, step.targets);
  return { img: `data:image/jpeg;base64,${shot.toString('base64')}`, callouts };
}

function stepHtml(s, index) {
  const markers = s._callouts.map((c) => `<span class="box" style="left:${c.bx}%;top:${c.by}%;width:${c.bw}%;height:${c.bh}%"><b class="badge">${c.n}</b></span>`).join('');
  const legend = s._callouts.map((c) => `<li><span class="ln">${c.n}</span>${c.label}</li>`).join('');
  return `
    <section class="screen">
      <div class="sec-head"><span class="num">${String(index).padStart(2, '0')}</span><h2>${s.title}</h2></div>
      <p class="lead">${s.desc}</p>
      <div class="anno">
        <div class="chrome"><i class="dot r"></i><i class="dot y"></i><i class="dot g"></i></div>
        <div class="imgwrap"><div class="imgclip"><img src="${s._img}"/></div>${markers}</div>
      </div>
      ${legend ? `<ol class="legend">${legend}</ol>` : ''}
    </section>`;
}

function docHtml(m) {
  const steps = (m._sections || []).filter((s) => s._img); // 캡처된 화면만(순서대로; 다단계는 펼쳐짐)
  const body = steps.map((s, i) => stepHtml(s, i + 1)).join('');
  const toc = steps.map((s, i) => `<li><span class="tnum">${String(i + 1).padStart(2, '0')}</span><span class="tt">${s.title}</span></li>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><style>
    * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body { font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; color:#182234; margin:0; }
    .cover { position:relative; height:284mm; overflow:hidden; color:#fff; background:linear-gradient(150deg, ${m.accent} 0%, ${m.accent2} 100%); page-break-after:always; }
    .cover .blob { position:absolute; border-radius:50%; background:rgba(255,255,255,.10); }
    .cover .b1 { width:520px; height:520px; right:-160px; top:-160px; } .cover .b2 { width:360px; height:360px; left:-120px; bottom:-120px; background:rgba(255,255,255,.08); }
    .cover .inner { position:relative; padding:66px 60px; height:100%; display:flex; flex-direction:column; }
    .cover .brand { display:flex; align-items:center; gap:13px; }
    .cover .logo { width:48px; height:48px; border-radius:14px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.45); display:flex; align-items:center; justify-content:center; }
    .cover .logo svg { width:27px; height:27px; display:block; }
    .cover .brand b { font-size:19px; } .cover .brand span { display:block; font-size:12px; opacity:.85; }
    .cover .mid { margin-top:auto; }
    .cover h1 { font-size:52px; line-height:1.06; margin:0 0 16px; letter-spacing:-1px; }
    .cover .sub { font-size:18px; opacity:.92; margin:0 0 24px; }
    .cover .rule { width:64px; height:4px; background:rgba(255,255,255,.9); border-radius:3px; margin:0 0 22px; }
    .cover .intro { font-size:14px; line-height:1.75; max-width:520px; opacity:.92; }
    .cover .foot { margin-top:32px; } .cover .pill { display:inline-block; padding:7px 14px; border-radius:999px; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.3); font-size:12px; }
    .toc { padding:56px 60px; page-break-after:always; } .toc h2 { font-size:26px; margin:0 0 24px; color:${m.accent}; }
    .toc ol { list-style:none; margin:0; padding:0; } .toc li { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #e7ecf4; }
    .toc .tnum { color:${m.accent}; font-weight:800; font-size:14px; width:30px; } .toc .tt { font-size:15px; font-weight:600; }
    main { padding:10px 46px 30px; }
    .screen { page-break-inside:avoid; margin:0 0 26px; padding-top:14px; }
    .sec-head { display:flex; align-items:center; gap:12px; margin-bottom:7px; }
    .num { background:${m.accent}; color:#fff; min-width:34px; height:30px; padding:0 8px; border-radius:9px; font-size:14px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; }
    .sec-head h2 { font-size:21px; margin:0; } .lead { color:#41506a; font-size:13.5px; line-height:1.65; margin:0 0 13px; }
    .anno { border:1px solid #d5dced; border-radius:12px; overflow:visible; box-shadow:0 6px 20px rgba(20,40,80,.08); }
    .chrome { height:28px; background:#eef2f8; border-bottom:1px solid #dde4ef; border-radius:12px 12px 0 0; display:flex; align-items:center; gap:7px; padding:0 12px; }
    .chrome .dot { width:10px; height:10px; border-radius:50%; } .chrome .r { background:#ff5f57; } .chrome .y { background:#febc2e; } .chrome .g { background:#28c840; }
    .imgwrap { position:relative; line-height:0; }
    .imgclip { border-radius:0 0 12px 12px; overflow:hidden; line-height:0; } .imgclip img { width:100%; display:block; }
    .box { position:absolute; border:2.5px solid #dc2626; border-radius:7px; box-shadow:0 0 0 1.5px rgba(255,255,255,.65), 0 0 0 3.5px rgba(220,38,38,.18); }
    /* 번호뱃지는 박스 '바깥' 좌상단 모서리에 얹어 버튼명/내용을 가리지 않는다. */
    .box .badge { position:absolute; left:0; top:0; transform:translate(-50%,-50%); min-width:20px; height:20px; padding:0 5px; border-radius:50%; background:#dc2626;
      color:#fff; font-size:11.5px; font-weight:800; display:flex; align-items:center; justify-content:center; line-height:1; box-shadow:0 0 0 2px #fff; }
    .legend { margin:12px 0 0; padding:12px 16px; list-style:none; background:linear-gradient(180deg,#f4f9ff,#eef5fd); border:1px solid #d5e6f7; border-left:4px solid ${m.accent}; border-radius:10px; }
    .legend li { display:flex; align-items:flex-start; gap:9px; font-size:13px; line-height:1.6; margin:4px 0; color:#2a3446; }
    .legend .ln { flex:0 0 auto; width:20px; height:20px; border-radius:50%; background:#dc2626; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:1px; }
  </style></head><body>
    <div class="cover"><span class="blob b1"></span><span class="blob b2"></span><div class="inner">
      <div class="brand"><span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/></svg></span><div><b>SKonnection</b><span>팀을 잇는 곳</span></div></div>
      <div class="mid"><h1>${m.title}</h1><p class="sub">${m.subtitle}</p><div class="rule"></div><p class="intro">${m.intro}</p><div class="foot"><span class="pill">기준일 ${DATE}</span></div></div>
    </div></div>
    <section class="toc"><h2>목차</h2><ol>${toc}</ol></section>
    <main>${body}</main>
  </body></html>`;
}

// 인앱 가이드용: 표지·목차·A4 없이 섹션만 스크롤로 쌓는 반응형 화면. stepHtml 을 재사용한다.
function screenDocHtml(m) {
  const steps = (m._sections || []).filter((s) => s._img);
  const body = steps.map((s, i) => stepHtml(s, i + 1)).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${m.title}</title><style>
    * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body { font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; color:#182234; margin:0; background:#f5f7fb; }
    .g-head { position:sticky; top:0; z-index:5; background:linear-gradient(120deg, ${m.accent}, ${m.accent2}); color:#fff; padding:14px 20px; box-shadow:0 2px 10px rgba(20,40,80,.12); }
    .g-head b { font-size:16px; } .g-head span { opacity:.9; font-size:12.5px; margin-left:8px; }
    main { max-width:900px; margin:0 auto; padding:20px 16px 64px; }
    .screen { margin:0 0 30px; }
    .sec-head { display:flex; align-items:center; gap:12px; margin-bottom:7px; }
    .num { background:${m.accent}; color:#fff; min-width:34px; height:30px; padding:0 8px; border-radius:9px; font-size:14px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; }
    .sec-head h2 { font-size:20px; margin:0; } .lead { color:#41506a; font-size:13.5px; line-height:1.65; margin:0 0 13px; }
    .anno { border:1px solid #d5dced; border-radius:12px; box-shadow:0 6px 20px rgba(20,40,80,.08); }
    .chrome { height:28px; background:#eef2f8; border-bottom:1px solid #dde4ef; border-radius:12px 12px 0 0; display:flex; align-items:center; gap:7px; padding:0 12px; }
    .chrome .dot { width:10px; height:10px; border-radius:50%; } .chrome .r { background:#ff5f57; } .chrome .y { background:#febc2e; } .chrome .g { background:#28c840; }
    .imgwrap { position:relative; line-height:0; }
    .imgclip { border-radius:0 0 12px 12px; overflow:hidden; line-height:0; } .imgclip img { width:100%; display:block; }
    .box { position:absolute; border:2.5px solid #dc2626; border-radius:7px; box-shadow:0 0 0 1.5px rgba(255,255,255,.65), 0 0 0 3.5px rgba(220,38,38,.18); }
    .box .badge { position:absolute; left:0; top:0; transform:translate(-50%,-50%); min-width:20px; height:20px; padding:0 5px; border-radius:50%; background:#dc2626; color:#fff; font-size:11.5px; font-weight:800; display:flex; align-items:center; justify-content:center; line-height:1; box-shadow:0 0 0 2px #fff; }
    .legend { margin:12px 0 0; padding:12px 16px; list-style:none; background:linear-gradient(180deg,#f4f9ff,#eef5fd); border:1px solid #d5e6f7; border-left:4px solid ${m.accent}; border-radius:10px; }
    .legend li { display:flex; align-items:flex-start; gap:9px; font-size:13px; line-height:1.6; margin:4px 0; color:#2a3446; }
    .legend .ln { flex:0 0 auto; width:20px; height:20px; border-radius:50%; background:#dc2626; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:1px; }
  </style></head><body>
    <div class="g-head"><b>${m.title}</b><span>${m.subtitle}</span></div>
    <main>${body}</main>
  </body></html>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  for (const manual of [MEMBER, OPERATOR]) {
    manual._sections = [];
    let loggedIn = null;
    for (const step of manual.steps) {
      const who = step.login || manual.login;
      try {
        if (step.common) {
          await page.goto(URL, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.login-panel', { timeout: 30000 });
          await page.waitForTimeout(800);
          loggedIn = null;
        } else if (who && loggedIn !== who.email) {
          await login(page, who.email);
          loggedIn = who.email;
        }
        if (step.sequence) {
          const secs = await captureFlow(page, step);
          manual._sections.push(...secs);
        } else {
          const { img, callouts } = await captureStep(page, step);
          manual._sections.push({ title: step.title, desc: step.desc, _img: img, _callouts: callouts });
          console.log('  ✔', manual.file.replace('.pdf', ''), step.key, `— 마커 ${callouts.length}개`);
        }
      } catch (e) {
        console.log('  ✗ 건너뜀', manual.file.replace('.pdf', ''), step.key, '—', String(e).split('\n')[0]);
      }
    }
    const html = docHtml(manual);
    await writeFile(`${OUT}/${manual.file.replace('.pdf', '.html')}`, html);
    const p2 = await context.newPage();
    await p2.setContent(html, { waitUntil: 'networkidle' });
    await p2.pdf({ path: `${OUT}/${manual.file}`, format: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#9aa4b4;padding:0 14mm;display:flex;justify-content:space-between;"><span>SKonnection · ${manual.title}</span><span class="pageNumber"></span></div>`,
      margin: { top: '0', bottom: '13mm', left: '0', right: '0' } });
    await p2.close();
    console.log('✔', manual.file);

    // 인앱 가이드용 스크린 HTML 도 함께 내보낸다.
    const guideName = manual === MEMBER ? 'member' : 'operator';
    await mkdir(GUIDE_OUT, { recursive: true });
    await writeFile(`${GUIDE_OUT}/${guideName}.html`, screenDocHtml(manual));
    console.log('✔ 인앱 가이드:', `${GUIDE_OUT}/${guideName}.html`);
  }
  await browser.close();
  console.log('완료:', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
