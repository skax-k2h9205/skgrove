import type { RecipientKey } from './crypto/issueCrypto';

export type Section =
  | 'dashboard'
  | 'mypage'
  | 'intake'
  | 'leader'
  | 'agenda'
  | 'actions'
  | 'meetings'
  | 'gatherings'
  | 'profiles'
  | 'connect'
  | 'memory'
  | 'metrics'
  | 'growth'
  | 'accounts'
  | 'system'
  | 'platform'
  | 'notifications'
  | 'humor'
  | 'market';

export type Identity = '익명' | '실명';
export type Urgency = '낮음' | '보통' | '높음';
// '결정됨'은 객관식 전용이다. 찬반의 통과/부결은 "안건이 받아들여졌는가"를 말하지만
// 객관식은 받아들이고 말고가 아니라 "어느 쪽으로 정해졌는가"를 묻는다.
export type AgendaStatus = '투표중' | '통과' | '부결' | '결정됨';
export type UserRole = '팀원' | '파트리더' | '팀리더';
export type TeamPart = '전체' | 'TEST혁신파트' | 'ITS혁신파트' | 'PM혁신파트';
export type AccountStatus = '승인 대기' | '활성' | '비활성';
export type IssueStatus = '접수' | '검토중' | '답변완료' | '1on1 제안' | '액션아이템' | '안건화' | '보류' | '회수' | '종료';

export type CurrentUser = {
  name: string;
  email: string;
  role: UserRole;
  part: TeamPart;
  // 커넥셔너 = 시스템 구축 슈퍼관리자. 팀 역할과 별개인 전권 플래그(계정 관리에서 토글).
  connectioner?: boolean;
  // 소속 테넌트(팀/회사) id. 멀티테넌트 데이터 스코핑의 기준.
  tenantId?: string;
  // 플랫폼 오너 = 전 테넌트 관제(테넌트 개설 등). 커넥셔너(테넌트 관리자)와 별개인 최상위.
  platformOwner?: boolean;
};

export type ManagedAccount = CurrentUser & {
  id: string;
  status: AccountStatus;
  joinedAt: string;
  photoUrl?: string; // 계정별 프로필 사진(직접 이미지 URL). 없으면 이니셜 칩으로 폴백.
  // 슬랙 DM 발송용 이메일. 앱 로그인 이메일과 슬랙 계정 이메일이 다를 수 있어 별도 관리.
  // 없으면 앱 이메일(email)로 폴백.
  slackEmail?: string;
  // 로그인 비밀번호 해시(pbkdf2$...). 없으면 첫 로그인 때 본인이 설정한다.
  // 서버 인증이 켜지면 이 값은 클라이언트로 내려오지 않는다(폴백용으로만 남는다).
  passwordHash?: string;
  // true 면 로그인 직후 새 비밀번호를 정하게 강제한다(초기 비번 123123 대비).
  mustChangePassword?: boolean;
  // Slack(OIDC) 로그인 연결값. 첫 슬랙 로그인 때 계정에 박아둔다.
  //  authUid     = Supabase auth.users.id — 향후 RLS/테넌트 스코핑 키.
  //  slackUserId = Slack 사용자 id(Uxxxx) — DM 을 이메일 대신 id 로 보내는 근거.
  authUid?: string;
  slackUserId?: string;
};

// 접수자가 고른 공개 범위. '리더만 보기'는 안건 전환을 막는 약속이므로 저장해야 한다.
export type IssueVisibility = '리더만 보기' | '안건 후보로 공개 가능';

