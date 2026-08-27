// 인앱 사용 가이드. 캡처 파이프라인(scripts/manual/detailed.mjs)이 만든 정적 HTML을
// iframe 으로 온디맨드 로드한다(이미지가 무거워 JS 번들에 넣지 않는다).
// 권한과 무관하게 팀원·운영자 가이드를 모두 토글로 볼 수 있게 둔다.
import { useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

const GUIDES = {
  member: { src: '/guides/member.html', label: '팀원 가이드' },
  operator: { src: '/guides/operator.html', label: '운영자 가이드' },
} as const;

type GuideKey = keyof typeof GUIDES;

export function GuidePage() {
  const [view, setView] = useState<GuideKey>('member');
  const guide = GUIDES[view];

  return (
    <section className="screen guide-screen">
      <div className="guide-toolbar">
        <div className="guide-toolbar-title">
          <BookOpen size={18} />
          <span>화면을 따라 하며 배우는 사용법이에요. 각 동작에 번호를 붙여 두었습니다.</span>
        </div>
        <div className="guide-toolbar-actions">
          <div className="guide-switch" role="tablist" aria-label="가이드 종류">
            {(Object.keys(GUIDES) as GuideKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={view === key ? 'on' : ''}
                onClick={() => setView(key)}
              >
                {GUIDES[key].label}
              </button>
            ))}
          </div>
          <a className="secondary-button" href={guide.src} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> 새 탭에서 열기
          </a>
        </div>
      </div>
      <div className="guide-frame-wrap">
        <iframe key={view} className="guide-frame" src={guide.src} title={guide.label} />
      </div>
    </section>
  );
}
