ASSET PACKS
===========

Packs live in asset_packs/ - one folder per campaign world, each holding
one folder per kind (ambience/ music/ sfx/ img/ stingers/): a bundle of
loops, tracks, one-shot sounds, pictures and cue-moment music that a
campaign can be dressed in. A pack may also carry a world.txt in its
ROOT: one deliberately vague paragraph about what world a campaign of
this pack lives in (the kind of things it features, not a fixed
setting) - it rides along with the game_start result (and
get_assets(asset_pack=...)) so the AI leans into the world while
keeping every room to invent it.

assets/
  css/  js/                <- the interface's OWN folders; these MUST
                               stay right here (warning at the bottom)
  asset_packs/
    default/             <- the pack used when game_start names none, AND
                           the global base of EVERY kind (see below)
      ambience/          set_scene ambience= loops (a weather_<kind> or
                         sky_<kind> loop also becomes that kind's bed)
      music/             {{music|stem}} / game_start music= soundtrack
      sfx/               {{sfx|stem}} one-shots
      img/               {{img|stem}} scene art
      stingers/          play_stinger cue-moment scores (tool-only)
      sfx_builtin/       the built-in stamp sounds (quest chime, coin
                         ping...) - the GLOBAL base every pack falls
                         back to; see that folder's README
      overlays/          <name>.css overlay moods - ALL 17 built-ins
                         live here, one file per mood: the GLOBAL base
      weather/           <name>.css + <name>.json weather kinds - every
                         built-in kind lives here, look + particle spec
                         (json): the GLOBAL base (foreground: motes
                         over transparent air; <name>.glsl paints the
                         falling body itself)
      skies/             <name>.css + <name>.json BACKDROP skies - the
                         air the weather falls through, each built-in
                         weather with a backdrop of its own (rainhaze,
                         thunderhead, snowglow, whiteout, coldfront,
                         desert, sandwall, fog): the GLOBAL base
      pulses/            <name>.css one-shot {{name}} macros - flash &
                         poof live here: the GLOBAL base
      text_decoration/   <name>.css inline {{name|text}} decorations -
                         whisper, shout, sparkle... 15 base looks, one
                         file per name (optional <name>.json sidecar:
                         "desc" for the GM inventory + a "render" mode
                         for the sparkle/woozy DOM builders): the
                         GLOBAL base
    magic_academy/       <- any new folder in asset_packs/ with this
      music/ ...            shape becomes a pack immediately:
      sfx_builtin/          rescanned live, no restart, no code
      overlays/             (a pack holding only ONE kind folder is
                            still a valid pack)

game_start(asset_pack="<folder name>") picks the pack and returns that
pack's EFFECTIVE inventory - that list is the campaign's asset
vocabulary: the pack's own assets over the default pack, which is the
GLOBAL BASE OF EVERY KIND. A same-named file in the campaign pack wins;
whatever the pack lacks plays the default's. ONLY assets of the
campaign's pack or the default base resolve (tools, inline macros and
served files alike); a file living in some OTHER pack never leaks in.
The AI sees the installed pack names in its system prompt and inspects
contents with the get_assets tool (its overview counts what each pack
carries itself; the full inventory is the merged view).

A pack may hold just some of the kind folders (or leave one empty):
that kind then simply keeps the default pack's assets. A pack may also carry its own
sfx_builtin/ folder to re-skin the interface's stamp sounds: put e.g.
quest.mp3 in <pack>/sfx_builtin/ and every quest chime plays that file
while a campaign of this pack runs. It overrides file-by-file - any
stamp the pack does not carry (and every stamp of a pack with no
sfx_builtin/ folder at all) falls back to the default pack's
sfx_builtin/ base. These stay the interface's own vocabulary: they are
never offered to the AI as {{sfx}} options, in any pack.

The five VISUAL kinds (overlays/, weather/, skies/, pulses/ and the
inline text_decoration/) work
exactly like sfx_builtin: the default pack is the GLOBAL BASE and ships
every
built-in look as one file per name. A campaign pack's sheets override
the base file-by-file, and NEW names are simply additions; sheets load
after the module css and after the base sheets, so a re-skin of a
built-in wins by cascade. A weather <name>.json particle spec merges
its fields over the base spec one by one (a text_decoration sidecar
merges the same way and may carry a "render" mode). Decoration names
ARE macro names, exactly like pulse names: the decoration files are
the campaign's whole {{name|text}} vocabulary, and text_decoration
names shadow same-named pulses. See each folder's README.

!! css/ and js/ are NOT pack material - keep them directly in assets/,
never inside asset_packs/. The webui loads them only from assets/css/
and assets/js/ (moving them silently kills the whole adventure
frontend).
