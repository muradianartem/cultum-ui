// Step 1 of the add-a-plant flow (Figma "Add a plant / Name", node 338:2947):
// the plant's photo, a name field prefilled with the species' common name, and
// a row of suggestion chips that fill it in.
//
// Chrome-less — AddPlantScreen supplies the nav bar and the Continue footer,
// the way SnoozeContent leans on its host sheet.

import { useMemo } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip, Icon, TextInput } from '../../components';
import { space } from '../../theme/foundations';
import { useTheme } from '../../theme/ThemeProvider';
import { HERO } from '../placeholderPhotos';

export default function NameStep({ photo, name, onChangeName, suggestions }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  // Tapping anywhere off the field puts the keyboard away.
  return (
    <Pressable style={styles.body} onPress={Keyboard.dismiss} accessible={false}>
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
              <Icon name="close" size={20} color={t.text.placeholder} />
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
    </Pressable>
  );
}

const makeStyles = (t) => StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    gap: space[24],
    paddingHorizontal: space[16],
    paddingVertical: space[24],
  },
  photo: { width: 152, height: 152, borderRadius: 18 },
  suggestions: { alignSelf: 'stretch', gap: 10 },
  suggestionsLabel: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: t.text.secondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8] },
});
