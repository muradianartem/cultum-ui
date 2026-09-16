// Settings → Appearance — Figma "Sheet · Appearance" (node 395:798).
//
// A single-select list with a check on the chosen row, not radio controls: that
// is what the design draws, and it is what iOS does elsewhere.
//
// The choice is saved to preferences and applied at once: App.js hands it to
// <ThemeProvider> as the controlled mode.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Icon, List, ListItem } from '../../components';
import { usePrefs } from '../../prefs';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';

/** The value shown on the Settings row for each mode. */
export const APPEARANCE_LABEL = { system: 'System', light: 'Light', dark: 'Dark' };

const OPTIONS = [
  { value: 'system', title: 'System', subtitle: 'Follow your phone' },
  { value: 'light', title: 'Light', subtitle: 'Always light' },
  { value: 'dark', title: 'Dark', subtitle: 'Always dark' },
];

export default function AppearanceSheet({ visible, onClose }) {
  const { appearance, setAppearance } = usePrefs();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Appearance"
      testID="appearance-sheet"
    >
      <View style={styles.body}>
        <List variant="card" style={styles.list}>
          {OPTIONS.map((option, i) => (
            <ListItem
              key={option.value}
              title={option.title}
              divider={i < OPTIONS.length - 1}
              after={
                appearance === option.value ? (
                  <Icon name="check" size={20} color={t.text.primary} />
                ) : null
              }
              accessibilityLabel={option.title}
              onPress={() => {
                setAppearance(option.value);
                onClose?.();
              }}
            />
          ))}
        </List>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    body: { paddingHorizontal: space[16] },
    // A shade darker than the page's cards: the sheet's own ground is already
    // #ECEDEC, so a list at the same value would disappear into it.
    list: { backgroundColor: t.surface.secondary },
  });
