import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { getResonances, productError, reportResonance, respondToPhoto, signedMedia, type Resonance } from '../../product/api';

function ResonanceCard({ resonance, refresh }: { resonance: Resonance; refresh: () => void }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all((resonance.photo_paths ?? []).map((path) => signedMedia('dating-photos', path)))
      .then((urls) => { if (active) setPhotos(urls); })
      .catch((cause) => { if (active) setError(productError(cause)); });
    return () => { active = false; };
  }, [resonance.photo_paths]);
  async function decide(interested: boolean) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await respondToPhoto(resonance.resonance_id, interested); refresh(); }
    catch (cause) { setError(productError(cause)); }
    finally { setBusy(false); }
  }
  async function report() {
    if (busy || !window.confirm('Пожаловаться на анкету и заблокировать контакт?')) return;
    setBusy(true); setError(null);
    try { await reportResonance(resonance.resonance_id); refresh(); }
    catch (cause) { setError(productError(cause)); }
    finally { setBusy(false); }
  }
  return <article className="product-card">
    <p className="eyebrow">{resonance.stage === 'mutuality' ? 'Взаимность' : 'Резонанс'}</p>
    <h2>{resonance.display_name}</h2>
    <p className="product-muted">{resonance.age} лет · {resonance.city} · {resonance.relationship_goal}</p>
    {resonance.about ? <p>{resonance.about}</p> : null}
    {resonance.interests?.length ? <p>Интересы: {resonance.interests.join(', ')}</p> : null}
    <div className="product-photos">{photos.map((url) => <img key={url} src={url} alt={`Фотография ${resonance.display_name}`} />)}</div>
    {resonance.stage === 'resonance' && !resonance.my_photo_decision ? <div className="button-row">
      <button type="button" className="button button-primary" disabled={busy} onClick={() => void decide(true)}>Хочу продолжить</button>
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => void decide(false)}>Не сейчас</button>
    </div> : null}
    {resonance.my_photo_decision === 'interest' && resonance.stage === 'resonance' ? <p role="status">Ваш отклик отправлен. Ждём взаимности.</p> : null}
    {resonance.conversation_id ? <Link className="button button-primary" to={`/chats/${resonance.conversation_id}`}>Открыть чат</Link> : null}
    <button type="button" className="button button-ghost" disabled={busy} onClick={() => void report()}>Пожаловаться на анкету</button>
    {error ? <p role="alert" className="product-error">{error}</p> : null}
  </article>;
}

export function ResonancesPage() {
  const [items, setItems] = useState<Resonance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setError(null);
    try { setItems(await getResonances()); }
    catch (cause) { setError(productError(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="product-page">
    <PageHeader eyebrow="Взаимный интерес" title="Резонансы">Здесь открываются анкеты людей, с которыми вы откликнулись друг другу.</PageHeader>
    <div className="button-row"><button type="button" className="button button-secondary button-small" onClick={() => void load()}>Обновить</button></div>
    {loading ? <p role="status">Загружаем Резонансы…</p> : null}
    {error ? <p role="alert" className="product-error">{error}</p> : null}
    {!loading && !error && !items.length ? <p className="product-empty">Резонансов пока нет</p> : null}
    <div className="product-grid">{items.map((item) => <ResonanceCard key={item.resonance_id} resonance={item} refresh={() => void load()} />)}</div>
  </section>;
}
