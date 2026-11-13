ONE-SHOT PULSE SKINS
====================

Each <name>.css here both DEFINES A MACRO and skins it: the moment the
file exists, the GM may fire {{<name>}} inline in prose - the typewriter
scans for it, and the interface throws a fresh
<div class="adv-fx adv-fx-<name>"> over the story window that removes
itself 2 s later. Your sheet animates it once; end transparent so
nothing lingers (copy this folder's flash.css / poof.css as a
template).

  .adv-fx-nova {
      background: radial-gradient(...);
      animation: my-nova 1.8s ease-out forwards;
  }
  @keyframes my-nova { from { opacity: 1; } to { opacity: 0; } }

Names are plain words: [a-z0-9_], starting with a letter - they double
as macro names inside the typewriter's regexes.

GLSL SHADERS
------------
A <name>.glsl here (or with a css twin) fires the macro as a live WebGL
one-shot canvas: u_progress 0->1, "// duration: 1.4" header pins the
cycle, be invisible at progress 1. Contract details: AI_GUIDE.md
(adventure_shaders.js is the runtime). A failed shader swaps back to the
div, so its css twin still plays.

Pulses stay OFF-LIMITS to screen_effect/set_scene (they cannot be held)
- one shot, in prose, like {{flash}}. New pulses appear in the
game_start inventory. {{flash}} and {{poof}} live HERE - this folder is
the global base: a campaign set shipping its own flash.css (or flash.glsl)
re-skins the macro (the set sheet loads after these base sheets), same
rules as overlays/.
