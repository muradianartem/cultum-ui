// RoomSheet — every sheet behind a room's ⋯ button, as steps of ONE
// BottomSheet, because iOS won't present a second Modal over an open one
// (screens/TaskSheet.js does the same for its Snooze page).
//
//   actions   "Room / Actions" 505:35011 — Rename, Delete
//   rename    "Room / Rename" 381:19290
//   move      "Room / Delete / Move plants" 531:196 and its [New room] 531:311
//   new-room  "Room / Delete / Move plants / New room" 531:420
//
// The two "Delete room?" confirmations are Dialogs rather than steps, as drawn;
// RoomScreen opens them once this sheet has finished dismissing.
//
// Presentational: RoomScreen owns which step is showing and every mutation.

import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet, Icon, List, ListItem, RadioButton, TextInput } from '../../components';
import { roomSubtitle } from '../../store/format';
import { roomIcon } from '../../store/model';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';
import { useRoomGate } from './useRoomGate';

const NEW_ROOM = 'new-room';

export default function RoomSheet({
  step,
  room,
  otherRooms = [],
  plantCount = 0,
  onStep,
  onClose,
  onDismiss,
  onRename,
  onDeleteRequest,
  onMoveAndDelete,
  onCreateAndMove,
}) {
  const t = useTheme();
  const gate = useRoomGate();
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState(null);

  // Keep drawing the last step while the sheet animates out, rather than
  // collapsing to an empty panel for its final frames.
  const shown = useRef(step);
  if (step) shown.current = step;
  const view = step ?? shown.current;

  // Each step opens clean: rename on the room's current name, the move with
  // nothing picked, a new room with an empty field.
  useEffect(() => {
    if (step === 'rename') setDraft(room?.name ?? '');
    if (step === 'new-room') setDraft('');
    if (step === 'move') setSelected(null);
  }, [step, room?.name]);

  const name = draft.trim();
  const glyph = (icon) => <Icon name={icon} size={20} color={t.text.primary} />;

  let sheet = {};
  let body = null;

  if (view === 'actions') {
    sheet = { title: 'Actions' };
    body = (
      <List variant="card">
        <ListItem
          before={glyph('edit-pen')}
          title="Rename"
          subtitle="Change this room's name"
          onPress={() => onStep('rename')}
        />
        <ListItem
          before={glyph('trash')}
          title="Delete"
          subtitle="Remove this room once it's empty"
          onPress={onDeleteRequest}
        />
      </List>
    );
  }

  if (view === 'rename') {
    const save = () => name && onRename(name);
    sheet = {
      title: 'Rename room',
      primaryAction: { label: 'Save', onPress: save, disabled: !name },
    };
    body = (
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
    );
  }

  if (view === 'move') {
    const creating = selected === NEW_ROOM;
    const pick = (id) => () => setSelected(id);
    sheet = {
      title: `Move ${roomSubtitle(plantCount)} to`,
      primaryAction: {
        label: creating ? 'Continue' : 'Move and delete room',
        disabled: !selected,
        onPress: () => (creating ? gate(() => onStep('new-room')) : onMoveAndDelete(selected)),
      },
    };
    body = (
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <List variant="card">
          {otherRooms.map((r) => (
            <ListItem
              key={r.id}
              before={glyph(roomIcon(r))}
              title={r.name}
              onPress={pick(r.id)}
              after={
                <RadioButton
                  selected={selected === r.id}
                  onSelect={pick(r.id)}
                  accessibilityLabel={r.name}
                />
              }
            />
          ))}
          <ListItem
            before={glyph('add')}
            title="Create new room"
            onPress={pick(NEW_ROOM)}
            after={
              <RadioButton
                selected={creating}
                onSelect={pick(NEW_ROOM)}
                accessibilityLabel="Create new room"
              />
            }
          />
        </List>
      </ScrollView>
    );
  }

  if (view === 'new-room') {
    const create = () => name && onCreateAndMove(name);
    sheet = {
      title: 'Create new room',
      primaryAction: { label: 'Create and move', onPress: create, disabled: !name },
    };
    body = (
      <TextInput
        label="Room name"
        placeholder="What's the room name?"
        helper={`Every plant from ${room?.name ?? 'this room'} moves here.`}
        value={draft}
        onChangeText={setDraft}
        accessibilityLabel="Room name"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={create}
      />
    );
  }

  return (
    <BottomSheet
      visible={!!step}
      onClose={onClose}
      onDismiss={onDismiss}
      testID="room-sheet"
      {...sheet}
    >
      {body ? <View style={styles.body}>{body}</View> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space[16] },
  scroll: { maxHeight: 340 },
});
