import { getPlantDetail } from '../../api/plants';
import { plantDetailToVM, cardToVM } from '../../api/mapPlant';

/**
 * Open the Product page for a chosen candidate/result. Fetches full detail and
 * maps it to a PlantVM; if there's no sourceId or the fetch fails, falls back to
 * a VM built straight from the card so the tap still lands on a populated page.
 *
 * @param {object}   card      SpeciesCardModel (from candidateToCard/summaryToCard)
 * @param {Function} navigate  router push
 */
export async function openPlant(card, navigate) {
  if (!card.sourceId) {
    navigate('product', { plant: cardToVM(card) });
    return;
  }
  try {
    const detail = await getPlantDetail(card.sourceId, card.source);
    navigate('product', { plant: plantDetailToVM(detail) });
  } catch {
    navigate('product', { plant: cardToVM(card) });
  }
}
