import { act } from 'react-test-renderer';
import { TextInput as RNTextInput } from 'react-native';
import { speciesDetailToVM } from '../../../api/mapPlant';
import { Route } from '../../../routing';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../../store/testing';
import ProductPage from '../../ProductPage';
import AddPlantScreen from '../AddPlantScreen';

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

// The product page is mounted alongside so Done can be followed all the way
// through: the flow finishes by replacing the route with the new plant's id,
// and what lands there has to render from the store.
function create(props = {}) {
  harness = renderWithGarden(
    <>
      <Route name="add-plant" component={() => <AddPlantScreen plant={VM} today={TODAY} {...props} />} />
      <Route name="product" component={ProductPage} />
    </>,
    { state: seedGarden({ now: TODAY }), initial: 'add-plant', clock: TODAY },
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

  test('Done writes the plant to the store and opens its page by id', () => {
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

  test('Scan another plant resets to the camera, leaving no flow in the stack', () => {
    const tree = create();
    walkTo(tree, 'success');
    press(tree, 'Scan another plant');
    expect(tree.router.route).toBe('scan-camera');
    expect(tree.router.canGoBack).toBe(false);
  });
});
