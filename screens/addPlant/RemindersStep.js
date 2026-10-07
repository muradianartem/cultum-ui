// Step 3 of the add-a-plant flow (Figma section "Reminders", node 1:7888):
// watering, fertilizing and repotting, each on by default, laid out as the same
// ReminderCard Edit Reminders uses — a "Last watering" date and a Frequency the
// user can change before anything is saved. Switching a reminder off folds
// its card down to the header. Custom reminders added through the
// "Add custom reminder" row (or the nav bar's + action) can be removed again.
//
// The schedule starts from the plant's own care facts (see
// addPlantData.defaultReminders), counted from a last-done of today.
//
// Chrome-less — AddPlantScreen supplies the nav bar, the footer and the sheets.

import { ScrollView, StyleSheet } from 'react-native';
import { PlusBadge } from '../../components';
import { space } from '../../theme/foundations';
import ReminderCard from '../ReminderCard';
import { draftView } from './addPlantData';
import CardRow from './CardRow';

export default function RemindersStep({
  reminders,
  onToggle,
  onEditField,
  onRemove,
  onAddCustom,
  customLocked = false,
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
    >
      {reminders.map((r) => (
        <ReminderCard
          key={r.id}
          title={r.title}
          action={r.action}
          enabled={r.enabled}
          view={draftView(r)}
          collapsible
          onToggle={() => onToggle(r.id)}
          onEditField={(field) => onEditField(r.id, field)}
          onRemove={r.action === 'custom' ? () => onRemove(r.id) : undefined}
        />
      ))}

      <CardRow
        icon="add"
        title="Add custom reminder"
        after={customLocked ? <PlusBadge /> : undefined}
        onPress={onAddCustom}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { padding: space[16], gap: space[16] },
});
