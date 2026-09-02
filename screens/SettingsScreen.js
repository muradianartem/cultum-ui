import { useMemo, useRef, useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dialog, Icon, List, ListItem, NavigationBar, TabBar } from '../components';
import { useRouter } from '../routing';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/foundations';
import { TABS } from './todayData';

// Settings — a tab-level destination (not a pushed screen), so the bottom
// TabBar stays visible with "Settings" active and the NavigationBar has no
// back affordance. V1 carries a single option: Log out.
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, reset } = useRouter();
  const { signOut } = useAuth();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busy, setBusy] = useState(false);

  // A successful signOut flips AuthProvider to 'signedOut', which unmounts this
  // whole tree from AuthGate — so guard the trailing setState.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // signOut() never rejects: it swallows the server revoke's errors and clears
  // the local session regardless, so an offline logout still lands on Login.
  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    await signOut();
    if (mounted.current) setBusy(false);
  }

  // TabBar wants icon nodes; resolve each tab's icon name to an <Icon>.
  const tabBarTabs = TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <Icon name={tab.icon} size={24} color={t.text.primary} />,
  }));

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar title="Settings" divider={false} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: space[16], gap: space[16] }}
        showsVerticalScrollIndicator={false}
      >
        <List variant="card">
          <ListItem
            title="Log out"
            before={<Icon name="logout" size={20} color={t.error.primary} />}
            after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
            onPress={() => setConfirmLogout(true)}
          />
        </List>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
        <TabBar
          tabs={tabBarTabs}
          value="settings"
          onChange={(value) => {
            // Today is the router's root — reset so Settings doesn't pile up
            // in the back stack. Discover/Rooms are inert (as on TodayScreen).
            if (value === 'today') reset('today');
            if (value === 'scan') navigate('scan-camera');
          }}
        />
      </View>

      <Dialog
        testID="logout-dialog"
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Log out?"
        description="You’ll need to sign in again to see your plants."
        primaryAction={{
          label: 'Log out',
          destructive: true,
          loading: busy,
          onPress: handleLogout,
        }}
        secondaryAction={{ label: 'Cancel', onPress: () => setConfirmLogout(false) }}
      />
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },
    bottom: { alignItems: 'center', backgroundColor: t.background.primary },
  });
