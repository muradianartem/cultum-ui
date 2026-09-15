import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Close one Modal and open another — a sheet into a dialog, or back.
 *
 * iOS presents one Modal at a time: open the next while the last is still
 * animating out and it silently never appears. So on iOS the next surface
 * waits for the closing Modal's `onDismiss`, which RN only fires there.
 * Elsewhere there is no `onDismiss` to wait for, and nothing to wait out.
 *
 *   const { handoff, onDismiss } = useModalHandoff();
 *   <BottomSheet onDismiss={onDismiss} … />
 *   <Dialog onDismiss={onDismiss} … />
 *   handoff(() => setSheet(null), () => setDialog(true));
 */
export function useModalHandoff() {
  const pending = useRef(null);

  const handoff = useCallback((close, open) => {
    close();
    if (Platform.OS === 'ios') pending.current = open;
    else open();
  }, []);

  const onDismiss = useCallback(() => {
    const open = pending.current;
    pending.current = null;
    open?.();
  }, []);

  return { handoff, onDismiss };
}
