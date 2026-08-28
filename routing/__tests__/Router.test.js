import TestRenderer, { act } from 'react-test-renderer';
import Router from '../Router';
import { useRouter } from '../RouterContext';

// Captures the live router context so tests can drive it imperatively.
let api;
function Probe() {
  api = useRouter();
  return null;
}

function mount(initial = 'today') {
  act(() => {
    TestRenderer.create(
      <Router initial={initial}>
        <Probe />
      </Router>
    );
  });
}

test('reset jumps to a route and empties the history stack', () => {
  mount('today');
  act(() => api.navigate('scan-camera'));
  act(() => api.navigate('scan-matches'));
  expect(api.canGoBack).toBe(true);

  act(() => api.reset('today'));
  expect(api.route).toBe('today');
  expect(api.canGoBack).toBe(false);
});

test('reset passes params through', () => {
  mount('today');
  act(() => api.reset('scan-camera', { from: 'close' }));
  expect(api.route).toBe('scan-camera');
  expect(api.params).toEqual({ from: 'close' });
});
