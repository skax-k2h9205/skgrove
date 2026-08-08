import { BarChart3, CalendarClock, CheckCircle2, Eye, Gauge, LockKeyhole, Settings2, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isTeamLeader } from '../../auth';
import { loadAccounts } from '../../accountStore';
import { mockCalendarEvents } from '../../mockCalendar';
import { loadActionItems } from '../../actionItemStore';
import { voteTotal } from '../../agendaRules';
import { loadAgendas } from '../../agendaStore';
import { loadBallots } from '../../ballotStore';
import {
  calendarConfigured,
  fetchCalendarSnapshot,
  meetingLoadByPerson,
  type MeetingLoad,
  toMetricEvents,
} from '../../googleCalendar';
import {
  initialAgendas,
  initialCanOpinions,
  initialCanSessions,
  initialIssues,
  profiles,
} from '../../data/mockData';
import { loadIssues } from '../../issueStore';
import {
  DEFAULT_CALENDAR_WINDOW_DAYS,
  LONG_MEETING_MINUTES,
  WEEKLY_MEETING_BUDGET_HOURS,
  clampScore,
  formatHours,
  meetingBudgetUsage,
  meetingHealth,
  weeklyMeetingHours,
  weeklyMinutes,
} from '../../meetingRules';
import { MIN_MEMBERS_TO_REVEAL, isRevealable } from '../../metricsPrivacy';
import { loadTeaSessions } from '../../teaStore';
import type {
  ActionItem,
  Agenda,
  AgendaBallot,
  CalendarConnection,
  CalendarMetricEvent,
  CanOpinion,
  CanSession,
  CurrentUser,
  Issue,
  ManagedAccount,
  Profile,
  TeaSession,
} from '../../types';

type PartMetric = {
  name: string;
  members: number;
  opinionSubmitted: number;
  reflectedOpinions: number;
  voteParticipation: number;
  coffeeParticipation: number;
  oneOnOneMinutes: number;
  partMeetingMinutes: number;
  longMeetingRate: number;
  meetingTrend: string;
  profileColors: {
    label: string;
    value: number;
    color: 'green' | 'red' | 'blue' | 'yellow';
  }[];
  traits: string[];
};

type MetricWeights = {
  opinion: number;
  reflected: number;
  participation: number;
  healthyMeeting: number;
  overloadPenalty: number;
  rewardScore: number;
};

const initialWeights: MetricWeights = {
  opinion: 20,
  reflected: 30,
  participation: 20,
  healthyMeeting: 20,
  overloadPenalty: 10,
  rewardScore: 82,
};

const partNames = ['TEST혁신파트', 'ITS혁신파트', 'PM혁신파트'];


type MetricsActivity = {
  actionItems: ActionItem[];
  agendas: Agenda[];
  ballots: AgendaBallot[];
  calendarEvents: CalendarMetricEvent[];
  /** calendarEvents 를 모은 기간(일). 합계를 주당 값으로 되돌리는 분모다. */
  calendarWindowDays: number;
  canOpinions: CanOpinion[];
  canSessions: CanSession[];
  connectShareTexts: string[];
  issues: Issue[];
  teaSessions: TeaSession[];
};

// CalendarMeetingType · CalendarMetricEvent · CalendarConnection 은 types.ts 로 옮겼다.
// googleCalendar.ts 의 매핑 함수와 같은 타입을 써야 하기 때문이다.

const initialActivity: MetricsActivity = {
  actionItems: [],
  agendas: initialAgendas,
  ballots: [],
  calendarEvents: [],
  calendarWindowDays: DEFAULT_CALENDAR_WINDOW_DAYS,
  canOpinions: initialCanOpinions,
  canSessions: initialCanSessions,
  connectShareTexts: [],
  issues: initialIssues,
  teaSessions: [],
};

type MetricsProps = {
  currentUser: CurrentUser;
};

const CALENDAR_STORAGE_KEY = 'skgrove:metrics-calendar-events';
const CALENDAR_STATUS_KEY = 'skgrove:metrics-calendar-status';
// 몇 일치를 모은 값인지 함께 남긴다. 이게 없으면 저장된 합계를 주당으로 되돌릴 수 없다.
const CALENDAR_WINDOW_KEY = 'skgrove:metrics-calendar-window-days';

// clampScore·회의 건강도 계산은 meetingRules.ts 로 옮겼다. 테스트가 붙는 자리다.
function getMeetingHealth(part: PartMetric) {
  // part.oneOnOneMinutes / partMeetingMinutes 는 이미 '주당' 값이다(buildPartMetrics 참고).
  return meetingHealth(part.oneOnOneMinutes, part.partMeetingMinutes, part.longMeetingRate);
}

function getReflectionRate(part: PartMetric) {
  if (part.opinionSubmitted === 0) return 0;
  return Math.round((part.reflectedOpinions / part.opinionSubmitted) * 100);
}

