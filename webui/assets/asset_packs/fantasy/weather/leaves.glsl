/* shader weather: leaves - default set. golden hour: a low amber sun on one
   side, gradient haze, one long soft shaft of afternoon light. */
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
    vec3 col=mix(vec3(0.95,0.72,0.40),vec3(0.55,0.62,0.75),pow(uv.y,0.8));
    vec2 sp=vec2(0.22,0.20);
    float d=length((uv-sp)*vec2(u_aspect,1.0));
    float sun=exp(-d*4.0)*0.55+exp(-d*18.0)*0.5;
    // one long soft shaft across the window from the sun
    float line=(uv.y-sp.y)-0.55*(uv.x-sp.x)*u_aspect;
    float shaft=exp(-line*line*300.0)*smoothstep(1.1,0.0,d)*0.25;
    float haze=fbm(vec2(uv.x*2.0+u_time*0.02,uv.y*1.6))*0.2;
    col+=(sun+shaft)*vec3(1.0,0.80,0.45)+haze*vec3(0.9,0.7,0.5)*0.4;
    float a=0.12+sun*0.35+shaft*0.5+haze*0.2+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.42));
}
