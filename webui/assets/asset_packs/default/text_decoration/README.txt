INLINE TEXT DECORATIONS
=======================

Each <name>.css here both DEFINES A MACRO and skins it: the moment the
file exists, the GM may write {{<name>|some words}} inline in prose and
those words land in a <span class="adv-macro adv-macro-<name>"> right
inside the sentence. Your sheet styles that span; loops survive the
streaming re-renders automatically (the engines stamp every macro span
with a --adv-phase continuity offset - use
"animation-delay: var(--adv-phase, 0s);" as the longhand AFTER your
animation shorthand, like this folder's whisper.css).

  .adv-macro-rose {
      color: #f472b6;
      animation: adv-rose-breathe 3s ease-in-out infinite;
      animation-delay: var(--adv-phase, 0s);
  }

Names are plain words: [a-z0-9_], starting with a letter - they double
as macro names inside the typewriter's regexes. stat, item, status,
statusoff, music, sfx and img are RESERVED pipe macros and can never be
decoration names; avoid the campaign's pulse names too (a decoration
shadows a same-named pulse, because {{name|tail}} reads as a decoration).

THE JSON SIDECAR
----------------
An optional <name>.json carries "desc" (the one-liner the GM reads in
the inventory) and a "render" mode when the look needs the engines' DOM
builders instead of plain css: "sparkle" scatters seeded little stars
over the text, "woozy" wraps and reels every letter (see sparkle.css /
woozy.css for the markup contracts those builders emit - their class
names and custom properties must stay).

REDUCED MOTION
--------------
Decorations are prose: they must STAY READABLE, so the guard kills only
the motion - end every animated sheet with

@media (prefers-reduced-motion: reduce) {
    .adv-macro-<name> { animation: none; }
}

Never opacity: 0 (that hides the player's words).

This folder is the global base: a campaign set shipping its own
whisper.css re-skins the macro (the set sheet loads after these base
sheets, same rules as overlays/), and a new stem like holo.css simply
adds {{holo|..}} to that campaign's decoration vocabulary - it shows up
in the game_start inventory and the per-message state block with no
code anywhere.
