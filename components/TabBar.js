import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tabBar } from '../theme/tokens';

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
  return (
    <View accessibilityRole="tablist" style={[styles.bar, style]} {...rest}>
      {tabs.map((tab, i) => {
        const active = value != null ? value === tab.value : i === 0;
        const pill = tab.emphasized
          ? tabBar.emphasizedPill
          : active
          ? tabBar.activePill
          : 'transparent';

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
              tab.disabled && styles.disabled,
            ]}
          >
            {({ pressed }) => (
              <>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor:
                        pressed && !tab.disabled && !tab.emphasized
                          ? tabBar.pressedPill
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
                      { color: active ? tabBar.labelActive : tabBar.labelInactive },
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
    backgroundColor: tabBar.bg,
    borderTopWidth: 1,
    borderTopColor: tabBar.borderTop,
  },
  tab: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 8 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  disabled: { opacity: 0.5 },
});
