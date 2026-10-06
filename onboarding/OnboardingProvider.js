// Onboarding progress, held above <Router>.
//
// routing/Route.js unmounts a screen the moment you navigate away, and the scan
// flow resets history on several of its exits, so a flag threaded through
// route params would be lost somewhere between the camera and the add-plant
// wizard. Kept here instead, the intent survives every one of those
// transitions — the same reason the garden and the entitlement live up here.
//
// Every transition is written to disk as it happens (onboarding/storage.js),
// not batched for backgrounding: the process can die between any two screens,
// and the next launch should resume from the last one the user actually saw.
//
// Whether to show it at all is the account's question, answered by the backend:
// GET /users/me's `onboarding_shown`, read at sign-in (auth/AuthProvider.js).
// Finishing sends PATCH /users/me `{ onboarding_shown: true }`, retried at
// the next launch when it fails.
//
// A failed write is logged and otherwise ignored. The in-memory state still
// moves on, so the session is never blocked by a full disk — the cost is that
// the next launch may replay the unfinished stage.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { setOnboardingShown } from '../api/account';
import {
  COMPLETE,
  ENTRY_STEP,
  FRESH,
  loadOnboardingSync,
  saveOnboarding,
} from './storage';

// Any consumer can render outside the provider (isolated screen tests, a
// screen reached outside onboarding) and read "not onboarding" instead of
// crashing — which is also exactly what an ordinary add-plant should see.
const DEFAULT_CONTEXT = {
  stage: 'complete',
  step: ENTRY_STEP,
  savedPlantId: null,
  active: false,
  addingPlant: false,
  resuming: false,
  initialRoute: 'today',
  setStep: () => {},
  beginPlant: () => {},
  returnToEntry: () => {},
  recordSavedPlant: () => {},
  beginPaywall: () => {},
  finishResume: () => {},
  complete: () => {},
};

const OnboardingContext = createContext(DEFAULT_CONTEXT);

/**
 * `EXPO_PUBLIC_ONBOARDING=fresh|complete` in a development build forces either
 * path on every launch, whatever is on disk — the only way to preview a
 * first-run flow on a phone that has long since finished it.
 */
function devOverride() {
  if (!__DEV__) return null;
  const value = process.env.EXPO_PUBLIC_ONBOARDING;
  return value === 'fresh' || value === 'complete' ? value : null;
}

/**
 * Where this launch starts, from the backend's answer, what is on disk and how
 * the session began.
 *
 * `serverShown` is GET /users/me's `onboarding_shown` — only asked at a fresh
 * sign-in, and null when it was not asked or could not be read:
 *
 *   • true  → complete. The account has been through it, on this phone or
 *     another one.
 *   • false → an unfinished record resumes; otherwise onboarding from the top.
 *     The exception is a complete record whose report never reached the
 *     server: that is this account's own finish, and replaying it would be
 *     wrong — the pending report goes out instead.
 *
 * With no answer, the record on this device decides, as it did before:
 *
 *   • a stored record wins, normalised for resuming (below);
 *   • no record + a fresh sign-in ('login') → onboarding from the top;
 *   • no record + restored tokens (or the dev bypass) → complete. That is an
 *     installation that predates onboarding, and its user has seen the app.
 *
 * A pragmatic migration, not a new-account detector: an existing user who was
 * signed out when they updated sees onboarding once.
 *
 * Returns `{ record, resuming, persist }`. `resuming` means the record names a
 * checkpoint that <OnboardingNavigator> has to settle before any onboarding UI
 * is meaningful; `persist` whether the result is worth writing back.
 */
export function resolveInitial({ stored, signedInVia, serverShown = null, override = null }) {
  if (override === 'fresh') return { record: { ...FRESH }, resuming: false, persist: false };
  if (override === 'complete') return { record: { ...COMPLETE }, resuming: false, persist: false };

  if (serverShown === true) {
    if (stored?.stage === 'complete' && stored.reported) {
      return { record: stored, resuming: false, persist: false };
    }
    return { record: { ...COMPLETE, reported: true }, resuming: false, persist: true };
  }
  if (serverShown === false && stored?.stage === 'complete' && stored.reported) {
    return { record: { ...FRESH }, resuming: false, persist: true };
  }

  if (!stored) {
    const record = signedInVia === 'login' ? { ...FRESH } : { ...COMPLETE };
    return { record, resuming: false, persist: true };
  }

  // Scan/search was in progress with nothing saved yet. The camera state and
  // an unsaved form draft are not restorable, so start again from the entry
  // screen rather than pretend to resume them.
  if (stored.stage === 'add-plant' && !stored.savedPlantId) {
    return { record: { ...stored, stage: 'intro', step: ENTRY_STEP }, resuming: false, persist: true };
  }
  // A plant was saved (it may or may not have reached the garden's own file),
  // or only the paywall was left. The navigator checks the garden and decides.
  const resuming = stored.stage === 'add-plant' || stored.stage === 'paywall';
  return { record: stored, resuming, persist: false };
}

