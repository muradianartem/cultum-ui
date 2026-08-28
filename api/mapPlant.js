import { CARE_FACTS, CHIPS, FAQ, DEFAULT_ABOUT } from '../screens/plantData';

export function candidateToCard(c) {
  return {
    title: c.common_name ?? c.scientific_name,
    subtitle: c.scientific_name,
    thumbUri: c.reference_image_url,
    percent: Math.round((c.probability ?? 0) * 100),
    sourceId: c.provider_ref,
    source: 'perenual',
  };
}

export function summaryToCard(s) {
  return {
    title: s.common_name,
    subtitle: s.scientific_name,
    thumbUri: s.image_url,
    percent: null,
    sourceId: s.source_id,
    source: s.source ?? 'perenual',
  };
}

export function plantDetailToVM(d) {
  const careFacts = CARE_FACTS.map((fact) =>
    fact.label === 'Water' && d.watering_frequency_days
      ? { ...fact, value: `Every ${d.watering_frequency_days} days` }
      : fact
  );
  return {
    commonName: d.common_name,
    latinName: d.scientific_name ?? '',
    about: d.brief ?? DEFAULT_ABOUT,
    heroUri: d.image_url ?? null,
    careFacts,
    chips: CHIPS,
    faq: FAQ,
    source: d.source,
    sourceId: d.source_id,
  };
}

export function cardToVM(card) {
  return {
    commonName: card.title,
    latinName: card.subtitle ?? '',
    about: DEFAULT_ABOUT,
    heroUri: card.thumbUri ?? null,
    careFacts: CARE_FACTS,
    chips: CHIPS,
    faq: FAQ,
    source: card.source,
    sourceId: card.sourceId,
  };
}

export function matchesCaption(topPercent) {
  return `${topPercent}% is a guess, not an answer. Retake it closer, or search by name.`;
}
