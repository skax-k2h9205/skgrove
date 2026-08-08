import { useEffect, useState } from 'react';
import { FilePlus2, Search, Vote } from 'lucide-react';
import { daysLeft, isOpen, optionRate, voteTotal, winningOptions } from '../../agendaRules';
import { teamParts } from '../../auth';
import type { Agenda, CurrentUser, TeamPart, VoteSelection } from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { AgendaDetail } from './AgendaDetail';
import { AgendaForm, type AgendaDraft } from './AgendaForm';
import {
  agendaSorts,
  agendaStatusFilters,
  approveRate,
  filterAgendas,
  sortAgendas,
  type AgendaSort,
  type AgendaStatusFilter,
} from './agendaSort';

type AgendaBoardProps = {
  agendas: Agenda[];
  currentUser: CurrentUser;
  votedAgendaIds: string[];
  canClose: boolean;
  today: string;
  onVote: (id: string, selection: VoteSelection) => void;
  onCloseAgenda: (id: string) => void;
  onCreateAgenda: (draft: AgendaDraft) => Agenda;
  // 안건별로 이미 만들어진 액션아이템 수. 중복 생성 여부를 사용자가 판단할 근거가 된다.
  actionCountByAgenda: Record<string, number>;
  onCreateActions: (agenda: Agenda) => void;
  /** 홈 피드에서 이 안건을 눌러 들어온 경우 그 id. 바로 상세를 열고 한 번만 소비한다. */
  focusId?: string | null;
  onFocusHandled?: () => void;
};

type BoardView = 'list' | 'create' | 'detail';

const partFilters: TeamPart[] = ['전체', ...teamParts];

