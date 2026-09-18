import { Link } from 'react-router';

import { Wordmark } from '../components/BrandMark';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Страница не найдена');
  return (
    <main className="screen-center">
      <Wordmark caption={false} />
      <p className="eyebrow">404</p>
      <h1 className="status-title">Здесь пока тихо.</h1>
      <p className="status-text">Такой страницы нет. Проверьте адрес или вернитесь в личный кабинет.</p>
      <Link to="/account" className="button button-primary">В личный кабинет</Link>
    </main>
  );
}
