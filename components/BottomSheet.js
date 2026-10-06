import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sheet, shadow, motion } from '../theme/tokens';
import { typography } from '../theme/foundations';
import Icon from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import Button from './Button';
import ButtonIcon from './ButtonIcon';
import Overlay from './Overlay';
import { useKeyboard } from './useKeyboardVisible';

// Drag-to-dismiss: a pull past this distance, or a downward fling faster than
// this velocity, closes the sheet; anything less springs back.
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.8;

// A clearly vertical, downward move — a sideways or upward one is left alone.
// The drag zone is at least the grabber strip and the corner-button row.
const HEADER_MIN = 64;

export const claimsDrag = (g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx);
export const shouldDismiss = (g) => g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY;

/**
 * BottomSheet — Cultum's slide-up panel, imported from Figma "Bottom Sheet – P2".
 *
 * A focused, confirmation-style sheet: a grabber, an optional close button and
 * status icon, a centred title + description, up to two stacked actions (which
 * reuse <Button>), and an optional caption. Figma's boolean slots map to props
 * — pass a prop and its slot shows; omit it and the slot disappears.
 *
 * Interaction (Modal host, backdrop-to-dismiss, slide-in) is reconstructed for
 * RN — Figma only specifies the resting visual. The page behind is washed out
 * by <Overlay> (background-primary at 0.85, App Design node 335:9787).
 *
 * Dragging the sheet down by its header (grabber, corner buttons, title) closes
 * it; `dismissible={false}` turns that off. The body is left alone so wheel
 * pickers and scroll views keep their own drags.
 *
 * Multi-step sheets: `onBack` shows a back button in the top-left corner, and
 * `onRequestClose` replaces `onClose` for the backdrop and hardware back — so
 * those can step back through the flow while the close button and a swipe
 * still dismiss the whole sheet.
 *
 * `leading` / `trailing` replace the corner buttons outright (top-left: back,
 * top-right: close) for sheets whose design puts something else there — the
 * task sheet has close on the left and settings on the right.
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
 * Status icon→statusIcon, Close→onClose/showClose, Back→onBack, Primary/Secondary action→
 * primaryAction/secondaryAction ({ label, onPress, ...buttonProps }).
 * Arbitrary body content goes in `children`, between description and actions.
 */
