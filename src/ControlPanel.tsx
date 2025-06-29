import React, { useState } from "react";
import { ShaderEffect } from "./utils";
import { InputTab, ClipsTab, EffectsTab } from "./components";
import "./ControlPanel.css";

interface ControlPanelProps {
  activeEffects: Record<ShaderEffect, boolean>;
  bpm: number;
  effectIntensities: Record<ShaderEffect, number>;
  inputSource: string;
  isSettingBpm: boolean;
  loopClips: Record<string, boolean>;
  isMuted: boolean;
  onInputSourceChange: (newSource: string) => void;
  onFileSelected: (file: File) => void;
  onIntensityChange: (effect: ShaderEffect, intensity: number) => void;
  onLoopToggle: (clipId: string) => void;
  onMuteToggle: () => void;
  onPlayToggle: (clipId: string) => void;
  onToggleEffect: (effect: ShaderEffect) => void;
  onToggleHelp: () => void;
  playingClips: Record<string, boolean>;
  showHelp: boolean;
}

type TabType = 'input' | 'clips' | 'effects';

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeEffects,
  bpm,
  effectIntensities,
  inputSource,
  isSettingBpm,
  loopClips,
  isMuted,
  onInputSourceChange,
  onFileSelected,
  onIntensityChange,
  onLoopToggle,
  onMuteToggle,
  onPlayToggle,
  onToggleEffect,
  onToggleHelp,
  playingClips,
  showHelp,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('input');

  return (
    <div className="control-panel">
      <div className="tab-header">
        <button 
          className={`tab-button ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          Input
        </button>
        <button 
          className={`tab-button ${activeTab === 'clips' ? 'active' : ''}`}
          onClick={() => setActiveTab('clips')}
        >
          Clips
        </button>
        <button 
          className={`tab-button ${activeTab === 'effects' ? 'active' : ''}`}
          onClick={() => setActiveTab('effects')}
        >
          Effects
        </button>
      </div>

      {activeTab === 'input' && (
        <InputTab
          inputSource={inputSource}
          onInputSourceChange={onInputSourceChange}
          onFileSelected={onFileSelected}
          isMuted={isMuted}
          onMuteToggle={onMuteToggle}
          showHelp={showHelp}
          onToggleHelp={onToggleHelp}
        />
      )}

      {activeTab === 'clips' && (
        <ClipsTab
          bpm={bpm}
          isSettingBpm={isSettingBpm}
          loopClips={loopClips}
          onLoopToggle={onLoopToggle}
          onPlayToggle={onPlayToggle}
          playingClips={playingClips}
          showHelp={showHelp}
          onToggleHelp={onToggleHelp}
        />
      )}

      {activeTab === 'effects' && (
        <EffectsTab
          activeEffects={activeEffects}
          effectIntensities={effectIntensities}
          onIntensityChange={onIntensityChange}
          onToggleEffect={onToggleEffect}
          showHelp={showHelp}
          onToggleHelp={onToggleHelp}
        />
      )}
    </div>
  );
};

export default ControlPanel;
