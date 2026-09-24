import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, Route, requireSubscription } from './routing';
import { ThemeProvider, useTheme, useThemeMode } from './theme/ThemeProvider';
import FontGate from './theme/FontGate';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { GardenProvider } from './store/GardenProvider';
import { clearState } from './store/persist';
import { clearPhotos } from './store/media';
import { clearEntitlement } from './lib/entitlementCache';
import { PrefsProvider, usePrefs } from './prefs';
import { EntitlementProvider } from './billing/EntitlementProvider';
import { cancelAll, configureNotifications } from './notifications';
import NotificationRouter from './notifications/NotificationRouter';
import LoginScreen from './screens/LoginScreen';
import { LoadingIndicator, SnackbarProvider } from './components';
import TodayScreen from './screens/TodayScreen';
import ProductPage from './screens/ProductPage';
import RemindersScreen from './screens/RemindersScreen';
import AddPlantScreen from './screens/addPlant/AddPlantScreen';
import RoomsScreen from './screens/rooms/RoomsScreen';
import RoomScreen from './screens/rooms/RoomScreen';
import PremiumGallery from './screens/PremiumGallery';
import SettingsScreen from './screens/settings/SettingsScreen';
import NotificationsScreen from './screens/settings/NotificationsScreen';
import SendFeedbackScreen from './screens/settings/SendFeedbackScreen';
import ContactUsScreen from './screens/settings/ContactUsScreen';
import AboutScreen from './screens/settings/AboutScreen';
import PaywallScreen from './screens/PaywallScreen';
import ScanCameraScreen from './screens/scan/ScanCameraScreen';
import ScanMatchesScreen from './screens/scan/ScanMatchesScreen';
import ScanSearchScreen from './screens/scan/ScanSearchScreen';
import OnboardingScreen from './screens/onboarding/OnboardingScreen';
import { OnboardingNavigator, OnboardingProvider, useOnboarding } from './onboarding';
// V2: full-screen photo viewer (Figma "Product Page / View Image"). Kept out of
// the V1 flow — re-enable this import and its route below when V2 ships.
// import ImageViewer from './screens/ImageViewer';

// A reminder that arrives while the user happens to be in the app is still a
// reminder, so notifications show a banner in the foreground too. Set once, at
// module scope, as the SDK expects.
configureNotifications();

// Chooses login vs. the app router based on async auth status. Gating happens
// here at the root (not via routing/guards, which are pure sync functions with
// no context access), so the Router only ever mounts once authenticated.
//
// Exported for test/support/integration.js, which mounts the real gate — its
// sign-out cleanup included — under a test shell.
export function AuthGate() {
  const { status, signedInVia, onboardingShown } = useAuth();
  const t = useTheme();

  // Signing out has to take the garden with it: the document on disk, the
  // pictures beside it and the notifications already queued with the OS all
  // outlive the React tree, and the next person to sign in on this device must
  // not inherit any of them.
  //
  // Only the user's *own* photos are cleared. The cached catalog images under
  // media/ are public — GET /media/{key} takes no bearer token and every user
  // of a species sees the same picture — so keeping them says nothing about who
  // was signed in, and means the next sign-in has its cards populated
  // immediately instead of re-downloading the same bytes.
  useEffect(() => {
    if (status === 'signedOut') {
      clearState();
      clearPhotos();
      cancelAll();
      // Unlike the preferences (which describe the device), this describes an
      // account — the next person to sign in must not inherit someone's Plus.
      clearEntitlement();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: t.background.primary }]}>
        <LoadingIndicator />
      </View>
    );
  }

  if (status === 'signedOut') {
    return <LoginScreen />;
  }

  return (
    // Every one of these sits above <Router> for the same reason: routing/Route.js
    // unmounts a screen the moment you navigate away, so anything that has to be
    // remembered — the garden, an open undo, whether this user is on Plus — has to
    // live outside whichever screen changed it.
    <EntitlementProvider>
      <GardenProvider>
        {/* Inside the garden so an open undo can still reach it — signing out
            takes both with it. */}
        <SnackbarProvider>
          {/* The account's onboarding_shown (read at sign-in) decides; the
              record on this device resumes an unfinished run. It picks the
              router's first route, so it has to sit above it. */}
          <OnboardingProvider signedInVia={signedInVia} serverShown={onboardingShown}>
            <AppRoutes />
          </OnboardingProvider>
        </SnackbarProvider>
      </GardenProvider>
    </EntitlementProvider>
  );
}

