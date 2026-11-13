# AI GUIDE — coding one-shot pulses

Everything a model needs to author a one-shot screen pulse for the
adventure_games module. Quick human reference: `README.txt` beside this
file. Verified against the live engine (`module.py`,
`adventure_beats.js`, `adventure_effects.js`, `adventure_type.js`,
`adventure_shaders.js`).

## 1. What a pulse is

A pulse file **defines a macro and skins it in one stroke**: the moment
`pulses/<name>.css` and/or `pulses/<name>.glsl` exists in the default
set (the global base — it ships `flash` and `poof`) or in a campaign's
set, the GM may type `{{name}}` inline in prose. The typewriter's reveal-scan fires it exactly once per
macro occurrence (so a pulse may repeat within a passage); a pulse fired
before the visual pack finished loading is queued by AdvFX (up to 8) and
replayed the moment the pack lands — the first firing is never lost.

Pulses are the opposite of overlays (`../overlays/`): ONE shot, prose
only, never held. The backend refuses pulse names in `screen_effect`,
`set_scene(effects=)` and `status_visual` links.

## 2. The pipeline

1. `/fx` route (module.py) scans default `pulses/` first, the campaign's
   `pulses/` over it, file by file (name = stem, same cascade rules as
   overlays).
2. AdvFX (adventure_effects.js) adds every landed name to the pulse
   vocabulary and loads the sheet as a `<link>` after the module css; on
   arrival it fires `adv:fx`, and the macro engines (games/type/plus)
   rebuild their name regex from `AdvFX.pulseAlt()`.
3. When the GM writes the macro, `oneShot()` (adventure_beats.js) throws
   a FRESH throwaway element per firing:
   `<div class="adv-fx adv-fx-<name>">` inside `#adv-pulses` — or a
   `<canvas>` with the same classes when a `<name>.glsl` ships (§5). A
   fresh element means the animation always plays from frame zero — your
   sheet (or shader) never has to "retrigger" anything.

## 3. Engine contract

- Holder: `#adv-pulses` — fixed, `z-index: 9995` (ABOVE the dice
  flourish, below the mode curtain), `pointer-events: none`, pinned to
  the chat window by adventure_bounds.js.
- The fired div uses the same `.adv-fx` base as overlays: absolute,
  `inset: 0`, **`opacity: 0`**. Your keyframes drive the opacity
  themselves, starting at 0 — there is NO `adv-fx-in` fade for pulses.
- **The element is removed after exactly 2000 ms.** Your animation must
  fully play AND settle to invisible comfortably inside that window (the
  base pack: flash 0.7 s, poof 1.1 s). Anything still visible at 2 s is
  yanked mid-frame — an ugly hard cut.
- Non-forced callers fire each pulse name at most once per passage (a
  guard that absorbs streaming re-parses); the typewriter's reveal-scan
  bypasses it deliberately, one firing per written `{{name}}`.
- Reduced motion: `oneShot()` returns early — **pulses never fire at all**
  when the user prefers reduced motion. The per-file guard below is the
  required belt-and-braces (see §5 why).

## 4. Writing the css

Template — copy the shape of `flash.css`:

```css
/* one-shot pulse: nova - default set
   collapsing starburst: a spell detonating, ward shattering */
.adv-fx-nova {
    background: radial-gradient(circle at 50% 50%, #fff 0%, rgba(200,150,255,.7) 35%, transparent 70%);
    animation: adv-fx-nova 1.4s ease-out forwards;
}
@keyframes adv-fx-nova {
    0%   { opacity: 0; transform: scale(0.2); }
    15%  { opacity: 1; }
    100% { opacity: 0; transform: scale(2.2); }
}
@media (prefers-reduced-motion: reduce) {
    #adv-effects .adv-fx-nova,
    #adv-pulses .adv-fx-nova { opacity: 0; }
}
```

Rules:

- The keyframe path starts `opacity: 0` and ENDS `opacity: 0` (or fully
  transparent) — with `forwards` the element then simply sits invisible
  until removal, so nothing lingers.
- `transform: scale()/rotate()` are welcome (poof swells to 2.4×); the
  div covers the whole story window, so anchor gradients deliberately
  (center burst vs full wash).
- The optional macro tail — `{{nova|the ward shatters}}` — is parsed too;
  the tail renders as the span's text in the passage, so pulses can
  carry narration without printing the braces.
