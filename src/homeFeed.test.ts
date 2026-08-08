import { describe, expect, it } from 'vitest';
import { buildHomeFeed, HOME_FEED_LIMIT, type HomeFeedSources } from './homeFeed';
import type { ActionItem, Agenda, Gathering, HumorPost, MarketItem } from './types';

const agenda = (patch: Partial<Agenda> = {}): Agenda =>
  ({ id: 'AG1', title: '회의실 예약 규칙', status: '투표중', createdAt: '2026-08-01', ...patch }) as Agenda;

const action = (patch: Partial<ActionItem> = {}): ActionItem =>
  ({ id: 'AC1', title: '위키 정리', status: '진행중', createdAt: '2026-08-02', ...patch }) as ActionItem;

const gathering = (patch: Partial<Gathering> = {}): Gathering =>
  ({ id: 'GAT1', kind: 'flash', title: '점심 번개', createdAt: '2026-08-03', canceled: false, ...patch }) as Gathering;

const humor = (patch: Partial<HumorPost> = {}): HumorPost =>
  ({ id: 'H1', author: '김승현', body: '오늘의 짤', mediaUrl: '', createdAt: '2026-08-04', likedBy: [], ...patch }) as HumorPost;

const market = (patch: Partial<MarketItem> = {}): MarketItem =>
  ({ id: 'M1', kind: 'auction', title: '기계식 키보드', createdAt: '2026-08-05', ...patch }) as MarketItem;

const empty: HomeFeedSources = { agendas: [], actionItems: [], gatherings: [], humorPosts: [], marketItems: [] };

describe('buildHomeFeed', () => {
  it('빈 입력이면 빈 배열', () => {
    expect(buildHomeFeed(empty)).toEqual([]);
  });

  it('다섯 도메인을 하나로 합쳐 최신순(createdAt 내림차순)으로 정렬한다', () => {
    const feed = buildHomeFeed({
      agendas: [agenda({ createdAt: '2026-08-01' })],
      actionItems: [action({ createdAt: '2026-08-02' })],
      gatherings: [gathering({ createdAt: '2026-08-03' })],
      humorPosts: [humor({ createdAt: '2026-08-04' })],
      marketItems: [market({ createdAt: '2026-08-05' })],
    });
    expect(feed.map((item) => item.kind)).toEqual(['market', 'humor', 'gathering', 'action', 'agenda']);
  });

  it('도메인 접두어 id·section·kind 를 붙인다', () => {
    const feed = buildHomeFeed({ ...empty, gatherings: [gathering()] });
    expect(feed[0]).toMatchObject({ id: 'gathering:GAT1', section: 'gatherings', kind: 'gathering', title: '점심 번개' });
  });

  it('최근 HOME_FEED_LIMIT개로 자른다', () => {
    const many = Array.from({ length: HOME_FEED_LIMIT + 15 }, (_, index) =>
      action({ id: `AC${index}`, createdAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}` }),
    );
    expect(buildHomeFeed({ ...empty, actionItems: many })).toHaveLength(HOME_FEED_LIMIT);
  });

  it('안건·액션은 이미지가 없고, 번개·유머·장터는 이미지가 있으면 담는다', () => {
    const feed = buildHomeFeed({
      ...empty,
      agendas: [agenda()],
      gatherings: [gathering({ imageUrl: 'https://x/y.jpg' })],
    });
    const byKind = Object.fromEntries(feed.map((item) => [item.kind, item.imageUrl]));
    expect(byKind.agenda).toBeUndefined();
    expect(byKind.gathering).toBe('https://x/y.jpg');
  });

  it('유머 배경 = 붙인 이미지 / 유튜브면 영상 썸네일 / 그 외엔 없음(AI 생성 썸네일 미사용)', () => {
    const withImage = buildHomeFeed({ ...empty, humorPosts: [humor({ mediaUrl: 'https://x/pic.png' })] });
    expect(withImage[0].imageUrl).toBe('https://x/pic.png');

    const withYoutube = buildHomeFeed({ ...empty, humorPosts: [humor({ mediaUrl: 'https://youtu.be/dQw4w9WgXcQ' })] });
    expect(withYoutube[0].imageUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');

    // 미디어 없음 + (옛) imageUrl 있어도 이제 배경으로 쓰지 않는다.
    const noMedia = buildHomeFeed({ ...empty, humorPosts: [humor({ mediaUrl: '', imageUrl: 'https://x/thumb.png' })] });
    expect(noMedia[0].imageUrl).toBeUndefined();
  });

  it('메타에 도메인별 상태를 담는다 (취소된 번개 표시 포함)', () => {
    const feed = buildHomeFeed({
      ...empty,
      gatherings: [gathering({ id: 'G2', canceled: true, createdAt: '2026-08-09' })],
      marketItems: [market({ id: 'M2', kind: 'giveaway', createdAt: '2026-08-08' })],
    });
    expect(feed.find((item) => item.id === 'gathering:G2')?.meta).toBe('취소됨');
    expect(feed.find((item) => item.id === 'market:M2')?.meta).toBe('나눔');
  });
});
