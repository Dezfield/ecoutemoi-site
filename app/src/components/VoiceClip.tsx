import { useEffect, useRef, useState } from 'react';
import { prepareClip, type PendingVoice } from '../product/audioLetters';
import { productError } from '../product/api';
import { voiceMediaLink } from '../product/voiceLinks';

export function VoicePlayer({ path, onListened }: { path: string; onListened?: () => Promise<void> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setBusy(true);
    setError(null);
    try {
      setUrl(await voiceMediaLink(path));
    } catch {
      setError('Запись недоступна. Повторите загрузку.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="voice-player">
      {url ? (
        <audio
          controls
          src={url}
          aria-label="Прослушать запись"
          onError={() => {
            setUrl(null);
            setError('Ссылка истекла. Загрузите запись ещё раз.');
          }}
          onEnded={() => {
            void onListened?.().catch(() => setError('Не удалось сохранить прослушивание. Повторите.'));
          }}
        />
      ) : (
        <button className="button button-secondary" disabled={busy} onClick={() => void open()}>
          {busy ? 'Загружаем…' : 'Слушать'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

// Only used for letters and pre-disclosure voice threads, never in chat.
export function VoiceComposer({
  min,
  max,
  purpose,
  onSend,
  label = 'Отправить',
}: {
  min: number;
  max: number;
  purpose: 'letter' | 'note';
  onSend: (pending: PendingVoice) => Promise<void>;
  label?: string;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const media = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startAt = useRef(0);
  const pending = useRef<PendingVoice | null>(null);
  const mounted = useRef(true);
  const [file, setFile] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      media.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - startAt.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= max && recorder.current?.state === 'recording') recorder.current.stop();
    }, 200);
    return () => window.clearInterval(timer);
  }, [recording, max]);
  async function start() {
    setError(null);
    const mime = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) =>
      window.MediaRecorder?.isTypeSupported(t),
    );
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setError('Запись в этом браузере недоступна. Используйте Safari, Chrome или приложение.');
      return;
    }
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      pending.current = null;
      setFile(null);
      setSeconds(0);
      chunks.current = [];
      const next = new MediaRecorder(stream, { mimeType: mime });
      recorder.current = next;
      next.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      next.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        setRecording(false);
        setSeconds(Math.round((Date.now() - startAt.current) / 1000));
        setFile(new Blob(chunks.current, { type: mime.includes('webm') ? 'audio/webm' : 'audio/mp4' }));
      };
      next.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        setError('Запись прервалась.');
        setRecording(false);
      };
      startAt.current = Date.now();
      next.start();
      setRecording(true);
    } catch {
      setError('Разрешите доступ к микрофону в браузере.');
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!file || busy || seconds < min || seconds > max) return;
    setBusy(true);
    setError(null);
    try {
      pending.current ??= await prepareClip(file, seconds, purpose);
      await onSend(pending.current);
      pending.current = null;
      setFile(null);
    } catch (cause) {
      setError(productError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="voice-composer">
      <p>
        Запись {min}–{max} секунд.{' '}
        <span role="status">
          {recording ? `Записываем: ${seconds} сек.` : file ? `${seconds} сек.` : 'Микрофон выключен'}
        </span>
      </p>
      <div className="button-row">
        {recording ? (
          <button className="button button-secondary" onClick={() => recorder.current?.stop()}>
            Остановить запись
          </button>
        ) : (
          <button className="button button-secondary" disabled={busy} onClick={() => void start()}>
            {file ? 'Перезаписать' : 'Записать'}
          </button>
        )}
      </div>
      {url && <audio controls src={url} aria-label="Предпросмотр записи" />}
      {file && (
        <button
          className="button button-primary"
          disabled={busy || seconds < min || seconds > max}
          onClick={() => void send()}
        >
          {busy ? 'Отправляем…' : label}
        </button>
      )}
      {error && (
        <p role="alert" className="product-error">
          {error}
        </p>
      )}
    </div>
  );
}
