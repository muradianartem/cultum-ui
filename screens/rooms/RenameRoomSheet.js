// RenameRoomSheet — "Rename room" (Figma "Room / Rename", node 381:19290): a
// short sheet over the room detail with one labelled field and a Save that
// stays disabled until the name has content.
//
// A thin wrapper over the <BottomSheet> primitive, the same shape as
// AddRoomSheet — the primitive owns the Modal, backdrop, grabber and close
// button; this only supplies the field and the action.
//
//   <RenameRoomSheet visible name={name} onClose={…} onSave={(next) => …} />

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, TextInput } from '../../components';

export default function RenameRoomSheet({ visible, name = '', onClose, onSave }) {
  const [draft, setDraft] = useState(name);

  // Reopen on the room's current name, not on the last abandoned edit.
  useEffect(() => {
    if (visible) setDraft(name);
  }, [visible, name]);

  const canSave = draft.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onSave?.(draft);
    onClose?.();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Rename room"
      testID="rename-room-sheet"
      primaryAction={{ label: 'Save', onPress: save, disabled: !canSave }}
    >
      <View style={styles.field}>
        <TextInput
          label="Room name"
          helper="Every plant here moves with it."
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel="Room name"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  field: { paddingHorizontal: 16 },
});
