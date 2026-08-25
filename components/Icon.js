import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { ICON_XML, ICON_NAMES } from './iconRegistry';

/**
 * Icon — the Cultum icon set (142 glyphs from the design-system "Icons" frame).
 *
 * All monochrome icons render in `color` (they were normalised to
 * fill="currentColor" at build time). The four brand logos — apple, facebook,
 * google, x — keep their own colours and ignore `color`.
 *
 * Drops straight into the icon-agnostic library props:
 *   <Button leftIcon={<Icon name="search" />} ... />
 *   <ButtonIcon icon={<Icon name="trash" />} accessibilityLabel="Delete" />
 *
 * @param {keyof typeof ICON_XML} name  icon name, e.g. "mail" (see ICON_NAMES)
 * @param {number} size   width/height in px (default 24 — the native art size)
 * @param {string} color  glyph colour for monochrome icons (default ink)
 */
export default function Icon({ name, size = 24, color = colors.ink, style, ...rest }) {
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
      color={color}
      style={style}
      {...rest}
    />
  );
}

export { ICON_NAMES };
