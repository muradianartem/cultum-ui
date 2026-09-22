import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { isLoaded, loadAsync } from 'expo-font';
import FontGate from '../FontGate';
import { ThemeProvider } from '../ThemeProvider';
import { FONT_FACES } from '../fonts';

jest.mock('expo-font', () => ({ isLoaded: jest.fn(), loadAsync: jest.fn() }));

const mount = () =>
  create(
    <ThemeProvider initialMode="light">
      <FontGate>
        <Text>app</Text>
      </FontGate>
    </ThemeProvider>
  );

const texts = (r) => r.root.findAllByType(Text).map((n) => n.props.children);

beforeEach(() => jest.resetAllMocks());

test('loads every bundled face, then mounts the app', async () => {
  isLoaded.mockReturnValue(false);
  const load = loadAsync.mockResolvedValue();
  let r;
  await act(async () => {
    r = mount();
  });
  expect(load).toHaveBeenCalledWith(FONT_FACES);
  expect(texts(r)).toEqual(['app']);
});

test('holds the app back while loading', async () => {
  isLoaded.mockReturnValue(false);
  loadAsync.mockReturnValue(new Promise(() => {}));
  let r;
  await act(async () => {
    r = mount();
  });
  expect(texts(r)).toEqual([]);
});

test('a failed load is shown with a retry, not waved through', async () => {
  isLoaded.mockReturnValue(false);
  const load = loadAsync
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  let r;
  await act(async () => {
    r = mount();
  });
  expect(texts(r)).not.toContain('app');
  expect(texts(r)).toContain('Try again');

  await act(async () => {
    r.root.findByProps({ accessibilityRole: 'button' }).props.onPress();
  });
  expect(load).toHaveBeenCalledTimes(2);
  warn.mockRestore();
  expect(texts(r)).toEqual(['app']);
});

test('skips loading when the faces are already registered', async () => {
  isLoaded.mockReturnValue(true);
  const load = loadAsync;
  let r;
  await act(async () => {
    r = mount();
  });
  expect(load).not.toHaveBeenCalled();
  expect(texts(r)).toEqual(['app']);
});
