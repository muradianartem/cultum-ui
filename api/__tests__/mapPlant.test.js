import {
  matchesCaption,
  candidateToCard,
  summaryToCard,
  speciesDetailToVM,
  cardToVM,
} from '../mapPlant';
import { DEFAULT_ABOUT, CHIPS } from '../../screens/plantData';
import { MOCK_DETAIL } from '../__mocks__/scanFixtures';

const water = (vm) => vm.careFacts.find((f) => f.label === 'Water').value;
const fact = (vm, label) => vm.careFacts.find((f) => f.label === label).value;

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

  test('builds all four care facts, in the order ProductPage indexes them', () => {
    const vm = speciesDetailToVM(MOCK_DETAIL);
    expect(vm.careFacts.map((f) => f.label)).toEqual([
      'Water',
      'Sun',
      'Temperature',
      'Humidity',
    ]);
    expect(water(vm)).toBe('Every 7–10 days');
    expect(fact(vm, 'Sun')).toBe('Bright, indirect');
    expect(fact(vm, 'Temperature')).toBe('18–27℃ / 64–81℉');
    expect(fact(vm, 'Humidity')).toBe('Average home is fine');
  });

  test('collapses an equal water range and handles a single bound', () => {
    expect(
      water(speciesDetailToVM({ water_interval_days_min: 7, water_interval_days_max: 7 }))
    ).toBe('Every 7 days');
    expect(water(speciesDetailToVM({ water_interval_days_min: 5 }))).toBe('Every 5 days');
    expect(water(speciesDetailToVM({ water_interval_days_max: 9 }))).toBe('Every 9 days');
  });

  test('falls back to water_note, then to the static placeholder', () => {
    expect(water(speciesDetailToVM({ water_note: 'When the topsoil dries.' }))).toBe(
      'When the topsoil dries.'
    );
    expect(water(speciesDetailToVM({}))).toBe('Every 7–10 days');
  });

  test('falls back to the raw level when a label is missing, then to the placeholder', () => {
    const levels = speciesDetailToVM({ sun_level: 'low', humidity_level: 'high' });
    expect(fact(levels, 'Sun')).toBe('low');
    expect(fact(levels, 'Humidity')).toBe('high');

    const bare = speciesDetailToVM({});
    expect(fact(bare, 'Sun')).toBe('Bright, indirect');
    expect(fact(bare, 'Temperature')).toBe('18–27℃ / 64–81℉');
    expect(fact(bare, 'Humidity')).toBe('Average home is fine');
  });

  test('converts a single-bound temperature to °F too', () => {
    expect(fact(speciesDetailToVM({ temp_min_c: 10 }), 'Temperature')).toBe('10℃ / 50℉');
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
    expect(vm.careFacts).toHaveLength(4);
    expect(vm.chips).toBeDefined();
    expect(vm.faq).toBeDefined();
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

  expect(vm.careFacts.map((f) => f.value)).toEqual([
    'Every 7–10 days',
    'Bright, indirect',
    '16–29℃ / 61–84℉',
    'Likes humidity',
  ]);
  expect(vm.chips).toEqual([
    { label: 'Moderate', intent: 'positive', icon: 'stickers' },
    { label: 'Toxic', intent: 'negative', icon: 'outlined-paw' },
  ]);
  expect(vm.commonName).toBe('Swiss Cheese Plant');
});
