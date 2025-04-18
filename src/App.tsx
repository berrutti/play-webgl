import React, { useEffect, useRef, useState } from "react";
import {
  clips,
  getTextureCoordinates,
  ShaderEffect,
  shaderEffects,
} from "./utils";
import ControlPanel from "./ControlPanel";

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  source: string,
  type: number
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const errMsg = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Error compiling shader: " + errMsg);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program.");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const errMsg = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("Error linking program: " + errMsg);
  }
  return program;
}

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const initialActiveEffects = Object.values(ShaderEffect).reduce(
    (effects, effect) => {
      effects[effect] = false;
      return effects;
    },
    {} as Record<ShaderEffect, boolean>
  );

  const [activeEffects, setActiveEffects] =
    useState<Record<ShaderEffect, boolean>>(initialActiveEffects);

  const [showPanel, setShowPanel] = useState(false);
  const [inputSource, setInputSource] = useState("webcam");
  const [playingClips, setPlayingClips] = useState<Record<string, boolean>>(
    () =>
      clips.reduce((acc, clip) => {
        acc[clip.id] = false;
        return acc;
      }, {} as Record<string, boolean>)
  );

  const [loopClips, setLoopClips] = useState<Record<string, boolean>>(() =>
    clips.reduce((acc, clip) => {
      acc[clip.id] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const [clipStartTimes, setClipStartTimes] = useState<Record<string, number>>(
    {}
  );

  // Input Source Setup
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    videoElement.crossOrigin = "anonymous";
    if (videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    if (inputSource === "webcam") {
      videoElement.src = "";
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          videoElement.srcObject = stream;
          return videoElement.play();
        })
        .catch();
    } else if (inputSource === "video") {
      videoElement.pause();
      videoElement.srcObject = null;
      videoElement.src =
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      videoElement.loop = true;
      videoElement.load();
      videoElement
        .play()
        .catch((err) => console.error("Error playing video:", err));
    }
  }, [inputSource]);

  // WebGL Setup & Rendering
  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const webGLContext = canvasElement.getContext("webgl");
    if (!webGLContext) {
      console.error("WebGL not supported.");
      return;
    }

    // 1) Full‑screen quad buffer
    const quadPositions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const positionBuffer = webGLContext.createBuffer()!;
    webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, positionBuffer);
    webGLContext.bufferData(
      webGLContext.ARRAY_BUFFER,
      quadPositions,
      webGLContext.STATIC_DRAW
    );

    const textureCoordinateBuffer = webGLContext.createBuffer()!;

    function updateBuffers() {
      if (!canvasElement || !webGLContext || !videoElement) return;
      canvasElement.width = window.innerWidth;
      canvasElement.height = window.innerHeight;
      webGLContext.viewport(0, 0, canvasElement.width, canvasElement.height);

      const videoWidth = videoElement.videoWidth || 640;
      const videoHeight = videoElement.videoHeight || 480;
      const textureCoordinates = getTextureCoordinates(
        videoWidth,
        videoHeight,
        canvasElement.width,
        canvasElement.height
      );
      webGLContext.bindBuffer(
        webGLContext.ARRAY_BUFFER,
        textureCoordinateBuffer
      );
      webGLContext.bufferData(
        webGLContext.ARRAY_BUFFER,
        textureCoordinates,
        webGLContext.STATIC_DRAW
      );
    }
    updateBuffers();
    window.addEventListener("resize", updateBuffers);
    videoElement.addEventListener("loadedmetadata", updateBuffers);

    // 2) Build fragment shader source (same as before)
    let fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_time;
    ${Object.entries(playingClips)
      .map(([clipId, isPlaying]) =>
        isPlaying ? `uniform float u_clipTime_${clipId};` : ``
      )
      .join("\n")}
    varying vec2 v_texCoord;
    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
          ${Object.entries(playingClips)
            .filter(([, play]) => play)
            .map(([clipId]) => {
              const clip = clips.find((c) => c.id === clipId)!;
              return clip.instructions
                .map(
                  (inst) => `
        if (u_clipTime_${clipId} >= ${inst.start.toFixed(1)} && 
            u_clipTime_${clipId} <= ${inst.end.toFixed(1)}) {
          ${shaderEffects[inst.effect].glsl}
        }
      `
                )
                .join("\n");
            })
            .join("\n")}
  `;
    Object.entries(activeEffects).forEach(([effect, isActive]) => {
      if (isActive) {
        fragmentShaderSource += shaderEffects[effect as ShaderEffect].glsl;
      }
    });
    fragmentShaderSource += `
      gl_FragColor = color;
    }
  `;

    // 3) Compile & link
    const vertexShader = compileShader(
      webGLContext,
      vertexShaderSource,
      webGLContext.VERTEX_SHADER
    );
    const fragmentShader = compileShader(
      webGLContext,
      fragmentShaderSource,
      webGLContext.FRAGMENT_SHADER
    );
    const shaderProgram = createProgram(
      webGLContext,
      vertexShader,
      fragmentShader
    );
    webGLContext.useProgram(shaderProgram);

    // 4) Attributes
    const positionAttributeLocation = webGLContext.getAttribLocation(
      shaderProgram,
      "a_position"
    );
    webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, positionBuffer);
    webGLContext.enableVertexAttribArray(positionAttributeLocation);
    webGLContext.vertexAttribPointer(
      positionAttributeLocation,
      2,
      webGLContext.FLOAT,
      false,
      0,
      0
    );

    const texCoordAttributeLocation = webGLContext.getAttribLocation(
      shaderProgram,
      "a_texCoord"
    );
    webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, textureCoordinateBuffer);
    webGLContext.enableVertexAttribArray(texCoordAttributeLocation);
    webGLContext.vertexAttribPointer(
      texCoordAttributeLocation,
      2,
      webGLContext.FLOAT,
      false,
      0,
      0
    );

    // 5) Uniform locations
    const timeUniformLocation = webGLContext.getUniformLocation(
      shaderProgram,
      "u_time"
    );

    // one u_clipTime_<id> uniform per clip
    const clipUniformLocations: Record<string, WebGLUniformLocation | null> =
      {};
    Object.keys(playingClips).forEach((clipId) => {
      clipUniformLocations[clipId] = webGLContext.getUniformLocation(
        shaderProgram,
        `u_clipTime_${clipId}`
      );
    });

    // 6) Texture setup + placeholder
    const videoTexture = webGLContext.createTexture()!;
    webGLContext.bindTexture(webGLContext.TEXTURE_2D, videoTexture);
    webGLContext.pixelStorei(webGLContext.UNPACK_FLIP_Y_WEBGL, true);
    webGLContext.texParameteri(
      webGLContext.TEXTURE_2D,
      webGLContext.TEXTURE_WRAP_S,
      webGLContext.CLAMP_TO_EDGE
    );
    webGLContext.texParameteri(
      webGLContext.TEXTURE_2D,
      webGLContext.TEXTURE_WRAP_T,
      webGLContext.CLAMP_TO_EDGE
    );
    webGLContext.texParameteri(
      webGLContext.TEXTURE_2D,
      webGLContext.TEXTURE_MIN_FILTER,
      webGLContext.LINEAR
    );

    webGLContext.texImage2D(
      webGLContext.TEXTURE_2D,
      0,
      webGLContext.RGB,
      canvasElement.width,
      canvasElement.height,
      0,
      webGLContext.RGB,
      webGLContext.UNSIGNED_BYTE,
      null
    );

    // 7) requestVideoFrameCallback loop
    let videoFrameCallbackId: number;
    function renderFrame(now: DOMHighResTimeStamp) {
      webGLContext?.useProgram(shaderProgram);

      if (
        webGLContext &&
        typeof videoElement?.readyState === "number" &&
        videoElement?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        webGLContext.bindTexture(webGLContext.TEXTURE_2D, videoTexture);
        webGLContext.texImage2D(
          webGLContext.TEXTURE_2D,
          0,
          webGLContext.RGB,
          webGLContext.RGB,
          webGLContext.UNSIGNED_BYTE,
          videoElement
        );

        if (timeUniformLocation) {
          webGLContext.uniform1f(timeUniformLocation, now / 1000);
        }
        // update every playing clip's u_clipTime_<id>
        Object.entries(playingClips).forEach(([clipId, isPlaying]) => {
          if (!isPlaying) return;
          const start = clipStartTimes[clipId];
          if (start == null) return;

          // find clip duration
          const insts = clips.find((c) => c.id === clipId)!.instructions;
          const duration = Math.max(...insts.map((i) => i.end));
          const elapsed = now / 1000 - start;

          // if not looping & we've passed the end, stop playing
          if (!loopClips[clipId] && elapsed >= duration) {
            setPlayingClips((prev) => ({ ...prev, [clipId]: false }));
            return;
          }

          // otherwise compute the time uniform
          const t = loopClips[clipId]
            ? elapsed % duration
            : Math.min(elapsed, duration);
          const loc = clipUniformLocations[clipId];
          if (!loc) return;

          webGLContext.uniform1f(loc, t);
        });

        webGLContext.drawArrays(webGLContext.TRIANGLES, 0, 6);
      }

      videoFrameCallbackId =
        videoElement?.requestVideoFrameCallback(renderFrame) || 0;
    }
    videoFrameCallbackId = videoElement.requestVideoFrameCallback(renderFrame);

    return () => {
      videoElement.cancelVideoFrameCallback(videoFrameCallbackId);
      window.removeEventListener("resize", updateBuffers);
      videoElement.removeEventListener("loadedmetadata", updateBuffers);
    };
  }, [activeEffects, inputSource, playingClips, loopClips, clipStartTimes]);

  // UI Handlers.
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowPanel((prev) => !prev);
  };

  const handleCheckboxChange = (effect: ShaderEffect) => {
    setActiveEffects((prev) => ({
      ...prev,
      [effect]: !prev[effect],
    }));
  };

  const handlePlayToggle = (clipId: string) => {
    setPlayingClips((prev) => {
      const now = performance.now() / 1000;
      const isNowPlaying = !prev[clipId];
      if (isNowPlaying) {
        setClipStartTimes((times) => ({ ...times, [clipId]: now }));
      }
      return { ...prev, [clipId]: isNowPlaying };
    });
  };

  const handleLoopToggle = (clipId: string) => {
    setLoopClips((prev) => ({ ...prev, [clipId]: !prev[clipId] }));
  };

  const handleInputSourceChange = (newSource: string) => {
    setInputSource(newSource);
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        backgroundColor: "black",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <video
        ref={videoRef}
        style={{ display: "none" }}
        crossOrigin="anonymous"
      />
      {showPanel && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            zIndex: 10,
          }}
        >
          <ControlPanel
            inputSource={inputSource}
            onInputSourceChange={handleInputSourceChange}
            playingClips={playingClips}
            loopClips={loopClips}
            onPlayToggle={handlePlayToggle}
            onLoopToggle={handleLoopToggle}
            activeEffects={activeEffects}
            onToggleEffect={handleCheckboxChange}
          />
        </div>
      )}
    </div>
  );
};

export default App;
