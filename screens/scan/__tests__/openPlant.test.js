import { openPlant } from '../openPlant';
import { getSpecies } from '../../../api/plants';
import { MOCK_DETAIL } from '../../../api/__mocks__/scanFixtures';

jest.mock('../../../api/plants', () => ({ getSpecies: jest.fn() }));

const CARD = {
  candidateId: 'cand-1',
  speciesKey: 'monstera-deliciosa',
  title: 'Swiss cheese plant',
  subtitle: 'Monstera deliciosa',
  thumbUri: 'https://img/monstera.jpg',
  percent: 52,
};

beforeEach(() => jest.clearAllMocks());

test('fetches detail by species key and navigates to product with the mapped VM', async () => {
  getSpecies.mockResolvedValueOnce(MOCK_DETAIL);
  const navigate = jest.fn();

  await openPlant(CARD, navigate);

  expect(getSpecies).toHaveBeenCalledWith('monstera-deliciosa');
  expect(navigate).toHaveBeenCalledTimes(1);
  const [route, params] = navigate.mock.calls[0];
  expect(route).toBe('product');
  expect(params.plant.commonName).toBe('Monstera');
  expect(params.plant.latinName).toBe('Monstera deliciosa');
});

test('uses the scan response’s inline care payload instead of re-fetching it', async () => {
  const navigate = jest.fn();

  await openPlant(CARD, navigate, { care: MOCK_DETAIL });

  expect(getSpecies).not.toHaveBeenCalled();
  const [, params] = navigate.mock.calls[0];
  expect(params.plant.commonName).toBe('Monstera');
  expect(params.plant.careFacts.find((f) => f.label === 'Water').value).toBe(
    'Every 7–10 days'
  );
});

test('ignores inline care that describes a different species', async () => {
  getSpecies.mockResolvedValueOnce(MOCK_DETAIL);
  const navigate = jest.fn();

  const other = { ...CARD, speciesKey: 'epipremnum-aureum' };
  await openPlant(other, navigate, { care: MOCK_DETAIL });

  expect(getSpecies).toHaveBeenCalledWith('epipremnum-aureum');
});

test('falls back to a card-built VM when the detail fetch fails', async () => {
  getSpecies.mockRejectedValueOnce(new Error('boom'));
  const navigate = jest.fn();

  await openPlant(CARD, navigate);

  const [route, params] = navigate.mock.calls[0];
  expect(route).toBe('product');
  expect(params.plant.commonName).toBe('Swiss cheese plant');
  expect(params.plant.heroUri).toBe('https://img/monstera.jpg');
});

test('skips the fetch entirely when the card has no species key', async () => {
  const navigate = jest.fn();

  await openPlant({ ...CARD, speciesKey: null }, navigate);

  expect(getSpecies).not.toHaveBeenCalled();
  expect(navigate.mock.calls[0][1].plant.commonName).toBe('Swiss cheese plant');
});
