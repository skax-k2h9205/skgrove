import { useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Lock, LockOpen, Shuffle, Users } from 'lucide-react';
import { PanelHeader } from '../../components/PanelHeader';
import { EmptyState } from '../../components/EmptyState';
import { generationLabelOf } from '../../generation';
import {
  AXES,
  LAYOUTS,
  arrange,
  conflicts,
  totalSeats,
  unavoidable,
  type LayoutKey,
  type Line,
  type Seatable,
} from '../../seatingRules';
import { SEATING_KEY, loadConfig, saveConfig } from '../../configStore';
import type { ManagedAccount, Profile } from '../../types';

/*
  회식 자리배치(커넥셔너 전용).

  명단은 활성 계정에서 오고, 연령대는 프로필의 생년에서 자동으로 채운다.
  성별만 DB에 없어서(accounts·profiles 어디에도 컬럼이 없다) 이 화면에서 받고
  이 기기에만 남긴다 — 다른 화면으로 새지 않는다.
*/

// 성별·참석 입력은 이 기기에만 남긴다. 확정된 배치만 팀 공용(app_config)으로 나간다.
const OVERRIDE_KEY = 'skgrove:seating:overrides';
const WRAP = 8; // 도면에서 한 번에 보여줄 좌석 수(표시 전용 — 자리 관계는 안 바뀐다)
const SEXES = ['남', '여'];
const AGES = ['새싹', '브릿지', '든든한'];

type Override = { sex?: string; age?: string; out?: boolean };
type Overrides = Record<string, Override>;

type Confirmed = { at: string; layout: LayoutKey; lines: { A: (string | null)[]; B: (string | null)[] }[] };

type SeatRef = { li: number; row: 'A' | 'B'; col: number };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 용량 초과 등 무시 */
  }
}

function stamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

type SeatingProps = {
  accounts: ManagedAccount[];
  profiles: Profile[];
  // 커넥셔너만 편집한다. 팀원은 확정된 배치를 읽기만 한다.
  canEdit: boolean;
  // 모임에서 넘어왔을 때의 출처. 신청자를 '참석'으로 맞춰줄 뿐,
  // 명단은 활성 계정 전체를 그대로 보여준다 — 신청 안 한 사람도 넣을 수 있어야 한다.
  source?: { key: string; title: string; names: string[] } | null;
};

