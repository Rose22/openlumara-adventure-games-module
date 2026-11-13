PALETTES KIND - human quick reference (AI: see AI_GUIDE.md)

One <name>.json per palette, name = stem (^[a-z][a-z0-9_]*$).
The default pack's palettes/ folder is the GLOBAL BASE; a campaign's
asset pack overrides same-named files and may ship its own names.
THE FOLDER IS THE WHOLE VOCABULARY - game_start palette= only
resolves names this folder (over the base) actually ships; the live
list rides in get_assets, game_start's result and the state block.

File shape:
{
  "label": "Rose Quartz (soft pink-violet)",   optional, defaults to stem
  "prefers": "light" | "dark",                 optional, native character
  "light": { ...variant... },                  at least ONE variant needed
  "dark":  { ...variant... }
}

A variant is the flat color map the frontend turns into CSS vars:
  dark (bool), accent, link, link_hover, page, ink, ink_soft, line,
  ui_bg1..3, ui_text, ui_text_soft, ui_text_muted, ui_border
Each variant may also carry a "tint" map (see AI_GUIDE.md).

game_start falls back gently: unknown name -> rose_quartz -> first
installed palette, always with a note in the tool result.
