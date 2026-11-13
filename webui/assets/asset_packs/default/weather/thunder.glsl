/* shader weather: storm - default set. the foreground half of the
   storm: the same comet-column rain as plain rain, but hammered on a
   far steeper lean and a wilder gust. the churning cloud belly and its
   internal lightning live in its backdrop sky (skies/thunderhead) -
   this
   canvas paints ONLY the falling water over a transparent background,
   so the flashes behind it keep reading clean through the gaps. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
// one rain layer: continuous runs down hashed columns, where EVERY
// column owns its speed, phase and dash density - wide per-column
// speeds are what stop the curtain reading as one scrolling sheet
// (xp), while the layers' differing angles provide the chaos (diabol)
float rain(vec2 uv,float t,float density,float slant,float columns,float speed){
    vec2 p=vec2(uv.x*u_aspect+uv.y*slant,uv.y);   // wind shear
    float px=p.x*columns;
    float col=floor(px);
    float on=step(hash(vec2(col,7.3)),density);
    float sp=speed*(0.55+0.9*hash(vec2(col,1.7)));    // own terminal speed
    float ph=hash(vec2(col,4.1));                    // own phase
    float rows=columns*0.08*(0.5+1.1*hash(vec2(col,8.7)));
    float qi=(p.y+t*sp)*rows+ph;
    float di=floor(qi);                              // which drop of the column
    float q=fract(qi);
    // comet profile: crisp head, exponential blur tail trailing above
    // it; length is hashed PER DROP so the curtain never looks stitched
    float len=0.20+0.60*hash(vec2(col,di+1.9));
    float dash=smoothstep(0.0,0.03,q)*exp(-q*3.2/max(len,0.05));
    // per-drop micro-lean keyed to the dash INDEX - the old version
    // re-keyed mid-dash and made every streak twitch sideways 7x a cell
    float h4=hash(vec2(col,di));
    float d=px-(col+0.2+0.6*hash(vec2(col,2.9))+(0.2-q)*(h4-0.5)*0.5);
    float w=exp(-d*d*100.0);                      // ~1px gaussian hairline
    float mass=0.4+1.1*hash(vec2(col,di+6.3));    // some drops blaze brighter
    return on*w*dash*mass;
}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    // the wind itself wanders: the whole rain's lean breathes over
    // ~30s so the direction is never pinned
    float gust=0.07*sin(u_time*0.19)+0.04*sin(u_time*0.11+2.0);
    // three curtains on visibly different angles AND depths: far drift,
    // fast near layer on its own lean, and a sparse bold one steeping
    // hardest through everything
    float rainAmt=rain(uv,u_time,0.45,-0.45+gust,460.0,0.25)*0.22
                 +rain(uv,u_time,0.32,-0.75+gust,260.0,0.5)*0.50
                 +rain(uv,u_time,0.20,-1.10+gust,170.0,0.9)*0.35;
    vec3 col=vec3(0.75,0.82,0.95)*rainAmt*0.85;
    // no strike-synced brightening here: the two canvases run their own
    // clocks, so the bolts stay the sky's alone and never fight the drops
    float a=rainAmt*0.50+u_dark*0.03;
    gl_FragColor=vec4(col,clamp(a,0.0,0.60));
}
