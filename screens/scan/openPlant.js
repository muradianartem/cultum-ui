import { getSpecies } from '../../api/plants';
import { speciesDetailToVM, cardToVM } from '../../api/mapPlant';

/**
 * Open the Product page for a chosen candidate/search result.
 *
 * Care data always comes from GET /plants/{species_key}. A scan response also
 * carries `care` — the full SpeciesDetail for its top match — but reading it
 * would give the top candidate an instant page while every other candidate paid
 * a round trip, and that latency gap is a nudge toward the top result on a
 * screen whose whole point is an unbiased explicit pick. One path instead.
 *
 * Rejects with the ApiError from the fetch: the caller shows a retry state.
 * Falling back to a card-built view-model here would hand the Add Plant flow
 * placeholder care intervals to seed real reminders from, with nothing on
 * screen saying the numbers were invented.
 *
 * @param {object}   card      card model (from candidateToCard/summaryToCard)
 * @param {Function} navigate  router push
 * @throws {ApiError} when the detail fetch fails
 */
export async function openPlant(card, navigate) {
  // A candidate the provider matched outside our catalog has no key — there is
  // nothing to fetch, so the card's own data is all there will ever be.
  if (!card.speciesKey) {
    navigate('product', { plant: cardToVM(card) });
    return;
  }
  const detail = await getSpecies(card.speciesKey);
  navigate('product', { plant: speciesDetailToVM(detail) });
}
