# AI GUIDE - authoring fonts for the adventure

Everything a model needs to add fonts to an adventure_games asset pack.
Quick human reference: README.txt beside this file. Verified against
the live engine (module.py `_resolve_font` / `_font_faces`, the
`/fonts` route, adventure_plus.js font-face loader).

## 1. Two ways to ship a font

**Stack file** - `fonts/<name>.txt` holds exactly one CSS font stack:

    Iowan Old Style, 'Palatino Linotype', Georgia, serif

The name joins the campaign's font inventory; game_start(font="<name>")
bakes the stack into the campaign verbatim. Only works if the player's
machine has the named face - fine for system classics, wrong for a
distinctive display font.

**Real font file** - `fonts/<name>.ttf/.otf/.woff/.woff2`. The frontend
fetches the campaign's face map from /fonts and registers each as the
family `adv-<name>` with `font-display: swap`; game_start resolves the
name to the stack `'adv-<name>', Georgia, serif`. The player needs NO
font installed - the file IS the font. This is how a scifi set ships a
terminal face or a fantasy set a blackletter.

A stem with both ships wins as the FILE. Multiple formats of one stem:
ship them all, they are listed woff2-first and the browser picks.

## 2. Merging (same doctrine as every kind)

The default set's fonts/ is the global base (georgia palatino garamond
typewriter modern live there as stacks); the campaign's set overrides
same-named stems file-by-file and adds new names freely. game_start
also accepts ANY raw CSS font stack as font= for one-off looks.

## 3. Practical rules

- stem must match ^[a-z][a-z0-9_]*$ (it becomes the CSS family name
  `adv-<stem>` and the GM-facing inventory name).
- a display face is for HEADINGS energy - the whole campaign renders in
  the chosen font, so a wild blackletter gets exhausting; prefer
  readable book faces and save display faces for sets with a strong
  voice.
- woff2 is the format to ship: smallest, universally supported on
  modern browsers. Keep one file per font NAME (no separate bold/
  italic files under separate names - the engine picks ONE face per
  campaign and synthesizes the rest).
- font-display: swap means the story paints in Georgia for a moment on
  a cold load - unavoidable and harmless.

## 4. Checklist

- [ ] stem lowercase-safe
- [ ] woff2 (or ttf) next to nothing else, or one clean stack line in .txt
- [ ] test live: game_start(font="<name>") on your set - the passage
      must visibly switch (check DevTools > computed font-family shows
      adv-<name>)
