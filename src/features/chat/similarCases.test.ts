import { describe, expect, it } from 'vitest';
import { findSimilarCases } from './similarCases';
import type { Agenda, Issue } from '../../types';

function issue(over: Partial<Issue>): Issue {
  return {
    id: 'ISS-1', title: '', category: '', author: '익명', target: '', status: '접수',
    urgency: '보통', body: '', expectedChange: '', visibility: '전체', createdAt: '2026-08-01',
    ...over,
  } as Issue;
}
function agenda(over: Partial<Agenda>): Agenda {
  return {
    id: 'AGD-1', title: '', description: '', category: '', source: '', part: 'ITS혁신파트',
    author: '익명', authorName: '', approve: 0, reject: 0, voteType: '찬반', options: [],
    multiSelect: false, voterCount: 0, status: '투표중', createdAt: '2026-08-01',
    eligibleCount: 0, deadline: '', closedAt: '',
    ...over,
  } as Agenda;
}

describe('findSimilarCases', () => {
  it('키워드가 겹치는 접수·안건을 점수순으로 돌려준다', () => {
    const issues = [
      issue({ id: 'A', title: '회의 시간 갈등', body: '회의가 너무 길어 협업이 힘들어요' }),
      issue({ id: 'B', title: '주차 안내', body: '주차장이 좁아요' }),
    ];
    const agendas = [agenda({ id: 'C', title: '회의 문화 개선', description: '회의 협업 방식을 바꾸자' })];

    const out = findSimilarCases('회의 협업이 힘들다', issues, agendas, 3);
    const ids = out.map((c) => c.id);
    expect(ids).toContain('A');
    expect(ids).toContain('C');
    expect(ids).not.toContain('B'); // 겹치는 단어 없음
  });

  it('겹치는 단어가 없으면 빈 배열', () => {
    const out = findSimilarCases('주말 등산 모임', [issue({ id: 'A', title: '전표 승인', body: '비용 정산' })], [], 3);
    expect(out).toEqual([]);
  });

  it('limit 을 넘지 않는다', () => {
    const issues = Array.from({ length: 8 }, (_, i) => issue({ id: `I${i}`, title: '협업 갈등', body: '협업이 어렵다' }));
    expect(findSimilarCases('협업 갈등', issues, [], 3)).toHaveLength(3);
  });
});
