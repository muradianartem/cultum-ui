import { StyleSheet, Text, View } from 'react-native';
import { navbar } from '../theme/tokens';
import { typography } from '../theme/foundations';
import { useTheme } from '../theme/ThemeProvider';
import ButtonIcon from './ButtonIcon';
import Icon from './Icon';

/**
 * NavigationBar — top-of-screen bar, imported from Figma "Navigation bar – P2".
 *
 * Figma axes → props:
 *   Icon Before (Back / Close / None) → `leading` ('back' | 'close' | node) + `onLeadingPress`
 *   Actions After (None / 1 / 2)      → `actions` (array of { icon, onPress, accessibilityLabel })
 *   Size (Small / Large)              → `size` ('sm' centres the title; 'lg' stacks a big serif title)
 *   Show title / subtitle / Divider   → `title` / `subtitle` / `divider`
 *
 * Leading + actions render as <ButtonIcon>s — ghost by default, or filled grey
 * circles with `buttonVariant="secondary"` (what the add-a-plant flow's bars
 * use in Figma).
 */
function LeadingButton({ leading, onPress, variant }) {
  const t = useTheme();
  if (!leading) return null;
  const name =
    leading === 'back' ? 'chevron-left' : leading === 'close' ? 'close' : null;
  const icon = name ? (
    <Icon name={name} size={20} color={t.text.primary} />
  ) : (
    leading
  );
  return (
    <ButtonIcon
      variant={variant}
      size="md"
      icon={icon}
      onPress={onPress}
      accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
    />
  );
}

function Actions({ actions = [], variant }) {
  return (
    <View style={styles.actions}>
      {actions.slice(0, 2).map((a, i) => (
        <ButtonIcon
          key={i}
          variant={variant}
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
  buttonVariant = 'ghost',
  divider = true,
  style,
  ...rest
}) {
  const t = useTheme();
  const isLarge = size === 'lg';
  // Figma's large bar drops the button row entirely when it has neither a
  // leading icon nor actions (the Rooms header) — rendering it anyway would
  // push the title down by an empty 56pt.
  const hasActions = (actions?.length ?? 0) > 0;
  // With no leading button there is nothing to put on a row of its own, so the
  // actions trail the large title on its line (the Rooms header's +).
  const inlineActions = isLarge && !leading && hasActions;
  const hasButtons = !inlineActions && (Boolean(leading) || hasActions);
  const ink = { color: t.text.primary };

  return (
    <View
      accessibilityRole="header"
      style={[
        styles.bar,
        { backgroundColor: t.background.primary },
        divider && styles.withDivider,
        divider && { borderBottomColor: t.border.primary },
        style,
      ]}
      {...rest}
    >
      {isLarge ? (
        <>
          {hasButtons ? (
            <View style={styles.rowLarge}>
              <LeadingButton leading={leading} onPress={onLeadingPress} variant={buttonVariant} />
              <View style={styles.spacer} />
              <Actions actions={actions} variant={buttonVariant} />
            </View>
          ) : null}
          <View
            style={[
              styles.largeTitleRow,
              !hasButtons && styles.largeTitleRowAlone,
              inlineActions && styles.largeTitleRowInline,
            ]}
          >
            {title ? <Text style={[styles.largeTitle, ink]}>{title}</Text> : null}
            {inlineActions ? <Actions actions={actions} variant={buttonVariant} /> : null}
          </View>
        </>
      ) : (
        <View style={styles.rowSmall}>
          <View style={styles.side}>
            <LeadingButton leading={leading} onPress={onLeadingPress} variant={buttonVariant} />
          </View>
          <View style={styles.center}>
            {title ? (
              <Text style={[styles.title, ink]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.subtitle, { color: t.text.secondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={[styles.side, styles.sideRight]}>
            <Actions actions={actions} variant={buttonVariant} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignSelf: 'stretch' },
  withDivider: { borderBottomWidth: 1 },
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
  // Figma Size=Small: title "Heading/Heading Extra Small", subtitle
  // "Button/Button Small" (both centred).
  title: { ...typography.headingExtraSmall, textAlign: 'center' },
  subtitle: { ...typography.buttonSmall, textAlign: 'center' },
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
  // Without the button row above it the title carries the bar's full inset.
  largeTitleRowAlone: { paddingVertical: 16 },
  largeTitleRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Figma Size=Large: "Heading/Heading Large".
  largeTitle: { ...typography.headingLarge, flexShrink: 1 },
});
