import { cleanupTrees, renderWithGarden, seedGarden } from '../../../store/testing';
import RoomsScreen from '../RoomsScreen';
import RoomScreen from '../RoomScreen';

const NOW = new Date(2026, 8, 5, 15, 0, 0);

// Two rooms with plants and one (Bathroom, from the default catalog) without —
// a room exists for this screen only once something lives in it.
const garden = () =>
  seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Penny',
        speciesKey: 'pilea-peperomioides',
        care: { scientific_name: 'Pilea peperomioides' },
        room: 'Living Room',
        reminders: [{ action: 'water', intervalDays: 7, dueInDays: 0 }],
      },
      {
        nickname: 'Figgy',
        speciesKey: 'ficus-lyrata',
        care: { scientific_name: 'Ficus lyrata' },
        room: 'Living Room',
        reminders: [{ action: 'water', intervalDays: 7, dueInDays: -1 }],
      },
      {
        nickname: 'Kitchen Monstera',
        speciesKey: 'monstera-deliciosa',
        care: { scientific_name: 'Monstera deliciosa' },
        room: 'Kitchen',
        reminders: [{ action: 'water', intervalDays: 7, dueInDays: 5 }],
      },
    ],
  });

const render = (node, { state = garden(), initial = 'rooms' } = {}) =>
  renderWithGarden(node, { state, initial, clock: NOW });

afterEach(cleanupTrees);

describe('RoomsScreen', () => {
  test('lists only rooms that hold plants, with their meta lines', () => {
    const t = render(<RoomsScreen />).texts();
    expect(t).toContain('Rooms');
    expect(t).toContain('Living Room');
    expect(t).toContain('Kitchen');
    expect(t).toContain('2 plants · 2 to check'); // both Living Room plants are due
    expect(t).toContain('1 plant'); // Kitchen has nothing due
    expect(t).not.toContain('Bathroom'); // in the catalog, but empty
  });

  test('an empty garden points at the way in rather than an empty list', () => {
    const t = render(<RoomsScreen />, { state: seedGarden({ now: NOW }) }).texts();
    expect(t).toContain('No rooms yet');
    expect(t).toContain('Add a plant');
  });

  test('a plant-only query shows the plant cards and no rooms or headers', () => {
    const r = render(<RoomsScreen />);
    r.type('pilea');
    const t = r.texts();
    expect(t).toContain('Penny');
    expect(t).toContain('Pilea peperomioides');
    expect(t).not.toContain('Living Room');
    // "Rooms" is still the nav title, but no "Plants" section header appears
    // when only one kind matched.
    expect(t).not.toContain('Plants');
  });

  test('a query hitting both kinds renders both sections, with headers', () => {
    const r = render(<RoomsScreen />);
    r.type('kitchen');
    const t = r.texts();
    expect(t).toContain('Plants'); // section header
    expect(t).toContain('Kitchen'); // the room card
    expect(t).toContain('Kitchen Monstera'); // the plant card
    expect(t).not.toContain('Living Room');
  });

  test('search reaches the species as well as the nickname', () => {
    const r = render(<RoomsScreen />);
    r.type('ficus');
    expect(r.texts()).toContain('Figgy');
  });

  test('a miss shows the empty state', () => {
    const r = render(<RoomsScreen />);
    r.type('zzzz');
    expect(r.texts()).toContain('No results found');
    expect(r.texts()).not.toContain('Living Room');
  });

  test('clearing the query goes back to the full list', () => {
    const r = render(<RoomsScreen />);
    r.type('zzzz');
    r.type('');
    expect(r.texts()).toContain('Living Room');
  });

  test('tapping a room navigates to it by id, not by value', () => {
    const state = garden();
    const r = render(<RoomsScreen />, { state });
    r.press('Living Room, 2 plants · 2 to check');
    expect(r.router.route).toBe('room');
    expect(r.router.params.roomId).toBe('living-room');
  });

  test('tapping a plant opens that plant', () => {
    const state = garden();
    const r = render(<RoomsScreen />, { state });
    r.type('pilea');
    r.press('Penny, Pilea peperomioides');
    expect(r.router.route).toBe('product');
    expect(r.router.params.plantId).toBe(state.plants[0].id);
  });
});

describe('RoomScreen', () => {
  test('renders the room name, plant count and its plants', () => {
    const t = render(<RoomScreen roomId="living-room" />, { initial: 'room' }).texts();
    expect(t).toContain('Living Room');
    expect(t).toContain('2 plants');
    expect(t).toContain('Penny');
    expect(t).toContain('Figgy');
  });

  test('an empty room falls back to the empty state', () => {
    const t = render(<RoomScreen roomId="bathroom" />, { initial: 'room' }).texts();
    expect(t).toContain('No plants here yet');
  });

  // The mock version kept the new name in local state, so navigating back
  // discarded it. It goes to the store now, which is the point.
  test('the pen opens the rename sheet, and the new name persists in the store', () => {
    const r = render(<RoomScreen roomId="living-room" />, { initial: 'room' });
    r.press('Rename room');
    expect(r.texts()).toContain('Rename room');

    r.type('Lounge');
    r.press('Save');
    expect(r.texts()).toContain('Lounge');
    expect(r.texts()).not.toContain('Living Room');
  });
});
