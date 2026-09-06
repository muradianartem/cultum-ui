import {
  matchesCaption,
  candidateToCard,
  summaryToCard,
  speciesDetailToVM,
  cardToVM,
  careActions,
  faq,
  highlights,
} from '../mapPlant';
import { DEFAULT_ABOUT, CHIPS } from '../fallbacks';
import { MOCK_DETAIL } from '../__mocks__/scanFixtures';

// The watering cadence and the six Highlights tiles are where the raw
// SpeciesDetail numbers surface.
const water = (d) => careActions(d).find((r) => r.action === 'water').value;
const fact = (d, key) => highlights(d).find((h) => h.key === key).value;

describe('matchesCaption', () => {
  test('interpolates the top percent into the verbatim design caption', () => {
    expect(matchesCaption(52)).toBe(
      '52% is a guess, not an answer. Retake it closer, or search by name.'
    );
  });
});

describe('candidateToCard', () => {
  test('maps a ScanCandidateOut, keeping the ids confirm and detail lookups need', () => {
    const card = candidateToCard({
      id: 'cand-1',
      rank: 1,
      species_key: 'monstera-deliciosa',
      scientific_name: 'Monstera deliciosa',
      common_name: 'Swiss cheese plant',
      probability: 0.524,
      provider_ref: 'perenual-2868',
      reference_image_url: 'https://img/monstera.jpg',
    });
    expect(card).toEqual({
      candidateId: 'cand-1',
      rank: 1,
      speciesKey: 'monstera-deliciosa',
      title: 'Swiss cheese plant',
      subtitle: 'Monstera deliciosa',
      thumbUri: 'https://img/monstera.jpg',
      percent: 52,
    });
  });

  test('falls back to scientific_name for title and 0% when optional fields are absent', () => {
    const card = candidateToCard({ id: 'c', rank: 1, scientific_name: 'Ficus lyrata' });
    expect(card.title).toBe('Ficus lyrata');
    expect(card.percent).toBe(0);
    expect(card.speciesKey).toBeNull();
    expect(card.thumbUri).toBeNull();
  });
});

describe('summaryToCard', () => {
  test('maps a SpeciesSummary to a card with no confidence, preferring the thumb', () => {
    const card = summaryToCard({
      species_key: 'dracaena-trifasciata',
      common_name: 'Snake plant',
      scientific_name: 'Dracaena trifasciata',
      image_url: 'https://img/snake.jpg',
      image_thumb_url: 'https://img/snake-thumb.jpg',
    });
    expect(card).toEqual({
      speciesKey: 'dracaena-trifasciata',
      title: 'Snake plant',
      subtitle: 'Dracaena trifasciata',
      thumbUri: 'https://img/snake-thumb.jpg',
      percent: null,
    });
  });

  test('falls back to the full image, then null, and to the scientific name', () => {
    expect(
      summaryToCard({ species_key: 'k', scientific_name: 'S', image_url: 'https://a.jpg' })
        .thumbUri
    ).toBe('https://a.jpg');
    const bare = summaryToCard({ species_key: 'k', scientific_name: 'Ficus lyrata' });
    expect(bare.thumbUri).toBeNull();
    expect(bare.title).toBe('Ficus lyrata');
  });
});

