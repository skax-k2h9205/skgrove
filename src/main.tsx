import { createRoot } from 'react-dom/client';
// 한국어 본문 폰트. 선언만 하고 파일을 안 불러오면 그 기기에 깔린 사람만 보게 되어
// OS마다 서체가 갈린다. dynamic-subset 은 unicode-range 로 쪼개져 있어
// 실제로 쓰는 글자 범위만 내려받는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startVersionWatch } from './versionWatch';
import './styles.css';

// 바깥 경계. 여기까지 오면 앱 전체가 죽은 상황이라 최소한의 안내와 재시도만 남긴다.
// 화면 단위 경계는 AppShell 안에 따로 있다.
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// 새 배포가 나오면 옛 번들 탭이 스스로 최신화된다(공유 DB 를 옛 로직으로 되돌리는 사고 방지).
void startVersionWatch();
