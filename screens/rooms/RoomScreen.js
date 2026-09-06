import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, NavigationBar, State } from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';
import { openPlant } from '../scan/openPlant';
import PlantGrid from './PlantGrid';
import RenameRoomSheet from './RenameRoomSheet';
import { roomSubtitle } from './roomsData';

/**
 * RoomScreen — one room's plants (Figma "Room" 377:10, and "Room / Rename"
 * 381:19290 for the sheet).
 *
 * Reached from RoomsScreen with the room as a route param. No tab bar: Figma
 * treats this as a pushed detail, not a tab root.
 *
 * V1 mock: the rename lives in this screen's state, and routing/Route.js
 * unmounts a screen the moment you navigate away — so a new name is gone once
 * you go back to the list. Same limitation the add-a-plant flow documents; it
 * lifts when rooms get a real store.
 */
export default function RoomScreen({ room }) {
  const insets = useSafeAreaInsets();
  const { navigate, back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [name, setName] = useState(room?.name ?? 'Room');
  const [renaming, setRenaming] = useState(false);

  const plants = room?.plants ?? [];

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar
          title={name}
          subtitle={roomSubtitle(room)}
          leading="back"
          onLeadingPress={back}
          buttonVariant="secondary"
          divider={false}
          actions={[
            {
              icon: <Icon name="edit-pen" size={20} color={t.text.primary} />,
              onPress: () => setRenaming(true),
              accessibilityLabel: 'Rename room',
            },
          ]}
        />
      </View>

      {plants.length === 0 ? (
        <View style={styles.emptyWrap}>
          <State
            icon={<Icon name="plant" size={24} color={t.text.primary} />}
            iconVariant="secondary"
            title="No plants here yet"
            subtitle="Add a plant to this room and it will show up here."
            primaryAction={{
              label: 'Add a plant',
              leftIcon: <Icon name="outlined-scan" size={16} color={t.brand.onPrimary} />,
              onPress: () => navigate('scan-camera'),
            }}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[24] }]}
          showsVerticalScrollIndicator={false}
        >
          <PlantGrid plants={plants} onPress={(p) => openPlant(p, navigate)} />
        </ScrollView>
      )}

      <RenameRoomSheet
        visible={renaming}
        name={name}
        onClose={() => setRenaming(false)}
        onSave={(next) => setName(next.trim())}
      />
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },
    content: {
      paddingTop: space[12],
      paddingHorizontal: space[16],
      gap: space[16],
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: space[48],
    },
  });
