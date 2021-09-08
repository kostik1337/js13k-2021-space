in vec3 i_position;
in vec3 i_speed;

out vec3 v_position;
out vec3 v_speed;

uniform float time;
uniform float dt;
uniform int figure;
uniform int compute_collision;
uniform mat4 u_proj;
uniform mat4 u_view;
uniform mat4 u_invprojview;

#define rep(p, s) (mod(p, s) - s/2.)
#define rep2(p, s) (abs(rep(p, 2.*s)) - s/2.)

float noise(float t) {
  float fl = floor(t), fr = fract(t);
  fr = smoothstep(0., 1., fr);
  return mix(hash(fl), hash(fl+1.), fr);
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
  // if (p.x < p.y) p.xy = p.yx;
  if (p.y < p.z) p.yz = p.zy;
  if (p.x < p.y) p.xy = p.yx;
  return box2(p.yz, s);
}

float map(vec3 p) {
  p.xy += .9*sin(p.z * vec2(.2, .3));
  p.xy += .7*sin(p.z * vec2(.41, .64));

  float m = INF;
  if (figure == 0) {
    m = length(p.xy) - .1;
  } else if (figure == 1) {
    float modSize = 6.;
    float pc = floor(p.z/modSize);
    float dir = mix(-1., 1., mod(pc, 2.));
    p.z = rep(p.z, modSize);
    vec2 size = vec2(2., .01);
    p.xy *= mr(time*dir*.2);
    m = min(box(p, size.xyy), box(p, size.yxy));
  }
  return m;
}

vec4 mnormal(vec3 p) {
  vec2 E = vec2(.001, .0);
  float m = map(p);
  vec3 normal = normalize(vec3(
    map(p+E.xyy),
    map(p+E.yxy),
    map(p+E.yyx)
  ) - m);
  return vec4(m, normal);
}

vec3 randAcc() {
  float vid = float(gl_VertexID);
  float t = 3.*time;
  vec3 randDir = vec3(
    noise(vid*.361 + t),
    noise(vid*.825 + t),
    noise(vid*.717 + t)
  );
  randDir = normalize(tan(randDir));
  return 40. * randDir;
}

void main() {
  if (compute_collision > 0) {
    v_position = vec3(map(i_position), 0., 0.);
    return;
  }
  vec3 p = i_position;
  vec4 mn = mnormal(p);
  float m = mn.x;
  
  vec3 acc;
  float maxSpeed;
  float airFriction;
  acc = randAcc();
  if (m > 0.) {
    vec3 n = mn.yzw;
    acc = -50.*m*m*n;
    maxSpeed = 1.;
    airFriction = .1;
  } else {
    vec3 p1 = 100.*p + 2.*time;
    maxSpeed = 1.;
    airFriction = 0.;
  }

  v_speed = i_speed + acc * dt;
  v_speed = normalize(v_speed) * min(length(v_speed) - airFriction * dt, maxSpeed);
  v_position = i_position + v_speed * dt;

  vec4 screenPosition;
  if (isOutOfSight(u_proj, u_view, v_position, screenPosition)) {
    v_position = generateRandomPosition(screenPosition, u_invprojview, gl_VertexID, time, 1.);
    for (int i=0; i<15; ++i) {
      vec4 mn = mnormal(v_position);
      v_position -= mn.x * mn.yzw;
    }
  }
}