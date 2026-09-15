import { act } from 'react-test-renderer';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../../store/testing';
import { useGarden } from '../../../store/GardenProvider';
import RoomsScreen from '../RoomsScreen';
import RoomScreen from '../RoomScreen';

// The room limit comes off the entitlement; each test sets what the plan allows.
let mockLimits = null;
jest.mock('../../../billing/EntitlementProvider', () => ({
  useEntitlement: () => ({ limits: mockLimits }),
}));

const NOW = new Date(2026, 8, 5, 15, 0, 0);

// Two rooms with plants and one (Bathroom) without — an empty room is still a
// room, and the list shows it.
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
    rooms: ['Living Room', 'Kitchen', 'Bathroom'],
  });

// Reads the live store alongside the screen under test.
let store;
function StoreProbe() {
  store = useGarden();
  return null;
}

const render = (node, { state = garden(), initial = 'rooms' } = {}) =>
  renderWithGarden(
    <>
      {node}
      <StoreProbe />
    </>,
    { state, initial, clock: NOW },
  );

/**
 * Finish a Modal's dismissal. iOS only opens the next sheet or dialog once the
 * last one reports `onDismiss` (screens/rooms/useModalHandoff.js), and the jest
 * Modal never fires it by itself.
 */
const dismiss = (r, testID) => {
  const host = r.tree.root.findAll(
    (n) => n.props.testID === testID && typeof n.props.onDismiss === 'function',
  )[0];
  if (!host) throw new Error(`No dismissable modal “${testID}”`);
  act(() => host.props.onDismiss());
};

const roomNames = () => store.rooms.map((room) => room.name);

const sheetVisible = (r, testID) =>
  r.tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

beforeEach(() => {
  mockLimits = null;
});

afterEach(cleanupTrees);

