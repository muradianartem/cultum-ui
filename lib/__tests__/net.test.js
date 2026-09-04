import { isOffline } from '../net';
import * as Network from 'expo-network';

jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('reports offline when the OS says the internet is unreachable', async () => {
  Network.getNetworkStateAsync.mockResolvedValue({
    isConnected: true,
    isInternetReachable: false,
  });
  await expect(isOffline()).resolves.toBe(true);
});

test('reports offline when there is no connection at all', async () => {
  Network.getNetworkStateAsync.mockResolvedValue({ isConnected: false });
  await expect(isOffline()).resolves.toBe(true);
});

test('does not claim offline for a live connection', async () => {
  Network.getNetworkStateAsync.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
  await expect(isOffline()).resolves.toBe(false);
});

// The whole point of this module is to stop an unreachable *server* from being
// reported as the user's connection being down — so anything we can't determine
// has to answer "not offline".
test('does not guess when reachability is unknown', async () => {
  Network.getNetworkStateAsync.mockResolvedValue({ isConnected: true });
  await expect(isOffline()).resolves.toBe(false);

  Network.getNetworkStateAsync.mockResolvedValue({});
  await expect(isOffline()).resolves.toBe(false);
});

test('does not guess when the probe itself fails', async () => {
  Network.getNetworkStateAsync.mockRejectedValue(new Error('no module'));
  await expect(isOffline()).resolves.toBe(false);
});
