// Pre-auth entry screen: full-bleed hero photo + scrim, brand block, and the two
// SSO buttons. Google is fully wired (nonce-bound OIDC id_token → /auth/google);
// Apple is deferred with a "coming soon" snackbar this pass.

import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Button, Icon, Snackbar } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { space, typography } from '../theme/foundations';
import { GOOGLE_CLIENT_IDS } from '../lib/config';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';

// Required so the web OAuth popup can hand the result back and close itself.
WebBrowser.maybeCompleteAuthSession();

const APPLE_COMING_SOON = 'Apple Sign In is coming soon';
const SIGN_IN_FAILED = "Couldn't sign in. Try again.";

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t, insets), [t, insets]);

  const [nonce, setNonce] = useState(null);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState(null);

  const auth = useAuth();

  // Google's own auth-session provider: it selects the right client ID per
  // platform and uses the matching redirect (the iOS client's reversed-scheme,
  // not a custom `cultum://` — which is why the raw Web-client + custom-scheme
  // request was rejected as invalid_request). `webClientId` is the backend's
  // audience: it becomes the id_token `aud` the server verifies in /auth/google.
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_CLIENT_IDS.ios,
    androidClientId: GOOGLE_CLIENT_IDS.android,
    webClientId: GOOGLE_CLIENT_IDS.web,
    // openid→sub, profile→name, email→email + email_verified: the four claims
    // the backend's get_or_create_user() reads off the id_token.
    scopes: ['openid', 'profile', 'email'],
    // The server-minted nonce is the replay defense — Google bakes it into the
    // id_token and the backend verifies it. The Google provider defers to a
    // supplied extraParams.nonce rather than generating its own.
    extraParams: nonce ? { nonce } : undefined,
  });

  // Nonce is single-use/expiring — mint a fresh one on mount and after each try.
  async function refreshNonce() {
    try {
      const { nonce: minted } = await authApi.createNonce();
      setNonce(minted);
    } catch {
      setNonce(null);
    }
  }

  useEffect(() => {
    refreshNonce();
  }, []);

  // Exchange the Google id_token once the auth request resolves.
  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (__DEV__ && !idToken) console.warn('[login] Google success but no id_token', response.params);
      setBusy(true);
      auth
        .completeGoogleLogin(idToken)
        .catch((err) => {
          if (__DEV__) console.warn('[login] /auth/google exchange failed:', err?.message ?? err);
          setSnack({ label: SIGN_IN_FAILED });
        })
        .finally(() => setBusy(false));
    } else if (response.type === 'error' || response.type === 'dismiss' || response.type === 'cancel') {
      if (__DEV__ && response.type === 'error') console.warn('[login] auth error:', response.error);
      // The old nonce may be spent — re-arm for the next attempt.
      setBusy(false);
      refreshNonce();
    }
  }, [response]);

  // Snackbar auto-dismiss (caller owns Snackbar timing).
  useEffect(() => {
    if (!snack) return undefined;
    const id = setTimeout(() => setSnack(null), 3000);
    return () => clearTimeout(id);
  }, [snack]);

  async function onGooglePress() {
    await promptAsync();
  }

  function showAppleComingSoon() {
    setSnack({ label: APPLE_COMING_SOON });
  }

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../assets/plant/hero.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.title}>Cultum</Text>
          <Text style={styles.tagline}>Know every plant you meet.</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Continue with Google"
            leftIcon={<Icon name="google" size={20} />}
            onPress={onGooglePress}
            loading={busy}
            disabled={!request || !nonce}
          />
          <Button
            variant="secondary"
            label="Continue with Apple"
            leftIcon={<Icon name="apple" size={20} />}
            onPress={showAppleComingSoon}
          />
        </View>
      </View>

      {snack ? (
        <View style={styles.snackHost} pointerEvents="box-none">
          <Snackbar label={snack.label} onDismiss={() => setSnack(null)} />
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(t, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    content: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: space[24],
      paddingTop: insets.top + space[48],
      paddingBottom: insets.bottom + space[24],
    },
    brand: { marginBottom: space[48] },
    // Light text on the photo scrim — a fixed light value is intentional here.
    title: { ...typography.display, color: '#FFFFFF' },
    tagline: { ...typography.bodyLarge, color: 'rgba(255,255,255,0.85)', marginTop: space[8] },
    actions: { gap: space[12] },
    snackHost: {
      position: 'absolute',
      left: space[16],
      right: space[16],
      bottom: insets.bottom + space[16],
      alignItems: 'center',
    },
  });
}
