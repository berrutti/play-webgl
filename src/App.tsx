import React, { useEffect, useRef, useState } from "react";
import { Clip, ShaderEffect, shaderEffects } from "./utils";

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

const demoClips: Clip[] = [
  {
    id: "clip1",
    name: "Clip 1",
    instructions: [
      { effect: ShaderEffect.GRAYSCALE, start: 0, end: 5 },
      { effect: ShaderEffect.INVERT, start: 3, end: 8 },
    ],
  },
  {
    id: "clip2",
    name: "Clip 2",
    instructions: [{ effect: ShaderEffect.SINE_WAVE, start: 0, end: 10 }],
  },
  {
    id: "clip3",
    name: "Clip 3",
    instructions: [
      { effect: ShaderEffect.INVERT, start: 1, end: 2 },
      { effect: ShaderEffect.INVERT, start: 3, end: 4 },
    ],
  },
];

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

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported.");
      return;
    }
    // Start building your fragment shader
    let fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_time;
      ${
        selectedClipId && clipStartTime !== null
          ? "uniform float u_clipTime;"
          : ""
      }
      varying vec2 v_texCoord;
      void main() {
        vec4 color = texture2D(u_image, v_texCoord);
    `;

    // For each clip instruction, attach its definition
    if (selectedClipId && clipStartTime !== null) {
      const selectedClip = demoClips.find((clip) => clip.id === selectedClipId);
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

    Object.entries(activeEffects).forEach(([effect, isActive]) => {
      if (isActive) {
        fragmentShaderSource += `
          ${shaderEffects[effect].glsl}
        `;
      }
    });

    // Close the main() function.
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

    const timeUniformLocation = gl.getUniformLocation(program, "u_time");

    // Set Up a Fullscreen Rectangle with Preserved Aspect Ratio
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvas.width / canvas.height;
    let scaleX = 1,
      scaleY = 1;
    if (canvasAspect > videoAspect) {
      scaleX = videoAspect / canvasAspect;
    } else {
      scaleY = canvasAspect / videoAspect;
    }
    const positions = new Float32Array([
      -scaleX,
      -scaleY,
      scaleX,
      -scaleY,
      -scaleX,
      scaleY,
      -scaleX,
      scaleY,
      scaleX,
      -scaleY,
      scaleX,
      scaleY,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Create a Texture for the Video Frame
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
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
          const selectedClip = demoClips.find(
            (clip) => clip.id === selectedClipId
          );
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
  }, [activeEffects, inputSource, selectedClipId, clipStartTime]);

  // UI Interaction Handlers
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

  const handleInputSourceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setInputSource(event.target.value);
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
      {/* Fullscreen canvas displaying the processed video feed */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Hidden video element used as the texture source */}
      <video
        ref={videoRef}
        style={{ display: "none" }}
        crossOrigin="anonymous"
      />

      {/* Modal: Appears when right-clicked */}
      {showPanel && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            width: "25vw",
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            zIndex: 10,
          }}
        >
          {/* Dropdown to select video input */}
          <div style={{ marginBottom: "15px" }}>
            <label
              htmlFor="inputSource"
              style={{ fontSize: "20px", color: "black" }}
            >
              Input Source:
            </label>
            <br />
            <select
              id="inputSource"
              value={inputSource}
              onChange={handleInputSourceChange}
              style={{ fontSize: "18px", marginTop: "5px", width: "100%" }}
            >
              <option value="webcam">Webcam</option>
              <option value="video">Video File</option>
            </select>
          </div>

          {/* Dropdown to select a Clip */}
          <div style={{ marginBottom: "15px" }}>
            <label
              htmlFor="clipSelect"
              style={{ fontSize: "20px", color: "black" }}
            >
              Select Clip:
            </label>
            <br />
            <select
              id="clipSelect"
              value={selectedClipId || ""}
              onChange={(e) => {
                const newClipId = e.target.value || null;
                setSelectedClipId(newClipId);
                if (newClipId) {
                  setClipStartTime(performance.now() / 1000);
                } else {
                  setClipStartTime(null);
                }
              }}
              style={{ fontSize: "18px", marginTop: "5px", width: "100%" }}
            >
              <option value="">None</option>
              {demoClips.map((clip) => (
                <option key={clip.id} value={clip.id}>
                  {clip.name}
                </option>
              ))}
            </select>
          </div>

          {/* Simple effects checkboxes generated from the ShaderEffect enum */}
          <div>
            {Object.values(ShaderEffect).map((effect) => (
              <div key={effect} style={{ marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  id={effect}
                  checked={activeEffects[effect]}
                  onChange={() => handleCheckboxChange(effect)}
                />
                <label
                  htmlFor={effect}
                  style={{
                    fontSize: "20px",
                    color: "black",
                    marginLeft: "8px",
                  }}
                >
                  {effect.toUpperCase()}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
