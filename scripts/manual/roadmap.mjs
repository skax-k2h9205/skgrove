// 멀티테넌트 전환 로드맵 — 공유용 1~2장 PDF.
import { chromium } from 'playwright';
const OUT = process.env.MANUAL_OUT || '/private/tmp/claude-503/-Users-a09253-other-projects-skgrove/586d0b59-1833-45b8-9c92-72fbe557652d/scratchpad/manual';
const DATE = '2026-08-13';

const PHASES = [
  { n: '0', t: '인증 기반', g: 'Supabase Auth + Slack(OIDC) 도입', b: ['Slack team_id = 테넌트 키 확보', '계정 매칭: Slack ID 1차 · 이메일/slackEmail 다리', '비밀번호 제거 · 세션 도입'] },
  { n: '1', t: '테넌트 모델 · 데이터 격리', g: '한 DB에 여러 팀, 엄격히 분리', b: ['tenants 테이블 + 전 테이블에 tenant_id', '기존 팀 = tenant#1 백필', 'RLS 재설계(전면개방 → 테넌트 격리)'] },
  { n: '2', t: '테넌트별 설정 · 온보딩', g: '팀마다 자기 설정으로', b: ['알림설정·브랜딩(이름/로고)·커넥셔너 테넌트별', '새 워크스페이스 첫 로그인 → 테넌트 자동생성', '허용목록으로 온보딩 통제'] },
  { n: '3', t: 'Slack 멀티 워크스페이스', g: '팀별 봇·채널로 알림', b: ['Slack 앱 배포형(각 워크스페이스 설치)', '워크스페이스별 봇 토큰 암호화 저장', 'notify가 그 테넌트 토큰·채널로 발송'] },
  { n: '4', t: '운영 · 거버넌스', g: '중앙 관제 · 규정 준수', b: ['플랫폼 오너 콘솔(테넌트·사용량·승인)', '데이터 보존/삭제·내보내기 · 격리 감사', '비용/스케일: 유료 전환·스토리지 한도'] },
  { n: '5', t: '확산 · 셀프서비스', g: '새 팀이 스스로 시작', b: ['온보딩 위저드(파트·채널·봇 초대)', '테넌트 브랜딩 매뉴얼 자동 생성', '문서/지원 체계'] },
];

