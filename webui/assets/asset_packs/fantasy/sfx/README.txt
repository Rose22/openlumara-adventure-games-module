DYNAMIC SOUND LIBRARY
=====================

Drop any one-shot sound file in this folder and it becomes immediately
available to the game master as:

  * a {{sfx|<filename-without-extension>}} macro inside passages
    (cued by the typewriter's reveal scan, once per macro).

Examples:
  sword_swing.ogg  ->  {{sfx|sword_swing}}
  lock_click.mp3   ->  {{sfx|lock_click}}
  wolf_howl.wav    ->  {{sfx|wolf_howl}}

Supported: .ogg .mp3 .wav .m4a .flac - ogg and mp3 are the safest bets.
Keep cues short (< 2 s is ideal); they play at the module's SFX volume.

Built-in stamp cues (quest chime, coin ping, pickup blip...) do NOT
live here - they live in the sfx_builtin/ folders: this set's own
(optional per-file overrides) over the default set's base copy.
They are the interface's own sounds, played automatically from backend
event stamps, and their names (coin_flip, quest, stage, pickup,
status, cleanse, crit, fumble) are BLOCKED from the {{sfx}} macro -
even if a same-named file lands in this folder, the macro path will
not fire it. Keep those names free; to re-skin the stamps themselves,
drop them in <this set>/sfx_builtin/ instead.
