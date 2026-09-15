import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Whether the software keyboard is up. iOS announces it before it animates
// ("will"), Android only once it has landed ("did") — sheets use this to let a
// backdrop tap close the keyboard before it closes the sheet.
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(() => Keyboard.isVisible?.() ?? false);

  useEffect(() => {
    const when = Platform.OS === 'ios' ? 'Will' : 'Did';
    const show = Keyboard.addListener(`keyboard${when}Show`, () => setVisible(true));
    const hide = Keyboard.addListener(`keyboard${when}Hide`, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
