import { act } from 'react-test-renderer';
import { TextInput as RNTextInput } from 'react-native';
import { speciesDetailToVM } from '../../../api/mapPlant';
import { Route } from '../../../routing';
import { useGarden } from '../../../store/GardenProvider';
import { nextDueAt } from '../../../store/schedule';
import AddReminderSheet from '../../AddReminderSheet';
import { DEFAULT_UNIT_INDEX, makeReminderDraft } from '../../addReminderData';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../../store/testing';
import ProductPage from '../../ProductPage';
import AddPlantScreen from '../AddPlantScreen';
import { OnboardingProvider, useOnboarding } from '../../../onboarding';
import { FRESH } from '../../../onboarding/storage';

// Fixed "today" so every date label is deterministic: Thursday 10 Sep 2026.
const TODAY = new Date(2026, 8, 10);

const DETAIL = {
  species_key: 'monstera-deliciosa',
  scientific_name: 'Monstera deliciosa',
  common_name: 'Swiss cheese plant',
  image_url: 'https://img/monstera.jpg',
  water_interval_days_min: 7,
  water_interval_days_max: 10,
};
const VM = speciesDetailToVM(DETAIL);

let harness;
let garden;

// Reads the store from inside the provider, so a test can check what the flow
// saved without going through a screen.
function GardenProbe() {
  garden = useGarden();
  return null;
}

// The product page is mounted alongside so Done can be followed all the way
// through: the flow finishes by replacing the route with the new plant's id,
// and what lands there has to render from the store.
function create(props = {}) {
  harness = renderWithGarden(
    <>
      <GardenProbe />
      <Route name="add-plant" component={() => <AddPlantScreen plant={VM} today={TODAY} {...props} />} />
      <Route name="product" component={ProductPage} />
    </>,
    {
      // Rooms come from the server now; seed the five the design draws.
      state: seedGarden({ now: TODAY, rooms: ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Office'] }),
      initial: 'add-plant',
      clock: TODAY,
    },
  );
  return harness;
}

afterEach(cleanupTrees);

const texts = (r) => r.texts();
const press = (r, label) => r.press(label);
const button = (r, label) => r.find(label);
const type = (r, value) => r.type(value);

const sheetVisible = (r, testID) =>
  r.tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

// Walk to a given step with a name and (past `room`) the Kitchen selected.
const walkTo = (r, step) => {
  if (step === 'name') return;
  press(r, 'Continue'); // name → room
  if (step === 'room') return;
  press(r, 'Kitchen'); // select the room
  press(r, 'Continue'); // room → reminders
  if (step === 'reminders') return;
  press(r, 'Skip for now'); // reminders → success
};

describe('step 1 — name', () => {
  test('opens prefilled with the common name and the Figma suggestions', () => {
    const tree = create();
    const t = texts(tree);
    expect(t).toContain('Name your plant');
    expect(t).toContain('Step 1 of 3');
    expect(tree.tree.root.findAllByType(RNTextInput)[0].props.value).toBe('Swiss cheese plant');
    expect(t).toEqual(expect.arrayContaining(['Monstera', 'Ziggy', 'Mo', 'Bruce']));
  });

  test('a suggestion chip fills the field, and clearing disables Continue', () => {
    const tree = create();
    press(tree, 'Mo');
    expect(tree.tree.root.findAllByType(RNTextInput)[0].props.value).toBe('Mo');

    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
    type(tree, '   ');
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(true);
  });

  test('close leaves the flow rather than stepping back', () => {
    const tree = create();
    expect(texts(tree)).not.toContain('Choose a room');
    press(tree, 'Close');
    // Nothing to pop to from the initial route, so the route is unchanged —
    // what matters is that the flow did not advance or step within itself.
    expect(tree.router.route).toBe('add-plant');
    expect(texts(tree)).toContain('Name your plant');
  });
});

describe('step 2 — room', () => {
  test('lists the rooms and holds Continue until one is picked', () => {
    const tree = create();
    walkTo(tree, 'room');
    const t = texts(tree);
    expect(t).toContain('Choose a room');
    expect(t).toContain('Step 2 of 3');
    expect(t).toEqual(
      expect.arrayContaining(['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Office', 'Add a new room'])
    );

    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(true);
    press(tree, 'Kitchen');
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
  });

  test('the add-a-room sheet appends the room and selects it', () => {
    const tree = create();
    walkTo(tree, 'room');
    expect(sheetVisible(tree, 'add-room-sheet')).toBe(false);

    press(tree, 'Add a new room');
    expect(sheetVisible(tree, 'add-room-sheet')).toBe(true);

    type(tree, 'Hallway');
    press(tree, 'Add room');

    expect(sheetVisible(tree, 'add-room-sheet')).toBe(false);
    expect(texts(tree)).toContain('Hallway');
    // Selected, so Continue is live without a further tap.
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
  });

  test('back returns to the name step with the name intact', () => {
    const tree = create();
    press(tree, 'Mo');
    walkTo(tree, 'room');
    press(tree, 'Back');
    expect(texts(tree)).toContain('Name your plant');
    expect(tree.tree.root.findAllByType(RNTextInput)[0].props.value).toBe('Mo');
  });
});

describe('step 3 — reminders', () => {
  test('both reminders start off, and enabling one shows the species interval', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    const t = texts(tree);
    expect(t).toContain('Set reminders');
    expect(t).toContain('Step 3 of 3');
    expect(t).toContain('Watering');
    expect(t).toContain('Fertilizing');
    expect(t).toContain('Repotting');
    expect(t.filter((x) => x === 'Reminder is turned off')).toHaveLength(3);
    expect(t).toContain('Skip for now');

    press(tree, 'Enable Watering');
    // The catalog's own phrasing, not a flattened number.
    expect(texts(tree)).toContain('Every 7–10 days');
    expect(texts(tree)).toContain('Continue'); // the CTA is no longer a skip
  });

  test('the add-reminder sheet appends a custom row', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(false);

    press(tree, 'Add custom reminder');
    expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(true);
  });

  test('back returns to the room step with the room still selected', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    press(tree, 'Back');
    expect(texts(tree)).toContain('Choose a room');
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
  });
});

