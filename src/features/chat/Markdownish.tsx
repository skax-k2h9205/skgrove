// LLM 답변용 초경량 마크다운 렌더러. 외부 라이브러리를 더하지 않으려고 직접 만든다.
// raw HTML 은 넣지 않으므로(문자열을 React 노드로만 조립) XSS 걱정이 없다.
//
// 여기서 그리지 못하는 서식은 화면에 `**이렇게**` 별표째로 남는다. 그래서
// "무엇을 지원하는가"는 취향이 아니라, api/chat.ts 의 페르소나가 모델에게
// 허용한 서식과 **정확히 같아야 한다**. 한쪽을 늘리면 다른 쪽도 늘려야 한다.
//
// 블록: 빈 줄로 나뉜 문단 · `- `/`* ` 불릿 · `1. ` 번호 목록 · `---` 구분선
//       · `#` 제목(굵은 한 줄로 강등 — 상담 답변에 h1 크기가 끼면 말투가 깨진다)
// 인라인: `**굵게**` · `*기울임*` · `` `코드` ``
import { Fragment, type ReactNode } from 'react';

// 굵게를 기울임보다 먼저 적는다 — 순서가 바뀌면 `**굵게**` 의 안쪽을
// `*기울임*` 으로 먼저 집어 별표 한 쌍이 글자로 남는다.
const INLINE = /(\*\*[^*]+?\*\*|\*[^*\n]+?\*|`[^`]+?`)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('*')) nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    else nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Item = { text: string };

export function Markdownish({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let items: Item[] = [];
  let ordered = false;
  let key = 0;

  const flush = () => {
    if (items.length === 0) return;
    const list = items;
    const wasOrdered = ordered;
    items = [];
    const children = list.map((item, i) => <li key={i}>{renderInline(item.text)}</li>);
    blocks.push(wasOrdered ? <ol key={key++}>{children}</ol> : <ul key={key++}>{children}</ul>);
  };

  for (const line of lines) {
    // 목록 기호 뒤에 공백이 있어야 목록이다. `*강조*` 로 시작하는 줄을 불릿으로
    // 삼키지 않도록 `[-*]\s+` 를 요구한다.
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const nextOrdered = Boolean(numbered);
      // 불릿과 번호가 섞이면 목록을 끊는다 — 한 <ul> 안에 번호를 넣을 수 없다.
      if (items.length > 0 && nextOrdered !== ordered) flush();
      ordered = nextOrdered;
      items.push({ text: (bullet ?? numbered)![1] });
      continue;
    }
    flush();
    const trimmed = line.trim();
    if (trimmed === '') continue;
    // `---`, `***` 구분선. 모델이 문단을 가를 때 즐겨 쓴다.
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      blocks.push(<hr key={key++} />);
      continue;
    }
    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={key++}>
          <strong>{renderInline(heading[1])}</strong>
        </p>,
      );
      continue;
    }
    blocks.push(<p key={key++}>{renderInline(trimmed)}</p>);
  }
  flush();

  return <Fragment>{blocks}</Fragment>;
}
