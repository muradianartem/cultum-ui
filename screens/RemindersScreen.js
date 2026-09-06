// Edit Reminders — one plant's care schedule (Figma node 1:7889).
//
// Every row is a real reminder from the store, and every edit is written
// straight back: a toggle, a new frequency, a moved start date and a removal
// all persist and all re-derive the plant's next due date (store/schedule.js)
// and its notifications.
//
// The sheets still speak in display strings ("7 days", "21 Aug", "None") —
// that is the wheel's own vocabulary — so store/format.js owns the pair of
// formatter and parser at that boundary rather than either sheet knowing about
// interval days.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Dialog, Icon, List, ListItem, NavigationBar, State, Toggle } from '../components';
import { useRouter } from '../routing';
import { useGarden } from '../store/GardenProvider';
import { actionMeta } from '../store/model';
import {
  dateLabelFor,
  durationMs,
  frequencyValue,
  longDate,
  parseFrequency,
  reminderDateValue,
  shortDate,
} from '../store/format';
import { nextDueAt } from '../store/schedule';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';
import { parseShortDate } from './addReminderData';
import ReminderValueSheet from './ReminderValueSheet';
import AddReminderSheet from './AddReminderSheet';

// Coloured icon chip — a 40×40 rounded-full tinted square holding a 20px icon.
// The action's semantic tone resolves against the theme, so it re-tints in
// light/dark for free.
function Chip({ action, styles, t }) {
  const meta = actionMeta(action);
  const { bg, fg } =
    meta.tone === 'neutral'
      ? { bg: t.surface.secondary, fg: t.text.primary }
      : { bg: t[meta.tone].secondary, fg: t[meta.tone].primary };
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Icon name={meta.icon} size={20} color={fg} />
    </View>
  );
}

// One detail row: a pressable "label ↔ value + chevron" line that opens the
// value editor for `field`.
function DetailRow({ label, value, onPress, accessibilityLabel, styles, t }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.detailRow}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValue}>
        <Text style={styles.detailValueText}>{value}</Text>
        <Icon name="chevron-right" size={20} color={t.text.primary} />
      </View>
    </Pressable>
  );
}

// One reminder card: a card-style List panel with a (non-pressable) header row
// — chip, title, "Next reminder" subtitle, enable Toggle — followed by three
// pressable detail rows (date, frequency, snooze) and a Remove.
function ReminderCard({ reminder, view, onToggle, onEditField, onRemove, styles, t }) {
  return (
    <List variant="card">
      <ListItem
        before={<Chip action={reminder.action} styles={styles} t={t} />}
        title={reminder.title}
        subtitle={view.nextLabel}
        after={
          <Toggle
            value={reminder.enabled}
            onValueChange={onToggle}
            accessibilityLabel={`Enable ${reminder.title}`}
          />
        }
      />
      <View style={styles.details}>
        <DetailRow
          label={view.dateLabel}
          value={view.dateValue}
          accessibilityLabel={`${reminder.title} date`}
          onPress={() => onEditField('date')}
          styles={styles}
          t={t}
        />
        <DetailRow
          label="Frequency"
          value={view.frequency}
          accessibilityLabel={`${reminder.title} Frequency`}
          onPress={() => onEditField('frequency')}
          styles={styles}
          t={t}
        />
        <DetailRow
          label="Snooze for"
          value={view.snooze}
          accessibilityLabel={`${reminder.title} Snooze`}
          onPress={() => onEditField('snooze')}
          styles={styles}
          t={t}
        />
        <View style={styles.removeWrap}>
          <Button
            variant="secondary"
            destructive
            size="sm"
            label="Remove"
            accessibilityLabel="Remove"
            onPress={onRemove}
            leftIcon={<Icon name="trash" size={16} color={t.error.primary} />}
          />
        </View>
      </View>
    </List>
  );
}

/**
 * The stored reminder as the three detail rows read it.
 *
 * The card is entirely derived — there is no separate display copy to keep in
 * step with the numbers underneath.
 */
function toView(reminder) {
  const due = reminder.enabled ? nextDueAt(reminder) : null;
  return {
    nextLabel: due ? `Next reminder: ${longDate(due)}` : null,
    dateLabel: dateLabelFor(reminder),
    dateValue: reminderDateValue(reminder),
    frequency: frequencyValue(reminder.intervalDays),
    snooze: reminder.snoozedUntil ? `Until ${shortDate(new Date(reminder.snoozedUntil))}` : 'None',
  };
}

