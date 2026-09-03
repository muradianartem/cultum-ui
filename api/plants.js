import { apiFetch } from './client';

/**
 * Search the care catalog by common or scientific name. Public (no auth).
 * GET /plants/search?q=<text> → SpeciesSummary[]
 *
 * @param {string} q  query; the API requires at least 2 characters
 */
export async function searchPlants(q) {
  return apiFetch(`/plants/search?q=${encodeURIComponent(q)}`);
}

/**
 * Full care detail for one species. Public (no auth).
 * GET /plants/{species_key} → SpeciesDetail
 *
 * @param {string} speciesKey  slugified Latin name, e.g. 'monstera-deliciosa'
 */
export async function getSpecies(speciesKey) {
  return apiFetch(`/plants/${encodeURIComponent(speciesKey)}`);
}
