import { Pressable, StyleSheet, Text, View } from 'react-native';
import { segmented, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * SegmentedControl — horizontal single-select switch, imported from Figma
 * "Segmented Control – P2".
 *
 * A surface-primary pill track of equal-width segments; the selected one becomes
 * a background-primary pill. Figma axes → props: Has Icon → per-segment `icon`;
 * State (Active/Pressed) → pressed feedback + the selected fill; disabled →
 * `disabled`.
 *
 * `segments` is an array of strings or `{ label, value, icon }`. Controlled via
 * `value` + `onChange(value, index)`.
 */
function normalize(segments) {
  return segments.map((s, i) =>
    typeof s === 'string' ? { label: s, value: s } : { value: s.value ?? s.label ?? i, ...s }
  );
}

export default function SegmentedControl({
  segments = [],
  value,
  onChange,
  disabled = false,
  style,
  ...rest
}) {
  const t = useTheme();
  const items = normalize(segments);

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        { backgroundColor: t.surface.primary },
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {items.map((item, i) => {
        const isSelected = value != null ? value === item.value : i === 0;
        return (
          <Pressable
            key={String(item.value)}
            onPress={() => !disabled && onChange?.(item.value, i)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={typeof item.label === 'string' ? item.label : String(item.value)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && { backgroundColor: t.background.primary },
              !isSelected && pressed && !disabled && { backgroundColor: t.interaction.pressed },
            ]}
          >
            {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
            {typeof item.label === 'string' ? (
              <Text
                numberOfLines={1}
                style={[styles.label, { color: disabled ? t.disabled.on : t.text.primary }]}
              >
                {item.label}
              </Text>
            ) : (
              // A non-string label (e.g. a text + count-badge row) renders as-is,
              // NOT wrapped in <Text> — a Text wrapper would trap a View badge as
              // an inline attachment on iOS instead of laying it out as a row.
              item.label
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: segmented.pad,
    borderRadius: radius.pill,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '500' },
  disabled: { opacity: 0.6 },
});
