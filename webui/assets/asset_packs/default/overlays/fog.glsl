/* shader overlay: fog - default set
   cold blue valley fog: domain-warped fBm banks pooling low, a luminous
   haze brightening toward the light in the upper left, and soft god-rays
   stretched along the light direction through the murk. the css twin
   (fog.css) paints the div whenever WebGL is absent. Contract uniforms
   only: u_time, u_resolution, u_aspect, u_accent, u_ink, u_page, u_dark. */
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
    vec2 uv = gl_FragCoord.xy / u_resolution;   // uv.y up
    vec2 p = vec2(uv.x * u_aspect, uv.y) * 2.6;
    float t = u_time * 0.03;

    // fog body: two warped fields steer a third, slow horizontal lean;
    // a finer swirl rides inside so near banks have fiber
    vec2 q = vec2(fbm(p + vec2(t * 0.6, t * 0.4)),
                  fbm(p + vec2(5.2, 1.3) - t * 0.5));
    float f = fbm(p + 2.1 * q + vec2(t * 1.2, -t * 0.35));
    float f2 = fbm(p * 2.6 - vec2(t * 2.2, 0.0));
    float body = smoothstep(0.10, 0.92, f * 0.85 + f2 * 0.15);

    // mist lies deep: dense at the floor, thin haze riding high
    float pool = 0.55 + 0.55 * pow(1.0 - uv.y, 1.3);

    // god-rays: noise stretched along the light direction (origin upper
    // left, y up) - high frequency across the beams, lazy along them
    vec2 L = normalize(vec2(-0.62, 0.78));
    vec2 perp = vec2(L.y, -L.x);
    vec2 lp = vec2(uv.x * u_aspect, uv.y);
    float along = dot(lp, L);                    // 1 near the light
    float rays = fbm(vec2(dot(lp, perp) * 6.5, along * 1.15 - t * 1.6));
    rays = smoothstep(0.48, 0.95, rays)
         * smoothstep(0.10, 0.75, along)         // fade far from the light
         * (0.35 + 0.65 * body);                 // beams live INSIDE fog

    // cold blue volume: shaded mist to sunlit mist, brighter near the light
    vec3 col = mix(vec3(0.235, 0.345, 0.50), vec3(0.80, 0.875, 0.95),
                   clamp(f * 0.9 + 0.25 * along, 0.0, 1.0));
    col = mix(col, u_accent, 0.05);
    col += vec3(0.30, 0.38, 0.48) * rays;        // the beams glow

    float a = body * 0.50 * pool * (0.82 + 0.40 * u_dark);
    a += rays * 0.12 * smoothstep(0.1, 0.8, along);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.62));
}

