import React from "react";
import { ShaderEffect, shaderEffects } from "../utils";

interface EffectsTabProps {
  activeEffects: Record<ShaderEffect, boolean>;
  effectIntensities: Record<ShaderEffect, number>;
  onIntensityChange: (effect: ShaderEffect, intensity: number) => void;
  onToggleEffect: (effect: ShaderEffect) => void;
  showHelp: boolean;
  onToggleHelp: () => void;
}

export const EffectsTab: React.FC<EffectsTabProps> = ({
  activeEffects,
  effectIntensities,
  onIntensityChange,
  onToggleEffect,
  showHelp,
  onToggleHelp,
}) => {
  return (
    <div className="tab-content">
      <div className="control-group">
        <div className="checkbox-container">
          {Object.values(ShaderEffect).map((effect) => {
            const effectDef = shaderEffects[effect];
            const hasIntensity = effectDef.intensity !== undefined;
            
            return (
              <div key={effect} className="effect-item">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id={`effect-${effect}`}
                    className="control-checkbox"
                    checked={activeEffects[effect]}
                    onChange={() => onToggleEffect(effect)}
                  />
                  <label htmlFor={`effect-${effect}`} className="checkbox-label">
                    {effect.toUpperCase()}
                  </label>
                </div>
                {hasIntensity && (
                  <div className="intensity-control">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectIntensities[effect]}
                      onChange={(e) => onIntensityChange(effect, parseFloat(e.target.value))}
                      className="intensity-slider"
                      disabled={!activeEffects[effect]}
                    />
                    <span className="intensity-value">
                      {Math.round(effectIntensities[effect] * 100)}%
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
            id="showHelp-effects"
            className="control-checkbox"
            checked={showHelp}
            onChange={onToggleHelp}
          />
          <label htmlFor="showHelp-effects" className="checkbox-label">
            Show help overlay
          </label>
        </div>
      </div>
    </div>
  );
}; 