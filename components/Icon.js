import { SvgXml } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { ICON_XML, ICON_NAMES } from './iconRegistry';

/**
 * Icon — the Cultum icon set (158 glyphs from the design-system "Icons" frame).
 *
 * All monochrome icons render in `color` (they were normalised to
 * fill="currentColor" at build time). The multicolour brand logos — facebook,
 * google, x, cultum-logo — keep their own colours and ignore `color`. `apple`
 * is a silhouette, so it follows `color` like any monochrome glyph (Apple's
 * guidelines require the mark to be white on a dark background).
 *
 * Drops straight into the icon-agnostic library props:
 *   <Button leftIcon={<Icon name="search" />} ... />
 *   <ButtonIcon icon={<Icon name="trash" />} accessibilityLabel="Delete" />
 *
 * @param {keyof typeof ICON_XML} name  icon name, e.g. "mail" (see ICON_NAMES)
 * @param {number} size   width/height in px (default 24 — the native art size)
 * @param {string} color  glyph colour for monochrome icons (default text-primary
 *                        for the active theme)
 */
export default function Icon({ name, size = 24, color, style, ...rest }) {
  const t = useTheme();
  const xml = ICON_XML[name];
  if (!xml) {
    if (__DEV__) {
      console.warn(`<Icon> unknown name "${name}". See ICON_NAMES for valid names.`);
    }
    return null;
  }
  return (
    <SvgXml
      xml={xml}
      width={size}
      height={size}
      color={color ?? t.text.primary}
      style={style}
      {...rest}
    />
  );
}

export { ICON_NAMES };
