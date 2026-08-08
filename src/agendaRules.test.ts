import { describe, expect, it } from 'vitest';
import {
  applySelection,
  finalStatus,
  liveStatus,
  optionRate,
  participationRate,
  quorumFor,
  remainingVoters,
  settleAgendas,
  votesShortOfQuorum,
  winningOptions,
} from './agendaRules';
import type { Agenda, AgendaOption } from './types';

const TODAY = '2026-07-27';

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

/** 득표 수만 주면 선택지가 만들어지는 객관식 안건. */
const choiceAgenda = (counts: number[], patch: Partial<Agenda> = {}): Agenda => {
  const options: AgendaOption[] = counts.map((count, index) => ({
    id: `OPT-${index + 1}`,
    label: `선택지 ${index + 1}`,
    count,
  }));
  return agenda({
    voteType: '객관식',
    options,
    // 단일 선택이면 득표 합계가 곧 참여 인원이다. 복수 선택 케이스는 voterCount를 직접 넘긴다.
    voterCount: counts.reduce((sum, count) => sum + count, 0),
    ...patch,
  });
};

describe('quorumFor', () => {
  it('대상 인원의 1/3을 올림한 값', () => {
    expect(quorumFor(30)).toBe(10);
    expect(quorumFor(28)).toBe(10);
    expect(quorumFor(5)).toBe(2);
    expect(quorumFor(3)).toBe(1);
  });

  it('대상 인원이 없으면 0', () => {
    expect(quorumFor(0)).toBe(0);
  });
});

describe('liveStatus', () => {
  it('남은 전원이 반대해도 찬성이 많으면 조기 통과', () => {
    // 대상 5, 3:0 → 남은 2가 모두 반대해도 3 > 2
    expect(liveStatus(agenda({ approve: 3, reject: 0, eligibleCount: 5 }))).toBe('통과');
  });

  it('남은 표로 뒤집힐 수 있으면 계속 투표중', () => {
    // 대상 5, 2:0 → 남은 3이 모두 반대하면 2 < 3
    expect(liveStatus(agenda({ approve: 2, reject: 0, eligibleCount: 5 }))).toBe('투표중');
  });

  it('남은 전원이 찬성해도 과반이 안 되면 조기 부결', () => {
    // 대상 5, 0:3 → 남은 2가 모두 찬성해도 2 <= 3
    expect(liveStatus(agenda({ approve: 0, reject: 3, eligibleCount: 5 }))).toBe('부결');
  });

  it('아직 투표할 사람이 남았으면 과반이어도 닫지 않는다', () => {
    // 예전 구현은 '10표 이상 + 과반'이라 이 시점에 통과시켜 투표권을 뺏었다
    expect(liveStatus(agenda({ approve: 6, reject: 4, eligibleCount: 30 }))).toBe('투표중');
  });

  it('대상 인원 스냅샷이 없으면 남은 인원을 0으로 보고 즉시 판정한다', () => {
    expect(liveStatus(agenda({ approve: 1, reject: 0, eligibleCount: 0 }))).toBe('통과');
  });
});

describe('finalStatus', () => {
  it('정족수 미달이면 찬성이 많아도 부결', () => {
    // 대상 30 → 정족수 10인데 참여 6
    expect(finalStatus(agenda({ approve: 4, reject: 2, eligibleCount: 30 }))).toBe('부결');
  });

  it('정족수를 채우고 과반 찬성이면 통과', () => {
    expect(finalStatus(agenda({ approve: 8, reject: 4, eligibleCount: 30 }))).toBe('통과');
  });

  it('동수는 부결', () => {
    expect(finalStatus(agenda({ approve: 1, reject: 1, eligibleCount: 5 }))).toBe('부결');
  });
});

describe('settleAgendas', () => {
  it('마감일이 지난 안건을 닫고 최종 상태를 기록한다', () => {
    const [settled] = settleAgendas(
      [agenda({ approve: 3, reject: 8, eligibleCount: 30, deadline: '2026-07-01' })],
      TODAY,
    );

    expect(settled.status).toBe('부결');
    expect(settled.closedAt).toBe(TODAY);
  });

  it('마감 전이라도 이미 결과가 확정된 안건을 닫는다', () => {
    // 투표 이벤트에서만 상태를 갱신하면 이런 안건이 '투표중'으로 남는다
    const [settled] = settleAgendas(
      [agenda({ approve: 18, reject: 5, eligibleCount: 30, deadline: '2026-08-30' })],
      TODAY,
    );

    expect(settled.status).toBe('통과');
    expect(settled.closedAt).toBe(TODAY);
  });

  it('아직 뒤집힐 수 있는 안건은 건드리지 않고 배열 참조도 유지한다', () => {
    const input = [agenda({ approve: 2, reject: 1, eligibleCount: 30, deadline: '2026-08-30' })];
    expect(settleAgendas(input, TODAY)).toBe(input);
  });

  it('이미 닫힌 안건은 다시 닫지 않는다', () => {
    const input = [agenda({ status: '통과', closedAt: '2026-07-10', deadline: '2026-07-01' })];
    expect(settleAgendas(input, TODAY)).toBe(input);
  });
});

