import TestRenderer, { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import RoomCard from '../RoomCard';
import { RoomCard as BarrelRoomCard } from '../index';

const PHOTO = { uri: 'a' };

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
const images = (tree) => tree.root.findAllByType(Image);

test('is exported from the components barrel', () => {
  expect(BarrelRoomCard).toBe(RoomCard);
});

test('renders the room name and meta line', () => {
  const tree = create(<RoomCard name="Living Room" meta="3 plants · 2 to check" />);
  expect(texts(tree)).toEqual(['Living Room', '3 plants · 2 to check']);
});

test('omits the meta line when there is none', () => {
  expect(texts(create(<RoomCard name="Attic" />))).toEqual(['Attic']);
});

test('fills all four mosaic cells from four photos', () => {
  const photos = [{ uri: 'a' }, { uri: 'b' }, { uri: 'c' }, { uri: 'd' }];
  const tree = create(<RoomCard name="x" photos={photos} />);
  expect(images(tree).map((n) => n.props.source)).toEqual(photos);
});

test('cycles a short photo list to keep the mosaic full', () => {
  const tree = create(<RoomCard name="x" photos={[PHOTO]} />);
  expect(images(tree)).toHaveLength(4);
});

test('renders no images at all when the room has no photos', () => {
  expect(images(create(<RoomCard name="x" />))).toHaveLength(0);
});

test('fires onPress and labels itself with name and meta', () => {
  const onPress = jest.fn();
  const tree = create(<RoomCard name="Kitchen" meta="2 plants" onPress={onPress} />);
  const node = tree.root
    .findAll((n) => typeof n.props.onPress === 'function')
    .at(-1);
  expect(node.props.accessibilityLabel).toBe('Kitchen, 2 plants');
  act(() => node.props.onPress());
  expect(onPress).toHaveBeenCalled();
});
