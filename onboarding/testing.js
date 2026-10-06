// Test harness for screens that behave differently inside onboarding.
//
// Not a test file, and never imported by the app (Metro only bundles what
// index.js reaches), so it may lean on react-test-renderer's `act`.

import { act } from 'react-test-renderer';
import { OnboardingProvider, useOnboarding } from './OnboardingProvider';
import { ENTRY_STEP, FRESH } from './storage';

/**
 * Wrap `element` in an onboarding that is on "Add your first plant", ready to
 * open an add session. Returns the element to render and a live handle:
 *
 *   const session = onboardingSession(<ScanCameraScreen />);
 *   const tree = create(session.element);
 *   session.begin();                 // what the entry screen's Scan / Search do
 *   expect(session.current.addingPlant).toBe(true);
 */
export function onboardingSession(element) {
  const handle = { current: null };
  function Probe() {
    handle.current = useOnboarding();
    return null;
  }
  return {
    element: (
      <OnboardingProvider initial={{ ...FRESH, step: ENTRY_STEP }} override={null}>
        <Probe />
        {element}
      </OnboardingProvider>
    ),
    begin: () => act(() => handle.current.beginPlant()),
    get current() {
      return handle.current;
    },
  };
}
