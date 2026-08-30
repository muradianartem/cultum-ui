# Edit Reminders screen

## Summary
Adds a new full-screen **Edit Reminders** page (Figma `Reminders`, node `1:7889`) that lists a plant's care reminders as expandable cards — each with a coloured icon chip, an enable toggle, and a detail list (last/start date, frequency, snooze) — plus a "Remove" action on custom reminders and an "Add Reminder" card at the bottom. It is composed entirely from existing Cultum primitives (`NavigationBar`, `List`/`ListItem`, `Toggle`, `Button`, `Dialog`, `BottomSheet`, `WheelPicker`, `Icon`), driven by a new mock-data fixture with local state (matching the V1 pattern of [TodayScreen.js](screens/TodayScreen.js) and [ProductPage.js](screens/ProductPage.js)), registered as a `reminders` route and exposed from the Product page.

## Goal & non-goals
**Goal:** A pixel-faithful, interactive Edit Reminders screen a user can reach from a plant, toggle reminders on/off, edit each reminder's frequency/snooze/date via a wheel picker, remove custom reminders, and see an "Add Reminder" affordance — all backed by local mock state, wired into the in-app router.

**Non-goals:**
- **No backend / persistence.** Like every V1 screen, state lives in `useState` and resets on unmount. No API calls, no `api/` changes.
- **No real "Add Reminder" creation flow.** The Add Reminder card is present and pressable but opens a "coming soon" `Snackbar` (or no-op) in V1 — designing the create-reminder form is a separate task.
- **No new notification scheduling / OS permissions.** This screen edits reminder *data*, it does not register local notifications.
- **No new design-system primitives.** Everything maps to components already in [components/index.js](components/index.js). If something seems to need a new primitive, prefer composing existing ones.
- **No dark-mode-specific art.** Colours come from `useTheme()` tokens, so dark mode works for free; no bespoke dark treatment beyond that.
- **No changes to the Today flow's `TaskSheet`/`SnoozeContent`.** Those stay as-is; we *reuse the wheel pattern*, not the files.

## Context

The app is Expo SDK 57 / React 19 / RN 0.86 (see [package.json](package.json)). **Before writing code, read the versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ per [AGENTS.md](AGENTS.md).**

Relevant current state:

- **Routing** is a minimal in-app navigator ([routing/Router.js](routing/Router.js), [routing/Route.js](routing/Route.js), [routing/RouterContext.js](routing/RouterContext.js)). Screens are declared as `<Route name=… component=… />` children of `<Router>` in [App.js](App.js). `useRouter()` exposes `{ route, params, navigate, replace, back, reset, canGoBack }`. A screen component receives the route `params` as props. Current routes: `today`, `product`, `scan-camera`, `scan-matches`, `scan-search`, `premium-gallery`.
- **Screen conventions** (see [TodayScreen.js](screens/TodayScreen.js), [ProductPage.js](screens/ProductPage.js)): a screen is a `View` with `flex:1` and `backgroundColor: t.background.primary`; content in a `ScrollView` padded by `useSafeAreaInsets()`; styles built with `makeStyles(t)` memoised on the theme; colours from `useTheme()`, spacing/typography/radius from [theme/foundations.js](theme/foundations.js) (`space`, `typography`, `radius`, `stroke`). Mock data lives in a sibling `*Data.js` module ([screens/todayData.js](screens/todayData.js), [screens/plantData.js](screens/plantData.js)).
- **NavigationBar** ([components/NavigationBar.js](components/NavigationBar.js)) already implements the Figma top bar: `title`, `subtitle`, `leading` (`'back'` renders a ghost `‹` `ButtonIcon` wired to `onLeadingPress`), `actions` (array of `{ icon, onPress, accessibilityLabel }`, ghost `ButtonIcon`s), `size` (`'sm'` centres title over subtitle), `divider`.
- **List / ListItem** ([components/List.js](components/List.js), [components/ListItem.js](components/ListItem.js)): `List variant="card"` wraps children in a grey rounded panel and propagates `variant` to each `ListItem`. `ListItem` takes `before`, `title`, `subtitle`, `after`, `onPress`, `divider`. Card padding is `12px` vertical / `16px` horizontal.
- **Toggle** ([components/Toggle.js](components/Toggle.js)): controlled `value` + `onValueChange`.
- **Coloured icon chip** — the Figma "State Icon Item" (40×40 rounded-full tinted square holding a 20px icon) has **no dedicated primitive**; it is built inline. The established pattern is `TaskRow` in [ProductPage.js:100-120](screens/ProductPage.js): `<View style={[styles.taskTile,{backgroundColor: tone.secondary}]}><Icon size={20} color={tone.primary} /></View>` where `tone = t[task.tone]`. Copy this.
- **Semantic tones** ([theme/colorTokens.js](theme/colorTokens.js)) provide `information` and `warning` (each with `.primary`/`.secondary`), matching the Figma chip fills (`#CFE5FF` blue watering, `#FFDECB` orange fertilizing). The grey notifications chip (`#D9DBD8`) maps to `surface.secondary` + `text.primary`.
- **WheelPicker** ([components/WheelPicker.js](components/WheelPicker.js)) + the value-editor pattern in [screens/SnoozeContent.js](screens/SnoozeContent.js) (two-column number+unit wheel over a selection band) is exactly the interaction the detail rows need. **BottomSheet** ([components/BottomSheet.js](components/BottomSheet.js)) hosts it. Note the [[no-stacked-modals]] memory does **not** bite here: this is a plain screen, not a Modal, so a single BottomSheet over it is fine.
- **Icons** — all needed glyphs exist in [components/iconRegistry.js](components/iconRegistry.js): `outlined-water`, `power`, `notifications`, `add`, `trash`, `chevron-right`, `chevron-left`, `calendar`, `clock`.
- **Entry point today:** the Product page's hero "Settings" `NavButton` (`onPress={() => {}}`, [ProductPage.js:203](screens/ProductPage.js)) and the overflow menu's "Notification settings" item (no-op, [ProductPage.js:167](screens/ProductPage.js)) are both dead ends — natural places to launch this screen. The Figma nav subtitle "Fern Gully" is a plant name, confirming this is the **per-plant** reminders editor.
- **Tests**: Jest + `jest-expo`, `react-test-renderer`. Screen tests wrap the screen in `<SafeAreaProvider initialMetrics=…><Router initial=…>` and assert on flattened `Text` content / `accessibilityRole` nodes (see [screens/__tests__/TodayScreen.test.js](screens/__tests__/TodayScreen.test.js)). Run with `npm test`.

