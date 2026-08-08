// LLM 답변용 초경량 마크다운 렌더러. 외부 라이브러리를 더하지 않으려고 직접 만든다.
// 지원: 문단(빈 줄), 줄바꿈, `- `/`* ` 불릿, `**굵게**`, `` `코드` ``. raw HTML 은 넣지
// 않으므로(문자열을 React 노드로만 조립) XSS 걱정이 없다. 그 이상은 의도적으로 안 한다.
import { Fragment, type ReactNode } from 'react';

// 한 줄 안의 **굵게** 와 `코드` 만 인라인 처리한다.
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdownish({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={key++}>
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    if (line.trim() === '') continue;
    blocks.push(<p key={key++}>{renderInline(line)}</p>);
  }
  flushBullets();

  return <Fragment>{blocks}</Fragment>;
}
