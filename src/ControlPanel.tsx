import React from "react";
import { clips, ShaderEffect } from "./utils";
import "./ControlPanel.css";

interface ControlPanelProps {
  activeEffects: Record<ShaderEffect, boolean>;
  inputSource: string;
  isRecording: boolean;
  loopClips: Record<string, boolean>;
  onInputSourceChange: (newSource: string) => void;
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
  inputSource,
  isRecording,
  loopClips,
  onInputSourceChange,
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
