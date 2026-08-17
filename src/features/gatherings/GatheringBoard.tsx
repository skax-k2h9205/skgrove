import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  Coffee,
  Hourglass,
  MapPin,
  Plus,
  Trash2,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { ProfilesContext } from '../../profilesContext';
import { CoffeeDrawCanvas } from './CoffeeDrawCanvas';
import { CoffeeGamePicker } from './CoffeeGamePicker';
import type { CoffeeMember } from './coffeeStage';
import { COFFEE_GAMES, gameMeta } from './games/coffeeGames';
import { LadderDrawCanvas } from './LadderDrawCanvas';
import { ReactionGame } from './skill/ReactionGame';
import { SkillGameRunner, type SkillGameComponent } from './skill/SkillGameRunner';
import {
  belowMinimum,
  canDrawCoffee,
  canJoinWaitlist,
  confirmedCount,
  deriveStatus,
  formatWhen,
  mySeat,
  sortGatherings,
  splitRoster,
  spotsLeft,
  timeUntil,
} from '../../gatheringRules';
import type { CoffeeGame, CoffeeScore, CurrentUser, Gathering, GatheringSignup, GatheringStatus } from '../../types';
import { localPoster } from '../../aiPoster';
import { GatheringForm, type GatheringDraft } from './GatheringForm';
import { PosterFrame, PosterThumb } from './PosterFrame';

// 실력 게임 중 러너가 실제로 붙은 것만. 여기 없으면 아직 플레이 불가 — 픽커에도 노출하지 않는다.
// Phase C 에서 timing/tap 을 추가하면 픽커가 자동으로 확장된다.
const SKILL_PLAY: Partial<Record<CoffeeGame, SkillGameComponent>> = {
  reaction: ReactionGame,
};

// 픽커에는 운 게임 + 러너가 붙은 실력 게임만 노출한다 — 골랐는데 플레이할 방법이 없는 상태를 막는다.
const availableGames = COFFEE_GAMES.filter((g) => g.kind === 'luck' || SKILL_PLAY[g.id]);

type GatheringBoardProps = {
  gatherings: Gathering[];
  signups: GatheringSignup[];
  currentUser: CurrentUser;
  /** 'YYYY-MM-DDTHH:mm' 로컬 시각. 상태 파생의 기준이라 App 이 한 곳에서 만든다. */
  now: string;
  onCreate: (draft: GatheringDraft) => void;
  onJoin: (gathering: Gathering) => void;
  onLeave: (gathering: Gathering) => void;
  onCancelGathering: (gathering: Gathering) => void;
  onDrawCoffee: (gathering: Gathering, game: CoffeeGame) => void;
  /** B4에서 실력 게임 러너 완료 시 호출 */
  onCoffeeSkillResult: (gathering: Gathering, game: CoffeeGame, scores: CoffeeScore[]) => void;
  /** 팀리더 권한. 남의 모임도 삭제할 수 있다. */
  canModerate: boolean;
  /** 완전 삭제(모임 + 신청 기록). 주최자 또는 팀리더만 호출한다. */
  onDelete: (gathering: Gathering) => void;
  /** 등록 직후 배경에서 그림을 그리는 중인 모임. 격자에 '그리는 중' 을 띄운다. */
  imagePendingIds: string[];
  /** 홈 피드에서 이 모임을 눌러 들어온 경우 그 id. 바로 상세를 열고 한 번만 소비한다. */
  focusId?: string | null;
  onFocusHandled?: () => void;
  /** 홈 피드에서 진입한 상세에서 '뒤로'를 누르면 목록이 아니라 홈으로 돌아간다. */
  onExitToHome?: () => void;
};

type BoardView = 'feed' | 'create' | 'detail';
type Filter = '모집중' | '내가 신청' | '내가 연 것' | '전체';

const FILTERS: Filter[] = ['모집중', '내가 신청', '내가 연 것', '전체'];

