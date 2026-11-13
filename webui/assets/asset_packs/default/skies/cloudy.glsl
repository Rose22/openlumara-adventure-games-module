/* shader sky: cloudy - default set. a broken overcast SKY BAND: the
   same two domain-warped cloud decks on a slow high current -
   billowing masses with LIT TOPS and SHADED BASES instead of noise
   mush - but kept sparse and confined to the upper half of the
   window: real gaps of open page between the drifting masses, and one
   long even fade that dissolves everything before the halfway point.
   contract uniforms: u_time, u_resolution, u_aspect, u_dark. */
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
    vec2 p=vec2(uv.x*u_aspect,uv.y);
    float t=u_time;

    // sky-band mask (uv.y high = TOP of the window): clouds at full
    // voice near the top, one long gradual fade that reaches nothing
    // a little below the halfway point - the page breathes down there
    float band=smoothstep(0.38,0.76,uv.y);
    if(band<=0.002){gl_FragColor=vec4(0.0);return;}

    // domain warp: the wind curls the field BEFORE the decks sample it -
    // this is what turns fbm mush into clouds with direction
    vec2 w=vec2(fbm(p*1.4+vec2(t*0.008,0.0)),
                fbm(p*1.4+vec2(-t*0.006,3.7)));
    // high deck: big slow masses; low deck: faster, smaller, wispier
    vec2 q1=p*1.7+w*1.1+vec2(t*0.011,0.0);
    vec2 q2=p*3.4+w*0.7-vec2(t*0.024,0.0)+4.7;
    float f1=fbm(q1);
    float f2=fbm(q2);
    // sparse: the thresholds sit high so the decks break apart into
    // individual masses with honest sky between them
    float c1=smoothstep(0.56,0.82,f1);
    float c2=smoothstep(0.62,0.92,f2)*0.7;

    // fake volume: sample each deck slightly BELOW - where that reads
    // denser, this pixel sits on a base the mass in front of it shades
    float shade1=smoothstep(0.02,0.22,fbm(q1-vec2(0.0,0.10))-f1);
    float shade2=smoothstep(0.02,0.18,fbm(q2-vec2(0.0,0.06))-f2);

    // daylight fades with the torch; clouds go slate at night
    float day=1.0-0.55*u_dark;
    vec3 lit=mix(vec3(0.58,0.60,0.66),vec3(0.94,0.95,0.98),day);
    vec3 base=mix(vec3(0.30,0.32,0.40),vec3(0.66,0.69,0.76),day);

    // overcast sky underneath: paler at the horizon, deeper up top
    vec3 col=mix(vec3(0.80,0.83,0.88),vec3(0.55,0.58,0.66),uv.y);
    col*=(1.0-0.45*u_dark);

    col=mix(col,mix(base,lit,1.0-shade2),c2*0.85);
    col=mix(col,mix(base,lit,1.0-shade1),c1);

    // warm sun trying its hardest through the high gaps
    float leak=pow(max(0.0,0.48-f2),2.0)*smoothstep(0.55,0.95,uv.y)*day;
    col+=leak*vec3(1.0,0.93,0.78)*0.5;

    // the whole sky rides on the band: even the faint haze and the
    // night darkening stop dead before the halfway point, and the
    // gaps between the masses let the campaign palette through
    float a=(0.05+c1*0.34+c2*0.14+leak*0.15+u_dark*0.05)*band;
    gl_FragColor=vec4(col,clamp(a,0.0,0.5));
}
