import { Bell, Hash, LayoutList, Settings } from 'lucide-react';
import { PanelHeader } from '../../components/PanelHeader';
import { canHideMenu, isMenuHidden, setMenuHidden } from '../../menuRules';
import { navGroups } from '../../navigation';
import type { NotifyRoute, NotifySettings } from '../../notifySettingsStore';
import type { NotificationKind, Section } from '../../types';

type SystemManagementProps = {
  settings: NotifySettings;
  onSettingsChange: (settings: NotifySettings) => void;
  /** 팀 전체에서 숨긴 메뉴. */
  hiddenMenus: Section[];
  onHiddenMenusChange: (hidden: Section[]) => void;
};

/*
  메뉴 표시 설정에 늘어놓을 묶음. 사이드바와 같은 묶음·순서를 쓰되 플랫폼 묶음은 뺀다 —
  플랫폼 관리는 팀 설정이 아니라 플랫폼 오너의 화면이라 여기서 다룰 대상이 아니다.
*/
const MENU_GROUPS = navGroups.filter((group) => group.title !== '플랫폼');

const KIND_ORDER: NotificationKind[] = [
  'issue',
  'agenda',
  'deadline',
  'tea',
  'message',
  'action',
  'humor',
  'gathering',
  'market',
];

const KIND_LABELS: Record<NotificationKind, string> = {
  issue: '대나무숲 접수',
  agenda: '안건 등록',
  deadline: '투표 마감 임박',
  tea: '티미팅 제안 접수',
  message: '개인 메시지',
  action: '액션아이템',
  humor: '유머게시판',
  gathering: '모임 · 번개',
  market: '이음장터',
};

// 각 알림이 '언제' 나가는지. 종류와 설정 사이에 짧게 보여, 커넥셔너가 무슨 시점의
// 알림인지 알고 발송 위치를 정하게 한다. (문구는 실제 트리거 코드 기준)
const KIND_TIMING: Record<NotificationKind, string> = {
  issue: '팀원이 대나무숲에 의견을 접수한 때',
  agenda: '새 안건이 등록돼 투표가 열린 때',
  deadline: '안건 투표 마감이 임박한 때',
  tea: '티미팅 세션이 제안된 때',
  message: '누군가 나에게 메시지를 보낸 때',
  action: '내가 액션 담당자로 지정된 때',
  humor: '내 글에 댓글이 달린 때',
  gathering: '모임 자리 승계·취소가 생긴 때',
  market: '상회 입찰·낙찰·취소가 생긴 때',
};

const ROUTE_OPTIONS: NotifyRoute[] = ['team', 'connector', 'dm', 'off'];
const ROUTE_LABELS: Record<NotifyRoute, string> = {
  team: '팀 채널',
  connector: '커넥셔너 채널',
  dm: '개인 DM',
  off: '끔 (인앱만)',
};