describe('집계 보조', () => {
  it('참여율은 대상 인원 대비 투표 수', () => {
    expect(participationRate(agenda({ approve: 18, reject: 5, eligibleCount: 30 }))).toBe(77);
  });

  it('대상 인원이 0이면 참여율은 0', () => {
    expect(participationRate(agenda({ approve: 3, reject: 0, eligibleCount: 0 }))).toBe(0);
  });

  it('집계가 대상 인원을 넘어도 남은 인원과 부족 표는 음수가 되지 않는다', () => {
    const overflow = agenda({ approve: 15, reject: 5, eligibleCount: 5 });
    expect(remainingVoters(overflow)).toBe(0);
    expect(votesShortOfQuorum(overflow)).toBe(0);
    expect(participationRate(overflow)).toBe(100);
  });
});

describe('객관식 판정', () => {
  it('남은 전원이 2위에 몰려도 1위가 그대로면 조기 결정', () => {
    // 대상 5, 4:1 → 남은 0
    expect(liveStatus(choiceAgenda([4, 1], { eligibleCount: 5 }))).toBe('결정됨');
  });

  it('남은 표로 1위가 뒤집힐 수 있으면 계속 투표중', () => {
    // 대상 30, 5:3 → 남은 22가 2위에 몰리면 25로 뒤집힌다
    expect(liveStatus(choiceAgenda([5, 3]))).toBe('투표중');
  });

  it('선택지가 두 개 미만이면 조기 판정하지 않는다', () => {
    expect(liveStatus(choiceAgenda([4], { eligibleCount: 5 }))).toBe('투표중');
  });

  it('마감 시 정족수를 채웠으면 결정됨', () => {
    // 대상 30 → 정족수 10, 참여 12
    expect(finalStatus(choiceAgenda([7, 5]))).toBe('결정됨');
  });

  it('마감 시 정족수 미달이면 성립하지 않아 부결', () => {
    expect(finalStatus(choiceAgenda([3, 2]))).toBe('부결');
  });

  it('1위가 동점이어도 마감되면 결정됨이고, 승자는 여러 개로 나온다', () => {
    const tied = choiceAgenda([6, 6]);
    expect(finalStatus(tied)).toBe('결정됨');
    expect(winningOptions(tied).map((option) => option.id)).toEqual(['OPT-1', 'OPT-2']);
  });

  it('표가 하나도 없으면 승자가 없다', () => {
    expect(winningOptions(choiceAgenda([0, 0]))).toEqual([]);
  });
});

describe('applySelection', () => {
  it('찬반은 고른 쪽 카운터만 올린다', () => {
    const next = applySelection(agenda(), { kind: '찬반', choice: 'approve' });
    expect(next).toMatchObject({ approve: 1, reject: 0 });
  });

  it('객관식은 고른 선택지와 참여 인원을 함께 올린다', () => {
    const next = applySelection(choiceAgenda([0, 0]), { kind: '객관식', optionIds: ['OPT-2'] });
    expect(next?.options.map((option) => option.count)).toEqual([0, 1]);
    expect(next?.voterCount).toBe(1);
  });

  it('복수 선택 안건은 고른 만큼 득표가 오르지만 참여 인원은 1명만 는다', () => {
    const next = applySelection(choiceAgenda([0, 0, 0], { multiSelect: true }), {
      kind: '객관식',
      optionIds: ['OPT-1', 'OPT-3'],
    });
    expect(next?.options.map((option) => option.count)).toEqual([1, 0, 1]);
    expect(next?.voterCount).toBe(1);
  });

  it('하나만 고르는 안건에 여러 개가 올라오면 통째로 거절한다', () => {
    expect(applySelection(choiceAgenda([0, 0]), { kind: '객관식', optionIds: ['OPT-1', 'OPT-2'] })).toBeNull();
  });

  it('같은 선택지를 두 번 보내도 한 표로만 센다', () => {
    const next = applySelection(choiceAgenda([0, 0]), { kind: '객관식', optionIds: ['OPT-1', 'OPT-1'] });
    expect(next?.options.map((option) => option.count)).toEqual([1, 0]);
  });

  it('없는 선택지만 가리키면 반영하지 않는다', () => {
    expect(applySelection(choiceAgenda([0, 0]), { kind: '객관식', optionIds: ['OPT-9'] })).toBeNull();
  });

  it('투표 방식과 선택 종류가 어긋나면 반영하지 않는다', () => {
    expect(applySelection(choiceAgenda([0, 0]), { kind: '찬반', choice: 'approve' })).toBeNull();
    expect(applySelection(agenda(), { kind: '객관식', optionIds: ['OPT-1'] })).toBeNull();
  });
});

describe('객관식 비율', () => {
  it('선택지 비율은 총 득표가 아니라 참여 인원 대비로 센다', () => {
    // 3명이 참여했고 그중 3명 모두가 OPT-1을 골랐다 → 100%
    const multi = choiceAgenda([3, 2], { multiSelect: true, voterCount: 3 });
    expect(optionRate(multi, multi.options[0])).toBe(100);
    expect(optionRate(multi, multi.options[1])).toBe(67);
  });

  it('참여자가 없으면 0%', () => {
    const empty = choiceAgenda([0, 0]);
    expect(optionRate(empty, empty.options[0])).toBe(0);
  });
});
