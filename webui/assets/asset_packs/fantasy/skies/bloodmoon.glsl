/* shader weather: bloodmoon - default set. a red moon with limb shading and
   a bloody halo, thin clouds drifting across the disc, red-tainted sky. */
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
    vec2 d=(uv-vec2(0.50,0.74))*vec2(u_aspect,1.0);
    float r=length(d);
    float disc=smoothstep(0.11,0.092,r);
    float shade=disc*(0.5+0.5*smoothstep(-0.10,0.10,d.x*0.5+d.y));
    float halo=exp(-max(r-0.11,0.0)*5.0)*0.5;
    float sky=fbm(vec2(uv.x*2.0+u_time*0.02,uv.y*1.4));
    vec3 col=mix(vec3(0.05,0.01,0.02),vec3(0.14,0.03,0.04),sky);
    // thin clouds passing over the disc
    float cloud=smoothstep(0.45,0.75,fbm(vec2(uv.x*3.0-u_time*0.03,uv.y*2.0)));
    col=mix(col,vec3(0.10,0.03,0.04),cloud*0.6);
    shade*=1.0-cloud*0.55;
    col+=vec3(0.85,0.15,0.10)*(shade*1.0+halo*0.8);
    col+=disc*vec3(0.35,0.02,0.02);
    float a=0.12+sky*0.08+halo*0.4+disc*0.38+u_dark*0.08;
    gl_FragColor=vec4(col,clamp(a,0.0,0.5));
}