export type Issue = {
  id: string;
  title: string;
  category: string;
  author: Identity;
  anonymousAccessCode?: string;
  submitterName?: string;
  submitterEmail?: string;
  submitterPart?: TeamPart;
  target: string;
  status: IssueStatus;
  urgency: Urgency;
  // 접수자가 작성한 본문과 기대 변화. 예전에는 화면 state에만 있다가 폐기돼
  // 리더가 읽을 수도, 안건 배경 설명으로 승계할 수도 없었다.
  body: string;
  expectedChange: string;
  visibility: IssueVisibility;
  leaderReply?: string;
  oneOnOneNote?: string;
  actionItem?: string;
  leaderMemo?: string;
  submitterResponse?: string;
  oneOnOneResponse?: '수락' | '일정 조율 요청';
  // 접수일. 리더 관리함에서 "며칠째 방치됐는지"를 보여주려면 필요하다.
  // 예전에는 DB 컬럼만 있고 앱 모델에 올라오지 않아 경과일을 알 수 없었다.
  createdAt: string;
  // 보류·종료 사유. 접수자 화면에도 그대로 노출된다.
  statusReason?: string;
  // ── E2E 암호화(익명 전용, v1) ── 대상 리더 공개키로 암호화된 본문.
  // encrypted면 body/expectedChange는 빈 문자열이고, 실제 내용은 encPayload/encKeys에 있다.
  // 운영자(anon)는 암호문만 볼 수 있고, 대상 리더만 복호화한다.
  encrypted?: boolean;
  encPayload?: string;
  encKeys?: RecipientKey[];
  encAlg?: string;
};

export type Agenda = {
  id: string;
  title: string;
  description: string;
  category: string;
  // 안건이 어디서 왔는지(대나무숲 SOOP-142 / 캔미팅 · 주제 / 직접 등록)
  source: string;
  part: TeamPart;
  author: Identity;
  // 익명 안건이면 빈 문자열. 상세 화면은 author를 보고 노출 여부를 정한다.
  authorName: string;
  // 찬반 투표의 집계. 객관식 안건에서는 0으로 남는다.
  approve: number;
  reject: number;
  voteType: VoteType;
  // 객관식 선택지. 찬반이면 빈 배열.
  options: AgendaOption[];
  // 객관식에서 여러 개를 고를 수 있는지. 등록할 때 정하고 이후 바뀌지 않는다.
  multiSelect: boolean;
  // 실제로 투표한 '사람' 수. 복수 선택이면 선택지 득표 합계가 사람 수보다 커지므로
  // 정족수·참여율 계산에 쓸 인원을 따로 센다. 찬반은 approve + reject가 곧 사람 수라 0으로 둔다.
  voterCount: number;
  status: AgendaStatus;
  createdAt: string;
  // 등록 시점의 투표 대상 인원 스냅샷.
  // 계정이 늘거나 줄어도 과거 안건의 정족수와 참여율이 소급해 흔들리지 않도록 값으로 박아둔다.
  eligibleCount: number;
  // 'YYYY-MM-DD'. 빈 문자열이면 마감일 없이 수동 마감만 가능하다.
  deadline: string;
  // 마감 처리된 날짜. 빈 문자열이면 아직 열려 있다.
  closedAt: string;
};

export type VoteChoice = 'approve' | 'reject';

export type VoteType = '찬반' | '객관식';

export type AgendaOption = {
  // 안건 안에서만 고유하면 된다. 라벨을 키로 쓰면 같은 글자를 두 번 넣었을 때 집계가 엉킨다.
  id: string;
  label: string;
  count: number;
};

// 확정 버튼이 App으로 올려보내는 값. 투표 방식마다 담기는 것이 다르다.
export type VoteSelection =
  | { kind: '찬반'; choice: VoteChoice }
  | { kind: '객관식'; optionIds: string[] };

// 익명성 유지를 위해 "누가 투표했는가"와 "무엇을 골랐는가"를 분리한다.
// 투표용지(ballot)는 선택을 담지 않고, 선택은 Agenda의 approve/reject 카운터와
// options[].count 집계로만 남는다. 따라서 어떤 행 하나도 사람과 선택을 이어주지 못한다.
export type AgendaBallot = {
  agendaId: string;
  // 안건마다 다른 값이 나오는 단방향 해시. 안건 간 투표 이력 연결을 막는다.
  voterKey: string;
  createdAt: string;
};

// 재검토는 '보류'가 아니라 별도 상태다. 적용해봤는데 효과가 없어 되돌아온 것과
// 아직 시작하지 않은 것은 리더가 다르게 다뤄야 한다.
export type ActionStatus = '대기' | '진행중' | '완료' | '재검토';

export type ActionSourceKind = '안건' | '캔미팅' | '직접';

