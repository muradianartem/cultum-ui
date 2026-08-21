import { useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, List, ListItem } from '../components';
import { colors, fonts, radius } from '../theme/tokens';

const HERO = require('../assets/plant/hero.png');
const GALLERY = [
  require('../assets/plant/gallery1.png'),
  require('../assets/plant/gallery2.png'),
];

const CARE_FACTS = [
  { icon: '💧', label: 'Water', value: 'Every 7–10 days' },
  { icon: '☀️', label: 'Sun', value: 'Bright, indirect' },
  { icon: '🌡️', label: 'Temperature', value: '18–27℃ / 64–81℉' },
  { icon: '☁️', label: 'Humidity', value: 'Average home is fine' },
];

const FAQ = [
  {
    q: 'Is it safe around pets?',
    a: 'No. Monstera is toxic to cats and dogs if chewed — keep it out of their reach.',
  },
  { q: 'How often should I water it?' },
  { q: 'Where should it live?' },
  { q: 'What should I watch for?' },
  { q: 'How fast does it grow?' },
];

// Circular translucent nav button floating over the hero image.
function NavButton({ glyph, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
    >
      <Text style={styles.navGlyph}>{glyph}</Text>
    </Pressable>
  );
}

// One tile of the care grid: icon over a bold label over a caption value.
function CareFact({ icon, label, value }) {
  return (
    <View style={styles.careFact}>
      <Text style={styles.careIcon}>{icon}</Text>
      <Text style={styles.careLabel}>{label}</Text>
      <Text style={styles.careValue}>{value}</Text>
    </View>
  );
}

// A single expand/collapse FAQ row.
function AccordionItem({ question, answer, open, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={!answer}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={styles.accItem}
    >
      <View style={styles.accText}>
        <Text style={styles.accQuestion}>{question}</Text>
        {open && answer ? <Text style={styles.accAnswer}>{answer}</Text> : null}
      </View>
      <Text style={styles.accChevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
  );
}

export default function ProductPage() {
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <ImageBackground source={HERO} style={styles.hero} resizeMode="cover">
          <View style={styles.heroScrim} pointerEvents="none" />

          <View style={[styles.navRow, { top: insets.top + 8 }]}>
            <NavButton glyph="‹" label="Back" onPress={() => { }} />
            <NavButton glyph="🔖" label="Save" onPress={() => { }} />
          </View>

          <View style={styles.heroText}>
            <View style={styles.chips}>
              <Badge
                label="Easy"
                intent="positive"
                variant="secondary"
                leftIcon={<Text style={styles.badgeIcon}>🌿</Text>}
              />
              <Badge
                label="Toxic"
                intent="negative"
                variant="secondary"
                leftIcon={<Text style={styles.badgeIcon}>🐾</Text>}
              />
            </View>
            <Text style={styles.heroTitle}>Swiss cheese plant</Text>
            <Text style={styles.heroSubtitle}>Monstera deliciosa</Text>
          </View>
        </ImageBackground>

        {/* ── Content ──────────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Owned banner */}
          <List variant="card">
            <ListItem
              before={
                <View style={styles.ownedIcon}>
                  <Text style={styles.ownedCheck}>✓</Text>
                </View>
              }
              title="You already have one"
              subtitle="Kitchen Monstera · Kitchen"
              after={<Text style={styles.chevronRight}>›</Text>}
              onPress={() => { }}
            />
          </List>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.bodyText}>
              The split leaves are a grown-up trait: young plants only start
              fenestrating with enough light and something to climb.
            </Text>
          </View>

          {/* How to care */}
          <View style={styles.section}>
            <Text style={styles.heading}>How to care</Text>
            <View style={styles.careGrid}>
              <View style={styles.careRow}>
                <CareFact {...CARE_FACTS[0]} />
                <CareFact {...CARE_FACTS[1]} />
              </View>
              <View style={styles.careRow}>
                <CareFact {...CARE_FACTS[2]} />
                <CareFact {...CARE_FACTS[3]} />
              </View>
            </View>
          </View>

          {/* Gallery */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.heading}>Gallery</Text>
              <Pressable accessibilityRole="button" onPress={() => { }}>
                <Text style={styles.viewAll}>View All</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryScroller}
            >
              {GALLERY.map((src, i) => (
                <ImageBackground
                  key={i}
                  source={src}
                  style={styles.galleryImage}
                  imageStyle={styles.galleryImageRadius}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>

          {/* FAQ */}
          <View style={styles.section}>
            <Text style={styles.heading}>FAQ</Text>
            <View style={styles.accordionList}>
              {FAQ.map((item, i) => (
                <View key={i} style={styles.accordion}>
                  <AccordionItem
                    question={item.q}
                    answer={item.a}
                    open={openFaq === i}
                    onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky CTA ─────────────────────────────────────────── */}
      <View style={[styles.cta, { paddingBottom: 16 + insets.bottom }]}>
        <Button
          label="Add to my plants"
          size="lg"
          onPress={() => { }}
          leftIcon={<Text style={styles.addGlyph}>＋</Text>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },

  // ── Hero ──
  hero: {
    height: 353,
    paddingHorizontal: 16,
    paddingBottom: 25,
    justifyContent: 'flex-end',
    backgroundColor: colors.brandDark,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    // Figma bottom-up scrim so the light text stays legible over the photo.
    backgroundColor: 'rgba(21,23,20,0.28)',
  },
  navRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,250,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250,250,250,0.6)',
  },
  navBtnPressed: { backgroundColor: 'rgba(250,250,250,0.34)' },
  navGlyph: { color: colors.white, fontSize: 18, lineHeight: 20 },
  heroText: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeIcon: { fontSize: 12 },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.paper,
  },
  heroSubtitle: { fontSize: 16, lineHeight: 22, color: '#DADBDA' },

  // ── Content ──
  content: { padding: 16, paddingTop: 24, gap: 32 },
  section: { gap: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: '#151515',
  },
  bodyText: { fontSize: 14, lineHeight: 20, color: '#404140' },
  viewAll: { fontSize: 14, fontWeight: '500', color: '#151515' },

  // Owned banner
  ownedIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownedCheck: { fontSize: 18, color: colors.greenInk, fontWeight: '700' },
  chevronRight: { fontSize: 22, color: '#151515' },

  // ── Care grid ──
  careGrid: { gap: 12 },
  careRow: { flexDirection: 'row', gap: 12 },
  careFact: {
    flex: 1,
    padding: 12,
    gap: 8,
    borderRadius: radius.card,
    backgroundColor: '#ECEDEC',
  },
  careIcon: { fontSize: 22 },
  careLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#151515' },
  careValue: { fontSize: 12, lineHeight: 16, color: '#404140' },

  // ── Gallery ──
  galleryScroller: { gap: 12 },
  galleryImage: { width: 264, height: 184 },
  galleryImageRadius: { borderRadius: 12 },

  // ── FAQ accordion ──
  accordionList: { gap: 8 },
  accordion: {
    backgroundColor: '#ECEDEC',
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  accItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  accText: { flex: 1, gap: 4 },
  accQuestion: { fontSize: 16, lineHeight: 22, color: '#151515' },
  accAnswer: { fontSize: 14, lineHeight: 20, color: '#404140' },
  accChevron: { fontSize: 16, color: '#151515', width: 24, textAlign: 'center' },

  // ── CTA ──
  cta: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  addGlyph: { fontSize: 18, color: colors.greenInk, fontWeight: '600' },
});
