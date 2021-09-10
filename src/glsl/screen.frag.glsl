out vec4 outColor;

uniform sampler2D tex;
uniform vec2 res;
uniform float energy;

vec4 renderUi(vec2 uv) {
  vec2 s = vec2(0.032, 0.03);
  float l = length(uv);
  float delta = 3./res.y;
  float border = smoothstep(s.x, s.x-delta, l);
  border *= smoothstep(s.y-delta, s.y, l);
  float energyCircle = smoothstep(s.x*energy, s.x*energy-delta, l);
  return vec4(vec3(1.), border + energyCircle*0.5);
}

void main(void) {
  outColor = texture(tex, gl_FragCoord.xy/res);
  vec2 uv = gl_FragCoord.xy/res*2. - 1.;
  uv.x *= res.x / res.y;
  vec4 ui = renderUi(uv);
  outColor.rgb = mix(outColor.rgb, ui.rgb, ui.a);
}