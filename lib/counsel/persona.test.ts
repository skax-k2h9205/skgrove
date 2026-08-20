import { describe, expect, it } from 'vitest';
import { PERSONA, RULE_PERSONA, FORMAT_RULES, buildSystemContent } from './persona.js';

describe('buildSystemContent', () => {
  it('상담 모드: 페르소나 + 성향 + 사례를 주입하고 서식 규칙으로 끝난다', () => {
    const out = buildSystemContent({
      mode: 'counsel',
      self: { name: '지훈' },
      partner: { name: '민수' },
      cases: [{ source: '대나무숲', id: 'SOOP-1', title: '회의 갈등', status: '검토중', snippet: '요약' }],
    });

    expect(out).toContain(PERSONA);
    expect(out).toContain('지훈');
    expect(out).toContain('민수');
    // 이미 고른 상대를 다시 묻지 않도록 프롬프트가 못을 박는다(되물으면 고른 행위가 무의미해진다).
    expect(out).toContain('"민수"님을 이미 지정했다');
    expect(out).toContain('되묻지도 말고');
    expect(out).toContain('"민수님" 으로 부르고');   // 지정한 상대를 이름으로 부른다
    expect(out).toContain('대나무숲 SOOP-1'); // 사례가 id 와 함께 인용됨
    expect(out).toContain(FORMAT_RULES);
  });

  it('상대를 고르지 않았으면 지정 문구를 넣지 않는다 — 그때는 되묻는 게 맞다', () => {
    const out = buildSystemContent({ mode: 'counsel', self: { name: '지훈' } });
    expect(out).not.toContain('이미 지정했다');
    expect(out).not.toContain('[갈등 상대의 성향]');
  });

  it('상담 모드: 사례가 없으면 사례 섹션을 넣지 않는다', () => {
    const out = buildSystemContent({ mode: 'counsel', self: { name: '지훈' } });
    expect(out).not.toContain('[팀의 유사 사례');
  });

  it('룰 모드: 룰 페르소나 + 제공된 지식 문서를 쓴다', () => {
    const out = buildSystemContent({ mode: 'rule', knowledge: '전표 승인 기한은 7일' });
    expect(out).toContain(RULE_PERSONA);
    expect(out).toContain('전표 승인 기한은 7일');
    expect(out).toContain(FORMAT_RULES);
  });

  it('룰 모드: 지식이 없으면 안내 문구로 대체한다', () => {
    const out = buildSystemContent({ mode: 'rule' });
    expect(out).toContain('지식 문서가 제공되지 않았습니다');
  });
});
