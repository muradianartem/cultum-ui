// Auth session state + the token exchange/persistence orchestration. The Google
// ID-token acquisition (the useAuthRequest hook) lives in the Login screen, not
// here — this provider only owns exchange + storage.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadTokens, saveTokens, clearTokens } from '../lib/authStorage';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

// DEV ONLY. When true (and running a dev build), skip Google sign-in and enter
// the app with a fake session — lets you debug the UI/screens without OAuth
// credentials. Gated by __DEV__ so it can NEVER take effect in a release build.
// Turn this back to false once the real Google client IDs are wired in.
const DEV_BYPASS_AUTH = true;

const DEV_FAKE_TOKENS = {
  access_token: 'dev-access',
  refresh_token: 'dev-refresh',
  token_type: 'bearer',
  expires_in: 3600,
};

export function AuthProvider({ children }) {
  // 'loading' until we know whether a session was persisted.
  const [status, setStatus] = useState('loading');
  const [tokens, setTokens] = useState(null);

  useEffect(() => {
    // Dev escape hatch: pretend we have a session so AuthGate renders the app.
    // Note: any real authenticated backend call would 401 with these fake
    // tokens (none exist today — main screens use local/mock data).
    if (__DEV__ && DEV_BYPASS_AUTH) {
      setTokens(DEV_FAKE_TOKENS);
      setStatus('signedIn');
      return;
    }

    let cancelled = false;
    loadTokens().then((stored) => {
      if (cancelled) return;
      if (stored) {
        setTokens(stored);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Exchange a Google ID token for app tokens, persist, and flip to signedIn.
  // Throws on failure so the Login screen can surface an error.
  async function completeGoogleLogin(idToken) {
    const minted = await authApi.loginGoogle(idToken);
    await saveTokens(minted);
    setTokens(minted);
    setStatus('signedIn');
  }

  // Rotate the session with the stored refresh token (backend rotates it too).
  // Persists the whole new token set and returns it; on rejection (expired /
  // reused refresh token) the session is cleared. Not auto-triggered on 401 yet
  // — no authenticated feature call exists to drive that retry.
  async function refreshSession() {
    try {
      const rotated = await authApi.refresh(tokens?.refresh_token);
      await saveTokens(rotated);
      setTokens(rotated);
      setStatus('signedIn');
      return rotated;
    } catch (e) {
      await clearTokens();
      setTokens(null);
      setStatus('signedOut');
      throw e;
    }
  }

  // Best-effort server logout (ignore its errors), then clear local storage and
  // flip to signedOut. Not wired to any UI control yet (out of scope this pass).
  async function signOut() {
    try {
      if (tokens?.refresh_token) await authApi.logout(tokens.refresh_token);
    } catch { }
    await clearTokens();
    setTokens(null);
    setStatus('signedOut');
  }

  const value = {
    status,
    tokens,
    completeGoogleLogin,
    refreshSession,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
