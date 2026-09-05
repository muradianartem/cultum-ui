// ReminderValueSheet — the value editor for a reminder's detail rows. A single
// BottomSheet typed by `field` ('date' | 'frequency' | 'snooze'):
//
//   frequency / snooze → a two-column WheelPicker over a selection band,
//                        following SnoozeContent's wheel/band pattern
//   date               → the <Calendar> primitive, the same picker (and the
//                        same suggestion chips) the add-reminder flow uses, so
//                        choosing a date reads identically whether you are
//                        creating a reminder or editing one
//
// On confirm it hands the parent a formatted value string to write back into
// local state. V1 mock — no scheduling, no persistence.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar, BottomSheet, WheelPicker } from '../components';
import { sheet, fonts } from '../theme/tokens';
import {
  DEFAULT_FREQUENCY_UNIT_INDEX,
  FREQUENCY_NUMBERS,
  FREQUENCY_UNITS,
  SNOOZE_NUMBERS,
  SNOOZE_UNITS,
  unitLabel,
} from './durationUnits';
import {
  parseShortDate,
  setDateLabel,
  shortDate,
  startDateSuggestions,
} from './addReminderData';

const ITEM_H = 44;
const WHEEL_H = 176;

// Per-field configuration. `date` is picked on a calendar; the others are
// number+unit wheels, with their value lists shared via ./durationUnits so the
// create flow and this editor always offer the same options.
export const FIELD = {
  date: { title: 'Date', kind: 'calendar' },
  frequency: {
    title: 'Frequency',
    confirm: 'Set frequency',
    kind: 'amount',
    numbers: FREQUENCY_NUMBERS,
    units: FREQUENCY_UNITS,
    defaultUnitIndex: DEFAULT_FREQUENCY_UNIT_INDEX,
  },
  snooze: {
    title: 'Snooze for',
    confirm: 'Set snooze',
    kind: 'amount',
    numbers: SNOOZE_NUMBERS,
    units: SNOOZE_UNITS,
    noneIndex: 0,
  },
};

const clamp = (i, len) => Math.max(0, Math.min(len - 1, i));

// Format the two wheel indices into the stored value string for `field`.
// Amount fields only — `date` is a calendar, and formats via shortDate().
// Pure — the unit worth testing on its own.
export function buildResult(field, a, b) {
  const cfg = FIELD[field];
  if (cfg.noneIndex != null && b === cfg.noneIndex) return 'None';
  const n = cfg.numbers[a];
  return `${n} ${unitLabel(cfg.units[b], n)}`;
}

// Parse a stored value string back to { a, b } wheel indices for `field`,
// falling back to a sensible default when parsing fails. Amount fields only —
// `date` parses via parseShortDate(). Pure.
export function parseValue(field, value) {
  const cfg = FIELD[field];
  const s = String(value ?? '').trim();
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
    b: b >= 0 ? b : cfg.defaultUnitIndex ?? 0,
  };
}

export default function ReminderValueSheet({
  visible,
  field,
  reminder,
  onClose,
  onConfirm,
  today, // injectable for deterministic tests; defaults to now
}) {
  const cfg = field ? FIELD[field] : null;
  const currentValue =
    reminder && field
      ? field === 'date'
        ? reminder.dateValue
        : reminder[field]
      : undefined;

  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [date, setDate] = useState(() => today ?? new Date());

  // Re-seed the picker from the reminder's current value whenever the sheet
  // opens on a (field, reminder) pair.
  useEffect(() => {
    if (!visible || !field) return;
    if (FIELD[field].kind === 'calendar') {
      setDate(parseShortDate(currentValue, today ?? new Date()));
    } else {
      const idx = parseValue(field, currentValue);
      setA(idx.a);
      setB(idx.b);
    }
  }, [visible, field, currentValue, today]);

  if (!cfg) return <BottomSheet testID="value-sheet" visible={false} onClose={onClose} />;

  const isCalendar = cfg.kind === 'calendar';
  const showNumber = cfg.noneIndex == null || b !== cfg.noneIndex;

  const confirm = () => {
    onConfirm?.(isCalendar ? shortDate(date) : buildResult(field, a, b));
    onClose?.();
  };

  // A date row is titled by what it actually holds — "Last watering" on a
  // built-in reminder, "Start date" on a custom one.
  const title = isCalendar ? reminder?.dateLabel ?? cfg.title : cfg.title;

  return (
    <BottomSheet
      testID="value-sheet"
      visible={visible}
      onClose={onClose}
      primaryAction={{
        label: isCalendar ? setDateLabel(date) : cfg.confirm,
        onPress: confirm,
      }}
    >
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        {isCalendar ? (
          <View style={styles.calendarWrap}>
            <Calendar
              value={date}
              onChange={setDate}
              today={today}
              suggestions={startDateSuggestions(today ?? new Date())}
            />
          </View>
        ) : (
          <View style={styles.picker}>
            <View style={styles.band} pointerEvents="none" />
            <View style={styles.wheels}>
              {showNumber ? (
                <WheelPicker
                  items={cfg.numbers}
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
                items={cfg.units.map((u) => u.plural)}
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
        )}
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
  // Figma wraps the #FAFAFA calendar card in a bordered 20px-radius frame.
  calendarWrap: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B6B9B6',
    borderRadius: 20,
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
