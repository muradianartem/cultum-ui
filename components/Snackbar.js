import { Pressable, StyleSheet, Text, View } from 'react-native';
import { snackbar, radius, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

// Figma draws the action pill the same dark grey in both modes (light "Snackbar
// – P2" and the dark Today section, node 567:8343) — it is not a semantic role
// that flips, so it is pinned here rather than read from the theme.
const ACTION_BG = '#383937';
const ACTION_INK = '#FCFCFC';

/**
 * Snackbar — transient bottom-of-screen message, imported from Figma "Snackbar – P2".
 *
 * An inverted pill (dark on the light theme, light on the dark one) with 14px
 * copy, an optional leading icon, an optional inline action pill, and
 * (Dismissable=True) a close button. Figma axes → props:
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
  const t = useTheme();
  const content = children ?? label;
  const ink = { color: t.text.primaryInverse };

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={
        accessibilityLabel ?? (typeof content === 'string' ? content : undefined)
      }
      style={[
        styles.bar,
        { backgroundColor: t.background.primaryInverse, borderColor: t.border.primary },
        shadow.float,
        style,
      ]}
      {...rest}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}

      {typeof content === 'string' ? (
        <Text style={[styles.label, ink]} numberOfLines={2}>
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
          <Text style={[styles.closeGlyph, ink]}>✕</Text>
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
    borderRadius: snackbar.radius,
    borderWidth: 1,
  },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  labelSlot: { flex: 1 },
  label: { flex: 1, fontSize: 14, lineHeight: 20 },
  action: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: ACTION_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '500', color: ACTION_INK },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 16 },
});
