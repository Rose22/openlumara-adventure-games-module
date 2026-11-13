/* shader sky: heat - default set. high-noon heat dome: bleached
   near-white sky, swollen pale sun, and soft shimmer waves rising off
   the ground, thickest right at the floor where the air boils. the
   actual PAGE wobble is not this canvas - that's the json's refract
   block doing its job - here we only paint the visible density of
   the rising heat. */
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
    float t=u_time;

    // rising shimmer: two noise layers scrolled so the waves drift UP
    // (a fixed noise phase needs q.y to FALL with time), swayed
    // sideways by a slow breath
    vec2 q=vec2(uv.x*u_aspect,uv.y)*vec2(6.0,3.2);
    q.y-=t*0.45;
    q.x+=sin(t*0.5+uv.y*7.0)*0.25;
    float sh=(noise(q)+0.5*noise(q*2.3+vec2(0.0,-t*0.7)))/1.5;
    // heat hugs the ground and fades toward the zenith
    float low=smoothstep(1.0,0.10,uv.y);
    float shim=sh*low;

    // bleached sky and the swollen noon sun
    vec2 sd=(uv-vec2(0.5,0.94))*vec2(u_aspect,1.0);
    float sun=exp(-length(sd)*3.0);
    vec3 col=mix(vec3(0.88,0.60,0.42),vec3(0.98,0.90,0.80),uv.y);
    col+=sun*vec3(1.0,0.90,0.72)*0.50;

    // shimmer as hot, red-tinged air boiling off the ground
    col+=shim*vec3(0.30,0.10,0.03)*(0.6+sun*0.6);

    float a=0.08+shim*0.40+sun*0.28+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.50));
}
