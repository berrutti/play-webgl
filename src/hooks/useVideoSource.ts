import { useEffect, useRef, RefObject } from "react";

interface VideoPlaylistItem {
  id: string;
  name: string;
  url?: string;
  file?: File;
  isDefault?: boolean;
}

export const useVideoSource = (
  videoRef: RefObject<HTMLVideoElement | null>,
  inputSource: string,
  loadedVideoIndex: number,
  videoPlaylist: VideoPlaylistItem[],
  setIsVideoPlaying: (playing: boolean) => void
): void => {
  const currentBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }

    videoElement.crossOrigin = "anonymous";
    if (videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }

    if (inputSource === "webcam") {
      videoElement.src = "";
      videoElement.pause();
      setIsVideoPlaying(false);

      videoElement.load();
      videoElement.currentTime = 0;

      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          videoElement.srcObject = stream;
          return videoElement.play();
        })
        .catch(console.error);
    } else if (inputSource === "video") {
      const wasOnWebcam = videoElement.srcObject !== null;
      if (wasOnWebcam) {
        videoElement.pause();
        setIsVideoPlaying(false);
      }

      const loadedVideo = videoPlaylist[loadedVideoIndex];
      if (loadedVideo) {
        let newSrc = "";
        if (loadedVideo.file) {
          const fileUrl = URL.createObjectURL(loadedVideo.file);
          currentBlobUrl.current = fileUrl;
          newSrc = fileUrl;
        } else if (loadedVideo.url) {
          newSrc = loadedVideo.url;
        }

        if (videoElement.src !== newSrc) {
          videoElement.src = newSrc;
          videoElement.loop = false;
          videoElement.load();
        }
      } else {
        videoElement.src = "";
      }
    }
  }, [inputSource, loadedVideoIndex, videoPlaylist, videoRef, setIsVideoPlaying]);

  useEffect(() => {
    return () => {
      if (currentBlobUrl.current) {
        URL.revokeObjectURL(currentBlobUrl.current);
      }
    };
  }, []);
};
