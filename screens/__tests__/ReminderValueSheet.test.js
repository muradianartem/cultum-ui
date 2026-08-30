import { buildResult, parseValue } from '../ReminderValueSheet';

describe('buildResult', () => {
  test('frequency formats number + plural unit', () => {
    // FREQ numbers are 1..30 (index 6 → 7); units [days, weeks, months].
    expect(buildResult('frequency', 6, 0)).toBe('7 days');
    expect(buildResult('frequency', 1, 1)).toBe('2 weeks');
  });

  test('frequency uses the singular unit for a value of 1', () => {
    expect(buildResult('frequency', 0, 0)).toBe('1 day');
  });

  test('snooze returns "None" for the None unit regardless of number', () => {
    expect(buildResult('snooze', 5, 0)).toBe('None');
  });

  test('snooze formats number + unit for a real unit', () => {
    // SNOOZE numbers 1..12; units [None, hours, days, weeks].
    expect(buildResult('snooze', 1, 2)).toBe('2 days');
    expect(buildResult('snooze', 0, 1)).toBe('1 hour');
  });

  test('date formats as "{day} {Mon}"', () => {
    // months index 7 → Aug, days index 20 → 21.
    expect(buildResult('date', 7, 20)).toBe('21 Aug');
  });
});

describe('parseValue', () => {
  test('frequency round-trips through buildResult', () => {
    const { a, b } = parseValue('frequency', '7 days');
    expect(buildResult('frequency', a, b)).toBe('7 days');
  });

  test('frequency parses a singular value', () => {
    const { a, b } = parseValue('frequency', '1 day');
    expect(buildResult('frequency', a, b)).toBe('1 day');
  });

  test('snooze parses "None" to the None unit', () => {
    const { b } = parseValue('snooze', 'None');
    expect(b).toBe(0);
  });

  test('date round-trips through buildResult', () => {
    const { a, b } = parseValue('date', '21 Aug');
    expect(buildResult('date', a, b)).toBe('21 Aug');
  });

  test('falls back to defaults for unparseable input', () => {
    expect(parseValue('frequency', 'garbage')).toEqual({ a: 0, b: 0 });
    expect(parseValue('frequency', undefined)).toEqual({ a: 0, b: 0 });
  });
});