// The authenticated routes. A component of its own because <Router initial>
// comes from the onboarding record, which is only readable below its provider.
// `initialRoute` is fixed at the provider's mount, so this never remounts the
// router under the user.
function AppRoutes() {
  const { initialRoute } = useOnboarding();
  return (
    <Router initial={initialRoute}>
      {/* Not a route: it has to outlive whichever screen is on top, because
          a tapped reminder can arrive at any moment. */}
      <NotificationRouter />
      {/* Also not a route: it settles an onboarding checkpoint a previous
          launch left behind. */}
      <OnboardingNavigator />
      <Route name="onboarding" component={OnboardingScreen} />
      <Route name="today" component={TodayScreen} />
      <Route name="product" component={ProductPage} />
      <Route name="add-plant" component={AddPlantScreen} />
      <Route name="reminders" component={RemindersScreen} />
      <Route name="rooms" component={RoomsScreen} />
      <Route name="room" component={RoomScreen} />
      <Route name="settings" component={SettingsScreen} />
      <Route name="settings-notifications" component={NotificationsScreen} />
      <Route name="settings-feedback" component={SendFeedbackScreen} />
      <Route name="settings-contact" component={ContactUsScreen} />
      <Route name="settings-about" component={AboutScreen} />
      <Route name="scan-camera" component={ScanCameraScreen} />
      <Route name="scan-matches" component={ScanMatchesScreen} />
      <Route name="scan-search" component={ScanSearchScreen} />
      {/* Entered at the end of onboarding (with source: 'onboarding'), from
          the upgrade card in Settings, the room-limit gate, and as the
          subscription guard's fallback. There is no launch paywall any more:
          it would land on top of onboarding. */}
      <Route name="paywall" component={PaywallScreen} />
      <Route
        name="premium-gallery"
        guard={requireSubscription}
        component={PremiumGallery}
        fallback={<PaywallScreen />}
      />
    </Router>
  );
}

// Status-bar glyphs contrast with the page: dark on the light theme, light on
// the dark one. Screens whose header is a photo (ProductPage, LoginScreen,
// PaywallScreen, ScanCameraScreen) mount their own light <StatusBar>, and the
// most recently mounted one wins while they are on screen.
function ThemedStatusBar() {
  const { effective } = useThemeMode();
  return <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />;
}

// The theme's mode is a stored preference, so it has to be read below
// <PrefsProvider> — which App() itself renders and therefore cannot read.
//
// Controlled rather than seeded with `initialMode`: the preference is the
// single source of truth, and `useThemeMode().setMode(...)` writes straight
// through to it. See theme/ThemeProvider.js.
function AppShell() {
  const { appearance, setAppearance } = usePrefs();
  return (
    <ThemeProvider
      mode={appearance}
      onModeChange={setAppearance}
    >
      <ThemedStatusBar />
      {/* Every text style names a loaded face (theme/fonts.js), so nothing that
          draws text mounts before they are registered. */}
      <FontGate>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </FontGate>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Outermost of the app's own providers: preferences describe the device,
          not the session, so they sit above auth and survive a sign-out. They
          also hydrate synchronously (lib/prefsStorage.js), which is what lets
          the theme be right on the first frame. */}
      <PrefsProvider>
        <AppShell />
      </PrefsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
