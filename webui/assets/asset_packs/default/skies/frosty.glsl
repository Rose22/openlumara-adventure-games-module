/* shader sky: coldfront - default set. hail's hard cold sky: bright
   below, dark clouded ceiling, one stinging sun-glare high in the
   corner - the backdrop under weather=hail. */
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
    vec3 col=mix(vec3(0.55,0.60,0.66),vec3(0.25,0.28,0.33),uv.y);
    float ceiling=smoothstep(0.55,0.95,fbm(vec2(uv.x*2.0+u_time*0.015,uv.y*1.8)))*0.35;
    col*=1.0-ceiling;
    float d=length((uv-vec2(0.80,0.82))*vec2(u_aspect,1.0));
    float glare=exp(-d*6.0)*0.30+exp(-d*40.0)*0.50;
    col+=vec3(0.90,0.95,1.0)*glare;
    float a=0.06+ceiling*0.12+glare*0.35+u_dark*0.06;
    gl_FragColor=vec4(col,clamp(a,0.0,0.45));
}
