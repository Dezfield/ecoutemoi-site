import { Spinner } from './Spinner';
import { BrandMark } from './BrandMark';

/** Full-screen placeholder shown while the session is restored. No private data is rendered. */
export function LoadingScreen({ label = 'Загружаем личный кабинет…' }: { label?: string }) {
  return (
    <main className="screen-center" aria-busy="true">
      <BrandMark size={56} />
      <Spinner label={label} />
    </main>
  );
}
