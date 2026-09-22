// AddPlantScreen — the "Add a plant" flow (Figma section "Add a plant",
// node 338:2946), reached from the product page's "Add to my plants" CTA:
//
//   name      (338:2947)  name it, or pick a suggestion      → Continue
//   room      (338:2948)  choose a room, or add one          → Continue
//   reminders (338:2949)  opt into watering / fertilizing    → Skip / Continue
//   success   (338:2951)  what was added and what's next     → Done
//
// One route, four steps. The Router has no shared param store and spreads
// params as props, so four routes would mean threading the whole draft through
// navigate() on every step — and losing it on back(). Instead the draft lives
// here and `step` walks the PREVIOUS map, the same shape AddReminderSheet uses.
//
// Leaving the reminders step writes the plant and its reminders to the store
// in one commit, before success renders — that screen says the plant was
// added, and every one of its exits (Done, close, Scan another plant) must
// keep it. Done and close then re-enter the product page through replace()
// with the new plant's id — a Route only renders while it matches, so
// ProductPage is unmounted for the whole flow and there is no state there to
// call back into.

import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, NavigationBar, useKeyboard } from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';
import { useGarden } from '../../store/GardenProvider';
import { parseFrequency } from '../../store/format';
import AddReminderSheet from '../AddReminderSheet';
import AddRoomSheet from './AddRoomSheet';
import { useRoomGate } from '../rooms/useRoomGate';
import NameStep from './NameStep';
import RemindersStep from './RemindersStep';
import RoomStep from './RoomStep';
import SuccessStep from './SuccessStep';
import {
  customReminderRow,
  defaultReminders,
  nameSuggestions,
  remindersCta,
  successSubtitle,
  successTitle,
} from './addPlantData';

// Where "back" goes from each step. `name` is the first step and `success` is
// terminal, so neither has one — their leading affordance is close instead.
const PREVIOUS = { name: null, room: 'name', reminders: 'room', success: null };

const TITLES = {
  name: { title: 'Name your plant', subtitle: 'Step 1 of 3' },
  room: { title: 'Choose a room', subtitle: 'Step 2 of 3' },
  reminders: { title: 'Set reminders', subtitle: 'Step 3 of 3' },
  success: {},
};

