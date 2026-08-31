// Paywall — Figma "Paywall / Cultum Plus" (file 4jmjNlaM7IRpCOogYRJMks,
// node 250:11): a photo hero that dissolves into the page, the 7-day trial
// timeline, a Free-vs-Plus comparison table, social proof, and a sticky price
// bar. "See all plans" opens <ChoosePlanSheet> (node 265:159).
//
// Presentation only — there is no IAP dependency in the project yet, so
// `onStartTrial` is a stub. See PRICING below.

import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, ButtonIcon, Icon } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, stroke, typography } from '../theme/foundations';
import { useRouter } from '../routing';
import ChoosePlanSheet from './ChoosePlanSheet';

// Figma geometry with no scale step of its own.
const HERO_H = 300;
const CHIP_W = 57;
const COL_W = 64;
const RAIL_LINE = { left: 27.5, top: 44, height: 120 };
const PLUS_CORNER = radius[16]; // Figma 14px — nearest step on the radius scale

// Copy + numbers are transcribed from the Figma frame. Replace `PRICING` with
// the resolved StoreKit products (and `SOCIAL_PROOF` with real App Store data)
// when in-app purchases are wired up.
const PRICING = { headline: '7 days free, then $39.99 a year' };
const SOCIAL_PROOF = { rating: '4.8', count: '6.2K ratings' };

const TRIAL_STEPS = [
  {
    day: 'Today',
    highlight: true,
    title: 'Full access',
    body: 'Every plan, check and reminder unlocks straight away.',
  },
  {
    day: 'Day 5',
    highlight: false,
    title: 'Reminder',
    body: 'We email you two days before the trial ends.',
  },
  {
    day: 'Day 7',
    highlight: false,
    title: 'Trial ends',
    body: 'Billing starts unless you have cancelled by then.',
  },
];

// `free` is what the FREE column shows; Plus always gets a tick.
const FEATURES = [
  { label: 'Unlimited plants', free: 'Limited' },
  { label: 'Plant identification', free: 'Limited' },
  { label: 'Journal and history', free: 'Limited' },
  { label: 'Discover and care guides', free: 'Limited' },
  { label: 'Rooms and spaces', free: 'Limited' },
  { label: 'Adaptive care reminders', free: null },
  { label: 'Custom reminders', free: null },
  { label: 'Bulk care actions', free: null },
  { label: 'Shared household', free: null },
];

const REVIEWS = [
  {
    title: 'They are all still alive',
    body: 'First winter I have not lost anything. The checks are the part that works.',
    name: 'Rina',
  },
  {
    title: 'Tells me when it is not sure',
    body: 'It says how confident the match is instead of guessing at me. That is rare.',
    name: 'Tomas',
  },
];

const FOOTNOTE =
  'Cancel any time in the App Store. If you cancel before day 7 you are not charged.';

