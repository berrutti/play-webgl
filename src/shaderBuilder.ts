// src/shaderBuilder.ts
import { clips, ShaderEffect, shaderEffects } from "./utils";

export function buildFragmentShaderSource(
  activeEffects: Record<ShaderEffect, boolean>,
  effectOrder: ShaderEffect[],
  playingClips: Record<string, boolean>
): string {
  return `
precision mediump float;
uniform sampler2D u_image;
uniform float u_time;
${Object.entries(playingClips)
  .filter(([, on]) => on)
  .map(([id]) => `uniform float u_clipTime_${id};`)
  .join("\n")}
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;

  // 1) mapping
  ${effectOrder
    .filter(
      (eff) => activeEffects[eff] && shaderEffects[eff].stage === "mapping"
    )
    .map((eff) => shaderEffects[eff].glsl)
    .join("\n")}

  // 2) sample
  vec4 color = texture2D(u_image, uv);

  // 3) clip-based
  ${Object.entries(playingClips)
    .filter(([, on]) => on)
    .flatMap(([id]) => {
      const clip = clips.find((c) => c.id === id)!;
      return clip.instructions.map(
        (inst) => `
    if (u_clipTime_${id} >= ${inst.start.toFixed(
          3
        )} && u_clipTime_${id} <= ${inst.end.toFixed(3)}) {
      ${shaderEffects[inst.effect].glsl.replace(
        /texture2D\\(u_image,\\s*v_texCoord\\)/g,
        "texture2D(u_image, uv)"
      )}
    }`
      );
    })
    .join("\n")}

  // 4) color
  ${effectOrder
    .filter((eff) => activeEffects[eff] && shaderEffects[eff].stage === "color")
    .map((eff) => shaderEffects[eff].glsl)
    .join("\n")}

  gl_FragColor = color;
}
`;
}
