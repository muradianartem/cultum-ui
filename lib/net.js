// Connectivity probe, used to decide whether a failed request is *our* fault or
// the device's. The distinction matters: telling someone with four bars that
// they're offline sends them to reset their router instead of tapping retry.
import * as Network from 'expo-network';

/**
 * True only when the OS positively reports no usable connection.
 *
 * Anything unknown or unavailable answers false on purpose — an unreachable
 * server must never be reported as the user's connection being down.
 *
 * @returns {Promise<boolean>}
 */
export async function isOffline() {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state?.isInternetReachable === false) return true;
    return state?.isConnected === false;
  } catch {
    // No network module (web/tests) or the probe itself failed — don't guess.
    return false;
  }
}
