export enum ShaderEffect {
  INVERT = "INVERT",
  GRAYSCALE = "GRAYSCALE",
  SINE_WAVE = "SINE_WAVE",
}

export interface ShaderInstruction {
  effect: ShaderEffect;
  start: number;
  end: number;
}

export interface Clip {
  id: string;
  name: string;
  instructions: ShaderInstruction[];
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
