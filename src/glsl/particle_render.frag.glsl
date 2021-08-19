in vec2 v_dir;

out vec4 outColor;

#define PI 3.141592

uniform mat4 u_proj;
uniform mat4 u_model;
uniform mat4 u_view;

vec3 particle(vec2 p, vec2 d) {
  vec2 dn = normalize(d);
  p *= mat2(dn.x, dn.y, -dn.y, dn.x);
  float dist = .02;
  vec3 c = vec3(0.);
  for (int i=0; i<3; ++i) {
    float theta = 2./3.*PI*float(i);
    vec2 p1 = p + dist*vec2(vec2(cos(theta), sin(theta)));
    c[i] += 1.3 * smoothstep(1., -2., (length(p1)));
    p1.x /= mix(1., 4., length(d));
    c[i] += 1. * smoothstep(.1, .07, length(p1));
  }
  return c;
}

void main(void) {
  vec2 uv = gl_PointCoord*2.-1.;
  uv.y = -uv.y;

  vec3 c = vec3(.6, .7, 1.2) * particle(uv, v_dir);
  outColor = vec4(c, 1.0);
}