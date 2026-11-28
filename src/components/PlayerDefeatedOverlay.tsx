import type { ReactNode } from "react";

type Props = {
  busy: boolean;
  onRetry: () => void;
  onReturnToBaseCamp: () => void;
  /** Phase 5 · optional texts (Unit 3 Floor 4 game over); defaults keep the dungeon overlay unchanged */
  className?: string;
  eyebrow?: string;
  title?: string;
  message?: ReactNode;
  returnLabel?: string;
};

export function PlayerDefeatedOverlay({ busy, onRetry, onReturnToBaseCamp, className, eyebrow = "DUNGEON CHALLENGE", title = "쓰러졌습니다!", message = "잠시 정비한 뒤 다시 도전해 보자.", returnLabel = "베이스 캠프로 돌아가기" }: Props) {
  return (
    <div className={`dungeon-modal-backdrop dungeon-defeated-backdrop${className ? ` ${className}` : ""}`} role="presentation">
      <section className="dungeon-modal-panel" role="dialog" aria-modal="true" aria-labelledby="defeated-title">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="defeated-title">{title}</h2>
        <p>{message}</p>
        <div className="button-group">
          <button type="button" disabled={busy} onClick={onRetry}>다시 도전하기</button>
          <button type="button" disabled={busy} onClick={onReturnToBaseCamp}>{returnLabel}</button>
        </div>
      </section>
    </div>
  );
}
