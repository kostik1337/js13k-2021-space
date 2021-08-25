in vec3 i_position;
in vec3 i_speed;

out vec3 v_position;
out vec3 v_speed;

uniform float time;
uniform float dt;
uniform int compute_collision;
uniform mat4 u_proj;
uniform mat4 u_view;
uniform mat4 u_invprojview;

float hash(float x) {
  return fract(sin(x*3465.1367));
}

float hash3(vec3 x) {
  return hash(dot(x, vec3(1.3, 1.5, 1.7)));
}

void main() {
  v_speed = i_speed;
  v_position = i_position + v_speed * dt;
  if (compute_collision == 0) {
    vec4 screenPosition = u_proj * u_view * vec4(v_position, 1.);
    screenPosition.xyz /= screenPosition.w;
    screenPosition.z -= .5;
    if (any(greaterThan(abs(screenPosition.xyz), vec3(1., 1., .5)))) {
      float vid = 0.;
      screenPosition = vec4(
        (hash(vid + .5*time + 5.*hash3(screenPosition.xyz)) - .5) * 2.,
        (hash(3.2*vid + .3*time + 13.*hash3(screenPosition.yzx + .345)) - .5) * 2.,
        mix(1., 1., hash(vid + .8*time + 13.*hash3(screenPosition.zxy + .123))),
        1.);
      vec4 globalPosition = u_invprojview * screenPosition;
      v_position = globalPosition.xyz/globalPosition.w;
      // v_position = vec3(0.);
    }
  }
}