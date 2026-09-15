// Settings → Contact us — Figma nodes 394:757 and 486:26867 (the copied state).
//
// One centred card with the address and a copy button that confirms in place —
// the button becomes a tick reading "Email Copied" and reverts. No snackbar:
// the design puts the feedback on the control itself, which is also the only
// place the user is looking.

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Icon, StateIcon } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/foundations';
import SettingsShell from './SettingsShell';
import { SUPPORT_EMAIL } from './appInfo';

/** How long the button stays in its confirmed state. */
const COPIED_MS = 2000;

export default function ContactUsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <SettingsShell title="Contact us">
      <View style={styles.card}>
        <StateIcon size="lg">
          <Icon name="mail" size={24} color={t.text.primary} />
        </StateIcon>
        <Text style={styles.address}>{SUPPORT_EMAIL}</Text>
        <Text style={styles.blurb}>We reply within one working day.</Text>
        <Button
          variant="secondary"
          size="md"
          label={copied ? 'Email Copied' : 'Copy Email Address'}
          leftIcon={
            <Icon name={copied ? 'check' : 'copy'} size={20} color={t.text.primary} />
          }
          onPress={copy}
        />
      </View>
    </SettingsShell>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: space[12],
      padding: space[16],
      borderRadius: radius[16],
      backgroundColor: t.surface.primary,
    },
    address: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    blurb: { ...typography.bodyMedium, color: t.text.secondary, textAlign: 'center' },
  });
