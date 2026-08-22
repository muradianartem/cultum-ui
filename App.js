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
  LoadingIndicator,
  State,
  Snackbar,
  SegmentedControl,
  SearchBar,
  TextInput,
  Card,
  List,
  ListItem,
  Dropdown,
  DropdownMenu,
  NavigationBar,
  TabBar,
  Avatar,
  AvatarGroup,
  Overlay,
  Tabs,
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
  const [seg, setSeg] = useState('all');
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const [ddValue, setDdValue] = useState('');
  const [tab, setTab] = useState('care');
  const [overlayOn, setOverlayOn] = useState(false);
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

      <Text style={styles.h1}>— P2 —</Text>

      <Text style={styles.h1}>NavigationBar</Text>
      <NavigationBar
        title="My Plants"
        subtitle="12 items"
        leading="back"
        onLeadingPress={() => {}}
        actions={[
          { icon: <Text>🔍</Text>, onPress: () => {}, accessibilityLabel: 'Search' },
          { icon: <Text>⋯</Text>, onPress: () => {}, accessibilityLabel: 'More' },
        ]}
      />

      <Text style={styles.h1}>SegmentedControl</Text>
      <SegmentedControl
        segments={['All', 'Indoor', 'Outdoor']}
        value={seg}
        onChange={(v) => setSeg(v)}
      />

      <Text style={styles.h1}>SearchBar</Text>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Find a plant" />

      <Text style={styles.h1}>TextInput</Text>
      <TextInput
        label="Email"
        optional
        placeholder="you@example.com"
        helper="We'll send care reminders here."
        value={email}
        onChangeText={setEmail}
      />
      <TextInput label="Name" value="" onChangeText={() => {}} error="This field is required." />

      <Text style={styles.h1}>Dropdown</Text>
      <Dropdown
        label="Watering plan"
        placeholder="Choose a plan"
        value={ddValue}
        open={ddOpen}
        onPress={() => setDdOpen((o) => !o)}
      />
      {ddOpen ? (
        <DropdownMenu
          items={['Weekly', 'Biweekly', 'Monthly'].map((p) => ({
            title: p,
            onPress: () => {
              setDdValue(p);
              setDdOpen(false);
            },
          }))}
        />
      ) : null}

      <Text style={styles.h1}>Card</Text>
      <Card
        icon={<Text style={{ fontSize: 20 }}>🌿</Text>}
        title="Monstera"
        subtitle="Living room"
        body="Needs watering every 7 days. Bright, indirect light."
        primaryAction={{ label: 'Water now', onPress: () => {} }}
        secondaryAction={{ label: 'Snooze', onPress: () => {} }}
      />

      <Text style={styles.h1}>List</Text>
      <List variant="card">
        <ListItem
          title="Monstera"
          subtitle="Water in 2 days"
          before={<Text style={{ fontSize: 18 }}>🪴</Text>}
          after={<Text style={{ color: colors.ink3 }}>›</Text>}
          divider
          onPress={() => {}}
        />
        <ListItem
          title="Snake plant"
          subtitle="Water in 9 days"
          before={<Text style={{ fontSize: 18 }}>🌱</Text>}
          after={<Text style={{ color: colors.ink3 }}>›</Text>}
          onPress={() => {}}
        />
      </List>

      <Text style={styles.h1}>Snackbar</Text>
      <Snackbar
        label="Plant added to your garden"
        icon={<Text>✅</Text>}
        action={{ label: 'Undo', onPress: () => {} }}
        onDismiss={() => {}}
      />

      <Text style={styles.h1}>LoadingIndicator</Text>
      <View style={styles.row}>
        <LoadingIndicator />
        <LoadingIndicator size={32} color={colors.greenDeep} />
      </View>

      <Text style={styles.h1}>State (empty)</Text>
      <State
        icon={<Text style={{ fontSize: 22 }}>🪴</Text>}
        title="No plants yet"
        subtitle="Add your first plant to start tracking care."
        primaryAction={{ label: 'Add a plant', onPress: () => {} }}
        secondaryAction={{ label: 'Learn more', onPress: () => {} }}
      />

      <Text style={styles.h1}>TabBar</Text>
      <TabBar
        value={seg === 'all' ? 'home' : seg}
        onChange={(v) => setSeg(v)}
        tabs={[
          { value: 'home', label: 'Home', icon: <Text>🏠</Text> },
          { value: 'garden', label: 'Garden', icon: <Text>🪴</Text> },
          { value: 'add', label: 'Add', icon: <Text>＋</Text>, emphasized: true },
          { value: 'care', label: 'Care', icon: <Text>💧</Text> },
          { value: 'me', label: 'Me', icon: <Text>🙂</Text> },
        ]}
      />

      <Text style={styles.h1}>— P3 —</Text>

      <Text style={styles.h1}>Avatar</Text>
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        <Avatar initials="JD" size="lg" />
        <Avatar initials="AB" size="md" />
        <Avatar initials="CD" size="sm" />
        <Avatar initials="EF" size="xs" />
        <Avatar overflow={9} size="md" />
      </View>
      <AvatarGroup
        size="md"
        max={3}
        avatars={[
          { initials: 'JD' },
          { initials: 'AB' },
          { initials: 'CD' },
          { initials: 'EF' },
          { initials: 'GH' },
        ]}
      />

      <Text style={styles.h1}>Tabs</Text>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'care', label: 'Care' },
          { value: 'history', label: 'History' },
          { value: 'notes', label: 'Notes', disabled: true },
        ]}
      />

      <Text style={styles.h1}>Overlay</Text>
      <Button label="Show overlay" variant="outline" onPress={() => setOverlayOn(true)} />
      {overlayOn ? (
        <Overlay color={colors.brandDark} opacity={0.5} onPress={() => setOverlayOn(false)}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayText}>Tap outside to dismiss</Text>
            <Button label="Close" onPress={() => setOverlayOn(false)} />
          </View>
        </Overlay>
      ) : null}

      <View style={{ height: 40 }} />

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
  overlayCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    width: 260,
    alignItems: 'center',
  },
  overlayText: { fontSize: 16, color: colors.ink },
});
