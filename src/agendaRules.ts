import type { Agenda, AgendaOption, AgendaStatus, VoteSelection } from './types';

/**
 * 집계에 필요한 최소 조각. 찬반과 객관식이 서로 다른 필드를 쓰기 때문에 한 덩어리로 묶어 다닌다.
 */
type Tally = Pick<Agenda, 'approve' | 'reject' | 'voteType' | 'options' | 'voterCount'>;
type TallyWithEligible = Tally & Pick<Agenda, 'eligibleCount'>;

/**
 * 안건이 성립하려면 대상 인원 중 이 비율 이상이 투표해야 한다.
 * 두세 명이 던진 표로 팀 규칙이 바뀌는 것을 막는 최소 정족수다.
 */
export const QUORUM_RATIO = 1 / 3;

export function quorumFor(eligibleCount: number) {
  return eligibleCount > 0 ? Math.ceil(eligibleCount * QUORUM_RATIO) : 0;
}

export function isOpen(agenda: Agenda) {
  return agenda.status === '투표중' && !agenda.closedAt;
}

export function isDeadlinePassed(agenda: Agenda, today: string) {
  return Boolean(agenda.deadline) && agenda.deadline < today;
}

/**
 * 투표에 참여한 '사람' 수.
 *
 * 찬반은 한 사람이 한 표라 approve + reject가 곧 인원이다. 객관식은 복수 선택이 열려 있으면
 * 선택지 득표를 합쳤을 때 인원을 넘으므로 따로 세어둔 voterCount를 쓴다.
 * 정족수·참여율·남은 인원은 모두 '사람' 기준이어야 해서 여기서 한 번에 맞춘다.
 */
export function voteTotal(agenda: Pick<Agenda, 'approve' | 'reject' | 'voteType' | 'voterCount'>) {
  return agenda.voteType === '객관식' ? agenda.voterCount : agenda.approve + agenda.reject;
}

/** 아직 투표하지 않은 대상 인원. 집계가 대상 인원을 넘어도 음수가 되지 않게 막는다. */
export function remainingVoters(agenda: TallyWithEligible) {
  return Math.max(0, agenda.eligibleCount - voteTotal(agenda));
}

export function participationRate(agenda: TallyWithEligible) {
  if (agenda.eligibleCount <= 0) return 0;
  // 대상 인원 스냅샷보다 참여자가 많은 안건이 실제로 있다(등록 후 계정이 늘어난 경우).
  // 참여율이 100%를 넘어 보이면 읽는 사람이 집계를 의심하게 되므로 여기서 자른다.
  return Math.min(100, Math.round((voteTotal(agenda) / agenda.eligibleCount) * 100));
}

/**
 * 최다 득표 선택지. 동점이면 여러 개가 나오고, 아직 표가 없으면 빈 배열이다.
 * "하나로 정해졌는가"를 판단하는 쪽에서 length === 1인지 보면 된다.
 */
export function winningOptions(agenda: Pick<Agenda, 'options'>): AgendaOption[] {
  const top = agenda.options.reduce((max, option) => Math.max(max, option.count), 0);
  if (top === 0) return [];
  return agenda.options.filter((option) => option.count === top);
}

/**
 * 선택지를 고른 '사람'의 비율.
 *
 * 총 투표수가 아니라 참여 인원으로 나눈다. 복수 선택 안건에서 득표 합계로 나누면
 * "3명 중 3명이 골랐는데 33%"처럼 실제보다 작아 보인다.
 * 대신 복수 선택에서는 선택지 비율의 합이 100%를 넘을 수 있다 — 그게 사실이다.
 */
export function optionRate(agenda: Tally, option: AgendaOption) {
  const voters = voteTotal(agenda);
  return voters === 0 ? 0 : Math.round((option.count / voters) * 100);
}

/**
 * 투표 중인 안건의 상태.
 *
 * 조기 확정은 **남은 사람이 전부 반대로 몰려도 결과가 뒤집히지 않을 때만** 한다.
 * 예전 구현은 '10표 이상 + 과반'이면 곧바로 통과시켰는데, 두 가지가 잘못됐다.
 *  - 10이 고정값이라 대상이 5명인 안건은 조기 판정에 영원히 도달하지 못했다.
 *  - 아직 투표할 수 있는 사람이 남았는데 안건을 닫아 투표권을 빼앗았다.
 */
