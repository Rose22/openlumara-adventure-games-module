/* shader weather: petals - default set. pastel sky with drifting light
   pools - sun through trees you cannot see - and soft bokeh orbs. */
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
    float pool=fbm(p*1.4+vec2(u_time*0.02,-u_time*0.015));
    vec3 col=mix(vec3(0.98,0.80,0.85),vec3(0.85,0.62,0.72),uv.y);
    col*=0.88+0.30*pool;
    float orb=0.0;
    for(int i=0;i<5;i++){
        float fi=float(i);
        vec2 op=vec2(hash(vec2(fi,3.3)),hash(vec2(fi,7.1)));
        op.x=fract(op.x+u_time*0.005*(0.5+hash(vec2(fi,1.1))));
        float d=length((uv-op)*vec2(u_aspect,1.0));
        orb+=smoothstep(0.06,0.0,d)*0.30;
    }
    col+=orb*vec3(1.0,0.92,0.95);
    float a=0.10+pool*0.10+orb*0.12+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.35));
}