describe('speciesDetailToVM', () => {
  test('maps names, about and hero from the real SpeciesDetail fields', () => {
    const vm = speciesDetailToVM(MOCK_DETAIL);
    expect(vm.commonName).toBe('Monstera');
    expect(vm.latinName).toBe('Monstera deliciosa');
    expect(vm.about).toBe(
      'A climbing aroid whose mature leaves split and fenestrate with light.'
    );
    expect(vm.heroUri).toBe(MOCK_DETAIL.image_url);
    expect(vm.speciesKey).toBe('monstera-deliciosa');
  });

  test('reads the care numbers the catalog gives', () => {
    expect(water(MOCK_DETAIL)).toBe('Every 7–10 days');
    expect(fact(MOCK_DETAIL, 'sun')).toBe('Bright, indirect');
    expect(fact(MOCK_DETAIL, 'temperature')).toBe('18–27℃ / 64–81℉');
    expect(fact(MOCK_DETAIL, 'humidity')).toBe('Average home is fine');
  });

  test('collapses an equal water range and handles a single bound', () => {
    expect(water({ water_interval_days_min: 7, water_interval_days_max: 7 })).toBe('Every 7 days');
    expect(water({ water_interval_days_min: 5 })).toBe('Every 5 days');
    expect(water({ water_interval_days_max: 9 })).toBe('Every 9 days');
  });

  test('falls back to water_note when the catalog only has prose', () => {
    expect(water({ water_note: 'When the topsoil dries.' })).toBe('When the topsoil dries.');
    expect(water({})).toBe('—');
  });

  test('falls back to the raw level when a label is missing', () => {
    expect(fact({ sun_level: 'low' }, 'sun')).toBe('low');
    expect(fact({ humidity_level: 'high' }, 'humidity')).toBe('high');
  });

  test('converts a single-bound temperature to °F too', () => {
    expect(fact({ temp_min_c: 10 }, 'temperature')).toBe('10℃ / 50℉');
  });

  test('derives chips from difficulty and toxicity, keeping the static pair when neither exists', () => {
    const vm = speciesDetailToVM(MOCK_DETAIL);
    expect(vm.chips).toEqual([
      { label: 'Easy', intent: 'positive', icon: 'stickers' },
      { label: 'Toxic', intent: 'negative', icon: 'outlined-paw' },
    ]);

    // toxic_to alone is enough to warrant the warning chip
    expect(speciesDetailToVM({ toxic_to: ['cats'] }).chips).toEqual([
      { label: 'Toxic', intent: 'negative', icon: 'outlined-paw' },
    ]);

    expect(speciesDetailToVM({ common_name: 'Mystery' }).chips).toBe(CHIPS);
  });

  test('defaults empty latinName and DEFAULT_ABOUT when detail is sparse', () => {
    const vm = speciesDetailToVM({ common_name: 'Mystery plant' });
    expect(vm.latinName).toBe('');
    expect(vm.about).toBe(DEFAULT_ABOUT);
    expect(vm.heroUri).toBeNull();
  });
});

describe('cardToVM', () => {
  test('builds a valid fallback VM from a card when detail is unavailable', () => {
    const vm = cardToVM({
      speciesKey: 'dracaena-trifasciata',
      title: 'Snake plant',
      subtitle: 'Dracaena trifasciata',
      thumbUri: 'https://img/snake.jpg',
      percent: 88,
    });
    expect(vm.commonName).toBe('Snake plant');
    expect(vm.latinName).toBe('Dracaena trifasciata');
    expect(vm.heroUri).toBe('https://img/snake.jpg');
    expect(vm.about).toBe(DEFAULT_ABOUT);
    expect(vm.highlights).toHaveLength(6);
    expect(vm.careActions).toHaveLength(3);
    expect(vm.chips).toBeDefined();
    expect(vm.faq).toEqual([]); // nothing to answer from without detail
    expect(vm.speciesKey).toBe('dracaena-trifasciata');
  });
});

// ---------------------------------------------------------------------------
// The catalog serves root-relative /media/... image paths (verified against the
// live API); RN's <Image> needs them absolute.
// ---------------------------------------------------------------------------
describe('media URLs', () => {
  const { API_BASE_URL } = require('../client');

  test('resolves a relative catalog path against the API base', () => {
    const vm = speciesDetailToVM({
      species_key: 'monstera-deliciosa',
      image_url: '/media/species/monstera-deliciosa/5244d63563561545-card.jpg',
    });
    expect(vm.heroUri).toBe(
      `${API_BASE_URL}/media/species/monstera-deliciosa/5244d63563561545-card.jpg`
    );
  });

  test('leaves an absolute provider URL untouched', () => {
    expect(
      candidateToCard({ id: 'c', rank: 1, reference_image_url: 'https://cdn/x.jpg' })
        .thumbUri
    ).toBe('https://cdn/x.jpg');
    expect(
      speciesDetailToVM({ image_url: 'http://cdn/y.jpg' }).heroUri
    ).toBe('http://cdn/y.jpg');
  });

  test('resolves search thumbnails too, and keeps null as null', () => {
    expect(summaryToCard({ species_key: 'k', image_thumb_url: '/media/t.jpg' }).thumbUri).toBe(
      `${API_BASE_URL}/media/t.jpg`
    );
    expect(summaryToCard({ species_key: 'k' }).thumbUri).toBeNull();
    expect(speciesDetailToVM({}).heroUri).toBeNull();
  });
});

