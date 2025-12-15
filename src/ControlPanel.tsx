import React, { useState } from "react";
import { ShaderEffect } from "./utils";
import { InputTab, EffectsTab } from "./components";
import "./ControlPanel.css";

interface ControlPanelProps {
  activeEffects: Record<ShaderEffect, boolean>;
  bpm: number;
  effectIntensities: Record<ShaderEffect, number>;
  inputSource: string;
  isSettingBpm: boolean;
  isMuted: boolean;
  midiConnected: boolean;
  midiDeviceName: string;
  isPopupMode?: boolean;
  onInputSourceChange: (newSource: string) => void;
  onIntensityChange: (effect: ShaderEffect, intensity: number) => void;
  onMuteToggle: () => void;
  onToggleEffect: (effect: ShaderEffect) => void;
  onToggleHelp: () => void;
  showHelp: boolean;
  videoPlaylist: Array<{
    id: string;
    name: string;
    url?: string;
    file?: File;
    isDefault?: boolean;
  }>;
  selectedVideoIndex: number;
  loadedVideoIndex: number;
  isVideoPlaying: boolean;
  onVideoSelect: (index: number) => void;
  onVideoPlayPause: () => void;
  onNextVideo: () => void;
  onPreviousVideo: () => void;
  onAddVideosToPlaylist: (files: File[]) => void;
  onRemoveFromPlaylist: (videoId: string) => void;
  onSeek: (time: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  currentTime: number;
  duration: number;
  isSeeking: boolean;
  onPopOutClick?: () => void;
}

type TabType = 'input' | 'effects';

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeEffects,
  bpm,
  effectIntensities,
  inputSource,
  isSettingBpm,
  isMuted,
  midiConnected,
  midiDeviceName,
  isPopupMode = false,
  onInputSourceChange,
  onIntensityChange,
  onMuteToggle,
  onToggleEffect,
  onToggleHelp,
  showHelp,
  videoPlaylist,
  selectedVideoIndex,
  loadedVideoIndex,
  isVideoPlaying,
  onVideoSelect,
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
  onPopOutClick,
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
          selectedVideoIndex={selectedVideoIndex}
          loadedVideoIndex={loadedVideoIndex}
          isVideoPlaying={isVideoPlaying}
          onVideoSelect={onVideoSelect}
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
          bpm={bpm}
          isSettingBpm={isSettingBpm}
        />
      )}

      {!isPopupMode && onPopOutClick && (
        <div className="pop-out-footer">
          <button
            onClick={onPopOutClick}
            className="pop-out-button"
            title="Open controls in popup window"
          >
            Pop Out Controls
          </button>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
