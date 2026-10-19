import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AuthLayout } from '../layouts/AuthLayout';
import { acceptDocuments, documents, loadLegalState, withdrawConsent, type DocumentType, type LegalState } from './api';

function Document({ type, level = 3 }: { type: DocumentType; level?: 2 | 3 }) {
  const document = documents[type];
  const Heading = level === 2 ? 'h2' : 'h3';
  return <details className="legal-document"><summary>{document.title} · {document.version}</summary>
    {document.intro && <p>{document.intro}</p>}
    {document.sections.map((section) => <section key={section.title}><Heading>{section.title}</Heading>
      {section.body.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}
  </details>;
}

function useLegalState() {
  const { user } = useAuth();
  const [state, setState] = useState<LegalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadLegalState().then((value) => { if (alive) { setState(value); setError(null); } })
      .catch(() => { if (alive) setError('Не удалось проверить согласия. Проверьте соединение и повторите.'); });
    return () => { alive = false; };
  }, [user?.id, revision]);
  const action = async (run: () => Promise<LegalState>) => {
    setBusy(true); setError(null);
    try { setState(await run()); return true; }
    catch { setError('Не удалось сохранить выбор. Проверьте соединение; если редакция изменилась, обновите страницу и повторите.'); return false; }
    finally { setBusy(false); }
  };
  return { state, error, busy, action, setError, retry: () => setRevision((value) => value + 1) };
}

export function LegalAcceptanceScreen() {
  const auth = useAuth();
  const legal = useLegalState();
  const [terms, setTerms] = useState(false), [privacy, setPrivacy] = useState(false);
  return <AuthLayout><section className="legal-acceptance">
    <h1 className="auth-title">Прежде чем продолжить</h1>
    <p>Для использования Écoute Moi примите соглашение и ознакомьтесь с политикой. Добровольные согласия запрашиваются отдельно.</p>
    <Document type="terms" level={2} /><Document type="privacy_policy" level={2} />
    <label className="legal-check"><input type="checkbox" checked={terms} disabled={legal.busy} onChange={(event) => setTerms(event.target.checked)} /> Мне есть 18 лет. Я прочитал(а) и принимаю Пользовательское соглашение.</label>
    <label className="legal-check"><input type="checkbox" checked={privacy} disabled={legal.busy} onChange={(event) => setPrivacy(event.target.checked)} /> Я ознакомлен(а) с Политикой конфиденциальности.</label>
    {legal.state?.outdatedBuild && <p role="alert">Текст документов изменился. Обновите страницу, чтобы прочитать актуальную редакцию.</p>}
    {legal.error && <p role="alert">{legal.error} <button onClick={legal.retry}>Повторить</button></p>}
    {!legal.state && !legal.error && <p role="status">Проверяем документы…</p>}
    <button className="button button-primary" disabled={legal.busy || !legal.state?.available || legal.state.outdatedBuild || !terms || !privacy} onClick={() => {
      void legal.action(async () => { const state = await acceptDocuments(['terms', 'privacy_policy']); await auth.refreshProfileState(); return state; });
    }}>Принять и продолжить</button>
    <button className="button button-secondary" disabled={legal.busy} onClick={() => { void auth.signOut().catch(() => legal.setError('Не удалось выйти. Проверьте соединение и повторите.')); }}>Не принимаю — выйти</button>
    <p>Обращения и удаление аккаунта без входа: <a href="mailto:support@ecoutemoi.ru">support@ecoutemoi.ru</a>.</p>
  </section></AuthLayout>;
}

export function AudioPublicationConsent({ children }: { children: ReactNode }) {
  const legal = useLegalState();
  if (legal.state?.available && legal.state.accepted.audio_publication && legal.state.featureAvailable.audio_publication) return <>{children}</>;
  return <section className="panel" aria-label="Согласие на публикацию аудиописем">
    <Document type="audio_publication" />
    {legal.error && <p role="alert">{legal.error}</p>}
    {!legal.state && !legal.error && <p role="status">Проверяем согласие…</p>}
    {legal.state && !legal.state.available && <p>Публикация пока недоступна.</p>}
    {legal.state?.incompatible.audio_publication && <p>Текст согласия изменился. Обновите страницу, чтобы продолжить публикацию.</p>}
    <button className="button button-primary" disabled={legal.busy || !legal.state?.available || legal.state.incompatible.audio_publication || !legal.state.featureAvailable.audio_publication}
      onClick={() => { void legal.action(() => acceptDocuments(['audio_publication'])); }}>Согласен(на) на публикацию</button>
    {legal.error && <button className="button button-secondary" onClick={legal.retry}>Повторить проверку</button>}
    <p>Согласие добровольное. Без него можно продолжать пользоваться чатами и другими доступными функциями.</p>
  </section>;
}

export function ConsentSettings() {
  const legal = useLegalState();
  return <section className="panel" aria-labelledby="consents-title"><h2 id="consents-title">Мои согласия</h2>
    <p>Отзыв не удаляет аккаунт. Оператор получает обращение о прекращении обработки и рассмотрении удаления материалов; повторное письмо не требуется.</p>
    {legal.error && <p role="alert">{legal.error} <button onClick={legal.retry}>Повторить</button></p>}
    {!legal.state && !legal.error && <p role="status">Проверяем согласия…</p>}
    {legal.state?.available && (['audio_publication', 'selfie_verification'] as const).map((type) => <div key={type}>
      <h3>{documents[type].title}</h3><Document type={type} />
      <p>{legal.state!.accepted[type] ? 'Согласие дано' : legal.state!.withdrawable[type] ? 'Дано согласие на прежнюю редакцию' : 'Согласие не дано'}</p>
      {legal.state!.withdrawable[type] && <button className="button button-secondary" disabled={legal.busy} onClick={() => {
        const effect = type === 'audio_publication' ? 'Опубликованные письма исчезнут из ленты; новая публикация потребует согласия.' : 'Новые проверки и загрузки прекратятся.';
        if (window.confirm(`Отозвать согласие? ${effect}`)) void legal.action(() => withdrawConsent(type));
      }}>Отозвать согласие</button>}
    </div>)}
  </section>;
}
