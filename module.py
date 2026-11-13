# -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-08) harness:openlumara
import asyncio
import json
import os
import time

import core
import copy
import random
import re

import channels.webui.api as webui


class AdventureGamesModule(core.module.Module):
    """Turn any webui chat into an audiovisual adventure game."""

    category = "Games"

    settings = {
        "hide_process_chain": {
            "description": "Hide the AI's process chain (thinking / tool calls) inside passages, for maximum immersion. While the AI works, the story's own rune overlay shows instead.",
            "default": True
        },
        "sound_enabled": {
            "description": "Enable sounds: the music soundtrack, scene ambience loops and soft synthesized effects (choice chimes, stat sparkles, dice tumble, page turns).",
            "default": True
        },
        "music_volume": {
            "description": "Volume of the looping music tracks (game_start / the {{music}} macro crossfade between them).",
            "default": 70,
            "depends": "sound_enabled"
        },
        "ambience_volume": {
            "description": "Master volume of the scene ambience bed - the per-loop volumes the AI sets with set_scene (ambience=...) are percentages of this.",
            "default": 95,
            "depends": "sound_enabled"
        },
        "sfx_volume": {
            "description": "Volume of the one-shot sound effects ({{sfx}} sounds, synthesized or from the sfx folder), stingers and UI sounds.",
            "default": 100,
            "depends": "sound_enabled"
        },
        "daynight_tint": {
            "description": "Tint the screen with the campaign's in-game time of day (dawn peach, dusk ember, moonstone night).",
            "default": True
        },
        "weather_effects": {
            "description": "Show the campaign's skies and weather.",
            "default": True
        },
        "torch_logic": {
            "description": "Darkness creeps into the screen edges when the campaign clock turns night; carried light sources (torches, lanterns, candles) keep it at bay.",
            "default": True
        },
        "phone_performance_mode": {
            "description": "Automatically lighten the show on phones and tablets (the interface's own screen-size detection decides): lower-resolution shaders, fewer of them at once, fewer weather particles, a gentler typewriter and caret, fewer ambience layers and cheaper css effects (no page refraction, softer blurs). The look stays the same - it just renders lighter.",
            "default": True
        },
        "shaders_enabled": {
            "description": "Render GLSL shader assets (sky backdrops, weathers, overlay moods, pulse effects) as live WebGL canvases. Off means every asset plays its plain css look - nothing else changes.",
            "default": True
        },
        "shader_max": {
            "type": "number",
            "description": "How many custom GLSL shaders (weathers / held overlays) may animate at the same time; a sky and a pulse shader always get a slot of their own. 0 disables shaders completely - every asset falls back to its plain css look.",
            "default": 3,
            "min": 0,
            "max": 8,
            "step": 1,
            "depends": "shaders_enabled"
        },
        "shader_resolution": {
            "type": "number",
            "description": "Internal shader rendering resolution as a percentage (25-150). 0 keeps DYNAMIC scaling: 150% while one shader animates, 100% at two, 75% at three or more.",
            "default": 0,
            "min": 0,
            "max": 150,
            "step": 25,
            "depends": "shaders_enabled"
        },
        "typewriter": {
            "description": "Reveal passages with a typewriter effect: the prose types itself out, comfortably lagging behind generation (the typing keeps going until the last word has landed). A Skip button finishes the passage instantly.",
            "default": True
        },
        "typewriter_speed": {
            "type": "number",
            "description": "Typewriter speed in characters per second. The sentence-ending and comma beats scale with this speed.",
            "default": 30,
            "min": 20,
            "max": 2000,
            "step": 10,
            "depends": "typewriter"
        },
        "typewriter_pause": {
            "description": "The typewriter pauses for the story's beats: sound-effect cues and stingers hold it until they finish playing, stat and item badge popups hold it until they fade away.",
            "default": True,
            "depends": "typewriter"
        },
        "typewriter_caret": {
            "description": "Show the little effect sprite riding just right of the character being typed (its look ships with the campaign's asset pack - the caret.css slot). Off hides the cursor sprite entirely; typing itself is untouched.",
            "default": True,
            "depends": "typewriter"
        },
        "typing_volume": {
            "type": "number",
            "description": "Volume of the keystroke sounds: the typewriter's per-character typing, and (with the typewriter off) the token-stream keys. Rides on top of the SFX volume, so keys can sit softly under the other cues.",
            "default": 70,
            "min": 0,
            "max": 100,
            "step": 5,
            "depends": "typewriter"
        },
        "font_size": {
            "type": "number",
            "description": "Story text size in the passage view, in pixels (17.5 is the default book feel).",
            "default": 17.5,
            "min": 12,
            "max": 32,
            "step": 0.5
        }
    }

    # -------------------------
    #   STATE HELPERS
    # -------------------------

    async def on_ready(self):
        self.data = core.storage.StorageDict("adventure_games", type="json")
        if "campaigns" not in self.data:
            self.data["campaigns"] = {}
        if "undo" not in self.data:
            self.data["undo"] = {}
        self.data.save()
        # UI beat handshake (mirrors the meditation module's countdown):
        # chat_id -> (kind, asyncio.Event) while a tool call waits for the
        # browser to finish playing its animation; _ui_seen is the last time
        # the webui polled the campaign state (= a browser is watching).
        self._beat_events = {}
        self._ui_seen = 0.0
        # Typing-handshake state: chat_id -> (busy, timestamp), mirrored from
        # the typewriter's "still revealing prose" flag which rides every
        # /state heartbeat the watching browser sends (_route_state). While
        # that stays fresh and true, _await_typing holds tool calls so the
        # world only moves once the player has watched the passage type out.
        self._typing = {}

    def _campaigns(self):
        return self.data.get("campaigns", {})

    def _chat_id(self, chat=None):
        if chat:
            return str(chat)
        try:
            cid = self.channel.context.chat.get("id")
            return str(cid) if cid else None
        except Exception:
            return None

    def _get_campaign(self, chat_id):
        if not chat_id:
            return None
        c = self._campaigns().get(str(chat_id))
        if c:
            self._migrate_quests(c)
        return c

    def _migrate_quests(self, c):
        """In-place, one-time conversion of the legacy numbered-stage quest
        model to the unordered sub-goal model. Old saves and old rewind
        snapshots simply come back shaped the new way; stages already
        reached read as that many sub-goals checked off. The next save
        persists the converted shape."""
        for q in (c.get("quests") or {}).values():
            if "subgoals" in q:
                continue
            stages = q.pop("stages", None) or []
            cur = int(q.pop("stage", 0) or 0)
            q["subgoals"] = [{"text": str(s), "done": i < cur} for i, s in enumerate(stages)]

    def _save_campaign(self, chat_id, campaign):
        campaigns = self._campaigns()
        campaigns[str(chat_id)] = campaign
        self.data["campaigns"] = campaigns
        self.data.save()

    async def _ui_push(self, chat_id, active):
        """Push an adv:campaign websocket frame so watching browsers learn
        this chat gained/lost (or paused/resumed) a campaign the moment it
        happens - no polling. The webui channel is set on every module when
        it becomes the active channel; its websocket_manager broadcasts to
        all clients, so the frame carries the chat id and the frontend
        filters against the selected chat. The frame type is unknown to the
        core's handleWebSocketMessage switch (no default case), so it passes
        through untouched for this module's own listener."""
        ws = getattr(getattr(self, "channel", None), "websocket_manager", None)
        if not ws or not chat_id:
            return
        try:
            await ws.broadcast({"type": "adv:campaign", "chat": str(chat_id), "active": bool(active)})
        except Exception:
            pass  # presentation must never break the story

    def _snapshot(self, chat_id):
        """push an undo snapshot of the campaign, stamped with the current
        message count so rewind can figure out which turn it belongs to"""
        if not chat_id:
            return
        campaign = self._get_campaign(chat_id)
        if not campaign:
            return
        try:
            # the Messages wrapper has no __len__ - its StorageList does,
            # and here it equals the index the incoming user message is
            # about to land on (= the turn's first_message_index). len() on
            # the wrapper itself raises TypeError, which used to silently
            # stamp EVERY snapshot with count 0: the dedup guard below then
            # rejected every snapshot after the first, and rewind's
            # count >= first_index match never found a candidate, so the
            # passage got deleted while the world stayed exactly as it was.
            count = len(self.channel.context.chat.messages.data)
        except Exception:
            count = 0
        undo = self.data.get("undo", {})
        stack = undo.get(str(chat_id), [])
        # don't stack multiple snapshots within the same passage
        if stack and stack[-1].get("count", -1) >= count:
            return
        stack.append({"count": count, "campaign": copy.deepcopy(campaign)})
        undo[str(chat_id)] = stack[-12:]
        self.data["undo"] = undo
        self.data.save()

    # -------------------------
    #   PROMPTS
    # -------------------------

    def _state_block(self, c):
        lines = []
        stats = c.get("stats", {})
        if stats:
            parts = []
            for name, s in stats.items():
                icon = (s.get("icon") + " ") if s.get("icon") else ""
                if s.get("max") is not None:
                    parts.append(f"{icon}{name} {s['value']}/{s['max']}")
                else:
                    parts.append(f"{icon}{name} {s['value']}")
            lines.append("Stats: " + " | ".join(parts))
        inv = c.get("inventory", {})
        if inv:
            parts = []
            for name, item in inv.items():
                icon = (item.get("icon") + " ") if item.get("icon") else ""
                qty = item.get("qty", 1)
                parts.append(f"{icon}{name}" + (f" \u00d7{qty}" if qty != 1 else ""))
            lines.append("Inventory: " + " | ".join(parts))
        clock = self._clock_str(c)
        if clock:
            lines.append("Clock: " + clock)
        lines.append("Light: " + self._light_word(self._light_level(c)))
        auto = int(c.get("auto_minutes") or 0)
        if auto:
            lines.append(f"Clock auto-ticks {auto} min per turn (set_turn_minutes to change)")
        quests = c.get("quests", {})
        if quests:
            parts = []
            for name, q in quests.items():
                icon = (q.get("icon") + " ") if q.get("icon") else ""
                if q.get("status") == "active":
                    goals = q.get("subgoals") or []
                    prog = ""
                    if goals:
                        marks = ", ".join(("[x] " if g.get("done") else "[ ] ") + str(g.get("text")) for g in goals)
                        prog = f" ({sum(1 for g in goals if g.get('done'))}/{len(goals)}: {marks})"
                    parts.append(f"{icon}{name}{prog}")
                else:
                    parts.append(f"{icon}{name} [{q.get('status')}]")
            lines.append("Quests: " + "; ".join(parts))
        statuses = c.get("statuses", {})
        if statuses:
            parts = []
            for name, s in statuses.items():
                icon = (s.get("icon") + " ") if s.get("icon") else ""
                turns = f" ({s['turns']} turns left)" if s.get("turns") else ""
                linked = (c.get("status_fx") or {}).get(name)
                tail = f" \u2192 {linked} overlay" if linked else ""
                parts.append(f"{icon}{name}{turns}{tail}")
            lines.append("Statuses: " + "; ".join(parts))
        apack = self._pack_of(c)
        if c.get("ambience"):
            lines.append(f"Ambience playing: {c['ambience']}")
        loops = self._ambience_tracks(apack)
        if loops:
            lines.append("Ambience loops available (set_scene ambience=): " + ", ".join(loops))
        if c.get("music"):
            lines.append(f"Music playing: {c['music']}")
        songs = self._music_tracks(apack)
        if songs:
            lines.append("Music tracks available ({{music}} / game_start): " + ", ".join(songs))
        lines.append("Sound effects ({{sfx|name}}): " + ", ".join(self._sfx_cues(apack)))
        stingers = self._stinger_names(apack)
        if stingers:
            lines.append("Stingers available (play_stinger): " + ", ".join(stingers))
        pics = self._img_names(apack)
        if pics:
            lines.append("Images available ({{img|name}}): " + ", ".join(pics))
        if c.get("sky"):
            lines.append(f"Sky: {c['sky']}")
        lines.append("Sky kinds available (set_scene sky=): " + ", ".join(self._skies_for(apack)) + ", off")
        if c.get("weather"):
            lines.append(f"Weather: {c['weather']}")
        lines.append("Weather kinds available (set_scene weather=): " + self._weather_vocab(apack) + ", off")
        active_fx = sorted(c.get("effects") or {})
        if active_fx:
            lines.append("Screen overlays active: " + ", ".join(active_fx))
        lines.append("Overlays available (screen_effect tool / set_scene effects=): " + self._overlay_vocab(apack))
        lines.append("One-shot pulses (inline macros): " + ", ".join("{{" + n + "}}" for n in self._pulses_for(apack)))
        lines.append("Text decorations ({{name|text}} inline): " + ", ".join(self._decorations_for(apack)))
        pals = self._palettes_for(apack)
        if pals:
            lines.append("Palettes available (game_start palette=): " + ", ".join(sorted(pals)))
        font_names = self._fonts_for(apack)
        if font_names:
            lines.append("Fonts available (game_start font=): " + ", ".join(font_names))
        shader_notes = c.get("shader_notes") or []
        if shader_notes:
            lines.append("Shader notes (failed GLSL - css fallback is playing): " + "; ".join(shader_notes))
        if c.get("ended"):
            lines.append(f"STATUS: GAME OVER ({c.get('ending', 'ended')}): {c.get('epitaph', '')}")
        else:
            scene = c.get("scene_title") or "(no scene set)"
            loc = f" \u2014 {c['location']}" if c.get("location") else ""
            lines.append(f"Scene: {scene}{loc}")
        return "\n".join(lines)

    def _world_compact(self, c):
        # one-line snapshot injected into every player message: the volatile
        # facts of _state_block in the smallest readable font. Static tool
        # rosters do NOT belong here - this text is stored in the history.
        if c.get("ended"):
            return f"GAME OVER ({c.get('ending', 'ended')}): {c.get('epitaph', '')}"
        segs = []
        clock = self._clock_str(c)
        if clock:
            segs.append(clock.split(" \u00b7 ")[0].replace(", ", " "))
        light = self._light_level(c)
        if light >= 40:
            segs.append("light " + self._light_word(light))
        stats = c.get("stats", {})
        if stats:
            parts = []
            for name, s in stats.items():
                icon = (s.get("icon") + " ") if s.get("icon") else ""
                if s.get("max") is not None:
                    parts.append(f"{icon}{name} {s['value']}/{s['max']}")
                else:
                    parts.append(f"{icon}{name} {s['value']}")
            segs.append(", ".join(parts))
        statuses = c.get("statuses", {})
        if statuses:
            parts = []
            for name, s in statuses.items():
                icon = (s.get("icon") + " ") if s.get("icon") else ""
                turns = f" {s['turns']}t" if s.get("turns") else ""
                parts.append(f"{icon}{name}{turns}")
            segs.append("statuses: " + ", ".join(parts))
        quests = c.get("quests", {})
        if quests:
            parts = []
            for name, q in quests.items():
                if q.get("status") == "active":
                    goals = q.get("subgoals") or []
                    prog = ""
                    if goals:
                        prog = f" {sum(1 for g in goals if g.get('done'))}/{len(goals)}"
                    parts.append(f"\"{name}\"{prog}")
                else:
                    parts.append(f"\"{name}\" [{q.get('status')}]")
            segs.append("quests: " + "; ".join(parts))
        inv = c.get("inventory", {})
        if inv:
            parts = []
            for name, item in inv.items():
                qty = item.get("qty", 1)
                parts.append(name + (f" \u00d7{qty}" if qty != 1 else ""))
            segs.append("have: " + ", ".join(parts))
        active_fx = sorted(c.get("effects") or {})
        if active_fx:
            segs.append("fx " + "+".join(active_fx))
        if c.get("sky"):
            segs.append("sky " + c["sky"])
        if c.get("weather"):
            segs.append("wx " + c["weather"])
        if c.get("ambience"):
            segs.append("\u266a " + c["ambience"])
        if c.get("music"):
            segs.append("\u266b " + c["music"])
        if not segs:
            return ""
        return " \u00b7 ".join(segs)

    async def on_system_prompt(self):
        # Built ONCE when a chat opens, so this block must stay forever-static:
        # no campaign facts here. The live world reaches the GM through the
        # [world: ...] tag injected into every player message instead, and the
        # palette hexes come back once in the game_start confirmation.
        # The per-kind asset inventories (loops / tracks / sfx / images /
        # stingers AND the visual vocabulary: overlay moods with meanings,
        # sky kinds, weather kinds, one-shot pulses) are NOT listed here: those lists
        # are the default pack's assets, and the default pack belongs to
        # whichever campaign runs. Every kind's full inventory (the
        # campaign's pack merged over the default base, one continuous list
        # per kind) arrives with get_assets(asset_pack=...) and with every
        # game_start, and stays visible in the campaign's state block.
        parts = [self.GAME_RULES]
        packs = self._asset_packs()
        if packs:
            parts.append("\nAsset packs available (game_start asset_pack=): " + ", ".join(packs) +
                         ". Each pack bundles its own ambience loops, music tracks, sound effects, overlays, weathers, skies, images, stingers, palettes, fonts, inline text decorations ({{name|text}} macros), thinking sigils, dice flourish skins and typewriter caret effects. Call get_assets BEFORE game_start to see a pack's full effective inventory, then pass the pack that fits the game's world.")
        else:
            parts.append("\nAsset packs available (game_start asset_pack=): none installed (webui/assets/asset_packs/ holds no pack folders) - games run without loops, music, sound effects, images or stingers.")
        return "\n".join(parts)

    async def on_end_prompt(self):
        # the anti-drift micro-footer: one line, only while a campaign runs.
        # Long tool-warp passages push the system-prompt GAME_RULES out of
        # reach - the choice rail is the first thing to go - so the single
        # most fragile format rule gets a fresh anchor right at the end.
        c = self._get_campaign(self._chat_id())
        if not c:
            return None
        if c.get("paused"):
            return None
        return "End the passage with 2-4 [[choice links]] unless the game is over."

    async def on_message_inject(self, user_message: str):
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return None
        if c.get("paused"):
            # the player stepped out of the immersive view: the campaign is
            # frozen (no clock tick, no status countdown, no world snapshot)
            # and the GM must drop character until they re-enter.
            return ("[adventure paused: answer as a normal assistant. do not "
                    "use [[choice links]], {{macros}}, or advance the clock.]")
        # baseline for rewind: catch the campaign exactly as it stands before
        # this turn moves the world (clock tick, status countdown, and every
        # tool/macro change that follows become rewinding with it). the
        # per-message-count dedup inside keeps it to one snapshot per turn.
        if not c.get("ended"):
            self._snapshot(chat_id)
        self._tick_statuses(c)
        # the world's heartbeat: the per-turn clock tick happens HERE, so it
        # can never be forgotten - the [world:] tag below already shows the
        # fresh time, and the GM narrates forward from it. Frozen on game
        # over: the dead world stops keeping time.
        auto = int(c.get("auto_minutes") or 0)
        if auto and not c.get("ended"):
            self._advance_clock(c, auto)
            self._save_campaign(chat_id, c)
        compact = self._world_compact(c)
        if not compact:
            return None
        return f"[world: {compact}]"

    # identity palettes and fonts are ASSET KINDS now: the pack folders
    # palettes/ and fonts/ below hold them, the default pack is the global
    # base and the campaign's own set overrides file by file - the loaders
    # live beside _resolve_palette, and THE FOLDERS ARE THE WHOLE
    # VOCABULARY for these kinds too.

    # ASSET PACKS: webui/assets/asset_packs/<pack>/ holds one folder per
    # kind (ambience/ music/ sfx/ img/ stingers/, plus the optional
    # sfx_builtin/ override folder), so a whole campaign's soundtrack,
    # soundscape, cues, art and stingers bundle together in one folder.
    # game_start(asset_pack=...) picks the pack for a campaign and every
    # later lookup - tool validation, inline macros and the frontend's
    # stem->url maps alike - reads the DEFAULT pack as the global base of
    # EVERY kind, with the campaign's own pack scanned over it: its files
    # override same-named default files stem by stem, and whatever the
    # pack lacks simply stays the default's. A kind folder left empty (or
    # absent) is a clean "keep the defaults"; no kind is replaced whole.
    # Packs live in their OWN asset_packs/ folder: the interface's css/
    # and js/ must stay directly in assets/ (the webui loads them from
    # exactly those paths), and keeping the two worlds in separate
    # directories means a folder move can never mix them up.
    # A pack may also carry a world.txt in its ROOT: one deliberately
    # vague paragraph about what world a campaign of this pack lives in
    # (the kind of things it features, not a fixed setting), handed to
    # the GM with game_start and get_assets so it can lean into the
    # world while still having every room to invent it.
    AUDIO_EXTS = (".ogg", ".mp3", ".wav", ".m4a", ".flac")
    IMG_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp")
    ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              "webui", "assets")
    ASSET_PACKS_DIR = os.path.join(ASSETS_DIR, "asset_packs")
    # sfx_builtin counts a pack on its own too: a folder holding nothing
    # but stamp overrides is still a pack - it merely shows up empty in
    # the AI-facing inventories (those stay the first five kinds).
    # overlays/ weather/ skies/ pulses/ are the VISUAL kinds: <name>.css
    # skins a held overlay / weather kind / sky kind / one-shot pulse,
    # weather and skies also take a <name>.json particle spec. Weather is
    # the FOREGROUND layer (falling motes, and its own <name>.glsl paints
    # the precipitation itself); skies are the BACKDROP every other layer
    # rides over (their <name>.glsl is the sky proper). A weather's json may
    # carry a "sky" field naming its RECOMMENDED backdrop - it rides along
    # in the AI-facing inventories as a nudge only; sky and weather stay
    # free to mix any other way. text_decoration/ is the INLINE kind:
    # <name>.css skins a {{name|text}} span right in the prose (same
    # sheet-is-the-vocabulary rule as the screen kinds); an optional
    # <name>.json sidecar carries its "desc" plus a "render" mode when the
    # look needs the frontend's DOM builders instead of plain css
    # ("sparkle" scatters seeded stars, "woozy" reels per letter).
    # Like sfx_builtin the default
    # pack is the
    # global BASE for these too: its folders are the base collection, and a
    # campaign pack overrides files one by one and adds new names. THE
    # FOLDERS ARE THE WHOLE VOCABULARY - nothing in the code hardcodes a
    # list of weather kinds, sky kinds, overlays, pulses or text
    # decorations; a name exists exactly
    # when the default base or the campaign's pack ships its file. The
    # frontend loads the sheets after the module's own css, so a pack's
    # re-skin wins by cascade.
    FX_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")
    ASSET_KINDS = ("ambience", "music", "sfx", "img", "stingers", "sfx_builtin",
                   "overlays", "weather", "pulses", "skies", "text_decoration",
                   "palettes", "fonts")
    # CHROME is different from every kind above: single FILES sitting in a
    # pack's ROOT, never a folder and never a stem-by-stem vocabulary.
    # thinking.svg is the sigil injected into #adv-thinking while the GM
    # ponders behind the hidden chain and thinking.css skins it;
    # thinking_text.json carries the world's own words for the wait
    # ("thinking": shown while the GM ponders, "prompt": while the request
    # is away, no tokens have landed, or tool RESULTS are running,
    # "tool": while it writes out its tool calls) merged field by field
    # over the default base - each field is
    # one string or a LIST of them, and a list rotates to a new random
    # entry every 2-5 s while its phase holds, and
    # thinking_text.css skins the words under the sigil (font and the
    # animation that lives there, and colors that should ride the palette
    # vars applyTheme paints - --adv-accent, --adv-ink-soft,
    # --adv-link-hover - so the line speaks the campaign's own tongue;
    # the phases are also classed
    # .adv-think-prompt/.adv-think-tool for css that wants them apart, and
    # while the prompt phase runs plus.js writes --adv-think-charge (0..1,
    # real prompt-eval progress) on the line so a set can make the words
    # THEMSELVES the quiet progress gauge, and sheds .adv-think-spark
    # motes at charge rate for a sheet to light (a mote a sheet does not
    # style stays invisible - same opt-out as the caret particles));
    # dice.css
    # restyles the roll flourish, dice.json carrying its glyph overrides
    # ("faces": six die-face glyphs, "heads"/"tails": the coin's faces);
    # caret.css skins the sprite that rides the typewriter cursor AND the
    # .adv-caret-p particles the engine emits at the caret's spot and
    # leaves behind as it moves on (positioning and emission belong to
    # adventure_type.js - glyphs, particle looks and ALL animation live
    # in the sheet; particle animations must be FINITE, the engine
    # recycles each one on animationend plus a 3s safety net, and the
    # engine hands each spawn a random v0/v1/v2 variant class to scatter
    # the trail). Two visibility classes ride the sprite: .adv-caret-on
    # (a character just landed - hides on pauses, skip and stream end,
    # the fantasy way) and .adv-caret-stay (lives from the turn's first
    # character until the turn retires - pauses and stream end keep the
    # cursor visible, the scifi terminal way; a sheet picks its class).
    # The campaign's own pack replaces the default base's file
    # FOR FILE (a pack's caret.css IS its caret look whole, not a cascade
    # add-on - "#adv-caret {display:none}" and no ".adv-caret-p" styling
    # simply switches the effect off for that world). All
    # slots ride to the frontend on the /fx route; nothing here is ever
    # named in a tool call: the pack's root files ARE the chrome.
    CHROME_FILES = ("thinking.svg", "thinking.css", "thinking_text.json",
                    "thinking_text.css", "dice.css", "dice.json", "caret.css")
    # the audio bed slots (sfx_builtin/typing_loop.*, sfx_builtin/
    # thinking_loop.*) carry a VARIABLE extension, so they are scanned
    # by stem instead of being listed in CHROME_FILES
    LOOP_EXTS = (".mp3", ".ogg", ".wav", ".m4a", ".aac", ".opus", ".flac")
    # pipe macros the frontend matches before any decoration name is
    # consulted - a decoration may never claim one of these
    TD_RESERVED = ("stat", "item", "status", "statusoff", "music", "sfx", "img", "sd")
    DEFAULT_PACK = "default"

    def _asset_packs(self):
        # installed pack names, lowercased and sorted: any asset_packs/
        # subfolder carrying at least one kind folder
        found = []
        try:
            for name in sorted(os.listdir(self.ASSET_PACKS_DIR)):
                low = name.lower()
                if low.startswith("."):
                    continue
                folder = os.path.join(self.ASSET_PACKS_DIR, name)
                if not os.path.isdir(folder):
                    continue
                if (any(os.path.isdir(os.path.join(folder, kind)) for kind in self.ASSET_KINDS)
                        or any(os.path.isfile(os.path.join(folder, f)) for f in self.CHROME_FILES)):
                    found.append(low)
        except OSError:
            return []
        return found

    def _default_pack(self):
        packs = self._asset_packs()
        if self.DEFAULT_PACK in packs:
            return self.DEFAULT_PACK
        return packs[0] if packs else ""

    def _resolve_pack(self, asset_pack):
        # an unknown or empty pack name falls back to the default, so a
        # campaign always rides a real folder (or none at all)
        low = str(asset_pack or "").strip().lower()
        if low in self._asset_packs():
            return low
        return self._default_pack()

    def _pack_of(self, c):
        # the campaign's own pack name: campaigns saved before the
        # asset-set -> asset-pack rename still carry the old storage key
        # and simply read through as this campaign's pack
        return str(c.get("asset_pack") or c.get("asset_set") or "") or self._default_pack()

    def _kind_dir(self, asset_pack, kind):
        return os.path.join(self.ASSET_PACKS_DIR, str(asset_pack or self.DEFAULT_PACK), kind)

    def _chrome_url(self, folder_pack, fname):
        # one chrome slot's file in a pack's ROOT (see CHROME_FILES),
        # empty string when that pack does not ship it
        try:
            if os.path.isfile(os.path.join(self.ASSET_PACKS_DIR, str(folder_pack), fname)):
                return f"/ext-assets/adventure_games/asset_packs/{folder_pack}/" + fname
        except (OSError, TypeError, ValueError):
            pass
        return ""

    def _chrome_pick(self, asset_pack, fname):
        # the campaign pack's root file wins over the default base's
        return (self._chrome_url(asset_pack, fname)
                or self._chrome_url(self._default_pack(), fname))

    def _bed_url(self, asset_pack, stem):
        # an optional audio bed: <stem>.<audio> in sfx_builtin/
        # (typing_loop = the typewriter's voice replacing per-key
        # clacks; thinking_loop = a hum riding the thinking indicator).
        # The campaign pack's file wins over the default base's; no file
        # anywhere means each feature's frontend default (clacks /
        # silence).
        for folder_pack in (asset_pack, self._default_pack()):
            try:
                folder = os.path.join(self.ASSET_PACKS_DIR, str(folder_pack), "sfx_builtin")
                for fname in sorted(os.listdir(folder)):
                    s, ext = os.path.splitext(fname)
                    if s == stem and ext.lower() in self.LOOP_EXTS:
                        return f"/ext-assets/adventure_games/asset_packs/{folder_pack}/sfx_builtin/" + fname
            except OSError:
                pass
        return ""

    def _chrome_json(self, asset_pack, fname):
        # a chrome json slot (dice.json's glyph spec) merged field by
        # field: the default base first, the campaign's pack over it
        spec = {}
        for folder_pack in (self._default_pack(), asset_pack):
            path = os.path.join(self.ASSET_PACKS_DIR, str(folder_pack), fname)
            if not os.path.isfile(path):
                continue
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, dict):
                    merged = dict(spec)
                    merged.update(data)
                    spec = merged
            except (OSError, ValueError):
                pass  # a broken spec is simply absent
        return spec

    def _scan_names(self, asset_pack, kind, exts, uniq=False):
        # filenames without extension, in play-order; rescanned per call so
        # new drops are picked up live
        try:
            names = []
            for fname in sorted(os.listdir(self._kind_dir(asset_pack, kind))):
                stem, ext = os.path.splitext(fname)
                name = stem.lower()
                if ext.lower() in exts and name:
                    if uniq and name in names:
                        continue
                    names.append(name)
            return names
        except OSError:
            return []

    def _scan_merged(self, asset_pack, kind, exts):
        # how every kind's names are read: the default pack is the global
        # base, the campaign's own pack rides over it stem by stem (its
        # same-named files win), and whatever the pack lacks stays the
        # default's. Unique stems, sorted; rescanned per call.
        names = set(self._scan_names(self._default_pack(), kind, exts, uniq=True))
        names.update(self._scan_names(asset_pack, kind, exts, uniq=True))
        return sorted(names)

    def _ambience_tracks(self, asset_pack):
        return self._scan_merged(asset_pack, "ambience", self.AUDIO_EXTS)

    # the ambience BED: several loops layered at once, each with a volume
    # relative to the overall ambience setting. stored as one compact spec:
    # "rain:70,summer-night" - a bare stem plays at 100%. This is simply
    # how the AI says it, and a lone loop stays the one-element case.

    def _amb_spec(self, layers):
        # {stem: vol} -> canonical spec string (100% layers stay bare)
        parts = []
        for stem, vol in layers.items():
            parts.append(stem if vol >= 100 else f"{stem}:{vol}")
        return ",".join(parts)

    def _amb_layers(self, c):
        # stored spec -> {stem: vol}, order kept, bare stem = 100
        layers = {}
        for part in str(c.get("ambience") or "").split(","):
            stem, sep, vol_str = part.strip().partition(":")
            if not stem:
                continue
            try:
                vol = int(vol_str) if sep else 100
            except ValueError:
                vol = 100
            layers[stem] = max(0, min(100, vol))
        return layers

    def _amb_names(self, c):
        return list(self._amb_layers(c))

    def _parse_ambience(self, spec, asset_pack):
        # "rain:70, summer-night.ogg" -> ("rain:70,summer-night", None);
        # "off"/"" -> ("", None); unknown stem -> ("", error). The stem may
        # only come from the campaign's asset pack or the default base - a
        # loop that lives in some OTHER pack is as unknown as one that was
        # never installed.
        loops = self._ambience_tracks(asset_pack)
        layers = {}
        for part in str(spec or "").split(","):
            stem, sep, vol_str = part.strip().lower().partition(":")
            # tolerate "thunder.ogg" style answers: keep the stem
            stem = os.path.splitext(stem)[0]
            if not stem or stem == "off":
                continue
            if stem not in loops:
                hint = (f"options: {', '.join(loops)}, off" if loops else
                        "no ambient loops are installed (neither the "
                        "campaign's asset pack nor the default base has an "
                        "ambience/ file)")
                return "", f"unknown ambience track '{stem}' - {hint}"
            if not sep:
                layers[stem] = 100
                continue
            try:
                vol = int(vol_str)
            except ValueError:
                return "", f"invalid volume '{vol_str.strip()}' for '{stem}' - use a percentage, like rain:70"
            layers[stem] = max(0, min(100, vol))
        return self._amb_spec(layers), None

    def _env_apply(self, c, ambience="", music="", weather="", sky="", effects=None, banner=None):
        # the shared environment setter behind game_start AND set_scene:
        # a scene transition restages the whole world in one stroke.
        # Tolerant by design - an unknown loop/track/sky/overlay is skipped
        # with a note instead of failing the call; the valid ones still set.
        # Empty string / None means "leave this aspect exactly as it is";
        # "off" clears it. Returns the skip notes.
        # validation runs against the campaign's asset pack plus the default
        # base, so an unknown loop/track from ANOTHER pack is skipped
        # exactly like one that was never installed at all
        notes = []
        apack = self._pack_of(c)
        if ambience:
            beds, err = self._parse_ambience(ambience, apack)
            if err:
                notes.append("skipped ambience - " + err)
            else:
                c["ambience"] = beds
        if music:
            tune, ext = os.path.splitext(str(music).strip().lower())
            if tune in ("", "off"):
                c["music"] = ""
            elif tune in self._music_tracks(apack):
                c["music"] = tune
            else:
                notes.append(f"skipped music '{tune}' - no such track in the campaign's asset pack or the default base")
        if weather:
            name = str(weather).strip().lower()
            if name == "off":
                c["weather"] = ""
            elif name in self._weathers_for(apack):
                c["weather"] = name
            else:
                notes.append(f"skipped weather '{name}' - no weather file ships this kind (campaign pack or default base) - check the campaign's weather inventory")
        if sky:
            name = str(sky).strip().lower()
            if name == "off":
                c["sky"] = ""
            elif name in self._skies_for(apack):
                c["sky"] = name
            else:
                notes.append(f"skipped sky '{name}' - no sky file ships this kind (campaign pack or default base) - check the campaign's sky inventory")
        if effects is not None:
            parsed = {}
            for name in effects:
                name = str(name).strip().lower()
                if not name:
                    continue
                if name == "off":
                    parsed = {}
                    break
                if name in self._pulses_for(apack):
                    notes.append(f"skipped effect '{name}' - one-shot pulse, fire it inline in prose with " + "{{" + name + "}}")
                    continue
                if name not in self._overlays_for(apack):
                    notes.append(f"skipped effect '{name}' - no overlay file ships this mood (campaign pack or default base) - check the campaign's overlay inventory")
                    continue
                parsed[name] = 0
            c["effects"] = parsed
        if banner is not None:
            b = str(banner).strip()
            c["banner"] = "" if b.lower() == "off" else str(banner)[:4000]
        return notes

    # one-shot sound effects live in <pack>/sfx/: drop any
    # .ogg/.mp3/.wav/.m4a/.flac file in there and its stem becomes a
    # {{sfx|stem}} macro option of that pack immediately.
    # the built-in stamp sounds (quest chimes, coin pings...) live in each
    # pack's sfx_builtin/ folder: the campaign's own pack overrides a stamp
    # file-by-file, everything it doesn't carry falls back to the default
    # pack's sfx_builtin/ (the global base). The interface plays them itself
    # from backend event stamps, so they are deliberately NOT offered to
    # the AI as {{sfx}} options and the frontend blocks their names from
    # the macro too.
    BUILTIN_SFX = ("coin_flip", "quest", "stage", "pickup", "status",
                   "cleanse", "crit", "fumble", "dice_roll",
                   "chime", "stat_up", "stat_down", "thump",
                   "send", "reply_start", "complete", "reasoning",
                   "token", "type_key", "quill", "image_insertion",
                   "typing_loop", "thinking_loop", "scene_change",
                   "sleep", "morning")

    def _sfx_names(self, asset_pack):
        return self._scan_merged(asset_pack, "sfx", self.AUDIO_EXTS)

    # the soundtrack lives in <pack>/music/: drop any
    # .ogg/.mp3/.wav/.m4a/.flac file in there and it becomes a {{music}}
    # macro option of that pack immediately. tracks loop seamlessly on the
    # frontend - for a truly gapless loop the file itself should be encoded
    # loop-ready.
    def _music_tracks(self, asset_pack):
        return self._scan_merged(asset_pack, "music", self.AUDIO_EXTS)

    # the picture library lives in <pack>/img/: drop any supported image
    # file in there and its stem becomes a {{img|stem}} macro option of
    # that pack immediately (the first file of that stem, in any format, is
    # the one inserted). rescanned live, so new drops work without a restart.
    def _img_names(self, asset_pack):
        return self._scan_merged(asset_pack, "img", self.IMG_EXTS)

    # VISUAL kinds: overlays/, weather/, skies/ and pulses/ hold <name>.css
    # plus an optional <name>.glsl shader (and for weather and skies a
    # <name>.json particle spec). A shader replaces the plain div with a
    # live GLSL canvas at
    # runtime; the css sheet keeps styling it, so css alone stays a full
    # fallback and shader+css layer the two together. A pack's files
    # ADD names to the vocabulary and CASCADE-OVERRIDE base looks of the
    # same name (the frontend loads pack sheets after the module's own
    # css). THE FOLDERS ARE THE WHOLE VOCABULARY: the default pack ships
    # the base collection and the campaign's pack rides over it - no name list
    # is hardcoded anywhere, so a kind exists (and reaches the AI-facing
    # inventories and the validation checks) exactly when a file ships
    # it. An optional <name>.json beside an overlay carries its meaning
    # as {"desc": "..."}; a lone sidecar never makes a name - overlays
    # and pulses need a LOOK (a css or a glsl), only weather accepts a
    # spec-only kind. Names are filtered to plain [a-z0-9_] words -
    # pulse names double as macro names and feed a client-side RegExp,
    # so a filename like "a+b.css" must never reach it.
    def _fx_scan(self, asset_pack, kind):
        # name -> set of extensions present in this folder
        found = {}
        try:
            for fname in sorted(os.listdir(self._kind_dir(asset_pack, kind))):
                stem, ext = os.path.splitext(fname)
                name = stem.lower()
                ext = ext.lower()
                if ext not in (".css", ".glsl", ".json"):
                    continue
                if not self.FX_NAME_RE.match(name):
                    continue
                found.setdefault(name, set()).add(ext)
        except OSError:
            return {}
        return found

    def _fx_names(self, asset_pack, kind):
        # the usable names of one folder: weather takes any of the three
        # files (a shader-only or spec-only kind is real), overlays, skies
        # and pulses need a LOOK - a lone json is just their spec sidecar
        found = self._fx_scan(asset_pack, kind)
        if kind == "weather":
            return sorted(found)
        return sorted(n for n, exts in found.items() if exts & {".css", ".glsl"})

    def _fx_desc(self, asset_pack, kind, name):
        # the optional meaning of one name: <name>.json's "desc" string,
        # the campaign pack's sidecar winning over the default base's
        for folder_pack in (asset_pack, self._default_pack()):
            try:
                with open(os.path.join(self._kind_dir(folder_pack, kind),
                                       name + ".json"), "r", encoding="utf-8") as fh:
                    spec = json.load(fh)
            except (OSError, ValueError):
                continue
            if isinstance(spec, dict) and spec.get("desc"):
                return str(spec["desc"])
        return ""

    def _pack_fx_names(self, asset_pack, kind):
        # the visual vocabulary of a campaign: the default pack's files are
        # the global base, and the campaign's own pack rides over them
        # file by file
        names = set(self._fx_names(self._default_pack(), kind))
        names.update(self._fx_names(asset_pack, kind))
        return names

    def _overlays_for(self, asset_pack):
        # every overlay this campaign may hold
        return sorted(self._pack_fx_names(asset_pack, "overlays"))

    def _weathers_for(self, asset_pack):
        return sorted(self._pack_fx_names(asset_pack, "weather"))

    def _skies_for(self, asset_pack):
        return sorted(self._pack_fx_names(asset_pack, "skies"))

    def _pulses_for(self, asset_pack):
        return sorted(self._pack_fx_names(asset_pack, "pulses"))

    def _decorations_for(self, asset_pack):
        # every inline text decoration this campaign may name: a name is
        # real when a <name>.css ships in the campaign's pack or the default
        # base (css-only: the shader runtime paints whole-window canvases,
        # never inline text). Reserved pipe-macro names can never be
        # decorations - the frontend matches those first, so a colliding
        # sheet would be dead weight with a misleading inventory entry.
        found = set()
        for folder_pack in (asset_pack, self._default_pack()):
            for name, exts in self._fx_scan(folder_pack, "text_decoration").items():
                if ".css" in exts and name not in self.TD_RESERVED:
                    found.add(name)
        return sorted(found)

    def _decoration_vocab(self, asset_pack):
        # the decoration vocabulary annotated with each <name>.json desc,
        # same contract as _overlay_vocab
        parts = []
        for name in self._decorations_for(asset_pack):
            desc = self._fx_desc(asset_pack, "text_decoration", name)
            parts.append(f"{name} ({desc})" if desc else name)
        return " | ".join(parts)

    def _overlay_vocab(self, asset_pack):
        # the full held-overlay vocabulary as ONE continuous list: every
        # name the default base or the campaign's pack ships, each one
        # annotated with its <name>.json desc when it has one (a mood
        # without a sidecar stays a bare name - its look is discovered
        # by trying it)
        parts = []
        for name in self._overlays_for(asset_pack):
            desc = self._fx_desc(asset_pack, "overlays", name)
            parts.append(f"{name} ({desc})" if desc else name)
        return " | ".join(parts)

    def _sfx_cues(self, asset_pack):
        # library stems only: the built-in stamp sounds (BUILTIN_SFX) live in
        # sfx_builtin/ and are the interface's own vocabulary - the AI offers
        # and fires only what the player dropped in
        return self._sfx_names(asset_pack)

    def _sfx_event(self, c, name):
        # stamp a one-shot for the frontend; the counter lets the same sound
        # replay back-to-back (same-name events need a fresh nonce)
        ev = c.get("sfx_event") or {}
        c["sfx_event"] = {"name": str(name), "n": int(ev.get("n") or 0) + 1}

    # stingers are the pack's stingers/ folder's longer, musical one-shots:
    # they depict a CUE MOMENT in the story (a reveal, a level-up, a death).
    # They exist only for the play_stinger tool - the {{sfx}} macro never
    # reaches this folder, so a stinger can never slip into flowing prose.
    # While one plays, the frontend fades the soundtrack out and pauses
    # it, then resumes and fades it back in when the stinger ends.
    def _stinger_names(self, asset_pack):
        return self._scan_merged(asset_pack, "stingers", self.AUDIO_EXTS)

    def _stinger_event(self, c, name, desc=""):
        # stamp a one-shot stinger for the frontend; same fresh-nonce trick
        # as _sfx_event, so the same cue moment can replay back-to-back.
        # desc rides along: the frontend shows it on screen for exactly as
        # long as the stinger plays.
        ev = c.get("stinger_event") or {}
        c["stinger_event"] = {"name": str(name),
                              "desc": str(desc or "")[:240],
                              "n": int(ev.get("n") or 0) + 1}

    def _world_desc(self, asset_pack):
        # a pack's optional world.txt (its ROOT, beside the chrome files):
        # one deliberately vague paragraph about what world a campaign of
        # this pack lives in, handed to the GM with game_start (and
        # get_assets). No default-base fallback - a pack describes its own
        # world or stays silent; the blanks are left for the GM on purpose.
        path = os.path.join(self.ASSET_PACKS_DIR, str(asset_pack or ""), "world.txt")
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read().strip()[:2000]
        except (OSError, TypeError, ValueError):
            return ""

    def _asset_list_block(self, apack):
        # the chosen asset pack's full toolbox, handed back once at
        # game_start: the system prompt only names the PACKS, so this is
        # where the GM learns which loops / tracks / sounds / pictures /
        # stingers this campaign may actually name.
        if not apack:
            return ("No asset pack is installed (webui/assets/asset_packs/ holds no "
                    "pack folders) - this campaign has no ambient loops, music, "
                    "sound effects, images or stingers.")
        lines = [f"Asset pack '{apack}' is loaded for this campaign. These assets exist for it "
                 f"(the pack's own files over the default pack's base - same names are the pack's versions):"]
        world = self._world_desc(apack)
        if world:
            lines.append("World (the pack's own sketch - vague on purpose, the blanks are yours "
                         "to fill, just stay consistent with what it names): " + world)
        loops = self._ambience_tracks(apack)
        lines.append("Ambience loops (set_scene ambience=): " + (", ".join(loops) if loops else "(none)"))
        songs = self._music_tracks(apack)
        lines.append("Music tracks ({{music}} / set_scene music=): " + (", ".join(songs) if songs else "(none)"))
        cues = self._sfx_cues(apack)
        lines.append("Sound effects ({{sfx|name}}): " + (", ".join(cues) if cues else "(none)"))
        pics = self._img_names(apack)
        lines.append("Images ({{img|name}}): " + (", ".join(pics) if pics else "(none)"))
        stingers = self._stinger_names(apack)
        lines.append("Stingers (play_stinger): " + (", ".join(stingers) if stingers else "(none)"))
        # every kind as one continuous merged list: this pack's own assets
        # over the default base, same names being the pack's versions
        lines.append("Overlays (screen_effect tool / set_scene effects=): " + self._overlay_vocab(apack))
        lines.append("Weather kinds (set_scene weather=): " + self._weather_vocab(apack) + ", off")
        lines.append("Sky kinds (set_scene sky=): " + ", ".join(self._skies_for(apack)) + ", off")
        lines.append("One-shot pulses (inline {{name}} macros): " + ", ".join(self._pulses_for(apack)))
        lines.append("Text decorations (inline {{name|text}} macros): " + self._decoration_vocab(apack))
        lines.append("Palettes (game_start palette=): " + ", ".join(sorted(self._palettes_for(apack))) +
                     " (or a custom color object)")
        lines.append("Fonts (game_start font=): " + ", ".join(self._fonts_for(apack)) +
                     " (or any CSS font-family)")
        # the chrome slots: single root files of this pack over the default
        # base. Nothing to name here - the campaign's pack's files ARE the
        # chrome (custom = this pack ships its own version)
        def chrome_state(fname):
            if self._chrome_url(apack, fname):
                return "custom"
            return "default" if self._chrome_url(self._default_pack(), fname) else "none"
        lines.append("Chrome (automatic, never named in a tool) - thinking sigil: " +
                     chrome_state("thinking.svg") + ", sigil skin: " + chrome_state("thinking.css") +
                     ", wait wording: " + chrome_state("thinking_text.json") +
                     " + " + chrome_state("thinking_text.css") +
                     ", dice skin: " + chrome_state("dice.css") +
                     ", dice glyphs: " + chrome_state("dice.json") +
                     ", typewriter caret: " + chrome_state("caret.css") +
                     ", typing sound: " + ("loop" if self._bed_url(apack, "typing_loop") else "keystrike") +
                     ", thinking sound: " + ("loop" if self._bed_url(apack, "thinking_loop") else "silent"))
        return "\n".join(lines)

    async def _await_beat(self, chat_id, kind, cap_seconds):
        # pacing handshake, same shape as the meditation module's countdown:
        # some tool calls put a beat on the player's screen that takes
        # seconds to play out (dice flourish, title card, curtains). Register
        # an event and let the browser release it via /anim_done the moment
        # its animation completes, so the tool result lands after the player
        # has seen the beat. A cap always frees the call: the beat is pure
        # presentation and must never stall the story if no browser answers.
        if not chat_id:
            return
        if time.time() - self._ui_seen > 4:
            return  # no webui watching this beat (other channel, closed tab)
        key = str(chat_id)
        evt = asyncio.Event()
        self._beat_events[key] = (kind, evt)
        try:
            await asyncio.wait_for(evt.wait(), timeout=cap_seconds)
        except asyncio.TimeoutError:
            pass
        if self._beat_events.get(key, (None, None))[1] is evt:
            self._beat_events.pop(key, None)

    async def _await_typing(self, chat_id, cap_seconds=300):
        # The reveal handshake: a tool call that lands while the player is
        # still watching the passage type out waits until the typewriter has
        # revealed everything. The busy flag rides the browser's own state
        # heartbeat (/state?typing=1, ~450 ms while the turn runs), so this
        # costs no extra traffic: the wait re-reads the freshest report twice
        # a second and frees the call the moment the browser says it caught
        # up (reveal finished, Skip pressed, a hidden tab flushed it, or no
        # browser was watching at all). Reports going stale free the wait too
        # - a vanished browser never stalls the story; the cap is pure
        # insurance long past any honest passage. Returns a note for the tool
        # result when a real hold happened, so the delay is never a mystery
        # to the GM.
        if not chat_id or self.config.get("typewriter") is False:
            return ""
        key = str(chat_id)
        state = self._typing.get(key)
        if not state or not state[0] or time.time() - state[1] > 3:
            return ""
        start = time.time()
        while True:
            await asyncio.sleep(0.5)
            if time.time() - start > cap_seconds:
                break
            cur = self._typing.get(key)
            if not cur or not cur[0]:
                break  # the reveal caught up: the tool runs now
            if time.time() - cur[1] > 3:
                break  # the browser stopped reporting: never stall on it
        waited = time.time() - start
        if waited < 1.0:
            return ""
        return (f" [held {waited:.0f}s: this call landed while the player was still "
                "watching the passage type out, and ran only after the reveal finished]")

    # torch logic: how dark the screen edges get, derived from the clock.
    # carried light sources - or a crackling fireplace loop - hold it at bay.
    LIGHT_WORDS = ("torch", "lantern", "candle", "lamp", "light",
                   "glowstone", "glowstick", "glowworm")

    def _light_level(self, c):
        cl = c.get("clock") or {}
        h = int(cl.get("hour", 8))
        if 6 <= h < 20:
            dark = 0
        elif 20 <= h < 22:
            dark = (h - 20) * 50
        elif 4 <= h < 6:
            dark = (6 - h) * 50
        else:
            dark = 100
        if dark:
            carried = any(
                w in str(name).lower() and int(item.get("qty", 1) or 0) > 0
                for name, item in (c.get("inventory") or {}).items()
                for w in self.LIGHT_WORDS
            )
            if carried:
                dark = min(dark, 35)
            elif "fireplace" in self._amb_names(c):
                dark = min(dark, 45)
        return dark

    @staticmethod
    def _light_word(level):
        if level >= 70:
            return "pitch dark"
        if level >= 40:
            return "dim"
        if level > 0:
            return "gloaming"
        return "lit"

    # THEME kinds: palettes/ and fonts/ ride the campaign's asset pack the
    # same way every other kind does - the default pack's folders are the
    # global base, the campaign's pack overrides file by file and may add
    # names of its own. THE FOLDERS ARE THE WHOLE VOCABULARY.
    # palettes/<name>.json holds {"label"?, "prefers": "light"|"dark"?,
    # "light": {...}, "dark": {...}}; every variant may also carry a "tint"
    # map ({dawn, morning, afternoon, dusk, night, deepnight} -> CSS
    # background) the frontend lays over the story as the campaign clock
    # turns. A palette needs at least one complete variant; its label
    # defaults to the file's stem.
    PALETTE_EXTS = (".json",)

    def _read_palette(self, folder_pack, name):
        # one palette file parsed, or None. variant fields are copied out
        # one by one: "dark" stays a bool, nested dicts (the "tint" map)
        # pass through untouched, everything else stringifies
        try:
            with open(os.path.join(self._kind_dir(folder_pack, "palettes"),
                                   name + ".json"), "r", encoding="utf-8") as fh:
                spec = json.load(fh)
        except (OSError, ValueError):
            return None
        if not isinstance(spec, dict):
            return None
        variants = {}
        for mode in ("light", "dark"):
            raw = spec.get(mode)
            if not isinstance(raw, dict) or not raw:
                continue
            out = {}
            for k, v in raw.items():
                if k == "dark":
                    out[str(k)] = bool(v)
                elif isinstance(v, dict):
                    out[str(k)] = v
                else:
                    out[str(k)] = str(v)
            variants[mode] = out
        if not variants:
            return None
        prefers = spec.get("prefers")
        if prefers not in variants:
            prefers = "light" if "light" in variants else next(iter(variants))
        label = str(spec.get("label") or name.replace("_", " ").title())
        return {"label": label, "prefers": prefers, "variants": variants}

    def _palettes_for(self, asset_pack):
        # name -> parsed palette: the default base first, the campaign's
        # own pack overriding same-named files on top
        out = {}
        for folder_pack in (self._default_pack(), asset_pack):
            for name in self._scan_names(folder_pack, "palettes", self.PALETTE_EXTS, uniq=True):
                spec = self._read_palette(folder_pack, name)
                if spec:
                    out[name] = spec
        return out

    def _resolve_palette(self, palette, asset_pack=None):
        # custom dict palettes stay flat (used as-is in both modes); a
        # named palette resolves against the campaign's pack over the
        # default base, falling back to rose_quartz, then to the first
        # installed palette
        apack = self._resolve_pack(asset_pack)
        base = self._palettes_for(apack)
        if isinstance(palette, dict) and palette:
            first = base.get("rose_quartz") or next(iter(base.values()), None)
            merged = dict(first["variants"].get("light", {})) if first else {}
            for k, v in palette.items():
                if k in ("variants", "prefers", "label"):
                    continue
                merged[str(k)] = bool(v) if k == "dark" else (v if isinstance(v, dict) else str(v))
            merged["label"] = str(palette.get("label", "Custom"))
            return merged
        named = base.get(str(palette).strip().lower()) if isinstance(palette, str) else None
        named = named or base.get("rose_quartz") or next(iter(base.values()), None)
        if not named:
            return {}
        return {
            "label": named["label"],
            "prefers": named["prefers"],
            "variants": {m: dict(v) for m, v in named["variants"].items()},
        }

    @staticmethod
    def _palette_view(pal):
        """palettes carry both light and dark variants; pick the variant that
        matches the palette's native character (for banner color hints)"""
        if not isinstance(pal, dict):
            return {}
        variants = pal.get("variants")
        if variants:
            return variants.get(pal.get("prefers") or "dark") or variants.get("dark") or variants.get("light") or {}
        return pal

    # fonts/<name>.txt holds one CSS font stack; fonts/<name>.woff2/.woff/
    # .otf/.ttf is a REAL font file the frontend registers as the family
    # "adv-<name>" (the /fonts route hands out the face list). A stem with
    # both a file and a txt plays the FILE - stacks are for system faces,
    # files ship their own.
    FONT_FILE_EXTS = (".woff2", ".woff", ".otf", ".ttf")
    FONT_FILE_FMT = {".woff2": "woff2", ".woff": "woff", ".otf": "opentype", ".ttf": "truetype"}

    def _font_stacks(self, asset_pack):
        # name -> CSS stack from fonts/<name>.txt, campaign pack over base
        stacks = {}
        for folder_pack in (self._default_pack(), asset_pack):
            for name in self._scan_names(folder_pack, "fonts", (".txt",), uniq=True):
                try:
                    with open(os.path.join(self._kind_dir(folder_pack, "fonts"),
                                           name + ".txt"), "r", encoding="utf-8") as fh:
                        stack = " ".join(fh.read().split())
                except OSError:
                    continue
                if stack:
                    stacks[name] = stack
        return stacks

    def _font_faces(self, asset_pack):
        # name -> ordered urls of real font files; several formats of one
        # stem all ride, most modern first (the browser takes the first it
        # supports), and the campaign's pack wins over the default base
        # stem by stem
        faces = {}
        for folder_pack in (self._default_pack(), asset_pack):
            found = {}
            try:
                for fname in sorted(os.listdir(self._kind_dir(folder_pack, "fonts"))):
                    stem, ext = os.path.splitext(fname)
                    name = stem.lower()
                    if ext.lower() in self.FONT_FILE_EXTS and name:
                        found.setdefault(name, []).append((ext.lower(), fname))
            except OSError:
                continue
            for name, items in found.items():
                items.sort(reverse=True)
                faces[name] = ["/ext-assets/adventure_games/asset_packs/"
                               + folder_pack + "/fonts/" + fname for _, fname in items]
        return faces

    def _fonts_for(self, asset_pack):
        # every font name this campaign may pick: stacks and real files alike
        return sorted(set(self._font_stacks(asset_pack)) | set(self._font_faces(asset_pack)))

    def _resolve_font(self, font, asset_pack=None):
        # a real font file wins over a txt stack of the same name; any other
        # non-empty string stays a raw CSS font stack, exactly as before
        if not isinstance(font, str):
            font = ""
        name = font.strip().lower()
        apack = self._resolve_pack(asset_pack)
        if name:
            if name in self._font_faces(apack):
                return "'adv-" + name + "', Georgia, serif"
            stacks = self._font_stacks(apack)
            if name in stacks:
                return stacks[name]
            if font.strip():
                return str(font)
        return self._font_stacks(apack).get("georgia") or \
            "Georgia, 'Palatino Linotype', 'Book Antiqua', serif"

    def _weather_vocab(self, asset_pack):
        # weather names annotated with the backdrop each one's json
        # recommends (its optional "sky" field) - a nudge for the GM only,
        # any sky still mixes freely with any weather
        parts = []
        for name in self._weathers_for(asset_pack):
            reco = ""
            for folder_pack in (asset_pack, self._default_pack()):
                try:
                    with open(os.path.join(self._kind_dir(folder_pack, "weather"),
                                           name + ".json"), "r", encoding="utf-8") as fh:
                        spec = json.load(fh)
                except (OSError, ValueError):
                    continue
                if isinstance(spec, dict) and spec.get("sky"):
                    reco = str(spec["sky"])
                    break
            parts.append(f"{name} (sky: {reco})" if reco else name)
        return ", ".join(parts)

    def _clock_str(self, c):
        cl = c.get("clock")
        if not cl:
            return None
        h = int(cl.get("hour", 8))
        m = int(cl.get("minute", 0))
        if 5 <= h < 8:
            part = "dawn"
        elif 8 <= h < 12:
            part = "morning"
        elif 12 <= h < 17:
            part = "afternoon"
        elif 17 <= h < 20:
            part = "dusk"
        elif 20 <= h < 24:
            part = "night"
        else:
            part = "deep night"
        return f"Day {int(cl.get('day', 1))}, {h:02d}:{m:02d} \u00b7 {part}"

    def _advance_clock(self, c, total_minutes):
        # shared clock math (no save): used by advance_time AND by the
        # automatic per-turn tick in on_message_inject
        cl = c.get("clock") or {"day": 1, "hour": 8, "minute": 0}
        mins = int(cl.get("day", 1) - 1) * 1440 + int(cl.get("hour", 0)) * 60 + int(cl.get("minute", 0)) + int(total_minutes)
        mins = max(0, mins)
        cl["day"] = mins // 1440 + 1
        cl["hour"] = (mins % 1440) // 60
        cl["minute"] = mins % 60
        c["clock"] = cl

    def _tick_statuses(self, c):
        changed = False
        for name in list(c.get("statuses", {})):
            s = c["statuses"][name]
            if s.get("turns"):
                s["turns"] -= 1
                if s["turns"] <= 0:
                    del c["statuses"][name]
                changed = True
        if changed:
            self.data["campaigns"][str(self._chat_id())] = c
            self.data.save()

    GAME_RULES = """GAME RULES \u2014 save these and follow them for the whole game:
- Conditional choices: append (StatName N+) to the displayed text, e.g. [[Seduce the guard (Charm 60+)]] \u2014 the interface automatically greys it out when the stat is below the threshold. Only reference stats that exist.
- The player's stats, inventory and scene are tracked by your tools \u2014 the source of truth. The player sees them in a sidebar.
- Mutate the world INLINE the moment you narrate the consequence - state macros fire as the word streams: {{stat|Gold +40, Health -15}} (comma-chained), {{item|Torch +1}} / {{item|Ration -1}} (ONLY an explicit number hands an item over - +N on an item not held yet creates it as a fresh pickup, and a leading emoji plus a ~tail dress the item it grants: {{item|🗝 Silver key +1 ~cold to the touch}}; a bare {{item|Silver key}} is a PURE MENTION - it styles the word and shows the icon but NEVER changes the inventory, and any ~tail on a mention is ignored), {{status|Poisoned 3t}} / {{statusoff|Poisoned}}, {{music|tavern_1}}. Never state a change ("you gain 10 gold") without its macro.
- Risky actions with real stakes: call roll_dice BEFORE writing the outcome, and honor the result. Pure binary fate (tossed coin, yes/no oracle): coinflip instead.
- Call set_scene when the location or story beat changes - and bring the new scene's atmosphere along AS ARGS on that same call (ambience=, music=, sky=, weather=, effects=, banner=), so every transition restages the world automatically; omit an arg to keep it as-is, "off" to clear it. Call end_game when the story reaches an ending \u2014 then write one closing passage (a game-over banner appears automatically, so no choices after it).
- Keep continuity with the [world: ...] snapshot every player message carries (clock, stats, statuses, quests, inventory, overlays, sky, weather, music) - your freshest source of truth.
- Time flows AUTOMATICALLY: the clock ticks turn_minutes on every player message, BEFORE you reply - narrate along the fresh [world:] time, never contradict it. Keep the tick matched to pace with set_turn_minutes (10-20 conversation, 60-240 travel/action, 0 frozen). advance_time is ONLY for extra one-off jumps beyond the tick, never for the passage itself.
- Quests: quest_add when the player commits to a goal (with subgoals for the beats that make it up). Sub-goals close in ANY order - subgoal_done checks one off and the quest completes itself when the last one closes; quest_done/quest_fail end one outright. Inline equivalents: {{quest|🔔 Name ~description}} opens, {{subgoal|Name :: new beat}} adds one, {{subdone|Name :: that beat}} closes one, {{questdone|Name}} / {{questfail|Name ~reason}} / {{questoff|Name}} finish, break or drop the whole quest.
- Statuses: {{status|Blinded 3t}} inflicts (turns optional; a leading emoji becomes the chip icon, e.g. {{status|✨ Blessed}}), {{statusoff|Blinded}} cures; status_visual links the overlay each drags along (e.g. Cursed \u2192 static, Love-sick \u2192 bloom) - it rides exactly as long as the status.
- Atmosphere rides WITH the scene: on every set_scene pass the ambience loops that fit (your campaign's loop list, from the game_start result - "off" for silence), comma-separated to LAYER them, each with a relative volume: "rain:70, summer-night:40", and bring sky= and weather= along whenever the backdrop or the falling things change: sky= is the backdrop (a wash, a shader sky, its own particle kinds like stars or clouds), weather= the foreground motes riding over it - the two mix freely, so snow under a clear starfield is weather=snow sky=stars. Each weather's inventory entry names a recommended backdrop sky in parentheses - for a plain scene of one weather that pairing plays safest, but sky and weather are free to mix any other way; "off" clears either alone. Whenever the scene changes, the ambience, sky and weather change with it.
- The interface animates its own beats: gold max rolls, red min rolls, scene title cards, day-rollover fades, the game-over curtain. An animated tool call (roll_dice, coinflip, set_scene, end_game, day-crossing advance_time) returns only once the player has watched it. And ANY tool call that lands while the typewriter is still revealing your prose is held until the passage has finished typing - the result then carries a [held Ns...] note, so a delayed call is never a mystery to you. Music (from the game_start asset inventory - "off" for silence) crossfades via {{music|track}} mid-passage, or on the next set_scene's music= when the mood turns - not every passage. When a game starts, pick the asset_pack that matches your world and set the opening inventory, quests, ambience, music, sky, weather, banner, scene and location DIRECTLY on game_start - one call.
- Dialogue format: start a spoken line with **Name:** - the UI reads that prefix to give each speaker a consistent color. Nothing else about how you write dialogue is dictated.
- Text decoration macros style single words or short phrases, never whole paragraphs: {{name|decorated text}} with a name from the campaign's "Text decorations" list (the game_start result and the per-message state block) - e.g. {{whisper|a soft word}}. The list is the whole vocabulary: the campaign's asset pack ships it, so never invent a decoration name that is not on it.
- Scene art: {{img|name}} drops a picture from the campaign's "Images available" list (in the game_start result) straight into the passage, e.g. {{img|tavern}} - place it where it belongs and narrate toward it. A placement tail steers the frame: {{img|name|left}} / {{img|name|right}} float the picture beside the paragraph with the prose wrapping around it (lovely for scenery during dialogue or long description), {{img|name|center}} or a plain {{img|name}} gives it its own full-width line (use for the passage's hero shot). Only ever use a name from that list; if the list is empty there are no pictures to place, so don't invent one.
- Sound: {{sfx|sword_clash}} fires a one-shot as the words stream - pick names from the campaign's "Sound effects" list (in the game_start result), sprinkle them through combat and set-pieces, and ALWAYS narrate what is heard ("{{sfx|sword_slash}} the blade bites - a wet crack"); STINGERS are the other tier - musical scores for the story's CUE MOMENTS: revelation, boss falling, omens, major world-scale events, betrayal, time-skip. Fire play_stinger (tool-only) BEFORE the beat's prose - the call waits for the music."""

    # -------------------------
    #   AI TOOLS
    # -------------------------

    @core.module.tool
    async def get_assets(self, asset_pack: str = ""):
        """Inspect the asset packs BEFORE dressing a campaign in one. With no argument: one line per installed pack with per-kind counts of what the pack carries itself (the chooser view). With asset_pack: that pack's full EFFECTIVE inventory - its world sketch (world.txt, when it ships one), every ambience loop, music track, {{sfx}} sound, {{img}} picture, stinger, overlay mood, weather kind, sky kind, one-shot pulse, inline text decoration, palette and font a campaign of it may name, plus the pack's chrome (thinking sigil + skin, dice skin + glyphs, typewriter caret - single root files, applied automatically), the default pack's base merged in as one continuous list per kind. Check here before game_start so the chosen pack and its opening ambience/music use real names; mid-game, the live campaign's own inventory rides on get_campaign.

        Args:
            asset_pack: An installed pack name to list in full; omit for the overview of all packs
        """
        held = await self._await_typing(self._chat_id())
        packs = self._asset_packs()
        low = str(asset_pack or "").strip().lower()
        if low:
            if low not in packs:
                return self.result(f"unknown asset pack '{low}' - installed packs: {', '.join(packs) or '(none)'}", success=False)
            return self.result(held + self._asset_list_block(low), success=True)
        if not packs:
            return self.result("no asset packs are installed (webui/assets/asset_packs/ holds no folder with kind subfolders like ambience/ music/ sfx/ img/ stingers/ or sfx_builtin/) - games run without loops, music, sound effects, images or stingers", success=True)
        lines = ["Installed asset packs:"]
        for name in packs:
            # the overview counts what a pack carries ITSELF; the full
            # inventory (asset_pack=) shows the effective list over the
            # default base
            counts = (
                f"{len(self._scan_names(name, 'ambience', self.AUDIO_EXTS))} loops",
                f"{len(self._scan_names(name, 'music', self.AUDIO_EXTS))} tracks",
                f"{len(self._scan_names(name, 'sfx', self.AUDIO_EXTS))} sounds",
                f"{len(self._scan_names(name, 'img', self.IMG_EXTS, uniq=True))} images",
                f"{len(self._scan_names(name, 'stingers', self.AUDIO_EXTS))} stingers",
                f"{len(self._fx_names(name, 'overlays'))} overlays",
                f"{len(self._fx_names(name, 'weather'))} weather",
                f"{len(self._fx_names(name, 'skies'))} skies",
                f"{len(self._fx_names(name, 'pulses'))} pulses",
                f"{len([n for n, exts in self._fx_scan(name, 'text_decoration').items() if '.css' in exts and n not in self.TD_RESERVED])} decorations",
                f"{len(self._scan_names(name, 'palettes', self.PALETTE_EXTS, uniq=True))} palettes",
                f"{len(self._scan_names(name, 'fonts', self.FONT_FILE_EXTS + ('.txt',), uniq=True))} fonts",
                f"{sum(1 for f in self.CHROME_FILES if os.path.isfile(os.path.join(self.ASSET_PACKS_DIR, name, f)))} chrome files",
            )
            lines.append(f"{name} ({', '.join(counts)})")
        lines.append('call again with asset_pack="<name>" for a pack\'s full inventory')
        lines.append("note: full inventories merge the default pack as the global base (a pack overrides same-named files, everything it lacks stays the default's); the counts above show only what each pack carries itself")
        return self.result(held + "\n".join(lines), success=True)

    @core.module.tool
    async def game_start(self, title: str, stats: dict, palette: str = "rose_quartz", font: str = "georgia", start_day: int = 1, start_hour: int = 8, inventory: dict = None, quests: dict = None, ambience: str = "", music: str = "", weather: str = "", sky: str = "", effects: list = None, banner: str = "", scene: str = "Prologue", location: str = "", turn_minutes: int = 15, asset_pack: str = ""):
        """Starts or restarts a campaign. Call when the player asks to play an adventure. Set the opening scene, gear, quests, ambience, music, sky, weather, effects and banner here in ONE call so the world is alive from the very first passage. An unknown ambience loop / music track / weather kind / sky kind / overlay name is skipped with a note instead of failing the start. Call get_assets first to pick the asset_pack that fits the game's world (the installed packs are named in the system prompt): the result then lists that pack's full inventory of every kind - loops, tracks, sounds, pictures, stingers, overlay moods, weather kinds, sky kinds, pulses and inline text decorations, the pack's assets merged over the default base as one continuous list per kind - and the campaign may only ever name assets from it or that base. When the pack ships a world.txt, its deliberately vague world sketch rides along in the result too: lean into it, fill its blanks yourself.

        Args:
            title: Adventure name
            stats: name -> number (free counter) or {value, max?, min?, icon?} (max makes a bar). Example: {"Health": {"value": 100, "max": 100, "icon": "\u2764\ufe0f"}, "Gold": 15}
            palette: name from the campaign's palette inventory (get_assets / the state block list every palette its asset pack ships) or a custom color object
            font: name from the campaign's font inventory (get_assets / the state block list stacks AND real font files a pack ships) or any CSS font-family
            start_day: Starting calendar day (default 1)
            start_hour: Starting hour 0-23 (default 8)
            inventory: Opening gear, same shape as inventory_add. Example: {"Rations": 3, "Silver key": {"icon": "\U0001f511", "desc": "Cold to the touch"}}
            quests: Opening quests, name -> one-line description or {desc?, subgoals?, icon?}. Sub-goals close in any order and the quest completes when the last one does. Example: {"The Missing Bell": {"desc": "Find the stolen chapel bell", "subgoals": ["Ask around", "Track it down", "Return it"], "icon": "\U0001f514"}}
            ambience: Opening ambience bed from the chosen asset pack's loop list - comma-separated, each loop optionally with a volume percentage ("rain:70, summer-night:40"); omit for silence
            music: Opening soundtrack from the chosen asset pack's track list; omit for silence; changes crossfade
            weather: Opening foreground weather (falling motes over the sky) from the chosen asset pack's weather inventory; omit for none
            sky: Opening sky backdrop from the chosen asset pack's sky inventory (each weather's inventory entry names a recommended backdrop - a suggestion only, any sky mixes freely with any weather); omit for a clear sky
            effects: Opening held overlays from the chosen asset pack's overlay inventory, e.g. ["fog", "dark"]; one-shot pulses belong in prose instead, fired as their inline {{name}} macros
            banner: Opening banner under the header (raw HTML, palette-styled, max 2 lines)
            scene: Opening scene title (default "Prologue")
            location: Opening location, e.g. "The rain-slicked docks of Vellmoor"
            turn_minutes: In-game minutes the clock advances automatically EVERY turn (default 15; 10-20 conversation, 60-240 travel/action, 0 frozen). Change anytime with set_turn_minutes.
            asset_pack: Installed asset-pack folder name (the system prompt names the packs, get_assets shows what each holds): one bundle of ambience loops, music tracks, {{sfx}} sounds, {{img}} pictures and stingers dressed over the campaign, plus its world sketch (world.txt) when it has one. Omit for the default pack. The default pack is the global base of every kind: this pack's own files override same-named default files, and everything it lacks stays the default's.
        """
        chat_id = self._chat_id()
        if not chat_id:
            return self.result("could not resolve the current chat", success=False)
        held = await self._await_typing(chat_id)

        self._snapshot(chat_id)
        resolved_pack = self._resolve_pack(asset_pack)
        given_pack = str(asset_pack or "").strip().lower()

        parsed_stats = {}
        for name, spec in (stats or {}).items():
            if isinstance(spec, (int, float)):
                parsed_stats[str(name)] = {"value": int(spec), "min": None, "max": None, "icon": ""}
            elif isinstance(spec, dict):
                try:
                    value = int(spec.get("value", 0))
                    mx = spec.get("max")
                    mn = spec.get("min", 0 if mx is not None else None)
                    parsed_stats[str(name)] = {
                        "value": value,
                        "min": int(mn) if mn is not None else None,
                        "max": int(mx) if mx is not None else None,
                        "icon": str(spec.get("icon", "")),
                    }
                except (TypeError, ValueError):
                    return self.result(f"invalid stat definition for '{name}'", success=False)
            else:
                return self.result(f"invalid stat definition for '{name}'", success=False)

        parsed_inv = {}
        for name, spec in (inventory or {}).items():
            name = str(name)
            if isinstance(spec, (int, float)):
                parsed_inv[name] = {"qty": int(spec), "icon": ""}
            elif isinstance(spec, dict):
                try:
                    qty = int(spec.get("qty", 1))
                except (TypeError, ValueError):
                    return self.result(f"invalid quantity for '{name}'", success=False)
                entry = {"qty": qty, "icon": str(spec.get("icon", ""))}
                if spec.get("desc"):
                    entry["desc"] = str(spec.get("desc"))
                parsed_inv[name] = entry
            else:
                return self.result(f"invalid item definition for '{name}'", success=False)

        parsed_quests = {}
        for name, spec in (quests or {}).items():
            name = str(name)
            if isinstance(spec, str):
                spec = {"desc": spec}
            elif isinstance(spec, (int, float)):
                return self.result(f"invalid quest definition for '{name}' - give a description or {{desc, subgoals?, icon?}}", success=False)
            if not isinstance(spec, dict):
                return self.result(f"invalid quest definition for '{name}'", success=False)
            goals = spec.get("subgoals")
            if goals is None:
                goals = spec.get("stages")
            parsed_quests[name] = {
                "desc": str(spec.get("desc", spec.get("description", ""))),
                "icon": str(spec.get("icon", "")),
                "status": "active",
                "subgoals": [{"text": str(g), "done": False} for g in (goals or [])],
            }

        campaign = {
            "title": str(title),
            "asset_pack": resolved_pack,
            "scene_title": str(scene or "Prologue"),
            "location": str(location or ""),
            "stats": parsed_stats,
            "inventory": parsed_inv,
            "quests": parsed_quests,
            "statuses": {},
            "clock": {"day": max(1, int(start_day or 1)), "hour": int(start_hour or 0) % 24, "minute": 0},
            "auto_minutes": max(0, min(1440, int(turn_minutes or 0))),
            "ambience": "",
            "music": "",
            "weather": "",
            "sky": "",
            "effects": {},
            "banner": str(banner or "")[:4000],
            "palette": self._resolve_palette(palette, resolved_pack),
            "font": self._resolve_font(font, resolved_pack),
            "ended": False,
            "paused": False,
            "ending": None,
            "epitaph": None,
            "last_roll": None,
            "scene_n": 1,
            "status_fx": {},
            "shader_notes": [],
            "sfx_event": None,
            "stinger_event": None,
        }
        env_notes = self._env_apply(campaign, ambience=ambience, music=music,
                                    weather=weather, sky=sky, effects=effects, banner=banner)
        if isinstance(palette, str) and palette.strip() and \
                palette.strip().lower() not in self._palettes_for(resolved_pack):
            env_notes.append("unknown palette '" + palette.strip() + "' - '"
                             + str((campaign["palette"] or {}).get("label", "?"))
                             + "' loaded instead (see the palette list in this campaign's state block)")
        self._save_campaign(chat_id, campaign)
        await self._ui_push(chat_id, True)

        pal = self._palette_view(campaign.get("palette") or {})
        pal_line = ""
        if pal:
            pal_line = (f"\n\nPalette (match these in any banner= HTML): "
                        f"accent {pal.get('accent', '')} / ink {pal.get('ink', '')} / page {pal.get('page', '')}")
        if given_pack and given_pack != resolved_pack:
            if resolved_pack:
                env_notes.append(f"unknown asset pack '{given_pack}' - loaded '{resolved_pack}' instead")
            else:
                env_notes.append(f"unknown asset pack '{given_pack}' - no asset packs are installed, this game runs without loops, music, sound effects, images or stingers")
        note_str = ("\n" + "\n".join(env_notes)) if env_notes else ""
        # the pack's own world sketch (world.txt), handed to the GM right
        # with the start: a vague frame to paint inside, never a script
        world = self._world_desc(resolved_pack)
        world_line = ""
        if world:
            world_line = ("\n\nWorld inspiration: " + world +
                          "\nBe creative and free in your storytelling, use the world inspiration as inspiration, but don't follow it as instructions or a guideline."
                         )
        return self.result(
            f"Campaign '{title}' started.{pal_line}{note_str}\n\n"
            f"Asset pack '{resolved_pack}' loaded.{world_line}\n\nCurrent state:\n{self._state_block(campaign)}{held}",
            success=True,
        )

    @core.module.tool
    async def stat_add(self, stats: dict):
        """Adds new stats to the sidebar (batch).

        Args:
            stats: name -> number, or {value, max?, min?, icon?} (max makes a bar). Example: {"Courage": {"value": 50, "max": 100, "icon": "\U0001f981"}, "Gold": 0}
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)

        added = []
        for name, spec in (stats or {}).items():
            name = str(name)
            if isinstance(spec, (int, float)):
                c["stats"][name] = {"value": int(spec), "min": None, "max": None, "icon": ""}
            elif isinstance(spec, dict):
                try:
                    mx = spec.get("max")
                    mn = spec.get("min", 0 if mx is not None else None)
                    c["stats"][name] = {
                        "value": int(spec.get("value", 0)),
                        "min": int(mn) if mn is not None else None,
                        "max": int(mx) if mx is not None else None,
                        "icon": str(spec.get("icon", "")),
                    }
                except (TypeError, ValueError):
                    return self.result(f"invalid stat definition for '{name}'", success=False)
            else:
                return self.result(f"invalid stat definition for '{name}'", success=False)
            added.append(name)
        self._save_campaign(chat_id, c)
        return self.result(f"added stats: {', '.join(added)}{held}", success=True)

    @core.module.tool
    async def stat_remove(self, names: list):
        """Removes stats from the campaign sidebar.

        Args:
            names: List of stat names to remove
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)

        removed = []
        for name in (names or []):
            if name in c["stats"]:
                del c["stats"][str(name)]
                removed.append(str(name))
        if not removed:
            return self.result("no matching stats found", success=False)
        self._save_campaign(chat_id, c)
        return self.result(f"removed stats: {', '.join(removed)}{held}", success=True)

    @core.module.tool
    async def inventory_add(self, items: dict):
        """Adds items to the inventory (batch) - the fallback for off-prose setup; to hand items out inside a passage, write the inline {{item|Name +N}} macro instead. Existing items gain quantity.

        Args:
            items: name -> quantity, or {qty?, icon?, desc?}. Example: {"Torch": {"qty": 2, "icon": "\U0001f525", "desc": "Smells like adventure"}, "Gold coin": 10}
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)

        done = []
        for name, spec in (items or {}).items():
            name = str(name)
            if isinstance(spec, (int, float)):
                qty, icon = int(spec), ""
            elif isinstance(spec, dict):
                try:
                    qty = int(spec.get("qty", 1))
                except (TypeError, ValueError):
                    return self.result(f"invalid quantity for '{name}'", success=False)
                icon = str(spec.get("icon", ""))
            else:
                return self.result(f"invalid item definition for '{name}'", success=False)
            entry = c["inventory"].setdefault(name, {"qty": 0, "icon": ""})
            entry["qty"] += qty
            if icon:
                entry["icon"] = icon
            if isinstance(spec, dict) and spec.get("desc"):
                entry["desc"] = str(spec.get("desc"))
            done.append(f"{name} x{entry['qty']}")
        self._sfx_event(c, "pickup")
        self._save_campaign(chat_id, c)
        return self.result(f"inventory updated: {', '.join(done)}{held}", success=True)

    @core.module.tool
    async def roll_dice(self, rolls: list, reason: str):
        """Rolls real dice (shown to the player). Never invent results - roll here.

        Args:
            rolls: Dice expressions at once, e.g. ["1d20", "2d6+3", "d100"]
            reason: Short flavor, e.g. "attack the goblin"
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        results = []
        total = 0
        for expr in (rolls or []):
            expr = str(expr).replace(" ", "").lower()
            m = re.fullmatch(r"(\d*)d(\d+)([+-]\d+)?", expr)
            if not m:
                return self.result(f"invalid dice expression '{expr}' (use NdM+K like 2d6+3)", success=False)
            count = int(m.group(1) or 1)
            sides = int(m.group(2))
            mod = int(m.group(3) or 0)
            if not (1 <= count <= 20) or not (2 <= sides <= 1000) or not (-100 <= mod <= 100):
                return self.result(f"out of bounds expression '{expr}' (max 20 dice, 2-1000 sides, +-100 modifier)", success=False)
            dice = [random.randint(1, sides) for _ in range(count)]
            subtotal = sum(dice) + mod
            total += subtotal
            results.append({"expr": expr, "dice": dice, "mod": mod, "total": subtotal})

        c["last_roll"] = {"rolls": results, "total": total, "reason": str(reason)}
        self._save_campaign(chat_id, c)

        lines = []
        for r in results:
            dice_str = " + ".join(str(d) for d in r["dice"])
            mod_str = f" {r['mod']:+d}" if r["mod"] else ""
            lines.append(f"{r['expr']}: [{dice_str}{mod_str}] = {r['total']}")
        # let the dice flourish play out in the player's browser before
        # the result lands - the reveal is the beat this roll was for
        await self._await_beat(chat_id, "dice", 4.5)
        return self.result("\U0001f3b2 " + str(reason) + " \u2014 " + "; ".join(lines) + f" | TOTAL: {total}" + held, success=True)

    @core.module.tool
    async def coinflip(self, reason: str = ""):
        """Flips a coin (spins in front of the player). Binary fate only - never invent the side.

        Args:
            reason: Short flavor, e.g. "who goes first"
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        side = random.choice(("heads", "tails"))
        c["last_roll"] = {"kind": "coin", "side": side, "reason": str(reason)}
        self._sfx_event(c, "coin_flip")
        self._save_campaign(chat_id, c)
        # wait for the coin to finish its spin in the browser
        await self._await_beat(chat_id, "dice", 4.5)
        return self.result("\U0001fa99 " + str(reason or "a coin spins") + f" \u2014 the coin lands: {side.upper()}!" + held, success=True)

    @core.module.tool
    async def set_scene(self, title: str, location: str, ambience: str = "", music: str = "", weather: str = "", sky: str = "", effects: list = None, banner: str = None):
        """Sets the current scene - and restages the ENTIRE environment in the same call, so every scene transition automatically shifts ambience, music, sky, weather, overlays and banner together. Pass the args that fit the new scene; omit an arg to keep it exactly as it plays now; "off" clears it. Unknown loops/tracks/skies/weathers/overlays are skipped with a note instead of failing the call. Mid-passage music shifts stay inline instead ({{music|track}}); a lone overlay change mid-passage goes to the screen_effect tool.

        Args:
            title: Short scene name, e.g. "The Drowned Chapel"
            location: Where the scene takes place, e.g. "Catacombs under the city"
            ambience: Ambient bed from "Ambience loops available" - comma-separated to LAYER loops, each optionally with a volume percentage: "rain:70, summer-night:40"; "off" for silence; omit to keep whatever plays
            music: Soundtrack from "Music tracks available", crossfaded in seamlessly; "off" fades the music out; omit to keep
            weather: Foreground weather (motes riding over the sky) from your campaign's weather inventory (its pack over the default base; also fades in its audible bed); "off" clears; omit to keep
            sky: Sky backdrop (the layer everything else rides over) from your campaign's sky inventory (its pack over the default base; also fades in its sky_<name> audible bed); "off" clears; omit to keep
            effects: Held overlays for the new scene, e.g. ["fog", "dark"] - REPLACES the live set; ["off"] clears all; omit to keep. Any mood of the campaign's overlay inventory (its set over the default base); one-shot pulses belong in prose, fired as their inline {{name}} macros
            banner: Banner under the header (raw HTML, palette-styled, max 2 lines); "off" clears; omit to keep
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        # the environment must rewind with the scene, so record the world as
        # it plays NOW (dedup: no-op when an earlier call already snapshotted
        # this turn)
        self._snapshot(chat_id)
        # the environment moves WITH the scene: one call restages everything
        notes = self._env_apply(c, ambience=ambience, music=music,
                                weather=weather, sky=sky, effects=effects, banner=banner)

        c["scene_title"] = str(title)
        # arriving SOMEWHERE ELSE earns its own stamp - compare the
        # location BEFORE overwriting, so a scene retitled in place (or
        # re-staged with the same address) stays silent
        new_loc = str(location)
        if new_loc and new_loc != str(c.get("location") or ""):
            self._sfx_event(c, "scene_change")
        c["location"] = new_loc
        # bump the counter the frontend watches: a new number fires the
        # scene title card, even when title+location repeat a former scene
        c["scene_n"] = int(c.get("scene_n") or 0) + 1
        self._save_campaign(chat_id, c)
        # let the chapter's title card play out inside the chat window
        # before the story continues past it
        await self._await_beat(chat_id, "scene", 5.0)
        note_str = ("\n" + "\n".join(notes)) if notes else ""
        return self.result(f"scene set: {title} ({location}){note_str}{held}", success=True)

    @core.module.tool
    async def end_game(self, ending: str, epitaph: str):
        """Ends the campaign. Write one final closing passage after calling this - the interface shows a game-over banner automatically, so do not offer choices after it.

        Args:
            ending: Short ending type/name, e.g. "Glorious Victory" or "A Grim End"
            epitaph: One-sentence summary of how the story ended
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)
        c["ended"] = True
        c["ending"] = str(ending)
        c["epitaph"] = str(epitaph)
        self._save_campaign(chat_id, c)
        # hold the curtain: the death vignette closes in the browser and
        # the result lands as it fades
        await self._await_beat(chat_id, "death", 5.5)
        return self.result(f"game over: {ending} \u2014 {epitaph}{held}", success=True)

    @core.module.tool
    async def get_campaign(self):
        """Returns the current campaign state (scene, stats, inventory), in case you need to check it mid-turn."""
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat", success=False)
        held = await self._await_typing(chat_id)
        return self.result(self._state_block(c) + held, success=True)

    @core.module.tool
    async def advance_time(self, days: int = 0, hours: int = 0, minutes: int = 0):
        """Extra one-off clock jump BEYOND the automatic per-turn tick (set_turn_minutes). Do NOT use it for the passage itself - only for big single beats: days of travel, recuperation, a ritual till dawn.

        Args:
            days: Days to add
            hours: Hours to add
            minutes: Minutes to add
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)

        day_before = int((c.get("clock") or {}).get("day", 1))
        self._advance_clock(c, int(days) * 1440 + int(hours) * 60 + int(minutes))
        crossed_day = int((c.get("clock") or {}).get("day", 1)) > day_before
        self._save_campaign(chat_id, c)
        if crossed_day:
            # the jump rolled the campaign into a new day: wait out the
            # sleep-to-dawn curtain the browser plays for the rollover
            await self._await_beat(chat_id, "sleep", 6.5)
        return self.result(f"clock advanced -> {self._clock_str(c)}{held}", success=True)

    @core.module.tool
    async def set_turn_minutes(self, minutes: int):
        """Sets how many in-game minutes the clock auto-advances EVERY turn, right before you reply - the heartbeat of the world, so you never have to remember the clock again. Match it to pacing: 10-20 for conversation scenes, 60-240 while travelling or in the thick of action, 0 to freeze the clock and do it all by hand with advance_time.

        Args:
            minutes: Minutes per turn (0-1440). Applies from the NEXT message; the tick already spent for this one stands.
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)
        held = await self._await_typing(chat_id)
        try:
            m = max(0, min(1440, int(minutes)))
        except (TypeError, ValueError):
            return self.result("minutes must be a whole number between 0 and 1440", success=False)
        c["auto_minutes"] = m
        self._save_campaign(chat_id, c)
        return self.result((f"clock now ticks {m} min per turn" if m else "clock frozen - advance_time is your only clock again") + held, success=True)

    @core.module.tool
    async def quest_add(self, name: str, description: str, subgoals: list = None, icon: str = ""):
        """Adds a quest to the sidebar log. Sub-goals are unordered beats that make the quest up - close them in any order with subgoal_done, and the quest itself completes when the last one closes.

        Args:
            name: Quest name
            description: One-sentence goal
            subgoals: Optional beats, e.g. ["Learn of it", "Find the thief", "Return the bell"] - any order, the quest clears when all are done
            icon: Single emoji
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)

        goals = [{"text": str(g), "done": False} for g in (subgoals or [])]
        c["quests"][str(name)] = {
            "desc": str(description),
            "icon": str(icon),
            "status": "active",
            "subgoals": goals,
        }
        self._save_campaign(chat_id, c)
        return self.result(f"quest added: {name}" + (f" ({len(goals)} sub-goals)" if goals else "") + held, success=True)

    def _check_subgoal(self, q, goal_text):
        """Marks one sub-goal of an active quest done - forgiving matching:
        exact text first, then a distinctive fragment, case-insensitive.
        When the LAST open goal closes, the quest itself completes. Returns
        (ok, message, quest_just_completed)."""
        goals = q.get("subgoals") or []
        if not goals:
            return False, "this quest has no sub-goals - add some with the {{subgoal|Quest :: text}} macro first", False
        needle = str(goal_text).strip().lower()
        if not needle:
            return False, "name the sub-goal to complete", False
        match = None
        for g in goals:
            if str(g.get("text", "")).strip().lower() == needle:
                match = g
                break
        if match is None:
            for g in goals:
                if needle in str(g.get("text", "")).lower():
                    match = g
                    break
        if match is None:
            open_goals = ", ".join(str(g.get("text")) for g in goals if not g.get("done"))
            return False, f"no sub-goal matching '{goal_text}' - open: {open_goals or '(none)'}", False
        if match.get("done"):
            return True, f"sub-goal already done: {match.get('text')}", False
        match["done"] = True
        if all(g.get("done") for g in goals):
            q["status"] = "done"
            return True, f"last sub-goal done - quest complete: {match.get('text')}", True
        done_n = sum(1 for g in goals if g.get("done"))
        return True, f"sub-goal done ({done_n}/{len(goals)}): {match.get('text')}", False

    @core.module.tool
    async def subgoal_done(self, name: str, subgoal: str):
        """Marks one sub-goal of a quest as completed. Sub-goals close in ANY order; when the last open one closes, the quest itself completes automatically (chime and all).

        Args:
            name: Exact quest name
            subgoal: The sub-goal's text (or a distinctive piece of it)
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)
        q = c["quests"].get(str(name))
        if not q or q.get("status") != "active":
            return self.result(f"no active quest named '{name}' - quests: {', '.join(c['quests']) or '(none)'}", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)
        ok, msg, completed = self._check_subgoal(q, subgoal)
        if ok:
            self._sfx_event(c, "quest" if completed else "stage")
            self._save_campaign(chat_id, c)
        return self.result(msg + held, success=ok)

    @core.module.tool
    async def quest_done(self, name: str):
        """Marks a quest as completed.

        Args:
            name: Exact quest name
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)
        q = c["quests"].get(str(name))
        if not q:
            return self.result(f"no quest named '{name}' - quests: {', '.join(c['quests']) or '(none)'}", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)
        q["status"] = "done"
        for g in q.get("subgoals") or []:
            g["done"] = True
        self._sfx_event(c, "quest")
        self._save_campaign(chat_id, c)
        return self.result(f"quest complete: {name}{held}", success=True)

    @core.module.tool
    async def quest_fail(self, name: str, reason: str = ""):
        """Marks a quest as failed.

        Args:
            name: Exact quest name
            reason: Short reason it failed
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)
        q = c["quests"].get(str(name))
        if not q:
            return self.result(f"no quest named '{name}' - quests: {', '.join(c['quests']) or '(none)'}", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)
        q["status"] = "failed"
        if reason:
            q["fail_reason"] = str(reason)
        self._sfx_event(c, "fumble")
        self._save_campaign(chat_id, c)
        return self.result(f"quest failed: {name}" + (f" ({reason})" if reason else "") + held, success=True)

    @core.module.tool
    async def quest_remove(self, names: list):
        """Removes quests entirely from the log.

        Args:
            names: List of quest names to remove
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)
        removed = []
        for name in (names or []):
            if str(name) in c["quests"]:
                del c["quests"][str(name)]
                removed.append(str(name))
        if not removed:
            return self.result("no matching quests found", success=False)
        self._save_campaign(chat_id, c)
        return self.result(f"quests removed: {', '.join(removed)}{held}", success=True)

    @core.module.tool
    async def screen_effect(self, effect: str, on: bool = True):
        """Puts one mood overlay on the story window (names and meanings ride with your campaign's "Overlays available" inventory) - or takes it off. The overlay holds until changed; for big beats keep it to 1-2 at once, cleared with effect="off" once past. Complements set_scene's effects=, which replaces the whole set when restaging a scene.

        Args:
            effect: Overlay name from your campaign's "Overlays available" inventory, or "off" to clear every overlay at once
            on: False removes just that one overlay and leaves the others untouched (True - the default - adds it)
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)

        apack = self._pack_of(c)
        # every overlay the campaign's asset pack ships over the default base
        steady = self._overlays_for(apack)
        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)
        fx = dict(c.get("effects") or {})
        name = str(effect or "").strip().lower()
        if not name:
            return self.result("give an overlay name (or \"off\" to clear them all)", success=False)
        if name == "off":
            fx = {}
        elif name in self._pulses_for(apack):
            return self.result(f"'{name}' is a one-shot pulse - fire it inline in prose as {{{{{name}}}}}", success=False)
        elif name not in steady:
            return self.result(f"unknown overlay '{name}' - options: {', '.join(steady)}, off", success=False)
        elif on:
            fx[name] = 0
        else:
            fx.pop(name, None)

        c["effects"] = fx
        self._save_campaign(chat_id, c)
        return self.result(f"overlays now: {', '.join(sorted(fx)) or 'none'}{held}", success=True)

    @core.module.tool
    async def status_visual(self, status: str, effect: str):
        """Links a status condition to a story-window overlay - YOU decide which mood belongs to which condition (Cursed -> static, Love-sick -> bloom, Poisoned -> venom...). The overlay follows the status by itself: it fades in while the condition holds and out when it is cured or ticks out. Re-linking replaces the old effect; the link waits patiently for a status that is not applied yet.

        Args:
            status: Exact status name
            effect: Overlay name from the screen overlays list, or "" to remove the link
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)
        apack = self._pack_of(c)
        effect = str(effect).strip().lower()
        if effect in self._pulses_for(apack):
            return self.result(f"'{effect}' is a one-shot pulse and cannot be held by a status - link a steady mood instead", success=False)
        if effect and effect not in self._overlays_for(apack):
            return self.result(f"unknown effect '{effect}' - options: {', '.join(self._overlays_for(apack))}, or '' to clear", success=False)
        held = await self._await_typing(chat_id)
        self._snapshot(chat_id)
        links = dict(c.get("status_fx") or {})
        if effect:
            links[str(status)] = effect
        else:
            links.pop(str(status), None)
        c["status_fx"] = links
        self._save_campaign(chat_id, c)
        if effect:
            return self.result(f"status link: {status} now drags the {effect} overlay along{held}", success=True)
        return self.result(f"status link for '{status}' cleared{held}", success=True)

    @core.module.tool
    async def play_stinger(self, name: str, description: str = ""):
        """Fires a stinger: a longer, MUSICAL one-shot that depicts a cue moment in the story - a revelation, a level-up, a quest's bitter end, a time-skip. While one plays, the soundtrack smoothly fades out and pauses, then resumes right where it left off and fades back in when the stinger finishes. Stingers are TOOL-ONLY - there is no {{stinger}} macro and the {{sfx}} macro does not reach them; they are the instrument of the story's cue moments. Pick from the stinger list the game_start result returned for your campaign's asset pack; like every sound, the moment it scores must be narrated. This call HOLDS until the stinger has fully played out in the player's browser (the same pacing handshake as the dice flourish), so whatever you write next lands after the music.

        Args:
            name: A stinger from your campaign's asset pack (any music file dropped in the module's webui/assets/asset_packs/<asset pack>/stingers/ folder)
            description: One short line saying what this sound is scoring ("the seal breaks - the true moon rises"). It shows on screen, centered over the story, for exactly as long as the stinger plays
        """
        chat_id = self._chat_id()
        c = self._get_campaign(chat_id)
        if not c:
            return self.result("no active campaign in this chat - call game_start first", success=False)
        name = str(name).strip().lower()
        apack = self._pack_of(c)
        stingers = self._stinger_names(apack)
        if not stingers:
            return self.result(f"no stingers are installed (neither the campaign's asset pack '{apack}' nor the default base has a stingers/ file)", success=False)
        if name not in stingers:
            return self.result(f"unknown stinger '{name}' - options: {', '.join(stingers)}", success=False)
        held = await self._await_typing(chat_id)
        self._stinger_event(c, name, str(description or ""))
        self._save_campaign(chat_id, c)
        # the show: hold the call until the browser reports the stinger
        # done playing (or the cap frees it - no browser, animations off,
        # or a stinger longer than the cap)
        await self._await_beat(chat_id, "stinger", 90)
        return self.result(f"stinger: {name}{held}", success=True)

    # -------------------------
    #   WEBUI ROUTES
    # -------------------------

    def _campaign_view(self, c):
        # what the frontend sees: the stored campaign plus three derived
        # extras - overlays linked to CURRENTLY ACTIVE statuses (the
        # status_visual tool decides which mood belongs to which
        # condition), the torch-logic light level (0-100 darkness), and
        # the pack key normalized to "asset_pack" even for campaigns
        # saved back when it was still called asset_set
        if not c:
            return None
        view = dict(c)
        view["asset_pack"] = self._pack_of(c)
        links = c.get("status_fx") or {}
        active = c.get("statuses") or {}
        if links and active:
            merged = dict(c.get("effects") or {})
            for status, fx_name in links.items():
                if status in active:
                    merged.setdefault(fx_name, 0)
            view["effects"] = merged
        view["light"] = self._light_level(c)
        return view

    def _request_pack(self, query=None, body=None):
        # which asset pack a frontend asset-map request belongs to: the
        # campaign's own pack when the request carries that chat (every
        # asset fetch in the JS appends ?chat=<id>), else the default
        # folder. This is what locks {{sfx}} / {{img}} / the weather bed
        # to the assets game_start chose for the campaign.
        src = dict(query or {})
        src.update(body or {})
        c = self._get_campaign(self._chat_id(src.get("chat")))
        return self._pack_of(c) if c else self._default_pack()

    def _merged_urls(self, asset_pack, kind, exts):
        # stem -> public URL for one kind, served the way every kind works
        # now: the default pack is the global base, the campaign's own pack
        # is scanned over it and wins stem by stem (first file of a stem
        # wins WITHIN a folder, the campaign pack wins ACROSS folders).
        # Rescanned per call, so new drops work live without a restart.
        urls = {}
        for folder_pack in (self._default_pack(), asset_pack):
            folder = {}
            try:
                for fname in sorted(os.listdir(self._kind_dir(folder_pack, kind))):
                    stem, ext = os.path.splitext(fname)
                    if ext.lower() in exts and stem:
                        folder.setdefault(stem.lower(),
                                          f"/ext-assets/adventure_games/"
                                          f"asset_packs/{folder_pack}/{kind}/" + fname)
            except OSError:
                pass
            urls.update(folder)
        return urls

    @webui.route("state")
    async def _route_state(self, body=None, query=None):
        # a state poll means a browser is watching this campaign's beats -
        # _await_beat only holds tool calls while that stays recent
        self._ui_seen = time.time()
        query = query or {}
        chat_id = self._chat_id(query.get("chat"))
        if chat_id:
            # the typewriter's "still revealing prose" flag rides every
            # heartbeat poll: _await_typing holds tool calls while it stays
            # fresh and 1, and runs them the moment the reveal catches up
            self._typing[str(chat_id)] = (str(query.get("typing") or "0") == "1",
                                          time.time())
        return {"campaign": self._campaign_view(self._get_campaign(chat_id))}

    @webui.route("anim_done", method="POST")
    async def _route_anim_done(self, body=None, query=None):
        # the browser reports a story beat has fully played out
        # (kind: dice, scene, sleep, death or stinger), releasing the tool
        # call paused on it. Kind must match - a sleep curtain finishing must
        # not free a wait set for the dice flourish.
        chat_id = self._chat_id((body or {}).get("chat"))
        kind = str((body or {}).get("kind") or "")
        if chat_id:
            pending = self._beat_events.get(str(chat_id))
            if pending and (not kind or kind == pending[0]):
                pending[1].set()
        return {"ok": True}

    @webui.route("loops")
    async def _route_loops(self, body=None, query=None):
        # stem -> public URL for every ambient loop of the chat campaign's
        # asset pack, so the frontend can play a track without knowing its
        # file extension. Rescanned per call: new drops work immediately.
        apack = self._request_pack(query, body)
        # the webui dispatcher wraps this as {success, data} for
        # simpleApiFetch - return the payload plainly, like /state does
        return {"loops": self._merged_urls(apack, "ambience", self.AUDIO_EXTS)}

    @webui.route("sfx")
    async def _route_sfx(self, body=None, query=None):
        # stem -> public URL for every one-shot in the chat campaign's
        # asset pack: the dynamic sound library. Files dropped in there
        # override the frontend's built-in synthesized sound of the same
        # name. Rescanned per call, so new drops work immediately.
        apack = self._request_pack(query, body)
        return {"sfx": self._merged_urls(apack, "sfx", self.AUDIO_EXTS)}

    @webui.route("sfx_builtin")
    async def _route_sfx_builtin(self, body=None, query=None):
        # stem -> public URL for the built-in stamp sounds. The default
        # pack's sfx_builtin/ folder is the global base; the chat
        # campaign's own pack is scanned over it, so a pack overrides stamps
        # file-by-file and whatever it lacks keeps the default files. The
        # frontend merges this map into its cue lookup so event stamps
        # (quest chimes, coin pings...) play the same files the synth set
        # merely imitates; names with no file anywhere fall back to the
        # frontend synths. These names are blocked from {{sfx}}.
        apack = self._request_pack(query, body)
        return {"sfx": self._merged_urls(apack, "sfx_builtin", self.AUDIO_EXTS)}

    @webui.route("fx")
    async def _route_fx(self, body=None, query=None):
        # the chat campaign's VISUAL pack: per overlay/pulse name a
        # {css, shader} URL pair (empty string = absent), for the two
        # LAYERED kinds (weather, skies) every name also carries the
        # inlined particle spec, and per text_decoration name its css sheet
        # plus json spec (render mode), so the frontend needs exactly one fetch.
        # Like sfx_builtin the default pack is the global base - its
        # folders ARE the base vocabulary - and the campaign's own pack
        # overrides it file-by-file, FIELD by FIELD: shipping only
        # <name>.glsl keeps the base css sheet (shader over base look),
        # shipping <name>.css replaces the base look whole. Spec jsons
        # merge field by field too, so a pack can reshape a single field of
        # a built-in kind. Rescanned per call.
        apack = self._request_pack(query, body)

        def scan(folder_pack, kind):
            found = {}
            try:
                for fname in sorted(os.listdir(self._kind_dir(folder_pack, kind))):
                    stem, ext = os.path.splitext(fname)
                    name = stem.lower()
                    if not self.FX_NAME_RE.match(name):
                        continue
                    field = {".css": "css", ".glsl": "shader"}.get(ext.lower())
                    if not field:
                        continue
                    entry = found.setdefault(name, {"css": "", "shader": ""})
                    if not entry[field]:
                        entry[field] = (f"/ext-assets/adventure_games/asset_packs/"
                                        f"{folder_pack}/{kind}/" + fname)
            except OSError:
                pass
            return found

        def merge_entries(into, fresh):
            for name, entry in fresh.items():
                if name not in into:
                    into[name] = dict(entry)
                    continue
                for field, url in entry.items():
                    if url:
                        into[name][field] = url

        def scan_specs(folder_pack, kind):
            specs = {}
            try:
                for fname in sorted(os.listdir(self._kind_dir(folder_pack, kind))):
                    stem, ext = os.path.splitext(fname)
                    name = stem.lower()
                    if ext.lower() != ".json" or not self.FX_NAME_RE.match(name):
                        continue
                    try:
                        with open(os.path.join(self._kind_dir(folder_pack, kind), fname), "r", encoding="utf-8") as fh:
                            spec = json.load(fh)
                        if isinstance(spec, dict):
                            specs[name] = spec
                    except (OSError, ValueError):
                        pass  # a broken spec is simply absent
            except OSError:
                pass
            return specs

        def layered(kind):
            # one of the two layered visual kinds (weather, skies):
            # {css, shader} urls over the field-merged json spec
            files, specs = {}, {}
            for folder_pack in (self._default_pack(), apack):
                # the campaign pack's files win ACROSS folders, one field at a time
                merge_entries(files, scan(folder_pack, kind))
                for name, spec in scan_specs(folder_pack, kind).items():
                    merged = dict(specs.get(name, {}))
                    merged.update(spec)
                    specs[name] = merged
            out = {}
            for name in set(files) | set(specs):
                entry = files.get(name, {"css": "", "shader": ""})
                out[name] = {"css": entry.get("css", ""),
                             "shader": entry.get("shader", ""),
                             "spec": specs.get(name)}
            return out

        overlays, pulses = {}, {}
        for folder_pack in (self._default_pack(), apack):
            merge_entries(overlays, scan(folder_pack, "overlays"))
            merge_entries(pulses, scan(folder_pack, "pulses"))
        # the inline kind: name -> {css, spec}. css-only by contract (an
        # inline span has no canvas to paint a shader on), and a name needs
        # its sheet - a lone json is a sidecar, not a macro. Reserved
        # pipe-macro names never join the vocabulary.
        decos, deco_specs = {}, {}
        for folder_pack in (self._default_pack(), apack):
            merge_entries(decos, scan(folder_pack, "text_decoration"))
            for name, spec in scan_specs(folder_pack, "text_decoration").items():
                merged = dict(deco_specs.get(name, {}))
                merged.update(spec)
                deco_specs[name] = merged
        decorations = {}
        for name, entry in decos.items():
            if name in self.TD_RESERVED or not entry.get("css"):
                continue
            decorations[name] = {"css": entry["css"], "spec": deco_specs.get(name)}
        # the chrome slots: single files in a pack's root, the campaign's
        # own replacing the default base's file for file. svg = the
        # thinking sigil's markup (plus.js fetches and injects the text),
        # css = its skin; text = the words under the sigil (merged json of
        # thinking/prompt/tool wording - each a single string or a rotating
        # 2-5 s list - plus its skin sheet; the prompt phase also gets the
        # --adv-think-charge css var (0..1, real eval progress) written on
        # the line by plus.js); dice = the roll overlay's sheet + its merged
        # glyph spec; caret = the typewriter cursor sprite's look;
        # typing.loop = the optional typing bed (typing_loop.<audio>).
        return {"overlays": overlays, "pulses": pulses,
                "weather": layered("weather"), "skies": layered("skies"),
                "text_decoration": decorations,
                "thinking": {"svg": self._chrome_pick(apack, "thinking.svg"),
                             "css": self._chrome_pick(apack, "thinking.css"),
                             "loop": self._bed_url(apack, "thinking_loop"),
                             "text": {"css": self._chrome_pick(apack, "thinking_text.css"),
                                      "spec": self._chrome_json(apack, "thinking_text.json") or None}},
                "dice": {"css": self._chrome_pick(apack, "dice.css"),
                         "spec": self._chrome_json(apack, "dice.json") or None},
                "caret": {"css": self._chrome_pick(apack, "caret.css")},
                "typing": {"loop": self._bed_url(apack, "typing_loop")}}

    @webui.route("shader_error", method="POST")
    async def _route_shader_error(self, body=None, query=None):
        # the frontend reports a GLSL asset that failed to compile/link:
        # the note lands on the campaign so the GM hears about it through
        # get_campaign / the game_start state block (the asset itself
        # already degraded to its css look in the browser). deduped per
        # message, capped to the last five notes.
        body = body or {}
        chat_id = self._chat_id(body.get("chat"))
        c = self._get_campaign(chat_id)
        if not c:
            return {"success": False, "data": "no campaign in this chat"}
        name = str(body.get("name") or "?")
        kind = str(body.get("kind") or "shader")
        msg = str(body.get("msg") or "")[:300]
        line = kind + " shader '" + name + "': " + msg
        notes = c.get("shader_notes") or []
        if line not in notes:
            notes.append(line)
            c["shader_notes"] = notes[-5:]
            self._save_campaign(chat_id, c)
        return {"success": True, "data": True}

    @webui.route("music")
    async def _route_music(self, body=None, query=None):
        # stem -> public URL for every soundtrack of the chat campaign's
        # asset pack. The frontend loops them seamlessly and crossfades
        # between them on {{music}} / game_start. Rescanned per call.
        apack = self._request_pack(query, body)
        return {"music": self._merged_urls(apack, "music", self.AUDIO_EXTS)}

    @webui.route("images")
    async def _route_images(self, body=None, query=None):
        # stem -> public URL for every picture of the chat campaign's asset
        # pack: the {{img|stem}} macro looks its file up here, so any
        # supported format works without the AI (or the macro) knowing the
        # extension. Rescanned per call, so new drops work immediately.
        apack = self._request_pack(query, body)
        return {"images": self._merged_urls(apack, "img", self.IMG_EXTS)}

    @webui.route("stingers")
    async def _route_stingers(self, body=None, query=None):
        # stem -> public URL for every stinger of the chat campaign's asset
        # pack: the tool-only musical cue-moment library. Rescanned per
        # call, so new drops work immediately.
        apack = self._request_pack(query, body)
        return {"stingers": self._merged_urls(apack, "stingers", self.AUDIO_EXTS)}

    @webui.route("fonts")
    async def _route_fonts(self, body=None, query=None):
        # the chat campaign's REAL font files (default base under its pack):
        # name -> {family, urls} where family is what game_start baked into
        # the campaign's font stack ("adv-<name>") and urls carry each
        # format's name for the @font-face src. Text stacks (<name>.txt)
        # resolved server-side already and need no registration.
        # Rescanned per call, so new drops work immediately.
        apack = self._request_pack(query, body)
        out = {}
        for name, urls in self._font_faces(apack).items():
            out[name] = {"family": "adv-" + name,
                         "urls": [{"url": u,
                                   "format": self.FONT_FILE_FMT.get(os.path.splitext(u)[1].lower(), "")}
                                  for u in urls]}
        return {"fonts": out}

    @webui.route("campaigns")
    async def _route_campaigns(self, body=None, query=None):
        out = []
        for chat_id, c in self._campaigns().items():
            out.append({
                "chat": chat_id,
                "title": c.get("title", "Untitled"),
                "scene": c.get("scene_title", ""),
                "clock": self._clock_str(c),
                "ended": bool(c.get("ended")),
                "accent": self._palette_view(c.get("palette") or {}).get("accent", ""),
            })
        return {"campaigns": out}

    @webui.route("chat_cleared", method="POST")
    async def _route_chat_cleared(self, body=None, query=None):
        # the frontend notices that this chat's history was wiped (the core
        # /clear command leaves an empty passage page) and reports it here:
        # a cleared chat means a cleared campaign. idempotent by design -
        # if there is no campaign, there is nothing to do.
        chat_id = self._chat_id((body or {}).get("chat"))
        if not chat_id:
            return {"success": False, "data": "no chat id"}
        campaigns = self._campaigns()
        had = chat_id in campaigns
        if had:
            del campaigns[chat_id]
            self.data["campaigns"] = campaigns
        # wipe the chat's undo stack with it: a cleared chat restarts its
        # message indices at 0, so stale snapshots of the dead campaign
        # would match every future turn's rewind count and could resurrect
        # it - a snapshot taken here would only add one more stale entry
        undo = self.data.get("undo", {})
        stale = undo.get(str(chat_id))
        if stale:
            undo[str(chat_id)] = []
            self.data["undo"] = undo
        if had or stale:
            self.data.save()
        if had:
            await self._ui_push(chat_id, False)
        return {"success": True, "data": True}

    @webui.route("set_paused", method="POST")
    async def _route_set_paused(self, body=None, query=None):
        # stepping out of the immersive view is a frontend override, but the
        # world behind it (the clock tick, the [world:] tag, the choice-link
        # footer) is backend-driven. this keeps the two in sync: exiting
        # freezes the campaign, re-entering resumes it.
        chat_id = self._chat_id((body or {}).get("chat"))
        c = self._get_campaign(chat_id)
        if not c:
            return {"success": False, "data": "no campaign in this chat"}
        c["paused"] = bool((body or {}).get("paused"))
        self._save_campaign(chat_id, c)
        # sync other tabs watching this chat (the initiating tab already
        # knows - the refresh it triggers there is a cheap no-op)
        await self._ui_push(chat_id, not c["paused"])
        return {"success": True, "data": c["paused"]}

    @webui.route("consume_roll", method="POST")
    async def _route_consume_roll(self, body=None, query=None):
        # hands the last dice roll to the frontend once, then clears it
        chat_id = self._chat_id((body or {}).get("chat"))
        c = self._get_campaign(chat_id)
        if not c or not c.get("last_roll"):
            return None  # plain payload - the dispatcher adds the envelope
        roll = c["last_roll"]
        c["last_roll"] = None
        self._save_campaign(chat_id, c)
        # plain payload - the dispatcher adds the success envelope
        return roll

    # -------------------------
    #   INLINE STATE MACROS
    # -------------------------
    # {{stat|Gold -15}}, {{item|Torch +1}}, {{status|Poisoned 3t}},
    # {{statusoff|Poisoned}}, {{music|tavern_1}}: the webui's marked
    # extension POSTs each macro the instant it parses one mid-stream, so
    # the world moves INSIDE the
    # passage instead of waiting on tool calls. Every branch mirrors its
    # tool's rules exactly (clamping, validation, undo snapshots, sfx
    # events); the turn-scoped key is remembered, so re-parses, resends or
    # retried POSTs never apply the same macro twice.

    @staticmethod
    def _macro_deltas(text):
        # "Name +N, Other -M" -> [(name, n)]; None on a malformed segment.
        # A bare number counts as positive.
        parsed = []
        for seg in text.split(","):
            seg = seg.strip()
            if not seg:
                continue
            m = re.match(r"^(.+?)\s*([+-]?\d+)$", seg)
            if not m:
                return None
            parsed.append((m.group(1).strip(), int(m.group(2))))
        return parsed or None

    @staticmethod
    def _macro_resolve(name, mapping):
        # exact name, else case-insensitive; None when absent
        if name in mapping:
            return name
        for key in mapping:
            if key.lower() == name.lower():
                return key
        return None

    def _macro_stat(self, chat_id, c, text):
        parsed = self._macro_deltas(text)
        if parsed is None:
            return {"success": False, "data": "cannot parse - use 'Name +N' or 'Name -N'"}
        targets = []
        for name, delta in parsed:
            target = self._macro_resolve(name, c["stats"])
            if target is None:
                return {"success": False, "data": f"unknown stat '{name}' - existing: {', '.join(c['stats']) or '(none)'}"}
            targets.append((target, delta))
        self._snapshot(chat_id)
        changes = []
        for target, delta in targets:
            s = c["stats"][target]
            old = s["value"]
            new = old + delta
            if s.get("min") is not None:
                new = max(new, s["min"])
            if s.get("max") is not None:
                new = min(new, s["max"])
            s["value"] = new
            changes.append(f"{target}: {old} -> {new}")
        return {"success": True, "data": "; ".join(changes)}

    def _macro_item(self, chat_id, c, text):
        # ONLY an explicit delta hands an item over: a positive one on an
        # unknown item creates it (a fresh pickup), taking away what the
        # player does not have is an error, and every segment is validated
        # before anything moves. an icon and a "~ ..." description ride
        # with that hand-off: "🗝 Old key +1 ~smells of brine".
        # a BARE name (no number) is a PURE MENTION - the prose touching
        # on a thing without the pack ever changing, held or not: no
        # snapshot, no sfx, nothing to diff. a "~tail" on a mention is
        # stripped for parsing and then dropped (the description belongs
        # to the hand-off that created the item); its icon stays purely
        # visual - the frontend badge shows it, the backend never writes.
        parsed = []
        for seg in text.split(","):
            seg = seg.strip()
            if not seg:
                continue
            desc = ""
            m_desc = re.match(r"^(.*?)\s*~\s*(.+)$", seg)
            if m_desc:
                seg, desc = m_desc.group(1).strip(), m_desc.group(2).strip()
            icon = ""
            m_icon = re.match(r"^([^\w\s]+)\s+(.+)$", seg, re.UNICODE)
            if m_icon:
                icon = m_icon.group(1)
                seg = m_icon.group(2).strip()
            m = re.match(r"^(.+?)\s*([+-]?\d+)$", seg)
            if m and m.group(1).strip():
                parsed.append((m.group(1).strip(), int(m.group(2)), icon, desc))
            else:
                # bare segment: a mention keeps its icon for the badge and
                # loses its description - neither ever reaches the entry
                parsed.append((seg, None, icon, ""))
        if not parsed:
            return {"success": False, "data": "cannot parse - use 'Name +N' or 'Name -N'"}
        targets = []
        mentions = []
        for name, delta, icon, desc in parsed:
            target = self._macro_resolve(name, c["inventory"])
            if delta is None:
                # a mention never moves anything - not even a key lying
                # unheld in a ditch; it keeps its resolved name
                mentions.append(target or name)
                continue
            if target is None and delta <= 0:
                return {"success": False, "data": f"player does not have '{name}' - inventory: {', '.join(c['inventory']) or '(empty)'}"}
            targets.append((name if target is None else target, delta, icon, desc))
        if not any(delta or icon or desc for _, delta, icon, desc in targets):
            # mentions and explicit zeros only: nothing moves - no
            # snapshot, no sfx, nothing to diff.
            return {"success": True, "data": "mentioned: " + ", ".join(mentions or [t for t, _, _, _ in targets])}
        self._snapshot(chat_id)
        done = []
        for target, delta, icon, desc in targets:
            entry = c["inventory"].setdefault(target, {"qty": 0, "icon": "", "desc": ""})
            if icon:
                entry["icon"] = icon
            if desc:
                entry["desc"] = desc
            entry["qty"] = max(0, entry["qty"] + delta)
            if entry["qty"] <= 0:
                del c["inventory"][target]
                done.append(f"{target} (gone)")
            else:
                done.append(f"{target} x{entry['qty']}")
        self._sfx_event(c, "pickup")
        out = "inventory updated: " + ", ".join(done)
        if mentions:
            out += "; mentioned: " + ", ".join(mentions)
        return {"success": True, "data": out}

    def _macro_status(self, chat_id, c, text):
        # "Poisoned 3t, ✨ Blessed" - optional turn count, optional leading
        # icon (any symbol run), bare name = permanent
        self._snapshot(chat_id)
        applied = []
        for seg in text.split(","):
            seg = seg.strip()
            if not seg:
                continue
            # a leading non-word run is the chip icon: "✨ Blessed 5t"
            # gives the chip its sparkle and keeps the name clean
            icon = ""
            m_icon = re.match(r"^([^\w\s]+)\s+(.+)$", seg, re.UNICODE)
            if m_icon:
                icon = m_icon.group(1)
                seg = m_icon.group(2).strip()
            m = re.match(r"^(.+?)\s+(\d+)t$", seg, re.IGNORECASE)
            if m:
                name, turns = m.group(1).strip(), int(m.group(2))
            else:
                name, turns = seg, 0
            if not name:
                return {"success": False, "data": "cannot parse - use 'Name' or 'Name 3t'"}
            existing = self._macro_resolve(name, c["statuses"])
            # re-applying without an icon keeps the old one; an explicit
            # icon wins and updates
            if not icon and existing:
                icon = c["statuses"][existing]["icon"]
            c["statuses"][existing or name] = {"turns": turns, "icon": icon, "note": ""}
            applied.append(existing or name)
        if not applied:
            return {"success": False, "data": "nothing to apply"}
        self._sfx_event(c, "status")
        return {"success": True, "data": "statuses applied: " + ", ".join(applied)}

    def _macro_statusoff(self, chat_id, c, text):
        names = [s.strip() for s in text.split(",") if s.strip()]
        found = [self._macro_resolve(n, c["statuses"]) for n in names]
        found = [f for f in found if f]
        if not found:
            return {"success": False, "data": f"no matching statuses - active: {', '.join(c['statuses']) or '(none)'}"}
        self._snapshot(chat_id)
        for name in found:
            del c["statuses"][name]
        self._sfx_event(c, "cleanse")
        return {"success": True, "data": "statuses removed: " + ", ".join(found)}

    def _macro_music(self, c, text):
        apack = self._pack_of(c)
        tracks = self._music_tracks(apack)
        # tolerate "eyes_of_glory.mp3" style answers: keep the stem. The
        # campaign's pack plus the default base are consulted - a track
        # from another pack does not exist for this game.
        track, ext = os.path.splitext(text.strip().lower())
        if track and track != "off" and track not in tracks:
            if not tracks:
                return {"success": False, "data": "no music is installed (neither the campaign's asset pack nor the default base has a music/ file)"}
            return {"success": False, "data": f"unknown music track '{track}' - options: {', '.join(tracks)}, off"}
        c["music"] = "" if track in ("", "off") else track
        return {"success": True, "data": f"music: {c['music'] or 'off'}"}

    def _macro_quest(self, c, text):
        # {{quest|\U0001f514 Name ~optional description}} - open a quest inline.
        # A leading symbol run is its icon (same trick as items and statuses);
        # sub-goals join afterwards via the {{subgoal|...}} macro.
        seg, desc = text, ""
        m_desc = re.match(r"^(.*?)\s*~\s*(.+)$", seg)
        if m_desc:
            seg, desc = m_desc.group(1).strip(), m_desc.group(2).strip()
        icon = ""
        m_icon = re.match(r"^([^\w\s]+)\s+(.+)$", seg, re.UNICODE)
        if m_icon:
            icon, seg = m_icon.group(1), m_icon.group(2).strip()
        if not seg:
            return {"success": False, "data": "quest macro needs a name: {{quest|Name ~description}}"}
        quests = c.setdefault("quests", {})
        target = self._macro_resolve(seg, quests)
        if target:
            return {"success": False, "data": f"quest '{target}' already exists"}
        quests[seg] = {"desc": desc, "icon": icon, "status": "active", "subgoals": []}
        return {"success": True, "data": f"quest added: {seg}"}

    def _macro_quest_for(self, c, name):
        """Resolve a macro's quest name -> (key, quest) or (None, message)."""
        quests = c.get("quests") or {}
        target = self._macro_resolve(name.strip(), quests)
        if not target:
            return None, None, f"no quest matching '{name.strip()}' - quests: {', '.join(quests) or '(none)'}"
        return target, quests[target], ""

    def _macro_subgoal(self, c, text):
        # {{subgoal|Quest Name :: the new beat}} - add one open sub-goal
        name, sep, goal = text.partition("::")
        if not sep:
            return {"success": False, "data": "use {{subgoal|Quest Name :: sub-goal text}}"}
        target, q, err = self._macro_quest_for(c, name)
        if not q:
            return {"success": False, "data": err}
        if q.get("status") != "active":
            return {"success": False, "data": f"quest '{target}' is {q.get('status')} - no beats to add"}
        if not goal.strip():
            return {"success": False, "data": "the sub-goal text after :: is empty"}
        q.setdefault("subgoals", []).append({"text": goal.strip(), "done": False})
        return {"success": True, "data": f"sub-goal added to '{target}': {goal.strip()}"}

    def _macro_subdone(self, c, text):
        # {{subdone|Quest Name :: sub-goal text}} - close one beat (any
        # order); the quest itself completes when its last beat closes.
        name, sep, goal = text.partition("::")
        if not sep:
            return {"success": False, "data": "use {{subdone|Quest Name :: sub-goal text}}"}
        target, q, err = self._macro_quest_for(c, name)
        if not q:
            return {"success": False, "data": err}
        if q.get("status") != "active":
            return {"success": False, "data": f"quest '{target}' is already {q.get('status')}"}
        ok, msg, completed = self._check_subgoal(q, goal)
        if ok:
            self._sfx_event(c, "quest" if completed else "stage")
        return {"success": ok, "data": msg}

    def _macro_questdone(self, c, text):
        target, q, err = self._macro_quest_for(c, text)
        if not q:
            return {"success": False, "data": err}
        q["status"] = "done"
        for g in q.get("subgoals") or []:
            g["done"] = True
        self._sfx_event(c, "quest")
        return {"success": True, "data": f"quest complete: {target}"}

    def _macro_questfail(self, c, text):
        # {{questfail|Name ~optional reason}}
        name, _, reason = text.partition("~")
        target, q, err = self._macro_quest_for(c, name)
        if not q:
            return {"success": False, "data": err}
        q["status"] = "failed"
        if reason.strip():
            q["fail_reason"] = reason.strip()
        self._sfx_event(c, "fumble")
        return {"success": True, "data": f"quest failed: {target}" + (f" ({reason.strip()})" if reason.strip() else "")}

    def _macro_questoff(self, c, text):
        target, q, err = self._macro_quest_for(c, text)
        if not q:
            return {"success": False, "data": err}
        del c["quests"][target]
        return {"success": True, "data": f"quest removed: {target}"}

    @webui.route("state_macro", method="POST")
    async def _route_state_macro(self, body=None, query=None):
        body = body or {}
        kind = str(body.get("kind", ""))
        text = str(body.get("text", ""))[:400].strip()
        key = str(body.get("key", ""))[:220]
        chat_id = self._chat_id(body.get("chat"))
        c = self._get_campaign(chat_id)
        if not c:
            return {"success": False, "data": "no active campaign in this chat"}
        applied = c.get("macro_keys") or []
        if key and key in applied:
            return {"success": True, "data": "already applied"}
        if not text:
            return {"success": False, "data": "empty macro"}
        if kind == "stat":
            out = self._macro_stat(chat_id, c, text)
        elif kind == "item":
            out = self._macro_item(chat_id, c, text)
        elif kind == "status":
            out = self._macro_status(chat_id, c, text)
        elif kind == "statusoff":
            out = self._macro_statusoff(chat_id, c, text)
        elif kind == "music":
            # a soundtrack swap is a world change like any other: rewindable
            self._snapshot(chat_id)
            out = self._macro_music(c, text)
        elif kind in ("quest", "subgoal", "subdone", "questdone", "questfail", "questoff"):
            # quests move the log like any other world change: rewindable
            self._snapshot(chat_id)
            if kind == "quest":
                out = self._macro_quest(c, text)
            elif kind == "subgoal":
                out = self._macro_subgoal(c, text)
            elif kind == "subdone":
                out = self._macro_subdone(c, text)
            elif kind == "questdone":
                out = self._macro_questdone(c, text)
            elif kind == "questfail":
                out = self._macro_questfail(c, text)
            else:
                out = self._macro_questoff(c, text)
        else:
            out = {"success": False, "data": f"unknown macro kind '{kind}'"}
        if not out.get("success"):
            return out
        if key:
            applied.append(key)
            c["macro_keys"] = applied[-32:]
        self._save_campaign(chat_id, c)
        return out

    @webui.route("rewind", method="POST")
    async def _route_rewind(self, body=None, query=None):
        body = body or {}
        chat_id = self._chat_id(body.get("chat"))
        first_index = body.get("first_index")
        if not chat_id or first_index is None:
            return {"success": False, "data": "need chat and first_index"}
        try:
            first_index = int(first_index)
        except (TypeError, ValueError):
            return {"success": False, "data": "invalid first_index"}

        undo = self.data.get("undo", {})
        stack = undo.get(str(chat_id), [])
        # snapshots taken during the rewound turn have count >= first_index;
        # the earliest of those holds the campaign as it was before the turn.
        candidates = [(i, s) for i, s in enumerate(stack) if s.get("count", 0) >= first_index]
        if not candidates:
            return {"success": True, "data": "no state changes in that turn - nothing to restore"}
        idx, snap = candidates[0]
        campaigns = self._campaigns()
        campaigns[str(chat_id)] = snap["campaign"]
        self.data["campaigns"] = campaigns
        undo[str(chat_id)] = stack[:idx]
        self.data["undo"] = undo
        self.data.save()
        return {"success": True, "data": True}

    # -------------------------
    #   USER COMMANDS
    # -------------------------

    @core.module.command("adventure", help={
        "": "Shows adventure game status and usage",
        "status": "Show the campaign state for this chat",
    })
    async def adventure_command(self, args: list):
        chat_id = self._chat_id()
        if args and args[0] == "status":
            c = self._get_campaign(chat_id)
            if not c:
                return "no campaign in this chat \u2014 ask the AI to start an adventure game!"
            return f"{c.get('title')}\n" + self._state_block(c)
        return (
            "ADVENTURE GAMES \u2014 a Twine-style game engine living in your chats.\n"
            "  just ask the AI: 'start a fantasy adventure' or 'play a sci-fi mystery'\n"
            "  story passages show clickable [[choice links]] and a stats sidebar\n"
            "  /adventure status  - show this chat's campaign\n"
            "  clearing the chat (the trash button or /clear) wipes the campaign with it\n"
        )
