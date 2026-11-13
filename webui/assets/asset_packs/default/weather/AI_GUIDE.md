# AI GUIDE — coding weather kinds

Everything a model needs to author a weather asset for the adventure_games
module. The human-facing quick reference is `README.txt` beside this file;
this guide is the full contract, verified against the live engine code
(`module.py`, `adventure_plus.js`, `adventure_effects.js`, `adventure_shaders.js`,
`adventure_audio.js`).

## 1. The pipeline

1. The GM calls `set_scene(weather=<name>)` / `game_start(weather=...)`.
   `module.py` validates the name against the FILES: every `<name>`
   shipped by the campaign's asset pack **plus** the default pack's
   `weather/` folder (default files count for every campaign). There is
   no hardcoded kind list anywhere - a name exists exactly when a file
   ships it. Invalid names are skipped with a note, never fatal.
2. The frontend's `applyWeather()` (adventure_plus.js) builds the DOM:
   it reads the merged particle spec from `AdvFX.weatherSpec(kind)` and
   spawns particles; the LOOK comes purely from CSS.
3. The `/fx` webui route (module.py) assembles the visual pack: it scans
   the **default set first, then the campaign's set over it, file by
   file**. Every name comes back as a `{css, shader}` URL pair (empty
   string = absent) plus the merged spec; JSON specs merge **field by
   field** across the two folders, and so do the css/shader fields -
   shipping only `<name>.glsl` keeps the base css sheet, shipping
   `<name>.css` replaces the base look whole.
4. `AdvFX` (adventure_effects.js) fetches `/fx?chat=<id>` ~300 ms after
   load and on every asset-pack switch, then appends each css as a
   `<link data-advfx>` **after the module's own css** in `<head>` — that
   source order is what makes overrides win by cascade. When the pack
   lands it fires the `adv:fx` event, which re-runs `applyWeather()`.
   Until the pack is ready, `applyWeather` holds a pending kind (weather
   simply appears when the pack arrives — plan for that ~300 ms).

