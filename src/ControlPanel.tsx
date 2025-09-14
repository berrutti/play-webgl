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
  midiConnected: boolean;
  midiDeviceName: string;
  isPopupMode?: boolean;
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
  // New playlist props
  videoPlaylist: Array<{
    id: string;
    name: string;
    url?: string;
    file?: File;
    isDefault?: boolean;
  }>;
  currentVideoIndex: number;
  isVideoPlaying: boolean;
  onVideoPlayPause: () => void;
  onNextVideo: () => void;
  onPreviousVideo: () => void;
  onAddVideosToPlaylist: (files: File[]) => void;
  onRemoveFromPlaylist: (videoId: string) => void;
  // Timeline props
  onSeek: (time: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  currentTime: number;
  duration: number;
  isSeeking: boolean;
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
  midiConnected,
  midiDeviceName,
  isPopupMode = false,
  onInputSourceChange,
  onIntensityChange,
  onLoopToggle,
  onMuteToggle,
  onPlayToggle,
  onToggleEffect,
  onToggleHelp,
  playingClips,
  showHelp,
  videoPlaylist,
  currentVideoIndex,
  isVideoPlaying,
  onVideoPlayPause,
  onNextVideo,
  onPreviousVideo,
  onAddVideosToPlaylist,
  onRemoveFromPlaylist,
  onSeek,
  onSeekStart,
  onSeekEnd,
  currentTime,
  duration,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('input');

  return (
    <div className={`control-panel ${isPopupMode ? 'popup' : ''}`}>
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
          isMuted={isMuted}
          onMuteToggle={onMuteToggle}
          videoPlaylist={videoPlaylist}
          currentVideoIndex={currentVideoIndex}
          isVideoPlaying={isVideoPlaying}
          onVideoPlayPause={onVideoPlayPause}
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
          onAddVideosToPlaylist={onAddVideosToPlaylist}
          onRemoveFromPlaylist={onRemoveFromPlaylist}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
          onSeekEnd={onSeekEnd}
          currentTime={currentTime}
          duration={duration}
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
          midiConnected={midiConnected}
          midiDeviceName={midiDeviceName}
          isPopupMode={isPopupMode}
        />
      )}
    </div>
  );
};

export default ControlPanel;
