import TestRenderer, { act } from 'react-test-renderer';
import { WheelPicker } from '../../../components';
import ReminderTimeSheet from '../ReminderTimeSheet';

const wheels = (tree) => tree.root.findAllByType(WheelPicker);

function create(props) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <ReminderTimeSheet visible onClose={() => {}} value="09:00" {...props} />,
    );
  });
  return tree;
}

test('opens on the stored time, at mount', () => {
  // Regression: the indices used to be seeded in an effect, which runs after
  // BottomSheet's children have already mounted — and WheelPicker positions
  // itself from `contentOffset` at mount, so every wheel sat on its first row
  // and a stored 09:00 read as 1:00 AM.
  const [hours, minutes, periods] = wheels(create());
  expect(hours.props.index).toBe(8); // HOURS[8] === '9'
  expect(minutes.props.index).toBe(0);
  expect(periods.props.index).toBe(0); // AM
});

test('an afternoon time lands on PM', () => {
  const [hours, minutes, periods] = wheels(create({ value: '19:45' }));
  expect(hours.props.index).toBe(6); // HOURS[6] === '7'
  expect(minutes.props.index).toBe(45);
  expect(periods.props.index).toBe(1);
});

test('midnight and noon are 12, not 0', () => {
  expect(wheels(create({ value: '00:00' }))[0].props.index).toBe(11);
  expect(wheels(create({ value: '00:00' }))[2].props.index).toBe(0);
  expect(wheels(create({ value: '12:00' }))[0].props.index).toBe(11);
  expect(wheels(create({ value: '12:00' }))[2].props.index).toBe(1);
});

test('confirms the wheels as a 24-hour time, and only on Save', () => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const tree = create({ onConfirm, onClose });

  const [hours, minutes, periods] = wheels(tree);
  act(() => hours.props.onChange(6)); // 7
  act(() => minutes.props.onChange(30));
  act(() => periods.props.onChange(1)); // PM

  // Scrolling alone commits nothing — the confirm is what re-times every
  // reminder the user owns, so it must not fire per wheel tick.
  expect(onConfirm).not.toHaveBeenCalled();

  const save = tree.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Save',
  );
  act(() => save.props.onPress());

  expect(onConfirm).toHaveBeenCalledWith('19:30');
  expect(onClose).toHaveBeenCalled();
});
