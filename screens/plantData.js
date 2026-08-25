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

export const CHIPS = [
  { label: 'Easy', intent: 'positive', glyph: '🌿' },
  { label: 'Toxic', intent: 'negative', glyph: '🐾' },
];

export const HERO = require('../assets/plant/hero.png');

export const PHOTOS = [
  require('../assets/plant/gallery1.png'),
  require('../assets/plant/gallery2.png'),
  require('../assets/plant/hero.png'),
];

export const CARE_FACTS = [
  { icon: '💧', label: 'Water', value: 'Every 7–10 days' },
  { icon: '☀️', label: 'Sun', value: 'Bright, indirect' },
  { icon: '🌡️', label: 'Temperature', value: '18–27℃ / 64–81℉' },
  { icon: '☁️', label: 'Humidity', value: 'Average home is fine' },
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

// Today's tasks for the owned plant. `tint`/`ink` come straight from the Figma
// task-row icon tiles (water = blue, fertilize = amber). `due` fills the badge.
export const TODAYS_TASKS = [
  {
    id: 'water',
    icon: '💧',
    title: 'Watering',
    subtitle: 'Every 6 days',
    due: 'Today',
    tint: '#CFE5FF',
  },
  {
    id: 'fertilize',
    icon: '⚡',
    title: 'Fertilizing',
    subtitle: 'Every 4 weeks',
    due: '3d ago',
    tint: '#FFDECB',
  },
];

// Shown in the "All caught up" banner once every task is done.
export const NEXT_REMINDER = 'Next reminder is on Tue, Aug 18';