## Approach & decisions

- **Decision: full screen, not a bottom sheet.** — **chose** a routed full screen over presenting reminders in a `BottomSheet`/`TaskSheet`, because the Figma frame is a full-height page with its own `NavigationBar` (back + add), and the router is how every other page-level view is mounted. This also keeps the value-editor BottomSheet un-nested (no modal-over-modal).
- **Decision: reuse `NavigationBar` as-is (ghost leading/actions).** — **chose** the existing primitive over reproducing Figma's *outlined circular* nav buttons, because the project's stance is "the primitive is the imported source of truth" and every other screen uses ghost nav affordances. The bordered-circle look is a cosmetic delta noted under Risks; if desired, pass a custom node as `leading`/`actions[].icon` later.
- **Decision: coloured chip built inline via `tone`, no new primitive.** — **chose** copying `ProductPage`'s `taskTile` pattern over adding a `StateIconItem` component, matching the non-goal "no new primitives" and keeping tone→theme resolution consistent.
- **Decision: detail rows open a single shared `ReminderValueSheet` (BottomSheet + WheelPicker).** — **chose** one field-typed editor (`'date' | 'frequency' | 'snooze'`) over three bespoke sheets, because all three are the same "pick a value on a wheel and confirm" interaction already proven in `SnoozeContent`. Editing writes back to local state so values visibly update. This is the one place with real implementation depth; see the plan for exact wheel contents.
- **Decision: reminder "kind" drives layout differences via data, not branching in JSX.** — Built-in reminders (Watering/Fertilizing) show `Last {action}` + no Remove; custom reminders (Check for better pods) show `Start date` + a destructive Remove button and default their toggle off. Model this with a `removable` flag and a `dateLabel` string on each reminder so the card component stays uniform.
- **Decision: details always visible (no accordion).** — The Figma shows all three cards expanded with no collapse control, so render details unconditionally; do not build expand/collapse.

## Implementation plan

Build bottom-up: data → sub-components → screen → editor → routing → entry points → tests. The tree compiles and renders after step 4 (screen mounts with inert rows); interactivity lands in steps 5–7.

### 1. Mock data — `screens/reminderData.js` (new)
Export the fixtures the screen renders. Mirror the shape/tone of [screens/todayData.js](screens/todayData.js) with a header comment explaining "V1 mock, local state, no backend."

