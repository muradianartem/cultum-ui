import { Alert } from 'react-native';

/**
 * The line to show for a failed garden request (an api/client.js ApiError, or
 * anything else that was thrown).
 *
 * Every garden change is a request now, so a failure is something the user
 * has to hear about: nothing is saved behind their back for later.
 */
export function errorMessage(e) {
  if (e?.code === 'offline') return 'You’re offline. Connect to the internet and try again.';
  if (e?.code === 'network' || e?.code === 'timeout') {
    return 'We couldn’t reach Cultum. Check your connection and try again.';
  }
  if (e?.status === 402 || e?.status === 403) {
    return 'Your plan doesn’t allow this. Upgrade to Plus to add more.';
  }
  if (e?.status === 404) return 'This no longer exists. Reopen the app to see the latest.';
  return 'Something went wrong on our side. Please try again.';
}

/** Tell the user a change didn't go through. */
export function showError(e, title = 'Couldn’t save your change') {
  Alert.alert(title, errorMessage(e));
}