/*
  탭마다 없는 것이 다르므로 하는 말도 달라야 한다. '모집중' 이 비어 있는 것과
  '내가 신청' 이 비어 있는 것은 사용자가 해야 할 일이 정반대다 — 앞은 누가 열어
  주길 기다리거나 내가 열면 되고, 뒤는 이미 열려 있는 것에 신청하면 된다.
*/
const EMPTY_COPY: Record<Filter, { title: string; description: string; toOpen: boolean }> = {
  모집중: {
    title: '지금 열린 자리가 없어요',
    description: '오늘 점심이든 다음 주 워크샵이든, 먼저 열면 누군가는 옵니다.',
    toOpen: true,
  },
  '내가 신청': {
    title: '아직 신청한 모임이 없어요',
    description: '모집중 탭에서 자리가 남은 모임을 찾아보세요. 마음에 드는 게 없으면 직접 열어도 됩니다.',
    toOpen: true,
  },
  '내가 연 것': {
    title: '아직 연 모임이 없어요',
    description: '거창하지 않아도 됩니다. 오늘 점심 같이 먹자는 것도 모임이에요.',
    toOpen: true,
  },
  전체: {
    title: '아직 아무 모임도 없어요',
    description: '첫 모임을 열면 여기부터 쌓입니다.',
    toOpen: true,
  },
};

const STATUS_TONE: Record<GatheringStatus, 'moss' | 'clay' | 'muted'> = {
  모집중: 'moss',
  마감: 'clay',
  진행함: 'muted',
  종료: 'muted',
  취소: 'muted',
};

// 커피 뽑은 시각(ISO)을 짧게. "08/07 18:05" 처럼.
function formatPickedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

// 게임별 점수 단위. 숫자만 봐서는 뭘 뜻하는지 모르니 게임에 맞는 문구를 붙인다.
function formatSkillScore(game: CoffeeGame, score: number): string {
  switch (game) {
    case 'reaction':
      return `${Math.round(score)}ms`;
    case 'tap':
      return `${Math.round(score)}회`;
    case 'timing':
      return `${(score * 100).toFixed(0)} 벗어남`;
    default:
      return `${score}`;
  }
}

