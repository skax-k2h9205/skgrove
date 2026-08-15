import { useMemo, useState, type ChangeEvent } from 'react';
import { CalendarClock, ChevronDown, Coffee, ImagePlus, MapPin, Trash2, Users, Zap } from 'lucide-react';
import { PanelHeader } from '../../components/PanelHeader';
import { useTenantParts } from '../../tenantParts';
import type { Gathering, GatheringCost, GatheringKind, TeamPart } from '../../types';

export type GatheringDraft = Pick<
  Gathering,
  'title' | 'startAt' | 'place' | 'capacity' | 'closeAt' | 'minPeople' | 'desc' | 'part' | 'cost' | 'coffeeDraw'
> & { kind: GatheringKind; imageFile: File | null };

type GatheringFormProps = {
  onSubmit: (draft: GatheringDraft) => void;
  onCancel: () => void;
};

const costs: GatheringCost[] = ['없음', 'n빵', '주최자 부담'];

/** 'YYYY-MM-DDTHH:mm' 로컬 시각. datetime-local 이 그대로 받는 형식이다. */
function localStamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function at(dayOffset: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return localStamp(date);
}

/*
  번개는 "지금 정해서 오늘 만나는" 것이라 날짜 입력이 가장 큰 마찰이다.
  달력을 열어 연·월·일·시를 고르게 하면 그 사이에 마음이 식는다. 칩 하나로 끝내고,
  안 맞으면 그때만 직접 고르게 한다. 공모는 미리 계획하는 것이라 칩이 의미가 적다.
*/
const FLASH_CHIPS: Array<{ label: string; value: () => string }> = [
  { label: '오늘 점심', value: () => at(0, 12) },
  { label: '오늘 저녁', value: () => at(0, 18) },
  { label: '내일 점심', value: () => at(1, 12) },
  { label: '내일 저녁', value: () => at(1, 18) },
];

