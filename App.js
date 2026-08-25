import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, Route, requireSubscription } from './routing';
import ProductPage from './screens/ProductPage';
import PremiumGallery from './screens/PremiumGallery';
// V2: full-screen photo viewer (Figma "Product Page / View Image"). Kept out of
// the V1 flow — re-enable this import and its route below when V2 ships.
// import ImageViewer from './screens/ImageViewer';
import { colors } from './theme/tokens';

// Rendered when a guard blocks a route (subscription guard is a stub today, so
// this stays unused until the guard starts returning false for non-subscribers).
function Locked() {
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedText}>This is a premium feature.</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Router initial="product">
        <Route name="product" component={ProductPage} />
        <Route
          name="premium-gallery"
          guard={requireSubscription}
          component={PremiumGallery}
          fallback={<Locked />}
        />
        {/* V2: <Route name="image-viewer" component={ImageViewer} /> */}
      </Router>
      {/* Light hero photo behind the status bar → light status-bar text. */}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  locked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  lockedText: { fontSize: 16, color: colors.ink },
});
