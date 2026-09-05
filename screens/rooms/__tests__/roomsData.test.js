import { ROOMS, renameRoom, roomMeta, roomSubtitle, searchRooms } from '../roomsData';

const room = (name, plants) => ({ id: name.toLowerCase(), name, photos: [], plants });
const p = (title, subtitle, needsCheck = false) => ({
  id: title,
  title,
  subtitle,
  needsCheck,
});

describe('roomMeta / roomSubtitle', () => {
  test('counts plants and the ones that need checking', () => {
    expect(roomMeta(room('Living Room', [p('a', 'x', true), p('b', 'y', true), p('c', 'z')])))
      .toBe('3 plants · 2 to check');
  });

  test('drops the second clause when nothing is due', () => {
    expect(roomMeta(room('Kitchen', [p('a', 'x'), p('b', 'y')]))).toBe('2 plants');
  });

  test('singularises, and handles an empty room', () => {
    expect(roomMeta(room('Attic', [p('a', 'x')]))).toBe('1 plant');
    expect(roomMeta(room('Attic', []))).toBe('0 plants');
    expect(roomSubtitle(room('Attic', [p('a', 'x')]))).toBe('1 plant');
  });

  test('the seeded rooms read as the Figma frames do', () => {
    expect(ROOMS.map(roomMeta)).toEqual([
      '3 plants · 2 to check',
      '2 plants · 1 to check',
      '2 plants · 1 to check',
    ]);
  });
});

describe('searchRooms', () => {
  test('a blank query matches nothing (callers treat it as idle)', () => {
    expect(searchRooms(ROOMS, '')).toEqual({ rooms: [], plants: [] });
    expect(searchRooms(ROOMS, '   ')).toEqual({ rooms: [], plants: [] });
  });

  test('matches a room name, case- and whitespace-insensitively', () => {
    const { rooms, plants } = searchRooms(ROOMS, '  BEDroom ');
    expect(rooms.map((r) => r.name)).toEqual(['Bedroom']);
    expect(plants).toEqual([]);
  });

  test('matches a plant nickname', () => {
    const { rooms, plants } = searchRooms(ROOMS, 'penny');
    expect(rooms).toEqual([]);
    expect(plants.map((x) => x.title)).toEqual(['Penny']);
  });

  test('matches a species name across every room', () => {
    const { rooms, plants } = searchRooms(ROOMS, 'monstera');
    expect(rooms).toEqual([]);
    expect(plants.map((x) => x.title)).toEqual(['Kitchen Monstera', 'Mo']);
  });

  test('returns both kinds when the query hits a room and a plant', () => {
    const { rooms, plants } = searchRooms(ROOMS, 'kitchen');
    expect(rooms.map((r) => r.name)).toEqual(['Kitchen']);
    expect(plants.map((x) => x.title)).toEqual(['Kitchen Monstera']);
  });

  test('a miss is empty on both sides', () => {
    expect(searchRooms(ROOMS, 'zzzz')).toEqual({ rooms: [], plants: [] });
  });
});

describe('renameRoom', () => {
  test('replaces one name and leaves the input untouched', () => {
    const rooms = [room('Kitchen', []), room('Bedroom', [])];
    const next = renameRoom(rooms, 'kitchen', '  Galley  ');
    expect(next.map((r) => r.name)).toEqual(['Galley', 'Bedroom']);
    expect(rooms.map((r) => r.name)).toEqual(['Kitchen', 'Bedroom']);
    expect(next[1]).toBe(rooms[1]);
  });
});
