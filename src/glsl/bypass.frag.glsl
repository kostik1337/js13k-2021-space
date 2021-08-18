uniform sampler2D tex;
uniform vec2 res;
out vec4 outColor;

void main(void) {
  outColor = texture(tex, gl_FragCoord.xy / res);
}