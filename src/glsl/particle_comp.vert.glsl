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

float noise(float t, float h) {
  float fl = floor(t), fr = fract(t);
  fr = smoothstep(0., 1., fr);
  return mix(hash(fl+h), hash(fl+h+1.), fr);
}

float box(vec3 p, vec3 s) {
  p = abs(p) - s;
  return max(max(p.x, p.y), p.z);
}

float box2(vec2 p, vec2 s) {
  p = abs(p) - s;
  return max(p.x, p.y);
}

float sdCross(vec3 p, vec2 s) {
  p = abs(p);
  if (p.y < p.z) p.yz = p.zy;
  if (p.x < p.y) p.xy = p.yx;
  return box2(p.yz, s);
}

float crosses(vec3 p) {
  float modSize = 12.;
  float pc = floor(p.z/modSize);
  float dir = mix(-1., 1., mod(pc, 2.));
  p.x += dir;
  p.z = rep(p.z, modSize);
  vec2 size = vec2(2.5, .05);
  p.xy *= mr(time*dir*.2);
  float m = min(box(p, size.xyy), box(p, size.yxy));
  return m;
}

float path1(vec3 p) {
  float m = INF;
  for (int i=0;i<3;++i) {
    vec3 p1 = p;
    p1.xy += 3.*sin(p1.z * .5 * vec2(.2, .3) + float(i)/3.*TAU);
    m = min(m, length(p1.xy) - .03);
  }
  return m;
}

float obst1(vec3 p) {
  float modSize = 10.;
  float pc = floor(p.z/modSize);
  float dir = mix(-1., 1., mod(pc, 2.));
  p.xy *= mr(time*.2);
  p.z = rep(p.z, modSize);
  float m = max(length(p.xy)-2., abs(p.z)-.1);
  p.x -= .1*dir;
  m = max(m, p.x*dir);
  return m;
}

float dots(vec3 p) {
  p.xy *= mr(time*.2);
  p.xz += vec2(1., .3) * .5 * time;
  float modSize = 6.;
  p.xy *= mr(.4);
  p.yz *= mr(.3);
  p.xz = rep2(p.xz, vec2(modSize));
  return length(p.xz)-.05;
}

float ifs1(vec3 p) {
  vec3 s = vec3(12.);
  for(int i=0;i<2;++i) {
    p = rep2(p, s);
    s *= .5;
    p.xz *= mr(PI/4.);
    p.yz *= mr(PI/4.);
  }
  return length(p.xy)-.03;
}

float boxesRot(vec3 p) {
  float modSize = 6.;
  float pc = floor(p.z/modSize);
  p.xy *= mr(pc*.8);
  p.x -= .8;
  p.z = rep(p.z, modSize);
  return box(p, vec3(.5, 1., .1));
}

float lattice(vec3 p) {
  p.xz *= mr(PI/4.);
  p.yz *= mr(PI/6.);
  p = rep2(p, vec3(10.));
  p.xz *= mr(time*.05);
  return sdCross(p, vec2(.01));
}

float outwind(vec3 p) {
  float modSize = 8.;
  float pc = floor(p.z/modSize);
  p.xy += 3.*(hash(pc)-.5);
  p.z = rep(p.z, modSize);
  p.xy = abs(p.xy);
  if (p.x < p.y) p.xy = p.yx;
  p.x = rep(p.x, 4.);
  return max(abs(p.x) - .01, abs(p.z)-.01);
}


float map(vec3 p) {
  p.xy += 1.3*sin(p.z * .3 * vec2(.2, .3));
  p.xy += 1.4*sin(p.z * .3 * vec2(.41, .64));

  float m = INF;
  if (figure == 0) {
    m = length(p.xy) - .1;
  } else if (figure == 1) {
    m = crosses(p);
  } else if (figure == 2) {
    m = path1(p);
  } else if (figure == 3) {
    m = obst1(p);
  } else if (figure == 4) {
    m = dots(p);
  } else if (figure == 5) {
    m = lattice(p);
  } else if (figure == 6) {
    m = boxesRot(p);
  } else if (figure == 7) {
    m = ifs1(p);
  } else if (figure == 8) {
    m = outwind(p);
  } else if (figure == 20) {
    p.z += FINAL_DIST;
    p.xz *= mr(time);
    p = abs(p);
    m = dot(p, normalize(vec3(1.)))-2.;
  }
  m = max(m, length(p.xy)-4.);
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
  float freq = hash(vid*.123);
  float t = time*freq;
  vec3 randDir = vec3(
    noise(t, vid*.361),
    noise(t*1.3, vid*.825),
    noise(t*1.4, vid*.717)
  );
  randDir -= .5;
  randDir = normalize(randDir);
  return 5. * randDir;
}

void main() {
  if (compute_collision > 0) {
    v_position = vec3(map(i_position), 0., 0.);
    return;
  }

  vec4 mn = mnormal(i_position);
  float m = mn.x;
  
  vec3 acc;
  float maxSpeed;
  float airFriction;
  acc = randAcc();
  if (m > 0.) {
    vec3 n = mn.yzw;
    acc += -100.*m*m*n;
    maxSpeed = 1.;
    airFriction = .1;
  } else {
    maxSpeed = 1.;
    airFriction = 0.;
  }

  v_speed = i_speed + acc * dt;
  v_speed = normalize(v_speed) * min(length(v_speed) - airFriction * dt, maxSpeed);
  v_position = i_position + v_speed * dt;

  vec4 screenPosition;
  if (isOutOfSight(u_proj, u_view, v_position, screenPosition)) {
    v_position = generateRandomPosition(screenPosition, u_invprojview, gl_VertexID, time, 1.);
    int I = 15;
    for (int i=0; i<I; ++i) {
      vec4 mn = mnormal(v_position);
      v_position -= mn.x * mn.yzw;
    }
  }
}