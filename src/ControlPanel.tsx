import React from "react";
import { clips, ShaderEffect } from "./utils";
import "./ControlPanel.css";

interface ControlPanelProps {
  inputSource: string;
  onInputSourceChange: (newSource: string) => void;
  playingClips: Record<string, boolean>;
  loopClips: Record<string, boolean>;
  onPlayToggle: (clipId: string) => void;
  onLoopToggle: (clipId: string) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  activeEffects: Record<ShaderEffect, boolean>;
  onToggleEffect: (effect: ShaderEffect) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  inputSource,
  onInputSourceChange,
  playingClips,
  loopClips,
  onPlayToggle,
  onLoopToggle,
  isRecording,
  onStartRecording,
  onStopRecording,
  activeEffects,
  onToggleEffect,
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
          {Object.values(ShaderEffect).map((effect) => (
            <div key={effect} className="checkbox-group">
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
