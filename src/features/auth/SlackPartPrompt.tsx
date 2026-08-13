import { useState } from 'react';
import { HeartHandshake, ShieldCheck } from 'lucide-react';
import { teamParts } from '../../auth';
import type { TeamPart } from '../../types';

// 첫 슬랙 로그인(신규 @sk.com 계정)에게 소속 파트만 1회 물어보는 화면.
// Slack 이 이름·이메일은 주지만 파트는 회사 계정이 알려주지 않아, 파트지수·파트 필터가
// 동작하려면 최초 1회 본인이 고른다. 이후엔 계정 관리/내 정보에서 바꾼다.
type SlackPartPromptProps = {
  name: string;
  email: string;
  onConfirm: (part: TeamPart) => void;
  onCancel: () => void;
};

export function SlackPartPrompt({ name, email, onConfirm, onCancel }: SlackPartPromptProps) {
  const [part, setPart] = useState<TeamPart>('TEST혁신파트');

  return (
    <main className="login-page">
      <form
        aria-label="소속 파트 선택"
        className="login-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(part);
        }}
      >
        <div className="brand login-brand">
          <div className="brand-mark" title="SKonnection">
            <HeartHandshake size={24} />
          </div>
          <div>
            <strong>SKonnection</strong>
            <span>팀을 잇는 곳</span>
          </div>
        </div>

        <div className="role-note">
          <strong>
            <ShieldCheck size={15} /> {name || email}님, 환영해요
          </strong>
          <span>처음 로그인이에요. 소속 파트만 한 번 골라주시면 바로 시작합니다.</span>
        </div>

        <label>
          소속 파트
          <select value={part} onChange={(event) => setPart(event.target.value as TeamPart)}>
            {teamParts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <div className="login-actions">
          <button className="primary-button" type="submit">
            <ShieldCheck size={18} />
            시작하기
          </button>
          <button className="secondary-button" type="button" onClick={onCancel}>
            취소
          </button>
        </div>
      </form>
    </main>
  );
}
