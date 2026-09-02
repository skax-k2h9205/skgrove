import { describe, expect, it } from 'vitest';
import { buildHomeFeed, HOME_FEED_LIMIT, type HomeFeedSources } from './homeFeed';
import type { ActionItem, Agenda, Gathering, MarketItem, TeamMemory } from './types';

const agenda = (patch: Partial<Agenda> = {}): Agenda =>
  ({ id: 'AG1', title: '회의실 예약 규칙', status: '투표중', createdAt: '2026-08-01', ...patch }) as Agenda;

const action = (patch: Partial<ActionItem> = {}): ActionItem =>
  ({ id: 'AC1', title: '위키 정리', status: '진행중', createdAt: '2026-08-02', ...patch }) as ActionItem;

const gathering = (patch: Partial<Gathering> = {}): Gathering =>
  ({ id: 'GAT1', kind: 'callup', title: '점심 공모', createdAt: '2026-08-03', canceled: false, ...patch }) as Gathering;

// 팀추억: 행사 날짜(date)를 정렬 키로, assets 중 previewUrl 있는 첫 자산을 썸네일로 쓴다.
const memory = (patch: Partial<TeamMemory> = {}): TeamMemory =>
  ({ id: 1, title: '워크샵 회고', date: '2026-08-04', place: '양양', assets: [], ...patch }) as TeamMemory;

const asset = (previewUrl?: string) => ({ previewUrl }) as TeamMemory['assets'][number];

const market = (patch: Partial<MarketItem> = {}): MarketItem =>
  ({ id: 'M1', kind: 'auction', title: '기계식 키보드', createdAt: '2026-08-05', ...patch }) as MarketItem;

const empty: HomeFeedSources = { agendas: [], actionItems: [], gatherings: [], memories: [], marketItems: [] };

describe('buildHomeFeed', () => {
  it('빈 입력이면 빈 배열', () => {
    expect(buildHomeFeed(empty)).toEqual([]);
  });

  it('다섯 도메인을 하나로 합쳐 최신순(createdAt 내림차순)으로 정렬한다', () => {
    const feed = buildHomeFeed({
      agendas: [agenda({ createdAt: '2026-08-01' })],
      actionItems: [action({ createdAt: '2026-08-02' })],
      gatherings: [gathering({ createdAt: '2026-08-03' })],
      memories: [memory({ date: '2026-08-04' })],
      marketItems: [market({ createdAt: '2026-08-05' })],
    });
    expect(feed.map((item) => item.kind)).toEqual(['market', 'memory', 'gathering', 'action', 'agenda']);
  });

  it('도메인 접두어 id·section·kind 를 붙인다', () => {
    const feed = buildHomeFeed({ ...empty, gatherings: [gathering()] });
    expect(feed[0]).toMatchObject({ id: 'gathering:GAT1', section: 'gatherings', kind: 'gathering', title: '점심 공모' });
  });

  it('최근 HOME_FEED_LIMIT개로 자른다', () => {
    const many = Array.from({ length: HOME_FEED_LIMIT + 15 }, (_, index) =>
      action({ id: `AC${index}`, createdAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}` }),
    );
    expect(buildHomeFeed({ ...empty, actionItems: many })).toHaveLength(HOME_FEED_LIMIT);
  });

  it('안건·액션은 이미지가 없고, 번개·팀추억·장터는 이미지가 있으면 담는다', () => {
    const feed = buildHomeFeed({
      ...empty,
      agendas: [agenda()],
      gatherings: [gathering({ imageUrl: 'https://x/y.jpg' })],
    });
    const byKind = Object.fromEntries(feed.map((item) => [item.kind, item.imageUrl]));
    expect(byKind.agenda).toBeUndefined();
    expect(byKind.gathering).toBe('https://x/y.jpg');
  });

  it('팀추억 썸네일 = previewUrl 있는 첫 자산 / 없으면 없음', () => {
    const withPhoto = buildHomeFeed({
      ...empty,
      memories: [memory({ assets: [asset(undefined), asset('https://x/pic.png')] })],
    });
    expect(withPhoto[0].imageUrl).toBe('https://x/pic.png');

    const noPhoto = buildHomeFeed({ ...empty, memories: [memory({ assets: [] })] });
    expect(noPhoto[0].imageUrl).toBeUndefined();
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

/*
  번개는 홈 스토리 줄이 맡는다. 피드에까지 넣으면 같은 모임이 위아래로 두 번 보인다.
  다만 취소된 번개는 스토리에 안 뜨므로, 피드에서까지 빼면 '취소됨'을 알릴 자리가 없어진다.
*/
describe('번개와 스토리 중복', () => {
  it('모집중 번개는 피드에서 뺀다', () => {
    const feed = buildHomeFeed({ ...empty, gatherings: [gathering({ id: 'G-FLASH', kind: 'flash' })] });
    expect(feed.find((item) => item.id === 'gathering:G-FLASH')).toBeUndefined();
  });

  it('취소된 번개는 피드에 남는다', () => {
    const feed = buildHomeFeed({ ...empty, gatherings: [gathering({ id: 'G-DEAD', kind: 'flash', canceled: true })] });
    expect(feed.find((item) => item.id === 'gathering:G-DEAD')?.meta).toBe('취소됨');
  });

  it('공모는 그대로 피드에 남는다', () => {
    const feed = buildHomeFeed({ ...empty, gatherings: [gathering({ id: 'G-CALL', kind: 'callup' })] });
    expect(feed.find((item) => item.id === 'gathering:G-CALL')?.meta).toBe('공모');
  });
});
