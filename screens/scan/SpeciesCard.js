import { Image, StyleSheet, View } from 'react-native';
import { ConfidenceRing, Icon, List, ListItem } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/foundations';

/**
 * SpeciesCard — one candidate/result row, shared by the Matches and Search
 * screens. Built on List/ListItem to match the app's card rows (ProductPage's
 * TaskRow). Shows a thumbnail, name/latin subtitle, a chevron, and — on Matches
 * only (`showConfidence`) — a ConfidenceRing with the match probability.
 *
 * @param {object}   card            SpeciesCardModel from api/mapPlant
 * @param {boolean}  showConfidence  render the confidence ring (Matches only)
 * @param {Function} onPress         open the plant
 */
export default function SpeciesCard({ card, showConfidence = false, onPress }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const ring = showConfidence && card.percent != null;

  return (
    <List variant="card">
      <ListItem
        onPress={onPress}
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
            <Icon name="chevron-right" size={24} color={t.text.primary} />
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
  });
