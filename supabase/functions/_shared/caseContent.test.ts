import { describe, expect, it } from 'vitest';
import { caseContentOf } from './caseContent.js';

describe('caseContentOf', () => {
  it('공개 가능 평문 이슈는 본문·기대변화까지 content 에 넣는다', () => {
    const out = caseContentOf('issue', {
      title: '회의 발언 기회', visibility: '안건 후보로 공개 가능', encrypted: false,
      body: '회의에서 말할 틈이 없어요', expected_change: '라운드로빈 발언', status: '검토중', category: '문화',
    });
    expect(out).toBeTruthy();
    expect(out!.content).toContain('말할 틈');
    expect(out!.content).toContain('라운드로빈');
    expect(out!.snippet).toContain('말할 틈');
  });

  it('리더만 보기(또는 visibility 누락) 이슈는 제외(null)', () => {
    expect(caseContentOf('issue', { title: 'x', visibility: '리더만 보기', body: 'b', status: 's' })).toBeNull();
    expect(caseContentOf('issue', { title: 'x', body: 'b', status: 's' })).toBeNull();
  });

  it('암호화 이슈는 제목·카테고리·상태만 (본문 미포함)', () => {
    const out = caseContentOf('issue', {
      title: '팀장님과의 갈등', visibility: '안건 후보로 공개 가능', encrypted: true,
      body: '', expected_change: '', status: '접수', category: '관계',
    });
    expect(out).toBeTruthy();
    expect(out!.content).toContain('팀장님과의 갈등');
    expect(out!.content).toContain('관계');
    expect(out!.snippet).toBe('팀장님과의 갈등');
  });

  it('안건은 제목+설명, 1200자 캡·80자 스니펫', () => {
    const long = '가'.repeat(3000);
    const out = caseContentOf('agenda', { title: '재택 규칙', description: long, status: '투표중' });
    expect(out).toBeTruthy();
    expect(out!.content.length).toBeLessThanOrEqual(1200);
    expect(out!.snippet.length).toBeLessThanOrEqual(81); // 80 + '…'
  });

  it('제목 없음·미지 source 는 null', () => {
    expect(caseContentOf('agenda', { title: '', description: 'd', status: 's' })).toBeNull();
    expect(caseContentOf('memo' as never, { title: 't' })).toBeNull();
  });
});
