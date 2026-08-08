/*
  뽑기 연출의 3D 무대. React 밖에서 도는 살림살이(렌더러·씬·루프)를 여기 모은다.

  왜 컴포넌트 안에 두지 않는가:
  three 의 객체들은 GPU 자원을 잡고 있어서 반드시 손으로 반납해야 한다(dispose).
  리렌더마다 다시 만들면 렌더링 컨텍스트가 쌓이다 브라우저 한도(보통 16개)에 걸려
  화면이 통째로 사라진다. 만드는 곳과 버리는 곳을 한 파일에 붙여 두면 빠뜨리기 어렵다.
*/
import * as THREE from 'three';

/**
 * 무대가 차지하는 공간. 카메라를 여기에 맞춘다 — 무대가 카메라 자리를 직접 정하면
 * 프레임이 납작해졌을 때(스토리 뷰어는 폭만 정해져 있다) 조각이 화면 밖으로 잘린다.
 */
export type StageFit = {
  /** 원점 기준 이 반지름 안에 무대가 다 들어온다. */
  radius: number;
  /** 0~0.9. 클수록 위에서 내려다본다. */
  elevation?: number;
  /** 무대의 무게중심 높이. 카메라가 여기를 본다. */
  focusY?: number;
};

export type DrawStageHandle = {
  /** 매 프레임 호출된다. t 는 0~1 로 정규화한 진행도. */
  update: (elapsed: number) => void;
  dispose: () => void;
  fit?: StageFit;
};

export type StageContext = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** 이 씬이 만든 자원. 여기 담아 두면 정리할 때 한 번에 반납한다. */
  track: <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(item: T) => T;
};

/*
  이름 한 글자를 캔버스에 그려 텍스처로 쓴다.
  3D 안에 실제 이름이 보여야 "누가 뽑히는지" 가 읽힌다 — 익명의 도형이 도는 것과
  내 이름이 도는 것은 긴장의 크기가 다르다. 그게 이 연출을 바꾸는 이유였다.

  배경은 비워 두고 글자만 그린다. 배경색까지 구우면 그 색이 재질색과 곱해져,
  조뽑기에서 개인 색을 조 색으로 바꿀 때 두 색이 섞인 흙빛이 나온다.
  색은 조각이 갖고, 텍스처는 글자만 갖는다.
*/
export function makeLabelTexture(text: string) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(size * 0.44)}px Pretendard, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + size * 0.02);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 0에서 1로 가되 끝에서 부드럽게 멈춘다. 뽑기의 '감속' 은 전부 이 곡선에서 나온다. */
export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/** 살짝 넘어갔다 돌아온다. 당첨 카드가 튀어나올 때 쓴다. */
export function easeOutBack(t: number) {
  const c = 1.70158 + 1;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

/*
  무대를 프레임 안에 넣는다.

  시야각은 세로로만 정의돼 있어서, 프레임이 납작해지면(폭 348 · 높이 190 인 스토리
  뷰어가 그렇다) 세로가 먼저 모자란다. 반대로 좁고 긴 프레임에서는 가로가 모자란다.
  둘 중 좁은 쪽에 맞춰 물러나면 어느 비율에서도 잘리지 않는다.
*/
function frameCamera(camera: THREE.PerspectiveCamera, { radius, elevation = 0, focusY = 0 }: StageFit) {
  const vertical = (camera.fov * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2);

  const lift = Math.min(Math.max(elevation, 0), 0.9);
  camera.position.set(0, focusY + distance * lift, distance * Math.sqrt(1 - lift * lift));
  camera.lookAt(0, focusY, 0);
}

export type MountOptions = {
  canvas: HTMLCanvasElement;
  /** 씬을 채우는 부분. 무대마다 다른 것은 이 함수뿐이다. */
  build: (ctx: StageContext) => DrawStageHandle;
};

/**
 * 캔버스에 3D 무대를 올린다. 돌려주는 함수를 호출하면 자원까지 모두 반납한다.
 * WebGL 을 못 쓰는 환경에서는 null 을 돌려준다 — 호출부는 기존 CSS 연출로 떨어진다.
 */
export function mountDrawScene({ canvas, build }: MountOptions): (() => void) | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }

  // 레티나에서 계단 현상을 없애되 2배까지만 — 3배 화면에서 픽셀 수가 9배가 되면 저사양 기기가 버벅인다.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  /* 멀리 있는 조각을 배경색으로 녹인다. 스토리 뷰어 배경이 어두워 같은 색으로 두면
     '뒤쪽' 이 실제로 뒤로 물러나 보인다 — 깊이가 생기는 가장 싼 방법이다. */
  scene.fog = new THREE.Fog(0x14161a, 7, 16);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  /* 빛을 셋으로 나눈다. 하나만 쓰면 정면만 밝고 옆면이 새까매져 입체가 아니라
     오려 붙인 종이처럼 보인다. 채움광과 뒷광이 윤곽을 살린다. */
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 24;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.7);
  fill.position.set(-5, -1, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(0, 2, -6);
  scene.add(rim);

  const owned: Array<{ dispose: () => void }> = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(item: T) => {
    owned.push(item);
    return item;
  };

  const stage = build({ scene, camera, track });

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    if (stage.fit) frameCamera(camera, stage.fit);
    camera.updateProjectionMatrix();
  };
  resize();

  // 창 크기가 아니라 캔버스 자신의 크기를 본다. 스토리 뷰어가 접히거나 열 수가 바뀔 때도
  // 창 폭은 그대로라 resize 이벤트가 오지 않는다.
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const clock = new THREE.Clock();
  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    stage.update(clock.getElapsedTime());
    renderer.render(scene, camera);
  };
  loop();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    stage.dispose();
    owned.forEach((item) => item.dispose());
    renderer.dispose();
  };
}
