# AI GUIDE — coding sky kinds

Everything a model needs to author a sky asset for the adventure_games
module. Sky = the BACKDROP layer (`#adv-sky`): washes, live shader skies
and slow backdrop particles, always UNDER the weather motes. The
human-facing quick reference is `README.txt` beside this file; this
guide is the full contract, verified against the live engine code
(`module.py`, `adventure_plus.js`, `adventure_effects.js`,
`adventure_shaders.js`, `adventure_audio.js`).

The two layers run on ONE engine, so `weather/AI_GUIDE.md` remains the
deep reference for the shared mechanics (spec fields, stem rules, the
/fx merge, css etiquette, keyframe naming). Spelled out here in full:
everything sky-side that differs.

## 1. The pipeline

1. The GM calls `set_scene(sky=<name>)` / `game_start(sky=...)`.
   `module.py` validates the name against the FILES: every `<name>`
   shipped by the campaign's asset pack **plus** the default pack's
   `skies/` folder (default files count for every campaign). No
   hardcoded kind list - a name exists exactly when a file ships it.
   Invalid names are skipped with a note, never fatal; `sky=off`
   clears the layer.
2. The frontend's `applySky()` (adventure_plus.js) builds the DOM: it
   reads the merged spec from `AdvFX.skySpec(kind)`, spawns particles,
   mounts a shipped `skies/<name>.glsl` as a live canvas; the LOOK
   comes purely from CSS.
3. The `/fx` webui route assembles the visual pack: the `skies`
   section behaves exactly like `weather` - default set first, the
   campaign's set over it file by file, JSON specs merged field by
   field, css/shader fields replaced independently.
4. `AdvFX` (adventure_effects.js) fetches the pack ~300 ms after load
   and on every asset-pack switch; until it lands, `applySky` holds the
   pending kind and re-runs on the `adv:fx` event (plan for ~300 ms).

**THIS folder is the global BASE PACK for backdrops.** Sky kinds carry
their OWN names, deliberately distinct from the weather names (the
folders are siblings - same stems would only invite mix-ups). The
built-in pairings:

| weather     | sky of its own |
|-------------|----------------|
| snow        | snowglow       |
| blizzard    | whiteout       |
| hail        | coldfront      |
| sand        | desert         |
| sandstorm   | sandwall       |
| fogdrift    | fog            |
| rain        | rainhaze       |
| storm       | thunderhead    |

plus the standalone skies cloudy, stars, sunny, heat and underwater.
A weather kind's own `<name>.glsl` paints ONLY the falling body over
transparent air; the atmosphere it falls through is a KIND OF THIS
FOLDER. `weather=rain sky=rainhaze` is the immersive pair;
`weather=rain sky=stars` is the night shower. Ship `<name>.glsl` HERE
for anything that reads as sky (cloud decks, night, haze, gloom,
underwater); ship one in `weather/` only for precipitation itself.

## 2. Files

One sky kind = up to three files sharing a stem:

- `<name>.css` — the LOOK and the MOTION (and the no-WebGL fallback)
- `<name>.glsl` — the live sky canvas (see §5)
- `<name>.json` — the particle SHAPE spec (see §4; a broken or
  non-object json is silently treated as absent)
- Unlike weather (where any single file makes a kind), a sky needs a
  LOOK: a lone `<name>.json` is just a spec sidecar, invisible to the
  backend. Ship css and/or glsl.
- Stems must match `FX_NAME_RE = ^[a-z][a-z0-9_]*$` (lowercase letter
  first, then lowercase letters/digits/underscores; no dots, dashes,
  capitals, unicode - inside the json unicode is fine).

## 3. Engine contract — who sets what

DOM built by `applySky()`:

```html
<div id="adv-sky" class="adv-sky adv-sky-<kind>">
    <canvas class="adv-skshader adv-skshader-<kind>"></canvas> <!-- if shipped -->
    <span class="adv-wp"></span>  <!-- × count -->
</div>
```

