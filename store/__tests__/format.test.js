import { FREQUENCY_UNITS, SNOOZE_UNITS } from '../../screens/durationUnits';
import {
  dateLabelFor,
  durationMs,
  frequencyLabel,
  frequencyValue,
  longDate,
  nextReminderLabel,
  parseFrequency,
  reminderDateValue,
  roomMeta,
  shortDate,
} from '../format';

describe('frequencyValue', () => {
  test.each([
    [1, '1 day'],
    [3, '3 days'],
    [7, '7 days'], // people say "every 7 days", not "every week"
    [14, '2 weeks'],
    [28, '4 weeks'],
    [30, '1 month'],
    [360, '12 months'],
  ])('%i days reads as "%s"', (days, expected) => {
    expect(frequencyValue(days)).toBe(expected);
  });

  test('every value it produces can be re-parsed to the same number of days', () => {
    for (const d of [1, 3, 6, 7, 14, 21, 28, 30, 60, 90, 360]) {
      expect(parseFrequency(frequencyValue(d))).toBe(d);
    }
  });

  test('and every unit the frequency wheel offers is understood', () => {
    for (const unit of FREQUENCY_UNITS) {
      expect(parseFrequency(`2 ${unit.plural}`)).toBeGreaterThan(0);
    }
  });

  test('an unparsable value falls back rather than producing NaN', () => {
    expect(parseFrequency('None')).toBe(7);
    expect(parseFrequency(undefined, 3)).toBe(3);
  });

  test('frequencyLabel is the subtitle form', () => {
    expect(frequencyLabel(6)).toBe('Every 6 days');
  });
});

describe('durationMs', () => {
  test('covers every snooze unit, and treats "None" as no snooze', () => {
    expect(durationMs('2 hours')).toBe(2 * 3600 * 1000);
    expect(durationMs('3 days')).toBe(3 * 24 * 3600 * 1000);
    expect(durationMs('None')).toBe(0);
    for (const unit of SNOOZE_UNITS.filter((u) => u.plural !== 'None')) {
      expect(durationMs(`1 ${unit.singular}`)).toBeGreaterThan(0);
    }
  });
});

describe('dates', () => {
  const d = new Date(2026, 7, 18); // Tue 18 Aug 2026

  test('formats without Intl, which Hermes does not honour consistently', () => {
    expect(shortDate(d)).toBe('18 Aug');
    expect(longDate(d)).toBe('Tue, Aug 18');
    expect(nextReminderLabel(d.toISOString())).toBe('Next reminder is on Tue, Aug 18');
  });

  test('no schedule at all says so', () => {
    expect(nextReminderLabel(null)).toBe('No reminders');
  });

  test('the date row is anchored to the last completion once there is one', () => {
    const started = { action: 'water', startAt: d.toISOString(), lastDoneAt: null };
    expect(dateLabelFor(started)).toBe('Start date');
    expect(reminderDateValue(started)).toBe('18 Aug');

    const done = { action: 'water', startAt: d.toISOString(), lastDoneAt: d.toISOString() };
    expect(dateLabelFor(done)).toBe('Last watering');
    expect(dateLabelFor({ action: 'rotate', lastDoneAt: d.toISOString() })).toBe('Last done');
  });
});

test('roomMeta only mentions what needs checking when something does', () => {
  expect(roomMeta(3, 2)).toBe('3 plants · 2 to check');
  expect(roomMeta(2, 0)).toBe('2 plants');
  expect(roomMeta(1)).toBe('1 plant');
  expect(roomMeta(0)).toBe('0 plants');
});
