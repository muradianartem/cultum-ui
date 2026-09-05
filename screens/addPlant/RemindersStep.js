// Step 3 of the add-a-plant flow (Figma "Add a plant / Reminders",
// node 338:2949): watering and fertilizing, each off until the user opts in,
// plus an "Add custom reminder" row that opens the existing AddReminderSheet
// (as does the nav bar's + action).
//
// Toggling one on doesn't ask a second question — the schedule comes off the
// plant's own care facts (see addPlantData.defaultReminders).
//
// Chrome-less — AddPlantScreen supplies the nav bar and the footer.

import { ScrollView, StyleSheet } from 'react-native';
import { Toggle } from '../../components';
import { space } from '../../theme/foundations';
import { reminderSubtitle } from './addPlantData';
import CardRow from './CardRow';

export default function RemindersStep({ reminders, onToggle, onAddCustom }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
    >
      {reminders.map((r) => (
        <CardRow
          key={r.id}
          icon={r.icon}
          title={r.title}
          subtitle={reminderSubtitle(r)}
          after={
            <Toggle
              value={r.enabled}
              onValueChange={() => onToggle(r.id)}
              accessibilityLabel={`Enable ${r.title}`}
            />
          }
        />
      ))}

      <CardRow icon="add" title="Add custom reminder" onPress={onAddCustom} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { padding: space[16], gap: space[8] },
});
