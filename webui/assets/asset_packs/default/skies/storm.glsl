/* shader sky: thunderhead - default set. churning domain-warped storm
   clouds lit from inside by distant lightning - flashes seen as the
   clouds glow, not as a white screen. the rain that hammers through
   this sky belongs to the weather layer (weather/storm); this canvas is
   the belly. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}
// continuous path offset: smooth interpolation BETWEEN hashed bend
// points. the old version drew a constant x per segment - a literal
// staircase, which is what made the bolts look blocky
float bend(float y,float seed){
    float n=y*9.0;
    float i=floor(n),f=n-i;
    return mix(hash(vec2(i,seed)),hash(vec2(i+1.0,seed)),smoothstep(0.0,1.0,f));
}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    float t=u_time*0.03;
    float warp=fbm(vec2(uv.x*2.0-t*0.8,uv.y*1.4));
    float cl=fbm(vec2(uv.x*u_aspect*2.6+warp*2.2-t*1.4,uv.y*1.8-t*0.5));
    float body=smoothstep(0.30,0.85,cl);

    // perpetual DISTANT flicker deep in the clouds (kept gentle)
    float flash=min(1.0,pow(max(0.0,sin(u_time*2.1)+sin(u_time*3.7+2.0)-1.6),2.0)*2.2);

    // THE STRIKE: every 6.5s a fresh, hashed event - its own moment,
    // x position, zigzag seed, spread and strength
    float cyc=floor(u_time/6.5);
    float lt=u_time-cyc*6.5-hash(vec2(cyc,1.3))*4.6;   // local time
    float act=step(0.0,lt)*step(lt,0.6);
    // return strokes: exponential decay stuttered by a fast 8 Hz flicker
    float strobe=act*exp(-max(lt,0.0)*9.0)*(0.55+0.45*step(0.55,fract(lt*8.0)));
    float bx=0.15+0.7*hash(vec2(cyc,2.1));
    float spread=0.02+0.05*hash(vec2(cyc,3.3));
    float seed=hash(vec2(cyc,4.7))*97.0;
    // main channel + faint parallel branch, split into three light
    // radii: razor core, tight halo, and a WIDE skirt that floods the
    // surrounding cloud mass
    float cx=bx+(bend(uv.y,seed)-0.5)*2.0*spread*(1.15-uv.y)
              +(bend(uv.y*2.7,seed+13.0)-0.5)*spread*0.35;
    float d=abs(uv.x-cx);
    float core=exp(-d*150.0);
    float halo=exp(-d*34.0);
    float wide=exp(-d*5.0)*(0.35+0.65*uv.y);
    float cx2=bx+0.05+(bend(uv.y,seed+31.0)-0.5)*2.0*spread*1.4*(1.15-uv.y);
    float d2=abs(uv.x-cx2);
    float core2=exp(-d2*150.0);
    float halo2=exp(-d2*34.0);
    // the strike's origin glowing deep in the cloud ceiling
    vec2 gd=(uv-vec2(bx,0.85))*vec2(u_aspect,1.0);
    float bglow=exp(-length(gd)*3.6);

    vec3 col=mix(vec3(0.05,0.05,0.09),vec3(0.16,0.16,0.24),body);
    col+=body*flash*vec3(0.60,0.66,0.92)*0.9;               // thunder rumble-light
    col+=vec3(0.92,0.95,1.0)*(core+core2*0.45)*strobe*1.7;  // the crack itself
    col+=vec3(0.70,0.76,1.0)*(halo+halo2*0.5)*strobe*1.2;   // glow welded to the path
    col+=vec3(0.55,0.62,0.95)*(wide+bglow)*body*strobe*1.4; // CLOUDS lit around it
    col+=vec3(0.50,0.56,0.88)*wide*(1.0-body)*strobe*0.30;  // bleed into the gaps
    col*=1.0-0.30*smoothstep(0.65,1.0,uv.y);
    float strike=strobe*(core*1.2+halo*0.8+wide*0.8+bglow*0.8);

    float a=0.04+body*0.32+flash*body*0.30+strike*(0.50*body+0.32)
           +u_dark*0.08;
    gl_FragColor=vec4(col,clamp(a,0.0,0.78));
}
