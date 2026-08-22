import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { tabs as tk } from '../theme/tokens';

/**
 * Tabs — in-screen underline tabs, imported from Figma "Tabs - P3".
 *
 * A horizontal strip that switches between sibling views. Figma axes → props:
 *   State (Active)  → the tab whose value === `value` (green underline)
 *   Has Icon / Show icon → per-tab `icon`
 *   State (Disabled) → per-tab `disabled`
 *
 * `items` is an array of `{ value, label, icon, disabled }`. Controlled via
 * `value` + `onChange(value)`. Scrolls horizontally when the tabs overflow.
 */
export default function Tabs({ items = [], value, onChange, scrollable = true, style, ...rest }) {
  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.row }
    : { style: styles.row };

  const inner = items.map((tab, i) => {
    const active = value != null ? value === tab.value : i === 0;
    return (
      <Pressable
        key={String(tab.value ?? i)}
        onPress={() => !tab.disabled && onChange?.(tab.value)}
        disabled={tab.disabled}
        accessibilityRole="tab"
        accessibilityState={{ selected: active, disabled: !!tab.disabled }}
        accessibilityLabel={tab.label}
        style={({ pressed }) => [
          styles.tab,
          { borderBottomColor: active ? tk.underline : 'transparent' },
          pressed && !tab.disabled && styles.pressed,
        ]}
      >
        {tab.icon ? <View style={styles.icon}>{tab.icon}</View> : null}
        {tab.label ? (
          <Text
            numberOfLines={1}
            style={[styles.label, tab.disabled && { color: tk.inkDisabled }]}
          >
            {tab.label}
          </Text>
        ) : null}
      </Pressable>
    );
  });

  return (
    <View accessibilityRole="tablist" style={[styles.bar, style]} {...rest}>
      <Container {...containerProps}>{inner}</Container>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: tk.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  pressed: { backgroundColor: tk.pressed, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: tk.ink },
});
