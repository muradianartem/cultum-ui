// Mock data for the Today home screen (V1). No backend yet — the screen renders
// these fixtures and completes tasks in local state. Real data is a follow-up
// behind the same shapes. Photos reuse existing plant art (no new assets).

export const GREETING = { salutation: 'Good afternoon', name: 'Allison Allison' };

// Segmented control: Today (with a live count) | Upcoming.
export const SEGMENTS = [
  { label: 'Today', value: 'today', count: 5 },
  { label: 'Upcoming', value: 'upcoming' },
];

// Reuse existing plant art for row thumbnails — no new assets are added.
const MONSTERA = require('../assets/plant/hero.png');
const GALLERY_1 = require('../assets/plant/gallery1.png');
const GALLERY_2 = require('../assets/plant/gallery2.png');

// Today's tasks, grouped by task type. Each task: { id, title, plant, room,
// due, photo }. Seeded to match the Figma "Today / Idle" frame.
export const TODAY_GROUPS = [
  {
    key: 'watering',
    header: 'Watering',
    tasks: [
      { id: 'w1', title: 'Soil Check', plant: 'Monstera', room: 'Kitchen', due: 'Today', photo: MONSTERA },
    ],
  },
  {
    key: 'fertilizing',
    header: 'Fertilizing',
    tasks: [
      { id: 'f1', title: 'Feed', plant: 'Fiddle Leaf Fig', room: 'Living room', due: 'Today', photo: GALLERY_1 },
      { id: 'f2', title: 'Top-dress', plant: 'Snake Plant', room: 'Bedroom', due: '3d ago', photo: GALLERY_2 },
    ],
  },
  {
    key: 'custom',
    header: 'Custom',
    tasks: [
      { id: 'c1', title: 'Move this plant', plant: 'Pothos', room: 'Office', due: '2d ago', photo: GALLERY_1 },
    ],
  },
];

// Shown in the "All caught up" empty state: the soonest future task.
export const NEXT_UP = {
  id: 'n1',
  title: 'Mist leaves',
  plant: 'Fern',
  room: 'Bathroom',
  due: 'In 2 days',
  photo: GALLERY_2,
};

// Copy for the empty state.
export const EMPTY = {
  title: 'All caught up',
  subtitle: 'Your plants are on their own schedule.',
};

// How the Today list can be grouped. `label` is the button's trailing value
// ("Grouping: By Task"); `title`/`subtitle` are the menu rows.
export const GROUPINGS = [
  { value: 'task', label: 'By Task', title: 'Task', subtitle: 'Grouped by tasks' },
  { value: 'room', label: 'By Room', title: 'Room', subtitle: 'Grouped by rooms' },
  { value: 'none', label: 'None', title: 'None', subtitle: 'One list with no grouping' },
];

// Bottom tab bar. `icon` values are Cultum icon names (components/iconRegistry).
// Today is the active tab; the others are visual/no-op in V1 (single-screen router).
export const TABS = [
  { value: 'today', label: 'Today', icon: 'home-check' },
  { value: 'discover', label: 'Discover', icon: 'globe' },
  { value: 'scan', label: 'Scan/Add', icon: 'outlined-scan' },
  { value: 'rooms', label: 'Rooms', icon: 'outlined-sections' },
  { value: 'settings', label: 'Settings', icon: 'settings' },
];
