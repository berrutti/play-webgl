import React from "react";
import { clips } from "../utils";

interface ClipsTabProps {
  bpm: number;
  isSettingBpm: boolean;
  loopClips: Record<string, boolean>;
  onLoopToggle: (clipId: string) => void;
  onPlayToggle: (clipId: string) => void;
  playingClips: Record<string, boolean>;
  showHelp: boolean;
  onToggleHelp: () => void;
}

export const ClipsTab: React.FC<ClipsTabProps> = ({
  bpm,
  isSettingBpm,
  loopClips,
  onLoopToggle,
  onPlayToggle,
  playingClips,
  showHelp,
  onToggleHelp,
}) => {
  return (
    <div className="tab-content">
      <div className="control-group">
        <label className="control-label">
          BPM: {bpm} {isSettingBpm && "🎵"}
        </label>
        <p className="control-description">Press spacebar to tap tempo</p>
      </div>

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

      <div className="control-group">
        <div className="placeholder-section">
          <label className="control-label">Custom Clips:</label>
          <p className="control-description">Coming soon - create your own clips</p>
        </div>
      </div>

      <div className="control-group">
        <div className="checkbox-group">
          <input
            type="checkbox"
            id="showHelp-clips"
            className="control-checkbox"
            checked={showHelp}
            onChange={onToggleHelp}
          />
          <label htmlFor="showHelp-clips" className="checkbox-label">
            Show help overlay
          </label>
        </div>
      </div>
    </div>
  );
}; 