export type ActionItem = {
  id: string;
  title: string;
  // '미정'을 허용한다. 담당자 없이 먼저 만들어두고 나중에 지정하는 흐름이 실제로 있다.
  owner: string;
  // 'YYYY-MM-DD'. 빈 문자열이면 목표일 미정.
  // 예전에는 'D-3' 같은 상대 문자열이라 지연 여부를 계산할 수 없었다.
  due: string;
  status: ActionStatus;
  sourceKind: ActionSourceKind;
  // 출처 식별자(안건 id 등). 어디서 비롯됐는지 되짚기 위한 값이라 없을 수 있다.
  sourceId: string;
  sourceLabel: string;
  createdAt: string;
  // 적용 결과 기록(SKSOOP-57). 완료 처리할 때 무엇이 어떻게 바뀌었는지 남긴다.
  outcome: string;
  // 재검토 사유(SKSOOP-58). 왜 다시 봐야 하는지 없으면 재검토가 방치로 끝난다.
  reviewReason: string;
};

export type Profile = {
  name: string;
  part: string;
  role: string;
  englishName: string;
  birthYear: string;
  birthday: string;
  character: string;
  trait: string;
  style: string;
  collaboration: string;
  feedback: string;
  guide: string;
  color: 'green' | 'red' | 'blue' | 'yellow';
  // 성향 진단 결과(선택). 없으면 아직 진단 안 함.
  mbtiType?: string; // 예: 'INFP'
  mbtiScores?: MbtiScores; // 각 축 lean 0~100 (해당 글자 쪽 비중)
  discType?: DiscKey; // 업무 1차 유형
  discSecondary?: DiscKey;
  discScores?: DiscScores;
  collabGuide?: string; // "나와 일하는 법" — AI로 뽑아 붙여넣은 자유서술
  // 내 캐릭터(선택). 그림을 만들기 위한 최소 입력 — 사람이 아니라 사물을 묻는다.
  // 나이·외모는 일부러 받지 않는다: 그림 품질은 거의 안 오르는데 팀에서 민감해진다.
  avatarKind?: string;   // 어떤 모습으로 그릴지(동물/사물/사람) — 가장 큰 시각 차별점
  deskItem?: string;     // 내 자리에 늘 있는 것 → 소품
  intoLately?: string;   // 요즘 빠져 있는 것 → 소품·배경
  energyTime?: EnergyTime; // 에너지가 좋은 때 → 조명
  characterUrl?: string; // 생성된 캐릭터 이미지(Storage 공개 URL). 없으면 이니셜로 폴백.
};

/** 캐릭터 조명과 협업 참고를 겸한다 — 순수 취향만 묻지 않아 질문에 명분이 생긴다. */
export type EnergyTime = '아침' | '낮' | '밤';

/** 캐릭터 모습 선택지. 사람 얼굴을 그리지 않아도 되게 해서 '닮았다/아니다' 논란을 없앤다. */
export const AVATAR_KINDS = [
  '고양이', '강아지', '수달', '펭귄', '곰', '토끼',
  '여우', '올빼미', '거북이', '고래', '다람쥐', '사람',
] as const;

// MBTI 4축. 값은 첫 글자(E/S/T/J) 쪽 비중 0~100. 50 미만이면 반대 글자(I/N/F/P).
export type MbtiScores = { EI: number; SN: number; TF: number; JP: number };

export type DiscKey = 'D' | 'I' | 'S' | 'C';
export type DiscScores = { D: number; I: number; S: number; C: number };

// AI 상담 챗봇 — 한 대화(session)의 메시지 한 건. 저장은 counselStore(Supabase/localStorage).
export type CounselMode = 'counsel' | 'rule';
export type CounselMessage = {
  id: string;
  sessionId: string;
  author: string; // 작성자 이메일(소프트 스코핑 키)
  mode: CounselMode;
  role: 'user' | 'assistant';
  content: string;
  partnerName?: string; // 상담 모드에서 지정한 갈등 상대(있을 때만)
  createdAt: string;
};

export type ConnectResultMode = 'coffee' | 'teams';

export type SavedDrawResult = {
  id: string;
  mode: ConnectResultMode;
  title: string;
  createdAt: string;
  summary: string;
  shareText: string;
  shareUrl: string;
};

