// 벼룩숲 테스트 데이터 — dev DB 에 물건/입찰을 넣는다.
// 실행: node scripts/seed-market.mjs   (프로젝트 루트에서)
//
// id 가 고정이라 여러 번 돌려도 늘어나지 않고 덮어쓴다. 마감 시각은 "지금" 기준으로
// 다시 계산되므로, 마감 임박 건이 이미 지나버렸으면 그냥 한 번 더 돌리면 된다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
try {
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch {
  console.error('⚠️  .env.local 이 없습니다.');
  process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

/* 마감 비교는 앱과 같은 로컬 'YYYY-MM-DDTHH:mm' 형식이어야 한다.
   toISOString 은 UTC 라 저녁 마감이 다음 날로 넘어간다. */
const pad = (n) => String(n).padStart(2, '0');
const stamp = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const shift = (minutes) => stamp(new Date(Date.now() + minutes * 60_000));
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
// 입찰 순서(동액 승자·나눔 선착순)를 가르는 값이라 흐트러지면 안 된다.
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const HOUR = 60;
const DAY = 24 * HOUR;

const items = [
  // ── 진행중 ────────────────────────────────────────────────────────
  {
    id: 'MKT-SEED-01',
    kind: 'auction',
    title: '기계식 키보드 적축 풀배열',
    description: '2년 썼고 키감 그대로입니다. 키캡은 새로 갈아 끼웠어요. 소음 적은 편입니다.',
    start_price: 60000,
    min_step: 3000,
    close_at: shift(2 * DAY),
    place: '9층 라운지',
    seller: '심상준',
    created_at: day(-2),
  },
  {
    id: 'MKT-SEED-02',
    kind: 'auction',
    title: '캠핑 의자 2개 세트',
    description: '작년에 두 번 쓰고 베란다에 있었습니다. 접이식이고 커버 있습니다.',
    start_price: 25000,
    min_step: 2000,
    close_at: shift(4 * DAY),
    place: '지하 주차장 B2',
    seller: '이선민',
    created_at: day(-1),
  },
  {
    id: 'MKT-SEED-03',
    kind: 'giveaway',
    title: '이사하며 정리하는 텀블러 3개',
    description: '스타벅스/써모스 섞여 있습니다. 세척해뒀어요. 먼저 누르시는 분.',
    start_price: 0,
    min_step: 0,
    close_at: shift(3 * DAY),
    place: '9층 탕비실 옆',
    seller: '박완배',
    created_at: day(-1),
  },
  {
    id: 'MKT-SEED-04',
    // 마감이 곧이라 지금 입찰하면 3분 연장되는 것을 볼 수 있다.
    kind: 'auction',
    title: '아이패드 9세대 64GB (펜슬 포함)',
    description: '액정 흠집 없고 배터리 성능 92%입니다. 정품 케이스와 1세대 펜슬 같이 드려요.',
    start_price: 210000,
    min_step: 10000,
    close_at: shift(4),
    place: '10층 회의실 앞',
    seller: '곽민성',
    created_at: day(-3),
  },

  // ── 끝난 것 (랭킹·낙찰 확인용, 마감이 이번 달이어야 랭킹에 잡힌다) ────
  {
    id: 'MKT-SEED-05',
    kind: 'auction',
    title: '로지텍 MX Master 3',
    description: '무선 충전 케이블 포함입니다. 클릭 이상 없어요.',
    start_price: 40000,
    min_step: 3000,
    close_at: shift(-6 * HOUR),
    place: '9층 라운지',
    seller: '김수정',
    created_at: day(-4),
  },
  {
    id: 'MKT-SEED-06',
    // 아무도 안 불러서 유찰. '거래완료' 로 뜨면 안 된다.
    kind: 'auction',
    title: '골프 드라이버 (구형)',
    description: '연습장에서만 썼습니다. 헤드 커버 있습니다.',
    start_price: 150000,
    min_step: 10000,
    close_at: shift(-2 * DAY),
    place: '지하 주차장 B2',
    seller: '이상협',
    created_at: day(-6),
  },
  {
    id: 'MKT-SEED-07',
    kind: 'giveaway',
    title: '아이 다 큰 유아 도서 20권',
    description: '상태 깨끗합니다. 종이백에 담아뒀어요.',
    start_price: 0,
    min_step: 0,
    close_at: shift(-1 * DAY),
    place: '9층 탕비실 옆',
    seller: '노현희',
    created_at: day(-5),
    seller_done: true,
    buyer_done: true,
  },
  {
    id: 'MKT-SEED-08',
    kind: 'giveaway',
    title: '남는 USB-C 케이블 · 충전기',
    description: '정품 아닌 것도 섞여 있습니다. 필요하신 분 가져가세요.',
    start_price: 0,
    min_step: 0,
    close_at: shift(-3 * DAY),
    place: '9층 내 자리',
    seller: '노현희',
    created_at: day(-7),
    seller_done: true,
    buyer_done: true,
  },
  {
    id: 'MKT-SEED-09',
    kind: 'auction',
    title: '스탠딩 책상 (수동 높이조절)',
    description: '상판 흠집 조금 있습니다. 직접 가져가셔야 해요.',
    start_price: 80000,
    min_step: 5000,
    close_at: shift(-3 * DAY),
    place: '지하 주차장 B2',
    seller: '심상준',
    created_at: day(-8),
    seller_done: true,
    buyer_done: true,
  },
  {
    id: 'MKT-SEED-10',
    // 취소된 건. 격자에서 가라앉아 보이는지 확인용.
    kind: 'auction',
    title: '자전거 헬멧',
    description: '사이즈가 안 맞아 내놓습니다.',
    start_price: 20000,
    min_step: 2000,
    close_at: shift(5 * DAY),
    place: '9층 라운지',
    seller: '최철원',
    created_at: day(-2),
    canceled: true,
  },
];

const bids = [
  // 01 — 김승현이 한 번 부르고 밀린 상태. 재입찰 화면을 바로 볼 수 있다.
  { id: 'BID-SEED-0101', item_id: 'MKT-SEED-01', name: '김승현', amount: 63000, created_at: ago(300) },
  { id: 'BID-SEED-0102', item_id: 'MKT-SEED-01', name: '이수현', amount: 66000, created_at: ago(240) },
  { id: 'BID-SEED-0103', item_id: 'MKT-SEED-01', name: '임성빈', amount: 72000, created_at: ago(90) },

  // 02 — 입찰 0건. 첫 입찰이 시작가부터 열리는지 확인용.
  // 03 — 나눔, 아직 아무도 안 가져감.

  // 04 — 마감 임박. 여기에 입찰하면 마감이 3분 밀려야 한다.
  { id: 'BID-SEED-0401', item_id: 'MKT-SEED-04', name: '박동진', amount: 220000, created_at: ago(180) },
  { id: 'BID-SEED-0402', item_id: 'MKT-SEED-04', name: '김기주', amount: 240000, created_at: ago(45) },

  // 05 — 마감됨. 김승현이 낙찰자라 낙찰 알림과 '거래 완료' 버튼을 볼 수 있다.
  { id: 'BID-SEED-0501', item_id: 'MKT-SEED-05', name: '최종현', amount: 43000, created_at: ago(9 * 60) },
  { id: 'BID-SEED-0502', item_id: 'MKT-SEED-05', name: '김승현', amount: 49000, created_at: ago(7 * 60) },

  // 06 — 입찰 없음 → 유찰.

  // 07·08 — 나눔 선착순. 먼저 누른 사람이 가져간다.
  { id: 'BID-SEED-0701', item_id: 'MKT-SEED-07', name: '이수현', amount: 0, created_at: ago(2 * DAY) },
  { id: 'BID-SEED-0702', item_id: 'MKT-SEED-07', name: '박소연', amount: 0, created_at: ago(2 * DAY - 30) },
  { id: 'BID-SEED-0801', item_id: 'MKT-SEED-08', name: '김금', amount: 0, created_at: ago(4 * DAY) },

  // 09 — 동액 두 건. 먼저 부른 임성빈이 이겨야 한다(나중 사람이 가로채면 규칙이 없는 셈).
  { id: 'BID-SEED-0901', item_id: 'MKT-SEED-09', name: '임성빈', amount: 110000, created_at: ago(4 * DAY) },
  { id: 'BID-SEED-0902', item_id: 'MKT-SEED-09', name: '양권상', amount: 110000, created_at: ago(4 * DAY - 20) },
];

const filled = items.map((item) => ({
  extended_to: null,
  image_url: null,
  poster: null, // 없으면 화면이 제목·가격으로 포스터를 만든다
  canceled: false,
  seller_done: false,
  buyer_done: false,
  ...item,
}));

const itemResult = await supabase.from('market_items').upsert(filled, { onConflict: 'id' });
if (itemResult.error) {
  console.error('❌ 물건 저장 실패:', itemResult.error.message);
  process.exit(1);
}
console.log(`✅ 물건 ${filled.length}건`);

const bidResult = await supabase.from('market_bids').upsert(bids, { onConflict: 'id' });
if (bidResult.error) {
  console.error('❌ 입찰 저장 실패:', bidResult.error.message);
  process.exit(1);
}
console.log(`✅ 입찰 ${bids.length}건`);
console.log('\n지우려면: delete from market_bids where id like \'BID-SEED-%\';');
console.log('           delete from market_items where id like \'MKT-SEED-%\';');
