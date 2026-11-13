/* shader weather: meteorshower - default set. eight fast meteor streaks with
   flare pops lighting the whole sky in sympathy. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    vec2 p=vec2(uv.x*u_aspect,uv.y);
    vec3 col=vec3(0.012,0.014,0.035);
    float flash=0.0;
    for(int i=0;i<8;i++){
        float fi=float(i);
        float ph=hash(vec2(fi,21.7));
        float life=fract(u_time*0.14*(0.6+ph)+ph);
        vec2 origin=vec2(hash(vec2(fi,4.4)),0.85+0.15*hash(vec2(fi,8.8)));
        vec2 dir=normalize(vec2(-0.55-0.35*hash(vec2(fi,12.9)),-1.0));
        vec2 head=origin+dir*life*1.1;
        vec2 rel=(uv-head)*vec2(u_aspect,1.0);
        float d=length(rel);
        float along=dot(rel,-dir);
        float fade=smoothstep(0.0,0.05,life)*(1.0-smoothstep(0.8,1.0,life));
        col+=vec3(1.0,0.85,0.65)*(0.002/(d*d+0.000006))*fade;
        col+=vec3(0.7,0.75,1.0)*max(0.0,along)*exp(-along*6.0)
            *exp(-abs(dot(rel,vec2(dir.y,-dir.x)))*90.0)*0.6*fade;
        flash+=fade*smoothstep(0.015,0.0,d)*0.25;
    }
    col+=flash*vec3(0.25,0.28,0.45);
    float a=0.08+flash*0.3+u_dark*0.10;
    gl_FragColor=vec4(col,clamp(a,0.0,0.5));
}