export default function BottomSheet({
  visible,
  onClose,
  onRequestClose,
  onBack,
  leading,
  trailing,
  dismissible = true,
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
  const dragY = useRef(new Animated.Value(0)).current; // the finger's pull, px
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const t = useTheme();

  // Where the sheet sits on screen and where its header ends, for the drag
  // zone. Layout ignores the slide transform, so these are resting positions.
  const geometry = useRef({ sheetY: 0, bodyY: 0, textBottom: 0 });
  const inHeader = (y) => {
    const { bodyY, textBottom } = geometry.current;
    return y >= 0 && y <= Math.max(HEADER_MIN, textBottom ? bodyY + textBottom : 0);
  };

  // The pan responder is built once, so it reads the latest props via a ref.
  const latest = useRef({});
  latest.current = { onClose, dismissible };

  const pan = useMemo(
    () =>
      PanResponder.create({
        // RN's <Modal> host claims every touch start its content leaves alone,
        // and a responder that high up is never asked about moves below it —
        // so the sheet claims the start itself, but only in its header (the
        // grabber, corner buttons and title). A claim over a wheel picker or
        // scroll view would stop it scrolling natively. The buttons in the
        // header are deeper and still get first pick.
        onStartShouldSetPanResponder: (e) =>
          latest.current.dismissible && inHeader(e.nativeEvent.pageY - geometry.current.sheetY),
        onMoveShouldSetPanResponder: (_e, g) => latest.current.dismissible && claimsDrag(g),
        onPanResponderMove: (_e, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (claimsDrag(g) && shouldDismiss(g)) {
            latest.current.onClose?.();
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
              speed: 20,
            }).start();
          }
        },
        onPanResponderTerminate: () =>
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
      }),
    [dragY]
  );

  useEffect(() => {
    // A sheet swiped closed keeps its pull until it is next opened.
    if (visible) dragY.setValue(0);
    Animated.timing(translateY, {
      toValue: visible ? 0 : 1,
      duration: visible ? motion.dur : motion.durFast,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY, dragY]);

  const requestClose = onRequestClose ?? onClose;
  const onBackdrop = () => (keyboardVisible ? Keyboard.dismiss() : requestClose?.());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={requestClose}
      statusBarTranslucent
      testID={testID}
      {...rest}
    >
      <View style={[styles.root, { paddingBottom: keyboardHeight }]}>
        <Overlay
          onPress={onBackdrop}
          scrimLabel="Close"
          scrimTestID="bottomsheet-backdrop"
        />
        <Animated.View
          {...pan.panHandlers}
          onLayout={(e) => {
            geometry.current.sheetY = e.nativeEvent.layout.y;
          }}
          style={[
            styles.sheet,
            { backgroundColor: t.background.secondary },
            shadow.sheet,
            keyboardVisible && styles.sheetOverKeyboard,
            {
              transform: [
                {
                  translateY: Animated.add(
                    translateY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 600],
                    }),
                    dragY
                  ),
                },
              ],
            },
            sheetStyle,
          ]}
          accessibilityViewIsModal
        >
          {/* Tapping the panel hides the keyboard — but it claims the touch only
              while the keyboard is up. A Pressable here took every touch on the
              sheet, and the wheel pickers inside could no longer scroll. */}
          <View
            onStartShouldSetResponder={() => keyboardVisible}
            onResponderRelease={Keyboard.dismiss}
            testID="bottomsheet-panel"
          >
            <View style={styles.top}>
              <View style={[styles.handle, { backgroundColor: t.text.placeholder }]} />
            </View>

            {leading !== undefined ? (
              leading ? <View style={styles.back}>{leading}</View> : null
            ) : onBack ? (
              <ButtonIcon
                size="md"
                variant="secondary"
                accessibilityLabel="Back"
                icon={<Icon name="chevron-left" size={20} color={t.text.primary} />}
                onPress={onBack}
                style={styles.back}
                testID="bottomsheet-back"
              />
            ) : null}

            {trailing !== undefined ? (
              trailing ? <View style={styles.close}>{trailing}</View> : null
            ) : showClose && onClose ? (
              <ButtonIcon
                size="md"
                variant="secondary"
                accessibilityLabel="Close"
                icon={<Icon name="close" size={20} color={t.text.primary} />}
                onPress={onClose}
                hitSlop={8}
                style={styles.close}
                testID="bottomsheet-close"
              />
            ) : null}

            <View
              style={[styles.body, bodyStyle]}
              onLayout={(e) => {
                geometry.current.bodyY = e.nativeEvent.layout.y;
              }}
            >
              {statusIcon || title || description ? (
                <View
                  style={styles.textBlock}
                  onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    geometry.current.textBottom = y + height;
                  }}
                >
                  {statusIcon ? <View style={[styles.statusIcon, { backgroundColor: t.brand.secondary }]}>{statusIcon}</View> : null}
                  {title ? <Text style={[styles.title, { color: t.text.primary }]}>{title}</Text> : null}
                  {description ? (
                    <Text style={[styles.description, { color: t.text.secondary }]}>{description}</Text>
                  ) : null}
                </View>
              ) : null}

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
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: sheet.radiusTop,
    borderTopRightRadius: sheet.radiusTop,
    paddingBottom: 34, // Figma home-indicator inset
  },
  // The keyboard covers the home indicator, so the inset would only be a gap.
  sheetOverKeyboard: { paddingBottom: 0 },
  // Figma: grabber 10px from the top edge, corner buttons 12px in.
  top: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 100,
  },
  back: { position: 'absolute', top: 12, left: 12, zIndex: 1 },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
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
  // The title follows the app's sheets (App Design 335:9843, "Heading Extra
  // Small Emphasized", Literata Bold 18), so every sheet in the app reads the
  // same. The design system's "Bottom Sheet – P2" (14233:14268) sets its other
  // text layers as raw values: Inter 16/24 and Inter 12/16. They are kept as
  // drawn (design-system/exceptions.json).
  title: { ...typography.headingExtraSmallEmphasized, textAlign: 'center' },
  description: { ...typography.bodyLarge, lineHeight: 24, textAlign: 'center' },
  actions: { paddingHorizontal: 16, gap: 12 },
  caption: { ...typography.caption, lineHeight: 16, textAlign: 'center' },
});
