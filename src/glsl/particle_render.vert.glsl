in vec3 i_position;
in vec3 i_speed;

out vec2 v_dir;
out float v_fog;

uniform mat4 u_proj;
uniform mat4 u_view;
uniform float size;

vec4 project(vec3 p) {
  return u_proj * u_view * vec4(p, 1.);
}

void main() {
  vec4 p = project(i_position);
  gl_Position = p;
  gl_PointSize = size / p.w;
  // vec4 d1 = u_view * vec4(normalize(i_speed), 1.);
  // v_dir = d1.xy;
  //v_fog = exp(-p.z / p.w * 3.);
  v_fog = smoothstep(1., 0.99, p.z/p.w);
}