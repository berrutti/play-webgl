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
}

export const shaderEffects: Record<ShaderEffect, ShaderEffectDef> = {
  [ShaderEffect.INVERT]: {
    stage: "color",
    glsl: `color.rgb = 1.0 - color.rgb;`,
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
    glsl: `
      float w = sin(uv.y*50.0 + u_time*5.0) * 0.1;
      color.rg += w;
    `,
  },

  [ShaderEffect.KALEIDOSCOPE]: {
    stage: "mapping",
    glsl: `
      {
        vec2 c = uv*2.0-1.0;
        float slices = 6.0;
        float r = length(c);
        float a = mod(atan(c.y,c.x), 2.0*3.14159265/slices);
        uv = (vec2(cos(a),sin(a)) * r + 1.0) * 0.5;
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
    glsl: `
      {
        float off = 0.01;
        float r = texture2D(u_image, uv+vec2(off,0)).r;
        float g = texture2D(u_image, uv       ).g;
        float b = texture2D(u_image, uv-vec2(off,0)).b;
        color = vec4(r,g,b,1.0);
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
    glsl: `
      {
        float d = length(uv - 0.5);
        float wave = sin((d - u_time*0.5)*30.0);
        color.rgb += wave * 0.2;
      }
    `,
  },
};

export interface ClipInstruction {
  effect: ShaderEffect;
  start: number;
  end: number;
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
      { effect: ShaderEffect.GRAYSCALE, start: 0, end: 5 },
      { effect: ShaderEffect.INVERT, start: 3, end: 8 },
    ],
  },
  {
    id: "2",
    name: "Sine wave 10 seconds",
    instructions: [
      { effect: ShaderEffect.SINE_WAVE, start: 0, end: 5 },
      { effect: ShaderEffect.SINE_WAVE, start: 6, end: 6.1 },
    ],
  },
  {
    id: "3",
    name: "Double invert",
    instructions: [
      { effect: ShaderEffect.INVERT, start: 1, end: 2 },
      { effect: ShaderEffect.INVERT, start: 3, end: 4 },
    ],
  },
].map((clip) => ({
  ...clip,
  instructions: clip.instructions.map(({ effect, start, end }) => {
    if (end < start) {
      // swap them if out of order
      return { effect, start: end, end: start };
    }
    return { effect, start, end };
  }),
}));
