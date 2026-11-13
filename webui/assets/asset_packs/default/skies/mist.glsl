/* shader sky: rainhaze - default set. the air rain falls through: a low
   grey fbm haze, slightly thicker toward the floor and darkening with
   the torch - the backdrop half of the rain pair (the curtain itself
   lives in the weather layer, weather/rain). banks kept soft and slow
   so the campaign palette still breathes between them. */
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
    // the same slow wandering haze the old all-in-one rain shader drew,
    // now free-standing: thickest low, thinning toward the zenith
    float h=fbm(vec2(uv.x*u_aspect*1.6+u_time*0.012,uv.y*1.2-u_time*0.008));
    float fog=smoothstep(0.45,0.80,h)*(1.0-0.30*uv.y);
    vec3 col=fog*vec3(0.60,0.66,0.76)*0.55;
    float a=0.05+fog*0.12+u_dark*0.06;
    gl_FragColor=vec4(col,clamp(a,0.0,0.30));
}
