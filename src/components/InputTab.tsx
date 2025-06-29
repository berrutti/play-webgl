import React, { useState } from "react";

interface InputTabProps {
  inputSource: string;
  onInputSourceChange: (newSource: string) => void;
  onFileSelected: (file: File) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
}

export const InputTab: React.FC<InputTabProps> = ({
  inputSource,
  onInputSourceChange,
  onFileSelected,
  isMuted,
  onMuteToggle,
  showHelp,
  onToggleHelp,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      handleVideoFile(videoFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const videoFile = files[0];
      if (videoFile.type.startsWith('video/')) {
        handleVideoFile(videoFile);
      }
    }
  };

  const handleVideoFile = (file: File) => {
    onInputSourceChange('video');
    onFileSelected(file);
    console.log('Selected video file:', file.name, 'Size:', Math.round(file.size / 1024 / 1024), 'MB');
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="tab-content">
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
        <label className="control-label">Drop Video File:</label>
        <div 
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
        >
          <div className="drop-zone-content">
            <div className="drop-zone-icon">📁</div>
            <div className="drop-zone-text">Drag & drop video files here</div>
            <div className="drop-zone-subtext">or click to browse</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">Playback Controls:</label>
        <div className="playback-toolbar">
          <button 
            className={`mute-button ${isMuted ? 'muted' : ''}`}
            onClick={onMuteToggle}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <span className="playback-status">
            {isMuted ? 'Audio muted' : 'Audio enabled'}
          </span>
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
            Show help overlay
          </label>
        </div>
      </div>
    </div>
  );
}; 