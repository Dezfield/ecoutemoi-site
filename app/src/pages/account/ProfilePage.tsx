import type { ReactNode } from 'react';

import { useAccountData } from '../../account/AccountDataProvider';
import { accountErrorMessage, loadProfileMedia } from '../../account/api';
import { labels } from '../../account/labels';
import type { DatingProfile } from '../../account/types';
import { AsyncState } from '../../components/AsyncState';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { Spinner } from '../../components/Spinner';
import { ageFromBirthDate, formatDuration, yearsLabel } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

function Row({ term, children }: { term: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="details-row">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="chips" aria-label="Список">
      {items.map((item) => <li key={item} className="chip">{item}</li>)}
    </ul>
  );
}

function ProfileMedia({ profile }: { profile: DatingProfile }) {
  const media = useAsync(() => loadProfileMedia(profile), accountErrorMessage, [profile]);
  if (media.loading && !media.data) return <div className="panel panel-state"><Spinner label="Загружаем фотографии…" /></div>;
  if (!media.data) {
    return media.error ? <Notice tone="error">Фотографии и аудиописьмо сейчас недоступны. {media.error}</Notice> : null;
  }
  const { photoUrls, audioUrl } = media.data;
  return (
    <>
      {photoUrls.length ? (
        <section className="panel" aria-labelledby="photos-title">
          <h2 id="photos-title" className="panel-title">Фотографии</h2>
          <p className="panel-text">Видны другому человеку только после взаимного Отклика.</p>
          <ul className="photo-grid">
            {photoUrls.map((url, index) => (
              <li key={url}><img src={url} alt={`Фотография ${index + 1}`} loading="lazy" /></li>
            ))}
          </ul>
        </section>
      ) : null}
      {audioUrl ? (
        <section className="panel" aria-labelledby="letter-title">
          <h2 id="letter-title" className="panel-title">Аудиописьмо</h2>
          <p className="panel-text">
            {labels.prompt(profile.audioPromptKey) ?? 'Аудиописьмо'} · {formatDuration(profile.audioDurationSeconds)}
          </p>
          <audio className="audio" controls preload="none" src={audioUrl}>
            Ваш браузер не поддерживает воспроизведение аудио.
          </audio>
        </section>
      ) : null}
    </>
  );
}

export function ProfilePage() {
  const { summary } = useAccountData();

  return (
    <>
      <PageHeader eyebrow="Мой аккаунт" title="Профиль">
        <p>Так выглядит ваша анкета в Écoute Moi. Изменить её можно в мобильном приложении.</p>
      </PageHeader>
      <AsyncState
        loading={summary.loading}
        error={summary.error}
        data={summary.data}
        onRetry={summary.reload}
        loadingLabel="Загружаем профиль…"
      >
        {(data) => {
          const profile = data.dating;
          if (!profile || !profile.onboardingComplete) {
            return (
              <section className="panel">
                <h2 className="panel-title">Анкета ещё не заполнена</h2>
                <p className="panel-text">
                  Создайте анкету в приложении Écoute Moi: запишите аудиописьмо, добавьте фотографии и расскажите о
                  себе. После этого она появится здесь.
                </p>
              </section>
            );
          }
          const age = ageFromBirthDate(profile.birthDate);
          return (
            <>
              <section className="panel" aria-labelledby="about-title">
                <h2 id="about-title" className="panel-title">
                  {profile.displayName}
                  {age !== null ? `, ${yearsLabel(age)}` : ''}
                </h2>
                {profile.about ? <p className="profile-about">{profile.about}</p> : null}
                <dl className="details">
                  <Row term="Город">{[profile.city, labels.country(profile.countryCode)].filter(Boolean).join(', ')}</Row>
                  <Row term="Пол">{labels.gender(profile.genderCode)}</Row>
                  <Row term="Ищу">{labels.lookingFor(profile.lookingFor).join(', ')}</Row>
                  <Row term="Цель знакомства">{labels.goal(profile.relationshipGoal)}</Row>
                  <Row term="Знак зодиака">{labels.zodiac(profile.zodiacSign)}</Row>
                  <Row term="Возраст собеседника">
                    {profile.preferredMinAge !== null && profile.preferredMaxAge !== null
                      ? `${profile.preferredMinAge}–${profile.preferredMaxAge}`
                      : null}
                  </Row>
                  <Row term="Языки">{profile.languages.map(labels.language).join(', ')}</Row>
                  <Row term="Участие в подборе">{profile.discoveryEnabled ? 'Включено' : 'Выключено'}</Row>
                </dl>
              </section>

              {profile.interests.length || profile.profileValues.length || profile.whatMatters ? (
                <section className="panel" aria-labelledby="values-title">
                  <h2 id="values-title" className="panel-title">Интересы и ценности</h2>
                  {profile.interests.length ? <h3 className="panel-subtitle">Интересы</h3> : null}
                  <Chips items={profile.interests} />
                  {profile.profileValues.length ? <h3 className="panel-subtitle">Ценности</h3> : null}
                  <Chips items={profile.profileValues} />
                  {profile.whatMatters ? (
                    <>
                      <h3 className="panel-subtitle">Что для меня важно</h3>
                      <p className="profile-about">{profile.whatMatters}</p>
                    </>
                  ) : null}
                </section>
              ) : null}

              <section className="panel" aria-labelledby="lifestyle-title">
                <h2 id="lifestyle-title" className="panel-title">Образ жизни</h2>
                <dl className="details">
                  <Row term="Дети">{labels.children(profile.childrenPreference)}</Row>
                  <Row term="Курение">{labels.smoking(profile.smokingCode)}</Row>
                  <Row term="Алкоголь">{labels.alcohol(profile.alcoholCode)}</Row>
                  <Row term="Темп общения">{labels.pace(profile.communicationPace)}</Row>
                </dl>
              </section>

              <ProfileMedia profile={profile} />
            </>
          );
        }}
      </AsyncState>
    </>
  );
}
