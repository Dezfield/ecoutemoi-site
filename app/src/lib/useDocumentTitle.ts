import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — Écoute Moi` : 'Écoute Moi — Личный кабинет';
  }, [title]);
}