// 실력 게임 결과 점수판. 못한 사람(패자)이 위로 오도록 정렬해 왜 저 사람이 커피 담당인지 바로 보이게 한다.
function CoffeeScoreboard({ game, scores, loser }: { game: CoffeeGame; scores: CoffeeScore[]; loser?: string | null }) {
  const higherIsBetter = gameMeta(game).higherIsBetter ?? false;
  const sorted = [...scores].sort((a, b) => (higherIsBetter ? a.score - b.score : b.score - a.score));
  return (
    <div className="coffee-scoreboard">
      <span className="coffee-pool-label">{gameMeta(game).name} 결과</span>
      <ul className="coffee-scoreboard-list">
        {sorted.map((s) => (
          <li className={s.name === loser ? 'lost' : ''} key={s.name}>
            <span className="coffee-scoreboard-name">{s.name}</span>
            <span className="coffee-scoreboard-score">{formatSkillScore(game, s.score)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GatheringBoard({
  gatherings,
  signups,
  currentUser,
  now,
  onCreate,
  onJoin,
  onLeave,
  onCancelGathering,
  onDrawCoffee,
  onCoffeeSkillResult,
  canModerate,
  onDelete,
  imagePendingIds,
  focusId,
  onFocusHandled,
  onExitToHome,
}: GatheringBoardProps) {
  const [view, setView] = useState<BoardView>('feed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 상세를 '홈 피드'에서 열었는지 기록한다. 뒤로가기 목적지(홈 vs 목록)를 이걸로 정한다.
  const [openedFromFeed, setOpenedFromFeed] = useState(false);
  const [filter, setFilter] = useState<Filter>('모집중');
  // 삭제는 되돌릴 수 없어 상세 안에서 펼치는 확인 UI로 받는다(유머와 같은 방식).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const visible = sortGatherings(
    gatherings.filter((item) => {
      const status = deriveStatus(item, signups, now);
      if (filter === '모집중') return status === '모집중' || status === '마감';
      if (filter === '내가 신청') return mySeat(item, signups, currentUser.name) !== null;
      if (filter === '내가 연 것') return item.host === currentUser.name;
      return true;
    }),
    signups,
    now,
  );

  // 목록 필터에서 빠져도 열어둔 상세는 유지되어야 하므로 전체에서 찾는다.
  const selected = gatherings.find((item) => item.id === selectedId) ?? null;

  const openDetail = (id: string, fromFeed = false) => {
    setSelectedId(id);
    setView('detail');
    setConfirmingDelete(false);
    setOpenedFromFeed(fromFeed);
  };

  // 상세 '뒤로': 홈에서 들어왔으면 홈으로, 목록에서 들어왔으면 목록으로.
  const backFromDetail = () => {
    if (openedFromFeed && onExitToHome) onExitToHome();
    else setView('feed');
  };

  // 홈 피드에서 이 모임을 눌러 들어오면 바로 그 상세를 연다(한 번만 소비).
  useEffect(() => {
    if (focusId) {
      openDetail(focusId, true);
      onFocusHandled?.();
    }
  }, [focusId]);

  // 커피 뽑기 룰렛: 주최자가 '방금' 뽑았을 때만, 프로필이 섞이다 감속해 걸리는 3D 연출.
  // (상세를 그냥 열었을 땐 안 돈다 — justDrewRef 로 구분.) 당첨자는 이미 확정돼 넘어온다.
  const directory = useContext(ProfilesContext);
  const justDrewRef = useRef(false);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!justDrewRef.current || !selected?.coffeePick) return;
    justDrewRef.current = false;
    setSpinning(true); // 당첨자·후보가 state 에 도착한 시점 — 이제 무대를 돌린다.
  }, [selected?.coffeePick]);

  // 커피내기 게임 선택(뽑기 전 UI 상태). 뽑히고 나면 selected.coffeeGame 이 진실이 된다.
  const [pickedGame, setPickedGame] = useState<CoffeeGame>('roulette');
  // 실력 게임 러너가 지금 화면을 차지하고 있는지. 완료·취소되면 꺼진다.
  const [runningSkill, setRunningSkill] = useState(false);

  // 뽑는 순간 박제된 후보(coffeePool)를 3D 원반 멤버로. 색·사진은 라이브 디렉토리에서.
  const coffeePool = selected?.coffeePool ?? [];
  const coffeeMembers = useMemo<CoffeeMember[]>(
    () =>
      coffeePool.map((name) => {
        const info = directory.get(name);
        return { name, color: info?.color, photoUrl: info?.photoUrl };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coffeePool.join('|'), directory],
  );

  const create = (draft: GatheringDraft) => {
    onCreate(draft);
    setView('feed');
  };

  if (view === 'create') {
    return (
      <section className="screen">
        <GatheringForm onSubmit={create} onCancel={() => setView('feed')} />
      </section>
    );
  }

  if (view === 'detail' && selected) {
    const status = deriveStatus(selected, signups, now);
    const { confirmed, waiting } = splitRoster(selected, signups);
    const seat = mySeat(selected, signups, currentUser.name);
    const left = spotsLeft(selected, signups);
    const isHost = selected.host === currentUser.name;
    const waitlistOnly = canJoinWaitlist(selected, signups, now);
    const joinable = status === '모집중' || waitlistOnly;

    return (
      <section className="screen">
        <button className="btn-ghost back-link" onClick={backFromDetail} type="button">
          <ArrowLeft size={16} />
          {openedFromFeed ? '홈으로' : '목록으로'}
        </button>

        <div className="gathering-detail">
          <div className="gathering-detail-poster">
            <PosterFrame badge={status} badgeTone={STATUS_TONE[status]} gathering={selected} />
          </div>

          <div className="gathering-detail-body">
            <h2>{selected.title}</h2>
            <p className="gathering-host">{selected.host}님이 열었어요</p>

            <dl className="gathering-facts">
              <div>
                <dt>
                  <CalendarClock size={16} />
                  언제
                </dt>
                <dd>
                  {formatWhen(selected.startAt)}
                  {status === '모집중' && <em> · {timeUntil(selected.startAt, now)}</em>}
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin size={16} />
                  어디서
                </dt>
                <dd>{selected.place}</dd>
              </div>
              <div>
                <dt>
                  <Users size={16} />
                  인원
                </dt>
                <dd>
                  {selected.capacity === null
                    ? `제한 없음 · 지금 ${confirmedCount(selected, signups)}명`
                    : `${confirmedCount(selected, signups)} / ${selected.capacity}명`}
                  {left !== null && left > 0 && <em> · {left}자리 남음</em>}
                </dd>
              </div>
              <div>
                <dt>
                  <Wallet size={16} />
                  비용
                </dt>
                <dd>{selected.cost}</dd>
              </div>
            </dl>

            {selected.desc && <p className="gathering-desc">{selected.desc}</p>}

            {/* 주최자에게만 보이는 판단 근거. 접을지 말지를 여기서 정한다. */}
            {isHost && selected.minPeople !== null && belowMinimum(selected, signups) && status !== '취소' && (
              <p className="gathering-warn">
                최소 {selected.minPeople}명 중 {confirmedCount(selected, signups)}명이에요. 부담 없이 접어도 괜찮습니다.
              </p>
            )}

            <div className="gathering-actions">
              {seat === '확정' && (
                <>
                  <span className="seat-badge confirmed">
                    <Check size={16} />
                    신청 완료
                  </span>
                  <button className="btn-ghost" onClick={() => onLeave(selected)} type="button">
                    신청 취소
                  </button>
                </>
              )}
              {seat && seat !== '확정' && (
                <>
                  <span className="seat-badge waiting">
                    <Hourglass size={16} />
                    대기 {seat.대기}번
                  </span>
                  <button className="btn-ghost" onClick={() => onLeave(selected)} type="button">
                    대기 취소
                  </button>
                </>
              )}
              {!seat && joinable && (
                <button className="primary-button" onClick={() => onJoin(selected)} type="button">
                  {waitlistOnly ? '대기 걸기' : '신청하기'}
                </button>
              )}
              {!seat && !joinable && <span className="seat-badge closed">{status}</span>}

              {isHost && !selected.canceled && status !== '진행함' && status !== '종료' && (
                <button className="btn-ghost danger" onClick={() => onCancelGathering(selected)} type="button">
                  <Ban size={16} />
                  모임 취소
                </button>
              )}

              {canModerate && !confirmingDelete && (
                <button className="btn-ghost danger" onClick={() => setConfirmingDelete(true)} type="button">
                  <Trash2 size={16} />
                  삭제
                </button>
              )}
            </div>

            {confirmingDelete && (
              <div className="agenda-close-box">
                <AlertTriangle size={18} />
                <p>이 모임을 삭제하면 되돌릴 수 없어요. 신청자·대기자 기록도 함께 사라집니다.</p>
                <div className="vote-confirm-actions">
                  <button className="secondary-button" onClick={() => setConfirmingDelete(false)} type="button">
                    취소
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      onDelete(selected);
                      setConfirmingDelete(false);
                      setView('feed');
                    }}
                  >
                    <Trash2 size={16} />
                    삭제 확정
                  </button>
                </div>
              </div>
            )}

            {selected.kind === 'flash' && !selected.canceled && selected.coffeeDraw && (
              <div className="coffee-pick">
                {spinning && selected.coffeePick ? (
                  selected.coffeeGame === 'ladder' ? (
                    <LadderDrawCanvas
                      members={coffeeMembers}
                      winner={selected.coffeePick}
                      spinning={spinning}
                      onLanded={() => setSpinning(false)}
                    >
                      {/* WebGL·모션 불가 시 폴백: 이름은 감춰 긴장을 남긴다 */}
                      <div className="coffee-roulette">
                        <Coffee size={20} />
                        <span>커피 담당 뽑는 중…</span>
                      </div>
                    </LadderDrawCanvas>
                  ) : (
                    <CoffeeDrawCanvas
                      members={coffeeMembers}
                      winner={selected.coffeePick}
                      spinning={spinning}
                      onLanded={() => setSpinning(false)}
                    >
                      {/* WebGL·모션 불가 시 폴백: 이름은 감춰 긴장을 남긴다 */}
                      <div className="coffee-roulette">
                        <Coffee size={20} />
                        <span>커피 담당 뽑는 중…</span>
                      </div>
                    </CoffeeDrawCanvas>
                  )
                ) : selected.coffeePick ? (
                  <div className="coffee-pick-result">
                    <div className="coffee-result-hero">
                      <span className="coffee-result-avatar">
                        <Avatar name={selected.coffeePick} className="xl" />
                      </span>
                      <span className="coffee-result-label">
                        <Coffee size={13} /> 오늘 커피 담당
                      </span>
                      <strong className="coffee-result-name">{selected.coffeePick}</strong>
                      {selected.coffeePickedAt && (
                        <span className="coffee-result-meta">
                          {formatPickedAt(selected.coffeePickedAt)} · {gameMeta(selected.coffeeGame ?? 'roulette').name} ·
                          재추첨 없이 확정
                        </span>
                      )}
                    </div>
                    {/* 뽑은 순간의 후보 전원을 박제해 보여준다 — 재추첨이 막혀 있어 이 명단에서 공정하게 나온 것이 증명된다. */}
                    {selected.coffeePool && selected.coffeePool.length > 0 && (
                      <div className="coffee-result-pool">
                        <span className="coffee-pool-label">후보 {selected.coffeePool.length}명 중에서 공정하게 뽑혔어요</span>
                        <div className="coffee-pool-chips">
                          {selected.coffeePool.map((name) => (
                            <span className={name === selected.coffeePick ? 'won' : ''} key={name}>
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 실력 게임 결과 — 운이 아니라 점수로 정해졌다는 증거를 그대로 남긴다. */}
                    {selected.coffeeScores && selected.coffeeScores.length > 0 && (
                      <CoffeeScoreboard
                        game={selected.coffeeGame ?? pickedGame}
                        scores={selected.coffeeScores}
                        loser={selected.coffeePick}
                      />
                    )}
                  </div>
                ) : runningSkill ? (
                  <SkillGameRunner
                    members={confirmed.map((s) => s.name)}
                    game={pickedGame}
                    Play={SKILL_PLAY[pickedGame]!}
                    onComplete={(scores) => {
                      setRunningSkill(false);
                      onCoffeeSkillResult(selected, pickedGame, scores);
                    }}
                    onCancel={() => setRunningSkill(false)}
                  />
                ) : isHost ? (
                  canDrawCoffee(selected, signups) ? (
                    <div className="coffee-pick-setup">
                      <CoffeeGamePicker value={pickedGame} onChange={setPickedGame} games={availableGames} />
                      <button
                        className="primary-button coffee"
                        onClick={() => {
                          if (gameMeta(pickedGame).kind === 'skill') {
                            setRunningSkill(true);
                          } else {
                            justDrewRef.current = true;
                            onDrawCoffee(selected, pickedGame);
                          }
                        }}
                        type="button"
                      >
                        <Coffee size={18} />
                        {gameMeta(pickedGame).kind === 'skill'
                          ? `${gameMeta(pickedGame).name} 시작`
                          : `${gameMeta(pickedGame).name}(으)로 커피 뽑기`}
                      </button>
                    </div>
                  ) : (
                    <p className="coffee-pick-hint">
                      <Coffee size={15} /> 확정 2명부터 커피 담당을 뽑을 수 있어요
                    </p>
                  )
                ) : (
                  <p className="coffee-pick-hint">
                    <Coffee size={15} /> 이 번개는 주최자가 커피 담당을 뽑아요
                  </p>
                )}
              </div>
            )}

            <div className="roster">
              <p className="roster-title">
                확정 {confirmed.length}명
                {waiting.length > 0 && <span> · 대기 {waiting.length}명</span>}
              </p>
              <ul className="roster-list">
                {confirmed.map((signup, index) => (
                  <li key={signup.id}>
                    <span className="roster-no">{index + 1}</span>
                    {signup.name}
                  </li>
                ))}
                {waiting.map((signup, index) => (
                  <li className="waiting" key={signup.id}>
                    <span className="roster-no">대기 {index + 1}</span>
                    {signup.name}
                  </li>
                ))}
              </ul>
              {confirmed.length === 0 && <p className="field-note">아직 아무도 신청하지 않았어요. 첫 번째가 되어보세요.</p>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="gathering-toolbar">
        <div className="toolbar">
          {FILTERS.map((item) => (
            <button
              className={filter === item ? 'filter active' : 'filter'}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={() => setView('create')} type="button">
          <Plus size={18} />
          모임 열기
        </button>
      </div>

      {visible.length === 0 ? (
        /*
          빈 상태를 필터마다 다르게 말한다. 전에는 어느 탭에서든 "해당하는 모임이
          없어요" 한 문장이라, '내가 연 것' 에 들어간 사람이 자기가 뭘 잘못했는지
          아니면 원래 비어 있는 건지 알 수 없었다. 무엇이 없는지와 다음에 뭘 할지를
          탭마다 따로 적는다.
        */
        <EmptyState
          action={EMPTY_COPY[filter].toOpen ? { label: '모임 열기', onClick: () => setView('create') } : undefined}
          description={EMPTY_COPY[filter].description}
          icon={Zap}
          title={EMPTY_COPY[filter].title}
        />
      ) : (
        /*
          이음장터와 같은 격자다. 피드로 한 건씩 보여주다가 되돌렸다 — 모임은
          "무엇이 열려 있나" 를 훑는 화면이고, 한 건씩 넘기면 오늘 갈 만한 것이
          몇 개인지 세려고 스크롤해야 한다. 판단에 필요한 사실(날짜 · 남은 자리)은
          포스터 아래 캡션이 대신 나른다.
        */
        <div className="poster-grid ig-shop ig-gallery">
          {visible.map((item) => {
            const status = deriveStatus(item, signups, now);
            const open = status === '모집중';
            const left = spotsLeft(item, signups);
            const seat = mySeat(item, signups, currentUser.name);
            const pending = imagePendingIds.includes(item.id);

            return (
              <figure className={open ? 'ig-shop-cell' : 'ig-shop-cell closed'} key={item.id}>
                {/*
                  캡션을 없애고 사진만 남긴다(인스타 프로필 격자). 사진이 없는 모임은
                  없다 — 첨부가 없으면 등록 직후 그림을 그려 넣기 때문이다.
                  다만 글자가 하나도 없는 격자는 눈으로만 읽힌다. 이름과 시각을
                  aria-label 과 title 로 남겨 스크린리더와 hover 에서는 알 수 있게 한다.
                */}
                <button
                  aria-label={`${item.title} · ${formatWhen(item.startAt)}`}
                  className="poster-cell"
                  onClick={() => openDetail(item.id)}
                  title={`${item.title} · ${formatWhen(item.startAt)}${seat === '확정' ? ' · 신청함' : seat ? ` · 대기 ${seat.대기}` : ''}`}
                  type="button"
                >
                  <PosterFrame badge={status} badgeTone={STATUS_TONE[status]} gathering={item} />
                  {/*
                    등록 직후 배경에서 그림을 그린다. 8초 안팎 걸리는데 아무 표시가
                    없으면 "포스터가 원래 저건가" 하고 지나친다. 그리는 중임을
                    이 자리에서 알린다 — 다 그려지면 이 자리가 사진으로 바뀐다.
                  */}
                  {pending && (
                    <span className="ig-drawing">
                      <Hourglass size={14} />
                      그림 그리는 중
                    </span>
                  )}
                  {!pending && left !== null && left > 0 && <span className="ig-price-tag">{left}자리 남음</span>}
                </button>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
