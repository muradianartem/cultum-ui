import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

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
 *
 * The inset lands in one frame, deliberately unanimated. LayoutAnimation is
 * global, so a configureNext here animates whatever commits next — and when a
 * sheet autofocuses its field, that is the commit mounting the sheet inside its
 * <Modal>. On iOS (Fabric) that left the sheet laid out above the keyboard,
 * even tappable, but never painted: the room-name field looked buried.
 */
export function useKeyboard() {
  const [state, setState] = useState(() => {
    const visible = Keyboard.isVisible?.() ?? false;
    return { visible, height: (visible && Keyboard.metrics?.()?.height) || 0 };
  });

  useEffect(() => {
    const when = Platform.OS === 'ios' ? 'Will' : 'Did';
    const show = Keyboard.addListener(`keyboard${when}Show`, (e) => {
      setState({ visible: true, height: e?.endCoordinates?.height ?? 0 });
    });
    const hide = Keyboard.addListener(`keyboard${when}Hide`, () => {
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
