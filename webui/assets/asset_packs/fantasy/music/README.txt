MUSIC TRACKS
============

Drop soundtrack files in this folder and they become immediately
available to the game master as:

  * game_start(..., music="<filename-without-extension>"), and
  * set_scene(..., music="<filename-without-extension>") mid-game.

Supported: .ogg .mp3 .wav .m4a .flac - OGG (Vorbis) and MP3 are the
safest bets for smooth looping.

TIP - truly gapless loops: a looping <audio> element is only as
seamless as the file itself. Encode loop metadata so nobody hears a
seam:

  # ogg (best - stores loop points in the header):
  metatag -i_loop_full 1 track.ogg
  # or with ffmpeg, strip silence and ensure identical loop edges:
  ffmpeg -i in.mp3 -c:a libmp3lame -q:a 2 loop-ready.mp3

The volume is set by the module's "music volume" setting.

INCLUDED MUSIC
==============
I (Rose22) included music made by Kevin Macleod (https://www.incompetech.com), all rights to the music go to him! As the AI-written note above says, you can add your own music files to this folder, and they will automatically usable by the AI as soon as you restart OpenLumara.
