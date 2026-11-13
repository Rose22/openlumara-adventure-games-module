/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-08) harness:openlumara
   adventure_games :: story beats (split module).

   The visuals the interface plays ON ITS OWN from the campaign
   heartbeat - no AI call needed:
   - scene title cards: set_scene starts a chapter, the screen announces
     it in the campaign's own serif, ink bleeding in from a blur
   - the sleep-to-dawn fade when the clock crosses into a new day
   - a closing vignette curtain when the campaign ends
   - torch-logic darkness: night creeps in from the screen edges, held
     back by carried light sources (level 0-100 arrives precomputed as
     campaign.light, derived server-side from clock + inventory)
   - crit & fumble juice: max rolls shimmer gold, min rolls flash red
     and shake the screen, timed to land as the dice total appears

   Talks to the other scripts only through window.AdvBeats;
   styling lives in adventure_beats.css. */
(function () {
    var cfg = window.ADV_CONFIG || {};

    function reduced() {
        return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    /* beat handshake: tool calls that put a beat on screen pause on the
     * backend until the browser says the animation played out (kind:
     * dice, scene, sleep, death) - same shape as the meditation module's
     * countdown report. Fire-and-forget: nobody waits on the report. */
    function ack(kind) {
        try {
            var chat = Alpine.store("chat").selectedChat;
            if (!chat) return;
            var p = simpleApiPost("/api/ext/adventure_games/anim_done",
                { chat: chat, kind: kind });
            if (p && p.catch) p.catch(function () {});
        } catch (e) {}
    }

    // one shared layer for cards and curtains; only one beat
    // plays at a time (they never meaningfully overlap - and if they do,
    // the newest wins, which is always the more important one).
    // adventure_bounds.js keeps the layer pinned to the chat window; the
    // fit calls here just make a freshly created or re-fired layer land
    // on the right rect on its very first frame.
    function pin(el) {
        if (window.AdvBounds) window.AdvBounds.fit(el, window.AdvBounds.box());
    }
    function layer() {
        var el = document.getElementById("adv-beat");
        if (!el) {
            el = document.createElement("div");
            el.id = "adv-beat";
            document.body.appendChild(el);
            pin(el);
        }
        return el;
    }
    // which finished beat releases which backend wait (juice flashes are
    // pure garnish and report nothing)
    var BEAT_ACK = {
        "adv-beat-card": "scene",
        "adv-beat-sleep": "sleep",
        "adv-beat-death": "death"
    };
    function fire(cls, ms, build) {
        var el = layer();
        pin(el);
        if (build) build(el);
        else el.innerHTML = "";
        el.className = cls;
        if (el._t) clearTimeout(el._t);
        el._t = setTimeout(function () {
            el.className = "";
            if (BEAT_ACK[cls]) ack(BEAT_ACK[cls]);
        }, ms);
    }

    /* -------------------------
     * scene title card
     * ------------------------- */
    function showSceneCard(title, location) {
        if (reduced()) { ack("scene"); return; }
        fire("adv-beat-card", 3100, function (el) {
            var card = document.createElement("div");
            card.className = "adv-card";
            var t = document.createElement("div");
            t.className = "adv-card-title";
            t.textContent = title || "";
            card.appendChild(t);
            if (location) {
                var l = document.createElement("div");
                l.className = "adv-card-loc";
                l.textContent = location;
                card.appendChild(l);
            }
            el.appendChild(card);
        });
    }

    /* -------------------------
     * sleep & death curtains
     * ------------------------- */
    function playSleep() {
        // the nightfall stamp rides the curtain - motion setting or not
        if (window.AdvAudio) window.AdvAudio.cue("sleep", false, true);
        if (reduced()) { ack("sleep"); return; }
        fire("adv-beat-sleep", 4700);
    }
    function playDeath() {
        if (reduced()) { ack("death"); return; }
        fire("adv-beat-death", 3900);
    }

    /* -------------------------
     * one-shot pulses: {{flash}} / {{poof}} text macros
     * a fresh throwaway element per firing plays the plus.css one-shot
     * animation once (both end transparent, so it leaves nothing behind).
     * Live passages cue from the typewriter's reveal scan
     * (adventure_type.js) with forced=true - position-based, exactly once
     * per macro occurrence, so a pulse may repeat within a passage. The
     * per-turn guard below stays only as the fallback for non-forced
     * callers, absorbing streaming re-parses.
     * ------------------------- */
    // the pulse vocabulary lives entirely in files: the AdvFX pack lists
    // every name the asset packs ship as pulses/ (the pulse CSS is just
    // the .adv-fx-<name> class the div below already gets - nothing here
    // is name-specific beyond the gate)
    function pulseKnown(name) {
        return !!(window.AdvFX && window.AdvFX.pulseKnown && window.AdvFX.pulseKnown(name));
    }
    var fired = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    function onceThisTurn(key) {
        var t = document.querySelector("#messages .turn:last-child") || document.documentElement;
        if (!fired) return true;
        var set = fired.get(t);
        if (!set) { set = {}; fired.set(t, set); }
        if (set[key]) return false;
        set[key] = 1;
        return true;
    }
    function oneShot(name, forced) {
        name = String(name || "").trim().toLowerCase();
        if (!pulseKnown(name) || reduced()) return;
        // a pulse whose pack is still in flight has neither its
        // stylesheet nor its shape yet - AdvFX replays it the moment the
        // map lands, instead of an invisible flash
        if (window.AdvFX && !window.AdvFX.ready() && window.AdvFX.queuePulse) {
            window.AdvFX.queuePulse(name, forced);
            return;
        }
        // forced = already replay-proof callers (the reveal scan): they
        // bypass the passage guard and may repeat within one passage
        if (!forced && !onceThisTurn("pulse:" + name)) return;
        var holder = document.getElementById("adv-pulses");
        if (!holder) {
            holder = document.createElement("div");
            holder.id = "adv-pulses";
            document.body.appendChild(holder);
            pin(holder);
        }
        // a shipped pulses/<name>.glsl fires as a live shader canvas; the
        // canvas itself plays the shot, so "// duration: N" trims the DOM
        // lifetime to fit (the plain div + css path stays the fallback)
        var el = (window.AdvShaders && window.AdvShaders.shot(name)) || null;
        if (!el) {
            el = document.createElement("div");
            el.className = "adv-fx adv-fx-" + name;
        }
        holder.appendChild(el);
        var life = window.AdvShaders ? AdvShaders.shotMs(name, 2000) : 2000;
        setTimeout(function () { el.remove(); }, life);
    }

    /* -------------------------
     * torch darkness
     * the night itself, not a directed effect: fully independent of the
     * AI's overlays, so a held dark overlay can still stack on top
     * ------------------------- */
    function nightfall(c) {
        var el = document.getElementById("adv-torch");
        if (!el) {
            el = document.createElement("div");
            el.id = "adv-torch";
            el.innerHTML = '<div class="adv-torch-vg"></div>';
            document.body.appendChild(el);
            pin(el);
        }
        // the night is STAY-dark logic: once it is dark it holds, steady,
        // until morning - no breathing, no flicker, no resets. Only a real
        // change in the light level touches the vignette; identical writes
        // on every 450ms heartbeat would leave room for transition hiccups.
        var level = cfg.torch_logic === false ? 0 : Math.max(0, Math.min(100, (c && c.light) || 0));
        if (!c && level === 0 && el._level
            && document.documentElement.classList.contains("adv-on")) {
            return;  // transient campaign gap mid-poll - hold the darkness
        }
        if (el._level === level) return;
        el._level = level;
        el.style.opacity = (level / 100).toFixed(2);
    }

    /* -------------------------
     * crit & fumble juice
     * ------------------------- */
    function judge(roll) {
        var allMax = true, allMin = true, any = false;
        (roll.rolls || []).forEach(function (x) {
            var m = /d(\d+)/.exec(String(x.expr || ""));
            var sides = m ? parseInt(m[1], 10) : 6;
            (x.dice || []).forEach(function (d) {
                any = true;
                if (d < sides) allMax = false;
                if (d > 1) allMin = false;
            });
        });
        if (!any) return "";
        if (allMin) return "fumble";
        return allMax ? "crit" : "";
    }
    var lastJuice = 0;
    function dice(roll) {
        if (!roll || roll.kind === "coin") return;
        var verdict = judge(roll);
        if (!verdict) return;
        // GMs often roll several pools in one burst: the first judgement
        // of the flurry decides the drama, the rest fold into the flourish
        if (Date.now() - lastJuice < 3200) return;
        lastJuice = Date.now();
        // land WITH the total: the dice flourish reveals it at ~2600 ms
        setTimeout(function () {
            fire("adv-beat-" + verdict, verdict === "crit" ? 1500 : 1100);
            // rattling the whole chat window costs a phone the most; the
            // red flash beat still plays, just without the quake
            if (verdict === "fumble" && !reduced() &&
                    (!window.AdvPerf || AdvPerf.shakeAllowed())) {
                document.documentElement.classList.add("adv-jshake");
                setTimeout(function () {
                    document.documentElement.classList.remove("adv-jshake");
                }, 620);
            }
            if (window.AdvAudio) window.AdvAudio.cue(verdict);
        }, 2600);
    }

    /* -------------------------
     * heartbeat watcher
     * state(campaign, fresh) runs on every adv:state refresh. the FIRST
     * sighting of a campaign (page load, chat switch) only arms the
     * comparators - a reload must never replay last night's curtains.
     * ------------------------- */
    var seen = { scene: null, day: null, min: null, ended: null };
    // dawn o'clock: when the clock rolls past this the pack's "morning"
    // stamp rings - the interface's own built-in cue (a set may override
    // it with sfx_builtin/morning.<audio>, else the synth fallback), never
    // an AI macro. Crossings are counted in absolute minutes so a long
    // time jump rings exactly one dawn per sunrise it passes.
    var DAWN_MIN = 7 * 60;
    function dawnCount(t) { return Math.floor((t - DAWN_MIN) / 1440); }
    function clockMin(cl) {
        return cl ? (Math.max(1, cl.day || 1) - 1) * 1440 + (cl.hour || 0) * 60 + (cl.minute || 0) : null;
    }
    function cueDawn() {
        // the chime may ride a curtain-length timeout: a game closed in
        // between must not have its morning ring into a dead screen
        try {
            if (!(Alpine.store("adv") && Alpine.store("adv").active)) return;
        } catch (e) { return; }
        if (window.AdvAudio) window.AdvAudio.cue("morning", false, true);
    }
    function state(c, fresh) {
        if (!c) { seen.scene = seen.day = seen.min = seen.ended = null; return; }
        var t = clockMin(c.clock);
        if (fresh) {
            seen.scene = c.scene_n || 1;
            seen.day = c.clock ? c.clock.day : null;
            seen.min = t;
            seen.ended = !!c.ended;
            return;
        }
        var sn = c.scene_n || 1;
        if (seen.scene !== null && sn !== seen.scene) showSceneCard(c.scene_title, c.location);
        seen.scene = sn;
        var day = c.clock ? c.clock.day : null;
        var slept = false;
        if (seen.day !== null && day !== null && day > seen.day) { playSleep(); slept = true; }
        seen.day = day;
        // morning broke between two heartbeats. when the sleep curtain
        // played on this very beat (a jump that crossed midnight AND 7am
        // together) the chime waits for the curtain to clear: the curtain
        // IS the night passing, dawn rings after it, never on top of it.
        if (seen.min !== null && t !== null && dawnCount(t) > dawnCount(seen.min)) {
            if (slept) setTimeout(cueDawn, 4700);
            else cueDawn();
        }
        seen.min = t;
        var ended = !!c.ended;
        if (seen.ended === false && ended) playDeath();
        seen.ended = ended;
    }

    window.AdvBeats = { state: state, nightfall: nightfall, dice: dice, oneShot: oneShot, ack: ack };
})();
