import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import { useAccountData } from '../account/AccountDataProvider';
import { entitlementLabel } from '../account/labels';
import { useAuth } from '../auth/AuthProvider';
import { Wordmark } from '../components/BrandMark';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { Notice } from '../components/Notice';
import { config } from '../config';
import { initials } from '../lib/format';
import { accountNavigation } from './navigation';

function Identity() {
  const { user } = useAuth();
  const { summary, entitlement } = useAccountData();
  const name = summary.data?.displayName ?? '';
  const photoUrl = summary.data?.photoUrl ?? null;
  const plan = entitlement.data?.active ? entitlementLabel(entitlement.data) : null;
  return (
    <div className="identity">
      <span className="avatar avatar-small" aria-hidden="true">
        {photoUrl ? <img src={photoUrl} alt="" /> : <span>{initials(name || user?.email)}</span>}
      </span>
      <span className="identity-copy">
        <span className="identity-name">{name || 'Ваш аккаунт'}</span>
        <span className="identity-meta">{plan ?? user?.email ?? ''}</span>
      </span>
    </div>
  );
}

function AccountNav({ onSignOut }: { onSignOut: () => void }) {
  return (
    <nav className="account-nav" aria-label="Разделы личного кабинета">
      <Identity />
      {accountNavigation.map((group, index) => (
        <div className="nav-group" key={group.title ?? `group-${index}`}>
          {group.title ? <p className="nav-group-title">{group.title}</p> : null}
          <ul>
            {group.items.map((item) => (
              <li key={item.label}>
                {item.kind === 'route' ? (
                  <NavLink to={item.to} end={item.end} className="nav-link">
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                ) : (
                  <a href={item.href} className="nav-link">
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    <Icon name="external" size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="nav-group nav-footer">
        <ul>
          <li>
            <a href={config.links.home} className="nav-link">
              <Icon name="wave" />
              <span>На сайт Écoute Moi</span>
            </a>
          </li>
          <li>
            <button type="button" className="nav-link" onClick={onSignOut}>
              <Icon name="logout" />
              <span>Выйти</span>
            </button>
          </li>
          <li>
            <NavLink to="/account/delete" className="nav-link">
              <Icon name="trash" />
              <span>Удаление аккаунта</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export function AccountLayout() {
  const { status, profileError, refreshProfileState, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const firstRender = useRef(true);

  // Close the mobile menu after navigation and move focus to the new content
  // so keyboard and screen-reader users land on the page they opened.
  useEffect(() => {
    setMenuOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (menuOpen && !drawer.open) drawer.showModal();
    if (!menuOpen && drawer.open) {
      drawer.close();
      menuButtonRef.current?.focus();
    }
  }, [menuOpen]);

  const requestSignOut = () => {
    setMenuOpen(false);
    setSignOutError(null);
    setConfirmSignOut(true);
  };

  const performSignOut = async () => {
    setSigningOut(true);
    try {
      // ProtectedRoute sends the signed-out visitor to /login, where the notice is shown.
      await signOut('Вы вышли из аккаунта. Профиль и данные сохранены.');
    } catch {
      setSignOutError('Не удалось выйти. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  };

  const retryProfile = async () => {
    setRetrying(true);
    try {
      await refreshProfileState();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="account-shell">
      <a className="skip-link" href="#account-content">Перейти к содержимому</a>

      <aside className="sidebar">
        <Link to="/voices" className="sidebar-brand" aria-label="Écoute Moi — Голоса">
          <Wordmark />
        </Link>
        <AccountNav onSignOut={requestSignOut} />
      </aside>

      <header className="topbar">
        <Link to="/voices" className="sidebar-brand" aria-label="Écoute Moi — Голоса">
          <Wordmark caption={false} />
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-controls="account-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" />
          <span>Меню</span>
        </button>
      </header>

      <dialog
        id="account-drawer"
        ref={drawerRef}
        className="drawer"
        aria-label="Меню личного кабинета"
        onCancel={(event) => {
          event.preventDefault();
          setMenuOpen(false);
        }}
        onClick={(event) => {
          if (event.target === drawerRef.current) setMenuOpen(false);
        }}
      >
        <div className="drawer-panel">
          <div className="drawer-head">
            <Wordmark caption={false} />
            <button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню">
              <Icon name="close" />
            </button>
          </div>
          <AccountNav onSignOut={requestSignOut} />
        </div>
      </dialog>

      <main id="account-content" ref={mainRef} tabIndex={-1} className="account-main">
        <div className="account-content">
          {profileError ? (
            <Notice
              tone="error"
              title="Профиль временно недоступен"
              action={
                <button type="button" className="button button-secondary button-small" onClick={() => void retryProfile()} disabled={retrying}>
                  {retrying ? 'Проверяем…' : 'Повторить'}
                </button>
              }
            >
              <p>{profileError}</p>
            </Notice>
          ) : null}
          {status === 'onboarding_required' ? (
            <Notice tone="warning" title="Завершите создание профиля в приложении Écoute Moi">
              <p>
                Анкета, аудиописьмо и фотографии создаются в мобильном приложении. Аккаунт уже работает: здесь можно
                посмотреть способы входа, статус аккаунта и заблокированных пользователей.
              </p>
            </Notice>
          ) : null}
          {signOutError ? <Notice tone="error">{signOutError}</Notice> : null}
          <Outlet />
        </div>
      </main>

      <nav className="product-bottom-nav" aria-label="Основные разделы">
        <NavLink to="/voices"><Icon name="wave" /><span>Голоса</span></NavLink>
        <NavLink to="/resonances"><Icon name="star" /><span>Резонансы</span></NavLink>
        <NavLink to="/chats"><Icon name="bell" /><span>Чаты</span></NavLink>
        <NavLink to="/account"><Icon name="profile" /><span>Профиль</span></NavLink>
      </nav>

      <ConfirmDialog
        open={confirmSignOut}
        title="Выйти из аккаунта?"
        confirmLabel="Выйти"
        busy={signingOut}
        onConfirm={() => void performSignOut()}
        onCancel={() => setConfirmSignOut(false)}
      >
        <p>Вы выйдете только в этом браузере. Профиль, Резонансы и разговоры останутся в вашем аккаунте.</p>
      </ConfirmDialog>
    </div>
  );
}
