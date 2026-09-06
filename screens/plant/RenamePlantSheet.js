// "Rename" from the product page's Actions list (Figma "Product page" 1:11377).
//
// The same shape as screens/rooms/RenameRoomSheet.js — the <BottomSheet>
// primitive owns the modal, backdrop and close button; this supplies one field
// and a Save that stays disabled until the name has content.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, TextInput } from '../../components';

export default function RenamePlantSheet({ visible, name = '', onClose, onSave }) {
  const [draft, setDraft] = useState(name);

  // Reopen on the plant's current name, not on the last abandoned edit.
  useEffect(() => {
    if (visible) setDraft(name);
  }, [visible, name]);

  const canSave = draft.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onSave?.(draft.trim());
    onClose?.();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Rename plant"
      testID="rename-plant-sheet"
      primaryAction={{ label: 'Save', onPress: save, disabled: !canSave }}
    >
      <View style={styles.field}>
        <TextInput
          label="Plant name"
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel="Plant name"
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
