import { Component, type ReactNode } from 'react';

type State = { failed: boolean };

/**
 * Last-resort guard against a blank screen. Shows a neutral message; no
 * stack trace or error text reaches the user, and nothing is logged that
 * could contain session data.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen-center" role="alert">
        <h1 className="status-title">Что-то пошло не так</h1>
        <p className="status-text">Страница не смогла загрузиться. Обновите её или вернитесь позже.</p>
        <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
          Обновить страницу
        </button>
      </main>
    );
  }
}