**THIS folder (the default set's weather/) is the global BASE PACK**:
the kinds it ships - each as a `<name>.css` (+ `<name>.json` spec, plus
an optional `<name>.glsl` foreground shader that paints the
precipitation ITSELF over transparent air (the backdrop it falls
through is a kind of the sibling `skies/` folder); the css particles
remain the complete fallback) - are the weather vocabulary every
campaign starts from. A campaign set may ship its own `weather/` folder to re-skin any
of them file-by-file and to add entirely new kinds; a shader-only kind
is fine too, give it a `{"count": 0}` json so the engine spawns no
unstyled motes. A new kind needs **only
files** — no code change, anywhere. Everything is rescanned per request,
so new drops work live (a page reload is still wise for the css cache).

## 2. Files

One weather kind = up to three files sharing a stem:

- `<name>.css` — the LOOK and the MOTION
- `<name>.glsl` — an optional live shader painting the falling body itself (see §6; the backdrop sky is a skies/ kind)
- `<name>.json` — the particle SHAPE spec (a JSON object; a broken or
  non-object json is silently treated as absent)
- At least one of them must exist.
- The stem must match `FX_NAME_RE = ^[a-z][a-z0-9_]*$` (lowercase letter
  first, then lowercase letters/digits/underscores) or the file is
  invisible to the backend. No dots, dashes, capitals, or unicode stems.
  (Unicode is fine INSIDE the json, e.g. glyph strings — files are read
  as UTF-8.)

## 3. Engine contract — who sets what

DOM built by `applyWeather()`:

```html
<div id="adv-weather" class="adv-weather adv-weather-<kind>">
    <span class="adv-wp"></span>  <!-- × count -->
</div>
```

The engine base (adventure_plus.css — the ONLY weather css that stays in
the module) provides:

- `#adv-weather`: fixed full-window layer, `z-index: 9992`,
  `pointer-events: none`, `overflow: hidden`, hidden unless
  `html.adv-on` and the element is not `.adv-weather-off`. Pinned to the
  chat window (not the monitor) by adventure_bounds.js.
- `.adv-wp`: `position: absolute; top: -14px; will-change: transform;`
  — this is why the default motion reads as "falls from above".

Inline styles the engine stamps on EVERY particle (inline beats your css
unless you use `!important`):

| inline property      | comes from                                             |
|----------------------|--------------------------------------------------------|
| `left`               | random in spec `left` band (default `[0, 100]` %)      |
| `top`                | only if spec `top` present — random in band (%)        |
| `animation-duration` | random in spec `dur` (default `[6, 16]` s)             |
| `animation-delay`    | random `-14 s … 0 s` (particles start mid-flight)      |
| `textContent` + `font-size` | TEXT particles only: a random `glyphs` entry and a random size from `font` (default `[11, 26]` px) |
| `width` (+`height`)  | dot particles with spec `size`: random px — or vw when `vw: true`; `height` field gives a px range for shapes taller than wide |

Consequences — the two golden rules:

1. **Spawn geometry belongs to the JSON spec, not the css.** The engine
   never reads your css; your css cannot cleanly override left/top/
   width/height/font-size/animation-duration/animation-delay.
2. **The engine never sets `animation-name`, `animation-timing-function`
   or `animation-iteration-count` — your css MUST.** A `.adv-wp` rule
   without `animation-name` produces perfectly placed, completely frozen
   dots.

## 4. Spec fields (all optional)

```json
{
  "count": 40,           // particles to spawn (engine default 42; 0 = none)
  "dur":   [2, 6],       // per-particle travel time in seconds
  "size":  [2, 5],       // particle width+height in px (engine default [2,5])
  "vw":    true,         // size is in VIEWPORT WIDTHS instead (wide banks)
  "height": [80, 150],   // px — for shapes taller than wide
  "top":   [10, 90],     // vertical spawn band in % (omit: css decides —
                         //   top:-14px for falling, your bottom: for rising)
  "left":  [-20, 80],    // horizontal spawn band in % (default 0–100)
  "glyphs": ["XII", "VI", "⧖"],  // TEXT particles instead of dots
  "font":  [11, 26],     // px size range for glyph particles
  "refract": {           // PAGE refraction: bends the chat window ITSELF
    "scale": 8,          //   (text and art included) through an injected
    "freq": [0.004, 0.007], // SVG displacement filter - the sky shakes the
    "speed": 11,         //   WORDS. ALL subfields optional; the chain is
    "octaves": 2,        //   rebuilt per kind containing ONLY what you
    "type": "fractalNoise", // ask for. speed = SEAMLESS LOOP seconds.
    "shake": 0,          // bend (scale/freq/speed/octaves/type) then,
    "morph": 0,          // in chain order: shake (px quake), morph
    "blur": 1.2,         //   (+erode decay / -dilate bleed, 0-2), blur
    "poster": 0,         //   (px haze), poster (2-32 discrete levels,
    "gamma": 1,          //   CRT banding!), gamma (0.2-3 brightness
    "convolve": "",      //   curve), convolve "sharpen"|"emboss"|
    "duotone": null,     //   "edges", duotone {shadow,light} hex pair,
    "sheen": 0,          //   sheen = orbiting wet specular highlight
    "scan": 0,           //   (3 scale, or {scale,exponent,color,z}),
    "grain": 0,          //   scan = CRT scanline darkness (4px pitch),
    "sat": 1.15,         //   grain (0-1 boiling film noise), sat
    "hue": 0,            //   (0=drained 3=hyperreal), hue (WHOLE
    "glow": { "size": 5, //   rainbow turns per loop), glow bloom halo
      "color": "#7fd8ff" //   {size,color}. Combos: CRT = poster 5 +
    }                    //   scan .5 + grain .3 + glow; decay = morph .6
  }                      //   + sat .3 + blur .4; wet = sheen 3 + blur .5;
                         //   haunted = hue 1 + duo red/black + grain.
                         //   (engine: setPageRefract)
}
```

A campaign set's partial spec merges over the base field-by-field: a
re-skin json of just `{"count": 90}` reshapes only the count and keeps
everything else of the built-in kind.

## 5. Writing the css

Primary selector: `.adv-weather-<kind> .adv-wp` (some base sheets add the
`#adv-weather` prefix to raise specificity — do the same when overriding
a base sheet that uses it). A sheet provides:

- the LOOK: `background` / `color` / `border-radius` / `filter` /
  `box-shadow`
- `animation-name`, `animation-timing-function`,
  `animation-iteration-count: infinite`

Recipes from the base pack (copy any neighbour as a template):

- **Falling** (snow, rain, petals): nothing special — the base
  `top: -14px` spawns at the top; keyframes travel `translateY` past
  `104vh`. Rain forces `width: 1px !important` (see §7 for why the
  `!important` rides into every rain re-skin).
- **Rising** (embers, glitter, timewarp): `top: auto; bottom: -Xpx;` on
  `.adv-wp`, keyframes climb to negative `vh`.
- **Text particles** (timewarp): set `background: none` and give the
  span `color`, `text-shadow`, `font-family` — the engine supplies the
  glyphs and font-size from the spec.
- **Veil washes + motes** (blizzard, sandstorm): use
  `#adv-weather.adv-weather-<kind>::before` / `::after`
  (`position: absolute; inset: 0;` gradients). A full-window BACKDROP
  wash is no longer weather material - ship it as a `skies/` kind.
  To kill the particles entirely use `"count": 0` (the shader-only
  rain/storm locks) — `.adv-wp { display: none; }` works as a second
  lock.
- **Tint knob**: glitter reads `hsl(calc(var(--adv-w-hue, 300)) 90% 75%)`
  — `--adv-w-hue` is a convention nothing sets globally, so a re-skin can
  re-tint by defining it on the particle rule instead of rewriting colors.

Keyframes: every sheet shares ONE global keyframe namespace. Follow the
pack convention `adv-<motion>-<kind>` (`adv-fall-snow`,
`adv-rise-timewarp`) so sheets never collide. Reusing another BASE sheet's
keyframes is safe — the default pack always loads before any campaign
sheet (glitter deliberately rides embers' `adv-rise-embers`).

Reduced motion: no guard needed here. `applyWeather()` clears the kind
altogether when the user prefers reduced motion — weather never renders,
so weather sheets never need `@media (prefers-reduced-motion: reduce)`.

## 6. GLSL shaders

`<name>.glsl` turns the kind's FALLING BODY into a live WebGL canvas,
mounted inside `#adv-weather` UNDER the particles
(`adventure_shaders.js`). It paints the precipitation itself over a
transparent background - the atmosphere the streaks fall through
belongs to the sibling `skies/` folder, under its OWN name
(`weather=rain` pairs with `sky=rainhaze` - the full pairing table
lives in `skies/README.txt`). The css sheet keeps working next to it and the motes ride on top, and
the css alone stays the complete fallback: no WebGL, reduced motion,
`shader_max = 0` or a compile failure all simply mean no canvas.

Author contract (WebGL1 / GLSL ES 1.0 fragment shader):

- include a `precision` statement; write straight to `gl_FragColor`;
  alpha 0 = the page shows through. `gl_FragCoord.y` starts at the
  BOTTOM (uv.y high = the top of the window).
- declare only the uniforms you use — the runtime supplies:
  - `uniform float u_time` — seconds since this kind mounted
  - `uniform vec2 u_resolution` — shader buffer size in px
  - `uniform float u_aspect` — width / height
  - `uniform vec3 u_accent / u_ink / u_page` — campaign palette, live
  - `uniform float u_dark` — torch darkness 0 (lit) → 1 (pitch dark)
  - `uniform float u_progress` — always 1 for held kinds (pulse-only)
- the canvas floats ABOVE the story text — keep alpha gentle,
  doubly so in these transparent-foreground shaders: the gaps between
  your streaks are exactly where the SKY kind shows through. The
  backdrop showcase `skies/underwater.glsl` clamps itself to 0.52
  max; text must stay readable through any layer.
- held shaders (weather + overlays together) share the `shader_max`
  cap (default 3) - a sky and a pulse shader always get a slot of
  their own; when the newest pushes past the cap, the OLDEST freeze on
  their last frame. Internal resolution rides `shader_resolution`:
  0 = dynamic (150% one shader, 100% two, 75% three+), any other
  percentage pins it.
- a glsl needs no css companion: the runtime stamps the canvas
  `opacity: 1` inline, and the particle spans ride on top regardless.
  BUT beware the particle default: with no json (or a json without
  `count`) `applyWeather()` still spawns 42 plain falling dots over the
  shader - a SHADER-ONLY kind ships a `{"count": 0}` json as its no-motes
  lock (a `{"count": 0}` json beside a lone `<name>.glsl` is all it takes).
  A campaign set can ship its own `<kind>.glsl` to override the base
  shader (e.g. a personal `underwater.glsl`) without touching the css.
- a broken shader is skipped with a note the GM can read via
  `get_campaign` ("Shader notes...") — but test before shipping; the
  css twin is what players see when it fails.

## 7. Sound (convention, not a file here)

A weather kind gets its audio automatically if the set's `ambience/`
folder holds a loop named `weather_<kind>.<ext>` (adventure_audio.js
tries `weather_<kind>` first, then the kind's curated fallback list, and
never doubles a stem the GM's ambience bed already plays). Give a new
kind a voice by dropping `weather_<name>.ogg` next door — the visible
kind and its bed switch together. The matching sky kind follows the
same rule: a `sky_<kind>.<ext>` loop in `ambience/` beds the backdrop
(see `skies/AI_GUIDE.md`).
(Hardcoded, not extensible by files: while `snow` is active the whole
soundscape low-passes to 1200 Hz; new kinds are not muffled.)

## 8. Re-skinning a built-in kind

Ship `<name>.css`, `<name>.glsl` and/or `<name>.json` in YOUR set's
`weather/` folder (the css/shader fields replace per field, so a lone
glsl re-skins the sky over the base css):

- json: field-by-field server-side merge (safe to send one field).
- css: loads AFTER this base sheet, so equal-specificity rules win by
  source order. It is a cascade, not a replacement — restyle every
  property you want changed; any base rule using `!important` (rain's
  width) needs `!important` to beat.
- A brand-new kind joins the merged `game_start` / `get_assets` weather
  inventory and the GM may `set_scene weather=` to it immediately.

## 9. Checklist

- [ ] stem is `^[a-z][a-z0-9_]*$` and identical between the css and json
- [ ] css supplies `animation-name` + timing-function + iteration-count
- [ ] rising kinds reset `top: auto; bottom: -Xpx`
- [ ] geometry (count/dur/size/bands/glyphs) lives in the json, not css
- [ ] keyframes prefixed `adv-…-<kind>` (or reuse a base pack name)
- [ ] json is a valid JSON object
- [ ] optional: `weather_<name>.ogg` in the set's ambience/ for a bed
- [ ] optional `<name>.glsl`: precision statement in, `gl_FragColor` out,
      gentle alpha (text lives under it), only contract uniforms
      declared, and it paints ONLY the falling body over clear air -
      atmosphere belongs to skies/
- [ ] test in a live game: `set_scene weather=<name>`, watch the [world:] tag
      (and `get_campaign` for Shader notes if a glsl was involved)
