/* shader sky: underwater - default set
   the dive, after a sunlit reef photo: EVERYTHING pours from one bright
   sun-hole just above the surface - teal water glowing directly under
   it, navy sinking into the far corners, wedges of god-rays fanning DOWN
   from the hole (they converge at the sun, not stand in vertical bars),
   a churning shimmer band across the ceiling where the water skin is
   seen from below, sparse marine snow drifting down - and the whole
   frame still refracted through the three-source ripple, so the entire
   seascape wobbles like a pool bottom. No fish, no coral: just sea.
   Kept gentle in the middle band - text stays readable through it.
   The css twin (underwater.css + bubble particles) carries the kind
   whenever WebGL is absent.
   Contract uniforms only: u_time, u_resolution, u_aspect, u_accent,
   u_ink, u_page, u_dark. */
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

// one travelling wave from a surface point: pushed outward along d,
// amplitude kept everywhere so the ripple bends the WHOLE frame, only
// a little stronger near its source
vec2 wavelet(vec2 d, float t, float ph) {
    float dist = length(d * vec2(u_aspect, 1.0)) + 0.0001;
    float w = sin(dist * 24.0 - t * 2.4 + ph);
    float amp = 0.0045 * (0.35 + 0.65 * exp(-dist * 1.8));
    return (d / dist) * w * amp;
}
// three sources drift slowly, so the interference pattern never loops
vec2 ripple(vec2 uv, float t) {
    vec2 s0 = vec2(0.30 + 0.08 * sin(t * 0.23), 0.62 + 0.06 * cos(t * 0.31));
    vec2 s1 = vec2(0.72 + 0.07 * cos(t * 0.19), 0.40 + 0.09 * sin(t * 0.27));
    vec2 s2 = vec2(0.50 + 0.22 * sin(t * 0.13 + 2.1), 0.80 + 0.05 * cos(t * 0.17));
    return wavelet(uv - s0, t, 0.0)
         + wavelet(uv - s1, t, 2.1)
         + wavelet(uv - s2, t, 4.2);
}
void main() {
    vec2 uv0 = gl_FragCoord.xy / u_resolution;   // uv.y up: surface is high
    vec2 rw = ripple(uv0, u_time);               // the refraction nudge
    vec2 uv = uv0 + rw;                          // everything below samples
    vec2 p = vec2(uv.x * u_aspect, uv.y) * 3.0;  // the warped frame
    float t = u_time * 0.1;
    // the sun hole: all light in the picture enters through this one
    // bright window just above the surface, a little off-centre
    float ox = 0.55 + 0.06 * sin(u_time * 0.06);
    float rdist = length(vec2((uv.x - ox) * u_aspect, 1.10 - uv.y));

    // the ceiling: the water skin seen from below - fast tight shimmer
    // hugging the top of the frame, brightest right under the sun
    float surfw = smoothstep(0.50, 1.00, uv0.y);
    float shimmer = 0.0;
    for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 q = p * (0.8 + fi * 0.55)
               + vec2(u_time * (0.16 + fi * 0.14), -u_time * (0.38 + fi * 0.24));
        float n = noise(q * 1.4 + fi * 9.1);
        shimmer += pow(max(0.0, sin(q.x * 2.9 + n * 7.0)), 5.0) * (0.6 - fi * 0.2);
    }

    // caustics: the three-ridge field, now concentrated toward the
    // ceiling and faded to a memory of light near the floor
    float caustic = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float x = p.x * (1.0 + fi * 0.4);
        float y = p.y * (1.0 + fi * 0.3) - t * (0.9 + fi * 0.35);
        float w = noise(vec2(x * 1.7 + fi * 3.1, y * 1.1));
        caustic += pow(max(0.0, sin(x * 2.6 + w * 6.0 + t * 2.2)), 6.0)
                 * (0.5 - fi * 0.13);
    }
    caustic *= 0.25 + 0.95 * surfw;

    // god-rays: true shafts now - wedges RADIATING from the sun hole, so
    // they fan out as they fall instead of standing as vertical stripes;
    // angular beams are narrow at the surface and widen at depth on
    // their own, and noise makes each one breathe
    float ang = atan((uv.x - ox) * u_aspect, 1.35 - uv.y);
    float shaft = pow(0.55 + 0.45 * sin(ang * 10.0 +
                  noise(vec2(ang * 2.5, t * 0.4)) * 6.0 +
                  sin(t * 0.5 + 1.7) * 0.7), 4.0);
    float rays = shaft * exp(-rdist * 1.05) * (0.35 + 0.65 * uv0.y) * 0.45;

    // the sun window itself, blazing through the surface
    float sun = exp(-rdist * 2.6) * 0.55;

    // water body: teal directly under the sun, navy in the far corners,
    // and deeper everywhere toward the floor
    vec3 deep = vec3(0.015, 0.06, 0.15);
    vec3 shallow = mix(vec3(0.16, 0.52, 0.64), u_accent, 0.15);
    vec3 col = mix(deep, shallow, smoothstep(0.0, 1.15, 1.25 - rdist)
                 * (0.45 + 0.55 * uv0.y));

    col += shimmer * surfw * vec3(0.50, 0.82, 0.82) * 0.55;
    col += caustic * vec3(0.35, 0.60, 0.62);
    col += rays * vec3(0.60, 0.78, 0.92);
    col += sun * vec3(0.75, 0.92, 0.98);

    // marine snow: sparse motes sinking slowly through the whole sea
    float snow = 0.0;
    for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 g = vec2(uv.x * u_aspect, uv.y + u_time * (0.010 + fi * 0.006))
               * (26.0 + fi * 18.0);
        vec2 cell = floor(g), fr = fract(g) - 0.5;
        float h = hash(cell + fi * 17.3);
        if (h > 0.86) {
            fr -= (vec2(hash(cell + 3.7), hash(cell + 8.3)) - 0.5) * 0.6;
            snow += exp(-dot(fr, fr) * 26.0) * (0.25 + 0.5 * hash(cell + 1.1));
        }
    }
    col += snow * vec3(0.55, 0.70, 0.75) * 0.35;

    // the ripple crests themselves catch a thin sheen of surface light
    float sheen = min(length(rw) * 90.0, 1.0);
    col += vec3(0.18, 0.32, 0.38) * sheen * 0.08;
    // torch darkness pulls the whole sea toward night
    col *= 1.0 - 0.35 * u_dark;
    float a = 0.10 + 0.05 * uv0.y + caustic * 0.16 + rays
            + shimmer * surfw * 0.22 + sun * 0.5 + sheen * 0.03;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.52));
}
