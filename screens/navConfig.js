// App-wide navigation and grouping configuration.
//
// Config, not data: these are the fixed choices the design makes (which tabs
// exist, how the Today list can be grouped), so they stay hard-coded while
// everything that describes a user's plants comes from the store.

export const TABS = [
  { value: 'today', label: 'Today', icon: 'home-check' },
  { value: 'discover', label: 'Discover', icon: 'globe' },
  { value: 'scan', label: 'Scan/Add', icon: 'outlined-scan' },
  { value: 'rooms', label: 'Rooms', icon: 'outlined-sections' },
  { value: 'settings', label: 'Settings', icon: 'settings' },
];

export const GROUPINGS = [
  { value: 'task', label: 'By Task', title: 'Task', subtitle: 'Grouped by tasks' },
  { value: 'room', label: 'By Room', title: 'Room', subtitle: 'Grouped by rooms' },
  { value: 'none', label: 'None', title: 'None', subtitle: 'One list with no grouping' },
];

export const EMPTY = {
  title: 'All caught up',
  subtitle: 'Your plants are on their own schedule.',
};

export const NO_PLANTS = {
  title: 'No plants yet',
  subtitle: 'Scan or search for a plant and it will start reminding you.',
};

/** "Good morning" / "Good afternoon" / "Good evening", by the device's clock. */
export function salutation(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
