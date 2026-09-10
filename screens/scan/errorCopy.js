/**
 * Error copy for the scan flow, keyed by ApiError.code (api/client.js).
 *
 * Shared by the camera (upload failures), Matches and Search (species-detail
 * failures) so the same underlying failure reads the same way wherever it
 * surfaces. Note the split between 'offline' and 'network': `offline` is only
 * ever set when the OS confirmed there isn't a connection — a request we simply
 * couldn't complete says so instead of sending someone to go restart their
 * router. The wording stays transport-level for that reason, rather than naming
 * the upload or the fetch.
 */
const ERROR_COPY = {
  unauthorized: {
    title: 'Your session expired.',
    subtitle: 'Sign in again to identify plants by photo.',
  },
  offline: {
    title: 'You’re offline.',
    subtitle: 'Check your connection and try again.',
  },
  network: {
    title: 'Couldn’t reach Cultum.',
    subtitle: 'The request didn’t get through. Try again.',
  },
  timeout: {
    title: 'That took too long.',
    subtitle: 'The server didn’t answer in time. Try again in a moment.',
  },
  camera: {
    title: 'Couldn’t take the photo.',
    subtitle: 'Try again, or pick an existing picture.',
  },
  http: {
    title: 'Something went wrong.',
    subtitle: 'Try again in a moment.',
  },
};

/**
 * @param {string} [code]  ApiError.code, or a flow-specific code like 'camera'
 * @returns {{title: string, subtitle: string}} never undefined — unknown codes
 *          fall through to the generic 'http' copy
 */
export function copyFor(code) {
  return ERROR_COPY[code] ?? ERROR_COPY.http;
}
