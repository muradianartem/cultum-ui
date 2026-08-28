import { createContext, useContext } from 'react';

/**
 * The shared navigation state for the app's minimal router.
 *
 * Shape:
 *   route     — name of the currently active route (string)
 *   params    — params passed to the current route (object)
 *   navigate(name, params?) — push a new route
 *   replace(name, params?)  — swap the current route without growing history
 *   back()                  — pop to the previous route
 *   reset(name, params?)    — jump to a route and clear all history (pop to root)
 *   canGoBack               — whether there is history to pop
 */
export const RouterContext = createContext(null);

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used inside a <Router>.');
  }
  return ctx;
}
