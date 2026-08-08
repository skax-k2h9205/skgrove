import { describe, expect, it } from 'vitest';
import { fileFromDataUri } from './gatheringImage';
import { buildPrompt, castFor, retryNoteFor, sniffMime, timeOfDay, usableSubject } from '../scripts/image-proxy.mjs';

describe('timeOfDay — 시작 시각이 장면의 빛을 정한다', () => {
  it('시간대별로 나눈다', () => {
    expect(timeOfDay('2026-08-05T08:00')).toBe('bright morning');
    expect(timeOfDay('2026-08-05T12:30')).toBe('bright midday');
    expect(timeOfDay('2026-08-05T16:00')).toBe('warm late afternoon');
    expect(timeOfDay('2026-08-05T19:00')).toBe('cozy evening');
  });

  it('경계값은 다음 구간으로 넘어간다', () => {
    expect(timeOfDay('2026-08-05T11:00')).toBe('bright midday');
    expect(timeOfDay('2026-08-05T15:00')).toBe('warm late afternoon');
    expect(timeOfDay('2026-08-05T18:00')).toBe('cozy evening');
  });

  it('형식이 깨져도 그림은 나와야 한다', () => {
    expect(timeOfDay('')).toBe('warm daylight');
    expect(timeOfDay('2026-08-05')).toBe('warm daylight');
  });
});

describe('castFor — 정원이 구도를 정한다', () => {
  it('소수 정원은 친밀한 장면이 된다', () => {
    expect(castFor(3)).toContain('just 3');
    expect(castFor(3)).toContain('intimate');
  });

  it('중간 정원은 인원수를 그대로 전달한다', () => {
    expect(castFor(8)).toContain('about 8');
  });

  it('큰 정원과 무제한은 군중으로 뭉뚱그린다', () => {
    expect(castFor(30)).toContain('crowd');
    expect(castFor(null)).toContain('lively group');
    expect(castFor(undefined)).toContain('lively group');
  });
});

describe('usableSubject — 못 미더운 번역을 걸러낸다', () => {
  it('정상 문장은 통과한다', () => {
    expect(usableSubject('Coworkers bowl together at a bowling lane after work.')).toBe(true);
  });

  it('모델이 지시를 못 알아듣고 되물으면 버린다', () => {
    // 실제로 겪은 응답. 이게 통과하면 등산이 회식 장면이 된다.
    expect(usableSubject("I don't see an image attached. Could you please share it?")).toBe(false);
  });

  it('너무 짧거나 너무 긴 문장은 버린다', () => {
    expect(usableSubject('Coworkers meet')).toBe(false);
    expect(usableSubject(new Array(30).fill('word').join(' '))).toBe(false);
  });

  it('빈 값에도 터지지 않는다', () => {
    expect(usableSubject('')).toBe(false);
    expect(usableSubject(null)).toBe(false);
  });
});

describe('sniffMime — 확장자가 아니라 바이트를 믿는다', () => {
  it('jpeg 를 png 로 착각하지 않는다', () => {
    // 이걸 틀리면 비전 API 가 400 을 내고, 그 빈 응답이 '글자 없음' 으로 오해된다.
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('png 를 알아본다', () => {
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
  });

  it('모르는 형식은 그렇다고 말한다', () => {
    expect(sniffMime(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBe('application/octet-stream');
  });
});

describe('buildPrompt — 등록값이 프롬프트에 실제로 들어간다', () => {
  const gathering = { title: '퇴근 후 볼링', place: '볼링장', startAt: '2026-08-05T19:00', capacity: 3 };

  it('정원과 시간대가 반영된다', () => {
    const prompt = buildPrompt('Coworkers bowl together at a bowling lane.', gathering);
    expect(prompt).toContain('just 3');
    expect(prompt).toContain('cozy evening');
    expect(prompt).toContain('Coworkers bowl together at a bowling lane.');
  });

  it('화풍과 제약은 언제나 붙는다 — 격자의 통일감이 여기서 나온다', () => {
    const prompt = buildPrompt('Anything.', gathering);
    expect(prompt).toContain('crayon');
    expect(prompt).toContain('Korean coworkers in Korea');
    expect(prompt).toContain('blank and unmarked');
  });
});

describe('retryNoteFor — 같은 실수를 반복하지 않게 되먹인다', () => {
  it('검출된 글자와 제거 지시를 함께 담는다', () => {
    const note = retryNoteFor('산행 시작');
    expect(note).toContain('산행 시작');
    expect(note).toContain('Remove');
  });
});

describe('fileFromDataUri — 첨부 사진과 같은 저장 경로를 타게 한다', () => {
  it('실제 형식으로 확장자를 만든다', () => {
    // 1x1 png
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const file = fileFromDataUri(png, 'GAT-1');
    expect(file?.name).toBe('GAT-1.png');
    expect(file?.type).toBe('image/png');
    expect(file?.size).toBeGreaterThan(0);
  });

  it('data URI 가 아니면 null — 호출부는 폴백 한 갈래만 다룬다', () => {
    expect(fileFromDataUri('https://example.com/a.png', 'GAT-1')).toBeNull();
    expect(fileFromDataUri('', 'GAT-1')).toBeNull();
  });
});
