// Settings → Notifications → Reminder time — Figma "Sheet · Reminder time"
// (node 419:2523).
//
// Three wheels over one selection band, following SnoozeContent's pattern
// (built on plain ScrollViews — this project has no gesture-handler or
// reanimated, by design).
//
// It commits on Save, never on a wheel tick, and that matters well beyond
// tidiness: confirming re-times every reminder the user owns, which queues one
// PATCH each. Committing per tick would queue a round for every value the wheel
// passed through on the way.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet, WheelPicker } from '../../components';
import { timeOfDayFrom, timeParts } from '../../store/format';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';

const ITEM_H = 44;
const WHEEL_H = 200;

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

export default function ReminderTimeSheet({ visible, onClose, value, onConfirm }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  // The stored time is the state until the user touches a wheel; only then is
  // there a draft. Deriving it during render rather than seeding it in an
  // effect is what makes the wheels open on the right value: BottomSheet keeps
  // its children mounted inside the Modal, and WheelPicker positions itself
  // from `contentOffset` at mount — an effect that fires after that mount is
  // already too late, and the wheels sit on their first row.
  const seed = timeParts(value);
  const [draft, setDraft] = useState(null);
  const current = draft ?? {
    hour: seed.hour12 - 1,
    minute: seed.minute,
    period: seed.period === 'PM' ? 1 : 0,
  };
  const setPart = (patch) => setDraft({ ...current, ...patch });

  // Abandon an uncommitted edit on close, so re-opening starts from the stored
  // value rather than from wherever the wheels happened to be left.
  useEffect(() => {
    if (!visible) setDraft(null);
  }, [visible]);

  function confirm() {
    onConfirm?.(
      timeOfDayFrom({
        hour12: Number(HOURS[current.hour]),
        minute: Number(MINUTES[current.minute]),
        period: PERIODS[current.period],
      }),
    );
    onClose?.();
  }

  const column = (items, index, onChange, style, label) => (
    <WheelPicker
      items={items}
      index={index}
      onChange={onChange}
      itemHeight={ITEM_H}
      height={WHEEL_H}
      style={style}
      accessibilityLabel={label}
      renderItem={(item, active) => (
        <Text style={[styles.item, active ? styles.active : styles.dim]}>{item}</Text>
      )}
    />
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Reminder time"
      description="Reminders arrive at this time."
      primaryAction={{ label: 'Save', onPress: confirm }}
      testID="reminder-time-sheet"
    >
      <View style={styles.picker}>
        <View style={styles.band} pointerEvents="none" />
        <View style={styles.wheels}>
          {column(HOURS, current.hour, (hour) => setPart({ hour }), styles.hourCol, 'Hour')}
          {column(MINUTES, current.minute, (minute) => setPart({ minute }), styles.minuteCol, 'Minute')}
          {column(PERIODS, current.period, (period) => setPart({ period }), styles.periodCol, 'AM or PM')}
        </View>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    picker: { height: WHEEL_H, justifyContent: 'center' },
    band: {
      position: 'absolute',
      left: space[16],
      right: space[16],
      top: (WHEEL_H - ITEM_H) / 2,
      height: ITEM_H,
      borderRadius: 9999,
      backgroundColor: t.surface.secondary,
    },
    wheels: { flexDirection: 'row', justifyContent: 'center', gap: space[16] },
    hourCol: { width: 72 },
    minuteCol: { width: 56 },
    periodCol: { width: 72 },
    item: {
      height: ITEM_H,
      lineHeight: ITEM_H,
      textAlign: 'center',
      ...typography.bodyMediumEmphasized,
    },
    // Figma 653:4705: the selected row is Heading Extra Small Emphasized.
    active: { ...typography.headingExtraSmallEmphasized, lineHeight: ITEM_H, color: t.text.primary },
    dim: { color: t.text.secondary, opacity: 0.7 },
  });
