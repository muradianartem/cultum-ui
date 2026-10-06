// Settings → Send feedback — Figma nodes 394:756 and 485:25653 (the open
// selector).
//
// A topic dropdown, a message box with a counter, and an Email feedback button
// that stays disabled until both are filled.
//
// There is no feedback endpoint, so the button hands the message to the user's
// mail app, pre-addressed to the support inbox (api/feedback.js). The app can't
// know whether they then send it, so there is no "sent" message and the screen
// stays put — the draft is still here if they come back. If Mail can't be
// opened, the error names the address and "Other ways to contact us" leads to
// the Contact us screen.
//
// The button label, the caption and the contact link are not in Figma yet.

import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button, Dropdown, DropdownMenu, TextArea, TextButton } from '../../components';
import { useRouter } from '../../routing';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_TOPICS, feedbackMailto } from '../../api/feedback';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';
import { APP_BUILD, APP_VERSION, SUPPORT_EMAIL } from './appInfo';
import SettingsShell from './SettingsShell';

export default function SendFeedbackScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { navigate } = useRouter();

  const [topic, setTopic] = useState(null);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const chosen = FEEDBACK_TOPICS.find((o) => o.key === topic) ?? null;
  const canSend = !!topic && message.trim().length > 0 && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      await Linking.openURL(
        feedbackMailto({ topic, message, appVersion: APP_VERSION, build: APP_BUILD }),
      );
    } catch {
      // No mail account or app. The draft stays; the address is the way out.
      setError(`Couldn't open Mail. You can reach us at ${SUPPORT_EMAIL}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsShell
      title="Send feedback"
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            variant="primary"
            size="lg"
            label="Email feedback"
            disabled={!canSend}
            loading={busy}
            onPress={send}
          />
          <Text style={styles.caption}>{`Opens your mail app, addressed to ${SUPPORT_EMAIL}.`}</Text>
          <TextButton
            label="Other ways to contact us"
            tone="muted"
            size="sm"
            onPress={() => navigate('settings-contact')}
            style={styles.contact}
          />
        </>
      }
    >
      <View style={styles.field}>
        <Dropdown
          label="Topic"
          placeholder="Select a topic"
          value={chosen?.title}
          open={open}
          onPress={() => setOpen((v) => !v)}
        />
        {/* Anchored under the field rather than in a portal: DropdownMenu draws
            the surface but leaves positioning to the caller, and the page does
            not scroll far enough for a fixed overlay to be worth it. */}
        {open ? (
          <View style={styles.menuAnchor}>
            <DropdownMenu
              style={styles.menu}
              items={FEEDBACK_TOPICS.map((o) => ({
                key: o.key,
                title: o.title,
                subtitle: o.subtitle,
                selected: o.key === topic,
                onPress: () => {
                  setTopic(o.key);
                  setOpen(false);
                },
              }))}
            />
          </View>
        ) : null}
      </View>

      <TextArea
        label="Your message"
        placeholder="Write any details you want to let us to know about"
        value={message}
        onChangeText={setMessage}
        maxLength={FEEDBACK_MAX_LENGTH}
      />
    </SettingsShell>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    field: { zIndex: 2 },
    menuAnchor: { marginTop: space[4] },
    menu: { width: '100%' },
    caption: { ...typography.caption, color: t.text.secondary, textAlign: 'center' },
    error: { ...typography.bodyMedium, color: t.error.primary, textAlign: 'center' },
    contact: { alignSelf: 'center' },
  });
