import { mapPaywall } from '../billing';

// GET /billing/plans, recorded from the live backend. It lives here because it
// is test input and nothing else — the app ships no copy of the paywall's copy.
const LIVE_RESPONSE = {
  title: 'Cultum Plus, free for 7 days',
  trial_days: 7,
  timeline: [
    { day: 0, label: 'Today', title: 'Full access', body: 'Every plan, check and reminder unlocks straight away.' },
    { day: 5, label: 'Day 5', title: 'Reminder', body: 'We email you two days before the trial ends.' },
    { day: 7, label: 'Day 7', title: 'Trial ends', body: 'Billing starts unless you have cancelled by then.' },
  ],
  features: [
    { key: 'identification', label: 'Plant identification', free: '3 scans a day', plus: '30 scans a day' },
    { key: 'plants', label: 'Unlimited plants', free: '5 plants', plus: null },
    { key: 'rooms', label: 'Rooms and spaces', free: '1 room', plus: null },
    { key: 'guides', label: 'Discover and care guides', free: '5 guides a day', plus: null },
    { key: 'adaptive_reminders', label: 'Adaptive care reminders', free: null, plus: null },
    { key: 'custom_reminders', label: 'Custom reminders', free: null, plus: null },
    { key: 'bulk_actions', label: 'Bulk care actions', free: null, plus: null },
  ],
  products: [
    {
      key: 'yearly',
      label: 'Yearly',
      badge: 'Best value',
      period: 'year',
      apple_product_id: 'com.cultum.plus.yearly',
      google_product_id: 'cultum_plus_yearly',
      fallback_price: '$39.99',
      trial_days: 7,
      default: true,
    },
    {
      key: 'monthly',
      label: 'Monthly',
      badge: null,
      period: 'month',
      apple_product_id: 'com.cultum.plus.monthly',
      google_product_id: 'cultum_plus_monthly',
      fallback_price: '$5.99',
      trial_days: 3,
      default: false,
    },
  ],
  footnote: 'Cancel any time in the App Store. Cancel before your free trial ends and you are not charged.',
};

// The mapper's whole job is deciding what to do with a payload that is not the
// happy one, so the unhappy ones are written at the assertion that reads them.
const patched = (patch) => ({ ...LIVE_RESPONSE, ...patch });

describe('mapPaywall', () => {
  test('maps the live payload to camelCase content', () => {
    const c = mapPaywall(LIVE_RESPONSE);
    expect(c.title).toBe('Cultum Plus, free for 7 days');
    expect(c.trialDays).toBe(7);
    expect(c.footnote).toMatch(/^Cancel any time/);
    expect(c.timeline).toHaveLength(3);
    expect(c.timeline[0]).toEqual({
      day: 0,
      label: 'Today',
      title: 'Full access',
      body: 'Every plan, check and reminder unlocks straight away.',
    });
    expect(c.features).toHaveLength(7);
    expect(c.features[0]).toEqual({
      key: 'identification',
      label: 'Plant identification',
      free: '3 scans a day',
      plus: '30 scans a day',
    });
    // A tier with no ceiling of its own comes through as null — the screen
    // reads that as "draw a tick".
    expect(c.features[1].plus).toBeNull();
    expect(c.products[0]).toEqual({
      key: 'yearly',
      label: 'Yearly',
      period: 'year',
      fallbackPrice: '$39.99',
      badge: 'Best value',
      appleProductId: 'com.cultum.plus.yearly',
      googleProductId: 'cultum_plus_yearly',
      trialDays: 7,
      isDefault: true,
    });
    expect(c.products[1].badge).toBeNull();
  });

  test('breaks the headline after the comma, and leaves a comma-less one alone', () => {
    expect(mapPaywall(LIVE_RESPONSE).titleLines).toBe('Cultum Plus,\nfree for 7 days');
    expect(mapPaywall(patched({ title: 'Cultum Plus' })).titleLines).toBe('Cultum Plus');
  });

  test('resolves the default product from the flag, else the first one', () => {
    expect(mapPaywall(LIVE_RESPONSE).defaultProductKey).toBe('yearly');

    const noFlag = patched({
      products: LIVE_RESPONSE.products.map((p) => ({ ...p, default: false })),
    });
    expect(mapPaywall(noFlag).defaultProductKey).toBe('yearly');
    expect(mapPaywall(patched({ products: [...noFlag.products].reverse() })).defaultProductKey)
      .toBe('monthly');
  });

  test('a product with no trial maps to 0 rather than undefined', () => {
    // headlineFor reads this to decide whether to promise free days at all.
    const lifetime = patched({
      products: [{ ...LIVE_RESPONSE.products[0], trial_days: 0 }],
    });
    expect(mapPaywall(lifetime).products[0].trialDays).toBe(0);
  });

  test('refuses a payload it cannot render', () => {
    expect(mapPaywall(null)).toBeNull();
    expect(mapPaywall(patched({ title: '' }))).toBeNull();
    expect(mapPaywall(patched({ products: [] }))).toBeNull();
    expect(mapPaywall(patched({ timeline: 'soon' }))).toBeNull();

    const { products, ...noProductsKey } = LIVE_RESPONSE;
    expect(mapPaywall(noProductsKey)).toBeNull();

    // All-or-nothing on products: one plan with no price discards the payload
    // rather than silently offering half the catalog.
    const halfPriced = patched({
      products: [
        LIVE_RESPONSE.products[0],
        { ...LIVE_RESPONSE.products[1], fallback_price: null },
      ],
    });
    expect(mapPaywall(halfPriced)).toBeNull();
  });

  test('drops a malformed feature row instead of the whole payload', () => {
    const withGhost = patched({
      features: [LIVE_RESPONSE.features[0], { key: 'ghost' }, LIVE_RESPONSE.features[1]],
    });
    expect(mapPaywall(withGhost).features.map((f) => f.key)).toEqual([
      'identification',
      'plants',
    ]);
  });

});
