// Settings → Notifications — Figma node 421:4376 (the long variant, drawn
// behind the Reminder time sheet).
//
// Two switches and a time. The distinctions between them are the substance of
// this screen:
//
//   • "App notifications" is a master switch over OS *delivery* only. It never
//     touches a reminder's own `enabled` flag — that one is pushed to the
//     server, so writing it here would silently disable the user's reminders on
//     their other devices.
//   • "Email notifications" is a server-side preference and the API has no
//     endpoint for it. The row is drawn and disabled rather than omitted: the
//     design calls for it, and a switch that pretends to work is worse than one
//     that visibly does not.
//   • "Reminder time" is global, and changing it re-times every reminder the
//     user owns. See the reducer's `reminders/timeOfDay`.

import { useState } from 'react';
import { Linking } from 'react-native';
import { Icon, ListItem, StateIcon, Toggle } from '../../components';
import { usePrefs } from '../../prefs';
import { useAuth } from '../../auth/AuthProvider';
import { useGarden } from '../../store/GardenProvider';
import { timeLabel } from '../../store/format';
import { useTheme } from '../../theme/ThemeProvider';
import SettingsShell, { Prose, Section } from './SettingsShell';
import ReminderTimeSheet from './ReminderTimeSheet';

export default function NotificationsScreen() {
  const t = useTheme();
  const { profileEmail } = useAuth();
  const { retimeAllReminders } = useGarden();
  const {
    notificationsEnabled,
    notificationPermission,
    reminderTime,
    setNotificationsEnabled,
    setReminderTime,
  } = usePrefs();

  const [sheetOpen, setSheetOpen] = useState(false);

  // The switch shows what will actually happen, not what was asked for. The
  // preference records intent and stays true through a refusal (so allowing it
  // later in iOS Settings just works) — but a switch reading "on" while nothing
  // is ever delivered is a lie.
  const granted = notificationPermission === 'granted';
  const effective = notificationsEnabled && granted;
  const blocked = notificationsEnabled && !granted && notificationPermission !== 'undetermined';

  const badge = (name) => (
    <StateIcon>
      <Icon name={name} size={20} color={t.text.primary} />
    </StateIcon>
  );

  const appSubtitle = blocked
    ? 'Blocked in iOS Settings — tap to allow'
    : 'We say “time to check”, never “water now”';

  const emailSubtitle = profileEmail
    ? `The same nudge, to ${profileEmail}`
    : 'The same nudge, by email';

  function applyTime(next) {
    // Two writes, deliberately: the preference is the default for reminders
    // made from here on, and the action re-times the ones that already exist.
    setReminderTime(next);
    retimeAllReminders(next);
  }

  return (
    <SettingsShell title="Notifications">
      <Prose>
        One nudge when a plant is likely ready for a look — never a daily timer. Choose where it
        lands.
      </Prose>

      <Section label="Where they arrive">
        <ListItem
          title="App notifications"
          subtitle={appSubtitle}
          before={badge('bell')}
          divider
          // When the OS has refused, the row is the remedy: tapping either the
          // row or the switch opens Settings rather than toggling something
          // that cannot take effect. Same shape as ScanCameraScreen's
          // permission handling.
          onPress={blocked ? () => Linking.openSettings() : undefined}
          after={
            <Toggle
              value={effective}
              accessibilityLabel="App notifications"
              onValueChange={(next) =>
                blocked ? Linking.openSettings() : setNotificationsEnabled(next)
              }
            />
          }
        />
        <ListItem
          title="Email notifications"
          subtitle={emailSubtitle}
          before={badge('mail')}
          after={<Toggle value={false} disabled accessibilityLabel="Email notifications" />}
        />
      </Section>

      <Prose>
        Every reminder is tracked end to end. One that does not arrive is treated as an outage.
      </Prose>

      <Section label="When they arrive">
        <ListItem
          title="Reminder time"
          before={badge('clock')}
          value={timeLabel(reminderTime)}
          after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
          onPress={() => setSheetOpen(true)}
        />
      </Section>

      <ReminderTimeSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={reminderTime}
        onConfirm={applyTime}
      />
    </SettingsShell>
  );
}
