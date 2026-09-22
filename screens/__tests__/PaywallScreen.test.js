import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const mockBack = jest.fn();
const mockReset = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  const RN = require('react-native');
  return { __esModule: true, LinearGradient: (props) => R.createElement(RN.View, props, props.children) };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../routing', () => ({
  useRouter: () => ({ back: mockBack, reset: mockReset, canGoBack: mockCanGoBack }),
}));

// Only the request is stubbed: the mapper, the module cache and the hook all
// run for real, because "bundled snapshot first, remote content when it lands"
// is the behaviour under test.
jest.mock('../../api/billing', () => ({
  ...jest.requireActual('../../api/billing'),
  getPaywall: jest.fn(),
}));
const { getPaywall } = require('../../api/billing');

// The store flow has its own tests (billing/__tests__/useStorePurchase.test.js);
// here it is only what the screen asks of it and what it hands back.
const mockStore = { supported: true, available: true, busy: false, error: null, purchase: jest.fn() };
jest.mock('../../billing/useStorePurchase', () => ({ __esModule: true, default: () => mockStore }));

import PaywallScreen from '../PaywallScreen';
import { Icon } from '../../components';
import { __resetPaywallCache } from '../../billing/paywallContent';
import { colorTokens } from '../../theme/colorTokens';

// GET /billing/plans, recorded from the live backend. Test input only — the app
// ships no copy of this.
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

const texts = (tree) => tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));
const ticks = (tree) =>
  tree.root.findAllByType(Icon).filter((n) => n.props.name === 'check');
const rows = (tree) =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'paywall-feature-row');

// BottomSheet kicks off an Animated.timing on mount, so creation has to be
// wrapped in act() or the renderer tears down mid-update.
const mounted = [];
const render = () => {
  let tree;
  act(() => {
    tree = TestRenderer.create(<PaywallScreen />);
  });
  mounted.push(tree);
  return tree;
};

// The host node carries the resolved style; the composite above it still holds
// a style function (see docs/figma-import.md's jest-expo notes).
const press = (tree, label) =>
  tree.root
    .find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === label
    )
    .props.onPress();

// Content is fetched, not bundled — so unless a test says otherwise, the
// backend has not answered and the screen is still loading.
beforeEach(() => {
  __resetPaywallCache();
  getPaywall.mockReturnValue(new Promise(() => {}));
  Object.assign(mockStore, { supported: true, available: true, busy: false, error: null });
  mockStore.purchase.mockResolvedValue(true);
});

afterEach(() => {
  // The content cache hands out subscriptions — a tree left mounted keeps
  // getting told about the next test's payload.
  act(() => {
    while (mounted.length) mounted.pop().unmount();
  });
  jest.clearAllMocks();
  mockCanGoBack = true;
});

// Resolve the fetch before the first render, the way <PaywallLauncher> does:
// it only opens this route once the content exists.
const renderWith = async (payload) => {
  getPaywall.mockResolvedValue(payload);
  let tree;
  await act(async () => {
    tree = TestRenderer.create(<PaywallScreen />);
  });
  mounted.push(tree);
  return tree;
};

const spinner = (tree) =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityLabel === 'Loading plans');

