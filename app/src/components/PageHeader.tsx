import type { ReactNode } from 'react';

import { useDocumentTitle } from '../lib/useDocumentTitle';

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      {children ? <div className="page-lead">{children}</div> : null}
    </header>
  );
}
