export enum ShaderEffect {
  INVERT = "INVERT",
  GRAYSCALE = "GRAYSCALE",
  SINE_WAVE = "SINE_WAVE",
}

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

export type ShaderEffectDefinition = {
  id: string;
  glsl: string;
};

export const shaderEffects: Record<string, ShaderEffectDefinition> = {
  GRAYSCALE: {
    id: ShaderEffect.GRAYSCALE,
    glsl: "color = vec4(vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114))), 1.0);",
  },
  INVERT: {
    id: ShaderEffect.INVERT,
    glsl: "color = vec4(vec3(1.0) - color.rgb, 1.0);",
  },
  SINE_WAVE: {
    id: ShaderEffect.SINE_WAVE,
    glsl: "color.rgb *= 0.5 + 0.5 * abs(sin(u_time));",
  },
};

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
