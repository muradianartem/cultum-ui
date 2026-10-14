// "Your free trial has ended" (Figma "Trial end / Trial ended", 987:29711): the
// one notice a lapse gets. Opened over Today by billing/PlanLapseLauncher.js,
// once per lapse.
//
// Nothing is taken away here — the plants all stay. What changes is reminders:
// the free plan keeps them for `limits.plants` plants, so a bigger garden is
// asked which plant (PickFreePlantSheet). "Upgrade to Plus" leaves the notice
// unanswered on purpose: closing the paywall comes back here, and a user who
// leaves the app from the paywall is asked again next launch.

import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, State } from '../components';
import { useRouter } from '../routing';
import { useEntitlement } from '../billing/EntitlementProvider';
import { useUpgrade } from '../billing/useUpgrade';
import { needsFreePlantPick, planLapse } from '../billing/lapse';
import { acknowledgeLapse } from '../lib/planLapseAck';
import { chooseFreePlant } from '../api/account';
import { planPreview } from '../billing/planPreview';
import { useGarden } from '../store/GardenProvider';
import { showError } from '../lib/showError';
import { useTheme } from '../theme/ThemeProvider';
import { space, typography } from '../theme/foundations';
import PickFreePlantSheet from './PickFreePlantSheet';

export function planEndedTitle(kind) {
  return kind === 'plus' ? 'Your Cultum Plus subscription has ended' : 'Your free trial has ended';
}

export function planEndedSubtitle(plantCount, freePlants) {
  if (plantCount <= 0) return 'You can keep using Cultum on the free plan.';
  if (plantCount <= freePlants) {
    return plantCount === 1
      ? 'Your plant is safe, and its reminders stay on.'
      : `Your ${plantCount} plants are safe, and their reminders stay on.`;
  }
  const covered = freePlants === 1 ? '1 plant gets' : `${freePlants} plants get`;
  return `Your ${plantCount} plants are safe. On the free plan, ${covered} reminders.`;
}

export default function PlanEndedScreen({ kind: kindParam, lapseKey }) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { back, canGoBack, reset } = useRouter();
  const entitlement = useEntitlement();
  const garden = useGarden();
  const openPaywall = useUpgrade();
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const lapse = planLapse(entitlement);
  const kind = lapse?.kind ?? kindParam ?? 'trial';
  const key = lapse?.key ?? lapseKey;
  const freePlants = Number.isFinite(entitlement.limits?.plants) ? entitlement.limits.plants : 1;

  const leave = () => {
    acknowledgeLapse(key);
    if (canGoBack) back();
    else reset('today');
  };

  const onContinue = () => {
    if (needsFreePlantPick(entitlement)) setPicking(true);
    else leave();
  };

  const onSave = async (plantId) => {
    // A preview's entitlement is made up; there is nothing on the server to pick.
    if (planPreview()) {
      setPicking(false);
      leave();
      return;
    }
    setSaving(true);
    try {
      await chooseFreePlant(plantId);
    } catch (e) {
      // 409: picked already, from another device — the server's pick stands.
      if (e?.status !== 409) {
        setSaving(false);
        showError(e, 'Couldn’t save your free plant');
        return;
      }
    }
    // The pick changes which reminders are paused (the garden) and whether to
    // ask again (the entitlement); both are the server's to say.
    await Promise.all([entitlement.refresh(), garden.refresh()]);
    setSaving(false);
    setPicking(false);
    leave();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="plan-ended-screen">
      <View style={styles.content}>
        <State
          icon={<Icon name="power" size={24} color={t.brand.onPrimary} />}
          title={planEndedTitle(kind)}
          titleStyle={styles.title}
          subtitle={planEndedSubtitle(garden.plants.length, freePlants)}
          style={styles.state}
        />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space[16] }]}>
        <Button
          variant="primary"
          size="lg"
          label="Upgrade to Plus"
          leftIcon={<Icon name="power" size={20} color={t.brand.onPrimary} />}
          onPress={() => openPaywall('plan_ended')}
        />
        <Button variant="secondary" size="lg" label="Continue with free plan" onPress={onContinue} />
      </View>

      <PickFreePlantSheet
        visible={picking}
        plants={garden.plants}
        roomName={(id) => (id ? garden.getRoom(id)?.name ?? null : null)}
        selectedId={entitlement.freePlantId}
        saving={saving}
        onClose={() => setPicking(false)}
        onSave={onSave}
      />
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    // Figma "Content": 24px gutters, the State centred in what is left.
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: space[24] },
    state: { width: '100%' },
    title: typography.headingSmallEmphasized,
    // Figma "Actions": 8 / 16 / 16 padding, 12 between the buttons.
    actions: { paddingHorizontal: space[16], paddingTop: space[8], gap: space[12] },
  });