function getPartScore(part: PartMetric, weights: MetricWeights) {
  const opinionScore = Math.min(100, part.opinionSubmitted * 5);
  const reflectedScore = getReflectionRate(part);
  const participationScore = Math.round((part.voteParticipation + part.coffeeParticipation) / 2);
  const meetingHealth = getMeetingHealth(part);
  const longMeetingPenalty = part.longMeetingRate * (weights.overloadPenalty / 30);

  return clampScore(
    (opinionScore * weights.opinion +
      reflectedScore * weights.reflected +
      participationScore * weights.participation +
      meetingHealth * weights.healthyMeeting) /
      (weights.opinion + weights.reflected + weights.participation + weights.healthyMeeting) -
      longMeetingPenalty,
  );
}

function getDominantTone(part: PartMetric) {
  return [...part.profileColors].sort((a, b) => b.value - a.value)[0];
}

function getProfileTone(profile: Profile): PartMetric['profileColors'][number] {
  const source = `${profile.trait} ${profile.style} ${profile.role}`;

  if (/품질|기준|테스트|판단|재현|리스크/.test(source)) {
    return { label: '맥락형', value: 0, color: 'green' };
  }
  if (/빠르게|실행|실험|피드백|개선|시도/.test(source)) {
    return { label: '실행형', value: 0, color: 'red' };
  }
  if (/구조|룰|운영|프로세스|정리|흐름|도구/.test(source)) {
    return { label: '구조형', value: 0, color: 'blue' };
  }
  return { label: '연결형', value: 0, color: 'yellow' };
}

function getProfilePalette(members: Profile[]) {
  const base: PartMetric['profileColors'] = [
    { label: '맥락형', value: 0, color: 'green' },
    { label: '실행형', value: 0, color: 'red' },
    { label: '구조형', value: 0, color: 'blue' },
    { label: '연결형', value: 0, color: 'yellow' },
  ];

  members.forEach((member) => {
    const tone = getProfileTone(member);
    const target = base.find((item) => item.label === tone.label);
    if (target) target.value += 1;
  });

  return base.map((item) => ({
    ...item,
    value: members.length > 0 ? Math.round((item.value / members.length) * 100) : 0,
  }));
}

function getTraits(members: Profile[]) {
  return members
    .map((member) => member.style)
    .filter(Boolean)
    .slice(0, 3);
}

function getConnectParticipation(partMembers: Profile[], shareTexts: string[]) {
  if (shareTexts.length === 0 || partMembers.length === 0) return 0;

  const participated = new Set<string>();
  shareTexts.forEach((text) => {
    partMembers.forEach((member) => {
      if (text.includes(member.name)) participated.add(member.name);
    });
  });

  return Math.round((participated.size / partMembers.length) * 100);
}

function getVoteParticipation(partAgendas: Agenda[], allAgendas: Agenda[], ballots: AgendaBallot[]) {
  const targetAgendas = partAgendas.length > 0 ? partAgendas : allAgendas;
  const eligibleCount = targetAgendas.reduce((sum, agenda) => sum + Math.max(agenda.eligibleCount, 0), 0);
  // 참여율이므로 '표'가 아니라 '사람'을 센다. 객관식 복수 선택은 한 사람이 여러 표를 던진다.
  const visibleVoteCount = targetAgendas.reduce((sum, agenda) => sum + voteTotal(agenda), 0);
  const anonymousBallotHint = allAgendas.length > 0 ? Math.round(ballots.length / allAgendas.length) : 0;

  if (eligibleCount <= 0) return 0;
  return clampScore(((visibleVoteCount + anonymousBallotHint) / eligibleCount) * 100);
}

function getMeetingTrend(partMeetingMinutes: number, longMeetingRate: number) {
  if (longMeetingRate >= 35) return '긴 회의 비율이 높아 45분 컷 운영을 권장해요.';
  if (partMeetingMinutes >= 520) return '파트회의 총량이 높아 안건 사전 정리를 붙이면 좋아요.';
  return '원온원과 파트회의 길이가 안정권이에요.';
}

