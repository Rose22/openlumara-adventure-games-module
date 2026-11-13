# AI GUIDE — coding overlay moods

Everything a model needs to author a held story-window overlay for the
adventure_games module. Quick human reference: `README.txt` beside this
file. Everything below is verified against the live engine
(`module.py`, `adventure_plus.js` / `adventure_plus.css`,
`adventure_effects.js`, `adventure_shaders.js`).

## 1. The pipeline

1. The GM holds an overlay with the `screen_effect` tool or
   `set_scene(effects=[...])` (and `status_visual` can link one to a
   status condition). `module.py` validates the name against the
   built-in list **plus** every `<name>` shipped by the campaign's asset
   set. A held overlay lives in the campaign's `effects` dict; it stays
   until removed — no timer.
2. `applyEffects()` (adventure_plus.js) diffs the dict on every campaign
   heartbeat: for each held name it inserts one persistent
   `<div id="adv-fx-<name>" class="adv-fx adv-fx-<name>" data-fx="<name>">`
   into `#adv-effects`. Adding or removing a DIFFERENT overlay never
   restarts this div's animations; removing the name deletes the div.
3. The `/fx` route + AdvFX (adventure_effects.js) serve the pack: the
   default set (THIS folder — the global base, 17 built-in moods, one
   file per name) is scanned first, the campaign's set overrides file by
   file and adds new names. Every name returns as a `{css, shader}` URL
   pair; the css loads as a `<link>` **after the module's own css** so a
   campaign's re-skin wins by cascade, and the glsl url feeds the shader
   runtime (adventure_shaders.js). Where a shader exists, `applyEffects`
   inserts a `<canvas>` carrying the SAME id, classes and `data-fx` as
   the div it replaces — every rule in this guide still applies to it.

## 2. Files & naming

- One overlay = one `<name>.css`, optionally plus a `<name>.glsl` live
  shader (see §5). No json exists for overlays.
- The stem must match `FX_NAME_RE = ^[a-z][a-z0-9_]*$` or the backend
  never lists it.
- A new name appears in the `game_start` / `get_assets` inventory as
  "Overlays this set adds" and is holdable immediately, no restart.
- Do NOT name a new file `flash` or `poof` (those are one-shot pulses —
  they live in `../pulses/`; a same-named file here would still be a
  held overlay mood and confuse everyone, including the GM).

## 3. Engine contract — read this before writing a line

The module css (adventure_plus.css) keeps ONLY the engine:

```css
#adv-effects { position: fixed; inset: 0; z-index: 9993;
               pointer-events: none; overflow: hidden; }
.adv-fx { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
@keyframes adv-fx-in { from { opacity: 0; } to { opacity: 1; } }
```

Three consequences authors get wrong most often:

1. **`.adv-fx` starts at `opacity: 0`.** Your sheet must bring it
   visible: reference the provided `adv-fx-in` fade in your animation
   list with `forwards` (`fog` does exactly this), or bake opacity into
   your own keyframes (`dark` ends its idle loop at opacity 1). A sheet
   that only sets a `background` shows NOTHING.
2. **The reduced-motion guard is engine-side:** under
   `prefers-reduced-motion: reduce` the module forces
   `#adv-effects .adv-fx { animation: none; opacity: 1; }`. Your overlay
   therefore becomes a STATIC frame of its final look — design so that
   frame reads well (gradients and washes are fine; pure-motion effects
   need their own per-file guard, like `daydream`'s does).
3. **The sheet is ALWAYS loaded** once the pack lands — visibility is
   gated only by the div existing. So keep every selector in your sheet
   under `.adv-fx-<name>` (or, for page-restyle moods, under an html
   class the JS itself toggles — see §5). Selectors like
   `#chat-window { ... }` at top level would apply permanently, held or
   not.

Z-order context (all pinned to the chat window by adventure_bounds.js):
tint 9991 → weather 9992 → **overlays 9993** → dice flourish 9994 →
pulses 9995 → curtain 9996. Your overlay paints over the story page;
keep `pointer-events: none` behavior (inherited from `.adv-fx`) so the
player can still click choices through it.

## 4. Writing the css

Standard shape:

```css
.adv-fx-mirrorgaze {
    background: radial-gradient(...);              /* the veil */
    animation: adv-fx-in 1.2s ease forwards,       /* REQUIRED fade-in */
               adv-mirrorgaze-idle 12s ease-in-out infinite alternate;
}
.adv-fx-mirrorgaze::before { /* second drifting parallax layer */ }
.adv-fx-mirrorgaze::after  { /* third layer / rays / texture */ }
@keyframes adv-mirrorgaze-idle { ... }
```

House style extracted from the base pack:

- Layer depth: main div = base gradient veil, `::before` = a big blurred
  drifting bank (give it `inset` past the edges, `filter: blur(...)`),
  `::after` = texture (repeating-linear god-rays, scanlines...). Copy
  `fog.css` as the three-layer exemplar.
- `backdrop-filter` (with `-webkit-` twin) is the tool for softening the
  STORY behind the mood — `fog.css` desaturates + blurs the text through
  it. Use sparingly; it's expensive.
- Palette: reference the campaign's live custom properties, not hardcoded
  colors: `var(--adv-accent)`, `var(--adv-ink)`, `var(--adv-page)`,
  `var(--adv-line)`... The GM's palette changes and your overlay follows.
  For translucent accents use
  `color-mix(in srgb, var(--adv-accent) 55%, transparent)` (see daydream).
- Light mode: handled for you — `applyTheme()` resolves the campaign
  palette's light/dark variant to match the webui mode and rewrites the
  `--adv-*` custom properties, so a variable-driven mood adapts on its
  own. (The `html.adv-light` class appearing in a couple of legacy module
  rules is never toggled by any JS — do not build on it.)
- Keyframes share ONE global namespace with every other sheet AND the
  module css: prefix yours with your mood (`adv-fog-bank`, not `drift`).
- Slow is good: a held overlay may run for an hour of play. The base
  pack idles between ~7 s and ~56 s per cycle, usually
  `ease-in-out ... infinite alternate`.
- Comment the file's top like the base pack does (mood name + the moment
  it fits) — the next AI reads those.

