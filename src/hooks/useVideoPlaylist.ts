import { useState, useCallback, useEffect, useMemo, RefObject } from "react";

const VIDEO_LOAD_DELAY_MS = 100;

interface VideoPlaylistItem {
  id: string;
  name: string;
  url?: string;
  file?: File;
  isDefault?: boolean;
}

interface UseVideoPlaylistReturn {
  videoPlaylist: VideoPlaylistItem[];
  selectedVideoIndex: number;
  loadedVideoIndex: number;
  isVideoPlaying: boolean;
  videoPausedManually: boolean;
  currentTime: number;
  duration: number;
  isSeeking: boolean;
  setVideoPlaylist: (playlist: VideoPlaylistItem[]) => void;
  setSelectedVideoIndex: (index: number) => void;
  setLoadedVideoIndex: (index: number) => void;
  setIsVideoPlaying: (playing: boolean) => void;
  handleVideoSelect: (index: number) => void;
  handleVideoPlayPause: () => void;
  handleNextVideo: () => void;
  handlePreviousVideo: () => void;
  handleAddVideosToPlaylist: (files: File[]) => void;
  handleRemoveFromPlaylist: (videoId: string) => void;
  handleSeek: (time: number) => void;
  handleSeekStart: () => void;
  handleSeekEnd: () => void;
}

