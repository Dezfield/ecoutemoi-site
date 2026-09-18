import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageFromBirthDate, formatDuration, initials, sessionDeviceLabel, yearsLabel } from '../../src/lib/format.ts';
import { planDescription, planLabel } from '../../src/account/labels.ts';

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

test('initials, durations and device labels', () => {
  assert.equal(initials('анна мария петрова'), 'АМ');
  assert.equal(initials(''), 'É');
  assert.equal(formatDuration(32), '0:32');
  assert.equal(formatDuration(null), '—');
  assert.equal(sessionDeviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'iPhone или iPad');
  assert.equal(sessionDeviceLabel(null), 'Неизвестное устройство');
});

test('plan labels follow mobile honestPremium mapping', () => {
  assert.equal(planLabel('founder', true), 'Exclusive');
  assert.equal(planLabel('premium', true), 'Premium');
  assert.equal(planLabel('premium', false), 'Бесплатный');
  assert.match(planDescription('free', false), /без подписки/);
});
