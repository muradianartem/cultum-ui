import { StyleSheet, Text, View } from 'react-native';
import { divider } from '../theme/tokens';

/**
 * Divider — thin separator, imported from Figma "Divider – P1".
 *
 * Figma axes → props:
 *   Size             → `size`:   sm (1px hairline) | lg (8px block)
 *   Margin           → `margin`: boolean — adds a 16px horizontal inset
 *   Split with label → `label`:  string — centred Caption between two hairlines
 *
 * A labelled divider always uses 1px hairlines (Figma only splits at Size=Small).
 */
export default function Divider({ size = 'sm', margin = false, label, style }) {
  const inset = margin ? styles.inset : null;

  if (label != null && label !== '') {
    return (
      <View
        accessibilityRole="none"
        style={[styles.row, inset, style]}
      >
        <View style={styles.hairline} />
        <Text style={styles.label}>{label}</Text>
        <View style={styles.hairline} />
      </View>
    );
  }

  const line =
    size === 'lg'
      ? { height: divider.blockHeight, backgroundColor: divider.block }
      : { height: 1, backgroundColor: divider.hairline };

  return <View accessibilityRole="none" style={[line, inset, style]} />;
}

const styles = StyleSheet.create({
  inset: { marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hairline: { flex: 1, height: 1, backgroundColor: divider.hairline },
  label: {
    fontSize: 12,
    lineHeight: 17,
    color: divider.labelInk,
    textAlign: 'center',
  },
});
