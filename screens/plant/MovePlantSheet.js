// "Move" from the product page's Actions list: pick the room this plant lives
// in, or make a new one.
//
// The room list is the store's whole catalog rather than only the occupied
// rooms — moving a plant into an empty room is exactly how a room stops being
// empty. Creating one selects it immediately, so a new room is one gesture
// rather than two.

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet, Icon, List, ListItem, RadioButton, TextInput } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';

export default function MovePlantSheet({ visible, rooms = [], roomId, onClose, onMove, onAddRoom }) {
  const t = useTheme();
  const [selected, setSelected] = useState(roomId ?? null);
  const [creating, setCreating] = useState(false);
  const [newRoom, setNewRoom] = useState('');

  // Reopen on where the plant actually is, with the create field put away.
  useEffect(() => {
    if (visible) {
      setSelected(roomId ?? null);
      setCreating(false);
      setNewRoom('');
    }
  }, [visible, roomId]);

  const createRoom = () => {
    const name = newRoom.trim();
    if (!name) return;
    const id = onAddRoom?.(name);
    if (id) setSelected(id);
    setCreating(false);
    setNewRoom('');
  };

  const move = () => {
    onMove?.(selected);
    onClose?.();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Move to another room"
      testID="move-plant-sheet"
      primaryAction={{ label: 'Move plant', onPress: move, disabled: !selected }}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <List variant="card">
          {rooms.map((room) => (
            <ListItem
              key={room.id}
              before={<Icon name={room.icon ?? 'home'} size={20} color={t.text.primary} />}
              title={room.name}
              onPress={() => setSelected(room.id)}
              after={
                <RadioButton
                  selected={room.id === selected}
                  onSelect={() => setSelected(room.id)}
                  accessibilityLabel={room.name}
                />
              }
            />
          ))}
        </List>

        {creating ? (
          <View style={styles.create}>
            <TextInput
              value={newRoom}
              onChangeText={setNewRoom}
              placeholder="e.g Hallway"
              accessibilityLabel="New room name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createRoom}
            />
          </View>
        ) : (
          <List variant="card">
            <ListItem
              before={<Icon name="add" size={20} color={t.text.primary} />}
              title="Add a new room"
              onPress={() => setCreating(true)}
            />
          </List>
        )}

        {rooms.length === 0 && !creating ? (
          <Text style={[styles.hint, { color: t.text.secondary }]}>
            You have no rooms yet — add one and this plant moves straight into it.
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 340 },
  body: { paddingHorizontal: space[16], gap: space[8] },
  create: { paddingTop: space[4] },
  hint: { ...typography.bodyMedium, paddingHorizontal: space[4] },
});
