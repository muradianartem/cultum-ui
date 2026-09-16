import { Children, cloneElement, isValidElement } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { avatar, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

// The "+N" overflow sits on a dark scrim laid over a photo, so it stays light
// on dark in both themes rather than following the page.
const OVERFLOW_SCRIM = 'rgba(21,21,21,0.4)';
const OVERFLOW_INK = '#FAFAFA';

/**
 * Avatar — person/entity mark, imported from Figma "Avatar - P3".
 *
 * Figma axes → props:
 *   Type (Photo / Initials / Overflow) → derived: `source` → Photo,
 *     `overflow` (a number) → "+N", else `initials` text
 *   Size (Extra small / Small / Medium / Large) → `size`: xs 24 / sm 32 / md 40 / lg 56
 *
 * Overflow dims a photo (or the plain fill) with a dark scrim and light "+N".
 * `ring` draws the page-coloured separator used inside <AvatarGroup>.
 */
export default function Avatar({
  source,
  initials,
  overflow,
  size = 'md',
  ring = false,
  style,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const dim = avatar.sizes[size] ?? avatar.sizes.md;
  const fontSize = avatar.fontSizes[size] ?? avatar.fontSizes.md;
  const isOverflow = overflow != null;

  const box = [
    styles.base,
    { width: dim, height: dim, borderRadius: radius.pill, backgroundColor: t.surface.primary },
    ring && { borderWidth: 1, borderColor: t.background.primary },
    style,
  ];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ?? (isOverflow ? `${overflow} more` : initials)
      }
      style={box}
      {...rest}
    >
      {source ? (
        <Image source={typeof source === 'string' ? { uri: source } : source} style={styles.image} />
      ) : null}

      {isOverflow ? (
        <>
          <View style={styles.scrim} />
          <Text style={[styles.overflow, { fontSize }]}>+{overflow}</Text>
        </>
      ) : !source && initials ? (
        <Text style={[styles.initials, { fontSize, color: t.text.primary }]}>{initials}</Text>
      ) : null}
    </View>
  );
}

/**
 * AvatarGroup — an overlapping cluster of Avatars with an optional "+N" overflow.
 * Pass <Avatar> children (or `avatars` data) and a `max`; extras collapse into
 * an overflow avatar. Each avatar gets a ring and negative overlap.
 */
export function AvatarGroup({ children, avatars, max = 5, size = 'md', style, ...rest }) {
  const overlap = -Math.round((avatar.sizes[size] ?? avatar.sizes.md) * 0.28);

  let items = avatars
    ? avatars.map((a, i) => <Avatar key={i} size={size} {...a} />)
    : Children.toArray(children);

  let extra = 0;
  if (items.length > max) {
    extra = items.length - max;
    items = items.slice(0, max);
  }

  const withRings = items.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          size: child.props.size ?? size,
          ring: true,
          style: [i > 0 && { marginLeft: overlap }, child.props.style],
        })
      : child
  );

  return (
    <View accessibilityRole="none" style={[styles.group, style]} {...rest}>
      {withRings}
      {extra > 0 ? (
        <Avatar size={size} overflow={extra} ring style={{ marginLeft: overlap }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: OVERFLOW_SCRIM },
  initials: { fontWeight: '600' },
  overflow: { fontWeight: '600', color: OVERFLOW_INK },
  group: { flexDirection: 'row', alignItems: 'center' },
});
