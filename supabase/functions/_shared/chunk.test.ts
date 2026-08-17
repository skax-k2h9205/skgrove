import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from './chunk.js';

const MD = `# 팀 운영\n인사말 문단입니다. 이 섹션은 팀 운영 전반을 다룹니다. 충분히 길게 만들어 병합되지 않도록 합니다.\n\n## 예산\n### 의욕관리비\n의욕관리비 한도는 분기당 30만원입니다. 사용 절차는 팀장 승인 후 집행합니다. 영수증 첨부 필수입니다.\n### 전표\n전표 승인 기한은 7일입니다.\n\n## 근태\n유연근무는 코어타임 10-16시를 지킵니다. 재택은 주 2회까지 가능합니다. 사전 공유가 원칙입니다.`;

describe('chunkMarkdown', () => {
  it('헤딩 경계로 나누고 doc·heading 경로를 붙인다', () => {
    const chunks = chunkMarkdown(MD, 'team.md');
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.every((c) => c.doc === 'team.md')).toBe(true);
    const budget = chunks.find((c) => c.content.includes('의욕관리비 한도'));
    expect(budget).toBeTruthy();
    expect(budget!.heading).toContain('예산');
    expect(budget!.heading).toContain('의욕관리비');
  });

  it('200자 미만 청크는 직전 청크에 병합한다', () => {
    const chunks = chunkMarkdown(MD, 'team.md');
    // '전표'(짧음)는 단독 청크로 남지 않고 직전(예산/의욕관리비)에 병합된다
    const tiny = chunks.find((c) => c.heading.endsWith('전표') && c.content.length < 200);
    expect(tiny).toBeUndefined();
    expect(chunks.some((c) => c.content.includes('전표 승인 기한'))).toBe(true);
  });

  it('빈 입력은 빈 배열', () => {
    expect(chunkMarkdown('', 'x.md')).toEqual([]);
  });
});
