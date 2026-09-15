// RoomScreen — one room's plants (Figma "Room" 377:10, "Room / Empty"
// 505:37071), and everything behind its ⋯ button: the actions sheet, rename,
// and the two ways a delete goes (505:35639 when the room is empty, 505:35851 →
// move the plants first when it isn't).
//
// Reached from RoomsScreen with the room's *id* as the route param. Reading the
// room from the store rather than receiving it by value is what makes a rename
// stick: routing/Route.js unmounts this screen on the way back, and a param
// would have been a snapshot of a name that no longer exists.

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dialog, Icon, NavigationBar, State, useSnackbar } from '../../components';
import { useRouter } from '../../routing';
import { useGarden } from '../../store/GardenProvider';
import { roomSubtitle } from '../../store/format';
import { plantCard, roomDetailSubtitle } from '../../store/views';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';
import PlantGrid from './PlantGrid';
import RoomSheet from './RoomSheet';
import { useModalHandoff } from './useModalHandoff';

export default function RoomScreen({ roomId }) {
  const insets = useSafeAreaInsets();
  const { navigate, back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const garden = useGarden();
  const { show } = useSnackbar();
  const { handoff, onDismiss } = useModalHandoff();

  // One sheet (with steps) and one dialog, never both on screen — see
  // useModalHandoff for why the switch between them waits on iOS.
  const [sheet, setSheet] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const room = garden.getRoom(roomId);
  const plants = useMemo(
    () => garden.plantsInRoom(roomId).map(plantCard),
    [garden, roomId],
  );
  const otherRooms = garden.rooms.filter((r) => r.id !== roomId);
  const hasPlants = plants.length > 0;

  // The bar is hosted above the router, so it outlives this screen and lands
  // on the Rooms list the user is sent back to.
  const leave = () => {
    show({ label: 'Room deleted' });
    back();
  };

  const closeSheet = () => setSheet(null);
  const requestDelete = () => handoff(closeSheet, () => setConfirming(true));
  const moveFirst = () => handoff(() => setConfirming(false), () => setSheet('move'));

  const rename = (name) => {
    garden.renameRoom(roomId, name);
    closeSheet();
  };

  const deleteEmpty = () => {
    setConfirming(false);
    garden.deleteRoom(roomId);
    leave();
  };

  const moveAndDelete = (toRoomId) => {
    closeSheet();
    garden.deleteRoomMovingPlants(roomId, toRoomId);
    leave();
  };

  const createAndMove = (name) => {
    closeSheet();
    const newRoomId = garden.addRoom(name);
    garden.deleteRoomMovingPlants(roomId, newRoomId);
    leave();
  };

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
                  icon: <Icon name="more-horizontal" size={20} color={t.text.primary} />,
                  onPress: () => setSheet('actions'),
                  accessibilityLabel: 'Room actions',
                },
              ]
              : []
          }
        />
      </View>

      {!hasPlants ? (
        <View style={styles.emptyWrap}>
          <State
            icon={<Icon name="plant" size={24} color={t.text.primary} />}
            iconVariant="secondary"
            title="No plants here yet"
            subtitle="Scan a plant to add it to this room, or search by name."
            primaryAction={{
              label: 'Scan a plant',
              leftIcon: <Icon name="outlined-scan" size={16} color={t.brand.onPrimary} />,
              onPress: () => navigate('scan-camera'),
            }}
            secondaryAction={{
              label: 'Search by name instead',
              onPress: () => navigate('scan-search'),
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

      <RoomSheet
        step={sheet}
        room={room}
        otherRooms={otherRooms}
        plantCount={plants.length}
        onStep={setSheet}
        onClose={closeSheet}
        onDismiss={onDismiss}
        onRename={rename}
        onDeleteRequest={requestDelete}
        onMoveAndDelete={moveAndDelete}
        onCreateAndMove={createAndMove}
      />

      <Dialog
        testID="room-delete-dialog"
        visible={confirming}
        onClose={() => setConfirming(false)}
        onDismiss={onDismiss}
        title="Delete room?"
        description={
          hasPlants
            ? `${room?.name ?? 'This room'} still has ${roomSubtitle(plants.length)}. Move them to another room before deleting it.`
            : 'The room will be removed. Your plants and their reminders are not affected. This cannot be undone.'
        }
        primaryAction={
          hasPlants
            ? { label: 'Move to another room', onPress: moveFirst }
            : { label: 'Delete', destructive: true, onPress: deleteEmpty }
        }
        secondaryAction={{ label: 'Cancel', onPress: () => setConfirming(false) }}
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
