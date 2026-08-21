import { StyleSheet, Text, View } from 'react-native';
import { card, radius } from '../theme/tokens';
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
  const hasActions = primaryAction || secondaryAction;

  return (
    <View accessibilityRole="none" style={[styles.card, style]} {...rest}>
      {(icon || title || subtitle) && (
        <View style={styles.header}>
          {icon ? <View style={styles.iconBadge}>{icon}</View> : null}
          {(title || subtitle) && (
            <View style={styles.headerText}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          )}
        </View>
      )}

      {body ? <Text style={styles.body}>{body}</Text> : null}
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
    backgroundColor: card.bg,
    borderRadius: card.radius,
    padding: card.padding,
    gap: card.gap,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: {
    width: card.iconBadgeSize,
    height: card.iconBadgeSize,
    borderRadius: radius.pill,
    backgroundColor: card.iconBadgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 4 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: card.titleInk },
  subtitle: { fontSize: 14, lineHeight: 20, color: card.subtitleInk },
  body: { fontSize: 14, lineHeight: 20, color: card.bodyInk },
  actions: { gap: 12 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  actionsCol: { flexDirection: 'column', alignItems: 'stretch' },
});
