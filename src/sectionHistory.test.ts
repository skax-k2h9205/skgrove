import { describe, expect, it } from 'vitest';
import {
  isSection,
  newLoginKey,
  sectionFromHistoryState,
  sectionHistoryState,
  shouldPushSection,
} from './sectionHistory';

/*
  뒤로가기는 눈으로 확인하기 번거로운 기능이라(히스토리를 쌓고 눌러봐야 한다)
  판단 부분만 떼어 여기서 고정한다. App.tsx 는 이 판단에 pushState 를 붙이기만 한다.
*/

const KEY = 'login-1';

describe('sectionHistoryState / sectionFromHistoryState — 왕복', () => {
  it('넣은 화면을 그대로 꺼낸다', () => {
    expect(sectionFromHistoryState(sectionHistoryState('gatherings', KEY), KEY)).toBe('gatherings');
  });

  it('우리가 쌓지 않은 항목은 null — 화면을 건드리지 않는다', () => {
    expect(sectionFromHistoryState(null, KEY)).toBeNull();
    expect(sectionFromHistoryState(undefined, KEY)).toBeNull();
    expect(sectionFromHistoryState({}, KEY)).toBeNull();
    // Supabase 리다이렉트 등 남의 state 와 같은 항목에 섞여 있어도 우리 키만 본다.
    expect(sectionFromHistoryState({ usr: 1, someLib: 'x' }, KEY)).toBeNull();
  });

  it('같은 항목에 남의 값이 섞여 있어도 우리 키를 읽는다', () => {
    expect(sectionFromHistoryState({ ...sectionHistoryState('metrics', KEY), someLib: 'x' }, KEY)).toBe('metrics');
  });

  it('없는 화면 이름은 받지 않는다 — 옛 배포가 남긴 항목으로 빈 화면이 뜨면 안 된다', () => {
    expect(sectionFromHistoryState({ skgroveSection: 'bamboo', skgroveLogin: KEY }, KEY)).toBeNull();
    expect(sectionFromHistoryState({ skgroveSection: 42, skgroveLogin: KEY }, KEY)).toBeNull();
    expect(sectionFromHistoryState({ skgroveSection: '', skgroveLogin: KEY }, KEY)).toBeNull();
  });
});

describe('로그인 표식 — 앞사람이 남긴 항목은 무시한다', () => {
  it('다른 로그인에서 쌓은 항목은 null', () => {
    const before = sectionHistoryState('accounts', 'login-앞사람');
    expect(sectionFromHistoryState(before, 'login-뒷사람')).toBeNull();
  });

  it('표식이 없는 옛 항목(이 기능 배포 전에 쌓인 것)도 null', () => {
    expect(sectionFromHistoryState({ skgroveSection: 'accounts' }, KEY)).toBeNull();
  });

  it('newLoginKey 는 매번 다른 값을 준다', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newLoginKey()));
    expect(keys.size).toBe(50);
  });
});

describe('isSection', () => {
  it.each(['dashboard', 'seating', 'market', 'platform'])('%s 는 화면이다', (id) => {
    expect(isSection(id)).toBe(true);
  });

  it.each([null, undefined, 42, {}, 'toString', 'constructor', '없는화면'])('%s 는 아니다', (value) => {
    expect(isSection(value)).toBe(false);
  });
});

describe('shouldPushSection — 같은 화면이면 쌓지 않는다', () => {
  it('화면이 바뀌면 쌓는다', () => {
    expect(shouldPushSection('dashboard', 'intake')).toBe(true);
  });

  it('같은 메뉴를 다시 누르면 쌓지 않는다 — 뒤로가기를 여러 번 눌러야 하는 걸 막는다', () => {
    expect(shouldPushSection('intake', 'intake')).toBe(false);
  });
});
