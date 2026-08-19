import { BadgeCheck, ChevronDown, ClipboardCopy, Hand, Save, Search, Shuffle, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { PanelHeader } from '../../components/PanelHeader';
import { DrawCanvas } from './DrawCanvas';
import { DrawHype, pickHypeClip, type HypeClip } from './DrawHype';
import {
  clearConnectResults,
  loadConnectResults,
  makeConnectResultId,
  makeConnectShareUrl,
  saveConnectResults,
} from '../../connectResultStore';
import type { Profile, SavedDrawResult } from '../../types';
import { useTenantParts } from '../../tenantParts';

type ConnectProps = {
  // 실제 유저(활성 계정)의 라이브 성향 프로필. App이 profiles(DB)+accounts(활성 상태)로 합쳐 전달한다.
  members: Profile[];
};

type BalanceRule = 'part' | 'age' | 'both' | 'random';
type TeamBasis = 'count' | 'size';

type TeamGroup = {
  id: number;
  members: Profile[];
};

type TeamInsight = {
  conversationStarter: string;
  profileSignals: string[];
  strengthSummary: string;
  tone: string;
  title: string;
};

type ProfileSignal = {
  key: string;
  label: string;
  member: string;
  weight: number;
};


function getAgeMood(birthYear: string) {
  const year = Number(birthYear);

  if (!Number.isFinite(year)) return { key: 'unknown', label: '미입력' };
  if (year >= 1997) return { key: 'fresh', label: '새싹' };
  if (year >= 1990) return { key: 'bridge', label: '브릿지' };
  return { key: 'steady', label: '든든한' };
}

function shuffleProfiles(items: Profile[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getBalanceKey(profile: Profile, rule: BalanceRule) {
  if (rule === 'part') return profile.part;
  if (rule === 'age') return getAgeMood(profile.birthYear).key;
  if (rule === 'both') return `${profile.part}-${getAgeMood(profile.birthYear).key}`;
  return 'random';
}

function buildBalancedTeams(participants: Profile[], teamCount: number, rule: BalanceRule) {
  const groups: TeamGroup[] = Array.from({ length: teamCount }, (_, index) => ({ id: index + 1, members: [] }));
  const buckets = new Map<string, Profile[]>();

  shuffleProfiles(participants).forEach((profile) => {
    const key = getBalanceKey(profile, rule);
    buckets.set(key, [...(buckets.get(key) ?? []), profile]);
  });

  const ordered = [...buckets.values()].flatMap((bucket) => bucket);
  ordered.forEach((profile, index) => {
    const round = Math.floor(index / teamCount);
    const position = index % teamCount;
    const groupIndex = round % 2 === 0 ? position : teamCount - position - 1;
    groups[groupIndex].members.push(profile);
  });

  return groups;
}

function getTeamCount(participantCount: number, basis: TeamBasis, value: number) {
  if (participantCount === 0) return 0;
  if (basis === 'count') return Math.min(Math.max(1, value), participantCount);
  return Math.ceil(participantCount / Math.max(2, value));
}

function getBalanceRuleLabel(rule: BalanceRule) {
  if (rule === 'both') return '파트 + 연령대 골고루';
  if (rule === 'part') return '파트 골고루';
  if (rule === 'age') return '연령대 골고루';
  return '랜덤';
}

function getTeamBasisLabel(basis: TeamBasis, value: number) {
  return basis === 'count' ? `조 개수 ${value}개` : `조당 ${value}명`;
}

function formatSavedTime(isoDate: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(isoDate));
}

function buildTeamShareText(groups: TeamGroup[], rule: BalanceRule, basis: TeamBasis, value: number) {
  const lines = groups.map((group) => {
    const members = group.members.map((member) => member.name).join(', ');
    return `${group.id}조: ${members}`;
  });

  return [
    '[SKonnection 조뽑기 결과]',
    `조건: ${getBalanceRuleLabel(rule)} · ${getTeamBasisLabel(basis, value)}`,
    ...lines,
  ].join('\n');
}

function getTopEntryLabel(entries: [string, number][]) {
  return entries.length > 0 ? entries[0][0] : '없음';
}

function countLabels(labels: string[]) {
  return [...labels.reduce((map, label) => map.set(label, (map.get(label) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
}

function getProfileSignal(profile: Profile): ProfileSignal {
  const source = `${profile.trait} ${profile.style}`;

  if (/품질|기준|테스트|판단|재현|이상징후|리스크/.test(source)) {
    return {
      key: 'quality',
      label: '품질과 리스크를 먼저 잡는 시선',
      member: profile.name,
      weight: 3,
    };
  }

  if (/빠르게|실행|실험|피드백|개선|시도/.test(source)) {
    return {
      key: 'action',
      label: '아이디어를 바로 움직이는 실행력',
      member: profile.name,
      weight: 3,
    };
  }

  if (/연결|사람|분위기|부드럽게|파트 사이|공유|소개/.test(source)) {
    return {
      key: 'bridge',
      label: '사람과 파트 사이를 잇는 연결감',
      member: profile.name,
      weight: 3,
    };
  }

  if (/구조|룰|운영|프로세스|정리|흐름|서비스 전체|영향/.test(source)) {
    return {
      key: 'structure',
      label: '복잡한 흐름을 구조화하는 힘',
      member: profile.name,
      weight: 3,
    };
  }

  return {
    key: 'context',
    label: '맥락을 보고 대화를 넓히는 감각',
    member: profile.name,
    weight: 2,
  };
}

function analyzeTeam(group: TeamGroup): TeamInsight {
  const signals = group.members.map(getProfileSignal);
  const signalCounts = countLabels(signals.map((signal) => signal.key));
  const topSignalKey = getTopEntryLabel(signalCounts);
  const uniqueSignalCount = signalCounts.length;
  const signalLabels = signalCounts
    .slice(0, 3)
    .map(([key]) => signals.find((signal) => signal.key === key)?.label)
    .filter((label): label is string => Boolean(label));
  const memberExamples = signals
    .filter((signal, index, list) => list.findIndex((item) => item.key === signal.key) === index)
    .slice(0, 4)
    .map((signal) => `${signal.member}: ${signal.label}`);

  if (uniqueSignalCount >= 4) {
    return {
      conversationStarter: '먼저 각자 최근에 개선하고 싶은 팀 흐름을 하나씩 꺼내면 좋아요.',
      profileSignals: memberExamples,
      strengthSummary: signalLabels.join(' · '),
      title: '다기능 밸런스 조',
      tone: '품질, 실행, 연결, 구조화 성향이 함께 보여서 아이디어를 내고 바로 현실적인 실행안까지 좁히기 좋은 조예요.',
    };
  }

  if (topSignalKey === 'quality') {
    return {
      conversationStarter: '현재 업무에서 놓치기 쉬운 리스크나 검증 기준을 주제로 열면 잘 맞아요.',
      profileSignals: memberExamples,
      strengthSummary: signalLabels.join(' · '),
      title: '품질 기준형 조',
      tone: '재현 조건, 판단 기준, 운영 리스크를 보는 사람이 많아 느슨한 아이디어도 안전한 실행 기준으로 바꾸기 좋아요.',
    };
  }

  if (topSignalKey === 'action') {
    return {
      conversationStarter: '바로 해볼 수 있는 작은 실험이나 이번 주 액션을 정해보면 좋아요.',
      profileSignals: memberExamples,
      strengthSummary: signalLabels.join(' · '),
      title: '빠른 실행형 조',
      tone: '빠르게 시도하고 피드백을 돌리는 성향이 강해서 대화를 짧은 실험과 개선안으로 연결하기 좋은 조예요.',
    };
  }

  if (topSignalKey === 'bridge') {
    return {
      conversationStarter: '서로 다른 파트가 요즘 헷갈리는 지점이나 공유가 필요한 맥락을 이야기하면 좋아요.',
      profileSignals: memberExamples,
      strengthSummary: signalLabels.join(' · '),
      title: '관계 연결형 조',
      tone: '사람 사이 연결과 설명을 부드럽게 만드는 성향이 보여서 낯선 멤버끼리도 대화 문턱을 낮추기 좋은 조예요.',
    };
  }

  if (topSignalKey === 'structure') {
    return {
      conversationStarter: '반복되는 업무를 더 단순하게 만드는 룰이나 템플릿 이야기를 꺼내면 잘 맞아요.',
      profileSignals: memberExamples,
      strengthSummary: signalLabels.join(' · '),
      title: '구조 정리형 조',
      tone: '흐름, 운영 룰, 전체 영향을 보는 사람이 많아 흩어진 의견을 실행 가능한 구조로 정리하기 좋은 조예요.',
    };
  }

  return {
    conversationStarter: '최근 팀 안에서 맥락 공유가 부족했던 순간을 편하게 나눠보면 좋아요.',
    profileSignals: memberExamples,
    strengthSummary: signalLabels.join(' · '),
    title: '맥락 확장형 조',
    tone: '각자의 관찰을 모아 대화 주제를 넓히기 좋은 조예요. 처음부터 결론보다 경험 공유로 시작하면 자연스럽습니다.',
  };
}

function analyzeAllTeams(groups: TeamGroup[]) {
  const totalMembers = groups.reduce((sum, group) => sum + group.members.length, 0);
  const partCount = new Set(groups.flatMap((group) => group.members.map((member) => member.part))).size;
  const ageCount = new Set(groups.flatMap((group) => group.members.map((member) => getAgeMood(member.birthYear).key))).size;
  const averageMembers = groups.length > 0 ? Math.round(totalMembers / groups.length) : 0;

  return {
    title: `${groups.length}개 조 · 평균 ${averageMembers}명`,
    description: `파트 ${partCount}종, 세대 ${ageCount}종이 섞인 결과예요. 아래 카드는 각 조 멤버의 개인 프로필 성향과 일하는 방식을 바탕으로 팀 특징을 읽어낸 내용입니다.`,
  };
}

export function Connect({ members }: ConnectProps) {
  const partOrder = useTenantParts(); // 현재 팀의 파트 순서(SK 고정 아님)
  // 커피뽑기는 번개로 통합됐다. 이 화면(커넥셔너 · 조뽑기)은 조뽑기 전용이다.
  const participantNames = useMemo(() => members.map((member) => member.name), [members]);
  const [selectedNames, setSelectedNames] = useState(participantNames);

  // 실제 명단(활성 계정)이 로드/변경되면(로그인 직후 DB 로드, 계정 활성상태 변경 등)
  // 선택 목록을 최신 명단 전체로 다시 맞춘다. 데모성 화면이라 선택 상태를 영속화하지 않는다.
  useEffect(() => {
    setSelectedNames(participantNames);
  }, [participantNames]);
  const [balanceRule, setBalanceRule] = useState<BalanceRule>('both');
  const [teamBasis, setTeamBasis] = useState<TeamBasis>('count');
  const [teamValue, setTeamValue] = useState(4);
  const [teams, setTeams] = useState<TeamGroup[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [teamEventText, setTeamEventText] = useState('조건을 고르고 셔플 버튼을 눌러보세요');
  const [hypeClip, setHypeClip] = useState<HypeClip | null>(null);
  // 참여자 선택은 기본 접힘. 대부분 '전체'로 조를 짜므로 요약만 보이고, 바꿀 때만 편다.
  const [participantsOpen, setParticipantsOpen] = useState(false);

  /* 뽑기가 시작된 순간의 명단을 붙잡아 둔다. 멈출 때 화면 상태를 다시 읽으면,
     도는 동안 참여자를 지운 경우 빈 명단에서 당첨자를 꺼내다 화면이 죽는다. */
  const drawRosterRef = useRef<{ members: Profile[]; teamCount: number }>({ members: [], teamCount: 0 });
  const [participantSearch, setParticipantSearch] = useState('');
  const [savedResults, setSavedResults] = useState<SavedDrawResult[]>([]);
  const [shareNotice, setShareNotice] = useState('');

  useEffect(() => {
    let isMounted = true;

    loadConnectResults().then((results) => {
      if (isMounted) setSavedResults(results);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedParticipants = useMemo(() => {
    return members.filter((member) => selectedNames.includes(member.name));
  }, [members, selectedNames]);

  const visibleParticipants = useMemo(() => {
    const keyword = participantSearch.trim().toLowerCase();

    if (!keyword) return members;
    return members.filter((member) => (
      member.name.toLowerCase().includes(keyword) ||
      member.part.toLowerCase().includes(keyword) ||
      getAgeMood(member.birthYear).label.toLowerCase().includes(keyword)
    ));
  }, [members, participantSearch]);

  const visibleParticipantsByPart = useMemo(() => {
    return partOrder.map((part) => ({
      part,
      members: visibleParticipants.filter((profile) => profile.part === part),
    }));
  }, [visibleParticipants, partOrder]);

  const teamCount = getTeamCount(selectedParticipants.length, teamBasis, teamValue);
  // 입력한 값이 그대로 쓰이지 못한 경우에만 이유를 밝힌다.
  const teamAdjustedNote = (() => {
    if (selectedParticipants.length === 0) return '';
    if (teamBasis === 'count') {
      if (teamValue > selectedParticipants.length) {
        return `참여자가 ${selectedParticipants.length}명이라 ${teamValue}개 조로 나눌 수 없어요. ${teamCount}개 조로 진행합니다.`;
      }
      if (teamValue < 1) return `조 개수는 1개 이상이어야 해요. ${teamCount}개 조로 진행합니다.`;
      return '';
    }
    if (teamValue < 2) return `조당 인원은 2명 이상이어야 해요. 2명 기준 ${teamCount}개 조로 진행합니다.`;
    return '';
  })();
  const selectedParts = new Set(selectedParticipants.map((profile) => profile.part)).size;
  const selectedAgeMoods = new Set(selectedParticipants.map((profile) => getAgeMood(profile.birthYear).key)).size;
  const teamShareText = teams.length > 0 ? buildTeamShareText(teams, balanceRule, teamBasis, teamValue) : '';

  const toggleParticipant = (name: string) => {
    setSelectedNames((current) => (
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    ));
  };

  const selectAll = () => {
    setSelectedNames(participantNames);
  };

  const clearAll = () => {
    setSelectedNames([]);
    setTeams([]);
  };

  const togglePart = (part: string) => {
    const partMemberNames = members.filter((member) => member.part === part).map((member) => member.name);
    const hasEveryMember = partMemberNames.every((name) => selectedNames.includes(name));

    setSelectedNames((current) => (
      hasEveryMember
        ? current.filter((name) => !partMemberNames.includes(name))
        : [...new Set([...current, ...partMemberNames])]
    ));
  };

  const drawTeams = () => {
    if (selectedParticipants.length < 2 || teamCount === 0 || isDrawing) return;

    setIsDrawing(true);
    setHypeClip(pickHypeClip());
    drawRosterRef.current = { members: selectedParticipants, teamCount };
    setTeams([]);
    setTeamEventText('멈추고 싶을 때 버튼을 누르세요');
  };

  const stopTeamDraw = () => {
    if (!isDrawing) return;

    const { members, teamCount: rosterTeamCount } = drawRosterRef.current;
    if (members.length === 0 || rosterTeamCount === 0) {
      setIsDrawing(false);
      return;
    }

    const nextTeams = buildBalancedTeams(members, rosterTeamCount, balanceRule);
    setTeams(nextTeams);
    setTeamEventText(`${nextTeams.length}개 조가 완성됐어요`);
    setIsDrawing(false);
  };

  const saveResult = (result: SavedDrawResult) => {
    const nextResults = [result, ...savedResults.filter((item) => item.id !== result.id)].slice(0, 6);
    setSavedResults(nextResults);
    void saveConnectResults(nextResults);
    setShareNotice('최근 결과에 저장했고 고정 공유 URL을 만들었어요');
  };

  const saveTeamResult = () => {
    if (teams.length === 0) return;
    const id = makeConnectResultId('teams');
    const shareUrl = makeConnectShareUrl(id);

    saveResult({
      id,
      mode: 'teams',
      title: `${teams.length}개 조 편성`,
      createdAt: new Date().toISOString(),
      summary: `${getBalanceRuleLabel(balanceRule)} · ${getTeamBasisLabel(teamBasis, teamValue)}`,
      shareText: `${teamShareText}\n공유 URL: ${shareUrl}`,
      shareUrl,
    });
  };

  const copyShareText = async (shareText: string) => {
    if (!shareText) return;

    await navigator.clipboard.writeText(shareText);
    setShareNotice('공유 문구를 복사했어요');
  };

  const clearSavedResults = () => {
    setSavedResults([]);
    void clearConnectResults();
    setShareNotice('저장된 결과를 비웠어요');
  };

  return (
    <section className="screen connect-screen">
      <section className="panel connect-studio">
        <PanelHeader icon={Shuffle} title="조뽑기" note="파트·세대를 골고루 섞어 조를 짜요" />

        {/* ① 참여자 — 기본 접힘. 요약만 보이고 '참여자 고르기'로 편다. */}
        <section className="connect-participants">
          <div className="cp-summary">
            <div className="cp-summary-info">
              <UsersRound size={18} />
              <strong>{selectedParticipants.length}명 참여</strong>
              <span>파트 {selectedParts}종 · 세대 {selectedAgeMoods}종</span>
            </div>
            <div className="cp-summary-actions">
              <button className="secondary-button" onClick={selectAll} type="button">전체</button>
              <button className="secondary-button" onClick={clearAll} type="button">해제</button>
              <button className="secondary-button" onClick={() => setParticipantsOpen((open) => !open)} type="button">
                <ChevronDown className={participantsOpen ? 'rotated' : ''} size={16} />
                {participantsOpen ? '접기' : '참여자 고르기'}
              </button>
            </div>
          </div>

          {participantsOpen && (
            <div className="cp-body">
            <div className="participant-search">
              <Search size={17} />
              <input
                aria-label="참여자 검색"
                placeholder="이름, 파트, 세대로 찾기"
                value={participantSearch}
                onChange={(event) => setParticipantSearch(event.target.value)}
              />
            </div>
            <div className="part-group-list">
              {visibleParticipantsByPart.map((group) => (
                <section className="part-group" key={group.part}>
                  <div className="part-group-head">
                    <div>
                      <strong>{group.part}</strong>
                      <span>{group.members.filter((member) => selectedNames.includes(member.name)).length}/{group.members.length}명 선택</span>
                    </div>
                    <button className="secondary-button" onClick={() => togglePart(group.part)} type="button">파트 선택</button>
                  </div>
                  <div className="participant-list compact">
                    {group.members.map((profile) => {
                      const ageMood = getAgeMood(profile.birthYear);
                      const isSelected = selectedNames.includes(profile.name);

                      return (
                        <button
                          className={isSelected ? `selected ${profile.color}` : ''}
                          key={profile.name}
                          onClick={() => toggleParticipant(profile.name)}
                          type="button"
                        >
                          <Avatar name={profile.name} color={profile.color} />
                          <div>
                            <strong>{profile.name}</strong>
                            <small>{ageMood.label}</small>
                          </div>
                          {isSelected && <BadgeCheck size={18} />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            </div>
          )}
        </section>

        <div className="connect-workbench">
            <section className="connect-control-panel">
              <div className="connect-control-grid">
                <label>
                  섞기 조건
                  <select value={balanceRule} onChange={(event) => setBalanceRule(event.target.value as BalanceRule)}>
                    <option value="both">파트 + 연령대 골고루</option>
                    <option value="part">파트 골고루</option>
                    <option value="age">연령대 골고루</option>
                    <option value="random">랜덤</option>
                  </select>
                </label>
                <label>
                  편성 기준
                  <select value={teamBasis} onChange={(event) => setTeamBasis(event.target.value as TeamBasis)}>
                    <option value="count">조 개수</option>
                    <option value="size">조 인원</option>
                  </select>
                </label>
                <label>
                  {teamBasis === 'count' ? '조 개수' : '조당 인원'}
                  <input
                    max={selectedParticipants.length || 1}
                    min={teamBasis === 'count' ? 1 : 2}
                    type="number"
                    value={teamValue}
                    onChange={(event) => setTeamValue(Number(event.target.value))}
                  />
                </label>
              </div>
              {/* getTeamCount가 인원수에 맞춰 조용히 깎아냈다. 입력칸은 4를 보여주는데
                  실제로는 3개 조로 돌아가서, 왜 다른지 알 길이 없었다. 덮어쓰지 말고 알린다. */}
              {teamAdjustedNote && <p className="field-note connect-adjust-note">{teamAdjustedNote}</p>}
              <div className="connect-summary-strip">
                <span>파트 {selectedParts}종</span>
                <span>세대 {selectedAgeMoods}종</span>
                <span>예상 {teamCount}개 조</span>
              </div>
              {/* 뽑는 중에는 같은 버튼이 멈추기가 된다.
                  비활성 조건에 !isDrawing 이 붙은 이유: 돌리는 중에 참여자를
                  전부 해제하면 버튼이 잠겨 뽑기를 끝낼 수가 없었다.
                  시작은 막아도 되지만 멈추는 길은 항상 열려 있어야 한다. */}
              <button
                className={isDrawing ? 'primary-button wide draw-stop' : 'primary-button wide'}
                disabled={!isDrawing && selectedParticipants.length < 2}
                onClick={isDrawing ? stopTeamDraw : drawTeams}
                type="button"
              >
                {isDrawing ? <Hand size={18} /> : <Sparkles size={18} />}
                {isDrawing ? '지금 멈춰!' : '조 섞기 시작'}
              </button>
            </section>

            {/* ③ 결과 — 뽑는 중이거나 결과가 있을 때만 무대를 띄운다(평소 빈 검은 박스 제거). */}
            {/* 3D 무대는 '돌리는 중'에만. 결과는 아래 조별 프로필 사진 카드로 깔끔하게 본다
                (3D 타일에 이름을 겹쳐 그리면 글자가 깨져 보였다). */}
            {isDrawing && (
              <DrawStage
                hypeClip={hypeClip}
                isDrawing={isDrawing}
                members={selectedParticipants}
                teams={teams}
                text={teamEventText}
              />
            )}

            <section className="team-result-grid">
              {teams.map((team) => (
                <article className="team-result-card" key={team.id}>
                  <div className="team-result-head">
                    <strong>{team.id}조</strong>
                    <span>{team.members.length}명</span>
                  </div>
                  <div className="team-member-grid">
                    {team.members.map((member) => (
                      <div className="team-member-cell" key={member.name}>
                        <Avatar name={member.name} color={member.color} className="lg" />
                        <strong>{member.name}</strong>
                        <small>{getAgeMood(member.birthYear).label}</small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
            {teams.length > 0 && (
              <SharePanel
                onCopy={() => void copyShareText(teamShareText)}
                onSave={saveTeamResult}
                shareText={teamShareText}
                teams={teams}
                title="조뽑기 공유 화면"
              />
            )}
            <section className="saved-result-panel">
              <div className="saved-result-head">
                <div>
                  <strong>최근 저장 결과</strong>
                  <span>{savedResults.length}개 저장됨</span>
                </div>
                <button className="secondary-button" disabled={savedResults.length === 0} onClick={clearSavedResults} type="button">
                  비우기
                </button>
              </div>
              {shareNotice && <p className="share-notice">{shareNotice}</p>}
              <div className="saved-result-list">
                {savedResults.length === 0 ? (
                  <EmptyState
                    icon={Shuffle}
                    title="저장된 결과가 아직 없어요"
                    description="뽑기를 돌리고 결과를 저장하면 여기에 쌓입니다."
                  />
                ) : (
                  savedResults.map((result) => (
                    <article key={result.id}>
                      <div>
                        <span>{result.mode === 'teams' ? '조뽑기' : '커피뽑기'} · {formatSavedTime(result.createdAt)}</span>
                        <strong>{result.title}</strong>
                        <p>{result.summary}</p>
                        <small>{result.shareUrl}</small>
                      </div>
                      <button className="secondary-button" onClick={() => void copyShareText(result.shareText)} type="button">
                        <ClipboardCopy size={16} />
                        복사
                      </button>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
      </section>
    </section>
  );
}

function SharePanel({
  onCopy,
  onSave,
  shareText,
  teams,
  title,
}: {
  onCopy: () => void;
  onSave: () => void;
  shareText: string;
  teams?: TeamGroup[];
  title: string;
}) {
  const overallInsight = teams && teams.length > 0 ? analyzeAllTeams(teams) : undefined;

  return (
    <section className="share-panel">
      <div className="share-panel-head">
        <div>
          <strong>{title}</strong>
          <span>팀 채팅에 바로 붙여넣기 좋은 형태예요.</span>
        </div>
        <div>
          <button className="secondary-button" onClick={onSave} type="button">
            <Save size={16} />
            결과 저장
          </button>
          <button className="primary-button" onClick={onCopy} type="button">
            <ClipboardCopy size={16} />
            공유 복사
          </button>
        </div>
      </div>
      {teams && teams.length > 0 && (
        <div className="share-slide-deck">
          <section className="share-hero-slide">
            <span>TEAM DRAW RESULT</span>
            <strong>{overallInsight?.title}</strong>
            <p>{overallInsight?.description}</p>
          </section>
          <div className="share-team-slides">
            {teams.map((team) => {
              const insight = analyzeTeam(team);

              return (
                <article className="share-team-slide" key={team.id}>
                  <div className="share-team-slide-head">
                    <div>
                      <span>{team.id}조</span>
                      <strong>{insight.title}</strong>
                    </div>
                    <em>{team.members.length}명</em>
                  </div>
                  <div className="share-member-cloud">
                    {team.members.map((member) => (
                      <span className={member.color} key={member.name}>{member.name}</span>
                    ))}
                  </div>
                  <div className="team-insight-grid">
                    <div>
                      <span>성향 조합</span>
                      <strong>{insight.strengthSummary}</strong>
                    </div>
                    <div>
                      <span>추천 대화</span>
                      <strong>{insight.conversationStarter}</strong>
                    </div>
                  </div>
                  <div className="profile-signal-list">
                    {insight.profileSignals.map((signal) => (
                      <span key={signal}>{signal}</span>
                    ))}
                  </div>
                  <p>{insight.tone}</p>
                </article>
              );
            })}
          </div>
        </div>
      )}
      <pre>{shareText}</pre>
    </section>
  );
}

/*
  뽑기는 한 번 보고 끝나는 순간이라 인스타 스토리가 정확한 그릇이다.
  세로 카드 · 상단 진행 막대 · 위에 누가 언제 돌렸는지. 결과가 나오면
  마지막 칸이 찬다. 스토리와 다른 점은 자동으로 넘어가지 않는 것뿐이다 —
  뽑기 결과는 사라지면 안 된다.
*/
function StoryFrame({
  step,
  total,
  label,
  children,
}: {
  step: number;
  total: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ig-story-view">
      <div className="ig-story-bars" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <i className={index < step ? 'on' : ''} key={index} />
        ))}
      </div>
      <div className="ig-story-head">
        <span className="ig-ava sm">뽑</span>
        <b>{label}</b>
        <span>· 방금</span>
      </div>
      {children}
    </div>
  );
}

function DrawStage({
  hypeClip,
  isDrawing,
  members,
  teams,
  text,
}: {
  hypeClip: HypeClip | null;
  isDrawing: boolean;
  members: Profile[];
  teams: TeamGroup[];
  text: string;
}) {
  // 이름 → 조 번호. 3D 타일이 자기 조 색으로 바뀌며 아래 결과 카드와 이어진다.
  const teamOf = useMemo(() => {
    const map: Record<string, number> = {};
    teams.forEach((team, index) => team.members.forEach((member) => (map[member.name] = index)));
    return map;
  }, [teams]);

  return (
    <StoryFrame label="조뽑기" step={isDrawing ? 2 : text.includes('조') ? 3 : 1} total={3}>
      <section className={isDrawing ? 'draw-stage rolling' : 'draw-stage'}>
        <DrawCanvas
          isDrawing={isDrawing}
          members={members}
          teamCount={teams.length}
          teamOf={teams.length > 0 ? teamOf : undefined}
        >
          {/* WebGL 을 못 쓰거나 모션을 줄인 환경에서 쓰는 기존 연출 */}
          <div className="draw-orbit">
            <span />
            <span />
            <span />
            <span />
          </div>
        </DrawCanvas>
        <DrawHype active={isDrawing} clip={hypeClip} />
        <strong>{text}</strong>
      </section>
    </StoryFrame>
  );
}
