import React from "react";
import { ShaderEffect, clips } from "./utils";
import "./ControlPanel.css";

interface ControlPanelProps {
  inputSource: string;
  onInputSourceChange: (newSource: string) => void;
  selectedClipId: string | null;
  onClipChange: (newClipId: string | null) => void;
  activeEffects: Record<ShaderEffect, boolean>;
  onToggleEffect: (effect: ShaderEffect) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  inputSource,
  onInputSourceChange,
  selectedClipId,
  onClipChange,
  activeEffects,
  onToggleEffect,
}) => {
  return (
    <div className="control-panel">
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
      <div className="control-group">
        <label htmlFor="clipSelect" className="control-label">
          Select Clip:
        </label>
        <select
          id="clipSelect"
          className="control-select"
          value={selectedClipId || ""}
          onChange={(e) => onClipChange(e.target.value || null)}
        >
          <option value="">None</option>
          {clips.map((clip) => (
            <option key={clip.id} value={clip.id}>
              {clip.name}
            </option>
          ))}
        </select>
      </div>
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
