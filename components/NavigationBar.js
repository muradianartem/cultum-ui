import { StyleSheet, Text, View } from 'react-native';
import { navbar, fonts, divider as dividerToken } from '../theme/tokens';
import ButtonIcon from './ButtonIcon';

/**
 * NavigationBar — top-of-screen bar, imported from Figma "Navigation bar – P2".
 *
 * Figma axes → props:
 *   Icon Before (Back / Close / None) → `leading` ('back' | 'close' | node) + `onLeadingPress`
 *   Actions After (None / 1 / 2)      → `actions` (array of { icon, onPress, accessibilityLabel })
 *   Size (Small / Large)              → `size` ('sm' centres the title; 'lg' stacks a big serif title)
 *   Show title / subtitle / Divider   → `title` / `subtitle` / `divider`
 *
 * Leading + actions render as ghost <ButtonIcon>s.
 */
function LeadingButton({ leading, onPress }) {
  if (!leading) return null;
  const glyph =
    leading === 'back' ? '‹' : leading === 'close' ? '✕' : null;
  const icon = glyph ? <Text style={styles.navGlyph}>{glyph}</Text> : leading;
  return (
    <ButtonIcon
      variant="ghost"
      size="md"
      icon={icon}
      onPress={onPress}
      accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
    />
  );
}

function Actions({ actions = [] }) {
  return (
    <View style={styles.actions}>
      {actions.slice(0, 2).map((a, i) => (
        <ButtonIcon
          key={i}
          variant="ghost"
          size="md"
          icon={a.icon}
          onPress={a.onPress}
          accessibilityLabel={a.accessibilityLabel ?? `Action ${i + 1}`}
        />
      ))}
    </View>
  );
}

export default function NavigationBar({
  title,
  subtitle,
  leading,
  onLeadingPress,
  actions,
  size = 'sm',
  divider = true,
  style,
  ...rest
}) {
  const isLarge = size === 'lg';

  return (
    <View
      accessibilityRole="header"
      style={[styles.bar, divider && styles.withDivider, style]}
      {...rest}
    >
      {isLarge ? (
        <>
          <View style={styles.rowLarge}>
            <LeadingButton leading={leading} onPress={onLeadingPress} />
            <View style={styles.spacer} />
            <Actions actions={actions} />
          </View>
          <View style={styles.largeTitleRow}>
            {title ? <Text style={styles.largeTitle}>{title}</Text> : null}
          </View>
        </>
      ) : (
        <View style={styles.rowSmall}>
          <View style={styles.side}>
            <LeadingButton leading={leading} onPress={onLeadingPress} />
          </View>
          <View style={styles.center}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={[styles.side, styles.sideRight]}>
            <Actions actions={actions} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignSelf: 'stretch', backgroundColor: navbar.bg },
  withDivider: { borderBottomWidth: 1, borderBottomColor: dividerToken.hairline },
  rowSmall: {
    minHeight: navbar.height,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  side: { minWidth: 40, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: navbar.titleInk,
    textAlign: 'center',
  },
  subtitle: { fontSize: 14, fontWeight: '500', color: navbar.subtitleInk, textAlign: 'center' },
  rowLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: navbar.height,
  },
  spacer: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  largeTitleRow: { paddingHorizontal: 16, paddingVertical: 8 },
  largeTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    color: navbar.titleInk,
  },
  navGlyph: { fontSize: 22, color: navbar.titleInk, lineHeight: 24 },
});
