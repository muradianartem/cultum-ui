import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calendar } from '../theme/tokens';
import ButtonIcon from './ButtonIcon';
import Chip from './Chip';
import Divider from './Divider';
import Icon from './Icon';

/**
 * Calendar — month grid date picker, imported from Figma "Calendar" (node
 * 360:29) and "Calendar Day" (node 359:39).
 *
 * A month header (‹ September 2026 ›), a Sunday-first weekday row, a fixed 6×7
 * grid of 32px day cells, and an optional suggestions strip (a hairline over
 * wrapped <Chip>s) below. Figma axes → props:
 *   Month            → `month` + `onMonthChange` (or left uncontrolled)
 *   Show suggestions → `suggestions` (omit to hide the strip)
 *   Day state        → derived: Selected (`value`), Today (`today`), Empty
 *                      (padding cells outside the month)
 *
 * The month is optionally controlled: pass `month`/`onMonthChange` to own it,
 * or omit both and the component tracks its own visible month. While it owns
 * the month it follows `value` whenever the selection lands outside the visible
 * grid — whether from a suggestion chip or a parent re-seeding the picker (as
 * ReminderValueSheet does each time it opens on a stored date).
 *
 * The grid helpers below are exported and pure so date maths can be tested
 * without rendering.
 */

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Midnight on the same calendar day — strips the time so comparisons are by day.
export const startOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export const isSameMonth = (a, b) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export const isSameDay = (a, b) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const monthLabel = (d) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

/**
 * The visible grid for `date`'s month: always 6 rows of 7, Sunday-first.
 * Cells before the 1st and after the last day are `null` (Figma's "Empty" day
 * state), so the grid height never jumps between months.
 */
export function monthMatrix(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lead = new Date(year, month, 1).getDay(); // 0 = Sunday
  const days = new Date(year, month + 1, 0).getDate();

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - lead + 1;
    return day >= 1 && day <= days ? new Date(year, month, day) : null;
  });

  return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

function Day({ date, selected, isToday, onPress }) {
  if (!date) return <View style={styles.day} />;

  const fill = selected
    ? calendar.daySelectedBg
    : isToday
    ? calendar.dayTodayBg
    : 'transparent';
  const ink = selected ? calendar.daySelectedInk : calendar.dayInk;

  return (
    <Pressable
      onPress={() => onPress(date)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${date.getDate()} ${monthLabel(date)}`}
      style={({ pressed }) => [
        styles.day,
        { backgroundColor: fill },
        pressed && !selected && { backgroundColor: calendar.dayTodayBg },
      ]}
    >
      <Text
        style={[
          styles.dayText,
          { color: ink },
          (selected || isToday) && styles.dayTextEmphasized,
        ]}
      >
        {date.getDate()}
      </Text>
    </Pressable>
  );
}

export default function Calendar({
  value,
  onChange,
  month,
  onMonthChange,
  suggestions,
  today = new Date(),
  style,
  testID,
}) {
  const [ownMonth, setOwnMonth] = useState(() =>
    startOfMonth(month ?? value ?? today)
  );

  // Follow `value` onto its own month when we own the month. Compared by
  // timestamp because callers hand us a fresh Date object every render.
  const valueTime = value ? +startOfDay(value) : null;
  const [seenValue, setSeenValue] = useState(valueTime);
  if (valueTime !== seenValue) {
    setSeenValue(valueTime);
    if (!month && value && !isSameMonth(value, ownMonth)) {
      setOwnMonth(startOfMonth(value));
    }
  }

  const visible = month ? startOfMonth(month) : ownMonth;

  const goToMonth = (next) => {
    if (!month) setOwnMonth(next);
    onMonthChange?.(next);
  };

  const select = (date) => {
    // A suggestion (or any date) outside the visible month pulls the grid to it.
    if (date.getMonth() !== visible.getMonth() || date.getFullYear() !== visible.getFullYear()) {
      goToMonth(startOfMonth(date));
    }
    onChange?.(startOfDay(date));
  };

  const weeks = monthMatrix(visible);
  const selected = value ? startOfDay(value) : null;
  const todayStart = startOfDay(today);

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.body}>
        <View style={styles.monthRow}>
          <ButtonIcon
            variant="ghost"
            size="md"
            accessibilityLabel="Previous month"
            icon={<Icon name="chevron-left" size={20} color={calendar.monthInk} />}
            onPress={() => goToMonth(addMonths(visible, -1))}
          />
          <Text style={styles.monthLabel}>{monthLabel(visible)}</Text>
          <ButtonIcon
            variant="ghost"
            size="md"
            accessibilityLabel="Next month"
            icon={<Icon name="chevron-right" size={20} color={calendar.monthInk} />}
            onPress={() => goToMonth(addMonths(visible, 1))}
          />
        </View>

        <View style={styles.week}>
          {WEEKDAY_INITIALS.map((d, i) => (
            <View key={i} style={styles.weekday}>
              <Text style={styles.weekdayText}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((days, w) => (
            <View key={w} style={styles.week}>
              {days.map((date, i) => (
                <Day
                  key={i}
                  date={date}
                  selected={isSameDay(date, selected)}
                  isToday={isSameDay(date, todayStart)}
                  onPress={select}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {suggestions?.length ? (
        <View>
          <Divider />
          <View style={styles.chips}>
            {suggestions.map((s) => (
              <Chip
                key={s.label}
                label={s.label}
                selected={isSameDay(startOfDay(s.date), selected)}
                onPress={() => select(s.date)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: calendar.bg,
    borderRadius: calendar.radius,
  },
  body: { paddingVertical: 12, paddingHorizontal: 8, gap: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  monthLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: calendar.monthInk,
    textAlign: 'center',
  },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { width: calendar.daySize, height: 20, alignItems: 'center', justifyContent: 'center' },
  weekdayText: { fontSize: 12, lineHeight: 17, color: calendar.weekdayInk },
  grid: { paddingTop: 2, gap: 2 },
  day: {
    width: calendar.daySize,
    height: calendar.daySize,
    borderRadius: calendar.daySize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  dayTextEmphasized: { fontWeight: '500' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
});