export function AgendaBoard({
  agendas,
  currentUser,
  votedAgendaIds,
  canClose,
  today,
  onVote,
  onCloseAgenda,
  onCreateAgenda,
  actionCountByAgenda,
  onCreateActions,
  focusId,
  onFocusHandled,
}: AgendaBoardProps) {
  const [view, setView] = useState<BoardView>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<AgendaStatusFilter>('전체');
  const [part, setPart] = useState<TeamPart>(currentUser.part);
  const [sort, setSort] = useState<AgendaSort>('최신순');
  const [keyword, setKeyword] = useState('');

  const voted = new Set(votedAgendaIds);
  const visibleAgendas = sortAgendas(filterAgendas(agendas, { status, part, keyword }), sort);
  // 목록 필터에서 빠졌더라도 열어둔 상세는 유지되어야 하므로 전체 목록에서 찾는다.
  const selectedAgenda = agendas.find((agenda) => agenda.id === selectedId) ?? null;

  const openDetail = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  // 홈 피드에서 이 안건을 눌러 들어오면 바로 그 상세를 연다(한 번만 소비).
  useEffect(() => {
    if (focusId) {
      openDetail(focusId);
      onFocusHandled?.();
    }
  }, [focusId]);

  const createAgenda = (draft: AgendaDraft) => {
    const created = onCreateAgenda(draft);
    setSelectedId(created.id);
    setView('detail');
  };

  if (view === 'create') {
    return (
      <section className="screen">
        <AgendaForm onSubmit={createAgenda} onCancel={() => setView('list')} />
      </section>
    );
  }

  if (view === 'detail' && selectedAgenda) {
    return (
      <section className="screen">
        <AgendaDetail
          agenda={selectedAgenda}
          alreadyVoted={voted.has(selectedAgenda.id)}
          canClose={canClose}
          today={today}
          actionCount={actionCountByAgenda[selectedAgenda.id] ?? 0}
          onVote={onVote}
          onClose={onCloseAgenda}
          onCreateActions={onCreateActions}
          onBack={() => setView('list')}
        />
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="agenda-toolbar">
        <div className="toolbar leader-toolbar">
          {agendaStatusFilters.map((item) => (
            <button className={status === item ? 'filter active' : 'filter'} key={item} onClick={() => setStatus(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="agenda-toolbar-right">
          <label className="agenda-search">
            <Search size={16} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="안건 검색" />
          </label>
          <select aria-label="파트로 거르기" value={part} onChange={(event) => setPart(event.target.value as TeamPart)}>
            {partFilters.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select aria-label="정렬 기준" value={sort} onChange={(event) => setSort(event.target.value as AgendaSort)}>
            {agendaSorts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button className="primary-button" onClick={() => setView('create')}>
            <FilePlus2 size={18} />
            안건 등록
          </button>
        </div>
      </div>

      {visibleAgendas.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="조건에 맞는 안건이 없어요"
          description="필터를 바꾸거나 새 안건을 등록하면 여기에서 바로 투표할 수 있습니다."
          action={{ label: '안건 등록', onClick: () => setView('create') }}
        />
      ) : (
        /*
          인스타 스토리의 투표 스티커 문법. 막대가 배경으로 깔리고 글자가 그 위에
          얹힌다. 이 화면에서는 결과만 보여주고 투표는 상세에서 한다 —
          투표는 되돌릴 수 없는데 목록에는 되돌릴 화면이 없다.

          행 목록보다 한 화면에 담기는 건수가 줄어든다. 대신 "몇 대 몇인지"를
          누르지 않고 알 수 있다. 안건함에 오는 이유가 그것이라 바꿨다.
        */
        <div className="ig-feed">
          {visibleAgendas.map((agenda) => {
            const rate = approveRate(agenda);
            const open = isOpen(agenda);
            const remaining = daysLeft(agenda, today);
            const done = voted.has(agenda.id);
            const multipleChoice = agenda.voteType === '객관식';
            const total = voteTotal(agenda);
            const winners = winningOptions(agenda);
            const statusClass =
              agenda.status === '통과' || agenda.status === '결정됨'
                ? 'pass'
                : agenda.status === '부결'
                  ? 'fail'
                  : 'moss';
            const when = open
              ? done
                ? '투표 완료'
                : remaining !== null && remaining <= 0
                  ? '오늘 마감'
                  : remaining !== null
                    ? `${remaining}일 남음`
                    : '투표중'
              : agenda.createdAt;

            return (
              <article className="ig-post plain" key={agenda.id}>
                <header className="ig-post-head">
                  <span className="ig-ava">
                    <Vote size={17} />
                  </span>
                  <span className="ig-post-who">
                    <b>{agenda.category}</b>
                    <span>
                      {agenda.source} · {agenda.part}
                    </span>
                  </span>
                  <span className={`ig-post-status ${statusClass}`}>{agenda.status}</span>
                </header>

                <div className="ig-post-body">
                  <p className="ig-headline">{agenda.title}</p>

                  <div className="ig-poll">
                    {multipleChoice ? (
                      agenda.options.map((option) => {
                        const share = optionRate(agenda, option);
                        const leading = total > 0 && winners.some((winner) => winner.id === option.id);
                        return (
                          <div className={leading ? 'ig-opt win' : 'ig-opt'} key={option.id}>
                            <span className="ig-opt-bar" style={{ width: `${share}%` }} />
                            <b>{option.label}</b>
                            <em>{share}%</em>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        <div className={rate >= 50 ? 'ig-opt win' : 'ig-opt'}>
                          <span className="ig-opt-bar" style={{ width: `${rate}%` }} />
                          <b>찬성</b>
                          <em>{rate}%</em>
                        </div>
                        <div className={rate < 50 ? 'ig-opt win' : 'ig-opt'}>
                          <span className="ig-opt-bar" style={{ width: `${100 - rate}%` }} />
                          <b>반대</b>
                          <em>{100 - rate}%</em>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="ig-poll-meta">
                    {multipleChoice ? `${total}명 참여` : `${total}표`} · {when}
                  </p>

                  <button className={done || !open ? 'ig-join done' : 'ig-join'} onClick={() => openDetail(agenda.id)} type="button">
                    {open ? (done ? '결과 보기' : '투표하기') : '결과 보기'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

    </section>
  );
}