export default function RemindersScreen({ plantId, plantName }) {
  const insets = useSafeAreaInsets();
  const { back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const garden = useGarden();

  // Id of the reminder pending removal (drives the confirm Dialog); null = closed.
  const [pendingRemove, setPendingRemove] = useState(null);
  // Value editor: { id, field } while a detail row's sheet is open (null = closed).
  const [editor, setEditor] = useState(null);
  // Keep the last-edited target while the sheet slides out, so it doesn't blank.
  const [editorOpen, setEditorOpen] = useState(false);
  // The three-step "Add new reminder" flow (nav + and the bottom row).
  const [addOpen, setAddOpen] = useState(false);

  const plant = plantId ? garden.getPlant(plantId) : null;
  const reminders = plant ? garden.remindersFor(plant.id) : [];

  // Both sheets are Modals on this one screen, and iOS won't stack two — the UI
  // already makes them mutually exclusive (whichever is open covers the other's
  // trigger), but close the sibling explicitly so that stays true by construction.
  const openEditField = (id, field) => {
    setAddOpen(false);
    setEditor({ id, field });
    setEditorOpen(true);
  };
  const openAdd = () => {
    setEditorOpen(false);
    setAddOpen(true);
  };

  const editing = editor ? reminders.find((r) => r.id === editor.id) : null;
  const editingView = editing ? toView(editing) : null;

  /** Translate a wheel's display string back into what the store keeps. */
  const applyEdit = (value) => {
    if (!editor || !editing) return;
    const { id, field } = editor;
    if (field === 'frequency') {
      garden.updateReminder(id, { intervalDays: parseFrequency(value, editing.intervalDays) });
      return;
    }
    if (field === 'snooze') {
      // "None" parses to 0, which the store reads as "clear the snooze".
      garden.snoozeReminder(id, durationMs(value));
      return;
    }
    // The date row anchors the schedule: once something has been done it is the
    // last completion, before that it is the start.
    const date = parseShortDate(value);
    if (!date) return;
    garden.updateReminder(
      id,
      editing.lastDoneAt
        ? { lastDoneAt: date.toISOString() }
        : { startAt: date.toISOString() },
    );
  };

  const addReminder = (draft) => {
    if (!plant) return;
    garden.addReminder(plant.id, {
      action: 'custom',
      title: draft.title,
      intervalDays: parseFrequency(draft.frequency),
      startAt: (parseShortDate(draft.dateValue) ?? new Date()).toISOString(),
    });
  };

  const confirmRemove = () => {
    garden.deleteReminder(pendingRemove);
    setPendingRemove(null);
  };

  const pending = reminders.find((r) => r.id === pendingRemove);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar
          title="Edit Reminders"
          subtitle={plant?.nickname ?? plantName}
          leading="back"
          onLeadingPress={back}
          divider={false}
          actions={
            plant
              ? [
                {
                  icon: <Icon name="add" size={20} color={t.text.primary} />,
                  onPress: openAdd,
                  accessibilityLabel: 'Add reminder',
                },
              ]
              : []
          }
        />
      </View>

      {plant ? (
        <ScrollView
          contentContainerStyle={{
            padding: space[16],
            paddingBottom: insets.bottom + space[24],
            gap: space[16],
          }}
          showsVerticalScrollIndicator={false}
        >
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              view={toView(reminder)}
              onToggle={() => garden.toggleReminder(reminder.id, !reminder.enabled)}
              onEditField={(field) => openEditField(reminder.id, field)}
              onRemove={() => setPendingRemove(reminder.id)}
              styles={styles}
              t={t}
            />
          ))}

          <List variant="card">
            <ListItem title="Add new reminder" onPress={openAdd} />
          </List>
        </ScrollView>
      ) : (
        // Reached without a plant — the only way in now is from a plant, so
        // this is a dead end rather than a state to design around.
        <View style={styles.emptyWrap}>
          <State
            icon={<Icon name="plant" size={24} color={t.text.primary} />}
            iconVariant="secondary"
            title="No plant selected"
            subtitle="Open a plant to edit its reminders."
          />
        </View>
      )}

      <Dialog
        testID="remove-dialog"
        visible={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title="Remove reminder?"
        description={
          pending ? `“${pending.title}” will be removed from this plant’s reminders.` : undefined
        }
        primaryAction={{ label: 'Remove reminder', destructive: true, onPress: confirmRemove }}
        secondaryAction={{ label: 'Cancel', onPress: () => setPendingRemove(null) }}
      />

      <ReminderValueSheet
        visible={editorOpen}
        field={editor?.field}
        reminder={editingView}
        onClose={() => setEditorOpen(false)}
        onConfirm={applyEdit}
      />

      <AddReminderSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onConfirm={addReminder}
      />
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    chip: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    details: { paddingHorizontal: space[16], paddingBottom: space[12], gap: space[4] },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: space[4],
    },
    detailLabel: { ...typography.bodyLarge, color: t.text.primary },
    detailValue: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
    detailValueText: { ...typography.bodyLarge, color: t.text.secondary },
    removeWrap: { paddingTop: space[8] },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: space[48] },
  });
