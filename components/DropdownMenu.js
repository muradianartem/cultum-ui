import { Pressable, StyleSheet, Text, View } from 'react-native';
import { menu, shadow } from '../theme/tokens';

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
  return (
    <Pressable
      onPress={() => !disabled && onPress?.()}
      disabled={disabled}
      accessibilityRole="menuitem"
      accessibilityState={{ disabled, selected }}
      accessibilityLabel={typeof title === 'string' ? title : undefined}
      style={({ pressed }) => [
        styles.item,
        pressed && !disabled && styles.itemPressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
  return (
    <View accessibilityRole="menu" style={[styles.surface, shadow.low, style]} {...rest}>
      {items
        ? items.map((it, i) => <MenuItem key={it.key ?? i} {...it} />)
        : children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: menu.width,
    maxWidth: '100%',
    backgroundColor: menu.bg,
    borderRadius: menu.radius,
    borderWidth: 1,
    borderColor: menu.border,
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
  itemPressed: { backgroundColor: menu.pressed },
  leading: { width: 24, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  // Figma "_Dropdown Menu Item": title Body Large 16, subtitle Body Medium 14.
  title: { fontSize: 16, lineHeight: 22, color: menu.titleInk },
  subtitle: { fontSize: 14, lineHeight: 20, color: menu.subtitleInk },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