Layering facts:

- `#adv-sky` shares the weather z-band (9992) and is inserted right
  BEFORE `#adv-weather` in the DOM - same stacking level, so document
  order is what keeps the sky UNDER the weather motes. Above the
  day/night tint (9991), below the effects layer (9993). Pinned to the
  chat window (not the monitor) by adventure_bounds.js.
- The engine base (adventure_plus.css - the ONLY sky css that stays in
  the module) provides: fixed full-window layer, `pointer-events:
  none`, `overflow: hidden`, hidden unless `html.adv-on` and the
  element is not `.adv-sky-off`; and the same `.adv-wp` base as
  weather (`position: absolute; top: -14px; will-change: transform`).
- Inline particle styles: the identical table as weather §3 - spawn
  geometry lives in the JSON spec only, your css cannot cleanly
  override left/top/width/height/font-size/animation-duration/delay,
  and the engine again never sets `animation-name`,
  `animation-timing-function` or `animation-iteration-count` - your
  css MUST.

The ONE default that differs: the weather layer defaults to 42 motes,
the SKY layer defaults to ZERO. A sky spawns particles only when its
json explicitly says `"count"`. Shader-and-wash skies need no json at
all.

The `adv-sky-shader` class: when the kind's shader actually mounts AND
its spec carries `"shader_only": true`, applySky adds `adv-sky-shader`
to `#adv-sky` and the base sheet stands the kind's css down
(`#adv-sky.adv-sky-shader::before/::after/.adv-wp` are hidden - still
in the dom, cheap while display:none). If the shader gives up (fetch,
compile, context) the loader fires `adv:fx-fail`, the class comes off
and the css twin falls back in live. Kinds WITHOUT `shader_only` keep
css and canvas side by side - motes riding OVER a shader sky (twinkles
on a painted night) is a supported look.

Page refraction: skies may carry the same `refract` block as weather
(full field list in weather §4). When both layers claim it at once the
WEATHER claim outranks the sky's (syncRefract).

## 4. Spec fields

Identical to `weather/AI_GUIDE.md` §4 - one shared spawner
(`count`, `dur`, `size`, `vw`, `height`, `top`, `left`, `glyphs`,
`font`, `refract`), field-by-field campaign merge. Sky-flavoured
reminders from the base pack:

- slow `dur` suits drift: cloud banks 30-70 s (cloudy), bubble climbs
  9-18 s (underwater), twinkle cycles 2.5-6.5 s (stars).
- `top` bands keep backdrop motes where they belong: stars spawn in
  `[0, 55]`, cloud blobs in `[3, 28]` - cloudy keeps its drifting
  masses to the upper band, fading out before the halfway point.
- `"count"` is the ONLY way a sky gets motes (default here is 0, not
  42); `"shader_only": true` is the lock that lets the css fall away
  while the canvas paints (cloudy, heat).

## 5. GLSL shaders

`<name>.glsl` is THE SKY: a WebGL1 / GLSL ES 1.0 fragment canvas
appended inside `#adv-sky` (`AdvShaders.sky(name)`,
adventure_shaders.js). The css sheet stays the complete fallback: no
WebGL, reduced motion, `shader_max = 0` or a compile failure all
simply mean no canvas (and, for `shader_only` kinds, the css veil
re-appears the moment the canvas dies).

Author contract (WebGL1 fragment shader):

- include a `precision` statement; write straight to `gl_FragColor`;
  alpha 0 = the page shows through. `gl_FragCoord.y` starts at the
  BOTTOM (uv.y high = the top of the window).
- declare only the uniforms you use - the runtime supplies:
  - `uniform float u_time` — seconds since this kind mounted
  - `uniform vec2 u_resolution` — shader buffer size in px
  - `uniform float u_aspect` — width / height
  - `uniform vec3 u_accent / u_ink / u_page` — campaign palette, live
  - `uniform float u_dark` — torch darkness 0 (lit) → 1 (pitch dark)
  - `uniform float u_progress` — always 1 for held kinds (pulse-only)
