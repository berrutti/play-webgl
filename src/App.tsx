import React, { useEffect, useRef, useState, useCallback } from "react";
import { clips, ShaderEffect, shaderEffects } from "./utils";
import { useWebGLRenderer } from "./hooks/useWebGLRenderer";
import { 
  createInitialTransitions, 
  startTransition, 
  updateTransitions, 
  hasActiveTransitions,
  type EffectTransitions 
} from "./transitions";
import ControlPanel from "./ControlPanel";

const clipKeyBindings: Record<string, string> = {
  q: clips[0].id,
  w: clips[1].id,
  e: clips[2].id,
};

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Key binding handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
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

  // State management
  const initialActiveEffects = Object.values(ShaderEffect).reduce(
    (effects, effect) => {
      effects[effect] = false;
      return effects;
    },
    {} as Record<ShaderEffect, boolean>
  );

  const [activeEffects, setActiveEffects] =
    useState<Record<ShaderEffect, boolean>>(initialActiveEffects);

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
      const userIntensity = effectDef.intensity !== undefined 
        ? effectIntensities[effect] 
        : 1;
        
      return [effect, transition.currentIntensity * userIntensity];
    })
      ) as Record<ShaderEffect, number>;

  const [showPanel, setShowPanel] = useState(false);
  const [inputSource, setInputSource] = useState("webcam");
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

  const [isRecording, setIsRecording] = useState(false);
  const [recordingStart, setRecordingStart] = useState<number>(0);
  const [recordedEvents, setRecordedEvents] = useState<
    { effect: ShaderEffect; on: boolean; time: number }[]
  >([]);

  const [showHelp, setShowHelp] = useState(true);

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

  // Input Source Setup
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    videoElement.crossOrigin = "anonymous";
    if (videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    if (inputSource === "webcam") {
      videoElement.src = "";
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          videoElement.srcObject = stream;
          return videoElement.play();
        })
        .catch();
    } else if (inputSource === "video") {
      videoElement.pause();
      videoElement.srcObject = null;
      videoElement.src =
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      videoElement.loop = true;
      videoElement.load();
      videoElement
        .play()
        .catch((err) => console.error("Error playing video:", err));
    }
  }, [inputSource]);

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
  });

  // UI Handlers
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowPanel((prev) => !prev);
  };

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

    if (isRecording) {
      const nowInSeconds = now / 1000;
      setRecordedEvents((evs) => [
        ...evs,
        { effect, on: nextEffect, time: nowInSeconds - recordingStart },
      ]);
    }
  }, [activeEffects, isRecording, recordingStart]);

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

  const startRecording = () => {
    setPlayingClips(
      (prev) =>
        Object.fromEntries(
          Object.keys(prev).map((clipId) => [clipId, false])
        ) as Record<string, boolean>
    );
    setClipStartTimes({});
    setRecordedEvents([]);
    setRecordingStart(performance.now() / 1000);
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
    const instructions: { effect: ShaderEffect; start: number; end: number }[] =
      [];
    Object.values(ShaderEffect).forEach((eff) => {
      const events = recordedEvents.filter((e) => e.effect === eff);
      let pendingOn: number | null = null;
      events.forEach((e) => {
        if (e.on) {
          pendingOn = e.time;
        } else if (pendingOn !== null) {
          instructions.push({ effect: eff, start: pendingOn, end: e.time });
          pendingOn = null;
        }
      });
      if (pendingOn !== null) {
        instructions.push({
          effect: eff,
          start: pendingOn,
          end: recordedEvents[recordedEvents.length - 1]?.time ?? 0,
        });
      }
    });

    const newClip = {
      id: `${Date.now()}`,
      name: `Recorded ${new Date().toLocaleTimeString()}`,
      instructions,
    };

    console.log("🆕 New clip:", newClip);
  };

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
      {showPanel && (
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
            effectIntensities={effectIntensities}
            inputSource={inputSource}
            isRecording={isRecording}
            loopClips={loopClips}
            onInputSourceChange={handleInputSourceChange}
            onIntensityChange={handleIntensityChange}
            onLoopToggle={handleLoopToggle}
            onPlayToggle={handlePlayToggle}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onToggleEffect={handleCheckboxChange}
            onToggleHelp={() => setShowHelp((prev) => !prev)}
            playingClips={playingClips}
            showHelp={showHelp}
          />
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
          Hint: Right click to show the effects.
        </div>
      )}
    </div>
  );
};

export default App;
