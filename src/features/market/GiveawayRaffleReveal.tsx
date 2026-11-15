import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import type { MarketItem } from '../../types';

/*
  추첨 나눔 결과 연출 — 화면을 통째로 덮는 무대.

  당첨자는 이 컴포넌트가 정하지 않는다. 보드가 marketRules.raffleWinner 로 '이미 정해진' 한 명을
  넘겨준다. 그래서 몇 번을 다시 틀어도 같은 사람이 나온다 — 연출은 순수 표시용이다.

  장면은 둘이고 순서대로 흐른다(참고 데모의 'shuffle' 호흡).
    shuffle  신청자 이름이 번쩍이며 빠르게 지나간다. 점점 느려지다(감속) 당첨자에서 멈춘다.
             "지금 뽑힌다"는 긴장 — 이게 없으면 결과를 조회하는 느낌이 된다.
    done     당첨자의 프로필 사진 + 이름이 크게 서고 색종이가 터진다. 여기부터 '결과'다.

  prefers-reduced-motion 이면 shuffle 을 건너뛰고 바로 결과(done)에서 시작한다.
  연출을 못 보는 사람도 당첨자는 봐야 한다 — 연출은 덤이고 공개가 본체다.

  색종이는 Canvas 2D 로 그린다(랜덤박스 무대와 같은 이유 — 조각 수백 개를 DOM 으로 두면 끊긴다).
  소리는 없다 — 사무실이고, 무대 스피커는 운영자가 따로 튼다.
*/

type Phase = 'shuffle' | 'done';

// 셔플 총 길이(ms). 합쳐서 약 4.8초 — 랜덤박스 무대(약 5초)와 호흡을 맞춘다.
const SHUFFLE_MS = 4800;
// 한 이름이 머무는 시간. 처음엔 빠르게(60ms) 번쩍이다 끝에선 느리게(420ms) — 감속의 핵심.
const MIN_STEP = 60;
const MAX_STEP = 420;

const CONFETTI_COLORS = ['#ff4d6d', '#ffb703', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#ffffff'];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  flutter: number;
};

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function makeParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 9 + Math.random() * 13;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      flutter: Math.random() * Math.PI * 2,
    };
  });
}

type GiveawayRaffleRevealProps = {
  item: MarketItem;
  /** 신청자 이름들(1인 1표로 추린 것). 셔플에 번갈아 띄운다. */
  entrants: string[];
  /** 당첨자 이름. 규칙(raffleWinner)이 이미 정한 값. 없으면(유찰) 연출을 띄우지 않는 게 맞지만 방어적으로 처리. */
  winner?: string;
  onClose: () => void;
};

export function GiveawayRaffleReveal({ item, entrants, winner, onClose }: GiveawayRaffleRevealProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(reduced || !winner ? 'done' : 'shuffle');
  // 셔플 중 지금 번쩍이는 이름. 당첨자 공개 전까지는 신청자 이름들이 지나간다.
  const [flashName, setFlashName] = useState<string>(entrants[0] ?? winner ?? '');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const burstRef = useRef(false);
  const frameRef = useRef(0);

  const done = phase === 'done';

  /*
    셔플. 이름을 번갈아 띄우되 머무는 시간을 점점 늘려(감속) 당첨자에서 멈춘다.
    setInterval 이 아니라 setTimeout 재귀로 매번 간격을 키운다 — ease-out 곡선으로 늘려야
    "빠르게 돌다 스르르 멎는" 느낌이 난다. 경과 비율(progress)의 제곱이 간격을 정한다.
  */
  useEffect(() => {
    if (reduced || !winner || entrants.length === 0) return undefined;
    const start = performance.now();
    let index = Math.floor(Math.random() * entrants.length);
    let timer = 0;

    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / SHUFFLE_MS);
      if (progress >= 1) {
        setFlashName(winner); // 반드시 당첨자에서 멈춘다
        setPhase('done');
        return;
      }
      index = (index + 1) % entrants.length;
      setFlashName(entrants[index]);
      // ease-out: 끝으로 갈수록 간격이 MAX_STEP 에 가까워진다.
      const step = MIN_STEP + (MAX_STEP - MIN_STEP) * (progress * progress);
      timer = window.setTimeout(tick, step);
    };
    timer = window.setTimeout(tick, MIN_STEP);
    return () => window.clearTimeout(timer);
  }, [reduced, winner, entrants]);

  // Esc 로 닫기 + 뒤 화면 스크롤 잠금(랜덤박스 무대와 같은 처리).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // 결과가 나오면 닫기 단추에, 셔플 중엔 건너뛰기 단추에 초점(키보드만 쓰는 사람의 탈출구).
  useEffect(() => {
    if (done) closeRef.current?.focus();
    else skipRef.current?.focus();
  }, [done]);

  // 색종이 — 결과(done)에 들어서면 한 번만 터뜨리고 다 떨어질 때까지 그린다. 움직임 줄이기면 안 터뜨린다.
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);
  useEffect(() => {
    if (reduced || !done || burstRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    burstRef.current = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const particles = makeParticles(width / 2, height * 0.42, 180);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 16.67;
      last = now;
      ctx.clearRect(0, 0, width, height);
      let alive = false;
      for (const p of particles) {
        p.vy += 0.38 * dt;
        p.vx *= 0.985;
        p.vy *= 0.995;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flutter += 0.12 * dt;
        if (p.y < height + 30) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(p.flutter))));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [done, reduced]);

  const skip = () => {
    if (winner) setFlashName(winner);
    setPhase('done');
  };

  return (
    <div aria-label="추첨 결과" aria-modal="true" className={`gr-stage phase-${phase}`} role="dialog">
      <div aria-hidden className="gr-dim" />
      <canvas aria-hidden className="gr-confetti" ref={canvasRef} />

      <div className="gr-inner">
        <p className="gr-kicker">🎁 {item.title} · 나눔 추첨</p>

        {done && winner ? (
          <div className="gr-winner">
            <span aria-hidden className="gr-crown">🎉</span>
            <Avatar className="gr-face" name={winner} />
            <p className="gr-winner-name">{winner}</p>
            <p className="gr-winner-sub">축하합니다 · {winner}님이 받아요</p>
          </div>
        ) : done ? (
          // 방어적 — 당첨자가 없으면(유찰) 결과만 담백하게.
          <div className="gr-winner">
            <p className="gr-winner-name">아직 당첨자가 없어요</p>
            <p className="gr-winner-sub">신청한 분이 없거나 아직 마감 전이에요.</p>
          </div>
        ) : (
          <div aria-hidden className="gr-shuffle">
            <p className="gr-drum-text">두구두구두구…</p>
            <p className="gr-shuffle-name">{flashName}</p>
            <p className="gr-shuffle-count">신청 {entrants.length}명 중 한 분</p>
          </div>
        )}
      </div>

      {done ? (
        <button aria-label="닫기" className="gr-close" onClick={onClose} ref={closeRef} type="button">
          <X size={20} />
        </button>
      ) : (
        <button className="gr-skip" onClick={skip} ref={skipRef} type="button">
          건너뛰기
        </button>
      )}
    </div>
  );
}
