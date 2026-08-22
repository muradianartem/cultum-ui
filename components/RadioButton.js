import { Pressable, StyleSheet, View } from 'react-native';
import { radio } from '../theme/tokens';

/**
 * RadioButton — single-choice control, imported from Figma "Radio Button – P1".
 *
 * Figma axes → props: Selected → `selected`; State → `disabled` + the pressed
 * "Active" halo via Pressable. A grey ring when unselected; a green ring with a
 * centre dot when selected. Meant to live in a group where one is selected at a
 * time — pass `selected` + `onSelect`.
 */
export default function RadioButton({
  selected = false,
  onSelect,
  disabled = false,
  value,
  style,
  accessibilityLabel,
  ...rest
}) {
  const ringColor = disabled
    ? radio.ringDisabled
    : selected
    ? radio.ringSelected
    : radio.ring;

  return (
    <Pressable
      onPress={() => !disabled && onSelect?.(value ?? true)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.hit, disabled && styles.disabled, style]}
      {...rest}
    >
      {({ pressed }) => (
        <View style={styles.center}>
          {pressed && !disabled ? <View style={styles.halo} /> : null}
          <View style={[styles.ring, { borderColor: ringColor }]}>
            {selected ? (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: disabled ? radio.dotDisabled : radio.dot },
                ]}
              />
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { padding: 8 },
  center: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: radio.haloSize,
    height: radio.haloSize,
    borderRadius: 9999,
    backgroundColor: radio.halo,
  },
  ring: {
    width: radio.size,
    height: radio.size,
    borderRadius: 9999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 9999 },
  disabled: { opacity: 0.6 },
});
