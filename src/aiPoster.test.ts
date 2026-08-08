import { describe, expect, it } from 'vitest';
import { localPoster } from './aiPoster';
import type { Gathering } from './types';

const meetup = (patch: Partial<Gathering> = {}): Gathering => ({
  id: 'GAT-1',
  kind: 'flash',
  title: '퇴근 후 볼링',
  startAt: '2026-08-05T19:00',
  place: '강남 볼링장',
  capacity: 3,
  closeAt: '2026-08-05T18:00',
  minPeople: null,
  desc: '',
  part: '전체',
  cost: 'n빵',
  host: '이선민',
  createdAt: '2026-08-05',
  canceled: false,
  ...patch,
});

describe('로컬 포스터 폴백', () => {
  it('AI 엔드포인트 없이도 포스터가 나온다', () => {
    // 없으면 카드가 비는 게 아니라 "AI가 꺼져 있음"이 화면에 남는데, 사용자 잘못이 아니다
    const poster = localPoster(meetup());
    expect(poster.headline).toBe('퇴근 후 볼링');
    expect(poster.source).toBe('local');
  });

  it('부연에 시각·장소·정원을 모아 넣는다', () => {
    expect(localPoster(meetup()).caption).toBe('8월 5일(수) 오후 7:00 · 강남 볼링장 · 선착순 3명');
  });

  it('제한 없음도 말로 적는다', () => {
    expect(localPoster(meetup({ capacity: null })).caption).toContain('인원 제한 없음');
  });

  it('장소가 비어도 구분점이 남지 않는다', () => {
    expect(localPoster(meetup({ place: '  ' })).caption).toBe('8월 5일(수) 오후 7:00 · 선착순 3명');
  });

  it('같은 입력이면 언제나 같은 포스터다', () => {
    // 새로고침할 때마다 색이 바뀌면 "쌓아 보는" 목적이 무너진다
    expect(localPoster(meetup())).toEqual(localPoster(meetup()));
  });

  it('제목이 다르면 색이 갈린다', () => {
    const tones = ['커피 한잔', '등산 가요', '보드게임 나잇', '스터디 모집'].map(
      (title) => localPoster(meetup({ title })).tone,
    );
    expect(new Set(tones).size).toBeGreaterThan(1);
  });

  it('제목의 낱말로 아이콘을 고른다', () => {
    expect(localPoster(meetup({ title: '커피 한잔 하실 분' })).motif).toBe('Coffee');
    expect(localPoster(meetup({ title: '점심 같이 먹어요' })).motif).toBe('UtensilsCrossed');
    expect(localPoster(meetup({ title: '주말 등산 가실 분' })).motif).toBe('Mountain');
    expect(localPoster(meetup({ title: '생일 축하 자리' })).motif).toBe('PartyPopper');
    // 업무 성격 모임도 자주 열린다. 목록에 없으면 해시 폴백으로 엉뚱한 아이콘이 붙는다
    // ('분기 회고 워크샵'이 포크·나이프로 나왔다).
    expect(localPoster(meetup({ title: '분기 회고 워크샵' })).motif).toBe('BookOpen');
  });

  it('아는 낱말이 없어도 아이콘은 반드시 하나 정해진다', () => {
    expect(localPoster(meetup({ title: 'ㅁㄴㅇㄹ' })).motif).toBeTruthy();
  });

  it('색은 앱의 역할색 밖으로 나가지 않는다', () => {
    const allowed = ['moss', 'clay', 'info', 'pending'];
    for (let i = 0; i < 50; i += 1) {
      expect(allowed).toContain(localPoster(meetup({ title: `모임 ${i}` })).tone);
    }
  });
});
