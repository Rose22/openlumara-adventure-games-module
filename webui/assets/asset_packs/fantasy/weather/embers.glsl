/* shader weather: embers - default set. smoke-black sky over a breathing
   furnace glow at the floor, heat bands rolling upward. */
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
    float breathe=0.7+0.4*fbm(vec2(uv.x*1.6+u_time*0.12,u_time*0.05));
    float glow=exp(-uv.y*3.6)*breathe;
    float bands=pow(max(0.0,sin(uv.y*16.0-u_time*0.8+fbm(uv*2.0)*4.0)),3.0)*glow*0.3;
    vec3 col=vec3(0.02,0.015,0.02);
    col+=glow*vec3(0.9,0.32,0.08)*0.9+bands*vec3(1.0,0.5,0.2);
    float smoke=fbm(vec2(uv.x*2.0-u_time*0.03,uv.y*1.4+u_time*0.06));
    col+=smoke*0.04*vec3(0.5,0.4,0.4);
    float a=0.08+glow*0.34+bands*0.6+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.48));
}
