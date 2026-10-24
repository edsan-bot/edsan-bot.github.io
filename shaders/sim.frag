// Wave-equation simulation.
// .r holds the current height, .g holds the previous one, so a single
// ping-pong pair advances a leapfrog integration every frame.

precision highp float;

varying vec2 vUv;

uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uPoint;
uniform float uAspect;
uniform float uRadius;
uniform float uStrength;
uniform float uDamping;
uniform float uClamp;

void main() {
  vec4 state = texture2D(uState, vUv);
  float current = state.r;
  float previous = state.g;

  float left = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float right = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float down = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
  float up = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;

  float next = (left + right + down + up) * 0.5 - previous;
  next *= uDamping;

  vec2 aspectPoint = vec2(uPoint.x * uAspect, uPoint.y);
  vec2 here = vec2(vUv.x * uAspect, vUv.y);
  float dist = length(here - aspectPoint);
  float splat = smoothstep(uRadius, 0.0, dist);
  next += splat * uStrength;

  next = clamp(next, -uClamp, uClamp);

  gl_FragColor = vec4(next, current, 0.0, 1.0);
}