```js
export const PLANT_NAME = 'Fern Gully'; // nav subtitle; overridable via route param

// Each reminder:
//   id         string
//   kind       'watering' | 'fertilizing' | 'custom'  (chooses icon + tone)
//   title      string
//   nextLabel  string | null   → "Next reminder: 1 Sep" subtitle (null hides it)
//   enabled    boolean         → Toggle initial state
//   removable  boolean         → show the destructive Remove button
//   dateLabel  string          → detail-row label ("Last watering" | "Start date")
//   dateValue  string          → "21 Aug"
//   frequency  string          → "7 days"
//   snooze     string          → "None"
export const REMINDERS = [ /* watering (info, enabled), fertilizing (warning, enabled),
                              custom "Check for better pods" (neutral, removable, off) */ ];

// kind → { icon (registry name), tone ('information'|'warning'|'neutral') }
export const KIND_META = {
  watering:    { icon: 'outlined-water', tone: 'information' },
  fertilizing: { icon: 'power',          tone: 'warning' },
  custom:      { icon: 'notifications',  tone: 'neutral' },
};
```
Seed the three reminders exactly as the Figma text: `Watering` / `Last watering` / `7 days` / `None`, `Fertilizing` / `Last fertilizing`, `Check for better pods` / `Start date` / `Next reminder: 1 Sep` / `enabled:false` / `removable:true`. Provide wheel-source constants too (see step 5): `FREQUENCY_UNITS`, `SNOOZE_UNITS = ['None','hours','days','weeks']`, and month/day ranges for dates.

### 2. Coloured chip helper — inside `RemindersScreen`
A small component resolving `KIND_META[kind]` to `{ icon, tone }`, where `tone==='neutral'` → `{ bg: t.surface.secondary, fg: t.text.primary }` and otherwise `{ bg: t[tone].secondary, fg: t[tone].primary }`. Render a 40×40 `radius.full` `View` (from `theme/foundations`) holding `<Icon name={icon} size={20} color={fg} />`. Reuse the `taskTile` style values from `ProductPage`.

### 3. Reminder card — `ReminderCard` (co-located in the screen file, like `TaskGroup`/`TaskRow`)
`ReminderCard({ reminder, onToggle, onEditField, onRemove, styles, t })`. Structure per Figma "Reminder Group" (a `List variant="card"` panel):
- **Header row**: `<ListItem before={<Chip kind/>} title={reminder.title} subtitle={reminder.nextLabel} after={<Toggle value={reminder.enabled} onValueChange={onToggle} accessibilityLabel={`Enable ${reminder.title}`} />} />`. The header row is **not** pressable (only the toggle and detail rows are interactive).
- **Detail list**: three rows, each a pressable row `label ↔ (value + chevron-right)`:
  1. `reminder.dateLabel` → `reminder.dateValue`, press → `onEditField('date')`
  2. `Frequency` → `reminder.frequency`, press → `onEditField('frequency')`
  3. `Snooze for` → `reminder.snooze`, press → `onEditField('snooze')`

  Build each as a `Pressable` row: left `Text` (`typography.bodyLarge`, `t.text.primary`), right a row of value `Text` + `<Icon name="chevron-right" size={20} />`, `justifyContent:'space-between'`, `paddingVertical: space[4]`. (You may use `ListItem` with `title`/`after`/`onPress` instead — either matches; the hand-rolled row matches the Figma "Detail Row" spacing more exactly.)
- **Remove button** (only when `reminder.removable`): `<Button variant="secondary" destructive size="sm" label="Remove" leftIcon={<Icon name="trash" size={16} color={…} />} onPress={onRemove} />`. Per Figma it is a full-width secondary (grey) button with a trash icon; keep `destructive` so the label reads as an action colour.

Detail-list container padding per Figma: `padding: 0 16 12/16`, `gap: 4` (date/freq/snooze) with `gap:12` before the Remove button.

### 4. Screen shell — `screens/RemindersScreen.js` (new)
```js
export default function RemindersScreen({ plantName }) { … }
```
- `const { back } = useRouter();  const insets = useSafeAreaInsets();  const t = useTheme();  const styles = useMemo(() => makeStyles(t), [t]);`
- Local state: `const [reminders, setReminders] = useState(REMINDERS);` and editor state (step 5).
- Render a `flex:1` `View` (`t.background.primary`) containing:
  - `<NavigationBar title="Edit Reminders" subtitle={plantName ?? PLANT_NAME} leading="back" onLeadingPress={back} divider={false} actions={[{ icon: <Icon name="add" size={24} color={t.text.primary} />, onPress: openAddReminder, accessibilityLabel: 'Add reminder' }]} />` — but note the nav bar must sit **below** the status bar: wrap it so it starts at `insets.top` (either pad a top `View` of height `insets.top`, or place NavigationBar inside a `View` with `paddingTop: insets.top`). Follow whatever `ProductPage`/`TodayScreen` do for the safe-area top; `NavigationBar` itself does not add top inset.
  - `<ScrollView contentContainerStyle={{ padding: space[16], paddingBottom: insets.bottom + space[24], gap: space[16] }}>` mapping `reminders` to `<ReminderCard … />`, then the **Add Reminder** card: a `List variant="card"` with one pressable `ListItem before={<Chip kind for add/notifications, neutral tone/>} title="Add Reminder" onPress={openAddReminder} />`.
