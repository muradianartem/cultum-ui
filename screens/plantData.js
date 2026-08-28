
export const PLANT = {
  commonName: 'Swiss cheese plant',
  latinName: 'Monstera deliciosa',
  owned: { title: 'You already have one', subtitle: 'Kitchen Monstera · Kitchen' },
  about:
    'The split leaves are a grown-up trait: young plants only start ' +
    'fenestrating with enough light and something to climb.',
};

// Fallback "About" copy for plants whose PlantDetail has no `brief` (used by the
// api/mapPlant view-models). Kept identical to the static product page.
export const DEFAULT_ABOUT = PLANT.about;

// `icon` values are Cultum icon names (see components/iconRegistry.js), mapped
// from the Figma "Product Page" badges: Easy → stickers, Toxic → outlined-paw.
export const CHIPS = [
  { label: 'Easy', intent: 'positive', icon: 'stickers' },
  { label: 'Toxic', intent: 'negative', icon: 'outlined-paw' },
];

export const HERO = require('../assets/plant/hero.png');

export const PHOTOS = [
  require('../assets/plant/gallery1.png'),
  require('../assets/plant/gallery2.png'),
  require('../assets/plant/hero.png'),
];

// `icon` values are Cultum icon names (see components/iconRegistry.js), mapped
// from the Figma Care Facts: Water → outlined-water, Sun → sun,
// Temperature → temperature, Humidity → cloude.
export const CARE_FACTS = [
  { icon: 'outlined-water', label: 'Water', value: 'Every 7–10 days' },
  { icon: 'sun', label: 'Sun', value: 'Bright, indirect' },
  { icon: 'temperature', label: 'Temperature', value: '18–27℃ / 64–81℉' },
  { icon: 'cloude', label: 'Humidity', value: 'Average home is fine' },
];

export const FAQ = [
  {
    q: 'Is it safe around pets?',
    a: 'No. Monstera is toxic to cats and dogs if chewed — keep it out of their reach.',
  },
  { q: 'How often should I water it?' },
  { q: 'Where should it live?' },
  { q: 'What should I watch for?' },
  { q: 'How fast does it grow?' },
];

// The static Product-page view-model (PlantVM shape), used when ProductPage is
// opened with no `plant` param — i.e. the existing standalone `product` route.
// `heroUri: null` makes the page fall back to the bundled HERO asset.
export const DEFAULT_PLANT_VM = {
  commonName: PLANT.commonName,
  latinName: PLANT.latinName,
  about: PLANT.about,
  heroUri: null,
  careFacts: CARE_FACTS,
  chips: CHIPS,
  faq: FAQ,
  source: null,
  sourceId: null,
};


// `tone` is a semantic feedback category the screen resolves to theme colours
// (tile = `<tone>.secondary` tint, icon = `<tone>.primary`) so the tiles follow
// light/dark instead of hard-coding hex.
export const TODAYS_TASKS = [
  {
    id: 'water',
    icon: 'outlined-water',
    title: 'Watering',
    subtitle: 'Every 6 days',
    due: 'Today',
    tone: 'information',
  },
  {
    id: 'fertilize',
    icon: 'power',
    title: 'Fertilizing',
    subtitle: 'Every 4 weeks',
    due: '3d ago',
    tone: 'warning',
  },
];

// Shown in the "All caught up" banner once every task is done.
export const NEXT_REMINDER = 'Next reminder is on Tue, Aug 18';
