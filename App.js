import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from './components';
import { colors, spacing } from './theme/tokens';

// Temporary gallery to preview primitives as we build them.
export default function App() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.h1}>Button</Text>

      <Button label="Water now" onPress={() => {}} />
      <Button label="Continue" variant="dark" onPress={() => {}} />
      <Button label="Skip today" variant="secondary" onPress={() => {}} />
      <Button label="Add a plant" variant="outline" onPress={() => {}} />
      <Button label="Sign in with email" variant="ghost" onPress={() => {}} />
      <Button label="Remove plant" variant="danger" onPress={() => {}} />

      <Text style={styles.h1}>TextButton</Text>
      <View style={styles.row}>
        <TextButton label="Not now" onPress={() => {}} />
        <TextButton label="Undo" tone="danger" onPress={() => {}} />
        <TextButton label="Skip" size="sm" tone="muted" onPress={() => {}} />
      </View>

      <Text style={styles.h1}>Button sizes & states</Text>
      <View style={styles.row}>
        <Button label="Save" size="sm" fullWidth={false} onPress={() => {}} />
        <Button
          label="Saved"
          size="sm"
          variant="secondary"
          fullWidth={false}
          onPress={() => {}}
        />
      </View>

      <Button label="Loading" loading onPress={() => {}} />
      <Button label="Disabled" disabled onPress={() => {}} />

      <StatusBar style="dark" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.margin, gap: 12, paddingTop: 72 },
  h1: {
    fontSize: 25,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', gap: 12 },
});
