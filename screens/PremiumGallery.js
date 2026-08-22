import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from '../routing';
import { colors, fonts, radius } from '../theme/tokens';

/**
 * PremiumGallery — the full photo gallery, gated behind a subscription in App.js
 * (<Route guard={requireSubscription}>). Reached from ProductPage's "View All".
 */
const PHOTOS = [
  require('../assets/plant/gallery1.png'),
  require('../assets/plant/gallery2.png'),
  require('../assets/plant/hero.png'),
];

export default function PremiumGallery() {
  const insets = useSafeAreaInsets();
  const { back } = useRouter();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Gallery</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {PHOTOS.map((src, i) => (
          <Image key={i} source={src} style={styles.photo} resizeMode="cover" />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  backPressed: { backgroundColor: colors.surface2 },
  backGlyph: { fontSize: 18, color: colors.ink, lineHeight: 20 },
  title: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.ink },
  grid: { padding: 16, gap: 12 },
  photo: { width: '100%', height: 220, borderRadius: 12 },
});