function readConnectShareTexts() {
  try {
    const saved = window.localStorage.getItem('skgrove:connect-results');
    if (!saved) return [];
    const parsed = JSON.parse(saved) as { shareText?: string }[];
    return parsed.map((item) => item.shareText ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

function readCalendarEvents() {
  try {
    const saved = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (!saved) return [];
    return JSON.parse(saved) as CalendarMetricEvent[];
  } catch {
    return [];
  }
}

function readCalendarStatus(): CalendarConnection {
  const saved = window.localStorage.getItem(CALENDAR_STATUS_KEY);
  if (saved === 'connected' || saved === 'synced') return saved;
  return 'disconnected';
}

function readCalendarWindowDays(): number {
  const saved = Number(window.localStorage.getItem(CALENDAR_WINDOW_KEY));
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_CALENDAR_WINDOW_DAYS;
}

function saveCalendarState(status: CalendarConnection, events: CalendarMetricEvent[], windowDays: number) {
  window.localStorage.setItem(CALENDAR_STATUS_KEY, status);
  window.localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
  window.localStorage.setItem(CALENDAR_WINDOW_KEY, String(windowDays));
}

function buildPartMetrics(activity: MetricsActivity): PartMetric[] {
  return partNames.map((partName) => {
    const members = profiles.filter((profile) => profile.part === partName);
    const canOpinions = activity.canOpinions.filter((opinion) => opinion.part === partName);
    const partAgendas = activity.agendas.filter((agenda) => agenda.part === partName || agenda.part === '전체');
    const partActions = activity.actionItems.filter((item) => members.some((member) => item.owner === member.name));
    const reflectedFromCan = canOpinions.filter((opinion) => opinion.selected).length;
    const reflectedFromActions = partActions.filter((item) => item.status === '완료' || item.status === '진행중').length;
    const issuePressure = activity.issues.filter((issue) => issue.target === '파트장' || issue.target.includes(partName)).length;
    const teaCount = activity.teaSessions.filter((session) => session.part === partName || members.some((member) => member.name === session.presenter)).length;
    const canSessionCount = activity.canSessions.filter((session) => session.parts.includes(partName as never)).length;
    const partCalendarEvents = activity.calendarEvents.filter((event) => event.part === partName);
    const calendarOneOnOneMinutes = partCalendarEvents
      .filter((event) => event.type === '원온원')
      .reduce((sum, event) => sum + event.durationMinutes, 0);
    const calendarMeetingMinutes = partCalendarEvents
      .filter((event) => event.type !== '원온원')
      .reduce((sum, event) => sum + event.durationMinutes, 0);
    const longCalendarMeetings = partCalendarEvents.filter(
      (event) => event.durationMinutes >= LONG_MEETING_MINUTES,
    ).length;
    // 캘린더는 90일치를 읽어온다. 그 합계를 주당 값으로 맞춘 뒤에 쓴다.
    // 안 그러면 12.9주치가 1주로 들어가 어떤 파트든 과부하로 잡힌다.
    const windowDays = activity.calendarWindowDays;
    // 캘린더가 붙어 있으면 그 값을 쓴다. 원온원이 0건인 것도 사실이므로 추정식으로 되돌리지 않는다.
    // 예전에는 `|| 추정식` 이라 0이 곧 '데이터 없음'으로 취급됐다.
    const hasCalendar = partCalendarEvents.length > 0;
    const oneOnOneMinutes = hasCalendar
      ? weeklyMinutes(calendarOneOnOneMinutes, windowDays)
      : members.length * 25 + issuePressure * 20;
    const partMeetingMinutes = hasCalendar
      ? weeklyMinutes(calendarMeetingMinutes, windowDays)
      : canSessionCount * 80 + teaCount * 45 + canOpinions.length * 12;
    const longMeetingRate = hasCalendar
      ? clampScore((longCalendarMeetings / partCalendarEvents.length) * 100)
      : clampScore((canSessionCount * 8 + teaCount * 4 + issuePressure * 3) / Math.max(1, members.length) * 5);

    return {
      name: partName,
      members: members.length,
      opinionSubmitted: canOpinions.length + issuePressure,
      reflectedOpinions: reflectedFromCan + reflectedFromActions,
      voteParticipation: getVoteParticipation(partAgendas, activity.agendas, activity.ballots),
      coffeeParticipation: getConnectParticipation(members, activity.connectShareTexts),
      oneOnOneMinutes,
      partMeetingMinutes,
      longMeetingRate,
      meetingTrend: getMeetingTrend(partMeetingMinutes, longMeetingRate),
      profileColors: getProfilePalette(members),
      traits: getTraits(members),
    };
  });
}

/** 분 → '1시간 35분'. 0 이면 '0분'. 소수점은 사람에게 뜻이 없다. */
function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total}분`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/** 팀원들의 하루 평균을 다시 평균낸다. 사람 단위로 봐야 한 명의 폭주가 묻히지 않는다. */
function averageOf(loads: MeetingLoad[]): number {
  if (loads.length === 0) return 0;
  return loads.reduce((sum, load) => sum + load.avgPerWorkday, 0) / loads.length;
}

/** 'YYYY-MM-DD' → '8월 7일'. 앞의 0 을 떼야 사람이 쓰는 표기가 된다. */
function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-');
  if (!month || !day) return date;
  return `${Number(month)}월 ${Number(day)}일`;
}

/** 모든 사람·모든 날 중 가장 회의가 많았던 하루. */
function busiestOf(loads: MeetingLoad[]): { name: string; date: string; minutes: number } | null {
  let best: { name: string; date: string; minutes: number } | null = null;
  for (const load of loads) {
    if (!load.busiestDay) continue;
    if (!best || load.busiestDay.minutes > best.minutes) {
      best = { name: load.name, date: load.busiestDay.date, minutes: load.busiestDay.minutes };
    }
  }
  return best;
}

export function Metrics({ currentUser }: MetricsProps) {
  const [activity, setActivity] = useState<MetricsActivity>(initialActivity);
  const [partMetrics, setPartMetrics] = useState<PartMetric[]>(() => buildPartMetrics(initialActivity));
  const [calendarEvents, setCalendarEvents] = useState<CalendarMetricEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarConnection>('disconnected');
  // 언제 기준 값인지 밝히지 않으면 오래된 값을 지금 값으로 착각한다.
  const [calendarSyncedAt, setCalendarSyncedAt] = useState<string | null>(null);
  // 사람별 집계는 파트 판정과 다른 축이라 원시 일정에서 따로 센다.
  // 회의 부담 — 요청한 세 지표(평균·최대·최소)와 그 값이 얼마나 믿을 만한지.
  const [meetingLoad, setMeetingLoad] = useState<ReturnType<typeof meetingLoadByPerson> | null>(null);
  // 캘린더 미연결일 때 등록된 회원으로 만든 목업을 보여주는 중인지. 배너로 밝힌다.
  const [isSample, setIsSample] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [selectedPart, setSelectedPart] = useState(currentUser.part === '전체' ? partNames[0] : currentUser.part);
  const [weights, setWeights] = useState(initialWeights);
  const canViewAllLeaderMetrics = isTeamLeader(currentUser); // 커넥셔너 포함
  const isPartLeader = currentUser.role === '파트리더';

  useEffect(() => {
    let isMounted = true;

    const savedCalendarStatus = readCalendarStatus();
    const savedCalendarEvents = readCalendarEvents();
    // 저장된 합계가 몇 일치인지 함께 복원해야 주당 값으로 되돌릴 수 있다.
    const savedCalendarWindowDays = readCalendarWindowDays();
    setCalendarStatus(savedCalendarStatus);
    setCalendarEvents(savedCalendarEvents);

    Promise.all([
      loadIssues(),
      loadAgendas(),
      loadBallots(),
      loadActionItems(),
      loadTeaSessions(),
    ]).then(([issues, agendas, ballots, actionItems, teaSessions]) => {
      if (!isMounted) return;
      const loadedActivity = {
        actionItems,
        agendas,
        ballots,
        calendarEvents: savedCalendarEvents,
        calendarWindowDays: savedCalendarWindowDays,
        canOpinions: initialCanOpinions,
        canSessions: initialCanSessions,
        connectShareTexts: readConnectShareTexts(),
        issues,
        teaSessions,
      };
      setActivity(loadedActivity);
      setPartMetrics(buildPartMetrics(loadedActivity));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const scoredParts = useMemo(
    () =>
      partMetrics
        .map((part) => ({
          ...part,
          score: getPartScore(part, weights),
          meetingHealth: getMeetingHealth(part),
          reflectionRate: getReflectionRate(part),
          dominantTone: getDominantTone(part),
        }))
        .sort((a, b) => b.score - a.score),
    [partMetrics, weights],
  );

  const activePart = scoredParts.find((part) => part.name === selectedPart) ?? scoredParts[0];
  const canViewActiveLeaderMetrics = canViewAllLeaderMetrics || (isPartLeader && currentUser.part === activePart.name);
  const modeClass = canViewAllLeaderMetrics ? 'team-leader-mode' : isPartLeader ? 'part-leader-mode' : 'public-member-mode';
  const modeTitle = canViewAllLeaderMetrics ? '팀리더 운영 콘솔' : isPartLeader ? '파트리더 리더룸' : '팀원 공개 리포트';
  const accessLabel = canViewActiveLeaderMetrics ? '리더 전용 지표 포함' : '전체 공개 지표';
  const accessDescription = canViewActiveLeaderMetrics
    ? '회의 과다 감점, 상세 반영률, 운영 리스크 신호까지 확인할 수 있어요.'
    : '민감할 수 있는 회의량과 운영 리스크는 리더 권한에서만 보여요.';
  const rewardCandidates = scoredParts.filter((part) => part.score >= weights.rewardScore);
  const totalOpinions = scoredParts.reduce((sum, part) => sum + part.opinionSubmitted, 0);
  const reflectedOpinions = scoredParts.reduce((sum, part) => sum + part.reflectedOpinions, 0);
  const averageMeetingHealth = Math.round(scoredParts.reduce((sum, part) => sum + part.meetingHealth, 0) / scoredParts.length);
  const reflectionRate = totalOpinions > 0 ? Math.round((reflectedOpinions / totalOpinions) * 100) : 0;
  const activeCalendarEvents = calendarEvents.filter((event) => event.part === activePart.name);
  const longCalendarEventCount = activeCalendarEvents.filter((event) => event.durationMinutes >= 60).length;

  const applyCalendarEvents = (
    status: CalendarConnection,
    events: CalendarMetricEvent[],
    windowDays: number,
  ) => {
    setCalendarStatus(status);
    setCalendarEvents(events);
    saveCalendarState(status, events, windowDays);
    const nextActivity = {
      ...activity,
      calendarEvents: events,
      calendarWindowDays: windowDays,
      connectShareTexts: readConnectShareTexts(),
    };
    setActivity(nextActivity);
    setPartMetrics(buildPartMetrics(nextActivity));
  };

  // 최근 90일치를 읽는다. 회의 습관을 보는 지표라 오래된 일정은 도움이 안 되고,
  // 범위를 넓힐수록 구글 응답도 무거워진다.
  const CALENDAR_LOOKBACK_DAYS = 90;

  /*
    서버가 30분마다 당겨둔 것을 읽는다. 사람이 '연결'을 누를 필요가 없다.
    화면을 열 때 한 번 읽고, 버튼은 '지금 새로고침'으로만 남긴다.
  */
  const loadFromServer = async (manual = false) => {
    if (calendarBusy) return;
    setCalendarBusy(true);
    if (manual) setCalendarError('');
    try {
      const snap = await fetchCalendarSnapshot();
      if (!snap.ok || !snap.events) {
        // 설정 안 됨·읽기 실패 모두 실제 데이터가 없는 것 — 이미 채워둔 샘플을 그대로 둔다.
        if (manual && snap.reason !== 'disabled') {
          setCalendarError(`캘린더를 읽지 못해 샘플을 유지합니다: ${snap.reason ?? '알 수 없는 오류'}`);
        }
        return;
      }

      // 파트 판정은 계정 정보를 가진 이 화면에서 한다. 조직 구성을 프록시로 보내지 않는다.
      const accounts = await loadAccounts();
      const events = toMetricEvents(snap.events, accounts);
      if (events.length === 0) {
        // 실제 회의가 파트로 안 잡히면 빈 화면 대신 샘플을 유지한다.
        if (manual) {
          setCalendarError(
            `읽어온 일정 ${snap.events.length}건 중 파트를 정할 수 있는 회의가 없어 샘플을 유지합니다. ` +
              '제목 앞에 [회의/참여자] 또는 [파트명] 을 적으면 파트별로 집계됩니다.',
          );
        }
        return;
      }
      // 실제 회의가 있으니 샘플을 대체한다.
      applyCalendarEvents('synced', events, CALENDAR_LOOKBACK_DAYS);
      setCalendarSyncedAt(snap.syncedAt ?? null);
      setMeetingLoad(meetingLoadByPerson(snap.events, accounts));
      setIsSample(false);
    } finally {
      setCalendarBusy(false);
    }
  };

  // 등록된 회원으로 4주치 목업 회의를 만들어 파트·사람별 대시보드를 채운다(샘플).
  const applyMockCalendar = (accounts: ManagedAccount[]) => {
    const raw = mockCalendarEvents(accounts, new Date(), 4);
    const events = toMetricEvents(raw, accounts);
    applyCalendarEvents('disconnected', events, 28); // 4주 = 28일 창
    setMeetingLoad(meetingLoadByPerson(raw, accounts));
    setIsSample(true);
    setCalendarError('');
  };

  /* 화면을 열면 대시보드를 비우지 않게 등록 회원으로 목업을 먼저 채우고,
     연동이 설정돼 실제 회의가 있으면 그것으로 대체한다(없으면 샘플 유지). */
  useEffect(() => {
    void loadAccounts().then(applyMockCalendar);
    if (calendarConfigured()) void loadFromServer(false);
    // 마운트 때 한 번만. 주기 조회는 서버가 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importSampleCalendar = () => {
    void loadAccounts().then(applyMockCalendar);
  };

  const updateWeight = (key: keyof MetricWeights, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

  return (
    <section className={`screen metrics-screen ${modeClass}`}>
      <section className="metrics-hero">
        <div>
          <p className="eyebrow">CULTURE HEALTH REPORT</p>
          <h2>{modeTitle}</h2>
          <p>
            {canViewAllLeaderMetrics
              ? '전체 파트의 회의 리스크, 보상 기준, 문화 흐름을 운영 관점에서 봅니다.'
              : isPartLeader
                ? `${currentUser.part}의 회의 리스크와 의견 반영 흐름을 리더 관점에서 봅니다.`
                : '팀원에게 공개 가능한 파트별 문화 흐름과 성향 색만 가볍게 봅니다.'}
          </p>
        </div>
        <div className="metrics-access-card">
          {canViewAllLeaderMetrics ? <ShieldCheck size={22} /> : isPartLeader ? <UsersRound size={22} /> : <Eye size={22} />}
          <strong>{currentUser.role}</strong>
          <span>{accessLabel}</span>
          <small>{currentUser.part === '전체' ? '전체 파트 접근' : currentUser.part}</small>
        </div>
      </section>

      <section className="metrics-permission-strip" aria-label="권한별 보기 단계">
        <div className="active">
          <Eye size={18} />
          <strong>전체 공개</strong>
          <span>파트지수, 반영률, 성향 팔레트</span>
        </div>
        <div className={isPartLeader || canViewAllLeaderMetrics ? 'active' : 'locked'}>
          {isPartLeader || canViewAllLeaderMetrics ? <UsersRound size={18} /> : <LockKeyhole size={18} />}
          <strong>파트리더</strong>
          <span>내 파트 회의 상세와 운영 힌트</span>
        </div>
        <div className={canViewAllLeaderMetrics ? 'active' : 'locked'}>
          {canViewAllLeaderMetrics ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
          <strong>팀리더</strong>
          <span>전체 파트 민감 지표와 계산 기준</span>
        </div>
      </section>

      <section className="metrics-visibility-banner">
        <div>
          <strong>{accessLabel}</strong>
          <span>{accessDescription}</span>
        </div>
        <div className="calendar-sync-card">
          <CalendarClock size={18} />
          <strong>Google Calendar</strong>
          <span>
            {calendarStatus === 'synced'
              ? `${calendarEvents.length}개 회의 반영됨`
              : isSample
                ? `샘플 ${calendarEvents.length}개 회의 표시 중`
                : calendarStatus === 'connected'
                  ? '연결됨 · 회의 가져오기 대기'
                  : '미연결'}
          </span>
        </div>
      </section>

      {isSample && (
        <section className="metrics-sample-banner">
          <Sparkles size={16} />
          <span>
            샘플 데이터예요 — 캘린더 연동 전, 등록된 회원으로 만든 4주치 예시 회의량입니다. 연동되면 실제 값으로 대체됩니다.
          </span>
        </section>
      )}

      <section className="metrics-summary">
        <div>
          <BarChart3 size={20} />
          의견 제출
          <strong>{totalOpinions}</strong>
        </div>
        <div>
          <CheckCircle2 size={20} />
          반영률
          <strong>{reflectionRate}%</strong>
        </div>
        <div>
          <Gauge size={20} />
          회의 건강도
          <strong>{averageMeetingHealth}</strong>
        </div>
        <div>
          <Sparkles size={20} />
          보상 후보
          <strong>{rewardCandidates.length}</strong>
        </div>
      </section>

      {canViewAllLeaderMetrics && (
        <section className="metrics-leader-console">
          <div>
            <ShieldCheck size={20} />
            <strong>팀리더 전용 운영 콘솔</strong>
            <span>모든 파트의 회의 과다 감점과 보상 기준 조정이 열려 있어요.</span>
          </div>
          <div>
            <Gauge size={20} />
            <strong>최대 긴 회의 비율 {Math.max(...scoredParts.map((part) => part.longMeetingRate))}%</strong>
            <span>민감 지표라 팀원 공개 화면에는 표시하지 않습니다.</span>
          </div>
          <div>
            <Settings2 size={20} />
            <strong>보상 기준 {weights.rewardScore}점</strong>
            <span>팀리더만 계산 기준을 조정할 수 있어요.</span>
          </div>
        </section>
      )}

      {canViewActiveLeaderMetrics && (
        <section className="metrics-calendar-panel">
          <div>
            <CalendarClock size={20} />
            <strong>Google Calendar 회의 분석</strong>
            {/* 연동이 돌고 있으면 설명하지 않는다. 아래 숫자가 이미 말한다.
                기준 시각은 설명이 아니라 사실이라 칩 줄로 옮겼다. */}
            {calendarStatus !== 'synced' && (
              <span>
                {calendarConfigured()
                  ? '서버가 30분마다 팀 캘린더를 읽습니다. 읽기만 하고 쓰지 않아요.'
                  : '연동이 아직 설정되지 않았어요. 샘플 회의로 계산 흐름을 먼저 확인할 수 있습니다.'}
              </span>
            )}
          </div>
          {/* 서버가 30분마다 알아서 당겨온다. 사람이 누를 버튼이 없다.
              연동 전에는 계산 흐름을 볼 수 있게 샘플만 남긴다. */}
          {!calendarConfigured() && (
            <div className="calendar-sync-actions">
              <button className="secondary-button" type="button" onClick={importSampleCalendar}>
                샘플 다시 생성
              </button>
            </div>
          )}
          {calendarError && <p className="form-error">{calendarError}</p>}
          {meetingLoad && meetingLoad.loads.length > 0 && (
            <div className="meeting-load">
              <p className="meeting-load-title">
                팀원 하루 회의시간
                <span>
                  근무일 기준입니다. 누구 회의인지 알 수 있는 {meetingLoad.attributed}건만 셌어요
                  (전체 {meetingLoad.total}건) — <b>실제는 이보다 많습니다.</b>
                </span>
              </p>
              <div className="meeting-load-stats">
                <div>
                  <span>평균</span>
                  <strong>{formatDuration(averageOf(meetingLoad.loads))}</strong>
                </div>
                <div className="peak">
                  <span>최대</span>
                  <strong>{formatDuration(meetingLoad.loads[0].avgPerWorkday)}</strong>
                  <em>{meetingLoad.loads[0].name}</em>
                </div>
                <div>
                  <span>최소</span>
                  <strong>{formatDuration(meetingLoad.loads[meetingLoad.loads.length - 1].avgPerWorkday)}</strong>
                  <em>{meetingLoad.loads[meetingLoad.loads.length - 1].name}</em>
                </div>
              </div>
              {/* 평균은 사람을 설득하지 못한다. 최악의 날이 설득한다. */}
              {busiestOf(meetingLoad.loads) && (
                <p className="meeting-load-peak">
                  가장 회의가 많았던 하루는 <b>{busiestOf(meetingLoad.loads)!.name}</b> 님의{' '}
                  <b>{formatDuration(busiestOf(meetingLoad.loads)!.minutes)}</b>이었어요
                  <span> ({formatMonthDay(busiestOf(meetingLoad.loads)!.date)})</span>
                </p>
              )}
            </div>
          )}
          {meetingLoad && meetingLoad.loads.length > 0 && (
            <div className="meeting-rank">
              {/* 위 요약과 같은 기준으로 센다. 파트 위클리는 그 파트 전원에게 붙는다 —
                  1시간짜리 파트 위클리면 파트원 각자에게 1시간이다. */}
              <p className="meeting-rank-title">사람별 하루 평균 회의시간</p>
              <ol className="meeting-rank-list">
                {meetingLoad.loads.slice(0, 8).map((row, index) => (
                  <li key={row.name}>
                    <span className="meeting-rank-no">{index + 1}</span>
                    <strong>{row.name}</strong>
                    {/* 1등 대비 길이로 그린다. 절대값으로 그리면 막대가 다 짧아진다. */}
                    <span className="meeting-rank-bar">
                      <span
                        style={{
                          width: `${Math.round((row.avgPerWorkday / meetingLoad.loads[0].avgPerWorkday) * 100)}%`,
                        }}
                      />
                    </span>
                    <em>{formatDuration(row.avgPerWorkday)}</em>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="calendar-event-summary">
            <span>선택 파트 회의 {activeCalendarEvents.length}개</span>
            <span>60분 이상 {longCalendarEventCount}개</span>
            {/* '상태 동기화됨'은 아무 정보가 없다. 언제 기준인지가 실제로 필요한 값이다. */}
            {calendarSyncedAt ? (
              <span>
                {new Date(calendarSyncedAt).toLocaleString('ko-KR', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                기준
              </span>
            ) : (
              <span>미연결</span>
            )}
          </div>
        </section>
      )}

      <div className="metrics-layout">
        <section className="panel metrics-ranking">
          <div className="panel-header">
            <BarChart3 size={20} />
            <h2>파트지수 랭킹</h2>
          </div>
          <div className="metrics-part-list">
            {scoredParts.map((part) => (
              <button
                className={part.name === activePart.name ? 'selected' : ''}
                key={part.name}
                onClick={() => setSelectedPart(part.name)}
                type="button"
              >
                <div>
                  <strong>{part.name}</strong>
                  <span>
                    {part.members}명{isRevealable(part) ? ` · 반영률 ${part.reflectionRate}%` : ''}
                  </span>
                  <small className={canViewAllLeaderMetrics || (isPartLeader && currentUser.part === part.name) ? 'leader-visible' : 'public-visible'}>
                    {canViewAllLeaderMetrics || (isPartLeader && currentUser.part === part.name) ? '리더 상세 열림' : '공개 지표만'}
                  </small>
                </div>
                {/* 인원 미달 파트는 점수 자리에 숫자를 넣지 않는다. 흐린 값도 단서가 된다. */}
                <em className={isRevealable(part) ? '' : 'score-hidden'}>
                  {isRevealable(part) ? part.score : '비공개'}
                </em>
              </button>
            ))}
          </div>
        </section>

        <section className="panel metrics-detail">
          <div className="metrics-detail-head">
            <div>
              <p className="eyebrow">선택 파트 분석</p>
              <h2>{activePart.name}</h2>
            </div>
            <div className="metrics-detail-badges">
              <span className={canViewActiveLeaderMetrics ? 'leader-scope-badge' : 'public-scope-badge'}>{accessLabel}</span>
              {isRevealable(activePart) && activePart.score >= weights.rewardScore && (
                <span className="reward-badge">보상 후보</span>
              )}
            </div>
          </div>

          {isRevealable(activePart) ? (
            <div className="metrics-score-grid">
              <div>
                파트지수
                <strong>{activePart.score}</strong>
              </div>
              <div>
                의견 반영도
                <strong>{activePart.reflectionRate}%</strong>
              </div>
              <div>
                {canViewActiveLeaderMetrics ? '긴 회의 비율' : '참여 균형'}
                <strong>{canViewActiveLeaderMetrics ? `${activePart.longMeetingRate}%` : `${activePart.voteParticipation}%`}</strong>
              </div>
            </div>
          ) : (
            // 리더 권한이어도 열리지 않는다. 권한 문제가 아니라 익명성 문제다.
            <div className="metrics-suppressed">
              <LockKeyhole size={20} />
              <div>
                <strong>인원이 적어 지표를 표시하지 않습니다</strong>
                <span>
                  {activePart.name}은(는) {activePart.members}명으로, 공개 기준 {MIN_MEMBERS_TO_REVEAL}명에 미치지 못합니다.
                  적은 인원에서는 집계 숫자만으로 누가 어떤 의견을 냈는지 좁혀질 수 있어 리더에게도 열지 않습니다.
                </span>
              </div>
            </div>
          )}

          {canViewActiveLeaderMetrics ? (
            <div className="meeting-health-card leader-only-card">
              <div>
                <CalendarClock size={20} />
                <strong>회의 건강도</strong>
                <span>{activePart.meetingTrend}</span>
              </div>
              {/* 예전에는 막대 두 개뿐이고 폭이 분÷5, 분÷7 이라는 근거 없는 값이었다.
                  몇 시간인지도, 기준이 얼마인지도 화면에 없어서 많고 적음을 판단할 수 없었다. */}
              <div className="meeting-volume">
                <div className="meeting-volume-total">
                  <strong>주 {weeklyMeetingHours(activePart.oneOnOneMinutes, activePart.partMeetingMinutes)}시간</strong>
                  <span>기준 {WEEKLY_MEETING_BUDGET_HOURS}시간</span>
                </div>
                <div
                  className={
                    meetingBudgetUsage(activePart.oneOnOneMinutes, activePart.partMeetingMinutes) > 100
                      ? 'meeting-budget-bar over'
                      : 'meeting-budget-bar'
                  }
                >
                  <span
                    style={{
                      width: `${Math.min(100, meetingBudgetUsage(activePart.oneOnOneMinutes, activePart.partMeetingMinutes))}%`,
                    }}
                  />
                </div>
                <dl className="meeting-volume-split">
                  <div>
                    <dt>원온원</dt>
                    <dd>{formatHours(activePart.oneOnOneMinutes)}</dd>
                  </div>
                  <div>
                    <dt>파트회의</dt>
                    <dd>{formatHours(activePart.partMeetingMinutes)}</dd>
                  </div>
                  <div>
                    <dt>{LONG_MEETING_MINUTES}분 이상</dt>
                    <dd>
                      {activeCalendarEvents.length > 0
                        ? `${longCalendarEventCount}건 / ${activeCalendarEvents.length}건`
                        : `${activePart.longMeetingRate}%`}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <div className="metrics-public-note">
              <LockKeyhole size={20} />
              <div>
                <strong>회의 상세는 리더 전용이에요</strong>
                <span>팀원 공개 화면에서는 파트별 문화 흐름과 성향 팔레트만 보여주고, 회의 피로도나 감점 근거는 숨깁니다.</span>
              </div>
            </div>
          )}

          <div className="profile-color-panel">
            <div className="panel-header">
              <UsersRound size={20} />
              <h2>파트 성향 팔레트</h2>
            </div>
            <div className="color-stack" aria-label="파트 성향 비율">
              {activePart.profileColors.map((tone) => (
                <span className={tone.color} key={tone.label} style={{ width: `${tone.value}%` }} />
              ))}
            </div>
            <div className="tone-list">
              {activePart.profileColors.map((tone) => (
                <span className={tone.color} key={tone.label}>
                  {tone.label} {tone.value}%
                </span>
              ))}
            </div>
            <p>
              가장 강한 색은 <strong>{activePart.dominantTone.label}</strong>이에요. {activePart.traits.join(', ')} 흐름이
              파트 대화에서 자주 나타납니다.
            </p>
          </div>

          {canViewActiveLeaderMetrics && (
            <div className="calendar-event-list">
              <div className="panel-header">
                <CalendarClock size={20} />
                <h2>캘린더 회의 분류</h2>
              </div>
              {activeCalendarEvents.length > 0 ? (
                activeCalendarEvents.map((event) => (
                  <div className={event.durationMinutes >= 60 ? 'long-meeting' : ''} key={event.id}>
                    <span>{event.type}</span>
                    <strong>{event.title}</strong>
                    <small>{event.durationMinutes}분 · {event.attendees}명 · {event.isRecurring ? '반복' : '단건'}</small>
                  </div>
                ))
              ) : (
                <p>아직 이 파트에 반영된 캘린더 회의가 없어요. 상단에서 샘플 회의를 가져오면 회의 건강도 계산에 바로 반영됩니다.</p>
              )}
            </div>
          )}
        </section>

        <aside className="metrics-side">
          <section className="panel">
            <div className="panel-header">
              <Sparkles size={20} />
              <h2>이번 달 리포트</h2>
            </div>
            <div className="insight-list">
              <p>의견은 총 {totalOpinions}건 접수됐고 {reflectedOpinions}건이 답변/안건/액션으로 이어졌어요.</p>
              <p>{scoredParts[0].name}은 회의 건강도와 의견 반영 균형이 가장 좋아요.</p>
              <p>
                {canViewAllLeaderMetrics
                  ? '긴 회의 비율이 높은 파트는 45분 단위 회의 템플릿을 적용해보면 좋아요.'
                  : '상세 회의 리스크는 리더 권한에서만 볼 수 있고, 공개 리포트에는 팀 문화 흐름만 남깁니다.'}
              </p>
            </div>
          </section>

          {canViewAllLeaderMetrics ? (
          <section className="panel">
            <div className="panel-header">
              <Settings2 size={20} />
              <h2>계산 기준 설정</h2>
            </div>
            <div className="weight-controls">
              {([
                ['opinion', '의견 제출'],
                ['reflected', '의견 반영'],
                ['participation', '투표/연결 참여'],
                ['healthyMeeting', '회의 건강도'],
                ['overloadPenalty', '긴 회의 감점'],
                ['rewardScore', '보상 기준'],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    max={key === 'rewardScore' ? 100 : 40}
                    min={0}
                    onChange={(event) => updateWeight(key, Number(event.target.value))}
                    type="range"
                    value={weights[key]}
                  />
                  <strong>{weights[key]}</strong>
                </label>
              ))}
            </div>
          </section>
          ) : (
          <section className="panel metrics-locked-panel">
            <div className="panel-header">
              <Settings2 size={20} />
              <h2>계산 기준 설정</h2>
            </div>
            <p>보상 기준과 감점 가중치는 팀리더 전용 설정이에요. 파트리더는 자기 파트의 운영 상세를 보고, 팀원은 공개 리포트만 확인합니다.</p>
          </section>
          )}
        </aside>
      </div>
    </section>
  );
}
