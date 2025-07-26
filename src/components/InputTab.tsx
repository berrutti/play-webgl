import React, { useState } from "react";

interface InputTabProps {
  inputSource: string;
  onInputSourceChange: (source: string) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
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
  onSeek: (time: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  currentTime: number;
  duration: number;
}

export const InputTab: React.FC<InputTabProps> = ({
  inputSource,
  onInputSourceChange,
  isMuted,
  onMuteToggle,
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
    const videoFiles = files.filter(file => file.type.startsWith('video/'));

    if (videoFiles.length > 0) {
      onAddVideosToPlaylist(videoFiles);
      console.log(`Added ${videoFiles.length} video(s) to playlist`);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        onAddVideosToPlaylist(videoFiles);
      }
    }
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  // Timeline seeking handlers
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * duration;
      onSeek(newTime);
    }
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    onSeekStart();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).closest('.timeline-track')?.getBoundingClientRect();
      if (rect && duration > 0) {
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = percentage * duration;
        onSeek(newTime);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onSeekEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTimelineMouseUp = () => {
    onSeekEnd();
  };

  // Format time helper
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage for timeline display
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const currentVideo = videoPlaylist[currentVideoIndex];

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
          <option value="video">Video Playlist</option>
        </select>
      </div>

      {inputSource === "video" && (
        <div className="video-player-container">
          {/* Current Video Info */}
          {currentVideo && (
            <div className="current-video-display">
              <div className="video-title">{currentVideo.name}</div>
              <div className="video-position">{currentVideoIndex + 1} of {videoPlaylist.length}</div>
            </div>
          )}

          {/* Video Controls Bar */}
          <div className="video-controls-bar">
            <div className="transport-controls">
              <button
                className="control-btn"
                onClick={onPreviousVideo}
                disabled={videoPlaylist.length <= 1}
                title="Previous video"
              >
                ⏮
              </button>
              <button
                className="control-btn play-btn"
                onClick={onVideoPlayPause}
                disabled={videoPlaylist.length === 0}
                title={isVideoPlaying ? 'Pause' : 'Play'}
              >
                {isVideoPlaying ? '⏸' : '▶'}
              </button>
              <button
                className="control-btn"
                onClick={onNextVideo}
                disabled={videoPlaylist.length <= 1}
                title="Next video"
              >
                ⏭
              </button>
            </div>


            {/* Audio Controls */}
            <div className="audio-controls">
              <button
                className={`control-btn ${isMuted ? 'muted' : ''}`}
                onClick={onMuteToggle}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? 'MUTE' : 'VOL'}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="timeline-container">
            <span className="time-display">{formatTime(currentTime)}</span>
            <div
              className="timeline-track"
              onMouseDown={handleTimelineMouseDown}
              onMouseUp={handleTimelineMouseUp}
              onClick={handleTimelineClick}
            >
              <div className="timeline-background"></div>
              <div
                className="timeline-progress"
                style={{ width: `${progressPercentage}%` }}
              ></div>
              <div
                className="timeline-handle"
                style={{ left: `${progressPercentage}%` }}
              ></div>
            </div>
            <span className="time-display">{formatTime(duration)}</span>
          </div>

          {/* Playlist */}
          <div className="playlist-section">
            <div className="playlist-header">
              <span>Playlist ({videoPlaylist.length})</span>
              <div
                className={`add-videos-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleDropZoneClick}
              >
                <span>+ Add Videos</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div className="playlist-items">
              {videoPlaylist.map((video, index) => (
                <div
                  key={video.id}
                  className={`playlist-row ${index === currentVideoIndex ? 'current' : ''}`}
                >
                  <div className="playlist-number">{index + 1}</div>
                  <div className="playlist-info">
                    <div className="playlist-name">{video.name}</div>
                    {index === currentVideoIndex && (
                      <div className="playlist-status">
                        {isVideoPlaying ? 'Playing' : 'Paused'}
                      </div>
                    )}
                  </div>
                  {!video.isDefault && (
                    <button
                      className="remove-btn"
                      onClick={() => onRemoveFromPlaylist(video.id)}
                      title="Remove from playlist"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {videoPlaylist.length === 0 && (
                <div className="playlist-empty">
                  No videos in playlist
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {inputSource === "webcam" && (
        <div className="webcam-controls">
          <div className="control-group">
            <label className="control-label">Webcam Audio:</label>
            <button
              className={`control-btn ${isMuted ? 'muted' : ''}`}
              onClick={onMuteToggle}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? 'MUTED' : 'ENABLED'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 