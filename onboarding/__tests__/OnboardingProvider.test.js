import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Route } from '../../routing';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import { useGarden } from '../../store/GardenProvider';
import { OnboardingProvider, resolveInitial, useOnboarding } from '../OnboardingProvider';
import OnboardingNavigator from '../OnboardingNavigator';
import { COMPLETE, FRESH, loadOnboardingSync } from '../storage';

const fs = require('expo-file-system');

let ob;
function Probe() {
  ob = useOnboarding();
  return null;
}
let garden;
function GardenProbe() {
  garden = useGarden();
  return null;
}

const trees = [];
function mount(props = {}) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <OnboardingProvider {...props}>
        <Probe />
      </OnboardingProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

beforeEach(() => {
  fs.__files.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  act(() => {
    while (trees.length) trees.pop().unmount();
  });
  cleanupTrees();
  jest.restoreAllMocks();
});

describe('entry policy', () => {
  test('a fresh sign-in with no record starts onboarding, and says so on disk', () => {
    mount({ signedInVia: 'login', override: null });
    expect(ob).toMatchObject({ stage: 'intro', step: 0, active: true, initialRoute: 'onboarding' });
    expect(loadOnboardingSync()).toMatchObject({ stage: 'intro', step: 0 });
  });

  test.each(['restore', 'dev'])('a %s session with no record is an existing install: complete', (via) => {
    mount({ signedInVia: via, override: null });
    expect(ob).toMatchObject({ stage: 'complete', active: false, initialRoute: 'today' });
    expect(loadOnboardingSync()).toMatchObject({ stage: 'complete' });
  });

  test('a completed record opens Today even after a fresh sign-in', () => {
    mount({ signedInVia: 'login', initial: { ...COMPLETE }, override: null });
    expect(ob).toMatchObject({ active: false, initialRoute: 'today' });
  });

  test('an unfinished record resumes on its step', () => {
    mount({ signedInVia: 'restore', initial: { ...FRESH, step: 2 }, override: null });
    expect(ob).toMatchObject({ stage: 'intro', step: 2, initialRoute: 'onboarding' });
  });

  test('the dev override previews either path and writes nothing', () => {
    expect(resolveInitial({ stored: COMPLETE, signedInVia: 'dev', override: 'fresh' })).toEqual({
      record: FRESH,
      resuming: false,
      persist: false,
    });
    expect(
      resolveInitial({ stored: null, signedInVia: 'login', override: 'complete' }).record.stage,
    ).toBe('complete');
  });
});

describe('interruption recovery', () => {
  test('scan/search in progress with nothing saved resumes on the entry screen', () => {
    const out = resolveInitial({ stored: { ...FRESH, stage: 'add-plant', step: 3 }, signedInVia: 'restore' });
    expect(out).toMatchObject({ record: { stage: 'intro', step: 3 }, resuming: false });
  });

  test('a saved plant or a pending paywall has to be settled before anything shows', () => {
    const saved = { ...FRESH, stage: 'add-plant', step: 3, savedPlantId: 'p1' };
    expect(resolveInitial({ stored: saved, signedInVia: 'restore' }).resuming).toBe(true);
    const paywall = { ...FRESH, stage: 'paywall', step: 3 };
    expect(resolveInitial({ stored: paywall, signedInVia: 'restore' }).resuming).toBe(true);
  });
});

