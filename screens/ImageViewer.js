import { useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from '../routing';
import { PHOTOS, PLANT } from './plantData';
import { badge, colors, radius } from '../theme/tokens';

/**
 * ⚠️ V2 — not wired into the V1 flow. The `image-viewer` route in App.js and the
 * gallery-thumbnail navigation in ProductPage.js are commented out; re-enable
 * both to ship this. Kept here so the screen is ready to drop in.
 *
 * ImageViewer — the full-screen photo pager (Figma "Product Page / View Image").
 *
 * A horizontal, paged ScrollView of the plant's photos with a floating close
 * button, the "View All" title + plant name, and a "n / total" counter pill.
 * Opened by tapping a gallery thumbnail on the product page; `params.index`
 * picks the starting photo.
 */
const { width } = Dimensions.get('window');

export default function ImageViewer() {
  const insets = useSafeAreaInsets();
  const { back, params } = useRouter();
  const start = Math.min(Math.max(params?.index ?? 0, 0), PHOTOS.length - 1);
  const [page, setPage] = useState(start);

  return (
    <View style={styles.screen}>
      {/* Paged photo strip, centred vertically. */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: start * width, y: 0 }}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={styles.pager}
      >
        {PHOTOS.map((src, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <Image source={src} style={styles.photo} resizeMode="contain" />
          </View>
        ))}
      </ScrollView>

      {/* Header: close + title/subtitle, floating over the photo. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closePressed]}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>View All</Text>
          <Text style={styles.subtitle}>{PLANT.commonName}</Text>
        </View>
        {/* Spacer keeps the title centred opposite the close button. */}
        <View style={styles.closeBtn} />
      </View>

      {/* Counter pill. */}
      <View style={[styles.counterRow, { bottom: insets.bottom + 24 }]}>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {page + 1} / {PHOTOS.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  pager: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '70%' },

  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { backgroundColor: colors.surface2 },
  closeGlyph: { fontSize: 18, color: colors.ink, lineHeight: 20 },
  headerText: { flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.ink3 },

  counterRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  counter: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: badge.neutral.soft,
  },
  counterText: { fontSize: 12, color: badge.neutral.softInk },
});
