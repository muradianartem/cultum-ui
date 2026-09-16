import { StyleSheet, Text, View } from 'react-native';
import { divider } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Divider — thin separator, imported from Figma "Divider – P1".
 *
 * Figma axes → props:
 *   Size             → `size`:   sm (1px hairline) | lg (8px block)
 *   Margin           → `margin`: boolean — adds a 16px horizontal inset
 *   Split with label → `label`:  string — centred Caption between two hairlines
 *
 * A labelled divider always uses 1px hairlines (Figma only splits at Size=Small).
 * Hairlines are border-primary; the block separator is surface-primary.
 */
export default function Divider({ size = 'sm', margin = false, label, style }) {
  const t = useTheme();
  const inset = margin ? styles.inset : null;
  const hairline = [styles.hairline, { backgroundColor: t.border.primary }];

  if (label != null && label !== '') {
    return (
      <View
        accessibilityRole="none"
        style={[styles.row, inset, style]}
      >
        <View style={hairline} />
        <Text style={[styles.label, { color: t.text.secondary }]}>{label}</Text>
        <View style={hairline} />
      </View>
    );
  }

  const line =
    size === 'lg'
      ? { height: divider.blockHeight, backgroundColor: t.surface.primary }
      : { height: 1, backgroundColor: t.border.primary };

  return <View accessibilityRole="none" style={[line, inset, style]} />;
}

const styles = StyleSheet.create({
  inset: { marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hairline: { flex: 1, height: 1 },
  label: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
