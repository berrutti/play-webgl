import { clips, ShaderEffect, shaderEffects } from "./utils";

export function buildStaticFragmentShaderSource(): string {
  const effectUniforms = Object.values(ShaderEffect)
    .map((eff) => `uniform bool u_enable_${eff};`)
    .join("\n");

  const clipUniforms = clips
    .map(
      (c) => `
uniform bool u_play_${c.id};
uniform float u_clipTime_${c.id};`
    )
    .join("\n");

  const mappingCode = Object.values(ShaderEffect)
    .filter((eff) => shaderEffects[eff].stage === "mapping")
    .map(
      (eff) => `
  if (u_enable_${eff}) {
    ${shaderEffects[eff].glsl}
  }
`
    )
    .join("\n");

  const clipCode = clips
    .map((c) =>
      c.instructions
        .map(
          (inst) => `
  if (u_play_${c.id} && 
      u_clipTime_${c.id} >= ${inst.start.toFixed(3)} && 
      u_clipTime_${c.id} <= ${inst.end.toFixed(3)}) {
    ${shaderEffects[inst.effect].glsl.replace(
      /texture2D$begin:math:text$u_image,\\s*v_texCoord$end:math:text$/g,
      "texture2D(u_image, uv)"
    )}
  }
`
        )
        .join("\n")
    )
    .join("\n");

  const colorCode = Object.values(ShaderEffect)
    .filter((eff) => shaderEffects[eff].stage === "color")
    .map(
      (eff) => `
  if (u_enable_${eff}) {
    ${shaderEffects[eff].glsl}
  }
`
    )
    .join("\n");

  return `
precision mediump float;
uniform sampler2D u_image;
uniform float u_time;
${effectUniforms}
${clipUniforms}
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;

  // 1) all mapping effects
  ${mappingCode}

  // 2) sample once
  vec4 color = texture2D(u_image, uv);

  // 3) all clip‑based
  ${clipCode}

  // 4) all color effects
  ${colorCode}

  // 5) output
  gl_FragColor = color;
}
`;
}
