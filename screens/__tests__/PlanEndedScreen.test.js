import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import { isLapseAcknowledged } from '../../lib/planLapseAck';
import PlanEndedScreen, { planEndedSubtitle, planEndedTitle } from '../PlanEndedScreen';

let mockEntitlement;
jest.mock('../../billing/EntitlementProvider', () => ({
  useEntitlement: () => mockEntitlement,
}));

const mockChooseFreePlant = jest.fn();
jest.mock('../../api/account', () => ({
  chooseFreePlant: (...args) => mockChooseFreePlant(...args),
}));

const NOW = new Date(2026, 9, 14, 15, 0, 0);
let lapseNo = 0;

const garden = (names = ['Monstera', 'Figgy', 'Penny', 'Fern Gully']) =>
  seedGarden({
    now: NOW,
    plants: names.map((nickname) => ({
      nickname,
      room: 'Kitchen',
      reminders: [{ action: 'water', intervalDays: 7 }],
    })),
  });

// A fresh subscription id per test: acknowledgements live in the (in-memory)
// file system for the whole run.
const lapsed = (state, overrides = {}) => {
  lapseNo += 1;
  return {
    ready: true,
    isPlus: false,
    limits: { plants: 1 },
    subscription: {
      id: `sub-${lapseNo}`,
      status: 'expired',
      expires_at: '2026-10-13T10:00:00Z',
      trial_ends_at: '2026-10-13T10:00:00Z',
    },
    freePlantId: state.plants[0]?.id ?? null,
    freePlantChosen: false,
    refresh: jest.fn(async () => {}),
    ...overrides,
  };
};

const keyOf = (ent) => `${ent.subscription.id}:${ent.subscription.expires_at}`;

const render = (state) =>
  renderWithGarden(<PlanEndedScreen />, { state, clock: NOW, initial: 'plan-ended' });

afterEach(() => {
  cleanupTrees();
  mockChooseFreePlant.mockReset();
});

describe('copy', () => {
  test('names what ended', () => {
    expect(planEndedTitle('trial')).toBe('Your free trial has ended');
    expect(planEndedTitle('plus')).toBe('Your Cultum Plus subscription has ended');
  });

  test('counts the plants against the free limit', () => {
    expect(planEndedSubtitle(4, 1)).toBe(
      'Your 4 plants are safe. On the free plan, 1 plant gets reminders.',
    );
    expect(planEndedSubtitle(4, 2)).toBe(
      'Your 4 plants are safe. On the free plan, 2 plants get reminders.',
    );
    expect(planEndedSubtitle(1, 1)).toBe('Your plant is safe, and its reminders stay on.');
    expect(planEndedSubtitle(0, 1)).toBe('You can keep using Cultum on the free plan.');
  });
});

test('renders the Figma frame for an ended trial', () => {
  const state = garden();
  mockEntitlement = lapsed(state);
  const t = render(state).texts();
  expect(t).toContain('Your free trial has ended');
  expect(t).toContain('Your 4 plants are safe. On the free plan, 1 plant gets reminders.');
  expect(t).toContain('Upgrade to Plus');
  expect(t).toContain('Continue with free plan');
});

test('Upgrade to Plus opens the paywall and leaves the lapse unanswered', () => {
  const state = garden();
  mockEntitlement = lapsed(state);
  const r = render(state);
  r.press('Upgrade to Plus');
  expect(r.router.route).toBe('paywall');
  expect(r.router.params).toEqual({ source: 'plan_ended' });
  expect(isLapseAcknowledged(keyOf(mockEntitlement))).toBe(false);
});

test('Continue with a garden the free plan covers just acknowledges and leaves', () => {
  const state = garden(['Monstera']);
  mockEntitlement = lapsed(state, { freePlantId: null });
  const r = render(state);
  r.press('Continue with free plan');
  expect(r.texts()).not.toContain('Pick your free plant');
  expect(r.router.route).toBe('today');
  expect(isLapseAcknowledged(keyOf(mockEntitlement))).toBe(true);
});

test('Continue over the limit asks for the free plant, and Save picks it', async () => {
  const state = garden();
  mockEntitlement = lapsed(state);
  mockChooseFreePlant.mockResolvedValue({});
  const r = render(state);

  r.press('Continue with free plan');
  const t = r.texts();
  expect(t).toContain('Pick your free plant');
  expect(t).toContain('On the free plan, reminders stay on for 1 plant. You can only pick once.');
  expect(t).toEqual(expect.arrayContaining(['Monstera', 'Figgy', 'Penny', 'Fern Gully']));

  r.press('Penny');
  r.press('Save');
  await r.settle();

  const penny = state.plants.find((p) => p.nickname === 'Penny');
  expect(mockChooseFreePlant).toHaveBeenCalledWith(penny.id);
  expect(mockEntitlement.refresh).toHaveBeenCalled();
  expect(r.router.route).toBe('today');
  expect(isLapseAcknowledged(keyOf(mockEntitlement))).toBe(true);
});

test('a pick already made elsewhere (409) is accepted as the answer', async () => {
  const state = garden();
  mockEntitlement = lapsed(state);
  mockChooseFreePlant.mockRejectedValue(Object.assign(new Error('taken'), { status: 409 }));
  const r = render(state);

  r.press('Continue with free plan');
  r.press('Save');
  await r.settle();

  expect(r.router.route).toBe('today');
  expect(isLapseAcknowledged(keyOf(mockEntitlement))).toBe(true);
});

test('any other failure keeps the sheet open and the lapse unanswered', async () => {
  const state = garden();
  mockEntitlement = lapsed(state);
  mockChooseFreePlant.mockRejectedValue(Object.assign(new Error('down'), { status: 503 }));
  const r = render(state);

  r.press('Continue with free plan');
  r.press('Save');
  await r.settle();

  expect(r.router.route).toBe('plan-ended');
  expect(isLapseAcknowledged(keyOf(mockEntitlement))).toBe(false);
});
