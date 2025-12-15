import { useRef, useEffect } from "react";
import { ShaderEffect, shaderEffects, getTextureCoordinates } from "../utils";
import {
  multiPassVertexShader,
  createPassthroughShader,
  createEffectShader,
  createVideoSamplingShader
} from "../shaderBuilder";

export interface UseWebGLRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  activeEffects: Record<ShaderEffect, boolean>;
  effectIntensities: Record<ShaderEffect, number>;
  inputSource: string;
  bpm: number;
  onRenderPerformance?: (fps: number, frameTime: number) => void;
}

interface RenderTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface ShaderProgram {
  program: WebGLProgram;
  attribLocations: {
    position: number;
    texCoord: number;
  };
  uniformLocations: Record<string, WebGLUniformLocation | null>;
}

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

function createRenderTarget(gl: WebGLRenderingContext, width: number, height: number): RenderTarget {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create texture");
  
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new Error("Failed to create framebuffer");
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer is not complete");
  }
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  
  return { framebuffer, texture, width, height };
}

export function useWebGLRenderer({
  canvasRef,
  videoRef,
  activeEffects,
  effectIntensities,
  inputSource,
  bpm,
  onRenderPerformance,
}: UseWebGLRendererProps) {
  const glRef = useRef<WebGLRenderingContext | null>(null);

  // Track previous values to detect what changed
  const prevPropsRef = useRef({ activeEffects, effectIntensities, inputSource, bpm });

  const changedProps = [];
  if (prevPropsRef.current.activeEffects !== activeEffects) changedProps.push('activeEffects');
  if (prevPropsRef.current.effectIntensities !== effectIntensities) changedProps.push('effectIntensities');
  if (prevPropsRef.current.inputSource !== inputSource) changedProps.push('inputSource');
  if (prevPropsRef.current.bpm !== bpm) changedProps.push('bpm');

  if (changedProps.length > 0) {
    console.log('[useWebGLRenderer] Props changed:', changedProps);
  }

  prevPropsRef.current = { activeEffects, effectIntensities, inputSource, bpm };
  const videoTextureRef = useRef<WebGLTexture | null>(null);
  const renderTargetsRef = useRef<RenderTarget[]>([]);
  const shadersRef = useRef<Record<string, ShaderProgram>>({});
  const buffersRef = useRef<{
    positionBuffer: WebGLBuffer | null;
    aspectRatioTexCoordBuffer: WebGLBuffer | null; // For video sampling with aspect ratio
    standardTexCoordBuffer: WebGLBuffer | null;    // For render target sampling (0-1)
  }>({
    positionBuffer: null,
    aspectRatioTexCoordBuffer: null,
    standardTexCoordBuffer: null,
  });

  // Performance tracking for GPU rendering
  const performanceRef = useRef<{
    frameStartTimes: number[];
    lastFrameTime: number;
    lastPerformanceReport: number;
  }>({
    frameStartTimes: [],
    lastFrameTime: 0,
    lastPerformanceReport: 0,
  });
  
  // Cache for uniform values to avoid unnecessary GPU uploads
  const uniformCacheRef = useRef<Record<string, {
    time?: number;
    bpm?: number;
    intensities?: Record<string, number>;
    lastProgramUsed?: WebGLProgram | null;
  }>>({});

  // Initialize WebGL context and resources
  useEffect(() => {
    console.log('[useWebGLRenderer] useEffect triggered - initializing WebGL');
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported.");
      return;
    }
    glRef.current = gl;

    // Create vertex shader (shared by all programs)
    const vertexShader = compileShader(gl, multiPassVertexShader, gl.VERTEX_SHADER);

    // Create shader programs
    const programs: Record<string, ShaderProgram> = {};
    
    // Video sampling program (preserves aspect ratio)
    const videoSamplingFragShader = compileShader(gl, createVideoSamplingShader(), gl.FRAGMENT_SHADER);
    const videoSamplingProgram = createProgram(gl, vertexShader, videoSamplingFragShader);
    programs['videoSampling'] = {
      program: videoSamplingProgram,
      attribLocations: {
        position: gl.getAttribLocation(videoSamplingProgram, 'a_position'),
        texCoord: gl.getAttribLocation(videoSamplingProgram, 'a_texCoord'),
      },
      uniformLocations: {
        image: gl.getUniformLocation(videoSamplingProgram, 'u_image'),
      }
    };

    // Individual effect programs
    Object.values(ShaderEffect).forEach(effect => {
      const effectFragShader = compileShader(gl, createEffectShader(effect), gl.FRAGMENT_SHADER);
      const effectProgram = createProgram(gl, vertexShader, effectFragShader);
      
      const uniformLocations: Record<string, WebGLUniformLocation | null> = {
        image: gl.getUniformLocation(effectProgram, 'u_image'),
        time: gl.getUniformLocation(effectProgram, 'u_time'),
        bpm: gl.getUniformLocation(effectProgram, 'u_bpm'),
      };
      
      // Add intensity uniform if effect supports it
      if (shaderEffects[effect].intensity !== undefined) {
        uniformLocations[`intensity_${effect}`] = gl.getUniformLocation(effectProgram, `u_intensity_${effect}`);
      }
      
      programs[effect] = {
        program: effectProgram,
        attribLocations: {
          position: gl.getAttribLocation(effectProgram, 'a_position'),
          texCoord: gl.getAttribLocation(effectProgram, 'a_texCoord'),
        },
        uniformLocations
      };
    });

    // Passthrough program (for copying)
    const passthroughFragShader = compileShader(gl, createPassthroughShader(), gl.FRAGMENT_SHADER);
    const passthroughProgram = createProgram(gl, vertexShader, passthroughFragShader);
    programs['passthrough'] = {
      program: passthroughProgram,
      attribLocations: {
        position: gl.getAttribLocation(passthroughProgram, 'a_position'),
        texCoord: gl.getAttribLocation(passthroughProgram, 'a_texCoord'),
      },
      uniformLocations: {
        image: gl.getUniformLocation(passthroughProgram, 'u_image'),
      }
    };

    shadersRef.current = programs;

    // Create buffers
    const quadPositions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadPositions, gl.STATIC_DRAW);
    
    const aspectRatioTexCoordBuffer = gl.createBuffer();
    const standardTexCoordBuffer = gl.createBuffer();
    
    // Standard texture coordinates (0-1) for render target sampling
    const standardTexCoords = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, standardTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, standardTexCoords, gl.STATIC_DRAW);
    
    buffersRef.current = {
      positionBuffer,
      aspectRatioTexCoordBuffer,
      standardTexCoordBuffer,
    };

    // Create video texture
    const videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    videoTextureRef.current = videoTexture;

    // Setup update functions
    function updateBuffers() {
      if (!canvas || !gl || !video || !buffersRef.current.aspectRatioTexCoordBuffer) return;
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);

      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      
      // Create aspect-ratio-corrected texture coordinates (CRITICAL for preserving aspect ratio)
      const aspectRatioTexCoords = getTextureCoordinates(
        videoWidth,
        videoHeight,
        canvas.width,
        canvas.height
      );
      
             // Aspect ratio correction applied - logging removed for production
      
      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.aspectRatioTexCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, aspectRatioTexCoords, gl.STATIC_DRAW);
      
      // Recreate render targets if size changed
      renderTargetsRef.current.forEach(rt => {
        gl.deleteFramebuffer(rt.framebuffer);
        gl.deleteTexture(rt.texture);
      });
      
      // Create 2 render targets for ping-pong rendering
      renderTargetsRef.current = [
        createRenderTarget(gl, canvas.width, canvas.height),
        createRenderTarget(gl, canvas.width, canvas.height),
      ];
    }
    
    updateBuffers();
    window.addEventListener("resize", updateBuffers);
         if (video) video.addEventListener("loadedmetadata", updateBuffers);

    // Render function
    let videoFrameCallbackId: number;
    let frameCount = 0;
    let lastLogTime = performance.now();

    function renderFrame(now: DOMHighResTimeStamp) {
      if (!gl || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        videoFrameCallbackId = video?.requestVideoFrameCallback(renderFrame) || 0;
        return;
      }

      frameCount++;
      const currentTime = performance.now();

      // Log every 120 frames (~2 seconds at 60fps) to avoid spam
      if (frameCount % 120 === 0) {
        const timeSinceLastLog = currentTime - lastLogTime;
        const fps = (120 / timeSinceLastLog) * 1000;
        console.log(`[useWebGLRenderer] Rendered ${frameCount} frames total, current FPS: ${fps.toFixed(1)}`);
        lastLogTime = currentTime;
      }

      // Performance tracking - mark frame start
      const frameStartTime = performance.now();
      const perfData = performanceRef.current;

      // Update video texture
      gl.bindTexture(gl.TEXTURE_2D, videoTextureRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);

      // Get active effects in order
      const activeEffectsList = Object.values(ShaderEffect).filter(effect => activeEffects[effect]);
      
      let currentTexture = videoTextureRef.current;
      let currentRenderTarget = 0;
      
      // Multi-pass rendering
      if (activeEffectsList.length > 0) {
        // First pass: Sample video with aspect ratio correction to first render target
        gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargetsRef.current[0].framebuffer);
        gl.viewport(0, 0, renderTargetsRef.current[0].width, renderTargetsRef.current[0].height);
        
        const videoSamplingShader = shadersRef.current['videoSampling'];
        gl.useProgram(videoSamplingShader.program);
        
        // Use aspect-ratio-corrected texture coordinates for video sampling
        setupAttributes(gl, videoSamplingShader, buffersRef.current.positionBuffer, buffersRef.current.aspectRatioTexCoordBuffer);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(videoSamplingShader.uniformLocations.image, 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        currentTexture = renderTargetsRef.current[0].texture;
        currentRenderTarget = 1;
        
        // Apply effects one by one
        activeEffectsList.forEach(effect => {
          const targetRT = renderTargetsRef.current[currentRenderTarget];
          gl.bindFramebuffer(gl.FRAMEBUFFER, targetRT.framebuffer);
          gl.viewport(0, 0, targetRT.width, targetRT.height);
          
          const effectShader = shadersRef.current[effect];
          gl.useProgram(effectShader.program);
          
          // Use standard texture coordinates for render target sampling
          setupAttributes(gl, effectShader, buffersRef.current.positionBuffer, buffersRef.current.standardTexCoordBuffer);
          
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, currentTexture);
          gl.uniform1i(effectShader.uniformLocations.image, 0);
          
          // PERFORMANCE OPTIMIZATION: Smart uniform uploads
          // Note: WebGL uniforms are lost when switching programs, so we track the last program used
          const cache = uniformCacheRef.current[effect] || { lastProgramUsed: null };
          const currentTime = now / 1000;
          
          // If this is the first time using this program this frame, upload all uniforms
          const programSwitched = cache.lastProgramUsed !== effectShader.program;
          
          // Upload time uniform (always changes or on program switch)
          if (cache.time !== currentTime || programSwitched) {
            gl.uniform1f(effectShader.uniformLocations.time, currentTime);
            cache.time = currentTime;
          }
          
          // Upload BPM uniform (only if changed or on program switch)
          if (cache.bpm !== bpm || programSwitched) {
            gl.uniform1f(effectShader.uniformLocations.bpm, bpm);
            cache.bpm = bpm;
          }
          
          // Upload intensity uniform (only if changed or on program switch)
          const intensityLocation = effectShader.uniformLocations[`intensity_${effect}`];
          if (intensityLocation) {
            const currentIntensity = effectIntensities[effect];
            if (!cache.intensities) cache.intensities = {};
            if (cache.intensities[effect] !== currentIntensity || programSwitched) {
              gl.uniform1f(intensityLocation, currentIntensity);
              cache.intensities[effect] = currentIntensity;
            }
          }
          
          // Remember this program was used
          cache.lastProgramUsed = effectShader.program;
          uniformCacheRef.current[effect] = cache;
          
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          
          currentTexture = targetRT.texture;
          currentRenderTarget = (currentRenderTarget + 1) % 2;
        });
        
                 // Final pass: Render to screen
         gl.bindFramebuffer(gl.FRAMEBUFFER, null);
         gl.viewport(0, 0, canvas?.width || 0, canvas?.height || 0);
        
        const passthroughShader = shadersRef.current['passthrough'];
        gl.useProgram(passthroughShader.program);
        
        setupAttributes(gl, passthroughShader, buffersRef.current.positionBuffer, buffersRef.current.standardTexCoordBuffer);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(passthroughShader.uniformLocations.image, 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } else {
                 // No effects: Direct video sampling to screen (preserving aspect ratio)
         gl.bindFramebuffer(gl.FRAMEBUFFER, null);
         gl.viewport(0, 0, canvas?.width || 0, canvas?.height || 0);
        
        const videoSamplingShader = shadersRef.current['videoSampling'];
        gl.useProgram(videoSamplingShader.program);
        
        setupAttributes(gl, videoSamplingShader, buffersRef.current.positionBuffer, buffersRef.current.aspectRatioTexCoordBuffer);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(videoSamplingShader.uniformLocations.image, 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // Performance tracking - measure frame completion and calculate metrics
      const frameEndTime = performance.now();
      const frameTime = frameEndTime - frameStartTime;
      
      // Track frame times for FPS calculation
      perfData.frameStartTimes.push(frameStartTime);
      
      // Keep only frames from the last second for FPS calculation
      const oneSecondAgo = frameStartTime - 1000;
      perfData.frameStartTimes = perfData.frameStartTimes.filter(time => time > oneSecondAgo);
      
      // Calculate actual GPU rendering FPS and average frame time
      const renderFps = perfData.frameStartTimes.length;
      
      // Report performance metrics every 200ms to avoid spam
      if (frameStartTime - perfData.lastPerformanceReport > 200 && onRenderPerformance) {
        onRenderPerformance(renderFps, frameTime);
        perfData.lastPerformanceReport = frameStartTime;
      }
      
      perfData.lastFrameTime = frameEndTime;

      videoFrameCallbackId = video.requestVideoFrameCallback(renderFrame);
    }
    
    videoFrameCallbackId = video.requestVideoFrameCallback(renderFrame);

    function setupAttributes(
      gl: WebGLRenderingContext, 
      shader: ShaderProgram, 
      positionBuffer: WebGLBuffer | null, 
      texCoordBuffer: WebGLBuffer | null
    ) {
      // Position attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(shader.attribLocations.position);
      gl.vertexAttribPointer(shader.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
      
      // Texture coordinate attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.enableVertexAttribArray(shader.attribLocations.texCoord);
      gl.vertexAttribPointer(shader.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
    }

    return () => {
      video.cancelVideoFrameCallback(videoFrameCallbackId);
      window.removeEventListener("resize", updateBuffers);
      video.removeEventListener("loadedmetadata", updateBuffers);
      
      // Cleanup WebGL resources
      renderTargetsRef.current.forEach(rt => {
        gl.deleteFramebuffer(rt.framebuffer);
        gl.deleteTexture(rt.texture);
      });
      Object.values(shadersRef.current).forEach(shader => {
        gl.deleteProgram(shader.program);
      });
      if (videoTextureRef.current) {
        gl.deleteTexture(videoTextureRef.current);
      }
      Object.values(buffersRef.current).forEach(buffer => {
        if (buffer) gl.deleteBuffer(buffer);
      });
    };
  }, [
    activeEffects,
    effectIntensities,
    inputSource,
    bpm,
    canvasRef,
    onRenderPerformance,
    videoRef,
  ]);

  return {
    gl: glRef.current,
  };
} 