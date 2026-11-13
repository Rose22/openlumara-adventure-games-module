/* shader sky: fog - default set
   full-screen rolling mist (the backdrop under weather=fogdrift):
   a domain-warped fBm field drifting across the
   ENTIRE window with a bigger, slower parallax layer behind it - steel-blue
   volume lit faintly from the upper left. there is no clear sky anywhere:
   the alpha floor is a true haze and the warping banks ride on top of it,
   while the giant css banks roll above as separate bodies. contract
   uniforms: u_time, u_resolution, u_aspect, u_dark. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform float u_dark;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}

void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;              // y up
    vec2 p=vec2(uv.x*u_aspect,uv.y)*2.2;
    float t=u_time*0.035;
    p.y+=0.06*sin(u_time*0.11);                        // slow breathing roll

    // near bank: two warped fields steer a third - organic, curling
    vec2 q=vec2(fbm(p+vec2(t*0.7,t*0.35)),
                fbm(p+vec2(5.2,1.3)-t*0.5));
    float near=fbm(p+2.0*q+vec2(t*1.3,-t*0.3));
    // far layer: bigger, flatter, drifting the other way for depth
    float far=fbm(vec2(p.x*0.55-t*0.6,p.y*0.8+3.0));

    // coverage everywhere: low smoothstep cutoff, so even thin spots haze
    float body=smoothstep(0.02,0.80,near*0.8+far*0.35);

    // mist lies deeper low; light still comes from the upper left
    float dens=0.78+0.30*(1.0-uv.y);
    float lit=clamp(((1.0-uv.x)*0.5+uv.y)*0.95,0.0,1.0);

    vec3 col=mix(vec3(0.27,0.38,0.53),vec3(0.78,0.86,0.94),
                 clamp(body*0.75+0.35*lit,0.0,1.0));

    // haze floor kept at 0.16: a thick wash everywhere, but the palette
    // still ghosts through the thinner air between the banks
    float a=0.16+body*0.32*dens+u_dark*0.10;
    gl_FragColor=vec4(col,clamp(a,0.0,0.62));
}
