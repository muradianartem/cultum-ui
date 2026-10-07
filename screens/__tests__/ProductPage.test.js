import { Alert, ImageBackground, Text } from 'react-native';
import { act } from 'react-test-renderer';
import { speciesDetailToVM } from '../../api/mapPlant';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import { SegmentedControl } from '../../components';
import ProductPage from '../ProductPage';

let mockEntitlement = { ready: false, isPlus: false };
jest.mock('../../billing/EntitlementProvider', () => ({
  useEntitlement: () => mockEntitlement,
}));

const NOW = new Date(2026, 8, 5, 15, 0, 0);

beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

// A SpeciesDetail rich enough to fill every section the redesign added.
const DETAIL = {
  species_key: 'dracaena-trifasciata',
  scientific_name: 'Dracaena trifasciata',
  common_name: 'Snake plant',
  about: 'A hardy succulent that tolerates neglect.',
  image_url: 'https://img/snake.jpg',
  difficulty: 'easy',
  toxic_to: ['cats', 'dogs'],
  sun_label: 'Bright, indirect',
  temp_min_c: 18,
  temp_max_c: 27,
  humidity_label: 'Average',
  growth_rate: 'slow',
  water_interval_days_min: 14,
  fertilize_interval_days: 60,
  repot_interval_months: 24,
};

const VM = speciesDetailToVM(DETAIL);

const owned = (over = {}) =>
  seedGarden({
    now: NOW,
    rooms: ['Kitchen', 'Bedroom'],
    plants: [
      {
        nickname: 'Mo',
        speciesKey: 'dracaena-trifasciata',
        room: 'Kitchen',
        care: DETAIL,
        heroUri: DETAIL.image_url,
        reminders: [{ action: 'water', intervalDays: 14, dueInDays: 0 }],
        ...over,
      },
    ],
  });

const render = (node, state = seedGarden({ now: NOW })) =>
  renderWithGarden(node, { state, initial: 'product', clock: NOW });

const hero = (r) => r.tree.root.findAllByType(ImageBackground)[0];

afterEach(() => {
  cleanupTrees();
  mockEntitlement = { ready: false, isPlus: false };
});

describe('a catalog entry', () => {
  test('renders the species, a remote hero and the Add CTA', () => {
    const r = render(<ProductPage plant={VM} />);
    const t = r.texts();
    expect(t).toContain('Snake plant');
    expect(t).toContain('Dracaena trifasciata');
    expect(t).toContain('Add to my plants');
    expect(hero(r).props.source).toEqual({ uri: 'https://img/snake.jpg' });
  });

  test('the hero carries no difficulty / toxicity pills', () => {
    const t = render(<ProductPage plant={VM} />).texts();
    expect(t).not.toContain('Toxic');
    expect(t).not.toContain('Moderate');
    // Easy still appears once, as the Maintenance highlight's value.
    expect(t.filter((x) => x === 'Easy')).toHaveLength(1);
  });

  test('with nothing at all it still renders, on the bundled hero asset', () => {
    const r = render(<ProductPage />);
    // A bundled asset resolves to a number (require id), never a { uri } object.
    expect(hero(r).props.source).not.toHaveProperty('uri');
    expect(r.texts()).toContain('Add to my plants');
  });

  test('Add to my plants opens the add-a-plant flow with the view-model', () => {
    const r = render(<ProductPage plant={VM} />);
    r.press('Add to my plants');
    expect(r.router.route).toBe('add-plant');
    expect(r.router.params).toEqual({ plant: VM });
  });

  test('nudges when the garden already holds one of this species, and links to it', () => {
    const state = owned();
    const r = render(<ProductPage plant={VM} />, state);
    expect(r.texts()).toContain('You already have one');
    expect(r.texts()).toContain('Mo · Kitchen');

    r.press('You already have one');
    expect(r.router.params.plantId).toBe(state.plants[0].id);
  });

  test('no nudge when the garden holds nothing like it', () => {
    expect(render(<ProductPage plant={VM} />).texts()).not.toContain('You already have one');
  });
});

