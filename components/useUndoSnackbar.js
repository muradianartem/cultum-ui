import { useCallback } from 'react';
import { useSnackbar } from './SnackbarProvider';

/**
 * Show a message for an action that can be taken back.
 *
 * The garden's mutating actions hand back an undo token (or `null` when there
 * was nothing to do); this wires it to the bar:
 *
 *   notify('Task completed', garden.completeReminder(id));
 *
 * The token owns the sync hold that keeps the change off the server while the
 * Undo is on offer, so `onDismiss` — which the host guarantees fires exactly
 * once — is what releases it. Nothing for the call site to remember.
 *
 * @returns {(label: string, undoable?: {undo: () => void, drop: () => void} | null) => void}
 */
export function useUndoSnackbar() {
  const { show } = useSnackbar();

  return useCallback(
    (label, undoable) => {
      if (!undoable) {
        show({ label });
        return;
      }
      show({
        label,
        action: { label: 'Undo', onPress: undoable.undo },
        onDismiss: undoable.drop,
      });
    },
    [show],
  );
}
