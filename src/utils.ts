// utils.ts
export enum ShaderEffect {
  INVERT = "INVERT",
  GRAYSCALE = "GRAYSCALE",
  SINE_WAVE = "SINE_WAVE",
  KALEIDOSCOPE = "KALEIDOSCOPE",
  DISPLACE = "DISPLACE",
  SWIRL = "SWIRL",
  CHROMA = "CHROMA",
  PIXELATE = "PIXELATE",
  VORONOI = "VORONOI",
  RIPPLE = "RIPPLE",
}

export interface ShaderEffectDef {
  /** 'mapping' effects mutate uv, 'color' effects mutate color */
  stage: "mapping" | "color";
  glsl: string;
  intensity?: number; // Optional - if present, effect has intensity control
}

export const shaderEffects: Record<ShaderEffect, ShaderEffectDef> = {
  [ShaderEffect.INVERT]: {
    stage: "color",
    intensity: 1.0,
    glsl: `color.rgb = mix(color.rgb, 1.0 - color.rgb, u_intensity_INVERT);`,
  },

  [ShaderEffect.GRAYSCALE]: {
    stage: "color",
    glsl: `
      float l = dot(color.rgb, vec3(0.299,0.587,0.114));
      color = vec4(vec3(l),1.0);
    `,
  },

  [ShaderEffect.SINE_WAVE]: {
    stage: "color",
    intensity: 1.0,
    glsl: `
      float w = sin(uv.y*50.0 + u_time*5.0) * 0.1;
      color.rg += w * u_intensity_SINE_WAVE;
    `,
  },

  [ShaderEffect.KALEIDOSCOPE]: {
    stage: "mapping",
    glsl: `
      {
        // Center the coordinates and add time-based rotation
        vec2 center = vec2(0.5, 0.5);
        vec2 c = (uv - center) * 1.5; // 1.5x zoom to see more of the image
        
        // Add gentle rotation over time
        float rotation = u_time * 0.1;
        float cosR = cos(rotation);
        float sinR = sin(rotation);
        c = vec2(c.x * cosR - c.y * sinR, c.x * sinR + c.y * cosR);
        
        // More slices for complexity and beauty
        float slices = 10.0;
        float r = length(c);
        float a = atan(c.y, c.x);
        
        // Create the kaleidoscope mirroring
        float slice = 2.0 * 3.14159265 / slices;
        a = mod(a, slice);
        
        // Mirror every other slice for more interesting patterns
        if (mod(floor(atan(c.y, c.x) / slice), 2.0) > 0.5) {
          a = slice - a;
        }
        
        // Reconstruct coordinates with better scaling
        vec2 kaleidoCoord = vec2(cos(a), sin(a)) * r * 0.8; // 0.8 scale for better fit
        
        // Offset the sampling area to get more interesting parts of the image
        // Sample from upper area where face usually is, not dead center
        uv = kaleidoCoord + vec2(0.5, 0.4);
        
        // Keep UV in bounds with wrapping for seamless effect
        uv = fract(uv);
      }
    `,
  },

  [ShaderEffect.DISPLACE]: {
    stage: "mapping",
    glsl: `
      {
        float t = u_time * 0.2;
        uv.x += (sin((uv.y+t)*10.0)*0.5+0.5)*0.05;
        uv.y += (sin((uv.x+t)*10.0)*0.5+0.5)*0.05;
      }
    `,
  },

  [ShaderEffect.SWIRL]: {
    stage: "mapping",
    glsl: `
      {
        vec2 c = uv*2.0-1.0;
        float r = length(c);
        float a = atan(c.y,c.x) + r*3.0*sin(u_time);
        uv = (vec2(cos(a),sin(a)) * r + 1.0) * 0.5;
      }
    `,
  },

  [ShaderEffect.CHROMA]: {
    stage: "color",
    intensity: 1.0,
    glsl: `
      {
        float off = 0.01;
        vec3 chromaDiff = vec3(
          texture2D(u_image, uv+vec2(off,0)).r - color.r,
          0.0,
          texture2D(u_image, uv-vec2(off,0)).b - color.b
        );
        color.rgb += chromaDiff * u_intensity_CHROMA;
      }
    `,
  },

  [ShaderEffect.PIXELATE]: {
    stage: "mapping",
    glsl: `
      {
        float px = 100.0;
        uv = floor(uv * px) / px;
      }
    `,
  },

  [ShaderEffect.VORONOI]: {
    stage: "mapping",
    glsl: `
      {
        vec2 cell = floor(uv * 10.0);
        vec2 f    = fract(uv * 10.0);
        float jx = fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
        float jy = fract(sin(dot(cell,vec2(93.9898,67.345)))*24634.6345);
        uv = (cell + vec2(jx,jy) + f) / 10.0;
      }
    `,
  },

  [ShaderEffect.RIPPLE]: {
    stage: "color",
    intensity: 1.0,
    glsl: `
      {
        float d = length(uv - 0.5);
        float wave = sin((d - u_time*0.5)*30.0);
        color.rgb += wave * 0.2 * u_intensity_RIPPLE;
      }
    `,
  },
};

