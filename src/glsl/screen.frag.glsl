uniform sampler2D tex;
uniform vec2 res;
out vec4 outColor;

vec3 t(vec2 p, float m){
    vec3 tex = textureLod(tex, p, m).rgb;
    return tex * tex;
}

vec3 fastBloom(vec2 p,vec2 r, float mip){
    float scale = exp2(mip)/2.;
    vec3 c =
        t((p+vec2(-1.5,-0.5)*scale)/r, mip)*.1+
        t((p+vec2( 0.5,-1.5)*scale)/r, mip)*.1+
        t((p+vec2( 1.5, 0.5)*scale)/r, mip)*.1+
        t((p+vec2(-0.5, 1.5)*scale)/r, mip)*.1+
        t((p)/r,mip)*.6
        ;
    return c;
}

void main(void) {
  // outColor = textureLod(tex, gl_FragCoord.xy / res, 2.);
  outColor = vec4(0.,0.,0.,1.);
  outColor.rgb += t(gl_FragCoord.xy/res, 1.0);
  outColor.rgb += .5*fastBloom(gl_FragCoord.xy, res, 4.);
  outColor.rgb += .3*fastBloom(gl_FragCoord.xy, res, 5.);
  outColor.rgb = sqrt(outColor.rgb);
}