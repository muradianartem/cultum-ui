import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, ICON_NAMES } from '../components';
import { colors } from '../theme/tokens';

/**
 * IconGallery — a catalog of every icon in the Cultum set. Not part of the app
 * flow; a reference/QA screen for browsing the 142 glyphs and their names.
 */
export default function IconGallery() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Text style={styles.title}>Icons · {ICON_NAMES.length}</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {ICON_NAMES.map((name) => (
          <View key={name} style={styles.cell}>
            <Icon name={name} size={24} color={colors.ink} />
            <Text style={styles.label} numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 40,
  },
  cell: {
    width: 88,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  label: { fontSize: 10, color: colors.ink3, textAlign: 'center' },
});
