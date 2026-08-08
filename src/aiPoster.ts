// 포스터 생성 이음새(seam) — 사진을 첨부하지 않은 모임의 대표 이미지를 만든다.
// aiSummarize.ts 와 같은 규약: VITE_AI_ENDPOINT 로 POST 하고, 키는 프록시에만 둔다.
//
// 중요한 설계 결정 하나: **그림을 생성하지 않는다.**
// 요청은 "포스터"였고 이유는 "쌓이면 한눈에 보기 좋게"였다. 사진 생성 모델을 쓰면
// 건마다 화풍·구도·색이 제각각이라 스무 장이 쌓였을 때 오히려 어지러워진다.
// 그래서 틀(레이아웃·타이포·비율)은 CSS 로 고정하고, LLM 은 문구와 색만 정한다.
// 개성은 나되 격자는 흐트러지지 않는다. 덤으로 응답이 빠르고 비용이 거의 없다.
import { formatWhen } from './gatheringRules';
import type { Gathering, GatheringPoster } from './types';

const ENDPOINT = (import.meta.env as Record<string, string | undefined>).VITE_AI_ENDPOINT;

// 포스터가 쓸 수 있는 색은 앱의 역할색뿐이다. LLM 이 아무 색이나 뱉어도
// 디자인 시스템 밖으로 나가지 못하게 여기서 막는다.
const TONES: GatheringPoster['tone'][] = ['moss', 'clay', 'info', 'pending'];

// 아이콘도 마찬가지로 목록 안에서만 고른다. 없는 이름이 오면 렌더가 깨진다.
const MOTIFS = [
  'Coffee',
  'UtensilsCrossed',
  'Beer',
  'Mountain',
  'Bike',
  'Dumbbell',
  'Gamepad2',
  'Music',
  'Clapperboard',
  'BookOpen',
  'PartyPopper',
  'Sparkles',
] as const;

// 제목에 이 말이 있으면 그 아이콘을 쓴다. 로컬 폴백의 품질은 대부분 여기서 나온다.
const KEYWORD_MOTIF: Array<[string[], string]> = [
  [['커피', '카페', '아메리카노', '차'], 'Coffee'],
  [['점심', '저녁', '밥', '식사', '맛집', '회식', '뒷풀이'], 'UtensilsCrossed'],
  [['술', '맥주', '한잔', '치맥', '와인'], 'Beer'],
  [['등산', '산', '트래킹', '캠핑', '나들이'], 'Mountain'],
  [['자전거', '러닝', '달리기', '산책', '걷기'], 'Bike'],
  [['운동', '헬스', '요가', '클라이밍', '볼링', '배드민턴'], 'Dumbbell'],
  [['게임', '보드게임', '오락', '피시방'], 'Gamepad2'],
  [['노래', '음악', '공연', '콘서트', '노래방'], 'Music'],
  [['영화', '드라마', '관람'], 'Clapperboard'],
  [['스터디', '공부', '독서', '세미나', '강의', '워크샵', '워크숍', '회고'], 'BookOpen'],
  [['생일', '축하', '파티', '환영', '송별'], 'PartyPopper'],
];

/** 제목이 같으면 언제나 같은 포스터가 나오게 하는 결정적 해시. */
function hash(text: string) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }
  return value;
}

function motifFor(title: string) {
  const lowered = title.toLowerCase();
  const hit = KEYWORD_MOTIF.find(([words]) => words.some((word) => lowered.includes(word)));
  if (hit) return hit[1];
  return MOTIFS[hash(title) % MOTIFS.length];
}

/*
  엔드포인트 없이도 포스터가 나와야 한다. 없으면 카드가 비는 게 아니라
  "AI 가 꺼져 있어서 못 만들었습니다"가 화면에 남는데, 그건 사용자 잘못이 아니다.
  제목은 이미 사용자가 고른 말이므로 그대로 쓰고, 부연만 만들어 붙인다.
*/
export function localPoster(gathering: Gathering): GatheringPoster {
  const seats =
    gathering.capacity === null ? '인원 제한 없음' : `선착순 ${gathering.capacity}명`;
  const where = gathering.place.trim();
  return {
    headline: gathering.title.trim(),
    caption: [formatWhen(gathering.startAt), where, seats].filter(Boolean).join(' · '),
    tone: TONES[hash(gathering.title + gathering.startAt) % TONES.length],
    motif: motifFor(gathering.title),
    source: 'local',
  };
}

/** 응답이 어떤 형태로 와도 앱이 깨지지 않게 정제한다. 하나라도 이상하면 그 항목만 폴백. */
function sanitize(raw: unknown, gathering: Gathering): GatheringPoster {
  const fallback = localPoster(gathering);
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Record<string, unknown>;

  const headline = typeof value.headline === 'string' ? value.headline.trim() : '';
  const caption = typeof value.caption === 'string' ? value.caption.trim() : '';
  const tone = TONES.find((item) => item === value.tone);
  const motif = MOTIFS.find((item) => item === value.motif);

  return {
    // 문구가 너무 길면 포스터가 깨진다. 격자를 지키는 것이 문구보다 우선이다.
    headline: headline && headline.length <= 40 ? headline : fallback.headline,
    caption: caption && caption.length <= 60 ? caption : fallback.caption,
    tone: tone ?? fallback.tone,
    motif: motif ?? fallback.motif,
    source: 'ai',
  };
}

export type PosterResult = { poster: GatheringPoster; usedAi: boolean };

/**
 * 포스터를 만든다. 실패하거나 엔드포인트가 없으면 로컬 폴백을 돌려준다.
 * 호출부는 항상 포스터를 받으므로 "없을 때" 분기를 따로 두지 않아도 된다.
 */
export async function makePoster(gathering: Gathering): Promise<PosterResult> {
  if (!ENDPOINT) return { poster: localPoster(gathering), usedAi: false };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'gathering-poster',
        // 프론트는 프롬프트를 조립하지 않고 사실만 넘긴다. 문구 규칙은 프록시가 갖는다.
        gathering: {
          kind: gathering.kind,
          title: gathering.title,
          startAt: gathering.startAt,
          place: gathering.place,
          capacity: gathering.capacity,
          desc: gathering.desc,
          cost: gathering.cost,
        },
        allowedTones: TONES,
        allowedMotifs: MOTIFS,
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; poster?: unknown } | null;
    if (!data?.ok) return { poster: localPoster(gathering), usedAi: false };
    const poster = sanitize(data.poster, gathering);
    return { poster, usedAi: poster.source === 'ai' };
  } catch {
    return { poster: localPoster(gathering), usedAi: false };
  }
}
