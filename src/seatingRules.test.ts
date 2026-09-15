import { describe, expect, it } from 'vitest';
import { LAYOUTS, arrange, buildLines, conflicts, quotasFor, totalSeats, unavoidable, type Seatable } from './seatingRules';

const person = (name: string, part: string, sex = '', age = ''): Seatable => ({ name, part, sex, age });

// 파트만 세 갈래로 고른 명단 — 겹침 0건이 가능한 구성.
const balanced = (n: number) =>
  Array.from({ length: n }, (_, i) => person(`P${i}`, ['가', '나', '다'][i % 3]));

describe('quotasFor — 줄별 정원', () => {
  it('2열은 인원을 반씩 나눈다', () => {
    expect(quotasFor(buildLines('2열'), 28)).toEqual([14, 14]);
  });

  it('홀수는 한 명 차이까지만 벌어진다', () => {
    expect(quotasFor(buildLines('2열'), 27)).toEqual([14, 13]);
  });

  it('좌석을 다 채우면 정원이 곧 좌석 수다', () => {
    expect(quotasFor(buildLines('2열'), 32)).toEqual([16, 16]);
  });

  it('좌석보다 많으면 좌석 수를 넘지 않는다', () => {
    expect(quotasFor(buildLines('2열'), 40)).toEqual([16, 16]);
  });

  it('1열은 나눌 줄이 없다', () => {
    expect(quotasFor(buildLines('1열'), 27)).toEqual([27]);
  });
});

describe('arrange — 배치', () => {
  it('참석자를 모두 앉힌다', () => {
    const people = balanced(28);
    const lines = arrange(people, '2열');
    const seated = lines.flatMap((l) => [...l.A, ...l.B]).filter(Boolean);
    expect(seated).toHaveLength(28);
    expect(new Set(seated.map((p) => p!.name)).size).toBe(28);
  });

  it('2열이면 줄마다 고르게 앉는다', () => {
    const lines = arrange(balanced(27), '2열');
    const perLine = lines.map((l) => [...l.A, ...l.B].filter(Boolean).length);
    expect(perLine).toEqual([14, 13]);
  });

  it('값이 고르면 옆자리·맞은편 겹침이 0건이다', () => {
    const lines = arrange(balanced(27), '1열');
    expect(conflicts(lines).part).toBe(0);
  });

  it('좌석보다 인원이 많으면 좌석 수만큼만 앉는다', () => {
    const lines = arrange(balanced(40), '1열');
    const seated = lines.flatMap((l) => [...l.A, ...l.B]).filter(Boolean);
    expect(seated).toHaveLength(totalSeats(lines));
  });

  it('미입력(빈 문자열)은 서로 겹침으로 세지 않는다', () => {
    const people = Array.from({ length: 10 }, (_, i) => person(`P${i}`, '가'));
    const lines = arrange(people, '1열');
    // 파트는 전부 같으니 겹치지만, 성별·연령대는 전부 빈 값이라 0건이어야 한다.
    const got = conflicts(lines);
    expect(got.part).toBeGreaterThan(0);
    expect(got.sex).toBe(0);
    expect(got.age).toBe(0);
  });
});

describe('conflicts — 줄 경계', () => {
  it('다른 줄끼리는 이웃으로 세지 않는다', () => {
    const lines = buildLines('2열');
    // 1번째 줄 마지막 자리와 2번째 줄 첫 자리에 같은 파트를 둔다.
    lines[0].A[7] = person('끝', '같은파트');
    lines[1].A[0] = person('첫', '같은파트');
    expect(conflicts(lines).part).toBe(0);
  });

  it('같은 줄에서 옆자리가 같으면 센다', () => {
    const lines = buildLines('1열');
    lines[0].A[3] = person('왼', '같은파트');
    lines[0].A[4] = person('오', '같은파트');
    expect(conflicts(lines).part).toBe(1);
  });

  it('맞은편이 같으면 센다', () => {
    const lines = buildLines('1열');
    lines[0].A[3] = person('위', '같은파트');
    lines[0].B[3] = person('아래', '같은파트');
    expect(conflicts(lines).part).toBe(1);
  });
});

describe('unavoidable — 0건이 불가능한 구성', () => {
  it('한쪽이 과반이면 불가피하다', () => {
    const people = [
      ...Array.from({ length: 19 }, (_, i) => person(`남${i}`, '가', '남')),
      ...Array.from({ length: 8 }, (_, i) => person(`여${i}`, '가', '여')),
    ];
    expect(unavoidable(people, 'sex')).toBe(true);
  });

  it('고르게 나뉘면 불가피하지 않다', () => {
    expect(unavoidable(balanced(27), 'part')).toBe(false);
  });

  it('아무도 입력하지 않았으면 판단하지 않는다', () => {
    expect(unavoidable(balanced(27), 'sex')).toBe(false);
  });
});

describe('LAYOUTS', () => {
  it('두 구성 모두 32석이다', () => {
    expect(totalSeats(buildLines('1열'))).toBe(32);
    expect(totalSeats(buildLines('2열'))).toBe(32);
  });

  it('1열은 한 줄, 2열은 두 줄이다', () => {
    expect(LAYOUTS['1열'].lines).toHaveLength(1);
    expect(LAYOUTS['2열'].lines).toHaveLength(2);
  });
});
