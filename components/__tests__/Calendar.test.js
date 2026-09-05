import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Calendar, {
  addMonths,
  isSameDay,
  monthLabel,
  monthMatrix,
  startOfDay,
  startOfMonth,
} from '../Calendar';
import { Calendar as BarrelCalendar } from '../index';
import { calendar } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// Day cells are the buttons labelled "<d> <Month> <Year>".
const day = (tree, label) =>
  tree.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label
  );

const press = (tree, label) => act(() => day(tree, label).props.onPress());

const dayStyle = (tree, label) =>
  Object.assign(
    {},
    ...[]
      .concat(day(tree, label).props.style({ pressed: false }))
      .filter(Boolean)
      .flat()
      .filter(Boolean)
  );

test('is exported from the components barrel', () => {
  expect(BarrelCalendar).toBe(Calendar);
});

describe('grid helpers', () => {
  test('monthMatrix is always 6 rows of 7', () => {
    for (const d of [new Date(2026, 1, 1), new Date(2026, 8, 1), new Date(2024, 1, 1)]) {
      const weeks = monthMatrix(d);
      expect(weeks).toHaveLength(6);
      weeks.forEach((w) => expect(w).toHaveLength(7));
    }
  });

  test('the 1st lands in its Sunday-first column and leading cells are empty', () => {
    // 1 Sep 2026 is a Tuesday → index 2 of the first row.
    const weeks = monthMatrix(new Date(2026, 8, 15));
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toBeNull();
    expect(weeks[0][2].getDate()).toBe(1);
  });

  test('every day of the month appears exactly once, and nothing else', () => {
    const days = monthMatrix(new Date(2026, 8, 1))
      .flat()
      .filter(Boolean);
    expect(days).toHaveLength(30); // September
    expect(days.map((d) => d.getDate())).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1)
    );
    days.forEach((d) => expect(d.getMonth()).toBe(8));
  });

  test('handles a leap February', () => {
    const days = monthMatrix(new Date(2024, 1, 1)).flat().filter(Boolean);
    expect(days).toHaveLength(29);
  });

  test('addMonths rolls the year over and normalises to the 1st', () => {
    expect(monthLabel(addMonths(new Date(2026, 11, 31), 1))).toBe('January 2027');
    expect(monthLabel(addMonths(new Date(2026, 0, 15), -1))).toBe('December 2025');
    expect(addMonths(new Date(2026, 8, 30), 1).getDate()).toBe(1);
  });

  test('startOfDay/startOfMonth strip time and day', () => {
    const d = new Date(2026, 8, 10, 13, 45, 30);
    expect(startOfDay(d).getHours()).toBe(0);
    expect(startOfMonth(d).getDate()).toBe(1);
  });

  test('isSameDay ignores time and rejects nullish', () => {
    expect(isSameDay(new Date(2026, 8, 10, 9), new Date(2026, 8, 10, 22))).toBe(true);
    expect(isSameDay(new Date(2026, 8, 10), new Date(2026, 9, 10))).toBe(false);
    expect(isSameDay(null, new Date(2026, 8, 10))).toBe(false);
  });
});

