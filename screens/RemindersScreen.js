import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Dialog,
  Icon,
  List,
  ListItem,
  NavigationBar,
  Toggle,
} from '../components';
import { useRouter } from '../routing';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';
import { KIND_META, PLANT_NAME, REMINDERS } from './reminderData';
import ReminderValueSheet from './ReminderValueSheet';

// Coloured icon chip — a 40×40 rounded-full tinted square holding a 20px icon.
// Resolves the reminder's `kind` to an icon + semantic tone (copying the
// `taskTile` pattern from ProductPage), so it re-tints in light/dark for free.
function Chip({ kind, styles, t }) {
  const meta = KIND_META[kind] ?? KIND_META.custom;
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

// One reminder card: a card-style List panel with a (non-pressable) header row —
// chip, title, optional "Next reminder" subtitle, enable Toggle — followed by
// three pressable detail rows (date, frequency, snooze).
function ReminderCard({ reminder, onToggle, onEditField, onRemove, styles, t }) {
  return (
    <List variant="card">
      <ListItem
        before={<Chip kind={reminder.kind} styles={styles} t={t} />}
        title={reminder.title}
        subtitle={reminder.nextLabel}
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
          label={reminder.dateLabel}
          value={reminder.dateValue}
          accessibilityLabel={`${reminder.title} date`}
          onPress={() => onEditField('date')}
          styles={styles}
          t={t}
        />
        <DetailRow
          label="Frequency"
          value={reminder.frequency}
          accessibilityLabel={`${reminder.title} Frequency`}
          onPress={() => onEditField('frequency')}
          styles={styles}
          t={t}
        />
        <DetailRow
          label="Snooze for"
          value={reminder.snooze}
          accessibilityLabel={`${reminder.title} Snooze`}
          onPress={() => onEditField('snooze')}
          styles={styles}
          t={t}
        />
        {reminder.removable ? (
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
        ) : null}
      </View>
    </List>
  );
}

// The Edit Reminders screen — a per-plant list of care reminders. Composed from
// Cultum primitives and themed via useTheme() (light/dark), spacing from
// theme/foundations. Mock data + local state (V1); mirrors ProductPage/TodayScreen.
export default function RemindersScreen({ plantName }) {
  const insets = useSafeAreaInsets();
  const { back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [reminders, setReminders] = useState(REMINDERS);
  // Id of the reminder pending removal (drives the confirm Dialog); null = closed.
  const [pendingRemove, setPendingRemove] = useState(null);
  // Value editor: { id, field } while a detail row's sheet is open (null = closed).
  const [editor, setEditor] = useState(null);
  // Keep the last-edited target while the sheet slides out, so it doesn't blank.
  const [editorOpen, setEditorOpen] = useState(false);

  const toggle = (id) =>
    setReminders((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );

  const openEditField = (id, field) => {
    setEditor({ id, field });
    setEditorOpen(true);
  };
  const closeEditor = () => setEditorOpen(false);
  const applyEdit = (value) => {
    if (!editor) return;
    const { id, field } = editor;
    const key = field === 'date' ? 'dateValue' : field;
    setReminders((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const editing = editor ? reminders.find((r) => r.id === editor.id) : null;

  const askRemove = (id) => setPendingRemove(id);
  const cancelRemove = () => setPendingRemove(null);
  const confirmRemove = () => {
    setReminders((rs) => rs.filter((r) => r.id !== pendingRemove));
    setPendingRemove(null);
  };

  const pending = reminders.find((r) => r.id === pendingRemove);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar
          title="Edit Reminders"
          subtitle={plantName ?? PLANT_NAME}
          leading="back"
          onLeadingPress={back}
          divider={false}
        />
      </View>

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
            onToggle={() => toggle(reminder.id)}
            onEditField={(field) => openEditField(reminder.id, field)}
            onRemove={() => askRemove(reminder.id)}
            styles={styles}
            t={t}
          />
        ))}

        <List variant="card">
          <ListItem title="Add Reminder" onPress={() => {}} />
        </List>
      </ScrollView>

      <Dialog
        testID="remove-dialog"
        visible={pendingRemove !== null}
        onClose={cancelRemove}
        title="Remove reminder?"
        description={
          pending
            ? `“${pending.title}” will be removed from this plant’s reminders.`
            : undefined
        }
        primaryAction={{
          label: 'Remove reminder',
          destructive: true,
          onPress: confirmRemove,
        }}
        secondaryAction={{ label: 'Cancel', onPress: cancelRemove }}
      />

      <ReminderValueSheet
        visible={editorOpen}
        field={editor?.field}
        reminder={editing}
        onClose={closeEditor}
        onConfirm={applyEdit}
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
  });
