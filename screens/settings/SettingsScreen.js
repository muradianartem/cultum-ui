// Settings — Figma "Settings" (node 387:1728) and the two confirmation dialogs
// (node 486:27101).
//
// A tab destination, not a pushed screen: large title, no back affordance, and
// the TabBar stays visible with "Settings" active. Everything below it is a
// pushed inner page or a sheet this screen owns — iOS will not present a second
// Modal over an open one, so the sheets are rendered here as siblings and only
// ever one is visible at a time.

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as StoreReview from 'expo-store-review';
import {
  Avatar,
  Card,
  Dialog,
  Icon,
  ListItem,
  NavigationBar,
  StateIcon,
  TabBar,
} from '../../components';
import { useRouter } from '../../routing';
import { useAuth } from '../../auth/AuthProvider';
import { useEntitlement } from '../../billing/EntitlementProvider';
import { usePrefs } from '../../prefs';
import { deleteAccount } from '../../api/account';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';
import { TABS } from '../navConfig';
import { Section } from './SettingsShell';
import EditProfileSheet from './EditProfileSheet';
import AppearanceSheet, { APPEARANCE_LABEL } from './AppearanceSheet';
import { APP_VERSION } from './appInfo';

/** Avatar renders what it is given, and the design shows a single letter. */
const initialOf = (name) => String(name ?? '').trim().charAt(0).toUpperCase() || '?';

