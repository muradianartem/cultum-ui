// AddReminderSheet — the "Add new reminder" flow (Figma section
// "Reminders / Add new reminder", node 362:17102), in three steps:
//
//   label     (1:7788)   name it            → Continue
//   frequency (1:7770)   how often to repeat + a "Start date" row
//                                           → Remind every 2 days  (confirms)
//   date      (362:15028) pick the start day → Set 10 Sep  (returns to frequency)
//
// All three live in ONE Modal that swaps content between steps — iOS can't
// present a second Modal over an open one, so `date` is a step within this
// sheet rather than a sheet of its own. Same structure as TaskSheet's inline
// "snooze" page; see that file for the original of this pattern.
//
//   <AddReminderSheet visible onClose={…} onConfirm={(reminder) => …} />

import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  ButtonIcon,
  Calendar,
  Icon,
  ListItem,
  TextInput,
  WheelPicker,
} from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, motion, shadow, sheet } from '../theme/tokens';
import { FREQUENCY_NUMBERS, FREQUENCY_UNITS } from './durationUnits';
import {
  DEFAULT_NUMBER_INDEX,
  DEFAULT_UNIT_INDEX,
  frequencyLabel,
  makeReminder,
  setDateLabel,
  shortDate,
  startDateSuggestions,
} from './addReminderData';

const ITEM_H = 44;
const WHEEL_H = 176;
const BG = '#ECEDEC'; // Figma sheet ground for all three steps
const HELPER = 'This will help you to distinguish reminders from each other.';
const DATE_CAPTION = 'The reminder starts on this day and repeats from there.';

// Where "back" goes from each step. `label` is the first step, so it has none —
// its back affordance is the close button instead.
const PREVIOUS = { label: null, frequency: 'label', date: 'frequency' };

