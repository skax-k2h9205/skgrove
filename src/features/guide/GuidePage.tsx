// 인앱 사용 가이드. 캡처 파이프라인(scripts/manual/detailed.mjs)이 만든 정적 HTML을
// iframe 으로 온디맨드 로드한다(이미지가 무거워 JS 번들에 넣지 않는다).
// 리더·커넥셔너는 운영자 가이드도 볼 수 있어 팀원/운영자를 토글한다.
import { useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { hasLeaderRole, isConnectioner, isTeamLeader } from '../../auth';
import type { CurrentUser } from '../../types';

const GUIDES = {
  member: { src: '/guides/member.html', label: '팀원 가이드' },
  operator: { src: '/guides/operator.html', label: '운영자 가이드' },
} as const;

type GuideKey = keyof typeof GUIDES;

export function GuidePage({ currentUser }: { currentUser: CurrentUser }) {
  // 운영자 가이드는 관리 메뉴를 쓰는 사람(리더·팀리더·커넥셔너)에게만 의미가 있다.
  const canSeeOperator = hasLeaderRole(currentUser) || isTeamLeader(currentUser) || isConnectioner(currentUser);
  const [view, setView] = useState<GuideKey>('member');
  const active = view === 'operator' && canSeeOperator ? 'operator' : 'member';
  const guide = GUIDES[active];

  return (
    <section className="screen guide-screen">
      <div className="guide-toolbar">
        <div className="guide-toolbar-title">
          <BookOpen size={18} />
          <span>화면을 따라 하며 배우는 사용법이에요. 각 동작에 번호를 붙여 두었습니다.</span>
        </div>
        <div className="guide-toolbar-actions">
          {canSeeOperator && (
            <div className="guide-switch" role="tablist" aria-label="가이드 종류">
              {(Object.keys(GUIDES) as GuideKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active === key}
                  className={active === key ? 'on' : ''}
                  onClick={() => setView(key)}
                >
                  {GUIDES[key].label}
                </button>
              ))}
            </div>
          )}
          <a className="secondary-button" href={guide.src} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> 새 탭에서 열기
          </a>
        </div>
      </div>
      <div className="guide-frame-wrap">
        <iframe key={active} className="guide-frame" src={guide.src} title={guide.label} />
      </div>
    </section>
  );
}
