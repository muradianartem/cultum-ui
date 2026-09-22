// Paywall — Figma "Paywall / Cultum Plus" (file 4jmjNlaM7IRpCOogYRJMks,
// node 250:11): a photo hero that dissolves into the page, the 7-day trial
// timeline, a Free-vs-Plus comparison table, social proof, and a sticky price
// bar. "See all plans" opens <ChoosePlanSheet> (node 265:159).
//
// The copy, the trial timeline, the comparison rows and both products come
// from GET /billing/plans via billing/paywallContent.js. Nothing is bundled, so
// this screen has no prices of its own to fall back on. The end of onboarding,
// Settings → Upgrade and the room-limit gate all navigate here directly, so
// until the content lands the screen draws <PaywallPending>: a Close plus a
// spinner, or an error with Try again.
//
// The rating and the reviews are NOT in that payload and stay local constants;
// there is no endpoint to hunt for.
//
// The CTA buys the selected plan through billing/useStorePurchase: StoreKit 2
// plus POST /billing/apple/verify on iOS. There StoreKit owns the price and the
// trial — the headline, plan rows and CTA read `store.termsFor(product)`, and
// "Start free trial" (and the trial timeline) appear only when StoreKit offers
// a free trial this user is eligible for; otherwise the CTA reads "Subscribe".
// Other platforms have no store flow yet: they keep the backend's fallback
// price, and there the button just closes the screen.

import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  Button,
  ButtonIcon,
  Icon,
  LoadingIndicator,
  NavigationBar,
  State,
} from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { fontFace } from '../theme/fonts';
import { radius, space, stroke, typography } from '../theme/foundations';
import { useRouter } from '../routing';
import { useOnboarding } from '../onboarding';
import { usePaywallResource } from '../billing/paywallContent';
import useStorePurchase from '../billing/useStorePurchase';
import { headline } from '../billing/storeTerms';
import ChoosePlanSheet from './ChoosePlanSheet';

// Figma geometry with no scale step of its own.
const HERO_H = 300;
const CHIP_W = 57;
const COL_W = 64;
// Figma's line is a fixed 120 tall, fitted to exactly three steps. The step
// count is server data now, so it runs chip-centre to chip-centre instead —
// which also survives a step whose body text wraps to an extra line.
const RAIL_LINE = { left: 27.5, top: 44, bottom: 44 };
const PLUS_CORNER = radius[16]; // Figma 14px — nearest step on the radius scale

// Not in GET /billing/plans — the backend has no App Store review data — so
// these stay transcribed from the Figma frame.
// FIXME(App Review 1.1.6/3.1.2): the app has no ratings yet, so this is a made-up
// claim on a purchase screen. Needs an owner decision before submission.
const SOCIAL_PROOF = { rating: '4.8', count: '6.2K ratings' };

/**
 * The line above the CTA from the backend's copy — what platforms without a
 * store flow show. On iOS the headline comes from StoreKit (billing/storeTerms).
 *
 * Exported because it is the one piece of derived copy on this screen worth
 * testing on its own: it is what makes the price follow the plan sheet, which
 * the hardcoded version never did.
 */
export function headlineFor(product) {
  const price = `${product.fallbackPrice} a ${product.period}`;
  return product.trialDays > 0
    ? `${product.trialDays} days free, then ${price}`
    : price;
}

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

/**
 * @param {object} props
 * @param {'onboarding'} [props.source]  set only by the end of onboarding. That
 *   paywall is the last onboarding step, so every way out of it — Close, a
 *   verified purchase — completes onboarding. Any other paywall (Settings, the
 *   room-limit gate) is a detour and leaves onboarding alone.
 */
export default function PaywallScreen({ source } = {}) {
  const { content, status, retry } = usePaywallResource();
  // Hooks cannot be skipped, so the "no content" check has to happen above
  // every other one — hence the split. Reachable before its content lands from
  // every entry point: onboarding, Settings → Upgrade and the room gate.
  if (!content) return <PaywallPending status={status} onRetry={retry} source={source} />;
  return <Paywall content={content} source={source} />;
}

