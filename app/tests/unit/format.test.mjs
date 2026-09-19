import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageFromBirthDate, formatDuration, initials, yearsLabel } from '../../src/lib/format.ts';
import { entitlementLabel, labels, restrictionLabels } from '../../src/account/labels.ts';

test('age from birth date', () => {
  const now = new Date(2026, 8, 18);
  assert.equal(ageFromBirthDate('1996-03-14', now), 30);
  assert.equal(ageFromBirthDate('2008-09-18', now), 18);
  assert.equal(ageFromBirthDate('2008-09-19', now), 17);
  assert.equal(ageFromBirthDate('bad', now), null);
  assert.equal(ageFromBirthDate(null, now), null);
});

test('Russian plural for years', () => {
  assert.equal(yearsLabel(21), '21 год');
  assert.equal(yearsLabel(22), '22 года');
  assert.equal(yearsLabel(25), '25 лет');
  assert.equal(yearsLabel(11), '11 лет');
  assert.equal(yearsLabel(34), '34 года');
});

test('initials and durations', () => {
  assert.equal(initials('анна мария петрова'), 'АМ');
  assert.equal(initials(''), 'É');
  assert.equal(formatDuration(32), '0:32');
  assert.equal(formatDuration(null), '—');
});

test('entitlement labels use only get_my_entitlement tiers', () => {
  assert.equal(entitlementLabel({ tier: 'founder', active: true, premiumUntil: null }), 'Founder');
  assert.equal(entitlementLabel({ tier: 'premium', active: true, premiumUntil: '2026-12-31T00:00:00Z' }), 'Premium');
  assert.equal(entitlementLabel({ tier: 'free', active: false, premiumUntil: '2026-01-01T00:00:00Z' }), 'Free');
  assert.equal(entitlementLabel({ tier: 'premium', active: false, premiumUntil: null }), 'Free');
});

test('restriction labels follow mobile account status wording', () => {
  assert.equal(restrictionLabels.suspended, 'Аккаунт приостановлен');
  assert.equal(restrictionLabels.banned, 'Аккаунт заблокирован');
});

test('dating labels: known codes from mobile main, unknown codes are not guessed', () => {
  assert.equal(labels.gender('woman'), 'Женщина');
  assert.equal(labels.gender('nonbinary'), null);
  assert.equal(labels.goal('serious'), 'Серьёзные отношения');
  assert.equal(labels.country('RU'), 'Россия');
  assert.equal(labels.country('XX'), null);
  assert.equal(labels.prompt('why_here'), 'Почему вы здесь?');
});
