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

test('rejects when the detail fetch fails, rather than faking the care data', async () => {
  const boom = Object.assign(new Error('boom'), { code: 'network' });
  getSpecies.mockRejectedValueOnce(boom);
  const navigate = jest.fn();

  // Falling back to a card-built VM here would hand the Add Plant flow
  // placeholder watering intervals to seed real reminders from, with nothing on
  // screen saying the numbers were invented. The caller shows a retry instead.
  await expect(openPlant(CARD, navigate)).rejects.toBe(boom);
  expect(navigate).not.toHaveBeenCalled();
});

test('skips the fetch entirely when the card has no species key', async () => {
  const navigate = jest.fn();

  await openPlant({ ...CARD, speciesKey: null }, navigate);

  expect(getSpecies).not.toHaveBeenCalled();
  expect(navigate.mock.calls[0][1].plant.commonName).toBe('Swiss cheese plant');
});
