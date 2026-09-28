// TaskSheet — the task-detail bottom sheet opened by tapping a TaskCard on the
// Today screen (Figma "Task", node 1:11089), plus its inline "Snooze" step
// (node 1:11111). Both live in ONE <BottomSheet> that swaps content between the "detail"
// and "snooze" pages — iOS can't present a second Modal over an open one, so the
// back-buttoned snooze page is a step within this sheet, not a separate modal.
//
// `snoozed` is the variant opened from the Snoozed page (node 694:1520): the
// badge reads "Snoozed · In 3d" and "Snooze for" becomes "Cancel snooze".
//
//   <TaskSheet task={task} visible onClose={…} onMarkDone={…}
//              onSnoozeConfirm={(n, unit) => …} onOpenPlant={…} onSettings={…} />
//   <TaskSheet task={task} snoozed visible onCancelSnooze={…} … />

import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Badge, BottomSheet, Button, ButtonIcon, Icon } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/foundations';
import SnoozeContent from './SnoozeContent';

const CAPTION = 'You can edit reminders anytime from a plant settings.';

export default function TaskSheet({
  task,
  visible,
  initialStep = 'detail',
  snoozed = false,
  onClose,
  onMarkDone,
  onSnoozeConfirm,
  onCancelSnooze,
  onOpenPlant,
  onSettings,
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [step, setStep] = useState(initialStep); // 'detail' | 'snooze'

  useEffect(() => {
    // Open on the requested page (default 'detail');
    // reset to 'detail' whenever the sheet is dismissed.
    setStep(visible ? initialStep : 'detail');
  }, [visible, initialStep]);

  const snoozing = step === 'snooze';

  const toDetail = () => setStep('detail');

  // Figma "Task" puts close top-left and settings top-right; the snooze page
  // swaps close for back and drops settings.
  const leading = snoozing ? (
    <ButtonIcon
      size="md"
      variant="secondary"
      accessibilityLabel="Back"
      icon={<Icon name="chevron-left" size={20} color={t.text.primary} />}
      onPress={toDetail}
    />
  ) : (
    <ButtonIcon
      size="md"
      variant="secondary"
      accessibilityLabel="Close"
      icon={<Icon name="close" size={20} color={t.text.primary} />}
      onPress={onClose}
    />
  );
  const trailing = snoozing ? null : (
    <ButtonIcon
      size="md"
      variant="secondary"
      accessibilityLabel="Reminder settings"
      icon={<Icon name="settings" size={20} color={t.text.primary} />}
      onPress={onSettings}
    />
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onRequestClose={snoozing ? toDetail : onClose}
      leading={leading}
      trailing={trailing}
      sheetStyle={snoozing ? { backgroundColor: t.surface.primary } : null}
      bodyStyle={snoozing ? null : styles.detailBody}
      testID="task-sheet"
    >
      {snoozing ? (
        <SnoozeContent onConfirm={(n, unit) => onSnoozeConfirm?.(n, unit)} />
      ) : (
        <View style={styles.content}>
          <View style={styles.header}>
            {task?.photo ? (
              <Image source={task.photo} style={styles.photo} resizeMode="cover" />
            ) : null}
            <View style={styles.textBlock}>
              <Text style={styles.title}>{task?.title}</Text>
              {task ? (
                <Text style={styles.subtitle}>{`${task.plant} · ${task.room}`}</Text>
              ) : null}
              {task?.due ? (
                <Badge
                  label={snoozed ? `Snoozed · ${task.due}` : task.due}
                  intent="neutral"
                  variant="secondary"
                  leftIcon={<Icon name="clock" size={14} color={t.text.primary} />}
                />
              ) : null}
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              label="Mark as done"
              leftIcon={<Icon name="check" size={20} color={t.brand.onPrimary} />}
              onPress={onMarkDone}
            />
            {snoozed ? (
              <Button
                variant="secondary"
                size="lg"
                label="Cancel snooze"
                onPress={onCancelSnooze}
              />
            ) : (
              <Button
                variant="secondary"
                size="lg"
                label="Snooze for"
                leftIcon={<Icon name="snooze" size={20} color={t.text.primary} />}
                onPress={() => setStep('snooze')}
              />
            )}
            <Button
              variant="secondary"
              size="lg"
              label="Open plant page"
              onPress={onOpenPlant}
            />
            <Text style={styles.caption}>{CAPTION}</Text>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const makeStyles = (t) => StyleSheet.create({
  // Figma "Task" hangs the photo 32px from the sheet's top edge, between the
  // corner buttons, so the body starts closer than BottomSheet's default.
  detailBody: { paddingTop: 11 },
  content: { paddingBottom: 8, gap: 24 },
  header: { paddingHorizontal: 16, alignItems: 'center', gap: 12 },
  photo: { width: 144, height: 144, borderRadius: 28 },
  textBlock: { alignItems: 'center', gap: 8 },
  title: {
    ...typography.headingMediumEmphasized,
    color: t.text.primary,
    textAlign: 'center',
  },
  subtitle: { ...typography.bodyLarge, color: t.text.secondary, textAlign: 'center' },
  actions: { paddingHorizontal: 16, gap: 12 },
  // Bottom Sheet's caption: Inter 12/16, not a named style.
  caption: {
    ...typography.caption,
    lineHeight: 16,
    color: t.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
