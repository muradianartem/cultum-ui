import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AddReminderSheet from '../AddReminderSheet';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Fixed "today" so the calendar, its suggestions and every date label are
// deterministic: Thursday 10 September 2026.
const TODAY = new Date(2026, 8, 10);

function create(props = {}) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AddReminderSheet visible today={TODAY} {...props} />
      </SafeAreaProvider>
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// Press the deepest node carrying this label — the host Pressable, not the
// component element that also holds the prop.
const press = (tree, label) => {
  const nodes = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label
  );
  act(() => nodes[nodes.length - 1].props.onPress());
};

const type = (tree, value) =>
  act(() => tree.root.findByType(RNTextInput).props.onChangeText(value));

// Walk to the frequency step with a named reminder.
const toFrequency = (tree, label = 'Rotate the pot') => {
  type(tree, label);
  press(tree, 'Continue');
};

describe('step 1 — label', () => {
  test('opens on the label step', () => {
    const tree = create();
    const t = texts(tree);
    expect(t).toContain('Add new reminder');
    expect(t).toContain('Label'); // field label
    expect(t).toContain('This will help you to distinguish reminders from each other.');
    // The placeholder is a prop on the input, not rendered text.
    expect(tree.root.findByType(RNTextInput).props.placeholder).toBe('What to remind?');
    expect(t).toContain('Continue');
  });

  test('Continue is disabled until the label has content', () => {
    const tree = create();
    const button = () =>
      tree.root
        .findAll(
          (n) =>
            typeof n.props.onPress === 'function' &&
            n.props.accessibilityLabel === 'Continue'
        )
        .at(-1);

    expect(button().props.accessibilityState.disabled).toBe(true);
    type(tree, '   '); // whitespace alone doesn't count
    expect(button().props.accessibilityState.disabled).toBe(true);
    type(tree, 'Rotate the pot');
    expect(button().props.accessibilityState.disabled).toBe(false);
  });

  test('has no back affordance — it is the first step', () => {
    const tree = create();
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === 'Back')
    ).toHaveLength(0);
  });
});

describe('step 2 — frequency', () => {
  test('Continue advances and shows the repeat wheel defaulted to 2 days', () => {
    const tree = create();
    toFrequency(tree);
    const t = texts(tree);
    expect(t).toContain('When to repeat');
    expect(t).toContain('Remind every 2 days');
    expect(t).toContain('Start date');
    expect(t).toContain('10 Sep'); // the row's current value
  });

  test('the CTA tracks the wheel, singular at 1', () => {
    const tree = create();
    toFrequency(tree);
    const { WheelPicker } = require('../../components');
    const [numbers, units] = tree.root.findAllByType(WheelPicker);

    act(() => units.props.onChange(2)); // weeks
    expect(texts(tree)).toContain('Remind every 2 weeks');

    act(() => numbers.props.onChange(0)); // 1
    expect(texts(tree)).toContain('Remind every week');
  });

  test('Back returns to the label step, keeping what was typed', () => {
    const tree = create();
    toFrequency(tree, 'Rotate the pot');
    press(tree, 'Back');
    expect(texts(tree)).toContain('Add new reminder');
    expect(tree.root.findByType(RNTextInput).props.value).toBe('Rotate the pot');
  });

  test('the CTA confirms a reminder and closes', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const tree = create({ onConfirm, onClose });
    toFrequency(tree, 'Rotate the pot');
    press(tree, 'Remind every 2 days');

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      kind: 'custom',
      title: 'Rotate the pot',
      enabled: true,
      removable: true,
      dateLabel: 'Start date',
      dateValue: '10 Sep',
      frequency: '2 days',
      snooze: 'None',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('step 3 — start date', () => {
  const toDate = (tree) => {
    toFrequency(tree);
    press(tree, 'Start date');
  };

  test('the Start date row opens the calendar step', () => {
    const tree = create();
    toDate(tree);
    const t = texts(tree);
    expect(t).toContain('Start date');
    expect(t).toContain('The reminder starts on this day and repeats from there.');
    expect(t).toContain('September 2026');
    expect(t).toContain('Set 10 Sep');
    // The suggestion chips ride along with the calendar.
    expect(t).toContain('Yesterday');
    expect(t).toContain('Two weeks ago');
  });

  test('picking a day updates the CTA, and confirming returns to frequency', () => {
    const tree = create();
    toDate(tree);
    press(tree, '21 September 2026');
    expect(texts(tree)).toContain('Set 21 Sep');

    press(tree, 'Set 21 Sep');
    expect(texts(tree)).toContain('When to repeat'); // back on step 2
    expect(texts(tree)).toContain('21 Sep'); // row reflects the new date
  });

  test('the chosen date reaches the confirmed reminder', () => {
    const onConfirm = jest.fn();
    const tree = create({ onConfirm });
    toDate(tree);
    press(tree, '21 September 2026');
    press(tree, 'Set 21 Sep');
    press(tree, 'Remind every 2 days');
    expect(onConfirm.mock.calls[0][0].dateValue).toBe('21 Sep');
  });

  test('Back leaves the date unchanged', () => {
    const tree = create();
    toDate(tree);
    press(tree, 'Back');
    expect(texts(tree)).toContain('When to repeat');
    expect(texts(tree)).toContain('10 Sep');
  });
});

describe('dismissal', () => {
  test('Close fires onClose from any step', () => {
    const onClose = jest.fn();
    const tree = create({ onClose });
    toFrequency(tree);
    press(tree, 'Close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('hiding the sheet resets the draft for the next open', () => {
    const onClose = jest.fn();
    const tree = create({ onClose });
    toFrequency(tree, 'Rotate the pot');

    act(() => {
      tree.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <AddReminderSheet visible={false} today={TODAY} onClose={onClose} />
        </SafeAreaProvider>
      );
    });
    act(() => {
      tree.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <AddReminderSheet visible today={TODAY} onClose={onClose} />
        </SafeAreaProvider>
      );
    });

    // Back to step 1 with an empty field.
    expect(texts(tree)).toContain('Add new reminder');
    expect(tree.root.findByType(RNTextInput).props.value).toBe('');
  });
});
