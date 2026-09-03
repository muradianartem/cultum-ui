import { CARE_FACTS, CHIPS, FAQ, DEFAULT_ABOUT } from '../screens/plantData';
import { API_BASE_URL } from './client';

// The catalog serves its own images as root-relative /media/... paths, which RN's
// <Image> can't load — it needs an absolute URL. Provider-supplied images
// (scan candidates) already come through absolute, so leave those alone.
function mediaUrl(path) {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
}

// difficulty/toxicity arrive lowercase ('moderate', 'toxic'); the chips render
// them as labels.
function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Card model — one row in the Matches / Search lists.
//   { candidateId?, rank?, speciesKey, title, subtitle, thumbUri, percent }
// `speciesKey` is the catalog key (slugified Latin name) used to fetch detail;
// `candidateId` only exists for scan candidates and is what POST /scans/{id}/
// confirm labels.
// ---------------------------------------------------------------------------

/** ScanCandidateOut → card. */
export function candidateToCard(c) {
  return {
    candidateId: c.id,
    rank: c.rank,
    speciesKey: c.species_key ?? null,
    title: c.common_name ?? c.scientific_name,
    subtitle: c.scientific_name,
    thumbUri: mediaUrl(c.reference_image_url),
    percent: Math.round((c.probability ?? 0) * 100),
  };
}

/** SpeciesSummary → card. No confidence — these came from a name search. */
export function summaryToCard(s) {
  return {
    speciesKey: s.species_key,
    title: s.common_name ?? s.scientific_name,
    subtitle: s.scientific_name,
    thumbUri: mediaUrl(s.image_thumb_url ?? s.image_url),
    percent: null,
  };
}

// ---- SpeciesDetail → care facts ------------------------------------------
// ProductPage indexes vm.careFacts[0..3] positionally, so this always returns
// exactly four entries in the order Water / Sun / Temperature / Humidity, each
// keeping the icon and label from the static CARE_FACTS and falling back to its
// placeholder value when the API has nothing.
const cToF = (c) => Math.round((c * 9) / 5 + 32);

function waterValue(d) {
  const { water_interval_days_min: min, water_interval_days_max: max } = d;
  if (min != null && max != null) {
    return min === max ? `Every ${min} days` : `Every ${min}–${max} days`;
  }
  const only = min ?? max;
  if (only != null) return `Every ${only} days`;
  return d.water_note ?? null;
}

function temperatureValue(d) {
  const { temp_min_c: min, temp_max_c: max } = d;
  if (min != null && max != null) {
    return `${min}–${max}℃ / ${cToF(min)}–${cToF(max)}℉`;
  }
  const only = min ?? max;
  if (only != null) return `${only}℃ / ${cToF(only)}℉`;
  return null;
}

function careFacts(d) {
  const values = [
    waterValue(d),
    d.sun_label ?? d.sun_level ?? null,
    temperatureValue(d),
    d.humidity_label ?? d.humidity_level ?? null,
  ];
  return CARE_FACTS.map((fact, i) => ({ ...fact, value: values[i] ?? fact.value }));
}

// Difficulty reads as a positive trait, toxicity as a warning. With neither
// present, keep the static chips so the page never renders a bare header.
function chips(d) {
  const out = [];
  if (d.difficulty) {
    out.push({ label: titleCase(d.difficulty), intent: 'positive', icon: 'stickers' });
  }
  const toxic = d.toxicity ?? (d.toxic_to?.length ? 'toxic' : null);
  if (toxic) out.push({ label: titleCase(toxic), intent: 'negative', icon: 'outlined-paw' });
  return out.length ? out : CHIPS;
}

/** SpeciesDetail → the ProductPage view-model. */
export function speciesDetailToVM(d) {
  return {
    commonName: d.common_name ?? d.scientific_name,
    latinName: d.scientific_name ?? '',
    about: d.about ?? DEFAULT_ABOUT,
    heroUri: mediaUrl(d.image_url),
    careFacts: careFacts(d),
    chips: chips(d),
    faq: FAQ,
    speciesKey: d.species_key,
  };
}

/**
 * Card → view-model, for when detail is unavailable (no species key, or the
 * fetch failed). Populates the page from what the card already knows.
 */
export function cardToVM(card) {
  return {
    commonName: card.title,
    latinName: card.subtitle ?? '',
    about: DEFAULT_ABOUT,
    heroUri: card.thumbUri ?? null,
    careFacts: CARE_FACTS,
    chips: CHIPS,
    faq: FAQ,
    speciesKey: card.speciesKey ?? null,
  };
}

export function matchesCaption(topPercent) {
  return `${topPercent}% is a guess, not an answer. Retake it closer, or search by name.`;
}
