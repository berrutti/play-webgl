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
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clipStartTime, setClipStartTime] = useState<number | null>(null);

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
        .catch((err) => console.error("Error accessing webcam:", err));
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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported.");
      return;
    }

    // Set up full-screen quad positions (always the same).
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();

    function updateBuffers() {
      if (!canvas || !gl || !video) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);

      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      const texCoords = getTextureCoordinates(
        videoWidth,
        videoHeight,
        canvas.width,
        canvas.height
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    }
    updateBuffers();

    window.addEventListener("resize", updateBuffers);
    video.addEventListener("loadedmetadata", updateBuffers);

    // Start building your fragment shader
    let fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_time;
      ${
        selectedClipId !== null && clipStartTime !== null
          ? "uniform float u_clipTime;"
          : ""
      }
      varying vec2 v_texCoord;
      void main() {
        vec4 color = texture2D(u_image, v_texCoord);
    `;

    // For each clip instruction, attach its definition
    if (selectedClipId && clipStartTime !== null) {
      const selectedClip = clips.find((clip) => clip.id === selectedClipId);
      if (selectedClip) {
        selectedClip.instructions.forEach((instruction) => {
          const effectGlsl = shaderEffects[instruction.effect].glsl;
          fragmentShaderSource += `
        if(u_clipTime >= ${instruction.start.toFixed(
          1
        )} && u_clipTime <= ${instruction.end.toFixed(1)}) {
          ${effectGlsl}
        }
          `;
        });
      }
    }

    // Add effects from the checkboxes.
    Object.entries(activeEffects).forEach(([effect, isActive]) => {
      if (isActive) {
        fragmentShaderSource += `
          ${shaderEffects[effect].glsl}
        `;
      }
    });
    fragmentShaderSource += `
        gl_FragColor = color;
      }
    `;

    // Compile shaders and create the program
    const vertexShader = compileShader(
      gl,
      vertexShaderSource,
      gl.VERTEX_SHADER
    );
    const fragmentShader = compileShader(
      gl,
      fragmentShaderSource,
      gl.FRAGMENT_SHADER
    );
    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    // (Re)bind the full-screen quad positions to the program.
    const aPosition = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Bind texture coordinates.
    const aTexCoord = gl.getAttribLocation(program, "a_texCoord");
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

    const timeUniformLocation = gl.getUniformLocation(program, "u_time");
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    // Rendering Loop
    function render() {
      if (video && gl && video.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGB,
          gl.RGB,
          gl.UNSIGNED_BYTE,
          video
        );
        if (timeUniformLocation) {
          gl.uniform1f(timeUniformLocation, performance.now() / 1000);
        }
        if (selectedClipId && clipStartTime !== null) {
          const selectedClip = clips.find((clip) => clip.id === selectedClipId);
          if (selectedClip) {
            const clipDuration = Math.max(
              ...selectedClip.instructions.map((inst) => inst.end)
            );
            const elapsed = performance.now() / 1000 - clipStartTime;
            const currentClipTime = elapsed % clipDuration;
            const uClipTimeLocation = gl.getUniformLocation(
              program,
              "u_clipTime"
            );
            if (uClipTimeLocation) {
              gl.uniform1f(uClipTimeLocation, currentClipTime);
            }
          }
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      requestAnimationFrame(render);
    }
    render();

    return () => {
      window.removeEventListener("resize", updateBuffers);
      video.removeEventListener("loadedmetadata", updateBuffers);
    };
  }, [activeEffects, inputSource, selectedClipId, clipStartTime]);

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
            selectedClipId={selectedClipId}
            onClipChange={(newClipId) => {
              setSelectedClipId(newClipId);
              if (newClipId !== null) {
                setClipStartTime(performance.now() / 1000);
              } else {
                setClipStartTime(null);
              }
            }}
            activeEffects={activeEffects}
            onToggleEffect={handleCheckboxChange}
          />
        </div>
      )}
    </div>
  );
};

export default App;