- Handlers:
  - `toggle(id)` → `setReminders(rs => rs.map(r => r.id===id ? {…r, enabled:!r.enabled} : r))`.
  - `remove(id)` → open a confirm `Dialog` (see step 6), on confirm `setReminders(rs => rs.filter(r => r.id!==id))`.
  - `openEditField(id, field)` → set editor state (step 5).
  - `openAddReminder()` → V1 stub: show a `Snackbar` "Adding reminders is coming soon" (or no-op). Document as non-goal.

### 5. Value editor — `ReminderValueSheet` (new file `screens/ReminderValueSheet.js`, or co-located)
A `BottomSheet` hosting a `WheelPicker`, closely following [screens/SnoozeContent.js](screens/SnoozeContent.js) (selection band + wheels + confirm `Button`). Props:
```js
ReminderValueSheet({ visible, field, reminder, onClose, onConfirm })
//   field: 'date' | 'frequency' | 'snooze'
//   onConfirm(nextValueString)  → parent writes it back to the reminder
```
Field → wheel configuration:
- **`frequency`**: two columns — number `1–30` and unit `['days','weeks','months']`. Confirm label `Set frequency`; result string e.g. `"7 days"`.
- **`snooze`**: number `1–12` + unit `['hours','days','weeks']`, plus a leading **`None`** option (a single-column mode, or unit list `['None','hours','days','weeks']` where `None` hides the number column). Result `"None"` or `"2 days"`. Reuse `SnoozeContent`'s singular/plural logic.
- **`date`**: two columns — month (`Jan…Dec`, reuse the `MONTHS` array pattern from [TodayScreen.js](screens/TodayScreen.js)) and day (`1–31`). Result `"21 Aug"` (format `${day} ${MONTHS[m]}`).

Initialise the wheel indices by parsing `reminder`'s current value for that field (best-effort; fall back to a sensible default index if parsing fails). On confirm: `onConfirm(resultString); onClose();` and the parent updates the reminder via `setReminders`. In the screen, wire `onConfirm` to write to the field named by editor state.

`WheelPicker`/band styling and `ITEM_H`/`WHEEL_H` constants: copy from `SnoozeContent`. Title text = the field label (`Frequency` / `Snooze for` / the date label).

### 6. Remove confirmation — reuse `Dialog`
Follow the `confirmAll` pattern in [TodayScreen.js](screens/TodayScreen.js): a `Dialog` with `title="Remove reminder?"`, `description` naming the reminder, `primaryAction={{ label:'Remove', onPress: …, destructive }}` and `secondaryAction={{ label:'Cancel' }}`. Keep the pending reminder id in state while the dialog is open.

### 7. Routing — register + expose
- **`App.js`**: import `RemindersScreen` and add `<Route name="reminders" component={RemindersScreen} />` inside `<Router>` alongside the others.
- **Entry point (`ProductPage.js`)**: change the hero **Settings** `NavButton` `onPress` (currently `() => {}`) to `() => navigate('reminders', { plantName: vm.commonName })`, and the overflow menu **"Notification settings"** item's `onPress` to `() => { setMenuOpen(false); navigate('reminders', { plantName: vm.commonName }); }`. `navigate` is already destructured from `useRouter()` in `ProductPage`.
- The screen's back button calls `useRouter().back()`, which pops to `product` (or wherever it was launched from).

### 8. Tests — `screens/__tests__/RemindersScreen.test.js` (new)
Mirror [screens/__tests__/TodayScreen.test.js](screens/__tests__/TodayScreen.test.js): wrap in `SafeAreaProvider initialMetrics=… > Router initial="reminders"`. Assert:
- Renders the three reminder titles and the "Add Reminder" row.
- The `switch` (Toggle) count/state and that pressing a toggle flips its `accessibilityState.checked`.
- Pressing "Remove" on the custom reminder opens the dialog; confirming drops it (title no longer present).
- A detail row is pressable (has `onPress`) — opening the sheet can be asserted by the sheet's title text appearing, if `BottomSheet` renders inline (check how `TaskSheet` tests handle `Modal`/`BottomSheet`; if it doesn't render synchronously in the test renderer, assert the row's `onPress` exists instead).

