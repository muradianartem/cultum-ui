import { useCallback, useMemo, useState } from 'react';
import { RouterContext } from './RouterContext';

/**
 * Router — the minimal in-app navigator.
 *
 * Holds the active route name + params and a history stack, and exposes
 * navigate/replace/back through <RouterContext>. Screens are declared as
 * <Route> children; only the one whose `name` matches the active route renders
 * (and only if its guard allows). No URL, no deep linking — this is an
 * intentionally small primitive we can grow into Expo Router / React Navigation
 * later without changing screen code.
 *
 *   <Router initial="product">
 *     <Route name="product" component={ProductPage} />
 *     <Route name="premium" guard={requireSubscription} component={Premium} />
 *   </Router>
 */
export default function Router({ initial, children }) {
  const [state, setState] = useState({ route: initial, params: {}, stack: [] });

  const navigate = useCallback((route, params = {}) => {
    setState((s) => ({
      route,
      params,
      stack: [...s.stack, { route: s.route, params: s.params }],
    }));
  }, []);

  const replace = useCallback((route, params = {}) => {
    setState((s) => ({ route, params, stack: s.stack }));
  }, []);

  const back = useCallback(() => {
    setState((s) => {
      if (s.stack.length === 0) return s;
      const stack = s.stack.slice(0, -1);
      const prev = s.stack[s.stack.length - 1];
      return { route: prev.route, params: prev.params, stack };
    });
  }, []);

  const value = useMemo(
    () => ({
      route: state.route,
      params: state.params,
      canGoBack: state.stack.length > 0,
      navigate,
      replace,
      back,
    }),
    [state, navigate, replace, back]
  );

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}
