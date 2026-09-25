import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { getVoices, productError, reportVoice, respondToVoice, signedMedia, type Voice } from '../../product/api';

const reasons = [
  ['thought', 'Зацепила мысль'], ['voice', 'Понравился голос'],
  ['values', 'Близки ценности'], ['curious', 'Хочу узнать больше'],
] as const;

function VoiceCard({ voice, onDecided }: { voice: Voice; onDecided: (id: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('thought');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportCategory, setReportCategory] = useState('inappropriate');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    let active = true;
    void signedMedia('dating-audio', voice.audio_path).then((value) => {
      if (active) setUrl(value);
    }).catch((cause) => { if (active) setError(productError(cause)); });
    return () => { active = false; };
  }, [voice.audio_path]);

  async function decide(interested: boolean) {
    if (busy || result) return;
    setBusy(true); setError(null);
    try {
      const response = await respondToVoice(voice.impression_id, interested, interested ? reason : null);
      setResult(response.result_status === 'resonance' ? 'Резонанс возник!' : interested ? 'Отклик отправлен' : 'Голос пропущен');
      onDecided(voice.impression_id);
    } catch (cause) { setError(productError(cause)); }
    finally { setBusy(false); }
  }

  async function report() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await reportVoice(voice.impression_id, reportCategory, reportDetails); setResult('Жалоба отправлена. Контакт заблокирован.'); setReporting(false); }
    catch (cause) { setError(productError(cause)); }
    finally { setBusy(false); }
  }

  return <article className="product-card voice-card">
    <p className="eyebrow">Аудиописьмо · {voice.audio_duration_seconds} сек.</p>
    <h2>{voice.prompt_key === 'good_day' ? 'Что вас вдохновляет?' : voice.prompt_key === 'want_to_hear' ? 'Какие отношения вы ищете?' : 'Голос нового человека'}</h2>
    <p className="product-muted">{[voice.age ? `${voice.age} лет` : null, voice.city, voice.relationship_goal].filter(Boolean).join(' · ')}</p>
    {voice.shared_interests?.length ? <p>Общие интересы: {voice.shared_interests.join(', ')}</p> : null}
    {url ? <audio controls preload="none" src={url} aria-label="Прослушать аудиописьмо" /> : <p role="status">Подготавливаем запись…</p>}
    <label className="product-select-label">Что заинтересовало?
      <select value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy || Boolean(result)}>
        {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <div className="button-row">
      <button type="button" className="button button-primary" onClick={() => void decide(true)} disabled={busy || Boolean(result)}>Отклик</button>
      <button type="button" className="button button-secondary" onClick={() => void decide(false)} disabled={busy || Boolean(result)}>Пропустить</button>
      <button type="button" className="button button-ghost" onClick={() => setReporting((value) => !value)} disabled={busy || Boolean(result)}>Пожаловаться</button>
    </div>
    {reporting ? <form className="form" onSubmit={(event) => { event.preventDefault(); void report(); }}>
      <label>Причина <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="spam">Спам</option><option value="harassment">Преследование</option><option value="impersonation">Выдаёт себя за другого</option><option value="inappropriate">Недопустимый контент</option><option value="other">Другое</option></select></label>
      <label>Комментарий <textarea maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} /></label>
      <button className="button button-danger-outline" type="submit" disabled={busy}>Отправить жалобу и заблокировать</button>
    </form> : null}
    {error ? <p role="alert" className="product-error">{error}</p> : null}
    {result ? <p role="status">{result} <Link to="/resonances">Открыть Резонансы</Link></p> : null}
  </article>;
}

export function VoicesPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true); setError(null);
    try { setVoices(await getVoices()); }
    catch (cause) { setError(productError(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="product-page">
    <PageHeader eyebrow="Начало знакомства" title="Голоса">Сначала послушайте человека. Анкета и фотографии откроются после взаимного отклика.</PageHeader>
    <Link to="/voices/record" className="button button-secondary">Моё аудиописьмо</Link>
    <div className="button-row"><button type="button" className="button button-secondary button-small" onClick={() => void load()}>Обновить</button></div>
    {loading ? <p role="status">Ищем новые Голоса…</p> : null}
    {error ? <p role="alert" className="product-error">{error}</p> : null}
    {!loading && !error && !voices.length ? <p className="product-empty">Пока нет новых Голосов</p> : null}
    <div className="product-grid">{voices.map((voice) => <VoiceCard key={voice.impression_id} voice={voice} onDecided={(id) => setVoices((current) => current.filter((item) => item.impression_id !== id))} />)}</div>
  </section>;
}
