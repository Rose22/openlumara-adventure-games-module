# AI GUIDE — coding an inline text decoration

Everything a model needs to author a text decoration for the
adventure_games module. Quick human reference: `README.txt` beside this
file. Verified against the live engine (`module.py`,
`adventure_effects.js`, `adventure_games.js`, `adventure_type.js`,
`adventure_plus.js`).

## 1. What a decoration is

A decoration file **defines a macro and skins it in one stroke**: the
moment `text_decoration/<name>.css` exists in the default set (the
global base) or in a campaign's set, the GM may write `{{name|words}}`
inline in prose and those words render inside
`<span class="adv-macro adv-macro-<name>">` at that exact spot in the
sentence — styled mid-stream by the marked tokenizer, by the
typewriter's open-macro edge (the body types already styled), and by
the DOM catch-up pass.

Decorations are the INLINE cousins of overlays (`../overlays/`) and
pulses (`../pulses/`): they never cover the window, never fire once, and
never mutate the campaign — they dress words that stay.

## 2. The pipeline

1. `/fx` route (module.py) scans default `text_decoration/` first, the
   campaign's `text_decoration/` over it, file by file (name = stem,
   same cascade rules as overlays). css-only: a name needs its `.css`;
   a lone `.json` is a sidecar. Reserved pipe-macro names
   (`stat item status statusoff music sfx img`) are filtered out.
2. AdvFX (adventure_effects.js) loads every sheet as a `<link>` after
   the module css and joins the name to the decoration vocabulary
   (`AdvFX.tdList()/tdAlt()/tdRender()`); on arrival it fires `adv:fx`,
   and the macro engines (games/type/plus) rebuild their kind regexes —
   the decoration names ARE the macro kinds, nothing is hardcoded.
3. The span renders with just your class. No JS builds anything for a
   plain css decoration; render modes are opt-in (see §5).
4. New names join the merged inventories: `game_start` / `get_assets`
   (with each `<name>.json` "desc") and the per-message state block, so
   the GM always sees the live vocabulary.

## 3. Engine contract

- The span is `display: inline` inside flowing text — the baseline and
  the text color must stay readable; `color: transparent` is only right
  with a `background-clip: text` gradient (glitter/fire/divine trick).
- **Loop-clock continuity:** the typewriter re-renders the passage up to
  sixty times a second, and every rebuilt span is a fresh element. The
  phase pass (adventure_plus.js) stamps each span with a negative
  `--adv-phase` equal to the span's age, so a loop keeps running across
  rebuilds — but only if the sheet reads it: put
  `animation-delay: var(--adv-phase, 0s);` as a longhand AFTER the
  `animation:` shorthand (the shorthand resets the delay).
- Colors may ride the palette vars: `var(--adv-accent)`,
  `var(--adv-link)`, `var(--adv-link-hover)`, `var(--adv-ink-soft)`.
  Add an `html.adv-light .adv-macro-<name>` rule when the dark look is
  illegible on a white page (see frost.css).
- Keyframes share ONE global namespace: name them `adv-<name>-...` and
  give every sheet its OWN copy of a pattern (glitter, rainbow and
  divine each ship their own shine) so a set re-skinning one decoration
  never disturbs another.

## 4. Writing the css

Template — copy the shape of `whisper.css`:

```css
/* text decoration: rose - my set
   the words bloom pink, breathing */
.adv-macro-rose {
    color: #f472b6;
    animation: adv-rose-breathe 3s ease-in-out infinite;
    animation-delay: var(--adv-phase, 0s);
}
@keyframes adv-rose-breathe {
    0%, 100% { opacity: 0.7; }
    50%      { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
    .adv-macro-rose { animation: none; }
}
```

The reduced-motion guard is MANDATORY for any animated sheet and must
kill the ANIMATION ONLY — a decoration is the player's story text, so
it must stay fully visible (`animation: none`, never `opacity: 0`).

## 5. Render modes (the json sidecar)

`<name>.json` beside the sheet may declare `"render"`:

- `"sparkle"` — the engines scatter seeded little stars over the words
  (`.adv-sparkle-w` per word, `.adv-sparkle-dot` stars with
  `--adv-sdur`/`--adv-sdelay`). The seeded rolls are stable per word so
  the stars never jitter while typing.
- `"woozy"` — the engines wrap every word (`.adv-woozy-w`) and every
  letter (`.adv-woozy-l`, staggered via `--adv-lbase`) so a wobble
  chains through the text like a wave.

With a render mode your sheet skins the BUILDER'S markup — keep those
class names and custom properties exactly (sparkle.css / woozy.css are
the contract). A re-skin of a built-in may change every look detail and
may drop the mode (plain `{"desc": ...}` or no json at all = plain css
span). The mode works for ANY name — a scifi set can give `{{static}}`
the sparkle stars. The DOM catch-up pass (adventure_plus.js) applies
render modes too; the streaming marked path implements `sparkle` as an
HTML-string twin, while `woozy` letters appear once the passage settles
— both degrade to the plain styled span, never break.

## 6. Naming

- Stem must match `FX_NAME_RE = ^[a-z][a-z0-9_]*$`. The name goes
  straight into a client-side RegExp alternation — anything fancier
  (`a+b`, capitals, dashes) can never work and is filtered out silently.
- NEVER claim a reserved pipe macro: `stat item status statusoff music
  sfx img sd`. The backend drops such sheets from the vocabulary; the
  frontend would match the pipe macro first anyway.
- Avoid the campaign's PULSE names (`../pulses/`): `{{name|tail}}` reads
  as a decoration, so a colliding pulse can never fire with a tail and
  the decoration silently shadows it.
- `whisper shout glitter glow rainbow glitch echo fire frost mind
  shadow divine runes woozy sparkle` are the default base names — in a
  campaign set, shipping those stems is a RE-SKIN of the existing macro
  (loads after the base sheets, equal specificity wins by source order;
  a base `!important` would need `!important` to beat), not a second
  macro.

## 7. Checklist

- [ ] stem `^[a-z][a-z0-9_]*$`, not reserved, no pulse collision
- [ ] `.adv-macro-<name>` styled; text stays READABLE (incl. light mode)
- [ ] loops: `animation-delay: var(--adv-phase, 0s);` longhand after
      the shorthand
- [ ] keyframes prefixed `adv-<name>-...`
- [ ] reduced-motion `animation: none` guard (NEVER opacity: 0)
- [ ] `<name>.json` "desc" one-liner for the GM inventory
- [ ] render mode only when the builder markup is wanted and kept
- [ ] test live: start a game on the set, write `{{name|hello}}` in a
      passage (verify it joins the state block's "Text decorations"
      list, styles mid-typing, and survives reduced motion)
