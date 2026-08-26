import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components';
import { useRouter } from '../routing';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, stroke, typography } from '../theme/foundations';

/**
 * PremiumGallery — the full photo gallery, gated behind a subscription in App.js
 * (<Route guard={requireSubscription}>). Reached from ProductPage's "View All".
 *
 * Colours come from the semantic token layer via useTheme() (so the screen
 * follows light/dark); geometry and type come from the Figma foundation scales.
 */
const PHOTOS = [
  require('../assets/plant/gallery1.png'),
  require('../assets/plant/gallery2.png'),
  require('../assets/plant/hero.png'),
];

export default function PremiumGallery() {
  const insets = useSafeAreaInsets();
  const { back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space[8] }]}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
        >
          <Icon name="chevron-left" size={20} color={t.text.primary} />
        </Pressable>
        <Text style={styles.title}>Gallery</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + space[24] }]}
        showsVerticalScrollIndicator={false}
      >
        {PHOTOS.map((src, i) => (
          <Image key={i} source={src} style={styles.photo} resizeMode="cover" />
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[12],
      paddingHorizontal: space[16],
      paddingBottom: space[8],
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: stroke[1],
      borderColor: t.border.tertiary,
    },
    backPressed: { backgroundColor: t.surface.secondary },
    title: { ...typography.headingSmallEmphasized, color: t.text.primary },
    grid: { padding: space[16], gap: space[12] },
    photo: { width: '100%', height: 220, borderRadius: radius[12] },
  });
