import type { ElementType } from 'react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  FileCheck2,
  Home,
  IdCard,
  Inbox,
  Laugh,
  MessageSquarePlus,
  Settings,
  Shuffle,
  Sparkles,
  Sprout,
  Store,
  UserRound,
  UsersRound,
  Vote,
  Zap,
} from 'lucide-react';
import type { Section } from './types';

export type AppSection = {
  id: Section;
  label: string;
  icon: ElementType;
  owner: string;
};

export type NavGroup = {
  title: string;
  items: AppSection[];
};

export const sections: AppSection[] = [
  { id: 'dashboard', label: '홈', icon: Home, owner: '공통' },
  { id: 'intake', label: '대나무숲 접수', icon: MessageSquarePlus, owner: '이선민' },
  { id: 'leader', label: '리더 관리함', icon: Inbox, owner: '김승현' },
  { id: 'agenda', label: '안건함 / 투표', icon: Vote, owner: '이상협' },
  { id: 'actions', label: '액션아이템', icon: FileCheck2, owner: '이상협' },
  { id: 'meetings', label: '캔미팅 / 티미팅', icon: CalendarDays, owner: '김승현 · 이상협' },
  { id: 'gatherings', label: '모임 · 번개', icon: Zap, owner: '공통' },
  { id: 'profiles', label: '동료 성향', icon: UserRound, owner: '김수정' },
  { id: 'connect', label: '조뽑기', icon: Shuffle, owner: '커넥셔너' },
  { id: 'memory', label: '팀 추억', icon: Sparkles, owner: '김수정' },
  { id: 'humor', label: '유~머게시판', icon: Laugh, owner: '공통' },
  { id: 'market', label: '이음장터', icon: Store, owner: '공통' },
  { id: 'growth', label: '성장 · 커리어', icon: Sprout, owner: '공통' },
  { id: 'metrics', label: '파트지수 / 리포트', icon: BarChart3, owner: '김수정' },
  { id: 'notifications', label: '알림 / 메시지', icon: Bell, owner: '김승현' },
  { id: 'accounts', label: '계정 관리', icon: UsersRound, owner: '팀리더' },
  { id: 'system', label: '시스템 관리', icon: Settings, owner: '커넥셔너' },
  /* 마이페이지는 사이드바에 넣지 않는다. 사이드바는 일을 하러 가는 곳이고,
     개인 영역은 헤더 우측 사용자 칩이 입구다(사진 변경도 거기 붙어 있다).
     다만 헤더 제목을 뽑으려면 sections 목록에는 있어야 한다. */
  { id: 'mypage', label: '마이페이지', icon: IdCard, owner: '본인' },
];

const bySection = (id: Section) => sections.find((section) => section.id === id)!;

// 메뉴를 평면으로 늘어놓으면 매일 오는 '함께하기'가 관리 메뉴와 같은 무게로 읽힌다.
// 목적 단위로 묶고, 사용자가 가장 자주 오는 '함께하기'(홈 포함)를 최상단에 둔다.
export const navGroups: NavGroup[] = [
  {
    // 매일 들르는 공간. 홈을 입구로 두고 함께 노는 메뉴를 모은다.
    title: '함께하기',
    items: ['dashboard', 'gatherings', 'memory', 'humor', 'market'].map((id) => bySection(id as Section)),
  },
  {
    // 팀이 의견을 모으고 결정하는 흐름(말하기 → 정하기). 캔미팅/티미팅이 말하기의 출발점.
    title: '말하고 정하기',
    items: ['meetings', 'intake', 'leader', 'agenda', 'actions'].map((id) => bySection(id as Section)),
  },
  // 커넥셔너(팀문화 담당) 전용 메뉴 묶음. 커넥셔너로 지정된 사람에게만 보인다(AppShell.canSee).
  // 조뽑기를 시작으로, 앞으로 커넥셔너가 쓰는 도구를 여기에 모은다.
  {
    title: '커넥셔너',
    items: ['connect'].map((id) => bySection(id as Section)),
  },
  {
    title: '살펴보기 · 관리',
    items: ['growth', 'metrics', 'profiles', 'notifications', 'accounts', 'system'].map((id) => bySection(id as Section)),
  },
];
