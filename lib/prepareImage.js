// Downscale + re-encode a photo before it goes over the wire.
//
// Two problems this solves. A modern iPhone capture is a 2–8 MB full-resolution
// JPEG (expo-camera's `quality` is compression, not size), and a multi-megabyte
// POST body over cellular is the single most common way an iOS upload dies with
// an unhelpful "network connection was lost". And the image picker hands back
// HEIC, which the API does not accept — re-encoding to JPEG makes that moot.
//
// ~1280px on the long edge is well past what identification needs, and takes a
// typical capture from megabytes to a few hundred kilobytes.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const MAX_EDGE = 1280;
export const JPEG_QUALITY = 0.7;

/**
 * @param {string} uri  local file URI from the camera or image picker
 * @param {{ width?: number, height?: number }} [dimensions]
 *        source dimensions when the caller already knows them (both the camera
 *        result and a picker asset carry them), which skips a decode
 * @returns {Promise<{uri: string, mimeType: string, fileName: string} | null>}
 *          null when preparation failed — callers fall back to the original
 *          file rather than losing the user's photo over a resize
 */
export async function prepareScanImage(uri, { width, height } = {}) {
  try {
    let source = uri;
    let w = width;
    let h = height;

    if (!w || !h) {
      const probed = await ImageManipulator.manipulate(uri).renderAsync();
      source = probed;
      w = probed.width;
      h = probed.height;
    }

    const context = ImageManipulator.manipulate(source);
    const longest = Math.max(w, h);
    if (longest > MAX_EDGE) {
      const scale = MAX_EDGE / longest;
      context.resize({ width: Math.round(w * scale), height: Math.round(h * scale) });
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: JPEG_QUALITY,
    });

    return { uri: saved.uri, mimeType: 'image/jpeg', fileName: 'scan.jpg' };
  } catch (e) {
    console.warn(`[prepareImage] falling back to the original file — ${e?.message}`);
    return null;
  }
}