export function Seating({ accounts, profiles, canEdit, source }: SeatingProps) {
  const [overrides, setOverrides] = useState<Overrides>(() => readJson<Overrides>(OVERRIDE_KEY, {}));
  const [layout, setLayout] = useState<LayoutKey>('2열');
  const [lines, setLines] = useState<Line[]>([]);
  const [locked, setLocked] = useState<string | null>(null);
  const [picked, setPicked] = useState<SeatRef | null>(null);
  const [manual, setManual] = useState(false);
  const [copied, setCopied] = useState('');

  // 활성 계정 + 프로필 생년 → 배치 대상. 성별·불참은 이 화면의 입력으로 덮어쓴다.
  const roster = useMemo<(Seatable & { out: boolean })[]>(() => {
    const birthByName = new Map(profiles.map((p) => [p.name, p.birthYear]));
    return accounts
      .filter((account) => account.status === '활성')
      .map((account) => {
        const edit = overrides[account.name] ?? {};
        return {
          name: account.name,
          part: account.part,
          sex: edit.sex ?? '',
          age: edit.age ?? generationLabelOf(birthByName.get(account.name) ?? ''),
          out: edit.out ?? false,
        };
      });
  }, [accounts, profiles, overrides]);

  const attending = useMemo(() => roster.filter((p) => !p.out), [roster]);
  const absent = useMemo(() => roster.filter((p) => p.out), [roster]);

  const reshuffle = (key: LayoutKey = layout) => {
    setLines(arrange(attending, key));
    setManual(false);
    setPicked(null);
  };

  // 첫 진입: 확정본(팀 공용)이 있으면 복원하고, 없으면 새로 섞는다.
  // 팀원은 확정본이 없으면 보여줄 것이 없다 — 그때는 섞지 않는다.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void loadConfig<Confirmed | null>(SEATING_KEY, null).then((saved) => {
      if (!alive) return;
      if (saved && LAYOUTS[saved.layout]) {
        const byName = new Map(roster.map((p) => [p.name, p]));
        setLayout(saved.layout);
        setLines(
          saved.lines.map((line) => ({
            cols: line.A.length,
            A: line.A.map((name) => (name ? byName.get(name) ?? null : null)),
            B: line.B.map((name) => (name ? byName.get(name) ?? null : null)),
          })),
        );
        setLocked(saved.at);
      } else if (canEdit) {
        setLines(arrange(attending, '2열'));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // 최초 1회만. 이후 재배치는 버튼·명단 변경이 일으킨다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    모임에서 넘어오면 그 모임의 확정 신청자만 참석으로 맞춘다.
    한 번만 맞추고 그 뒤로는 손대지 않는다 — 커넥셔너가 조정한 걸 되돌리면 안 되니까.
  */
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  useEffect(() => {
    if (!source || source.key === seededFrom || !accounts.length) return;
    const coming = new Set(source.names);
    const next: Overrides = { ...overrides };
    accounts
      .filter((account) => account.status === '활성')
      .forEach((account) => {
        next[account.name] = { ...next[account.name], out: !coming.has(account.name) };
      });
    setOverrides(next);
    writeJson(OVERRIDE_KEY, next);
    setSeededFrom(source.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, accounts, seededFrom]);

  const editPerson = (name: string, patch: Override) => {
    const next = { ...overrides, [name]: { ...overrides[name], ...patch } };
    setOverrides(next);
    writeJson(OVERRIDE_KEY, next);
    // 명단이 바뀌면 확정은 더 이상 유효하지 않다.
    if (locked) {
      void saveConfig(SEATING_KEY, null);
      setLocked(null);
    }
  };

  // 명단이 바뀌면 다시 섞는다(확정 중에는 건드리지 않는다).
  useEffect(() => {
    if (locked || !canEdit || loading) return;
    setLines(arrange(attending, layout));
    setManual(false);
    setPicked(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attending.length, overrides, layout]);

  const seatAt = (ref: SeatRef) => lines[ref.li]?.[ref.row][ref.col] ?? null;

  const swap = (a: SeatRef, b: SeatRef) => {
    if (a.li === b.li && a.row === b.row && a.col === b.col) return;
    const next = lines.map((line) => ({ cols: line.cols, A: line.A.slice(), B: line.B.slice() }));
    const first = next[a.li][a.row][a.col];
    next[a.li][a.row][a.col] = next[b.li][b.row][b.col];
    next[b.li][b.row][b.col] = first;
    setLines(next);
    setManual(true);
    setPicked(null);
  };

  const tapSeat = (ref: SeatRef) => {
    if (locked) return;
    if (!picked) {
      if (seatAt(ref)) setPicked(ref);
      return;
    }
    if (picked.li === ref.li && picked.row === ref.row && picked.col === ref.col) {
      setPicked(null);
      return;
    }
    swap(picked, ref);
  };

  const confirm = () => {
    const at = stamp();
    const payload: Confirmed = {
      at,
      layout,
      lines: lines.map((line) => ({
        A: line.A.map((p) => p?.name ?? null),
        B: line.B.map((p) => p?.name ?? null),
      })),
    };
    void saveConfig(SEATING_KEY, payload);
    setLocked(at);
    setPicked(null);
  };

  const unlock = () => {
    // 팀원 화면에서도 사라지도록 공용 값을 비운다.
    void saveConfig(SEATING_KEY, null);
    setLocked(null);
  };

  const seatLabel = (ref: SeatRef) =>
    `${lines.length > 1 ? `${ref.li + 1}줄 ` : ''}${ref.row}면 ${ref.col + 1}번`;

  const notice = useMemo(() => {
    const out: string[] = [];
    out.push(`[회식 자리배치] ${locked ?? '(확정 전 미리보기)'}`);
    out.push(`구성: ${layout} · ${LAYOUTS[layout].hint} · 총 ${totalSeats(lines)}석`);
    out.push(`참석: ${attending.length}명`);
    if (absent.length) out.push(`불참: ${absent.map((p) => p.name).join(', ')}`);
    out.push('');
    lines.forEach((line, li) => {
      if (lines.length > 1) out.push(`── ${li + 1}번째 줄 ──`);
      (['A', 'B'] as const).forEach((row) => {
        const seats = line[row]
          .map((p, i) => (p ? `${i + 1}. ${p.name}` : null))
          .filter(Boolean);
        out.push(`■ ${row}면 (왼쪽부터)`);
        out.push(`   ${seats.join('  ·  ') || '—'}`);
      });
      out.push('');
    });
    out.push('※ 같은 번호끼리 마주봅니다 (A면 3번 ↔ B면 3번).');
    return out.join('\n').trim();
  }, [lines, layout, locked, attending.length, absent]);

  const copyNotice = async () => {
    try {
      await navigator.clipboard.writeText(notice);
      setCopied(locked ? '복사했습니다.' : '복사했습니다 — 아직 확정 전입니다.');
    } catch {
      setCopied('복사에 실패했습니다. 아래 글을 직접 선택해 주세요.');
    }
  };

  const scores = conflicts(lines);
  const spare = totalSeats(lines) - attending.length;

  // 팀원은 확정된 배치만 본다. 없으면 보여줄 것이 없다.
  if (!canEdit && !locked) {
    return (
      <section className="screen">
        <EmptyState
          icon={Users}
          title={loading ? '불러오는 중…' : '아직 확정된 자리배치가 없어요'}
          description={loading ? '' : '자리가 정해지면 여기에서 확인할 수 있습니다.'}
        />
      </section>
    );
  }

  if (!accounts.length) {
    return (
      <section className="screen">
        <EmptyState icon={Users} title="활성 계정이 없습니다" description="계정 관리에서 참석자를 활성 상태로 바꾼 뒤 다시 열어주세요." />
      </section>
    );
  }

  return (
    <section className="screen">
      {canEdit && (
      <div className="panel">
        <PanelHeader icon={Users} title="명단" />
        {source && (
          <p className="seating-source">
            모임 <b>{source.title}</b> 신청자 {source.names.length}명을 참석으로 맞췄습니다.
            신청하지 않은 사람도 아래에서 체크하면 자리에 들어갑니다.
          </p>
        )}
        <p className="can-hint">
          활성 계정 {roster.length}명을 불러왔습니다. 연령대는 프로필의 생년에서 자동으로 채워지고,
          성별은 팀 데이터에 없어 여기서 받아 이 브라우저에만 남습니다.
        </p>

        <div className="seating-roster">
          {roster.map((person) => (
            <div key={person.name} className={person.out ? 'seating-row out' : 'seating-row'}>
              <label className="seating-attend" htmlFor={`attend-${person.name}`}>
                <input
                  id={`attend-${person.name}`}
                  type="checkbox"
                  checked={!person.out}
                  onChange={(event) => editPerson(person.name, { out: !event.target.checked })}
                />
                <span>{person.name}</span>
              </label>
              <span className="seating-part">{person.part}</span>
              <select
                id={`sex-${person.name}`}
                value={person.sex}
                onChange={(event) => editPerson(person.name, { sex: event.target.value })}
              >
                <option value="">성별 미입력</option>
                {SEXES.map((sex) => (
                  <option key={sex} value={sex}>{sex}</option>
                ))}
              </select>
              <select
                id={`age-${person.name}`}
                value={person.age}
                onChange={(event) => editPerson(person.name, { age: event.target.value })}
              >
                <option value="">연령대 미입력</option>
                {AGES.map((age) => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      )}

      {canEdit && (
      <div className="panel">
        <PanelHeader icon={Shuffle} title="배치" />
        <div className="seating-controls">
          <div className="segmented">
            {(Object.keys(LAYOUTS) as LayoutKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={key === layout ? 'selected' : ''}
                disabled={!!locked}
                onClick={() => setLayout(key)}
              >
                {key} · {LAYOUTS[key].hint}
              </button>
            ))}
          </div>
          <button className="secondary-button" type="button" disabled={!!locked} onClick={() => reshuffle()}>
            <Shuffle size={16} />
            다시 섞기
          </button>
          {locked ? (
            <button className="secondary-button" type="button" onClick={unlock}>
              <LockOpen size={16} />
              확정 해제
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={confirm}>
              <Lock size={16} />
              이 배치로 확정
            </button>
          )}
          {locked && <span className="seating-lock">확정됨 · {locked}</span>}
        </div>

        <dl className="seating-scores">
          {AXES.map((axis) => {
            const known = attending.filter((p) => p[axis.key]).length;
            const cant = unavoidable(attending, axis.key);
            const n = scores[axis.key] ?? 0;
            const tone = known === 0 ? '' : n === 0 ? ' ok' : cant || n <= 3 ? ' mid' : ' bad';
            return (
              <div className={`seating-score${tone}`} key={axis.key}>
                <dt>{axis.label} 겹침 (가중치 {axis.weight})</dt>
                <dd>
                  {known === 0 ? '미입력 — 조건에서 제외' : `${n}건`}
                  {known > 0 && cant && n > 0 && <small>한쪽이 과반이라 0건은 불가능합니다</small>}
                </dd>
              </div>
            );
          })}
          <div className="seating-score">
            <dt>좌석</dt>
            <dd>
              {attending.length} / {totalSeats(lines)}석
              <small>{spare >= 0 ? `빈자리 ${spare}석` : `⚠ ${-spare}명 초과 — 뒤쪽이 배치되지 않습니다`}</small>
            </dd>
          </div>
        </dl>
      </div>
      )}

      {locked && !canEdit && (
        <p className="seating-source">확정된 자리배치입니다 · {locked}</p>
      )}

      {canEdit && (
      <p className="can-hint">
        {locked
          ? '확정된 배치입니다. 자리를 옮기려면 먼저 확정을 해제하세요.'
          : picked
            ? `${seatAt(picked)?.name ?? ''} 님을 집었습니다 — 바꿀 자리를 누르세요.`
            : manual
              ? '두 자리를 차례로 눌러 맞바꿀 수 있습니다. 손으로 옮긴 배치이며, 다시 섞기를 누르면 사라집니다.'
              : '두 자리를 차례로 눌러 맞바꿀 수 있습니다.'}
      </p>
      )}

      <div className="seating-lines">
        {lines.map((line, li) => {
          const chunks: [number, number][] = [];
          for (let s = 0; s < line.cols; s += WRAP) chunks.push([s, Math.min(s + WRAP, line.cols)]);
          return (
            <div className="seating-line" key={li}>
              {lines.length > 1 && <span className="seating-linelabel">{li + 1}번째 줄</span>}
              {chunks.map(([from, to]) => (
                <div className="seating-room" key={from}>
                  <div className="seating-rail">
                    <span>A면</span>
                    <span className="mid" />
                    <span>B면</span>
                  </div>
                  <div className="seating-table">
                    {(['A', 'slab', 'B'] as const).map((which) =>
                      which === 'slab' ? (
                        <div className="seating-slab" key="slab">
                          {from + 1} ~ {to}번
                          {chunks.length > 1 && (to < line.cols ? '  →  이어짐' : '  ←  앞에서 이어짐')}
                        </div>
                      ) : (
                        <div className="seating-side" key={which}>
                          {line[which].slice(from, to).map((person, i) => {
                            const col = from + i;
                            const ref: SeatRef = { li, row: which, col };
                            const isPicked =
                              !!picked && picked.li === li && picked.row === which && picked.col === col;
                            return (
                              <button
                                type="button"
                                key={col}
                                className={`seating-seat${person ? '' : ' vacant'}${isPicked ? ' picked' : ''}`}
                                data-part={person?.part}
                                disabled={!!locked || !canEdit}
                                onClick={() => tapSeat(ref)}
                              >
                                <span className="no">{col + 1}</span>
                                <span className="nm">{person?.name ?? '빈자리'}</span>
                                {person && <span className="pt">{person.part}</span>}
                                {canEdit && person && (person.sex || person.age) && (
                                  <span className="meta">{[person.sex, person.age].filter(Boolean).join(' · ')}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {absent.length > 0 && (
        <div className="panel">
          <PanelHeader icon={Users} title={`불참 ${absent.length}명`} />
          <p className="can-hint">배치와 공지문에서 빠져 있습니다. 명단에서 체크하면 다시 들어옵니다.</p>
          <div className="seating-absent">
            {absent.map((person) => (
              <span key={person.name}>
                <b>{person.name}</b> {person.part}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <PanelHeader icon={ClipboardCopy} title="공지문" />
        <div className="seating-controls">
          <button className="secondary-button" type="button" onClick={copyNotice}>
            <ClipboardCopy size={16} />
            공지문 복사
          </button>
          {copied && <span className="can-hint">{copied}</span>}
        </div>
        <pre className="seating-notice">{notice}</pre>
      </div>
    </section>
  );
}
