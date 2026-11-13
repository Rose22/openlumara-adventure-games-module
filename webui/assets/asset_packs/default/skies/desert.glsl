/* shader sky: desert - default set. a blowing desert: sun smeared
   behind ochre haze, pale sky up top, dirty gold low, and three fast
   scouring sheets of grit racing right-to-left (the same wind the css
   grains of weather=sand ride) that thicken toward the floor. */
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
    float t=u_time;
    // the sun, buried in the dust: a dim ochre smear, low-ish
    vec2 sd=(uv-vec2(0.35,0.72))*vec2(u_aspect,1.0);
    float sun=exp(-length(sd)*4.0);

    // base haze, itself slowly breathing
    vec3 col=mix(vec3(0.62,0.46,0.28),vec3(0.85,0.74,0.54),
                 uv.y*0.6+fbm(vec2(uv.x*2.0,t*0.02))*0.45);
    col+=sun*vec3(1.0,0.85,0.55)*0.30;

    // scouring bands: streaky noise scrolling LEFT (q.x grows with t),
    // each layer faster, finer and higher than the last
    float st=0.0;
    for(int i=0;i<3;i++){
        float fi=float(i);
        float spd=1.6+fi*1.3;
        vec2 q=vec2(uv.x*(3.0+fi*2.4)+t*spd, uv.y*(5.0+fi*3.5));
        float n=noise(q+vec2(noise(q*1.7+t*0.3)*2.2,0.0));
        float band=smoothstep(0.55,0.95,n);
        band*=smoothstep(0.70-fi*0.15,0.05,uv.y);   // this band's ceiling
        st+=band*(0.34-fi*0.07);
    }
    // the grit reads as darker streaks catching a bit of gold
    col*=1.0-0.32*st;
    col+=st*vec3(0.45,0.32,0.16);

    float a=0.16+st*0.32+sun*0.15+(1.0-uv.y)*0.10+u_dark*0.06;
    gl_FragColor=vec4(col,clamp(a,0.0,0.62));
}
