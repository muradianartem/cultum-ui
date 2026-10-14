import { act } from 'react-test-renderer';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import { acknowledgeLapse } from '../../lib/planLapseAck';
import PlanLapseLauncher from '../PlanLapseLauncher';

let mockEntitlement;
jest.mock('../EntitlementProvider', () => ({
  useEntitlement: () => mockEntitlement,
}));

let mockOnboardingActive = false;
jest.mock('../../onboarding', () => ({
  useOnboarding: () => ({ active: mockOnboardingActive }),
}));

let n = 0;
const lapsed = () => {
  n += 1;
  return {
    ready: true,
    isPlus: false,
    subscription: { id: `launch-${n}`, expires_at: '2026-10-13T10:00:00Z', trial_ends_at: null },
  };
};

const render = () =>
  renderWithGarden(<PlanLapseLauncher />, { state: seedGarden({ plants: [{ nickname: 'Penny' }] }) });

afterEach(() => {
  cleanupTrees();
  mockOnboardingActive = false;
});

test('opens the notice over Today once a lapse is known', () => {
  mockEntitlement = lapsed();
  const r = render();
  expect(r.router.route).toBe('plan-ended');
  expect(r.router.params).toEqual({
    kind: 'plus',
    lapseKey: `${mockEntitlement.subscription.id}:2026-10-13T10:00:00Z`,
  });
});

test('fires once per session, not again when the user moves on', () => {
  mockEntitlement = lapsed();
  const r = render();
  act(() => r.router.reset('today'));
  expect(r.router.route).toBe('today');
});

test('stays quiet during onboarding', () => {
  mockEntitlement = lapsed();
  mockOnboardingActive = true;
  expect(render().router.route).toBe('today');
});

test('stays quiet for an acknowledged lapse, Plus, or an unknown plan', () => {
  mockEntitlement = lapsed();
  acknowledgeLapse(`${mockEntitlement.subscription.id}:2026-10-13T10:00:00Z`);
  expect(render().router.route).toBe('today');

  mockEntitlement = { ...lapsed(), isPlus: true };
  expect(render().router.route).toBe('today');

  mockEntitlement = { ...lapsed(), ready: false };
  expect(render().router.route).toBe('today');
});