export default function PaywallScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t, insets), [t, insets]);
  const { back, canGoBack, reset } = useRouter();

  const [plansOpen, setPlansOpen] = useState(false);
  const [plan, setPlan] = useState('yearly');

  // Same shape as the scan flow's close: pop if there's history, else go home.
  const onClose = () => (canGoBack ? back() : reset('today'));

  // TODO: hand off to StoreKit once an IAP module is added; today this only
  // closes the paywall so the flow is walkable.
  const onStartTrial = () => {
    if (__DEV__) console.log('[paywall] start trial (stub) — selected plan:', plan);
    onClose();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image
            source={require('../assets/auth/mosaic-01.png')}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            // Figma "Hero scrim" — translucent stops with no token equivalent.
            // The last stop is the page ground rather than Figma's literal
            // white, so the hero dissolves into the body with no seam (and
            // still works if the screen is ever rendered in the dark theme).
            colors={['rgba(13,15,10,0.45)', 'rgba(13,15,10,0.05)', t.background.primary]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroClose}>
            <ButtonIcon
              size="sm"
              variant="outline"
              icon={<Icon name="close" size={16} />}
              accessibilityLabel="Close"
              onPress={onClose}
            />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{'Cultum Plus,\nfree for 7 days'}</Text>

          <View style={styles.rail}>
            <View style={styles.railLine} />
            {TRIAL_STEPS.map((step) => (
              <View key={step.day} style={styles.step}>
                <View style={[styles.dayChip, step.highlight && styles.dayChipActive]}>
                  <Text
                    numberOfLines={1}
                    style={[styles.dayText, step.highlight && styles.dayTextActive]}
                  >
                    {step.day}
                  </Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.headerLabelCell}>
                <Text style={styles.eyebrow}>FEATURES</Text>
              </View>
              <View style={styles.headerFreeCell}>
                <Text style={styles.eyebrow}>FREE</Text>
              </View>
              <View style={[styles.plusCell, styles.plusCellTop, styles.plusHeaderCell]}>
                <Icon name="star-filled" size={13} color={t.success.onSecondary} />
                <Text style={styles.plusEyebrow}>PLUS</Text>
              </View>
            </View>

            {FEATURES.map((feature, i) => (
              <View key={feature.label} style={styles.tableRow} testID="paywall-feature-row">
                <View style={styles.labelCell}>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
                <View style={styles.freeCell}>
                  {feature.free ? <Text style={styles.freeText}>{feature.free}</Text> : null}
                </View>
                <View
                  style={[
                    styles.plusCell,
                    i === FEATURES.length - 1 && styles.plusCellBottom,
                  ]}
                >
                  <View style={styles.tick}>
                    <Icon name="check" size={14} color={t.brand.onPrimary} />
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.rating}>
            <View style={styles.stars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Icon key={i} name="star-filled" size={14} color={t.warning.primary} />
              ))}
            </View>
            <Text style={styles.ratingScore}>{SOCIAL_PROOF.rating}</Text>
            <Text style={styles.ratingCount}>{SOCIAL_PROOF.count}</Text>
          </View>

          <View style={styles.reviews}>
            {REVIEWS.map((review) => (
              <View key={review.name} style={styles.review}>
                <Text style={styles.reviewTitle}>{review.title}</Text>
                <Text style={styles.reviewBody}>{review.body}</Text>
                <Text style={styles.reviewName}>{review.name}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>{FOOTNOTE}</Text>
        </View>
      </ScrollView>

      <View style={styles.priceBar}>
        <Text style={styles.priceHeadline}>{PRICING.headline}</Text>
        <Button size="lg" label="Start free trial" onPress={onStartTrial} />
        <Button
          size="md"
          variant="ghost"
          label="See all plans"
          onPress={() => setPlansOpen(true)}
        />
      </View>

      <ChoosePlanSheet
        visible={plansOpen}
        initialPlan={plan}
        onClose={() => setPlansOpen(false)}
        onDone={(next) => {
          setPlan(next);
          setPlansOpen(false);
        }}
      />
    </View>
  );
}

function makeStyles(t, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: space[8] },

    hero: { height: HERO_H, overflow: 'hidden', backgroundColor: t.surface.primary },
    heroClose: { position: 'absolute', left: space[16], top: insets.top + space[8] },

    body: {
      // Opaque: the hero scrim resolves to solid white at its last stop, so the
      // page has to continue that ground rather than let the photo show through.
      backgroundColor: t.background.primary,
      paddingTop: space[4],
      paddingHorizontal: space[16],
      paddingBottom: space[24],
      gap: 28,
    },
    title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: t.text.primary },

    // ---- trial rail ----
    rail: { gap: 18 },
    railLine: {
      position: 'absolute',
      pointerEvents: 'none',
      width: stroke[1],
      backgroundColor: t.border.primary,
      ...RAIL_LINE,
    },
    step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    dayChip: {
      width: CHIP_W,
      paddingVertical: space[12],
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius[12],
      backgroundColor: t.surface.primary,
    },
    dayChipActive: { height: 44, paddingVertical: 0, backgroundColor: t.brand.primary },
    dayText: { ...typography.buttonSmall, color: t.text.secondary },
    dayTextActive: { color: t.brand.onPrimary },
    stepText: { flex: 1, gap: space[2] },
    stepTitle: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    stepBody: { ...typography.bodyMedium, color: t.text.secondary },

    // ---- free vs plus table ----
    table: {},
    tableRow: { flexDirection: 'row', alignItems: 'stretch' },
    eyebrow: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '500',
      letterSpacing: 0.44, // Figma 0.04em
      color: t.text.placeholder,
    },
    headerLabelCell: { flex: 1, justifyContent: 'flex-end', paddingBottom: 10 },
    headerFreeCell: { width: COL_W, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
    plusHeaderCell: { paddingVertical: 10, gap: 3 },
    plusEyebrow: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '500',
      letterSpacing: 0.44,
      color: t.success.onSecondary,
    },
    labelCell: {
      flex: 1,
      paddingTop: 14,
      paddingBottom: 14,
      paddingRight: space[8],
      borderTopWidth: stroke[1],
      borderTopColor: t.border.primary,
    },
    featureLabel: { fontSize: 15, lineHeight: 21, color: t.text.primary },
    freeCell: {
      width: COL_W,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: stroke[1],
      borderTopColor: t.border.primary,
    },
    freeText: { fontSize: 12.5, lineHeight: 18, fontWeight: '500', color: t.text.placeholder },
    plusCell: {
      width: COL_W,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.success.secondary,
    },
    plusCellTop: { borderTopLeftRadius: PLUS_CORNER, borderTopRightRadius: PLUS_CORNER },
    plusCellBottom: { borderBottomLeftRadius: PLUS_CORNER, borderBottomRightRadius: PLUS_CORNER },
    tick: {
      width: 24,
      height: 24,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brand.primary,
    },

    // ---- social proof ----
    rating: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    stars: { flexDirection: 'row', gap: 3 },
    ratingScore: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    ratingCount: { ...typography.bodyMedium, color: t.text.placeholder },
    reviews: { gap: 10 },
    review: {
      paddingVertical: 15,
      paddingHorizontal: space[16],
      borderRadius: radius[16],
      backgroundColor: t.surface.primary,
      gap: 6,
    },
    reviewTitle: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    reviewBody: { ...typography.bodyMedium, color: t.text.secondary },
    // Figma's Caption Emphasized is Inter Medium; foundations' is bold.
    reviewName: { ...typography.captionEmphasized, fontWeight: '500', color: t.text.placeholder },
    footnote: {
      ...typography.captionEmphasized,
      fontWeight: '500',
      color: t.text.placeholder,
      textAlign: 'center',
    },

    // ---- sticky price bar ----
    priceBar: {
      backgroundColor: t.background.primary,
      paddingTop: 14,
      paddingHorizontal: space[16],
      paddingBottom: insets.bottom + 10,
      gap: 10,
    },
    priceHeadline: {
      ...typography.bodyMediumEmphasized,
      color: t.text.secondary,
      textAlign: 'center',
    },
  });
}
