import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import type { MarketItem } from '../../types';
import { ItemPoster } from './ItemPoster';

/*
  랜덤박스 열기 연출 — 화면을 통째로 덮는 무대.

  장면은 넷이고 순서대로 흐른다(참고 영상의 호흡을 그대로 옮겼다).
    shake  상자가 흔들린다. "지금 열린다"는 예고 — 이게 없으면 결과를 조회하는 느낌이 된다.
    open   뚜껑이 튀어 오르고 색종이가 터진다.
    drum   상자 안에서 북 카드가 솟고, 북채 둘이 번갈아 친다(두구두구). 결과 직전의 뜸.
           이때 낙찰자가 상자 옆에서 춤춘다 — 뽑기 무대의 춤추는 고양이 영상 자리에,
           외부 에셋 대신 낙찰자의 프로필 사진을 얼굴로 쓴 CSS 인형을 세운다.
           낙찰자는 한 명이라 인형도 하나다. 왕관을 쓰고 팔을 흔들며 발을 구른다.
    lights 번쩍하며 북이 사라지고, 무지개 조명 아래 내용물 카드가 가운데서 튀어나온다. 여기부터 '결과'다.

  색종이는 Canvas 2D 로 그린다. 조각 180개를 DOM 으로 두면 저사양 폰에서 끊기고,
  three 를 끌어오기엔 장면 하나가 너무 가볍다(뽑기 무대와 달리 입체 카메라가 필요 없다).
  소리는 없다 — 사무실이고, 무대 스피커는 운영자가 따로 튼다.

  prefers-reduced-motion 이면 장면을 건너뛰고 바로 결과(lights)에서 시작한다.
  연출을 못 보는 사람도 내용물은 봐야 한다 — 연출은 덤이고 공개가 본체다.

  열렸는지의 '기록'(revealedAt)은 여기서 하지 않는다. 보드가 버튼을 누른 순간 저장하고
  이 무대를 띄운다. 그래야 연출 도중 창을 닫아도 열린 사실은 남는다.
*/

type Phase = 'shake' | 'open' | 'drum' | 'lights';

// 장면 전환 시각(ms). 합쳐서 약 5초 — 영상(약 7초)보다 조금 빠르다.
// 무대에서 여러 상자를 연달아 열면 7초씩은 길다. 두구두구는 2.8초면 충분히 조마조마하다.
const OPEN_AT = 1300;
const DRUM_AT = 2000;
const LIGHTS_AT = 4800;

