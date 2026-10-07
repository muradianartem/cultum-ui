import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Icon,
  NavigationBar,
  RoomCard,
  SearchBar,
  SegmentedControl,
  State,
  TabBar,
  useSnackbarOffset,
} from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';
import { useGarden } from '../../store/GardenProvider';
import { showError } from '../../lib/showError';
import { roomCards, searchGarden } from '../../store/views';
import { TABS } from '../navConfig';
import AddRoomSheet from '../addPlant/AddRoomSheet';
import PlantGrid from './PlantGrid';
import { useRoomGate } from './useRoomGate';

/**
 * RoomsScreen — the Rooms tab (Figma "Rooms / Idle" 377:8, "Rooms / First
 * plant" 734:14782, "Rooms / Search" 377:9, "Rooms / Search · No results"
 * 516:108).
 *
 * Idle is a stack of room cards. Rooms with plants lead; empty ones are tucked
 * behind a "Show empty rooms" link at the foot of the list (pinned low when the
 * list is short), unless every room is empty — then there is nothing to hide
 * them behind, so they all show. New rooms come from the + in the top bar.
 *
 * Typing filters across room names and plant names (nickname or species). The
 * filtering is local and synchronous — unlike the scan flow's manual search,
 * which debounces because it hits the API — so results land on every keystroke.
 * A Rooms / Plants switch picks which set shows; it opens on whichever has
 * results, and holds the user's pick until the query changes.
 */
