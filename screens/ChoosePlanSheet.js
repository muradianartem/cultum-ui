// "Choose a plan" sheet — Figma node 265:159 (file 4jmjNlaM7IRpCOogYRJMks),
// reached from the paywall's "See all plans".
//
// A thin composition over <BottomSheet>: the primitive already owns the grabber,
// backdrop-dismiss, slide-in and the green primary action. Only the surface
// colour/radius (Figma gives this sheet #FAFAFA + a 24px top radius, vs. the
// primitive's default) and the plan rows are specific to this screen.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, BottomSheet } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, stroke, typography } from '../theme/foundations';

// Figma copy. Real values must come from the StoreKit products once IAP lands —
// see the same note on PRICING in PaywallScreen.js.
export const PLANS = [
  {
    id: 'yearly',
    name: 'Yearly',
    badge: 'Best value',
    detail: '$3.33 a month, billed yearly',
    price: '$39.99',
    period: 'per year',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    badge: null,
    detail: 'Cancel any time',
    price: '$5.99',
    period: 'per month',
  },
];

export default function ChoosePlanSheet({ visible, onClose, onDone, initialPlan = 'yearly' }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [selected, setSelected] = useState(initialPlan);

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
          title is 18px and Figma sets this heading at 22. */}
      <Text style={styles.heading}>Choose a plan</Text>

      <View style={styles.plans}>
        {PLANS.map((plan) => {
          const isSelected = plan.id === selected;
          return (
            <Pressable
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              accessibilityRole="radio"
              // role=radio reads `checked`, not `selected` (it is what maps to
              // aria-checked on web and to the trait natively).
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${plan.name}, ${plan.price} ${plan.period}`}
              style={[styles.plan, isSelected && styles.planSelected]}
              testID={`plan-${plan.id}`}
            >
              <View style={styles.planLabel}>
                <View style={styles.planName}>
                  <Text style={styles.planNameText}>{plan.name}</Text>
                  {plan.badge ? (
                    <Badge label={plan.badge} intent="neutral" variant="primary" size="lg" />
                  ) : null}
                </View>
                <Text style={styles.planDetail}>{plan.detail}</Text>
              </View>

              <View style={styles.planPrice}>
                <Text style={styles.planPriceText}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
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
      fontSize: 22,
      lineHeight: 29, // Figma 1.3em
      fontWeight: '700',
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
    planPriceText: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: t.text.primary },
    planPeriod: {
      ...typography.captionEmphasized,
      fontWeight: '500', // Figma's Caption Emphasized is Inter Medium
      color: t.text.secondary,
    },
  });
}