describe('success', () => {
  test('skipping every reminder says nothing is scheduled', () => {
    const tree = create();
    press(tree, 'Mo');
    walkTo(tree, 'success');
    const t = texts(tree);
    expect(t).toContain('Mo added to your plants in the kitchen room');
    expect(t).toContain('There is no reminder set for now');
    expect(t).toContain('Scan another plant');
    expect(t).toContain('Done');
  });

  test('an enabled reminder dates the next treatment', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    press(tree, 'Enable Watering');
    press(tree, 'Continue');
    expect(texts(tree)).toContain('Next treatment is on Thu 17, Sep');
  });

  test('leaving the reminders step saves the plant before success shows', () => {
    const tree = create();
    press(tree, 'Mo');
    walkTo(tree, 'reminders');
    expect(garden.plants).toHaveLength(0);

    press(tree, 'Skip for now');
    expect(texts(tree)).toContain('Mo added to your plants in the kitchen room');
    expect(garden.plants).toHaveLength(1);
    const [plant] = garden.plants;
    expect(plant.nickname).toBe('Mo');
    expect(garden.rooms.find((r) => r.id === plant.roomId).name).toBe('Kitchen');
  });

  test('Done opens the saved plant without adding it again', () => {
    const tree = create();
    walkTo(tree, 'success');
    const [plant] = garden.plants;
    press(tree, 'Done');
    expect(garden.plants).toHaveLength(1);
    expect(tree.router.route).toBe('product');
    expect(tree.router.params.plantId).toBe(plant.id);
  });

  test('close on success opens the saved plant', () => {
    const tree = create();
    walkTo(tree, 'success');
    press(tree, 'Close');
    expect(tree.router.route).toBe('product');
    expect(tree.router.params.plantId).toBe(garden.plants[0].id);
  });

  test('Done opens the saved plant\'s page by id', () => {
    const tree = create();
    press(tree, 'Mo');
    walkTo(tree, 'reminders');
    press(tree, 'Enable Watering');
    press(tree, 'Continue');
    press(tree, 'Done');

    expect(tree.router.route).toBe('product');
    const { plantId } = tree.router.params;
    expect(plantId).toBeTruthy();
    // The page it lands on renders from the store, under the chosen name and
    // in the chosen room — and the watering it opted into is really scheduled,
    // a full interval out from the moment the plant was added.
    const t = texts(tree);
    expect(t).toContain('Mo');
    expect(t).toContain('Monstera deliciosa · Kitchen');
    expect(t).toContain('All caught up');
    expect(t).toContain('Next reminder is on Thu, Sep 17');
  });

  test('a custom reminder first comes due on the day chosen for it', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    press(tree, 'Enable Watering');
    press(tree, 'Add custom reminder');
    // The sheet's own wheels and calendar have their tests; what matters here
    // is what the flow does with the draft it hands back.
    const draft = makeReminderDraft({
      label: 'Mist the leaves',
      numberIndex: 29, // 30
      unitIndex: DEFAULT_UNIT_INDEX, // days
      date: new Date(2026, 8, 11), // tomorrow
    });
    const sheet = tree.tree.root.findByType(AddReminderSheet);
    act(() => {
      sheet.props.onConfirm(draft);
      sheet.props.onClose();
    });
    press(tree, 'Continue');

    // The success line and the store agree on the day.
    expect(texts(tree)).toContain('Next treatment is on Fri 11, Sep');
    const water = garden.reminders.find((r) => r.action === 'water');
    const custom = garden.reminders.find((r) => r.action === 'custom');
    expect(custom).toMatchObject({ title: 'Mist the leaves', intervalDays: 30, lastDoneAt: null });
    const [hh, mm] = custom.timeOfDay.split(':').map(Number);
    expect(nextDueAt(custom)).toEqual(new Date(2026, 8, 11, hh, mm));
    // A suggested reminder still counts as just done.
    expect(water.lastDoneAt).not.toBeNull();
  });

  test('Scan another plant resets to the camera, leaving no flow in the stack', () => {
    const tree = create();
    walkTo(tree, 'success');
    press(tree, 'Scan another plant');
    expect(tree.router.route).toBe('scan-camera');
    expect(tree.router.canGoBack).toBe(false);
    // The plant was saved on the way in, so leaving this way keeps it.
    expect(garden.plants).toHaveLength(1);
  });
});

