// "Pick your free plant" (Figma "Trial end / Pick a free plant", 998:774): after
// a lapse, with more plants than the free plan covers, the one whose reminders
// stay on. Rendered inside PlanEndedScreen rather than as a route of its own —
// it sits over that screen in the design, and iOS will not stack a second
// Modal over one that is already up.
//
// The server allows the pick once, and until it is made the earliest plant is
// the one that keeps reminders — that is what `selectedId` arrives as.

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar, BottomSheet, Icon, List, ListItem, RadioButton } from '../components';
import { plantPhoto } from '../store/model';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/foundations';

export default function PickFreePlantSheet({
  visible,
  plants = [],
  roomName = () => null,
  selectedId,
  saving = false,
  onClose,
  onSave,
}) {
  const t = useTheme();
  const [selected, setSelected] = useState(selectedId ?? null);

  // Reopen on the server's current answer, not on a choice that was never saved.
  useEffect(() => {
    if (!visible) return;
    const known = plants.some((p) => p.id === selectedId);
    setSelected(known ? selectedId : plants[0]?.id ?? null);
  }, [visible, selectedId, plants]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Pick your free plant"
      description="On the free plan, reminders stay on for 1 plant. You can only pick once."
      testID="pick-free-plant-sheet"
      primaryAction={{
        label: 'Save',
        onPress: () => onSave?.(selected),
        disabled: !selected || saving,
        loading: saving,
      }}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <List variant="card">
          {plants.map((plant) => {
            const photo = plantPhoto(plant);
            const name = plant.nickname || 'Plant';
            return (
              <ListItem
                key={plant.id}
                before={
                  photo ? (
                    <Avatar source={photo} size="md" accessibilityLabel={name} />
                  ) : (
                    <Icon name="plant" size={20} color={t.text.primary} />
                  )
                }
                title={name}
                subtitle={roomName(plant.roomId) ?? undefined}
                onPress={() => setSelected(plant.id)}
                after={
                  <RadioButton
                    selected={plant.id === selected}
                    onSelect={() => setSelected(plant.id)}
                    accessibilityLabel={name}
                  />
                }
              />
            );
          })}
        </List>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 360 },
  body: { paddingHorizontal: space[16] },
});
