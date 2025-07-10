import React from "react";
import { ShaderEffect, shaderEffects } from "../utils";

interface EffectsTabProps {
  activeEffects: Record<ShaderEffect, boolean>;
  effectIntensities: Record<ShaderEffect, number>;
  onIntensityChange: (effect: ShaderEffect, intensity: number) => void;
  onToggleEffect: (effect: ShaderEffect) => void;
  showHelp: boolean;
  onToggleHelp: () => void;
  midiConnected?: boolean;
  isPopupMode?: boolean;
}

export const EffectsTab: React.FC<EffectsTabProps> = ({
  activeEffects,
  effectIntensities,
  onIntensityChange,
  onToggleEffect,
  showHelp,
  onToggleHelp,
  midiConnected = false,
  isPopupMode = false,
}) => {
  // Get effects controlled by MIDI knobs (top row pads 40-43, 48-50)
  const getMidiControlledEffects = (): ShaderEffect[] => {
    if (!midiConnected) return [];

    // These are the effects mapped to the top row pads (40-43, 48-50)
    // which are controlled by knobs 1-7
    return [
      ShaderEffect.INVERT,     // Pad 40, Knob 1
      ShaderEffect.SINE_WAVE,  // Pad 41, Knob 2
      ShaderEffect.DISPLACE,   // Pad 42, Knob 3
      ShaderEffect.CHROMA,     // Pad 43, Knob 4
      ShaderEffect.PIXELATE,   // Pad 48, Knob 5
      ShaderEffect.VORONOI,    // Pad 49, Knob 6
      ShaderEffect.RIPPLE,     // Pad 50, Knob 7
    ];
  };

  const midiControlledEffects = getMidiControlledEffects();

  // Order effects according to PADS mapping from useMidi.ts
  const getEffectsInPadOrder = (): ShaderEffect[] => {
    // Top row (knob-controlled effects) - pads 40-43, 48-51
    const topRowEffects = [
      ShaderEffect.INVERT,     // Pad 40
      ShaderEffect.SINE_WAVE,  // Pad 41
      ShaderEffect.DISPLACE,   // Pad 42
      ShaderEffect.CHROMA,     // Pad 43
      ShaderEffect.PIXELATE,   // Pad 48
      ShaderEffect.VORONOI,    // Pad 49
      ShaderEffect.RIPPLE,     // Pad 50
    ];

    // Bottom row (toggle-only effects) - pads 36-39, 44-47
    const bottomRowEffects = [
      ShaderEffect.GRAYSCALE,    // Pad 36
      ShaderEffect.KALEIDOSCOPE, // Pad 37
      ShaderEffect.SWIRL,        // Pad 38
    ];

    // Add any remaining effects not in the PADS mapping
    const remainingEffects = Object.values(ShaderEffect).filter(
      effect => !topRowEffects.includes(effect) && !bottomRowEffects.includes(effect)
    );

    return [...topRowEffects, ...bottomRowEffects, ...remainingEffects];
  };

  const orderedEffects = getEffectsInPadOrder();

  return (
    <div className="tab-content">
      {midiConnected && (
        <div className="midi-status">
          <div className="control-group">
            <div className="midi-indicator">
              🎹 MIDI Connected
            </div>
          </div>
        </div>
      )}

      <div className="control-group">
        <div className={isPopupMode ? "checkbox-container" : "effects-grid"}>
          {orderedEffects.map((effect) => {
            const effectDef = shaderEffects[effect];
            const hasIntensity = effectDef.intensity !== undefined;
            const isMidiControlled = midiControlledEffects.includes(effect);

            return (
              <div key={effect} className={`effect-item ${isMidiControlled ? 'midi-controlled' : ''} ${isPopupMode ? '' : 'grid-item'}`}>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id={`effect-${effect}`}
                    className="control-checkbox"
                    checked={activeEffects[effect]}
                    onChange={() => onToggleEffect(effect)}
                  />
                  <label htmlFor={`effect-${effect}`} className="checkbox-label">
                    {isPopupMode ? effect.toUpperCase() : effect.charAt(0).toUpperCase() + effect.slice(1).toLowerCase()}
                    {isMidiControlled && <span className="midi-badge">🎛️</span>}
                  </label>
                </div>
                {hasIntensity && (
                  <div className={`intensity-control ${isPopupMode ? '' : 'grid-intensity'}`}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectIntensities[effect]}
                      onChange={(e) => onIntensityChange(effect, parseFloat(e.target.value))}
                      className={`intensity-slider ${isMidiControlled ? 'midi-controlled' : ''}`}
                      disabled={!activeEffects[effect] || (midiConnected && isMidiControlled)}
                      title={
                        midiConnected && isMidiControlled 
                          ? 'This effect intensity is controlled by MIDI knobs - mouse control disabled' 
                          : !activeEffects[effect] 
                            ? 'Enable effect to adjust intensity'
                            : ''
                      }
                    />
                    <span className="intensity-value">
                      {Math.round(effectIntensities[effect] * 100)}%
                      {midiConnected && isMidiControlled && <span style={{color: '#666', fontSize: '10px'}}> 🎛️</span>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="control-group">
        <div className="checkbox-group">
          <input
            type="checkbox"
            id="show-help"
            className="control-checkbox"
            checked={showHelp}
            onChange={onToggleHelp}
          />
          <label htmlFor="show-help" className="checkbox-label">
            Show help
          </label>
        </div>
      </div>
    </div>
  );
}; 