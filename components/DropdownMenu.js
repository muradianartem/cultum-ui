import { Pressable, StyleSheet, Text, View } from 'react-native';
import { menu, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * MenuItem — one row of a DropdownMenu (Figma "_Dropdown Menu Item").
 * Optional `leading` slot (e.g. a selected check), title + optional subtitle,
 * optional trailing `icon`; darkens while pressed. Pass `selected` for the
 * single-select a11y state. Passing `leading` (even `null`) reserves the leading
 * gutter so titles stay aligned across selected/unselected rows.
 */
export function MenuItem({
  title,
  subtitle,
  icon,
  leading,
  selected,
  onPress,
  disabled = false,
  style,
  ...rest
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onPress?.()}
      disabled={disabled}
      accessibilityRole="menuitem"
      accessibilityState={{ disabled, selected }}
      accessibilityLabel={typeof title === 'string' ? title : undefined}
      style={({ pressed }) => [
        styles.item,
        pressed && !disabled && { backgroundColor: t.interaction.pressed },
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        {typeof title === 'string' ? (
          <Text style={[styles.title, { color: t.text.primary }]}>{title}</Text>
        ) : (
          title
        )}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.text.secondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
    </Pressable>
  );
}

/**
 * DropdownMenu — floating action/option menu, imported from Figma
 * "Dropdown Menu – P2".
 *
 * Renders the menu *surface* (positioning/visibility is the caller's job — pair
 * it with an anchored overlay or a Modal). Pass `items` (an array of
 * `{ title, subtitle, icon, onPress }`) or compose <MenuItem> children.
 */
export default function DropdownMenu({ items, children, style, ...rest }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="menu"
      style={[
        styles.surface,
        { backgroundColor: t.background.primary, borderColor: t.border.secondary },
        shadow.low,
        style,
      ]}
      {...rest}
    >
      {items
        ? // `key` is pulled out rather than spread: React 19 warns when a props
          // object carries one, and MenuItem has no use for it anyway.
          items.map(({ key, ...item }, i) => <MenuItem key={key ?? i} {...item} />)
        : children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: menu.width,
    maxWidth: '100%',
    borderRadius: menu.radius,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 47,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: menu.itemRadius,
  },
  leading: { width: 24, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  // Figma "_Dropdown Menu Item": title Body Large 16, subtitle Body Medium 14.
  title: { fontSize: 16, lineHeight: 22 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
