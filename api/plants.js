import { apiFetch } from './client';

/**
 * Text search for a plant by name. Public (no auth).
 * GET /plants/search?q=<text>&page=<n> → PlantSummary[]
 *
 * @param {string} q     query (caller enforces min length / debounce)
 * @param {number} page  1-based page (default 1)
 */
export async function searchPlants(q, page = 1) {
  return apiFetch(`/plants/search?q=${encodeURIComponent(q)}&page=${page}`);
}

/**
 * Full detail for one plant. Public (no auth).
 * GET /plants/{source_id}?source=<source> → PlantDetail
 *
 * @param {string} sourceId  provider id (e.g. a perenual ref)
 * @param {string} source    provider name (default 'perenual')
 */
export async function getPlantDetail(sourceId, source = 'perenual') {
  return apiFetch(`/plants/${encodeURIComponent(sourceId)}?source=${encodeURIComponent(source)}`);
}
