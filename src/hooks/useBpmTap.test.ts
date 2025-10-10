import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBpmTap } from './useBpmTap';

describe('useBpmTap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with default BPM of 120', () => {
    const { result } = renderHook(() => useBpmTap());

    expect(result.current.bpm).toBe(120);
    expect(result.current.isSettingBpm).toBe(false);
  });

  it('should update BPM when spacebar is tapped multiple times', () => {
    const { result } = renderHook(() => useBpmTap());

    // Simulate spacebar taps at 120 BPM (500ms intervals)
    act(() => {
      const event1 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event1);
      vi.advanceTimersByTime(500);
    });

    act(() => {
      const event2 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event2);
      vi.advanceTimersByTime(500);
    });

    act(() => {
      const event3 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event3);
    });

    // BPM should be calculated from taps (500ms = 120 BPM)
    expect(result.current.bpm).toBe(120);
    expect(result.current.isSettingBpm).toBe(true);
  });

  it('should round BPM to nearest 5', () => {
    const { result } = renderHook(() => useBpmTap());

    // Simulate taps at ~127 BPM (472ms intervals)
    act(() => {
      const event1 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event1);
      vi.advanceTimersByTime(472);
    });

    act(() => {
      const event2 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event2);
      vi.advanceTimersByTime(472);
    });

    act(() => {
      const event3 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event3);
    });

    // Should round to 125
    expect(result.current.bpm).toBe(125);
  });

  it('should clamp BPM between 60 and 200', () => {
    const { result } = renderHook(() => useBpmTap());

    // Test very fast taps (would be > 200 BPM)
    act(() => {
      const event1 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event1);
      vi.advanceTimersByTime(100); // Very fast
    });

    act(() => {
      const event2 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event2);
      vi.advanceTimersByTime(100);
    });

    act(() => {
      const event3 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event3);
    });

    // Should clamp to max 200
    expect(result.current.bpm).toBeLessThanOrEqual(200);
  });

  it('should ignore repeated keydown events', () => {
    const { result } = renderHook(() => useBpmTap());

    const initialBpm = result.current.bpm;

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'Space', repeat: true });
      window.dispatchEvent(event);
    });

    // BPM should not change on repeated events
    expect(result.current.bpm).toBe(initialBpm);
  });

  it('should reset isSettingBpm after timeout', () => {
    const { result } = renderHook(() => useBpmTap());

    // Tap twice to trigger BPM calculation
    act(() => {
      const event1 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event1);
      vi.advanceTimersByTime(500);
    });

    act(() => {
      const event2 = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(event2);
    });

    expect(result.current.isSettingBpm).toBe(true);

    // Fast-forward past the timeout (2 * expected interval + 500ms)
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.isSettingBpm).toBe(false);
  });
});
