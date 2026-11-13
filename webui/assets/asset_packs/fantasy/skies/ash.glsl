/* shader weather: ash - default set. volcanic winter: desaturated smoke
   rolling upward and a dim red wound of a horizon at the very bottom. */
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
    float smoke=fbm(vec2(uv.x*u_aspect*1.8+u_time*0.02,-uv.y*1.2+u_time*0.10));
    vec3 col=mix(vec3(0.30,0.29,0.29),vec3(0.12,0.12,0.13),smoke);
    col=mix(col,vec3(0.40,0.39,0.38),smoothstep(0.6,0.0,uv.y)*0.5);
    float wound=exp(-uv.y*22.0)*0.6;
    col+=wound*vec3(0.55,0.12,0.05);
    float a=0.14+smoke*0.12+wound*0.4+u_dark*0.06;
    gl_FragColor=vec4(col,clamp(a,0.0,0.42));
}