/** Which one-off surface is open. Only ever one — see the file header. */
const SHEET = { none: null, profile: 'profile', appearance: 'appearance' };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, reset } = useRouter();
  const { signOut, profileName, profileEmail } = useAuth();
  const { ready, isPlus } = useEntitlement();
  const { appearance } = usePrefs();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [sheet, setSheet] = useState(SHEET.none);
  const [confirm, setConfirm] = useState(null); // 'logout' | 'delete' | null
  const [busy, setBusy] = useState(false);
  // What DELETE /users/me said about a store subscription we cannot cancel for
  // them. Shown before the sign-out that unmounts this whole tree.
  const [deleteNotice, setDeleteNotice] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const chevron = <Icon name="chevron-right" size={20} color={t.text.primary} />;
  const badge = (name) => (
    <StateIcon>
      <Icon name={name} size={20} color={t.text.primary} />
    </StateIcon>
  );

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    // signOut() never rejects: it swallows the server revoke's errors and
    // clears the local session regardless, so an offline logout still lands on
    // Login. No trailing setState — AuthGate unmounts this tree.
    await signOut();
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const result = await deleteAccount();
      setConfirm(null);
      // The account is gone either way; the only question is whether we owe the
      // user a word about a subscription that is still billing them.
      if (result?.store_subscription_active && result?.message) {
        setDeleteNotice(result.message);
        setBusy(false);
        return;
      }
      await signOut();
    } catch (e) {
      setBusy(false);
      setDeleteError(e?.message ?? 'Could not delete your account. Try again.');
    }
  }

  function rateTheApp() {
    // Resolves false outside a store build (TestFlight included), where iOS
    // shows nothing at all — so there is no point navigating anywhere either.
    StoreReview.hasAction().then((can) => can && StoreReview.requestReview());
  }

  const tabBarTabs = TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <Icon name={tab.icon} size={24} color={t.text.primary} />,
  }));

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar title="Settings" size="lg" divider={false} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Nothing at all until the answer is known. Flashing an upgrade pitch
            at somebody already paying is the worse of the two wrong frames, and
            the entitlement hydrates from disk so this window is empty on every
            launch after the first. */}
        {ready && !isPlus ? (
          <Card
            // <Card> draws the 48px badge itself, so this is the glyph alone.
            icon={<Icon name="power" size={24} color={t.text.primary} />}
            title="Upgrade to Cultum Plus"
            subtitle="Unlimited plants, smarter reminders and rooms."
            primaryAction={{ label: 'Upgrade', onPress: () => navigate('paywall') }}
          />
        ) : null}

        <Section>
          <ListItem
            title={profileName ?? 'Your profile'}
            // No placeholder when the email is unknown — a session established
            // before it was recorded, or an Apple sign-in that refused the
            // scope. "Unknown" would read as an error the user cannot fix.
            subtitle={profileEmail ?? undefined}
            before={<Avatar initials={initialOf(profileName)} size="md" />}
            after={<Icon name="edit-pen" size={20} color={t.text.primary} />}
            onPress={() => setSheet(SHEET.profile)}
            accessibilityLabel="Edit profile"
          />
        </Section>

        <Section label="Preferences">
          <ListItem
            title="Notifications"
            subtitle="Where the nudge lands"
            before={badge('bell')}
            value="App"
            after={chevron}
            divider
            onPress={() => navigate('settings-notifications')}
          />
          <ListItem
            title="Appearance"
            subtitle="Light, dark, or whatever the phone is doing"
            before={badge('sun')}
            value={APPEARANCE_LABEL[appearance]}
            after={chevron}
            onPress={() => setSheet(SHEET.appearance)}
          />
        </Section>

        <Section label="Help & feedback">
          <ListItem
            title="Send feedback"
            before={badge('chat')}
            after={chevron}
            divider
            onPress={() => navigate('settings-feedback')}
          />
          <ListItem
            title="Contact us"
            before={badge('mail')}
            after={chevron}
            divider
            onPress={() => navigate('settings-contact')}
          />
          <ListItem
            title="Rate the app"
            before={badge('star')}
            after={chevron}
            divider
            onPress={rateTheApp}
          />
          <ListItem
            title="About Cultum"
            subtitle="Version, privacy, terms and licences"
            before={badge('info')}
            value={APP_VERSION}
            after={chevron}
            onPress={() => navigate('settings-about')}
          />
        </Section>

        <Section>
          <ListItem
            title="Log out"
            before={badge('logout')}
            after={chevron}
            divider
            onPress={() => setConfirm('logout')}
          />
          <ListItem
            title="Delete account"
            destructive
            before={badge('trash')}
            after={chevron}
            onPress={() => {
              setDeleteError(null);
              setConfirm('delete');
            }}
          />
        </Section>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
        <TabBar
          tabs={tabBarTabs}
          value="settings"
          onChange={(value) => {
            // Today is the router's root — reset so Settings doesn't pile up
            // in the back stack. Discover is inert (as on TodayScreen).
            if (value === 'today') reset('today');
            if (value === 'scan') navigate('scan-camera');
            if (value === 'rooms') navigate('rooms');
          }}
        />
      </View>

      <EditProfileSheet
        visible={sheet === SHEET.profile}
        onClose={() => setSheet(SHEET.none)}
      />
      <AppearanceSheet
        visible={sheet === SHEET.appearance}
        onClose={() => setSheet(SHEET.none)}
      />

      <Dialog
        testID="logout-dialog"
        visible={confirm === 'logout'}
        onClose={() => setConfirm(null)}
        title="Log out?"
        description="You can sign back in anytime. Nothing is deleted."
        primaryAction={{ label: 'Log out', loading: busy, onPress: handleLogout }}
        secondaryAction={{ label: 'Cancel', onPress: () => setConfirm(null) }}
      />

      <Dialog
        testID="delete-account-dialog"
        visible={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete account?"
        description={
          deleteError ??
          'Your plants, journal and care history will be removed. This cannot be undone.'
        }
        primaryAction={{
          label: 'Delete',
          destructive: true,
          loading: busy,
          onPress: handleDelete,
        }}
        secondaryAction={{ label: 'Cancel', onPress: () => setConfirm(null) }}
      />

      {/* The account is already gone by the time this shows. Its only job is to
          say the one thing the server could not do for them — cancel a store
          subscription that is still billing. */}
      <Dialog
        testID="delete-notice-dialog"
        visible={deleteNotice != null}
        onClose={signOut}
        showClose={false}
        title="Account deleted"
        description={deleteNotice ?? ''}
        primaryAction={{ label: 'Done', onPress: signOut }}
      />
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },
    content: {
      paddingTop: space[12],
      paddingHorizontal: space[16],
      paddingBottom: space[32],
      gap: space[24],
    },
    bottom: { alignItems: 'center', backgroundColor: t.background.primary },
  });
