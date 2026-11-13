/* shader weather: cindersnow - default set. a grey snow sky lit FROM BELOW:
   furnace-orange underglow flickering up into falling snow. */
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
    float flick=0.6+0.4*fbm(vec2(uv.x*2.0+u_time*0.5,uv.y));
    float glow=exp(-uv.y*5.0)*flick;
    vec3 col=mix(vec3(0.30,0.32,0.38),vec3(0.55,0.56,0.60),uv.y);
    col+=glow*vec3(1.0,0.42,0.12)*0.9;
    float a=0.12+glow*0.38+u_dark*0.06;
    gl_FragColor=vec4(col,clamp(a,0.0,0.45));
}
