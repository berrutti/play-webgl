import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { clips, ShaderEffect, shaderEffects } from "./utils";
import { useWebGLRenderer } from "./hooks/useWebGLRenderer";
import {
  createInitialTransitions,
  startTransition,
  updateTransitions,
  hasActiveTransitions,
  type EffectTransitions
} from "./transitions";
import { settingsService } from "./services/settingsService";
import ControlPanel from "./ControlPanel";

const clipKeyBindings: Record<string, string> = {
  q: clips[0].id,
  w: clips[1].id,
  e: clips[2].id,
  r: clips[3].id,
};

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // BPM tapping state
  const [bpm, setBpm] = useState<number>(120); // Default BPM
  const [isSettingBpm, setIsSettingBpm] = useState<boolean>(false);
  const tapTimesRef = useRef<number[]>([]);

  // BPM calculation helpers
  const calculateBpmFromTaps = useCallback((times: number[]): number => {
    if (times.length < 2) return 120;

    // Calculate intervals between taps
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }

    // Average the intervals
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    // Convert to BPM (60000ms = 1 minute)
    const rawBpm = 60000 / avgInterval;

    // Round to nearest 5 for more musical BPMs
    return Math.max(60, Math.min(200, Math.round(rawBpm / 5) * 5));
  }, []);

  const handleBpmTap = useCallback(() => {
    const now = performance.now();

    // Add current tap and keep only recent taps
    const newTimes = [...tapTimesRef.current, now];
    const cutoffTime = now - 10000;
    const recentTimes = newTimes.filter(time => time > cutoffTime).slice(-8);

    tapTimesRef.current = recentTimes;

    // Calculate BPM if we have at least 2 taps
    if (recentTimes.length >= 2) {
      const newBpm = calculateBpmFromTaps(recentTimes);
      setBpm(newBpm);
      setIsSettingBpm(true);

      // Auto-complete BPM setting after 2 beat intervals of inactivity
      const expectedInterval = 60000 / newBpm;
      const timeoutDuration = expectedInterval * 2 + 500; // 2 beats + 500ms buffer

      setTimeout(() => {
        setIsSettingBpm(false);
        tapTimesRef.current = [];
      }, timeoutDuration);
    }
  }, [calculateBpmFromTaps]);

  // Key binding handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      // Handle spacebar for BPM tapping
      if (event.code === 'Space') {
        event.preventDefault();
        handleBpmTap();
        return;
      }

      // Handle clip key bindings
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
  }, [handleBpmTap]);

  // State management with default values
  const initialActiveEffects = Object.values(ShaderEffect).reduce(
    (effects, effect) => {
      effects[effect] = false;
      return effects;
    },
    {} as Record<ShaderEffect, boolean>
  );

  const [activeEffects, setActiveEffects] = useState<Record<ShaderEffect, boolean>>(initialActiveEffects);

  const [effectIntensities, setEffectIntensities] = useState<Record<ShaderEffect, number>>(() => {
    const intensities: Record<ShaderEffect, number> = {} as Record<ShaderEffect, number>;
    Object.values(ShaderEffect).forEach((effect) => {
      const effectDef = shaderEffects[effect];
      if (effectDef.intensity !== undefined) {
        intensities[effect] = effectDef.intensity;
      }
    });
    return intensities;
  });

  // Transition state for smooth effect animations
  const [effectTransitions, setEffectTransitions] = useState<EffectTransitions>(createInitialTransitions);

  // Computed rendering state based on transitions
  const renderingEffects = Object.fromEntries(
    Object.values(ShaderEffect).map(effect => [
      effect,
      effectTransitions[effect].isActive
    ])
  ) as Record<ShaderEffect, boolean>;

  const renderingIntensities = Object.fromEntries(
    Object.values(ShaderEffect).map(effect => {
      const transition = effectTransitions[effect];
      const effectDef = shaderEffects[effect];

      // For effects with intensity controls, use the actual value (including 0)
      // For effects without intensity controls, default to 1
      const hasIntensityControl = effectDef.intensity !== undefined;
      const userIntensity = hasIntensityControl
        ? (effectIntensities[effect] ?? effectDef.intensity)
        : 1;

      return [effect, transition.currentIntensity * userIntensity];
    })
  ) as Record<ShaderEffect, number>;

  const [showPanel, setShowPanel] = useState(false);
  const [inputSource, setInputSource] = useState("webcam");
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null);
  const [playingClips, setPlayingClips] = useState<Record<string, boolean>>(
    () =>
      clips.reduce((acc, clip) => {
        acc[clip.id] = false;
        return acc;
      }, {} as Record<string, boolean>)
  );

  const [loopClips, setLoopClips] = useState<Record<string, boolean>>(() =>
    clips.reduce((acc, clip) => {
      acc[clip.id] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const [clipStartTimes, setClipStartTimes] = useState<Record<string, number>>(
    {}
  );

  const [showHelp, setShowHelp] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  // Popup window reference
  const popupWindowRef = useRef<Window | null>(null);

  // Load settings from localStorage on mount only
  useEffect(() => {
    const savedSettings = settingsService.loadSettings();

    if (savedSettings.showHelp !== undefined) setShowHelp(savedSettings.showHelp);
    if (savedSettings.isMuted !== undefined) setIsMuted(savedSettings.isMuted);
    if (savedSettings.inputSource !== undefined) setInputSource(savedSettings.inputSource);
    if (savedSettings.activeEffects !== undefined) setActiveEffects(savedSettings.activeEffects);
    if (savedSettings.effectIntensities !== undefined) {
      // Merge saved intensities with defaults to handle newly added effects
      setEffectIntensities(prev => {
        const merged = { ...prev };
        Object.entries(savedSettings.effectIntensities!).forEach(([effect, intensity]) => {
          if (intensity !== undefined && !isNaN(intensity)) {
            merged[effect as ShaderEffect] = intensity;
          }
        });
        return merged;
      });
    }
    if (savedSettings.loopClips !== undefined) setLoopClips(savedSettings.loopClips);
    if (savedSettings.bpm !== undefined) setBpm(savedSettings.bpm);
  }, []); // Empty dependency array - only run on mount

  // Save settings when they change (not on initialization)
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Skip saving during initial load
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
    settingsService.saveActiveEffects(activeEffects);
  }, [activeEffects, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveEffectIntensities(effectIntensities);
  }, [effectIntensities, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveLoopClips(loopClips);
  }, [loopClips, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveBpm(bpm);
  }, [bpm, isInitialized]);

  // Apply mute state to video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.muted = isMuted;
    }
  }, [isMuted]);

  // Animation loop for smooth transitions
  useEffect(() => {
    let animationFrameId: number;

    function animate() {
      const now = performance.now();

      setEffectTransitions(currentTransitions => {
        const newTransitions = updateTransitions(currentTransitions, now);

        // Continue animation if there are active transitions
        if (hasActiveTransitions(newTransitions)) {
          animationFrameId = requestAnimationFrame(animate);
        }

        return newTransitions;
      });
    }

    // Start animation loop if there are active transitions
    if (hasActiveTransitions(effectTransitions)) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [effectTransitions]); // Re-run when transitions change

  // FPS tracking loop
  // Performance tracking callback for WebGL renderer
  const handleRenderPerformance = useCallback((renderFps: number, frameTimeMs: number) => {
    setFps(renderFps);
    setFrameTime(frameTimeMs);
  }, []);

  // Input Source Setup
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Clean up previous blob URL if it exists
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      setCurrentBlobUrl(null);
    }

    videoElement.crossOrigin = "anonymous";
    if (videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }

    if (inputSource === "webcam") {
      videoElement.src = "";
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          videoElement.srcObject = stream;
          return videoElement.play();
        })
        .catch(console.error);
    } else if (inputSource === "video") {
      videoElement.pause();

      if (selectedVideoFile) {
        // Use the user-selected video file
        const fileUrl = URL.createObjectURL(selectedVideoFile);
        setCurrentBlobUrl(fileUrl);
        videoElement.src = fileUrl;
      } else {
        // Fallback to Big Buck Bunny if no file is selected
        videoElement.src =
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      }

      videoElement.loop = true;
      videoElement.load();

      // Add a small delay before playing to ensure the video is loaded
      setTimeout(() => {
        videoElement
          .play()
          .catch((err) => {
            // Only log error if it's not an abort error (which is normal when switching videos)
            if (err.name !== 'AbortError') {
              console.error("Error playing video:", err);
            }
          });
      }, 100);
    }
  }, [inputSource, selectedVideoFile]);

  // Cleanup blob URL on component unmount
  useEffect(() => {
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [currentBlobUrl]);

  // UI Handlers
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowPanel((prev) => !prev);
  };

  const handleClipFinished = useCallback((clipId: string) => {
    setPlayingClips((prev) => ({ ...prev, [clipId]: false }));
  }, []);

  // Multi-pass WebGL renderer (using computed rendering state for smooth transitions)
  useWebGLRenderer({
    canvasRef,
    videoRef,
    activeEffects: renderingEffects,
    effectIntensities: renderingIntensities,
    playingClips,
    loopClips,
    clipStartTimes,
    inputSource,
    bpm,
    onClipFinished: handleClipFinished,
    onRenderPerformance: handleRenderPerformance,
  });

  const handleCheckboxChange = useCallback((effect: ShaderEffect) => {
    const nextEffect = !activeEffects[effect];
    const now = performance.now();

    // Update UI state immediately for responsive feel
    setActiveEffects((prev) => ({
      ...prev,
      [effect]: nextEffect,
    }));

    // Start smooth transition
    setEffectTransitions(currentTransitions => {
      const targetIntensity = nextEffect ? 1 : 0;
      return startTransition(currentTransitions, effect, targetIntensity, now);
    });
  }, [activeEffects]);

  const handleIntensityChange = useCallback((effect: ShaderEffect, intensity: number) => {
    setEffectIntensities((prev) => ({
      ...prev,
      [effect]: intensity,
    }));

    // If effect has an active transition, update the target intensity
    setEffectTransitions(currentTransitions => {
      const transition = currentTransitions[effect];
      if (transition.isActive && activeEffects[effect]) {
        return {
          ...currentTransitions,
          [effect]: {
            ...transition,
            targetIntensity: 1, // Always target full intensity for active effects
          }
        };
      }
      return currentTransitions;
    });
  }, [activeEffects]);

  const handlePlayToggle = (clipId: string) => {
    setPlayingClips((prev) => {
      const now = performance.now() / 1000;
      const isNowPlaying = !prev[clipId];
      if (isNowPlaying) {
        setClipStartTimes((times) => ({ ...times, [clipId]: now }));
      }
      return { ...prev, [clipId]: isNowPlaying };
    });
  };

  const handleLoopToggle = (clipId: string) => {
    setLoopClips((prev) => ({ ...prev, [clipId]: !prev[clipId] }));
  };

  const handleInputSourceChange = (newSource: string) => {
    setInputSource(newSource);
  };

  const handleFileSelected = (file: File) => {
    setSelectedVideoFile(file);
  };

  const handleMuteToggle = () => {
    setIsMuted((prev) => !prev);
  };

  // Popup window handlers
  const openPopupWindow = useCallback(() => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.focus();
      return;
    }

    const popup = window.open(
      '',
      'controlPanel',
      'width=400,height=600,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'
    );

    if (popup) {
      popupWindowRef.current = popup;
      setIsPopupOpen(true);

      // Setup popup window
      popup.document.title = 'Trippy Vids Controls';
      popup.document.head.innerHTML = `
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background-color: #f5f5f5;
          }
          * {
            box-sizing: border-box;
          }
          
          /* ControlPanel.css styles */
          .control-panel {
            background-color: white;
            color: black;
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            width: 100%;
            overflow: hidden;
            margin: 20px;
            max-width: calc(100% - 40px);
          }
          
          .tab-header {
            display: flex;
            border-bottom: 1px solid #ddd;
            background-color: #f8f9fa;
          }
          
          .tab-button {
            flex: 1;
            padding: 12px 16px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #666;
            transition: all 0.2s ease;
            border-bottom: 2px solid transparent;
          }
          
          .tab-button:hover {
            background-color: #e9ecef;
            color: #333;
          }
          
          .tab-button.active {
            color: #007bff;
            border-bottom-color: #007bff;
            background-color: white;
          }
          
          .tab-content {
            padding: 20px;
            max-height: calc(100vh - 120px);
            overflow-y: auto;
          }
          
          .control-group {
            margin-bottom: 16px;
          }
          
          .control-label {
            display: block;
            font-weight: 500;
            margin-bottom: 6px;
            color: #333;
          }
          
          .control-select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: white;
            color: #333;
            font-size: 14px;
            cursor: pointer;
          }
          
          .control-select:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          }
          
          .control-checkbox {
            margin-right: 8px;
          }
          
          .checkbox-label {
            font-size: 14px;
            color: #333;
            cursor: pointer;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            transition: color 0.2s ease;
          }
          
          .checkbox-label:hover {
            color: #007bff;
          }
          
          .checkbox-group {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-radius: 4px;
            transition: background-color 0.2s ease;
          }
          
          .checkbox-group:hover {
            background-color: #f8f9fa;
          }
          
          .effect-item {
            margin-bottom: 10px;
          }
          
          .intensity-control {
            margin-top: 5px;
            margin-left: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .intensity-slider {
            flex: 1;
            height: 4px;
            border-radius: 2px;
            background: #ddd;
            outline: none;
            -webkit-appearance: none;
          }
          
          .intensity-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #007bff;
            cursor: pointer;
          }
          
          .intensity-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #007bff;
            cursor: pointer;
            border: none;
          }
          
          .intensity-slider:disabled {
            background: #f0f0f0;
            cursor: not-allowed;
            opacity: 0.6;
          }
          
          .intensity-value {
            font-size: 12px;
            color: #666;
            min-width: 30px;
            text-align: right;
          }
          
          .clips-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .clip-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 4px;
            border: 1px solid #e9ecef;
          }
          
          .clip-name {
            flex: 1;
            font-size: 14px;
            color: #333;
          }
          
          .play-button {
            background: none;
            border: none;
            color: black;
            cursor: pointer;
          }
          
          .control-description {
            font-size: 12px;
            color: #666;
            margin: 5px 0 0 0;
            font-style: italic;
          }
          
          .drop-zone {
            border: 2px dashed #ddd;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
            background-color: #fafafa;
          }
          
          .drop-zone:hover {
            border-color: #007bff;
            background-color: #f0f8ff;
          }
          
          .drop-zone-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          
          .drop-zone-icon {
            font-size: 24px;
            opacity: 0.6;
          }
          
          .drop-zone-text {
            font-weight: 500;
            color: #333;
          }
          
          .drop-zone-subtext {
            font-size: 12px;
            color: #666;
          }
          
          .playback-toolbar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
          }
          
          .mute-button {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background-color: #6c757d;
            color: white;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 40px;
            height: 40px;
          }
          
          .mute-button:hover {
            background-color: #5a6268;
            transform: scale(1.05);
          }
          
          .mute-button.muted {
            background-color: #dc3545;
          }
          
          .playback-status {
            font-size: 14px;
            color: #495057;
            font-weight: 500;
          }
          
          .placeholder-section {
            padding: 16px;
            background-color: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
          }
          
          .popup-header {
            padding: 15px 20px;
            background-color: #007bff;
            color: white;
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .popup-close-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            font-size: 12px;
            cursor: pointer;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: 500;
            transition: background-color 0.2s ease;
          }
          
          .popup-close-btn:hover {
            background: rgba(255, 255, 255, 0.3);
          }
        </style>
      `;
      
      // Create popup structure
      const header = popup.document.createElement('div');
      header.className = 'popup-header';
      header.innerHTML = `
        <span>Trippy Vids Controls</span>
        <button class="popup-close-btn" onclick="window.close()">Close Popup</button>
      `;
      popup.document.body.appendChild(header);
      
      // Create container for React content
      const container = popup.document.createElement('div');
      container.id = 'popup-root';
      popup.document.body.appendChild(container);

      // Handle popup close
      popup.addEventListener('beforeunload', () => {
        setIsPopupOpen(false);
        popupWindowRef.current = null;
      });
    }
  }, []);

  const closePopupWindow = useCallback(() => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.close();
    }
    setIsPopupOpen(false);
    popupWindowRef.current = null;
  }, []);

  // Clean up popup on unmount
  useEffect(() => {
    return () => {
      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        popupWindowRef.current.close();
      }
    };
  }, []);

  // Render control panel in popup window
  const popupControlPanel = useMemo(() => {
    if (!isPopupOpen || !popupWindowRef.current || popupWindowRef.current.closed) {
      return null;
    }
    
    const popupContainer = popupWindowRef.current.document.getElementById('popup-root');
    if (!popupContainer) return null;
    
    return createPortal(
      <ControlPanel
        activeEffects={activeEffects}
        bpm={bpm}
        effectIntensities={effectIntensities}
        inputSource={inputSource}
        isSettingBpm={isSettingBpm}
        loopClips={loopClips}
        isMuted={isMuted}
        onInputSourceChange={handleInputSourceChange}
        onFileSelected={handleFileSelected}
        onIntensityChange={handleIntensityChange}
        onLoopToggle={handleLoopToggle}
        onMuteToggle={handleMuteToggle}
        onPlayToggle={handlePlayToggle}
        onToggleEffect={handleCheckboxChange}
        onToggleHelp={() => setShowHelp(!showHelp)}
        playingClips={playingClips}
        showHelp={showHelp}
      />,
      popupContainer
    );
  }, [
    isPopupOpen,
    activeEffects,
    effectIntensities,
    inputSource,
    isSettingBpm,
    loopClips,
    bpm,
    isMuted,
    playingClips,
    showHelp,
    handleInputSourceChange,
    handleFileSelected,
    handleIntensityChange,
    handleLoopToggle,
    handleMuteToggle,
    handlePlayToggle,
    handleCheckboxChange
  ]);

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
          <ControlPanel
            activeEffects={activeEffects}
            bpm={bpm}
            effectIntensities={effectIntensities}
            inputSource={inputSource}
            isSettingBpm={isSettingBpm}
            loopClips={loopClips}
            isMuted={isMuted}
            onInputSourceChange={handleInputSourceChange}
            onFileSelected={handleFileSelected}
            onIntensityChange={handleIntensityChange}
            onLoopToggle={handleLoopToggle}
            onMuteToggle={handleMuteToggle}
            onPlayToggle={handlePlayToggle}
            onToggleEffect={handleCheckboxChange}
            onToggleHelp={() => setShowHelp((prev) => !prev)}
            playingClips={playingClips}
            showHelp={showHelp}
          />
        </div>
      )}
      
      {showPanel && !isPopupOpen && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "430px",
            zIndex: 10,
          }}
        >
          <button
            onClick={openPopupWindow}
            style={{
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
            title="Open controls in popup window"
          >
            Pop Out Controls
          </button>
        </div>
      )}

      {showHelp && (
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
          <div>Right click to show controls | Spacebar to tap BPM | Q/W/E/R for beat-based clips | "Pop Out Controls" to detach panel</div>
          <div style={{ fontSize: "12px", marginTop: "5px", opacity: 0.8 }}>
            GPU FPS: {fps} | Frame Time: {frameTime.toFixed(2)}ms
          </div>
        </div>
      )}
      
      {popupControlPanel}
    </div>
  );
};

export default App;
