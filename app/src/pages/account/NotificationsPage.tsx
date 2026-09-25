import { type FormEvent, useEffect, useId, useState } from 'react';

// Preferences are read and saved only through get_/update_my_notification_preferences_v1
// (mobile main 20260921120100_account_rpc_deletion_guards.sql); every switch maps to a server field.

import {
  accountErrorMessage,
  detectedTimezone,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../../account/api';
import type { NotificationDeliveryMode, NotificationPreferences } from '../../account/types';
import { useAuth } from '../../auth/AuthProvider';
import { AsyncState } from '../../components/AsyncState';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { useAsync } from '../../lib/useAsync';

const quietPresets = [
  { start: '22:00', end: '08:00' },
  { start: '23:00', end: '07:00' },
  { start: '00:00', end: '09:00' },
];

const deliveryModes: Array<{ value: NotificationDeliveryMode; label: string }> = [
  { value: 'instant', label: 'Сразу' },
  { value: 'hourly', label: 'Раз в час' },
  { value: 'daily', label: 'Раз в день' },
];

function Toggle({ label, description, checked, disabled, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  const descriptionId = useId();
  return (
    <div className="toggle-row">
      <div className="toggle-copy">
        <label htmlFor={id} className="toggle-label">{label}</label>
        <p id={descriptionId} className="toggle-description">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const timezone = detectedTimezone();
  const quietGroup = useId();
  const deliveryGroup = useId();

  useEffect(() => setDraft(initial), [initial]);

  const patch = (value: Partial<NotificationPreferences>) => {
    setDraft((current) => ({ ...current, ...value }));
    setMessage(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      // Same as mobile: the quiet-hours timezone is taken from this device.
      const saved = await saveNotificationPreferences({ ...draft, timezone });
      setDraft(saved);
      setMessage({ tone: 'success', text: 'Настройки сохранены. Они общие для приложения и сайта.' });
    } catch (error) {
      setMessage({ tone: 'error', text: accountErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} aria-busy={saving}>
      <section className="panel" aria-labelledby="categories-title">
        <h2 id="categories-title" className="panel-title">Категории</h2>
        <Toggle
          label="Сообщения"
          description="Новые текстовые, голосовые и медиа-сообщения без показа их содержимого."
          checked={draft.messagesEnabled}
          disabled={saving}
          onChange={(value) => patch({ messagesEnabled: value })}
        />
        <Toggle
          label="Резонанс и Взаимность"
          description="Изменения в знакомствах и открытие разговора."
          checked={draft.datingEnabled}
          disabled={saving}
          onChange={(value) => patch({ datingEnabled: value })}
        />
        <Toggle
          label="Новости продукта"
          description="Редкие обновления Écoute Moi. По умолчанию отключены."
          checked={draft.productEnabled}
          disabled={saving}
          onChange={(value) => patch({ productEnabled: value })}
        />
        <div className="toggle-row">
          <div className="toggle-copy">
            <p className="toggle-label">Безопасность аккаунта</p>
            <p className="toggle-description">
              Критические защитные события нельзя заглушить настройками категорий, тихими часами или сводкой.
            </p>
          </div>
          <span className="status-pill status-ok">Всегда</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="quiet-title">
        <h2 id="quiet-title" className="panel-title">Спокойная доставка</h2>
        <Toggle
          label="Тихие часы"
          description={`${draft.quietStart}–${draft.quietEnd} · часовой пояс этого устройства: ${timezone}`}
          checked={draft.quietHoursEnabled}
          disabled={saving}
          onChange={(value) => patch({ quietHoursEnabled: value })}
        />
        <fieldset className="choice-group" disabled={saving}>
          <legend id={quietGroup} className="choice-legend">Интервал тихих часов</legend>
          <div className="choices">
            {quietPresets.map((preset) => {
              const selected = draft.quietStart === preset.start && draft.quietEnd === preset.end;
              return (
                <label key={preset.start} className={`choice ${selected ? 'choice-selected' : ''}`}>
                  <input
                    type="radio"
                    name="quiet-preset"
                    checked={selected}
                    onChange={() => patch({ quietStart: preset.start, quietEnd: preset.end, quietHoursEnabled: true })}
                  />
                  <span>{preset.start}–{preset.end}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="choice-group" disabled={saving}>
          <legend id={deliveryGroup} className="choice-legend">Как доставлять обычные события</legend>
          <div className="choices">
            {deliveryModes.map((mode) => (
              <label key={mode.value} className={`choice ${draft.deliveryMode === mode.value ? 'choice-selected' : ''}`}>
                <input
                  type="radio"
                  name="delivery-mode"
                  checked={draft.deliveryMode === mode.value}
                  onChange={() => patch({ deliveryMode: mode.value })}
                />
                <span>{mode.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="panel-note">
          Сводки объединяют однотипные события и не содержат текст личных сообщений. Безопасность доставляется сразу.
        </p>
      </section>

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить настройки'}
        </button>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      </div>
    </form>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const preferences = useAsync(loadNotificationPreferences, accountErrorMessage, [user?.id]);
  return (
    <>
      <PageHeader eyebrow="Мой аккаунт" title="Уведомления">
        <p>
          Настройки общие для всех ваших устройств. Push-уведомления разрешаются в приложении на телефоне — сайт их не
          отправляет.
        </p>
      </PageHeader>
      <AsyncState
        loading={preferences.loading}
        error={preferences.error}
        data={preferences.data}
        onRetry={preferences.reload}
        loadingLabel="Загружаем настройки…"
      >
        {(initial) => <PreferencesForm initial={initial} />}
      </AsyncState>
    </>
  );
}
