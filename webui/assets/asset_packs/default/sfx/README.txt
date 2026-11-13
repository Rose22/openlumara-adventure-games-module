SOUND ONE-SHOTS  ({{sfx|name}} macro AND the interface's own cues)
==================================================================

Every file dropped here (any audio extension: mp3, ogg, wav, ...) joins
the {{sfx|name}} vocabulary the GM can fire inside prose - and a few
SPECIAL STEMS are heard even when no macro names them, because the
interface itself plays that cue:

  type_key     the TYPEWRITER's per-character keystroke. Drop a file
               here and every revealed character clacks with it (a
               short, quiet sound works best - keys land many per
               second). Falls back to token.*, then the built-in knock.
  token        the raw stream keystroke (typewriter OFF) - and the
               fallback under type_key above.
  quill        the heavier accent key the core fires alongside tokens
  chime        a choice rail appeared
  stat_up      a {{stat}} badge rose (+)
  stat_down    a {{stat}} badge fell (-)
  dice_roll    the dice flourish tumbles
  thump        the game-over curtain drops
  send         you sent a message (in-world parchment rustle)
  reply_start  the GM begins: the storybook creaks open
  complete     a passage finished (harp glissando)
  reasoning    the GM's pondering ended (soft brass bell)

The campaign's own set overrides these stem by stem; whatever it lacks
stays this default base's, and what neither ships keeps the built-in
synth - so a set can re-voice just the typewriter (type_key.ogg) and
leave every other cue untouched. Volume rides the sfx slider, keystroke
cues additionally the typing-volume one.
