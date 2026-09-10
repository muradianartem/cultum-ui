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
import { searchBar } from '../../theme/tokens';
import { searchPlants } from '../../api/plants';
import { summaryToCard } from '../../api/mapPlant';
import SpeciesCard from './SpeciesCard';
import { openPlant } from './openPlant';
import { copyFor } from './errorCopy';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

/**
 * ScanSearchScreen — the "Search manually" fallback. Debounced text search
 * against GET /plants/search; results render as SpeciesCards (no confidence).
 * Zero results shows the "No species by that name" state with a scan escape.
 *
 * Opening a result costs a second round trip (GET /plants/{species_key}), so it
 * gets the same guarded lifecycle as the Matches screen: one open in flight,
 * a spinner on the chosen row, and a failure reported in place. `openError` is
 * kept separate from the search `error` so a failed open leaves the results
 * list standing — the user's query is still good, only the tap failed.
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
  const [pending, setPending] = useState(null);
  const [openError, setOpenError] = useState(null);

  useEffect(() => {
    const q = query.trim();
    setOpenError(null);
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

  const onOpen = async (card) => {
    if (pending) return;
    setPending(card.speciesKey);
    setOpenError(null);
    try {
      await openPlant(card, navigate);
    } catch (e) {
      setOpenError({ err: e, card });
    } finally {
      setPending(null);
    }
  };

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
          leftIcon={<Icon name="search" size={20} color={searchBar.placeholder} />}
          clearIcon={<Icon name="close" size={20} color={searchBar.ink} />}
        />

        {loading ? (
          <View style={styles.center}>
            <LoadingIndicator />
          </View>
        ) : error ? (
          <Text style={styles.error}>Couldn’t search right now. Check your connection and try again.</Text>
        ) : noResults ? (
          <View style={styles.emptyWrap}>
            <State
              icon={<Icon name="search" size={24} color={t.text.primary} />}
              iconVariant="secondary"
              title="No results found"
              subtitle="Please try another name, or scan the plant instead."
              primaryAction={{
                label: 'Scan it instead',
                leftIcon: <Icon name="outlined-scan" size={16} color={t.brand.onPrimary} />,
                onPress: () => reset('scan-camera'),
              }}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {openError ? (
              <State
                variant="card"
                title={copyFor(openError.err?.code).title}
                subtitle={copyFor(openError.err?.code).subtitle}
                primaryAction={{ label: 'Try again', onPress: () => onOpen(openError.card) }}
              />
            ) : null}
            {results.map((card, i) => (
              <SpeciesCard
                key={card.speciesKey ?? i}
                card={card}
                showConfidence={false}
                loading={pending != null && pending === card.speciesKey}
                disabled={pending != null}
                onPress={() => onOpen(card)}
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
    body: {
      flex: 1,
      paddingTop: space[8],
      paddingHorizontal: space[16],
      paddingBottom: space[16],
      gap: space[16],
    },
    list: { gap: space[12] },
    center: { paddingTop: space[24], alignItems: 'center' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: space[48] },
    error: { ...typography.bodyMedium, color: t.error.primary },
  });
