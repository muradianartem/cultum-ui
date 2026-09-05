// AddRoomSheet — "Add a new room" (Figma "Add a plant / Add a room",
// node 362:15622): a short sheet over the room step with one unlabelled field
// and a confirm that stays disabled until it has content.
//
// A thin wrapper over the <BottomSheet> primitive, the same shape as
// ReminderValueSheet — the primitive owns the Modal, backdrop, grabber and
// close button; this only supplies the field and the action.
//
//   <AddRoomSheet visible onClose={…} onConfirm={(name) => …} />

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, TextInput } from '../../components';

export default function AddRoomSheet({ visible, onClose, onConfirm }) {
  const [name, setName] = useState('');

  // Reset the draft on dismiss, so reopening never shows the last attempt.
  useEffect(() => {
    if (!visible) setName('');
  }, [visible]);

  const canAdd = name.trim().length > 0;

  const confirm = () => {
    if (!canAdd) return;
    onConfirm?.(name);
    onClose?.();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add a new room"
      testID="add-room-sheet"
      primaryAction={{ label: 'Add room', onPress: confirm, disabled: !canAdd }}
    >
      <View style={styles.field}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g Hallway"
          accessibilityLabel="Room name"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={confirm}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  field: { paddingHorizontal: 16 },
});
