import { useRouter } from './RouterContext';

/**
 * Route — a single guarded screen in the <Router>.
 *
 * Renders its screen only when the router's active route matches `name`, and
 * only if every guard allows access. Otherwise it renders `fallback` (a paywall,
 * a redirect prompt, etc.) or nothing.
 *
 * Props:
 *   name      — route key this screen answers to (required)
 *   component — screen component to render (receives the router `params`)
 *   children  — alternative to `component`; rendered when active + allowed
 *   guard     — one guard fn, or an array of them, run in order:
 *                 (context) => boolean   // true = allow, false = block
 *               context = { route: name, params, navigate, replace, back }
 *   fallback  — what to render when a guard blocks (default: null)
 *
 * Guards are side-effect friendly on purpose — a subscription guard can log,
 * kick off navigation, or open a paywall. Today they're console.log stubs.
 */
export default function Route({
  name,
  component: Component,
  children,
  guard,
  fallback = null,
}) {
  const { route, params, navigate, replace, back, reset } = useRouter();

  // Not the active route → render nothing.
  if (route !== name) return null;

  const guards = guard ? (Array.isArray(guard) ? guard : [guard]) : [];
  const context = { route: name, params, navigate, replace, back, reset };
  const allowed = guards.every((g) => g(context) !== false);

  if (!allowed) return fallback;

  if (Component) return <Component {...params} />;
  return children ?? null;
}
