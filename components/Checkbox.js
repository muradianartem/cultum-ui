import { Pressable, StyleSheet, Text, View } from 'react-native';
import { checkbox } from '../theme/tokens';

/**
 * Checkbox — multi-select control, imported from Figma "Checkbox – P1".
 *
 * Figma axes → props:
 *   Checked       → `checked`
 *   Indeterminate → `indeterminate` (parent with partial children; wins visually)
 *   State         → `disabled`, plus the pressed "Active" halo via Pressable
 *
 * The box is grey-outlined when empty and green-filled with a glyph when
 * checked/indeterminate. Figma ships the box as an SVG; with no react-native-svg
 * in the project we render it with Views + a text glyph.
 */
export default function Checkbox({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  style,
  accessibilityLabel,
  ...rest
}) {
  const on = checked || indeterminate;

  return (
    <Pressable
      onPress={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: indeterminate ? 'mixed' : checked,
        disabled,
      }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.hit,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {({ pressed }) => (
        <View style={styles.center}>
          {pressed && !disabled ? <View style={styles.halo} /> : null}
          <View
            style={[
              styles.box,
              on
                ? { backgroundColor: disabled ? checkbox.disabledFill : checkbox.fill }
                : { borderWidth: 2, borderColor: checkbox.border },
            ]}
          >
            {on ? (
              <Text
                style={[
                  styles.glyph,
                  { color: disabled ? checkbox.disabledGlyph : checkbox.glyph },
                ]}
              >
                {indeterminate ? '–' : '✓'}
              </Text>
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
    width: checkbox.haloSize,
    height: checkbox.haloSize,
    borderRadius: 9999,
    backgroundColor: checkbox.halo,
  },
  box: {
    width: checkbox.size,
    height: checkbox.size,
    borderRadius: checkbox.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
  disabled: { opacity: 0.6 },
});
