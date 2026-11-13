/* shader weather: whirlwind - default set. a dust devil: streaky noise
   columns swaying across the floor, dense at the core, flung wide on top. */
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
    float cx=0.5+0.10*sin(u_time*0.3)+0.06*sin(uv.y*5.0+u_time*0.8);
    float dx=(uv.x-cx)*u_aspect;
    float w=0.05+0.26*uv.y;
    float dens=exp(-dx*dx/(w*w*2.0));
    dens*=0.35+0.65*smoothstep(0.95,0.1,uv.y);
    float inner=fbm(vec2(dx*9.0/(uv.y+0.25),uv.y*3.0-u_time*1.4));
    vec3 col=mix(vec3(0.72,0.60,0.44),vec3(0.50,0.40,0.28),inner);
    float a=dens*(0.16+0.24*inner)+u_dark*0.04;
    gl_FragColor=vec4(col,clamp(a,0.0,0.42));
}
