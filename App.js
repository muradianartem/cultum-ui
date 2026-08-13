import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  TextButton,
  Badge,
  BottomSheet,
  Divider,
  Toggle,
  Checkbox,
  RadioButton,
  Chip,
  ButtonIcon,
} from './components';
import { colors, spacing } from './theme/tokens';

const BADGE_VARIANTS = ['primary', 'secondary', 'outline', 'ghost'];
const BADGE_INTENTS = ['neutral', 'positive', 'negative'];
const BADGE_SIZES = ['lg', 'md', 'sm'];

// Temporary gallery to preview primitives as we build them.
export default function App() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const [agree, setAgree] = useState(false);
  const [plan, setPlan] = useState('weekly');
  const [filter, setFilter] = useState('indoor');
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.h1}>Button</Text>

      <Button label="Water now" onPress={() => {}} />
      <Button label="Skip today" variant="secondary" onPress={() => {}} />
      <Button label="Add a plant" variant="outline" onPress={() => {}} />
      <Button label="Sign in with email" variant="ghost" onPress={() => {}} />
      <Button label="Remove plant" variant="primary" destructive onPress={() => {}} />
      <Button label="Delete" variant="outline" destructive onPress={() => {}} />

      <Text style={styles.h1}>TextButton</Text>
      <View style={styles.row}>
        <TextButton label="Not now" onPress={() => {}} />
        <TextButton label="Undo" tone="danger" onPress={() => {}} />
        <TextButton label="Skip" size="sm" tone="muted" onPress={() => {}} />
      </View>

      <Text style={styles.h1}>Button sizes & states</Text>
      <View style={styles.row}>
        <Button label="Large" size="lg" fullWidth={false} onPress={() => {}} />
        <Button label="Medium" size="md" fullWidth={false} onPress={() => {}} />
        <Button label="Small" size="sm" fullWidth={false} onPress={() => {}} />
      </View>

      <Button label="Loading" loading onPress={() => {}} />
      <Button label="Disabled" disabled onPress={() => {}} />

      <Text style={styles.h1}>Badge</Text>
      {BADGE_SIZES.map((size) => (
        <View key={size} style={styles.badgeSize}>
          <Text style={styles.h2}>Size {size}</Text>
          {BADGE_VARIANTS.map((variant) => (
            <View key={variant} style={styles.row}>
              {BADGE_INTENTS.map((intent) => (
                <Badge
                  key={intent}
                  label={intent}
                  variant={variant}
                  intent={intent}
                  size={size}
                />
              ))}
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.h2}>With icons</Text>
      <View style={styles.row}>
        <Badge label="New" intent="positive" leftIcon={<Text>●</Text>} />
        <Badge label="3" intent="negative" rightIcon={<Text>×</Text>} />
        <Badge intent="neutral" leftIcon={<Text>★</Text>} />
      </View>

      <Text style={styles.h1}>Divider</Text>
      <Divider />
      <Divider size="lg" />
      <Divider label="OR" />

      <Text style={styles.h1}>Toggle</Text>
      <View style={styles.row}>
        <Toggle value={notify} onValueChange={setNotify} accessibilityLabel="Notifications" />
        <Toggle value={false} onValueChange={() => {}} accessibilityLabel="Off" />
        <Toggle value disabled accessibilityLabel="Locked on" />
      </View>

      <Text style={styles.h1}>Checkbox</Text>
      <View style={styles.row}>
        <Checkbox checked={agree} onChange={setAgree} accessibilityLabel="Agree" />
        <Checkbox checked accessibilityLabel="Checked" />
        <Checkbox indeterminate accessibilityLabel="Some" />
        <Checkbox disabled accessibilityLabel="Disabled" />
        <Checkbox checked disabled accessibilityLabel="Checked disabled" />
      </View>

      <Text style={styles.h1}>Radio Button</Text>
      <View style={styles.row}>
        {['weekly', 'biweekly', 'monthly'].map((p) => (
          <RadioButton
            key={p}
            value={p}
            selected={plan === p}
            onSelect={setPlan}
            accessibilityLabel={p}
          />
        ))}
        <RadioButton disabled accessibilityLabel="Disabled" />
      </View>

      <Text style={styles.h1}>Chip</Text>
      <View style={styles.row}>
        {['indoor', 'outdoor', 'succulent'].map((c) => (
          <Chip
            key={c}
            label={c}
            selected={filter === c}
            onPress={() => setFilter(c)}
          />
        ))}
        <Chip label="tagged" leftIcon={<Text>🏷️</Text>} onPress={() => {}} />
        <Chip label="disabled" disabled />
      </View>

      <Text style={styles.h1}>ButtonIcon</Text>
      <View style={styles.row}>
        <ButtonIcon icon={<Text>＋</Text>} accessibilityLabel="Add" onPress={() => {}} />
        <ButtonIcon icon={<Text>✎</Text>} variant="secondary" accessibilityLabel="Edit" onPress={() => {}} />
        <ButtonIcon icon={<Text>↗</Text>} variant="outline" accessibilityLabel="Share" onPress={() => {}} />
        <ButtonIcon icon={<Text>♡</Text>} variant="ghost" accessibilityLabel="Like" onPress={() => {}} />
        <ButtonIcon icon={<Text>🗑</Text>} variant="primary" destructive accessibilityLabel="Delete" onPress={() => {}} />
        <ButtonIcon icon={<Text>＋</Text>} size="sm" accessibilityLabel="Add small" onPress={() => {}} />
      </View>

      <Text style={styles.h1}>BottomSheet</Text>
      <Button label="Open sheet" variant="outline" onPress={() => setSheetOpen(true)} />
      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        statusIcon={<Text style={{ fontSize: 20 }}>🌿</Text>}
        title="Remove this plant?"
        description="It will disappear from your garden. You can add it again anytime."
        primaryAction={{ label: 'Remove', destructive: true, onPress: () => setSheetOpen(false) }}
        secondaryAction={{ label: 'Keep it', onPress: () => setSheetOpen(false) }}
        caption="This won't delete your care history."
      />

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
  h2: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    marginTop: 4,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  badgeSize: { gap: 10 },
});