- Keyframes share ONE global namespace with all sheets and the module
  css: name them `adv-fx-<name>` (pack convention) and never reuse
  another sheet's keyframes for a DIFFERENT decay.
- Colors may ride `var(--adv-accent)` etc. for palette-linked pulses.
- Comment the top of the file with the moment it fits — the GM "reads"
  your pulse through the inventory lists, so flavor matters there too.

## 5. GLSL shader pulses

`<name>.glsl` makes the shot a live WebGL one-shot: the runtime mounts a
`<canvas>` (same classes, css sheet still styles it) instead of a div
and drives the shader. Extras on top of the css contract:

- WebGL1 / GLSL ES 1.0 fragment shader; `precision` statement in,
  `gl_FragColor` out; `gl_FragCoord.y` starts at the BOTTOM.
- declare only the uniforms you use:
  - `uniform float u_progress` — THE pulse uniform: 0 → 1 over the
    duration; the shader must be fully transparent at progress 1
  - `uniform float u_time` — seconds since firing (free easing clock)
  - `uniform vec2 u_resolution`, `uniform float u_aspect`
  - `uniform vec3 u_accent / u_ink / u_page` — campaign palette, live
  - `uniform float u_dark` — torch darkness 0 → 1
- pin the cycle with a header comment: `// duration: 1.4` (seconds;
  default 1.6). The DOM element lives `duration + 300 ms`, so end
  transparent well before 1.0 and nothing gets yanked mid-frame.
- pulse shaders are EXEMPT from the `shader_max` cap (they only live a
  second or two) and share the dynamic/fixed resolution scaling.
- a failed shader degrades to the plain div, so its css twin (if any)
  still plays — but test anyway: with no css twin a broken glsl pulse
  is an invisible `{{name}}` plus a "Shader note" in `get_campaign`.
- reduced motion still wins: pulses never fire at all, shader or not.
- a glsl needs no css companion: the runtime stamps the canvas
  `opacity: 1` inline, so the shader's own alpha IS the shot.

## 6. The reduced-motion guard is mandatory

The module's engine guard (`#adv-effects .adv-fx { animation: none;
opacity: 1; }` under reduced motion) would, for anything inside
`#adv-effects`, freeze a pure-motion one-shot at FULL opacity — a
lingering whiteout or smoke cloud. JS already blocks firing under reduced
motion, but your sheet must carry the belt-and-braces exactly as
`flash.css` / `poof.css` do, covering BOTH holders:

```css
@media (prefers-reduced-motion: reduce) {
    #adv-effects .adv-fx-<name>,
    #adv-pulses .adv-fx-<name> { opacity: 0; }
}
```

## 7. Naming — these are macro names, extra care

- Stem must match `FX_NAME_RE = ^[a-z][a-z0-9_]*$`. The name goes
  straight into a client-side RegExp alternation — anything fancier
  (`a+b`, capitals, dashes) can never work and is filtered out silently.
- NEVER collide with the inline macro names the same regex checks
  first: the campaign's **Text decorations** vocabulary
  (`../text_decoration/` - the `{{name|text}}` family, listed in the
  `game_start` inventory) plus the reserved pipe macros `sfx img stat
  item status statusoff music`. A colliding pulse is swallowed by the
  other family and simply never fires.
- `flash` and `poof` are the base pulse names — in a campaign set,
  shipping those stems (`.css` or `.glsl`; the two fields replace
  independently) is a RE-SKIN of the existing macro (loads after the
  base sheets, equal specificity wins by source order; a base
  `!important` would need `!important` to beat), not a second macro.
- New pulses join the merged `game_start` / `get_assets` pulse inventory
  (fire as {{name}} macros).

## 8. Checklist

- [ ] stem `^[a-z][a-z0-9_]*$`, no collision with text-decoration or
      reserved pipe macro names
- [ ] keyframes: start invisible → flash of visible → end invisible
- [ ] total animation well under 2 s (the element is removed at 2 s)
- [ ] `forwards` fill so the invisible end state holds
- [ ] reduced-motion `opacity: 0` guard covering #adv-effects + #adv-pulses
- [ ] keyframe name prefixed `adv-fx-<name>`
- [ ] optional `<name>.glsl`: transparent at `u_progress` 1, `// duration:`
      pinned under ~1.7 s, only contract uniforms declared
- [ ] test live: start a game on the set and write `{{name}}` in a passage
      (verify it also appears in that campaign's inventory lists, and
      `get_campaign` shows no Shader notes)
