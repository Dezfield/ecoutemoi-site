import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { saveOwnVoice } from '../../product/api';

export function RecordVoicePage() {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!blob) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function start() {
    if (busy || recording) return;
    setError(null); setSaved(false); setBlob(null); setElapsed(0);
    const mime = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) => window.MediaRecorder?.isTypeSupported(type));
    if (!navigator.mediaDevices?.getUserMedia || !mime) {
      setError('Этот браузер не поддерживает запись WebM или MP4. Прослушивание, Резонансы и Чаты остаются доступны.');
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const next = new MediaRecorder(media, { mimeType: mime });
      recorder.current = next;
      chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onerror = () => setError('Запись прервалась. Попробуйте ещё раз.');
      next.onstop = () => {
        const file = new Blob(chunks.current, { type: mime.includes('webm') ? 'audio/webm' : 'audio/mp4' });
        setBlob(file);
        media.getTracks().forEach((track) => track.stop());
        stream.current = null;
      };
      started.current = Date.now();
      next.start(); setRecording(true);
      timer.current = window.setInterval(() => {
        const seconds = Math.round((Date.now() - started.current) / 1000);
        setElapsed(seconds);
        if (seconds >= 45 && recorder.current?.state === 'recording') stop();
      }, 250);
    } catch { setError('Не удалось получить доступ к микрофону. Разрешите запись в настройках браузера.'); }
  }

  function stop() {
    if (recorder.current?.state !== 'recording') return;
    const seconds = Math.round((Date.now() - started.current) / 1000);
    setElapsed(seconds); setRecording(false);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    recorder.current.stop();
  }

  async function save() {
    if (!blob || busy) return;
    setBusy(true); setError(null);
    try { await saveOwnVoice(blob, elapsed); setSaved(true); }
    catch (cause) { setError(cause instanceof Error && cause.message.startsWith('Сначала завершите') ? cause.message : 'Не удалось сохранить аудиописьмо. Проверьте соединение и попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }

  return <section className="product-page">
    <PageHeader eyebrow="Ваш голос" title="Аудиописьмо">Запишите 20–45 секунд. Оно станет доступно людям, подходящим по вашим настройкам знакомства.</PageHeader>
    <div className="product-card voice-card">
      <p>Вопрос и остальные поля анкеты сохраняются из вашего мобильного профиля.</p>
      <p role="status">{recording ? `Идёт запись: ${elapsed} / 45 сек.` : blob ? `Записано: ${elapsed} сек.` : 'Микрофон выключен'}</p>
      <div className="button-row">
        {!recording ? <button type="button" className="button button-primary" onClick={() => void start()} disabled={busy}>{blob ? 'Перезаписать' : 'Начать запись'}</button> : <button type="button" className="button button-secondary" onClick={stop}>Остановить</button>}
      </div>
      {previewUrl ? <audio controls src={previewUrl} aria-label="Прослушать своё аудиописьмо" /> : null}
      {blob ? <button type="button" className="button button-primary" onClick={() => void save()} disabled={busy || elapsed < 20 || elapsed > 45 || blob.size > 3 * 1024 * 1024}>{busy ? 'Сохраняем…' : 'Опубликовать аудиописьмо'}</button> : null}
      {blob && (elapsed < 20 || elapsed > 45) ? <p>Нужна запись длительностью 20–45 секунд.</p> : null}
      {error ? <p role="alert" className="product-error">{error}</p> : null}
      {saved ? <p role="status">Аудиописьмо сохранено.</p> : null}
    </div>
    <Link to="/voices">← Вернуться к Голосам</Link>
  </section>;
}
