/* shader sky: snowglow - default set. snow-glow sky: bright at the
   bottom fading to slate above, lazy cloud shadows, faint light pillars
   up top - the backdrop under weather=snow. */
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
    vec3 col=mix(vec3(0.62,0.66,0.72),vec3(0.30,0.34,0.42),uv.y);
    float sh=fbm(vec2(uv.x*u_aspect*1.8+u_time*0.012,uv.y*1.2));
    col*=1.0-0.22*smoothstep(0.55,0.9,sh);
    float pil=pow(max(0.0,sin(uv.x*u_aspect*5.0+1.0)),8.0)*smoothstep(0.3,0.9,uv.y)*0.12;
    col+=pil*vec3(0.80,0.85,0.95);
    float a=0.06+sh*0.06+pil+u_dark*0.10;
    gl_FragColor=vec4(col,clamp(a,0.0,0.38));
}
