import { buildResult, parseValue } from '../ReminderValueSheet';
import {
  DEFAULT_NUMBER_INDEX,
  DEFAULT_UNIT_INDEX,
  frequencyLabel,
  frequencyValue,
  makeReminder,
  parseShortDate,
  resetReminderIds,
  setDateLabel,
  shortDate,
  startDateSuggestions,
} from '../addReminderData';

const SEP_10 = new Date(2026, 8, 10);

beforeEach(resetReminderIds);

describe('labels', () => {
  test('shortDate matches the stored detail-row format', () => {
    expect(shortDate(SEP_10)).toBe('10 Sep');
    expect(shortDate(new Date(2026, 0, 1))).toBe('1 Jan');
  });

  test('setDateLabel is the calendar CTA', () => {
    expect(setDateLabel(SEP_10)).toBe('Set 10 Sep');
  });

  test('frequencyLabel matches the Figma CTA at the default', () => {
    expect(frequencyLabel(DEFAULT_NUMBER_INDEX, DEFAULT_UNIT_INDEX)).toBe(
      'Remind every 2 days'
    );
  });

  test('frequencyLabel drops the "1" for a single unit', () => {
    expect(frequencyLabel(0, DEFAULT_UNIT_INDEX)).toBe('Remind every day');
    expect(frequencyLabel(0, 0)).toBe('Remind every hour');
    expect(frequencyLabel(0, 3)).toBe('Remind every month');
  });

  test('frequencyLabel covers the whole shared unit list', () => {
    expect(frequencyLabel(2, 0)).toBe('Remind every 3 hours');
    expect(frequencyLabel(1, 2)).toBe('Remind every 2 weeks');
    expect(frequencyLabel(5, 3)).toBe('Remind every 6 months');
  });
});

describe('makeReminder', () => {
  const build = (over = {}) =>
    makeReminder({
      label: 'Rotate the pot',
      numberIndex: DEFAULT_NUMBER_INDEX,
      unitIndex: DEFAULT_UNIT_INDEX,
      date: SEP_10,
      ...over,
    });

  test('produces a custom, removable, enabled reminder', () => {
    expect(build()).toMatchObject({
      kind: 'custom',
      title: 'Rotate the pot',
      nextLabel: null,
      enabled: true,
      removable: true,
      dateLabel: 'Start date',
      dateValue: '10 Sep',
      frequency: '2 days',
      snooze: 'None',
    });
  });

  test('trims the typed label', () => {
    expect(build({ label: '  Rotate the pot  ' }).title).toBe('Rotate the pot');
  });

  test('ids are unique even within the same millisecond', () => {
    const ids = [build(), build(), build()].map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
  });

  test('an explicit id wins', () => {
    expect(build({ id: 'seeded' }).id).toBe('seeded');
  });

  // The whole point of sharing screens/durationUnits.js: a freshly created
  // reminder must be editable by ReminderValueSheet without re-formatting.
  test('the frequency it writes round-trips through the edit sheet', () => {
    for (const unitIndex of [0, 1, 2, 3]) {
      for (const numberIndex of [0, 1, 6, 29]) {
        const value = frequencyValue(numberIndex, unitIndex);
        const { a, b } = parseValue('frequency', value);
        expect(buildResult('frequency', a, b)).toBe(value);
      }
    }
  });

  test('the date it writes round-trips through the edit sheet', () => {
    const value = build().dateValue; // '10 Sep'
    expect(shortDate(parseShortDate(value, SEP_10))).toBe(value);
  });
});

describe('startDateSuggestions', () => {
  test('are the four Figma chips, relative to today', () => {
    const s = startDateSuggestions(SEP_10);
    expect(s.map((x) => x.label)).toEqual([
      'Today',
      'Yesterday',
      'A week ago',
      'Two weeks ago',
    ]);
    expect(s.map((x) => shortDate(x.date))).toEqual([
      '10 Sep',
      '9 Sep',
      '3 Sep',
      '27 Aug', // crosses the month boundary
    ]);
  });

  test('cross a year boundary correctly', () => {
    const s = startDateSuggestions(new Date(2026, 0, 3));
    expect(shortDate(s[3].date)).toBe('20 Dec');
    expect(s[3].date.getFullYear()).toBe(2025);
  });
});


describe('parseShortDate', () => {
  const on = (value, today) => parseShortDate(value, today);

  test('round-trips anything shortDate produces', () => {
    for (const d of [
      new Date(2026, 0, 1),
      new Date(2026, 8, 10),
      new Date(2026, 11, 31),
    ]) {
      expect(shortDate(on(shortDate(d), SEP_10))).toBe(shortDate(d));
    }
  });

  test('resolves to the current year for a nearby date', () => {
    expect(on('21 Aug', SEP_10).getFullYear()).toBe(2026);
    expect(on('21 Aug', SEP_10).getMonth()).toBe(7);
    expect(on('21 Aug', SEP_10).getDate()).toBe(21);
  });

  test('picks the nearest occurrence across a New Year boundary', () => {
    // On 3 Jan 2027, "28 Dec" is last December — not 11 months away.
    const jan = new Date(2027, 0, 3);
    expect(on('28 Dec', jan).getFullYear()).toBe(2026);

    // And symmetrically, on 28 Dec 2026 a "3 Jan" is next January.
    const dec = new Date(2026, 11, 28);
    expect(on('3 Jan', dec).getFullYear()).toBe(2027);
  });

  test('returns a midnight date', () => {
    const d = on('21 Aug', SEP_10);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  test('clamps 29 Feb onto a non-leap year', () => {
    const d = on('29 Feb', new Date(2027, 1, 15)); // 2027 is not a leap year
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  test('falls back to today for unparseable input', () => {
    for (const bad of ['garbage', '', undefined, null, '32 Foo']) {
      expect(shortDate(on(bad, SEP_10))).toBe('10 Sep');
    }
  });
});
