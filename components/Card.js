import { StyleSheet, Text, View } from 'react-native';
import { card } from '../theme/tokens';
import { radius, typography } from '../theme/foundations';
import { useTheme } from '../theme/ThemeProvider';
import Button from './Button';

/**
 * Card — content container, imported from Figma "Card – P2".
 *
 * A grey rounded surface grouping an optional leading icon badge, a title +
 * optional subtitle, optional body copy, and optional actions. Figma axes → props:
 *   Show Icon / Show Subtitle / Show Body → `icon` / `subtitle` / `body`
 *   Type (None / 1 action / 2 Actions)    → `primaryAction` / `secondaryAction`
 *   Orientation (Horizontal / Vertical)   → `actionsOrientation`
 *
 * Actions reuse <Button size="md">. Custom content can go in `children`.
 */
export default function Card({
  icon,
  title,
  subtitle,
  body,
  primaryAction,
  secondaryAction,
  actionsOrientation = 'horizontal',
  children,
  style,
  ...rest
}) {
  const t = useTheme();
  const hasActions = primaryAction || secondaryAction;

  return (
    <View
      accessibilityRole="none"
      style={[styles.card, { backgroundColor: t.surface.primary }, style]}
      {...rest}
    >
      {(icon || title || subtitle) && (
        <View style={styles.header}>
          {icon ? (
            <View style={[styles.iconBadge, { backgroundColor: t.brand.secondary }]}>
              {icon}
            </View>
          ) : null}
          {(title || subtitle) && (
            <View style={styles.headerText}>
              {title ? (
                <Text style={[styles.title, { color: t.text.primary }]}>{title}</Text>
              ) : null}
              {subtitle ? (
                <Text style={[styles.subtitle, { color: t.text.secondary }]}>{subtitle}</Text>
              ) : null}
            </View>
          )}
        </View>
      )}

      {body ? <Text style={[styles.body, { color: t.text.secondary }]}>{body}</Text> : null}
      {children}

      {hasActions ? (
        <View
          style={[
            styles.actions,
            actionsOrientation === 'vertical' ? styles.actionsCol : styles.actionsRow,
          ]}
        >
          {primaryAction ? (
            <Button
              variant="primary"
              size="md"
              fullWidth={actionsOrientation === 'vertical'}
              label={primaryAction.label}
              onPress={primaryAction.onPress}
              {...primaryAction}
            />
          ) : null}
          {secondaryAction ? (
            <Button
              variant="secondary"
              size="md"
              fullWidth={actionsOrientation === 'vertical'}
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
  card: {
    width: 375,
    maxWidth: '100%',
    borderRadius: card.radius,
    padding: card.padding,
    gap: card.gap,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: {
    width: card.iconBadgeSize,
    height: card.iconBadgeSize,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 4 },
  // Figma "Card – P2": title Heading Extra Small Emphasized; subtitle and
  // body Body Medium.
  title: { ...typography.headingExtraSmallEmphasized },
  subtitle: { ...typography.bodyMedium },
  body: { ...typography.bodyMedium },
  actions: { gap: 12 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  actionsCol: { flexDirection: 'column', alignItems: 'stretch' },
});
