import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Icon,
  LoadingIndicator,
  NavigationBar,
  SearchBar,
  State,
} from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';
import { searchPlants } from '../../api/plants';
import { summaryToCard } from '../../api/mapPlant';
import SpeciesCard from './SpeciesCard';
import { openPlant } from './openPlant';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

/**
 * ScanSearchScreen — the "Search manually" fallback. Debounced text search
 * against GET /plants/search; results render as SpeciesCards (no confidence).
 * Zero results shows the "No species by that name" state with a scan escape.
 */
export default function ScanSearchScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, back, reset } = useRouter();
  const t = useTheme();
  const styles = makeStyles(t);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await searchPlants(q);
        if (cancelled) return;
        setResults(res.map(summaryToCard));
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setResults([]);
        setError(e);
      } finally {
        if (!cancelled) {
          setSearched(true);
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const noResults = searched && !loading && !error && results.length === 0;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationBar
          title="Search manually"
          leading={<Icon name="chevron-left" size={24} color={t.text.primary} />}
          onLeadingPress={back}
        />
      </View>

      <View style={styles.body}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="e.g Monstera"
        />

        {loading ? (
          <View style={styles.center}>
            <LoadingIndicator />
          </View>
        ) : error ? (
          <Text style={styles.error}>Couldn’t search right now. Check your connection and try again.</Text>
        ) : noResults ? (
          <State
            icon={<Icon name="search" size={28} color={t.text.primary} />}
            title="No species by that name"
            subtitle="Try the Latin name, or scan the plant instead."
            primaryAction={{
              label: 'Scan it instead',
              onPress: () => reset('scan-camera'),
            }}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {results.map((card, i) => (
              <SpeciesCard
                key={card.sourceId ?? i}
                card={card}
                showConfidence={false}
                onPress={() => openPlant(card, navigate)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    body: { flex: 1, padding: space[16], gap: space[16] },
    list: { gap: space[8] },
    center: { paddingTop: space[24], alignItems: 'center' },
    error: { ...typography.bodyMedium, color: t.error.primary },
  });
