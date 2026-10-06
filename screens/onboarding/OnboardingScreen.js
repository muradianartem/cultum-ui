// OnboardingScreen — the four onboarding screens after sign-in (Figma section
// "Onboarding", node 268:554):
//
//   0 Scan a plant          (772:21068)  → Next
//   1 Add your plant        (772:20998)  → Next
//   2 Get notified          (772:20967)  → Continue (asks for notifications)
//   3 Add your first plant  (772:20947)  → Scan a plant / Search by name
//
// One route, four steps, like the add-plant wizard. The step lives in
// <OnboardingProvider> rather than here, so leaving for the camera and coming
// back — which unmounts this screen — lands on the same step, and so does a
// relaunch.
//
// Navigation (product defaults; the prototype does not define these links):
//   • Back steps backwards; the first screen has none — it must not read as
//     "sign out".
//   • Skip on an intro jumps to "Add your first plant" without asking for
//     notifications; Skip there goes to the paywall without adding a plant.
//   • Scan / Search hand over to the existing scan flow, with the provider
//     remembering that the plant it produces is the onboarding one.

import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  ButtonIcon,
  Icon,
  LoadingIndicator,
  StateIcon,
  STATE_ICON_GLYPH,
} from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/foundations';
import { usePrefs } from '../../prefs';
import { ONBOARDING_PAYWALL, useOnboarding } from '../../onboarding';
import { ENTRY_STEP, STEP_COUNT } from '../../onboarding/storage';
import { ONBOARDING_STEPS } from './onboardingData';

// Figma geometry with no scale step of its own.
const ILLUSTRATION_H = 272;
const BAR_W = 40;
const BAR_H = 4;
const NAV_H = 56;

/** Figma "Step Progress" (775:107): bars fill up to and including the current step. */
function StepProgress({ step, styles }) {
  return (
    <View
      style={styles.progress}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${STEP_COUNT}`}
      accessibilityValue={{ min: 1, max: STEP_COUNT, now: step + 1 }}
    >
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <View key={i} style={[styles.bar, i <= step && styles.barDone]} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(t);
  const { navigate, reset } = useRouter();
  const { setNotificationsEnabled } = usePrefs();
  const onboarding = useOnboarding();
  const { stage, resuming, returnToEntry } = onboarding;

  // Back here from scan/search (search's own Back pops onto this route): the
  // acquisition was abandoned, so this is the entry screen again.
  useEffect(() => {
    if (stage === 'add-plant' && !resuming) returnToEntry();
  }, [stage, resuming, returnToEntry]);

  // The permission prompt is async and a second tap must not raise it twice.
  const asking = useRef(false);
  const [askingState, setAskingState] = useState(false);

  // A checkpoint from a previous launch is still being settled
  // (onboarding/OnboardingNavigator.js), or the paywall is about to take over.
  if (resuming || stage === 'paywall' || stage === 'complete') {
    return (
      <View style={[styles.screen, styles.center]}>
        <LoadingIndicator />
      </View>
    );
  }

  const step = stage === 'add-plant' ? ENTRY_STEP : onboarding.step;
  const content = ONBOARDING_STEPS[step];
  const isEntry = step === ENTRY_STEP;

  const next = () => onboarding.setStep(step + 1);

  const skip = () => {
    if (isEntry) {
      onboarding.beginPaywall();
      reset('paywall', ONBOARDING_PAYWALL);
    } else {
      onboarding.setStep(ENTRY_STEP);
    }
  };

  // Continue on "Get notified": ask through the same preference the Settings
  // switch uses, then move on whatever the answer — a "no" is an answer, and
  // an unexpected error must not leave the user stuck on this screen.
  const allowNotifications = async () => {
    if (asking.current) return;
    asking.current = true;
    setAskingState(true);
    try {
      await setNotificationsEnabled(true);
    } catch (e) {
      console.warn('[onboarding] notification permission failed:', e?.message ?? e);
    } finally {
      asking.current = false;
      setAskingState(false);
      onboarding.setStep(ENTRY_STEP);
    }
  };

  const acquire = (route) => {
    onboarding.beginPlant();
    navigate(route);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <StepProgress step={step} styles={styles} />
        {step > 0 ? (
          <ButtonIcon
            variant="secondary"
            size="md"
            icon={<Icon name="chevron-left" size={24} color={t.brand.onSecondary} />}
            accessibilityLabel="Back"
            onPress={() => onboarding.setStep(step - 1)}
            style={styles.back}
          />
        ) : null}
        <Button
          label="Skip"
          variant="secondary"
          size="sm"
          fullWidth={false}
          onPress={skip}
          style={styles.skip}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isEntry && styles.contentCentered]}
        showsVerticalScrollIndicator={false}
      >
        {content.illustration ? (
          <Image
            source={content.illustration}
            style={styles.illustration}
            resizeMode="cover"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : (
          <StateIcon size="lg" style={styles.entryIcon}>
            <Icon name="outlined-scan" size={STATE_ICON_GLYPH.lg} color={t.brand.onPrimary} />
          </StateIcon>
        )}
        <View style={styles.text}>
          <Text style={styles.title} accessibilityRole="header">
            {content.title}
          </Text>
          <Text style={styles.body}>{content.body}</Text>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: space[16] + insets.bottom }]}>
        {isEntry ? (
          <>
            <Button
              label={content.cta}
              size="lg"
              leftIcon={<Icon name="outlined-scan" size={24} color={t.brand.onPrimary} />}
              onPress={() => acquire('scan-camera')}
            />
            <Button
              label={content.secondaryCta}
              variant="secondary"
              size="lg"
              leftIcon={<Icon name="search" size={24} color={t.brand.onSecondary} />}
              onPress={() => acquire('scan-search')}
            />
          </>
        ) : (
          <Button
            label={content.cta}
            size="lg"
            loading={askingState}
            onPress={content.id === 'notifications' ? allowNotifications : next}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    center: { alignItems: 'center', justifyContent: 'center' },

    // Figma "Navigation Bar": progress centred, Back and Skip floated over it.
    nav: {
      height: NAV_H,
      paddingHorizontal: space[16],
      paddingVertical: space[8],
      alignItems: 'center',
      justifyContent: 'center',
    },
    progress: { flexDirection: 'row', gap: space[4] },
    bar: {
      width: BAR_W,
      height: BAR_H,
      borderRadius: radius.full,
      backgroundColor: t.surface.secondary,
    },
    barDone: { backgroundColor: t.brand.primary },
    back: { position: 'absolute', left: space[16], top: space[8] },
    skip: { position: 'absolute', right: space[16], top: space[8] },

    // Scrolls rather than clips, so the text survives a small phone or a large
    // Dynamic Type size while the actions stay pinned and reachable.
    scroll: { flex: 1 },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: space[16],
      paddingVertical: space[16],
      gap: space[20],
    },
    contentCentered: { alignItems: 'center' },
    illustration: {
      width: '100%',
      height: ILLUSTRATION_H,
      borderRadius: radius[24],
    },
    // Figma "State Icon Item", Type=Primary — the green variant.
    entryIcon: { backgroundColor: t.brand.primary },
    text: { alignSelf: 'stretch', gap: space[12] },
    title: { ...typography.headingLarge, color: t.text.primary, textAlign: 'center' },
    body: { ...typography.bodyLarge, color: t.text.secondary, textAlign: 'center' },

    actions: {
      paddingTop: space[8],
      paddingHorizontal: space[16],
      gap: space[12],
    },
  });
