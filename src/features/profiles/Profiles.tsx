import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  MessageCircle,
  PenLine,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { PanelHeader } from '../../components/PanelHeader';
import { profiles as initialProfiles } from '../../data/mockData';
import { loadProfiles, saveProfileForUser } from '../../profileStore';
import { Assessment } from './AssessmentFlow';
import { DISC_GUIDE, DISC_LABEL } from './assessment';
import { Markdownish } from '../chat/Markdownish';
import type { CurrentUser, Profile } from '../../types';

type ProfileDraft = Omit<Profile, 'color'>;
type ProfilesProps = {
  /* 'mine' = 마이페이지(내 카드+편집), 'directory' = 동료 성향(목록+상세).
     같은 상태와 저장 로직을 쓰므로 컴포넌트를 쪼개지 않고 렌더만 가른다. */
  mode: 'mine' | 'directory';
  currentUser: CurrentUser;
  // 편집/로드 시 상위(App)의 프로필 디렉토리에 반영 → Avatar 전역 갱신.
  onProfilesChange?: (profiles: Profile[]) => void;
};

type SurveyChoice = {
  label: string;
  value: string;
  helper: string;
};

const colorCycle: Profile['color'][] = ['green', 'red', 'blue', 'yellow'];
const partOptions = ['전체', 'TEST혁신파트', 'ITS혁신파트', 'PM혁신파트'];

const fallbackDraft: ProfileDraft = {
  name: '김수정',
  part: 'PM혁신파트',
  role: '팀 연결 경험과 문화 지표 기획',
  englishName: 'Crystal',
  birthYear: '1996',
  birthday: '11-18',
  character: 'Bright Orbit',
  trait: '관계형 촉진자',
  style: '사람 사이 연결과 분위기의 변화를 잘 봅니다.',
  collaboration: '사용자 감정과 화면 흐름을 같이 보면 좋은 아이디어가 나옵니다.',
  feedback: '좋았던 점과 바꿀 점을 나눠 들으면 다음 안을 빠르게 잡습니다.',
  guide: '팀원이 실제로 말하기 편한지, 다시 쓰고 싶은지를 함께 봅니다.',
};

const roleChoices: SurveyChoice[] = [
  { label: '경험 설계', value: '팀 연결 경험과 문화 지표 기획', helper: '사람이 쓰는 흐름과 감정을 먼저 봅니다.' },
  { label: '실행 지원', value: '자동화 도구 운영과 팀 업무 개선', helper: '반복 업무와 실행 조건을 정리합니다.' },
  { label: '품질 정리', value: '품질 기준 정리와 테스트 흐름 설계', helper: '완료 기준과 빠진 조건을 꼼꼼히 봅니다.' },
];

/*
  조뽑기 균형은 Connect.tsx 의 getAgeMood 가 연도 구간(>=1997 / >=1990 / 그 외)
  으로 판정한다. 사용자에게 정확한 연도를 받을 이유가 없으므로 구간을 직접
  고르게 하고, 저장은 각 구간의 대표 연도로 한다. 스키마와 조뽑기 로직을
  건드리지 않으면서 수집하는 개인정보만 줄인다.
*/
const generationChoices = [
  { label: '새싹', value: '1999', hint: '1997년생 이후' },
  { label: '브릿지', value: '1993', hint: '1990~1996년생' },
  { label: '든든한', value: '1985', hint: '1989년생 이전' },
];

// 기존 프로필은 임의 연도(1994, 1988…)를 갖고 있다. 대표값과 === 로 비교하면
// 아무것도 선택되지 않으므로, 어느 구간에 드는지로 판정한다.
function generationValueOf(birthYear: string) {
  const year = Number(birthYear);
  if (!Number.isFinite(year) || !birthYear) return '';
  if (year >= 1997) return '1999';
  if (year >= 1990) return '1993';
  return '1985';
}

const traitChoices: SurveyChoice[] = [
  { label: '관계형', value: '관계형 촉진자', helper: '팀 분위기와 연결감을 민감하게 봅니다.' },
  { label: '실행형', value: '실행형 문제 해결가', helper: '문제를 쪼개고 바로 움직입니다.' },
  { label: '기준형', value: '기준형 설계자', helper: '합의 기준과 운영 구조를 선호합니다.' },
  { label: '맥락형', value: '맥락형 조율가', helper: '결정 전 배경과 리스크를 확인합니다.' },
];

