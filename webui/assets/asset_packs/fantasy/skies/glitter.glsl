/* shader weather: glitter - default set. a real twinkle field: hash-picked
   points flashing with individual phases and cross flares, over a pastel
   aurora blush. */
precision mediump float;
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
    vec2 p=vec2(uv.x*u_aspect,uv.y);
    float n=fbm(p*1.5+vec2(u_time*0.03,0.0));
    vec3 blush=(0.5+0.5*cos(6.283*(n*0.7+vec3(0.85,0.60,0.75))))*0.5;
    vec3 col=blush;
    vec2 g=p*24.0;
    vec2 cell=floor(g);
    vec2 f=fract(g)-0.5;
    float ph=hash(cell+4.1);
    float tw=pow(max(0.0,sin(u_time*2.5+ph*6.283)),14.0)*step(0.972,hash(cell+8.8));
    float dot_=exp(-dot(f,f)*180.0);
    float streak=exp(-abs(f.x)*140.0)*exp(-abs(f.y)*10.0)
               +exp(-abs(f.y)*140.0)*exp(-abs(f.x)*10.0);
    float twk=tw*(dot_+streak*0.5);
    col+=twk*vec3(1.0,0.95,1.0)*1.5;
    float a=0.08+n*0.08+twk*0.55+u_dark*0.04;
    gl_FragColor=vec4(col,clamp(a,0.0,0.40));
}
