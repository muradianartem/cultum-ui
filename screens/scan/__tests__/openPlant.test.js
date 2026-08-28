import { openPlant } from '../openPlant';
import { getPlantDetail } from '../../../api/plants';
import { MOCK_DETAIL } from '../../../api/__mocks__/scanFixtures';

jest.mock('../../../api/plants', () => ({ getPlantDetail: jest.fn() }));

const CARD = {
  title: 'Monstera',
  subtitle: 'Monstera deliciosa',
  thumbUri: 'https://img/monstera.jpg',
  percent: 52,
  sourceId: '2868',
  source: 'perenual',
};

beforeEach(() => jest.clearAllMocks());

test('fetches detail by sourceId and navigates to product with the mapped VM', async () => {
  getPlantDetail.mockResolvedValueOnce(MOCK_DETAIL);
  const navigate = jest.fn();

  await openPlant(CARD, navigate);

  expect(getPlantDetail).toHaveBeenCalledWith('2868', 'perenual');
  expect(navigate).toHaveBeenCalledTimes(1);
  const [route, params] = navigate.mock.calls[0];
  expect(route).toBe('product');
  expect(params.plant.commonName).toBe('Monstera');
  expect(params.plant.latinName).toBe('Monstera deliciosa');
});

test('falls back to a card-built VM when the detail fetch fails', async () => {
  getPlantDetail.mockRejectedValueOnce(new Error('boom'));
  const navigate = jest.fn();

  await openPlant(CARD, navigate);

  const [route, params] = navigate.mock.calls[0];
  expect(route).toBe('product');
  expect(params.plant.commonName).toBe('Monstera');
  expect(params.plant.heroUri).toBe('https://img/monstera.jpg');
});

test('skips the fetch entirely when the card has no sourceId', async () => {
  const navigate = jest.fn();

  await openPlant({ ...CARD, sourceId: null }, navigate);

  expect(getPlantDetail).not.toHaveBeenCalled();
  expect(navigate.mock.calls[0][1].plant.commonName).toBe('Monstera');
});
