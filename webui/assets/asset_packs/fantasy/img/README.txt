{{img|name}} scene-art folder.

Drop any picture in here and it becomes instantly available to the AI as a
macro, no restart or code change needed:

    {{img|tavern}}      -> tavern.png / tavern.jpg / tavern.webp / ...
    {{img|the_dock}}    -> the_dock.<any format> (underscores read as spaces)

Supported extensions:
    .png .jpg .jpeg .gif .webp .svg .avif .bmp

Names are listed back to the AI in the asset inventory of any campaign
running this set (get_assets / the game_start result - "Images"), and
the {{img|name}} macro renders the picture framed and centered inside
the passage. A picture here is only ever visible to campaigns whose
game_start chose THIS set.
