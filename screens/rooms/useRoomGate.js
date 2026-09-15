import { useCallback } from 'react';
import { useEntitlement } from '../../billing/EntitlementProvider';
import { useRouter } from '../../routing';
import { useGarden } from '../../store/GardenProvider';

/**
 * Guard for anything that starts creating a room.
 *
 *   const gate = useRoomGate();
 *   <Button onPress={() => gate(() => setCreating(true))} />
 *
 * At the plan's `limits.rooms` (1 on free) it opens the paywall instead of
 * running `open`. A `null` limit — Plus, or an entitlement not fetched yet —
 * means no ceiling: the server is the real gate, and store/sync.js drops a
 * create it refuses.
 *
 * @returns {(open?: () => void) => boolean} whether `open` ran
 */
export function useRoomGate() {
  const { limits } = useEntitlement();
  const { navigate } = useRouter();
  const { rooms } = useGarden();
  const max = limits?.rooms;
  const count = rooms.length;

  return useCallback(
    (open) => {
      if (Number.isFinite(max) && count >= max) {
        navigate('paywall');
        return false;
      }
      open?.();
      return true;
    },
    [max, count, navigate],
  );
}
