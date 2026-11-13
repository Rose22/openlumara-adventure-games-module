/* shader weather: dust - default set. dry tan haze with fine grain drift
   and faint strata bands, visibility fading with height. */
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
    vec2 p=vec2(uv.x*u_aspect,uv.y);
    float drift=fbm(p*1.8+vec2(u_time*0.05,-u_time*0.02));
    float strata=0.5+0.5*sin(p.y*14.0+drift*4.0+u_time*0.08);
    float fine=noise(p*80.0+vec2(u_time*0.4,0.0));
    vec3 col=mix(vec3(0.78,0.66,0.46),vec3(0.52,0.42,0.30),uv.y*0.7);
    col*=0.85+0.3*drift;
    col*=1.0-0.12*strata;
    col+=fine*0.05;
    float a=0.12+drift*0.12+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.38));
}
