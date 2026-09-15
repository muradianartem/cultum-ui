// Settings → Send feedback — Figma nodes 394:756 and 485:25653 (the open
// selector).
//
// A topic dropdown, a message box with a counter, and a Send button that stays
// disabled until both are filled.
//
// THE ENDPOINT DOES NOT EXIST YET. api/feedback.js#sendFeedback is a stub that
// resolves without delivering anything — a deliberate call, so the screens
// could ship ahead of the API. Everything else here is real, and wiring the
// endpoint is a one-file change with nothing to alter on this screen. See that
// file's header for the caveat about shipping it as-is.

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Dropdown, DropdownMenu, TextArea } from '../../components';
import { useRouter } from '../../routing';
import { useSnackbar } from '../../components/SnackbarProvider';
import { useAuth } from '../../auth/AuthProvider';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_TOPICS, sendFeedback } from '../../api/feedback';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';
import SettingsShell from './SettingsShell';

export default function SendFeedbackScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { back } = useRouter();
  const { show } = useSnackbar();
  const { profileEmail } = useAuth();

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
      await sendFeedback({ topic, message: message.trim() });
      show({ label: 'Thanks — your feedback is on its way.' });
      back();
    } catch (e) {
      setBusy(false);
      setError(e?.message ?? 'Could not send that. Try again.');
    }
  }

  return (
    <SettingsShell
      title="Send feedback"
      footer={
        <>
          <Button
            variant="primary"
            size="lg"
            label="Send feedback"
            disabled={!canSend}
            loading={busy}
            onPress={send}
          />
          {profileEmail ? (
            <Text style={styles.caption}>{`We'll reply to ${profileEmail}.`}</Text>
          ) : null}
        </>
      }
    >
      <View style={styles.field}>
        <Dropdown
          label="Topic"
          placeholder="Select a topic"
          value={chosen?.title}
          open={open}
          error={error}
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
  });
