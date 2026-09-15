// Settings → About — Figma "Settings / About" (node 394:759).
//
// Two groups of plain rows: what this build is, and where the legal pages are.
// Neither has a leading icon, and the App info rows have no chevron either —
// they are facts, not destinations.

import { useMemo } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Icon, ListItem } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';
import SettingsShell, { Section } from './SettingsShell';
import { APP_BUILD, APP_VERSION, LEGAL_LINKS } from './appInfo';

// The release month is not derivable from the bundle — CFBundleVersion is a
// counter, not a date — so it is stated here and moves with each release.
const RELEASED = 'August 2026';

export default function AboutScreen() {
  const t = useTheme();
  const info = useMemo(
    () => [
      { title: 'Version', value: APP_VERSION },
      { title: 'Build', value: APP_BUILD },
      { title: 'Released', value: RELEASED },
    ],
    [],
  );

  return (
    <SettingsShell title="About">
      <Section label="App info">
        {info.map((row, i) => (
          <ListItem
            key={row.title}
            title={row.title}
            value={row.value}
            divider={i < info.length - 1}
          />
        ))}
      </Section>

      <Section label="Legal">
        {LEGAL_LINKS.map((link, i) => (
          <ListItem
            key={link.title}
            title={link.title}
            value={link.value}
            divider={i < LEGAL_LINKS.length - 1}
            after={<Icon name="external-link" size={20} color={t.text.primary} />}
            // In-app browser rather than Safari: it keeps the user in Cultum,
            // and expo-web-browser is already a dependency (the OAuth flow uses
            // it), so this costs no native surface.
            onPress={() => WebBrowser.openBrowserAsync(link.url)}
          />
        ))}
      </Section>
    </SettingsShell>
  );
}