export default function AddReminderSheet({ visible, onClose, onConfirm, today }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(1)).current; // 0 shown, 1 hidden

  const [step, setStep] = useState('label'); // 'label' | 'frequency' | 'date'
  const [label, setLabel] = useState('');
  const [numberIndex, setNumberIndex] = useState(DEFAULT_NUMBER_INDEX);
  const [unitIndex, setUnitIndex] = useState(DEFAULT_UNIT_INDEX);
  const [date, setDate] = useState(() => today ?? new Date());

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 1,
      duration: visible ? motion.dur : motion.durFast,
      useNativeDriver: true,
    }).start();

    // Every open starts a fresh reminder — reset the draft on dismiss so a
    // half-finished one never bleeds into the next.
    if (!visible) {
      setStep('label');
      setLabel('');
      setNumberIndex(DEFAULT_NUMBER_INDEX);
      setUnitIndex(DEFAULT_UNIT_INDEX);
      setDate(today ?? new Date());
    }
  }, [visible, today, translateY]);

  const back = PREVIOUS[step];
  // Backdrop / hardware back steps backwards through the flow, and only closes
  // the sheet from the first step.
  const dismiss = () => (back ? setStep(back) : onClose?.());

  const confirm = () => {
    onConfirm?.(makeReminder({ label, numberIndex, unitIndex, date }));
    onClose?.();
  };

  const canContinue = label.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
      testID="add-reminder-sheet"
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={back ? 'Back' : 'Close'}
        />

        <Animated.View
          style={[
            styles.sheet,
            shadow.sheet,
            { paddingBottom: insets.bottom + 12 },
            {
              transform: [
                {
                  translateY: translateY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 700],
                  }),
                },
              ],
            },
          ]}
          accessibilityViewIsModal
        >
          {back ? (
            <ButtonIcon
              size="md"
              variant="secondary"
              accessibilityLabel="Back"
              icon={<Icon name="chevron-left" size={20} color={t.text.primary} />}
              onPress={() => setStep(back)}
              style={styles.cornerLeft}
            />
          ) : null}
          <ButtonIcon
            size="md"
            variant="secondary"
            accessibilityLabel="Close"
            icon={<Icon name="close" size={20} color={t.text.primary} />}
            onPress={onClose}
            style={styles.cornerRight}
          />

          <View style={styles.grabber}>
            <View style={styles.handle} />
          </View>

          {step === 'label' ? (
            <View style={styles.content}>
              <Text style={styles.title}>Add new reminder</Text>
              <TextInput
                label="Label"
                placeholder="What to remind?"
                helper={HELPER}
                value={label}
                onChangeText={setLabel}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => canContinue && setStep('frequency')}
              />
              <Button
                variant="primary"
                size="lg"
                label="Continue"
                disabled={!canContinue}
                onPress={() => setStep('frequency')}
              />
            </View>
          ) : null}

          {step === 'frequency' ? (
            <View style={styles.content}>
              <Text style={styles.title}>When to repeat</Text>

              <View style={styles.picker}>
                <View style={styles.band} pointerEvents="none" />
                <View style={styles.wheels}>
                  <WheelPicker
                    items={FREQUENCY_NUMBERS}
                    index={numberIndex}
                    onChange={setNumberIndex}
                    itemHeight={ITEM_H}
                    height={WHEEL_H}
                    style={styles.numberCol}
                    renderItem={(n, active) => (
                      <Text style={[styles.number, active ? styles.active : styles.dim]}>
                        {n}
                      </Text>
                    )}
                  />
                  <WheelPicker
                    items={FREQUENCY_UNITS.map((u) => u.plural)}
                    index={unitIndex}
                    onChange={setUnitIndex}
                    itemHeight={ITEM_H}
                    height={WHEEL_H}
                    style={styles.unitCol}
                    renderItem={(u, active) => (
                      <Text style={[styles.unit, active ? styles.active : styles.dim]}>
                        {u}
                      </Text>
                    )}
                  />
                </View>
              </View>

              <ListItem
                title="Start date"
                accessibilityLabel="Start date"
                onPress={() => setStep('date')}
                after={
                  <View style={styles.after}>
                    <Text style={styles.afterText}>{shortDate(date)}</Text>
                    <Icon name="chevron-right" size={20} color={sheet.bodyInk} />
                  </View>
                }
              />

              <Button
                variant="primary"
                size="lg"
                label={frequencyLabel(numberIndex, unitIndex)}
                onPress={confirm}
              />
            </View>
          ) : null}

          {step === 'date' ? (
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>Start date</Text>
                <Text style={styles.caption}>{DATE_CAPTION}</Text>
              </View>

              <View style={styles.calendarWrap}>
                <Calendar
                  value={date}
                  onChange={setDate}
                  today={today}
                  suggestions={startDateSuggestions(today ?? new Date())}
                />
              </View>

              <Button
                variant="primary"
                size="lg"
                label={setDateLabel(date)}
                onPress={() => setStep('frequency')}
              />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,18,11,0.4)' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: sheet.radiusTop,
    borderTopRightRadius: sheet.radiusTop,
    paddingTop: 32,
  },
  cornerLeft: { position: 'absolute', top: 12, left: 12, zIndex: 1 },
  cornerRight: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  grabber: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  handle: { width: 36, height: 5, borderRadius: 100, backgroundColor: sheet.handle },

  content: { paddingHorizontal: 16, gap: 16 },
  header: { gap: 4 },
  title: {
    fontFamily: fonts.display, // Literata / serif — Heading XS Emphasized
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: sheet.titleInk,
    textAlign: 'center',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    color: sheet.bodyInk,
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
    backgroundColor: '#DADBDA',
  },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  numberCol: { width: 120 },
  unitCol: { width: 130 },
  number: { fontFamily: 'Inter', textAlign: 'right', color: sheet.titleInk },
  unit: { fontFamily: 'Inter', textAlign: 'left', color: sheet.titleInk },
  active: { fontSize: 20, opacity: 1, color: sheet.titleInk },
  dim: { fontSize: 18, opacity: 0.45, color: sheet.bodyInk },

  after: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  afterText: { fontSize: 14, lineHeight: 20, color: sheet.bodyInk },

  // Figma wraps the #FAFAFA calendar card in a bordered 20px-radius frame.
  calendarWrap: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B6B9B6',
    borderRadius: 20,
  },
});
