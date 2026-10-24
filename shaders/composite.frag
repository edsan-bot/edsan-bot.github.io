// Composite pass: one shader owns the skull, the ink field and the title.
// Everything shares the same wave field so nothing can look "pasted on".

precision highp float;

varying vec2 vUv;

uniform sampler2D uSim;
uniform sampler2D uSkull;
uniform sampler2D uText;

uniform vec2 uResolution;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uTime;
uniform float uEntrance;
uniform float uScroll;
uniform vec2 uMouse;
uniform float uEnergy;

uniform float uTextMix;
uniform float uFrag;
uniform vec2 uFragOrigin;

uniform vec4 uFocus;
uniform float uFocusAmount;

uniform float uSkullZoom;
uniform float uSkullAspect;
uniform float uGrain;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amp * valueNoise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return value;
}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float skullLuma(vec2 uv) {
  return luma(texture2D(uSkull, clamp(uv, 0.001, 0.999)).rgb);
}

void main() {
  vec2 uv = vUv;

  /* ---------------- wave field ---------------- */

  float height = texture2D(uSim, uv).r;
  float hl = texture2D(uSim, uv - vec2(uTexel.x, 0.0)).r;
  float hr = texture2D(uSim, uv + vec2(uTexel.x, 0.0)).r;
  float hd = texture2D(uSim, uv - vec2(0.0, uTexel.y)).r;
  float hu = texture2D(uSim, uv + vec2(0.0, uTexel.y)).r;
  vec2 grad = vec2(hr - hl, hu - hd);

  float inFocus =
    step(uFocus.x, uv.x) * step(uv.x, uFocus.x + uFocus.z) *
    step(uFocus.y, uv.y) * step(uv.y, uFocus.y + uFocus.w);

  vec2 raw = grad * (0.55 + inFocus * uFocusAmount * 1.4) + vec2(0.0, height) * 0.05;
  // Soft saturation: waves stay expressive without ever shredding the type.
  vec2 refraction = raw / (1.0 + length(raw) * 70.0);

  /* ---------------- ambient ink ---------------- */

  vec2 inkUv = (uv + refraction * 2.4) * vec2(uAspect * 1.5, 1.0) * 2.2;
  inkUv += vec2(uTime * 0.011, -uTime * 0.017);
  float ink = fbm(inkUv);
  float inkLevel = 0.010 + 0.042 * smoothstep(0.1, 0.8, uScroll) + inFocus * uFocusAmount * 0.1;

  vec3 color = vec3(0.012 + ink * inkLevel);

  /* ---------------- skull ---------------- */

  vec2 cover = vec2(1.0);
  if (uAspect > uSkullAspect) {
    cover.y = uSkullAspect / uAspect;
  } else {
    cover.x = uAspect / uSkullAspect;
  }

  vec2 skullUv = ((uv - 0.5) * cover) / uSkullZoom + 0.5;
  skullUv += vec2(0.0, 0.045);
  skullUv += refraction * 0.45;
  skullUv += vec2(0.0, uScroll * 0.05);

  vec2 tap = vec2(1.8 / 1600.0, 1.8 / 1067.0);
  float sl = skullLuma(skullUv);
  float slx = skullLuma(skullUv + vec2(tap.x, 0.0)) - skullLuma(skullUv - vec2(tap.x, 0.0));
  float sly = skullLuma(skullUv + vec2(0.0, tap.y)) - skullLuma(skullUv - vec2(0.0, tap.y));

  // Crush the photographic range: only sculptural highlights survive.
  float shaded = smoothstep(0.05, 0.58, sl);
  shaded = pow(shaded, 1.7);

  vec3 normal = normalize(vec3(-slx * 2.2, -sly * 2.2, 0.65));
  vec3 lightDir = normalize(vec3((uMouse.x - 0.5) * 1.2, (uMouse.y - 0.5) * 1.2, 1.0));
  float specular = pow(max(dot(normal, lightDir), 0.0), 42.0);

  vec2 radial = (uv - vec2(0.5, 0.5)) * vec2(uAspect * 0.66, 1.0);
  float mask = smoothstep(1.0, 0.24, length(radial));

  // Dark basin behind the type so the blackletter always wins.
  vec2 scrimUv = (uv - vec2(0.5, 0.475)) * vec2(uAspect, 1.0);
  float scrimDistance = length(scrimUv / vec2(0.5, 0.21));
  float scrim = 1.0 - smoothstep(0.55, 1.2, scrimDistance);

  float skullAlpha = smoothstep(0.03, 0.42, shaded) * mask * (1.0 - 0.86 * scrim);
  // The lower third dissolves into the void instead of ending in a bone pile.
  skullAlpha *= smoothstep(0.02, 0.34, uv.y);
  // With scroll the skull recedes so the gallery can breath.
  skullAlpha *= 1.0 - 0.82 * smoothstep(0.02, 0.34, uScroll);
  vec3 skullColor = vec3(0.42 * shaded + specular * 0.16);

  color += skullColor * skullAlpha * (0.86 + uEnergy * 0.12) * uEntrance;

  /* ---------------- title ---------------- */

  vec2 textUv = uv + refraction * 0.85;

  if (uFrag > 0.0005) {
    vec2 cell = floor((uv - uFragOrigin) * 34.0);
    float pick = step(0.6, hash21(cell)) * uFrag;
    vec2 dir = vec2(hash21(cell + 3.1), hash21(cell + 7.7)) * 2.0 - 1.0;
    dir /= max(length(dir), 0.0001);
    textUv += dir * pick * 0.055;
  }

  float textAlpha = texture2D(uText, textUv).a;
  float textEdge = texture2D(uText, uv + refraction * 0.35 - vec2(0.0009, 0.0)).a;
  textAlpha = max(textAlpha, textEdge * 0.34);
  textAlpha *= uTextMix;

  color += vec3(textAlpha) * (0.9 + 0.1 * uEntrance);

  /* ---------------- finish ---------------- */

  vec2 vignetteUv = (uv - 0.5) * vec2(uAspect * 0.62, 1.0);
  color *= 1.0 - 0.55 * smoothstep(0.32, 1.15, length(vignetteUv));

  float grain = hash21(uv * uResolution + fract(uTime) * 97.31);
  color += (grain - 0.5) * uGrain;

  color += (hash21(uv * uResolution + 17.77) - 0.5) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
