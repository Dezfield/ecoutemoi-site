import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info' | 'warning';

/**
 * Inline message. Errors use role="alert" so screen readers announce them;
 * other tones are polite status updates.
 */
export function Notice({ tone = 'info', title, children, action }: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="notice-copy">
        {title ? <p className="notice-title">{title}</p> : null}
        {children ? <div className="notice-body">{children}</div> : null}
      </div>
      {action ? <div className="notice-action">{action}</div> : null}
    </div>
  );
}
