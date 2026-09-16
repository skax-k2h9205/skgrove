// 근무지별 점심 맛집 추천 챗봇(GoldRibbon, 공개 Streamlit 앱)을 iframe 으로 임베드.
// ?embed=true 는 이 앱에서 하단 '목록 모드' 체크박스가 입력창과 겹치는 레이아웃 깨짐을 유발해
// 일반 URL 을 그대로 쓴다(단독 접속과 동일한 깔끔한 화면). 임베드 막히는 환경 대비 '새 탭' 링크 병행.
import { ExternalLink } from 'lucide-react';

const APP_URL = 'https://goldribbon.streamlit.app/';

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
        src={APP_URL}
        title="맛집추천 GoldRibbon"
        loading="lazy"
        allow="clipboard-write"
      />
    </section>
  );
}
