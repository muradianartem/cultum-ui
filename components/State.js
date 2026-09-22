import { StyleSheet, Text, View } from 'react-native';
import { emptyState } from '../theme/tokens';
import { radius, space, typography } from '../theme/foundations';
import { useTheme } from '../theme/ThemeProvider';
import Button from './Button';

/**
 * State — full-width empty/placeholder block, imported from Figma "State – P2".
 *
 * Centred icon badge + title + optional subtitle + optional actions, used when a
 * view has no data, is loading, or failed. Figma axes → props:
 *   Style          → `variant`: text | card (card = grey rounded panel)
 *   Show subtitle  → `subtitle`
 *   Primary/Secondary action → `primaryAction` / `secondaryAction`
 *                              ({ label, onPress }); actions reuse <Button size="sm">
 *   Show icon      → `icon` inside a badge; `iconVariant` (badge colour) + `iconSize`
 */
// The badge borrows Button's fills for the same variant names.
function iconPalette(t, variant) {
  return (
    {
      primary: { bg: t.brand.primary },
      secondary: { bg: t.brand.secondary },
      outline: { bg: t.background.primary, border: t.border.primary },
      ghost: { bg: 'transparent' },
    }[variant] || { bg: t.brand.primary }
  );
}

export default function State({
  variant = 'text',
  icon,
  iconVariant = 'primary',
  iconSize = 'lg',
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  style,
  ...rest
}) {
  const t = useTheme();
  const dim = emptyState.iconSizes[iconSize] || emptyState.iconSizes.lg;
  const ip = iconPalette(t, iconVariant);

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.base,
        variant === 'card' && styles.card,
        variant === 'card' && { backgroundColor: t.surface.primary },
        style,
      ]}
      {...rest}
    >
      {icon ? (
        <View
          style={[
            styles.badge,
            { width: dim, height: dim, backgroundColor: ip.bg },
            ip.border && { borderWidth: 1, borderColor: ip.border },
          ]}
        >
          {icon}
        </View>
      ) : null}

      <View style={styles.text}>
        {title ? <Text style={[styles.title, { color: t.text.primary }]}>{title}</Text> : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.text.secondary }]}>{subtitle}</Text>
        ) : null}
      </View>

      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {primaryAction ? (
            <Button
              variant="primary"
              size="sm"
              fullWidth={false}
              style={styles.action}
              label={primaryAction.label}
              onPress={primaryAction.onPress}
              {...primaryAction}
            />
          ) : null}
          {secondaryAction ? (
            <Button
              variant="ghost"
              size="sm"
              fullWidth={false}
              style={styles.action}
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              {...secondaryAction}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: emptyState.width,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  card: {
    borderRadius: emptyState.cardRadius,
    paddingHorizontal: 16,
  },
  badge: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Figma "State – P2" (27517:2352): an 8px gap between a Heading Extra Small
  // Emphasized title and a Body Medium subtitle.
  text: { alignSelf: 'stretch', gap: space[8] },
  title: { ...typography.headingExtraSmallEmphasized, textAlign: 'center' },
  subtitle: { ...typography.bodyMedium, textAlign: 'center' },
  actions: { alignSelf: 'stretch', alignItems: 'center', gap: 4 },
  // Inline Buttons pin themselves with alignSelf: 'flex-start', which beats the
  // column's alignItems — re-centre each one or the actions hug the left edge.
  action: { alignSelf: 'center' },
});
