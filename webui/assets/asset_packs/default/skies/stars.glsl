/* shader sky: stars - default set. proper night: a milky band of fbm
   along a diagonal, depth-layered twinkles, one slow satellite glint. */
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
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}
void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    vec2 p=vec2(uv.x*u_aspect,uv.y);
    vec3 col=vec3(0.012,0.015,0.035);
    float band=exp(-pow((uv.y-(0.72-uv.x*0.35))*4.2,2.0));
    float dust=fbm(p*3.0)*band;
    col+=dust*vec3(0.28,0.30,0.48)*0.9;
    float st=0.0;
    for(int i=0;i<3;i++){
        float fi=float(i);
        vec2 q=p*(140.0+fi*110.0);
        vec2 cell=floor(q);
        float g=hash(cell+fi*7.3);
        // round pinpoint: hash a center inside the cell and fall off
        // radially, instead of lighting the whole cell as a square
        vec2 f=fract(q)-vec2(g,hash(cell+vec2(3.7,9.1)+fi*7.3));
        float tw=0.35+0.65*sin(u_time*(1.5+fi)+g*60.0);
        float s=step(0.992-fi*0.002,g)*tw*(0.6+0.4*fi)
              *smoothstep(0.12+0.10*g,0.0,length(f));
        col+=s*0.7;
        st+=s;
    }
    float sy=fract(u_time*0.02);
    float sat=smoothstep(0.004,0.0,abs(uv.y-(0.9-sy*0.8)))*step(0.2,sy)*step(sy,0.8)
            *smoothstep(0.01,0.0,abs(fract(uv.x*2.0+sy)-0.5))*0.6;
    col+=sat*vec3(0.9,0.95,1.0);
    float a=0.08+dust*0.16+st*0.45+u_dark*0.10;
    gl_FragColor=vec4(col,clamp(a,0.0,0.45));
}
