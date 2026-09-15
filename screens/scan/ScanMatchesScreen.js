import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, NavigationBar, State } from '../../components';
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
 * flight at a time, a spinner on the chosen row, and a full-screen retry state
 * on failure rather than a Product page filled with placeholder care values.
 *
 * Figma: "Scan / Matches" (158:10405). The design has no no-match or error
 * frame; both are composed from "Camera access" (158:10369) and "Search
 * manually · No results" (158:10511) — a centred State with stacked actions.
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

  // Figma floats Retake over the bar rather than putting it in the bar's
  // (icon-only) action slot, which also keeps the title optically centred.
  const header = (showRetake) => (
    <View style={{ paddingTop: insets.top }}>
      <View>
        <NavigationBar
          title="Matching"
          leading="close"
          onLeadingPress={() => reset('today')}
          buttonVariant="secondary"
          divider={false}
        />
        {showRetake ? (
          <Button
            label="Retake"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={back}
            style={styles.retake}
          />
        ) : null}
      </View>
    </View>
  );

  const searchAction = {
    label: 'Search manually',
    leftIcon: <Icon name="search" size={16} color={t.text.primary} />,
    onPress: onNoneOfThese,
  };

  const centred = (showRetake, state) => (
    <View style={styles.screen}>
      {header(showRetake)}
      <View style={styles.emptyWrap}>{state}</View>
    </View>
  );

  if (cards.length === 0) {
    // The primary action is Retake, so the header pill would say it twice.
    return centred(
      false,
      <State
        style={styles.state}
        icon={<Icon name="outlined-scan" size={24} color={t.text.primary} />}
        iconVariant="secondary"
        title="No plant found"
        subtitle="Try a clearer, closer photo."
        primaryAction={{
          label: 'Retake',
          leftIcon: <Icon name="outlined-scan" size={16} color={t.brand.onPrimary} />,
          onPress: back,
        }}
        secondaryAction={searchAction}
      />
    );
  }

  if (error) {
    const copy = copyFor(error.err?.code);
    return centred(
      true,
      <State
        style={styles.state}
        icon={<Icon name="outlined-scan" size={24} color={t.text.primary} />}
        iconVariant="secondary"
        title={copy.title}
        subtitle={copy.subtitle}
        primaryAction={{ label: 'Try again', onPress: () => onPick(error.card) }}
        secondaryAction={searchAction}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {header(true)}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}
        <Text style={styles.caption}>{matchesCaption(cards[0]?.percent ?? 0)}</Text>

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
            size="sm"
            fullWidth={false}
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
    // 40pt pill centred in the 56pt bar, on the bar's 16pt inset.
    retake: { position: 'absolute', top: space[8], right: space[16] },
    content: { padding: space[16], gap: space[20], alignItems: 'stretch' },
    photo: { width: 168, height: 168, borderRadius: radius[16], alignSelf: 'center' },
    caption: { ...typography.bodyLarge, color: t.text.secondary, textAlign: 'center' },
    list: { gap: space[12] },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: space[8],
      paddingTop: space[4],
    },
    noneText: { ...typography.bodyMedium, color: t.text.secondary },
    // Figma's "Empty" frame: centred in the leftover height, lifted by 64pt.
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space[16],
      paddingBottom: 64,
    },
    state: { width: '100%' },
  });
