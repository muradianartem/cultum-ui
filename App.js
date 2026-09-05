import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, Route, requireSubscription } from './routing';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import LoginScreen from './screens/LoginScreen';
import { LoadingIndicator } from './components';
import TodayScreen from './screens/TodayScreen';
import ProductPage from './screens/ProductPage';
import RemindersScreen from './screens/RemindersScreen';
import AddPlantScreen from './screens/addPlant/AddPlantScreen';
import PremiumGallery from './screens/PremiumGallery';
import SettingsScreen from './screens/SettingsScreen';
import PaywallScreen from './screens/PaywallScreen';
import ScanCameraScreen from './screens/scan/ScanCameraScreen';
import ScanMatchesScreen from './screens/scan/ScanMatchesScreen';
import ScanSearchScreen from './screens/scan/ScanSearchScreen';
// V2: full-screen photo viewer (Figma "Product Page / View Image"). Kept out of
// the V1 flow — re-enable this import and its route below when V2 ships.
// import ImageViewer from './screens/ImageViewer';
import { colors } from './theme/tokens';

// Chooses login vs. the app router based on async auth status. Gating happens
// here at the root (not via routing/guards, which are pure sync functions with
// no context access), so the Router only ever mounts once authenticated.
function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <LoadingIndicator />
      </View>
    );
  }

  if (status === 'signedOut') {
    return <LoginScreen />;
  }

  return (
    <Router initial="today">
      <Route name="today" component={TodayScreen} />
      <Route name="product" component={ProductPage} />
      <Route name="add-plant" component={AddPlantScreen} />
      <Route name="reminders" component={RemindersScreen} />
      <Route name="settings" component={SettingsScreen} />
      <Route name="scan-camera" component={ScanCameraScreen} />
      <Route name="scan-matches" component={ScanMatchesScreen} />
      <Route name="scan-search" component={ScanSearchScreen} />
      {/* TODO: nothing navigates to "paywall" yet — it is reachable today only
          as the subscription guard's fallback. Add the in-app entry points
          (settings, gated actions) when entitlements land. */}
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

export default function App() {
  return (
    <SafeAreaProvider>
      {/* ThemeProvider makes the semantic color tokens available via useTheme()
          and drives light/dark. Follows the OS scheme by default. */}
      <ThemeProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ThemeProvider>
      {/* Light hero photo behind the status bar → light status-bar text. */}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
});