// Live payload shape as returned by GET /plants/monstera-deliciosa.
test('maps the live catalog payload into every care fact and chip', () => {
  const vm = speciesDetailToVM({
    species_key: 'monstera-deliciosa',
    scientific_name: 'Monstera deliciosa',
    common_name: 'Swiss Cheese Plant',
    about: 'Split-leaf philodendron is not actually a philodendron.',
    water_interval_days_min: 7,
    water_interval_days_max: 10,
    sun_level: 'bright_indirect',
    sun_label: 'Bright, indirect',
    temp_min_c: 16,
    temp_max_c: 29,
    humidity_level: 'high',
    humidity_label: 'Likes humidity',
    difficulty: 'moderate',
    toxicity: 'toxic',
    toxic_to: ['humans', 'cats', 'dogs', 'horses'],
    image_url: '/media/species/monstera-deliciosa/card.jpg',
  });

  expect(vm.careActions.map((r) => r.value)).toEqual(['Every 7–10 days', '—', '—']);
  expect(vm.highlights.map((h) => h.value)).toEqual([
    'Toxic to humans, cats, dogs, horses',
    'Moderate',
    'Bright, indirect',
    '16–29℃ / 61–84℉',
    'Likes humidity',
    '—',
  ]);
  expect(vm.chips).toEqual([
    { label: 'Moderate', intent: 'positive', icon: 'stickers' },
    { label: 'Toxic', intent: 'negative', icon: 'outlined-paw' },
  ]);
  expect(vm.commonName).toBe('Swiss Cheese Plant');
});

// ---------------------------------------------------------------------------
// The redesigned product page (Figma 1:11377) reads more of SpeciesDetail than
// the old care grid did: six Highlights tiles, three "How to care" rows, and an
// FAQ built from the catalog rather than a fixed script.
// ---------------------------------------------------------------------------

const row = (d, action) => careActions(d).find((r) => r.action === action);

describe('highlights', () => {
  test('always returns the six Figma tiles, in order', () => {
    expect(highlights(MOCK_DETAIL).map((h) => h.label)).toEqual([
      'Toxicity',
      'Maintenance',
      'Sun',
      'Temperature',
      'Humidity',
      'Pruning',
    ]);
  });

  test('names who a plant is toxic to, falling back to the bare label', () => {
    expect(fact({ toxic_to: ['cats', 'dogs'] }, 'toxicity')).toBe('Toxic to cats, dogs');
    expect(fact({ toxicity: 'toxic' }, 'toxicity')).toBe('Toxic');
  });

  test('derives pruning from growth rate, which is what actually drives it', () => {
    expect(fact({ growth_rate: 'slow' }, 'pruning')).toBe('Rarely needed');
    expect(fact({ growth_rate: 'Fast' }, 'pruning')).toBe('Often needed');
  });

  test('shows an em dash rather than dropping a tile out of the grid', () => {
    expect(highlights({}).map((h) => h.value)).toEqual(['—', '—', '—', '—', '—', '—']);
  });
});

describe('careActions', () => {
  test('states a cadence and carries the interval the reminders are seeded from', () => {
    const d = { ...MOCK_DETAIL, fertilize_interval_days: 28, repot_interval_months: 24 };
    expect(row(d, 'water')).toMatchObject({ value: 'Every 7–10 days', intervalDays: 7 });
    expect(row(d, 'fertilize')).toMatchObject({ value: 'Every 4 weeks', intervalDays: 28 });
    expect(row(d, 'repot')).toMatchObject({ value: 'Every 2 years', intervalDays: 720 });
  });

  test('a monthly-or-longer cadence reads in months and years, not days', () => {
    expect(row({ fertilize_interval_days: 30 }, 'fertilize').value).toBe('Every month');
    expect(row({ fertilize_interval_days: 60 }, 'fertilize').value).toBe('Every 2 months');
    expect(row({ repot_interval_months: 12 }, 'repot').value).toBe('Every year');
    expect(row({ repot_interval_months: 18 }, 'repot').value).toBe('Every 18 months');
  });

  test('an unknown cadence cannot seed a reminder, and says so', () => {
    expect(row({}, 'fertilize')).toMatchObject({ value: '—', intervalDays: null });
  });
});

describe('faq', () => {
  test('answers only what the catalog actually knows', () => {
    expect(faq({})).toEqual([]);
  });

  test('builds the pet-safety answer from toxic_to when there is no note', () => {
    const [first] = faq({ toxic_to: ['cats', 'dogs'] });
    expect(first.q).toBe('Is it safe around pets?');
    expect(first.a).toContain('toxic to cats and dogs');
  });

  test('prefers the catalog\'s own note over the derived sentence', () => {
    expect(faq({ toxicity_note: 'Chewing the leaves causes mouth irritation.' })[0].a).toBe(
      'Chewing the leaves causes mouth irritation.',
    );
  });

  test('combines light and temperature into the where-should-it-live answer', () => {
    const answer = faq({ sun_label: 'Bright, indirect', temp_min_c: 18, temp_max_c: 27 }).find(
      (i) => i.q === 'Where should it live?',
    );
    expect(answer.a).toBe('Give it bright, indirect light. It is happiest at 18–27℃ / 64–81℉.');
  });

  test('growth rate closes the list', () => {
    const items = faq(MOCK_DETAIL);
    expect(items[items.length - 1].q).toBe('How fast does it grow?');
  });
});
