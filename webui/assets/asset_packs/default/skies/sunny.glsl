/* shader sky: sunny - default set. warm afternoon sky with a proper
   lens-flare sun: breathing core, halo ring, slow-rotating soft spokes,
   and a real internal-flare BEAD STRING - ghosts mirrored through the
   window centre along the sun axis, alternating warm and cool, the way
   a camera actually throws them. as the torch dims the sun pales and
   the flare energy drains instead of the whole sky staying golden.
   contract uniforms: u_time, u_resolution, u_aspect, u_dark. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    float day=1.0-0.75*u_dark;                 // all flare energy scales
    vec2 sp=vec2(0.80,0.82)+0.008*vec2(sin(u_time*0.11),cos(u_time*0.09));
    vec2 sd=(uv-sp)*vec2(u_aspect,1.0);
    float r=length(sd);
    vec2 cc=vec2(0.5*u_aspect,0.5);            // window centre, aspect-kept
    vec2 euv=uv*vec2(u_aspect,1.0);

    // sky: a real summer blue - saturated overhead, pale warm haze only
    // near the horizon, dusk desaturates everything toward slate
    vec3 col=mix(vec3(0.93,0.90,0.74),vec3(0.30,0.56,0.90),smoothstep(0.0,0.70,uv.y));
    col=mix(col,vec3(0.74,0.72,0.78),u_dark*0.45);
    // the sky itself lights up GOLD around the sun
    col=mix(col,vec3(1.0,0.92,0.60),smoothstep(0.90,0.0,r)*0.32*day);

    // cirrus: thin noise bands drifting slowly across the high blue -
    // the reference photo's swirl - lit warmer the closer they pass to
    // the sun. mixed into the SKY, so the flare above still punches
    // straight through the veils like a halo through real cirrus
    float cir=fbm(vec2(uv.x*u_aspect,uv.y*2.8)*2.2+vec2(u_time*0.020,u_time*0.004));
    float cirrus=smoothstep(0.52,0.86,cir)*smoothstep(0.12,0.60,uv.y);
    col=mix(col,mix(vec3(0.93,0.95,0.98),vec3(1.0,0.95,0.82),
                     smoothstep(0.75,0.10,r)),cirrus*0.55*day);

    float disc=smoothstep(0.055,0.030,r)*(0.94+0.06*sin(u_time*0.7));
    // no halo RING - photographic suns just bleed softly into the sky
    float glow=exp(-r*4.0)*0.55;

    // a dozen thin rays, breathing with the core, fading out wide. the
    // smoothstep muzzles them INSIDE the disc edge (r<0.055): un-muzzled,
    // six ray lobes at full strength around the centre drew a visible
    // hexagonal fringe onto the sun itself
    float ang=atan(sd.y,sd.x)+u_time*0.02;
    float rays=pow(0.50+0.50*sin(ang*6.0),4.0)*exp(-r*2.6)
              *0.5*smoothstep(0.055,0.16,r)
              *(0.85+0.15*sin(u_time*1.7));   // fast shimmer on the star

    // the bead string: mirror the sun THROUGH the centre, hang ghosts
    // along that axis at increasing throw - the classic internal flare
    vec2 axis=-sd;
    float b1=exp(-length(euv-(cc+axis*0.8))*16.0);
    float b2=exp(-length(euv-(cc+axis*1.5))*22.0);
    float b3=exp(-length(euv-(cc+axis*2.3))*14.0);
    float b4=exp(-length(euv-(cc+axis*3.0))*26.0);

    // sunlight is YELLOW: a white-hot nucleus bleeding gold far outward
    vec3 sun=mix(vec3(1.0,0.82,0.38),vec3(1.0,0.99,0.93),smoothstep(0.05,0.0,r));
    col+=sun*(glow*0.9+disc*1.3)*day;
    col+=vec3(1.0,0.86,0.45)*rays*day;
    col+=(vec3(1.0,0.85,0.55)*(b1+b3)+vec3(0.62,0.82,1.0)*b2)*0.13*day;
    col+=vec3(0.75,0.9,1.0)*b4*0.15*day;

    float beads=b1+b3+b2*0.9+b4;
    float a=0.04+(disc*0.55+glow*0.50+rays*0.35+beads*0.16)*day
           +cirrus*0.16*day+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.58));
}