export interface ClipInstruction {
  effect: ShaderEffect;
  startBeat: number;      // Which beat to start on (1-based, like music)
  lengthBeats: number;    // How many beats the effect lasts
}

export interface Clip {
  id: string;
  name: string;
  instructions: ClipInstruction[];
}

export function getTextureCoordinates(
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number
): Float32Array {
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  if (videoAspect < canvasAspect) {
    // Video is "shorter" than the canvas when filling width: crop vertically.
    const vCrop = (1 - videoAspect / canvasAspect) / 2;
    return new Float32Array([
      // Triangle 1
      0,
      vCrop, // bottom-left
      1,
      vCrop, // bottom-right
      0,
      1 - vCrop, // top-left
      // Triangle 2
      0,
      1 - vCrop, // top-left
      1,
      vCrop, // bottom-right
      1,
      1 - vCrop, // top-right
    ]);
  } else {
    // Video is wider than (or equal to) canvas: crop horizontally.
    const uCrop = (1 - canvasAspect / videoAspect) / 2;
    return new Float32Array([
      // Triangle 1
      uCrop,
      0, // bottom-left
      1 - uCrop,
      0, // bottom-right
      uCrop,
      1, // top-left
      // Triangle 2
      uCrop,
      1, // top-left
      1 - uCrop,
      0, // bottom-right
      1 - uCrop,
      1, // top-right
    ]);
  }
}

export const clips: Clip[] = [
  {
    id: "1",
    name: "Grayscale then Invert",
    instructions: [
      { effect: ShaderEffect.GRAYSCALE, startBeat: 1, lengthBeats: 4 },     // Beats 1-4
      { effect: ShaderEffect.INVERT, startBeat: 3, lengthBeats: 4 },        // Beats 3-6 (overlap)
    ],
  },
  {
    id: "2", 
    name: "Rhythmic Sine Wave",
    instructions: [
      { effect: ShaderEffect.SINE_WAVE, startBeat: 1, lengthBeats: 4 },     // Beats 1-4
      { effect: ShaderEffect.SINE_WAVE, startBeat: 7, lengthBeats: 0.5 },   // Beat 7 (short accent)
    ],
  },
  {
    id: "3",
    name: "Double Beat Invert", 
    instructions: [
      { effect: ShaderEffect.INVERT, startBeat: 1, lengthBeats: 1 },        // Beat 1
      { effect: ShaderEffect.INVERT, startBeat: 3, lengthBeats: 1 },        // Beat 3
    ],
  },
  {
    id: "4",
    name: "Kaleidoscope Drop",
    instructions: [
      { effect: ShaderEffect.KALEIDOSCOPE, startBeat: 1, lengthBeats: 8 },  // Full 2-bar phrase
      { effect: ShaderEffect.CHROMA, startBeat: 5, lengthBeats: 2 },        // Add chroma in second bar
    ],
  },
];
