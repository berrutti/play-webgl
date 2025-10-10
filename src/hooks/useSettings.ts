import React, { useState, useEffect } from "react";
import { settingsService } from "../services/settingsService";

interface UseSettingsReturn {
  showHelp: boolean;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  inputSource: string;
  setInputSource: React.Dispatch<React.SetStateAction<string>>;
  loopClips: Record<string, boolean>;
  setLoopClips: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  bpm: number;
  setBpm: React.Dispatch<React.SetStateAction<number>>;
}

export const useSettings = (
  initialLoopClips: Record<string, boolean>
): UseSettingsReturn => {
  const [showHelp, setShowHelp] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [inputSource, setInputSource] = useState("webcam");
  const [loopClips, setLoopClips] = useState<Record<string, boolean>>(initialLoopClips);
  const [bpm, setBpm] = useState<number>(120);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedSettings = settingsService.loadSettings();

    if (savedSettings.showHelp !== undefined) setShowHelp(savedSettings.showHelp);
    if (savedSettings.isMuted !== undefined) setIsMuted(savedSettings.isMuted);
    if (savedSettings.loopClips !== undefined) setLoopClips(savedSettings.loopClips);
    if (savedSettings.bpm !== undefined) setBpm(savedSettings.bpm);
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      return;
    }
    settingsService.saveShowHelp(showHelp);
  }, [showHelp, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveMuted(isMuted);
  }, [isMuted, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveInputSource(inputSource);
  }, [inputSource, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveLoopClips(loopClips);
  }, [loopClips, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveBpm(bpm);
  }, [bpm, isInitialized]);

  return {
    bpm,
    inputSource,
    isMuted,
    loopClips,
    showHelp,
    setBpm,
    setInputSource,
    setIsMuted,
    setLoopClips,
    setShowHelp,
  };
};
