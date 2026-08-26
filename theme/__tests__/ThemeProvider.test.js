import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { colorTokens } from '../colorTokens';
import { ThemeProvider, useTheme, useThemeMode, resolveTokens } from '../ThemeProvider';

describe('resolveTokens', () => {
  test('collapses {light,dark} leaves to the active mode, preserving shape', () => {
    const sample = { a: { x: { light: '#111111', dark: '#222222' } } };
    expect(resolveTokens(sample, 'light')).toEqual({ a: { x: '#111111' } });
    expect(resolveTokens(sample, 'dark')).toEqual({ a: { x: '#222222' } });
  });
});

describe('ThemeProvider / useTheme', () => {
  function mount() {
    const api = {};
    function Probe() {
      api.t = useTheme();
      api.mode = useThemeMode();
      return null;
    }
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      );
    });
    return { api, renderer };
  }

  test('resolves semantic tokens to light hex by default', () => {
    const { api } = mount();
    expect(api.t.brand.primary).toBe(colorTokens.brand.primary.light);
    expect(api.t.text.primary).toBe(colorTokens.text.primary.light);
    expect(api.t.interaction.pressed).toBe('rgba(0,0,0,0.08)');
  });

  test('setMode("dark") re-renders consumers with dark values', () => {
    const { api } = mount();
    act(() => api.mode.setMode('dark'));
    expect(api.mode.mode).toBe('dark');
    expect(api.t.brand.primary).toBe(colorTokens.brand.primary.dark);
    expect(api.t.interaction.pressed).toBe('rgba(255,255,255,0.08)');
  });

  test('useTheme falls back to the light theme when no provider is mounted', () => {
    // Keeps components renderable in isolation (and their existing tests green)
    // without every one needing a ThemeProvider wrapper; the app mounts the
    // provider at its root for real light/dark theming.
    const api = {};
    function Probe() {
      api.t = useTheme();
      return null;
    }
    act(() => {
      TestRenderer.create(<Probe />);
    });
    expect(api.t.brand.primary).toBe(colorTokens.brand.primary.light);
  });
});
