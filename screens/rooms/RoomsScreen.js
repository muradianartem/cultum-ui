import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Icon,
  NavigationBar,
  RoomCard,
  SearchBar,
  State,
  TabBar,
} from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';
import { searchBar } from '../../theme/tokens';
import { TABS } from '../todayData';
import { openPlant } from '../scan/openPlant';
import PlantGrid from './PlantGrid';
import { ROOMS, roomMeta, searchRooms } from './roomsData';

/**
 * RoomsScreen — the Rooms tab (Figma "Rooms / Idle" 377:8 and "Rooms / Search"
 * 377:9).
 *
 * Idle is a stack of room cards. Typing filters across both kinds of thing the
 * screen knows about: room names and plant names (nickname or species). The
 * filtering is local and synchronous — unlike the scan flow's manual search,
 * which debounces because it hits the API — so results land on every keystroke.
 *
 * Section headers only appear when the query matched both rooms and plants; a
 * single-kind result set renders bare, which is the Figma search frame.
 */
export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, reset } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchRooms(ROOMS, query), [query]);

  const bothKinds = results.rooms.length > 0 && results.plants.length > 0;
  const noResults = searching && results.rooms.length === 0 && results.plants.length === 0;

  // TabBar wants icon nodes; resolve each tab's icon name to an <Icon>.
  const tabBarTabs = TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <Icon name={tab.icon} size={24} color={t.text.primary} />,
  }));

  const openRoom = (room) => navigate('room', { room });

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar title="Rooms" size="lg" divider={false} />
      </View>

      <View style={styles.body}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search your rooms"
          accessibilityLabel="Search your rooms"
          leftIcon={<Icon name="search" size={20} color={searchBar.placeholder} />}
          clearIcon={<Icon name="close" size={20} color={searchBar.ink} />}
          onClear={() => setQuery('')}
        />

        {noResults ? (
          <View style={styles.emptyWrap}>
            <State
              icon={<Icon name="search" size={24} color={t.text.primary} />}
              iconVariant="secondary"
              title="No results found"
              subtitle="Try another room or plant name."
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
              <>
                {results.rooms.length > 0 ? (
                  <View style={styles.section}>
                    {bothKinds ? <Text style={styles.sectionHeader}>Rooms</Text> : null}
                    <View style={styles.list}>
                      {results.rooms.map((room) => (
                        <RoomCard
                          key={room.id}
                          name={room.name}
                          meta={roomMeta(room)}
                          photos={room.photos}
                          onPress={() => openRoom(room)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {results.plants.length > 0 ? (
                  <View style={styles.section}>
                    {bothKinds ? <Text style={styles.sectionHeader}>Plants</Text> : null}
                    <PlantGrid
                      plants={results.plants}
                      onPress={(p) => openPlant(p, navigate)}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              ROOMS.map((room) => (
                <RoomCard
                  key={room.id}
                  name={room.name}
                  meta={roomMeta(room)}
                  photos={room.photos}
                  onPress={() => openRoom(room)}
                />
              ))
            )}
          </ScrollView>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
        <TabBar
          tabs={tabBarTabs}
          value="rooms"
          onChange={(value) => {
            // Today is the router's root — reset so Rooms doesn't pile up in
            // the back stack. Discover is inert (as on TodayScreen).
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
    list: { gap: space[20], paddingBottom: space[16] },
    results: { gap: space[16], paddingBottom: space[16] },
    section: { gap: space[12] },
    sectionHeader: { ...typography.headingSmallEmphasized, color: t.text.primary },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: space[48],
    },
    bottom: { alignItems: 'center', backgroundColor: t.background.primary },
  });
