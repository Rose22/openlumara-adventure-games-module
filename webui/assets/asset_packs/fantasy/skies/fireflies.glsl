/* shader weather: fireflies - default set. dusk gradient with a low warm
   horizon and value-noise treeline silhouettes: the dots are somewhere. */
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
    vec3 col=mix(vec3(0.55,0.32,0.18),vec3(0.05,0.05,0.16),pow(uv.y,0.7));
    float haze=exp(-abs(uv.y-0.14)*8.0)*0.4;
    col+=haze*vec3(1.0,0.6,0.3);
    float trees=0.055+0.075*fbm(vec2(uv.x*u_aspect*5.0,0.7))+0.018*fbm(vec2(uv.x*u_aspect*22.0,3.1));
    float sil=smoothstep(trees+0.004,trees-0.004,uv.y);
    col=mix(col,vec3(0.015,0.015,0.03),sil);
    float a=0.14+haze*0.2+sil*0.35+u_dark*0.08;
    gl_FragColor=vec4(col,clamp(a,0.0,0.5));
}
