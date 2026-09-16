// 근무지별 점심 맛집 추천 챗봇(GoldRibbon, 공개 Streamlit 앱)을 iframe 으로 임베드.
// - ⚠️ 반드시 ?embed=true 로 임베드한다. plain URL 은 iframe 안에서 인증 리다이렉트 루프
//   (서드파티 쿠키 차단)에 빠져 빈 화면이 된다. embed 모드는 200 으로 바로 렌더된다.
// - 하단 '목록 모드' 체크박스 겹침 완화를 위해 iframe 최소 폭을 주고 좁으면 가로 스크롤.
// - 앱이 깨어나는 데 몇 초 걸리므로 로딩 스피너를 덮어둔다(onLoad 또는 6초 후 제거).
// - 임베드가 막히는 환경 대비 '새 탭에서 열기' 링크도 둔다.
import { useEffect, useState } from 'react';
import { ExternalLink, UtensilsCrossed } from 'lucide-react';

const APP_URL = 'https://goldribbon.streamlit.app/';
// embed=true 로 렌더(인증 루프 회피) + embed_options=show_padding 으로 하단 여백을 되살려
// '목록 모드' 체크박스가 고정 입력창과 겹치는 것을 막는다(embed 는 기본적으로 padding 을 없앰).
const EMBED_URL = `${APP_URL}?embed=true&embed_options=show_padding`;

export function GoldRibbon() {
  const [loaded, setLoaded] = useState(false);

  // 이 앱은 리다이렉트가 많아 iframe onLoad 가 안 불릴 수 있다 → 6초 후엔 무조건 오버레이 제거.
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 6000);
    return () => clearTimeout(timer);
  }, []);

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
          src={EMBED_URL}
          title="맛집추천 GoldRibbon"
          loading="lazy"
          allow="clipboard-write"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </section>
  );
}