export default function AddPlantScreen({ plant, today }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const { back, replace, reset } = useRouter();
  const garden = useGarden();
  const gate = useRoomGate();

  const vm = plant;

  const [step, setStep] = useState('name');
  const [name, setName] = useState(() => vm?.commonName ?? '');
  const [roomId, setRoomId] = useState(null);
  const [reminders, setReminders] = useState(() => defaultReminders(vm));
  const [roomSheet, setRoomSheet] = useState(false);
  const [reminderSheet, setReminderSheet] = useState(false);
  // The new plant's id, set once it is in the store. Success has no way back,
  // so it never needs clearing.
  const savedId = useRef(null);

  // Rooms come from the store, so one created here is a room everywhere —
  // the flow no longer keeps a private list that the Rooms tab never sees.
  const rooms = garden.rooms;
  const room = rooms.find((r) => r.id === roomId) ?? null;
  const previous = PREVIOUS[step];

  const openPlant = () => replace('product', { plantId: savedId.current });

  // The leading button steps backwards through the flow where it can, and
  // otherwise leaves it — from success, onto the plant that was just saved
  // rather than back to the species it came from.
  const leave = () => {
    if (previous) setStep(previous);
    else if (step === 'success') openPlant();
    else back();
  };

  const addRoom = (roomName) => setRoomId(garden.addRoom(roomName));

  const toggleReminder = (id) =>
    setReminders((list) =>
      list.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );

  const addCustomReminder = (draft) =>
    setReminders((list) => [...list, customReminderRow(draft, parseFrequency(draft.frequency))]);

  // Runs from the reminders CTA. A ref, not state, guards it: two taps in the
  // same frame would both still read the old state and add the plant twice.
  const save = () => {
    if (!savedId.current) {
      savedId.current = garden.addPlant({
        speciesKey: vm?.speciesKey ?? null,
        nickname: name,
        roomId,
        // The raw SpeciesDetail, so the plant's page renders in full offline.
        care: vm?.detail ?? null,
        heroUri: vm?.heroUri ?? null,
        reminders: reminders
          .filter((r) => r.enabled)
          .map((r) => ({
            action: r.action,
            title: r.title,
            intervalDays: r.intervalDays,
            startAt: r.startAt ?? null,
          })),
      });
    }
    setStep('success');
  };

  // Both sheets are Modals, and iOS won't present a second over an open one —
  // so only one of them is ever mounted visible at a time. At the plan's room
  // limit the paywall opens instead.
  const openRoomSheet = () =>
    gate(() => {
      setReminderSheet(false);
      setRoomSheet(true);
    });
  const openReminderSheet = () => {
    setRoomSheet(false);
    setReminderSheet(true);
  };

  const addAction = {
    room: { icon: <Icon name="add" size={20} color={t.text.primary} />, onPress: openRoomSheet, accessibilityLabel: 'Add a new room' },
    reminders: { icon: <Icon name="add" size={20} color={t.text.primary} />, onPress: openReminderSheet, accessibilityLabel: 'Add custom reminder' },
  }[step];

  const cta = remindersCta(reminders);

  return (
    <View style={[styles.screen, { backgroundColor: t.background.primary, paddingTop: insets.top }]}>
      <NavigationBar
        {...TITLES[step]}
        leading={previous ? 'back' : 'close'}
        onLeadingPress={leave}
        actions={addAction ? [addAction] : []}
        buttonVariant="secondary"
        divider={false}
      />

      {/* The Name step autofocuses its field — keep Continue above the keyboard. */}
      <View style={[styles.content, { paddingBottom: keyboardHeight }]}>

        {step === 'name' ? (
          <NameStep
            photo={vm?.heroUri}
            name={name}
            onChangeName={setName}
            suggestions={nameSuggestions(vm ?? {})}
          />
        ) : null}

        {step === 'room' ? (
          <RoomStep
            rooms={rooms}
            selectedId={roomId}
            onSelect={setRoomId}
            onAddRoom={openRoomSheet}
          />
        ) : null}

        {step === 'reminders' ? (
          <RemindersStep
            reminders={reminders}
            onToggle={toggleReminder}
            onAddCustom={openReminderSheet}
          />
        ) : null}

        {step === 'success' ? (
          <SuccessStep
            photo={vm?.heroUri}
            title={successTitle(name, room?.name ?? '')}
            subtitle={successSubtitle(reminders, today ?? new Date())}
          />
        ) : null}

        <View
          style={[
            styles.footer,
            { paddingBottom: space[16] + (keyboardVisible ? 0 : insets.bottom) },
          ]}
        >
          {step === 'name' ? (
            <Button
              label="Continue"
              size="lg"
              disabled={name.trim().length === 0}
              onPress={() => setStep('room')}
            />
          ) : null}

          {step === 'room' ? (
            <Button
              label="Continue"
              size="lg"
              disabled={!room}
              onPress={() => setStep('reminders')}
            />
          ) : null}

          {step === 'reminders' ? (
            <Button
              label={cta.label}
              variant={cta.variant}
              size="lg"
              onPress={save}
            />
          ) : null}

          {step === 'success' ? (
            <>
              <Button
                label="Scan another plant"
                variant="secondary"
                size="lg"
                leftIcon={<Icon name="outlined-scan" size={20} color={t.text.primary} />}
                onPress={() => reset('scan-camera')}
              />
              <Button label="Done" size="lg" onPress={openPlant} />
            </>
          ) : null}
        </View>
      </View>

      <AddRoomSheet
        visible={roomSheet}
        onClose={() => setRoomSheet(false)}
        onConfirm={addRoom}
      />

      <AddReminderSheet
        visible={reminderSheet}
        today={today}
        onClose={() => setReminderSheet(false)}
        onConfirm={addCustomReminder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
  footer: {
    paddingHorizontal: space[16],
    paddingTop: space[8],
    gap: space[12],
  },
});
