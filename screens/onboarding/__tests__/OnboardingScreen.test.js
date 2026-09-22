import { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import { Route } from '../../../routing';
import { cleanupTrees, renderWithGarden } from '../../../store/testing';
import { OnboardingProvider, useOnboarding } from '../../../onboarding';
import { FRESH, loadOnboardingSync } from '../../../onboarding/storage';
import OnboardingScreen from '../OnboardingScreen';
import { ONBOARDING_STEPS } from '../onboardingData';

// The permission request is the one thing this screen does to the outside
// world; everything else is the provider's state.
const mockSetNotificationsEnabled = jest.fn();
jest.mock('../../../prefs', () => ({
  usePrefs: () => ({ setNotificationsEnabled: mockSetNotificationsEnabled }),
}));

let ob;
function Probe() {
  ob = useOnboarding();
  return null;
}

function create(record = FRESH) {
  return renderWithGarden(
    <OnboardingProvider initial={{ ...record }} override={null}>
      <Probe />
      <Route name="onboarding" component={OnboardingScreen} />
      <Route name="scan-camera">
        <Text>camera</Text>
      </Route>
      <Route name="scan-search">
        <Text>search</Text>
      </Route>
      <Route name="paywall" component={({ source }) => <Text>{`paywall:${source}`}</Text>} />
    </OnboardingProvider>,
    { initial: 'onboarding' },
  );
}

beforeEach(() => {
  require('expo-file-system').__files.clear();
  mockSetNotificationsEnabled.mockReset().mockResolvedValue('granted');
});
afterEach(cleanupTrees);

const progress = (r) => r.tree.root.find((n) => n.props.accessibilityRole === 'progressbar' && n.props.accessible);

test.each(ONBOARDING_STEPS.map((s, i) => [i, s]))('step %i shows its Figma copy', (i, s) => {
  const r = create({ ...FRESH, step: i });
  expect(r.texts()).toEqual(expect.arrayContaining([s.title, s.body, s.cta]));
  expect(progress(r).props.accessibilityLabel).toBe(`Step ${i + 1} of 4`);
  expect(progress(r).props.accessibilityValue).toEqual({ min: 1, max: 4, now: i + 1 });
});

test('the three intros carry a decorative illustration; the entry screen does not', () => {
  for (const step of [0, 1, 2]) {
    const r = create({ ...FRESH, step });
    const img = r.tree.root.findByType(Image);
    expect(img.props.accessible).toBe(false);
    expect(img.props.importantForAccessibility).toBe('no-hide-descendants');
    cleanupTrees();
  }
  expect(create({ ...FRESH, step: 3 }).tree.root.findAllByType(Image)).toHaveLength(0);
});

test('Next walks forward and Back walks back; the first screen has no Back', () => {
  const r = create();
  expect(r.find('Back')).toBeUndefined();
  r.press('Next');
  expect(r.texts()).toContain('Add your plant');
  r.press('Back');
  expect(r.texts()).toContain('Scan a plant');
  expect(loadOnboardingSync()).toMatchObject({ stage: 'intro', step: 0 });
});

test.each([0, 1, 2])('Skip on intro %i goes to the entry screen without asking for notifications', (step) => {
  const r = create({ ...FRESH, step });
  r.press('Skip');
  expect(r.texts()).toContain('Add your first plant');
  expect(mockSetNotificationsEnabled).not.toHaveBeenCalled();
});

test('Skip on the entry screen goes to the onboarding paywall with no plant', () => {
  const r = create({ ...FRESH, step: 3 });
  r.press('Skip');
  expect(r.texts()).toContain('paywall:onboarding');
  expect(r.router.canGoBack).toBe(false);
  expect(ob.stage).toBe('paywall');
});

describe('Get notified', () => {
  const continueFrom = async (r) => {
    await act(async () => {
      r.find('Continue').props.onPress();
    });
  };

  test('nothing is asked on arrival', () => {
    create({ ...FRESH, step: 2 });
    expect(mockSetNotificationsEnabled).not.toHaveBeenCalled();
  });

  test.each(['granted', 'denied'])('Continue asks, and moves on when the answer is %s', async (answer) => {
    mockSetNotificationsEnabled.mockResolvedValue(answer);
    const r = create({ ...FRESH, step: 2 });
    await continueFrom(r);
    expect(mockSetNotificationsEnabled).toHaveBeenCalledWith(true);
    expect(r.texts()).toContain('Add your first plant');
  });

  test('an unexpected error still moves on', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockSetNotificationsEnabled.mockRejectedValue(new Error('boom'));
    const r = create({ ...FRESH, step: 2 });
    await continueFrom(r);
    expect(r.texts()).toContain('Add your first plant');
  });

  test('a second tap while asking does not ask twice', async () => {
    let answer;
    mockSetNotificationsEnabled.mockImplementation(() => new Promise((res) => (answer = res)));
    const r = create({ ...FRESH, step: 2 });
    const onPress = r.find('Continue').props.onPress;
    act(() => {
      onPress();
      onPress();
    });
    await act(async () => answer('granted'));
    expect(mockSetNotificationsEnabled).toHaveBeenCalledTimes(1);
  });
});

test.each([
  ['Scan a plant', 'camera'],
  ['Search by name', 'search'],
])('%s opens an onboarding add session in the existing flow', (label, screen) => {
  const r = create({ ...FRESH, step: 3 });
  r.press(label);
  expect(r.texts()).toContain(screen);
  expect(ob.addingPlant).toBe(true);
  // Search's own Back pops onto the onboarding route: that is giving up.
  act(() => r.router.back());
  expect(r.texts()).toContain('Add your first plant');
  expect(ob.addingPlant).toBe(false);
});
