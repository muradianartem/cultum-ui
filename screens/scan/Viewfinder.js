import Svg, { Path } from 'react-native-svg';

// Figma "Subtract" (158:12396): the whole frame dimmed, with the viewfinder
// square punched out, plus four corner brackets. One <Svg> does both — RN has
// no mask primitive, and four positioned Views can't give the rounded cutout.
const DIM = 'rgba(0, 0, 0, 0.3)';
const BRACKET = '#FAFAFA';
const BRACKET_WIDTH = 3;
const ARM = 28; // straight run of each bracket beyond the corner arc

function roundedRect(x, y, w, h, r) {
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    ` V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    ` H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    ` V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

function brackets(x, y, w, h, r) {
  return [
    `M ${x} ${y + r + ARM} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + r + ARM} ${y}`,
    `M ${x + w - r - ARM} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + r + ARM}`,
    `M ${x + w} ${y + h - r - ARM} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} L ${x + w - r - ARM} ${y + h}`,
    `M ${x + r + ARM} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + h - r - ARM}`,
  ];
}

/**
 * Viewfinder — the dimming mask + corner brackets over the camera preview.
 *
 * @param {number} width   screen width
 * @param {number} height  screen height
 * @param {number} size    side of the square cutout
 * @param {number} top     cutout's distance from the top of the screen
 * @param {number} radius  cutout corner radius
 */
export default function Viewfinder({ width, height, size, top, radius = 24 }) {
  const x = (width - size) / 2;
  const y = top;
  const dimPath = `M 0 0 H ${width} V ${height} H 0 Z ${roundedRect(x, y, size, size, radius)}`;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path d={dimPath} fill={DIM} fillRule="evenodd" />
      {brackets(x, y, size, size, radius).map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={BRACKET}
          strokeWidth={BRACKET_WIDTH}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}
