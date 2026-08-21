import { Pressable, StyleSheet, Text, View } from 'react-native';
import { snackbar, radius, shadow } from '../theme/tokens';

/**
 * Snackbar — transient bottom-of-screen message, imported from Figma "Snackbar – P2".
 *
 * A dark pill with 12px copy, an optional leading icon, an optional inline action
 * pill, and (Dismissable=True) a close button. Figma axes → props:
 *   Show icon    → `icon`
 *   Action       → `action` ({ label, onPress })
 *   Dismissable  → `onDismiss` (renders the close control)
 *
 * This renders the bar itself; positioning/auto-timeout is the caller's job.
 */
export default function Snackbar({
  label,
  children,
  icon,
  action,
  onDismiss,
  style,
  accessibilityLabel,
  ...rest
}) {
  const content = children ?? label;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={
        accessibilityLabel ?? (typeof content === 'string' ? content : undefined)
      }
      style={[styles.bar, shadow.float, style]}
      {...rest}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}

      {typeof content === 'string' ? (
        <Text style={styles.label} numberOfLines={2}>
          {content}
        </Text>
      ) : (
        <View style={styles.labelSlot}>{content}</View>
      )}

      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={styles.action}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.close}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: snackbar.width,
    maxWidth: '100%',
    minHeight: snackbar.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: snackbar.bg,
    borderRadius: snackbar.radius,
    borderWidth: 1,
    borderColor: snackbar.border,
  },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  labelSlot: { flex: 1 },
  label: { flex: 1, fontSize: 12, lineHeight: 16, color: snackbar.ink },
  action: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: snackbar.actionBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '500', color: snackbar.actionInk },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 16, color: snackbar.ink },
});
