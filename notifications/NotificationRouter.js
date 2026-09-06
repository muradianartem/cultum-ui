// Turns a tapped notification into a navigation.
//
// Rendered inside <Router> (and so inside the garden), because that is where
// `navigate` lives — the routes themselves unmount as you move between them,
// so none of them is a safe place to hold this listener.
//
// Renders nothing.

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from '../routing';

export default function NotificationRouter() {
  const { navigate } = useRouter();

  useEffect(() => {
    let alive = true;

    const open = (response) => {
      const plantId = response?.notification?.request?.content?.data?.plantId;
      if (plantId) navigate('product', { plantId });
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

  return null;
}
