BUILT-IN STAMP SOUNDS - the GLOBAL BASE. Do not delete.

These are the interface's own sounds: the backend stamps an event
(quest chime, coin ping, pickup blip, stage tick, status zap, cleanse
shimmer...) and the frontend plays the matching file from here.
They are deliberately kept OUT of the player's sfx/ library so the AI
can never fire them by accident through a {{sfx|name}} macro - the
macro path blocks these names (coin_flip, quest, stage, pickup,
status, cleanse, crit, fumble) even if a same-named file appears in
sfx/.

ANY set may now carry its own sfx_builtin/ folder to override these
file-by-file: while a campaign of that set runs, a stamp the set ships
plays the set's version, and every stamp it lacks falls back to this
default copy. So keep this folder complete enough to be the base - it
is the sound of every set that overrides nothing.

Like every other asset folder these are rescanned live: replace a file
(hold the name, keep any of .ogg/.mp3/.wav/.m4a/.flac) and the stamps
pick it up without a restart. Names WITHOUT a file in either folder
(crit, fumble, status, sleep, morning) fall back to the synthesized
versions in adventure_audio.js.

Two of these stamps are clock beats the interface keeps itself:
  sleep   - rings with the day-rollover (sleep-to-dawn) curtain, the
            nightfall beat the player sleeps through.
  morning - rings when the in-game clock crosses 07:00, the dawn
            waking chime.