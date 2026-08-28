import {
  matchesCaption,
  candidateToCard,
  summaryToCard,
  plantDetailToVM,
  cardToVM,
} from '../mapPlant';
import { DEFAULT_ABOUT } from '../../screens/plantData';

describe('matchesCaption', () => {
  test('interpolates the top percent into the verbatim design caption', () => {
    expect(matchesCaption(52)).toBe(
      '52% is a guess, not an answer. Retake it closer, or search by name.'
    );
  });
});

describe('candidateToCard', () => {
  test('maps a scan candidate to a SpeciesCardModel with a rounded percent', () => {
    const card = candidateToCard({
      scientific_name: 'Monstera deliciosa',
      common_name: 'Swiss cheese plant',
      probability: 0.524,
      provider_ref: 'perenual-2868',
      reference_image_url: 'https://img/monstera.jpg',
    });
    expect(card).toEqual({
      title: 'Swiss cheese plant',
      subtitle: 'Monstera deliciosa',
      thumbUri: 'https://img/monstera.jpg',
      percent: 52,
      sourceId: 'perenual-2868',
      source: 'perenual',
    });
  });

  test('falls back to scientific_name for title and 0% when fields are missing', () => {
    const card = candidateToCard({ scientific_name: 'Ficus lyrata' });
    expect(card.title).toBe('Ficus lyrata');
    expect(card.percent).toBe(0);
  });
});

describe('summaryToCard', () => {
  test('maps a search summary to a card with no confidence percent', () => {
    const card = summaryToCard({
      common_name: 'Snake plant',
      scientific_name: 'Dracaena trifasciata',
      image_url: 'https://img/snake.jpg',
      source: 'perenual',
      source_id: '2100',
    });
    expect(card).toEqual({
      title: 'Snake plant',
      subtitle: 'Dracaena trifasciata',
      thumbUri: 'https://img/snake.jpg',
      percent: null,
      sourceId: '2100',
      source: 'perenual',
    });
  });

  test('defaults source to perenual when absent', () => {
    expect(summaryToCard({ common_name: 'x', source_id: '1' }).source).toBe('perenual');
  });
});

describe('plantDetailToVM', () => {
  test('maps names/about and overrides the Water care fact from watering_frequency_days', () => {
    const vm = plantDetailToVM({
      common_name: 'Snake plant',
      scientific_name: 'Dracaena trifasciata',
      brief: 'A hardy succulent.',
      image_url: 'https://img/snake.jpg',
      watering_frequency_days: 7,
      source: 'perenual',
      source_id: '2100',
    });
    expect(vm.commonName).toBe('Snake plant');
    expect(vm.latinName).toBe('Dracaena trifasciata');
    expect(vm.about).toBe('A hardy succulent.');
    expect(vm.heroUri).toBe('https://img/snake.jpg');
    expect(vm.careFacts).toHaveLength(4);
    const water = vm.careFacts.find((f) => f.label === 'Water');
    expect(water.value).toBe('Every 7 days');
    expect(vm.source).toBe('perenual');
    expect(vm.sourceId).toBe('2100');
  });

  test('defaults empty latinName and DEFAULT_ABOUT and keeps the static Water fact', () => {
    const vm = plantDetailToVM({ common_name: 'Mystery plant' });
    expect(vm.latinName).toBe('');
    expect(vm.about).toBe(DEFAULT_ABOUT);
    expect(vm.heroUri).toBeNull();
    expect(vm.careFacts.find((f) => f.label === 'Water').value).toBe('Every 7–10 days');
  });
});

describe('cardToVM', () => {
  test('builds a valid fallback VM from a SpeciesCardModel when detail is unavailable', () => {
    const vm = cardToVM({
      title: 'Snake plant',
      subtitle: 'Dracaena trifasciata',
      thumbUri: 'https://img/snake.jpg',
      percent: 88,
      sourceId: '2100',
      source: 'perenual',
    });
    expect(vm.commonName).toBe('Snake plant');
    expect(vm.latinName).toBe('Dracaena trifasciata');
    expect(vm.heroUri).toBe('https://img/snake.jpg');
    expect(vm.about).toBe(DEFAULT_ABOUT);
    expect(vm.careFacts).toHaveLength(4);
    expect(vm.chips).toBeDefined();
    expect(vm.faq).toBeDefined();
    expect(vm.sourceId).toBe('2100');
    expect(vm.source).toBe('perenual');
  });
});
