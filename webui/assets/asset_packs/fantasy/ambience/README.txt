AMBIENCE LOOPS
==============

Drop any .ogg/.mp3/.wav/.m4a/.flac loop file in this folder and it
becomes a set_scene ambience= option immediately - no code changes, no
other modules involved. Loops play under the music track and the weather bed.

Current loops: fireplace, rain, summer-night, waves, wind.

WEATHER BEDS
------------
A loop named weather_<kind> becomes that weather kind's automatic sound
the moment the file lands: weather_rain.ogg, weather_storm.ogg,
weather_fireflies.ogg... set_scene weather=<kind> then fades it in under the
main bed with no code change. Kinds without a weather_ file fall back
to curated stand-ins (storm -> rain, stars -> summer-night, ...).
Valid kinds: snow, blizzard, rain, bloodrain, storm, hail, sunny, cloudy,
moonrays, fogdrift, dust, whirlwind, sand, sandstorm, petals, feathers,
leaves, embers, cindersnow, heat, heatstroke, mirage, stars, starmotes,
meteorshower, fallingstars, divine, fireflies, underwater, sparks, ash,
bloodmoon, timewarp, glitter.

To bring over the five meditation loops the system originally borrowed:
  cp ~/path/to/openlumara/user_modules/meditation/webui/assets/audio/*.ogg \
     ~/path/to/openlumara/user_modules/adventure_games/webui/assets/asset_packs/default/ambience/
(ambience/ folders always live INSIDE an asset pack - see the README.txt
in webui/assets/; loops here belong only to campaigns that picked this pack)
