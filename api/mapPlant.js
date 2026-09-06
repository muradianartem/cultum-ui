import { CHIPS, DEFAULT_ABOUT } from './fallbacks';
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

// ---- SpeciesDetail → the small facts every section reads ------------------
// Shared by Highlights, How to care and the FAQ, so a species' watering
// interval is phrased identically wherever it appears.
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


// ---- SpeciesDetail → Highlights ------------------------------------------
// The six facts the product page opens with (Figma "Product page" 1:11377).
// Anything the catalog didn't scrape shows an em dash rather than vanishing —
// a six-tile grid with a hole in it reads as a bug, an honest "—" reads as
// missing data.
const UNKNOWN = '—';

function toxicityValue(d) {
  const targets = d.toxic_to?.length ? d.toxic_to.join(', ') : null;
  if (targets) return `Toxic to ${targets}`;
  if (d.toxicity) return titleCase(d.toxicity);
  return UNKNOWN;
}

// The catalog has no pruning field, but growth rate is what actually drives how
// often a plant needs cutting back, so the tile is derived from it.
const PRUNING_BY_GROWTH = {
  fast: 'Often needed',
  moderate: 'Now and then',
  medium: 'Now and then',
  slow: 'Rarely needed',
};

function pruningValue(d) {
  const rate = d.growth_rate ? String(d.growth_rate).toLowerCase() : null;
  return (rate && PRUNING_BY_GROWTH[rate]) ?? UNKNOWN;
}

/** SpeciesDetail → the six Highlights tiles, always in Figma's order. */
export function highlights(d) {
  return [
    { key: 'toxicity', icon: 'outlined-paw', label: 'Toxicity', value: toxicityValue(d) },
    {
      key: 'maintenance',
      icon: 'stickers',
      label: 'Maintenance',
      value: d.difficulty ? titleCase(d.difficulty) : UNKNOWN,
    },
    { key: 'sun', icon: 'sun', label: 'Sun', value: d.sun_label ?? d.sun_level ?? UNKNOWN },
    {
      key: 'temperature',
      icon: 'temperature',
      label: 'Temperature',
      value: temperatureValue(d) ?? UNKNOWN,
    },
    {
      key: 'humidity',
      icon: 'cloude',
      label: 'Humidity',
      value: d.humidity_label ?? d.humidity_level ?? UNKNOWN,
    },
    { key: 'pruning', icon: 'outlined-cut', label: 'Pruning', value: pruningValue(d) },
  ];
}

// ---- SpeciesDetail → care actions ----------------------------------------
// The "How to care" rows: what this species needs and how often. Each row also
// carries the interval in days, which is what the add-a-plant flow seeds its
// reminders from — the schedule the page states and the schedule the app
// actually keeps come from the same number.

const monthsLabel = (months) => {
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? 'Every year' : `Every ${years} years`;
  }
  return months === 1 ? 'Every month' : `Every ${months} months`;
};

/**
 * SpeciesDetail → [{ action, label, icon, value, intervalDays }].
 *
 * A row with no interval still appears when the catalog gave prose instead
 * (`water_note`); it just can't seed a reminder, and `intervalDays` is null.
 */
export function careActions(d) {
  const waterMin = d.water_interval_days_min ?? d.water_interval_days_max ?? null;
  const fertilizeDays = d.fertilize_interval_days ?? null;
  const repotMonths = d.repot_interval_months ?? null;

  return [
    {
      action: 'water',
      label: 'Water',
      icon: 'outlined-water',
      value: waterValue(d) ?? UNKNOWN,
      intervalDays: waterMin,
    },
    {
      action: 'fertilize',
      label: 'Fertilize',
      icon: 'shovel',
      value: fertilizeDays ? everyDays(fertilizeDays) : UNKNOWN,
      intervalDays: fertilizeDays,
    },
    {
      action: 'repot',
      label: 'Repot',
      icon: 'plant',
      value: repotMonths ? monthsLabel(repotMonths) : UNKNOWN,
      intervalDays: repotMonths ? repotMonths * 30 : null,
    },
  ];
}

// "Every 4 weeks" reads better than "Every 28 days" once a cadence is monthly.
function everyDays(days) {
  if (days % 30 === 0 && days >= 30) return monthsLabel(days / 30);
  if (days % 7 === 0 && days >= 14) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

// ---- SpeciesDetail → FAQ --------------------------------------------------
// The accordion answers the five questions in the design, but only where the
// catalog actually knows something. A question with no answer would expand into
// nothing, so it is left out rather than shown as a dead row.

export function faq(d) {
  const out = [];
  const pets = d.toxicity_note ?? (d.toxic_to?.length
    ? `Not entirely — it is toxic to ${d.toxic_to.join(' and ')} if chewed. Keep it somewhere they cannot reach.`
    : null);
  if (pets) out.push({ q: 'Is it safe around pets?', a: pets });

  const water = d.water_note ?? (waterValue(d) ? `${waterValue(d)}, adjusting for light and season.` : null);
  if (water) out.push({ q: 'How often should I water it?', a: water });

  const light = d.sun_label ?? d.sun_level;
  const temp = temperatureValue(d);
  if (light || temp) {
    out.push({
      q: 'Where should it live?',
      a: [light && `Give it ${String(light).toLowerCase()} light.`, temp && `It is happiest at ${temp}.`]
        .filter(Boolean)
        .join(' '),
    });
  }

  const watch = [
    d.toxic_parts?.length && `The ${d.toxic_parts.join(' and ')} are the parts to keep away from pets and children.`,
    d.soil_type && `It wants ${String(d.soil_type).toLowerCase()} soil.`,
    d.humidity_label && `Humidity: ${String(d.humidity_label).toLowerCase()}.`,
  ].filter(Boolean);
  if (watch.length) out.push({ q: 'What should I watch for?', a: watch.join(' ') });

  if (d.growth_rate) {
    out.push({
      q: 'How fast does it grow?',
      a: `${titleCase(d.growth_rate)} — ${String(pruningValue(d)).toLowerCase()} in the way of pruning.`,
    });
  }
  return out;
}

/** SpeciesDetail → the ProductPage view-model. */
export function speciesDetailToVM(d) {
  return {
    commonName: d.common_name ?? d.scientific_name,
    latinName: d.scientific_name ?? '',
    about: d.about ?? DEFAULT_ABOUT,
    heroUri: mediaUrl(d.image_url),
    highlights: highlights(d),
    careActions: careActions(d),
    chips: chips(d),
    faq: faq(d),
    speciesKey: d.species_key,
    // The raw detail rides along so the store can cache it on an owned plant
    // and rebuild this view-model offline (store/GardenProvider.js#addPlant).
    detail: d,
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
    highlights: highlights({}),
    careActions: careActions({}),
    chips: CHIPS,
    faq: [],
    speciesKey: card.speciesKey ?? null,
    detail: null,
  };
}

export function matchesCaption(topPercent) {
  return `${topPercent}% is a guess, not an answer. Retake it closer, or search by name.`;
}
