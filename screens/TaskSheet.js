// TaskSheet — the task-detail bottom sheet opened by tapping a TaskCard on the
// Today screen (Figma "Task", node 1:11089), plus its inline "Snooze" step
// (node 1:11111). Both live in ONE Modal that swaps content between the "detail"
// and "snooze" pages — iOS can't present a second Modal over an open one, so the
// back-buttoned snooze page is a step within this sheet, not a separate modal.
//
//   <TaskSheet task={task} visible onClose={…} onMarkDone={…}
//              onSnoozeConfirm={(n, unit) => …} onOpenPlant={…} onSettings={…} />

import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, ButtonIcon, Icon } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { sheet, shadow, motion, fonts } from '../theme/tokens';
import SnoozeContent from './SnoozeContent';

const CAPTION = 'You can edit reminders anytime from a plant settings.';

export default function TaskSheet({
  task,
  visible,
  initialStep = 'detail',
  onClose,
  onMarkDone,
  onSnoozeConfirm,
  onOpenPlant,
  onSettings,
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(1)).current; // 0 shown, 1 hidden
  const [step, setStep] = useState(initialStep); // 'detail' | 'snooze'

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 1,
      duration: visible ? motion.dur : motion.durFast,
      useNativeDriver: true,
    }).start();
    // Open on the requested page (the swipe "Snooze" action opens on 'snooze');
    // reset to 'detail' whenever the sheet is dismissed.
    setStep(visible ? initialStep : 'detail');
  }, [visible, initialStep, translateY]);

  const snoozing = step === 'snooze';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={snoozing ? () => setStep('detail') : onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={snoozing ? () => setStep('detail') : onClose}
          accessibilityLabel={snoozing ? 'Back' : 'Close'}
        />

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: snoozing ? '#ECEDEC' : sheet.bg },
            shadow.sheet,
            { paddingBottom: insets.bottom + 12 },
            {
              transform: [
                { translateY: translateY.interpolate({ inputRange: [0, 1], outputRange: [0, 700] }) },
              ],
            },
          ]}
          accessibilityViewIsModal
        >
          {snoozing ? (
            <ButtonIcon
              size="md"
              variant="secondary"
              accessibilityLabel="Back"
              icon={<Icon name="chevron-left" size={20} color={t.text.primary} />}
              onPress={() => setStep('detail')}
              style={styles.cornerLeft}
            />
          ) : (
            <>
              <ButtonIcon
                size="md"
                variant="secondary"
                accessibilityLabel="Close"
                icon={<Icon name="close" size={20} color={t.text.primary} />}
                onPress={onClose}
                style={styles.cornerLeft}
              />
              <ButtonIcon
                size="md"
                variant="secondary"
                accessibilityLabel="Reminder settings"
                icon={<Icon name="settings" size={20} color={t.text.primary} />}
                onPress={onSettings}
                style={styles.cornerRight}
              />
            </>
          )}

          <View style={styles.grabber}>
            <View style={styles.handle} />
          </View>

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
                      label={task.due}
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
                <Button
                  variant="secondary"
                  size="lg"
                  label="Snooze for"
                  leftIcon={<Icon name="snooze" size={20} color={t.text.primary} />}
                  onPress={() => setStep('snooze')}
                />
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,18,11,0.4)' },
  sheet: {
    borderTopLeftRadius: sheet.radiusTop,
    borderTopRightRadius: sheet.radiusTop,
    paddingTop: 32,
  },
  cornerLeft: { position: 'absolute', top: 12, left: 12, zIndex: 1 },
  cornerRight: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  grabber: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  handle: { width: 36, height: 5, borderRadius: 100, backgroundColor: sheet.handle },
  content: { paddingBottom: 8, gap: 24 },
  header: { paddingHorizontal: 16, alignItems: 'center', gap: 12 },
  photo: { width: 144, height: 144, borderRadius: 28 },
  textBlock: { alignItems: 'center', gap: 8 },
  title: {
    fontFamily: fonts.display, // Literata / serif — Heading Medium Emphasized
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    color: sheet.titleInk,
    textAlign: 'center',
  },
  subtitle: { fontSize: 16, lineHeight: 22, color: sheet.bodyInk, textAlign: 'center' },
  actions: { paddingHorizontal: 16, gap: 12 },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: sheet.bodyInk,
    textAlign: 'center',
    marginTop: 4,
  },
});
