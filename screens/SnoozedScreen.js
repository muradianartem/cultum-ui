// The "Snoozed" page (Figma "Today / Snoozed", node 667:4471), reached from the
// "N tasks snoozed" banner on Today. It lists every occurrence a snooze is
// currently holding back, each badged with when it comes back; tapping one
// opens the task sheet in its snoozed variant, where the snooze can be
// cancelled (the task drops straight back onto Today).
//
// Like Today, the list is derived from the store (garden.snoozed), so a
// cancelled or completed snooze leaves it without any local bookkeeping.

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, NavigationBar, State, useUndoSnackbar } from '../components';
import { useRouter } from '../routing';
import { useGarden } from '../store/GardenProvider';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/foundations';
import TaskCard from './TaskCard';
import TaskSheet from './TaskSheet';

export const snoozedCountLabel = (n) => (n === 1 ? '1 task' : `${n} tasks`);

export default function SnoozedScreen() {
  const insets = useSafeAreaInsets();
  const { back, navigate } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const garden = useGarden();
  const notify = useUndoSnackbar();

  const tasks = garden.snoozed;

  // Kept through the slide-out, as on Today, so the sheet doesn't blank.
  const [sheetTask, setSheetTask] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = (task) => {
    setSheetTask(task);
    setSheetOpen(true);
  };
  const closeSheet = () => setSheetOpen(false);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar
          title="Snoozed"
          subtitle={snoozedCountLabel(tasks.length)}
          leading={<Icon name="chevron-left" size={24} color={t.text.primary} />}
          onLeadingPress={back}
          buttonVariant="secondary"
          divider={false}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[16] }]}
        showsVerticalScrollIndicator={false}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onPress={() => openSheet(task)} />
        ))}
        {tasks.length === 0 ? (
          <State
            icon={<Icon name="snooze" size={28} color={t.text.primary} />}
            iconVariant="secondary"
            title="Nothing snoozed"
            subtitle="Snoozed tasks will show up here."
          />
        ) : null}
      </ScrollView>

      <TaskSheet
        task={sheetTask}
        snoozed
        visible={sheetOpen}
        onClose={closeSheet}
        onMarkDone={() => {
          if (sheetTask) {
            notify('Task completed', garden.completeReminder(sheetTask.reminderId));
          }
          closeSheet();
        }}
        onCancelSnooze={() => {
          // A falsy duration clears the snooze; the occurrence falls back to
          // its natural date, which is usually today or overdue.
          if (sheetTask) {
            notify('Snooze cancelled', garden.snoozeReminder(sheetTask.reminderId, 0));
          }
          closeSheet();
        }}
        onOpenPlant={() => {
          const task = sheetTask;
          closeSheet();
          navigate('product', { plantId: task?.plantId });
        }}
        onSettings={() => {
          const task = sheetTask;
          closeSheet();
          navigate('reminders', { plantId: task?.plantId });
        }}
      />
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    // Figma 667:4502: 12 top, 16 sides; cards 12 apart.
    content: { paddingTop: space[12], paddingHorizontal: space[16], gap: space[12] },
  });
