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

/**
 * ScanMatchesScreen — the ranked candidate picker after a scan upload.
 *
 * Params: { photoUri, scan }. Shows the captured photo, the honest design
 * caption (top candidate's %), one SpeciesCard per candidate (with confidence),
 * and a "Search manually" escape hatch.
 *
 * Every exit records a label via POST /scans/{id}/confirm — the tapped candidate,
 * or null for "none of these". That feedback is the reason the candidate list is
 * a list rather than an auto-picked top result, so it fires on both paths. It is
 * fire-and-forget: a failed confirm must never block the user's navigation.
 */
export default function ScanMatchesScreen({ photoUri, scan }) {
  const insets = useSafeAreaInsets();
  const { navigate, back, reset } = useRouter();
  const t = useTheme();
  const styles = makeStyles(t);

  const cards = (scan?.candidates ?? []).map(candidateToCard);

  const label = (candidateId) => {
    if (!scan?.id) return;
    confirmScan(scan.id, candidateId).catch(() => {});
  };

  const onPick = (card) => {
    label(card.candidateId);
    openPlant(card, navigate, { care: scan?.care });
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

        <View style={styles.list}>
          {cards.map((card, i) => (
            <SpeciesCard
              key={card.candidateId ?? i}
              card={card}
              showConfidence
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
