import { getSpecies } from '../../api/plants';
import { speciesDetailToVM, cardToVM } from '../../api/mapPlant';

/**
 * Open the Product page for a chosen candidate/result.
 *
 * A scan response carries `care` — the full SpeciesDetail for the top match —
 * so when the tapped card is that match we render straight from it and skip the
 * round trip. Otherwise fetch by species key; if there's no key or the fetch
 * fails, fall back to a VM built from the card so the tap still lands on a
 * populated page.
 *
 * @param {object}   card      card model (from candidateToCard/summaryToCard)
 * @param {Function} navigate  router push
 * @param {object}   [opts]    { care } — ScanResult.care, when coming from a scan
 */
export async function openPlant(card, navigate, { care } = {}) {
  if (care && card.speciesKey && care.species_key === card.speciesKey) {
    navigate('product', { plant: speciesDetailToVM(care) });
    return;
  }
  if (!card.speciesKey) {
    navigate('product', { plant: cardToVM(card) });
    return;
  }
  try {
    const detail = await getSpecies(card.speciesKey);
    navigate('product', { plant: speciesDetailToVM(detail) });
  } catch {
    navigate('product', { plant: cardToVM(card) });
  }
}
