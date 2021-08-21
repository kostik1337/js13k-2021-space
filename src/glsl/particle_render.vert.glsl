in vec3 i_position;
in vec3 i_speed;

out vec2 v_dir;

uniform mat4 u_proj;
uniform mat4 u_model;
uniform mat4 u_view;
uniform vec2 u_nearfar;

vec4 project(vec3 p) {
  return u_proj * u_view * vec4(p, 1.);
}

void main() {
  vec4 p = project(i_position);
  gl_Position = p;
  gl_PointSize = 10.0 / p.w;
  vec4 d1 = u_view * vec4(normalize(i_speed), 1.);
  v_dir = d1.xy;
}