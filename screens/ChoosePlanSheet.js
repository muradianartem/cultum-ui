// "Choose a plan" sheet — Figma node 265:159 (file 4jmjNlaM7IRpCOogYRJMks),
// reached from the paywall's "See all plans".
//
// A thin composition over <BottomSheet>: the primitive already owns the grabber,
// backdrop-dismiss, slide-in and the green primary action. Only the surface
// colour/radius (Figma gives this sheet #FAFAFA + a 24px top radius, vs. the
// primitive's default) and the plan rows are specific to this screen.
//
// The plans come in as `products` — the mapped GET /billing/plans payload the
// paywall is already holding — so the sheet owns no pricing of its own. On iOS
// `termsFor` supplies StoreKit's localized price, which wins over the backend's
// `fallbackPrice` once StoreKit has resolved the SKU.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, BottomSheet } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { fontFace } from '../theme/fonts';
import { radius, space, stroke, typography } from '../theme/foundations';

/**
 * The line under a plan's name.
 *
 * Keyed off `period`, not off arithmetic on `fallbackPrice`. Figma's copy here
 * was "$3.33 a month, billed yearly", but dividing the yearly price by twelve
 * would make the sheet lie the moment pricing changes in App Store Connect —
 * and `fallback_price` is not the price most storefronts show anyway. The
 * value story survives through the API's own `badge: "Best value"`.
 *
 * The right fix is a `detail` string on PaywallProduct: one Pydantic field, and
 * this function goes away.
 */
export function detailFor(product) {
  return product.period === 'year' ? 'Billed yearly, cancel any time' : 'Cancel any time';
}

export default function ChoosePlanSheet({ visible, products, termsFor, onClose, onDone, initialPlan }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [selected, setSelected] = useState(initialPlan ?? products[0]?.key);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      showClose={false}
      sheetStyle={styles.sheet}
      bodyStyle={styles.body}
      primaryAction={{ label: 'Done', onPress: () => onDone?.(selected) }}
      testID="choose-plan-sheet"
    >
      {/* Rendered here rather than via BottomSheet's `title`: the primitive's
          title is Inter, and Figma sets this heading in Literata (Heading
          Extra Small Emphasized, node 265:161). */}
      <Text style={styles.heading}>Choose a plan</Text>

      <View style={styles.plans}>
        {products.map((plan) => {
          const isSelected = plan.key === selected;
          const period = `per ${plan.period}`;
          const price = termsFor?.(plan)?.displayPrice || plan.fallbackPrice;
          return (
            <Pressable
              key={plan.key}
              onPress={() => setSelected(plan.key)}
              accessibilityRole="radio"
              // role=radio reads `checked`, not `selected` (it is what maps to
              // aria-checked on web and to the trait natively).
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${plan.label}, ${price} ${period}`}
              style={[styles.plan, isSelected && styles.planSelected]}
              testID={`plan-${plan.key}`}
            >
              <View style={styles.planLabel}>
                <View style={styles.planName}>
                  <Text style={styles.planNameText}>{plan.label}</Text>
                  {plan.badge ? (
                    <Badge label={plan.badge} intent="neutral" variant="primary" size="lg" />
                  ) : null}
                </View>
                <Text style={styles.planDetail}>{detailFor(plan)}</Text>
              </View>

              <View style={styles.planPrice}>
                {/* StoreKit's localized price on iOS. Elsewhere the *fallback*
                    price — right in a USD storefront and nowhere else, until
                    Play Billing lands. */}
                <Text style={styles.planPriceText}>{price}</Text>
                <Text style={styles.planPeriod}>{period}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: t.background.primary,
      borderTopLeftRadius: radius[24],
      borderTopRightRadius: radius[24],
    },
    body: { paddingTop: space[8], paddingBottom: space[24], gap: space[16] },
    heading: {
      ...typography.headingExtraSmallEmphasized,
      color: t.text.primary,
      textAlign: 'center',
      paddingHorizontal: space[16],
    },
    plans: { paddingHorizontal: space[16], gap: 10 },
    plan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[12],
      paddingVertical: 15,
      paddingHorizontal: space[16],
      borderRadius: radius[16],
      backgroundColor: t.surface.primary,
      // Reserve the selected ring's width so selection doesn't reflow the row.
      borderWidth: stroke[2],
      borderColor: 'transparent',
    },
    planSelected: { borderColor: t.text.primary },
    planLabel: { flex: 1, gap: 3 },
    planName: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    planNameText: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    planDetail: { ...typography.bodyMedium, color: t.text.secondary },
    planPrice: { alignItems: 'flex-end', gap: 1 },
    // Figma's amount is a raw Inter Bold 17/140% (node 299:477), not a named style.
    planPriceText: {
      fontFamily: fontFace('Inter', 700),
      fontSize: 17,
      lineHeight: 23.8,
      color: t.text.primary,
    },
    planPeriod: {
      ...typography.captionEmphasized,
      color: t.text.secondary,
    },
  });
}
