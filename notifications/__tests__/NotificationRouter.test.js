import { act } from 'react-test-renderer';
import { Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Route } from '../../routing';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import { OnboardingProvider, useOnboarding } from '../../onboarding';
import { COMPLETE, FRESH } from '../../onboarding/storage';
import NotificationRouter from '../NotificationRouter';

const NOW = new Date(2026, 8, 22);
const STATE = seedGarden({ now: NOW, plants: [{ nickname: 'Penny' }, { nickname: 'Fern' }] });
const PENNY = STATE.plants[0].id;
const FERN = STATE.plants[1].id;

let ob;
function Probe() {
  ob = useOnboarding();
  return null;
}

// The listener the router attaches, so a test can tap a notification.
let tap;
beforeEach(() => {
  require('expo-file-system').__files.clear();
  Notifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
    tap = (plantId) => act(() => fn({ notification: { request: { content: { data: { plantId } } } } }));
    return { remove: jest.fn() };
  });
});
afterEach(() => {
  cleanupTrees();
  Notifications.addNotificationResponseReceivedListener.mockReset();
});

async function boot(record) {
  const r = renderWithGarden(
    <OnboardingProvider initial={{ ...record }} override={null}>
      <Probe />
      <NotificationRouter />
      <Route name="onboarding">
        <Text>onboarding</Text>
      </Route>
      <Route name="today">
        <Text>today</Text>
      </Route>
      <Route name="product" component={({ plantId }) => <Text>{`product:${plantId}`}</Text>} />
    </OnboardingProvider>,
    { state: STATE, clock: NOW, initial: record.stage === 'complete' ? 'today' : 'onboarding' },
  );
  // Let the cold-launch lookup settle.
  await act(async () => {});
  return r;
}

const finish = (r) =>
  act(() => {
    ob.complete();
    r.router.reset('today');
  });

test('outside onboarding a tap opens the plant straight away', async () => {
  const r = await boot(COMPLETE);
  tap(PENNY);
  expect(r.texts()).toContain(`product:${PENNY}`);
});

test('during onboarding a tap is held, then delivered once onboarding completes', async () => {
  const r = await boot(FRESH);
  tap(PENNY);
  expect(r.texts()).toContain('onboarding');

  finish(r);
  expect(r.texts()).toContain(`product:${PENNY}`);
  // Delivered on top of Today, so Back from the plant lands there.
  act(() => r.router.back());
  expect(r.texts()).toContain('today');
});

test('only the latest held tap is delivered', async () => {
  const r = await boot(FRESH);
  tap(FERN);
  tap(PENNY);
  finish(r);
  expect(r.texts()).toContain(`product:${PENNY}`);
  act(() => r.router.back());
  expect(r.texts()).toContain('today');
});

test('a held tap for a plant that is gone is dropped, and Today stays', async () => {
  const r = await boot(FRESH);
  tap('deleted-plant');
  finish(r);
  expect(r.texts()).toContain('today');
  expect(r.router.canGoBack).toBe(false);
});
