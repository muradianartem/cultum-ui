import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';
import { fonts } from '../theme/tokens';

/**
 * PlantCard — one plant tile, imported from Figma "Plant Card" (node 376:80).
 *
 * Figma's component properties map to props:
 *   Name → `name`   (the nickname, "Kitchen Monstera")
 *   Meta → `meta`   (the species, "Monstera deliciosa")
 *
 * A 120pt photo over the two lines. The card carries no width of its own — it
 * is meant to sit in a `flex: 1` cell of the two-column grid the room screens
 * lay out (screens/rooms/PlantGrid.js).
 *
 * The name is the serif display face at 18pt (Figma "Heading/Heading Extra
 * Small" is Literata, which theme/foundations' Inter scale doesn't carry).
 */
export default function PlantCard({ name, meta, photo, onPress, style, ...rest }) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${name}, ${meta}` : name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      {...rest}
    >
      {photo ? (
        <Image source={photo} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, { backgroundColor: t.surface.primary }]} />
      )}

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

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: space[12] },
  pressed: { opacity: 0.85 },
  // width:'100%' as well as the stretch: without an explicit width RN Web
  // lays the <img> out at its intrinsic size and ignores resizeMode.
  photo: { alignSelf: 'stretch', width: '100%', height: 120, borderRadius: radius[16] },
  meta: { gap: 6 },
  name: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23 },
  metaText: { ...typography.bodyMedium },
});
