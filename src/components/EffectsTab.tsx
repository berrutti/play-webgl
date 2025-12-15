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
  bpm: number;
  isSettingBpm: boolean;
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
  bpm,
  isSettingBpm,
}) => {
  // Get effects controlled by MIDI knobs
  const getMidiControlledEffects = (): ShaderEffect[] => {
    if (!midiConnected) return [];
    return [
      ShaderEffect.INVERT,
      ShaderEffect.REALITY_GLITCH,
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
    ShaderEffect.REALITY_GLITCH,
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
    ShaderEffect.REALITY_GLITCH,
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

    const handleGridItemClick = (e: React.MouseEvent) => {
      if (isPopupMode) {
        // Only prevent toggle if clicking on interactive elements
        const target = e.target as HTMLElement;
        if (!target.closest('input[type="range"]') && !target.closest('input[type="checkbox"]')) {
          onToggleEffect(effect);
        }
      }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggleEffect(effect);
    };

    const handleGridItemKeyDown = (e: React.KeyboardEvent) => {
      if (isPopupMode && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onToggleEffect(effect);
      }
    };

    return (
      <div
        key={effect}
        className={`effect-item ${isMidiControlled ? 'midi-controlled' : ''} ${isPopupMode ? 'grid-item' : ''}`}
        onClick={handleGridItemClick}
        onKeyDown={handleGridItemKeyDown}
        tabIndex={isPopupMode ? 0 : undefined}
        role={isPopupMode ? 'button' : undefined}
        aria-label={isPopupMode ? `Toggle ${effect} effect` : undefined}
      >
        <div className="checkbox-group" onClick={(e) => { if (isPopupMode) e.stopPropagation(); onToggleEffect(effect); }}>
          <input
            type="checkbox"
            id={`effect-${effect}`}
            className="control-checkbox"
            checked={activeEffects[effect]}
            onChange={handleCheckboxChange}
            tabIndex={isPopupMode ? -1 : undefined}
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
              onClick={(e) => e.stopPropagation()}
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
      <div className="control-group">
        <label className="control-label">
          BPM: {bpm} {isSettingBpm && "🎵"}
        </label>
        <p className="control-description">Press spacebar to tap tempo</p>
      </div>

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