/* shader weather: feathers - default set. cool dreamy wash: soft caustic
   ridges drifting sideways and a few slow out-of-focus orbs falling. */
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
    float ridge=pow(0.5+0.5*sin(p.x*3.0+fbm(p*2.0-u_time*0.04)*5.0+u_time*0.15),3.0);
    vec3 col=mix(vec3(0.78,0.84,0.94),vec3(0.60,0.66,0.84),uv.y*0.6+ridge*0.3);
    float orb=0.0;
    for(int i=0;i<4;i++){
        float fi=float(i);
        vec2 op=vec2(hash(vec2(fi,5.5)),fract(hash(vec2(fi,2.2))-u_time*0.006));
        float d=length((uv-op)*vec2(u_aspect,1.0));
        orb+=smoothstep(0.05,0.0,d)*0.25;
    }
    col+=orb*vec3(0.95,0.97,1.0);
    float a=0.10+ridge*0.10+orb*0.12+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.34));
}
