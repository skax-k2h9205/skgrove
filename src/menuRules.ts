import { navGroups, type NavGroup } from './navigation';
import type { Section } from './types';

/*
  메뉴 숨김 규칙. 커넥셔너가 시스템 관리에서 팀 전체의 메뉴를 켜고 끈다.
  화면(사이드바·하단 탭·헤더 단추·홈 피드)과 진입 판정(App.resolveSection)이 모두
  이 한 곳을 본다 — 숨긴 메뉴가 사이드바에서만 빠지고 주소로는 열리면 숨긴 게 아니다.

  숨김은 '안 보이게'일 뿐이다. 데이터는 그대로 두고, 다시 켜면 그대로 돌아온다.
  역할로 막는 메뉴(리더 관리함·계정 관리 등)는 이 규칙과 별개로 계속 역할을 탄다.
*/

/*
  숨길 수 없는 메뉴.
  - 홈: 숨긴 메뉴로 들어오려는 사람을 돌려보낼 곳이 있어야 한다.
  - 시스템 관리: 이걸 숨기면 다시 켤 화면이 사라진다.
  - 플랫폼 관리: 팀(테넌트) 설정이 아니라 플랫폼 오너의 화면이다.
*/
const ALWAYS_VISIBLE: Section[] = ['dashboard', 'system', 'platform'];

/** 숨길 수 있는 메뉴 — 사이드바에 실제로 올라가는 것 중 ALWAYS_VISIBLE 을 뺀 전부. */
export const HIDEABLE_SECTIONS: Section[] = navGroups
  .flatMap((group) => group.items.map((item) => item.id))
  .filter((id) => !ALWAYS_VISIBLE.includes(id));

/*
  메뉴에는 없지만 다른 메뉴를 거쳐서만 들어가는 화면. 부모가 숨겨지면 같이 막는다.
  자리배치는 모임 상세의 버튼이 유일한 입구다.
*/
const PARENT_MENU: Partial<Record<Section, Section>> = { seating: 'gatherings' };

export function canHideMenu(section: Section) {
  return HIDEABLE_SECTIONS.includes(section);
}

/*
  저장된 값을 믿지 않고 다듬는다. 공용 설정(app_config)은 누구 브라우저에서든 올 수 있고,
  메뉴가 없어지거나 이름이 바뀐 뒤의 옛 값이 남아 있을 수 있다. 숨길 수 없는 메뉴와
  모르는 값은 버리고, 순서는 메뉴 순서로 고정한다(같은 설정이면 항상 같은 배열).
*/
export function normalizeHiddenMenus(value: unknown): Section[] {
  if (!Array.isArray(value)) return [];
  return HIDEABLE_SECTIONS.filter((id) => value.includes(id));
}

/** 이 메뉴가 숨겨졌는가. 숨길 수 없는 메뉴는 목록에 들어 있어도 false. */
export function isMenuHidden(section: Section, hidden: Section[]) {
  return canHideMenu(section) && hidden.includes(section);
}

/** 이 화면으로 들어갈 수 없는가 — 자기가 숨겨졌거나, 입구가 되는 부모 메뉴가 숨겨졌다. */
export function isSectionBlocked(section: Section, hidden: Section[]) {
  if (isMenuHidden(section, hidden)) return true;
  const parent = PARENT_MENU[section];
  return parent ? isMenuHidden(parent, hidden) : false;
}

/** 한 메뉴를 숨기거나 다시 보이게 한 새 목록. 숨길 수 없는 메뉴는 무시한다. */
export function setMenuHidden(hidden: Section[], section: Section, hide: boolean): Section[] {
  if (!canHideMenu(section)) return normalizeHiddenMenus(hidden);
  const next = hide ? [...hidden, section] : hidden.filter((id) => id !== section);
  return normalizeHiddenMenus(next);
}

/*
  사이드바에 그릴 그룹. 역할 판정(canSee)과 숨김을 함께 거르고, 항목이 다 빠진 그룹은
  제목만 남지 않게 통째로 뺀다.
*/
export function visibleNavGroups(
  hidden: Section[],
  canSee: (section: Section) => boolean,
  groups: NavGroup[] = navGroups,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSee(item.id) && !isMenuHidden(item.id, hidden)),
    }))
    .filter((group) => group.items.length > 0);
}
