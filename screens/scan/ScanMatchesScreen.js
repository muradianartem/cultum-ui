import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ButtonIcon, Icon, State } from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/foundations';
import { candidateToCard, matchesCaption } from '../../api/mapPlant';
import { confirmScan } from '../../api/scans';
import SpeciesCard from './SpeciesCard';
import { openPlant } from './openPlant';
import { copyFor } from './errorCopy';

/**
 * ScanMatchesScreen — the ranked candidate picker after a scan upload.
 *
 * Params: { photoUri, scan }. Shows the captured photo, the honest design
 * caption (top candidate's %), one SpeciesCard per candidate (with confidence),
 * and a "Search manually" escape hatch.
 *
 * Picking a candidate — and "None of these" — records a label via POST
 * /scans/{id}/confirm. That feedback is the reason this is a list the user
 * chooses from rather than an auto-picked top result, so it is the tap itself
 * that labels. Abandoning the screen (Close, Retake) deliberately records
 * nothing: leaving is not an answer about which plant this is. The confirm is
 * fire-and-forget — a lost label must never block navigation.
 *
 * The pick then fetches care detail (GET /plants/{species_key}), which against
 * a cold backend takes seconds, so it runs as a guarded lifecycle: one pick in
 * flight at a time, a spinner on the chosen row, and a retry state on failure
 * rather than a Product page filled with placeholder care values.
 */
export default function ScanMatchesScreen({ photoUri, scan }) {
  const insets = useSafeAreaInsets();
  const { navigate, back, reset } = useRouter();
  const t = useTheme();
  const styles = makeStyles(t);

  const cards = (scan?.candidates ?? []).map(candidateToCard);

  // The candidate whose detail fetch is in flight, and the failure to retry.
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  // A scan gets one answer: re-picking after a failure must not re-label, and
  // the in-flight guard stops a second card from contradicting the first.
  const labelled = useRef(new Set());

  const label = (candidateId) => {
    if (!scan?.id) return;
    const key = candidateId ?? 'none';
    if (labelled.current.has(key)) return;
    labelled.current.add(key);
    confirmScan(scan.id, candidateId).catch(() => {});
  };

  const onPick = async (card) => {
    if (pending) return;
    label(card.candidateId);
    setPending(card.candidateId ?? card.speciesKey ?? 'pick');
    setError(null);
    try {
      await openPlant(card, navigate);
    } catch (e) {
      setError({ err: e, card });
    } finally {
      setPending(null);
    }
  };

  const onNoneOfThese = () => {
    label(null);
    navigate('scan-search');
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space[8] }]}>
      <ButtonIcon
        variant="ghost"
        size="md"
        icon={<Icon name="close" size={24} color={t.text.primary} />}
        onPress={() => reset('today')}
        accessibilityLabel="Close"
      />
      <Text style={styles.title}>Match</Text>
      <Button label="Retake" variant="outline" size="sm" onPress={back} />
    </View>
  );

  if (cards.length === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.emptyWrap}>
          <State
            icon={<Icon name="outlined-scan" size={28} color={t.text.primary} />}
            title="No plant found"
            subtitle="Try a clearer, closer photo."
            primaryAction={{ label: 'Retake', onPress: back }}
            secondaryAction={{ label: 'Search manually', onPress: onNoneOfThese }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}
        <Text style={styles.caption}>{matchesCaption(cards[0]?.percent ?? 0)}</Text>

        {error ? (
          // Keep the photo and caption above this: the user should still see
          // which scan they're retrying.
          <State
            variant="card"
            icon={<Icon name="outlined-scan" size={28} color={t.text.primary} />}
            title={copyFor(error.err?.code).title}
            subtitle={copyFor(error.err?.code).subtitle}
            primaryAction={{ label: 'Try again', onPress: () => onPick(error.card) }}
            secondaryAction={{ label: 'Search manually', onPress: onNoneOfThese }}
          />
        ) : null}

        <View style={styles.list}>
          {cards.map((card, i) => (
            <SpeciesCard
              key={card.candidateId ?? i}
              card={card}
              showConfidence
              loading={pending != null && pending === card.candidateId}
              disabled={pending != null}
              onPress={() => onPick(card)}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.noneText}>None of these?</Text>
          <Button
            label="Search manually"
            variant="secondary"
            size="md"
            onPress={onNoneOfThese}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space[16],
      paddingBottom: space[8],
    },
    title: { ...typography.headingSmallEmphasized, color: t.text.primary },
    content: { padding: space[16], gap: space[20], alignItems: 'stretch' },
    photo: { width: 168, height: 168, borderRadius: radius[16], alignSelf: 'center' },
    caption: { ...typography.bodyLarge, color: t.text.secondary, textAlign: 'center' },
    list: { gap: space[12] },
    footer: { alignItems: 'center', gap: space[8] },
    noneText: { ...typography.bodyMedium, color: t.text.secondary },
    emptyWrap: { flex: 1, justifyContent: 'center', padding: space[16] },
  });
