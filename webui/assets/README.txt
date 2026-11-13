You can provide your own asset packs here! Possible asset kinds to include (just add them as subfolders in your asset pack):
- palettes (colorschemes for the UI)
- fonts
- music
- ambience (loops that the AI can launch in the background. it can decide to launch multiple layers at once, so just provide a bunch of them and watch it create a full soundscape!)
- sfx (sound effects)
- sfx_builtin (these override built in sound effects, like UI sounds)
- stingers (short musical cues that fire off during important story events)
- skies (CSS and javascript, and optionally a glsl shader, that renders a background)
- weather (particles and the like to render on top of skies. also supports CSS, javascript, and a glsl shader)
- overlays (screen effects that the AI can enable/disable at any time. CSS/javascript/glsl)
- pulses (one-shot screen effects that are meant to play for a short time. CSS/javascript/glsl)
- text_decoration (fancy text effects that the AI can {{echo|Trigger using text macros like these}}
- img (you can put any images here, and the AI can then add them to a story page as it sees fit)
 
You can also provide a CSS and json files for `thinking` and `thinking_text` to customize the loading screen
