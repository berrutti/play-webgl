import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from './useSettings';
import { settingsService } from '../services/settingsService';

vi.mock('../services/settingsService', () => ({
  settingsService: {
    loadSettings: vi.fn(),
    saveShowHelp: vi.fn(),
    saveMuted: vi.fn(),
    saveInputSource: vi.fn(),
    saveBpm: vi.fn(),
  },
}));

describe('useSettings', () => {

  beforeEach(() => {
    vi.mocked(settingsService.loadSettings).mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.showHelp).toBe(true);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.inputSource).toBe('webcam');
    expect(result.current.bpm).toBe(120);
  });

  it('should load settings from settingsService on mount', () => {
    const savedSettings = {
      showHelp: false,
      isMuted: true,
      bpm: 140,
    };

    vi.mocked(settingsService.loadSettings).mockReturnValue(savedSettings);

    const { result } = renderHook(() => useSettings());

    expect(result.current.showHelp).toBe(false);
    expect(result.current.isMuted).toBe(true);
    expect(result.current.bpm).toBe(140);
  });

  it('should update showHelp and save to settingsService', async () => {
    const { result } = renderHook(() => useSettings());

    vi.mocked(settingsService.saveShowHelp).mockClear();

    act(() => {
      result.current.setShowHelp(false);
    });

    expect(result.current.showHelp).toBe(false);

    await vi.waitFor(() => {
      expect(settingsService.saveShowHelp).toHaveBeenCalledWith(false);
    });
  });

  it('should update isMuted and save to settingsService', async () => {
    const { result } = renderHook(() => useSettings());

    vi.mocked(settingsService.saveMuted).mockClear();

    act(() => {
      result.current.setIsMuted(true);
    });

    expect(result.current.isMuted).toBe(true);

    await vi.waitFor(() => {
      expect(settingsService.saveMuted).toHaveBeenCalledWith(true);
    });
  });

  it('should update inputSource and save to settingsService', async () => {
    const { result } = renderHook(() => useSettings());

    vi.mocked(settingsService.saveInputSource).mockClear();

    act(() => {
      result.current.setInputSource('video');
    });

    expect(result.current.inputSource).toBe('video');

    await vi.waitFor(() => {
      expect(settingsService.saveInputSource).toHaveBeenCalledWith('video');
    });
  });

  it('should update bpm and save to settingsService', async () => {
    const { result } = renderHook(() => useSettings());

    vi.mocked(settingsService.saveBpm).mockClear();

    act(() => {
      result.current.setBpm(150);
    });

    expect(result.current.bpm).toBe(150);

    await vi.waitFor(() => {
      expect(settingsService.saveBpm).toHaveBeenCalledWith(150);
    });
  });

  it('should handle settings persistence after loading from storage', async () => {
    // Mock loading settings that differ from defaults
    vi.mocked(settingsService.loadSettings).mockReturnValue({
      showHelp: false,
      isMuted: true,
    });

    vi.mocked(settingsService.saveShowHelp).mockClear();
    vi.mocked(settingsService.saveMuted).mockClear();
    vi.mocked(settingsService.saveInputSource).mockClear();
    vi.mocked(settingsService.saveBpm).mockClear();

    renderHook(() => useSettings());

    // Wait for all effects to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // After loading and initialization, settings will be saved once
    expect(settingsService.saveShowHelp).toHaveBeenCalledTimes(1);
    expect(settingsService.saveShowHelp).toHaveBeenCalledWith(false);
    expect(settingsService.saveMuted).toHaveBeenCalledTimes(1);
    expect(settingsService.saveMuted).toHaveBeenCalledWith(true);
  });

  it('should provide setter functions', () => {
    const { result } = renderHook(() => useSettings());

    expect(typeof result.current.setShowHelp).toBe('function');
    expect(typeof result.current.setIsMuted).toBe('function');
    expect(typeof result.current.setInputSource).toBe('function');
    expect(typeof result.current.setBpm).toBe('function');
  });
});
