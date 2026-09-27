/**
 * Shorten free text for a collapsed preview.
 *
 * Runs of whitespace (the catalog's `about` often arrives as one raw block
 * with stray newlines) collapse to single spaces first. Text over `max`
 * characters is cut at the last word boundary within `max` — or hard at `max`
 * when there is none — loses any dangling punctuation, and ends in "…".
 *
 * @returns {{ text: string, full: string, truncated: boolean }}
 *   `full` is the whitespace-normalised original, for the expanded view.
 */
export function truncateText(text, max = 150) {
  const full = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (full.length <= max) return { text: full, full, truncated: false };

  const space = full.lastIndexOf(' ', max);
  const cut = full.slice(0, space > 0 ? space : max).replace(/[\s.,;:!?—–-]+$/, '');
  return { text: `${cut}…`, full, truncated: true };
}
