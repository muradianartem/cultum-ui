import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

/**
 * SwipeableRow — swipe a row to the LEFT to reveal trailing actions, imported
 * from the Figma "Task Row · Swiped" state. The foreground (`children`, an
 * opaque card) slides left over a fixed actions layer pinned to the right;
 * release snaps open or closed based on distance + fling velocity.
 *
 * Built on RN's Animated + PanResponder (no gesture-handler/reanimated dep). It
 * only claims the gesture on a horizontal drag, so a vertical drag still scrolls
 * the parent list.
 *
 *   <SwipeableRow renderActions={(close) => <Actions onDone={() => { doThing(); close(); }} />}>
 *     <Card>…</Card>
 *   </SwipeableRow>
 *
 * @param renderActions (close) => node   trailing actions; call `close()` to snap shut
 * @param gap    px between the card's right edge and the actions (Figma: 16)
 * @param onOpen / onClose  optional callbacks fired when a snap settles
 */
export default function SwipeableRow({
  children,
  renderActions,
  gap = 16,
  onOpen,
  onClose,
  style,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  // The snapped resting offset (0 = closed, -openTo = open). Kept in a ref so the
  // pan handlers always read the latest without re-creating the responder.
  const restX = useRef(0);
  const [actionsWidth, setActionsWidth] = useState(0);
  const openTo = actionsWidth > 0 ? actionsWidth + gap : 0;

  const settle = (toOpen) => {
    const to = toOpen ? -openTo : 0;
    restX.current = to;
    Animated.spring(translateX, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
    (toOpen ? onOpen : onClose)?.();
  };

  const close = () => settle(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Let plain taps fall through to the card's own Pressable…
        onStartShouldSetPanResponder: () => false,
        // …but claim the gesture once the move is clearly horizontal, which also
        // hands vertical drags back to the enclosing ScrollView.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 8,
        onPanResponderMove: (_e, g) => {
          // Clamp to [-openTo, 0] with a little rubber-band past each end.
          let next = restX.current + g.dx;
          if (next > 0) next = next * 0.25;
          else if (next < -openTo) next = -openTo + (next + openTo) * 0.25;
          translateX.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          if (!openTo) return;
          // Fling wins; otherwise snap to whichever state is nearer (past halfway).
          const flungOpen = g.vx < -0.35;
          const flungClosed = g.vx > 0.35;
          const pastHalf = restX.current + g.dx < -openTo / 2;
          settle(flungOpen || (pastHalf && !flungClosed));
        },
        onPanResponderTerminate: () => settle(restX.current < -openTo / 2),
      }),
    [openTo]
  );

  return (
    <View style={[styles.container, style]}>
      <View
        style={styles.actions}
        onLayout={(e) => setActionsWidth(e.nativeEvent.layout.width)}
        pointerEvents="box-none"
      >
        {renderActions?.(close)}
      </View>
      <Animated.View
        style={[styles.fore, { transform: [{ translateX }] }]}
        {...responder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // overflow visible so the card can slide past the left edge (its rounded
  // corners are preserved); the opaque card hides the actions when closed.
  container: { position: 'relative', justifyContent: 'center' },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fore: { width: '100%' },
});
