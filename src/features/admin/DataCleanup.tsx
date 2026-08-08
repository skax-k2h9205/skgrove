import { useState } from 'react';
import { supabase } from '../../supabaseClient';

/*
  데이터 정제(관리자 전용) — 등록된 모든 콘텐츠를 Supabase에서 삭제한다.
  실서비스 전 테스트 데이터를 비우는 1회성 도구. 되돌릴 수 없어 이중 확인을 거친다.
  계정(accounts)·설정(app_config)·프로필(profiles)은 로그인/신원 데이터라 삭제하지 않는다.
*/

type Target = { label: string; table: string; idColumn: string };

const TARGETS: Target[] = [
  { label: '대나무숲 접수', table: 'issues', idColumn: 'id' },
  { label: '안건', table: 'agendas', idColumn: 'id' },
  { label: '투표 기록', table: 'agenda_ballots', idColumn: 'agenda_id' },
  { label: '액션아이템', table: 'action_items', idColumn: 'id' },
  { label: '캔미팅 세션', table: 'can_sessions', idColumn: 'id' },
  { label: '캔미팅 의견', table: 'can_opinions', idColumn: 'id' },
  { label: '티미팅', table: 'tea_sessions', idColumn: 'id' },
  { label: '모임·번개', table: 'gatherings', idColumn: 'id' },
  { label: '모임 신청', table: 'gathering_signups', idColumn: 'id' },
  { label: '장터 물건', table: 'market_items', idColumn: 'id' },
  { label: '장터 입찰', table: 'market_bids', idColumn: 'id' },
  { label: '유머 글', table: 'humor_posts', idColumn: 'id' },
  { label: '유머 댓글', table: 'humor_comments', idColumn: 'id' },
  { label: '조뽑기 결과', table: 'connect_results', idColumn: 'id' },
  { label: '팀 추억 자산', table: 'team_memory_assets', idColumn: 'id' },
  { label: '팀 추억', table: 'team_memories', idColumn: 'id' },
  { label: '상담 대화', table: 'counsel_messages', idColumn: 'id' },
];

export function DataCleanup({ onLogout }: { onLogout: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const purge = async () => {
    if (!supabase) {
      setErrors(['Supabase가 설정되지 않아 삭제할 수 없습니다.']);
      return;
    }
    setWorking(true);
    setDone(null);
    setErrors([]);
    let ok = 0;
    const fails: string[] = [];
    for (const t of TARGETS) {
      const { error } = await supabase.from(t.table).delete().not(t.idColumn, 'is', null);
      if (error) fails.push(`${t.label}: ${error.message}`);
      else ok += 1;
    }
    setWorking(false);
    setConfirming(false);
    setErrors(fails);
    setDone(`정제 완료 — ${ok}개 항목 삭제${fails.length ? ` (${fails.length}개 실패)` : ''}`);
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>데이터 정제 · 관리자</h1>
          <button onClick={onLogout} style={ghostBtn}>로그아웃</button>
        </div>

        <div style={warn}>
          ⚠️ 실서비스 전 테스트 데이터를 비우는 도구입니다. 삭제는 웹·모든 기기에 즉시 반영되며 <b>되돌릴 수 없습니다</b>.
          계정·설정·프로필은 유지됩니다.
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: '14px 0 8px' }}>삭제 대상</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {TARGETS.map((t) => (
            <span key={t.table} style={chip}>{t.label}</span>
          ))}
        </div>

        {done && <div style={okBox}>{done}</div>}
        {errors.length > 0 && (
          <div style={errBox}>
            {errors.map((e) => <div key={e}>{e}</div>)}
          </div>
        )}

        {!confirming ? (
          <button onClick={() => setConfirming(true)} disabled={working} style={dangerBtn}>
            모든 등록 데이터 삭제
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={purge} disabled={working} style={dangerBtn}>
              {working ? '삭제 중…' : '정말 전체 삭제 (되돌릴 수 없음)'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={working} style={ghostBtn}>취소</button>
          </div>
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 20 };
const card: React.CSSProperties = { width: '100%', maxWidth: 560, background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 };
const warn: React.CSSProperties = { background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.6 };
const chip: React.CSSProperties = { fontSize: 12, color: '#4b5563', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 10px' };
const dangerBtn: React.CSSProperties = { flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 16px', fontSize: 14, cursor: 'pointer' };
const okBox: React.CSSProperties = { background: '#ecfdf5', color: '#047857', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 12 };
const errBox: React.CSSProperties = { background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '12px 14px', fontSize: 13, marginBottom: 12 };