export type MemoryReaction = '좋아요' | '웃겨요' | '또가요';
export type MemoryEmoji = '👍' | '👏' | '😂' | '🔥' | '💚';

export type MemoryAsset = {
  id: number;
  type: 'photo' | 'video';
  title: string;
  uploader: string;
  tone: 'green' | 'blue' | 'coral' | 'amber';
  uploadedAt: string;
  reactions: Record<MemoryEmoji, number>;
  comments: string[];
  previewUrl?: string;
  storagePath?: string;
  driveFileId?: string;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
};

export type TeamMemory = {
  id: number;
  title: string;
  date: string;
  place: string;
  host: string;
  createdBy: string;
  summary: string;
  tags: string[];
  driveFolderId?: string;
  driveFolderUrl?: string;
  assets: MemoryAsset[];
  comments: string[];
  reactions: Record<MemoryReaction, number>;
};

// 구글 캘린더에서 읽어온 회의. 파트지수의 회의 건강도와 긴 회의 감점의 입력이다.
// Metrics.tsx 안에만 있던 타입을 googleCalendar.ts 와 나눠 쓰려고 올렸다.
export type CalendarMeetingType = '원온원' | '파트회의' | '캔미팅' | '티미팅';

export type CalendarMetricEvent = {
  id: string;
  title: string;
  part: string;
  type: CalendarMeetingType;
  startsAt: string;
  durationMinutes: number;
  attendees: number;
  isRecurring: boolean;
};

export type CalendarConnection = 'disconnected' | 'connected' | 'synced';

// 프록시가 돌려주는 원시 일정. 구글 응답에서 필요한 것만 남긴 형태다.
// 파트 판정은 계정 정보를 가진 프론트가 하므로 프록시는 참석자 메일까지만 넘긴다.
/** 구글이 일정에 붙여주는 유형. default 만 회의 후보다. */
export type GoogleEventType = 'default' | 'focusTime' | 'outOfOffice' | 'workingLocation' | 'birthday' | 'fromGmail';

/** 내가 그 초대에 어떻게 답했는지. */
export type AttendeeResponse = 'accepted' | 'declined' | 'tentative' | 'needsAction';

export type RawCalendarEvent = {
  id: string;
  title: string;
  /** 종일 일정이면 'YYYY-MM-DD', 시간 일정이면 ISO datetime. */
  startsAt: string;
  endsAt: string;
  /** 종일 일정은 회의가 아니라 행사로 본다. */
  isAllDay: boolean;
  isRecurring: boolean;
  attendeeEmails: string[];
  organizerEmail?: string;
  location?: string;
  description?: string;
  /** 집중 시간·부재중 등은 회의가 아니다. 값이 없으면 default 로 본다. */
  eventType?: GoogleEventType;
  /** 내가 거절한 회의는 참석하지 않았으므로 회의 시간에 넣지 않는다. */
  selfResponse?: AttendeeResponse;
  /** 캘린더에 '한가함'으로 표시한 일정. 보통 회의가 아니다. 값이 없으면 '바쁨'으로 본다. */
  showsAsBusy?: boolean;
};

export type PartScore = {
  name: string;
  score: number;
  meetings: number;
};

export type CanStage = 'setup' | 'collect' | 'share' | 'select' | 'summary';
// 단계 정의는 canConfig.ts의 CAN_STEPS가 단일 소스. step에는 그 id(문자열)를 저장.
export type CanStep = string;
export type CanMethod = '온라인' | '오프라인';
export type CanFollowRoute = 'agenda' | 'action' | 'skip';
// 후속 라우팅은 opinion id 기준으로 저장(내용 중복에도 정확)
export type CanFollowUp = {
  routes: Record<string, CanFollowRoute>;
  actionMeta: Record<string, { owner: string; due: string }>;
};

// 확정된 결과물(원문 선정 의견 or AI 요약 중 택1). PPT·후속조치의 단일 소스.
// id: 원문이면 opinion.id, AI 요약이면 생성 id(stepId#index). routes/actionMeta가 이 id를 참조한다.
export type CanResultItem = { id: string; content: string };
export type CanResultGroup = { label: string; items: CanResultItem[] };

