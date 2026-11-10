import { useState, type ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  Camera,
  HeartHandshake,
  LogOut,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { hasLeaderRole, isConnectioner, isPlatformOwner, isTeamLeader } from '../auth';
import { isMenuHidden, visibleNavGroups } from '../menuRules';
import { sections } from '../navigation';
import type { CurrentUser, Section } from '../types';
import { Avatar } from './Avatar';

/*
  예전에는 못 쓰는 메뉴를 흐리게 보여주고 자물쇠를 달았다. "앱에 뭐가 있는지
  알려준다"는 근거였는데, 이 앱에서는 홈 히어로의 '의견이 지나는 길
  (접수 → 리더 검토 → 익명 투표 → 액션)'이 이미 흐름을 보여준다.
  팀원에게 13개 중 2개가 매일 못 누르는 상태로 남는 건 순손실이라 감춘다.
*/
function canSee(
  id: Section,
  canUseLeaderMenu: boolean,
  canUseAccountsMenu: boolean,
  canUseConnectionerMenu: boolean,
  canUsePlatformMenu: boolean,
) {
  if (id === 'leader') return canUseLeaderMenu;
  if (id === 'accounts') return canUseAccountsMenu;
  // 조뽑기·시스템 관리 등 커넥셔너 도구는 커넥셔너로 지정된 사람에게만.
  if (id === 'connect') return canUseConnectionerMenu;
  if (id === 'system') return canUseConnectionerMenu;
  // 자리배치는 커넥셔너가 만들고 팀원은 확정된 것을 본다 — 메뉴는 모두에게 연다.
  // 플랫폼 관리는 플랫폼 오너(전 테넌트 관제)에게만.
  if (id === 'platform') return canUsePlatformMenu;
  return true;
}

/*
  사이드바 접기는 사람마다·기기마다 다른 취향이라 팀 공용 설정이 아니라 이 브라우저에만 둔다.
  (메뉴 숨김은 반대로 팀 전체 설정이다 — menuRules.)
*/
const COLLAPSE_KEY = 'skgrove:sidebarCollapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

type AppShellProps = {
  active: Section;
  /** 팀 전체에서 숨긴 메뉴. 사이드바·하단 탭과 헤더 단추에서 함께 빠진다. */
  hiddenMenus: Section[];
  children: ReactNode;
  currentUser: CurrentUser;
  currentPhotoUrl?: string;
  onSavePhoto: (photoUrl: string) => void;
  unreadCount: number;
  onLogout: () => void;
  onSectionChange: (section: Section) => void;
};

export function AppShell({
  active,
  hiddenMenus,
  children,
  currentUser,
  currentPhotoUrl,
  onSavePhoto,
  unreadCount,
  onLogout,
  onSectionChange,
}: AppShellProps) {
  const currentSection = sections.find((section) => section.id === active) ?? sections[0];
  // 리더 관리함은 실제 리더 역할(파트리더·팀리더)에게만. 커넥셔너 전권은 통과시키지 않는다.
  const userCanUseLeaderMenu = hasLeaderRole(currentUser);
  const userCanUseAccountsMenu = isTeamLeader(currentUser);
  // 조뽑기·시스템 관리는 커넥셔너(슈퍼관리자)에게만 노출.
  const userCanUseConnectionerMenu = isConnectioner(currentUser);
  // 플랫폼 관리는 플랫폼 오너에게만.
  const userCanUsePlatformMenu = isPlatformOwner(currentUser);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoInput, setPhotoInput] = useState('');

  // 사이드바 접기. 접으면 아이콘만 남는다(좁은 창에서 자동으로 되는 것과 같은 모양).
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // 저장이 안 돼도 이번 화면에서는 접힌다.
      }
      return next;
    });
  };

  const groups = visibleNavGroups(hiddenMenus, (id) =>
    canSee(id, userCanUseLeaderMenu, userCanUseAccountsMenu, userCanUseConnectionerMenu, userCanUsePlatformMenu),
  );

  const openPhotoEditor = () => {
    setPhotoInput(currentPhotoUrl ?? '');
    setPhotoOpen(true);
  };

  const savePhoto = () => {
    onSavePhoto(photoInput);
    setPhotoOpen(false);
  };

  return (
    <div className={collapsed ? 'app nav-collapsed' : 'app'}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <HeartHandshake size={24} />
          </div>
          <div className="brand-text">
            <strong>SKonnection</strong>
            <span>팀을 잇는 곳</span>
          </div>
          {/* 넓은 화면에서만 보인다. 좁으면 이미 아이콘 레일이고, 폰에서는 하단 탭이다(CSS). */}
          <button
            aria-expanded={!collapsed}
            aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            className="nav-collapse-toggle"
            onClick={toggleCollapsed}
            title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="nav">
          {/* 역할로 못 보는 메뉴와 팀에서 숨긴 메뉴를 함께 거른다. 다 빠진 그룹은 오지 않는다. */}
          {groups.map((group) => {
            const visible = group.items;
            return (
            <div className="nav-group" key={group.title}>
              <p className="nav-group-title">{group.title}</p>
              {visible.map((section) => {
                  const Icon = section.icon;
                return (
                  <button
                    className={active === section.id ? 'nav-item active' : 'nav-item'}
                    key={section.id}
                    onClick={() => onSectionChange(section.id)}
                    title={`${section.label} · ${section.owner}`}
                  >
                    <Icon size={18} />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{currentSection.label}</h1>
          </div>
          <div className="top-actions">
            <div className="user-chip">
              <button className="user-photo-button" onClick={openPhotoEditor} title="프로필 사진 변경" type="button">
                <Avatar name={currentUser.name} />
                <span className="user-photo-edit">
                  <Camera size={11} />
                </span>
              </button>
              {/*
                사이드바는 일을 하러 가는 곳이고(대나무숲·안건함·액션), 헤더 우측은
                나에 관한 것이다(내 사진·알림·로그아웃). 마이페이지는 후자에 속해
                메뉴가 아니라 이 칩이 입구가 된다. 사진 변경도 이미 여기 붙어 있다.
              */}
              <button
                className="user-chip-text"
                type="button"
                onClick={() => onSectionChange('mypage')}
                title="마이페이지"
              >
                <strong>{currentUser.name}</strong>
                <span>
                  {currentUser.role} · {currentUser.part}
                </span>
              </button>
              {photoOpen && (
                <div className="photo-editor-pop">
                  <label htmlFor="user-photo-url">프로필 사진 URL</label>
                  <input
                    id="user-photo-url"
                    value={photoInput}
                    onChange={(event) => setPhotoInput(event.target.value)}
                    placeholder="https://…/photo.jpg"
                    autoFocus
                  />
                  <div className="photo-editor-preview">
                    {photoInput.trim() ? <img src={photoInput} alt="미리보기" /> : <span>미리보기</span>}
                  </div>
                  <div className="photo-editor-actions">
                    <button className="secondary-button" onClick={() => setPhotoOpen(false)} type="button">
                      취소
                    </button>
                    <button className="primary-button" onClick={savePhoto} type="button">
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* 헤더 단추도 메뉴의 또 다른 입구다. 숨긴 메뉴면 같이 뺀다 — 눌러도 못 들어가는 단추는 고장으로 읽힌다. */}
            {!isMenuHidden('notifications', hiddenMenus) && (
              <button
                className={active === 'notifications' ? 'icon-button has-badge active' : 'icon-button has-badge'}
                title="알림 / 메시지"
                onClick={() => onSectionChange('notifications')}
              >
                <Bell size={19} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            )}
            {/* 좁은 폭에서는 라벨을 감추고 아이콘만 남긴다(CSS). 감춰도 뜻이
                전달되게 title 과 aria-label 을 함께 둔다. */}
            <button
              className={active === 'guide' ? 'icon-button active' : 'icon-button'}
              onClick={() => onSectionChange('guide')}
              title="사용 가이드"
              aria-label="사용 가이드"
            >
              <BookOpen size={19} />
            </button>
            {!isMenuHidden('intake', hiddenMenus) && (
              <button
                className="primary-button intake-cta"
                onClick={() => onSectionChange('intake')}
                aria-label="의견 접수"
                title="의견 접수"
              >
                <MessageSquarePlus size={18} />
                <span>의견 접수</span>
              </button>
            )}
            <button className="icon-button" onClick={onLogout} title="로그아웃">
              <LogOut size={19} />
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
