import type { ElementType } from 'react';
import {
  CalendarClock,
  FileCheck2,
  Inbox,
  Laugh,
  Plus,
  Store,
  Vote,
  Zap,
} from 'lucide-react';
import { PanelHeader } from '../../components/PanelHeader';
import { buildHomeFeed, type HomeFeedKind } from '../../homeFeed';
import type {
  ActionItem,
  Agenda,
  CurrentUser,
  Gathering,
  GatheringSignup,
  HumorPost,
  Identity,
  MarketItem,
  Section,
} from '../../types';

// 피드 타일의 좌상단 배지·색 타일에 쓰는 도메인별 라벨·아이콘·색 클래스.
// 색은 styles.css 의 .home-feed-card.k-* 규칙(디자인 토큰)으로 정의한다.
const KIND_STYLE: Record<HomeFeedKind, { label: string; icon: ElementType; cls: string }> = {
  agenda: { label: '안건', icon: Vote, cls: 'k-agenda' },
  action: { label: '액션', icon: FileCheck2, cls: 'k-action' },
  gathering: { label: '모임', icon: CalendarClock, cls: 'k-gathering' },
  humor: { label: '유머', icon: Laugh, cls: 'k-humor' },
  market: { label: '장터', icon: Store, cls: 'k-market' },
};

type DashboardProps = {
  openIssueCount: number;
  passedAgendaCount: number;
  agendas: Agenda[];
  currentUser: CurrentUser;
  actionItems: ActionItem[];
  gatherings: Gathering[];
  signups: GatheringSignup[];
  humorPosts: HumorPost[];
  marketItems: MarketItem[];
  today: string;
  /** 'YYYY-MM-DDTHH:mm' 로컬 시각. 모임의 '아직 안 지났는가' 판정에 쓴다. */
  now: string;
  onSectionChange: (section: Section) => void;
  // 피드 게시글 클릭: 섹션으로만 가지 않고 그 항목 상세를 연다. id 는 도메인 원본 id(접두어 제거).
  onOpenFeedItem: (section: Section, id: string) => void;
  // 인스타처럼 본 스토리는 뒤로 밀고 링을 회색으로. App 이 localStorage 로 유지한다.
  viewedStoryIds: string[];
  onIdentityChange: (identity: Identity) => void;
};

export function Dashboard({
  openIssueCount,
  passedAgendaCount,
  agendas,
  currentUser,
  actionItems,
  gatherings,
  signups,
  humorPosts,
  marketItems,
  today,
  now,
  onSectionChange,
  onOpenFeedItem,
  viewedStoryIds,
  onIdentityChange,
}: DashboardProps) {
  const viewedSet = new Set(viewedStoryIds);
  /*
    스토리 줄에는 번개(flash)로 등록된 것만, 최신 등록순(맨 앞이 최신)으로 올린다.
    취소된 것은 뺀다.
  */
  const flashStories = gatherings
    .filter((item) => !item.canceled && item.kind === 'flash')
    .sort((a, b) => {
      // 안 본 스토리 먼저(인스타). 같은 그룹 안에서는 최신 등록순.
      const av = viewedSet.has(a.id) ? 1 : 0;
      const bv = viewedSet.has(b.id) ? 1 : 0;
      if (av !== bv) return av - bv;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 12);

  /*
    홈 통합 피드. 모임(번개·공모)도 피드에 타일로 넣는다 — 번개는 위 스토리에도 뜨지만,
    피드는 "모든 최근 소식"을 모으는 곳이라 함께 보이는 게 자연스럽다.
    안건·액션·모임·유머·장터를 buildHomeFeed 가 최신순으로 접는다.
  */
  const feedItems = buildHomeFeed({
    agendas,
    actionItems,
    gatherings,
    humorPosts,
    marketItems,
  });

  // 홈에서 방식을 고른 뜻이 접수 화면까지 이어져야 한다.
  // 이전에는 두 버튼이 똑같이 화면만 옮겨서, 고른 방식이 버려지고 다시 물었다.
  const startIntake = (identity: Identity) => {
    onIdentityChange(identity);
    onSectionChange('intake');
  };

  return (
    <section className="screen ig-home">
      {/*
        스토리 트레이 = 마감이 있는 것. 첫 칸은 인스타의 '내 스토리'와 같은 자리라
        만들기(= 의견 접수)를 둔다. 히어로를 없앤 대신 여기가 시작점이 된다.
      */}
      <div className="ig-tray">
        <button className="ig-story" onClick={() => startIntake('익명')} type="button">
          <span className="ig-ring new">
            <span className="ig-thumb">
              <Plus size={22} strokeWidth={2.4} />
            </span>
          </span>
          <small>말하기</small>
        </button>
        {flashStories.map((item) => (
          <button className="ig-story" key={item.id} onClick={() => onOpenFeedItem('gatherings', item.id)} type="button">
            <span className={viewedSet.has(item.id) ? 'ig-ring viewed' : 'ig-ring'}>
              <span className="ig-thumb">
                <Zap size={22} strokeWidth={1.6} />
              </span>
            </span>
            <small>{item.title}</small>
          </button>
        ))}
      </div>

      <div className="ig-col">
        {/*
          홈 통합 피드. 안건·액션·번개·유머·장터의 최근 소식을 한 판에 최신순 3열로 모은다.
          풀폭 포스트로 도메인마다 다른 리치 UI(투표 진행바·인라인 토글)를 두던 것을 걷어내고,
          같은 크기 타일 + 클릭 이동으로 통일했다. 정렬·개수·매핑은 buildHomeFeed(순수)가 맡는다.
        */}
        {feedItems.length > 0 ? (
          <div className="home-feed">
            {feedItems.map((item) => {
              const style = KIND_STYLE[item.kind];
              const Icon = style.icon;
              return (
                <button
                  className={item.imageUrl ? 'home-feed-card has-image' : `home-feed-card ${style.cls}`}
                  key={item.id}
                  onClick={() => onOpenFeedItem(item.section, item.id.slice(item.kind.length + 1))}
                  title={`${style.label} · ${item.title}`}
                  type="button"
                >
                  {item.imageUrl ? (
                    <>
                      <img alt="" className="home-feed-bg" loading="lazy" src={item.imageUrl} />
                      <span aria-hidden className="home-feed-corner">
                        <Icon size={15} strokeWidth={2.4} />
                      </span>
                    </>
                  ) : (
                    <span className="home-feed-plain">
                      <Icon aria-hidden size={26} strokeWidth={1.5} />
                      <strong>{item.title}</strong>
                      {item.meta && <em>{item.meta}</em>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <article className="ig-post plain">
            <div className="ig-post-body ig-quiet">
              <PanelHeader icon={Inbox} title="아직 소식이 없어요" />
              <p>
                안건·액션·모임·유머·장터에 새 소식이 올라오면 여기 최신순으로 모입니다. 위에서 한마디 남기면 여기부터 채워집니다.
              </p>
            </div>
          </article>
        )}

      </div>
    </section>
  );
}
