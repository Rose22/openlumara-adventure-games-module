/* shader weather: heatstroke - fantasy set. NOT weather: failing.
   a molten arterial sky swimming in sick gradients, the whole frame
   melting with a fine violent tremor, a HEARTBEAT throbbing through
   the color, and a dark tunnel of vision closing in on slow uneven
   waves - nearly to black, the last light in the middle white-out
   faint - before the world reluctantly swims back. near-death,
   rendered. the json arms an even nastier refract on top: this kind
   distorts the PAGE itself. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}
vec3 hsv(vec3 c){vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
 vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
 return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    float t=u_time;

    // the frame itself swims: broad slow melt, plus a fine sick tremor
    vec2 m=vec2(fbm(uv*1.6+vec2(t*0.10,-t*0.07)),
                fbm(uv*1.6-vec2(t*0.08,t*0.05)+3.1));
    vec2 w=uv+(m-0.5)*0.10
           +0.008*vec2(sin(t*7.0+uv.y*9.0),sin(t*6.3+uv.x*8.0));

    // molten gradient: arterial red low, sick orange, jaundiced high,
    // the hue itself never letting the eye settle
    float hue=0.018+0.07*w.y+0.02*sin(t*0.23+w.x*3.0);
    float sat=0.72+0.18*sin(w.x*4.0+t*0.5);
    vec3 col=hsv(vec3(hue,sat,0.52+0.32*w.y));

    // heartbeat: lub-DUB every 1.4 s, each throb washes the frame hot
    float bt=fract(t/1.4);
    float s1=(bt-0.05)*12.0,s2=(bt-0.28)*12.0;
    float beat=exp(-s1*s1)+0.65*exp(-s2*s2);
    col+=beat*vec3(0.55,0.16,0.08)*0.5;

    // the tunnel: vision narrows in slow, uneven waves...
    float wav=0.5+0.5*sin(t*0.7+sin(t*0.23)*2.0);
    float R=0.85-0.62*pow(wav,3.0);
    float cx=length((w-0.5)*vec2(u_aspect,1.0));
    float edge=smoothstep(R*0.45,R,cx);
    col=mix(col,vec3(0.08,0.005,0.015),edge*0.9);
    // ... and at the tightest moment the last light in the middle
    // whites out, like a faint going away from you
    float fade=smoothstep(0.45,0.25,R);
    float center=1.0-smoothstep(R*0.40,R*0.85,cx);
    col+=fade*center*vec3(1.0,0.90,0.80)*0.55;

    // melt streaks boiling across everything
    float melt=noise(vec2(w.x*9.0,w.y*3.0-t*0.55));
    col*=0.85+0.30*melt;

    float a=0.24+edge*0.34+beat*0.10+melt*0.10+u_dark*0.06;
    gl_FragColor=vec4(col,clamp(a,0.0,0.74));
}
