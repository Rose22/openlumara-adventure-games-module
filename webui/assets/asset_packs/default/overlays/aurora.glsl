/* shader overlay: aurora - default set
   curtains of northern light waving above the story: three fBm ribbons
   tinted with the campaign accent, threaded by faint rays, concentrated
   in the upper sky so the passage below stays perfectly readable.
   contract uniforms only (see adventure_shaders.js): u_time,
   u_resolution, u_aspect, u_accent, u_ink, u_page, u_dark.
   css twin: aurora.css - paints the div whenever WebGL is absent. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform vec3 u_accent;
uniform vec3 u_ink;
uniform vec3 u_page;
uniform float u_dark;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}
void main() {
    // gl_FragCoord.y is 0 at the BOTTOM: uv.y high = the sky above the page
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * 0.06;
    float band = 0.0;
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec2 q = vec2(uv.x * 2.4 + fk * 2.1 + t * (0.6 + fk * 0.25),
                      uv.y * 1.2 - fk * 0.7);
        float w = fbm(q + vec2(t, 0.0) + fbm(q * 0.7) * 0.8);
        float curtain = smoothstep(0.52, 1.05, w)
                      * smoothstep(0.40, 0.90, uv.y)
                      * (1.0 - (uv.y - 0.9) * 1.6);
        band += curtain * (0.5 - fk * 0.12);
    }
    // faint vertical rays shimmering inside the curtains
    float rays = 0.75 + 0.25 * sin(uv.x * 85.0 + fbm(uv * 5.0 + t) * 8.0);
    vec3 tint = mix(vec3(0.30, 0.95, 0.70), u_accent, 0.5);
    vec3 col = tint * (0.7 + 0.5 * band) + u_ink * 0.05;
    float a = band * rays * 0.42;
    // the night itself deepens the glow as torch logic darkens the screen
    a *= 0.75 + 0.55 * u_dark;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.6));
}
