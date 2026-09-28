import { StyleSheet, View } from 'react-native';
import { list } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * StateIcon — the tinted circle a glyph sits in, imported from Figma
 * "State Icon Item" (Type=Secondary → brand-secondary).
 *
 * Two sizes in the design, and they are not interchangeable: `md` (40px, a 20px
 * glyph) is the leading area of a list row; `lg` (48px, a 24px glyph) is the
 * icon on a Card and the one at the top of a centred panel. The caller supplies
 * the glyph already sized — this only draws the circle around it.
 *
 * `variant="outlined"` is Figma Type=Outlined: no fill, a 1pt border-primary
 * ring (the room icon on a Room Card).
 */
export default function StateIcon({ size = 'md', variant = 'secondary', children, style, ...rest }) {
  const t = useTheme();
  const diameter = size === 'lg' ? 48 : list.beforeBadgeSize;
  const look =
    variant === 'outlined'
      ? { borderWidth: 1, borderColor: t.border.primary }
      : { backgroundColor: t.brand.secondary };
  return (
    <View
      style={[styles.circle, { width: diameter, height: diameter }, look, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

/** The glyph size that belongs inside each circle, so callers agree on it. */
export const STATE_ICON_GLYPH = { md: 20, lg: 24 };

const styles = StyleSheet.create({
  circle: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
