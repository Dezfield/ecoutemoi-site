import type { ReactNode } from 'react';

import { Wordmark } from '../components/BrandMark';
import { config } from '../config';

/** Decorative waveform drawn as SVG geometry (no inline styles, CSP-friendly). */
function Waveform() {
  const count = 36;
  const bars = Array.from({ length: count }, (_, index) => {
    const envelope = Math.sin((index / (count - 1)) * Math.PI);
    const height = 14 + Math.pow(Math.sin(index * 1.63), 2) * (16 + 62 * envelope * envelope);
    return (
      <rect
        key={index}
        x={index * 9}
        y={(100 - height) / 2}
        width="4"
        height={height}
        rx="2"
        className={index % 3 === 2 ? 'wave-bar wave-bar-light' : 'wave-bar'}
      />
    );
  });
  return (
    <svg className="auth-wave" viewBox={`0 0 ${count * 9} 100`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {bars}
    </svg>
  );
}

/** Shared frame of the sign-in, sign-up, recovery and callback screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-content">Перейти к форме</a>
      <aside className="auth-aside">
        <a href={config.links.home} className="auth-brand" aria-label="Écoute Moi — на главную сайта">
          <Wordmark caption={false} />
        </a>
        <div className="auth-aside-copy">
          <p className="eyebrow">Личный кабинет · 18+</p>
          <p className="auth-motto">
            Слушать.<br />Слышать.<br /><em>Видеть.</em>
          </p>
          <p className="auth-aside-text">
            Один аккаунт для приложения и сайта. Войдите тем же способом, что и в приложении Écoute Moi.
          </p>
        </div>
        <Waveform />
      </aside>
      <main id="auth-content" className="auth-main">
        <div className="auth-mobile-brand">
          <a href={config.links.home} aria-label="Écoute Moi — на главную сайта">
            <Wordmark caption={false} />
          </a>
        </div>
        <div className="auth-card">{children}</div>
        <footer className="auth-footer">
          <a href={config.links.terms}>Условия использования</a>
          <a href={config.links.privacy}>Конфиденциальность</a>
          <a href={config.links.support}>Поддержка</a>
        </footer>
      </main>
    </div>
  );
}
