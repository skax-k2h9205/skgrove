// 홈 통합 피드 — 5개 도메인(안건·액션·번개·유머·장터)을 하나의 최신순 목록으로 접는다.
// 화면 없이 정렬·개수·매핑을 테스트할 수 있도록 순수 함수로 둔다. 카드의 색·아이콘·라벨은
// 화면(Dashboard)이 kind 로 정하고, 여기서는 데이터만 만든다.
import { resolveMedia, youtubeThumb } from './humorRules';
import type { ActionItem, Agenda, Gathering, HumorPost, MarketItem, Section } from './types';

export type HomeFeedKind = 'agenda' | 'action' | 'gathering' | 'humor' | 'market';

export type HomeFeedItem = {
  id: string; // 도메인 접두어. 예: 'gathering:GAT-1' — 도메인이 달라도 키가 겹치지 않게
  section: Section; // 클릭 시 이동할 메뉴
  kind: HomeFeedKind;
  title: string;
  createdAt: string; // 정렬 키(원본 그대로)
  imageUrl?: string; // 있으면 사진 타일, 없으면 색 타일
  meta?: string; // 작은 메타 한 줄: 상태 / 좋아요 / 나눔·경매 등
};

// 팀 하나의 최근 소식을 다 담을 만큼 넉넉히. 너무 낮으면 항목 많은 도메인(안건 등)이
// 상한을 채워 유머처럼 건수 적은 도메인이 통째로 안 보이는 문제가 생긴다.
export const HOME_FEED_LIMIT = 60;

export type HomeFeedSources = {
  agendas: Agenda[];
  actionItems: ActionItem[];
  gatherings: Gathering[];
  humorPosts: HumorPost[];
  marketItems: MarketItem[];
};

// 유머 배경 = 사용자가 붙인 이미지, 또는 유튜브 링크면 그 영상 썸네일. AI 생성 썸네일은 쓰지 않는다.
function humorImage(post: HumorPost): string | undefined {
  const media = resolveMedia(post.mediaUrl);
  if (media?.type === 'image') return media.src;
  if (media?.type === 'youtube') return youtubeThumb(post.mediaUrl);
  return undefined;
}

// 유머는 제목이 없다. 본문 첫 줄을 제목처럼 쓰되 너무 길면 자른다.
function humorTitle(body: string): string {
  const firstLine = body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return '유머';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

export function buildHomeFeed(sources: HomeFeedSources): HomeFeedItem[] {
  const items: HomeFeedItem[] = [
    ...sources.agendas.map(
      (agenda): HomeFeedItem => ({
        id: `agenda:${agenda.id}`,
        section: 'agenda',
        kind: 'agenda',
        title: agenda.title,
        createdAt: agenda.createdAt,
        meta: agenda.status,
      }),
    ),
    ...sources.actionItems.map(
      (item): HomeFeedItem => ({
        id: `action:${item.id}`,
        section: 'actions',
        kind: 'action',
        title: item.title,
        createdAt: item.createdAt,
        meta: item.status,
      }),
    ),
    // 스토리 줄에 오르는 번개는 피드에서 뺀다 — 같은 걸 위아래로 두 번 보여주는 꼴이 된다.
    // 조건을 스토리(!canceled && flash)와 똑같이 맞춘 이유: 취소된 번개는 스토리에 안 뜨므로
    // 피드에까지 빼 버리면 '취소됨'을 알릴 자리가 홈에서 사라진다.
    ...sources.gatherings
      .filter((gathering) => gathering.canceled || gathering.kind !== 'flash')
      .map(
      (gathering): HomeFeedItem => ({
        id: `gathering:${gathering.id}`,
        section: 'gatherings',
        kind: 'gathering',
        title: gathering.title,
        createdAt: gathering.createdAt,
        imageUrl: gathering.imageUrl,
        meta: gathering.canceled ? '취소됨' : gathering.kind === 'flash' ? '번개' : '공모',
      }),
    ),
    ...sources.humorPosts.map(
      (post): HomeFeedItem => ({
        id: `humor:${post.id}`,
        section: 'humor',
        kind: 'humor',
        title: humorTitle(post.body),
        createdAt: post.createdAt,
        imageUrl: humorImage(post),
        meta: `♥ ${post.likedBy.length}`,
      }),
    ),
    ...sources.marketItems.map(
      (marketItem): HomeFeedItem => ({
        id: `market:${marketItem.id}`,
        section: 'market',
        kind: 'market',
        title: marketItem.title,
        createdAt: marketItem.createdAt,
        imageUrl: marketItem.imageUrl,
        meta: marketItem.kind === 'giveaway' ? '나눔' : '경매',
      }),
    ),
  ];

  // 최신순. createdAt 은 도메인마다 'YYYY-MM-DD'(날짜만) 또는 ISO(시각까지) 라 포맷이 섞인다.
  // 날짜 단위까지는 정확히 내림차순이 되지만, 같은 날 안에서의 정확한 순서는 시각을 안 남긴
  // 도메인이 있어 보장하지 못한다. Array.sort 는 안정 정렬이라 같은 키는 입력 순서를 지킨다.
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, HOME_FEED_LIMIT);
}
