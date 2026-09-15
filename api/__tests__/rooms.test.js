import { createRoom, deleteRoom, listRooms, updateRoom } from '../rooms';
import { addPlant, updatePlant } from '../garden';
import { apiFetch } from '../client';

jest.mock('../client', () => ({ apiFetch: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

const [path, init] = [() => apiFetch.mock.calls[0][0], () => apiFetch.mock.calls[0][1] ?? {}];
const body = () => JSON.parse(init().body);

test('listRooms reads the user rooms collection', async () => {
  apiFetch.mockResolvedValueOnce([]);
  await listRooms();
  expect(path()).toBe('/users/me/rooms');
  expect(init().method).toBeUndefined();
});

test('createRoom posts the RoomCreate fields, snake_cased, with the icon alongside', async () => {
  apiFetch.mockResolvedValueOnce({ id: 'RK' });
  await createRoom({ name: 'Kitchen', icon: 'kitchen', light: 'unknown', sortOrder: 2 });
  expect(path()).toBe('/users/me/rooms');
  expect(init().method).toBe('POST');
  expect(body()).toEqual({ name: 'Kitchen', icon: 'kitchen', light: 'unknown', sort_order: 2 });
});

test('createRoom leaves out what it was not given, so the server defaults apply', async () => {
  apiFetch.mockResolvedValueOnce({ id: 'RK' });
  await createRoom({ name: 'Kitchen' });
  expect(body()).toEqual({ name: 'Kitchen' });
});

test('updateRoom patches only the defined fields', async () => {
  apiFetch.mockResolvedValueOnce({});
  await updateRoom('R/1', { name: 'Galley', sortOrder: undefined });
  expect(path()).toBe('/users/me/rooms/R%2F1');
  expect(init().method).toBe('PATCH');
  expect(body()).toEqual({ name: 'Galley' });
});

test('deleteRoom deletes by id', async () => {
  apiFetch.mockResolvedValueOnce(null);
  await deleteRoom('R1');
  expect(path()).toBe('/users/me/rooms/R1');
  expect(init().method).toBe('DELETE');
});

test('addPlant sends the room as room_id, not a location string', async () => {
  apiFetch.mockResolvedValueOnce({ id: 'S1' });
  await addPlant({ speciesKey: 'monstera', nickname: 'Penny', roomId: 'RK', acquiredAt: '2026-09-01' });
  expect(body()).toEqual({
    species_key: 'monstera',
    nickname: 'Penny',
    room_id: 'RK',
    acquired_at: '2026-09-01',
  });
});

test('updatePlant patches a rename or a move, and an explicit null takes the plant out of its room', async () => {
  apiFetch.mockResolvedValueOnce({});
  await updatePlant('S1', { nickname: 'Penny', roomId: null });
  expect(path()).toBe('/users/me/plants/S1');
  expect(init().method).toBe('PATCH');
  expect(body()).toEqual({ nickname: 'Penny', room_id: null });
});
