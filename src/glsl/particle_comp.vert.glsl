in vec3 i_position;
in vec3 i_speed;

out vec3 v_position;
out vec3 v_speed;

void main() {
  v_position = i_position + vec3(.001, .0, .0);
  v_speed = i_speed;
}