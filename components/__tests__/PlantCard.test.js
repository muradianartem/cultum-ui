import TestRenderer, { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import PlantCard from '../PlantCard';
import { PlantCard as BarrelPlantCard } from '../index';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);

test('is exported from the components barrel', () => {
  expect(BarrelPlantCard).toBe(PlantCard);
});

test('renders the nickname over the species', () => {
  const tree = create(<PlantCard name="Penny" meta="Pilea peperomioides" />);
  expect(texts(tree)).toEqual(['Penny', 'Pilea peperomioides']);
});

test('renders the photo when there is one, and nothing when there is not', () => {
  const photo = { uri: 'penny.png' };
  expect(create(<PlantCard name="x" photo={photo} />).root.findAllByType(Image)[0].props.source)
    .toBe(photo);
  expect(create(<PlantCard name="x" />).root.findAllByType(Image)).toHaveLength(0);
});

test('fires onPress', () => {
  const onPress = jest.fn();
  const tree = create(<PlantCard name="Mo" meta="Monstera adansonii" onPress={onPress} />);
  const node = tree.root.findAll((n) => typeof n.props.onPress === 'function').at(-1);
  expect(node.props.accessibilityLabel).toBe('Mo, Monstera adansonii');
  act(() => node.props.onPress());
  expect(onPress).toHaveBeenCalled();
});
