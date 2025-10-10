import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffectTransitions } from './useEffectTransitions';
import { ShaderEffect } from '../utils';
import { settingsService } from '../services/settingsService';

vi.mock('../services/settingsService', () => ({
  settingsService: {
    loadSettings: vi.fn(),
    saveActiveEffects: vi.fn(),
  },
}));

describe('useEffectTransitions', () => {
  const initialActiveEffects = {
    [ShaderEffect.INVERT]: false,
    [ShaderEffect.GRAYSCALE]: false,
    [ShaderEffect.REALITY_GLITCH]: false,
    [ShaderEffect.KALEIDOSCOPE]: false,
    [ShaderEffect.DISPLACE]: false,
    [ShaderEffect.SWIRL]: false,
    [ShaderEffect.CHROMA]: false,
    [ShaderEffect.PIXELATE]: false,
    [ShaderEffect.VORONOI]: false,
    [ShaderEffect.RIPPLE]: false,
  };

  const initialIntensities = {
    [ShaderEffect.INVERT]: 1,
    [ShaderEffect.GRAYSCALE]: 1,
    [ShaderEffect.REALITY_GLITCH]: 1,
    [ShaderEffect.KALEIDOSCOPE]: 1,
    [ShaderEffect.DISPLACE]: 1,
    [ShaderEffect.SWIRL]: 1,
    [ShaderEffect.CHROMA]: 1,
    [ShaderEffect.PIXELATE]: 1,
    [ShaderEffect.VORONOI]: 1,
    [ShaderEffect.RIPPLE]: 1,
  };

  beforeEach(() => {
    vi.mocked(settingsService.loadSettings).mockReturnValue({
      activeEffects: initialActiveEffects,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with provided active effects and intensities', () => {
    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    expect(result.current.activeEffects).toEqual(initialActiveEffects);
    expect(result.current.effectIntensities).toEqual(initialIntensities);
  });

  it('should load active effects from settings service', () => {
    const savedActiveEffects = {
      ...initialActiveEffects,
      [ShaderEffect.INVERT]: true,
    };

    vi.mocked(settingsService.loadSettings).mockReturnValue({
      activeEffects: savedActiveEffects,
    });

    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(true);
    expect(settingsService.loadSettings).toHaveBeenCalled();
  });

  it('should toggle effect on and trigger transition', () => {
    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(false);

    act(() => {
      result.current.handleToggleEffect(ShaderEffect.INVERT);
    });

    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(true);
  });

  it('should toggle effect off and trigger transition', () => {
    const activeEffects = {
      ...initialActiveEffects,
      [ShaderEffect.INVERT]: true,
    };

    vi.mocked(settingsService.loadSettings).mockReturnValue({
      activeEffects,
    });

    const { result } = renderHook(() =>
      useEffectTransitions(activeEffects, initialIntensities)
    );

    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(true);

    act(() => {
      result.current.handleToggleEffect(ShaderEffect.INVERT);
    });

    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(false);
  });

  it('should debounce rapid toggle calls', async () => {
    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(false);

    // First toggle should work
    act(() => {
      result.current.handleToggleEffect(ShaderEffect.INVERT);
    });
    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(true);

    // Immediate second toggle should be debounced (ignored)
    act(() => {
      result.current.handleToggleEffect(ShaderEffect.INVERT);
    });
    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(true);

    // After debounce delay, toggle should work again
    await new Promise(resolve => setTimeout(resolve, 100));

    act(() => {
      result.current.handleToggleEffect(ShaderEffect.INVERT);
    });
    expect(result.current.activeEffects[ShaderEffect.INVERT]).toBe(false);
  });

  it('should update intensity for an effect', () => {
    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    expect(result.current.effectIntensities[ShaderEffect.PIXELATE]).toBe(1);

    act(() => {
      result.current.handleIntensityChange(ShaderEffect.PIXELATE, 0.5);
    });

    expect(result.current.effectIntensities[ShaderEffect.PIXELATE]).toBe(0.5);
  });

  it('should save active effects to settings service after changes', async () => {
    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    vi.mocked(settingsService.saveActiveEffects).mockClear();

    act(() => {
      result.current.handleToggleEffect(ShaderEffect.INVERT);
    });

    // Wait for useEffect to run
    await vi.waitFor(() => {
      expect(settingsService.saveActiveEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          [ShaderEffect.INVERT]: true,
        })
      );
    });
  });

  it('should save to settings after initialization completes', async () => {
    vi.mocked(settingsService.saveActiveEffects).mockClear();

    renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    // Wait for initialization useEffect to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // The hook saves once after initialization (when isInitialized becomes true)
    expect(settingsService.saveActiveEffects).toHaveBeenCalledTimes(1);
    expect(settingsService.saveActiveEffects).toHaveBeenCalledWith(
      initialActiveEffects
    );
  });

  it('should provide rendering effects based on transition state', () => {
    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    // Initially all effects should have renderingEffects = false
    expect(result.current.renderingEffects[ShaderEffect.INVERT]).toBe(false);

    // renderingIntensities should be defined
    expect(result.current.renderingIntensities).toBeDefined();
    expect(typeof result.current.renderingIntensities[ShaderEffect.INVERT]).toBe('number');
  });

  it('should allow setting effect intensities directly', () => {
    const { result } = renderHook(() =>
      useEffectTransitions(initialActiveEffects, initialIntensities)
    );

    const newIntensities = {
      ...initialIntensities,
      [ShaderEffect.RIPPLE]: 0.7,
    };

    act(() => {
      result.current.setEffectIntensities(newIntensities);
    });

    expect(result.current.effectIntensities[ShaderEffect.RIPPLE]).toBe(0.7);
  });
});
