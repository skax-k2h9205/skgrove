import { describe, expect, it } from 'vitest';
import type { Agenda } from '../../types';
import { approveRate, filterAgendas, leadRate, sortAgendas } from './agendaSort';

const agenda = (patch: Partial<Agenda> = {}): Agenda => ({
  id: 'AGD-T',
  title: '테스트 안건',
  description: '',
  category: '회의문화',
  source: '직접 등록',
  part: '전체',
  author: '익명',
  authorName: '',
  approve: 0,
  reject: 0,
  voteType: '찬반',
  options: [],
  multiSelect: false,
  voterCount: 0,
  status: '투표중',
  createdAt: '2026-07-20',
  eligibleCount: 30,
  deadline: '',
  closedAt: '',
  ...patch,
});

const choiceAgenda = (counts: number[], patch: Partial<Agenda> = {}): Agenda =>
  agenda({
    voteType: '객관식',
    options: counts.map((count, index) => ({ id: `OPT-${index + 1}`, label: `선택지 ${index + 1}`, count })),
    voterCount: counts.reduce((sum, count) => sum + count, 0),
    ...patch,
  });

describe('approveRate', () => {
  it('투표가 없으면 0', () => {
    expect(approveRate(agenda())).toBe(0);
  });

  it('찬성 비율을 반올림한다', () => {
    expect(approveRate(agenda({ approve: 18, reject: 5 }))).toBe(78);
  });
});

describe('leadRate', () => {
  it('찬반은 찬성률을 그대로 쓴다', () => {
    expect(leadRate(agenda({ approve: 18, reject: 5 }))).toBe(78);
  });

  it('객관식은 1위 선택지의 비율을 쓴다', () => {
    // 표가 있는데도 0%로 계산되면 객관식이 목록 맨 아래에 깔린다
    expect(leadRate(choiceAgenda([7, 3]))).toBe(70);
  });

  it('투표가 없는 객관식은 0', () => {
    expect(leadRate(choiceAgenda([0, 0]))).toBe(0);
  });
});

describe('filterAgendas', () => {
  const list = [
    agenda({ id: 'all', part: '전체', title: '전사 공통 안건' }),
    agenda({ id: 'its', part: 'ITS혁신파트', title: 'ITS 전용 안건' }),
    agenda({ id: 'done', part: '전체', status: '통과', title: '끝난 안건' }),
  ];

  it('대상이 전체인 안건은 어느 파트를 골라도 보인다', () => {
    // 그러지 않으면 팀 전체 안건이 파트원 화면에서 사라져 투표율이 떨어진다
    const ids = filterAgendas(list, { status: '전체', part: 'TEST혁신파트', keyword: '' }).map((a) => a.id);
    expect(ids).toContain('all');
    expect(ids).not.toContain('its');
  });

  it('상태로 거른다', () => {
    expect(filterAgendas(list, { status: '통과', part: '전체', keyword: '' }).map((a) => a.id)).toEqual(['done']);
  });

  it('키워드는 제목·설명·카테고리를 훑는다', () => {
    expect(filterAgendas(list, { status: '전체', part: '전체', keyword: 'ITS' }).map((a) => a.id)).toEqual(['its']);
  });
});

describe('sortAgendas', () => {
  const list = [
    agenda({ id: 'closed-new', status: '통과', createdAt: '2026-07-25' }),
    agenda({ id: 'open-old', status: '투표중', createdAt: '2026-07-10', approve: 9, reject: 1 }),
    agenda({ id: 'open-new', status: '투표중', createdAt: '2026-07-20', approve: 1, reject: 1 }),
  ];

  it('투표중 안건이 항상 위로 온다', () => {
    // 끝난 안건이 최신이라는 이유로 상단을 차지하면 목록의 행동 유도가 죽는다
    expect(sortAgendas(list, '최신순').map((a) => a.id)).toEqual(['open-new', 'open-old', 'closed-new']);
  });

  it('참여순은 투표중 안건 안에서 총 투표 수로 정렬한다', () => {
    expect(sortAgendas(list, '참여순').map((a) => a.id)).toEqual(['open-old', 'open-new', 'closed-new']);
  });

  it('우세율순은 찬반과 객관식을 같은 축에 놓는다', () => {
    const mixed = [
      agenda({ id: 'binary', status: '투표중', approve: 6, reject: 4 }),
      choiceAgenda([8, 2], { id: 'choice', status: '투표중' }),
    ];
    // 찬반 60% vs 객관식 1위 80% → 객관식이 위
    expect(sortAgendas(mixed, '우세율순').map((a) => a.id)).toEqual(['choice', 'binary']);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const input = [...list];
    sortAgendas(input, '참여순');
    expect(input.map((a) => a.id)).toEqual(list.map((a) => a.id));
  });
});
