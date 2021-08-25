in vec2 v_dir;
in float v_pow;

out vec4 outColor;

#define PI 3.141592

uniform float power;

vec3 particle(vec2 p) {
  float dist = .1;
  vec3 c = vec3(0.);
  for (int i=0; i<3; ++i) {
    float theta = 2./3.*PI*float(i);
    vec2 p1 = p + dist*vec2(vec2(cos(theta), sin(theta)));
    float len = length(p1);
    len *= len;
    c[i] += 1. * smoothstep(.9, .2, len);
  }
  return c;
}

void main(void) {
  vec2 uv = gl_PointCoord*2.-1.;
  uv.y = -uv.y;

  vec3 c = vec3(.6, .7, 1.2) * particle(uv) * power * v_pow;
  outColor = vec4(c, 1.);
}