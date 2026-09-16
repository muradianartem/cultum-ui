import { Pressable, StyleSheet, Text, View } from 'react-native';
import { list } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * ListItem — one row of a List, imported from Figma "List – P2" (List Item).
 *
 * Layout: optional before area, a title + optional subtitle, optional after
 * area, and an optional hairline divider beneath. Figma axes → props:
 *   Show Area Before / After → `before` / `after` (arbitrary nodes)
 *   Show Subtitle            → `subtitle`
 *   Show Label               → `value` (the muted text before the after area)
 *   Show Divider             → `divider`
 *   State (Pressed)          → tap feedback when `onPress` is set
 *   Style (List / Card)      → `variant` (padding)
 *   Destructive              → `destructive` (title turns error-primary)
 *
 * Pressed is the translucent `interaction.pressed` layer rather than a fixed
 * grey, so it reads on both the page ground (List) and the card panel (Card) in
 * either theme.
 *
 * `value` is its own prop rather than something the caller stuffs into `after`
 * because it is a distinct Figma slot with its own colour and alignment, and the
 * settings screens use it six times over (`App`, `System`, `1.0`, `9:00 AM`, a
 * legal URL). It sits between the title block and the after area, as drawn.
 */
export default function ListItem({
  title,
  subtitle,
  before,
  after,
  value,
  destructive = false,
  divider = false,
  onPress,
  variant = 'list',
  style,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const isCard = variant === 'card';

  const Row = onPress ? Pressable : View;
  const rowProps = onPress
    ? {
        onPress,
        accessibilityRole: 'button',
        accessibilityLabel:
          accessibilityLabel ?? (typeof title === 'string' ? title : undefined),
      }
    : {};

  // Pressable evaluates a function style (for the pressed state); a plain View
  // does NOT — handing it a function silently drops all styling. So build the
  // style as a function for Pressable and a resolved array for View.
  const rowStyle = ({ pressed } = {}) => [
    styles.row,
    isCard ? styles.padCard : styles.padList,
    pressed && { backgroundColor: t.interaction.pressed, borderRadius: list.rowRadius },
    style,
  ];

  return (
    <Row
      {...rowProps}
      style={onPress ? rowStyle : rowStyle()}
      {...rest}
    >
      {before ? <View style={styles.before}>{before}</View> : null}

      <View style={styles.middle}>
        {typeof title === 'string' ? (
          <Text
            style={[
              styles.title,
              // Figma overrides the title's fill rather than using the component's
              // own Destructive variant, so the leading badge and chevron stay untinted.
              { color: destructive ? t.error.primary : t.text.primary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.text.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value != null && value !== '' ? (
        <Text style={[styles.value, { color: t.text.secondary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {after ? <View style={styles.after}>{after}</View> : null}

      {divider ? (
        <View style={[styles.divider, { backgroundColor: t.border.primary }]} />
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  padList: { paddingVertical: 12 },
  padCard: { paddingVertical: 12, paddingHorizontal: 16 },
  before: { justifyContent: 'center' },
  middle: { flex: 1, gap: 2 },
  title: { fontSize: 16, lineHeight: 22 },
  value: { fontSize: 14, lineHeight: 20, flexShrink: 0 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  after: { justifyContent: 'center' },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
  },
});
