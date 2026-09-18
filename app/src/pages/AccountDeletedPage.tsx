import { Link } from 'react-router';

import { config } from '../config';
import { AuthLayout } from '../layouts/AuthLayout';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function AccountDeletedPage() {
  useDocumentTitle('Аккаунт удалён');
  return (
    <AuthLayout>
      <h1 className="auth-title">Аккаунт удалён</h1>
      <p className="auth-lead">
        Доступ завершён. Профиль больше не показывается в Écoute Moi.
      </p>
      <div className="auth-links">
        <p><a href={config.links.home} className="button button-primary button-block">На сайт Écoute Moi</a></p>
        <p><Link to="/login">Ко входу</Link></p>
      </div>
    </AuthLayout>
  );
}
