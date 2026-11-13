WEATHER KIND SKINS + SHAPES
===========================

One weather kind = up to three files sharing a stem:

  petrichor.css   the LOOK: .adv-weather-petrichor .adv-wp { ... }
                  (plus #adv-weather.adv-weather-petrichor::before/::after
                  for veil washes - a full BACKDROP wash ships as a
                  skies/ kind instead; copy any neighbour's file in
                  this folder as a template; only the particle ENGINE
                  base stays in adventure_plus.css)
  petrichor.json  the SHAPE (particle spec, all fields optional):

    {
      "count": 40,          particles to spawn (default 42)
      "dur":   [2, 6],      travel time in seconds per particle
      "size":  [2, 5],      particle size in px (width+height)
      "vw":    true,        size is in VIEWPORT WIDTH instead (wide banks)
      "height": [80, 150],  px - for shapes taller than wide
      "top":   [10, 90],    vertical spawn band in % (omit: css decides,
                            top for falling kinds, bottom for rising)
      "left":  [-20, 80],   horizontal spawn band in % (default 0-100)
      "glyphs": ["XII", "VI"],  TEXT particles instead of dots
      "font":  [11, 26]     px size range for glyph particles
    }

A kind needs at least one of the two files to exist. New kinds show up
in the game_start inventory as "Weather kinds this set adds" and the GM
can set_scene weather=<name> right away; give it an audible bed by also
dropping a weather_<name>.ogg loop in the set's ambience/ folder.

  petrichor.glsl  an optional live WebGL canvas UNDER the particles that
                  paints the PRECIPITATION ITSELF over transparent air -
                  the backdrop is a skies/ kind of its own (rain pairs
                  with skies/rainhaze - table in skies/README.txt)
                  (WebGL1 fragment shader; uniforms u_time, u_resolution,
                  u_aspect, u_accent, u_ink, u_page, u_dark; css stays
                  the fallback when WebGL/reduced-motion/shader-error
                  strikes; see AI_GUIDE.md - backdrop showcase:
                  skies/underwater.glsl)

THIS FOLDER IS THE GLOBAL BASE: every built-in kind lives here as one
<name>.css + <name>.json pair. A campaign's own set may ship a weather/
folder of its own: its files override these one by one, and specs merge
FIELD BY FIELD (a json with only {"count": 90} reshapes just the
count), css/shader fields replace independently, css overrides the base
look by cascade - same rules as the overlays/ folder.
