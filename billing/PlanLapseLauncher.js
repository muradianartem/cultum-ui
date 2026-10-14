// Opens "Your free trial has ended" once a trial or subscription lapses.
//
// Not a <Route>: like <NotificationRouter> it renders nothing and sits inside
// the Router so it can navigate over whatever opened first. It waits for three
// things before deciding:
//   • onboarding to be over — onboarding ends on its own paywall, and a lapse
//     notice on top of that flow is exactly the interruption it forbids;
//   • the garden — the notice counts the user's plants;
//   • a lapse this device has not acknowledged (lib/planLapseAck.js). Only the
//     notice's own answers acknowledge it, so "Upgrade to Plus" followed by
//     closing the app asks again on the next launch.

import { useEffect, useRef } from 'react';
import { useRouter } from '../routing';
import { useOnboarding } from '../onboarding';
import { useGarden } from '../store/GardenProvider';
import { useEntitlement } from './EntitlementProvider';
import { planLapse } from './lapse';
import { isLapseAcknowledged } from '../lib/planLapseAck';

export default function PlanLapseLauncher() {
  const { navigate } = useRouter();
  const { active: onboarding } = useOnboarding();
  const { status } = useGarden();
  const lapse = planLapse(useEntitlement());
  // Once per session: a later entitlement refresh must not re-open it over
  // whatever the user went on to do.
  const fired = useRef(false);

  const key = lapse?.key ?? null;
  const kind = lapse?.kind ?? null;

  useEffect(() => {
    if (fired.current || !key || onboarding || status !== 'ready') return;
    if (isLapseAcknowledged(key)) return;
    fired.current = true;
    navigate('plan-ended', { kind, lapseKey: key });
  }, [key, kind, onboarding, status, navigate]);

  return null;
}
