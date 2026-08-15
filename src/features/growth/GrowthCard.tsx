import { useEffect, useMemo, useState } from 'react';
import { Sprout, Target, TrendingUp, ShieldCheck, Plus } from 'lucide-react';
import type {
  CompetencyLevel, CompetencyLogEntry, CurrentUser, GrowthGoal, ManagedAccount,
} from '../../types';
import { competencies } from '../../types';
import { isLeader } from '../../auth';
import { clampProgress, clampLevel, nextStatus, curveSeries } from '../../growthRules';
import { appendLog, loadGrowth, makeGrowthId, saveGoals, saveLevels } from '../../growthStore';
import './growth.css';

type Tab = 'me' | 'team';
const nowISO = () => new Date().toISOString();
const today = () => nowISO().slice(0, 10);

export function GrowthCard({ currentUser, accounts }: { currentUser: CurrentUser; accounts: ManagedAccount[] }) {
  const [goals, setGoals] = useState<GrowthGoal[]>([]);
  const [levels, setLevels] = useState<CompetencyLevel[]>([]);
  const [log, setLog] = useState<CompetencyLogEntry[]>([]);
  const [tab, setTab] = useState<Tab>('me');
  const canLead = isLeader(currentUser);
  const email = currentUser.email.toLowerCase();

  useEffect(() => {
    void loadGrowth().then((d) => { setGoals(d.goals); setLevels(d.levels); setLog(d.log); });
  }, []);

  const persistGoals = (next: GrowthGoal[]) => { setGoals(next); void saveGoals(next); };
  const persistLevels = (next: CompetencyLevel[]) => { setLevels(next); void saveLevels(next); };
  const pushLog = (e: CompetencyLogEntry) => { setLog((l) => [...l, e]); void appendLog(e); };

  return (
    <section className="panel growth-panel">
      <div className="growth-tabs">
        <button className={tab === 'me' ? 'active' : ''} onClick={() => setTab('me')}>
          <Sprout size={15} /> 내 성장
        </button>
        {canLead && (
          <button className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}>
            <ShieldCheck size={15} /> 팀 성장
          </button>
        )}
      </div>

      {tab === 'me' ? (
        <MeView
          email={email} goals={goals} levels={levels} log={log}
          persistGoals={persistGoals} persistLevels={persistLevels} pushLog={pushLog}
        />
      ) : (
        <TeamView
          accounts={accounts} goals={goals} levels={levels}
          persistGoals={persistGoals} persistLevels={persistLevels} pushLog={pushLog}
        />
      )}
    </section>
  );
}

// ── 내 성장 ──
function MeView({
  email, goals, levels, log, persistGoals, persistLevels, pushLog,
}: {
  email: string; goals: GrowthGoal[]; levels: CompetencyLevel[]; log: CompetencyLogEntry[];
  persistGoals: (g: GrowthGoal[]) => void; persistLevels: (l: CompetencyLevel[]) => void; pushLog: (e: CompetencyLogEntry) => void;
}) {
  const myGoals = useMemo(() => goals.filter((g) => g.ownerEmail.toLowerCase() === email), [goals, email]);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [due, setDue] = useState('');

  const addGoal = () => {
    if (!title.trim()) return;
    const g: GrowthGoal = {
      id: makeGrowthId('GRW'), ownerEmail: email, title: title.trim(), detail: detail.trim(),
      due, progress: 0, status: '진행중', leaderComment: '', createdAt: today(), updatedAt: today(),
    };
    persistGoals([g, ...goals]);
    setTitle(''); setDetail(''); setDue('');
  };
  const updateGoal = (id: string, patch: Partial<GrowthGoal>) =>
    persistGoals(goals.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: today() } : g)));

  const levelFor = (competency: string) =>
    levels.find((l) => l.ownerEmail.toLowerCase() === email && l.competency === competency);
  const setSelfLevel = (competency: (typeof competencies)[number], value: number) => {
    const lvl = clampLevel(value);
    const existing = levelFor(competency);
    const next: CompetencyLevel = existing
      ? { ...existing, selfLevel: lvl, updatedAt: today() }
      : { id: makeGrowthId('GRC'), ownerEmail: email, competency, selfLevel: lvl, evidence: '', updatedAt: today() };
    persistLevels(existing ? levels.map((l) => (l.id === existing.id ? next : l)) : [...levels, next]);
    pushLog({ id: makeGrowthId('GLG'), ownerEmail: email, competency, level: lvl, by: 'self', at: nowISO() });
  };
  const setEvidence = (competency: (typeof competencies)[number], value: string) => {
    const existing = levelFor(competency);
    if (!existing) {
      persistLevels([...levels, { id: makeGrowthId('GRC'), ownerEmail: email, competency, selfLevel: 1, evidence: value, updatedAt: today() }]);
    } else {
      persistLevels(levels.map((l) => (l.id === existing.id ? { ...l, evidence: value, updatedAt: today() } : l)));
    }
  };
  const myLog = log.filter((e) => e.ownerEmail.toLowerCase() === email);

  return (
    <>
      <h3 className="growth-h"><Target size={16} /> 성장 목표</h3>
      <div className="growth-newgoal">
        <input placeholder="이번 분기 성장 목표 (예: 코드리뷰 습관화)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="세부 내용 (선택)" value={detail} onChange={(e) => setDetail(e.target.value)} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="primary-button" onClick={addGoal}><Plus size={16} /> 목표 추가</button>
      </div>
      {myGoals.length === 0 && <p className="growth-empty">아직 성장 목표가 없어요. 이번 분기 목표를 하나 세워보세요.</p>}
      {myGoals.map((g) => (
        <div key={g.id} className="growth-goal">
          <div className="growth-goal-head">
            <strong>{g.title}</strong>
            <span className={`growth-status s-${g.status}`}>{g.status}</span>
          </div>
          {g.detail && <p className="growth-goal-detail">{g.detail}</p>}
          <div className="growth-progress">
            <input type="range" min={0} max={100} value={g.progress}
              onChange={(e) => { const p = clampProgress(Number(e.target.value)); updateGoal(g.id, { progress: p, status: nextStatus(p) }); }} />
            <span>{g.progress}%</span>
          </div>
          <div className="growth-goal-foot">
            {g.due && <span>기한 {g.due}</span>}
            <button className="secondary-button" onClick={() => updateGoal(g.id, { status: g.status === '보류' ? '진행중' : '보류' })}>
              {g.status === '보류' ? '재개' : '보류'}
            </button>
          </div>
          {g.leaderComment && <div className="role-note"><strong>리더 코멘트</strong><span>{g.leaderComment}</span></div>}
        </div>
      ))}

      <h3 className="growth-h"><TrendingUp size={16} /> 역량 레벨</h3>
      {competencies.map((c) => {
        const lvl = levelFor(c);
        const series = curveSeries(myLog, c, 'self');
        return (
          <div key={c} className="growth-comp">
            <div className="growth-comp-head">
              <strong>{c}</strong>
              <Sparkline series={series.map((p) => p.level)} />
            </div>
            <div className="growth-levels">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={lvl?.selfLevel === n ? 'lv active' : 'lv'} onClick={() => setSelfLevel(c, n)}>{n}</button>
              ))}
              {lvl?.leaderLevel != null && <span className="growth-leaderlv">리더 합의 {lvl.leaderLevel}</span>}
            </div>
            <input className="growth-evidence" placeholder="근거 한 줄 (예: A프로젝트 리드)" value={lvl?.evidence ?? ''}
              onChange={(e) => setEvidence(c, e.target.value)} />
          </div>
        );
      })}
    </>
  );
}