export function liveStatus(agenda: TallyWithEligible): AgendaStatus {
  const remaining = remainingVoters(agenda);

  if (agenda.voteType === '객관식') {
    // 겨룰 상대가 없으면 판정할 것도 없다. 폼에서 2개 이상을 강제하지만 DB에서 온 값은 믿지 않는다.
    if (agenda.options.length < 2) return '투표중';

    const counts = agenda.options.map((option) => option.count).sort((a, b) => b - a);
    // 남은 전원이 2위에 몰려도 1위가 그대로다 → 결정 확정.
    // 복수 선택이어도 한 사람이 한 선택지에 더할 수 있는 표는 최대 1이라 같은 식이 성립한다.
    return counts[0] > counts[1] + remaining ? '결정됨' : '투표중';
  }

  const { approve, reject } = agenda;
  // 남은 전원이 반대해도 찬성이 많다 → 통과 확정
  if (approve > reject + remaining) return '통과';
  // 남은 전원이 찬성해도 찬성이 과반을 넘지 못한다 → 부결 확정
  if (approve + remaining <= reject) return '부결';

  return '투표중';
}

/**
 * 마감 시점의 최종 상태.
 * 정족수 미달이면 찬성이 많아도 성립하지 않은 것으로 본다.
 * 마감했는데 '투표중'으로 남는 안건은 없어야 하므로 통과가 아니면 전부 부결이다.
 */
export function finalStatus(agenda: TallyWithEligible): AgendaStatus {
  const total = voteTotal(agenda);
  if (total < quorumFor(agenda.eligibleCount)) return '부결';
  // 객관식은 받아들이고 말고가 아니라 어디로 정해졌는가를 묻는다. 정족수만 채우면 결과가 선다.
  // 1위가 동점이어도 '결정됨'이다 — 무엇으로 정해졌는지는 winningOptions가 답하고,
  // 화면은 동점임을 그대로 알린다. 표를 다 받고도 상태가 '투표중'으로 남는 안건은 없어야 한다.
  if (agenda.voteType === '객관식') return '결정됨';
  return agenda.approve > agenda.reject ? '통과' : '부결';
}

/**
 * 한 사람의 선택을 집계에 더한 안건을 돌려준다. 반영할 것이 없으면 null.
 *
 * 반드시 투표용지를 남기기 전에 부르고, null이면 투표를 통째로 취소해야 한다.
 * 투표용지는 한 번 쓰면 지울 수 없어서, 집계에 못 들어간 선택으로 그냥 진행하면
 * 표는 안 들어가고 투표권만 사라진다.
 */
export function applySelection(agenda: Agenda, selection: VoteSelection): Agenda | null {
  if (agenda.voteType === '객관식') {
    if (selection.kind !== '객관식') return null;

    // Set으로 받아 같은 id가 두 번 올라와도 한 표로만 센다.
    const picked = new Set(selection.optionIds);
    const hits = agenda.options.filter((option) => picked.has(option.id));
    if (hits.length === 0) return null;
    // 하나만 고르는 안건에 여러 개가 올라오면 득표 합계가 인원과 어긋난다. 통째로 거절한다.
    if (!agenda.multiSelect && hits.length > 1) return null;

    return {
      ...agenda,
      options: agenda.options.map((option) =>
        picked.has(option.id) ? { ...option, count: option.count + 1 } : option,
      ),
      voterCount: agenda.voterCount + 1,
    };
  }

  if (selection.kind !== '찬반') return null;
  return { ...agenda, [selection.choice]: agenda[selection.choice] + 1 };
}

/**
 * 열린 안건들의 상태를 현재 집계에 맞춰 확정한다. 로드 시점에 한 번 적용한다.
 *
 * 투표 이벤트에서만 상태를 갱신하면, 이미 결과가 확정된 안건이 '투표중'으로 남는다.
 * 마감일이 지났거나 남은 표로 뒤집을 수 없는 안건은 여기서 모두 닫힌다.
 */
export function settleAgendas(agendas: Agenda[], today: string) {
  let changed = false;

  const next = agendas.map((agenda) => {
    if (!isOpen(agenda)) return agenda;

    if (isDeadlinePassed(agenda, today)) {
      changed = true;
      return { ...agenda, status: finalStatus(agenda), closedAt: today };
    }

    const decided = liveStatus(agenda);
    if (decided === '투표중') return agenda;

    changed = true;
    return { ...agenda, status: decided, closedAt: today };
  });

  return changed ? next : agendas;
}

/** 남은 일수. 마감일이 없으면 null. */
export function daysLeft(agenda: Agenda, today: string) {
  if (!agenda.deadline) return null;
  const diff = Date.parse(agenda.deadline) - Date.parse(today);
  return Math.round(diff / 86400000);
}

/** 정족수까지 더 필요한 표. 이미 채웠으면 0. */
export function votesShortOfQuorum(agenda: TallyWithEligible) {
  return Math.max(0, quorumFor(agenda.eligibleCount) - voteTotal(agenda));
}
