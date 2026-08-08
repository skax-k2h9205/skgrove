import { useState, type ChangeEvent } from 'react';
import { Gavel, Gift, ImagePlus, Trash2 } from 'lucide-react';
import { PanelHeader } from '../../components/PanelHeader';
import { formatPrice } from '../../marketRules';
import type { MarketItem, MarketKind } from '../../types';

export type MarketDraft = Pick<
  MarketItem,
  'title' | 'desc' | 'startPrice' | 'minStep' | 'closeAt' | 'place'
> & { kind: MarketKind; imageFile: File | null };

type MarketFormProps = {
  onSubmit: (draft: MarketDraft) => void;
  onCancel: () => void;
  /** 있으면 수정 모드 — 기존 값으로 채워 시작한다. 입찰 0건일 때만 호출부가 연다. */
  initial?: MarketItem;
};

/** 'YYYY-MM-DDTHH:mm' 로컬 시각. datetime-local 이 그대로 받는 형식이다. */
function localStamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inDays(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return localStamp(date);
}

/* 마감을 직접 고르게 하면 등록이 느려진다. 대부분 며칠 안에 끝나므로 칩으로 끝내고,
   안 맞을 때만 직접 고르게 한다(모임 폼과 같은 판단). */
const CLOSE_CHIPS: Array<{ label: string; value: () => string }> = [
  { label: '내일 저녁', value: () => inDays(1, 18) },
  { label: '3일 뒤', value: () => inDays(3, 18) },
  { label: '일주일 뒤', value: () => inDays(7, 18) },
];

/* 최소 인상폭 기본값. 시작가에 비해 너무 작으면 1,000원씩 스무 번 올리는 눈치싸움이
   되고, 너무 크면 아무도 못 올린다. 시작가의 5% 를 1,000원 단위로 반올림한다. */
function suggestStep(startPrice: number) {
  if (startPrice <= 0) return 1000;
  const raw = Math.round((startPrice * 0.05) / 1000) * 1000;
  return Math.max(1000, raw);
}

