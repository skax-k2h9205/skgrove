// 통합 로컬 프록시 — notify(슬랙) + ai(OpenRouter 취합) + review(접수 검토) + calendar(구글 캘린더 읽기)를
// 한 포트에서 경로로 분기한다.
// 실행: node scripts/proxy.mjs  (또는 npm run proxy)
//   POST /api/ai        → AI 취합 (ai-proxy)
//   POST /api/review    → 접수 검토 (review-proxy)
//   GET/POST /api/calendar → 구글 캘린더 읽기 (calendar-proxy)
//   POST /api/gathering-image → 모임 썸네일 생성 (image-proxy)
//   POST /api/notify    → 슬랙 전송 (notify-proxy)
// 설정은 .env.ai.local / .env.notify.local / .env.calendar.local 에서 읽는다(없으면 해당 기능만 휴면).
import { createServer } from 'node:http';
import { handleAi } from './ai-proxy.mjs';
import { handleReview } from './review-proxy.mjs';
import { SYNC_INTERVAL_MS, handleCalendar, syncCalendar } from './calendar-proxy.mjs';
import { handleGatheringImage } from './image-proxy.mjs';
import { handleNotify } from './notify-proxy.mjs';

const PORT = Number(process.env.PROXY_PORT || 8787);

createServer((req, res) => {
  const url = req.url || '';
  if (url.includes('/api/review')) {
    handleReview(req, res);
    return;
  }
  if (url.includes('/api/calendar')) {
    handleCalendar(req, res);
    return;
  }
  if (url.includes('/api/gathering-image')) {
    handleGatheringImage(req, res);
    return;
  }
  if (url.includes('/api/ai')) {
    handleAi(req, res);
    return;
  }
  handleNotify(req, res); // 기본: 슬랙(경로 미지정 포함, 하위호환)
}).listen(PORT, () => {
  console.log(`🔗 proxy (notify+ai+review+calendar+image) 실행 중 → http://127.0.0.1:${PORT}`);
  console.log(`   • POST     /api/ai        (OpenRouter 취합)`);
  console.log(`   • POST     /api/review    (접수 검토)`);
  console.log(`   • GET/POST /api/calendar  (구글 캘린더 읽기)`);
  console.log(`   • POST     /api/gathering-image (모임 썸네일 생성)`);

  /*
    사람이 '연결'을 누르지 않아도 서버가 알아서 당겨온다.
    GOOGLE_REFRESH_TOKEN 이 없으면 첫 시도에서 그 사실만 알리고 조용히 멈춘다 —
    설정이 안 된 것과 실패한 것은 다르게 다뤄야 헛경고가 안 뜬다.
  */
  void syncCalendar();
  const timer = setInterval(() => void syncCalendar(), SYNC_INTERVAL_MS);
  // 프록시를 내릴 때 타이머가 프로세스를 붙잡지 않게 한다.
  timer.unref?.();
  console.log(`   • POST     /api/notify    (슬랙 전송)`);
});
