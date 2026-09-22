// Onboarding progress — where this installation is in the way-in flow.
//
// Its own document for the same reason the preferences have one
// (lib/prefsStorage.js): `store/persist.js#clearState()` deletes the garden on
// sign-out, and onboarding is a property of the installation, not the account.
// There is no stable account id to key it on (the app never reads one out of
// its tokens), so "has this phone been through onboarding" is the honest
// question — and a completed onboarding must not replay because somebody
// signed out and back in.
//
// Read synchronously, like the preferences: the record picks <Router initial>,
// which is read once at mount, so there is no window in which Today could
// render and then be redirected away.
//
// Writes are synchronous too. That is what serialises them: each transition
// lands on disk in the order it happened, so an older checkpoint can never
// overwrite a newer one the way two racing async writes could.

import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'cultum-onboarding.json';
const TMP_NAME = 'cultum-onboarding.tmp.json';

/** Bump when the shape changes. */
export const ONBOARDING_VERSION = 1;

/** The four screens: three intros, then "Add your first plant". */
export const STEP_COUNT = 4;
export const ENTRY_STEP = STEP_COUNT - 1;

/**
 * intro     — on one of the four onboarding screens (`step` says which)
 * add-plant — left the entry screen for scan/search and the add-plant wizard
 * paywall   — the plant step is over; the paywall is what remains
 * complete  — done; the app opens on Today
 */
export const STAGES = Object.freeze(['intro', 'add-plant', 'paywall', 'complete']);

export const FRESH = Object.freeze({
  version: ONBOARDING_VERSION,
  stage: 'intro',
  step: 0,
  savedPlantId: null,
});

export const COMPLETE = Object.freeze({ ...FRESH, stage: 'complete' });

const onboardingFile = () => new File(Paths.document, FILE_NAME);
const tmpFile = () => new File(Paths.document, TMP_NAME);

/**
 * A stored document as a record, or null when it cannot be trusted.
 *
 * Unlike the preferences, a bad field is not quietly replaced with a default:
 * "the user was on step 2" and "the user finished" lead to very different
 * screens, and guessing between them is worse than the caller's own policy for
 * a missing record.
 */
export function parseOnboarding(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.version !== ONBOARDING_VERSION) return null;
  if (!STAGES.includes(doc.stage)) return null;
  if (!Number.isInteger(doc.step) || doc.step < 0 || doc.step > ENTRY_STEP) return null;
  const savedPlantId =
    typeof doc.savedPlantId === 'string' && doc.savedPlantId ? doc.savedPlantId : null;
  return { version: ONBOARDING_VERSION, stage: doc.stage, step: doc.step, savedPlantId };
}

/** The record as it was left, or null for none (or none worth trusting). Never throws. */
export function loadOnboardingSync() {
  try {
    const file = onboardingFile();
    if (!file.exists) return null;
    return parseOnboarding(JSON.parse(file.textSync()));
  } catch (e) {
    console.warn('[onboarding] could not read progress:', e?.message ?? e);
    return null;
  }
}

/** Write the record. Returns false rather than throwing. */
export function saveOnboarding(record) {
  try {
    const tmp = tmpFile();
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify({ ...record, version: ONBOARDING_VERSION }));
    tmp.moveSync(onboardingFile(), { overwrite: true });
    return true;
  } catch (e) {
    console.warn('[onboarding] could not save progress:', e?.message ?? e);
    return false;
  }
}

/** Forget the record. Deliberately not called on sign-out; exists for tests. */
export function clearOnboarding() {
  try {
    const file = onboardingFile();
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('[onboarding] could not clear progress:', e?.message ?? e);
  }
}
