uniform sampler2D prevTex;
uniform sampler2D newTex;
uniform vec2 res;
uniform float t;
uniform float dt;

out vec4 outColor;

vec3 tex(sampler2D s, vec2 p, float lod) {return textureLod(s, p, lod).rgb;}

vec3 fakeBloom(vec2 uv) {
  float I = 64.;
  vec3 col = vec3(0.);
  for (float i=0.;i<I;++i) {
    float angle = TAU*hash2(uv + i*.131 + t);
    vec2 dir = vec2(cos(angle), sin(angle));
    float len = exp(-5.*hash2(uv*2.151 + .123*i + .58*t));
    float p = exp(-len);
    len *= res.y*.3;
    vec2 offset = len*dir/res;
    float lod = log2(len)-1.;
    col += p * tex(newTex, uv + offset, lod)/I;
  }
  return col;
}

void main(void) {
  vec2 uv = gl_FragCoord.xy / res;

  vec3 col = vec3(0.);
  col += tex(newTex, uv, 1.);
  col += .5*fakeBloom(uv);

  col = mix(
    col,
    srgbToLinear(tex(prevTex, uv, 1.).rgb),
    .4
  );

  outColor = vec4(linearToSrgb(col), 1.);
}