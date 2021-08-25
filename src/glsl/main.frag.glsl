uniform sampler2D prevTex;
uniform sampler2D newTex;
uniform vec2 res;
uniform float t;
uniform float dt;

out vec4 outColor;

float hash(float x) {
  return fract(sin(x*3465.1367));
}

vec3 blur(sampler2D tex, vec2 uv) {
  vec3 col = vec3(0.);
  vec2 ts = vec2(textureSize(tex, 0));
  const float s = 2.;
  for (float i = -s; i <= s; ++i) {
    for (float j = -s; j <= s; ++j) {
      float a = pow(2., -abs(i)-abs(j));
      col += a * texture(tex, uv + vec2(i, j) / ts).rgb;
    }
  }
  return col / 6.25;
}

void main(void) {
  vec2 uv = gl_FragCoord.xy / res;
  vec3 col = vec3(0.);

  col += texture(newTex, uv).rgb;
  // col += texture(prevTex, uv).rgb * 0.9;
  col += blur(prevTex, uv) * .9;

  outColor = vec4(col, 1.);
}