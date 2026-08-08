import { optionRate, voteTotal, winningOptions } from '../../agendaRules';
import type { Agenda, AgendaStatus, TeamPart } from '../../types';

export type AgendaStatusFilter = '전체' | AgendaStatus;
export type AgendaSort = '최신순' | '참여순' | '우세율순';

export const agendaStatusFilters: AgendaStatusFilter[] = ['전체', '투표중', '통과', '결정됨', '부결'];
export const agendaSorts: AgendaSort[] = ['최신순', '참여순', '우세율순'];

/** 찬반 안건의 찬성률. 객관식에는 찬성이라는 축이 없어 0이 나온다. */
export function approveRate(agenda: Pick<Agenda, 'approve' | 'reject' | 'voteType' | 'voterCount'>) {
  const total = voteTotal(agenda);
  return total === 0 ? 0 : Math.round((agenda.approve / total) * 100);
}

/**
 * 1위가 얼마나 앞서 있는지. 찬반이면 찬성률, 객관식이면 최다 득표 선택지의 비율이다.
 *
 * 정렬에 approveRate를 그대로 쓰면 객관식은 늘 0%로 계산되어 목록 맨 아래에 깔린다.
 * "얼마나 한쪽으로 기울었는가"라는 축은 두 방식에 모두 있으므로 이 값으로 줄을 세운다.
 */
export function leadRate(agenda: Agenda) {
  if (agenda.voteType !== '객관식') return approveRate(agenda);
  const [top] = winningOptions(agenda);
  return top ? optionRate(agenda, top) : 0;
}

type AgendaFilters = {
  status: AgendaStatusFilter;
  part: TeamPart;
  keyword: string;
};

export function filterAgendas(agendas: Agenda[], { status, part, keyword }: AgendaFilters) {
  const query = keyword.trim().toLowerCase();

  return agendas.filter((agenda) => {
    if (status !== '전체' && agenda.status !== status) return false;
    // '전체' 대상 안건은 어느 파트를 골라도 보인다.
    if (part !== '전체' && agenda.part !== part && agenda.part !== '전체') return false;
    if (!query) return true;
    return `${agenda.title} ${agenda.description} ${agenda.category}`.toLowerCase().includes(query);
  });
}

// 정렬 정책: 아직 투표할 수 있는 안건이 항상 위로 온다.
// 이미 끝난 안건이 최신이라는 이유로 위를 차지하면 목록의 행동 유도가 죽는다.
export function sortAgendas(agendas: Agenda[], sort: AgendaSort) {
  const openFirst = (a: Agenda, b: Agenda) => Number(b.status === '투표중') - Number(a.status === '투표중');

  return [...agendas].sort((a, b) => {
    const byOpen = openFirst(a, b);
    if (byOpen !== 0) return byOpen;

    if (sort === '참여순') return voteTotal(b) - voteTotal(a);
    if (sort === '우세율순') return leadRate(b) - leadRate(a);
    return b.createdAt.localeCompare(a.createdAt);
  });
}
