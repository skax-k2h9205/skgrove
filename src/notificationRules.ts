// 알림 기준 정의 (SKSOOP-110). "어떤 이벤트가 → 누구에게 → 어떤 알림을" 을 한 곳에 명문화.
// 순수 함수만 두어 단위 테스트로 회귀 검증한다(팀 관례: *Rules.ts). React·상태 의존 없음.
import { daysLeft, isOpen } from './agendaRules';
import type {
  ActionItem,
  Agenda,
  AppNotification,
  Gathering,
  HumorPost,
  Issue,
  ManagedAccount,
  MarketBid,
  MarketItem,
  TeaSession,
} from './types';

// 마감 며칠 전부터 "임박" 알림을 낼지.
export const DEADLINE_SOON_DAYS = 2;

// id는 발송 시점에 부여하므로 규칙 단계에선 나머지(draft)만 만든다.
export type NotificationDraft = Omit<AppNotification, 'id'>;

// 슬랙 전송 채널(1단계: 고정 채널). 개인 대상(action/message)은 null → 슬랙 미전송.
export type SlackChannel = 'team' | 'connector';

export function slackChannelForKind(kind: AppNotification['kind']): SlackChannel | null {
  if (kind === 'agenda' || kind === 'deadline') return 'team'; // 공지성 → 팀 전체
  if (kind === 'tea' || kind === 'issue') return 'connector'; // 제안·접수 → 커넥셔너
  // action, message, gathering, market → 인앱만.
  // 승계·취소·상회 입찰은 특정 개인에게만 뜻이 있는 소식이라 팀 채널에 뿌리면 소음이 된다.
  return null;
}

// 같은 이벤트가 같은 수신자에게 중복 생성되는 것을 막는 키(특히 로드마다 계산되는 마감 임박).
export function dedupeKey(kind: AppNotification['kind'], sourceId: string, recipientName: string) {
  return `${kind}:${sourceId}:${recipientName}`;
}

// ── 수신자 해석 ─────────────────────────────────────────────
// 의견 접수(111): 접수 폼의 target에 맞는 활성 리더.
export function leadersFor(accounts: ManagedAccount[], target: string): ManagedAccount[] {
  const leaders = accounts.filter(
    (a) => a.status === '활성' && (a.role === '파트리더' || a.role === '팀리더'),
  );
  if (target === '팀리더') return leaders.filter((a) => a.role === '팀리더');
  if (target === '파트리더') return leaders.filter((a) => a.role === '파트리더'); // 레거시 · 파트리더 전원
  if (target === '리더 전체') return leaders;
  // 접수 폼에서 특정 파트리더를 이름으로 골랐으면 그 한 사람에게만 전달.
  // (익명이어도 대상이 명시적이라 라우팅에 작성자 파트가 필요 없다.)
  const chosen = leaders.filter((a) => a.name === target);
  return chosen.length > 0 ? chosen : leaders;
}

// 안건 등록(112)·마감 임박(113): 해당 파트의 투표 대상자(활성). 전체 소속(팀리더)도 포함.
export function agendaAudience(accounts: ManagedAccount[], part: Agenda['part']): ManagedAccount[] {
  return accounts.filter(
    (a) => a.status === '활성' && (part === '전체' || a.part === part || a.part === '전체'),
  );
}

// 액션 담당자(114): 이름으로 매칭되는 활성 계정. '미정'이면 대상 없음.
export function ownerAccount(accounts: ManagedAccount[], ownerName: string): ManagedAccount | null {
  if (!ownerName || ownerName === '미정') return null;
  return accounts.find((a) => a.status === '활성' && a.name === ownerName) ?? null;
}

// 마감 임박 판정: 열려 있고 마감까지 남은 일수가 [0, DEADLINE_SOON_DAYS].
export function isDeadlineSoon(agenda: Agenda, today: string): boolean {
  if (!isOpen(agenda)) return false;
  const left = daysLeft(agenda, today);
  return left !== null && left >= 0 && left <= DEADLINE_SOON_DAYS;
}

// ── 알림 draft 빌더 ─────────────────────────────────────────
export function issueDrafts(issue: Issue, leaders: ManagedAccount[], now: string): NotificationDraft[] {
  return leaders.map((leader): NotificationDraft => ({
    kind: 'issue',
    recipientName: leader.name,
    fromName: '시스템',
    title: `새 의견 접수 · ${issue.title}`,
    body: `${issue.author === '실명' ? '실명' : '익명'} 접수 · 대상 ${issue.target}`,
    section: 'leader',
    sourceId: issue.id,
    dedupeKey: dedupeKey('issue', issue.id, leader.name),
    createdAt: now,
    read: false,
  }));
}

