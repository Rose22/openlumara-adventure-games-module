SKY KIND BACKDROPS + SHAPES
===========================

The backdrop layer: the air everything else rides over - starfields,
cloud decks, hazes, gloom washes. #adv-sky sits UNDER #adv-weather
(same z-band, DOM order keeps it below): sky = backdrop, weather =
foreground falling motes.

Sky kinds have their OWN names, deliberately different from the
weather names (so the two folders can never be confused). Every
built-in falling weather has a backdrop made for it:

  weather=snow       ->  sky=snowglow     snow-glow underlight
  weather=blizzard   ->  sky=whiteout     racing whiteout veil
  weather=hail       ->  sky=coldfront    hard cold glare sky
  weather=sand       ->  sky=desert       ochre desert sun-haze
  weather=sandstorm  ->  sky=sandwall     the ochre wall rolling in
  weather=fogdrift   ->  sky=fog          full-window steel mist
  weather=rain       ->  sky=rainhaze     low grey rain haze
  weather=storm      ->  sky=thunderhead  glowing belly + lightning

And five skies stand alone, no falling things needed: cloudy, stars,
sunny, heat, underwater.

One sky kind = up to three files sharing a stem:

  starfall.css    the LOOK: .adv-sky-starfall .adv-wp { ... }
                  (plus #adv-sky.adv-sky-starfall::before/::after for
                  washes - copy any neighbour's file in this folder as
                  a template; only the layer ENGINE base stays in
                  adventure_plus.css)
  starfall.json   the SHAPE (particle spec, all fields optional) - the
                  SAME fields as weather specs (see weather/README.txt
                  for the field list), but note the one default that
                  differs: a weather kind with no json spawns 42 motes,
                  a SKY kind with no json spawns NONE - skies drift
                  particles only when the json says count.
  starfall.glsl   the live WebGL sky itself (WebGL1 fragment shader;
                  uniforms u_time, u_resolution, u_aspect, u_accent,
                  u_ink, u_page, u_dark; the css stays the fallback
                  when WebGL/reduced-motion/shader-error strikes;
                  see AI_GUIDE.md - showcase: underwater.glsl)

A kind needs at least a LOOK (css and/or glsl) to exist; the json is
only ever the spec sidecar.

A GM can set_scene sky=<name> / game_start sky=<name> right away (off
clears it); give a kind an audible bed by dropping a sky_<name>.ogg
loop in the set's ambience/ folder.

THIS FOLDER IS THE GLOBAL BASE. A campaign's own set may ship a skies/
folder of its own: its files override these one by one, specs merge
FIELD BY FIELD, css/shader fields replace independently, css overrides
the base look by cascade - same rules as the weather/ folder.
