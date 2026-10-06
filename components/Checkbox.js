import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { checkbox } from '../theme/tokens';
import { opacity } from '../theme/foundations';
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
 * checked/indeterminate. The box is a View (it needs the radius and border);
 * the tick and the dash are Figma's own vectors, exported from the Enabled
 * variants (checked 11931:39718, indeterminate 11931:39722) on the box's 22pt
 * grid, so they don't depend on how a font draws "✓".
 *
 * Disabled follows Figma: an empty box is outlined in on-disabled at 50%; a
 * filled one swaps to the disabled surface with an on-disabled glyph, unfaded.
 */
const TICK =
  'M17.1508 6.60916C17.0656 6.52324 16.9642 6.45505 16.8525 6.40851C16.7408 6.36197 16.621 6.33801 16.5 6.33801C16.379 6.33801 16.2592 6.36197 16.1475 6.40851C16.0358 6.45505 15.9344 6.52324 15.8492 6.60916L9.02 13.4475L6.15084 10.5692C6.06236 10.4837 5.95791 10.4165 5.84346 10.3714C5.72901 10.3263 5.6068 10.3042 5.4838 10.3063C5.3608 10.3084 5.23942 10.3348 5.1266 10.3838C5.01378 10.4328 4.91172 10.5036 4.82625 10.5921C4.74078 10.6806 4.67358 10.785 4.62848 10.8995C4.58337 11.0139 4.56125 11.1361 4.56338 11.2591C4.56551 11.3821 4.59184 11.5035 4.64088 11.6163C4.68991 11.7291 4.76069 11.8312 4.84917 11.9167L8.36917 15.4367C8.45439 15.5226 8.55577 15.5908 8.66747 15.6373C8.77918 15.6838 8.89899 15.7078 9.02 15.7078C9.14101 15.7078 9.26083 15.6838 9.37253 15.6373C9.48424 15.5908 9.58562 15.5226 9.67084 15.4367L17.1508 7.95666C17.2439 7.87082 17.3181 7.76664 17.3689 7.65068C17.4197 7.53473 17.4459 7.4095 17.4459 7.28291C17.4459 7.15632 17.4197 7.0311 17.3689 6.91514C17.3181 6.79918 17.2439 6.695 17.1508 6.60916Z';
const DASH =
  'M17.4167 10.0833H4.58333C4.34022 10.0833 4.10706 10.1799 3.93515 10.3518C3.76324 10.5237 3.66666 10.7569 3.66666 11C3.66666 11.2431 3.76324 11.4763 3.93515 11.6482C4.10706 11.8201 4.34022 11.9167 4.58333 11.9167H17.4167C17.6598 11.9167 17.8929 11.8201 18.0648 11.6482C18.2368 11.4763 18.3333 11.2431 18.3333 11C18.3333 10.7569 18.2368 10.5237 18.0648 10.3518C17.8929 10.1799 17.6598 10.0833 17.4167 10.0833Z';

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
      style={[styles.hit, style]}
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
                : {
                    borderWidth: 2,
                    borderColor: disabled ? t.disabled.on : t.border.primary,
                    opacity: disabled ? opacity[50] : 1,
                  },
            ]}
          >
            {on ? (
              <Svg
                width={checkbox.size}
                height={checkbox.size}
                viewBox="0 0 22 22"
                testID={indeterminate ? 'checkbox-dash' : 'checkbox-tick'}
              >
                <Path
                  d={indeterminate ? DASH : TICK}
                  fill={disabled ? t.disabled.on : t.brand.onPrimary}
                />
              </Svg>
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
});
