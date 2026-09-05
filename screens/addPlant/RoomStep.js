// Step 2 of the add-a-plant flow (Figma "Add a plant / Room", node 338:2948):
// one card per room with a radio on the right, and an "Add a new room" row
// under them that opens AddRoomSheet (as does the nav bar's + action).
//
// Chrome-less — AddPlantScreen supplies the nav bar and the Continue footer.

import { ScrollView, StyleSheet } from 'react-native';
import { Icon, RadioButton } from '../../components';
import { space } from '../../theme/foundations';
import { list } from '../../theme/tokens';
import CardRow from './CardRow';

export default function RoomStep({ rooms, selectedId, onSelect, onAddRoom }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
    >
      {rooms.map((room) => (
        <CardRow
          key={room.id}
          icon={room.icon}
          title={room.name}
          onPress={() => onSelect(room.id)}
          after={
            <RadioButton
              selected={room.id === selectedId}
              onSelect={() => onSelect(room.id)}
              accessibilityLabel={room.name}
            />
          }
        />
      ))}

      <CardRow icon="add" title="Add a new room" onPress={onAddRoom} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { padding: space[16], gap: space[8] },
});
