/* shader sky: hearthroom - fantasy set
   the interior of a cozy wooden home, seen as the room itself: a wall
   of horizontal planks (every board its own shade of oak, grain combed
   along the length, dark seams where the boards meet), a heavy ceiling
   beam across the top with its shadow sloping down the wall beneath it,
   and the whole room lit by a hearth just off the bottom-left corner -
   an amber falloff that breathes with the fire, bright on the boards
   near it, the far corners cooling into blue-ash gloom where the light
   never reaches. Torch darkness dims the room but lets the embers
   stand out. Alpha kept gentle - the story text lives right under this
   glow, and a warm read through the whole frame.
   The css twin (hearthroom.css + drifting dust motes) carries the kind
   whenever WebGL is absent.
   Contract uniforms only: u_time, u_resolution, u_aspect, u_accent,
   u_dark. */
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_aspect;
uniform vec3 u_accent;
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
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;      // uv.y up: ceiling is high
    vec2 p = vec2(uv.x * u_aspect, uv.y);

    /* ---- the plank wall ------------------------------------------- */
    float H = 0.075;                                // plank height, window-relative
    float row = floor(uv.y / H);
    float inplank = fract(uv.y / H);
    float rowh = hash(vec2(row, 7.0));              // this board's own personality

    // grain combed along the board: x stretched long, y tight, each
    // plank phased apart so no two boards ever share a pattern
    vec2 gp = vec2(p.x * 2.4, p.y * 26.0) + vec2(rowh * 31.0, row * 17.0);
    float grain = fbm(gp);
    float rings = 0.5 + 0.5 * sin(grain * 9.0 + p.x * 1.4 + rowh * 40.0);
    rings = pow(rings, 3.0);                        // thin comb lines along the grain

    // board-to-board shade variation from walnut to honey oak,
    // and a dark seam pressed into every board edge
    vec3 oak    = vec3(0.46, 0.27, 0.13);
    vec3 walnut = vec3(0.17, 0.095, 0.055);
    vec3 wood   = mix(walnut, oak, 0.35 + 0.5 * rowh + 0.22 * grain);
    wood *= 0.86 + 0.30 * rings;
    float seam = 1.0 - smoothstep(0.0, 0.012, inplank);
    seam += smoothstep(0.988, 1.0, inplank);
    wood *= 1.0 - 0.55 * min(seam, 1.0);

    /* ---- the ceiling beam ------------------------------------------ */
    float beam = smoothstep(0.905, 0.935, uv.y);
    float bgrain = fbm(vec2(p.x * 3.0, uv.y * 60.0));
    vec3 beamcol = mix(vec3(0.13, 0.075, 0.045), vec3(0.30, 0.17, 0.09), bgrain);
    wood = mix(wood, beamcol, beam);
    // the beam throws a soft shadow down the top of the wall
    float beamshade = smoothstep(0.70, 0.88, uv.y) * (1.0 - beam) * 0.35;

    /* ---- the hearth -------------------------------------------------- */
    // the fire sits just off the bottom-left corner; its glow breathes
    float flick = 0.82 + 0.11 * noise(vec2(u_time * 1.9, 11.0))
                       + 0.07 * sin(u_time * 6.3 + sin(u_time * 2.6));
    vec2 hearth = vec2(0.10 * u_aspect, -0.02);
    float hd = length(p - hearth);
    float glow = exp(-hd * 1.5) * flick;
    // a second, fainter warmth bouncing along the floorboards
    float bounce = exp(-abs(uv.y - 0.02) * 5.0)
                 * exp(-abs(uv.x - 0.12) * 1.6) * flick * 0.35;

    vec3 firelight = mix(vec3(1.0, 0.52, 0.20), u_accent, 0.18);
    vec3 col = wood * (0.42 + 1.15 * glow) + bounce * firelight * 0.5;

    // far from the fire the room cools toward blue-ash gloom
    float far = smoothstep(0.55, 1.25, hd);
    col = mix(col, col * vec3(0.55, 0.60, 0.80) + vec3(0.02, 0.02, 0.04), far * 0.5);

    col *= 1.0 - beamshade;
    // torch darkness dims the house but lets the embers stand out
    col *= 1.0 - 0.42 * u_dark;
    col += glow * u_dark * vec3(0.10, 0.045, 0.015);

    float a = 0.30 + glow * 0.14 + beam * 0.12 + far * 0.10;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.55));
}
