import { careActions } from '../../../api/mapPlant';
import { DEFAULT_ROOMS } from '../../../store/model';
import {
  customReminderRow,
  defaultReminders,
  nameSuggestions,
  reminderSubtitle,
  remindersCta,
  successSubtitle,
  successTitle,
} from '../addPlantData';

// Thursday 10 September 2026.
const TODAY = new Date(2026, 8, 10);

// The pieces of a PlantVM this flow reads: the catalog's own care cadences.
const vm = (detail) => ({ careActions: careActions(detail) });

describe('nameSuggestions', () => {
  test('leads with the genus and the common name, then the pet names', () => {
    expect(
      nameSuggestions({ commonName: 'Swiss cheese plant', latinName: 'Monstera deliciosa' }),
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

describe('defaultReminders', () => {
  test('offers the three primary actions, all off, seeded from the species', () => {
    const rows = defaultReminders(
      vm({
        water_interval_days_min: 7,
        water_interval_days_max: 10,
        fertilize_interval_days: 28,
        repot_interval_months: 24,
      }),
    );
    expect(rows.map((r) => r.action)).toEqual(['water', 'fertilize', 'repot']);
    expect(rows.every((r) => r.enabled === false)).toBe(true);

    // The interval the reminder will actually use, and the label the catalog
    // states — a range reads better than the flattened number behind it.
    expect(rows[0]).toMatchObject({ frequency: 'Every 7–10 days', intervalDays: 7 });
    expect(rows[1]).toMatchObject({ frequency: 'Every 4 weeks', intervalDays: 28 });
    expect(rows[2]).toMatchObject({ frequency: 'Every 2 years', intervalDays: 720 });
  });

  test('a species with no cadence still gets a row, on the action default', () => {
    const [water, feed, repot] = defaultReminders(vm({}));
    expect(water).toMatchObject({ frequency: 'Every 7 days', intervalDays: 7 });
    expect(feed).toMatchObject({ frequency: 'Every month', intervalDays: 30 });
    expect(repot).toMatchObject({ frequency: 'Every 12 months', intervalDays: 360 });
  });

  test('works from nothing at all, which is what a failed detail fetch gives', () => {
    expect(defaultReminders()).toHaveLength(3);
    expect(defaultReminders({}).every((r) => r.intervalDays > 0)).toBe(true);
  });
});

describe('reminderSubtitle', () => {
  test('says a reminder is off until it is enabled, then shows its schedule', () => {
    expect(reminderSubtitle({ enabled: false, frequency: 'Every 7 days' })).toBe(
      'Reminder is turned off',
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

test('the default room catalog is the five Figma rooms', () => {
  expect(DEFAULT_ROOMS.map((r) => r.name)).toEqual([
    'Living Room',
    'Kitchen',
    'Bedroom',
    'Bathroom',
    'Office',
  ]);
});

describe('customReminderRow', () => {
  test('reads an AddReminderSheet draft as an enabled row with a real interval', () => {
    expect(customReminderRow({ title: 'Rotate the pot', frequency: '2 weeks' }, 14)).toMatchObject({
      action: 'custom',
      title: 'Rotate the pot',
      enabled: true,
      frequency: 'Every 2 weeks',
      intervalDays: 14,
    });
  });
});

describe('success copy', () => {
  test('names the plant and lowercases the room', () => {
    expect(successTitle(' Mo ', 'Kitchen')).toBe('Mo added to your plants in the kitchen room');
  });

  test('counts from the soonest enabled reminder', () => {
    const subtitle = successSubtitle(
      [
        { enabled: true, intervalDays: 30 },
        { enabled: true, intervalDays: 7 },
        { enabled: false, intervalDays: 1 },
      ],
      TODAY,
    );
    expect(subtitle).toBe('Next treatment is on Thu 17, Sep');
  });

  test('says so when nothing is enabled', () => {
    expect(successSubtitle([{ enabled: false }], TODAY)).toBe('There is no reminder set for now');
  });
});
