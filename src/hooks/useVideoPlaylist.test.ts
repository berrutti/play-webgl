import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVideoPlaylist } from "./useVideoPlaylist";

describe("useVideoPlaylist", () => {
  let videoElement: HTMLVideoElement;
  let videoRef: React.RefObject<HTMLVideoElement>;
  let mockSetInputSource: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a mock video element
    videoElement = document.createElement("video");

    // Mock video element methods
    videoElement.play = vi.fn().mockResolvedValue(undefined);
    videoElement.pause = vi.fn();

    // Mock properties
    Object.defineProperty(videoElement, "readyState", {
      writable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    Object.defineProperty(videoElement, "currentTime", {
      writable: true,
      value: 0,
    });
    Object.defineProperty(videoElement, "duration", {
      writable: true,
      value: 100,
    });

    videoRef = { current: videoElement };
    mockSetInputSource = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default video playlist", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "webcam", mockSetInputSource)
    );

    expect(result.current.videoPlaylist).toHaveLength(1);
    expect(result.current.videoPlaylist[0].name).toBe("Big Buck Bunny");
    expect(result.current.selectedVideoIndex).toBe(0);
    expect(result.current.loadedVideoIndex).toBe(0);
    expect(result.current.isVideoPlaying).toBe(false);
  });

  it("should select a video", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "webcam", mockSetInputSource)
    );

    act(() => {
      result.current.handleVideoSelect(0);
    });

    expect(result.current.selectedVideoIndex).toBe(0);
  });

  it("should add videos to playlist", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "webcam", mockSetInputSource)
    );

    const mockFile = new File(["video content"], "test.mp4", {
      type: "video/mp4",
    });

    act(() => {
      result.current.handleAddVideosToPlaylist([mockFile]);
    });

    expect(result.current.videoPlaylist).toHaveLength(2);
    expect(result.current.videoPlaylist[1].name).toBe("test.mp4");
    expect(mockSetInputSource).toHaveBeenCalledWith("video");
  });

  it("should filter non-video files when adding to playlist", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "webcam", mockSetInputSource)
    );

    const mockVideoFile = new File(["video"], "test.mp4", {
      type: "video/mp4",
    });
    const mockTextFile = new File(["text"], "test.txt", { type: "text/plain" });

    act(() => {
      result.current.handleAddVideosToPlaylist([mockVideoFile, mockTextFile]);
    });

    expect(result.current.videoPlaylist).toHaveLength(2); // Only video file added
    expect(result.current.videoPlaylist[1].name).toBe("test.mp4");
  });

  it("should remove video from playlist", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "webcam", mockSetInputSource)
    );

    const initialVideoId = result.current.videoPlaylist[0].id;

    act(() => {
      result.current.handleRemoveFromPlaylist(initialVideoId);
    });

    expect(result.current.videoPlaylist).toHaveLength(0);
  });

  it("should adjust selected index when removing video", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "webcam", mockSetInputSource)
    );

    const mockFile1 = new File(["video1"], "test1.mp4", { type: "video/mp4" });
    const mockFile2 = new File(["video2"], "test2.mp4", { type: "video/mp4" });

    act(() => {
      result.current.handleAddVideosToPlaylist([mockFile1, mockFile2]);
    });

    expect(result.current.videoPlaylist).toHaveLength(3);

    act(() => {
      result.current.handleVideoSelect(2);
    });

    expect(result.current.selectedVideoIndex).toBe(2);

    // Remove the selected video
    const videoToRemove = result.current.videoPlaylist[2];
    act(() => {
      result.current.handleRemoveFromPlaylist(videoToRemove.id);
    });

    // Selected index should be adjusted
    expect(result.current.selectedVideoIndex).toBe(1);
  });

  it("should play video when inputSource is video", async () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    await act(async () => {
      result.current.handleVideoPlayPause();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(videoElement.play).toHaveBeenCalled();
  });

  it("should pause video when playing", async () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    // First start playing
    await act(async () => {
      result.current.setIsVideoPlaying(true);
    });

    // Then pause
    await act(async () => {
      result.current.handleVideoPlayPause();
    });

    expect(videoElement.pause).toHaveBeenCalled();
    expect(result.current.isVideoPlaying).toBe(false);
    expect(result.current.videoPausedManually).toBe(true);
  });

  it("should not play/pause when inputSource is not video", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "webcam", mockSetInputSource)
    );

    act(() => {
      result.current.handleVideoPlayPause();
    });

    expect(videoElement.play).not.toHaveBeenCalled();
    expect(videoElement.pause).not.toHaveBeenCalled();
  });

  it("should navigate to next video when playing", async () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    const mockFile = new File(["video"], "test.mp4", { type: "video/mp4" });

    act(() => {
      result.current.handleAddVideosToPlaylist([mockFile]);
    });

    expect(result.current.videoPlaylist).toHaveLength(2);

    act(() => {
      result.current.setIsVideoPlaying(true);
      result.current.setLoadedVideoIndex(0);
    });

    await act(async () => {
      result.current.handleNextVideo();
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.loadedVideoIndex).toBe(1);
    expect(result.current.selectedVideoIndex).toBe(1);
  });

  it("should wrap around to first video when at end", async () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    const mockFile = new File(["video"], "test.mp4", { type: "video/mp4" });

    act(() => {
      result.current.handleAddVideosToPlaylist([mockFile]);
      result.current.setIsVideoPlaying(true);
      result.current.setLoadedVideoIndex(1);
    });

    await act(async () => {
      result.current.handleNextVideo();
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.loadedVideoIndex).toBe(0);
  });

  it("should navigate to previous video when playing", async () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    const mockFile = new File(["video"], "test.mp4", { type: "video/mp4" });

    act(() => {
      result.current.handleAddVideosToPlaylist([mockFile]);
      result.current.setIsVideoPlaying(true);
      result.current.setLoadedVideoIndex(1);
    });

    await act(async () => {
      result.current.handlePreviousVideo();
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.loadedVideoIndex).toBe(0);
  });

  it("should wrap around to last video when at beginning", async () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    const mockFile = new File(["video"], "test.mp4", { type: "video/mp4" });

    act(() => {
      result.current.handleAddVideosToPlaylist([mockFile]);
      result.current.setIsVideoPlaying(true);
      result.current.setLoadedVideoIndex(0);
    });

    await act(async () => {
      result.current.handlePreviousVideo();
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.loadedVideoIndex).toBe(1);
  });

  it("should handle seeking", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    act(() => {
      result.current.handleSeek(50);
    });

    expect(videoElement.currentTime).toBe(50);
    expect(result.current.currentTime).toBe(50);
  });

  it("should handle seek start and end", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    expect(result.current.isSeeking).toBe(false);

    act(() => {
      result.current.handleSeekStart();
    });

    expect(result.current.isSeeking).toBe(true);

    act(() => {
      result.current.handleSeekEnd();
    });

    expect(result.current.isSeeking).toBe(false);
  });

  it("should not navigate when playlist has only one video", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    const initialIndex = result.current.selectedVideoIndex;

    act(() => {
      result.current.handleNextVideo();
    });

    expect(result.current.selectedVideoIndex).toBe(initialIndex);

    act(() => {
      result.current.handlePreviousVideo();
    });

    expect(result.current.selectedVideoIndex).toBe(initialIndex);
  });

  it("should provide setter functions", () => {
    const { result } = renderHook(() =>
      useVideoPlaylist(videoRef, "video", mockSetInputSource)
    );

    expect(typeof result.current.setVideoPlaylist).toBe("function");
    expect(typeof result.current.setSelectedVideoIndex).toBe("function");
    expect(typeof result.current.setLoadedVideoIndex).toBe("function");
    expect(typeof result.current.setIsVideoPlaying).toBe("function");
  });
});