export function GatheringForm({ onSubmit, onCancel }: GatheringFormProps) {
  const parts: TeamPart[] = ['전체', ...useTenantParts()];
  /*
    한때 이 선택이 사이드바 메뉴 두 개였다. 규칙에 kind 분기가 하나도 없어서
    (정원·대기·승계·상태·포스터 전부 동일) 메뉴를 나눈 대가는 "이건 번개인가
    공모인가"라는 판단을 사용자에게 떠넘긴 것뿐이었다. 여기로 내렸다.
    고르면 기본 날짜와 날짜 칩이 그에 맞게 바뀐다 — 실제로 다른 건 그 둘뿐이다.
  */
  // 폼 선택은 3갈래지만 저장 kind 는 둘뿐이다 — 커피내기는 내부적으로 번개(flash)다.
  const [pick, setPick] = useState<'flash' | 'callup' | 'coffee'>('flash');
  const isFlash = pick === 'flash';
  const isCoffee = pick === 'coffee';
  const kind: GatheringKind = pick === 'callup' ? 'callup' : 'flash';

  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(at(0, 18));
  const [place, setPlace] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const [capacity, setCapacity] = useState('6');

  // 종류를 바꾸면 기본 날짜도 그에 맞게 옮긴다(직접 고른 값은 안 덮는다).
  // 커피내기는 시각을 안 받는 대신 장소·정원 기본값을 채운다.
  const choosePick = (next: 'flash' | 'callup' | 'coffee') => {
    setPick(next);
    if (next === 'coffee') {
      if (!place.trim()) setPlace('4층 cafe4u');
      setCapacity('4');
      return;
    }
    const wasDefault = startAt === at(0, 18) || startAt === at(7, 18);
    if (wasDefault) setStartAt(next === 'flash' ? at(0, 18) : at(7, 18));
  };

  // 선택 항목은 접어 둔다. 번개 등록이 5개 필드를 넘어가면 번개가 아니게 된다.
  const [moreOpen, setMoreOpen] = useState(false);
  const [closeAt, setCloseAt] = useState('');
  const [minPeople, setMinPeople] = useState('');
  const [desc, setDesc] = useState('');
  const [part, setPart] = useState<TeamPart>('전체');
  const [cost, setCost] = useState<GatheringCost>('없음');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  // 미리보기는 파일이 바뀔 때만 다시 만든다. 렌더마다 만들면 URL 이 계속 새로 생긴다.
  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : ''), [imageFile]);

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
  };

  const submit = () => {
    const trimmedPlace = place.trim();
    // 커피내기는 제목·시각을 안 받는다 — 제목은 자동, 마감은 만든 뒤 10분(정원 차면 그 전에 마감).
    const trimmedTitle = isCoffee ? '커피 내기' : title.trim();
    const pad = (n: number) => String(n).padStart(2, '0');
    const soon = new Date(Date.now() + 10 * 60000);
    const coffeeAt = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
    const effStartAt = isCoffee ? coffeeAt : startAt;

    if (!isCoffee && trimmedTitle.length < 2) {
      setError('무엇을 하는 자리인지 적어주세요. 피드에서 제목만 보고 들어올지 정합니다.');
      return;
    }
    if (!isCoffee && !startAt) {
      setError('언제 만나는지 정해주세요.');
      return;
    }
    if (!trimmedPlace) {
      setError('어디서 만나는지 적어주세요. 온라인이면 링크를 넣어도 됩니다.');
      return;
    }

    const parsedCapacity = unlimited ? null : Number(capacity);
    if (!unlimited && (!Number.isFinite(parsedCapacity) || (parsedCapacity as number) < 1)) {
      setError('정원은 1명 이상으로 정하거나 "제한 없음"을 선택해주세요.');
      return;
    }

    // 커피내기 마감 = 만든 뒤 10분(effStartAt). 그 외는 비우면 시작 시각을 쓴다.
    const finalCloseAt = isCoffee ? effStartAt : closeAt || startAt;
    if (!isCoffee && finalCloseAt > startAt) {
      setError('신청 마감은 시작 시각보다 늦을 수 없습니다.');
      return;
    }

    const parsedMin = minPeople.trim() ? Number(minPeople) : null;
    if (parsedMin !== null && (!Number.isFinite(parsedMin) || parsedMin < 1)) {
      setError('최소 인원은 1명 이상으로 적어주세요.');
      return;
    }
    if (parsedMin !== null && parsedCapacity !== null && parsedMin > parsedCapacity) {
      setError('최소 인원이 정원보다 많습니다.');
      return;
    }

    setError('');
    onSubmit({
      kind,
      title: trimmedTitle,
      startAt: effStartAt,
      place: trimmedPlace,
      capacity: parsedCapacity,
      closeAt: finalCloseAt,
      minPeople: parsedMin,
      desc: desc.trim(),
      part,
      cost,
      // 커피내기 카드로 만든 것만 커피 뽑기가 켜진다.
      coffeeDraw: isCoffee,
      imageFile,
    });
  };

  return (
    <section className="panel gathering-form">
      <PanelHeader icon={Zap} title="모임 열기" />

      <div className="intake-choice-grid gathering-choice-3">
        <button
          className={pick === 'flash' ? 'choice-card selected' : 'choice-card'}
          onClick={() => choosePick('flash')}
          type="button"
        >
          <Zap size={22} />
          <strong>번개</strong>
          <span>오늘·내일 바로 만나요. 날짜를 칩으로 한 번에 고릅니다.</span>
        </button>
        <button
          className={pick === 'callup' ? 'choice-card selected' : 'choice-card'}
          onClick={() => choosePick('callup')}
          type="button"
        >
          <CalendarClock size={22} />
          <strong>미리 잡는 일정</strong>
          <span>날짜를 정해두고 선착순으로 모아요. 기본값이 일주일 뒤입니다.</span>
        </button>
        <button
          className={pick === 'coffee' ? 'choice-card selected' : 'choice-card'}
          onClick={() => choosePick('coffee')}
          type="button"
        >
          <Coffee size={22} />
          <strong>커피내기</strong>
          <span>모인 사람 중 커피 살 사람을 뽑아요. 어디서만 정하면 끝.</span>
        </button>
      </div>

      {/* 커피내기는 제목·시각을 안 받는다 — 제목은 '커피 내기'로 자동, 마감은 만든 뒤 10분. */}
      {!isCoffee && (
        <label className="field">
          <span className="field-label">
            무엇을 하나요 <em>필수</em>
          </span>
          <input
            autoFocus
            maxLength={40}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={isFlash ? '예) 점심 같이 먹어요' : '예) 제주 워크샵 함께 가실 분'}
            value={title}
          />
        </label>
      )}

      {!isCoffee && (
        <div className="field">
          <span className="field-label">
            언제 만나나요 <em>필수</em>
          </span>
          {isFlash && (
            <div className="chip-row">
              {FLASH_CHIPS.map((chip) => {
                const value = chip.value();
                return (
                  <button
                    className={startAt === value ? 'chip selected' : 'chip'}
                    key={chip.label}
                    onClick={() => setStartAt(value)}
                    type="button"
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}
          <input
            aria-label="시작 시각"
            onChange={(event) => setStartAt(event.target.value)}
            type="datetime-local"
            value={startAt}
          />
        </div>
      )}

      <div className="gathering-pair">
        <label className="field">
          <span className="field-label">
            어디서 <em>필수</em>
          </span>
        <span className="field-with-icon">
          <MapPin size={16} />
          <input
            onChange={(event) => setPlace(event.target.value)}
            placeholder="예) 1층 로비 / 강남 볼링장 / 온라인 링크"
            value={place}
          />
        </span>
      </label>

      <div className="field">
        <span className="field-label">
          몇 명까지 <em>필수</em>
        </span>
        <div className="capacity-row">
          <span className="field-with-icon">
            <Users size={16} />
            <input
              aria-label="정원"
              disabled={unlimited}
              min={1}
              onChange={(event) => setCapacity(event.target.value)}
              type="number"
              value={unlimited ? '' : capacity}
            />
          </span>
          <label className="checkline">
            <input checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} type="checkbox" />
            제한 없음
          </label>
        </div>
        {!unlimited && <p className="field-note">정원을 넘으면 대기 순번으로 받고, 앞사람이 취소하면 자동으로 올라갑니다.</p>}
        </div>
      </div>

      {isCoffee && (
        <p className="field-note coffee-form-note">
          <Coffee size={14} /> 제목은 '커피 내기'로 자동, 만든 뒤 10분 또는 정원이 차면 마감돼요. 모이면 상세에서 커피 살 사람을 뽑습니다.
        </p>
      )}

      {!isCoffee && (
        <>
      <button className="more-toggle" onClick={() => setMoreOpen((open) => !open)} type="button">
        <ChevronDown className={moreOpen ? 'rotated' : ''} size={16} />
        {moreOpen ? '선택 항목 접기' : '선택 항목 더 보기'}
      </button>

      {moreOpen && (
        <div className="gathering-more">
          <div className="gathering-pair">
            <label className="field">
              <span className="field-label">신청 마감</span>
            <input onChange={(event) => setCloseAt(event.target.value)} type="datetime-local" value={closeAt} />
            <p className="field-note">비워두면 시작 시각까지 받습니다.</p>
          </label>

          <label className="field">
            <span className="field-label">최소 인원</span>
            <input
              min={1}
              onChange={(event) => setMinPeople(event.target.value)}
              placeholder="예) 3"
              type="number"
              value={minPeople}
            />
            <p className="field-note">이 인원이 안 모이면 부담 없이 접을 수 있게 미리 알려둡니다.</p>
            </label>
          </div>

          <label className="field">
            <span className="field-label">한 줄 설명</span>
            <textarea
              maxLength={120}
              onChange={(event) => setDesc(event.target.value)}
              placeholder="준비물이나 분위기를 적어주세요"
              rows={2}
              value={desc}
            />
          </label>

          <div className="gathering-pair">
            <label className="field">
              <span className="field-label">대상</span>
            <select onChange={(event) => setPart(event.target.value as TeamPart)} value={part}>
              {parts.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">비용</span>
            <select onChange={(event) => setCost(event.target.value as GatheringCost)} value={cost}>
              {costs.map((item) => (
                <option key={item}>{item}</option>
              ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">대표 이미지</span>
        {previewUrl ? (
          <div className="image-picked">
            <img alt="첨부한 이미지 미리보기" src={previewUrl} />
            <button className="btn-ghost" onClick={() => setImageFile(null)} type="button">
              <Trash2 size={16} />
              지우고 자동 생성으로
            </button>
          </div>
        ) : (
          <label className="image-drop">
            <input accept="image/*" onChange={pickImage} type="file" />
            <ImagePlus size={22} />
            <strong>사진 넣기</strong>
            <small>넣지 않으면 입력한 내용으로 포스터를 만들어 드려요.</small>
          </label>
        )}
      </div>
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button className="btn-ghost" onClick={onCancel} type="button">
          취소
        </button>
        <button className="primary-button" onClick={submit} type="button">
          {isCoffee ? '커피내기 열기' : isFlash ? '번개 열기' : '공모 올리기'}
        </button>
      </div>
    </section>
  );
}
