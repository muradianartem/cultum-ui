import { Pressable, StyleSheet, Text, View } from 'react-native';
import { list, divider as dividerToken } from '../theme/tokens';

// The one red in the design system's settings surface (Figma #DA3737). The
// token layer's `colors.danger` is the warmer orange used on scan errors, so
// this is spelled out rather than borrowed.
const destructiveInk = '#DA3737';

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
 *   Style (List / Card)      → `variant` (padding + pressed colour)
 *   Destructive              → `destructive` (title turns red)
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
  const isCard = variant === 'card';
  const pressedColor = isCard ? list.pressedCard : list.pressedList;

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
    pressed && { backgroundColor: pressedColor, borderRadius: list.rowRadius },
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
            style={[styles.title, destructive && styles.titleDestructive]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value != null && value !== '' ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {after ? <View style={styles.after}>{after}</View> : null}

      {divider ? <View style={styles.divider} /> : null}
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
  title: { fontSize: 16, lineHeight: 22, color: list.titleInk },
  // Figma overrides the title's fill rather than using the component's own
  // Destructive variant, so the leading badge and chevron stay untinted.
  titleDestructive: { color: destructiveInk },
  value: { fontSize: 14, lineHeight: 20, color: list.subtitleInk, flexShrink: 0 },
  subtitle: { fontSize: 14, lineHeight: 20, color: list.subtitleInk },
  after: { justifyContent: 'center' },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: dividerToken.hairline,
  },
});
