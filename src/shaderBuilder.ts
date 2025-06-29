import { clips, ShaderEffect, shaderEffects } from "./utils";

// Vertex shader used for all passes
export const multiPassVertexShader = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// Passthrough shader for copying textures between passes
export function createPassthroughShader(): string {
  return `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    
    void main() {
      gl_FragColor = texture2D(u_image, v_texCoord);
    }
  `;
}

// Create individual effect shader for multi-pass rendering
export function createEffectShader(effect: ShaderEffect): string {
  const effectDef = shaderEffects[effect];
  const hasIntensity = effectDef.intensity !== undefined;
  
  const intensityUniform = hasIntensity ? `uniform float u_intensity_${effect};` : '';
  
  if (effectDef.stage === 'mapping') {
    // Mapping effects modify UV coordinates
    return `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_time;
      ${intensityUniform}
      varying vec2 v_texCoord;
      
      void main() {
        vec2 uv = v_texCoord;
        
        // Apply mapping effect
        ${effectDef.glsl}
        
        // Sample with modified UV
        gl_FragColor = texture2D(u_image, uv);
      }
    `;
  } else {
    // Color effects modify the sampled color
    return `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_time;
      ${intensityUniform}
      varying vec2 v_texCoord;
      
      void main() {
        vec2 uv = v_texCoord;
        vec4 color = texture2D(u_image, uv);
        
        // Apply color effect
        ${effectDef.glsl}
        
        gl_FragColor = color;
      }
    `;
  }
}

// Create shader for the initial video sampling pass (preserves aspect ratio)
export function createVideoSamplingShader(): string {
  return `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    
    void main() {
      // v_texCoord here uses the aspect-ratio-corrected coordinates
      // from getTextureCoordinates(), ensuring no warping
      gl_FragColor = texture2D(u_image, v_texCoord);
    }
  `;
}

// Legacy single-pass shader (keeping for comparison/fallback)
export function buildStaticFragmentShaderSource(): string {
  const effectUniforms = Object.values(ShaderEffect)
    .map((eff) => `uniform bool u_enable_${eff};`)
    .join("\n");

  const intensityUniforms = Object.values(ShaderEffect)
    .filter((eff) => shaderEffects[eff].intensity !== undefined)
    .map((eff) => `uniform float u_intensity_${eff};`)
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
${intensityUniforms}
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