export const useVideoPlaylist = (
  videoRef: RefObject<HTMLVideoElement | null>,
  inputSource: string,
  setInputSource: (source: string) => void
): UseVideoPlaylistReturn => {
  const [videoPlaylist, setVideoPlaylist] = useState<VideoPlaylistItem[]>([
    {
      id: "big-buck-bunny",
      name: "Big Buck Bunny",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      isDefault: true,
    },
  ]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [loadedVideoIndex, setLoadedVideoIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoPausedManually, setVideoPausedManually] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const handleVideoSelect = useCallback((index: number) => {
    setSelectedVideoIndex(index);
  }, []);

  const handleVideoPlayPause = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || inputSource !== "video") return;

    if (isVideoPlaying) {
      videoElement.pause();
      setIsVideoPlaying(false);
      setVideoPausedManually(true);
    } else {
      if (selectedVideoIndex !== loadedVideoIndex) {
        setLoadedVideoIndex(selectedVideoIndex);
        setVideoPausedManually(false);
        setTimeout(() => {
          const video = videoRef.current;
          if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            video
              .play()
              .then(() => {
                setIsVideoPlaying(true);
              })
              .catch((err) => {
                if (err.name !== "AbortError") {
                  console.error("Error playing video:", err);
                }
              });
          }
        }, VIDEO_LOAD_DELAY_MS);
      } else {
        videoElement
          .play()
          .then(() => {
            setIsVideoPlaying(true);
            setVideoPausedManually(false);
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.error("Error playing video:", err);
            }
          });
      }
    }
  }, [isVideoPlaying, inputSource, selectedVideoIndex, loadedVideoIndex, videoRef]);

  const handleNextVideo = useCallback(() => {
    if (videoPlaylist.length <= 1) return;

    if (isVideoPlaying) {
      const nextIndex = (loadedVideoIndex + 1) % videoPlaylist.length;
      setLoadedVideoIndex(nextIndex);
      setSelectedVideoIndex(nextIndex);

      setTimeout(() => {
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement
            .play()
            .then(() => {
              setIsVideoPlaying(true);
            })
            .catch(console.error);
        }
      }, VIDEO_LOAD_DELAY_MS);
    } else {
      const nextIndex = (selectedVideoIndex + 1) % videoPlaylist.length;
      setSelectedVideoIndex(nextIndex);
    }
  }, [loadedVideoIndex, selectedVideoIndex, videoPlaylist.length, isVideoPlaying, videoRef]);

  const handlePreviousVideo = useCallback(() => {
    if (videoPlaylist.length <= 1) return;

    if (isVideoPlaying) {
      const prevIndex =
        loadedVideoIndex === 0
          ? videoPlaylist.length - 1
          : loadedVideoIndex - 1;
      setLoadedVideoIndex(prevIndex);
      setSelectedVideoIndex(prevIndex);

      setTimeout(() => {
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement
            .play()
            .then(() => {
              setIsVideoPlaying(true);
            })
            .catch(console.error);
        }
      }, VIDEO_LOAD_DELAY_MS);
    } else {
      const prevIndex =
        selectedVideoIndex === 0
          ? videoPlaylist.length - 1
          : selectedVideoIndex - 1;
      setSelectedVideoIndex(prevIndex);
    }
  }, [loadedVideoIndex, selectedVideoIndex, videoPlaylist.length, isVideoPlaying, videoRef]);

  const handleAddVideosToPlaylist = useCallback(
    (files: File[]) => {
      const videoFiles = files.filter((file) => file.type.startsWith("video/"));
      const newVideos = videoFiles.map((file) => ({
        id: `video-${Date.now()}-${Math.random()}`,
        name: file.name,
        file,
      }));

      setVideoPlaylist((prev) => [...prev, ...newVideos]);

      if (
        videoPlaylist.length === 0 &&
        newVideos.length > 0 &&
        !isVideoPlaying
      ) {
        setSelectedVideoIndex(0);
        setLoadedVideoIndex(0);
      }

      if (newVideos.length > 0 && inputSource !== "video") {
        setInputSource("video");
      }
    },
    [videoPlaylist.length, isVideoPlaying, inputSource, setInputSource]
  );

  const handleRemoveFromPlaylist = useCallback(
    (videoId: string) => {
      setVideoPlaylist((prev) => {
        const newPlaylist = prev.filter((video) => video.id !== videoId);

        if (selectedVideoIndex >= newPlaylist.length) {
          setSelectedVideoIndex(Math.max(0, newPlaylist.length - 1));
        }
        if (loadedVideoIndex >= newPlaylist.length) {
          setLoadedVideoIndex(Math.max(0, newPlaylist.length - 1));
        }

        return newPlaylist;
      });
    },
    [selectedVideoIndex, loadedVideoIndex]
  );

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleVideoEnded = () => {
      if (inputSource === "video" && !videoPausedManually) {
        handleNextVideo();
      }
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(videoElement.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setCurrentTime(0);
    };

    const handleDurationChange = () => {
      setDuration(videoElement.duration);
    };

    videoElement.addEventListener("ended", handleVideoEnded);
    videoElement.addEventListener("timeupdate", handleTimeUpdate);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("durationchange", handleDurationChange);

    return () => {
      videoElement.removeEventListener("ended", handleVideoEnded);
      videoElement.removeEventListener("timeupdate", handleTimeUpdate);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("durationchange", handleDurationChange);
    };
  }, [inputSource, videoPausedManually, handleNextVideo, isSeeking, videoRef]);

  const handleSeek = useCallback(
    (time: number) => {
      const videoElement = videoRef.current;
      if (videoElement && inputSource === "video") {
        videoElement.currentTime = time;
        setCurrentTime(time);
      }
    },
    [inputSource, videoRef]
  );

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
  }, []);

  return useMemo(() => ({
    videoPlaylist,
    selectedVideoIndex,
    loadedVideoIndex,
    isVideoPlaying,
    videoPausedManually,
    currentTime,
    duration,
    isSeeking,
    setVideoPlaylist,
    setSelectedVideoIndex,
    setLoadedVideoIndex,
    setIsVideoPlaying,
    handleVideoSelect,
    handleVideoPlayPause,
    handleNextVideo,
    handlePreviousVideo,
    handleAddVideosToPlaylist,
    handleRemoveFromPlaylist,
    handleSeek,
    handleSeekStart,
    handleSeekEnd,
  }), [videoPlaylist, selectedVideoIndex, loadedVideoIndex, isVideoPlaying, videoPausedManually, isSeeking, setVideoPlaylist, setSelectedVideoIndex, setLoadedVideoIndex, setIsVideoPlaying, handleVideoSelect, handleVideoPlayPause, handleNextVideo, handlePreviousVideo, handleAddVideosToPlaylist, handleRemoveFromPlaylist, handleSeek, handleSeekStart, handleSeekEnd]);
};
