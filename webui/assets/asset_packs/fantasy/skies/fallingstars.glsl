/* shader weather: fallingstars - default set. slow nebula wash plus real
   shooting stars: random spawn, bright head, fading tail, time-seeded. */
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
    vec3 col=vec3(0.015,0.02,0.05);
    float neb=fbm(p*1.6+vec2(u_time*0.01,0.0));
    col+=neb*neb*vec3(0.18,0.10,0.32)*0.8;
    vec2 cell=floor(p*260.0);
    float g=hash(cell);
    col+=step(0.995,g)*(0.3+0.5*sin(u_time*2.0+g*50.0))*0.7;
    for(int i=0;i<4;i++){
        float fi=float(i);
        float ph=hash(vec2(fi,17.3));
        float life=fract(u_time*0.08*(0.5+ph)+ph);
        vec2 origin=vec2(hash(vec2(fi,3.1)),0.55+0.4*hash(vec2(fi,7.7)));
        vec2 dir=normalize(vec2(-0.7-0.5*hash(vec2(fi,9.3)),-0.5));
        vec2 head=origin+dir*life*0.9;
        vec2 rel=(uv-head)*vec2(u_aspect,1.0);
        float d=length(rel);
        float along=dot(rel,-dir);
        float fade=smoothstep(0.0,0.06,life)*(1.0-smoothstep(0.7,1.0,life));
        col+=vec3(0.9,0.95,1.0)*(0.0015/(d*d+0.000004))*fade;
        col+=vec3(0.6,0.7,1.0)*max(0.0,along)*exp(-along*9.0)*exp(-abs(dot(rel,vec2(dir.y,-dir.x)))*70.0)*0.5*fade;
    }
    float a=0.10+neb*0.12+u_dark*0.08;
    gl_FragColor=vec4(col,clamp(a,0.0,0.5));
}
