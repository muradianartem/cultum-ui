import { Pressable, StyleSheet, Text, View } from 'react-native';
import { checkbox } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Checkbox — multi-select control, imported from Figma "Checkbox – P1".
 *
 * Figma axes → props:
 *   Checked       → `checked`
 *   Indeterminate → `indeterminate` (parent with partial children; wins visually)
 *   State         → `disabled`, plus the pressed "Active" halo via Pressable
 *
 * The box is grey-outlined when empty and green-filled with a glyph when
 * checked/indeterminate. Figma ships the box as an SVG; we render it with
 * Views + a text glyph.
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
  const t = useTheme();
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
      style={[styles.hit, disabled && styles.disabled, style]}
      {...rest}
    >
      {({ pressed }) => (
        <View style={styles.center}>
          {pressed && !disabled ? (
            <View style={[styles.halo, { backgroundColor: t.interaction.pressed }]} />
          ) : null}
          <View
            style={[
              styles.box,
              on
                ? { backgroundColor: disabled ? t.disabled.surface : t.brand.primary }
                : { borderWidth: 2, borderColor: t.border.primary },
            ]}
          >
            {on ? (
              <Text
                style={[
                  styles.glyph,
                  { color: disabled ? t.disabled.on : t.brand.onPrimary },
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