export function agendaDrafts(agenda: Agenda, audience: ManagedAccount[], now: string): NotificationDraft[] {
  return audience.map((account): NotificationDraft => ({
    kind: 'agenda',
    recipientName: account.name,
    fromName: '시스템',
    title: `새 안건 · ${agenda.title}`,
    body: '투표에 참여해 주세요.',
    section: 'agenda',
    sourceId: agenda.id,
    dedupeKey: dedupeKey('agenda', agenda.id, account.name),
    createdAt: now,
    read: false,
  }));
}

export function deadlineDrafts(agenda: Agenda, audience: ManagedAccount[], now: string): NotificationDraft[] {
  return audience.map((account): NotificationDraft => ({
    kind: 'deadline',
    recipientName: account.name,
    fromName: '시스템',
    title: `투표 마감 임박 · ${agenda.title}`,
    body: '마감 전에 투표해 주세요.',
    section: 'agenda',
    sourceId: agenda.id,
    dedupeKey: dedupeKey('deadline', agenda.id, account.name),
    createdAt: now,
    read: false,
  }));
}

export function actionDraft(item: ActionItem, owner: ManagedAccount, now: string): NotificationDraft {
  return {
    kind: 'action',
    recipientName: owner.name,
    fromName: '시스템',
    title: `액션아이템 배정 · ${item.title}`,
    body: item.due ? `기한 ${item.due}` : '담당자로 지정되었어요.',
    section: 'actions',
    sourceId: item.id,
    dedupeKey: dedupeKey('action', item.id, owner.name),
    createdAt: now,
    read: false,
  };
}

// 티미팅 세션 제안(SKSOOP-21 확장): 커넥셔너 대행 리더에게 알림.
export function teaProposalDrafts(
  session: TeaSession,
  leaders: ManagedAccount[],
  now: string,
): NotificationDraft[] {
  const body = [
    `- 세션 제목: ${session.title}`,
    `- 세션 유형: ${session.type}`,
    `- 발표자: ${session.presenter}`,
    ...(session.desc.trim() ? [`- 설명: ${session.desc.trim()}`] : []),
  ].join('\n');
  return leaders.map((leader): NotificationDraft => ({
    kind: 'tea',
    recipientName: leader.name,
    fromName: '시스템',
    title: `새 티미팅 세션 제안 · ${session.title}`,
    body,
    section: 'meetings',
    sourceId: session.id,
    dedupeKey: dedupeKey('tea', session.id, leader.name),
    createdAt: now,
    read: false,
  }));
}

// 유머게시판: 내 글에 댓글이 달리면 작성자에게 알림(인앱 전용, 슬랙 미전송).
export function humorCommentDraft(
  post: HumorPost,
  commenterName: string,
  now: string,
  commentId: string,
): NotificationDraft {
  return {
    kind: 'humor',
    recipientName: post.author,
    fromName: commenterName,
    title: '유머게시판 · 내 글에 댓글이 달렸어요',
    body: post.body.length > 40 ? `${post.body.slice(0, 40)}…` : post.body,
    section: 'humor',
    sourceId: commentId,
    dedupeKey: dedupeKey('humor', commentId, post.author),
    createdAt: now,
    read: false,
  };
}

export function messageDraft(
  fromName: string,
  recipientName: string,
  body: string,
  now: string,
  messageId: string,
): NotificationDraft {
  return {
    kind: 'message',
    recipientName,
    fromName,
    title: `${fromName}님의 메시지`,
    body,
    section: 'notifications',
    sourceId: messageId,
    dedupeKey: dedupeKey('message', messageId, recipientName),
    createdAt: now,
    read: false,
  };
}

// ── 번개 모임 / 일정 공모 ──────────────────────────────────
// 이 두 알림이 없으면 대기 명단이 껍데기가 된다. 자리가 났는데 본인이 앱을
// 다시 열어보기 전까지 모르면, 자동 승계는 아무 일도 일어나지 않은 것과 같다.

/**
 * 대기 → 확정 승계. 앞사람이 취소해 자리가 났을 때 올라온 사람에게만 보낸다.
 * dedupeKey 에 '#promoted' 를 붙여 같은 모임의 취소 알림과 섞이지 않게 한다.
 */