export type CanSession = {
  id: string;
  topic: string;
  teamName: string;
  heldAt: string;
  method: CanMethod;
  parts: TeamPart[];
  stage: CanStage;
  resultSummary: string;
  resultGroups?: CanResultGroup[]; // 확정 시 저장. 없으면 원문(선정 의견)으로 폴백.
  followUp: CanFollowUp | null;
};

export type CanOpinion = {
  id: string;
  sessionId: string;
  part: TeamPart;
  step: CanStep;
  content: string;
  author: Identity;
  authorName: string;
  selected: boolean;
};

// ===== 티미팅 =====
// 2주 주기로 세션(기술세미나·여행기·팀워크샵·팀내공유) 1개를 진행하는 문화.
// 팀원이 세션을 자발 제안하고, 리더(커넥셔너)가 이번 회차 세션 선정 + 파트 믹스 그룹 편성 + 슬랙 공지를 한다.
export type TeaSessionStatus = '제안' | '채택' | '완료' | '보류';

export type TeaSession = {
  id: string;
  title: string;
  type: string; // 세션 유형(teaStore가 관리): 기술세미나/여행기/팀워크샵/팀내공유사항
  presenter: string; // 발표자 = 제안자(실명)
  part: TeamPart;
  desc: string; // 간단 설명(선택)
  status: TeaSessionStatus;
  memo: string; // 세션 후기 메모 (SKSOOP-71)
  // 개최일 'YYYY-MM-DD'. 제안 단계에서는 비어 있을 수 있다.
  // 구글 캘린더 일정과 대조하는 축이기도 하다(calendarMatch) — 비면 대조 후보가 없다.
  heldAt: string;
};

// 파트를 섞어 편성한 티미팅 그룹 (SKSOOP-70)
// part는 실제 파트 구성(ITS혁신/TEST혁신/PM혁신) 문자열 — 앱의 TeamPart enum과 별개.
export type TeaGroup = {
  name: string;
  members: { name: string; part: string }[];
};

// ===== 알림 / 메시지 (SKSOOP-21) =====
// 시스템 알림(issue/agenda/deadline/action/tea/humor)과 사람이 보내는 DM(message).
export type NotificationKind =
  | 'issue'
  | 'agenda'
  | 'deadline'
  | 'action'
  | 'tea'
  | 'humor'
  | 'message'
  // 번개/공모: 대기 승계와 모임 취소. 둘 다 "내 계획이 바뀌는" 일이라
  // 앱을 다시 열어보기 전에 알아야 한다.
  | 'gathering'
  // 이음장터: 상회 입찰과 낙찰. 상회는 다시 부를 기회를 주는 알림이고,
  // 낙찰은 돈과 물건이 오가는 약속이라 놓치면 파토가 된다.
  | 'market';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  recipientName: string; // 수신자(account name) — currentUser 매칭 기준
  fromName: string; // 발신자(메시지) 또는 '시스템'
  title: string;
  body: string;
  section: Section; // 클릭 시 이동할 화면
  sourceId: string; // 관련 엔티티 id(issue/agenda/action) 또는 메시지 고유 id
  dedupeKey: string; // 중복 생성 방지 키(특히 마감 임박)
  createdAt: string; // 'YYYY-MM-DD'
  read: boolean;
};

// ===== 유머게시판 =====
// 팀원이 재미있는 글을 실명으로 올리고 좋아요·댓글로 반응. 이번 달 랭커를 상단에 노출.
// 카테고리는 오픈 초기엔 단일 게시판으로 운영(나중에 사용 보고 분리 판단).
export type HumorPost = {
  id: string;
  author: string; // 실명(로그인 사용자)
  body: string;
  mediaUrl: string; // 선택 — 이미지 주소·유튜브·영상 링크. 렌더 시 자동 판별.
  imageUrl?: string; // 내용으로 생성한 크레파스 썸네일. mediaUrl(사용자가 붙인 링크)과 별개.
  createdAt: string; // 'YYYY-MM-DD'
  likedBy: string[]; // 좋아요 누른 사람 이름 — 토글·집계·랭킹 소스
};

