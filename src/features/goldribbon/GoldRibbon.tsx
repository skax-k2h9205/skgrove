// 근무지별 점심 맛집 추천 챗봇(GoldRibbon, 공개 Streamlit 앱)을 iframe 으로 임베드.
// - 좁은 폭에서 앱 하단 '목록 모드' 체크박스가 입력창과 겹치므로, iframe 에 최소 폭을 줘
//   앱을 넓은 레이아웃으로 렌더하고 좁으면 가로 스크롤한다.
// - 앱이 깨어나는 데 몇 초 걸리므로 로딩 스피너를 덮어둔다(iframe onLoad 시 제거).
// - 임베드가 막히는 환경 대비 '새 탭에서 열기' 링크도 둔다.
import { useState } from 'react';
import { ExternalLink, UtensilsCrossed } from 'lucide-react';

const APP_URL = 'https://goldribbon.streamlit.app/';

export function GoldRibbon() {
  const [loaded, setLoaded] = useState(false);

  return (
    <section className="panel goldribbon-panel">
      <div className="goldribbon-head">
        <p className="can-hint">근무지별 점심 맛집을 추천해주는 챗봇이에요. 메뉴·가격·도보시간으로 검색해 보세요.</p>
        <a className="secondary-button goldribbon-open" href={APP_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} />새 탭에서 열기
        </a>
      </div>
      <div className="goldribbon-frame-wrap">
        {!loaded && (
          <div className="goldribbon-loading" aria-live="polite">
            <UtensilsCrossed className="goldribbon-spin" size={30} />
            <p>GoldRibbon 맛집추천을 불러오는 중…</p>
            <span>처음엔 앱이 깨어나느라 몇 초 걸릴 수 있어요.</span>
          </div>
        )}
        <iframe
          className="goldribbon-frame"
          src={APP_URL}
          title="맛집추천 GoldRibbon"
          loading="lazy"
          allow="clipboard-write"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </section>
  );
}
