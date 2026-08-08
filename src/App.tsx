import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAccounts, makeAccountId, saveAccounts, seedAccounts } from './accountStore';
import { loadActionItems, makeActionItemId, saveActionItems } from './actionItemStore';
import { applySelection, finalStatus, isOpen, liveStatus, settleAgendas } from './agendaRules';
import { loadAgendas, makeAgendaId, makeAgendaOptions, saveAgendas } from './agendaStore';
import { hasVoted, loadBallots, makeVoterKey, saveBallots } from './ballotStore';
import { hasLeaderRole, isConnectioner, isLeader, isTeamLeader, teamParts } from './auth';
import { loadCanSteps, saveCanSteps } from './canStepsStore';
import {
  loadCanOpinions,
  loadCanSessions,
  makeCanOpinionId,
  makeCanSessionId,
  saveCanOpinions,
  saveCanSessions,
} from './canStore';
import {
  DEFAULT_TEA_SESSION_TYPES,
  loadTeaSessionTypes,
  loadTeaSessions,
  makeTeaSessionId,
  saveTeaSessionTypes,
  saveTeaSessions,
} from './teaStore';
import { CAN_STEPS, type CanStepConfig } from './canConfig';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastRegion, useToasts } from './components/Toast';
import { sections } from './navigation';
import {
  initialActionItems,
  initialAgendas,
  initialCanOpinions,
  initialCanSessions,
  initialHumorComments,
  initialHumorPosts,
  initialIssues,
  initialNotifications,
  initialTeaSessions,
  profiles as initialProfiles,
} from './data/mockData';
import { ActionBoard } from './features/actions/ActionBoard';
import { ActionCreateForm } from './features/actions/ActionCreateForm';
import { ChatWidget } from './features/chat/ChatWidget';
import { clearSession, loadSession, saveSession } from './session';
import { AgendaBoard } from './features/agenda/AgendaBoard';
import type { AgendaDraft } from './features/agenda/AgendaForm';
import { AccountManagement } from './features/auth/AccountManagement';
import { LoginScreen } from './features/auth/LoginScreen';
import { DataCleanup } from './features/admin/DataCleanup';
import { Connect } from './features/connect/Connect';
import { Dashboard } from './features/dashboard/Dashboard';
import { HumorBoard } from './features/humor/HumorBoard';
import { Intake } from './features/intake/Intake';
import { LeaderInbox } from './features/leader/LeaderInbox';
import { Meetings } from './features/meetings/Meetings';
import { Memory } from './features/memory/Memory';
import { Metrics } from './features/metrics/Metrics';
import { NotificationCenter } from './features/notifications/NotificationCenter';
import { Profiles } from './features/profiles/Profiles';
import { loadIssues, makeIssueId, saveIssues } from './issueStore';
import { deliverDm, deliverToSlack, sendAnnouncement } from './notificationDelivery';
import {
  actionDraft,
  agendaAudience,
  agendaDrafts,
  deadlineDrafts,
  humorCommentDraft,
  isDeadlineSoon,
  issueDrafts,
  leadersFor,
  messageDraft,
  ownerAccount,
  gatheringCanceledDrafts,
  gatheringPromotedDraft,
  marketCanceledDrafts,
  marketOutbidDrafts,
  marketWonDrafts,
  teaProposalDrafts,
  type NotificationDraft,
} from './notificationRules';
import { loadNotifications, makeNotificationId, saveNotifications } from './notificationStore';
import {
  DEFAULT_NOTIFY_SETTINGS,
  channelIdFor,
  loadNotifySettings,
  routeForKind,
  saveNotifySettings,
  type NotifySettings,
} from './notifySettingsStore';
import { SystemManagement } from './features/system/SystemManagement';
import {
  loadHumorComments,
  loadHumorPosts,
  makeHumorCommentId,
  makeHumorId,
  saveHumorComments,
  saveHumorPosts,
} from './humorStore';
import { makePoster } from './aiPoster';
import { requestGatheringImage } from './gatheringImage';
import {
  cacheSignups,
  deleteGatheringRecord,
  deleteSignup,
  insertSignup,
  loadGatherings,
  loadSignups,
  saveGatherings,
  uploadGatheringImage,
} from './gatheringStore';
import { coffeeCandidates, splitRoster } from './gatheringRules';
import {
  bidBlockedReason,
  canEditMarketItem,
  deriveStatus as deriveMarketStatus,
  extendedCloseFor,
  leadingBid,
  minNextBid,
} from './marketRules';
import {
  cacheMarketBids,
  deleteMarketBidsForItem,
  deleteMarketItemRecord,
  insertMarketBid,
  loadMarketBids,
  loadMarketItems,
  saveMarketItems,
  uploadMarketImage,
} from './marketStore';
import { requestMarketImage } from './marketImage';
import { GatheringBoard } from './features/gatherings/GatheringBoard';
import { MarketBoard } from './features/market/MarketBoard';
import { localItemPoster } from './features/market/ItemPoster';
import type { GatheringDraft } from './features/gatherings/GatheringForm';
import type { MarketDraft } from './features/market/MarketForm';
import { loadProfiles } from './profileStore';
import { ProfilesContext, type AvatarInfo } from './profilesContext';
import type {
  ActionItem,
  Agenda,
  AgendaBallot,
  AppNotification,
  CanFollowRoute,
  CanOpinion,
  CanResultGroup,
  CanSession,
  CurrentUser,
  Gathering,
  GatheringSignup,
  MarketBid,
  MarketItem,
  HumorComment,
  HumorPost,
  Identity,
  Issue,
  ManagedAccount,
  Profile,
  Section,
  TeaSession,
  TeaSessionStatus,
  VoteSelection,
} from './types';

const today = () => new Date().toISOString().slice(0, 10);

/* 'YYYY-MM-DDTHH:mm' 로컬 시각. 모임 상태는 저장하지 않고 이 값으로 파생시키므로
   (gatheringRules.deriveStatus) 화면마다 따로 만들지 않고 여기서 한 번만 만든다.
   toISOString 은 UTC 라 저녁 모임이 다음 날로 넘어간다 — 로컬 기준이어야 한다. */