// 색종이 색. 영상의 조명 빔과 같은 계열로 맞춘다.
const CONFETTI_COLORS = ['#ff4d6d', '#ffb703', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#ffffff'];
const BEAM_COLORS = ['#ff4d6d', '#ffb703', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];

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
  /** 0~1. 펄럭임 위상 — cos 로 세로 폭을 줄였다 늘렸다 해 종이가 뒤집히는 느낌을 낸다. */
  flutter: number;
};

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function makeParticles(x: number, y: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    // 위쪽 부채꼴로 터진다. 좌우는 넓게, 위로는 세게.
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

type RandomBoxRevealProps = {
  item: MarketItem;
  /** 낙찰자 이름(한 명). 얼굴이 되는 사진은 Avatar 가 ProfilesContext 에서 찾는다. 없으면 인형도 없다. */
  winner?: string;
  onClose: () => void;
};

export function RandomBoxReveal({ item, winner, onClose }: RandomBoxRevealProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(reduced ? 'lights' : 'shake');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const burstRef = useRef(false);

  const done = phase === 'lights';

  // 장면 타이머. 건너뛰기를 누르면 타이머를 걷고 바로 결과로 간다.
  useEffect(() => {
    if (reduced) return undefined;
    const timers = [
      window.setTimeout(() => setPhase('open'), OPEN_AT),
      window.setTimeout(() => setPhase('drum'), DRUM_AT),
      window.setTimeout(() => setPhase('lights'), LIGHTS_AT),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduced]);

  // Esc 로 닫기 + 뒤 화면 스크롤 잠금(PhotoViewer 와 같은 처리).
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

  // 결과가 나오면 닫기 단추에 초점 — 키보드만 쓰는 사람이 빠져나갈 길.
  useEffect(() => {
    if (done) closeRef.current?.focus();
  }, [done]);

  /*
    색종이. 뚜껑이 열리는 순간(open) 한 번만 터뜨리고, 다 떨어질 때까지 그린다.
    건너뛰기로 open 을 지나쳐도 터진다 — 결과 화면에 색종이가 없으면 밋밋하다.
    움직임 줄이기면 터뜨리지 않는다.

    루프는 장면(phase)과 묶지 않는다. phase 가 바뀔 때마다 effect 가 정리·재실행되는데,
    그때 rAF 를 취소하면 색종이가 공중에서 멈춘다(실제로 그랬다). 시작만 phase 로 트리거하고
    프레임 핸들은 ref 에 들고 있다가 무대가 내려갈 때 한 번만 걷는다.
  */
  const frameRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    if (reduced || phase === 'shake' || burstRef.current) return;
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

    // 상자 위치(.rb-box 의 CSS 와 맞춘다: 가로 중앙, 세로 58%)에서 터진다.
    const particles = makeParticles(width / 2, height * 0.58, 180);
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 16.67; // 60fps 기준 배수. 탭 전환 뒤 폭주 방지
      last = now;
      ctx.clearRect(0, 0, width, height);
      let alive = false;
      for (const p of particles) {
        p.vy += 0.38 * dt; // 중력
        p.vx *= 0.985; // 공기 저항
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
  }, [phase, reduced]);

  const skip = () => setPhase('lights');

  return (
    <div aria-label="랜덤박스 열기" aria-modal="true" className={`rb-stage phase-${phase}`} role="dialog">
      <div aria-hidden className="rb-stars" />

      {/* 조명 빔 — lights 부터. 각자 다른 각도·색으로 좌우로 흔들린다. */}
      <div aria-hidden className="rb-beams">
        {BEAM_COLORS.map((color, index) => (
          <span
            className="rb-beam"
            key={color}
            style={{ '--beam-color': color, '--beam-index': index } as React.CSSProperties}
          />
        ))}
      </div>

      <canvas aria-hidden className="rb-confetti" ref={canvasRef} />

      {/* 선물상자. 몸통 + 뚜껑, 리본은 CSS 가 그린다. */}
      <div aria-hidden className="rb-box">
        <div className="rb-flash" />
        <div className="rb-lid">
          <span className="rb-bow" />
        </div>
        <div className="rb-body" />
      </div>

      {/* 낙찰자 인형 — 북이 울리면 상자 옆에서 춤춘다. 얼굴은 프로필 사진(없으면 이니셜 칩). */}
      {winner && (
        <div aria-hidden className="rb-dancer">
          <span className="rb-crown">👑</span>
          <div className="rb-dancer-head">
            <Avatar className="rb-dancer-face" name={winner} />
          </div>
          <div className="rb-dancer-body">
            <span className="rb-arm left" />
            <span className="rb-arm right" />
            <span className="rb-torso" />
            <span className="rb-leg left" />
            <span className="rb-leg right" />
          </div>
          <span className="rb-dancer-name">낙찰 · {winner}</span>
        </div>
      )}

      {/* 북 카드 — 상자에서 솟아 두구두구. 결과가 나오면 번쩍이며 사라진다. 장식이라 읽어 주지 않는다. */}
      <div aria-hidden className="rb-drum-card">
        <div className="rb-snare">
          <span className="rb-stick left" />
          <span className="rb-stick right" />
          <span className="rb-snare-body" />
          <span className="rb-snare-top" />
        </div>
        <p className="rb-drum-text">두구두구두구…</p>
      </div>

      {/* 결과 직전의 번쩍임 — 화면 전체. 북에서 결과로 넘어가는 경계를 눈이 놓치지 않게. */}
      <div aria-hidden className="rb-flash-big" />

      {/*
        내용물 카드 — 번쩍임 뒤 상자에서 솟아오르며 세로축으로 세 바퀴 돌고 정면으로 멈춘다
        (참고 영상의 공개 장면). 뒷면은 금색 '🎁' 라 돌아가는 동안 뭔지 읽히지 않는다.
        결과 장면에서만 읽힌다.
      */}
      <div className="rb-card-spin" aria-hidden={!done}>
        <div className="rb-card">
          <p className="rb-card-kicker">🎁 {item.seller}님의 랜덤박스 속에는…</p>
          <div className="rb-card-poster">
            <ItemPoster forceReveal item={item} />
          </div>
          <h2 className="rb-card-title">{item.title}</h2>
          {item.desc && <p className="rb-card-desc">{item.desc}</p>}
        </div>
        <div aria-hidden className="rb-card-back">🎁</div>
      </div>

      {done ? (
        <button aria-label="닫기" className="rb-close" onClick={onClose} ref={closeRef} type="button">
          <X size={20} />
        </button>
      ) : (
        <button className="rb-skip" onClick={skip} type="button">
          건너뛰기
        </button>
      )}
    </div>
  );
}
