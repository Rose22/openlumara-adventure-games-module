/* shader weather: moonrays - default set. a real moon: limb-shaded disc,
   faint craters, halo and a light cone spilling down it, stars behind. */
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;   // sub-cell dot math bands badly on mediump
#else
precision mediump float;
#endif
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    vec2 d=(uv-vec2(0.68,0.78))*vec2(u_aspect,1.0);
    float r=length(d);
    float disc=smoothstep(0.09,0.075,r);
    float shade=disc*(0.55+0.45*smoothstep(-0.08,0.08,d.x*0.6+d.y));
    float crat=disc*fbm(d*60.0)*0.3;
    float halo=exp(-max(r-0.09,0.0)*6.0)*0.45;
    float cone=exp(-abs(d.x)*3.0)*smoothstep(0.0,-0.55,d.y)*0.22;
    vec3 col=vec3(0.02,0.03,0.08);
    vec2 sq=uv*vec2(u_aspect,1.0)*240.0;
    vec2 cell=floor(sq);
    float g=hash(cell);
    // round pinpoint: hashed center inside the cell, radial falloff
    vec2 sf=fract(sq)-vec2(g,hash(cell+vec2(7.3,3.1)));
    // per-star pulse choreography: two extra hashes give every star its
    // OWN rhythm (period 1.4-4.8 s) and phase, and a third decides
    // whether it pulses at all (~2/3 do, the rest hold a steady glow).
    // the pow() keeps each cycle a short shimmer with a long calm, so
    // the field winks in scattered pockets instead of breathing as one
    // synchronized sheet
    float h2=hash(cell+vec2(3.7,11.3));
    float h3=hash(cell+vec2(8.1,5.9));
    float amp=0.15+0.85*step(0.35,h2);
    float per=1.4+3.4*h2;
    float pulse=pow(0.5+0.5*sin(6.28318*(u_time/per+h3)),6.0);
    float star=step(0.996,g)*(0.35+0.65*amp*pulse)*(1.0-disc)
             *smoothstep(0.14+0.08*g,0.0,length(sf));
    col+=star*0.8;
    col+=vec3(0.85,0.90,1.0)*(shade*0.9+halo+cone+crat*0.5);
    float a=0.10+star*0.5+halo*0.5+cone+disc*0.35+u_dark*0.08;
    gl_FragColor=vec4(col,clamp(a,0.0,0.5));
}
