import { StyleSheet, View } from 'react-native';
import { PlantCard } from '../../components';
import { space } from '../../theme/foundations';

/**
 * PlantGrid — Figma's two-column plant grid (12pt gutters), used by both the
 * room detail and the Rooms search results.
 *
 * RN has no CSS grid, and `flexWrap` + `gap` can't express "two equal columns"
 * without hard-coding a width against the screen. So chunk the plants into
 * pairs and lay each pair out as a row of two `flex: 1` cells, padding an odd
 * tail with an invisible spacer so a lone card stays half-width instead of
 * stretching across the row.
 */
export default function PlantGrid({ plants = [], onPress }) {
  const rows = [];
  for (let i = 0; i < plants.length; i += 2) rows.push(plants.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((p) => (
            <PlantCard
              key={p.id}
              style={styles.cell}
              name={p.title}
              meta={p.subtitle}
              photo={p.photo}
              onPress={() => onPress?.(p)}
            />
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space[12] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[12] },
  cell: { flex: 1 },
});