export function gatheringPromotedDraft(gathering: Gathering, name: string, now: string): NotificationDraft {
  return {
    kind: 'gathering',
    recipientName: name,
    fromName: '시스템',
    title: `자리가 났어요 · ${gathering.title}`,
    body: `대기하던 자리가 확정으로 바뀌었어요. ${gathering.place}에서 만나요.`,
    section: 'gatherings',
    sourceId: gathering.id,
    dedupeKey: dedupeKey('gathering', `${gathering.id}#promoted`, name),
    createdAt: now,
    read: false,
  };
}

/**
 * 모임 취소. 확정·대기를 가리지 않고 신청한 모두에게 보낸다 —
 * 대기자도 그 시간을 비워두고 있었을 수 있다. 주최자 본인은 뺀다.
 */
export function gatheringCanceledDrafts(gathering: Gathering, names: string[], now: string): NotificationDraft[] {
  return names
    .filter((name) => name !== gathering.host)
    .map((name): NotificationDraft => ({
      kind: 'gathering',
      recipientName: name,
      fromName: '시스템',
      title: `취소됐어요 · ${gathering.title}`,
      body: `${gathering.host}님이 모임을 접었어요. 그 시간은 다시 비워두셔도 됩니다.`,
      section: 'gatherings',
      sourceId: gathering.id,
      dedupeKey: dedupeKey('gathering', `${gathering.id}#canceled`, name),
      createdAt: now,
      read: false,
    }));
}

/*
  상회 입찰. 내가 부른 값을 누가 넘겼다는 것은 "다시 부를 기회"를 주는 알림이라
  즉시 닿아야 뜻이 있다. 마감 뒤에 알면 아무것도 할 수 없다.
  낙찰자 본인에게는 보내지 않는다 — 방금 자기가 부른 값이다.
*/
export function marketOutbidDrafts(item: MarketItem, outbid: MarketBid[], now: string): NotificationDraft[] {
  return outbid.map((bid): NotificationDraft => ({
    kind: 'market',
    recipientName: bid.name,
    fromName: '시스템',
    title: `누가 더 불렀어요 · ${item.title}`,
    body: '지금 다시 부르면 아직 가져갈 수 있어요.',
    section: 'market',
    sourceId: item.id,
    // 같은 물건에서 여러 번 밀릴 수 있으므로 밀린 시점까지 키에 넣는다.
    // 물건 id 만 쓰면 두 번째 상회부터 조용히 사라진다.
    dedupeKey: dedupeKey('market', `${item.id}#outbid#${now}`, bid.name),
    createdAt: now,
    read: false,
  }));
}

/**
 * 낙찰·나눔 확정. 돈과 물건이 오가는 약속이라 놓치면 그대로 파토가 된다.
 * 판매자에게도 같이 알린다 — 누구와 언제 만날지 정해야 하는 쪽은 둘 다다.
 */
export function marketWonDrafts(item: MarketItem, buyerName: string, now: string): NotificationDraft[] {
  const where = item.place.trim();
  const isGift = item.kind === 'giveaway';
  return [
    {
      kind: 'market' as const,
      recipientName: buyerName,
      fromName: '시스템',
      title: `${isGift ? '나눔받았어요' : '낙찰됐어요'} · ${item.title}`,
      body: `${item.seller}님과 ${where || '거래 장소'}에서 만나 주고받으세요.`,
      section: 'market' as const,
      sourceId: item.id,
      dedupeKey: dedupeKey('market', `${item.id}#won`, buyerName),
      createdAt: now,
      read: false,
    },
    {
      kind: 'market' as const,
      recipientName: item.seller,
      fromName: '시스템',
      title: `${isGift ? '나눔 상대가 정해졌어요' : '거래가 성사됐어요'} · ${item.title}`,
      body: `${buyerName}님이 가져갑니다. ${where || '거래 장소'}에서 만나세요.`,
      section: 'market' as const,
      sourceId: item.id,
      dedupeKey: dedupeKey('market', `${item.id}#sold`, item.seller),
      createdAt: now,
      read: false,
    },
  ];
}

/** 판매자가 거래를 내렸다. 부른 사람들은 그 돈을 묶어두고 기다렸을 수 있다. */
export function marketCanceledDrafts(item: MarketItem, names: string[], now: string): NotificationDraft[] {
  return names
    .filter((name) => name !== item.seller)
    .map((name): NotificationDraft => ({
      kind: 'market',
      recipientName: name,
      fromName: '시스템',
      title: `거래가 내려갔어요 · ${item.title}`,
      body: `${item.seller}님이 거래를 취소했어요.`,
      section: 'market',
      sourceId: item.id,
      dedupeKey: dedupeKey('market', `${item.id}#canceled`, name),
      createdAt: now,
      read: false,
    }));
}
