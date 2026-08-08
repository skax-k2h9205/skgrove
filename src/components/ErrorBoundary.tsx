import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// 렌더 중 오류가 하나 나면 리액트는 트리 전체를 버린다. 경계가 없으면 화면이 백지가 되고,
// 사용자는 무엇이 잘못됐는지도, 어디로 가야 하는지도 알 수 없다.
//
// 경계를 두 겹으로 쓴다.
//  - App 바깥: 앱 전체가 죽는 것을 막는다.
//  - 화면 단위: 한 화면이 죽어도 사이드바와 다른 메뉴는 살아 있게 한다.
// 두 번째가 실제로 더 자주 쓰인다. 접수 화면 하나가 깨졌다고 팀 추억까지 못 볼 이유가 없다.

type ErrorBoundaryProps = {
  children: ReactNode;
  /** 무엇을 감싼 경계인지. 안내 문구에 쓰인다. */
  label?: string;
  /** 화면을 바꾸면 오류 상태를 푼다. 안 그러면 다른 메뉴로 옮겨도 오류 화면이 남는다. */
  resetKey?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // 화면이 바뀌었는데도 오류 상태가 남아 있으면, 멀쩡한 다른 화면까지 못 쓰게 된다.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 서버 로깅이 붙기 전까지는 콘솔이 유일한 단서다.
    console.error('[ErrorBoundary]', this.props.label ?? 'app', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <AlertTriangle size={28} />
        <h2>{this.props.label ? `${this.props.label} 화면을 불러오지 못했어요` : '화면을 불러오지 못했어요'}</h2>
        <p>
          잠시 후 다시 시도해주세요. 계속 같은 문제가 나면 이 메시지를 팀에 알려주시면 도움이 됩니다.
        </p>
        {/* 원인을 감추면 알릴 수도 없다. 기술적인 문구지만 그대로 보여준다. */}
        <code>{error.message}</code>
        <button className="primary-button" onClick={this.retry} type="button">
          <RefreshCw size={16} />
          다시 시도
        </button>
      </div>
    );
  }
}
