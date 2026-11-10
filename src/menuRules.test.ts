import { describe, expect, it } from 'vitest';
import {
  HIDEABLE_SECTIONS,
  canHideMenu,
  isMenuHidden,
  isSectionBlocked,
  normalizeHiddenMenus,
  setMenuHidden,
  visibleNavGroups,
} from './menuRules';
import type { Section } from './types';

const everyone = () => true;

describe('메뉴 숨김', () => {
  it('홈·시스템 관리·플랫폼 관리는 숨길 수 없다 — 돌아갈 곳과 다시 켤 화면이 있어야 한다', () => {
    expect(canHideMenu('dashboard')).toBe(false);
    expect(canHideMenu('system')).toBe(false);
    expect(canHideMenu('platform')).toBe(false);
    expect(canHideMenu('market')).toBe(true);
    // 사이드바에 없는 화면(마이페이지·가이드·자리배치)은 숨김 대상이 아니다.
    expect(HIDEABLE_SECTIONS).not.toContain('mypage');
    expect(HIDEABLE_SECTIONS).not.toContain('guide');
    expect(HIDEABLE_SECTIONS).not.toContain('seating');
  });

  it('저장된 값은 다듬어 쓴다 — 모르는 값·숨길 수 없는 메뉴·중복을 버리고 메뉴 순서로 고정', () => {
    expect(normalizeHiddenMenus(null)).toEqual([]);
    expect(normalizeHiddenMenus('market')).toEqual([]);
    expect(normalizeHiddenMenus(['goldribbon', 'dashboard', 'system', '없는메뉴', 'market', 'market'])).toEqual([
      'market',
      'goldribbon',
    ]);
  });

  it('숨길 수 없는 메뉴는 목록에 들어 있어도 숨겨지지 않는다', () => {
    const hidden = ['dashboard', 'market'] as Section[];
    expect(isMenuHidden('dashboard', hidden)).toBe(false);
    expect(isMenuHidden('market', hidden)).toBe(true);
    expect(isMenuHidden('humor', hidden)).toBe(false);
  });

  it('부모 메뉴가 숨겨지면 그 메뉴를 거쳐서만 가는 화면도 막힌다', () => {
    expect(isSectionBlocked('seating', ['gatherings'])).toBe(true);
    expect(isSectionBlocked('seating', ['market'])).toBe(false);
    expect(isSectionBlocked('market', ['market'])).toBe(true);
    expect(isSectionBlocked('mypage', ['market'])).toBe(false);
  });

  it('켜고 끄기 — 숨기면 들어가고, 다시 켜면 빠지고, 숨길 수 없는 메뉴는 무시한다', () => {
    expect(setMenuHidden([], 'market', true)).toEqual(['market']);
    expect(setMenuHidden(['market'], 'market', true)).toEqual(['market']);
    expect(setMenuHidden(['market', 'humor'], 'market', false)).toEqual(['humor']);
    expect(setMenuHidden(['market'], 'system', true)).toEqual(['market']);
  });

  it('사이드바 그룹은 역할과 숨김을 함께 거르고, 다 빠진 그룹은 통째로 사라진다', () => {
    const all = visibleNavGroups([], everyone);
    expect(all.map((group) => group.title)).toContain('커넥셔너');

    // 커넥셔너 그룹의 유일한 항목(조뽑기)을 숨기면 그룹 제목도 남지 않는다.
    const noConnect = visibleNavGroups(['connect'], everyone);
    expect(noConnect.map((group) => group.title)).not.toContain('커넥셔너');

    // 역할로 못 보는 메뉴는 숨김과 무관하게 빠진다.
    const member = visibleNavGroups([], (id) => id !== 'leader' && id !== 'accounts');
    const ids = member.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).not.toContain('leader');
    expect(ids).toContain('intake');

    const hiddenMarket = visibleNavGroups(['market'], everyone).flatMap((group) => group.items.map((item) => item.id));
    expect(hiddenMarket).not.toContain('market');
    expect(hiddenMarket).toContain('dashboard');
  });
});
