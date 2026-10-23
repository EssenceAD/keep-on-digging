// 조명 합성 · 후처리 셰이더 (PixiJS v8 · WebGL)
import { Geometry, Mesh, Shader } from 'pixi.js';

export const MAX_LIGHTS = 8;

const VERT = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

// 알베도 × (앰비언트 ∪ 광원들). 광원끼리는 pxl처럼 채널별 max로 합친다(타지 않게).
// 노멀 RT의 알파 0 = 조명 안 받음(하늘·구운 지상). 고체 격자 텍스처로 빛이 바위 속으로 몇 px만 스민다.
const LIGHT_FRAG = `
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform sampler2D uSolid;
uniform vec2 uView;
uniform vec2 uCam;
uniform vec2 uWorld;
uniform vec3 uAmbient;
uniform vec4 uLightPos[${MAX_LIGHTS}];
uniform vec4 uLightCol[${MAX_LIGHTS}];
uniform float uCount;
uniform float uSteps;
uniform float uBands;
uniform float uRelief;

void main() {
  vec4 alb = texture(uAlbedo, vUV);
  vec4 nrm = texture(uNormal, vUV);
  if (nrm.a < 0.5) { finalColor = alb; return; }
  vec3 N = normalize(nrm.rgb / nrm.a * 2.0 - 1.0);
  vec2 wp = uCam + floor(vUV * uView) + 0.5;
  vec3 light = uAmbient;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (float(i) >= uCount) break;
    vec4 L = uLightPos[i];
    vec4 C = uLightCol[i];
    vec2 d = L.xy - wp;
    float dist = length(d);
    if (dist >= L.w) continue;
    float att = pow(1.0 - dist / L.w, 1.35);
    float solid = 0.0;
    for (int s = 0; s < 16; s++) {
      if (float(s) >= uSteps || L.z < 0.0) break;   // z < 0: 바위 속 발광체(광석) — 가림 없음
      vec2 p = mix(wp, L.xy, (float(s) + 0.5) / uSteps);
      solid += texture(uSolid, p / uWorld).r;
    }
    float inRock = solid / uSteps * dist;
    float pass = exp(-inRock * 0.085);
    vec2 dir = dist > 0.5 ? vec2(d.x, -d.y) / dist : vec2(0.0);
    float face = clamp(1.0 + uRelief * dot(N.xy, dir) - 0.25 * uRelief * (1.0 - N.z), 0.25, 1.9);
    light = max(light, C.rgb * C.a * att * pass * face);
  }
  if (uBands > 0.0) light = floor(light * uBands + 0.5) / uBands;
  finalColor = vec4(alb.rgb * light, alb.a);
}`;

// 틸트 시프트(위아래 uBand 블러, 격자 영역은 마스크로 제외) · 층 색온도 · 비네팅
const POST_FRAG = `
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTex;
uniform vec2 uView;
uniform float uTilt;
uniform float uBand;
uniform vec4 uGrid;   // 격자 영역 (뷰 uv: x0, y0, x1, y1)
uniform float uVig;
uniform vec3 uTint;
uniform vec3 uFlash;

void main() {
  vec2 px = 1.0 / uView;
  float y = vUV.y;
  float b = clamp(max(uBand - y, y - (1.0 - uBand)) / uBand, 0.0, 1.0) * uTilt;
  bool inGrid = vUV.x >= uGrid.x && vUV.x < uGrid.z && vUV.y >= uGrid.y && vUV.y < uGrid.w;
  if (inGrid) b = 0.0;
  vec4 col = texture(uTex, vUV);
  if (b > 0.01) {
    vec4 acc = vec4(0.0);
    float wsum = 0.0;
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
      float w = exp(-float(i * i + j * j) / 3.0);
      acc += texture(uTex, vUV + vec2(float(i), float(j)) * px * b * 1.25) * w;
      wsum += w;
    }
    col = acc / wsum;
  }
  col.rgb *= uTint;
  vec2 q = (vUV - 0.5) * vec2(1.0, 1.25);
  col.rgb *= 1.0 - uVig * dot(q, q) * 1.6;
  col.rgb += uFlash;
  finalColor = vec4(col.rgb, 1.0);
}`;

function quad(fragment, resources) {
  const geometry = new Geometry({
    attributes: { aPosition: [0, 0, 1, 0, 1, 1, 0, 1], aUV: [0, 0, 1, 0, 1, 1, 0, 1] },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const shader = Shader.from({ gl: { vertex: VERT, fragment }, resources });
  return new Mesh({ geometry, shader });
}

export function makeLightPass(albedo, normal, solid) {
  return quad(LIGHT_FRAG, {
    uAlbedo: albedo.source,
    uNormal: normal.source,
    uSolid: solid.source,
    u: {
      uView: { value: [1, 1], type: 'vec2<f32>' },
      uCam: { value: [0, 0], type: 'vec2<f32>' },
      uWorld: { value: [1, 1], type: 'vec2<f32>' },
      uAmbient: { value: [0.3, 0.3, 0.3], type: 'vec3<f32>' },
      uLightPos: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
      uLightCol: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
      uCount: { value: 0, type: 'f32' },
      uSteps: { value: 12, type: 'f32' },
      uBands: { value: 12, type: 'f32' },
      uRelief: { value: 1.0, type: 'f32' },
    },
  });
}

export function makePostPass(lit) {
  return quad(POST_FRAG, {
    uTex: lit.source,
    u: {
      uView: { value: [1, 1], type: 'vec2<f32>' },
      uTilt: { value: 1, type: 'f32' },
      uBand: { value: 0.1, type: 'f32' },
      uGrid: { value: [0, 0, 0, 0], type: 'vec4<f32>' },
      uVig: { value: 0.5, type: 'f32' },
      uTint: { value: [1, 1, 1], type: 'vec3<f32>' },
      uFlash: { value: [0, 0, 0], type: 'vec3<f32>' },
    },
  });
}
