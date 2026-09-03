import { searchPlants, getSpecies } from '../plants';
import { apiFetch } from '../client';

jest.mock('../client', () => ({ apiFetch: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('searchPlants hits /plants/search with only the q param the spec defines', async () => {
  apiFetch.mockResolvedValueOnce([]);
  await searchPlants('monstera deliciosa');
  expect(apiFetch).toHaveBeenCalledWith('/plants/search?q=monstera%20deliciosa');
});

test('getSpecies keys off the species key, with no provider/source query', async () => {
  apiFetch.mockResolvedValueOnce({});
  await getSpecies('monstera-deliciosa');
  expect(apiFetch).toHaveBeenCalledWith('/plants/monstera-deliciosa');
});

test('getSpecies encodes the key', async () => {
  apiFetch.mockResolvedValueOnce({});
  await getSpecies('a/b');
  expect(apiFetch).toHaveBeenCalledWith('/plants/a%2Fb');
});
