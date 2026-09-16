import { useEffect, useRef } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sheet, shadow, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import Button from './Button';
import { useKeyboard } from './useKeyboardVisible';

/**
 * BottomSheet — Cultum's slide-up panel, imported from Figma "Bottom Sheet – P2".
 *
 * A focused, confirmation-style sheet: a grabber, an optional close button and
 * status icon, a centred title + description, up to two stacked actions (which
 * reuse <Button>), and an optional caption. Figma's boolean slots map to props
 * — pass a prop and its slot shows; omit it and the slot disappears.
 *
 * Interaction (Modal host, backdrop-to-dismiss, slide-in) is reconstructed for
 * RN — Figma only specifies the resting visual.
 *
 * Keyboard: the panel rides up by the keyboard's own height, so a sheet with a
 * field stays readable while typing — on both platforms, and from the very
 * first (auto)focus. Tapping the panel hides the keyboard, and so does the
 * first backdrop tap while it is up — only the next one closes.
 *
 * `sheetStyle` / `bodyStyle` restyle the surface and its content padding for
 * sheets the design gives a different ground or rhythm (the paywall's
 * "Choose a plan" sheet is background-primary with a 24px top radius).
 *
 * Slots (Figma → prop): Title→title, Description→description, Caption→caption,
 * Status icon→statusIcon, Close→onClose/showClose, Primary/Secondary action→
 * primaryAction/secondaryAction ({ label, onPress, ...buttonProps }).
 * Arbitrary body content goes in `children`, between description and actions.
 */
export default function BottomSheet({
  visible,
  onClose,
  title,
  description,
  caption,
  statusIcon,
  primaryAction,
  secondaryAction,
  showClose = true,
  children,
  sheetStyle,
  bodyStyle,
  testID,
  ...rest
}) {
  const translateY = useRef(new Animated.Value(1)).current; // 0 shown, 1 hidden
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const t = useTheme();

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 1,
      duration: visible ? motion.dur : motion.durFast,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const onBackdrop = () => (keyboardVisible ? Keyboard.dismiss() : onClose?.());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
      {...rest}
    >
      <View style={[styles.root, { paddingBottom: keyboardHeight }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onBackdrop}
          accessibilityLabel="Close"
          accessibilityRole="button"
          testID="bottomsheet-backdrop"
        />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: t.background.secondary },
            shadow.sheet,
            keyboardVisible && styles.sheetOverKeyboard,
            {
              transform: [
                {
                  translateY: translateY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 600],
                  }),
                },
              ],
            },
            sheetStyle,
          ]}
          accessibilityViewIsModal
        >
          <Pressable onPress={Keyboard.dismiss} accessible={false} testID="bottomsheet-panel">
            <View style={styles.top}>
              <View style={[styles.handle, { backgroundColor: t.text.placeholder }]} />
            </View>

            {showClose && onClose ? (
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.close, { backgroundColor: t.brand.secondary }]}
                testID="bottomsheet-close"
              >
                <Text style={[styles.closeGlyph, { color: t.text.primary }]}>✕</Text>
              </Pressable>
            ) : null}

            <View style={[styles.body, bodyStyle]}>
              <View style={styles.textBlock}>
                {statusIcon ? <View style={[styles.statusIcon, { backgroundColor: t.brand.secondary }]}>{statusIcon}</View> : null}
                {title ? <Text style={[styles.title, { color: t.text.primary }]}>{title}</Text> : null}
                {description ? (
                  <Text style={[styles.description, { color: t.text.secondary }]}>{description}</Text>
                ) : null}
              </View>

              {children}

              {primaryAction || secondaryAction || caption ? (
                <View style={styles.actions}>
                  {primaryAction ? (
                    <Button
                      variant="primary"
                      size="lg"
                      label={primaryAction.label}
                      onPress={primaryAction.onPress}
                      {...primaryAction}
                    />
                  ) : null}
                  {secondaryAction ? (
                    <Button
                      variant="secondary"
                      size="lg"
                      label={secondaryAction.label}
                      onPress={secondaryAction.onPress}
                      {...secondaryAction}
                    />
                  ) : null}
                  {caption ? <Text style={[styles.caption, { color: t.text.secondary }]}>{caption}</Text> : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,18,11,0.4)' },
  sheet: {
    borderTopLeftRadius: sheet.radiusTop,
    borderTopRightRadius: sheet.radiusTop,
    paddingBottom: 34, // Figma home-indicator inset
  },
  // The keyboard covers the home indicator, so the inset would only be a gap.
  sheetOverKeyboard: { paddingBottom: 0 },
  top: { paddingVertical: 8, alignItems: 'center' },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 100,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 16, lineHeight: 20 },
  body: {
    paddingTop: 32,
    paddingBottom: 24,
    gap: 24,
  },
  textBlock: { paddingHorizontal: 16, alignItems: 'center', gap: 12 },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    textAlign: 'center',
  },
  actions: { paddingHorizontal: 16, gap: 12 },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