## 5. GLSL shaders

`<name>.glsl` turns the held overlay into a live WebGL program instead
of a css-painted div. Rules of the road:

- WebGL1 / GLSL ES 1.0 fragment shader; include a `precision`
  statement, write straight to `gl_FragColor`; alpha 0 = page shows
  through. `gl_FragCoord.y` starts at the BOTTOM.
- declare only the uniforms you use — the runtime supplies:
  - `uniform float u_time` — seconds since this overlay was held
  - `uniform vec2 u_resolution` — shader buffer size in px
  - `uniform float u_aspect` — width / height
  - `uniform vec3 u_accent / u_ink / u_page` — campaign palette, live
  - `uniform float u_dark` — torch darkness 0 (lit) → 1 (pitch dark)
  - `uniform float u_progress` — always 1 for held overlays (pulse-only)
- the canvas sits above the story text (same z as the div) — keep the
  center readable; showcase twins here are `aurora.glsl` (sky region
  only) and `fog.glsl` (max alpha 0.5, pooling low).
- css and shader are twins, not layers on top of each other's pixels:
  the css `background` paints BEHIND the canvas output, so css stays
  the complete fallback (no WebGL, reduced motion, `shader_max = 0`,
  or a compile failure — failed shaders log, report a "Shader note"
  the GM sees via `get_campaign`, and the canvas swaps back to the
  plain div).
- held shaders (overlays + weather together) share the `shader_max`
  cap (default 3): pushing past it FREEZES the oldest on its last
  frame, nothing is evicted. Internal resolution rides
  `shader_resolution`: 0 = dynamic (150% one, 100% two, 75% three+),
  any other percentage pins it.
- a canvas-only mood must survive its frozen frame: idle slowly, and
  never rely on the css twin being visible when the shader is up.
- exception: `daydream` has no element to mount (it
  toggles an html class, §6) — a glsl file for that name is ignored.
- a glsl WITHOUT any css sheet still shows: the runtime stamps the
  canvas `opacity: 1` inline (a css ANIMATION still overrides that when
  a sheet exists — animations beat inline styles).

## 6. The page-restyle special case

`daydream` is NOT a div overlay — `applyEffects()` hardcodes
it: it creates NO div and instead toggles `html.adv-daydream`.
Its sheet styles the page itself
(`html.adv-daydream .message.assistant`)
and carries its own reduced-motion guard. Also note: `adventure_audio.js`
ducks the whole soundscape through a lowpass while daydream is
held (hardcoded by name — a custom mood does not duck audio).
If you author a NEW mood, assume the div model (§3). Page-level restyle
selectors work technically (the sheet is always loaded) but must stay
gated to `html.adv-daydream`-style JS-toggled classes or you break rule 3
above.

## 7. Re-skinning a built-in mood

Drop `<name>.css` and/or `<name>.glsl` (e.g. `fog.css`, `fog.glsl`) into
your set's `overlays/` folder. The css/shader fields replace
independently - a lone glsl swaps the base shader and keeps the base
sheet, a lone css re-skins the look and keeps a failing path safe. The
css sheet loads AFTER the base sheet: equal-specificity rules win by
source order, so restyle whatever you want changed. It is a cascade, NOT a replacement
— base properties you don't redeclare stay in play, and the rare base
rule with `!important` needs `!important` to beat. No backend change is
needed: the name already validates, the div already gets the class.

## 8. Checklist

- [ ] stem is `^[a-z][a-z0-9_]*$`, not a pulse name
- [ ] animation list fades the div in (adv-fx-in forwards or equivalent)
- [ ] every selector gated (`.adv-fx-<name>`, or a JS-toggled html class)
- [ ] keyframe names prefixed with the mood
- [ ] colors ride `--adv-*` custom properties; light-mode considered
- [ ] the static reduced-motion frame still reads well
- [ ] optional `<name>.glsl`: precision statement in, `gl_FragColor`
      out, only contract uniforms declared, center stays readable
- [ ] test live: hold it via screen_effect in a running campaign
      (and `get_campaign` for Shader notes if a glsl was involved)
