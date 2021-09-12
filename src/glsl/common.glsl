#define PI 3.1415927
#define TAU (2.*PI)
#define INF 1e10
#define mr(t) (mat2(cos(t), sin(t), -sin(t), cos(t)))

float hash(float x) {return fract(sin(x*3465.1367));}
float hash2(vec2 x) {return hash(dot(x, vec2(12.256, 31.384584)));}
float hash3(vec3 x) {return hash(dot(x, vec3(3.13515, 2.87345, 1.917263)));}

vec3 srgbToLinear(vec3 p) {return p*p;}
vec3 linearToSrgb(vec3 p) {return sqrt(p);}

const vec3 maxAbsPos = vec3(2., 2., 1.);

bool isOutOfSight(mat4 proj, mat4 view, vec3 position, out vec4 screenPosition) {
  screenPosition = proj * view * vec4(position, 1.);
  screenPosition.xyz /= screenPosition.w;
  // screenPosition.z -= .5;
  return any(greaterThan(abs(screenPosition.xyz), maxAbsPos));
}

vec3 generateRandomPosition(vec4 screenPosition, mat4 u_invprojview, int vertexId, float time, float zminFactor) {
    float vid = float(vertexId);
    screenPosition = vec4(
      (hash(vid + .5*time + 5.*hash3(screenPosition.xyz)) - .5) * 2. * maxAbsPos.x,
      (hash(3.2*vid + .3*time + 13.*hash3(screenPosition.yzx + .345)) - .5) * 2. * maxAbsPos.y,
      //mix(1., 1., hash(vid + .8*time + 13.*hash3(screenPosition.zxy + .123))),
      1.,
      1.);
    vec4 globalPosition = u_invprojview * screenPosition;
    return globalPosition.xyz/globalPosition.w;
}