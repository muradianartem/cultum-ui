// Placeholders for a catalog entry that is missing pieces.
//
// The care catalog is scraped, so a species can arrive with no prose and no
// difficulty or toxicity at all. The Highlights grid says "—" for a fact it
// doesn't have, but a page with no description and no chips reads as broken
// rather than as incomplete data — so those two have a stand-in.
//
// They live here rather than in a screen because api/mapPlant.js is what needs
// them: they are part of translating a SpeciesDetail, not part of any view.

export const DEFAULT_ABOUT =
  'The split leaves are a grown-up trait: young plants only start fenestrating with enough light and something to climb.';

export const CHIPS = [
  { label: 'Easy', intent: 'positive', icon: 'stickers' },
  { label: 'Toxic', intent: 'negative', icon: 'outlined-paw' },
];
