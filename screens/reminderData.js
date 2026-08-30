// Mock data for the Edit Reminders screen (V1). No backend yet — the screen
// renders these fixtures and edits them in local state (useState), resetting on
// unmount. Real data is a follow-up behind the same shapes. Seeded to match the
// Figma "Reminders" frame (node 1:7889).

export const PLANT_NAME = 'Fern Gully'; // nav subtitle; overridable via route param

// kind → { icon (registry name), tone }. `tone` selects the coloured chip fill:
// 'information' (blue watering), 'warning' (orange fertilizing), 'neutral' (grey).
export const KIND_META = {
  watering: { icon: 'outlined-water', tone: 'information' },
  fertilizing: { icon: 'power', tone: 'warning' },
  custom: { icon: 'notifications', tone: 'neutral' },
};

// Each reminder:
//   id         string
//   kind       'watering' | 'fertilizing' | 'custom'  (chooses icon + tone)
//   title      string
//   nextLabel  string | null   → "Next reminder: 1 Sep" subtitle (null hides it)
//   enabled    boolean         → Toggle initial state
//   removable  boolean         → show the destructive Remove button
//   dateLabel  string          → detail-row label ("Last watering" | "Start date")
//   dateValue  string          → "21 Aug"
//   frequency  string          → "7 days"
//   snooze     string          → "None"
export const REMINDERS = [
  {
    id: 'watering',
    kind: 'watering',
    title: 'Watering',
    nextLabel: null,
    enabled: true,
    removable: false,
    dateLabel: 'Last watering',
    dateValue: '21 Aug',
    frequency: '7 days',
    snooze: 'None',
  },
  {
    id: 'fertilizing',
    kind: 'fertilizing',
    title: 'Fertilizing',
    nextLabel: null,
    enabled: true,
    removable: false,
    dateLabel: 'Last fertilizing',
    dateValue: '21 Aug',
    frequency: '7 days',
    snooze: 'None',
  },
  {
    id: 'custom',
    kind: 'custom',
    title: 'Check for better pods',
    nextLabel: 'Next reminder: 1 Sep',
    enabled: false,
    removable: true,
    dateLabel: 'Start date',
    dateValue: '21 Aug',
    frequency: '7 days',
    snooze: 'None',
  },
];
