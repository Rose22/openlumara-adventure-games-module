FONTS KIND - human quick reference (AI: see AI_GUIDE.md)

Two file types share this folder, name = stem (^[a-z][a-z0-9_]*$):

1. <name>.txt    one CSS font stack (system faces), e.g.
                 Georgia, 'Palatino Linotype', 'Book Antiqua', serif

2. <name>.ttf / .otf / .woff / .woff2
                 a REAL font file. The frontend registers it as the
                 family "adv-<name>" (via the /fonts route) and the
                 story text renders in it - no OS font needed.
                 Several formats of one stem may all ship; browsers
                 take the most modern one they support (woff2 first).

A stem with BOTH a file and a txt plays the FILE.

The default set's fonts/ folder is the GLOBAL BASE; a campaign's set
overrides same-named files and may add its own. THE FOLDER IS THE
WHOLE VOCABULARY - game_start font= resolves names from here (over
the base); any OTHER string stays a raw CSS font-family stack, so
"any CSS stack" keeps working for free.

Keep font files reasonably small (a subset woff2 per weight is ideal;
the whole folder ships to the browser on campaign load).
