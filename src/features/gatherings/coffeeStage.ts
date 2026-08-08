/*
  커피뽑기의 3D 무대.

  조뽑기(buildTeamStage)와 형제지만 결이 다르다. 조뽑기는 '내 이름이 섞이는' 긴장이고,
  커피뽑기는 '내 얼굴이 섞이다 누구 하나에 걸리는' 순간이다. 그래서 조각은 이름 타일이
  아니라 **프로필 사진 원반**이고, 끝은 조별 정렬이 아니라 **당첨자 한 명의 클로즈업**이다.

  핵심은 "천천히 멈춰 걸린다": 즉시 정지가 아니라, 빠르게 돌던 궤도가 easeOutCubic 으로
  풀리며 당첨 원반이 중앙으로 미끄러져 커진다. 나머지는 뒤로 물러나 흐려진다.
  당첨자는 애니메이션 전에 이미 확정돼 있다(state.winner) — 무대는 결정하지 않고 보여준다.
*/
import * as THREE from 'three';
import { easeOutBack, easeOutCubic, type DrawStageHandle, type StageContext } from '../connect/drawScene';
import { makeAvatarTexture, type AvatarFace } from './avatarTexture';

export type CoffeeMember = AvatarFace;

/** 무대가 매 프레임 읽는 살아 있는 상태. 값이 바뀌어도 씬을 다시 만들지 않는다. */
export type CoffeeState = {
  phase: 'idle' | 'rolling' | 'landing';
  /** 현재 단계가 시작된 시각(초, 마운트 기준). 감속 곡선의 기준점. */
  startedAt: number;
  /** 당첨자 이름. landing 에서 이 원반이 중앙으로 온다. */
  winner?: string;
};

const DISC_R = 0.62; // 원반 반지름
const LAND_S = 2.6; // 감속에 쓰는 시간(초). 이 곡선이 '천천히 멈춤'의 전부다.
const ROLL_CHURN = 2.6; // 섞이는 속도
const SPREAD = new THREE.Vector3(2.7, 1.35, 1.35); // 궤도 반경(x,y,z)

/** 원반 i 가 시각 e 에 있는 궤도 위치. 순수 함수라 landing 의 출발점도 이걸로 되짚는다. */
function orbitAt(out: THREE.Vector3, e: number, seed: number): THREE.Vector3 {
  const t = e * ROLL_CHURN;
  return out.set(
    Math.sin(t * 0.7 + seed) * SPREAD.x,
    Math.sin(t * 0.9 + seed * 1.7) * SPREAD.y,
    Math.cos(t * 0.6 + seed) * SPREAD.z,
  );
}

function makeDisc(ctx: StageContext, face: CoffeeMember) {
  const texture = ctx.track(makeAvatarTexture(face));
  const geometry = ctx.track(new THREE.CircleGeometry(DISC_R, 48));
  const material = ctx.track(
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
  );
  return new THREE.Mesh(geometry, material);
}

/**
 * 커피뽑기 무대. 프로필 원반들이 떠 섞이다(rolling) 감속하며 당첨자가 중앙으로 온다(landing).
 */
export function buildCoffeeStage(
  ctx: StageContext,
  state: () => CoffeeState,
  members: CoffeeMember[],
): DrawStageHandle {
  const group = new THREE.Group();
  ctx.scene.add(group);

  const discs = members.map((member, index) => {
    const disc = makeDisc(ctx, member);
    const seed = (index * 2.399963) % (Math.PI * 2);
    // 나머지가 물러날 뒤쪽 링에서의 각도. 겹치지 않게 골고루 벌린다.
    const ringAngle = (index / Math.max(members.length, 1)) * Math.PI * 2;
    Object.assign(disc.userData, { seed, name: member.name, ringAngle });
    group.add(disc);
    return disc;
  });

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const material = (disc: THREE.Mesh) => disc.material as THREE.MeshBasicMaterial;

  return {
    // 스토리 뷰어의 납작한 프레임에서도 궤도가 안 잘리게 여유를 둔다.
    fit: { radius: 3.4, elevation: 0.04, focusY: 0 },
    update(elapsed) {
      const s = state();
      const rolling = s.phase === 'rolling' || s.phase === 'idle';
      const since = Math.max(0, elapsed - s.startedAt);
      const settle = s.phase === 'landing' ? easeOutCubic(Math.min(since / LAND_S, 1)) : 0;
      const pop = s.phase === 'landing' ? easeOutBack(Math.min(since / LAND_S, 1)) : 0;

      // 섞이는 동안엔 무리가 천천히 흔들린다. 자리를 잡으면 정면으로 선다.
      group.rotation.y = Math.sin(elapsed * 0.3) * 0.18 * (1 - settle);

      discs.forEach((disc) => {
        const { seed, name, ringAngle } = disc.userData as {
          seed: number;
          name: string;
          ringAngle: number;
        };
        const won = name === s.winner;

        if (rolling) {
          disc.position.copy(orbitAt(to, elapsed, seed));
          disc.scale.setScalar(1);
          material(disc).opacity = 1;
        } else {
          // 감속: landing 이 시작된 순간의 궤도 위치에서 최종 자리로 미끄러진다.
          orbitAt(from, s.startedAt, seed);
          if (won) {
            to.set(0, 0, 1.3); // 중앙·앞으로
          } else {
            // 나머지는 뒤쪽 링으로 물러난다.
            to.set(Math.cos(ringAngle) * 2.9, Math.sin(ringAngle) * 1.5, -1.4);
          }
          disc.position.lerpVectors(from, to, settle);

          const grow = won ? 1 + pop * 0.9 : 1 - settle * 0.5;
          disc.scale.setScalar(Math.max(grow, 0.2));
          material(disc).opacity = won ? 1 : 1 - settle * 0.72;
        }

        // 빌보드: 원반이 늘 카메라를 향해 사진이 정면으로 보인다.
        disc.quaternion.copy(ctx.camera.quaternion);
      });
    },
    dispose() {
      ctx.scene.remove(group);
    },
  };
}