- the canvas floats ABOVE the story text - keep alpha gentle. The
  showcase `underwater.glsl` clamps itself to 0.52, cloudy to 0.55;
  only `thunderhead.glsl` goes darker on purpose (0.78) and pays for
  it with lightning to look at. Text must stay readable through any
  sky.
- sky shaders always get a slot of their own - a sky and a pulse
  shader never compete with the weather/overlay `shader_max` pool.
- a lone `<name>.glsl` IS a complete kind, but ships with no fallback:
  if the shader fails there is nothing left. Add the css wash twin
  (`#adv-sky.adv-sky-<kind>::before`, copy snowglow.css) for graceful
  degradation - the pack does exactly this for every backdrop kind.
- a broken shader is skipped with a note the GM can read via
  `get_campaign` ("Shader notes...") - but test before shipping.

## 6. Sound (convention, not a file here)

A sky kind gets its audio automatically if the set's `ambience/`
folder holds a loop named `sky_<kind>.<ext>` (adventure_audio.js
tries `sky_<kind>` first, then the kind's curated fallback list - a
snowglow backdrop without its own loop happily borrows the winter bed
- and never doubles a stem the GM's ambience bed already plays). The
visible sky and its bed switch together, just like weather.

## 7. Re-skinning a built-in sky

Ship `<name>.css`, `<name>.glsl` and/or `<name>.json` in YOUR set's
`skies/` folder:

- json: field-by-field server-side merge (a one-field `{"count": 90}`
  reshapes only the count).
- css: loads AFTER this base sheet - a cascade, not a replacement;
  restyle every property you want changed.
- glsl: replaces the base shader over the base css (or vice versa -
  the fields replace independently).
- A brand-new kind joins the merged `game_start` / `get_assets` sky
  inventory and the GM may `set_scene sky=` to it immediately.

## 8. Pairing cheatsheet

- weather + its own sky (see §1 table): the full immersive look -
  `weather=storm sky=thunderhead`, `weather=snow sky=snowglow`...
- weather + a foreign backdrop: precipitation over another atmosphere -
  `weather=rain sky=stars` (night shower), `weather=sand sky=sunny`
  (noon dunes), `weather=snow sky=cloudy` (flat grey daylight).
- sky alone: pure atmosphere, no falling motes - cloudy, stars, sunny,
  heat, underwater are complete skies by themselves.
- weather alone: valid, but the motes fall through the bare campaign
  palette - usually you want a sky.

## 9. Checklist

- [ ] stem is `^[a-z][a-z0-9_]*$` and identical across the files
- [ ] the kind name is the SKY's own, not its weather's twin
- [ ] a LOOK ships (css and/or glsl) - a lone json is invisible
- [ ] css supplies `animation-name` + timing-function + iteration-count
- [ ] motes only when wanted: json must say `count` (default is 0!)
- [ ] geometry (count/dur/size/bands/glyphs) lives in the json, not css
- [ ] keyframes prefixed `adv-…-<kind>` (or reuse a base pack name)
- [ ] backdrop washes on `#adv-sky.adv-sky-<kind>::before/::after`
- [ ] optional `<name>.glsl`: precision statement in, `gl_FragColor`
      out, gentle alpha (text lives under it), only contract uniforms,
      and it paints ATMOSPHERE - precipitation belongs to weather/
- [ ] `shader_only: true` only when css+wash genuinely stand down under
      the canvas; keep the css wash twin as the fallback anyway
- [ ] optional: `sky_<name>.ogg` in the set's ambience/ for a bed
- [ ] test in a live game: `set_scene sky=<name>` (ideally beside its
      matching `weather=`), watch the [world:] tag and `get_campaign`
      for Shader notes if a glsl was involved
