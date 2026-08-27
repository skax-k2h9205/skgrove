// 캡처된 화면으로 매뉴얼 PDF 2종(팀원용·운영자용)을 만든다.
// HTML을 조립해 Chromium으로 A4 PDF 렌더. 캡처(capture.mjs) 후 실행.
//
// 실행: node scripts/manual/build.mjs
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = process.env.MANUAL_OUT || '/private/tmp/claude-503/-Users-a09253-other-projects-skgrove/586d0b59-1833-45b8-9c92-72fbe557652d/scratchpad/manual';
const DATE = process.env.MANUAL_DATE || '2026-08-07';

async function img(rel) {
  try {
    // 캡처는 JPEG(용량↓)로 저장한다. 섹션 데이터의 .png 경로를 .jpg로 읽는다.
    const p = rel.replace(/\.png$/, '.jpg');
    const buf = await readFile(`${OUT}/${p}`);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

const MEMBER = {
  file: 'SKonnection_팀원_매뉴얼.pdf',
  kicker: 'TEAM MEMBER GUIDE',
  title: '팀원용 매뉴얼',
  subtitle: '팀을 잇는 곳 · 일상 사용 안내',
  accent: '#006bb8',
  accent2: '#2a8fd4',
  intro:
    '팀원이 매일 쓰는 화면을 순서대로 안내합니다. 로그인 후 왼쪽 메뉴로 각 기능을 오갈 수 있어요.',
  sections: [
    { img: 'common/login.png', title: '로그인', lead: '이름 · 사내메일 · 비밀번호로 로그인합니다.',
      tips: ['처음 로그인하는 계정이면, 입력한 비밀번호가 그대로 등록됩니다(6자 이상).', '메일은 @sk.com만 사용할 수 있어요. 계정이 없으면 “가입”으로 요청하세요.', '접속 주소는 팀 리더/운영자에게 문의하세요.'] },
    { img: 'member/dashboard.png', title: '홈', lead: '팀 활동 요약과 자주 가는 곳으로 이동하는 시작 화면입니다.',
      tips: ['최근 소식·해야 할 일을 한눈에 확인하고, 카드에서 바로 해당 화면으로 이동합니다.'] },
    { img: 'member/intake.png', title: '대나무숲 접수', lead: '리더에게 의견을 전하는 곳. 익명 또는 실명으로 접수합니다.',
      tips: ['익명: 작성자 정보가 본문과 분리돼 리더 화면에도 누가 썼는지 보이지 않습니다.', '전달 대상(팀리더·특정 파트리더·리더 전체)과 공개 범위를 고르고 내용을 작성합니다.', '“내 접수” 탭에서 내가 낸 의견의 처리 상태와 리더 답변을 확인할 수 있어요.'] },
    { img: 'member/intake_write.png', title: '대나무숲 접수 · 내용 작성', lead: '방식을 고르면 제목·본문·기대 변화를 작성하는 단계로 넘어갑니다.',
      tips: ['제목과 내용을 적고, 검토를 거쳐 제출합니다.', '익명으로 접수하면 이 내용만 리더에게 전달되고 작성자 정보는 분리됩니다.'] },
    { img: 'member/agenda.png', title: '안건함 / 투표', lead: '팀 안건에 투표하는 곳. 찬반 또는 객관식(선택지)로 진행됩니다.',
      tips: ['열려 있는 안건에 마감 전까지 투표하세요. 투표는 익명으로 집계됩니다.', '객관식은 여러 개 고르기가 허용된 경우 복수 선택할 수 있어요.'] },
    { img: 'member/actions.png', title: '액션아이템', lead: '안건·캔미팅에서 정해진 후속 조치(할 일)를 관리합니다.',
      tips: ['내가 담당인 액션을 확인하고, 진행/완료로 상태를 바꾸며 결과를 남깁니다.'] },
    { img: 'member/meetings.png', title: '캔미팅 / 티미팅', lead: '회고·주제 수집(캔미팅)과 티타임 세션(티미팅)에 참여합니다.',
      tips: ['제시된 주제에 의견을 남기고, 티미팅 세션을 제안하거나 참여 상태를 확인합니다.'] },
    { img: 'member/gatherings.png', title: '모임 · 번개', lead: '가벼운 번개 모임을 만들고 신청하는 곳입니다.',
      tips: ['원하는 모임에 신청하세요. 정원이 차면 대기로 잡히고, 자리가 나면 자동 승계됩니다.'] },
    { img: 'member/profiles.png', title: '동료 성향', lead: '동료의 일하는 방식·협업 성향을 카드로 봅니다.',
      tips: ['협업 전에 상대의 성향·피드백 방식을 참고하세요. 내 성향은 마이페이지에서 관리합니다.'] },
    { img: 'member/memory.png', title: '팀 추억', lead: '행사별 사진첩. 커버를 눌러 들어가 사진을 올리고 반응·댓글을 남깁니다.',
      tips: ['게시물 탭에서 행사 커버를 누르면 그 행사의 사진 상세로 들어갑니다.', '새 행사는 캘린더 탭에서 날짜를 눌러 만들고, 상세에서 사진/영상을 올립니다(자동으로 가볍게 저장).'] },
    { img: 'member/memory_calendar.png', title: '팀 추억 · 캘린더', lead: '캘린더 탭에서 달을 넘겨 원하는 날짜에 행사를 만듭니다.',
      tips: ['빈 날짜를 누르면 그 날짜의 추억 공간이 생깁니다. 지난 행사도 이전 달로 넘겨 등록할 수 있어요.', '행사가 있는 날엔 제목이 함께 표시됩니다.'] },
    { img: 'member/humor.png', title: '유~머게시판', lead: '가볍게 웃을 글을 나누는 곳입니다.',
      tips: ['글을 올리고 반응·댓글로 소통하세요. 내 글은 수정·삭제할 수 있어요.'] },
    { img: 'member/market.png', title: '이음장터', lead: '팀 안에서 나눔하거나 경매로 물건을 주고받습니다.',
      tips: ['물건을 등록(나눔/경매)하거나, 마음에 드는 물건에 신청/입찰하세요.'] },
    { img: 'member/notifications.png', title: '알림 / 메시지', lead: '나에게 온 알림과 개인 메시지를 확인합니다.',
      tips: ['읽음/안읽음으로 정리되며, 알림을 누르면 관련 화면으로 이동합니다.'] },
  ],
};

const OPERATOR = {
  file: 'SKonnection_운영자_매뉴얼.pdf',
  kicker: 'OPERATOR GUIDE',
  title: '운영자용 매뉴얼',
  subtitle: '리더 · 커넥셔너(운영자) 안내',
  accent: '#0a4d8c',
  accent2: '#1f7a52',
  intro: '리더·커넥셔너가 쓰는 관리 화면을 안내합니다. 권한에 따라 보이는 메뉴가 다릅니다.',
  sections: [
    { title: '권한과 메뉴 (개념)', lead: '역할(팀원·파트리더·팀리더)과 별개로 “커넥셔너”라는 시스템 관리자 플래그가 있습니다.',
      tips: ['리더 관리함: 파트리더·팀리더 역할에게만 보입니다(자신이 전달 대상인 접수만 표시).', '계정 관리: 팀리더 또는 커넥셔너에게 보입니다.', '시스템 관리 · 조뽑기: 커넥셔너에게만 보입니다.', '커넥셔너 지정/해제는 계정 관리 화면에서 토글합니다.'] },
    { img: 'leader/leader.png', title: '리더 관리함', lead: '대나무숲 접수를 처리하는 곳. 자신이 전달 대상인 접수만 보입니다.',
      tips: ['건을 골라 답변 · 1on1 제안 · 안건화 · 메모로 처리하고 상태를 바꿉니다.', '안건화는 찬반 또는 객관식(선택지)로 만들 수 있어요.', '답변·후속 응답은 덮어쓰지 않고 처리기록에 쌓입니다.', '익명 접수는 작성자 정보가 분리돼 표시되지 않습니다.'] },
    { img: 'connectioner/connect.png', title: '조뽑기 (커넥셔너 도구)', lead: '팀을 무작위로 섞어 조를 나누는 커넥셔너 전용 도구입니다.',
      tips: ['활성 계정을 대상으로 조를 뽑고 결과를 저장·공유합니다.'] },
    { img: 'connectioner/metrics.png', title: '파트지수 / 리포트', lead: '회의 건강도 등 파트 지표를 보는 리포트 화면입니다.',
      tips: ['구글 캘린더 연동 데이터를 바탕으로 파트별 지표를 확인합니다.'] },
    { img: 'connectioner/accounts.png', title: '계정 관리', lead: '가입 승인, 역할·상태 변경, 커넥셔너 지정, 슬랙 이메일을 관리합니다.',
      tips: ['가입 요청을 활성으로 바꿔야 로그인할 수 있습니다.', '슬랙 DM을 받을 사람은 “슬랙 이메일”을 등록해 두세요(없으면 DM이 안 갑니다).', '커넥셔너 토글은 전권(시스템 관리 등)을 부여하므로 꼭 필요한 사람만.'] },
    { img: 'connectioner/system.png', title: '시스템 관리 (알림 발송)', lead: '슬랙 알림을 화면에서 제어합니다. 저장 즉시 팀 전체에 적용됩니다(재배포 불필요).',
      tips: ['슬랙 알림 사용: 전체 마스터 스위치. 끄면 슬랙 발송 없이 앱 안 알림만.', '개인 DM 발송: 대나무숲·개인 메시지 DM을 켜고 끕니다(슬랙 이메일 등록자만 수신).', '슬랙 채널 ID: 팀/커넥셔너 채널 ID(C…). 비우면 서버 기본값으로 폴백. 봇을 그 채널에 초대해야 게시됩니다.', '알림 종류별 발송 위치: 각 알림을 팀채널/커넥셔너채널/DM/끔 중 지정. 옆에 “언제 나가는 알림인지”가 함께 표기됩니다.', '변경은 이미 열려 있는 다른 사람 탭엔 새로고침 후 반영됩니다.'] },
    { title: '운영 체크리스트', lead: '데모/오픈 전 확인하면 좋은 것들.',
      tips: ['슬랙 봇(sk_grove)을 알림 보낼 채널마다 초대(/invite)했는지 확인. 미초대 시 게시 실패.', '시스템 관리에서 팀/커넥셔너 채널 ID가 올바른지, DM 사용 여부가 의도대로인지 확인.', '팀원들이 각자 첫 로그인으로 비밀번호를 설정하도록 안내(계정 선점 방지).', '리더별 슬랙 이메일이 계정 관리에 등록됐는지 확인(대나무숲 DM 수신용).'] },
  ],
};

function sectionHtml(s, index) {
  const tips = (s.tips || []).map((t) => `<li>${t}</li>`).join('');
  const shot = s._img
    ? `<div class="shot-wrap"><figure class="shot">
         <div class="chrome"><i class="dot r"></i><i class="dot y"></i><i class="dot g"></i></div>
         <img src="${s._img}" alt="${s.title}"/>
       </figure></div>`
    : '';
  return `
    <section class="screen">
      <div class="sec-head"><span class="num">${String(index).padStart(2, '0')}</span><h2>${s.title}</h2></div>
      <p class="lead">${s.lead}</p>
      ${shot}
      ${tips ? `<div class="tips"><p class="tips-title">핵심 사용법</p><ul>${tips}</ul></div>` : ''}
    </section>`;
}

function tocHtml(manual) {
  const items = manual.sections
    .map((s, i) => `<li><span class="tnum">${String(i + 1).padStart(2, '0')}</span><span class="tt">${s.title}</span></li>`)
    .join('');
  return `<section class="toc"><h2>목차</h2><ol>${items}</ol></section>`;
}

function docHtml(m) {
  const body = m.sections.map((s, i) => sectionHtml(s, i + 1)).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
  <style>
    :root { --accent:${m.accent}; --accent2:${m.accent2}; --ink:#182234; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; color:#182234; margin:0; }

    /* ===== 표지 ===== */
    .cover { position:relative; height:284mm; overflow:hidden; color:#fff;
      background:linear-gradient(150deg, ${m.accent} 0%, ${m.accent2} 100%); page-break-after:always; }
    .cover .blob { position:absolute; border-radius:50%; background:rgba(255,255,255,.10); }
    .cover .b1 { width:520px; height:520px; right:-160px; top:-160px; }
    .cover .b2 { width:360px; height:360px; left:-120px; bottom:-120px; background:rgba(255,255,255,.08); }
    .cover .b3 { width:180px; height:180px; right:120px; bottom:170px; background:rgba(255,255,255,.07); }
    .cover .inner { position:relative; padding:66px 60px; height:100%; display:flex; flex-direction:column; }
    .cover .brand { display:flex; align-items:center; gap:13px; }
    .cover .logo { width:48px; height:48px; border-radius:14px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.45);
      display:flex; align-items:center; justify-content:center; }
    .cover .logo svg { width:27px; height:27px; display:block; }
    .cover .brand b { font-size:19px; letter-spacing:.2px; } .cover .brand span { display:block; font-size:12px; opacity:.85; }
    .cover .mid { margin-top:auto; }
    .cover .kicker { font-size:12px; letter-spacing:3px; font-weight:700; opacity:.85; margin:0 0 14px; }
    .cover h1 { font-size:56px; line-height:1.05; margin:0 0 16px; letter-spacing:-1px; }
    .cover .sub { font-size:18px; opacity:.92; margin:0 0 26px; }
    .cover .rule { width:64px; height:4px; background:rgba(255,255,255,.9); border-radius:3px; margin:0 0 22px; }
    .cover .intro { font-size:14px; line-height:1.75; max-width:520px; opacity:.92; }
    .cover .foot { margin-top:34px; display:inline-flex; align-items:center; gap:10px; }
    .cover .pill { display:inline-block; padding:7px 14px; border-radius:999px; background:rgba(255,255,255,.16);
      border:1px solid rgba(255,255,255,.3); font-size:12px; }

    /* ===== 목차 ===== */
    .toc { padding:56px 60px; page-break-after:always; }
    .toc h2 { font-size:26px; margin:0 0 24px; color:var(--accent); }
    .toc ol { list-style:none; margin:0; padding:0; }
    .toc li { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #e7ecf4; }
    .toc .tnum { color:var(--accent); font-weight:800; font-size:14px; width:30px; }
    .toc .tt { font-size:15px; font-weight:600; }

    /* ===== 본문 ===== */
    main { padding: 10px 46px 30px; }
    .screen { page-break-inside: avoid; margin: 0 0 26px; padding-top:14px; }
    .sec-head { display:flex; align-items:center; gap:12px; margin-bottom:7px; }
    .num { background:var(--accent); color:#fff; min-width:34px; height:30px; padding:0 8px; border-radius:9px;
      font-size:14px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; letter-spacing:.5px; }
    .sec-head h2 { font-size:21px; margin:0; letter-spacing:-.3px; }
    .lead { color:#41506a; font-size:13.5px; line-height:1.65; margin:0 0 13px; }

    .shot { margin:0; border:1px solid #d5dced; border-radius:12px; overflow:hidden; box-shadow:0 6px 20px rgba(20,40,80,.08); }
    .chrome { height:28px; background:#eef2f8; border-bottom:1px solid #dde4ef; display:flex; align-items:center; gap:7px; padding:0 12px; }
    .chrome .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .chrome .r { background:#ff5f57; } .chrome .y { background:#febc2e; } .chrome .g { background:#28c840; }
    .shot img { width:100%; display:block; }

    .tips { margin-top:13px; background:linear-gradient(180deg,#f4f9ff,#eef5fd); border:1px solid #d5e6f7; border-left:4px solid var(--accent);
      border-radius:10px; padding:13px 18px; }
    .tips-title { font-weight:800; font-size:12.5px; margin:0 0 6px; color:var(--accent); letter-spacing:.2px; }
    .tips ul { margin:0; padding-left:18px; } .tips li { font-size:13px; line-height:1.7; margin:3px 0; color:#2a3446; }
  </style></head><body>
    <div class="cover">
      <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
      <div class="inner">
        <div class="brand">
          <span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/></svg></span>
          <div><b>SKonnection</b><span>팀을 잇는 곳</span></div>
        </div>
        <div class="mid">
          <h1>${m.title}</h1>
          <p class="sub">${m.subtitle}</p>
          <div class="rule"></div>
          <p class="intro">${m.intro}</p>
          <div class="foot"><span class="pill">기준일 ${DATE}</span></div>
        </div>
      </div>
    </div>
    ${tocHtml(m)}
    <main>${body}</main>
  </body></html>`;
}

async function buildOne(manual) {
  for (const s of manual.sections) s._img = s.img ? await img(s.img) : '';
  const html = docHtml(manual);
  await writeFile(`${OUT}/${manual.file.replace('.pdf', '.html')}`, html);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: `${OUT}/${manual.file}`,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      `<div style="width:100%; font-size:8px; color:#9aa4b4; padding:0 14mm; display:flex; justify-content:space-between;">
         <span>SKonnection · ${manual.title}</span>
         <span class="pageNumber"></span>
       </div>`,
    margin: { top: '0', bottom: '13mm', left: '0', right: '0' },
  });
  await browser.close();
  console.log('✔', manual.file);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await buildOne(MEMBER);
  await buildOne(OPERATOR);
  console.log('완료:', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