describe('the sections the redesign added', () => {
  test('Highlights states all six facts from the catalog', () => {
    const t = render(<ProductPage plant={VM} />).texts();
    expect(t).toContain('Highlights');
    expect(t).toContain('Toxicity');
    expect(t).toContain('Toxic to cats, dogs');
    expect(t).toContain('Maintenance');
    expect(t).toContain('Easy');
    expect(t).toContain('Pruning');
    expect(t).toContain('Rarely needed');
  });

  test('a long toxicity list shows in full rather than being cut off', () => {
    const vm = speciesDetailToVM({ ...DETAIL, toxic_to: ['humans', 'cats', 'dogs', 'children'] });
    const r = render(<ProductPage plant={vm} />);
    const value = r.tree.root
      .findAllByType(Text)
      .find((n) => n.props.children === 'Toxic to humans, cats, dogs, children');
    expect(value).toBeTruthy();
    expect(value.props.numberOfLines).toBeUndefined();
  });

  test('How to care states the species\' own cadence for each action', () => {
    const t = render(<ProductPage plant={VM} />).texts();
    expect(t).toContain('How to care');
    expect(t).toContain('Water');
    expect(t).toContain('Every 14 days');
    expect(t).toContain('Fertilize');
    expect(t).toContain('Every 2 months');
    expect(t).toContain('Repot');
    expect(t).toContain('Every 2 years');
  });

  test('the FAQ is built from the catalog rather than a fixed script', () => {
    const t = render(<ProductPage plant={VM} />).texts();
    expect(t).toContain('FAQ');
    expect(t).toContain('Is it safe around pets?');
    expect(t).toContain('How fast does it grow?');
  });

  test('a species the catalog knows nothing about drops the FAQ instead of showing dead rows', () => {
    const bare = speciesDetailToVM({ species_key: 'x', scientific_name: 'Unknown sp.' });
    expect(render(<ProductPage plant={bare} />).texts()).not.toContain('FAQ');
  });
});

describe('an owned plant', () => {
  test('goes by its nickname, over species · room, with no CTA', () => {
    const state = owned();
    const t = render(<ProductPage plantId={state.plants[0].id} />, state).texts();
    expect(t).not.toContain('Add to my plants');
    expect(t).toContain('Mo');
    expect(t).toContain('Dracaena trifasciata · Kitchen');
  });

  test('shows the description with no About / Journal switch (Journal is v2)', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    expect(r.texts()).toContain('A hardy succulent that tolerates neglect.');
    expect(r.texts()).not.toContain('Journal');
    expect(r.tree.root.findAllByType(SegmentedControl)).toHaveLength(0);
  });

  test('lists what is due today, and completing it flips to All caught up', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    expect(r.texts()).toContain('Today’s tasks');
    expect(r.texts()).toContain('Watering');
    expect(r.texts()).toContain('Every 14 days');

    r.press('Watering');
    expect(r.texts()).toContain('All caught up');
    expect(r.texts()).toContain('Next reminder is on Sat, Sep 19');
  });

  test('a completion offers an Undo that puts the task back', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);

    r.press('Watering');
    expect(r.texts()).toContain('Task completed');

    r.press('Undo');
    expect(r.texts()).toContain('Watering');
    expect(r.texts()).not.toContain('All caught up');
  });

  test('a plant with no reminders says so rather than promising a next one', () => {
    const state = owned({ reminders: [] });
    const t = render(<ProductPage plantId={state.plants[0].id} />, state).texts();
    expect(t).toContain('All caught up');
    expect(t).toContain('No reminders');
  });

  test('the Actions list holds Edit Reminders, Rename, Move and Delete', () => {
    const state = owned();
    const t = render(<ProductPage plantId={state.plants[0].id} />, state).texts();
    expect(t).toContain('Actions');
    ['Edit Reminders', 'Rename', 'Move', 'Delete'].forEach((label) =>
      expect(t).toContain(label),
    );
    // There is no archive: the server has nowhere to keep it.
    expect(t).not.toContain('Archive');
  });

  test('Edit Reminders navigates to that plant, not to a name', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Edit Reminders');
    expect(r.router.route).toBe('reminders');
    expect(r.router.params).toEqual({ plantId: state.plants[0].id });
  });

  test('Rename goes to the server, and its answer updates the hero in place', async () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Rename');
    r.type('Zed');
    r.press('Save');
    await r.settle();
    expect(r.api.callsTo('updatePlant')).toEqual([[state.plants[0].id, { nickname: 'Zed' }]]);
    expect(r.texts()).toContain('Zed');
    expect(r.texts()).not.toContain('Mo');
  });

  test('Move puts the plant in another room', async () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Move');
    r.press('Bedroom');
    r.press('Move plant');
    await r.settle();
    expect(r.texts()).toContain('Dracaena trifasciata · Bedroom');
  });

  test('Delete asks first, then leaves the page', async () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Delete');
    expect(r.texts()).toContain('Delete this plant?');
    // The dialog's own destructive confirm, which is the deepest 'Delete'.
    r.press('Delete');
    await r.settle();
    expect(r.api.callsTo('removePlant')).toEqual([[state.plants[0].id]]);
    expect(r.router.route).toBe('product'); // back() with an empty stack stays put
    expect(r.texts()).not.toContain('Actions'); // but the plant is gone
  });

  test('a delete the server refuses keeps the plant and says so', async () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.api.fail('removePlant', Object.assign(new Error('offline'), { code: 'offline' }));
    r.press('Delete');
    r.press('Delete');
    await r.settle();
    expect(Alert.alert).toHaveBeenCalledWith('Couldn’t delete your plant', expect.any(String));
    expect(r.texts()).toContain('Actions');
  });
});

