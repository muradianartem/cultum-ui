// Pre-auth entry screen — Figma "Auth / Welcome" (file 4jmjNlaM7IRpCOogYRJMks,
// node 250:8): a three-column photo mosaic bleeding off the bottom, a dark
// gradient scrim, the Cultum lockup, and the SSO buttons.
//
// Google is fully wired (nonce-bound OIDC id_token → /auth/google); Apple is
// deferred with a "coming soon" snackbar. The design's third provider,
// "Continue with email", is omitted until the backend grows an email/OTP
// endpoint — api/auth.js only speaks nonce/google/refresh/logout today.

import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Button, Icon, Snackbar } from '../components';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';
import { GOOGLE_CLIENT_IDS } from '../lib/config';
import { authApi } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';

// Required so the web OAuth popup can hand the result back and close itself.
WebBrowser.maybeCompleteAuthSession();

const APPLE_COMING_SOON = 'Apple Sign In is coming soon';
const SIGN_IN_FAILED = "Couldn't sign in. Try again.";

const TAGLINE = 'Better plant-care reminders, so you never forget your plants again.';

// Mosaic geometry (Figma: 3 columns, 5px gutters, 218px photos, 14px radius).
// The columns are 900 tall against an 812 frame — the grid is meant to bleed
// past the bottom edge, so nothing here clamps to the screen height.
const PHOTO_H = 218;
const PHOTO_GAP = 5;

// Figma slots 1–12; slot 12 repeats slot 1's image (one shared imageRef).
const MOSAIC = [
  [
    require('../assets/auth/mosaic-01.png'),
    require('../assets/auth/mosaic-02.png'),
    require('../assets/auth/mosaic-03.png'),
    require('../assets/auth/mosaic-04.png'),
  ],
  [
    require('../assets/auth/mosaic-05.png'),
    require('../assets/auth/mosaic-06.png'),
    require('../assets/auth/mosaic-07.png'),
    require('../assets/auth/mosaic-08.png'),
  ],
  [
    require('../assets/auth/mosaic-09.png'),
    require('../assets/auth/mosaic-10.png'),
    require('../assets/auth/mosaic-11.png'),
    require('../assets/auth/mosaic-01.png'),
  ],
];

// The Welcome screen is dark whatever the OS scheme is — it sits on photography.
// ThemeProvider is a plain context provider, so nesting one pins the dark tokens
// for this subtree and every colour in the Figma frame resolves from them:
//   #151515 background.primary · #606160 border.primary
//   #FAFAFA text.primary       · #DADBDA text.secondary
export default function LoginScreen() {
  return (
    <ThemeProvider initialMode="dark">
      <WelcomeScreen />
    </ThemeProvider>
  );
}

function WelcomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t, insets), [t, insets]);

  const [nonce, setNonce] = useState(null);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState(null);

  const auth = useAuth();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_CLIENT_IDS.ios,
    webClientId: GOOGLE_CLIENT_IDS.web,
    scopes: ['openid', 'profile', 'email'],
    extraParams: nonce ? { nonce } : undefined,
  });

  useEffect(() => {
    if (__DEV__ && request?.redirectUri) {
      console.log('[login] redirectUri =', request.redirectUri);
      console.log('[login] clientId    =', request.clientId);
    }
  }, [request?.redirectUri, request?.clientId]);

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
      <View style={styles.mosaic}>
        {MOSAIC.map((column, ci) => (
          <View key={`col-${ci}`} style={styles.column}>
            {column.map((source, pi) => (
              <Image
                key={`photo-${ci}-${pi}`}
                source={source}
                style={styles.photo}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
                testID="welcome-mosaic-photo"
              />
            ))}
          </View>
        ))}
      </View>

      <LinearGradient
        colors={[
          // Figma "Scrim" — a translucent stack with no token equivalent, same
          // as BottomSheet's backdrop and colorTokens' interaction layers.
          'rgba(13,15,10,0.5)',
          'rgba(13,15,10,0.32)',
          'rgba(13,15,10,0.9)',
          'rgba(13,15,10,1)',
        ]}
        locations={[0, 0.3, 0.46, 1]}
        style={[StyleSheet.absoluteFill, styles.nonInteractive]}
      />

      <View style={styles.content}>
        <View style={styles.lockup}>
          <Icon name="cultum-logo" size={48} />
          <View style={styles.wordmark}>
            <Text style={styles.title}>Cultum.app</Text>
            <Text style={styles.tagline}>{TAGLINE}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            size="lg"
            variant="outline"
            label="Continue with Google"
            leftIcon={<Icon name="google" size={24} />}
            onPress={onGooglePress}
            loading={busy}
            disabled={!request || !nonce}
          />
          <Button
            size="lg"
            variant="outline"
            label="Continue with Apple"
            leftIcon={<Icon name="apple" size={24} />}
            onPress={showAppleComingSoon}
          />
          {/* TODO: link the two spans to the real Terms/Privacy URLs via
              WebBrowser.openBrowserAsync once they exist. */}
          <Text style={styles.legal}>
            By continuing you agree to the{' '}
            <Text style={styles.legalLink}>Terms of Use</Text> and{' '}
            <Text style={styles.legalLink}>Privacy Policy</Text>.
          </Text>
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
    root: { flex: 1, backgroundColor: t.background.primary },
    // The mosaic and scrim are decoration — taps fall through to the content.
    nonInteractive: { pointerEvents: 'none' },
    mosaic: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      gap: PHOTO_GAP,
      pointerEvents: 'none',
    },
    column: { flex: 1, gap: PHOTO_GAP },
    // Figma's 14px corner has no step on the foundations radius scale.
    photo: { width: '100%', height: PHOTO_H, borderRadius: radius[16] },
    content: {
      flex: 1,
      paddingHorizontal: space[16],
      paddingTop: insets.top,
      paddingBottom: insets.bottom + space[8],
      gap: space[24],
    },
    lockup: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: space[12] },
    wordmark: { alignSelf: 'stretch', gap: space[16] },
    title: { ...typography.headingLargeEmphasized, color: t.text.primary, textAlign: 'center' },
    tagline: { ...typography.bodyLarge, color: t.text.secondary, textAlign: 'center' },
    actions: { gap: space[12] },
    // Figma's "Caption Emphasized" is Inter Medium; foundations' emphasized
    // caption is bold, so the weight is pinned back to 500 here.
    legal: {
      ...typography.captionEmphasized,
      fontWeight: '500',
      color: t.text.secondary,
      textAlign: 'center',
    },
    legalLink: { textDecorationLine: 'underline' },
    snackHost: {
      position: 'absolute',
      left: space[16],
      right: space[16],
      bottom: insets.bottom + space[16],
      alignItems: 'center',
    },
  });
}