export type HumorComment = {
  id: string;
  postId: string;
  author: string;
  body: string;
  createdAt: string;
};

// ===== 번개 모임 / 일정공모 =====
// 메뉴는 둘이지만 모델은 하나다. 입력값이 90% 같은데 타입을 쪼개면 정원·대기자
// 승계 같은 규칙이 두 벌이 되고, 한쪽만 고치는 버그가 생긴다. kind 로만 가른다.
//   flash  = 번개 모임: 오늘·내일 급조. 리드타임이 짧고 캐주얼하다.
//   callup = 일정공모: 미리 계획한 선착순 모집. 마감일이 따로 의미를 갖는다.
export type GatheringKind = 'flash' | 'callup';

// 상태는 저장하지 않고 정원·시각으로 파생시킨다(gatheringRules.deriveStatus).
// 저장하면 "마감인데 모집중으로 남아 있는" 어긋남이 반드시 생긴다.
// 취소만은 주최자의 의사라 파생할 수 없어 별도 플래그로 둔다.
export type GatheringStatus = '모집중' | '마감' | '진행함' | '종료' | '취소';

export type GatheringCost = '없음' | 'n빵' | '주최자 부담';

// LLM 이 정하는 것은 '문구와 색'까지다. 그림 자체를 만들지 않는다.
// 포스터가 쌓였을 때 한눈에 보이려면 틀이 같아야 하고, 개성은 이 세 값으로 낸다.
export type GatheringPoster = {
  headline: string; // 포스터에 크게 박히는 한 줄
  caption: string; // 그 아래 짧은 부연
  tone: 'moss' | 'clay' | 'info' | 'pending'; // 기존 역할색 토큰에서만 고른다
  motif: string; // lucide 아이콘 이름. 목록 밖 값이 오면 렌더에서 기본값으로 떨어진다
  source: 'ai' | 'local'; // 폴백으로 만든 것인지 표시 — 나중에 재생성 판단 근거
};

export type Gathering = {
  id: string;
  kind: GatheringKind;
  title: string;
  startAt: string; // 'YYYY-MM-DDTHH:mm' — 모임 시작
  place: string; // 자유 텍스트. 온라인이면 링크를 여기 적는다
  capacity: number | null; // null = 제한 없음. 0 은 허용하지 않는다
  closeAt: string; // 신청 마감. 기본값은 startAt
  minPeople: number | null; // 이 인원 미달이면 주최자가 접기 쉽게 — 등록 심리 장벽을 낮춘다
  desc: string;
  part: TeamPart; // 기본 '전체'
  cost: GatheringCost;
  imageUrl?: string; // 첨부한 사진. 있으면 포스터 대신 이 이미지를 쓴다
  poster?: GatheringPoster; // 사진이 없을 때만 채워진다
  host: string; // 주최자 실명 — 로그인 사용자에서 자동
  createdAt: string; // 'YYYY-MM-DD'
  // 번개에서 뽑은 '오늘 커피 담당' 실명. 없음/undefined = 아직 안 뽑음. 번개(flash)에서만 쓴다.
  // 번개를 만들 때 주최자가 '커피 뽑기'를 켰는가(opt-in). flash 에서만 의미. 켜야 상세에 커피 영역이 뜬다.
  coffeeDraw?: boolean;
  coffeePick?: string | null;
  coffeePickedAt?: string | null; // ISO. 언제 뽑았는지(표시용)
  // 뽑은 순간의 후보 전원(실명). 재추첨은 막고, 이 풀을 결과에 박제해 "이 명단에서 나왔다"를 증명한다.
  coffeePool?: string[] | null;
  canceled: boolean;
};

// 신청은 별도 레코드다. Gathering 안에 배열로 넣으면 두 사람이 동시에 신청할 때
// 통째로 덮어써 한쪽이 사라진다(선착순에서 가장 치명적인 실패).
export type GatheringSignup = {
  id: string;
  gatheringId: string;
  name: string; // 신청자 실명
  createdAt: string; // ISO. 선착순 순서의 유일한 근거
};