describe('the navigation bar', () => {
  const texts = (r) => r.texts().filter((x) => typeof x === 'string');
  const menuOpen = (r) => r.tree.root.findAll((n) => n.props.accessibilityRole === 'menu').length > 0;

  test('a catalog entry gets only Back, and the bar title is the common name', () => {
    const r = render(<ProductPage plant={VM} />);
    expect(r.find('Back')).toBeTruthy();
    expect(r.find('Edit reminders')).toBeUndefined();
    expect(r.find('More options')).toBeUndefined();
    // Hero title and the (faded-out) bar title.
    expect(texts(r).filter((x) => x === 'Snake plant')).toHaveLength(2);
  });

  test('Back pops the route stack', () => {
    const r = render(<ProductPage plant={VM} />);
    act(() => r.router.navigate('reminders'));
    expect(r.router.route).toBe('reminders');
    r.press('Back');
    expect(r.router.route).toBe('product');
  });

  test('an owned plant gets settings and an ellipsis, titled by its nickname', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    expect(texts(r).filter((x) => x === 'Mo')).toHaveLength(2);
    r.press('Edit reminders');
    expect(r.router.route).toBe('reminders');
    expect(r.router.params).toEqual({ plantId: state.plants[0].id });
  });

  test('the ellipsis opens Rename / Move / Delete, and a tap outside closes it', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    expect(menuOpen(r)).toBe(false);
    r.press('More options');
    expect(menuOpen(r)).toBe(true);
    const menu = r.tree.root.find((n) => n.props.accessibilityRole === 'menu');
    const items = menu
      .findAll((n) => n.props.accessibilityRole === 'menuitem' && typeof n.props.onPress === 'function')
      .map((n) => n.props.accessibilityLabel);
    expect([...new Set(items)]).toEqual(['Rename', 'Move', 'Delete']);
    r.press('Dismiss');
    expect(menuOpen(r)).toBe(false);
  });

  test('Rename from the ellipsis closes the menu and opens the rename sheet', async () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('More options');
    r.press('Rename'); // the menu's, being deepest
    expect(menuOpen(r)).toBe(false);
    r.type('Zed');
    r.press('Save');
    await r.settle();
    expect(r.api.callsTo('updatePlant')).toEqual([[state.plants[0].id, { nickname: 'Zed' }]]);
  });

  test('Delete from the ellipsis asks first', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('More options');
    r.press('Delete');
    expect(menuOpen(r)).toBe(false);
    expect(r.texts()).toContain('Delete this plant?');
  });
});

describe('the description', () => {
  const LONG_ABOUT =
    'The ZZ plant is a tropical perennial native to eastern Africa,\n\nfrom Kenya ' +
    'to northeastern South Africa. It is grown as an ornamental plant for its ' +
    'glossy foliage and tolerance of low light and irregular watering.';
  const FULL = LONG_ABOUT.replace(/\s+/g, ' ');

  test('a short one shows in full, with no View more', () => {
    const t = render(<ProductPage plant={VM} />).texts();
    expect(t).toContain('A hardy succulent that tolerates neglect.');
    expect(t).not.toContain('View more');
  });

  test('a long one collapses behind View more / View less', () => {
    const vm = speciesDetailToVM({ ...DETAIL, about: LONG_ABOUT });
    const r = render(<ProductPage plant={vm} />);

    const collapsed = r.texts().find((s) => typeof s === 'string' && s.startsWith('The ZZ plant'));
    expect(collapsed.endsWith('…')).toBe(true);
    expect(collapsed.length).toBeLessThanOrEqual(151);
    expect(r.texts()).not.toContain(FULL);

    r.press('View more');
    expect(r.texts()).toContain(FULL);
    expect(r.texts()).toContain('View less');

    r.press('View less');
    expect(r.texts()).not.toContain(FULL);
    expect(r.texts()).toContain('View more');
  });
});

// Figma "Plant page / Plant limit reached [Free]"
describe('the free plant limit', () => {
  const FREE = { ready: true, isPlus: false, limits: { plants: 1 }, usage: { plants: 0 } };

  test('a full free garden is offered Plus instead of the Add button', () => {
    mockEntitlement = FREE;
    const r = render(<ProductPage plant={VM} />, owned());
    const t = r.texts();
    expect(t).toContain('1 of 1 free plant used');
    expect(t).not.toContain('Add to my plants');

    r.press('Upgrade to Plus');
    expect(r.router.route).toBe('paywall');
    expect(r.router.params).toEqual({ source: 'plant_limit' });
  });

  test('an empty free garden can still add its plant', () => {
    mockEntitlement = FREE;
    expect(render(<ProductPage plant={VM} />).texts()).toContain('Add to my plants');
  });

  test('Plus is never limited', () => {
    mockEntitlement = { ready: true, isPlus: true, limits: { plants: null }, usage: { plants: 4 } };
    expect(render(<ProductPage plant={VM} />, owned()).texts()).toContain('Add to my plants');
  });
});
