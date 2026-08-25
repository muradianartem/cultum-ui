// Mock plant model for the product-page flow. In a real app this comes from the
// catalog/API; kept in one place so ProductPage, ImageViewer and PremiumGallery
// stay in sync.

export const PLANT = {
  commonName: 'Swiss cheese plant',
  latinName: 'Monstera deliciosa',
  // Where the user already keeps one (drives the "You already have one" banner).
  owned: { title: 'You already have one', subtitle: 'Kitchen Monstera · Kitchen' },
  about:
    'The split leaves are a grown-up trait: young plants only start ' +
    'fenestrating with enough light and something to climb.',
};

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

// `icon` is a Cultum icon name where one exists (from the Figma Care Facts:
// Water → outlined-water, Sun → sun, Humidity → cloude). Temperature uses
// Material Symbols "thermometer" in Figma, which has no Cultum equivalent, so it
// falls back to an emoji — CareFact renders any non-icon value as text.
export const CARE_FACTS = [
  { icon: 'outlined-water', label: 'Water', value: 'Every 7–10 days' },
  { icon: 'sun', label: 'Sun', value: 'Bright, indirect' },
  { icon: '🌡️', label: 'Temperature', value: '18–27℃ / 64–81℉' },
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

// Today's tasks for the owned plant. `tint` is the icon-tile background and
// `ink` the glyph colour (water = blue, fertilize = amber). `icon` is a Cultum
// icon name where one exists; fertilizing has no Cultum equivalent, so it keeps
// an emoji fallback (TaskRow renders any non-icon value as text). `due` fills
// the badge.
export const TODAYS_TASKS = [
  {
    id: 'water',
    icon: 'outlined-water',
    title: 'Watering',
    subtitle: 'Every 6 days',
    due: 'Today',
    tint: '#CFE5FF',
    ink: '#2B6EA6',
  },
  {
    id: 'fertilize',
    icon: '⚡',
    title: 'Fertilizing',
    subtitle: 'Every 4 weeks',
    due: '3d ago',
    tint: '#FFDECB',
    ink: '#A85E08',
  },
];

// Shown in the "All caught up" banner once every task is done.
export const NEXT_REMINDER = 'Next reminder is on Tue, Aug 18';
