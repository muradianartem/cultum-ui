import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isLoaded, loadAsync } from 'expo-font';
import { FONT_FACES } from './fonts';
import { useTheme } from './ThemeProvider';

const allLoaded = () => Object.keys(FONT_FACES).every((face) => isLoaded(face));

/**
 * Holds the app back until every face in theme/fonts.js is registered.
 *
 * Every text style names a face by alias ('Inter_500Medium', …). Rendering
 * before those are loaded draws the first screen in the system font and then
 * reflows it, so nothing mounts until they are.
 *
 * A failed load is shown, with a retry, rather than waved through: the app in
 * a fallback face is not the design, and a silent fallback would hide that.
 *
 * This sits inside <ThemeProvider> so its two holding screens match the theme,
 * and changing the theme only re-renders it — the children are never unmounted
 * once loaded, so the router's state survives.
 */
export default function FontGate({ children }) {
  const t = useTheme();
  const [status, setStatus] = useState(() => (allLoaded() ? 'ready' : 'loading'));

  const load = useCallback(() => {
    setStatus('loading');
    loadAsync(FONT_FACES).then(
      () => setStatus('ready'),
      (error) => {
        if (__DEV__) console.warn('[fonts] failed to load', error);
        setStatus('error');
      }
    );
  }, []);

  useEffect(() => {
    if (status === 'loading') load();
    // Only on mount: a retry calls load() itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'ready') return children;

  return (
    <View style={[styles.fill, { backgroundColor: t.background.primary }]}>
      {status === 'error' ? (
        // No custom face is available here by definition, so these two use the
        // platform font on purpose.
        <>
          <Text style={[styles.message, { color: t.text.primary }]}>
            Cultum couldn’t finish loading.
          </Text>
          <Pressable
            onPress={load}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: t.brand.primary }]}
          >
            <Text style={[styles.retryLabel, { color: t.brand.onPrimary }]}>Try again</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  message: { fontSize: 16, textAlign: 'center' },
  retry: { height: 48, paddingHorizontal: 16, borderRadius: 9999, justifyContent: 'center' },
  retryLabel: { fontSize: 16 },
});
