import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/foundations';

/**
 * TabBar — bottom navigation, imported from Figma "Tab Bar – P2".
 *
 * A row of equal-width icon + caption tabs with a top hairline. Figma axes → props:
 *   State (Active)   → the tab whose value === `value` (darker label + icon pill)
 *   Emphasized       → per-tab `emphasized` (green pill behind the icon)
 *   Disabled         → per-tab `disabled`
 *
 * `tabs` is an array of `{ value, label, icon, emphasized, disabled }`.
 * Controlled via `value` + `onChange(value)`. Icons are nodes (icon-agnostic).
 */
export default function TabBar({ tabs = [], value, onChange, style, ...rest }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { backgroundColor: t.background.primary, borderTopColor: t.border.primary },
        style,
      ]}
      {...rest}
    >
      {tabs.map((tab, i) => {
        const active = value != null ? value === tab.value : i === 0;
        const pill = tab.emphasized
          ? t.brand.primary
          : active
          ? t.surface.primary
          : 'transparent';

        return (
          <Pressable
            key={String(tab.value ?? i)}
            onPress={() => !tab.disabled && onChange?.(tab.value)}
            disabled={tab.disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!tab.disabled }}
            accessibilityLabel={tab.label}
            style={[styles.tab, tab.disabled && styles.disabled]}
          >
            {({ pressed }) => (
              <>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor:
                        pressed && !tab.disabled && !tab.emphasized
                          ? t.interaction.pressed
                          : pill,
                    },
                  ]}
                >
                  {tab.icon}
                </View>
                {tab.label ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      { color: active ? t.text.primary : t.text.secondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                ) : null}
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    borderTopWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 8 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Figma "Tab Bar – P2": Caption Emphasized.
  label: { ...typography.captionEmphasized },
  disabled: { opacity: 0.5 },
});
