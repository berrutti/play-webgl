import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ShaderEffect, shaderEffects } from "../utils";
import {
  createInitialTransitions,
  startTransition,
  updateTransitions,
  hasActiveTransitions,
  type EffectTransitions
} from "../transitions";
import { settingsService } from "../services/settingsService";

const DEBOUNCE_DELAY_MS = 50;

interface UseEffectTransitionsReturn {
  activeEffects: Record<ShaderEffect, boolean>;
  effectIntensities: Record<ShaderEffect, number>;
  renderingEffects: Record<ShaderEffect, boolean>;
  renderingIntensities: Record<ShaderEffect, number>;
  handleToggleEffect: (effect: ShaderEffect) => void;
  handleIntensityChange: (effect: ShaderEffect, intensity: number) => void;
  setEffectIntensities: React.Dispatch<React.SetStateAction<Record<ShaderEffect, number>>>;
}

export const useEffectTransitions = (
  initialActiveEffects: Record<ShaderEffect, boolean>,
  initialIntensities: Record<ShaderEffect, number>
): UseEffectTransitionsReturn => {
  const [activeEffects, setActiveEffects] = useState<Record<ShaderEffect, boolean>>(() => {
    const savedSettings = settingsService.loadSettings();
    return savedSettings.activeEffects ?? initialActiveEffects;
  });
  const [effectIntensities, setEffectIntensities] = useState<Record<ShaderEffect, number>>(initialIntensities);
  const [effectTransitions, setEffectTransitions] = useState<EffectTransitions>(createInitialTransitions);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastToggleTime = useRef<Record<string, number>>({});

  const renderingEffects: Record<ShaderEffect, boolean> = useMemo(() => Object.fromEntries(
    Object.values(ShaderEffect).map(effect => [
      effect,
      effectTransitions[effect].isActive
    ])
  ) as Record<ShaderEffect, boolean>, [effectTransitions]);

  const renderingIntensities: Record<ShaderEffect, number> = useMemo(() => Object.fromEntries(
    Object.values(ShaderEffect).map(effect => {
      const transition = effectTransitions[effect];
      const effectDef = shaderEffects[effect];

      const hasIntensityControl = effectDef.intensity !== undefined;
      const userIntensity = hasIntensityControl
        ? (effectIntensities[effect] ?? effectDef.intensity)
        : 1;

      return [effect, transition.currentIntensity * userIntensity];
    })
  ) as Record<ShaderEffect, number>, [effectTransitions, effectIntensities]);

  useEffect(() => {
    let animationFrameId: number;

    function animate() {
      const now = performance.now();

      setEffectTransitions((currentTransitions) => {
        const newTransitions = updateTransitions(currentTransitions, now);

        if (hasActiveTransitions(newTransitions)) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          console.log('[useEffectTransitions] Animation loop stopped - no active transitions');
        }

        return newTransitions;
      });
    }

    if (hasActiveTransitions(effectTransitions)) {
      console.log('[useEffectTransitions] Starting animation loop');
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [effectTransitions]);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      return;
    }
    settingsService.saveActiveEffects(activeEffects);
  }, [activeEffects, isInitialized]);

  const handleToggleEffect = useCallback((effect: ShaderEffect) => {
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

  return useMemo(() => ({
    activeEffects,
    effectIntensities,
    renderingEffects,
    renderingIntensities,
    handleIntensityChange,
    handleToggleEffect,
    setEffectIntensities,
  }), [activeEffects, effectIntensities, renderingEffects, renderingIntensities, handleIntensityChange, handleToggleEffect, setEffectIntensities]);
};