// ── 팀 성장(리더) ──
function TeamView({
  accounts, goals, levels, persistGoals, persistLevels, pushLog,
}: {
  accounts: ManagedAccount[]; goals: GrowthGoal[]; levels: CompetencyLevel[];
  persistGoals: (g: GrowthGoal[]) => void; persistLevels: (l: CompetencyLevel[]) => void; pushLog: (e: CompetencyLogEntry) => void;
}) {
  const members = accounts.filter((a) => a.status === '활성');
  const [email, setEmail] = useState(members[0]?.email.toLowerCase() ?? '');
  const memberGoals = goals.filter((g) => g.ownerEmail.toLowerCase() === email);
  const memberLevels = levels.filter((l) => l.ownerEmail.toLowerCase() === email);

  const comment = (id: string, text: string) =>
    persistGoals(goals.map((g) => (g.id === id ? { ...g, leaderComment: text } : g)));
  const agreeLevel = (lvl: CompetencyLevel, value: number) => {
    const v = clampLevel(value);
    persistLevels(levels.map((l) => (l.id === lvl.id ? { ...l, leaderLevel: v, updatedAt: today() } : l)));
    pushLog({ id: makeGrowthId('GLG'), ownerEmail: lvl.ownerEmail, competency: lvl.competency, level: v, by: 'leader', at: nowISO() });
  };

  return (
    <>
      <div className="growth-newgoal">
        <select value={email} onChange={(e) => setEmail(e.target.value)}>
          {members.map((m) => <option key={m.id} value={m.email.toLowerCase()}>{m.name} · {m.part}</option>)}
        </select>
      </div>
      <h3 className="growth-h"><Target size={16} /> 성장 목표 · 정렬</h3>
      {memberGoals.length === 0 && <p className="growth-empty">이 팀원은 아직 성장 목표가 없어요.</p>}
      {memberGoals.map((g) => (
        <div key={g.id} className="growth-goal">
          <div className="growth-goal-head"><strong>{g.title}</strong><span className={`growth-status s-${g.status}`}>{g.status} · {g.progress}%</span></div>
          {g.detail && <p className="growth-goal-detail">{g.detail}</p>}
          <textarea className="growth-comment" placeholder="리더 코멘트로 성장을 정렬해요" value={g.leaderComment}
            onChange={(e) => comment(g.id, e.target.value)} />
        </div>
      ))}
      <h3 className="growth-h"><TrendingUp size={16} /> 역량 합의</h3>
      {memberLevels.length === 0 && <p className="growth-empty">아직 자가 역량 평가가 없어요.</p>}
      {memberLevels.map((l) => (
        <div key={l.id} className="growth-comp">
          <div className="growth-comp-head"><strong>{l.competency}</strong><span className="growth-leaderlv">자가 {l.selfLevel}{l.leaderLevel != null ? ` · 합의 ${l.leaderLevel}` : ''}</span></div>
          {l.evidence && <p className="growth-goal-detail">{l.evidence}</p>}
          <div className="growth-levels">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={l.leaderLevel === n ? 'lv active' : 'lv'} onClick={() => agreeLevel(l, n)}>{n}</button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// 아주 단순한 스파크라인(레벨 1–5 추이). 하드코딩 색 대신 currentColor.
function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return <span className="growth-spark-empty">추이 없음</span>;
  const w = 64, h = 20, max = 5, min = 1;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="growth-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