const collaborationChoices: SurveyChoice[] = [
  { label: '같이 그리기', value: '사용자 감정과 화면 흐름을 같이 보면 좋은 아이디어가 나옵니다.', helper: '초기 아이디어를 함께 만지는 방식' },
  { label: '기준 먼저', value: '목표와 제약 조건을 같이 알려주면 현실적인 실행안을 만듭니다.', helper: '조건을 먼저 맞추는 방식' },
  { label: '짧은 단위', value: '오늘 끝낼 단위로 이야기하면 협업이 쉬워집니다.', helper: '작게 쪼개 빠르게 진행' },
];

const feedbackChoices: SurveyChoice[] = [
  { label: '좋은 점 + 바꿀 점', value: '좋았던 점과 바꿀 점을 나눠 들으면 다음 안을 빠르게 잡습니다.', helper: '방향을 잃지 않고 개선' },
  { label: '기준 중심', value: '결과물 기준과 우선순위를 함께 들으면 수정 속도가 빠릅니다.', helper: '무엇이 통과인지 선명하게' },
  { label: '근거 포함', value: '수정 이유와 기대 효과가 같이 있으면 바로 반영합니다.', helper: '왜 바꾸는지까지 이해' },
];

export function Profiles({ mode, currentUser, onProfilesChange }: ProfilesProps) {
  const [profileList, setProfileList] = useState<Profile[]>(initialProfiles);
  const [selectedName, setSelectedName] = useState(() => {
    return initialProfiles.find((profile) => profile.name === currentUser.name)?.name ?? initialProfiles[0]?.name ?? '';
  });
  const [partFilter, setPartFilter] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [editingCollab, setEditingCollab] = useState(false);
  const [collabDraft, setCollabDraft] = useState('');

  const myProfile = useMemo(() => {
    return profileList.find((profile) => profile.name === currentUser.name) ?? profileList[0];
  }, [currentUser.name, profileList]);

  const [draft, setDraft] = useState<ProfileDraft>(() => ({
    ...(initialProfiles.find((profile) => profile.name === currentUser.name) ?? fallbackDraft),
    name: currentUser.name,
    part: currentUser.part === '전체' ? fallbackDraft.part : currentUser.part,
  }));

  const selectedProfile = useMemo(
    () => profileList.find((profile) => profile.name === selectedName) ?? myProfile,
    [myProfile, profileList, selectedName],
  );

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return profileList
      .filter((profile) => partFilter === '전체' || profile.part === partFilter)
      .filter((profile) => {
        if (!normalizedSearch) return true;
        return [profile.name, profile.englishName, profile.character, profile.trait, profile.role]
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (a.name === currentUser.name) return -1;
        if (b.name === currentUser.name) return 1;
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [currentUser.name, partFilter, profileList, searchTerm]);

  const partCounts = useMemo(() => {
    return partOptions.map((part) => ({
      part,
      count: part === '전체' ? profileList.length : profileList.filter((profile) => profile.part === part).length,
    }));
  }, [profileList]);

  const draftColor = myProfile?.color ?? colorCycle[profileList.length % colorCycle.length];
  const previewProfile: Profile = {
    ...draft,
    color: draftColor,
  };
  // 편집 중이면 저장 전 값을, 아니면 저장본을 그린다.
  const cardProfile = isEditing ? previewProfile : myProfile;

  useEffect(() => {
    let isMounted = true;

    loadProfiles(initialProfiles, currentUser).then((loadedProfiles) => {
      if (!isMounted) return;
      setProfileList(loadedProfiles);
      onProfilesChange?.(loadedProfiles);
      const nextMine = loadedProfiles.find((profile) => profile.name === currentUser.name) ?? loadedProfiles[0];
      if (nextMine) {
        setSelectedName(nextMine.name);
        setDraft({
          name: nextMine.name,
          part: nextMine.part,
          role: nextMine.role,
          englishName: nextMine.englishName,
          birthYear: nextMine.birthYear,
          birthday: nextMine.birthday,
          character: nextMine.character,
          trait: nextMine.trait,
          style: nextMine.style,
          collaboration: nextMine.collaboration,
          feedback: nextMine.feedback,
          guide: nextMine.guide,
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const updateDraft = (field: keyof ProfileDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const startEdit = () => {
    if (myProfile) {
      setDraft({
        name: myProfile.name,
        part: myProfile.part,
        role: myProfile.role,
        englishName: myProfile.englishName,
        birthYear: myProfile.birthYear,
        birthday: myProfile.birthday,
        character: myProfile.character,
        trait: myProfile.trait,
        style: myProfile.style,
        collaboration: myProfile.collaboration,
        feedback: myProfile.feedback,
        guide: myProfile.guide,
      });
    }
    setIsEditing(true);
  };

  // 진단 결과를 내 프로필에 병합·저장한다(색·요약·협업 가이드 포함).
  const applyAssessment = (patch: Partial<Profile>) => {
    if (!myProfile) return;
    const nextProfile: Profile = { ...myProfile, ...patch };
    const nextProfiles = [nextProfile, ...profileList.filter((profile) => profile.name !== nextProfile.name)];
    setProfileList(nextProfiles);
    onProfilesChange?.(nextProfiles);
    void saveProfileForUser(nextProfile, currentUser, profileList);
    setSelectedName(nextProfile.name);
    setShowAssessment(false);
  };

  // '나와 일하는 법'만 따로 수정·저장한다(성향 진단 재수행 없이).
  const saveCollab = () => {
    applyAssessment({ collabGuide: collabDraft.trim() || undefined });
    setEditingCollab(false);
  };

  const saveProfile = () => {
    if (!draft.name.trim()) return;

    const nextProfile: Profile = {
      ...draft,
      name: draft.name.trim(),
      color: myProfile?.color ?? colorCycle[profileList.length % colorCycle.length],
      // 진단 결과는 draft(텍스트 설문)에 없으므로, 카드 텍스트만 고칠 때 지워지지 않게 보존한다.
      mbtiType: myProfile?.mbtiType,
      mbtiScores: myProfile?.mbtiScores,
      discType: myProfile?.discType,
      discSecondary: myProfile?.discSecondary,
      discScores: myProfile?.discScores,
      collabGuide: myProfile?.collabGuide,
    };
    const nextProfiles = [nextProfile, ...profileList.filter((profile) => profile.name !== nextProfile.name)];
    setProfileList(nextProfiles);
    onProfilesChange?.(nextProfiles);
    void saveProfileForUser(nextProfile, currentUser, profileList);
    setSelectedName(nextProfile.name);
    setIsEditing(false);
  };

  return (
    <section className="screen profiles-screen">
      {/*
        편집 중에는 이 카드가 draft 를 그린다. 예전에는 저장본을 그리는 이 카드와
        draft 를 그리는 작은 미리보기 카드가 따로 있었는데, 미리보기 쪽이 항목이
        적어(역할·협업만) 실물과 달랐고 어느 쪽이 저장본인지 표시도 없었다.
        카드 하나가 실제 레이아웃 그대로 갱신되는 편이 낫다.
      */}
      {mode === 'mine' && myProfile && (
        <section className={`my-profile-card ${cardProfile.color}`}>
          {/*
            신원(아바타·이름·무드)과 수정 버튼을 한 줄에 모은다. 예전에는
            '내 프로필 카드' 라벨줄 40px + 이름블록 79px + 무드줄 19px 이 세로로
            쌓여 신원에만 166px 을 썼다. 라벨은 화면 제목이 '마이페이지'라 군더더기다.
          */}
          <div className="my-profile-head">
            <div className={`avatar ${cardProfile.color}`}>{cardProfile.name.slice(0, 1)}</div>
            <div className="my-profile-id">
              <span>{cardProfile.part}</span>
              <h2>{cardProfile.name}</h2>
              <strong>{cardProfile.englishName} · {cardProfile.character}</strong>
            </div>
            <p className="my-profile-trait">{cardProfile.trait}</p>
            <div className="my-profile-actions">
              <button className="primary-button" onClick={() => setShowAssessment(true)}>
                <Sparkles size={16} />
                {cardProfile.mbtiType ? '성향 재진단' : '성향 진단'}
              </button>
              <button className="secondary-button" onClick={startEdit}>
                <PenLine size={17} />
                카드 수정
              </button>
            </div>
          </div>
          {(cardProfile.mbtiType || cardProfile.discType) && (
            <div className="my-profile-typechips">
              {cardProfile.mbtiType && <span className="type-chip mbti">{cardProfile.mbtiType}</span>}
              {cardProfile.discType && (
                <span className="type-chip disc">{DISC_LABEL[cardProfile.discType]} ({cardProfile.discType})</span>
              )}
            </div>
          )}
          <div className="my-profile-notes">
            <div>
              <span>역할</span>
              <strong>{cardProfile.role}</strong>
            </div>
            {cardProfile.discType && (
              <div>
                <span>소통 가이드 (업무 성향)</span>
                <strong>{DISC_GUIDE[cardProfile.discType]}</strong>
              </div>
            )}
          </div>

          <div className="my-profile-collab">
            <div className="my-profile-collab-head">
              <span>나와 일하는 법</span>
              {!editingCollab && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setCollabDraft(cardProfile.collabGuide ?? '');
                    setEditingCollab(true);
                  }}
                >
                  <PenLine size={14} /> {cardProfile.collabGuide ? '수정' : '작성'}
                </button>
              )}
            </div>
            {editingCollab ? (
              <div className="my-profile-collab-edit">
                <textarea
                  value={collabDraft}
                  onChange={(event) => setCollabDraft(event.target.value)}
                  placeholder="예) - 소통: 결론부터 간결하게 주세요"
                  rows={5}
                />
                <div className="profile-form-actions">
                  <button className="secondary-button" onClick={() => setEditingCollab(false)}>취소</button>
                  <button className="primary-button" onClick={saveCollab}>
                    <BadgeCheck size={16} /> 저장
                  </button>
                </div>
              </div>
            ) : cardProfile.collabGuide ? (
              <div className="my-profile-collab-body"><Markdownish text={cardProfile.collabGuide} /></div>
            ) : (
              <p className="my-profile-collab-empty">아직 없어요. ‘작성’을 눌러 동료가 참고할 협업 방식을 남겨보세요.</p>
            )}
          </div>
        </section>
      )}

      {mode === 'mine' && showAssessment && myProfile && (
        <Assessment profile={myProfile} onComplete={applyAssessment} onCancel={() => setShowAssessment(false)} />
      )}

      {mode === 'mine' && isEditing && (
        <section className="panel profile-form-panel profile-survey-panel">
          <PanelHeader icon={PenLine} title="성향 카드 짧은 설문" />
          <div className="profile-mini-fields">
            <label>
              영어 이름
              <input value={draft.englishName} onChange={(event) => updateDraft('englishName', event.target.value)} />
            </label>
            <label>
              성향 캐릭터
              <input value={draft.character} onChange={(event) => updateDraft('character', event.target.value)} />
            </label>
          </div>
          {/*
            예전에는 태어난 연도와 생일을 직접 받았다. 생일은 저장만 되고 어디에도
            표시·계산되지 않는 죽은 필드여서 수집을 멈춘다. 연도는 조뽑기 균형에만
            쓰이므로 구간을 직접 고르게 한다 — 정확한 연도가 필요한 곳이 없다.
            라벨 옆에 실제 구간을 적는다. 이름이 뜻을 숨기면 모르는 사람은 못
            알아듣고 아는 사람은 간파하므로, 완곡어법이 양쪽 모두에게 실패한다.
          */}
          <div className="profile-private-fields">
            <div>
              <strong>조뽑기 세대 구간</strong>
              <span>
                조뽑기에서 한쪽으로 몰리지 않게 섞는 데만 쓰입니다. 내 카드에도 동료 목록에도 보이지 않아요.
              </span>
            </div>
            <div className="survey-choice-grid">
              {generationChoices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={generationValueOf(draft.birthYear) === choice.value ? 'selected' : ''}
                  onClick={() => updateDraft('birthYear', choice.value)}
                >
                  <strong>{choice.label}</strong>
                  <span>{choice.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <SurveyQuestion title="주로 맡는 역할은?" field="role" value={draft.role} choices={roleChoices} onSelect={updateDraft} />
          <SurveyQuestion title="일하는 성향에 가까운 쪽은?" field="trait" value={draft.trait} choices={traitChoices} onSelect={updateDraft} />
          <SurveyQuestion title="협업할 때 편한 방식은?" field="collaboration" value={draft.collaboration} choices={collaborationChoices} onSelect={updateDraft} />
          <SurveyQuestion title="피드백은 어떻게 받는 게 좋은가요?" field="feedback" value={draft.feedback} choices={feedbackChoices} onSelect={updateDraft} />
          <label>
            동료에게 남길 한 줄 가이드
            <input value={draft.guide} onChange={(event) => updateDraft('guide', event.target.value)} />
          </label>
          <div className="profile-form-actions">
            <button className="secondary-button" onClick={() => setIsEditing(false)}>
              닫기
            </button>
            <button className="primary-button" onClick={saveProfile}>
              <BadgeCheck size={18} />
              카드 저장
            </button>
          </div>
        </section>
      )}

      {mode === 'directory' && (
      <section className="panel profile-overview">
        <PanelHeader icon={BarChart3} title="팀 성향 분포" />
        {(() => {
          // 선택지 중 하나를 실제로 고른 사람만 분포에 잡힌다. 나머지는 시드
          // 기본값이라 어느 막대에도 안 들어간다. 그 사실을 감추면 '다 1'인
          // 그래프가 집계 결과처럼 읽힌다.
          const answered = filteredProfiles.filter((profile) =>
            traitChoices.some((choice) => choice.value === profile.trait),
          ).length;
          return (
            <p className="field-note">
              {filteredProfiles.length}명 중 <strong>{answered}명</strong>이 성향 카드를 작성했습니다. 작성한 사람만
              분포에 반영됩니다. 항목을 누르면 그 성향만 모아 봅니다.
            </p>
          );
        })()}
        <div className="overview-axes">
          {[
            { 축: '주로 맡는 역할', 값들: roleChoices, field: 'role' as const },
            { 축: '일하는 성향', 값들: traitChoices, field: 'trait' as const },
            { 축: '협업 방식', 값들: collaborationChoices, field: 'collaboration' as const },
            { 축: '피드백 선호', 값들: feedbackChoices, field: 'feedback' as const },
          ].map(({ 축, 값들, field }) => {
            /*
              분모를 전체 인원(32)으로 잡으면 4명이 답한 상태에서 한 칸이 최대
              3% 라 막대가 원리적으로 찰 수 없다. 축 안에서 가장 많은 칸을
              기준으로 삼아야 같은 축의 항목끼리 비교가 된다.
            */
            const counts = 값들.map(
              (choice) => filteredProfiles.filter((profile) => profile[field] === choice.value).length,
            );
            const peak = Math.max(...counts, 1);
            return (
              <div className="overview-axis" key={축}>
                <strong>{축}</strong>
                {값들.map((choice, index) => {
                  const count = counts[index];
                  const active = searchTerm === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      className={active ? 'overview-bar is-active' : 'overview-bar'}
                      onClick={() => setSearchTerm(active ? '' : choice.value)}
                      title={`${choice.label} ${count}명`}
                    >
                      <span className="overview-bar-label">{choice.label}</span>
                      <span className="overview-bar-track">
                        <span style={{ width: `${Math.round((count / peak) * 100)}%` }} />
                      </span>
                      <span className="overview-bar-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
      )}

      {mode === 'directory' && (
      <section className="panel profile-directory">
        <PanelHeader icon={Sparkles} title="동료 프로필 찾기" />
        <div className="profile-directory-tools">
          <label>
            파트
            <select value={partFilter} onChange={(event) => setPartFilter(event.target.value)}>
              {partCounts.map((item) => (
                <option key={item.part} value={item.part}>
                  {item.part} · {item.count}명
                </option>
              ))}
            </select>
          </label>
          <label>
            검색
            <div className="profile-search-box">
              <Search size={18} />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="이름, 성향, 역할로 찾기" />
            </div>
          </label>
        </div>
        <div className="profile-result-summary">
          <strong>{filteredProfiles.length}명</strong>
          <span>30명 규모에서는 파트와 검색으로 좁혀서 보는 흐름이 가장 빠릅니다.</span>
        </div>
        <div className="profile-list-grid">
          {filteredProfiles.map((profile) => (
            <button className={selectedProfile?.name === profile.name ? 'selected' : ''} key={profile.name} onClick={() => setSelectedName(profile.name)}>
              <Avatar name={profile.name} color={profile.color} />
              <div>
                <strong>{profile.name}{profile.name === currentUser.name ? ' · 나' : ''}</strong>
                <small>{profile.part} · {profile.englishName}</small>
              </div>
            </button>
          ))}
        </div>
      </section>
      )}

      {/*
        상세는 디렉터리에서 동료를 골랐을 때 여는 패널이다. selectedProfile 은
        고른 사람이 없으면 내 프로필로 떨어지는데, 그러면 맨 위 '내 프로필 카드'와
        같은 사람을 같은 항목으로 한 번 더 그린다. 본인일 때는 띄우지 않는다.
      */}
      {mode === 'directory' && selectedProfile && selectedProfile.name !== myProfile?.name && (
        <section className="panel ig-person">
          {/*
            인스타 프로필 헤더 문법. 아바타는 원, 이름은 굵지 않고, 그 아래
            해시태그 칩이 붙는다. 칩은 장식이 아니라 이동 경로다 — 누르면
            같은 성향을 가진 동료만 모아 보여준다. 인스타의 해시태그와 같다.
          */}
          <header className="ig-person-head">
            <div className={`avatar ${selectedProfile.color}`}>{selectedProfile.name.slice(0, 1)}</div>
            <div className="ig-person-info">
              <div className="ig-person-line">
                <h2>{selectedProfile.englishName}</h2>
                <button className="ig-btn-soft" onClick={() => setSelectedName('')} type="button">
                  닫기
                </button>
              </div>
              <p className="ig-person-name">
                <b>{selectedProfile.name}</b>
                {selectedProfile.part} · {selectedProfile.character}
              </p>
              {(() => {
                /*
                  저장된 값은 "초안과 맥락을 함께 보면 협업이 쉬워집니다." 같은
                  문장이다. 그대로 해시태그로 쓰면 칩이 아니라 문단이 된다.
                  선택지에 있는 값만 짧은 label 로 칩을 만들고, 시드 기본값처럼
                  선택지에 없는 값은 칩을 만들지 않고 아래 사실 목록으로 내린다.
                  칩이 하나도 없다고 정보를 지우면 안 된다.
                */
                const axes = [
                  { value: selectedProfile.role, choices: roleChoices, hint: '역할' },
                  { value: selectedProfile.trait, choices: traitChoices, hint: '성향' },
                  { value: selectedProfile.collaboration, choices: collaborationChoices, hint: '협업' },
                  { value: selectedProfile.feedback, choices: feedbackChoices, hint: '피드백' },
                ].map((item) => ({
                  ...item,
                  label: item.choices.find((choice) => choice.value === item.value)?.label ?? null,
                }));
                const tagged = axes.filter((item) => item.label !== null);

                return (
                  <>
                    {tagged.length > 0 && (
                      <div className="ig-person-tags">
                        {tagged.map((tag) => (
                          <button
                            className={searchTerm === tag.value ? 'ig-tag on' : 'ig-tag'}
                            key={tag.hint}
                            onClick={() => setSearchTerm(searchTerm === tag.value ? '' : tag.value)}
                            title={`${tag.hint} · 같은 성향인 동료 모아 보기`}
                            type="button"
                          >
                            #{tag.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <dl className="ig-person-facts">
                      {axes.map((axis) => (
                        <div key={axis.hint}>
                          <dt>{axis.hint}</dt>
                          <dd>{axis.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                );
              })()}
            </div>
          </header>

          <p className="ig-person-bio">
            <b>동료 이해 가이드</b>
            {selectedProfile.guide}
          </p>
        </section>
      )}
    </section>
  );
}

function SurveyQuestion({
  title,
  field,
  value,
  choices,
  onSelect,
}: {
  title: string;
  field: keyof ProfileDraft;
  value: string;
  choices: SurveyChoice[];
  onSelect: (field: keyof ProfileDraft, value: string) => void;
}) {
  return (
    <fieldset className="survey-question">
      <legend>{title}</legend>
      <div className="survey-choice-grid">
        {choices.map((choice) => (
          <button className={value === choice.value ? 'selected' : ''} key={choice.value} type="button" onClick={() => onSelect(field, choice.value)}>
            <strong>{choice.label}</strong>
            <span>{choice.helper}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