export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, reset } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const garden = useGarden();
  const gate = useRoomGate();
  const [query, setQueryRaw] = useState('');
  const [tab, setTab] = useState(null); // null = pick whichever has results
  const [showEmpty, setShowEmpty] = useState(false);
  const [creating, setCreating] = useState(false);
  const openCreate = () => gate(() => setCreating(true));
  const searching = query.trim().length > 0;
  // The snackbar sits above the tab bar; measure the bottom block rather than
  // hardcode a height, so it tracks the safe-area inset.
  const [bottomH, setBottomH] = useState(0);
  useSnackbarOffset(bottomH);

  const setQuery = (next) => {
    setQueryRaw(next);
    setTab(null);
  };

  const rooms = useMemo(
    () => roomCards(garden.state, garden.now),
    [garden.state, garden.now],
  );
  const results = useMemo(
    () => searchGarden(garden.state, query, garden.now),
    [garden.state, query, garden.now],
  );

  const filledRooms = rooms.filter((room) => room.plantCount > 0);
  // Only offer the toggle when it would actually split the list.
  const canHideEmpty = filledRooms.length > 0 && filledRooms.length < rooms.length;
  const visibleRooms = canHideEmpty && !showEmpty ? filledRooms : rooms;

  const noResults = searching && results.rooms.length === 0 && results.plants.length === 0;
  const activeTab =
    tab ?? (results.rooms.length === 0 && results.plants.length > 0 ? 'plants' : 'rooms');

  // TabBar wants icon nodes; resolve each tab's icon name to an <Icon>.
  const tabBarTabs = TABS.map((item) => ({
    value: item.value,
    label: item.label,
    icon: <Icon name={item.icon} size={24} color={t.text.primary} />,
  }));

  // By id, not by value: a room passed as a param would be a snapshot, and
  // renaming it on the detail screen would leave this list showing the old name.
  const openRoom = (room) => navigate('room', { roomId: room.id });
  const openPlant = (plant) => navigate('product', { plantId: plant.id });

  const renderRoom = (room) => (
    <RoomCard
      key={room.id}
      name={room.name}
      meta={room.meta}
      icon={<Icon name={room.icon} size={24} color={t.text.primary} />}
      photos={room.photos}
      onPress={() => openRoom(room)}
    />
  );

  const renderResults = () => {
    if (activeTab === 'plants') {
      return results.plants.length > 0 ? (
        <PlantGrid plants={results.plants} onPress={openPlant} />
      ) : (
        <Text style={styles.tabEmpty}>{`No plants match “${query.trim()}”`}</Text>
      );
    }
    return results.rooms.length > 0 ? (
      <View style={styles.cards}>{results.rooms.map(renderRoom)}</View>
    ) : (
      <Text style={styles.tabEmpty}>{`No rooms match “${query.trim()}”`}</Text>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar
          title="Rooms"
          size="lg"
          divider={false}
          buttonVariant="secondary"
          actions={[
            {
              icon: <Icon name="add" size={24} color={t.text.primary} />,
              onPress: openCreate,
              accessibilityLabel: 'Create new room',
            },
          ]}
        />
      </View>

      <View style={styles.body}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search your rooms or plants"
          accessibilityLabel="Search your rooms or plants"
          leftIcon={<Icon name="search" size={20} color={t.text.placeholder} />}
          clearIcon={<Icon name="close" size={20} color={t.text.primary} />}
          onClear={() => setQuery('')}
        />

        {searching && !noResults ? (
          <SegmentedControl
            segments={[
              { label: 'Rooms', value: 'rooms' },
              { label: 'Plants', value: 'plants' },
            ]}
            value={activeTab}
            onChange={setTab}
            style={styles.switcher}
          />
        ) : null}

        {noResults ? (
          <View style={styles.emptyWrap}>
            <State
              icon={<Icon name="search" size={24} color={t.text.primary} />}
              iconVariant="secondary"
              title="No results found"
              subtitle="Try another name, or clear the search to see everything again."
              primaryAction={{ label: 'Clear search', onPress: () => setQuery('') }}
            />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={searching ? styles.results : styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {searching ? (
              renderResults()
            ) : rooms.length > 0 ? (
              <>
                <View style={styles.cards}>{visibleRooms.map(renderRoom)}</View>
                {canHideEmpty ? (
                  <Button
                    label={showEmpty ? 'Hide empty rooms' : 'Show empty rooms'}
                    variant="ghost"
                    size="sm"
                    onPress={() => setShowEmpty((v) => !v)}
                    style={styles.toggle}
                  />
                ) : null}
              </>
            ) : (
              // Nothing yet: the server has no rooms for this user (or the
              // first pull hasn't landed). Point at the one way in.
              <View style={styles.emptyWrap}>
                <State
                  icon={<Icon name="home" size={24} color={t.text.primary} />}
                  iconVariant="secondary"
                  title="No rooms yet"
                  subtitle="Create a room to group your plants by where they live."
                  primaryAction={{
                    label: 'Create new room',
                    leftIcon: <Icon name="add" size={16} color={t.brand.onPrimary} />,
                    onPress: openCreate,
                  }}
                />
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <AddRoomSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onConfirm={(name) =>
          garden
            .addRoom(name)
            // A new room is empty; reveal the empty ones so it doesn't vanish
            // behind the toggle the moment it lands.
            .then(() => setShowEmpty(true))
            .catch((e) => showError(e, 'Couldn’t create the room'))
        }
        title="Create new room"
        label="Room name"
        placeholder="What's the room name?"
        confirmLabel="Create"
        testID="new-room-sheet"
      />

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom }]}
        onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}
      >
        <TabBar
          tabs={tabBarTabs}
          value="rooms"
          onChange={(value) => {
            // Today is the router's root — reset so Rooms doesn't pile up in
            // the back stack.
            if (value === 'today') reset('today');
            if (value === 'scan') navigate('scan-camera');
            if (value === 'settings') navigate('settings');
          }}
        />
      </View>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    body: {
      flex: 1,
      paddingTop: space[12],
      paddingHorizontal: space[16],
      gap: space[16],
    },
    scroll: { flex: 1 },
    // Grow to the viewport so a short list pins the empty-rooms toggle low
    // (Figma 734:14782); a long one just runs it after the last card.
    list: {
      flexGrow: 1,
      justifyContent: 'space-between',
      gap: space[20],
      paddingBottom: space[16],
    },
    results: { paddingBottom: space[16] },
    cards: { gap: space[20] },
    switcher: { alignSelf: 'stretch' },
    toggle: { alignSelf: 'center' },
    tabEmpty: {
      ...typography.bodyMedium,
      color: t.text.secondary,
      textAlign: 'center',
      paddingTop: space[24],
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: space[48],
    },
    bottom: { alignItems: 'center', backgroundColor: t.background.primary },
  });
