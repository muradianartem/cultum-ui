// The onboarding transitions that need the router.
//
// Not a <Route>: like <NotificationRouter>, it renders nothing and sits inside
// <Router> so it can navigate. The provider above the router owns the record;
// this settles the one thing the record cannot settle alone — a checkpoint
// left by a previous launch that points past the onboarding screens.
//
//   • 'paywall' → the plant step is over, so reopen the onboarding paywall.
//   • 'add-plant' with a saved plant id → if that plant is in the garden, the
//     plant step is over too: straight to the paywall. If it is not (the
//     onboarding checkpoint reached disk and the garden write did not — they
//     are separate files, and nothing here pretends otherwise), back to the
//     entry screen to add one. Never create a plant from a checkpoint.
//
// Waits for the garden to load before checking, because until then every
// plant is "missing".

import { useEffect } from 'react';
import { useRouter } from '../routing';
import { useGarden } from '../store/GardenProvider';
import { useOnboarding } from './OnboardingProvider';

export const ONBOARDING_PAYWALL = { source: 'onboarding' };

export default function OnboardingNavigator() {
  const { reset } = useRouter();
  const garden = useGarden();
  const onboarding = useOnboarding();
  const { resuming, stage, savedPlantId, beginPaywall, returnToEntry, finishResume } = onboarding;

  useEffect(() => {
    if (!resuming || !garden.ready) return;
    if (stage === 'paywall') {
      reset('paywall', ONBOARDING_PAYWALL);
    } else if (stage === 'add-plant' && savedPlantId && garden.getPlant(savedPlantId)) {
      beginPaywall();
      reset('paywall', ONBOARDING_PAYWALL);
    } else {
      returnToEntry();
    }
    finishResume();
  }, [resuming, garden, stage, savedPlantId, reset, beginPaywall, returnToEntry, finishResume]);

  return null;
}

/**
 * The way out of scan/search when the user gives up on it. In onboarding that
 * is the entry screen ("Add your first plant"); anywhere else, Today — which is
 * where the scan flow's close has always gone.
 */
export function useLeaveAcquisition() {
  const { reset } = useRouter();
  const { addingPlant, returnToEntry } = useOnboarding();
  return () => {
    if (addingPlant) {
      returnToEntry();
      reset('onboarding');
    } else {
      reset('today');
    }
  };
}