describe('transitions', () => {
  beforeEach(() => mount({ signedInVia: 'login', override: null }));

  test('Next and Back move between steps and are clamped', () => {
    act(() => ob.setStep(1));
    expect(ob.step).toBe(1);
    act(() => ob.setStep(0));
    act(() => ob.setStep(-3));
    expect(ob.step).toBe(0);
    act(() => ob.setStep(9));
    expect(ob.step).toBe(3);
  });

  test('Skip to the entry screen is a step like any other', () => {
    act(() => ob.setStep(3));
    expect(ob).toMatchObject({ stage: 'intro', step: 3, addingPlant: false });
  });

  test('only beginPlant opens an add session, and returnToEntry closes it', () => {
    act(() => ob.recordSavedPlant('p1'));
    expect(ob.savedPlantId).toBeNull(); // no session → not an onboarding plant

    act(() => ob.beginPlant());
    expect(ob).toMatchObject({ stage: 'add-plant', addingPlant: true });
    act(() => ob.recordSavedPlant('p1'));
    expect(ob.savedPlantId).toBe('p1');
    expect(loadOnboardingSync()).toMatchObject({ stage: 'add-plant', savedPlantId: 'p1' });

    act(() => ob.returnToEntry());
    expect(ob).toMatchObject({ stage: 'intro', step: 3, addingPlant: false, savedPlantId: 'p1' });
  });

  test('completion is idempotent and final', () => {
    act(() => ob.beginPaywall());
    expect(ob.stage).toBe('paywall');
    const writes = jest.spyOn(fs.File.prototype, 'moveSync');
    act(() => ob.complete());
    act(() => ob.complete());
    expect(writes).toHaveBeenCalledTimes(1);
    expect(ob).toMatchObject({ stage: 'complete', active: false });

    // Nothing reopens a finished onboarding.
    act(() => ob.setStep(0));
    act(() => ob.beginPlant());
    act(() => ob.beginPaywall());
    expect(ob.stage).toBe('complete');
  });

  test('a failed write does not hold the session back', () => {
    jest.spyOn(fs.File.prototype, 'moveSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    act(() => ob.complete());
    expect(ob.active).toBe(false);
  });
});

describe('resuming through the navigator', () => {
  const NOW = new Date(2026, 8, 22);
  const state = seedGarden({ now: NOW, plants: [{ nickname: 'Penny' }] });
  const plantId = state.plants[0].id;

  function boot(record) {
    return renderWithGarden(
      <OnboardingProvider initial={record} override={null}>
        <Probe />
        <GardenProbe />
        <OnboardingNavigator />
        <Route name="onboarding">
          <Text>onboarding</Text>
        </Route>
        <Route name="paywall" component={({ source }) => <Text>{`paywall:${source}`}</Text>} />
      </OnboardingProvider>,
      { state, initial: 'onboarding', clock: NOW },
    );
  }

  test('a saved plant that reached the garden goes straight to the paywall', () => {
    const r = boot({ ...FRESH, stage: 'add-plant', step: 3, savedPlantId: plantId });
    expect(r.texts()).toContain('paywall:onboarding');
    expect(ob).toMatchObject({ stage: 'paywall', resuming: false });
    expect(r.router.canGoBack).toBe(false);
  });

  test('a saved plant the garden never got means adding one again — never creating it', () => {
    const r = boot({ ...FRESH, stage: 'add-plant', step: 3, savedPlantId: 'lost' });
    expect(r.texts()).toContain('onboarding');
    expect(ob).toMatchObject({ stage: 'intro', step: 3, resuming: false });
    expect(garden.plants.map((p) => p.nickname)).toEqual(['Penny']);
  });

  test('a pending paywall reopens', () => {
    const r = boot({ ...FRESH, stage: 'paywall', step: 3 });
    expect(r.texts()).toContain('paywall:onboarding');
  });
});

describe('the backend decides at sign-in', () => {
  const reported = { ...COMPLETE, reported: true };
  const at = (props) => mount({ signedInVia: 'login', override: null, reportShown: jest.fn(async () => ({})), ...props });

  test('onboarding_shown true skips it, whatever is on disk', () => {
    at({ serverShown: true, initial: { ...FRESH, step: 2 } });
    expect(ob).toMatchObject({ stage: 'complete', active: false, initialRoute: 'today' });
    expect(loadOnboardingSync()).toMatchObject({ stage: 'complete', reported: true });
  });

  test('onboarding_shown false starts it even though this phone finished it for someone', () => {
    at({ serverShown: false, initial: reported });
    expect(ob).toMatchObject({ stage: 'intro', step: 0, initialRoute: 'onboarding' });
  });

  test('onboarding_shown false resumes an unfinished record', () => {
    at({ serverShown: false, initial: { ...FRESH, step: 2 } });
    expect(ob).toMatchObject({ stage: 'intro', step: 2 });
  });

  test('onboarding_shown false does not replay a finish whose report never landed', async () => {
    const reportShown = jest.fn(async () => ({}));
    at({ serverShown: false, initial: { ...COMPLETE }, reportShown });
    expect(ob).toMatchObject({ stage: 'complete', initialRoute: 'today' });
    await act(async () => {});
    expect(reportShown).toHaveBeenCalledWith(true);
    expect(loadOnboardingSync()).toMatchObject({ reported: true });
  });

  test('no answer falls back to the record on this device', () => {
    at({ serverShown: null, initial: reported });
    expect(ob).toMatchObject({ stage: 'complete', initialRoute: 'today' });
  });
});

describe('reporting completion', () => {
  test('finishing sends PATCH once and records it', async () => {
    const reportShown = jest.fn(async () => ({}));
    mount({ signedInVia: 'login', serverShown: false, override: null, reportShown });
    expect(reportShown).not.toHaveBeenCalled();
    await act(async () => ob.complete());
    expect(reportShown).toHaveBeenCalledTimes(1);
    expect(loadOnboardingSync()).toMatchObject({ stage: 'complete', reported: true });
  });

  test('a failed report is retried at the next launch', async () => {
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    const tree = mount({ signedInVia: 'login', serverShown: false, override: null, reportShown: failing });
    await act(async () => ob.complete());
    expect(loadOnboardingSync()).toMatchObject({ stage: 'complete', reported: false });
    act(() => tree.unmount());

    const retry = jest.fn(async () => ({}));
    mount({ signedInVia: 'restore', override: null, reportShown: retry });
    await act(async () => {});
    expect(retry).toHaveBeenCalledWith(true);
    expect(loadOnboardingSync()).toMatchObject({ reported: true });
  });

  test('the dev bypass never reports', async () => {
    const reportShown = jest.fn(async () => ({}));
    mount({ signedInVia: 'dev', override: null, reportShown });
    await act(async () => {});
    expect(reportShown).not.toHaveBeenCalled();
  });
});
