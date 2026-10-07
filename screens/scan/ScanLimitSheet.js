import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomSheet, Icon } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/foundations';

// The countdown re-renders this often; minutes are the finest unit shown.
const TICK_MS = 30 * 1000;

/** "10:21" (hours:minutes) until `resetsAt`, or null when unknown or already past. */
export function untilReset(resetsAt, now = Date.now()) {
  const at = resetsAt ? Date.parse(resetsAt) : NaN;
  if (!Number.isFinite(at) || at <= now) return null;
  const minutes = Math.ceil((at - now) / 60000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * "Today's 3 free scans are used" (Figma "Scan / Daily limit reached [Free]",
 * 880:22023). The free day is a rolling 24 hours on the server, so the time
 * comes from it (`resetsAt`); without one the copy falls back to "tomorrow".
 * `trialUsed` swaps the trial pitch for a plain upgrade.
 */
export default function ScanLimitSheet({ visible, limit, resetsAt, trialUsed, onUpgrade, onClose }) {
  const t = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible || !resetsAt) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [visible, resetsAt]);

  const left = untilReset(resetsAt, now);
  const when = left ? (
    <>
      in <Text style={styles.strong}>{left}</Text>
    </>
  ) : (
    'tomorrow'
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      statusIcon={<Icon name="power" size={24} color={t.brand.onSecondary} />}
      title={limit ? `Today’s ${limit} free scans are used` : `Today’s free scans are used`}
      description={
        <>
          Your free scans come back {when}. Go unlimited with Cultum Plus and identify as many
          plants as you like.
        </>
      }
      primaryAction={{
        label: trialUsed ? 'Upgrade to Plus' : 'Start 7-day free trial',
        onPress: onUpgrade,
      }}
      secondaryAction={{ label: 'Skip for now', onPress: onClose }}
      caption={trialUsed ? undefined : 'Cancel any time during the 7-day trial.'}
    />
  );
}

const styles = StyleSheet.create({
  strong: { ...typography.bodyLargeEmphasized },
});
