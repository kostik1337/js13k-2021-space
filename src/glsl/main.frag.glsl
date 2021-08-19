uniform sampler2D prevTex;
uniform sampler2D newTex;
uniform vec2 res;
uniform float t;

out vec4 outColor;

float map(vec2 p) {
  float s = .2;
  p.x -= t;
  p.x = mod(p.x, s) - s/2.;
  return length(p) - .03;
}

void main(void) {
  vec2 uv = gl_FragCoord.xy / res;
  vec3 col = vec3(0.);

  col += texture(newTex, uv).rgb;
  col += texture(prevTex, uv).rgb * 0.7;

  outColor = vec4(col, 1.);
}