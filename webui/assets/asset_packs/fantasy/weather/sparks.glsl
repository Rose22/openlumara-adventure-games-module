/* shader weather: sparks - default set. dark forge basement: heavy vignette,
   furnace glow at the floor, flare pops on inharmonic pulses. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    float flick=0.7+0.4*fbm(vec2(uv.x*3.0+u_time*0.6,1.0));
    float glow=exp(-uv.y*4.0)*flick;
    float pop=min(1.0,pow(max(0.0,sin(u_time*1.7)+sin(u_time*2.9+1.0)-1.35),2.0)*4.0);
    vec3 col=vec3(0.03,0.02,0.015);
    col+=(glow*0.8+pop*glow*2.2)*vec3(1.0,0.45,0.15);
    col*=1.0-0.45*smoothstep(0.35,0.95,length((uv-0.5)*vec2(u_aspect,1.0)));
    float a=0.08+glow*0.30+pop*0.12+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.45));
}
