in vec3 i_position;
in vec3 i_speed;

out vec3 v_position;
out vec3 v_speed;

#define mr(t) (mat2(cos(t), sin(t), -sin(t), cos(t)))

void main() {
  v_position = i_position;
  v_position.xz *= mr(.03);
  v_position.xy *= mr(.043);
  // v_position.y -= .01;
  v_speed = (v_position - i_position) + i_speed*.001; // FIXME
}