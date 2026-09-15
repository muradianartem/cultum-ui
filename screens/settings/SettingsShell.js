// The chrome every Settings inner page shares: a small NavigationBar with a
// back button, and a scrolling column on the page ground.
//
// The root Settings screen does NOT use this — it is a tab destination, so it
// has a large title, no back affordance and a TabBar pinned underneath. That
// difference is the whole reason this is a shell for the inner pages rather
// than a wrapper for all of them.

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { List, NavigationBar } from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';

export default function SettingsShell({ title, children, contentStyle, footer }) {
  const insets = useSafeAreaInsets();
  const { back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar title={title} leading="back" onLeadingPress={back} divider={false} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          {
            paddingTop: space[12],
            paddingHorizontal: space[16],
            paddingBottom: insets.bottom + space[24],
            gap: space[24],
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space[16] }]}>{footer}</View>
      ) : null}
    </View>
  );
}

/**
 * A labelled group: the section header over its card. Figma puts 8px between
 * them and 24px between sections (the Content frame's own gap), so the header
 * belongs inside this rather than as a sibling.
 *
 * `label` is optional — the Account and Exits groups are headerless.
 */
export function Section({ label, children, style }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={[styles.section, style]}>
      {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}
      <List variant="card">{children}</List>
    </View>
  );
}

/** Free-standing explanatory copy between sections (the Notifications screen). */
export function Prose({ children }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return <Text style={styles.prose}>{children}</Text>;
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },
    footer: {
      paddingHorizontal: space[16],
      paddingTop: space[8],
      gap: space[8],
      backgroundColor: t.background.primary,
    },
    section: { gap: space[8] },
    sectionLabel: {
      ...typography.bodyMediumEmphasized,
      color: t.text.secondary,
    },
    prose: {
      ...typography.bodyMedium,
      color: t.text.secondary,
      textAlign: 'center',
    },
  });
