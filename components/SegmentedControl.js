import { Pressable, StyleSheet, Text, View } from 'react-native';
import { segmented, radius } from '../theme/tokens';

/**
 * SegmentedControl — horizontal single-select switch, imported from Figma
 * "Segmented Control – P2".
 *
 * A pill track of equal-width segments; the selected one becomes a white pill.
 * Figma axes → props: Has Icon → per-segment `icon`; State (Active/Pressed) →
 * pressed feedback + the selected fill; disabled → `disabled`.
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
  const items = normalize(segments);

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, disabled && styles.disabled, style]}
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
            accessibilityLabel={item.label}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.segmentSelected,
              !isSelected && pressed && !disabled && styles.segmentPressed,
            ]}
          >
            {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
            <Text
              numberOfLines={1}
              style={[styles.label, disabled && { color: segmented.inkDisabled }]}
            >
              {item.label}
            </Text>
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
    backgroundColor: segmented.trackBg,
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
  segmentSelected: { backgroundColor: segmented.thumbBg },
  segmentPressed: { backgroundColor: segmented.pressedBg },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: segmented.ink },
  disabled: { opacity: 0.6 },
});
