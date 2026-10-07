import { untilReset } from '../ScanLimitSheet';

describe('untilReset', () => {
  const NOW = Date.parse('2026-10-07T10:00:00Z');

  test('hours and minutes until the free scans come back', () => {
    expect(untilReset('2026-10-07T20:21:00Z', NOW)).toBe('10:21');
    expect(untilReset('2026-10-07T10:05:00Z', NOW)).toBe('0:05');
  });

  test('rounds a part minute up, so it never reads 0:00 early', () => {
    expect(untilReset('2026-10-07T10:00:20Z', NOW)).toBe('0:01');
  });

  test('null when missing, unreadable or already past', () => {
    expect(untilReset(null, NOW)).toBeNull();
    expect(untilReset('soon', NOW)).toBeNull();
    expect(untilReset('2026-10-07T09:00:00Z', NOW)).toBeNull();
  });
});
