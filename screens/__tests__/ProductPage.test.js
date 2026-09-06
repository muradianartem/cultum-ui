import { ImageBackground } from 'react-native';
import { speciesDetailToVM } from '../../api/mapPlant';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import ProductPage from '../ProductPage';

const NOW = new Date(2026, 8, 5, 15, 0, 0);

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

afterEach(cleanupTrees);

describe('a catalog entry', () => {
  test('renders the species, a remote hero and the Add CTA', () => {
    const r = render(<ProductPage plant={VM} />);
    const t = r.texts();
    expect(t).toContain('Snake plant');
    expect(t).toContain('Dracaena trifasciata');
    expect(t).toContain('Add to my plants');
    expect(hero(r).props.source).toEqual({ uri: 'https://img/snake.jpg' });
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

  test('a plant with no reminders says so rather than promising a next one', () => {
    const state = owned({ reminders: [] });
    const t = render(<ProductPage plantId={state.plants[0].id} />, state).texts();
    expect(t).toContain('All caught up');
    expect(t).toContain('No reminders');
  });

  test('the Actions list replaces the old overflow menu', () => {
    const state = owned();
    const t = render(<ProductPage plantId={state.plants[0].id} />, state).texts();
    expect(t).toContain('Actions');
    ['Edit Reminders', 'Rename', 'Move', 'Archive', 'Delete'].forEach((label) =>
      expect(t).toContain(label),
    );
  });

  test('Edit Reminders navigates to that plant, not to a name', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Edit Reminders');
    expect(r.router.route).toBe('reminders');
    expect(r.router.params).toEqual({ plantId: state.plants[0].id });
  });

  test('Rename writes through to the store, so the hero updates in place', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Rename');
    r.type('Zed');
    r.press('Save');
    expect(r.texts()).toContain('Zed');
    expect(r.texts()).not.toContain('Mo');
  });

  test('Move puts the plant in another room', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Move');
    r.press('Bedroom');
    r.press('Move plant');
    expect(r.texts()).toContain('Dracaena trifasciata · Bedroom');
  });

  test('Delete asks first, then leaves the page', () => {
    const state = owned();
    const r = render(<ProductPage plantId={state.plants[0].id} />, state);
    r.press('Delete');
    expect(r.texts()).toContain('Delete this plant?');
    // The dialog's own destructive confirm, which is the deepest 'Delete'.
    r.press('Delete');
    expect(r.router.route).toBe('product'); // back() with an empty stack stays put
    expect(r.texts()).not.toContain('Actions'); // but the plant is gone
  });
});
