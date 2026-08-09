/*
  AI 상담 챗봇 — 우하단 플로팅 캐릭터로 진입하는 위젯. 라우팅과 무관하게 App 루트에
  한 번만 뜬다. 두 모드: 🧭 상담(나+상대 성향 이해 → 중재 + 팀 유사사례) / 📖 룰 확인.

  설계 근거: docs/superpowers/specs/2026-08-07-ai-counsel-chatbot-design.md
  - 스트리밍(SSE)으로 답을 흘려 "대기"를 "읽기"로. 첫 토큰 전엔 shimmer 타이핑.
  - 당첨/상담 결정은 프록시(LLM)가, 성향·유사사례·룰 주입도 프록시가 조립. 키는 프록시에만.
  - AI 미설정(VITE_CHAT_ENDPOINT 없음)이면 위젯은 뜨되 안내만 — 앱은 안 깨진다.
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Send, Square, X } from 'lucide-react';
import {
  briefOf,
  streamChat,
  type ChatMode,
  type ChatRequest,
  type ChatTurn,
} from '../../aiChat';
import { insertCounselMessage, loadCounselMessages } from '../../counselStore';
import type { CounselMessage, CurrentUser, Agenda, Issue, Profile } from '../../types';
import { findSimilarCases } from './similarCases';
import { Markdownish } from './Markdownish';
import mascotUrl from './mascot.webp';

type ChatWidgetProps = {
  currentUser: CurrentUser;
  profiles: Profile[];
  issues: Issue[];
  agendas: Agenda[];
};

const MODE_INTRO: Record<ChatMode, string> = {
  counsel:
    '안녕하세요, 팀 마음상담이에요. 요즘 어떤 일로 마음이 무거운가요? 누구와의 일이라면 아래에서 이름을 골라 주면 서로의 성향을 함께 살펴볼게요.',
  rule: '팀 운영·예산·근태·AI 도구·KPI 규칙과 SK하이닉스 출입·보안 절차를 안내해요. 예: "전표 승인 기한?", "의욕관리비 한도?", "하이닉스 상시 출입증 어떻게 받아요?"',
};

const PLACEHOLDER: Record<ChatMode, string> = {
  counsel: '고민을 편하게 적어보세요…',
  rule: '팀 규칙을 물어보세요…',
};

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5)}`;
}

/*
  마음상담 마스코트. 외부 이미지 없이 SVG로 그린다(이모지 아이콘 금지 규칙 준수).
  납작한 점 두 개 대신 눈동자·하이라이트·볼터치·부드러운 미소를 넣어 상담봇답게 만든다.
  색은 CSS 클래스 → 토큰으로만(하드코딩 금지). FAB에선 버튼 배경(파랑)이 곧 얼굴이 된다.
*/
function Mascot() {
  return (
    <svg viewBox="0 0 48 48" className="chat-mascot-face" aria-hidden="true">
      <circle cx="24" cy="24" r="22" className="chat-mascot-bg" />
      {/* 볼터치 — 따뜻한 인상 */}
      <circle cx="13.5" cy="28" r="3.4" className="chat-mascot-cheek" />
      <circle cx="34.5" cy="28" r="3.4" className="chat-mascot-cheek" />
      {/* 눈: 흰자 + 눈동자 + 하이라이트 */}
      <ellipse cx="17.5" cy="21" rx="4" ry="4.7" className="chat-mascot-eye" />
      <ellipse cx="30.5" cy="21" rx="4" ry="4.7" className="chat-mascot-eye" />
      <circle cx="18.4" cy="21.8" r="2" className="chat-mascot-pupil" />
      <circle cx="31.4" cy="21.8" r="2" className="chat-mascot-pupil" />
      <circle cx="17.3" cy="20.2" r="0.9" className="chat-mascot-glint" />
      <circle cx="30.3" cy="20.2" r="0.9" className="chat-mascot-glint" />
      {/* 부드러운 미소 */}
      <path d="M18 30.5c2.4 3 9.6 3 12 0" className="chat-mascot-smile" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* 생성한 PNG 마스코트를 쓰고, 로드 실패(에셋 누락 등) 시 위 SVG 로 폴백한다. */
function MascotImg() {
  const [failed, setFailed] = useState(false);
  if (failed) return <Mascot />;
  return <img className="chat-mascot-img" src={mascotUrl} alt="" onError={() => setFailed(true)} />;
}

export function ChatWidget({ currentUser, profiles, issues, agendas }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<ChatMode>('counsel');
  const [partner, setPartner] = useState('');
  const [messages, setMessages] = useState<CounselMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  const sessionId = useRef(newId('CS')).current;
  // 진행 중인 요청. 취소하거나 위젯을 닫을 때 끊는다.
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 대화 기록은 위젯을 처음 열 때 한 번만 불러온다.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    void loadCounselMessages(currentUser.email).then(setMessages);
  }, [open, loaded, currentUser.email]);

  // 새 메시지·스트리밍이 늘면 항상 맨 아래로.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, draft, open, mode]);

  // 열리면 입력창에 포커스.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, mode]);

  const selfProfile = useMemo(
    () => profiles.find((p) => p.name === currentUser.name),
    [profiles, currentUser.name],
  );
  const partnerNames = useMemo(
    () => profiles.map((p) => p.name).filter((name) => name !== currentUser.name),
    [profiles, currentUser.name],
  );

  const thread = messages.filter((m) => m.mode === mode);

  /**
   * 새 질문을 보내거나(retry:false), 마지막 질문을 다시 청한다(retry:true).
   * 다시 시도가 첫 전송과 같은 경로를 타야 "왜 이번만 다르지"가 생기지 않는다.
   *
   * 재시도 여부는 인자로 **명시**한다. 입력창이 비었는지로 추측하면, 에러가 뜬 채로
   * 뭔가 입력해 두고 [다시 시도]를 누른 사람이 엉뚱한 걸 보내게 된다.
   */
  const send = async ({ retry = false }: { retry?: boolean } = {}) => {
    if (streaming) return;
    const content = input.trim();
    const retrying = retry;
    if (!content && !retrying) return;
    setError(null);

    const usePartner = mode === 'counsel' && partner ? partner : undefined;
    let sent = thread;
    let lastAsked = thread.filter((m) => m.role === 'user').at(-1)?.content ?? '';

    if (!retrying) {
      setInput('');
      const userMsg: CounselMessage = {
        id: newId('CM'),
        sessionId,
        author: currentUser.email,
        mode,
        role: 'user',
        content,
        partnerName: usePartner,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      void insertCounselMessage(userMsg);
      sent = [...thread, userMsg];
      lastAsked = content;
    }
    if (!lastAsked) return;

    const turns: ChatTurn[] = sent.map((m) => ({ role: m.role, content: m.content }));
    const request: ChatRequest =
      mode === 'counsel'
        ? {
            mode,
            messages: turns,
            self: briefOf(selfProfile),
            partner: briefOf(profiles.find((p) => p.name === partner)),
            cases: findSimilarCases(lastAsked, issues, agendas),
          }
        : { mode, messages: turns };

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setDraft('');
    let acc = '';
    const result = await streamChat(
      request,
      (token) => {
        acc += token;
        setDraft(acc);
      },
      controller.signal,
    );
    abortRef.current = null;
    setStreaming(false);
    setDraft('');

    if (result.ok && acc.trim()) {
      const botMsg: CounselMessage = {
        id: newId('CM'),
        sessionId,
        author: currentUser.email,
        mode,
        role: 'assistant',
        content: acc.trim(),
        partnerName: usePartner,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      void insertCounselMessage(botMsg);
    } else if (result.reason === 'aborted') {
      // 내가 멈춘 것을 실패로 알리지 않는다. 질문은 대화에 남아 다시 시도로 이어갈 수 있다.
    } else if (result.reason === 'disabled') {
      setError('AI가 아직 연결되지 않았어요. 관리자가 챗봇 서버(VITE_CHAT_ENDPOINT)를 설정하면 답할 수 있어요.');
    } else {
      setError('답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!open) {
    return (
      <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-label="AI 상담 열기">
        <MascotImg />
      </button>
    );
  }

  return (
    <section
      className={expanded ? 'chat-panel expanded' : 'chat-panel'}
      role="dialog"
      aria-label="AI 상담"
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <header className="chat-head">
        <div className="chat-head-id">
          <span className="chat-head-mascot"><MascotImg /></span>
          <div>
            <strong>팀 마음상담</strong>
            <span className="chat-head-sub">오은영 선생님처럼, 팀 규칙을 근거로</span>
          </div>
        </div>
        <div className="chat-head-actions">
          <button
            type="button"
            className="chat-close"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? '작게' : '크게'}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="chat-modes" role="tablist" aria-label="모드">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'counsel'}
          className={mode === 'counsel' ? 'on' : ''}
          onClick={() => setMode('counsel')}
        >
          🧭 상담
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'rule'}
          className={mode === 'rule' ? 'on' : ''}
          onClick={() => setMode('rule')}
        >
          📖 룰 확인
        </button>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-msg bot">
          <div className="chat-bubble">{MODE_INTRO[mode]}</div>
        </div>
        {thread.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'chat-msg me' : 'chat-msg bot'}>
            <div className="chat-bubble">
              {m.role === 'assistant' ? <Markdownish text={m.content} /> : m.content}
              {/* 상담 답변은 길고, 메모나 메시지로 옮겨 적고 싶어진다. */}
              {m.role === 'assistant' && (
                <button
                  type="button"
                  className="chat-copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText(m.content).then(() => {
                      setCopied(m.id);
                      window.setTimeout(() => setCopied(null), 1500);
                    });
                  }}
                >
                  {copied === m.id ? '복사했어요' : '복사'}
                </button>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="chat-msg bot">
            <div className="chat-bubble">
              {draft ? (
                <Markdownish text={draft} />
              ) : (
                <span className="chat-typing" aria-label="작성 중">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          </div>
        )}
        {/* 지금까지는 문구만 남아서 질문을 손으로 또 쳐야 했다. 질문은 이미 위에 있다. */}
        {error && (
          <p className="chat-error">
            {error}
            <button type="button" onClick={() => void send({ retry: true })} disabled={streaming}>
              다시 시도
            </button>
          </p>
        )}
      </div>

      {mode === 'counsel' && (
        <label className="chat-partner">
          갈등 상대(선택)
          <select value={partner} onChange={(e) => setPartner(e.target.value)}>
            <option value="">지정 안 함</option>
            {partnerNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="chat-input">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER[mode]}
          rows={1}
        />
        {streaming ? (
          // 답이 20~40초 걸린다. 잘못 보냈을 때 되돌릴 길이 없으면 그냥 기다리는 수밖에 없다.
          <button type="button" onClick={() => abortRef.current?.abort()} aria-label="그만 받기">
            <Square size={16} />
          </button>
        ) : (
          <button type="button" onClick={() => void send()} disabled={!input.trim()} aria-label="보내기">
            <Send size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
