import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Minus, Plus, X } from 'lucide-react';

/*
  사진 한 장을 화면 가득 띄워 보는 겹창.

  장터에는 세로로 긴 사진이 올라온다 — 여러 장을 못 올리니 사람들이 사진 여러 장을
  세로로 이어붙여 한 장으로 만든다. 그런 사진을 비율대로만 띄우면 가늘고 길어서
  정작 봐야 할 글씨나 흠집이 안 보인다.

  그래서 두 가지를 쥔다.
  - 처음에는 어떤 비율이든 화면 안에 통째로 맞춘다(맞춤 = 배율 1).
  - 거기서 키워서 들여다보고 끌어서 옮긴다. 키운 상태가 이 화면의 본령이다.

  배경은 대나무숲·캔미팅이 쓰는 .modal-backdrop 을 그대로 쓴다.
  닫는 길은 셋(Esc · 배경 누르기 · 닫기 단추) — 화면을 전부 덮는 창에서
  빠져나갈 길이 하나뿐이면 그 하나를 못 찾은 사람은 갇힌다.
*/

const MIN_SCALE = 1; // 맞춤보다 더 줄일 이유가 없다
const MAX_SCALE = 6;
const STEP = 0.4;

type PhotoViewerProps = {
  src: string;
  /** 읽어 줄 이름. 보통 물건 제목. */
  alt: string;
  onClose: () => void;
};

type Point = { x: number; y: number };

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

export function PhotoViewer({ src, alt, onClose }: PhotoViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  // 끌기 시작점과, 손가락 두 개의 거리(집기 확대용).
  const drag = useRef<{ from: Point; at: Point } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  /*
    배율을 바꾸되 화면의 한 점(보통 커서나 두 손가락 사이)을 제자리에 둔다.
    그냥 가운데를 기준으로 키우면 보고 있던 곳이 화면 밖으로 밀려난다.
  */
  const zoomAround = useCallback((next: number, anchor?: Point) => {
    setScale((prev) => {
      const target = clampScale(next);
      if (target === prev) return prev;

      const stage = stageRef.current;
      if (anchor && stage) {
        const box = stage.getBoundingClientRect();
        const fromCenter = { x: anchor.x - (box.left + box.width / 2), y: anchor.y - (box.top + box.height / 2) };
        setOffset((old) => ({
          x: fromCenter.x - ((fromCenter.x - old.x) * target) / prev,
          y: fromCenter.y - ((fromCenter.y - old.y) * target) / prev,
        }));
      }
      // 맞춤으로 돌아오면 치우쳐 있던 위치도 같이 되돌린다.
      if (target === 1) setOffset({ x: 0, y: 0 });
      return target;
    });
  }, []);

  // 사진이 바뀌면 보던 배율·위치를 들고 가지 않는다.
  useEffect(() => {
    reset();
  }, [src, reset]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === '+' || event.key === '=') zoomAround(scale + STEP);
      else if (event.key === '-' || event.key === '_') zoomAround(scale - STEP);
      else if (event.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);

    // 겹창 뒤의 목록이 같이 밀리면 닫았을 때 보던 자리를 잃는다.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // 열자마자 닫기 단추에 초점을 둔다 — 키보드만 쓰는 사람이 Tab 을 더듬지 않도록.
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, reset, scale, zoomAround]);

  /*
    휠은 React 의 onWheel 로 달면 passive 라 preventDefault 가 먹지 않아
    페이지가 같이 스크롤된다. 직접 passive:false 로 건다.
  */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAround(scale - event.deltaY * 0.0015 * scale, { x: event.clientX, y: event.clientY });
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [scale, zoomAround]);

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const middle = (): Point => {
    const [a, b] = [...pointers.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      drag.current = null;
      pinch.current = { dist: spread(), scale };
      return;
    }
    if (scale > 1) {
      (event.target as Element).setPointerCapture?.(event.pointerId);
      drag.current = { from: { x: event.clientX, y: event.clientY }, at: offset };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinch.current && pointers.current.size === 2) {
      const started = pinch.current;
      zoomAround((started.scale * spread()) / started.dist, middle());
      return;
    }
    if (!drag.current) return;
    const moved = drag.current;
    setOffset({
      x: moved.at.x + (event.clientX - moved.from.x),
      y: moved.at.y + (event.clientY - moved.from.y),
    });
  };

  const endPointer = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  const zoomed = scale > 1;

  return (
    <div aria-label={alt} aria-modal="true" className="modal-backdrop photo-viewer" role="dialog">
      {/* 배경(사진 바깥)을 누르면 닫는다. 사진·단추는 각자 멈춰 세운다. */}
      <div
        className="photo-viewer-stage"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onPointerCancel={endPointer}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        ref={stageRef}
      >
        <img
          alt={alt}
          className={zoomed ? 'photo-viewer-img zoomed' : 'photo-viewer-img'}
          draggable={false}
          onDoubleClick={(event) => zoomAround(zoomed ? 1 : 2.5, { x: event.clientX, y: event.clientY })}
          src={src}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>

      <button aria-label="닫기" className="photo-viewer-close" onClick={onClose} ref={closeRef} type="button">
        <X size={20} />
      </button>

      <div className="photo-viewer-tools">
        <button aria-label="축소" disabled={scale <= MIN_SCALE} onClick={() => zoomAround(scale - STEP)} type="button">
          <Minus size={18} />
        </button>
        <button aria-label="화면에 맞추기" disabled={!zoomed} onClick={reset} type="button">
          <Maximize size={16} />
          <span>{Math.round(scale * 100)}%</span>
        </button>
        <button aria-label="확대" disabled={scale >= MAX_SCALE} onClick={() => zoomAround(scale + STEP)} type="button">
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
