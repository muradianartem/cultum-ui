// AddRoomSheet — a short sheet with one field and a confirm that stays
// disabled until the field has content.
//
// Two designs share it, told apart only by their copy:
//   • "Add a plant / Add a room" (362:15622) — the defaults below;
//   • "Room / New room" (505:37620) and "Room / Delete / Move plants / New
//     room" (531:420) — a labelled "Room name" field, "What's the room name?",
//     and "Create" / "Create and move".
//
// A thin wrapper over the <BottomSheet> primitive, the same shape as
// ReminderValueSheet — the primitive owns the Modal, backdrop, grabber and
// close button; this only supplies the field and the action.
//
//   <AddRoomSheet visible onClose={…} onConfirm={(name) => …} />

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, TextInput } from '../../components';

export default function AddRoomSheet({
  visible,
  onClose,
  onConfirm,
  title = 'Add a new room',
  label,
  helper,
  placeholder = 'e.g Hallway',
  confirmLabel = 'Add room',
  testID = 'add-room-sheet',
}) {
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
      title={title}
      testID={testID}
      primaryAction={{ label: confirmLabel, onPress: confirm, disabled: !canAdd }}
    >
      <View style={styles.field}>
        <TextInput
          label={label}
          helper={helper}
          value={name}
          onChangeText={setName}
          placeholder={placeholder}
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
