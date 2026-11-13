# AI GUIDE - authoring a campaign palette

Everything a model needs to author a palette file for the
adventure_games module. Quick human reference: README.txt beside this
file. Verified against the live engine (module.py `_read_palette` /
`_resolve_palette`, adventure_plus.js `applyTheme` / `applyTint`).

## 1. What a palette is

`palettes/<name>.json` defines a campaign's whole visual identity:
`game_start(palette="<name>")` resolves it against the campaign's
asset pack over the default base, and the frontend paints every
resolved variant's fields as inline CSS vars on <html> - page, ink,
sidebar, borders, links, the works. Palettes ship a light AND a dark
variant; the frontend picks the variant matching the webui's current
mode, so design BOTH.

## 2. The variant fields (all required unless noted)

  dark        bool - true on the dark variant, false on the light one
  accent      the campaign's signature color (buttons, highlights)
  link        choice-link text; link_hover its hover state
  page        the story page background
  ink         story prose color; ink_soft secondary prose
  line        rules/dividers inside the story
  ui_bg1/2/3  sidebar / panels / inputs, light-to-heavy surfaces
  ui_text     primary UI text; ui_text_soft secondary; ui_text_muted tertiary
  ui_border   every UI border

Contrast contract: ink on page and ui_text on ui_bg1..3 must clear
comfortable reading contrast - the story is read for hours. Keep link
visibly distinct from ink.

## 3. The optional "tint" map (per variant)

Each variant may carry `"tint": { "dawn", "morning", "afternoon",
"dusk", "night", "deepnight" }` - each value a complete CSS
background (a linear-gradient is the house style) that the frontend
lays over the story window as the campaign clock turns. Tints blend
NORMALLY, so the alpha in the colors IS the strength:
- light variants: warm washes by day (0.10-0.24), deep dark blues by
  night (0.28-0.46 - night means night).
- dark variants: a dark veil over a dark page is invisible - lean on
  LIGHT-tinted hues instead (moonlight blue, ember orange) at
  0.12-0.24, and slightly stronger for deepnight.
- dawn/dusk are the theatrical ones (two-stop gradients); morning and
  afternoon barely whisper; transitions crossfade over 2.5s.
- a palette with no tint map keeps the module's built-in neutral tints.

## 4. Naming & merging

- stem must match ^[a-z][a-z0-9_]*$ - it is the name the GM passes.
- default set stems (rose_quartz sakura moonstone void_violet
  emberfall moss_and_gold neon_dream parchment): shipping the same
  stem in a campaign set REPLACES that palette wholesale for its
  campaigns - a partial json needs no fields merged in; it simply
  wins.
- labels are for humans; keep them one line, the genre hint in
  parentheses is the house style.

## 5. Checklist

- [ ] stem lowercase-safe, label + both variants complete
- [ ] "dark" bool correct per variant (it drives the frontend's mode)
- [ ] reading contrast verified in BOTH variants
- [ ] tint map optional but lovely; light pages get dark nights,
      dark pages get luminous nights
- [ ] test live: game_start(palette="<name>") on your set, flip the
      webui between light and dark, and advance the clock (the tint
      follows it)