// 커넥셔너 전용 시스템 관리 화면. 알림 발송 설정을 바꾸면 저장 즉시 팀 전체에 적용된다.
export function SystemManagement({
  settings,
  onSettingsChange,
  hiddenMenus,
  onHiddenMenusChange,
}: SystemManagementProps) {
  const patch = (partial: Partial<NotifySettings>) => onSettingsChange({ ...settings, ...partial });

  return (
    <section className="screen">
      <section className="panel">
        <PanelHeader icon={Settings} title="시스템 관리 · 알림 발송" />
        <p className="system-note">
          여기서 바꾼 설정은 <b>저장 즉시 팀 전체에 적용</b>됩니다(재배포 불필요). 슬랙 봇 토큰만 서버 비밀로 남습니다.
        </p>

        <div className="system-toggle-row">
          <div>
            <strong>슬랙 알림 사용</strong>
            <span>끄면 어떤 슬랙도 보내지 않고 앱 안 알림만 남습니다.</span>
          </div>
          <label className={settings.slackEnabled ? 'connectioner-toggle on' : 'connectioner-toggle'}>
            <input
              type="checkbox"
              aria-label="슬랙 알림 사용"
              checked={settings.slackEnabled}
              onChange={(event) => patch({ slackEnabled: event.target.checked })}
            />
          </label>
        </div>

        <div className="system-toggle-row">
          <div>
            <strong>개인 DM 발송</strong>
            <span>대나무숲·개인 메시지 등 DM 경로를 켭니다(슬랙 이메일이 등록된 사람만 받습니다).</span>
          </div>
          <label className={settings.dmEnabled ? 'connectioner-toggle on' : 'connectioner-toggle'}>
            <input
              type="checkbox"
              aria-label="개인 DM 발송"
              checked={settings.dmEnabled}
              onChange={(event) => patch({ dmEnabled: event.target.checked })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Hash} title="슬랙 채널 ID" />
        <p className="system-note">
          슬랙에서 채널 우클릭 → 채널 세부정보 → 맨 아래 <b>채널 ID</b>(C…) 복사. 봇을 그 채널에 초대해야 게시됩니다.
          비워 두면 서버 기본값으로 폴백합니다.
        </p>
        <div className="form-grid">
          <label>
            팀 채널
            <input
              value={settings.channels.team}
              placeholder="C…"
              onChange={(event) => patch({ channels: { ...settings.channels, team: event.target.value.trim() } })}
            />
          </label>
          <label>
            커넥셔너 채널
            <input
              value={settings.channels.connector}
              placeholder="C…"
              onChange={(event) =>
                patch({ channels: { ...settings.channels, connector: event.target.value.trim() } })
              }
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Bell} title="알림 종류별 발송 위치" />
        <p className="system-note">각 알림을 어디로 보낼지 고릅니다. 팀/커넥셔너 채널은 위에서 지정한 채널로 갑니다.</p>
        <div className="system-route-list">
          {KIND_ORDER.map((kind) => (
            <div className="system-route-row" key={kind}>
              <span className="system-route-kind">{KIND_LABELS[kind]}</span>
              <span className="system-route-when">{KIND_TIMING[kind]}</span>
              <select
                value={settings.routes[kind]}
                aria-label={`${KIND_LABELS[kind]} 발송 위치`}
                onChange={(event) => patch({ routes: { ...settings.routes, [kind]: event.target.value as NotifyRoute } })}
              >
                {ROUTE_OPTIONS.map((route) => (
                  <option key={route} value={route}>
                    {ROUTE_LABELS[route]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/*
        메뉴 표시 — 팀에서 안 쓰는 메뉴를 끈다. 사이드바·하단 탭·헤더 단추·홈 피드에서 빠지고
        주소로도 못 들어온다. 데이터는 지우지 않는다. 규칙은 menuRules 한 곳이 쥔다.
      */}
      <section className="panel">
        <PanelHeader icon={LayoutList} title="메뉴 표시" />
        <p className="system-note">
          끈 메뉴는 <b>팀 전체</b>의 사이드바와 하단 탭에서 빠지고 주소로도 들어갈 수 없습니다. 데이터는 지워지지
          않고, 다시 켜면 그대로 돌아옵니다. 리더 관리함처럼 역할로 막힌 메뉴는 켜 두어도 해당 역할에게만 보입니다.
        </p>
        <div className="menu-visibility-summary">
          <span>
            {hiddenMenus.length === 0 ? '지금은 모든 메뉴가 보입니다.' : `숨긴 메뉴 ${hiddenMenus.length}개`}
          </span>
          {hiddenMenus.length > 0 && (
            <button className="btn-ghost" onClick={() => onHiddenMenusChange([])} type="button">
              모두 보이기
            </button>
          )}
        </div>
        <div className="menu-visibility">
          {MENU_GROUPS.map((group) => (
            <div className="menu-visibility-group" key={group.title}>
              <h3>{group.title}</h3>
              {group.items.map((item) => {
                const Icon = item.icon;
                const hideable = canHideMenu(item.id);
                const hidden = isMenuHidden(item.id, hiddenMenus);
                return (
                  <div className={hidden ? 'menu-visibility-row off' : 'menu-visibility-row'} key={item.id}>
                    <Icon size={18} />
                    <strong>{item.label}</strong>
                    {hideable ? (
                      <label className={hidden ? 'connectioner-toggle' : 'connectioner-toggle on'}>
                        <input
                          aria-label={`${item.label} 메뉴 보이기`}
                          checked={!hidden}
                          onChange={(event) =>
                            onHiddenMenusChange(setMenuHidden(hiddenMenus, item.id, !event.target.checked))
                          }
                          type="checkbox"
                        />
                        {hidden ? '숨김' : '보임'}
                      </label>
                    ) : (
                      // 홈은 돌아갈 곳, 시스템 관리는 다시 켤 화면이라 끌 수 없다.
                      <span className="fixed">항상 보임</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