describe('before the plans have loaded', () => {
  test('shows a spinner and a Close that pops the router — never a price', () => {
    const tree = render();
    expect(spinner(tree).length).toBeGreaterThan(0);
    expect(rows(tree)).toHaveLength(0);
    expect(texts(tree)).not.toContain('Start free trial');

    act(() => press(tree, 'Close'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('with no history, Close goes home', () => {
    mockCanGoBack = false;
    const tree = render();
    act(() => press(tree, 'Close'));
    expect(mockReset).toHaveBeenCalledWith('today');
    expect(mockBack).not.toHaveBeenCalled();
  });

  test('a failed fetch offers Try again, which loads the plans', async () => {
    getPaywall.mockRejectedValue(Object.assign(new Error('offline'), { code: 'offline' }));
    let tree;
    await act(async () => {
      tree = TestRenderer.create(<PaywallScreen />);
    });
    mounted.push(tree);
    expect(texts(tree)).toContain("Plans couldn't be loaded");
    expect(texts(tree)).toContain('Try again');
    expect(rows(tree)).toHaveLength(0);

    getPaywall.mockResolvedValue(LIVE_RESPONSE);
    await act(async () => press(tree, 'Try again'));
    expect(texts(tree)).toContain('7 days free, then $39.99 a year');
    expect(rows(tree)).toHaveLength(7);
  });

  test('Close works from the error state too', async () => {
    getPaywall.mockRejectedValue(new Error('offline'));
    let tree;
    await act(async () => {
      tree = TestRenderer.create(<PaywallScreen />);
    });
    mounted.push(tree);
    act(() => press(tree, 'Close'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('with the live payload', () => {
  test('renders the headline, price line and both CTAs', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    expect(texts(tree)).toContain('Cultum Plus,\nfree for 7 days');
    expect(texts(tree)).toContain('7 days free, then $39.99 a year');
    expect(texts(tree)).toContain('Start free trial');
    expect(texts(tree)).toContain('See all plans');
  });

  test('renders the three trial steps', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    for (const day of ['Today', 'Day 5', 'Day 7']) expect(texts(tree)).toContain(day);
    expect(texts(tree)).toContain('Full access');
    expect(texts(tree)).toContain('Trial ends');
  });

  test('the comparison table shows each tier what it is allowed', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    expect(rows(tree)).toHaveLength(7);
    // The four capped features name their ceiling; the three Plus-only ones
    // leave the FREE cell blank.
    for (const cap of ['3 scans a day', '5 plants', '1 room', '5 guides a day']) {
      expect(texts(tree)).toContain(cap);
    }
    expect(texts(tree)).toContain('Bulk care actions');
  });

  test('the PLUS column says the number when Plus has a ceiling of its own', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    // Identification is 30/day on Plus, so it prints; the other six are ticks.
    expect(texts(tree)).toContain('30 scans a day');
    expect(ticks(tree)).toHaveLength(6);
  });

  test('renders the rating and both reviews — neither comes from the API', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    expect(texts(tree)).toContain('4.8');
    expect(texts(tree)).toContain('6.2K ratings');
    expect(texts(tree)).toContain('Rina');
    expect(texts(tree)).toContain('Tomas');
  });

  test('the close button pops the router, or goes home with no history', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    act(() => press(tree, 'Close'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();

    mockCanGoBack = false;
    __resetPaywallCache();
    const fresh = await renderWith(LIVE_RESPONSE);
    act(() => press(fresh, 'Close'));
    expect(mockReset).toHaveBeenCalledWith('today');
  });

  test('the whole screen follows the payload, not the file', async () => {
    // Nothing here is hardcoded anywhere in the app, so a different backend
    // response is a different screen — including a product with no trial,
    // which drops the free-days clause from the price line.
    const tree = await renderWith({
      ...LIVE_RESPONSE,
      title: 'Cultum Pro, on the house',
      features: LIVE_RESPONSE.features.slice(0, 2),
      products: [
        {
          key: 'lifetime',
          label: 'Lifetime',
          badge: 'One payment',
          period: 'lifetime',
          apple_product_id: 'com.cultum.plus.lifetime',
          google_product_id: 'cultum_plus_lifetime',
          fallback_price: '$99.99',
          trial_days: 0,
          default: true,
        },
      ],
      footnote: 'Buy once, keep it.',
    });
    expect(texts(tree)).toContain('Cultum Pro,\non the house');
    expect(texts(tree)).toContain('$99.99 a lifetime');
    expect(texts(tree)).toContain('Buy once, keep it.');
    expect(rows(tree)).toHaveLength(2);
  });
});

describe('Start free trial', () => {
  const startTrial = (tree) => act(async () => press(tree, 'Start free trial'));
  const cta = (tree) =>
    tree.root.find(
      (n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === 'Start free trial'
    );

  test('buys the default plan and closes once the purchase is confirmed', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    await startTrial(tree);
    expect(mockStore.purchase).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'yearly', appleProductId: 'com.cultum.plus.yearly' })
    );
    expect(mockBack).toHaveBeenCalled();
  });

  test('buys the plan chosen in the sheet', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    act(() => press(tree, 'See all plans'));
    act(() =>
      tree.root
        .find((n) => typeof n.type !== 'string' && n.props.testID === 'plan-monthly')
        .props.onPress()
    );
    act(() => press(tree, 'Done'));
    await startTrial(tree);
    expect(mockStore.purchase).toHaveBeenCalledWith(
      expect.objectContaining({ appleProductId: 'com.cultum.plus.monthly' })
    );
  });

  test('stays open when the purchase is cancelled or fails', async () => {
    mockStore.purchase.mockResolvedValue(false);
    const tree = await renderWith(LIVE_RESPONSE);
    await startTrial(tree);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  test('shows the store error and a busy button', async () => {
    Object.assign(mockStore, { busy: true, error: "The App Store couldn't complete the purchase. Try again." });
    const tree = await renderWith(LIVE_RESPONSE);
    expect(texts(tree)).toContain("The App Store couldn't complete the purchase. Try again.");
    expect(cta(tree).props.accessibilityState.busy).toBe(true);
  });

  test('with no store flow on the platform it just closes', async () => {
    mockStore.supported = false;
    const tree = await renderWith(LIVE_RESPONSE);
    await startTrial(tree);
    expect(mockStore.purchase).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('the Choose a plan sheet', () => {
  const pressRow = (tree, key) =>
    tree.root
      .find((n) => typeof n.type !== 'string' && n.props.testID === `plan-${key}`)
      .props.onPress();
  const row = (tree, key) =>
    tree.root.find((n) => typeof n.type === 'string' && n.props.testID === `plan-${key}`);

  test('is closed until "See all plans" is pressed', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    expect(texts(tree)).not.toContain('Choose a plan');

    act(() => press(tree, 'See all plans'));
    expect(texts(tree)).toContain('Choose a plan');
    expect(texts(tree)).toContain('Yearly');
    expect(texts(tree)).toContain('Monthly');
    expect(texts(tree)).toContain('Best value');
  });

  test('preselects the default plan and moves the ring on selection', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    act(() => press(tree, 'See all plans'));

    // Style lands on the host node; onPress stays on the composite above it.
    const ringOf = (key) =>
      Object.assign({}, ...[].concat(row(tree, key).props.style).filter(Boolean)).borderColor;

    expect(row(tree, 'yearly').props.accessibilityState.checked).toBe(true);
    expect(ringOf('yearly')).toBe(colorTokens.text.primary.light);
    expect(ringOf('monthly')).toBe('transparent');

    act(() => pressRow(tree, 'monthly'));
    expect(ringOf('monthly')).toBe(colorTokens.text.primary.light);
    expect(ringOf('yearly')).toBe('transparent');
  });

  test('"Done" closes the sheet and the price bar follows the chosen plan', async () => {
    const tree = await renderWith(LIVE_RESPONSE);
    act(() => press(tree, 'See all plans'));
    expect(texts(tree)).toContain('Choose a plan');

    act(() => pressRow(tree, 'monthly'));
    act(() => press(tree, 'Done'));

    expect(texts(tree)).not.toContain('Choose a plan');
    // Monthly's trial is 3 days, not the yearly plan's 7 — the headline that
    // was hardcoded could never say so.
    expect(texts(tree)).toContain('3 days free, then $5.99 a month');
  });
});
