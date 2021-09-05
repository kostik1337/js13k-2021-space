float hash(float x) {
  return fract(sin(x*3465.1367));
}

float hash3(vec3 x) {
  return hash(dot(x, vec3(3.13515, 2.87345, 1.917263)));
}

// curve matched using turingbot
vec3 srgbToLinear(const vec3 x){
    return 0.315206*x*((2.10545+x)*(0.0231872+x));
}

// curve matched using turingbot
vec3 linearToSrgb(const vec3 x){
    return 1.14374*(-0.126893*x+sqrt(x));
}

bool isOutOfSight(mat4 proj, mat4 view, vec3 position, out vec4 screenPosition) {
  screenPosition = proj * view * vec4(position, 1.);
  screenPosition.xyz /= screenPosition.w;
  screenPosition.z -= .5;
  vec3 maxAbsPos = vec3(1.5, 1.5, .5);
  return any(greaterThan(abs(screenPosition.xyz), maxAbsPos));
}

vec3 generateRandomPosition(vec4 screenPosition, mat4 u_invprojview, int vertexId, float time, float zminFactor) {
    float vid = float(vertexId);
    screenPosition = vec4(
      (hash(vid + .5*time + 5.*hash3(screenPosition.xyz)) - .5) * 2.,
      (hash(3.2*vid + .3*time + 13.*hash3(screenPosition.yzx + .345)) - .5) * 2.,
      //mix(1., 1., hash(vid + .8*time + 13.*hash3(screenPosition.zxy + .123))),
      1.,
      1.);
    vec4 globalPosition = u_invprojview * screenPosition;
    return globalPosition.xyz/globalPosition.w;
}