import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform } from 'react-native';

// Match the layout change to the keyboard's own curve, the way
// KeyboardAvoidingView does. Events without a duration (Android's "did", the
// synthetic ones in tests) just land in one frame.
function animate(e) {
  const duration = e?.duration;
  if (!duration) return;
  const type = LayoutAnimation.Types[e?.easing] || 'keyboard';
  LayoutAnimation.configureNext({
    duration,
    update: { duration, type },
  });
}

/**
 * The software keyboard's state: whether it is up, and how tall it is.
 *
 * Sheets size their own bottom inset from `height` instead of leaning on
 * <KeyboardAvoidingView>. The KAV derives its inset from its own onLayout, and
 * a <Modal> mounts its whole subtree only when it opens — so a field with
 * `autoFocus` raises the keyboard before that first layout reaches JS and the
 * sheet stays buried under it until the next focus. This hook is subscribed
 * from screen mount, outside the Modal, so it cannot miss the event, and it
 * gives Android the avoidance the KAV never did there.
 *
 * iOS announces the keyboard before it animates ("will"), Android only once it
 * has landed ("did").
 */
export function useKeyboard() {
  const [state, setState] = useState(() => {
    const visible = Keyboard.isVisible?.() ?? false;
    return { visible, height: (visible && Keyboard.metrics?.()?.height) || 0 };
  });

  useEffect(() => {
    const when = Platform.OS === 'ios' ? 'Will' : 'Did';
    const show = Keyboard.addListener(`keyboard${when}Show`, (e) => {
      animate(e);
      setState({ visible: true, height: e?.endCoordinates?.height ?? 0 });
    });
    const hide = Keyboard.addListener(`keyboard${when}Hide`, (e) => {
      animate(e);
      setState({ visible: false, height: 0 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return state;
}

// Whether the software keyboard is up — sheets use this to let a backdrop tap
// close the keyboard before it closes the sheet. Kept separate from `height`:
// a hardware keyboard is "up" with an accessory bar barely taller than nothing.
export function useKeyboardVisible() {
  return useKeyboard().visible;
}
