anime - asset pack for anime-styled campaigns
=============================================
The anime visual grammar: sakura petals on the breeze, speedlines on
the dramatic zoom, speed-of-light gasps, power-up rings and pastel
magical-girl sparkles - plus the striped sunset every confession
scene deserves. Soundtrack and stingers are already dropped in
(music/, stingers/); the rest of AUDIO IS EMPTY - the default set's
base audio plays underneath until you add files:

  ambience/   loops (voice a visual kind with weather_<kind>.<ext>
              or sky_<kind>.<ext>, e.g. weather_sakura.ogg,
              sky_magical_night.ogg - that one gets a night-crickets
              bed by convention)
  sfx/        one-shot {{sfx|name}} cues (whoosh, boing, glass...)
  img/        {{img|name}} scene art

WHAT SHIPS HERE
  palettes/   magical_girl (pastel sparkles),
              shonen_skies (indigo horizon, crimson resolve),
              isekai (two-moon twilight, hero's gold)
  fonts/      tokyo (Japanese-system sans), manga (speech-balloon),
              jrpg (guild-sign serif)
  overlays/   screentone, aura, transformation, confession,
              summoning (wheeling magic circle)
  weather/    sakura, fireflies, stardust,
              runes (rising spell glyphs), coinrain (loot geyser)
  skies/      sunset, cumulus, magical_night,
              twin_moons (two-moon alien night),
              white_void (the goddess briefing room)
  pulses/     speedlines, gasp, powerup,
              truck (TRUCK-KUN), levelup (golden light column),
              pyon (System window pop)   (fire as {{name}} macros)
  decoration/ kawaii (sparkle-render), telepath, hud,
              goddess, systemmsg, legendary
              (inline {{name|words}})
  chrome/     thinking.svg/css (twinkling magic star), thinking_text
              json/css (henshin wording), caret.css (pink caret
              shedding star particles), dice.json (circled numbers,
              maru/batsu coin)

Everything merges over the default set as the global base - same-named
files here override it, anything absent stays the default's. Rescanned
live, so new drops work without a restart.
