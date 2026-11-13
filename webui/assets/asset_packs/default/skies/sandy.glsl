/* shader sky: sandwall - default set. a wall of sand sweeping in from
   one side with a rolling leading edge - half the window still clear;
   the backdrop under weather=sandstorm. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    float t=u_time*0.05;
    float bank=fbm(vec2(uv.x*2.2-t*2.0,uv.y*1.4));
    float edge=0.42+0.30*sin(u_time*0.04)+0.22*bank;
    float sand=smoothstep(edge-0.12,edge+0.18,uv.x);
    float billow=fbm(vec2(uv.x*4.0-t*3.0,uv.y*2.5))*sand;
    vec3 col=mix(vec3(0.82,0.68,0.44),vec3(0.62,0.46,0.28),billow);
    col*=mix(1.0,0.8,smoothstep(0.5,1.0,uv.y));
    float rim=exp(-abs(uv.x-edge)*18.0)*sand;
    float a=sand*(0.24+0.26*billow)+rim*0.15+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.5));
}
