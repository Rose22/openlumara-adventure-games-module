/* shader weather: bloodrain - default set. oily red-black sky with rivulets
   crawling down the glass, as if the window itself is bleeding. */
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
    vec3 col=mix(vec3(0.06,0.01,0.02),vec3(0.16,0.03,0.05),
        uv.y+0.3*fbm(vec2(uv.x*2.0+u_time*0.03,uv.y*1.5)));
    // rivulets: per-column drip, bright head with a fading trail
    float xi=floor(uv.x*24.0);
    float ph=hash(vec2(xi,3.7));
    float sp=0.05+0.09*hash(vec2(xi,9.1));
    float yy=fract(uv.y+u_time*sp+ph);
    float w=0.010+0.014*hash(vec2(xi,5.2));
    gl_FragColor=vec4(col,clamp(a,0.0,0.45));
}