describe('RoomsScreen', () => {
  test('lists every room, empty ones included, with their meta lines', () => {
    const t = render(<RoomsScreen />).texts();
    expect(t).toContain('Rooms');
    expect(t).toContain('Living Room');
    expect(t).toContain('Kitchen');
    expect(t).toContain('2 plants · 2 to check'); // both Living Room plants are due
    expect(t).toContain('1 plant'); // Kitchen has nothing due
    expect(t).toContain('Bathroom');
    expect(t).toContain('0 plants');
  });

  test('a garden with no rooms offers to create one', () => {
    const t = render(<RoomsScreen />, { state: seedGarden({ now: NOW }) }).texts();
    expect(t).toContain('No rooms yet');
    expect(t).toContain('Create new room');
  });

  test('Create new room adds the room to the store and the list, queued for the server', () => {
    const r = render(<RoomsScreen />);
    r.press('Create new room');
    expect(sheetVisible(r, 'new-room-sheet')).toBe(true);

    r.type('Balcony', 1); // field 0 is the search bar
    r.press('Create');

    expect(r.texts()).toContain('Balcony');
    expect(roomNames()).toEqual(['Living Room', 'Kitchen', 'Bathroom', 'Balcony']);
    expect(store.state.outbox.map((e) => e.op)).toContain('room.create');
  });

  test('at the plan’s room limit, Create new room opens the paywall instead', () => {
    mockLimits = { rooms: 3 };
    const r = render(<RoomsScreen />);
    r.press('Create new room');
    expect(r.router.route).toBe('paywall');
    expect(roomNames()).toHaveLength(3);
  });

  test('an unlimited plan never hits the gate', () => {
    mockLimits = { rooms: null };
    const r = render(<RoomsScreen />);
    r.press('Create new room');
    expect(r.router.route).toBe('rooms');
    expect(sheetVisible(r, 'new-room-sheet')).toBe(true);
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

  test('search finds an empty room by name', () => {
    const r = render(<RoomsScreen />);
    r.type('bath');
    expect(r.texts()).toContain('Bathroom');
  });

  test('search reaches the species as well as the nickname', () => {
    const r = render(<RoomsScreen />);
    r.type('ficus');
    expect(r.texts()).toContain('Figgy');
  });

  test('a miss shows the empty state, and Clear search goes back to the list', () => {
    const r = render(<RoomsScreen />);
    r.type('zzzz');
    expect(r.texts()).toContain('No results found');
    expect(r.texts()).not.toContain('Living Room');

    r.press('Clear search');
    expect(r.texts()).toContain('Living Room');
  });

  test('tapping a room navigates to it by id, not by value', () => {
    const r = render(<RoomsScreen />);
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
  // Arrive the way the app does, so Back has somewhere to go.
  const open = (roomId) => {
    const r = render(<RoomScreen roomId={roomId} />);
    act(() => r.router.navigate('room', { roomId }));
    return r;
  };

  test('renders the room name, plant count and its plants', () => {
    const t = open('living-room').texts();
    expect(t).toContain('Living Room');
    expect(t).toContain('2 plants');
    expect(t).toContain('Penny');
    expect(t).toContain('Figgy');
  });

  test('an empty room offers a scan, or a search by name', () => {
    const r = open('bathroom');
    expect(r.texts()).toContain('No plants here yet');
    expect(r.texts()).toContain('Scan a plant to add it to this room, or search by name.');

    r.press('Search by name instead');
    expect(r.router.route).toBe('scan-search');
  });

  test('Rename from the actions sheet sticks in the store and queues nothing for an unsynced room', () => {
    const r = open('living-room');
    r.press('Room actions');
    expect(r.texts()).toContain("Change this room's name");

    r.press('Rename');
    expect(r.texts()).toContain('Rename room');
    r.type('Lounge');
    r.press('Save');

    expect(r.texts()).toContain('Lounge');
    expect(roomNames()).toContain('Lounge');
    expect(roomNames()).not.toContain('Living Room');
  });

  test('deleting an empty room confirms, deletes it and goes back', () => {
    const r = open('bathroom');
    r.press('Room actions');
    r.press('Delete');
    dismiss(r, 'room-sheet');

    expect(r.texts()).toContain('Delete room?');
    expect(r.texts()).toContain(
      'The room will be removed. Your plants and their reminders are not affected. This cannot be undone.',
    );
    r.press('Delete');

    expect(roomNames()).toEqual(['Living Room', 'Kitchen']);
    expect(r.router.route).toBe('rooms');
    expect(r.texts()).toContain('Room deleted');
  });

  test('the delete dialog waits for the actions sheet to finish closing', () => {
    const r = open('bathroom');
    r.press('Room actions');
    r.press('Delete');
    expect(r.texts()).not.toContain('Delete room?');
    dismiss(r, 'room-sheet');
    expect(r.texts()).toContain('Delete room?');
  });

  test('a room with plants has to be emptied first: move them, then delete', () => {
    const r = open('living-room');
    r.press('Room actions');
    r.press('Delete');
    dismiss(r, 'room-sheet');

    expect(r.texts()).toContain(
      'Living Room still has 2 plants. Move them to another room before deleting it.',
    );
    r.press('Move to another room');
    dismiss(r, 'room-delete-dialog');

    expect(r.texts()).toContain('Move 2 plants to');
    r.press('Kitchen');
    r.press('Move and delete room');

    expect(roomNames()).toEqual(['Kitchen', 'Bathroom']);
    const kitchen = store.rooms.find((room) => room.name === 'Kitchen');
    expect(store.plants.map((p) => p.roomId)).toEqual([kitchen.id, kitchen.id, kitchen.id]);
    expect(r.router.route).toBe('rooms');
    expect(r.texts()).toContain('Room deleted');
  });

  test('or into a new room made on the spot', () => {
    const r = open('living-room');
    r.press('Room actions');
    r.press('Delete');
    dismiss(r, 'room-sheet');
    r.press('Move to another room');
    dismiss(r, 'room-delete-dialog');

    r.press('Create new room');
    r.press('Continue');
    expect(r.texts()).toContain('Every plant from Living Room moves here.');
    r.type('Balcony');
    r.press('Create and move');

    expect(roomNames()).toEqual(['Kitchen', 'Bathroom', 'Balcony']);
    const balcony = store.rooms.find((room) => room.name === 'Balcony');
    expect(store.plantsInRoom(balcony.id).map((p) => p.nickname)).toEqual(['Penny', 'Figgy']);
    expect(r.router.route).toBe('rooms');
  });

  test('at the room limit, making a new room for the plants opens the paywall', () => {
    mockLimits = { rooms: 3 };
    const r = open('living-room');
    r.press('Room actions');
    r.press('Delete');
    dismiss(r, 'room-sheet');
    r.press('Move to another room');
    dismiss(r, 'room-delete-dialog');

    r.press('Create new room');
    r.press('Continue');

    expect(r.router.route).toBe('paywall');
    expect(roomNames()).toHaveLength(3);
  });
});
