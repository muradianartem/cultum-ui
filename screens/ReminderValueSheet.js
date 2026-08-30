// ReminderValueSheet — the value editor for a reminder's detail rows. A single
// BottomSheet hosting a WheelPicker (two columns over a selection band), typed
// by `field` ('date' | 'frequency' | 'snooze'). Closely follows SnoozeContent's
// wheel/band pattern; on confirm it hands the parent a formatted value string to
// write back into local state. V1 mock — no scheduling, no persistence.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet, WheelPicker } from '../components';
import { sheet, fonts } from '../theme/tokens';

const ITEM_H = 44;
const WHEEL_H = 176;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1); // 1–31
const FREQ_NUMBERS = Array.from({ length: 30 }, (_, i) => i + 1); // 1–30
const SNOOZE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12

// Units carry singular/plural so "1 day" / "2 days" read correctly.
const unit = (plural, singular) => ({ plural, singular });
const FREQ_UNITS = [unit('days', 'day'), unit('weeks', 'week'), unit('months', 'month')];
// Snooze leads with a "None" option (a null unit) that hides the number column.
const SNOOZE_UNITS = [unit('None', 'None'), unit('hours', 'hour'), unit('days', 'day'), unit('weeks', 'week')];

// Per-field wheel configuration. `date` is month+day; the others are number+unit.
export const FIELD = {
  date: { title: 'Date', confirm: 'Set date', kind: 'date' },
  frequency: { title: 'Frequency', confirm: 'Set frequency', kind: 'amount', numbers: FREQ_NUMBERS, units: FREQ_UNITS },
  snooze: { title: 'Snooze for', confirm: 'Set snooze', kind: 'amount', numbers: SNOOZE_NUMBERS, units: SNOOZE_UNITS, noneIndex: 0 },
};

const clamp = (i, len) => Math.max(0, Math.min(len - 1, i));
const unitLabel = (u, n) => (n === 1 ? u.singular : u.plural);

// Format the two wheel indices into the stored value string for `field`.
// Pure — the unit worth testing on its own.
export function buildResult(field, a, b) {
  const cfg = FIELD[field];
  if (cfg.kind === 'date') return `${DAYS[b]} ${MONTHS[a]}`;
  if (cfg.noneIndex != null && b === cfg.noneIndex) return 'None';
  const n = cfg.numbers[a];
  return `${n} ${unitLabel(cfg.units[b], n)}`;
}

// Parse a stored value string back to { a, b } wheel indices for `field`,
// falling back to a sensible default when parsing fails. Pure.
export function parseValue(field, value) {
  const cfg = FIELD[field];
  const s = String(value ?? '').trim();
  if (cfg.kind === 'date') {
    const [dayStr, monStr] = s.split(/\s+/);
    const m = MONTHS.findIndex((mo) => mo.toLowerCase() === (monStr ?? '').toLowerCase());
    const d = parseInt(dayStr, 10);
    return {
      a: m >= 0 ? m : 0,
      b: Number.isFinite(d) ? clamp(d - 1, DAYS.length) : 0,
    };
  }
  if (cfg.noneIndex != null && s.toLowerCase() === 'none') {
    return { a: 0, b: cfg.noneIndex };
  }
  const [numStr, unitStr = ''] = s.split(/\s+/);
  const n = parseInt(numStr, 10);
  const b = cfg.units.findIndex(
    (u) => u.plural === unitStr || u.singular === unitStr
  );
  return {
    a: Number.isFinite(n) ? clamp(n - 1, cfg.numbers.length) : 0,
    b: b >= 0 ? b : 0,
  };
}

export default function ReminderValueSheet({ visible, field, reminder, onClose, onConfirm }) {
  const cfg = field ? FIELD[field] : null;
  const currentValue =
    reminder && field
      ? field === 'date'
        ? reminder.dateValue
        : reminder[field]
      : undefined;

  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  // Re-seed the wheels from the reminder's current value whenever the sheet
  // opens on a (field, reminder) pair.
  useEffect(() => {
    if (visible && field) {
      const idx = parseValue(field, currentValue);
      setA(idx.a);
      setB(idx.b);
    }
  }, [visible, field, currentValue]);

  if (!cfg) return <BottomSheet testID="value-sheet" visible={false} onClose={onClose} />;

  const isDate = cfg.kind === 'date';
  const showNumber = isDate || cfg.noneIndex == null || b !== cfg.noneIndex;

  const leftItems = isDate ? MONTHS : cfg.numbers;
  const rightItems = isDate ? DAYS : cfg.units.map((u) => u.plural);

  const confirm = () => {
    onConfirm?.(buildResult(field, a, b));
    onClose?.();
  };

  return (
    <BottomSheet
      testID="value-sheet"
      visible={visible}
      onClose={onClose}
      primaryAction={{ label: cfg.confirm, onPress: confirm }}
    >
      <View style={styles.wrap}>
        <Text style={styles.title}>{cfg.title}</Text>
        <View style={styles.picker}>
          <View style={styles.band} pointerEvents="none" />
          <View style={styles.wheels}>
            {showNumber ? (
              <WheelPicker
                items={leftItems}
                index={a}
                onChange={setA}
                itemHeight={ITEM_H}
                height={WHEEL_H}
                style={styles.leftCol}
                renderItem={(v, active) => (
                  <Text style={[styles.number, active ? styles.active : styles.dim]}>{v}</Text>
                )}
              />
            ) : null}
            <WheelPicker
              items={rightItems}
              index={b}
              onChange={setB}
              itemHeight={ITEM_H}
              height={WHEEL_H}
              style={styles.rightCol}
              renderItem={(v, active) => (
                <Text style={[styles.unit, active ? styles.active : styles.dim]}>{v}</Text>
              )}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 16 },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: sheet.titleInk,
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
    backgroundColor: '#DADBDA', // copied from SnoozeContent's selection band
  },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  leftCol: { width: 120 },
  rightCol: { width: 130 },
  number: { fontFamily: 'Inter', textAlign: 'right', color: sheet.titleInk },
  unit: { fontFamily: 'Inter', textAlign: 'left', color: sheet.titleInk },
  active: { fontSize: 20, opacity: 1, color: sheet.titleInk },
  dim: { fontSize: 18, opacity: 0.45, color: sheet.bodyInk },
});
