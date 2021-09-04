in vec3 i_position;
in vec3 i_speed;

out vec3 v_position;
out vec3 v_speed;

uniform float time;
uniform float dt;
uniform mat4 u_proj;
uniform mat4 u_view;
uniform mat4 u_invprojview;

void main() {
  v_speed = i_speed;
  v_position = i_position + v_speed * dt;

  vec4 screenPosition;
  if (isOutOfSight(u_proj, u_view, v_position, screenPosition)) {
    v_position = generateRandomPosition(screenPosition, u_invprojview, gl_VertexID, time, 1.);
  }
}