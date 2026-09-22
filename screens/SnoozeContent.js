// SnoozeContent — the body of the "Snooze reminder" step (Figma node 1:11111):
// a centred title, a two-column wheel picker (number + unit) over a selection
// band, and a primary CTA whose label reflects the choice. Chrome (sheet, back
// button, grabber) is provided by the hosting TaskSheet, so this renders no
// Modal of its own — that's what lets the whole flow live in one Modal.

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, WheelPicker } from '../components';
import { wheel } from '../theme/tokens';
import { typography } from '../theme/foundations';
import { useTheme } from '../theme/ThemeProvider';
import {
  DEFAULT_FREQUENCY_UNIT_INDEX,
  FREQUENCY_UNITS as UNITS,
  SNOOZE_NUMBERS as NUMBERS,
  unitLabel,
} from './durationUnits';

const ITEM_H = 44;
const WHEEL_H = 176;

export default function SnoozeContent({ onConfirm }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  // Default to "2 days", matching the Figma.
  const [numberIndex, setNumberIndex] = useState(1);
  const [unitIndex, setUnitIndex] = useState(DEFAULT_FREQUENCY_UNIT_INDEX);

  const number = NUMBERS[numberIndex];
  const label = unitLabel(UNITS[unitIndex], number);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Snooze for</Text>

      <View style={styles.picker}>
        <View style={styles.band} pointerEvents="none" />
        <View style={styles.wheels}>
          <WheelPicker
            items={NUMBERS}
            index={numberIndex}
            onChange={setNumberIndex}
            itemHeight={ITEM_H}
            height={WHEEL_H}
            style={styles.numberCol}
            renderItem={(n, active) => (
              <Text style={[styles.number, active ? styles.active : styles.dim]}>{n}</Text>
            )}
          />
          <WheelPicker
            items={UNITS.map((u) => u.plural)}
            index={unitIndex}
            onChange={setUnitIndex}
            itemHeight={ITEM_H}
            height={WHEEL_H}
            style={styles.unitCol}
            renderItem={(u, active) => (
              <Text style={[styles.unit, active ? styles.active : styles.dim]}>{u}</Text>
            )}
          />
        </View>
      </View>

      <Button
        variant="primary"
        size="lg"
        label={`Snooze for ${number} ${label}`}
        onPress={() => onConfirm?.(number, label)}
      />
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 16 },
  title: {
    ...typography.headingExtraSmallEmphasized, // Figma 1:11113
    color: t.text.primary,
    textAlign: 'center',
  },
  picker: { height: WHEEL_H, justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (WHEEL_H - ITEM_H) / 2,
    height: ITEM_H,
    borderRadius: 9999,
    backgroundColor: t.surface.secondary,
  },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  numberCol: { width: 120 },
  unitCol: { width: 130 },
  number: { textAlign: 'right', color: t.text.primary },
  unit: { textAlign: 'left', color: t.text.primary },
  active: { ...wheel.active, color: t.text.primary },
  dim: { ...wheel.dim, color: t.text.secondary },
});