const nowStamp = () => {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// 대나무숲/캔미팅에서 자동 생성된 안건의 기본 투표 기간(7일).
// 사람이 마감일을 정할 기회가 없는 경로라 기한 없이 방치되는 것을 막는다.
const DEFAULT_VOTING_DAYS = 7;
const defaultDeadline = () =>
  new Date(Date.now() + DEFAULT_VOTING_DAYS * 86400000).toISOString().slice(0, 10);

// 슬랙 등 외부 링크의 #해시로 특정 화면에 바로 진입(딥링크). '#meetings-tea'는 meetings 진입 후 티미팅 탭.
const SECTION_BY_HASH: Record<string, Section> = {
  '#dashboard': 'dashboard',
  '#intake': 'intake',
  '#leader': 'leader',
  '#agenda': 'agenda',
  '#actions': 'actions',
  '#meetings': 'meetings',
  '#meetings-tea': 'meetings',
  '#profiles': 'profiles',
  '#connect': 'connect',
  '#memory': 'memory',
  '#metrics': 'metrics',
  '#accounts': 'accounts',
  '#notifications': 'notifications',
  '#humor': 'humor',
  '#gatherings': 'gatherings',
  '#market': 'market',
};

export function App() {
  const [accounts, setAccounts] = useState<ManagedAccount[]>(seedAccounts);
  // 저장된 세션이 있으면 복원한다 — 새로고침해도 로그인이 유지된다.
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => loadSession());
  const [active, setActive] = useState<Section>('dashboard');
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [agendas, setAgendas] = useState<Agenda[]>(initialAgendas);
  const [ballots, setBallots] = useState<AgendaBallot[]>([]);
  const [identity, setIdentity] = useState<Identity>('익명');
  const [canSessions, setCanSessions] = useState<CanSession[]>(initialCanSessions);
  const [canOpinions, setCanOpinions] = useState<CanOpinion[]>(initialCanOpinions);
  const [selectedCanId, setSelectedCanId] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems);
  // DB(있으면)에서 비동기 로드하므로 초기값은 시드/기본값으로 두고 useEffect에서 덮어쓴다.
  const [canSteps, setCanSteps] = useState<CanStepConfig[]>(CAN_STEPS);
  const [teaSessions, setTeaSessions] = useState<TeaSession[]>(initialTeaSessions);
  const [teaSessionTypes, setTeaSessionTypes] = useState<string[]>(DEFAULT_TEA_SESSION_TYPES);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  // 알림 발송 설정(팀 공용). 시스템 관리 화면에서 커넥셔너가 조정. DB에서 로드 전엔 기본값.
  const [notifySettings, setNotifySettings] = useState<NotifySettings>(DEFAULT_NOTIFY_SETTINGS);
  const [humorPosts, setHumorPosts] = useState<HumorPost[]>(initialHumorPosts);
  const [humorComments, setHumorComments] = useState<HumorComment[]>(initialHumorComments);
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [gatheringSignups, setGatheringSignups] = useState<GatheringSignup[]>([]);
  /*
    등록 직후 배경에서 그림을 그리는 동안의 id 목록. 저장하지 않는다 —
    새로고침하면 그리기도 같이 끝나 있으므로 남겨두면 영영 '그리는 중' 이 된다.
  */
  const [imagePendingIds, setImagePendingIds] = useState<string[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [marketBids, setMarketBids] = useState<MarketBid[]>([]);
  // 알림이 DB(있으면)에서 로드 완료됐는지. 마감 임박 체크는 이게 true여야 실행(중복 슬랙 방지).
  const [notificationsReady, setNotificationsReady] = useState(false);
  // 계정별 아바타(색·사진). Avatar가 ProfilesContext로 읽는다. 로그인 후 DB에서 로드.
  // 색은 성향 프로필(profiles), 사진은 계정(accounts)에서 오며 여기서 합친다.
  const [profileDirectory, setProfileDirectory] = useState<Profile[]>(initialProfiles);
  const profileMap = useMemo(() => {
    const map = new Map<string, AvatarInfo>();
    profileDirectory.forEach((profile) => map.set(profile.name, { color: profile.color }));
    // 사진의 단일 소스는 accounts. 있으면 우선하고, 색은 성향 프로필 값을 유지한다.
    accounts.forEach((account) => {
      if (!account.photoUrl) return;
      const existing = map.get(account.name);
      map.set(account.name, { color: existing?.color ?? 'blue', photoUrl: account.photoUrl });
    });
    return map;
  }, [profileDirectory, accounts]);

  // 커피뽑기/조뽑기 명단 = 실제 유저(활성 계정)의 라이브 성향 프로필.
  // 조 편성 로직이 part·birthYear·trait·style·color를 쓰므로 profiles가 소스,
  // 탈퇴·비활성 계정은 accounts.status로 걸러 명단에서 제외한다.
  const connectMembers = useMemo(() => {
    const activeNames = new Set(
      accounts.filter((account) => account.status === '활성').map((account) => account.name),
    );
    return profileDirectory.filter((profile) => activeNames.has(profile.name));
  }, [profileDirectory, accounts]);

  const [votedAgendaIds, setVotedAgendaIds] = useState<string[]>([]);
  const [agendaForActions, setAgendaForActions] = useState<Agenda | null>(null);

  const { toasts, notifyStatus, dismiss } = useToasts();

  // 서버 저장이 실패하면 화면에는 반영됐지만 이 기기에만 남는다.
  // 그 사실을 조용히 넘기면 사용자는 팀에 전달된 줄로 안다.
  const reportSave = (saved: Promise<boolean>, okText: string) => {
    void saved.then((ok) =>
      ok
        ? notifyStatus(okText)
        : notifyStatus('서버 저장에 실패해 이 기기에만 저장되었습니다. 네트워크를 확인해주세요.', 'error'),
    );
  };

  const actionCountByAgenda = actionItems.reduce<Record<string, number>>((acc, item) => {
    if (item.sourceKind === '안건' && item.sourceId) {
      acc[item.sourceId] = (acc[item.sourceId] ?? 0) + 1;
    }
    return acc;
  }, {});

  const passedAgendaCount = agendas.filter((agenda) => agenda.status === '통과').length;
  const openIssueCount = issues.filter((issue) => issue.status !== '종료').length;

  useEffect(() => {
    let isMounted = true;

    loadAccounts().then((loadedAccounts) => {
      if (isMounted) {
        setAccounts(loadedAccounts);
      }
    });
    loadIssues().then((loadedIssues) => {
      if (isMounted) {
        setIssues(loadedIssues);
      }
    });
    loadAgendas().then((loadedAgendas) => {
      if (!isMounted) return;
      // 서버 배치가 없으므로 마감일 경과와 조기 확정을 열어보는 시점에 함께 반영한다.
      const settled = settleAgendas(loadedAgendas, today());
      setAgendas(settled);
      if (settled !== loadedAgendas) void saveAgendas(settled);
    });
    loadBallots().then((loadedBallots) => {
      if (isMounted) {
        setBallots(loadedBallots);
      }
    });
    loadActionItems().then((loadedItems) => {
      if (isMounted) {
        setActionItems(loadedItems);
      }
    });
    loadTeaSessions().then((loaded) => {
      if (isMounted) setTeaSessions(loaded);
    });
    loadTeaSessionTypes().then((loaded) => {
      if (isMounted) setTeaSessionTypes(loaded);
    });
    loadCanSessions().then((loaded) => {
      if (isMounted) setCanSessions(loaded);
    });
    loadCanOpinions().then((loaded) => {
      if (isMounted) setCanOpinions(loaded);
    });
    loadCanSteps().then((loaded) => {
      if (isMounted) setCanSteps(loaded);
    });
    loadNotifySettings().then((loaded) => {
      if (isMounted) setNotifySettings(loaded);
    });
    loadNotifications().then((loaded) => {
      if (isMounted) {
        setNotifications(loaded);
        setNotificationsReady(true);
      }
    });
    loadHumorPosts().then((loaded) => {
      if (isMounted) setHumorPosts(loaded);
    });
    loadHumorComments().then((loaded) => {
      if (isMounted) setHumorComments(loaded);
    });
    loadMarketItems().then((loaded) => {
      if (isMounted) setMarketItems(loaded);
    });
    loadMarketBids().then((loaded) => {
      if (isMounted) setMarketBids(loaded);
    });
    loadGatherings().then((loaded) => {
      if (isMounted) setGatherings(loaded);
    });
    loadSignups().then((loaded) => {
      if (isMounted) setGatheringSignups(loaded);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 프로필 디렉토리는 로그인(currentUser) 후 로드 — loadProfiles가 currentUser를 필요로 한다.
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    loadProfiles(initialProfiles, currentUser).then((loaded) => {
      if (isMounted) setProfileDirectory(loaded);
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // createdAt은 App이 채운다(접수 시각). 호출부가 넘기지 않는다.
  const submitIssue = (issue: Omit<Issue, 'id' | 'status' | 'createdAt'>) => {
    const next: Issue = {
      id: makeIssueId(),
      ...issue,
      status: '접수',
      createdAt: today(),
    };
    const nextIssues = [next, ...issues];
    setIssues(nextIssues);
    reportSave(saveIssues(nextIssues), `${next.id} 접수가 저장되었습니다.`);
    // 111: 의견 접수 → 대상 리더에게 알림
    notify(issueDrafts(next, leadersFor(accounts, next.target), today()));
    return next;
  };

  // voterKey는 해시라 비동기다. 화면마다 계산하지 않도록 여기서 한 번 풀어 내려보낸다.
  useEffect(() => {
    if (!currentUser) {
      setVotedAgendaIds([]);
      return;
    }

    let isMounted = true;

    Promise.all(
      agendas.map(async (agenda) => {
        const voterKey = await makeVoterKey(currentUser.email, agenda.id);
        return hasVoted(ballots, agenda.id, voterKey) ? agenda.id : null;
      }),
    ).then((ids) => {
      if (isMounted) {
        setVotedAgendaIds(ids.filter((id): id is string => id !== null));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [agendas, ballots, currentUser]);

  const persistAgendas = (nextAgendas: Agenda[]) => {
    setAgendas(nextAgendas);
    void saveAgendas(nextAgendas);
  };

  // ===== 알림 / 메시지 (SKSOOP-21) =====
  const persistNotifications = (next: AppNotification[]) => {
    setNotifications(next);
    saveNotifications(next);
  };

  const persistNotifySettings = (next: NotifySettings) => {
    setNotifySettings(next);
    void saveNotifySettings(next);
  };

  // draft들을 dedupe 후 id 부여해 추가하고, 각 건을 전송 어댑터로 흘려보낸다.
  // 같은 tick에 여러 이벤트가 있으면 반드시 한 번의 notify(배열)로 넘긴다(중간 상태 클로버 방지).
  const notify = (drafts: NotificationDraft[]) => {
    const seen = new Set(notifications.map((item) => item.dedupeKey));
    const fresh = drafts
      .filter((draft) => !seen.has(draft.dedupeKey))
      .map((draft) => ({ ...draft, id: makeNotificationId() }));
    if (fresh.length === 0) return;
    const next = [...fresh, ...notifications];
    persistNotifications(next);
    // 슬랙 발송은 시스템 관리 설정을 따른다. 마스터가 꺼져 있으면 인앱 알림만.
    if (!notifySettings.slackEnabled) return;
    // 이벤트(kind:sourceId)당 채널 1회. DM은 수신자별이라 이벤트별 draft를 모아둔다.
    const byEvent = new Map<string, AppNotification[]>();
    fresh.forEach((item) => {
      const key = `${item.kind}:${item.sourceId}`;
      const list = byEvent.get(key);
      if (list) list.push(item);
      else byEvent.set(key, [item]);
    });
    // 슬랙 이메일이 명시적으로 등록된 사람만 DM 대상. 앱 로그인 이메일로 폴백하지 않는다
    // (매핑 안 된 사람에게 엉뚱한 상대로 DM이 가는 걸 방지).
    const slackEmailFor = (name: string) => accounts.find((item) => item.name === name)?.slackEmail;
    byEvent.forEach((items) => {
      const rep = items[0];
      const route = routeForKind(notifySettings, rep.kind);
      if (route === 'off') return;
      if (route === 'dm') {
        // 대나무숲·개인 메시지 등 DM 경로는 수신자마다 개인 DM. 익명 접수도 본문엔
        // '익명 접수'로만 나가 작성자는 드러나지 않는다.
        if (!notifySettings.dmEnabled) return;
        items.forEach((item) => {
          const slackEmail = slackEmailFor(item.recipientName);
          if (slackEmail) deliverDm(slackEmail, item.kind, item.title, item.body, item.fromName);
        });
        return;
      }
      // 채널 경로(team/connector): 설정에 든 실제 채널 ID로 게시(비면 서버 env 폴백).
      deliverToSlack(route, channelIdFor(notifySettings, route), rep.kind, rep.title, rep.body, rep.fromName);
    });
  };

  // 투표 마감 임박(113): 서버 타이머가 없으므로 안건이 로드/변경될 때 기회적으로 계산한다.
  // dedupeKey가 이미 만든 알림의 재생성을 막으므로 로드마다 중복 생성되지 않는다.
  useEffect(() => {
    // 알림이 DB에서 아직 안 실려온 상태면 보류 — seen(dedupe)이 비어 있어 매 로드마다 재발신되는 걸 막는다.
    if (!notificationsReady) return;
    const drafts: NotificationDraft[] = [];
    agendas.forEach((agenda) => {
      if (isDeadlineSoon(agenda, today())) {
        drafts.push(...deadlineDrafts(agenda, agendaAudience(accounts, agenda.part), today()));
      }
    });
    if (drafts.length > 0) notify(drafts);
    // notify는 최신 notifications 클로저를 쓰며, 이 effect는 알림 변경으로 재실행되지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendas, accounts, notificationsReady]);

  /*
    낙찰 알림. 경매가 끝나는 것은 사람의 행동이 아니라 시각이 지나는 일이라,
    아무도 "지금 낙찰됐다"를 쏘아주지 않는다. 마감 임박 알림과 같은 방식으로
    화면이 열릴 때 기회적으로 확인한다. dedupeKey 가 중복 발송을 막으므로
    여러 사람이 접속해도 각자 한 번씩만 받는다.

    나눔은 누른 그 순간 주인이 정해지므로 여기서 다시 보지 않는다(중복 방지는
    dedupeKey 가 하지만, 애초에 이 경로를 탈 이유가 없다).
  */
  useEffect(() => {
    if (!notificationsReady) return;
    const stamp = nowStamp();
    const drafts: NotificationDraft[] = [];
    marketItems.forEach((item) => {
      if (item.kind !== 'auction') return;
      if (deriveMarketStatus(item, marketBids, stamp) !== '거래완료') return;
      const won = leadingBid(item, marketBids);
      if (won) drafts.push(...marketWonDrafts(item, won.name, today()));
    });
    if (drafts.length > 0) notify(drafts);
    // notify는 최신 notifications 클로저를 쓰며, 이 effect는 알림 변경으로 재실행되지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketItems, marketBids, notificationsReady]);

  // 투표 대상 인원. 파트 한정 안건은 해당 파트 + 전체 소속(팀리더)만 센다.
  const eligibleCountFor = (part: Agenda['part']) =>
    accounts.filter(
      (account) => account.status === '활성' && (part === '전체' || account.part === part || account.part === '전체'),
    ).length;

  // 안건 직접 등록(안건함 화면). 익명이면 작성자 이름은 저장하지 않는다.
  const createAgenda = (draft: AgendaDraft) => {
    const { optionLabels, ...rest } = draft;
    const next: Agenda = {
      ...rest,
      id: makeAgendaId(),
      source: '직접 등록',
      authorName: draft.author === '실명' ? (currentUser?.name ?? '') : '',
      approve: 0,
      reject: 0,
      options: makeAgendaOptions(optionLabels),
      voterCount: 0,
      status: '투표중',
      createdAt: today(),
      eligibleCount: eligibleCountFor(draft.part),
      closedAt: '',
    };
    persistAgendas([next, ...agendas]);
    // 112: 안건 등록 → 해당 파트 팀원에게 알림
    notify(agendaDrafts(next, agendaAudience(accounts, next.part), today()));
    return next;
  };

  const promoteToAgenda = (
    issue: Issue,
    draft: Pick<Agenda, 'title' | 'description' | 'category' | 'part' | 'author' | 'deadline' | 'voteType' | 'multiSelect'> & {
      optionLabels: string[];
    },
  ) => {
    const shouldAnonymize = issue.visibility === '리더만 보기';
    const promoted: Agenda = {
      id: makeAgendaId(),
      title: draft.title,
      // 접수 원문을 그대로 공개하지 않는다. 리더가 정제한 draft만 안건으로 저장한다.
      description: draft.description,
      category: draft.category,
      source: `대나무숲 ${issue.id}`,
      part: draft.part,
      author: shouldAnonymize ? '익명' : draft.author,
      authorName: shouldAnonymize || draft.author === '익명' ? '' : (currentUser?.name ?? ''),
      approve: 0,
      reject: 0,
      // 접수는 대개 찬반이지만, 리더가 객관식으로 정제하면 선택지도 함께 올린다.
      voteType: draft.voteType,
      options: makeAgendaOptions(draft.optionLabels),
      multiSelect: draft.voteType === '객관식' && draft.multiSelect,
      voterCount: 0,
      status: '투표중',
      createdAt: today(),
      eligibleCount: eligibleCountFor(draft.part),
      deadline: draft.deadline || defaultDeadline(),
      closedAt: '',
    };
    persistAgendas([promoted, ...agendas]);
    const nextIssues: Issue[] = issues.map((item) => (item.id === issue.id ? { ...item, status: '안건화' } : item));
    setIssues(nextIssues);
    void saveIssues(nextIssues);
    setActive('agenda');
    notifyStatus(`안건 후보로 등록했습니다 · ${promoted.title}`);
    // 112: 대나무숲 → 안건 승격도 팀원 알림
    notify(agendaDrafts(promoted, agendaAudience(accounts, promoted.part), today()));
  };

  const updateIssue = (updatedIssue: Issue) => {
    const nextIssues = issues.map((issue) => (issue.id === updatedIssue.id ? updatedIssue : issue));
    setIssues(nextIssues);
    void saveIssues(nextIssues);
  };

  // 목록에 필터/정렬이 붙어도 안전하도록 index가 아닌 id로 대상을 찾는다.
  //
  // 투표는 두 갈래로 기록된다.
  //  - 선택(찬성/반대)은 안건의 카운터에만 더한다. 누가 골랐는지는 남기지 않는다.
  //  - "이 사람이 투표했다"는 사실만 투표용지에 남긴다. 무엇을 골랐는지는 담지 않는다.
  // 두 기록이 만나지 않으므로 중복은 막으면서 선택은 익명으로 남는다.
  const vote = async (id: string, selection: VoteSelection) => {
    if (!currentUser) return;

    const target = agendas.find((agenda) => agenda.id === id);
    if (!target || !isOpen(target)) return;

    const applied = applySelection(target, selection);
    // 고른 것이 없거나 없는 선택지를 가리키면 투표용지까지 써버리면 안 된다.
    // 한 번 남은 투표용지는 지울 수 없어서, 표는 안 들어가고 투표권만 사라진다.
    if (!applied) return;

    const voterKey = await makeVoterKey(currentUser.email, id);
    if (hasVoted(ballots, id, voterKey)) return;

    persistAgendas(
      agendas.map((agenda) => {
        if (agenda.id !== id) return agenda;
        const status = liveStatus(applied);
        // 조기 확정된 경우에만 마감 처리한다. 아직 뒤집힐 수 있으면 열어둔다.
        return status === '투표중' ? applied : { ...applied, status, closedAt: today() };
      }),
    );

    const nextBallots = [...ballots, { agendaId: id, voterKey, createdAt: today() }];
    setBallots(nextBallots);
    reportSave(saveBallots(nextBallots), '투표가 확정되었습니다.');
  };

  // 마감: 참여 수와 무관하게 과반 여부로 최종 상태를 확정한다.
  const closeAgenda = (id: string) => {
    const target = agendas.find((agenda) => agenda.id === id);
    persistAgendas(
      agendas.map((agenda) =>
        agenda.id === id && isOpen(agenda)
          ? { ...agenda, status: finalStatus(agenda), closedAt: today() }
          : agenda,
      ),
    );
    if (target && isOpen(target)) notifyStatus(`안건을 마감했습니다 · ${finalStatus(target)}`);
  };

  const persistCanSessions = (next: CanSession[]) => {
    setCanSessions(next);
    void saveCanSessions(next);
  };

  const persistCanOpinions = (next: CanOpinion[]) => {
    setCanOpinions(next);
    void saveCanOpinions(next);
  };

  const startCanSession = () => {
    // 공용 DB에서는 목록 길이 기반 id가 다른 사람과 충돌한다 → 고유 id 사용.
    const id = makeCanSessionId();
    const draft: CanSession = {
      id,
      topic: '',
      teamName: '',
      heldAt: new Date().toISOString().slice(0, 10),
      method: '오프라인',
      parts: [...teamParts],
      stage: 'setup',
      resultSummary: '',
      followUp: null,
    };
    persistCanSessions([draft, ...canSessions]);
    setSelectedCanId(id);
  };

  const updateCanSession = (session: CanSession) => {
    persistCanSessions(canSessions.map((item) => (item.id === session.id ? session : item)));
  };

  const addCanOpinion = (opinion: Omit<CanOpinion, 'id' | 'selected'>) => {
    persistCanOpinions([...canOpinions, { ...opinion, id: makeCanOpinionId(), selected: false }]);
  };

  const toggleCanOpinion = (id: string) => {
    persistCanOpinions(
      canOpinions.map((opinion) => (opinion.id === id ? { ...opinion, selected: !opinion.selected } : opinion)),
    );
  };

  const updateCanSteps = (steps: CanStepConfig[]) => {
    setCanSteps(steps);
    void saveCanSteps(steps);
  };

  const confirmCanResult = (sessionId: string, summary: string, groups: CanResultGroup[]) => {
    if (!summary.trim()) return;
    persistCanSessions(
      canSessions.map((session) =>
        session.id === sessionId ? { ...session, resultSummary: summary, resultGroups: groups } : session,
      ),
    );
  };

  // 캔미팅 결과 후속 조치: 선택 항목을 안건함/액션아이템으로 반영 + 세션에 적용 기록
  const applyCanFollowUp = (
    sessionId: string,
    data: {
      sessionTopic: string;
      agendaTitles: string[];
      actions: ActionItem[];
      routes: Record<string, CanFollowRoute>;
      actionMeta: Record<string, { owner: string; due: string }>;
    },
  ) => {
    if (canSessions.find((session) => session.id === sessionId)?.followUp) return; // 이미 적용됨 → 중복 방지
    const { sessionTopic, agendaTitles, actions, routes, actionMeta } = data;
    if (agendaTitles.length === 0 && actions.length === 0) return;
    const followDrafts: NotificationDraft[] = [];
    if (agendaTitles.length > 0) {
      const newAgendas: Agenda[] = agendaTitles.map((title) => ({
        id: makeAgendaId(),
        title,
        description: '',
        category: '회의문화',
        source: `캔미팅 · ${sessionTopic}`,
        part: '전체',
        author: '익명',
        authorName: '',
        approve: 0,
        reject: 0,
        // 캔미팅 후속 안건도 제목 하나로 찬반을 묻는 형태다.
        voteType: '찬반',
        options: [],
        multiSelect: false,
        voterCount: 0,
        status: '투표중',
        createdAt: today(),
        eligibleCount: eligibleCountFor('전체'),
        deadline: defaultDeadline(),
        closedAt: '',
      }));
      persistAgendas([...newAgendas, ...agendas]);
      newAgendas.forEach((agenda) =>
        followDrafts.push(...agendaDrafts(agenda, agendaAudience(accounts, agenda.part), today())),
      );
    }
    if (actions.length > 0) {
      persistActionItems([...actions, ...actionItems]);
      actions.forEach((item) => {
        const owner = ownerAccount(accounts, item.owner);
        if (owner) followDrafts.push(actionDraft(item, owner, today()));
      });
    }
    persistCanSessions(
      canSessions.map((session) => (session.id === sessionId ? { ...session, followUp: { routes, actionMeta } } : session)),
    );
    // 112/114: 캔미팅 후속으로 만든 안건·액션도 동일하게 알림
    if (followDrafts.length > 0) notify(followDrafts);
  };

  const persistActionItems = (nextItems: ActionItem[]) => {
    setActionItems(nextItems);
    void saveActionItems(nextItems);
  };

  // SKSOOP-53: 통과된 안건에서 액션아이템을 만든다.
  // 캔미팅 경로(applyCanFollowUp)와 같은 목록에 합류하되 출처로 구분된다.
  const createActionItemsFromAgenda = (agenda: Agenda, drafts: Array<Pick<ActionItem, 'title' | 'owner' | 'due'>>) => {
    const usable = drafts.filter((draft) => draft.title.trim());
    if (usable.length === 0) return;

    const created: ActionItem[] = usable.map((draft) => ({
      id: makeActionItemId(),
      title: draft.title.trim(),
      owner: draft.owner.trim() || '미정',
      due: draft.due,
      status: '대기',
      sourceKind: '안건',
      sourceId: agenda.id,
      sourceLabel: agenda.title,
      createdAt: today(),
      outcome: '',
      reviewReason: '',
    }));

    persistActionItems([...created, ...actionItems]);
    setActive('actions');
    notifyStatus(`액션아이템 ${created.length}건을 만들었습니다.`);
    // 114: 담당자 지정된 액션은 그 담당자에게 알림
    const ownerNotifs = created
      .map((item) => {
        const owner = ownerAccount(accounts, item.owner);
        return owner ? actionDraft(item, owner, today()) : null;
      })
      .filter((draft): draft is NotificationDraft => draft !== null);
    if (ownerNotifs.length > 0) notify(ownerNotifs);
  };

  const updateActionItem = (updated: ActionItem) => {
    const previous = actionItems.find((item) => item.id === updated.id);
    persistActionItems(actionItems.map((item) => (item.id === updated.id ? updated : item)));
    // 114: 담당자가 새로 지정/변경되면 알림
    if (previous && previous.owner !== updated.owner) {
      const owner = ownerAccount(accounts, updated.owner);
      if (owner) notify([actionDraft(updated, owner, today())]);
      // 담당자 변경은 상대에게 알림이 나가는 조작이다. 바꾼 사람도 무엇이 일어났는지 알아야 한다.
      notifyStatus(`담당자를 ${updated.owner}(으)로 바꿨습니다. 알림이 전달됩니다.`);
    } else if (previous && previous.status !== updated.status) {
      notifyStatus(`'${updated.title}' 상태를 ${updated.status}(으)로 바꿨습니다.`);
    }
  };

  // ===== 티미팅 =====
  const persistTeaSessions = (next: TeaSession[]) => {
    setTeaSessions(next);
    saveTeaSessions(next);
  };

  const addTeaSession = (session: Omit<TeaSession, 'id' | 'status' | 'memo'>) => {
    const created: TeaSession = { ...session, id: makeTeaSessionId(), status: '제안', memo: '' };
    persistTeaSessions([created, ...teaSessions]);
    // 티미팅 세션 제안 → 커넥셔너 대행 리더에게 알림(인앱) + 커넥셔너 채널(슬랙 1회)
    notify(teaProposalDrafts(created, leadersFor(accounts, '리더 전체'), today()));
  };

  const updateTeaSessionStatus = (id: string, status: TeaSessionStatus) => {
    persistTeaSessions(teaSessions.map((session) => (session.id === id ? { ...session, status } : session)));
  };

  // 이번 회차 날짜를 그 세션에 적어둔다. 공지문에만 쓰고 흘려보내면
  // 나중에 "그 세션 언제 했더라"를 아무도 알 수 없고, 캘린더와 대조할 축도 없다.
  const setTeaSessionHeldAt = (id: string, heldAt: string) => {
    persistTeaSessions(teaSessions.map((session) => (session.id === id ? { ...session, heldAt } : session)));
  };

  const setTeaSessionMemo = (id: string, memo: string) => {
    persistTeaSessions(teaSessions.map((session) => (session.id === id ? { ...session, memo } : session)));
  };

  const updateTeaSessionTypes = (types: string[]) => {
    setTeaSessionTypes(types);
    void saveTeaSessionTypes(types);
  };

  // 이번 티미팅 공지문을 팀 전체 채널로 전송.
  const announceTeaToSlack = (text: string) =>
    notifySettings.slackEnabled
      ? sendAnnouncement('team', channelIdFor(notifySettings, 'team'), text)
      : Promise.resolve('disabled' as const);

  // ===== 유머게시판 =====
  const persistHumorPosts = (next: HumorPost[]) => {
    setHumorPosts(next);
    saveHumorPosts(next);
  };
  const persistHumorComments = (next: HumorComment[]) => {
    setHumorComments(next);
    saveHumorComments(next);
  };


  const addHumorPost = (draft: { body: string; mediaUrl: string }) => {
    if (!currentUser || !draft.body.trim()) return;
    const post: HumorPost = {
      id: makeHumorId(),
      author: currentUser.name,
      body: draft.body.trim(),
      mediaUrl: draft.mediaUrl.trim(),
      createdAt: today(),
      likedBy: [],
    };
    persistHumorPosts([post, ...humorPosts]);
    // 유머 썸네일은 AI 생성을 쓰지 않는다. 이미지 링크는 그대로, 유튜브는 영상 썸네일을 카드가 만든다.
  };

  const toggleHumorLike = (postId: string) => {
    if (!currentUser) return;
    const me = currentUser.name;
    persistHumorPosts(
      humorPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              likedBy: post.likedBy.includes(me) ? post.likedBy.filter((n) => n !== me) : [...post.likedBy, me],
            }
          : post,
      ),
    );
  };

  const addHumorComment = (postId: string, body: string) => {
    if (!currentUser || !body.trim()) return;
    const commentId = makeHumorCommentId();
    const comment: HumorComment = { id: commentId, postId, author: currentUser.name, body: body.trim(), createdAt: today() };
    persistHumorComments([...humorComments, comment]);
    // 남의 글에 댓글 → 작성자에게 인앱 알림
    const post = humorPosts.find((item) => item.id === postId);
    if (post && post.author !== currentUser.name) {
      notify([humorCommentDraft(post, currentUser.name, today(), commentId)]);
    }
  };

  const editHumorPost = (postId: string, draft: { body: string; mediaUrl: string }) => {
    if (!currentUser || !draft.body.trim()) return;
    const post = humorPosts.find((item) => item.id === postId);
    if (!post || post.author !== currentUser.name) return; // 본인 글만 수정
    persistHumorPosts(
      humorPosts.map((item) =>
        item.id === postId ? { ...item, body: draft.body.trim(), mediaUrl: draft.mediaUrl.trim() } : item,
      ),
    );
  };

  const deleteHumorPost = (postId: string) => {
    const post = humorPosts.find((item) => item.id === postId);
    if (!post || !currentUser) return;
    if (post.author !== currentUser.name && !isTeamLeader(currentUser)) return; // 본인·팀리더만
    persistHumorPosts(humorPosts.filter((item) => item.id !== postId));
    persistHumorComments(humorComments.filter((item) => item.postId !== postId));
  };

  const deleteHumorComment = (commentId: string) => {
    const comment = humorComments.find((item) => item.id === commentId);
    if (!comment || !currentUser) return;
    if (comment.author !== currentUser.name && !isTeamLeader(currentUser)) return;
    persistHumorComments(humorComments.filter((item) => item.id !== commentId));
  };

  // 115: 특정 대상에게 직접 메시지
  const sendMessage = (recipientName: string, body: string) => {
    if (!currentUser || !recipientName || !body.trim()) return;
    const messageId = makeNotificationId();
    notify([messageDraft(currentUser.name, recipientName, body.trim(), today(), messageId)]);
    notifyStatus(`${recipientName}님에게 메시지를 보냈습니다.`);
  };

  const markNotificationRead = (id: string) => {
    persistNotifications(notifications.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const markAllNotificationsRead = () => {
    if (!currentUser) return;
    persistNotifications(
      notifications.map((item) => (item.recipientName === currentUser.name ? { ...item, read: true } : item)),
    );
  };

  const persistAccounts = (nextAccounts: ManagedAccount[]) => {
    setAccounts(nextAccounts);
    void saveAccounts(nextAccounts);
  };

  // 첫 로그인 때 본인이 정한 비밀번호 해시를 그 계정에 저장한다.
  const setAccountPassword = (email: string, passwordHash: string) => {
    persistAccounts(
      accounts.map((account) =>
        account.email.toLowerCase() === email.toLowerCase() ? { ...account, passwordHash } : account,
      ),
    );
  };

  // 자율 관리: 로그인한 본인 계정의 프로필 사진만 갱신한다.
  const saveMyProfilePhoto = (photoUrl: string) => {
    if (!currentUser) return;
    persistAccounts(
      accounts.map((account) =>
        account.email.toLowerCase() === currentUser.email.toLowerCase()
          ? { ...account, photoUrl: photoUrl.trim() || undefined }
          : account,
      ),
    );
  };

  /* ===== 번개 모임 / 일정공모 ===== */

  const persistGatherings = (next: Gathering[]) => {
    setGatherings(next);
    void saveGatherings(next);
  };

  /*
    썸네일 생성은 10초 넘게 걸리므로, 그 사이 목록이 바뀔 수 있다(다른 모임 등록·취소).
    등록 시점에 닫힌 변수로 잡아둔 배열에 덮어쓰면 그 사이의 변경이 조용히 사라진다.
    그래서 최신 목록을 ref 로 따로 들고, 뒤늦게 도착한 결과는 '그 한 건만' 고친다.
  */
  const gatheringsRef = useRef<Gathering[]>(gatherings);
  useEffect(() => {
    gatheringsRef.current = gatherings;
  }, [gatherings]);

  const patchGathering = (id: string, patch: Partial<Gathering>) => {
    const current = gatheringsRef.current;
    // 그 사이 취소·삭제됐으면 되살리지 않는다.
    if (!current.some((item) => item.id === id)) return;
    persistGatherings(current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const createGathering = async (draft: GatheringDraft) => {
    if (!currentUser) return;
    const id = `GAT-${Date.now().toString(36).toUpperCase()}`;
    // kind 는 이제 메뉴가 아니라 폼의 첫 선택에서 온다.
    const { imageFile, ...rest } = draft;

    const base: Gathering = {
      ...rest,
      id,
      host: currentUser.name,
      createdAt: today(),
      canceled: false,
    };

    // 사진을 넣었으면 그걸 쓰고, 없을 때만 포스터를 만든다.
    // 둘 다 실패해도 모임은 등록돼야 한다 — 대표 이미지는 부가물이지 본질이 아니다.
    let enriched = base;
    if (imageFile) {
      const { imageUrl } = await uploadGatheringImage(id, imageFile);
      enriched = { ...base, imageUrl };
    } else {
      const { poster } = await makePoster(base);
      enriched = { ...base, poster };
    }

    persistGatherings([enriched, ...gatherings]);

    /*
      연 사람은 자기 모임의 기본 참여자다. 커피내기는 확정 2명부터 뽑히는데
      호스트가 안 잡히면 혼자 열고도 못 뽑는다. 열자마자 확정 1번으로 넣는다.
      원치 않으면 상세에서 '신청 취소'로 빠질 수 있어 되돌릴 수 있다.
    */
    const hostSignup: GatheringSignup = {
      id: `SGN-${Date.now().toString(36).toUpperCase()}`,
      gatheringId: id,
      name: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    if (await insertSignup(hostSignup)) {
      const nextSignups = [...gatheringSignups, hostSignup];
      setGatheringSignups(nextSignups);
      cacheSignups(nextSignups);
    }

    /*
      그림은 등록을 마친 뒤 배경에서 그린다. 10초 넘게 걸리는 일을 등록 버튼에 매달면
      '번개' 가 번개가 아니게 된다. 그동안 카드는 방금 만든 포스터를 보여주고 있으므로
      빈 자리가 생기지도 않는다. 다 그려지면 그 자리만 조용히 사진으로 바뀐다.
      실패하면 아무것도 하지 않는다 — 포스터가 그대로 남는 것이 정상 동작이다.
    */
    if (!imageFile) {
      setImagePendingIds((prev) => [...prev, id]);
      void (async () => {
        try {
          const generated = await requestGatheringImage(enriched);
          if (!generated) return;
          const { imageUrl } = await uploadGatheringImage(id, generated);
          patchGathering(id, { imageUrl });
        } finally {
          // 성공이든 실패든 표시는 걷는다. 실패했는데 모래시계가 남으면
          // 영영 그리는 중인 것처럼 보인다.
          setImagePendingIds((prev) => prev.filter((pendingId) => pendingId !== id));
        }
      })();
    }
  };

  /*
    신청은 배열 통째로 저장하지 않고 한 건만 insert 한다. 두 사람이 같은 순간에
    신청할 때 나중 쓰기가 앞 쓰기를 지우면 한 명이 조용히 사라지는데, 선착순에서는
    그게 가장 치명적이다. DB 쓰기가 실패하면 화면에도 반영하지 않아
    "신청됐다는데 명단에 없는" 상태를 만들지 않는다.
  */
  const joinGathering = async (gathering: Gathering) => {
    if (!currentUser) return;
    if (gatheringSignups.some((s) => s.gatheringId === gathering.id && s.name === currentUser.name)) return;

    const signup: GatheringSignup = {
      id: `SGN-${Date.now().toString(36).toUpperCase()}`,
      gatheringId: gathering.id,
      name: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    const ok = await insertSignup(signup);
    if (!ok) return;
    const next = [...gatheringSignups, signup];
    setGatheringSignups(next);
    cacheSignups(next);
  };

  const leaveGathering = async (gathering: Gathering) => {
    if (!currentUser) return;
    const mine = gatheringSignups.find((s) => s.gatheringId === gathering.id && s.name === currentUser.name);
    if (!mine) return;

    const ok = await deleteSignup(mine.id);
    if (!ok) return;
    // 레코드 하나가 빠지면 대기 첫 번째가 저절로 확정된다(gatheringRules.splitRoster).
    const next = gatheringSignups.filter((s) => s.id !== mine.id);
    setGatheringSignups(next);
    cacheSignups(next);

    /*
      승계는 '사건'이 아니라 파생값이라 코드 어디에도 "지금 승격했다"는 순간이 없다.
      그래서 전후를 비교해 찾아낸다. 이 알림이 없으면 자리가 났는데 본인은
      앱을 다시 열어보기 전까지 모르고, 자동 승계가 아무 일도 아닌 게 된다.
    */
    const before = splitRoster(gathering, gatheringSignups).confirmed;
    const after = splitRoster(gathering, next).confirmed;
    const promoted = after.filter((seat) => !before.some((prev) => prev.id === seat.id));
    if (promoted.length > 0) {
      notify(promoted.map((seat) => gatheringPromotedDraft(gathering, seat.name, today())));
    }
  };

  // 번개 커피뽑기: 주최자만, 1회 확정(잠김). 당첨자는 여기서 뽑아 즉시 저장한다 —
  // 도는 연출과 결정을 분리해 모두가 같은 결과(저장값)를 본다.
  const drawCoffeePick = (gathering: Gathering) => {
    if (!currentUser || gathering.host !== currentUser.name) return;
    if (gathering.coffeePick) return; // 잠김
    const candidates = coffeeCandidates(gathering, gatheringSignups);
    if (candidates.length < 2) return;
    // 뽑는 순간의 후보 전원을 얼려 결과에 박제한다(이후 신청 변화와 무관하게 "이 명단에서 나왔다").
    const pool = candidates.map((candidate) => candidate.name);
    const winner = pool[Math.floor(Math.random() * pool.length)];
    persistGatherings(
      gatherings.map((item) =>
        item.id === gathering.id
          ? { ...item, coffeePick: winner, coffeePickedAt: new Date().toISOString(), coffeePool: pool }
          : item,
      ),
    );
  };

  const cancelGathering = (gathering: Gathering) => {
    // 대기자도 그 시간을 비워두고 있었을 수 있다. 확정·대기를 가리지 않고 알린다.
    const applicants = gatheringSignups.filter((s) => s.gatheringId === gathering.id).map((s) => s.name);
    if (applicants.length > 0) {
      notify(gatheringCanceledDrafts(gathering, applicants, today()));
      // 신청자가 있는 모임을 지우면 그들의 기록까지 사라진다. 지우지 않고 취소로 남긴다.
      persistGatherings(gatherings.map((item) => (item.id === gathering.id ? { ...item, canceled: true } : item)));
      return;
    }
    // 아무도 신청하지 않았다면 흔적을 남길 이유가 없다.
    void deleteGatheringRecord(gathering.id);
    persistGatherings(gatherings.filter((item) => item.id !== gathering.id));
  };

  // 완전 삭제. 취소(기록 보존)와 달리 모임과 신청 기록까지 통째로 지운다. 글쓴이(주최자)와 팀리더만.
  const deleteGathering = (gathering: Gathering) => {
    if (!currentUser) return;
    if (gathering.host !== currentUser.name && !isTeamLeader(currentUser)) return;
    // gathering_signups 는 gatherings 에 on delete cascade 라 DB 에서는 함께 지워진다.
    void deleteGatheringRecord(gathering.id);
    persistGatherings(gatherings.filter((item) => item.id !== gathering.id));
    // 로컬 상태·캐시에 남은 신청 기록도 걷어낸다(DB cascade 는 로컬 미러를 모른다).
    const nextSignups = gatheringSignups.filter((signup) => signup.gatheringId !== gathering.id);
    setGatheringSignups(nextSignups);
    cacheSignups(nextSignups);
  };

  /* ===== 이음장터 ===== */

  const persistMarketItems = (next: MarketItem[]) => {
    setMarketItems(next);
    void saveMarketItems(next);
  };

  /*
    썸네일 생성은 10초 넘게 걸리므로, 그 사이 목록이 바뀔 수 있다(다른 물건 등록·취소).
    등록 시점에 닫힌 변수로 잡아둔 배열에 덮어쓰면 그 사이의 변경이 조용히 사라진다.
    그래서 최신 목록을 ref 로 따로 들고, 뒤늦게 도착한 결과는 '그 한 건만' 고친다.
    (모임의 gatheringsRef/patchGathering 과 같은 판단.)
  */
  const marketItemsRef = useRef<MarketItem[]>(marketItems);
  useEffect(() => {
    marketItemsRef.current = marketItems;
  }, [marketItems]);

  const patchMarketItem = (id: string, patch: Partial<MarketItem>) => {
    const current = marketItemsRef.current;
    // 그 사이 취소·삭제됐으면 되살리지 않는다.
    if (!current.some((entry) => entry.id === id)) return;
    persistMarketItems(current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const createMarketItem = async (draft: MarketDraft) => {
    if (!currentUser) return;
    const id = `MKT-${Date.now().toString(36).toUpperCase()}`;
    const { imageFile, ...rest } = draft;

    const base: MarketItem = {
      ...rest,
      id,
      seller: currentUser.name,
      createdAt: today(),
      canceled: false,
      sellerDone: false,
      buyerDone: false,
    };

    // 사진이 있으면 그걸 쓰고, 없을 때만 포스터를 만든다. 둘 다 실패해도 등록은 되어야 한다.
    let enriched = base;
    if (imageFile) {
      const { imageUrl } = await uploadMarketImage(id, imageFile);
      enriched = { ...base, imageUrl };
    } else {
      enriched = { ...base, poster: localItemPoster(base) };
    }

    persistMarketItems([enriched, ...marketItems]);

    /*
      그림은 등록을 마친 뒤 배경에서 그린다 — 모임과 같은 방식. 10초 넘는 일을 등록
      버튼에 매달지 않는다. 그동안 카드는 방금 만든 로컬 포스터(틴트+아이콘)를 보여주고,
      그림이 다 되면 그 카드에만 imageUrl 이 붙어 사진으로 바뀐다. 실패하면 포스터 유지.
    */
    if (!imageFile) {
      setImagePendingIds((prev) => [...prev, id]);
      void (async () => {
        try {
          const generated = await requestMarketImage(enriched);
          if (!generated) return;
          const { imageUrl } = await uploadMarketImage(id, generated);
          patchMarketItem(id, { imageUrl });
        } finally {
          // 성공이든 실패든 표시는 걷는다 — 모임과 같은 판단. 실패했는데 모래시계가
          // 남으면 영영 그리는 중인 것처럼 보인다.
          setImagePendingIds((prev) => prev.filter((pendingId) => pendingId !== id));
        }
      })();
    }
  };

  /*
    물건 수정. 아직 아무도 입찰하지 않았을 때만 허용한다 — 입찰이 붙으면 그 사람은
    가격·마감·물건을 믿고 건 것이라, 몰래 바꾸면 입찰 취소 불가 원칙과 어긋난다.
    화면(수정 버튼)에서도 막지만, 저장 직전에 규칙으로 한 번 더 확인한다.
    이미지는 새 사진을 넣었을 때만 교체하고, 사진이 없던 물건은 바뀐 값으로 로컬
    포스터를 다시 만든다. 크레파스 AI 재생성은 하지 않는다 — 새로 그리려면 재등록한다.
  */
  const updateMarketItem = async (item: MarketItem, draft: MarketDraft) => {
    if (!currentUser) return;
    // 화면(수정 버튼)에서도 막지만 저장 직전 같은 규칙으로 재확인한다.
    if (!canEditMarketItem(item, marketBids, nowStamp(), currentUser.name)) return;

    const { imageFile, ...rest } = draft;
    let next: MarketItem = { ...item, ...rest };
    if (imageFile) {
      const { imageUrl } = await uploadMarketImage(item.id, imageFile);
      next = { ...next, imageUrl, poster: undefined };
    } else if (!item.imageUrl) {
      next = { ...next, poster: localItemPoster(next) };
    }
    patchMarketItem(item.id, next);
  };

  /*
    입찰은 배열 통째로 저장하지 않고 한 건만 insert 한다. 두 사람이 같은 순간에
    부를 때 나중 쓰기가 앞 쓰기를 지우면 한 건이 조용히 사라지는데, 경매에서
    그건 "분명 넣었는데 없다"가 되어 신뢰를 가장 크게 깬다.
    DB 쓰기가 실패하면 화면에도 반영하지 않는다.
  */
  const placeMarketBid = async (item: MarketItem, amount: number) => {
    if (!currentUser) return;
    const now = nowStamp();
    // 화면이 오래 열려 있었을 수 있다. 저장 직전에 규칙으로 한 번 더 막는다.
    if (bidBlockedReason(item, marketBids, now, currentUser.name)) return;
    if (item.kind === 'auction' && amount < minNextBid(item, marketBids)) return;

    const bid: MarketBid = {
      id: `BID-${Date.now().toString(36).toUpperCase()}`,
      itemId: item.id,
      name: currentUser.name,
      amount: item.kind === 'giveaway' ? 0 : amount,
      createdAt: new Date().toISOString(),
    };

    const ok = await insertMarketBid(bid);
    if (!ok) return;

    const nextBids = [...marketBids, bid];
    setMarketBids(nextBids);
    cacheMarketBids(nextBids);

    // 막판 입찰이면 마감을 민다. 마지막 순간에 낚아채고 끝나는 일을 막는다.
    const pushed = item.kind === 'auction' ? extendedCloseFor(item, now) : null;
    if (pushed) {
      persistMarketItems(
        marketItems.map((entry) => (entry.id === item.id ? { ...entry, extendedTo: pushed } : entry)),
      );
    }

    // 밀려난 사람에게만 알린다. 다시 부를 기회를 주는 알림이라 즉시 닿아야 뜻이 있다.
    if (item.kind === 'auction') {
      const before = leadingBid(item, marketBids);
      if (before && before.name !== currentUser.name) {
        notify(marketOutbidDrafts(item, [before], today()));
      }
    } else {
      // 나눔은 그 자리에서 주인이 정해진다. 마감을 기다릴 이유가 없다.
      notify(marketWonDrafts(item, currentUser.name, today()));
    }
  };

  const cancelMarketItem = (item: MarketItem) => {
    const bidders = marketBids.filter((bid) => bid.itemId === item.id).map((bid) => bid.name);
    if (bidders.length > 0) {
      notify(marketCanceledDrafts(item, [...new Set(bidders)], today()));
      // 부른 사람이 있는 거래를 지우면 그 기록까지 사라진다. 지우지 않고 취소로 남긴다.
      persistMarketItems(marketItems.map((entry) => (entry.id === item.id ? { ...entry, canceled: true } : entry)));
      return;
    }
    void deleteMarketItemRecord(item.id);
    persistMarketItems(marketItems.filter((entry) => entry.id !== item.id));
  };

  // 완전 삭제. 내리기(기록 보존)와 달리 물건과 입찰 기록까지 통째로 지운다. 글쓴이(판매자)와 팀리더만.
  const deleteMarketItem = (item: MarketItem) => {
    if (!currentUser) return;
    if (item.seller !== currentUser.name && !isTeamLeader(currentUser)) return;
    void deleteMarketItemRecord(item.id);
    // market_bids 는 item 에 FK 가 없어 DB 에서 자동으로 안 지워진다. 명시적으로 걷어낸다.
    void deleteMarketBidsForItem(item.id);
    persistMarketItems(marketItems.filter((entry) => entry.id !== item.id));
    const nextBids = marketBids.filter((bid) => bid.itemId !== item.id);
    setMarketBids(nextBids);
    cacheMarketBids(nextBids);
  };

  /* 거래 완료는 양쪽이 각각 누른다. 앱은 결제를 다루지 않아 누가 잘못했는지
     판정할 수 없으므로, 한쪽 말만 듣고 완료로 바꾸지 않는다. */
  const markMarketDone = (item: MarketItem) => {
    if (!currentUser) return;
    const isSeller = item.seller === currentUser.name;
    const won = leadingBid(item, marketBids);
    const isBuyer = won?.name === currentUser.name;
    if (!isSeller && !isBuyer) return;

    persistMarketItems(
      marketItems.map((entry) =>
        entry.id === item.id
          ? { ...entry, sellerDone: entry.sellerDone || isSeller, buyerDone: entry.buyerDone || isBuyer }
          : entry,
      ),
    );
  };

  const registerAccount = (account: Omit<ManagedAccount, 'id' | 'joinedAt' | 'status'>) => {
    persistAccounts([
      ...accounts,
      {
        ...account,
        id: makeAccountId(),
        status: '승인 대기',
        joinedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
  };

  const changeSection = (section: Section) => {
    // 리더 관리함은 실제 리더 역할만. 커넥셔너 전권으로는 딥링크(#leader)로도 못 들어온다.
    if (section === 'leader' && currentUser && !hasLeaderRole(currentUser)) {
      setActive('dashboard');
      return;
    }
    if (section === 'accounts' && currentUser && !isTeamLeader(currentUser)) {
      setActive('dashboard');
      return;
    }
    // 시스템 관리는 커넥셔너(슈퍼관리자)만. 딥링크(#system)로도 못 들어온다.
    if (section === 'system' && currentUser && !isConnectioner(currentUser)) {
      setActive('dashboard');
      return;
    }
    setActive(section);
  };

  // 홈 피드에서 게시글을 누르면 그 섹션으로 이동해 해당 항목 상세를 연다(딥링크).
  // 각 보드는 focusId 를 받으면 그 항목 상세를 열고 onFocusHandled 로 한 번만 소비한다.
  const [feedFocus, setFeedFocus] = useState<{ section: Section; id: string } | null>(null);
  // 인스타처럼 '본 스토리'를 기록한다. 본 번개는 트레이에서 뒤로 밀리고 링이 회색이 된다.
  const [viewedStoryIds, setViewedStoryIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('skgrove:viewedStories');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const openFeedItem = (section: Section, id: string) => {
    changeSection(section);
    setFeedFocus({ section, id });
    // 번개 스토리를 열면 '봤음'으로 기록(피드의 다른 도메인은 스토리가 아니라 무시).
    if (section === 'gatherings') {
      setViewedStoryIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        try {
          localStorage.setItem('skgrove:viewedStories', JSON.stringify(next));
        } catch {
          // 저장 실패해도 화면 정렬/링은 이번 세션 동안 유지된다.
        }
        return next;
      });
    }
  };
  const clearFeedFocus = () => setFeedFocus(null);
  const focusFor = (section: Section) => (feedFocus?.section === section ? feedFocus.id : null);

  // 딥링크: 로그인 상태에서 #해시가 있으면 해당 화면으로 이동(슬랙 알림 링크 진입점).
  // 단, 해시는 '한 번만' 소비하고 주소창에서 지운다. 안 지우면 슬랙 링크로 한 번
  // 들어온 해시가 주소창에 계속 남아, 다음 로그인 때마다 그 페이지로 되돌아간다
  // (닫았던 화면이 되살아나 '새 로그인 = 홈'이 깨짐). 소비 후 지우면 다음 로그인은
  // 해시가 없어 홈(dashboard)으로 시작한다.
  useEffect(() => {
    if (!currentUser) return;
    const applyHash = () => {
      const target = SECTION_BY_HASH[window.location.hash];
      if (!target) return;
      changeSection(target);
      // 해시를 읽는 하위 화면(예: 티미팅 tea 탭)이 먼저 읽도록 다음 틱에 지운다.
      window.setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }, 0);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleLogin = (user: CurrentUser) => {
    setActive('dashboard');
    setSelectedCanId(null);
    setCurrentUser(user);
    saveSession(user); // 새로고침해도 로그인 유지
  };

  if (!currentUser) {
    return (
      <LoginScreen
        accounts={accounts}
        onLogin={handleLogin}
        onRegister={registerAccount}
        onSetPassword={setAccountPassword}
      />
    );
  }

  // 관리자(admin) 로그인 시 데이터 정제 화면만 보여준다(일반 앱 진입 없이).
  if (currentUser.email === 'admin') {
    return <DataCleanup onLogout={() => { clearSession(); setCurrentUser(null); }} />;
  }

  const unreadCount = notifications.filter(
    (item) => item.recipientName === currentUser.name && !item.read,
  ).length;

  return (
    <ProfilesContext.Provider value={profileMap}>
    <AppShell
      active={active}
      currentUser={currentUser}
      currentPhotoUrl={accounts.find((account) => account.email.toLowerCase() === currentUser.email.toLowerCase())?.photoUrl}
      onSavePhoto={saveMyProfilePhoto}
      unreadCount={unreadCount}
      onLogout={() => {
        clearSession();
        setCurrentUser(null);
      }}
      onSectionChange={changeSection}
    >
      {/* 화면 단위 경계. 접수 화면 하나가 깨졌다고 사이드바까지 사라져 다른 메뉴로
          옮기지도 못하면 안 된다. resetKey 로 화면을 바꾸면 오류 상태를 푼다. */}
      <ErrorBoundary label={sections.find((section) => section.id === active)?.label} resetKey={active}>
      {active === 'dashboard' && (
        <Dashboard
          openIssueCount={openIssueCount}
          passedAgendaCount={passedAgendaCount}
          agendas={agendas}
          currentUser={currentUser}
          actionItems={actionItems}
          gatherings={gatherings}
          signups={gatheringSignups}
          humorPosts={humorPosts}
          marketItems={marketItems}
          today={today()}
          now={nowStamp()}
          onSectionChange={changeSection}
          onOpenFeedItem={openFeedItem}
          viewedStoryIds={viewedStoryIds}
          onIdentityChange={setIdentity}
        />
      )}
      {active === 'intake' && (
        <Intake
          currentUser={currentUser}
          identity={identity}
          issues={issues}
          partLeaders={accounts
            .filter((account) => account.status === '활성' && account.role === '파트리더')
            .map((account) => ({ name: account.name, part: account.part }))}
          onIdentityChange={setIdentity}
          onIssueUpdate={updateIssue}
          onSubmitIssue={submitIssue}
        />
      )}
      {active === 'leader' && hasLeaderRole(currentUser) && (
        <LeaderInbox
          issues={issues}
          accounts={accounts}
          currentUser={currentUser}
          today={today()}
          onIssueUpdate={updateIssue}
          onPromoteToAgenda={promoteToAgenda}
        />
      )}
      {active === 'agenda' && !agendaForActions && (
        <AgendaBoard
          agendas={agendas}
          currentUser={currentUser}
          votedAgendaIds={votedAgendaIds}
          canClose={isLeader(currentUser)}
          today={today()}
          onVote={vote}
          onCloseAgenda={closeAgenda}
          onCreateAgenda={createAgenda}
          actionCountByAgenda={actionCountByAgenda}
          onCreateActions={setAgendaForActions}
          focusId={focusFor('agenda')}
          onFocusHandled={clearFeedFocus}
        />
      )}
      {active === 'agenda' && agendaForActions && (
        <section className="screen">
          <ActionCreateForm
            agenda={agendaForActions}
            accounts={accounts}
            today={today()}
            onCreate={(agenda, drafts) => {
              createActionItemsFromAgenda(agenda, drafts);
              setAgendaForActions(null);
            }}
            onCancel={() => setAgendaForActions(null)}
          />
        </section>
      )}
      {active === 'actions' && (
        <ActionBoard
          items={actionItems}
          accounts={accounts}
          currentUser={currentUser}
          today={today()}
          onUpdate={updateActionItem}
        />
      )}
      {active === 'meetings' && (
        <Meetings
          sessions={canSessions}
          opinions={canOpinions}
          selectedId={selectedCanId}
          currentUser={currentUser}
          canSteps={canSteps}
          onSelectSession={setSelectedCanId}
          onStartSession={startCanSession}
          onUpdateSession={updateCanSession}
          onAddOpinion={addCanOpinion}
          onToggleOpinion={toggleCanOpinion}
          onConfirmResult={confirmCanResult}
          onApplyFollowUp={applyCanFollowUp}
          onCanStepsChange={updateCanSteps}
          teaSessions={teaSessions}
          teaSessionTypes={teaSessionTypes}
          onAddTeaSession={addTeaSession}
          onUpdateTeaStatus={updateTeaSessionStatus}
          onSetTeaMemo={setTeaSessionMemo}
          onSetTeaHeldAt={setTeaSessionHeldAt}
          onTeaTypesChange={updateTeaSessionTypes}
          onAnnounceToSlack={announceTeaToSlack}
          onNotifyStatus={notifyStatus}
        />
      )}
      {active === 'gatherings' && (
        <GatheringBoard
          gatherings={gatherings}
          signups={gatheringSignups}
          currentUser={currentUser}
          now={nowStamp()}
          onCreate={(draft) => void createGathering(draft)}
          onJoin={(gathering) => void joinGathering(gathering)}
          onLeave={(gathering) => void leaveGathering(gathering)}
          imagePendingIds={imagePendingIds}
          onCancelGathering={cancelGathering}
          onDrawCoffee={drawCoffeePick}
          canModerate={isTeamLeader(currentUser)}
          onDelete={deleteGathering}
          focusId={focusFor('gatherings')}
          onFocusHandled={clearFeedFocus}
        />
      )}
      {active === 'market' && (
        <MarketBoard
          bids={marketBids}
          currentUser={currentUser}
          items={marketItems}
          now={nowStamp()}
          imagePendingIds={imagePendingIds}
          onBid={(item, amount) => void placeMarketBid(item, amount)}
          onCancelItem={cancelMarketItem}
          onCreate={(draft) => void createMarketItem(draft)}
          onUpdate={(item, draft) => void updateMarketItem(item, draft)}
          onMarkDone={markMarketDone}
          canModerate={isTeamLeader(currentUser)}
          onDelete={deleteMarketItem}
          focusId={focusFor('market')}
          onFocusHandled={clearFeedFocus}
        />
      )}
      {active === 'notifications' && (
        <NotificationCenter
          notifications={notifications}
          currentUser={currentUser}
          accounts={accounts}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onSend={sendMessage}
          onOpen={changeSection}
        />
      )}
      {active === 'humor' && (
        <HumorBoard
          posts={humorPosts}
          comments={humorComments}
          currentUser={currentUser}
          canModerate={isTeamLeader(currentUser)}
          imagePendingIds={imagePendingIds}
          onAddPost={addHumorPost}
          onToggleLike={toggleHumorLike}
          onAddComment={addHumorComment}
          onEditPost={editHumorPost}
          onDeletePost={deleteHumorPost}
          onDeleteComment={deleteHumorComment}
          focusId={focusFor('humor')}
          onFocusHandled={clearFeedFocus}
        />
      )}
      {active === 'profiles' && (
        <Profiles mode="directory" currentUser={currentUser} onProfilesChange={setProfileDirectory} />
      )}
      {active === 'mypage' && (
        <Profiles mode="mine" currentUser={currentUser} onProfilesChange={setProfileDirectory} />
      )}
      {active === 'connect' && <Connect members={connectMembers} />}
      {active === 'memory' && <Memory currentUser={currentUser} />}
      {active === 'metrics' && <Metrics currentUser={currentUser} />}
      {active === 'accounts' && isTeamLeader(currentUser) && <AccountManagement accounts={accounts} onAccountsChange={persistAccounts} />}
      {active === 'system' && isConnectioner(currentUser) && (
        <SystemManagement settings={notifySettings} onSettingsChange={persistNotifySettings} />
      )}
      </ErrorBoundary>
      {/* 토스트는 경계 밖에 둔다. 화면이 깨져도 저장 실패 같은 알림은 계속 보여야 한다. */}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </AppShell>
    {/* AI 상담 챗봇 — 라우팅과 무관하게 모든 화면 위에 떠 있는 플로팅 위젯. */}
    <ChatWidget currentUser={currentUser} profiles={profileDirectory} issues={issues} agendas={agendas} />
    </ProfilesContext.Provider>
  );
}