## Data & interface changes
No API, schema, or type-system changes. New modules only:
- `screens/reminderData.js` — mock fixtures + wheel sources (new export surface, above).
- `screens/RemindersScreen.js`, `screens/ReminderValueSheet.js` — new components.
- `App.js` — one new `<Route name="reminders">`.
- `screens/ProductPage.js` — two `onPress` handlers repointed to `navigate('reminders', …)`.

Route contract: `reminders` accepts optional param `{ plantName?: string }`; falls back to `PLANT_NAME` from the fixture (same param-or-default pattern as `ProductPage`'s `plant ?? DEFAULT_PLANT_VM`).

## Verification
- **Unit:** `npm test -- RemindersScreen` (and full `npm test` to confirm no regressions in routing/screen suites).
- **Manual (simulator):** `npm run ios`, then from a plant's Product page (open the `product` route; if the plant isn't "added", the Settings button only shows once `added` — reach it via the overflow "Notification settings" instead, or launch `reminders` as the `initial` route temporarily for isolated visual QA). Verify against Figma node `1:7889`:
  - Nav bar shows "Edit Reminders" / plant name, back + add buttons.
  - Three cards render with correct coloured chips (blue water, orange power, grey notifications), the custom card's toggle **off**, its "Next reminder: 1 Sep" subtitle, and its Remove button.
  - Toggling a reminder animates the switch and persists within the session.
  - Tapping Frequency / Snooze / date opens the wheel sheet; confirming updates the row's value text.
  - Tapping Remove → confirm dialog → card disappears.
- **Dark mode:** flip the simulator to dark; chips/text/toggles should re-tint via tokens with no hard-coded colours leaking (grep the new files for hex literals — there should be none except any copied band colour from `SnoozeContent`).

## Acceptance criteria
- [ ] A `reminders` route is registered in [App.js](App.js) and reachable from the Product page's Settings button and overflow "Notification settings" item, passing `plantName`.
- [ ] `RemindersScreen` renders `NavigationBar` (title "Edit Reminders", subtitle = plant name, back + add) below the status bar, and a scrollable list of reminder cards + an "Add Reminder" card, matching Figma `1:7889`.
- [ ] Each card shows the correct kind chip (watering→information/water, fertilizing→warning/power, custom→neutral/notifications), title, optional "Next reminder" subtitle, and a working enable `Toggle`.
- [ ] Detail rows (date, Frequency, Snooze for) are pressable and open a `WheelPicker` `BottomSheet` whose confirmation updates the shown value in local state.
- [ ] Custom (`removable`) reminders show a destructive "Remove" button that, after a confirm `Dialog`, removes the card; built-in reminders show no Remove button.
- [ ] Colours resolve through `useTheme()` (works in light and dark); no new design-system primitives were added.
- [ ] New `RemindersScreen` Jest test passes and `npm test` is green.

## Risks, assumptions & open questions
- **Assumption — this is the per-plant reminders editor.** The Figma subtitle "Fern Gully" (a plant name) and the natural entry from a plant's Settings drive this. If instead it's meant to be a *global* reminders list, the entry point and `plantName` param change (surface from Settings tab instead). *Non-blocking:* the screen body is identical either way; only the launch site differs.
- **Decision to confirm — how far to wire detail-row editing (V1 scope).** This doc specifies functional wheel editors for **all three** field types (date/frequency/snooze). If that's more than wanted for V1, a smaller cut is: make rows pressable but open the sheet only for Frequency + Snooze, leaving date rows as a stub — matching how `TodayScreen` ships some no-op affordances. Recommendation: build all three (they share one component; the marginal cost is the month/day wheel). *Flagged, non-blocking.*
- **Risk — safe-area top for `NavigationBar`.** `NavigationBar` does not add `insets.top`; forgetting the top pad puts it under the notch. Follow the exact top-inset handling `ProductPage`/`TodayScreen` use.
- **Risk — `BottomSheet` in tests.** If `BottomSheet` renders via RN `Modal`, `react-test-renderer` may not mount its children synchronously; assert row `onPress` presence rather than sheet contents, or follow how existing `TaskSheet`/`SnoozeContent` (if tested) are covered.
- **Cosmetic delta — nav buttons.** Figma shows *outlined circular* back/add buttons; the reused `NavigationBar` renders ghost buttons. Accepted per "primitive is source of truth"; revisit only if design insists.
- **Assumption — Add Reminder is a stub in V1.** Confirmed as a non-goal; the card is present and pressable but does not open a create form.
