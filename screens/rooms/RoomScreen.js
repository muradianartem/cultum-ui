// RoomScreen — one room's plants (Figma "Room" 377:10, and "Room / Rename"
// 381:19290 for the sheet).
//
// Reached from RoomsScreen with the room's *id* as the route param. Reading the
// room from the store rather than receiving it by value is what makes the
// rename stick: routing/Route.js unmounts this screen on the way back, and a
// param would have been a snapshot of a name that no longer exists.

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, NavigationBar, State } from '../../components';
import { useRouter } from '../../routing';
import { useGarden } from '../../store/GardenProvider';
import { plantCard, roomDetailSubtitle } from '../../store/views';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';
import PlantGrid from './PlantGrid';
import RenameRoomSheet from './RenameRoomSheet';

export default function RoomScreen({ roomId }) {
  const insets = useSafeAreaInsets();
  const { navigate, back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const garden = useGarden();

  const [renaming, setRenaming] = useState(false);

  const room = garden.getRoom(roomId);
  const plants = useMemo(
    () => garden.plantsInRoom(roomId).map(plantCard),
    [garden, roomId],
  );

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar
          title={room?.name ?? 'Room'}
          subtitle={roomDetailSubtitle(garden.state, roomId)}
          leading="back"
          onLeadingPress={back}
          buttonVariant="secondary"
          divider={false}
          actions={
            room
              ? [
                {
                  icon: <Icon name="edit-pen" size={20} color={t.text.primary} />,
                  onPress: () => setRenaming(true),
                  accessibilityLabel: 'Rename room',
                },
              ]
              : []
          }
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
          <PlantGrid
            plants={plants}
            onPress={(plant) => navigate('product', { plantId: plant.id })}
          />
        </ScrollView>
      )}

      <RenameRoomSheet
        visible={renaming}
        name={room?.name ?? ''}
        onClose={() => setRenaming(false)}
        onSave={(next) => garden.renameRoom(roomId, next)}
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
