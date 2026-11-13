/* shader weather: mirage - default set. the showpiece: a warped horizon
   with sky and ground melting into each other and false water shimmering
   just below the line. */
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
    float hz=0.46;
    float wob=exp(-abs(uv.y-hz)*9.0);
    vec2 uvw=uv+vec2(0.0,sin(uv.x*24.0+u_time*2.6)*0.013*wob
                   +sin(uv.x*7.0-u_time*1.4)*0.007*wob);
    vec3 sky=mix(vec3(0.88,0.78,0.55),vec3(0.45,0.66,0.88),smoothstep(hz,1.0,uvw.y));
    vec3 ground=mix(vec3(0.72,0.55,0.34),vec3(0.55,0.40,0.24),smoothstep(hz,0.0,uvw.y));
    vec3 col=mix(ground,sky,smoothstep(hz-0.01,hz+0.01,uvw.y));
    // false water: a silver-blue band just under the line, rippling
    float water=exp(-pow((uvw.y-(hz-0.09))*11.0,2.0));
    float shimmer=0.5+0.5*sin(uv.x*40.0-u_time*4.0)*noise(vec2(uv.x*30.0,u_time));
    col=mix(col,mix(vec3(0.75,0.82,0.90),vec3(1.0),shimmer*0.4),water*0.7);
    float line=exp(-abs(uv.y-hz)*55.0)*0.5;
    col+=line*vec3(1.0,0.95,0.85);
    float a=0.15+water*0.18+line*0.4+wob*0.05+u_dark*0.05;
    gl_FragColor=vec4(col,clamp(a,0.0,0.42));
}
