// Step 1 of the add-a-plant flow (Figma "Add a plant / Name", node 338:2947):
// the plant's photo, a name field prefilled with the species' common name, and
// a row of suggestion chips that fill it in.
//
// Chrome-less — AddPlantScreen supplies the nav bar and the Continue footer,
// the way SnoozeContent leans on its host sheet.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip, Icon, TextInput } from '../../components';
import { space } from '../../theme/foundations';
import { list, textInput } from '../../theme/tokens';
import { HERO } from '../plantData';

export default function NameStep({ photo, name, onChangeName, suggestions }) {
  return (
    <View style={styles.body}>
      <Image source={photo ? { uri: photo } : HERO} style={styles.photo} />

      <TextInput
        label="Plant Name"
        value={name}
        onChangeText={onChangeName}
        placeholder="Give it a name"
        autoFocus
        returnKeyType="done"
        rightIcon={
          name ? (
            <Pressable
              onPress={() => onChangeName('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear name"
            >
              <Icon name="close" size={20} color={textInput.placeholder} />
            </Pressable>
          ) : null
        }
      />

      <View style={styles.suggestions}>
        <Text style={styles.suggestionsLabel}>Suggestions</Text>
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={s === name}
              onPress={() => onChangeName(s)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    gap: space[24],
    paddingHorizontal: space[16],
    paddingVertical: space[24],
  },
  photo: { width: 152, height: 152, borderRadius: 18 },
  suggestions: { alignSelf: 'stretch', gap: 10 },
  suggestionsLabel: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: list.subtitleInk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8] },
});
