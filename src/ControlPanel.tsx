import React from "react";
import { clips, ShaderEffect, shaderEffects } from "./utils";
import "./ControlPanel.css";

interface ControlPanelProps {
  activeEffects: Record<ShaderEffect, boolean>;
  bpm: number;
  effectIntensities: Record<ShaderEffect, number>;
  inputSource: string;
  isRecording: boolean;
  isSettingBpm: boolean;
  loopClips: Record<string, boolean>;
  onInputSourceChange: (newSource: string) => void;
  onIntensityChange: (effect: ShaderEffect, intensity: number) => void;
  onLoopToggle: (clipId: string) => void;
  onPlayToggle: (clipId: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleEffect: (effect: ShaderEffect) => void;
  onToggleHelp: () => void;
  playingClips: Record<string, boolean>;
  showHelp: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeEffects,
  bpm,
  effectIntensities,
  inputSource,
  isRecording,
  isSettingBpm,
  loopClips,
  onInputSourceChange,
  onIntensityChange,
  onLoopToggle,
  onPlayToggle,
  onStartRecording,
  onStopRecording,
  onToggleEffect,
  onToggleHelp,
  playingClips,
  showHelp,
}) => {
  return (
    <div className="control-panel">
      {/* Input Source */}
      <div className="control-group">
        <label htmlFor="inputSource" className="control-label">
          Input Source:
        </label>
        <select
          id="inputSource"
          className="control-select"
          value={inputSource}
          onChange={(e) => onInputSourceChange(e.target.value)}
        >
          <option value="webcam">Webcam</option>
          <option value="video">Video File</option>
        </select>
      </div>

      {/* BPM */}
      <div className="control-group">
        <label className="control-label">
          BPM: {bpm} {isSettingBpm && "🎵"}
        </label>
        <p className="control-description">Press spacebar to tap tempo</p>
      </div>

      {/* Clips */}
      <div className="control-group">
        <label className="control-label">Clips:</label>
        <div className="clips-container">
          {clips.map((clip) => (
            <div key={clip.id} className="clip-item">
              <button
                type="button"
                className="play-button"
                onClick={() => onPlayToggle(clip.id)}
              >
                {playingClips[clip.id] ? "⏹" : "▶"}
              </button>
              <span className="clip-name">{clip.name}</span>
              <input
                type="checkbox"
                id={`loop-${clip.id}`}
                className="control-checkbox"
                checked={loopClips[clip.id]}
                onChange={() => onLoopToggle(clip.id)}
              />
              <label htmlFor={`loop-${clip.id}`} className="checkbox-label">
                Loop
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Recording Mode */}
      <div className="control-group">
        {!isRecording ? (
          <button className="record-button" onClick={onStartRecording}>
            ▶ Record
          </button>
        ) : (
          <button className="record-button recording" onClick={onStopRecording}>
            ⏹ Stop
          </button>
        )}
      </div>

      {/* Effects */}
      <div className="control-group">
        <label className="control-label">Effects:</label>
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
            id="showHelp"
            className="control-checkbox"
            checked={showHelp}
            onChange={onToggleHelp}
          />
          <label htmlFor="showHelp" className="checkbox-label">
            Show help
          </label>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