// Same shape as the scan flow's close: pop if there's history, else go home.
// The onboarding paywall was entered through reset(), so it has no history —
// and must not, or closing it could remount the finished add-plant wizard.
function useClose(source) {
  const { back, canGoBack, reset } = useRouter();
  const { complete } = useOnboarding();
  return () => {
    if (source === 'onboarding') {
      complete();
      reset('today');
      return;
    }
    if (canGoBack) back();
    else reset('today');
  };
}

/** The paywall before its content exists: always a way out, never a blank. */
function PaywallPending({ status, onRetry, source }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const onClose = useClose(source);
  return (
    <View style={[pendingStyles.root, { backgroundColor: t.background.primary, paddingTop: insets.top }]}>
      <NavigationBar leading="close" onLeadingPress={onClose} divider={false} />
      <View style={pendingStyles.body}>
        {status === 'error' ? (
          <State
            title="Plans couldn't be loaded"
            subtitle="Check your connection and try again."
            primaryAction={{ label: 'Try again', onPress: onRetry }}
          />
        ) : (
          <LoadingIndicator accessibilityLabel="Loading plans" />
        )}
      </View>
    </View>
  );
}

const pendingStyles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[16] },
});

function Paywall({ content, source }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t, insets), [t, insets]);
  const onClose = useClose(source);

  const [plansOpen, setPlansOpen] = useState(false);
  const [planKey, setPlanKey] = useState(content.defaultProductKey);
  const store = useStorePurchase(content.products);

  // The cache is write-once (billing/paywallContent.js), so `content` cannot
  // change under an open screen and `planKey` cannot go stale. The `??` is the
  // whole insurance that needs; anything more would be guarding a state the
  // app has no way to reach.
  const product =
    content.products.find((p) => p.key === planKey) ?? content.products[0];

  // StoreKit's terms for the selected plan (iOS), or null: not resolved yet, or
  // a platform with no store at all.
  const terms = store.supported ? store.termsFor(product) : null;
  const pricesPending = store.supported && !terms;
  const offersTrial = !store.supported || Boolean(terms?.trial);
  const ctaLabel = offersTrial ? 'Start free trial' : 'Subscribe';

  // iOS: StoreKit sheet → backend verify → new entitlement. The paywall closes
  // only once the backend has confirmed. A cancel leaves it open and silent, and
  // any other failure shows above the button through the hook's `error`.
  const onStartTrial = async () => {
    if (!store.supported) {
      // No store flow on this platform yet, so keep the screen walkable.
      if (__DEV__) {
        console.log('[paywall] start trial (no store flow here) —', product.key, {
          google: product.googleProductId,
        });
      }
      onClose();
      return;
    }
    if (await store.purchase(product)) onClose();
  };

  return (
    <View style={styles.root}>
      {/* The hero photo runs under the status bar in both themes. */}
      <StatusBar style="light" />
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
              // A StoreKit sheet is up; closing under it would orphan the purchase.
              disabled={store.busy}
              onPress={onClose}
            />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{content.titleLines}</Text>

          {offersTrial ? (
            <View style={styles.rail}>
              <View style={styles.railLine} />
              {content.timeline.map((step) => {
                const highlight = step.day === 0;
                return (
                  <View key={step.day} style={styles.step}>
                    <View style={[styles.dayChip, highlight && styles.dayChipActive]}>
                      <Text
                        numberOfLines={1}
                        style={[styles.dayText, highlight && styles.dayTextActive]}
                      >
                        {step.label}
                      </Text>
                    </View>
                    <View style={styles.stepText}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepBody}>{step.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

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

            {content.features.map((feature, i) => (
              <View key={feature.key} style={styles.tableRow} testID="paywall-feature-row">
                <View style={styles.labelCell}>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
                <View style={styles.freeCell}>
                  {feature.free ? <Text style={styles.freeText}>{feature.free}</Text> : null}
                </View>
                <View
                  style={[
                    styles.plusCell,
                    i === content.features.length - 1 && styles.plusCellBottom,
                  ]}
                >
                  {/* A Plus tier that is simply "yes" gets a tick; one with a
                      ceiling of its own ("30 scans a day") has to say so. */}
                  {feature.plus ? (
                    <Text style={styles.plusText}>{feature.plus}</Text>
                  ) : (
                    <View style={styles.tick}>
                      <Icon name="check" size={14} color={t.brand.onPrimary} />
                    </View>
                  )}
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

          <Text style={styles.footnote}>{content.footnote}</Text>
        </View>
      </ScrollView>

      <View style={styles.priceBar}>
        {pricesPending ? (
          <Text style={styles.priceHeadline}>Loading prices…</Text>
        ) : (
          <Text style={styles.priceHeadline}>
            {terms ? headline(terms, product) : headlineFor(product)}
          </Text>
        )}
        {store.error ? <Text style={styles.purchaseError}>{store.error}</Text> : null}
        <Button
          size="lg"
          label={ctaLabel}
          loading={store.busy}
          disabled={pricesPending}
          onPress={onStartTrial}
        />
        <Button
          size="md"
          variant="ghost"
          label="See all plans"
          disabled={store.busy}
          onPress={() => setPlansOpen(true)}
        />
      </View>

      <ChoosePlanSheet
        visible={plansOpen}
        products={content.products}
        termsFor={store.supported ? store.termsFor : undefined}
        initialPlan={planKey}
        onClose={() => setPlansOpen(false)}
        onDone={(next) => {
          setPlanKey(next);
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
    // Figma 306:4764: a raw Literata Bold 30/36 — larger than any Heading.
    title: {
      fontFamily: fontFace('Literata', 700),
      fontSize: 30,
      lineHeight: 36,
      color: t.text.primary,
    },

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
    // Figma 872:21505: raw Inter Medium 11/140%, tracked 0.04em.
    eyebrow: {
      fontFamily: fontFace('Inter', 500),
      fontSize: 11,
      lineHeight: 15.4,
      letterSpacing: 0.44,
      color: t.text.placeholder,
    },
    headerLabelCell: { flex: 1, justifyContent: 'flex-end', paddingBottom: 10 },
    headerFreeCell: { width: COL_W, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
    plusHeaderCell: { paddingVertical: 10, gap: 3 },
    plusEyebrow: {
      fontFamily: fontFace('Inter', 500),
      fontSize: 11,
      lineHeight: 15.4,
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
    // Figma 872:21513: raw Inter 15/140%.
    featureLabel: {
      fontFamily: fontFace('Inter', 400),
      fontSize: 15,
      lineHeight: 21,
      color: t.text.primary,
    },
    freeCell: {
      width: COL_W,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: stroke[1],
      borderTopColor: t.border.primary,
    },
    // Figma 872:21515: raw Inter Medium 12.5/140%.
    freeText: {
      fontFamily: fontFace('Inter', 500),
      fontSize: 12.5,
      lineHeight: 17.5,
      color: t.text.placeholder,
    },
    // The FREE column's metrics on the PLUS column's ink — both tokens already
    // exist on this screen, so the string case adds none.
    plusText: {
      fontFamily: fontFace('Inter', 500),
      fontSize: 12.5,
      lineHeight: 17.5,
      color: t.success.onSecondary,
      textAlign: 'center',
    },
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
    reviewName: { ...typography.captionEmphasized, color: t.text.placeholder },
    footnote: {
      ...typography.captionEmphasized,
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
    // Figma 306:4787: a raw Inter Bold 14/140% — Body Medium Emphasized is
    // Medium, not Bold.
    priceHeadline: {
      fontFamily: fontFace('Inter', 700),
      fontSize: 14,
      lineHeight: 19.6,
      color: t.text.secondary,
      textAlign: 'center',
    },
    purchaseError: {
      ...typography.bodyMedium,
      color: t.error.primary,
      textAlign: 'center',
    },
  });
}
