// Turns a tapped notification into a navigation.
//
// Rendered inside <Router> (and so inside the garden), because that is where
// `navigate` lives — the routes themselves unmount as you move between them,
// so none of them is a safe place to hold this listener.
//
// While onboarding is running, a tap is held instead of followed: jumping to a
// plant page from the middle of the camera or the add-plant wizard would
// strand the user outside a flow that has no other way back in. Only the
// latest tap is kept, in memory. It is delivered once onboarding completes,
// and only if the garden still has that plant; otherwise Today stays put.
//
// Renders nothing.

import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from '../routing';
import { useGarden } from '../store/GardenProvider';
import { useOnboarding } from '../onboarding';

export default function NotificationRouter() {
  const { navigate } = useRouter();
  const garden = useGarden();
  const { active } = useOnboarding();
  const [pending, setPending] = useState(null);

  // Read by the listener, which is attached once and must not be re-attached
  // (that would re-deliver the cold-launch response) just because this changed.
  const onboardingActive = useRef(active);
  onboardingActive.current = active;

  useEffect(() => {
    let alive = true;

    const open = (response) => {
      const plantId = response?.notification?.request?.content?.data?.plantId;
      if (!plantId) return;
      if (onboardingActive.current) setPending(plantId);
      else navigate('product', { plantId });
    };

    // A tap that launched the app from cold arrives before any listener could
    // have been attached, so ask for it explicitly first.
    Notifications.getLastNotificationResponseAsync?.()
      .then((response) => {
        if (alive) open(response);
      })
      .catch(() => {
        // No launch response, or the module isn't available — nothing to do.
      });

    const sub = Notifications.addNotificationResponseReceivedListener?.(open);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, [navigate]);

  // Onboarding finished (or never started): deliver the held tap, if the plant
  // it names is still there. Waits for the garden, because until it has loaded
  // every plant looks missing.
  useEffect(() => {
    if (!pending || active || !garden.ready) return;
    setPending(null);
    if (garden.getPlant(pending)) navigate('product', { plantId: pending });
  }, [pending, active, garden, navigate]);

  return null;
}
