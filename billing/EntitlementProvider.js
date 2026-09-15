// Whether the signed-in user is on Plus.
//
// Mounted inside AuthGate and above <Router>, for the reason GardenProvider is:
// routing/Route.js unmounts a screen the moment you navigate away, and the
// answer has to outlive whichever screen asked.
//
// Starts from the cached answer (lib/entitlementCache.js) rather than from
// `free`, so on every launch after the first `ready` is already true on render
// #1 and nobody is shown an upgrade pitch for something they are paying for.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getEntitlement, mapEntitlement } from '../api/billing';
import { loadEntitlementSync, saveEntitlement } from '../lib/entitlementCache';
import { setEntitlement } from './entitlementRef';
import { useAuth } from '../auth/AuthProvider';

/** Re-check on foreground if the answer is older than this. */
const STALE_MS = 5 * 60 * 1000;

const UNKNOWN = { ready: false, plan: 'free', isPlus: false, limits: null, usage: null, subscription: null };

const EntitlementContext = createContext({ ...UNKNOWN, refresh: async () => {} });

const fromCache = () => {
  const cached = loadEntitlementSync();
  return cached ? { ...mapEntitlement(cached), ready: true } : UNKNOWN;
};

export function EntitlementProvider({ children, initial = null }) {
  const { status, devSession } = useAuth();
  const [entitlement, setState] = useState(() => initial ?? fromCache());
  const fetchedAt = useRef(0);
  const inFlight = useRef(false);

  // Written synchronously beside setState so routing/guards.js — which reads
  // the module singleton, not this context — is never a render behind.
  setEntitlement(entitlement);

  const refresh = useCallback(async () => {
    // A dev-bypass session has no real credentials: the fake tokens 401, and
    // apiFetch answers a 401 by rotating the session, which fails and signs the
    // developer straight out. Same reason GardenProvider#runSync sits it out.
    if (inFlight.current || status !== 'signedIn' || devSession) return;
    inFlight.current = true;
    try {
      const dto = await getEntitlement();
      const next = { ...mapEntitlement(dto), ready: true };
      fetchedAt.current = Date.now();
      setEntitlement(next);
      setState(next);
      saveEntitlement(dto);
    } catch (e) {
      // Offline, a timeout, a 5xx — none of them are news about this user's
      // plan, so the cached answer stands. A 401 is apiFetch's to handle: it
      // has already rotated or ended the session by the time we get here.
      // Deliberately no TTL on the cache: expiring it offline would take Plus
      // away from a paying user on a plane, and the server is the real gate on
      // anything that matters.
      if (__DEV__) console.log('[billing] entitlement unchanged:', e?.message ?? e);
    } finally {
      inFlight.current = false;
    }
  }, [status, devSession]);

  useEffect(() => {
    if (status === 'signedIn') refresh();
  }, [status, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() - fetchedAt.current > STALE_MS) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(() => ({ ...entitlement, refresh }), [entitlement, refresh]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlement() {
  return useContext(EntitlementContext);
}
