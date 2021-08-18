uniform sampler2D tex;
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
  vec2 uv = 2.*gl_FragCoord.xy / res - 1.;
  uv.x *= res.x / res.y;

  vec3 col = vec3(0.);
  col += step(map(uv), 0.);

  col += texture(tex, gl_FragCoord.xy / res).rgb * 0.8;

  outColor = vec4(col, 1.);
}