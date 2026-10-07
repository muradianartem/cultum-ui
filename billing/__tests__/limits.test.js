import { scanQuota, plantQuota, canCustomReminders, isPaywallError } from '../limits';

const FREE_LIMITS = { scans_per_day: 3, plants: 1, custom_reminders: false };
const free = (usage = {}, limits = FREE_LIMITS) => ({ ready: true, isPlus: false, limits, usage });
const plus = { ready: true, isPlus: true, limits: { scans_per_day: 30, plants: null, custom_reminders: true }, usage: {} };
const unknown = { ready: false, isPlus: false, limits: null, usage: null };

describe('scanQuota', () => {
  test('counts down the free daily scans', () => {
    expect(scanQuota(free({ scans_today: 1, scans_reset_at: '2026-10-08T09:00:00Z' }))).toEqual({
      limit: 3,
      used: 1,
      left: 2,
      resetsAt: '2026-10-08T09:00:00Z',
    });
  });

  test('never goes below zero', () => {
    expect(scanQuota(free({ scans_today: 9 }))).toMatchObject({ used: 3, left: 0, resetsAt: null });
  });

  test('is null for Plus, an unknown plan, or no limit', () => {
    expect(scanQuota(plus)).toBeNull();
    expect(scanQuota(unknown)).toBeNull();
    expect(scanQuota(free({}, { scans_per_day: null }))).toBeNull();
  });
});

describe('plantQuota', () => {
  test('is reached once the garden holds the free plant', () => {
    expect(plantQuota(free({ plants: 0 }), 1)).toEqual({ limit: 1, used: 1, reached: true });
    expect(plantQuota(free({ plants: 1 }), 0)).toMatchObject({ reached: true });
    expect(plantQuota(free({ plants: 0 }), 0)).toMatchObject({ used: 0, reached: false });
  });

  test('is null for Plus or an unknown plan', () => {
    expect(plantQuota(plus, 12)).toBeNull();
    expect(plantQuota(unknown, 12)).toBeNull();
  });
});

describe('canCustomReminders', () => {
  test('only a known free plan is locked out', () => {
    expect(canCustomReminders(free())).toBe(false);
    expect(canCustomReminders(plus)).toBe(true);
    expect(canCustomReminders(unknown)).toBe(true);
    expect(canCustomReminders(free({}, { custom_reminders: true }))).toBe(true);
  });
});

describe('isPaywallError', () => {
  const e = { code: 'paywall', status: 402, paywall: { reason: 'plant_limit' } };
  test('matches a 402, optionally by reason', () => {
    expect(isPaywallError(e)).toBe(true);
    expect(isPaywallError(e, 'plant_limit')).toBe(true);
    expect(isPaywallError(e, 'scan_limit')).toBe(false);
    expect(isPaywallError({ status: 500, code: 'http' })).toBe(false);
    expect(isPaywallError(null)).toBe(false);
  });
});
