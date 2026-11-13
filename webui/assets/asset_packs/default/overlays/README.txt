HELD OVERLAY SKINS
==================

Each <name>.css here defines one story-window overlay mood the GM can
hold (screen_effect tool / set_scene effects=) - the frontend puts a
<div class="adv-fx adv-fx-<name>"> over the story for every held effect,
and YOUR sheet gives it a look:

  .adv-fx-mirrorgaze {
      background: radial-gradient(...);
      animation: my-mirrorgaze 12s ease-in-out infinite alternate;
  }
  @keyframes my-mirrorgaze { ... }

Names are plain words: [a-z0-9_], starting with a letter.

THIS FOLDER IS THE GLOBAL BASE PACK
-----------------------------------
Every mood it ships lives here as its own <name>.css file - there is NO
built-in mood list in the code: a name exists exactly when a file ships
it (an overlay needs a LOOK - css or glsl). The module css keeps only
the engine (#adv-effects, .adv-fx, the fade-in). The interface serves
the default set FIRST and the campaign's own set OVER it, one file per
name:

  * NEW name (in any set)  -> the moment the file exists, the GM may
    hold it (it joins the merged game_start overlay inventory; add a
    <name>.json sidecar to teach the GM what it means, see below).

DESC SIDECARS
-------------
An optional <name>.json carries the mood's meaning for the GM-facing
inventory lists: {"desc": "closing shadows"}. A sidecar ALONE never
makes a name (an overlay needs a css or glsl LOOK), and the campaign
set's sidecar wins over the base's - a re-skin can re-describe a mood.
  * EXISTING name (e.g. fog.css in a campaign set) -> a RE-SKIN. The
    set's sheet loads AFTER these base sheets, so equal-specificity
    rules win by source order. This is cascade, not replacement:
    restyle every property you want changed, and remember a base rule
    using !important (rare here) needs !important to beat.

GLSL SHADERS
------------
A <name>.glsl beside the css (or alone) makes the held mood a live WebGL
canvas carrying the same classes - the runtime is adventure_shaders.js,
the uniform contract and cap rules live in AI_GUIDE.md. The css sheet is
the fallback: no WebGL, reduced motion or a compile error swaps the
canvas back to the plain div. Showcase twins here: aurora.glsl, fog.glsl.

The pack is loaded per campaign (the frontend fetches the pack of the
campaign's own set, base included) and swapped when the set switches.
