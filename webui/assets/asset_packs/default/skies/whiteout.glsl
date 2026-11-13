/* shader sky: whiteout - default set. wind-streaked whiteout: advected
   noise all racing one direction, gusts strengthening and easing, a
   dark polar band up top - the backdrop under weather=blizzard. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    // gust brightens and dims the snow, it must NOT touch advection:
    // u_time*gust(t) is a position whose speed is gust+t*gust', and that
    // t*gust' term grows forever, so any oscillating gust eventually
    // reverses the flow no matter how positive it stays.
    // wind instead is a monotonic phase: constant base speed + BOUNDED
    // oscillating offsets. its speed is 1.5+0.28cos+0.39cos, which lives
    // in [0.83, 2.17] - gusting hard, never negative, ever.
    float gust=0.6+0.4*sin(u_time*0.4)+0.15*sin(u_time*1.3);
    float wind=u_time*1.5+0.7*sin(u_time*0.4)+0.3*sin(u_time*1.3);
    float s=fbm(vec2(uv.x*u_aspect*3.0+wind*2.2,uv.y*1.1));
    float s2=fbm(vec2(uv.x*u_aspect*8.0+wind*4.0,uv.y*2.0));
    float mixn=s*0.6+s2*0.4;
    vec3 col=mix(vec3(0.50,0.55,0.62),vec3(0.80,0.84,0.88),mixn);
    col*=mix(1.0,0.72,smoothstep(0.75,1.0,uv.y));
    float a=0.08+mixn*0.22*gust+u_dark*0.06;
    gl_FragColor=vec4(col,clamp(a,0.0,0.42));
}
