import { useState, type ReactNode } from 'react';
import { Bell, Camera, HeartHandshake, LogOut, MessageSquarePlus } from 'lucide-react';
import { hasLeaderRole, isConnectioner, isTeamLeader } from '../auth';
import { navGroups, sections } from '../navigation';
import type { CurrentUser, Section } from '../types';
import { Avatar } from './Avatar';

/*
  예전에는 못 쓰는 메뉴를 흐리게 보여주고 자물쇠를 달았다. "앱에 뭐가 있는지
  알려준다"는 근거였는데, 이 앱에서는 홈 히어로의 '의견이 지나는 길
  (접수 → 리더 검토 → 익명 투표 → 액션)'이 이미 흐름을 보여준다.
  팀원에게 13개 중 2개가 매일 못 누르는 상태로 남는 건 순손실이라 감춘다.
*/
function canSee(id: Section, canUseLeaderMenu: boolean, canUseAccountsMenu: boolean, canUseConnectionerMenu: boolean) {
  if (id === 'leader') return canUseLeaderMenu;
  if (id === 'accounts') return canUseAccountsMenu;
  // 조뽑기·시스템 관리 등 커넥셔너 도구는 커넥셔너로 지정된 사람에게만.
  if (id === 'connect') return canUseConnectionerMenu;
  if (id === 'system') return canUseConnectionerMenu;
  return true;
}

type AppShellProps = {
  active: Section;
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

  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoInput, setPhotoInput] = useState('');

  const openPhotoEditor = () => {
    setPhotoInput(currentPhotoUrl ?? '');
    setPhotoOpen(true);
  };

  const savePhoto = () => {
    onSavePhoto(photoInput);
    setPhotoOpen(false);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <HeartHandshake size={24} />
          </div>
          <div>
            <strong>SKonnection</strong>
            <span>팀을 잇는 곳</span>
          </div>
        </div>

        <nav className="nav">
          {navGroups.map((group) => {
            const visible = group.items.filter((section) =>
              canSee(section.id, userCanUseLeaderMenu, userCanUseAccountsMenu, userCanUseConnectionerMenu),
            );
            // 항목이 모두 걸러진 그룹은 제목만 남는다. 그룹째 렌더하지 않는다.
            if (visible.length === 0) return null;
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
            <button
              className={active === 'notifications' ? 'icon-button has-badge active' : 'icon-button has-badge'}
              title="알림 / 메시지"
              onClick={() => onSectionChange('notifications')}
            >
              <Bell size={19} />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {/* 좁은 폭에서는 라벨을 감추고 아이콘만 남긴다(CSS). 감춰도 뜻이
                전달되게 title 과 aria-label 을 함께 둔다. */}
            <button
              className="primary-button intake-cta"
              onClick={() => onSectionChange('intake')}
              aria-label="의견 접수"
              title="의견 접수"
            >
              <MessageSquarePlus size={18} />
              <span>의견 접수</span>
            </button>
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
