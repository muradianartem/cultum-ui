import {
  DEFAULT_ROOMS,
  FERTILIZE_FREQUENCY,
  customReminderRow,
  defaultReminders,
  makePlantRecord,
  makeRoom,
  nameSuggestions,
  reminderSubtitle,
  remindersCta,
  resetRoomIds,
  successSubtitle,
  successTitle,
  wateringDays,
  weekdayDate,
} from '../addPlantData';

const careFacts = (waterValue) => [
  { icon: 'outlined-water', label: 'Water', value: waterValue },
  { icon: 'sun', label: 'Sun', value: 'Bright, indirect' },
];

// Thursday 10 September 2026.
const TODAY = new Date(2026, 8, 10);

beforeEach(resetRoomIds);

describe('nameSuggestions', () => {
  test('leads with the genus and the common name, then the pet names', () => {
    expect(
      nameSuggestions({ commonName: 'Swiss cheese plant', latinName: 'Monstera deliciosa' })
    ).toEqual(['Monstera', 'Swiss cheese plant', 'Ziggy', 'Mo', 'Bruce']);
  });

  test('drops duplicates case-insensitively and skips missing names', () => {
    expect(nameSuggestions({ commonName: 'Monstera', latinName: 'monstera deliciosa' })).toEqual([
      'monstera',
      'Ziggy',
      'Mo',
      'Bruce',
    ]);
    expect(nameSuggestions({})).toEqual(['Ziggy', 'Mo', 'Bruce']);
  });
});

describe('wateringDays', () => {
  test('reads the low end of a range and a plain interval', () => {
    expect(wateringDays(careFacts('Every 7–10 days'))).toBe(7); // en dash, as mapPlant emits
    expect(wateringDays(careFacts('Every 5 days'))).toBe(5);
  });

  test('is null when there is no number to read', () => {
    expect(wateringDays(careFacts('When the top inch is dry'))).toBeNull();
    expect(wateringDays(careFacts(null))).toBeNull();
    expect(wateringDays(undefined)).toBeNull();
  });
});

describe('defaultReminders', () => {
  test('seeds watering from the plant and fertilizing from the default, both off', () => {
    const [water, feed] = defaultReminders({ careFacts: careFacts('Every 7–10 days') });
    expect(water).toMatchObject({ title: 'Watering', enabled: false, frequency: 'Every 7 days', everyDays: 7 });
    expect(feed).toMatchObject({ title: 'Fertilizing', enabled: false, frequency: FERTILIZE_FREQUENCY });
  });

  test('watering carries no schedule when the species has no interval', () => {
    const [water] = defaultReminders({ careFacts: careFacts('Keep evenly moist') });
    expect(water.frequency).toBeNull();
    expect(water.everyDays).toBeNull();
  });
});

describe('reminderSubtitle', () => {
  test('says a reminder is off until it is enabled, then shows its schedule', () => {
    expect(reminderSubtitle({ enabled: false, frequency: 'Every 7 days' })).toBe(
      'Reminder is turned off'
    );
    expect(reminderSubtitle({ enabled: true, frequency: 'Every 7 days' })).toBe('Every 7 days');
    expect(reminderSubtitle({ enabled: true, frequency: null })).toBe('Reminder is on');
  });
});

describe('remindersCta', () => {
  test('offers a de-emphasised skip until something is enabled', () => {
    expect(remindersCta([{ enabled: false }, { enabled: false }])).toEqual({
      label: 'Skip for now',
      variant: 'secondary',
    });
    expect(remindersCta([{ enabled: false }, { enabled: true }])).toEqual({
      label: 'Continue',
      variant: 'primary',
    });
  });
});

describe('rooms', () => {
  test('ships the five Figma rooms', () => {
    expect(DEFAULT_ROOMS.map((r) => r.name)).toEqual([
      'Living Room',
      'Kitchen',
      'Bedroom',
      'Bathroom',
      'Office',
    ]);
  });

  test('makeRoom trims the name, takes the generic glyph and counts ids', () => {
    expect(makeRoom('  Hallway ')).toEqual({ id: 'room-1', name: 'Hallway', icon: 'home' });
    expect(makeRoom('Balcony').id).toBe('room-2');
    resetRoomIds();
    expect(makeRoom('Porch').id).toBe('room-1');
  });
});

describe('success copy', () => {
  test('names the plant and lowercases the room', () => {
    expect(successTitle(' Mo ', 'Kitchen')).toBe('Mo added to your plants in the kitchen room');
  });

  test('counts from the soonest enabled reminder', () => {
    const subtitle = successSubtitle(
      [
        { enabled: true, everyDays: 30 },
        { enabled: true, everyDays: 7 },
        { enabled: false, everyDays: 1 },
      ],
      TODAY
    );
    expect(subtitle).toBe('Next treatment is on Thu 17, Sep');
  });

  test('says so when nothing is enabled', () => {
    expect(successSubtitle([{ enabled: false }], TODAY)).toBe(
      'There is no reminder set for now'
    );
  });

  test('falls back when the only enabled reminders have no day count', () => {
    expect(successSubtitle([{ enabled: true, everyDays: null }], TODAY)).toBe(
      'Your reminders are set'
    );
  });

  test('weekdayDate formats as the design does', () => {
    expect(weekdayDate(new Date(2026, 7, 16))).toBe('Sun 16, Aug');
  });
});

describe('records', () => {
  test('customReminderRow reads an AddReminderSheet record as an enabled row', () => {
    expect(
      customReminderRow({ id: 'custom-1', title: 'Rotate the pot', frequency: '2 weeks' })
    ).toMatchObject({ id: 'custom-1', title: 'Rotate the pot', enabled: true, frequency: 'Every 2 weeks', everyDays: null });
  });

  test('makePlantRecord keeps only the enabled reminders', () => {
    const record = makePlantRecord({
      vm: { speciesKey: 'monstera-deliciosa' },
      nickname: ' Mo ',
      room: { id: 'kitchen', name: 'Kitchen' },
      reminders: [
        { id: 'watering', enabled: true },
        { id: 'fertilizing', enabled: false },
      ],
    });
    expect(record).toEqual({
      speciesKey: 'monstera-deliciosa',
      nickname: 'Mo',
      room: 'Kitchen',
      reminders: [{ id: 'watering', enabled: true }],
    });
  });
});
