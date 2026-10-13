import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  description?: string;
  /** When false, Escape and backdrop clicks do nothing (used for one-time secrets). */
  dismissible?: boolean;
  size?: 'md' | 'lg';
}

/** Built on the native <dialog>: focus trap, Escape and inert background come from the browser. */
export function Modal({ open, title, onClose, children, footer, description, dismissible = true, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onMouseDown={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="modal-body">
          <header className="modal-header">
            <h2 id={titleId}>{title}</h2>
            {dismissible ? (
              <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </header>
          {description ? (
            <p id={descId} className="muted">
              {description}
            </p>
          ) : null}
          <div className="modal-content">{children}</div>
          {footer ? <footer className="modal-footer">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
