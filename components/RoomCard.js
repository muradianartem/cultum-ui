import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';

/**
 * RoomCard — one room on the Rooms list, imported from Figma "Room Card"
 * (node 376:83).
 *
 * A 2x2 photo mosaic over a name + meta line. Figma's component properties map
 * to props:
 *   Room  → `name`
 *   Meta  → `meta`   ("3 plants · 2 to check")
 *
 * The mosaic is a fixed 216pt block with 2pt gutters, clipped by a 12pt radius.
 * Each cell is one plant's photo, filled in order; cells beyond the photos it
 * is given stay flat surface tint (Figma 505:34660 — a one-plant room shows
 * its photo top-left and three empty tiles). Photos are never repeated.
 *
 * The title is Figma "Heading/Heading Small" (Literata 20/26).
 */
export default function RoomCard({ name, meta, photos = [], onPress, style, ...rest }) {
  const t = useTheme();

  // Always four cells: one per photo, bare tiles for the rest.
  const cells = [0, 1, 2, 3].map((i) => photos[i] ?? null);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${name}, ${meta}` : name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      {...rest}
    >
      <View style={[styles.mosaic, { backgroundColor: t.surface.primary }]}>
        <View style={styles.row}>
          <Cell source={cells[0]} tint={t.surface.primary} />
          <Cell source={cells[1]} tint={t.surface.primary} />
        </View>
        <View style={styles.row}>
          <Cell source={cells[2]} tint={t.surface.primary} />
          <Cell source={cells[3]} tint={t.surface.primary} />
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={[styles.name, { color: t.text.primary }]} numberOfLines={1}>
          {name}
        </Text>
        {meta ? (
          <Text style={[styles.metaText, { color: t.text.secondary }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Cell({ source, tint }) {
  if (!source) return <View style={[styles.cell, { backgroundColor: tint }]} />;
  return <Image source={source} style={styles.cell} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: space[12] },
  pressed: { opacity: 0.85 },
  mosaic: {
    height: 216,
    borderRadius: radius[12],
    overflow: 'hidden',
    rowGap: 2,
  },
  row: { flex: 1, flexDirection: 'row', columnGap: 2 },
  // The explicit width matters on RN Web, where an <img> with no width falls
  // back to its intrinsic size and ignores resizeMode.
  cell: { flex: 1, width: '100%', height: '100%' },
  meta: { gap: 6 },
  name: { ...typography.headingSmall },
  metaText: { ...typography.bodyMedium },
});