const RISKS = [
  '대나무숲 익명성이 테넌트 경계를 넘지 않도록 RLS + 별도 검증(최우선)',
  '봇 토큰 등 비밀 관리(암호화)',
  '격리 방식: 단일 DB + 엄격 RLS로 시작 → 규모 커지면 DB 분리 검토',
  '인증이 없던 앱이라 Phase 0(auth)이 최대 리팩터 → 먼저',
  '팀 증가 시 DB·스토리지 비용 급증 → 한도/유료화 정책',
];

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#182234;margin:0;}
  .head{background:linear-gradient(135deg,#0a4d8c,#006bb8 60%,#2a8fd4);color:#fff;padding:34px 44px;position:relative;overflow:hidden;}
  .head .blob{position:absolute;border-radius:50%;background:rgba(255,255,255,.10);width:340px;height:340px;right:-110px;top:-150px;}
  .head .brand{display:flex;align-items:center;gap:11px;margin-bottom:16px;position:relative;}
  .head .logo{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;}
  .head .logo svg{width:22px;height:22px;display:block;}
  .head b{font-size:16px;} .head .brand span{font-size:11px;opacity:.85;display:block;}
  .head h1{font-size:30px;margin:0 0 6px;letter-spacing:-.6px;position:relative;}
  .head .sub{font-size:14px;opacity:.92;margin:0;position:relative;}
  .head .meta{margin-top:12px;font-size:11px;opacity:.85;position:relative;}
  main{padding:22px 44px 30px;}
  .principle{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px;}
  .principle span{font-size:11.5px;background:#eef5fd;border:1px solid #d5e6f7;color:#005a9e;border-radius:999px;padding:5px 11px;font-weight:600;}
  .h2{font-size:15px;font-weight:800;color:#0a4d8c;margin:0 0 12px;display:flex;align-items:center;gap:8px;}
  .h2::before{content:'';width:14px;height:14px;background:#006bb8;border-radius:4px;}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:22px;}
  .card{border:1px solid #dce3ef;border-radius:12px;padding:13px 14px;background:#fbfcfe;page-break-inside:avoid;}
  .card .top{display:flex;align-items:center;gap:9px;margin-bottom:6px;}
  .card .num{width:26px;height:26px;border-radius:8px;background:#006bb8;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;}
  .card .t{font-size:13.5px;font-weight:700;}
  .card .g{font-size:11.5px;color:#41506a;margin:0 0 8px;line-height:1.45;}
  .card ul{margin:0;padding-left:15px;} .card li{font-size:11px;line-height:1.55;color:#2a3446;margin:2px 0;}
  .flow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 22px;}
  .flow .step{background:#0a4d8c;color:#fff;font-size:11px;font-weight:700;border-radius:8px;padding:6px 10px;}
  .flow .arrow{color:#9aa8bd;font-weight:800;}
  .risk{background:#fff7f2;border:1px solid #f3d6c4;border-left:4px solid #e0322f;border-radius:10px;padding:13px 16px;}
  .risk ul{margin:0;padding-left:16px;} .risk li{font-size:12px;line-height:1.7;color:#3a2a24;margin:2px 0;}
  .note{margin-top:18px;font-size:11.5px;color:#5b6a82;line-height:1.6;}
</style></head><body>
  <div class="head">
    <span class="blob"></span>
    <div class="brand"><span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/></svg></span><div><b>SKonnection</b><span>팀을 잇는 곳</span></div></div>
    <h1>멀티테넌트 전환 로드맵</h1>
    <p class="sub">관계사·다수 팀 확산을 위한 단계별 계획</p>
    <p class="meta">기준일 ${DATE} · 한 배포 · 팀별 데이터 격리 · Slack 워크스페이스 = 테넌트</p>
  </div>
  <main>
    <div class="principle">
      <span>한 배포, 여러 팀</span><span>Slack 워크스페이스(team_id) = 테넌트</span><span>중앙 업데이트</span>
      <span>각 팀 커넥셔너가 자기 설정 관리</span><span>대나무숲 익명성·격리 최우선</span>
    </div>

    <p class="h2">단계별 계획</p>
    <div class="grid">
      ${PHASES.map((p) => `<div class="card"><div class="top"><span class="num">${p.n}</span><span class="t">${p.t}</span></div><p class="g">${p.g}</p><ul>${p.b.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('')}
    </div>

    <p class="h2">권장 순서 (단계별 feature 브랜치 → PR → 배포 → 검증)</p>
    <div class="flow">
      <span class="step">0 인증</span><span class="arrow">→</span>
      <span class="step">1 tenant_id + RLS</span><span class="arrow">→</span>
      <span class="step">2 설정·온보딩</span><span class="arrow">→</span>
      <span class="step">3 Slack 멀티봇</span><span class="arrow">→</span>
      <span class="step">4 거버넌스</span><span class="arrow">→</span>
      <span class="step">5 셀프서비스</span>
    </div>

    <p class="h2">핵심 리스크 · 결정</p>
    <div class="risk"><ul>${RISKS.map((r) => `<li>${r}</li>`).join('')}</ul></div>

    <p class="note">기존 단일 팀은 그대로 <b>tenant#1</b> 로 무중단 이행합니다. 첫 실행 블록은 <b>Phase 0(Slack 인증)</b> — 지금 로그인 개선이자 멀티테넌트의 첫 단추라 바로 착수 가치가 있습니다.</p>
  </main>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({ path: `${OUT}/SKonnection_멀티테넌트_로드맵.pdf`, format: 'A4', printBackground: true,
  margin: { top: '0', bottom: '10mm', left: '0', right: '0' } });
await browser.close();
console.log('✔ SKonnection_멀티테넌트_로드맵.pdf');
