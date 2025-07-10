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
  midiDeviceName?: string;
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
  midiDeviceName = '',
  isPopupMode = false,
}) => {
  // Get effects controlled by MIDI knobs
  const getMidiControlledEffects = (): ShaderEffect[] => {
    if (!midiConnected) return [];
    return [
      ShaderEffect.INVERT,
      ShaderEffect.SINE_WAVE,
      ShaderEffect.DISPLACE,
      ShaderEffect.CHROMA,
      ShaderEffect.PIXELATE,
      ShaderEffect.VORONOI,
      ShaderEffect.RIPPLE,
    ];
  };

  const midiControlledEffects = getMidiControlledEffects();

  // Simple array for popup mode: 8 top + 8 bottom = 16 elements
  const popupEffects = [
    // Top row (8 elements)
    ShaderEffect.INVERT,
    ShaderEffect.SINE_WAVE,
    ShaderEffect.DISPLACE,
    ShaderEffect.CHROMA,
    ShaderEffect.PIXELATE,
    ShaderEffect.VORONOI,
    ShaderEffect.RIPPLE,
    null,
    // Bottom row (8 elements)
    ShaderEffect.GRAYSCALE,
    ShaderEffect.KALEIDOSCOPE,
    ShaderEffect.SWIRL,
    null,
    null,
    null,
    null,
    null,
  ];

  // For regular mode - all effects
  const regularEffects = [
    ShaderEffect.INVERT,
    ShaderEffect.SINE_WAVE,
    ShaderEffect.DISPLACE,
    ShaderEffect.CHROMA,
    ShaderEffect.PIXELATE,
    ShaderEffect.VORONOI,
    ShaderEffect.RIPPLE,
    ShaderEffect.GRAYSCALE,
    ShaderEffect.KALEIDOSCOPE,
    ShaderEffect.SWIRL,
  ];

  const renderEffect = (effect: ShaderEffect | null, index: number) => {
    if (effect === null) {
      return <div key={`empty-${index}`} className="effect-item grid-item empty-placeholder"></div>;
    }

    const effectDef = shaderEffects[effect];
    const hasIntensity = effectDef.intensity !== undefined;
    const isMidiControlled = midiControlledEffects.includes(effect);

    return (
      <div key={effect} className={`effect-item ${isMidiControlled ? 'midi-controlled' : ''} ${isPopupMode ? 'grid-item' : ''}`}>
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
          <div className={`intensity-control ${isPopupMode ? 'grid-intensity' : ''}`}>
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
  };

  return (
    <div className="tab-content">
      {midiConnected && (
        <div className="midi-status">
          <div className="control-group">
            <div className="midi-indicator">
              🎹 MIDI Connected: {midiDeviceName}
            </div>
            <p className="control-description">
              🎛️ Knobs 1-7 control intensity • 🟨 Top row pads: toggle + knob control • 🟦 Bottom row pads: toggle only
            </p>
          </div>
        </div>
      )}

      <div className="control-group">
        <div className={isPopupMode ? "effects-grid" : "checkbox-container"}>
          {(isPopupMode ? popupEffects : regularEffects).map((effect, index) => renderEffect(effect, index))}
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