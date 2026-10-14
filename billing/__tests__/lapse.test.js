import { needsFreePlantPick, planLapse, trialCountdown } from '../lapse';

// Mid-afternoon local time, so "today" and "tomorrow" are unambiguous.
const NOW = new Date(2026, 9, 14, 15, 0, 0);
const inDays = (days, hour = 10) =>
  new Date(2026, 9, 14 + days, hour, 0, 0).toISOString();

const trialing = (endsAt) => ({
  ready: true,
  isPlus: true,
  subscription: { id: 's1', status: 'trialing', trial_ends_at: endsAt, expires_at: endsAt },
});

describe('trialCountdown', () => {
  test('counts calendar days to the end of the trial', () => {
    expect(trialCountdown(trialing(inDays(4)), NOW).daysLeft).toBe(4);
    expect(trialCountdown(trialing(inDays(2)), NOW).daysLeft).toBe(2);
    expect(trialCountdown(trialing(inDays(1, 9)), NOW).daysLeft).toBe(1);
    expect(trialCountdown(trialing(inDays(0, 20)), NOW).daysLeft).toBe(0);
  });

  test('counts down whether or not the trial is set to renew', () => {
    const ent = trialing(inDays(3));
    ent.subscription.auto_renew = true;
    expect(trialCountdown(ent, NOW)).toMatchObject({ daysLeft: 3 });
  });

  test('is null once the trial is over, for a paid plan, or before the plan is known', () => {
    expect(trialCountdown(trialing(inDays(0, 9)), NOW)).toBeNull();
    expect(
      trialCountdown(
        { ready: true, isPlus: true, subscription: { status: 'active', expires_at: inDays(300) } },
        NOW,
      ),
    ).toBeNull();
    expect(trialCountdown({ ...trialing(inDays(2)), ready: false }, NOW)).toBeNull();
    expect(trialCountdown({ ready: true, isPlus: false, subscription: null }, NOW)).toBeNull();
  });
});

describe('planLapse', () => {
  test('a free plan with a subscription is a lapse; trial_ends_at says it was a trial', () => {
    const ent = {
      ready: true,
      isPlus: false,
      subscription: { id: 's1', status: 'expired', expires_at: '2026-10-10T00:00:00Z', trial_ends_at: '2026-10-10T00:00:00Z' },
    };
    expect(planLapse(ent)).toEqual({ kind: 'trial', key: 's1:2026-10-10T00:00:00Z' });
  });

  test('a paid subscription lapsing is kind plus', () => {
    const ent = {
      ready: true,
      isPlus: false,
      subscription: { id: 's1', status: 'expired', expires_at: '2026-10-10T00:00:00Z', trial_ends_at: null },
    };
    expect(planLapse(ent).kind).toBe('plus');
  });

  test('a row the store never updated still reads trialing — the free plan is what counts', () => {
    const ent = {
      ready: true,
      isPlus: false,
      subscription: { id: 's1', status: 'trialing', expires_at: '2026-10-10T00:00:00Z', trial_ends_at: '2026-10-10T00:00:00Z' },
    };
    expect(planLapse(ent)).toMatchObject({ kind: 'trial' });
  });

  test('is null for Plus, a free account that never subscribed, or an unknown plan', () => {
    const sub = { id: 's1', status: 'active' };
    expect(planLapse({ ready: true, isPlus: true, subscription: sub })).toBeNull();
    expect(planLapse({ ready: true, isPlus: false, subscription: null })).toBeNull();
    expect(planLapse({ ready: false, isPlus: false, subscription: sub })).toBeNull();
  });
});

describe('needsFreePlantPick', () => {
  const free = { ready: true, isPlus: false };
  test('asks while the server names a free plant that has not been picked', () => {
    expect(needsFreePlantPick({ ...free, freePlantId: 'p1', freePlantChosen: false })).toBe(true);
  });

  test('not once picked, not when nothing is paused, not on Plus', () => {
    expect(needsFreePlantPick({ ...free, freePlantId: 'p1', freePlantChosen: true })).toBe(false);
    expect(needsFreePlantPick({ ...free, freePlantId: null })).toBe(false);
    expect(needsFreePlantPick({ ready: true, isPlus: true, freePlantId: 'p1' })).toBe(false);
  });
});
