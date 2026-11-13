/* shader weather: divine - default set. crepuscular god-rays rotating very
   slowly from one bright point, with glinting dust motes inside the shafts. */
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;   // sub-cell dot math bands badly on mediump
#else
precision mediump float;
#endif
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform vec3 u_accent;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(0.0+1.0,1.0)),u.x),u.y);}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    vec2 d=(uv-vec2(0.5,1.05))*vec2(u_aspect,1.0);
    float ang=atan(d.y,d.x);
    float r=length(d);
    float rays=pow(0.5+0.5*sin(ang*11.0+u_time*0.05),4.0);
    rays*=smoothstep(1.4,0.1,r);
    float bloom=exp(-r*2.2);
    vec2 dq=uv*vec2(u_aspect,1.0)*160.0;
    vec2 dcell=floor(dq);
    float dg=hash(dcell);
    // round motes: hashed center inside the cell, radial falloff
    vec2 df=fract(dq)-vec2(dg,hash(dcell+vec2(5.2,1.9)));
    float dust=step(0.985,dg)*(0.4+0.6*sin(u_time*3.0+uv.x*90.0))*rays
             *smoothstep(0.16+0.10*dg,0.0,length(df));
    vec3 col=mix(vec3(0.10,0.07,0.04),vec3(0.03,0.02,0.02),uv.y);
    vec3 gold=mix(vec3(1.0,0.85,0.55),u_accent,0.2);
    col+=(rays*0.5+bloom)*gold;
    col+=dust*0.8;
    float a=0.06+(rays*0.30+bloom*0.42+dust*0.5)*(1.0-0.4*uv.y)+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.48));
}
