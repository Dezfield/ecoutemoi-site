import { type ReactNode, useEffect, useId, useRef } from 'react';

/**
 * Modal confirmation built on the native <dialog> element: focus is moved
 * into the dialog and trapped by the browser, Escape cancels, and focus
 * returns to the previously focused control when it closes.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Отмена',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId} className="dialog-title">{title}</h2>
      <div id={bodyId} className="dialog-body">{children}</div>
      <div className="dialog-actions">
        <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy} autoFocus>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`button ${danger ? 'button-danger' : 'button-primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Подождите…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