export function OnboardingProvider({
  children,
  signedInVia = null,
  serverShown = null,
  initial,
  override,
  reportShown = setOnboardingShown,
}) {
  // Resolved once, at mount. `signedInVia` is only consulted when there is no
  // record yet; after that the record on disk is the whole truth.
  const [boot] = useState(() => {
    const out = resolveInitial({
      stored: initial !== undefined ? initial : loadOnboardingSync(),
      signedInVia,
      serverShown,
      override: override !== undefined ? override : devOverride(),
    });
    if (out.persist) saveOnboarding(out.record);
    return out;
  });

  const [record, setRecord] = useState(boot.record);
  const [resuming, setResuming] = useState(boot.resuming);

  // Transitions read the latest record through a ref so two in the same frame
  // (a double tap) see each other's result rather than the same stale state.
  const current = useRef(record);

  const commit = useCallback((patch) => {
    const prev = current.current;
    const next = { ...prev, ...patch };
    if (
      next.stage === prev.stage &&
      next.step === prev.step &&
      next.savedPlantId === prev.savedPlantId &&
      next.reported === prev.reported
    ) {
      return; // idempotent: nothing changed, nothing written
    }
    current.current = next;
    saveOnboarding(next);
    setRecord(next);
  }, []);

  const setStep = useCallback(
    (step) => {
      if (current.current.stage === 'complete') return;
      commit({ stage: 'intro', step: Math.max(0, Math.min(ENTRY_STEP, step)) });
    },
    [commit],
  );

  // Only the entry screen's Scan / Search calls this — the single thing that
  // makes a later add-plant an onboarding one.
  const beginPlant = useCallback(() => {
    if (current.current.stage === 'complete') return;
    commit({ stage: 'add-plant', step: ENTRY_STEP });
  }, [commit]);

  const returnToEntry = useCallback(() => {
    if (current.current.stage !== 'add-plant') return;
    commit({ stage: 'intro', step: ENTRY_STEP });
  }, [commit]);

  const recordSavedPlant = useCallback(
    (id) => {
      if (current.current.stage !== 'add-plant' || !id) return;
      commit({ savedPlantId: id });
    },
    [commit],
  );

  const beginPaywall = useCallback(() => {
    if (current.current.stage === 'complete') return;
    commit({ stage: 'paywall' });
  }, [commit]);

  const complete = useCallback(() => {
    setResuming(false);
    commit({ stage: 'complete' });
  }, [commit]);

  const finishResume = useCallback(() => setResuming(false), []);

  // Tell the backend once onboarding is complete, so the next sign-in — here
  // or on another phone — skips it. Only for a real session: the dev bypass's
  // fake tokens 401, and apiFetch answers that by signing the developer out.
  // A failure leaves `reported` false, and the next launch tries again.
  const reporting = useRef(false);
  const canReport = signedInVia === 'login' || signedInVia === 'restore';
  useEffect(() => {
    if (!canReport || record.stage !== 'complete' || record.reported || reporting.current) return;
    reporting.current = true;
    Promise.resolve()
      .then(() => reportShown(true))
      .then(
        () => commit({ reported: true }),
        (e) => console.warn('[onboarding] could not report completion:', e?.message ?? e),
      )
      .finally(() => {
        reporting.current = false;
      });
  }, [canReport, record, reportShown, commit]);

  const value = useMemo(
    () => ({
      stage: record.stage,
      step: record.step,
      savedPlantId: record.savedPlantId,
      active: record.stage !== 'complete',
      addingPlant: record.stage === 'add-plant',
      resuming,
      // Read once by <Router initial>. Any unfinished stage opens on the
      // onboarding route, which holds a spinner while a checkpoint resumes —
      // never on Today with a redirect a frame later.
      initialRoute: boot.record.stage === 'complete' ? 'today' : 'onboarding',
      setStep,
      beginPlant,
      returnToEntry,
      recordSavedPlant,
      beginPaywall,
      finishResume,
      complete,
    }),
    [
      record,
      resuming,
      boot,
      setStep,
      beginPlant,
      returnToEntry,
      recordSavedPlant,
      beginPaywall,
      finishResume,
      complete,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
