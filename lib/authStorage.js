import { Platform } from 'react-native';

// Single key holding the whole TokenResponse as JSON.
const KEY = 'cultum.auth.tokens';

// Web persistence: prefer window.localStorage, fall back to an in-memory object
// so calls never throw under SSR/tests where localStorage is absent.
const memory = {};
const webStore = {
  get(k) {
    try {
      const ls = typeof window !== 'undefined' ? window.localStorage : null;
      if (ls) return ls.getItem(k);
    } catch {}
    return k in memory ? memory[k] : null;
  },
  set(k, v) {
    try {
      const ls = typeof window !== 'undefined' ? window.localStorage : null;
      if (ls) return ls.setItem(k, v);
    } catch {}
    memory[k] = v;
  },
  remove(k) {
    try {
      const ls = typeof window !== 'undefined' ? window.localStorage : null;
      if (ls) return ls.removeItem(k);
    } catch {}
    delete memory[k];
  },
};

const isWeb = Platform.OS === 'web';

export async function saveTokens(tokens) {
  const json = JSON.stringify(tokens);
  if (isWeb) {
    webStore.set(KEY, json);
    return;
  }
  const SecureStore = require('expo-secure-store');
  await SecureStore.setItemAsync(KEY, json);
}

export async function loadTokens() {
  let json;
  if (isWeb) {
    json = webStore.get(KEY);
  } else {
    const SecureStore = require('expo-secure-store');
    json = await SecureStore.getItemAsync(KEY);
  }
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function clearTokens() {
  if (isWeb) {
    webStore.remove(KEY);
    return;
  }
  const SecureStore = require('expo-secure-store');
  await SecureStore.deleteItemAsync(KEY);
}
