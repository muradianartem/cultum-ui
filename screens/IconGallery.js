import { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, ICON_NAMES } from '../components';
import { useTheme } from '../theme/ThemeProvider';

/**
 * IconGallery — a catalog of every icon in the Cultum set. Not part of the app
 * flow; a reference/QA screen for browsing the 158 glyphs and their names.
 */
export default function IconGallery() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Text style={styles.title}>Icons · {ICON_NAMES.length}</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {ICON_NAMES.map((name) => (
          <View key={name} style={styles.cell}>
            <Icon name={name} size={24} color={t.text.primary} />
            <Text style={styles.label} numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background.primary },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: t.text.primary,
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
  label: { fontSize: 10, color: t.text.secondary, textAlign: 'center' },
});
