in vec3 i_position;

void main() {
  gl_Position = vec4(i_position.xy, 0., 1.);
  gl_PointSize = 10.0;
}