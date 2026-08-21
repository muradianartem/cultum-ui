import { StyleSheet, Text, View } from 'react-native';
import { emptyState, button, radius } from '../theme/tokens';
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
function iconPalette(variant) {
  const p = button[variant] || button.primary;
  return { bg: p.bg, border: p.border };
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
  const dim = emptyState.iconSizes[iconSize] || emptyState.iconSizes.lg;
  const ip = iconPalette(iconVariant);

  return (
    <View
      accessibilityRole="summary"
      style={[styles.base, variant === 'card' && styles.card, style]}
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
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {primaryAction ? (
            <Button
              variant="primary"
              size="sm"
              fullWidth={false}
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
    backgroundColor: emptyState.cardBg,
    borderRadius: emptyState.cardRadius,
    paddingHorizontal: 16,
  },
  badge: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { alignSelf: 'stretch', gap: 4 },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: emptyState.titleInk,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: emptyState.subtitleInk,
    textAlign: 'center',
  },
  actions: { alignSelf: 'stretch', alignItems: 'center', gap: 4 },
});
