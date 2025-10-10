import { useState, useCallback, useRef, useEffect } from "react";

const BPM_TAP_WINDOW_MS = 10000;
const BPM_TAP_MAX_COUNT = 8;
const BPM_MIN = 60;
const BPM_MAX = 200;
const BPM_ROUNDING = 5;
const DEFAULT_BPM = 120;

export const useBpmTap = () => {
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
  const [isSettingBpm, setIsSettingBpm] = useState<boolean>(false);
  const tapTimesRef = useRef<number[]>([]);

  const calculateBpmFromTaps = useCallback((times: number[]): number => {
    if (times.length < 2) return DEFAULT_BPM;

    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }

    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const rawBpm = 60000 / avgInterval;

    return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(rawBpm / BPM_ROUNDING) * BPM_ROUNDING));
  }, []);

  const handleBpmTap = useCallback(() => {
    const now = performance.now();

    const newTimes = [...tapTimesRef.current, now];
    const cutoffTime = now - BPM_TAP_WINDOW_MS;
    const recentTimes = newTimes.filter((time) => time > cutoffTime).slice(-BPM_TAP_MAX_COUNT);

    tapTimesRef.current = recentTimes;

    if (recentTimes.length >= 2) {
      const newBpm = calculateBpmFromTaps(recentTimes);
      setBpm(newBpm);
      setIsSettingBpm(true);

      const expectedInterval = 60000 / newBpm;
      const timeoutDuration = expectedInterval * 2 + 500;

      setTimeout(() => {
        setIsSettingBpm(false);
        tapTimesRef.current = [];
      }, timeoutDuration);
    }
  }, [calculateBpmFromTaps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.code === "Space") {
        event.preventDefault();
        handleBpmTap();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBpmTap]);

  return {
    bpm,
    isSettingBpm,
  };
};