// ===== 이음장터 (팀 내 중고거래) =====
// 모임·번개와 같은 철학으로 만든다. 모델은 하나고 kind 로만 가른다 — 등록·목록·상세·
// 마감이 전부 같은데 타입을 쪼개면 규칙이 두 벌이 되고 한쪽만 고치는 버그가 생긴다.
//   auction  = 경매: 마감 시각에 최고가를 부른 사람이 가져간다.
//   giveaway = 나눔: 선착순. 먼저 누른 사람이 가져간다.
//
// 포스터 틀(GatheringPoster)은 모임과 공유한다. 이름에 Gathering 접두어가 붙어 있는 것은
// 모임에서 먼저 생겼기 때문이고, 지금 이름을 바꾸면 진행 중인 작업과 충돌한다.
export type MarketKind = 'auction' | 'giveaway';

// 상태는 저장하지 않고 시각과 입찰에서 파생시킨다(marketRules.deriveStatus).
// 저장하면 "마감 시각이 지났는데 거래중으로 남은" 어긋남이 반드시 생긴다.
export type MarketStatus = '거래중' | '거래완료' | '유찰' | '취소';

export type MarketItem = {
  id: string;
  kind: MarketKind;
  title: string;
  desc: string;
  startPrice: number; // 나눔이면 0
  minStep: number; // 최소 인상폭. 없으면 1원씩 올리는 눈치싸움이 된다. 나눔이면 0
  closeAt: string; // 'YYYY-MM-DDTHH:mm' 로컬 시각
  // 마감 3분 안에 들어온 입찰로 밀린 시각. 막판에 낚아채고 끝나는 것을 막는다.
  // closeAt 을 직접 고치지 않는 이유는 원래 약속한 마감을 남겨두기 위해서다.
  extendedTo?: string;
  place: string; // 거래 장소
  imageUrl?: string;
  poster?: GatheringPoster; // 사진이 없을 때만 채워진다
  seller: string; // 판매자 실명 — 거래라 익명일 수 없다
  createdAt: string; // 'YYYY-MM-DD'
  canceled: boolean;
  // 거래 완료는 양쪽이 각각 누른다. 앱이 결제를 다루지 않으므로 누가 잘못했는지
  // 판정할 수 없다. 한쪽 말만 듣고 상태를 정하지 않는다.
  sellerDone: boolean;
  buyerDone: boolean;
};

// 입찰도 별도 레코드다. 물건 안에 배열로 넣으면 두 사람이 같은 순간에 입찰할 때
// 나중 쓰기가 앞 쓰기를 지운다. 나눔도 이 표를 쓴다(금액 0, 가장 이른 사람이 가져감).
export type MarketBid = {
  id: string;
  itemId: string;
  name: string; // 입찰자 실명
  amount: number; // 나눔이면 0
  createdAt: string; // ISO. 동액일 때와 선착순의 순서 근거
};

// ── 커리어 관리(성장 카드) ──
// 팀 공용 역량 세트(v1 고정). 개인이 자가 레벨을 매기고 리더가 합의한다.
export const competencies = ['문제정의·기획', '실행·개발', '협업·소통', '도메인 전문성', 'AI 활용', '학습·성장'] as const;
export type Competency = (typeof competencies)[number];
export type GoalStatus = '진행중' | '완료' | '보류';

// 성장 목표(단기). 개인이 세우고 진척을 갱신, 리더가 코멘트로 정렬한다.
export type GrowthGoal = {
  id: string;
  ownerEmail: string;
  title: string;
  detail: string;
  due: string; // 'YYYY-MM-DD' 또는 빈 문자열(무기한)
  progress: number; // 0–100
  status: GoalStatus;
  leaderComment: string;
  createdAt: string;
  updatedAt: string;
};

// 역량 레벨(장기). 자가 레벨 + 리더 합의 레벨.
export type CompetencyLevel = {
  id: string;
  ownerEmail: string;
  competency: Competency;
  selfLevel: number; // 1–5
  leaderLevel?: number; // 1–5, 리더 합의 전엔 없음
  evidence: string;
  updatedAt: string;
};

// 역량 레벨 변경 이력(성장 곡선용).
export type CompetencyLogEntry = {
  id: string;
  ownerEmail: string;
  competency: Competency;
  level: number; // 1–5
  by: 'self' | 'leader';
  at: string;
};
