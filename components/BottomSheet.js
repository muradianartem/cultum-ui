import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sheet, shadow, motion } from '../theme/tokens';
import Button from './Button';

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
  testID,
  ...rest
}) {
  const translateY = useRef(new Animated.Value(1)).current; // 0 shown, 1 hidden

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 1,
      duration: visible ? motion.dur : motion.durFast,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

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
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
          testID="bottomsheet-backdrop"
        />
        <Animated.View
          style={[
            styles.sheet,
            shadow.sheet,
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
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.top}>
            <View style={styles.handle} />
          </View>

          {showClose && onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}
              testID="bottomsheet-close"
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          ) : null}

          <View style={styles.body}>
            <View style={styles.textBlock}>
              {statusIcon ? <View style={styles.statusIcon}>{statusIcon}</View> : null}
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {description ? (
                <Text style={styles.description}>{description}</Text>
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
                {caption ? <Text style={styles.caption}>{caption}</Text> : null}
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,18,11,0.4)' },
  sheet: {
    backgroundColor: sheet.bg,
    borderTopLeftRadius: sheet.radiusTop,
    borderTopRightRadius: sheet.radiusTop,
    paddingBottom: 34, // Figma home-indicator inset
  },
  top: { paddingVertical: 8, alignItems: 'center' },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 100,
    backgroundColor: sheet.handle,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: sheet.closeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 16, color: sheet.titleInk, lineHeight: 20 },
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
    backgroundColor: sheet.statusIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: sheet.titleInk,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: sheet.bodyInk,
    textAlign: 'center',
  },
  actions: { paddingHorizontal: 16, gap: 12 },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: sheet.bodyInk,
    textAlign: 'center',
  },
});
