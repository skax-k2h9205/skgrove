// jsdom 없이 검증한다 — Markdownish 는 상태도 이펙트도 없는 순수 렌더라
// 문자열로 뽑아 보면 충분하다. 테스트 때문에 DOM 환경을 들이지 않는다.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdownish } from './Markdownish';

const html = (text: string) => renderToStaticMarkup(<Markdownish text={text} />);

describe('Markdownish', () => {
  it('굵게를 태그로 바꾼다', () => {
    expect(html('**중요**합니다')).toBe('<p><strong>중요</strong>합니다</p>');
  });

  it('기울임을 굵게보다 나중에 본다 — 순서가 바뀌면 별표가 글자로 샌다', () => {
    expect(html('**굵게**')).toBe('<p><strong>굵게</strong></p>');
    expect(html('*기울임*')).toBe('<p><em>기울임</em></p>');
    expect(html('**굵게** 그리고 *기울임*')).toBe(
      '<p><strong>굵게</strong> 그리고 <em>기울임</em></p>',
    );
  });

  it('불릿과 번호 목록을 각각 ul/ol 로 묶는다', () => {
    expect(html('- 하나\n- 둘')).toBe('<ul><li>하나</li><li>둘</li></ul>');
    expect(html('1. 하나\n2. 둘')).toBe('<ol><li>하나</li><li>둘</li></ol>');
  });

  it('불릿과 번호가 섞이면 목록을 끊는다', () => {
    expect(html('- 하나\n1. 둘')).toBe('<ul><li>하나</li></ul><ol><li>둘</li></ol>');
  });

  it('--- 를 구분선으로 그린다', () => {
    expect(html('앞\n\n---\n\n뒤')).toBe('<p>앞</p><hr/><p>뒤</p>');
  });

  it('제목은 굵은 한 줄로 낮춘다 — 상담 답변에 h1 크기가 끼면 말투가 깨진다', () => {
    expect(html('### 오늘 할 일')).toBe('<p><strong>오늘 할 일</strong></p>');
  });

  it('별표로 시작하는 강조 문장을 불릿으로 오해하지 않는다', () => {
    expect(html('*"끝까지 듣고 싶어요"*')).toBe('<p><em>&quot;끝까지 듣고 싶어요&quot;</em></p>');
  });

  it('코드 표기를 살린다', () => {
    expect(html('`SOOP-142` 참고')).toBe('<p><code>SOOP-142</code> 참고</p>');
  });

  it('실제 상담 답변에 별표가 하나도 남지 않는다', () => {
    // 2026-08-10 프로덕션 /api/chat 응답에서 그대로 가져온 형태.
    const reply = [
      '의견을 말하는 중간에 자꾸 끊기니 답답하시겠어요.',
      '',
      '**파트장님 입장을 먼저 살펴보면**, 다음 중 하나일 수 있어요:',
      '- 회의 시간을 효율적으로 진행하려는 성향',
      '- 당신의 말을 제대로 못 들었거나 오해한 상태',
      '',
      '---',
      '',
      '**오늘 해볼 수 있는 한 걸음:**',
      '',
      '*"제 생각을 끝까지 말한 후에 의견을 주시면 좋겠어요"*',
    ].join('\n');
    const out = html(reply);
    expect(out).not.toContain('*');
    expect(out).toContain('<strong>');
    expect(out).toContain('<em>');
    expect(out).toContain('<hr/>');
    expect(out).toContain('<ul>');
  });
});
