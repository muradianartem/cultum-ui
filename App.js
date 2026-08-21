import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ProductPage from './screens/ProductPage';

export default function App() {
  return (
    <SafeAreaProvider>
      <ProductPage />
      {/* Light hero photo behind the status bar → light status-bar text. */}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
