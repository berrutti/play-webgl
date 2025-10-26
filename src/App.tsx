import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { clips, ShaderEffect, shaderEffects } from "./utils";
import { useWebGLRenderer } from "./hooks/useWebGLRenderer";
import { useMidi, type MidiConfig } from "./hooks/useMidi";
import { useBpmTap } from "./hooks/useBpmTap";
import { useSettings } from "./hooks/useSettings";
import { useEffectTransitions } from "./hooks/useEffectTransitions";
import { useVideoSource } from "./hooks/useVideoSource";
import { useVideoPlaylist } from "./hooks/useVideoPlaylist";
import { usePopupWindow } from "./hooks/usePopupWindow";
import ControlPanel from "./ControlPanel";
import packageJson from "../package.json";

const VERSION = packageJson.version;
const MIDI_NOTIFICATION_DURATION_MS = 5000;

const clipKeyBindings: Record<string, string> = {
  q: clips[0].id,
  w: clips[1].id,
  e: clips[2].id,
  r: clips[3].id,
};

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showPanel, setShowPanel] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  const [showMidiSyncNotification, setShowMidiSyncNotification] = useState(false);

  const [playingClips, setPlayingClips] = useState<Record<string, boolean>>(() =>
    clips.reduce((acc, clip) => {
      acc[clip.id] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const [clipStartTimes, setClipStartTimes] = useState<Record<string, number>>({});

  const initialActiveEffects = useMemo(
    () =>
      Object.values(ShaderEffect).reduce(
        (effects, effect) => {
          effects[effect] = false;
          return effects;
        },
        {} as Record<ShaderEffect, boolean>
      ),
    []
  );

  const initialIntensities = useMemo(() => {
    const intensities: Record<ShaderEffect, number> = {} as Record<ShaderEffect, number>;
    Object.values(ShaderEffect).forEach((effect) => {
      const effectDef = shaderEffects[effect];
      if (effectDef.intensity !== undefined) {
        intensities[effect] = effectDef.intensity;
      }
    });
    return intensities;
  }, []);

  const initialLoopClips = useMemo(
    () =>
      clips.reduce((acc, clip) => {
        acc[clip.id] = false;
        return acc;
      }, {} as Record<string, boolean>),
    []
  );

  const { bpm, isSettingBpm } = useBpmTap();

  const settings = useSettings(initialLoopClips);

  const effectTransitions = useEffectTransitions(
    initialActiveEffects,
    initialIntensities
  );

  const playlist = useVideoPlaylist(
    videoRef,
    settings.inputSource,
    settings.setInputSource
  );

  useVideoSource(
    videoRef,
    settings.inputSource,
    playlist.loadedVideoIndex,
    playlist.videoPlaylist,
    playlist.setIsVideoPlaying
  );

  useEffect(() => {
    settings.setBpm(bpm);
  }, [bpm, settings]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.muted = settings.isMuted;
    }
  }, [settings.isMuted]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.code === "Space") {
        return;
      }

      const clipId = clipKeyBindings[event.key];
      if (!clipId) return;

      setPlayingClips((prev) => {
        const now = performance.now() / 1000;
        const isNowPlaying = !prev[clipId];
        if (isNowPlaying) {
          setClipStartTimes((times) => ({ ...times, [clipId]: now }));
        }
        return { ...prev, [clipId]: isNowPlaying };
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowPanel((prev) => !prev);
  };

  const handleClipFinished = useCallback((clipId: string) => {
    setPlayingClips((prev) => ({ ...prev, [clipId]: false }));
  }, []);

  const handleRenderPerformance = useCallback(
    (renderFps: number, frameTimeMs: number) => {
      setFps(renderFps);
      setFrameTime(frameTimeMs);
    },
    []
  );

  useWebGLRenderer({
    canvasRef,
    videoRef,
    activeEffects: effectTransitions.renderingEffects,
    effectIntensities: effectTransitions.renderingIntensities,
    playingClips,
    loopClips: settings.loopClips,
    clipStartTimes,
    inputSource: settings.inputSource,
    bpm,
    onClipFinished: handleClipFinished,
    onRenderPerformance: handleRenderPerformance,
  });

  const handlePlayToggle = useCallback((clipId: string) => {
    setPlayingClips((prev) => {
      const now = performance.now() / 1000;
      const isNowPlaying = !prev[clipId];
      if (isNowPlaying) {
        setClipStartTimes((times) => ({ ...times, [clipId]: now }));
      }
      return { ...prev, [clipId]: isNowPlaying };
    });
  }, []);

  const handleMuteToggle = useCallback(() => {
    settings.setIsMuted((prev: boolean) => !prev);
  }, [settings]);

  const midiConfig: MidiConfig = useMemo(
    () => ({
      onEffectToggle: (effect: ShaderEffect) => {
        effectTransitions.handleToggleEffect(effect);
      },
      onIntensityChange: (effect: ShaderEffect, intensity: number) => {
        effectTransitions.setEffectIntensities((prev: Record<ShaderEffect, number>) => ({
          ...prev,
          [effect]: intensity,
        }));
      },
      onMidiConnect: () => {
        setShowMidiSyncNotification(true);
        setTimeout(() => {
          setShowMidiSyncNotification(false);
        }, MIDI_NOTIFICATION_DURATION_MS);
      },
    }),
    [effectTransitions]
  );

  const midi = useMidi(midiConfig);

  const renderControlPanel = useCallback(
    (isPopupMode: boolean, openPopupFn?: () => void) => (
      <ControlPanel
        activeEffects={effectTransitions.activeEffects}
        bpm={bpm}
        effectIntensities={effectTransitions.effectIntensities}
        inputSource={settings.inputSource}
        isSettingBpm={isSettingBpm}
        loopClips={settings.loopClips}
        isMuted={settings.isMuted}
        midiConnected={midi.connected}
        midiDeviceName={midi.deviceName}
        isPopupMode={isPopupMode}
        onInputSourceChange={settings.setInputSource}
        onIntensityChange={effectTransitions.handleIntensityChange}
        onLoopToggle={(clipId: string) => {
          settings.setLoopClips((prev: Record<string, boolean>) => ({
            ...prev,
            [clipId]: !prev[clipId]
          }));
        }}
        onMuteToggle={handleMuteToggle}
        onPlayToggle={handlePlayToggle}
        onToggleEffect={effectTransitions.handleToggleEffect}
        onToggleHelp={() => settings.setShowHelp((prev: boolean) => !prev)}
        playingClips={playingClips}
        showHelp={settings.showHelp}
        videoPlaylist={playlist.videoPlaylist}
        selectedVideoIndex={playlist.selectedVideoIndex}
        loadedVideoIndex={playlist.loadedVideoIndex}
        isVideoPlaying={playlist.isVideoPlaying}
        onVideoSelect={playlist.handleVideoSelect}
        onVideoPlayPause={playlist.handleVideoPlayPause}
        onNextVideo={playlist.handleNextVideo}
        onPreviousVideo={playlist.handlePreviousVideo}
        onAddVideosToPlaylist={playlist.handleAddVideosToPlaylist}
        onRemoveFromPlaylist={playlist.handleRemoveFromPlaylist}
        onSeek={playlist.handleSeek}
        onSeekStart={playlist.handleSeekStart}
        onSeekEnd={playlist.handleSeekEnd}
        currentTime={playlist.currentTime}
        duration={playlist.duration}
        isSeeking={playlist.isSeeking}
        onPopOutClick={isPopupMode ? undefined : openPopupFn}
      />
    ),
    [
      effectTransitions,
      bpm,
      isSettingBpm,
      settings,
      midi,
      handleMuteToggle,
      handlePlayToggle,
      playingClips,
      playlist,
    ]
  );

  const { isPopupOpen, openPopupWindow, popupControlPanel } =
    usePopupWindow(renderControlPanel);

  return (
    <div
      onContextMenu={handleContextMenu}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        backgroundColor: "black",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <video
        ref={videoRef}
        style={{ display: "none" }}
        crossOrigin="anonymous"
      />
      {showPanel && !isPopupOpen && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            zIndex: 10,
          }}
        >
          {renderControlPanel(false, openPopupWindow)}
        </div>
      )}

      {settings.showHelp && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            width: "100%",
            textAlign: "center",
            color: "white",
            pointerEvents: "none",
          }}
        >
          <div>
            Right click to show controls | Spacebar to tap BPM | Q/W/E/R for
            beat-based clips | "Pop Out Controls" to detach panel
          </div>
          <div style={{ fontSize: "12px", marginTop: "5px", opacity: 0.8 }}>
            Version: {VERSION} | GPU FPS: {fps} | Frame Time:{" "}
            {frameTime.toFixed(2)}ms
            {midi.connected && (
              <span style={{ color: "#00ff00", marginLeft: "10px" }}>
                🎹 MIDI: {midi.deviceName}
              </span>
            )}
            {!midi.connected && (
              <span style={{ color: "#ff6666", marginLeft: "10px" }}>
                🎹 MIDI: Not connected
              </span>
            )}
          </div>
          {showMidiSyncNotification && (
            <div
              style={{
                fontSize: "14px",
                marginTop: "10px",
                color: "#ffff00",
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                padding: "10px 20px",
                borderRadius: "4px",
                display: "inline-block",
                pointerEvents: "none",
                animation: "fadeIn 0.3s ease-in-out",
              }}
            >
              🎛️ MIDI Connected! Move each knob slightly to sync with current
              positions
            </div>
          )}
        </div>
      )}

      {popupControlPanel}
    </div>
  );
};

export default App;
