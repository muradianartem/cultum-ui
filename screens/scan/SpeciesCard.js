import { Image, StyleSheet, View } from 'react-native';
import { ConfidenceRing, Icon, List, ListItem, LoadingIndicator } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/foundations';

// How far a row fades while another row's pick is in flight. Enough to read as
// "not right now" without hiding which plant the row is.
const DIMMED = 0.4;

/**
 * SpeciesCard — one candidate/result row, shared by the Matches and Search
 * screens. Built on List/ListItem to match the app's card rows (ProductPage's
 * TaskRow). Shows a thumbnail, name/latin subtitle, a chevron, and — on Matches
 * only (`showConfidence`) — a ConfidenceRing with the match probability.
 *
 * Opening a plant costs a round trip to GET /plants/{species_key}, and against
 * a cold backend that is seconds, so a pick has to look like it landed: the
 * chosen row swaps its chevron for a spinner (`loading`) and every row goes
 * inert (`disabled`) until it resolves. Dropping onPress is what makes a row
 * inert — ListItem renders a plain View without it.
 *
 * @param {object}   card            SpeciesCardModel from api/mapPlant
 * @param {boolean}  showConfidence  render the confidence ring (Matches only)
 * @param {boolean}  loading         this row's pick is in flight
 * @param {boolean}  disabled        some pick is in flight — ignore taps
 * @param {Function} onPress         open the plant
 */
export default function SpeciesCard({
  card,
  showConfidence = false,
  loading = false,
  disabled = false,
  onPress,
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const ring = showConfidence && card.percent != null;
  const inert = disabled || loading;

  return (
    <List variant="card">
      <ListItem
        onPress={inert ? undefined : onPress}
        style={inert && !loading ? styles.dimmed : null}
        before={
          card.thumbUri ? (
            <Image source={{ uri: card.thumbUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]} />
          )
        }
        title={card.title}
        subtitle={card.subtitle}
        after={
          <View style={styles.after}>
            {ring ? <ConfidenceRing percent={card.percent} /> : null}
            {loading ? (
              <LoadingIndicator size={24} accessibilityLabel="Opening" />
            ) : (
              <Icon name="chevron-right" size={24} color={t.text.primary} />
            )}
          </View>
        }
      />
    </List>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    thumb: { width: 56, height: 56, borderRadius: radius[12] },
    thumbPlaceholder: { backgroundColor: t.surface.secondary },
    after: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    dimmed: { opacity: DIMMED },
  });
