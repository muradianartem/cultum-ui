// An edit made while a sync round is awaiting the network.
//
// Unlike undoSync.test.js this runs the real store/sync.js: the bug it pins
// lived in how the provider commits a round, so only the api is faked — with
// promises the test resolves by hand, so the edit lands mid-round.

import TestRenderer, { act } from 'react-test-renderer';
import { GardenProvider, useGarden } from '../GardenProvider';
import { seedGarden } from '../testing';
import * as gardenApi from '../../api/garden';

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ status: 'signedIn', devSession: false }),
}));
jest.mock('../../api/garden', () => ({
  getGarden: jest.fn(),
  addPlant: jest.fn(),
  updatePlant: jest.fn(),
  removePlant: jest.fn(),
  createReminder: jest.fn(),
  updateReminder: jest.fn(),
  deleteReminder: jest.fn(),
  completeReminder: jest.fn(),
}));
jest.mock('../../api/rooms', () => ({
  listRooms: jest.fn(async () => []),
  createRoom: jest.fn(),
  updateRoom: jest.fn(),
  deleteRoom: jest.fn(),
}));

jest.useFakeTimers();

const NOW = new Date(2026, 8, 5, 15, 0, 0);
const SYNC_MS = 2000;

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function mountGarden(state) {
  const api = {};
  function Probe() {
    Object.assign(api, useGarden());
    return null;
  }
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <GardenProvider initialState={state} clock={NOW}>
        <Probe />
      </GardenProvider>,
    );
  });
  return { tree, api };
}

test('renaming a synced plant while the pull is pending keeps the new name and its update', async () => {
  const state = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', serverId: 'S1' }] });
  const plant = state.plants[0];
  const pull = deferred();
  gardenApi.getGarden.mockReturnValueOnce(pull.promise);

  const { tree, api } = mountGarden(state);
  await act(async () => {
    jest.advanceTimersByTime(SYNC_MS); // the mount's own round starts, and waits on the pull
  });
  expect(gardenApi.getGarden).toHaveBeenCalledTimes(1);

  act(() => api.renamePlant(plant.id, 'Fern'));
  await act(async () => {
    pull.resolve([{ id: 'S1', species_key: 'monstera-deliciosa', nickname: 'Penny', room_id: null, reminders: [] }]);
  });

  expect(api.state.plants.map((p) => p.nickname)).toEqual(['Fern']);
  expect(api.state.outbox).toEqual([
    { op: 'plant.update', localId: plant.id, serverId: 'S1', attempts: 0 },
  ]);

  act(() => tree.unmount());
});
