uniform sampler2D tex;
uniform vec2 res;

void main(void) {
  gl_FragColor = texture2D(tex, gl_FragCoord.xy / res);
}