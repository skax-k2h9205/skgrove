import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export type ToastTone = 'ok' | 'error';
export type Toast = { id: number; text: string; tone: ToastTone };

const VISIBLE_MS = 3200;

/**
 * 저장·전송·확정 결과를 알리는 최소한의 상태 레이어.
 *
 * 이전에는 접수 저장도, 슬랙 전송도, 투표 확정도 전부 조용히 끝났다.
 * 성공했는지 실패했는지 사용자가 알 방법이 없었고, 실패는 catch에서 삼켜졌다.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notifyStatus = useCallback((text: string, tone: ToastTone = 'ok') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return { toasts, notifyStatus, dismiss };
}

export function ToastRegion({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    // aria-live="polite": 포커스를 뺏지 않고 읽어준다. 확정 버튼을 누른 자리에 그대로 있어야 한다.
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={toast.tone === 'error' ? 'toast error' : 'toast'}>
      {toast.tone === 'error' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
      {toast.text}
    </div>
  );
}
