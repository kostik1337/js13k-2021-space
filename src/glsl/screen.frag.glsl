out vec4 outColor;

uniform sampler2D tex;
uniform vec2 res;
uniform float energy;
uniform int energyState;
uniform float progress;
uniform float blackout;

#define BLUE_COL vec3(.5, .7, 1.)
#define WHITE_COL vec3(1.)
#define RED_COL vec3(1., .7, .5)

vec4 renderUi(vec2 uv) {
  float l = length(uv);
  float delta = 3./res.y;

  vec2 s = vec2(0.032, 0.03);
  float energyBorder = smoothstep(s.x, s.x-delta, l);
  energyBorder *= smoothstep(s.y-delta, s.y, l);
  float energyCircle = smoothstep(s.x*energy, s.x*energy-delta, l);

  float ang = mod(atan(uv.x, uv.y)+TAU, TAU);
  vec2 s1 = vec2(0.05, 0.04);
  float progressBorder = smoothstep(s1.x, s1.x-delta, l);
  progressBorder *= smoothstep(s1.y-delta, s1.y, l);
  progressBorder *= mix(0., 1., sin(ang*40.)*.5+.5);
  progressBorder *= step(ang / TAU, progress);

  vec3 col;
  if(l > s.x) col = BLUE_COL;
  else if (energyState == 0) col = WHITE_COL;
  else if (energyState == 1) col = BLUE_COL;
  else if (energyState == 2) col = RED_COL;
  return vec4(col, progressBorder + energyBorder + energyCircle*0.5);
}

void main(void) {
  outColor = texture(tex, gl_FragCoord.xy/res);
  vec2 uv = gl_FragCoord.xy/res*2. - 1.;
  uv.x *= res.x / res.y;
  vec4 ui = renderUi(uv);
  outColor.rgb = mix(outColor.rgb, ui.rgb, ui.a);
  outColor.rgb *= blackout;
}