export function MarketForm({ onSubmit, onCancel, initial }: MarketFormProps) {
  const isEdit = Boolean(initial);
  const [kind, setKind] = useState<MarketKind>(initial?.kind ?? 'auction');
  const isAuction = kind === 'auction';

  const [title, setTitle] = useState(initial?.title ?? '');
  const [desc, setDesc] = useState(initial?.desc ?? '');
  const [place, setPlace] = useState(initial?.place ?? '');
  const [closeAt, setCloseAt] = useState(initial?.closeAt || inDays(3, 18));
  const [startPrice, setStartPrice] = useState(initial?.startPrice ? String(initial.startPrice) : '');
  // 수정 모드에서 인상폭이 이미 있으면 '사용자가 정한 값'으로 보고 시작가를 따라 움직이지 않는다.
  const [stepTouched, setStepTouched] = useState(Boolean(initial?.minStep));
  const [minStep, setMinStep] = useState(initial?.minStep ? String(initial.minStep) : '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const priceNumber = Number(startPrice.replace(/[^\d]/g, '')) || 0;
  const stepNumber = Number(minStep.replace(/[^\d]/g, '')) || 0;
  const effectiveStep = stepTouched ? stepNumber : suggestStep(priceNumber);

  const changePrice = (value: string) => {
    setStartPrice(value);
    if (!stepTouched) {
      const next = Number(value.replace(/[^\d]/g, '')) || 0;
      setMinStep(next > 0 ? String(suggestStep(next)) : '');
    }
  };

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
  };

  const submit = () => {
    if (!title.trim()) {
      setError('무엇을 내놓는지 적어주세요. 제목만 보고 판단하는 사람이 많습니다.');
      return;
    }
    if (!place.trim()) {
      setError('어디서 주고받을지 적어주세요. 층·회의실 정도면 충분합니다.');
      return;
    }
    if (isAuction && priceNumber <= 0) {
      setError('시작가를 적어주세요. 나눔이라면 위에서 나눔을 골라주세요.');
      return;
    }
    if (isAuction && effectiveStep <= 0) {
      setError('최소 인상폭은 1원 이상이어야 합니다. 없으면 1원씩 올리는 눈치싸움이 됩니다.');
      return;
    }
    if (closeAt <= localStamp(new Date())) {
      setError('마감은 지금 이후로 정해주세요. 이미 지난 시각이면 아무도 부를 수 없습니다.');
      return;
    }

    setError('');
    onSubmit({
      kind,
      title: title.trim(),
      desc: desc.trim(),
      place: place.trim(),
      closeAt,
      startPrice: isAuction ? priceNumber : 0,
      minStep: isAuction ? effectiveStep : 0,
      imageFile,
    });
  };

  return (
    <section className="panel form-panel">
      <PanelHeader icon={isAuction ? Gavel : Gift} title={isEdit ? '물건 수정' : '물건 내놓기'} />

      <div className="choice-row">
        <button
          className={isAuction ? 'choice-card selected' : 'choice-card'}
          onClick={() => setKind('auction')}
          type="button"
        >
          <Gavel size={22} />
          <strong>경매로 팔기</strong>
          <span>시작가를 정하면 마감까지 입찰을 받고, 가장 높이 부른 분이 가져갑니다.</span>
        </button>
        <button
          className={!isAuction ? 'choice-card selected' : 'choice-card'}
          onClick={() => setKind('giveaway')}
          type="button"
        >
          <Gift size={22} />
          <strong>그냥 나눔</strong>
          <span>먼저 누르는 분이 가져갑니다. 금액을 적지 않아도 됩니다.</span>
        </button>
      </div>

      <label className="field">
        <span className="field-label">
          무엇을 내놓나요 <em>필수</em>
        </span>
        <input
          autoFocus
          maxLength={40}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예) 기계식 키보드 적축 풀배열"
          value={title}
        />
      </label>

      <label className="field">
        <span className="field-label">
          어디서 주고받나요 <em>필수</em>
        </span>
        <input
          maxLength={30}
          onChange={(event) => setPlace(event.target.value)}
          placeholder="예) 9층 라운지"
          value={place}
        />
      </label>

      {isAuction && (
        <div className="two-column">
          <label className="field">
            <span className="field-label">
              시작가 <em>필수</em>
            </span>
            <input
              inputMode="numeric"
              onChange={(event) => changePrice(event.target.value)}
              placeholder="120000"
              value={startPrice}
            />
            {priceNumber > 0 && <p className="field-note">{formatPrice(priceNumber)}부터 시작합니다.</p>}
          </label>

          <label className="field">
            <span className="field-label">최소 인상폭</span>
            <input
              inputMode="numeric"
              onChange={(event) => {
                setStepTouched(true);
                setMinStep(event.target.value);
              }}
              placeholder="5000"
              value={minStep}
            />
            <p className="field-note">
              {effectiveStep > 0
                ? `${formatPrice(effectiveStep)}씩 올려 부를 수 있어요.`
                : '비워두면 시작가에 맞춰 정해드려요.'}
            </p>
          </label>
        </div>
      )}

      <div className="field">
        <span className="field-label">
          언제 마감하나요 <em>필수</em>
        </span>
        <div className="chip-row">
          {CLOSE_CHIPS.map((chip) => {
            const value = chip.value();
            return (
              <button
                className={closeAt === value ? 'chip selected' : 'chip'}
                key={chip.label}
                onClick={() => setCloseAt(value)}
                type="button"
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <input onChange={(event) => setCloseAt(event.target.value)} type="datetime-local" value={closeAt} />
        <p className="field-note">
          {isAuction
            ? '마감 3분 안에 입찰이 들어오면 3분 미뤄집니다. 마지막 순간에 낚아채고 끝나는 일을 막습니다.'
            : '마감 전에 먼저 누르는 분이 가져갑니다.'}
        </p>
      </div>

      <label className="field">
        <span className="field-label">설명</span>
        <textarea
          maxLength={300}
          onChange={(event) => setDesc(event.target.value)}
          placeholder="쓴 기간, 상태, 아쉬운 점을 적어주세요. 미리 알수록 거래가 깔끔합니다."
          rows={3}
          value={desc}
        />
      </label>

      <div className="field">
        <span className="field-label">사진</span>
        {imageFile ? (
          <div className="image-picked">
            <span>{imageFile.name}</span>
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
            <small>
              {isEdit && initial?.imageUrl
                ? '지금 이미지를 그대로 둡니다. 새 사진을 넣으면 교체됩니다.'
                : '넣지 않으면 입력한 내용으로 포스터를 만들어 드려요.'}
            </small>
          </label>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button className="btn-ghost" onClick={onCancel} type="button">
          취소
        </button>
        <button className="primary-button" onClick={submit} type="button">
          {isEdit ? '저장' : isAuction ? '경매 시작' : '나눔 올리기'}
        </button>
      </div>
    </section>
  );
}
