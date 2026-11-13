STINGERS - the tool-only musical cue-moment library

Drop any .ogg/.mp3/.wav/.m4a/.flac file in here and its stem (lowercased)
immediately becomes a stinger the game master can fire with the
play_stinger tool. Rescanned per call - no restart needed.

What makes a stinger a stinger:
- longer and MUSICAL, unlike the short impact sounds in ../sfx/
- it scores a cue moment in the story: a revelation, a level-up,
  a quest's bitter end, a time-skip
- while one plays, the soundtrack smoothly fades out and pauses; when the
  stinger finishes (or errors out) it resumes at its held position and
  fades back in
- TOOL-ONLY: there is no {{stinger}} macro and {{sfx}} does not reach
  this folder - stingers stay reserved for the few moments that earn
  an orchestra, so they can never slip into flowing prose

The stinger list in get_assets / the game_start result only names files
installed in the campaign's own set, so an empty folder changes nothing
for that set.