describe('rendering', () => {
  const SEP = new Date(2026, 8, 10);

  test('shows the visible month and the weekday row', () => {
    const t = texts(create(<Calendar month={SEP} today={SEP} />));
    expect(t).toContain('September 2026');
    expect(t.slice(0, 10)).toEqual(
      expect.arrayContaining(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
    );
  });

  test('the selected day takes the brand fill; today takes the grey one', () => {
    const tree = create(<Calendar value={SEP} today={new Date(2026, 8, 3)} month={SEP} />);
    expect(dayStyle(tree, '10 September 2026').backgroundColor).toBe(
      calendar.daySelectedBg
    );
    expect(dayStyle(tree, '3 September 2026').backgroundColor).toBe(
      calendar.dayTodayBg
    );
    expect(day(tree, '10 September 2026').props.accessibilityState.selected).toBe(true);
  });

  test('pressing a day reports it at midnight', () => {
    const onChange = jest.fn();
    const tree = create(<Calendar month={SEP} today={SEP} onChange={onChange} />);
    press(tree, '21 September 2026');
    const picked = onChange.mock.calls[0][0];
    expect(picked.getDate()).toBe(21);
    expect(picked.getMonth()).toBe(8);
    expect(picked.getHours()).toBe(0);
  });

  test('uncontrolled month steps with the arrows', () => {
    const tree = create(<Calendar value={SEP} today={SEP} />);
    expect(texts(tree)).toContain('September 2026');

    act(() =>
      tree.root
        .find(
          (n) =>
            typeof n.props.onPress === 'function' &&
            n.props.accessibilityLabel === 'Next month'
        )
        .props.onPress()
    );
    expect(texts(tree)).toContain('October 2026');
  });

  test('a controlled month reports arrow presses instead of moving itself', () => {
    const onMonthChange = jest.fn();
    const tree = create(
      <Calendar month={SEP} today={SEP} onMonthChange={onMonthChange} />
    );
    act(() =>
      tree.root
        .find(
          (n) =>
            typeof n.props.onPress === 'function' &&
            n.props.accessibilityLabel === 'Previous month'
        )
        .props.onPress()
    );
    expect(monthLabel(onMonthChange.mock.calls[0][0])).toBe('August 2026');
    expect(texts(tree)).toContain('September 2026'); // parent owns it; unchanged
  });

  test('suggestions render as chips and select their date', () => {
    const onChange = jest.fn();
    const tree = create(
      <Calendar
        month={SEP}
        today={SEP}
        onChange={onChange}
        suggestions={[{ label: 'Today', date: SEP }]}
      />
    );
    expect(texts(tree)).toContain('Today');

    const chip = tree.root.find(
      (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Today'
    );
    act(() => chip.props.onPress());
    expect(onChange.mock.calls[0][0].getDate()).toBe(10);
  });

  test('picking a suggestion in another month pulls the grid to it', () => {
    const tree = create(
      <Calendar
        value={SEP}
        today={SEP}
        suggestions={[{ label: 'Two weeks ago', date: new Date(2026, 7, 27) }]}
      />
    );
    expect(texts(tree)).toContain('September 2026');

    const chip = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === 'Two weeks ago'
    );
    act(() => chip.props.onPress());
    expect(texts(tree)).toContain('August 2026');
  });

  test('an uncontrolled month follows a value re-seeded into another month', () => {
    // What ReminderValueSheet does: the sheet mounts on today, then seeds the
    // stored date once it opens. The grid has to move with it.
    const tree = create(<Calendar value={SEP} today={SEP} />);
    expect(texts(tree)).toContain('September 2026');

    act(() => {
      tree.update(<Calendar value={new Date(2026, 7, 21)} today={SEP} />);
    });
    expect(texts(tree)).toContain('August 2026');
    expect(day(tree, '21 August 2026').props.accessibilityState.selected).toBe(true);
  });

  test('a re-seed within the visible month leaves the grid alone', () => {
    const tree = create(<Calendar value={SEP} today={SEP} />);
    act(() => {
      tree.update(<Calendar value={new Date(2026, 8, 28)} today={SEP} />);
    });
    expect(texts(tree)).toContain('September 2026');
  });

  test('a controlled month is not moved by a value re-seed', () => {
    const tree = create(<Calendar value={SEP} month={SEP} today={SEP} />);
    act(() => {
      tree.update(<Calendar value={new Date(2026, 7, 21)} month={SEP} today={SEP} />);
    });
    expect(texts(tree)).toContain('September 2026'); // parent still owns it
  });

  test('no suggestions prop hides the strip entirely', () => {
    const tree = create(<Calendar month={SEP} today={SEP} />);
    expect(texts(tree)).not.toContain('Today');
  });
});
