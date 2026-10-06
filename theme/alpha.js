// A theme colour role at a foundation opacity step ('#RRGGBB', opacity[50] →
// 'rgba(r,g,b,0.5)'), for Figma fills that are a role at partial opacity —
// e.g. a gradient into the page ground — which a flat role can't express.
export function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
