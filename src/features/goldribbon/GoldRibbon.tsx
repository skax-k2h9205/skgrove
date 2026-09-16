// 근무지별 점심 맛집 추천 챗봇(GoldRibbon, 공개 Streamlit 앱)을 iframe 으로 임베드.
// ?embed=true 로 Streamlit 자체 메뉴·푸터를 숨긴다. 혹시 임베드가 막히는 환경 대비 '새 탭' 링크도 둔다.
import { ExternalLink } from 'lucide-react';

const APP_URL = 'https://goldribbon.streamlit.app/';
const EMBED_URL = `${APP_URL}?embed=true`;

export function GoldRibbon() {
  return (
    <section className="panel goldribbon-panel">
      <div className="goldribbon-head">
        <p className="can-hint">근무지별 점심 맛집을 추천해주는 챗봇이에요. 메뉴·가격·도보시간으로 검색해 보세요.</p>
        <a className="secondary-button goldribbon-open" href={APP_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} />새 탭에서 열기
        </a>
      </div>
      <iframe
        className="goldribbon-frame"
        src={EMBED_URL}
        title="맛집추천 GoldRibbon"
        loading="lazy"
        allow="clipboard-write"
      />
    </section>
  );
}
