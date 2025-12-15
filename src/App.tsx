import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { ShaderEffect, shaderEffects } from "./utils";
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

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showPanel, setShowPanel] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  const [showMidiSyncNotification, setShowMidiSyncNotification] =
    useState(false);

  const initialActiveEffects = useMemo(
    () =>
      Object.values(ShaderEffect).reduce((effects, effect) => {
        effects[effect] = false;
        return effects;
      }, {} as Record<ShaderEffect, boolean>),
    []
  );

  const initialIntensities = useMemo(() => {
    const intensities: Record<ShaderEffect, number> = {} as Record<
      ShaderEffect,
      number
    >;
    Object.values(ShaderEffect).forEach((effect) => {
      const effectDef = shaderEffects[effect];
      if (effectDef.intensity !== undefined) {
        intensities[effect] = effectDef.intensity;
      }
    });
    return intensities;
  }, []);

  const { bpm, isSettingBpm } = useBpmTap();

  const settings = useSettings();

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

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowPanel((prev) => !prev);
  };

  // Throttle FPS updates to avoid constant re-renders
  const fpsDataRef = useRef({ fps: 0, frameTime: 0, lastUpdate: 0 });
  const handleRenderPerformance = useCallback(
    (renderFps: number, frameTimeMs: number) => {
      fpsDataRef.current.fps = renderFps;
      fpsDataRef.current.frameTime = frameTimeMs;

      const now = performance.now();
      if (now - fpsDataRef.current.lastUpdate > 500) {
        setFps(renderFps);
        setFrameTime(frameTimeMs);
        fpsDataRef.current.lastUpdate = now;
      }
    },
    []
  );

  useWebGLRenderer({
    canvasRef,
    videoRef,
    activeEffects: effectTransitions.renderingEffects,
    effectIntensities: effectTransitions.renderingIntensities,
    inputSource: settings.inputSource,
    bpm,
    onRenderPerformance: handleRenderPerformance,
  });

  const handleMuteToggle = useCallback(() => {
    settings.setIsMuted((prev: boolean) => !prev);
  }, [settings]);

  const midiConfig: MidiConfig = useMemo(
    () => ({
      onEffectToggle: (effect: ShaderEffect) => {
        effectTransitions.handleToggleEffect(effect);
      },
      onIntensityChange: (effect: ShaderEffect, intensity: number) => {
        effectTransitions.setEffectIntensities(
          (prev: Record<ShaderEffect, number>) => ({
            ...prev,
            [effect]: intensity,
          })
        );
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
        isMuted={settings.isMuted}
        midiConnected={midi.connected}
        midiDeviceName={midi.deviceName}
        isPopupMode={isPopupMode}
        onInputSourceChange={settings.setInputSource}
        onIntensityChange={effectTransitions.handleIntensityChange}
        onMuteToggle={handleMuteToggle}
        onToggleEffect={effectTransitions.handleToggleEffect}
        onToggleHelp={() => settings.setShowHelp((prev: boolean) => !prev)}
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
            Right click to show controls | Spacebar to tap BPM | "Pop Out
            Controls" to detach panel
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
