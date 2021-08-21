in vec3 i_position;
in vec3 i_speed;

out vec3 v_position;
out vec3 v_speed;

uniform float time;
uniform float dt;
uniform int figure;

#define PI 3.14159265
#define INF 1e10
#define mr(t) (mat2(cos(t), sin(t), -sin(t), cos(t)))

// float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise3(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

float box(vec3 p, vec3 s) {
  p = abs(p) - s;
  return max(max(p.x, p.y), p.z);
}

float box2(vec2 p, vec2 s) {
  p = abs(p) - s;
  return max(p.x, p.y);
}

float circle(vec3 p, vec2 size) {
  vec2 q = vec2(length(p.xz)-size.x,p.y);
  return box2(q, size.yy);
}

float sdCross(vec3 p, vec2 s) {
  p = abs(p);
  if (p.x < p.y) p.xy = p.yx;
  if (p.y < p.z) p.yz = p.zy;
  if (p.x < p.y) p.xy = p.yx;
  return box2(p.yz, s);
}

float map(vec3 p) {
  p.xz *= mr(time*.2);
  p.yz *= mr(time*.17);

  float m = INF;
  if (figure == 0) {
    m = max(box(p, vec3(1.)), -sdCross(p, vec2(.9)));
  } else {
    vec2 s = vec2(1.41, .05);
    m = circle(p, s);
    m = min(m, circle(p.yzx, s));
    m = min(m, circle(p.zxy, s));
  }
  return m;
}

vec3 normal(vec3 p, float m) {
  vec2 E = vec2(.001, .0);
  return normalize(vec3(
    map(p+E.xyy),
    map(p+E.yxy),
    map(p+E.yyx)
  ) - m);
}

void main() {
  vec3 p = i_position;
  float m = map(p);
  
  vec3 acc;
  float maxSpeed;
  float airFriction;
  if (m > 0.) {
    vec3 n = normal(p, m);
    acc = -50.*m*m*n;
    maxSpeed = 2.;
    airFriction = .1;
  } else {
    vec3 p1 = 100.*p + 2.*time;
    vec3 randDir = vec3(
      noise3(p1),
      noise3(p1.yzx),
      noise3(p1.zxy)
    ) * 2. - 1.;
    randDir = normalize(tan(randDir));
    acc = 20. * randDir;
    maxSpeed = .7;
    airFriction = 0.;
  }
  // maxSpeed = 1e10;

  v_speed = i_speed + acc * dt;
  v_speed = normalize(v_speed) * min(length(v_speed) - airFriction * dt, maxSpeed);
  // v_speed *= damp;
  v_position = i_position + v_speed * dt;
}