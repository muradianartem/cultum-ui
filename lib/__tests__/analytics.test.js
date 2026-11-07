import {
  __setAnalyticsClient,
  identify,
  initAnalytics,
  resetAnalytics,
  screen,
  setSuperProperties,
  track,
} from '../analytics';

const fakeClient = () => ({
  capture: jest.fn(),
  screen: jest.fn(),
  identify: jest.fn(),
  register: jest.fn(),
  reset: jest.fn(),
});

afterEach(() => __setAnalyticsClient(undefined));

test('without a key (and under jest) every call is a silent no-op', () => {
  expect(() => {
    initAnalytics();
    track('plant_added', { species_key: 'monstera' });
    screen('today');
    identify('42');
    setSuperProperties({ plan: 'free' });
    resetAnalytics();
  }).not.toThrow();
});

test('forwards calls to the client', () => {
  const c = fakeClient();
  __setAnalyticsClient(c);
  track('plant_added', { species_key: 'monstera' });
  screen('today');
  identify(42, { plan: 'free' });
  setSuperProperties({ plan: 'plus' });
  resetAnalytics();
  expect(c.capture).toHaveBeenCalledWith('plant_added', { species_key: 'monstera' });
  expect(c.screen).toHaveBeenCalledWith('today', undefined);
  expect(c.identify).toHaveBeenCalledWith('42', { plan: 'free' });
  expect(c.register).toHaveBeenCalledWith({ plan: 'plus' });
  expect(c.reset).toHaveBeenCalled();
});

test('identify ignores a missing id', () => {
  const c = fakeClient();
  __setAnalyticsClient(c);
  identify(null);
  expect(c.identify).not.toHaveBeenCalled();
});

test('a throwing client never reaches the caller', () => {
  const c = fakeClient();
  c.capture.mockImplementation(() => {
    throw new Error('boom');
  });
  __setAnalyticsClient(c);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(() => track('x')).not.toThrow();
  warn.mockRestore();
});
