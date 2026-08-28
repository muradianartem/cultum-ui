import { apiFetch } from './client';

/**
 * Upload a captured/selected photo for identification.
 *
 * POST /scans — multipart/form-data, field `image`. Bearer-gated: with no token
 * the endpoint 401s (surfaced as ApiError code 'unauthorized').
 *
 * @param {string} imageUri  local file URI from the camera or image picker
 * @returns {Promise<object>} ScanResult { candidates[] }
 */
export async function createScan(imageUri) {
  const form = new FormData();
  form.append('image', { uri: imageUri, name: 'scan.jpg', type: 'image/jpeg' });
  return apiFetch('/scans', { method: 'POST', body: form });
}
