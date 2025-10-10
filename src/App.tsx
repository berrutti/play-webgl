import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { clips, ShaderEffect, shaderEffects } from "./utils";
import { useWebGLRenderer } from "./hooks/useWebGLRenderer";
import {
  createInitialTransitions,
  startTransition,
  updateTransitions,
  hasActiveTransitions,
  type EffectTransitions,
} from "./transitions";
import { settingsService } from "./services/settingsService";
import { useMidi, type MidiConfig } from "./hooks/useMidi";
import ControlPanel from "./ControlPanel";
import packageJson from "../package.json";

const VERSION = packageJson.version;

const DEBOUNCE_DELAY_MS = 50;
const VIDEO_LOAD_DELAY_MS = 100;
const MIDI_NOTIFICATION_DURATION_MS = 5000;
const BPM_TAP_WINDOW_MS = 10000;
const BPM_TAP_MAX_COUNT = 8;
const BPM_MIN = 60;
const BPM_MAX = 200;
const BPM_ROUNDING = 5;

const clipKeyBindings: Record<string, string> = {
  q: clips[0].id,
  w: clips[1].id,
  e: clips[2].id,
  r: clips[3].id,
};

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [bpm, setBpm] = useState<number>(120);
  const [isSettingBpm, setIsSettingBpm] = useState<boolean>(false);
  const tapTimesRef = useRef<number[]>([]);

  const calculateBpmFromTaps = useCallback((times: number[]): number => {
    if (times.length < 2) return 120;

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

  const initialActiveEffects = Object.values(ShaderEffect).reduce(
    (effects, effect) => {
      effects[effect] = false;
      return effects;
    },
    {} as Record<ShaderEffect, boolean>
  );

  const [activeEffects, setActiveEffects] =
    useState<Record<ShaderEffect, boolean>>(initialActiveEffects);

  const [effectIntensities, setEffectIntensities] = useState<
    Record<ShaderEffect, number>
  >(() => {
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
  });

  const [effectTransitions, setEffectTransitions] = useState<EffectTransitions>(
    createInitialTransitions
  );

  const renderingEffects = useMemo(
    () =>
      Object.fromEntries(
        Object.values(ShaderEffect).map((effect) => [
          effect,
          effectTransitions[effect].isActive,
        ])
      ) as Record<ShaderEffect, boolean>,
    [effectTransitions]
  );

  const renderingIntensities = useMemo(
    () =>
      Object.fromEntries(
        Object.values(ShaderEffect).map((effect) => {
          const transition = effectTransitions[effect];
          const effectDef = shaderEffects[effect];

          const hasIntensityControl = effectDef.intensity !== undefined;
          const userIntensity = hasIntensityControl
            ? effectIntensities[effect] ?? effectDef.intensity
            : 1;

          return [effect, transition.currentIntensity * userIntensity];
        })
      ) as Record<ShaderEffect, number>,
    [effectTransitions, effectIntensities]
  );

  const [showPanel, setShowPanel] = useState(false);
  const [inputSource, setInputSource] = useState("webcam");
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null);

  const [videoPlaylist, setVideoPlaylist] = useState<
    Array<{
      id: string;
      name: string;
      url?: string;
      file?: File;
      isDefault?: boolean;
    }>
  >([
    {
      id: "big-buck-bunny",
      name: "Big Buck Bunny",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      isDefault: true,
    },
  ]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [loadedVideoIndex, setLoadedVideoIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoPausedManually, setVideoPausedManually] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

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
  const [showMidiSyncNotification, setShowMidiSyncNotification] =
    useState(false);

  const popupWindowRef = useRef<Window | null>(null);

  const handleRenderPerformance = useCallback(
    (renderFps: number, frameTimeMs: number) => {
      setFps(renderFps);
      setFrameTime(frameTimeMs);
    },
    []
  );

  useEffect(() => {
    const savedSettings = settingsService.loadSettings();

    if (savedSettings.showHelp !== undefined)
      setShowHelp(savedSettings.showHelp);
    if (savedSettings.isMuted !== undefined) setIsMuted(savedSettings.isMuted);
    if (savedSettings.activeEffects !== undefined)
      setActiveEffects(savedSettings.activeEffects);
    if (savedSettings.loopClips !== undefined)
      setLoopClips(savedSettings.loopClips);
    if (savedSettings.bpm !== undefined) setBpm(savedSettings.bpm);
  }, []);

  const [isInitialized, setIsInitialized] = useState(false);

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
    settingsService.saveActiveEffects(activeEffects);
  }, [activeEffects, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveLoopClips(loopClips);
  }, [loopClips, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    settingsService.saveBpm(bpm);
  }, [bpm, isInitialized]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    let animationFrameId: number;

    function animate() {
      const now = performance.now();

      setEffectTransitions((currentTransitions) => {
        const newTransitions = updateTransitions(currentTransitions, now);

        if (hasActiveTransitions(newTransitions)) {
          animationFrameId = requestAnimationFrame(animate);
        }

        return newTransitions;
      });
    }

    if (hasActiveTransitions(effectTransitions)) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [effectTransitions]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

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
      videoElement.pause();
      setIsVideoPlaying(false);

      videoElement.load();
      videoElement.currentTime = 0;

      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          videoElement.srcObject = stream;
          return videoElement.play();
        })
        .catch(console.error);
    } else if (inputSource === "video") {
      const wasOnWebcam = videoElement.srcObject !== null;
      if (wasOnWebcam) {
        videoElement.pause();
        setIsVideoPlaying(false);
      }

      const loadedVideo = videoPlaylist[loadedVideoIndex];
      if (loadedVideo) {
        let newSrc = "";
        if (loadedVideo.file) {
          const fileUrl = URL.createObjectURL(loadedVideo.file);
          setCurrentBlobUrl(fileUrl);
          newSrc = fileUrl;
        } else if (loadedVideo.url) {
          newSrc = loadedVideo.url;
        }

        if (videoElement.src !== newSrc) {
          videoElement.src = newSrc;
          videoElement.loop = false;
          videoElement.load();
        }
      } else {
        videoElement.src = "";
      }
    }
  }, [inputSource, loadedVideoIndex, videoPlaylist]);

  useEffect(() => {
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [currentBlobUrl]);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowPanel((prev) => !prev);
  };

  const handleClipFinished = useCallback((clipId: string) => {
    setPlayingClips((prev) => ({ ...prev, [clipId]: false }));
  }, []);

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

  const lastToggleTime = useRef<Record<string, number>>({});

  const handleCheckboxChange = useCallback((effect: ShaderEffect) => {
    const now = performance.now();

    const lastTime = lastToggleTime.current[effect] || 0;
    if (now - lastTime < DEBOUNCE_DELAY_MS) {
      return;
    }
    lastToggleTime.current[effect] = now;

    setActiveEffects((prev) => {
      const nextEffect = !prev[effect];

      setEffectTransitions((currentTransitions) => {
        const targetIntensity = nextEffect ? 1 : 0;
        const newTransitions = startTransition(
          currentTransitions,
          effect,
          targetIntensity,
          now
        );
        return newTransitions;
      });

      return {
        ...prev,
        [effect]: nextEffect,
      };
    });
  }, []);

  const handleIntensityChange = useCallback(
    (effect: ShaderEffect, intensity: number) => {
      setEffectIntensities((prev) => ({
        ...prev,
        [effect]: intensity,
      }));

      setEffectTransitions((currentTransitions) => {
        const transition = currentTransitions[effect];
        if (transition.isActive && activeEffects[effect]) {
          return {
            ...currentTransitions,
            [effect]: {
              ...transition,
              targetIntensity: 1,
            },
          };
        }
        return currentTransitions;
      });
    },
    [activeEffects]
  );

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

  const handleLoopToggle = useCallback((clipId: string) => {
    setLoopClips((prev) => ({ ...prev, [clipId]: !prev[clipId] }));
  }, []);

  const handleInputSourceChange = useCallback((newSource: string) => {
    setInputSource(newSource);
  }, []);

  const handleVideoSelect = useCallback((index: number) => {
    setSelectedVideoIndex(index);
  }, []);

  const handleVideoPlayPause = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || inputSource !== "video") return;

    if (isVideoPlaying) {
      videoElement.pause();
      setIsVideoPlaying(false);
      setVideoPausedManually(true);
    } else {
      if (selectedVideoIndex !== loadedVideoIndex) {
        setLoadedVideoIndex(selectedVideoIndex);
        setVideoPausedManually(false);
        setTimeout(() => {
          const video = videoRef.current;
          if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            video
              .play()
              .then(() => {
                setIsVideoPlaying(true);
              })
              .catch((err) => {
                if (err.name !== "AbortError") {
                  console.error("Error playing video:", err);
                }
              });
          }
        }, VIDEO_LOAD_DELAY_MS);
      } else {
        videoElement
          .play()
          .then(() => {
            setIsVideoPlaying(true);
            setVideoPausedManually(false);
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.error("Error playing video:", err);
            }
          });
      }
    }
  }, [isVideoPlaying, inputSource, selectedVideoIndex, loadedVideoIndex]);

  const handleNextVideo = useCallback(() => {
    if (videoPlaylist.length <= 1) return;

    if (isVideoPlaying) {
      const nextIndex = (loadedVideoIndex + 1) % videoPlaylist.length;
      setLoadedVideoIndex(nextIndex);
      setSelectedVideoIndex(nextIndex);

      setTimeout(() => {
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement
            .play()
            .then(() => {
              setIsVideoPlaying(true);
            })
            .catch(console.error);
        }
      }, VIDEO_LOAD_DELAY_MS);
    } else {
      const nextIndex = (selectedVideoIndex + 1) % videoPlaylist.length;
      setSelectedVideoIndex(nextIndex);
    }
  }, [
    loadedVideoIndex,
    selectedVideoIndex,
    videoPlaylist.length,
    isVideoPlaying,
  ]);

  const handlePreviousVideo = useCallback(() => {
    if (videoPlaylist.length <= 1) return;

    if (isVideoPlaying) {
      const prevIndex =
        loadedVideoIndex === 0
          ? videoPlaylist.length - 1
          : loadedVideoIndex - 1;
      setLoadedVideoIndex(prevIndex);
      setSelectedVideoIndex(prevIndex);

      setTimeout(() => {
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement
            .play()
            .then(() => {
              setIsVideoPlaying(true);
            })
            .catch(console.error);
        }
      }, VIDEO_LOAD_DELAY_MS);
    } else {
      const prevIndex =
        selectedVideoIndex === 0
          ? videoPlaylist.length - 1
          : selectedVideoIndex - 1;
      setSelectedVideoIndex(prevIndex);
    }
  }, [
    loadedVideoIndex,
    selectedVideoIndex,
    videoPlaylist.length,
    isVideoPlaying,
  ]);

  const handleAddVideosToPlaylist = useCallback(
    (files: File[]) => {
      const videoFiles = files.filter((file) => file.type.startsWith("video/"));
      const newVideos = videoFiles.map((file) => ({
        id: `video-${Date.now()}-${Math.random()}`,
        name: file.name,
        file,
      }));

      setVideoPlaylist((prev) => [...prev, ...newVideos]);

      if (
        videoPlaylist.length === 0 &&
        newVideos.length > 0 &&
        !isVideoPlaying
      ) {
        setSelectedVideoIndex(0);
        setLoadedVideoIndex(0);
      }

      if (newVideos.length > 0 && inputSource !== "video") {
        setInputSource("video");
      }
    },
    [videoPlaylist.length, isVideoPlaying, inputSource]
  );

  const handleRemoveFromPlaylist = useCallback(
    (videoId: string) => {
      setVideoPlaylist((prev) => {
        const newPlaylist = prev.filter((video) => video.id !== videoId);

        if (selectedVideoIndex >= newPlaylist.length) {
          setSelectedVideoIndex(Math.max(0, newPlaylist.length - 1));
        }
        if (loadedVideoIndex >= newPlaylist.length) {
          setLoadedVideoIndex(Math.max(0, newPlaylist.length - 1));
        }

        return newPlaylist;
      });
    },
    [selectedVideoIndex, loadedVideoIndex]
  );

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleVideoEnded = () => {
      if (inputSource === "video" && !videoPausedManually) {
        handleNextVideo();
      }
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(videoElement.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setCurrentTime(0);
    };

    const handleDurationChange = () => {
      setDuration(videoElement.duration);
    };

    videoElement.addEventListener("ended", handleVideoEnded);
    videoElement.addEventListener("timeupdate", handleTimeUpdate);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("durationchange", handleDurationChange);

    return () => {
      videoElement.removeEventListener("ended", handleVideoEnded);
      videoElement.removeEventListener("timeupdate", handleTimeUpdate);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("durationchange", handleDurationChange);
    };
  }, [inputSource, videoPausedManually, handleNextVideo, isSeeking]);

  const handleSeek = useCallback(
    (time: number) => {
      const videoElement = videoRef.current;
      if (videoElement && inputSource === "video") {
        videoElement.currentTime = time;
        setCurrentTime(time);
      }
    },
    [inputSource]
  );

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const midiConfig: MidiConfig = useMemo(
    () => ({
      onEffectToggle: (effect: ShaderEffect) => {
        handleCheckboxChange(effect);
      },
      onIntensityChange: (effect: ShaderEffect, intensity: number) => {
        setEffectIntensities((prev) => ({
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
    [handleCheckboxChange]
  );

  const midi = useMidi(midiConfig);

  const openPopupWindow = useCallback(() => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.focus();
      return;
    }

    const popup = window.open(
      "",
      "controlPanel",
      "width=450,height=700,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no,left=100,top=100"
    );

    if (popup) {
      popupWindowRef.current = popup;
      setIsPopupOpen(true);

      popup.document.title = "Play WebGL Controls";

      const styles = Array.from(document.styleSheets);
      styles.forEach((styleSheet) => {
        try {
          if (styleSheet.href) {
            const link = popup.document.createElement("link");
            link.rel = "stylesheet";
            link.href = styleSheet.href;
            popup.document.head.appendChild(link);
          } else if (styleSheet.cssRules) {
            const style = popup.document.createElement("style");
            const cssText = Array.from(styleSheet.cssRules)
              .map((rule) => rule.cssText)
              .join("\n");
            style.textContent = cssText;
            popup.document.head.appendChild(style);
          }
        } catch {
          // Some stylesheets might not be accessible due to CORS - ignore silently
        }
      });

      const container = popup.document.createElement("div");
      container.id = "popup-root";
      popup.document.body.appendChild(container);

      popup.addEventListener("beforeunload", () => {
        setIsPopupOpen(false);
        popupWindowRef.current = null;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        popupWindowRef.current.close();
      }
    };
  }, []);

  const popupControlPanel = useMemo(() => {
    if (
      !isPopupOpen ||
      !popupWindowRef.current ||
      popupWindowRef.current.closed
    ) {
      return null;
    }

    const popupContainer =
      popupWindowRef.current.document.getElementById("popup-root");
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
        midiConnected={midi.connected}
        midiDeviceName={midi.deviceName}
        isPopupMode={true}
        onInputSourceChange={handleInputSourceChange}
        onIntensityChange={handleIntensityChange}
        onLoopToggle={handleLoopToggle}
        onMuteToggle={handleMuteToggle}
        onPlayToggle={handlePlayToggle}
        onToggleEffect={handleCheckboxChange}
        onToggleHelp={() => setShowHelp(!showHelp)}
        playingClips={playingClips}
        showHelp={showHelp}
        videoPlaylist={videoPlaylist}
        selectedVideoIndex={selectedVideoIndex}
        loadedVideoIndex={loadedVideoIndex}
        isVideoPlaying={isVideoPlaying}
        onVideoSelect={handleVideoSelect}
        onVideoPlayPause={handleVideoPlayPause}
        onNextVideo={handleNextVideo}
        onPreviousVideo={handlePreviousVideo}
        onAddVideosToPlaylist={handleAddVideosToPlaylist}
        onRemoveFromPlaylist={handleRemoveFromPlaylist}
        onSeek={handleSeek}
        onSeekStart={handleSeekStart}
        onSeekEnd={handleSeekEnd}
        currentTime={currentTime}
        duration={duration}
        isSeeking={isSeeking}
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
    midi.connected,
    midi.deviceName,
    playingClips,
    showHelp,
    handleInputSourceChange,
    handleIntensityChange,
    handleLoopToggle,
    handleMuteToggle,
    handlePlayToggle,
    handleCheckboxChange,
    videoPlaylist,
    selectedVideoIndex,
    loadedVideoIndex,
    isVideoPlaying,
    handleVideoSelect,
    handleVideoPlayPause,
    handleNextVideo,
    handlePreviousVideo,
    handleAddVideosToPlaylist,
    handleRemoveFromPlaylist,
    handleSeek,
    handleSeekStart,
    handleSeekEnd,
    currentTime,
    duration,
    isSeeking,
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
            midiConnected={midi.connected}
            midiDeviceName={midi.deviceName}
            onInputSourceChange={handleInputSourceChange}
            onIntensityChange={handleIntensityChange}
            onLoopToggle={handleLoopToggle}
            onMuteToggle={handleMuteToggle}
            onPlayToggle={handlePlayToggle}
            onToggleEffect={handleCheckboxChange}
            onToggleHelp={() => setShowHelp((prev) => !prev)}
            playingClips={playingClips}
            showHelp={showHelp}
            videoPlaylist={videoPlaylist}
            selectedVideoIndex={selectedVideoIndex}
            loadedVideoIndex={loadedVideoIndex}
            isVideoPlaying={isVideoPlaying}
            onVideoSelect={handleVideoSelect}
            onVideoPlayPause={handleVideoPlayPause}
            onNextVideo={handleNextVideo}
            onPreviousVideo={handlePreviousVideo}
            onAddVideosToPlaylist={handleAddVideosToPlaylist}
            onRemoveFromPlaylist={handleRemoveFromPlaylist}
            onSeek={handleSeek}
            onSeekStart={handleSeekStart}
            onSeekEnd={handleSeekEnd}
            currentTime={currentTime}
            duration={duration}
            isSeeking={isSeeking}
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
