// 마크다운을 헤딩 경계로 청킹한다(순수). Deno(Edge reindex)와 vitest 양쪽에서 쓰인다.
// 목표: 300~800자 청크. 200자 미만은 직전에 병합, 1500자 초과는 문단 경계로 재분할.
// 각 청크는 상위 헤딩 누적 경로(heading)를 갖는다 — 검색 결과에 출처를 붙이기 위함.

const MIN = 200;
const MAX = 1500;

/** '## 예산' → { level:2, text:'예산' }, 아니면 null */
function parseHeading(line) {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  return m ? { level: m[1].length, text: m[2].trim() } : null;
}

function headingPath(stack) {
  return stack.map((h) => h.text).join(' > ');
}

/** 문단(빈 줄) 경계로 큰 텍스트를 MAX 이하 조각들로 나눈다. */
function splitLong(text) {
  if (text.length <= MAX) return [text];
  const paras = text.split(/\n\s*\n/);
  const out = [];
  let buf = '';
  for (const p of paras) {
    if (buf && (buf + '\n\n' + p).length > MAX) {
      out.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * @param {string} md
 * @param {string} doc  파일명 등 출처 식별자
 * @returns {Array<{doc:string, heading:string, content:string}>}
 */
export function chunkMarkdown(md, doc) {
  if (!md || !md.trim()) return [];
  const lines = md.split('\n');
  const stack = []; // 현재 헤딩 경로
  const raw = []; // {heading, body}
  let body = [];

  const flush = () => {
    const text = body.join('\n').trim();
    if (text) raw.push({ heading: headingPath(stack), content: text });
    body = [];
  };

  for (const line of lines) {
    const h = parseHeading(line);
    if (h) {
      flush();
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      stack.push(h);
    } else {
      body.push(line);
    }
  }
  flush();

  // 큰 청크 재분할
  const split = [];
  for (const c of raw) {
    for (const piece of splitLong(c.content)) split.push({ heading: c.heading, content: piece });
  }

  // 작은 청크 병합(직전에) — 같은 h2 부모 내에서만
  const merged = [];
  for (const c of split) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...c });
      continue;
    }
    if (c.content.length < MIN) {
      // 같은 h2 섹션 내인지 확인 (heading path의 2번째 컴포넌트가 같으면 형제)
      const cParts = c.heading.split(' > ');
      const prevParts = prev.heading.split(' > ');
      const sameParent = cParts.length > 1 && prevParts.length > 1 && cParts[1] === prevParts[1];
      if (sameParent || (cParts.length === 1 && prevParts.length === 1)) {
        // 같은 부모 또는 둘 다 루트 레벨
        prev.content += '\n\n' + (c.heading ? `[${c.heading}]\n` : '') + c.content;
      } else {
        merged.push({ ...c });
      }
    } else {
      merged.push({ ...c });
    }
  }

  return merged.map((c) => ({ doc, heading: c.heading, content: c.content }));
}