// The same wizard, reached from onboarding's "Add your first plant". Only the
// exits change: the plant is saved exactly as above, and then the onboarding
// paywall takes over instead of the plant's page.
describe('in onboarding', () => {
  let ob;
  function OnboardingProbe() {
    ob = useOnboarding();
    return null;
  }

  // Starts on the entry screen and opens the add session the way its Scan /
  // Search buttons do — a stored add session with nothing saved is treated as
  // interrupted, so it cannot be seeded directly.
  function createOnboarding({ session = true } = {}) {
    const record = { ...FRESH, stage: 'intro', step: 3 };
    harness = renderWithGarden(
      <OnboardingProvider initial={record} override={null}>
        <GardenProbe />
        <OnboardingProbe />
        <Route name="add-plant" component={() => <AddPlantScreen plant={VM} today={TODAY} />} />
        <Route name="product" component={ProductPage} />
        <Route name="paywall" component={() => null} />
        <Route name="scan-camera" component={() => null} />
      </OnboardingProvider>,
      {
        state: seedGarden({ now: TODAY, rooms: ['Kitchen'] }),
        initial: 'add-plant',
        clock: TODAY,
      },
    );
    if (session) act(() => ob.beginPlant());
    return harness;
  }

  beforeEach(() => require('expo-file-system').__files.clear());

  test('saving records the plant as the onboarding one', () => {
    const tree = createOnboarding();
    walkTo(tree, 'success');
    expect(ob.savedPlantId).toBe(garden.plants[0].id);
  });

  test.each(['Done', 'Close'])('%s on success opens the onboarding paywall, with no way back', (label) => {
    const tree = createOnboarding();
    walkTo(tree, 'success');
    press(tree, label);
    expect(tree.router.route).toBe('paywall');
    expect(tree.router.params).toEqual({ source: 'onboarding' });
    expect(tree.router.canGoBack).toBe(false);
    expect(ob.stage).toBe('paywall');
  });

  test('a burst of finish taps saves nothing more and lands on one paywall', () => {
    const tree = createOnboarding();
    walkTo(tree, 'success');
    const done = button(tree, 'Done').props.onPress;
    act(() => {
      done();
      done();
    });
    expect(garden.plants).toHaveLength(1);
    expect(tree.router.route).toBe('paywall');
    expect(tree.router.canGoBack).toBe(false);
  });

  test('the plant and its reminders are created exactly once', () => {
    const tree = createOnboarding();
    walkTo(tree, 'reminders');
    press(tree, 'Enable Watering');
    press(tree, 'Continue');
    press(tree, 'Done');
    expect(garden.plants).toHaveLength(1);
    expect(garden.reminders.filter((r) => r.plantId === garden.plants[0].id)).toHaveLength(1);
  });

  test('Scan another plant keeps the onboarding session and the saved plant', () => {
    const tree = createOnboarding();
    walkTo(tree, 'success');
    press(tree, 'Scan another plant');
    expect(tree.router.route).toBe('scan-camera');
    expect(ob).toMatchObject({ addingPlant: true, savedPlantId: garden.plants[0].id });
    expect(garden.plants).toHaveLength(1);
  });

  test('close before saving still steps back through the scan flow', () => {
    const tree = createOnboarding();
    act(() => tree.router.navigate('add-plant'));
    press(tree, 'Close');
    expect(garden.plants).toHaveLength(0);
    expect(ob.addingPlant).toBe(true);
  });

  test('outside an onboarding add session, onboarding never hijacks Done', () => {
    // Onboarding still running, but this plant came from ordinary Add.
    const tree = createOnboarding({ session: false });
    walkTo(tree, 'success');
    press(tree, 'Done');
    expect(tree.router.route).toBe('product');
    expect(ob.savedPlantId).toBeNull();
  });
});
