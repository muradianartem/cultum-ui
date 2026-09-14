// Opens the paywall once there is something to sell.
//
// Not a <Route>: like <NotificationRouter>, it renders nothing and sits inside
// the Router so it can navigate. It exists because the entry decision has to
// *wait*. <Router initial> is read once, at mount, and cannot await a fetch —
// fine when a copy of the content ships with the app, and not fine now that
// none does. The alternatives were both worse: a spinner on a sales page for as
// long as the backend's cold start takes, or a screen that paints prices from a
// bundled snapshot the server may since have changed.
//
// So the app opens on Today and the paywall arrives over it when its content
// does. If the request fails, nothing happens at all — silence is the correct
// outcome for "we cannot say what this costs", and the user is not blocked.

import { useEffect, useRef } from 'react';
import { useRouter } from '../routing';
import { usePaywallContent } from './paywallContent';
import { paywallEntryRoute } from './entry';

export default function PaywallLauncher({ signedInVia }) {
  const { navigate } = useRouter();
  const content = usePaywallContent();
  // Once per session. The cache can notify again (a later mount re-fetches),
  // and re-opening the paywall over whatever the user is doing would be rude.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !content) return;
    if (paywallEntryRoute({ signedInVia }) !== 'paywall') return;
    fired.current = true;
    // navigate, not reset: this leaves `today` on the stack, so the paywall's
    // close button pops back to it the same way every other screen's does.
    navigate('paywall');
  }, [content, signedInVia, navigate]);

  return null;
}
