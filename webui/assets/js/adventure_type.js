/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-08) harness:openlumara
   adventure_games :: typewriter (split module).

   Reveals passages character by character, deliberately lagging behind the
   real token stream:
   - the stream itself is intercepted AFTER advAccumulateFinal has resolved
     the append-only segment list: every content message handed to the core
     carries only the typed prefix, so marked (and with it the wiki-link,
     macro and speaker extensions, the delta anchors and the fade tail)
     always operates on what the player has actually seen, never on the
     raw stream
   - the typing KEEPS RUNNING after generation ends: stream_complete is
     held in a queue until the passage has fully typed out (input stays
     locked, the completion chime and the delta flush arrive with the
     reveal), then the queue drains in order
   - story beats pause the reveal: sound-effect cues and stingers hold it
     until they finish playing, stat/item badge chips hold it from the
     moment their macro is parsed until the popup has bloomed and been
     read (dice and coin flips come from tool calls, outside the
     content stream - they never pause it)
   - markup jumps: state/sfx/pulse macros and bare html tags are never
     typed out - the reveal leaps over them and resumes past their
     closing braces, or waits at the stream edge while a token is still
     arriving. flavor macros ({{whisper|..}} and friends) type normally,
     their words are prose
   - a floating skip button (or Escape) finishes the passage at once and
     releases everything in flight

   Speed, enable, and the pause-on-events behavior are module settings
   (typewriter, typewriter_speed, typewriter_pause) riding in on ADV_CONFIG. */
(function () {
    var cfg = window.ADV_CONFIG || {};

    function enabled() {
        if (cfg.typewriter === false) return false;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
        return true;
    }
    function pauseOn() { return cfg.typewriter_pause !== false; }
    function cps() {
        var v = parseFloat(cfg.typewriter_speed);
        if (!isFinite(v) || v <= 0) v = 150;
        v = Math.max(10, Math.min(5000, v));
        // phones read the same prose at a gentler clip (the reveal keeps
        // running ahead of the stream either way, nobody waits longer)
        if (window.AdvPerf) v = AdvPerf.cpsCap(v);
        return v;
    }
    function currentChat() {
        try { return Alpine.store("chat").selectedChat; } catch (e) { return null; }
    }
    function advActive() {
        try { return !!(Alpine.store("adv") && Alpine.store("adv").active); } catch (e) { return false; }
    }
    function wsUp() {
        try { return !!(window.socket && window.socket.readyState === 1); } catch (e) { return false; }
    }

    /* -------------------------
     * state
     * ------------------------- */
    // segs[i] mirrors final_messages[i]: {full, shown, delivered} for
    // content messages, null for anything else (chain artifacts etc.)
    var segs = [];
    // reveal-scan cursors: per-segment index of the last macro cued,
    // one set per macro family (they interleave in prose, so each scans
    // independently)
    var sfxIdx = [];
    var pulseIdx = [];
    var imgIdx = [];
    var sdIdx = [];
    var skipped = false;     // skip pressed: plain streaming for the rest of the turn
    var accChars = 0;
    var queue = [];          // ws messages parked while the reveal catches up
    var pumping = false;
    var holdStarted = 0;
    var holdChat = null;
    // the watchdog fires on STALL, never on elapsed time: a long passage
    // + badge/sound beats legitimately keeps the reveal running (and the
    // stream parked) well past any fixed budget, and flushing that was
    // the sudden skip-ahead players saw at stream finish. as long as the
    // lag keeps shrinking, the world is healthy and nothing interrupts.
    // only a hold where NOTHING moves for HOLD_CAP_MS is a stuck one.
    var HOLD_CAP_MS = 20000;
    var lastLag = 0;
    var lastLagAt = 0;
    var origRef = null;      // the wrapped (inner) handleWebSocketMessage
    var blockers = {};       // key -> expiry (ms); a live blocker pauses typing
    var rafOn = false;
    var lastT = 0;

    function reset() {
        segs = [];
        sfxIdx = [];
        pulseIdx = [];
        imgIdx = [];
        sdIdx = [];
        skipped = false;
        accChars = 0;
        restUntil = 0;
        queue = [];
        holdStarted = 0;
        holdChat = null;
        blockers = {};
        lastLag = 0;
        lastLagAt = 0;
        lastTypedAt = performance.now();
        retireCaret();
        typingLoopStop(true);
    }

    /* -------------------------
     * the macro reveal-scan
     * {{sfx|name}} and {{flash}}/{{poof}} macros are cued HERE, off the
     * reveal itself - not from the marked renderer. each family keeps one
     * cursor per segment, remembering the closing index of the last macro
     * cued; every scan re-reads the shown prefix and fires each complete
     * macro ending past the cursor. the index is position-stable, so
     * streaming re-parses never double-fire, while a sound (or a pulse)
     * may repeat freely within one passage - the old name-keyed guards
     * swallowed exactly those repeats, which read as a phantom cooldown.
     * Both engines are passed forced: this scan is its own proof of
     * freshness.
     * ------------------------- */
    var SFX_REVEAL_RE = /\{\{sfx\|([^{}]+)\}\}/g;
    // a tolerated |tail ({{poof|with a narration}}) still fires the pulse;
    // the scan just has to recognise the whole token. the pulse names are
    // dynamic: a campaign's asset pack ships pulses/ and the AdvFX pack
    // widens the list (adv:fx rebuilds this regex).
    function advPulseAlt() {
        // no hardcoded fallback: until the AdvFX pack lands there simply
        // are no pulse names - the adv:fx event rebuilds every scanner
        return (window.AdvFX && window.AdvFX.pulseAlt) ? window.AdvFX.pulseAlt() : "";
    }
    var PULSE_REVEAL_RE = new RegExp("\\{\\{(" + advPulseAlt() + ")(?:\\|[^{}]*)?\\}\\}", "g");
    var IMG_REVEAL_RE = /\{\{img\|([^{}]+)\}\}/g;
    // stable_diffusion art ({{sd|token}}) earns the very same arrival
    // ceremony: the token rides to advImgArrive as the stem
    var SD_REVEAL_RE = /\{\{sd\|([a-z0-9]{7})(?:\|[^{}]*)?\}\}/g;
    function scanFamily(re, cursors, i, text, fire) {
        if (!text) return;
        re.lastIndex = 0;
        var m;
        while ((m = re.exec(text))) {
            var end = m.index + m[0].length;
            if (end <= (cursors[i] || 0)) continue;
            cursors[i] = end;
            fire(m[1]);
        }
    }
    function scanSeg(i, text) {
        scanFamily(SFX_REVEAL_RE, sfxIdx, i, text, function (n) {
            // cueUser, not cue: this is the {{sfx}} MACRO path - built-in
            // stamp sounds are off-limits to the AI
            if (window.AdvAudio) window.AdvAudio.cueUser(n);
        });
        scanFamily(PULSE_REVEAL_RE, pulseIdx, i, text, function (n) {
            if (window.AdvBeats) window.AdvBeats.oneShot(n, true);
        });
        scanFamily(IMG_REVEAL_RE, imgIdx, i, text, function (n) {
            // the art arrival event: games.js claims the rendered node in
            // the live turn and runs its unroll ceremony for this stem
            if (window.advImgArrive) window.advImgArrive(n);
        });
        scanFamily(SD_REVEAL_RE, sdIdx, i, text, function (n) {
            // generated art arrives the exact same way - token as stem
            if (window.advImgArrive) window.advImgArrive(n);
        });
    }
    function scanRevealed() {
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            if (s) scanSeg(i, s.full.slice(0, s.shown));
        }
    }

    /* -------------------------
     * pause blockers (sounds, badge popups)
     * ------------------------- */
    function anyBlocker() {
        var now = Date.now();
        var stale = [];
        var live = false;
        for (var k in blockers) {
            if (blockers[k] > now) live = true;
            else stale.push(k);
        }
        stale.forEach(function (k) { delete blockers[k]; });
        return live;
    }
    function paused() { return pauseOn() && anyBlocker(); }

    function lag() {
        var n = 0;
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            if (s && s.shown < s.full.length) n += s.full.length - s.shown;
        }
        return n;
    }
    // does the stream need to wait for us? (skip wins over everything)
    function behind() {
        if (!enabled() || skipped) return false;
        if (lag() > 0) return true;
        return paused();
    }
    /* isBusy(): does the backend still owe the player typing? The state
       heartbeat rides this flag (?typing=1) so AdventureGamesModule
       ._await_typing holds tool calls until the passage has fully landed -
       the world only ever moves after the words that moved it are read.
       A FROZEN reveal is deliberately NOT busy: a stream-edge HOLD waits
       on characters that cannot arrive until the very tool call it would
       block completes, so stalling on it would be a circular dependency;
       punctuation beats (restUntil) and sound/badge blockers stay safely
       below the stall window, so real typing is never mistaken for a
       freeze. */
    var lastTypedAt = 0;
    function stalled() {
        return performance.now() - lastTypedAt > 1200 &&
            Date.now() >= restUntil && !anyBlocker();
    }
    function isBusy() {
        if (!enabled() || skipped) return false;
        if (queue.length > 0 || holdStarted > 0) return true;
        if (paused()) return true;
        return lag() > 0 && !stalled();
    }

    /* final deltas: since core/turns.py switched the provisional final to
       tiny append events (a full snapshot only every 128 appends and on
       structural changes), the typewriter SWALLOWS turn_final_delta
       frames instead of letting the store run ahead of the reveal. the
       text joins the segment the core would have appended to (the last
       final message, exactly the core's own rule), and the typed prefix
       reaches the store as the usual synthetic deliveries. the periodic
       snapshots then re-sync gate() for free: identical full text, kept
       progress. a SKIP stops the swallowing, so the remainder streams
       plain. (Without this the store always ran ahead and gate's
       never-rewind adoption marked everything typed: no lag, no pill,
       no typewriter.) */
    function feedFinalDelta(text) {
        var idx = -1;
        for (var i = segs.length - 1; i >= 0; i--) {
            if (segs[i]) { idx = i; break; }
        }
        if (idx === -1) {
            // no snapshot gated yet (typewriter activated before the
            // first): track the growing text ourselves - the run-ahead
            // guard in syncToStore reconciles with whatever the store
            // already holds
            idx = 0;
            segs[0] = { full: "", shown: 0, delivered: null };
        }
        segs[idx].full += text;
        ensureLoop();
    }

    /* -------------------------
     * gating: full accumulated segments in, typed prefixes out
     * ------------------------- */
    function gate(msgs) {
        if (!Array.isArray(msgs) || msgs.length === 0) return msgs;
        if (!enabled()) {
            // typewriter off: the arriving stream IS the reveal - scan
            // the raw content so sfx macros still cue
            for (var si = 0; si < msgs.length; si++) {
                var sm = msgs[si];
                if (sm && sm.type === "content" && typeof sm.content === "string") scanSeg(si, sm.content);
            }
            return msgs;
        }

        // an authoritative snapshot may be shorter than what we tracked
        if (segs.length > msgs.length) segs = segs.slice(0, msgs.length);

        for (var i = 0; i < msgs.length; i++) {
            var m = msgs[i];
            if (!m || m.type !== "content" || typeof m.content !== "string") {
                segs[i] = null;
                continue;
            }
            var c = m.content;
            var s = segs[i];
            if (!s) {
                s = segs[i] = { full: c, shown: 0, delivered: null };
                // typewriter activated mid-stream (campaign discovered late):
                // text already on screen stays on screen - never rewind it
                try {
                    var live = Alpine.store("stream").turn;
                    // only a LIVE turn's on-screen text may be adopted as
                    // already-woken: after a turn closes, stream.turn still
                    // points at the old finished passage, and an identical
                    // new passage would otherwise wake fully typed
                    var lm = live && live.live === true && live.final_messages && live.final_messages[i];
                    if (lm && typeof lm.content === "string" && lm.content.length &&
                            lm.content.length <= c.length && c.indexOf(lm.content) === 0) {
                        s.shown = lm.content.length;
                        s.delivered = lm.content;
                        // everything behind the wake line is already on the
                        // page: seed all family cursors so those macros do
                        // not fire as reveal events (sfx stays silent, art
                        // paints flat - it was shown, not revealed)
                        sfxIdx[i] = lm.content.length;
                        pulseIdx[i] = lm.content.length;
                        imgIdx[i] = lm.content.length;
                        sdIdx[i] = lm.content.length;
                    }
                } catch (e) {}
            } else if (c.length >= s.full.length && c.indexOf(s.full) === 0) {
                s.full = c;                       // the tail grew
            } else if (s.full.indexOf(c) === 0) {
                s.full = c;                       // content shrank: clamp
                if (s.shown > c.length) s.shown = c.length;
            } else {
                // authoritative rewrite of this segment: a finished one
                // stays finished, a typing one keeps its progress
                var wasDone = s.shown >= s.full.length;
                s.full = c;
                s.shown = wasDone ? c.length : Math.min(s.shown, c.length);
            }
        }

        if (skipped) {
            for (var j = 0; j < segs.length; j++) if (segs[j]) segs[j].shown = segs[j].full.length;
            scanRevealed();
            return msgs;
        }

        if (lag() > 0) ensureLoop();

        return msgs.map(function (mm, idx) {
            var sg = segs[idx];
            if (!sg || !mm || mm.type !== "content") return mm;
            if (sg.shown >= sg.full.length) return mm;
            var out = {};
            for (var k in mm) out[k] = mm[k];
            out.content = sg.full.slice(0, sg.shown);
            return out;
        });
    }

    /* The reveal rides the core's OWN delivery path: we synthesize a
       turn_final whose content messages carry nothing past the typed
       prefix and hand it to the wrapped handler, exactly as a real token
       delivery arrives. That is what makes the reveal paint every frame -
       direct writes to the store do NOT repaint the live message reliably,
       which is why the first cut appeared to stutter word-by-word (it only
       advanced on the real deliveries).
       coalesce: at most one synthetic delivery per frame, and never while
       a real delivery is still in flight inside the core handler. */
    var coreBusy = false;
    var pendingSync = false;
    // phone cadence: one synthetic delivery per PAINT GAP (26ms phone /
    // 36ms low-power) instead of one per frame. the reveal itself is
    // untouched - characters just land a few at a time, and the trailing
    // one is never dropped (the deferred retry below still delivers it).
    var paintAt = 0;
    var paintTimer = 0;
    function syncToStore() {
        if (coreBusy || skipped) return;
        if (pendingSync) return;
        var gap = window.AdvPerf ? AdvPerf.paintGapMs() : 0;
        if (gap > 0 && paintAt && performance.now() - paintAt < gap) {
            if (!paintTimer) {
                paintTimer = setTimeout(function () {
                    paintTimer = 0;
                    syncToStore();
                }, gap);
            }
            return;
        }
        pendingSync = true;
        requestAnimationFrame(function () {
            pendingSync = false;
            paintAt = performance.now();
            if (skipped) return;
            // Never resurrect a turn the core has already closed: if the live
            // turn is gone (or no longer live), dropping a synthetic turn_final
            // would make the core handler push a phantom turn into history.
            var turn;
            try { turn = Alpine.store("stream").turn; } catch (e) { return; }
            if (!turn || turn.live !== true) return;
            var msgs = turn.final_messages;
            if (!msgs || !msgs.length) return;
            var out = [];
            var changed = false;
            for (var i = 0; i < msgs.length; i++) {
                var m = msgs[i];
                var s = segs[i];
                if (!m || m.type !== "content" || typeof m.content !== "string" || !s) { out.push(m); continue; }
                if (m.is_cmd || (m._metadata && m._metadata.is_cmd)) {
                    // command output in the passage (rare in adventures):
                    // the core handler reloads chats per delivery of it -
                    // never replay that per frame, let the real stream own it
                    return;
                }
                if (m.content.length > s.shown) {
                    // the store ran ahead of the reveal (reload, replay,
                    // authoritative snapshot): adopt its text, never rewind
                    s.full = m.content;
                    s.shown = m.content.length;
                    changed = true;   // keep the payload as-is: it carries
                    out.push(m);      // the text that won
                    continue;
                }
                if (m.content.length === s.shown) { out.push(m); continue; }
                var copy = {};
                for (var k in m) copy[k] = m[k];
                copy.content = s.full.slice(0, s.shown);
                out.push(copy);
                changed = true;
            }
            // whatever just appeared cues here (store-adopted jumps too)
            scanRevealed();
            if (!changed) return;   // nothing new typed: no delivery, no sound
            var payload = { type: "turn_final", messages: out, advSynthetic: true };
            coreBusy = true;
            // the core plays its token blip per delivery; at a reveal of
            // up to 60 deliveries per second that is a machine gun, and
            // our own cues already punctuate the typing. the flag covers
            // the synchronous head of the handler (where the blip fires,
            // before its first await), so it is cleared right after the
            // call returns, not in the continuation
            window.__advTwSynthetic = true;
            try {
                var r = (window.handleWebSocketMessage || origRef)(payload);
                if (r && r.then) r.then(function () { coreBusy = false; }, function () { coreBusy = false; });
                else coreBusy = false;
            } catch (e) { coreBusy = false; }
            window.__advTwSynthetic = false;
        });
    }
    /* reading rhythm: the reveal lingers a beat after a sentence ends
       (. ! ?) and a shorter breath after a clause comma (, ; :) - the
       pauses scale with the typing speed (about 45 / 15 "virtual
       characters" of silence) so the prose cadence survives any setting.
       Only real sentence breaks count: a period followed by another
       period (ellipsis - the LAST dot gets the beat), by a digit
       (3.5) or by a letter (e.g. Mr.) stays silent */
    var restUntil = 0;
    var BREAK_END = /[.!?]/;
    var BREAK_SOFT = /[,;]/;
    var BREAK_AFTER = /[\s"')\]\u00BB\u2014\u2019]/;
    function restAt(s) {
        var i = s.shown - 1;
        if (i < 0) return;
        var ch = s.full.charAt(i);
        var nx = s.full.charAt(i + 1);
        if (!BREAK_END.test(ch) && !BREAK_SOFT.test(ch)) return;
        if (BREAK_END.test(nx)) return;                          // ellipsis mid-stream
        if (ch === "." && (/[0-9A-Za-z]/.test(nx) && nx !== "")) return;  // decimal / abbreviation
        if (nx !== "" && !BREAK_AFTER.test(nx) && nx !== "." && nx !== "!") return;
        var beat = BREAK_END.test(ch) ? 45 : 15;
        var ms = Math.min(BREAK_END.test(ch) ? 650 : 220, beat * 1000 / cps());
        restUntil = Math.max(restUntil, Date.now() + ms);
    }
    /* -------------------------
     * markup jumps
     * state macros ({{stat}}, {{item}}, {{status}}, {{statusoff}},
     * {{music}}), sound cues ({{sfx|..}}) and pulses ({{flash}}, {{poof}})
     * are world events, not prose - typing their braces letter by letter
     * is markup assembly, so the reveal JUMPS the instant it touches one:
     * straight past the closing braces, resuming from there. a token the
     * stream has not finished yet still commits once its kind is
     * unambiguous: the reveal runs to the last character the stream has
     * sent, waits at that edge, and leaps the moment the token closes.
     * bare inline html tags (<em>, <span ...>, <br/>) jump the same way,
     * complete or still open. FLAVOR macros ({{whisper|..}} and friends)
     * are deliberately NOT skipped - their words are the story and keep
     * typing out normally. WIKI LINKS ([[..]]) take the same flavor path:
     * wikiOpenEdge vanishes the brackets the instant they touch the cursor
     * (and a two-part link's hidden send-side whole), so the choice is
     * styled from its first typed character.
     * ------------------------- */
    var SKIP_KIND_BASE = ["stat", "item", "status", "statusoff", "music", "sfx", "img", "sd",
        "quest", "questdone", "questfail", "questoff", "subgoal", "subdone"];
    var SKIP_KIND_NAMES = SKIP_KIND_BASE.concat(window.AdvFX ? window.AdvFX.pulseList() : []);
    // every flavor kind: a partial kind that could still become one of
    // these is ambiguous, and ambiguous means "keep typing". the list is
    // dynamic - the campaign's asset pack ships the text_decoration/ sheets
    // and the AdvFX pack IS the vocabulary (adv:fx rebuilds it below);
    // before the pack lands there simply are no decoration names, so the
    // braces just type as plain text until the rebuild restyles them.
    // the same list is the set of kinds whose BODY is prose we want to see
    // in its final style the instant it starts typing (unlike state/sfx/pulse
    // macros, which stay skipped whole). flavorOpenEdge snaps past the pipe.
    function advTdList() {
        return (window.AdvFX && window.AdvFX.tdList) ? window.AdvFX.tdList() : [];
    }
    var FLAVOR_KINDS = advTdList();
    var HOLD = -1;   // sentinel: stay put at the opening braces, wait for more
    var SKIP_KIND_ALT = "stat|item|status|statusoff|music|sfx|img|sd|quest(?:done|fail|off)?|subgoal|subdone";
    var SKIP_MACRO_RE = new RegExp("^\\{\\{(?:(?:" + SKIP_KIND_ALT + ")\\|[^{}]*|(?:" + advPulseAlt() + ")(?:\\|[^{}]*)?)\\}\\}");
    var SKIP_PIPE_PART_RE = new RegExp("^\\{\\{(?:" + SKIP_KIND_ALT + ")\\|[^{}]*");
    var PARTIAL_KIND_RE = /^\{\{([a-z]*)$/;

    // when the visual pack (re)loads, the pulse vocabulary may have grown:
    // rebuild every name-derived scanner in this file at once
    window.addEventListener("adv:fx", function () {
        PULSE_REVEAL_RE = new RegExp("\\{\\{(" + advPulseAlt() + ")(?:\\|[^{}]*)?\\}\\}", "g");
        SKIP_MACRO_RE = new RegExp("^\\{\\{(?:(?:" + SKIP_KIND_ALT + ")\\|[^{}]*|(?:" + advPulseAlt() + ")(?:\\|[^{}]*)?)\\}\\}");
        SKIP_KIND_NAMES = SKIP_KIND_BASE.concat(window.AdvFX ? window.AdvFX.pulseList() : []);
        FLAVOR_KINDS = advTdList();
    });

    // is a pipeless kind part uniquely skippable? one flavor-kind
    // possibility anywhere ("s" could become shout, "m" could become
    // mind) keeps the token in the "type it" camp until it resolves
    function partialSkip(part) {
        for (var i = 0; i < FLAVOR_KINDS.length; i++)
            if (FLAVOR_KINDS[i].indexOf(part) === 0) return false;
        for (var j = 0; j < SKIP_KIND_NAMES.length; j++)
            if (SKIP_KIND_NAMES[j].indexOf(part) === 0) return true;
        return false;
    }

    // end index of a skippable token covering the reveal cursor: a number
    // (the token closes further ahead) or Infinity (open at the stream
    // edge). called after every typed character, so "covering" means the
    // token started at or before the cursor without closing past it.
    function skipOpenEnd(full, cur) {
        var lt = full.lastIndexOf("<", cur - 1);
        if (lt >= 0 && /[a-zA-Z\/!]/.test(full.charAt(lt + 1))) {
            var gt = full.indexOf(">", lt);
            if (gt < 0) return Infinity;              // stream broke mid-tag
            if (gt >= cur) return gt + 1;             // tag reaches past the cursor
        }
        var b = full.lastIndexOf("{{", cur - 1);
        if (b < 0) return -1;
        var rest = full.slice(b);
        var m = SKIP_MACRO_RE.exec(rest);
        if (m) return b + m[0].length > cur ? b + m[0].length : -1;
        if (SKIP_PIPE_PART_RE.test(rest)) return Infinity;   // kind confirmed, close pending
        var p = PARTIAL_KIND_RE.exec(rest);
        if (p && partialSkip(p[1])) return Infinity;         // uniquely a skip macro so far
        return -1;
    }

    // flavor-open edge: when the reveal cursor sits exactly on the "{{" of a
    // macro, decide whether to snap past its opening so the typed words are
    // already styled. returns HOLD (-1) to wait while the kind is still
    // unresolved at the stream edge, a position past the pipe to jump to
    // (a flavor kind's styled body, or a MADE-UP kind's plain body - the
    // renderers show an unknown macro as its bare text, so its braces are
    // markup the player never needs to watch assemble), or cur for "carry on
    // typing normally" (a state/sfx/pulse macro, which skipOpenEnd leaps
    // whole, or a resolved literal). the body past the pipe keeps typing one
    // char at a time; the marked partial-macro renderer styles it as it grows.
    function flavorOpenEdge(full, cur) {
        if (cur + 2 > full.length) return cur;
        if (full.charAt(cur) !== "{" || full.charAt(cur + 1) !== "{") return cur;
        var i = cur + 2;
        while (i < full.length && /[a-z0-9_-]/.test(full.charAt(i))) i++;
        var kind = full.slice(cur + 2, i);
        var atEdge = (i === full.length);          // nothing but the kind streamed yet
        var next = i < full.length ? full.charAt(i) : "";
        if (next === "|") {
            // pipe in: state/sfx/pulse macros keep their whole-token leap
            // (skipOpenEnd carries the reveal past the closing braces);
            // flavor kinds jump past the pipe - and so does ANY made-up
            // kind, whose body the renderers already show as plain text,
            // so the reveal types exactly what the page paints, never the
            // braces of a macro the AI invented
            if (SKIP_KIND_NAMES.indexOf(kind) !== -1) return cur;
            return i + 1;
        }
        // no pipe yet at the stream edge: whatever this token turns out to
        // be (flavor, pulse, skip or made-up), it has not announced itself
        // - freeze before a single brace can type. A literal "{{ word ..."
        // unlocks the instant a non-kind character lands (falls through to
        // raw typing as always), and a stream that ended mid-token unlocks
        // too (holdStarted: the passage is over, just type what is there),
        // so a hold can never stall the release on its own.
        if (atEdge && !holdStarted) return HOLD;
        return cur;
    }

    // wiki-link opening: the same concept as flavorOpenEdge, applied to
    // [[..]] choices. the brackets are markup, so the reveal leaps them
    // for free and the choice is FORMATTED from its very first typed
    // character (the marked partial-wiki renderer styles the growing
    // token). a two-part [[send|display]] link keeps its hidden send-side
    // whole: the leap runs straight past the pipe and typing resumes on
    // the display text. HOLD freezes the cursor while the stream edge has
    // not yet revealed which form the link is (exactly like an unresolved
    // flavor kind).
    function wikiOpenEdge(full, cur) {
        if (cur + 2 > full.length) return cur;
        if (full.charAt(cur) !== "[" || full.charAt(cur + 1) !== "[") return cur;
        var pipe = full.indexOf("|", cur + 2);
        var close = full.indexOf("]]", cur + 2);
        if (pipe !== -1 && (close === -1 || pipe < close)) return pipe + 1;
        if (close !== -1) return cur + 2;
        // unresolved at the stream edge - but if the stream is over
        // (holdStarted), this link never closes: type it raw instead of
        // freezing the release on it (same guard as flavorOpenEdge)
        return holdStarted ? cur : HOLD;
    }

    function advance(n) {
        var typed = 0;
        for (var i = 0; i < segs.length && n > 0; i++) {
            var s = segs[i];
            if (!s || s.shown >= s.full.length) continue;
            // character by character now: a keystroke that touches a
            // skippable token leaps the reveal over it instantly (or to
            // the stream edge while the token is still arriving) - the
            // player never watches markup assemble. the jump costs no
            // typing budget, so the prose simply resumes after the token.
            var add = Math.min(n, s.full.length - s.shown);
            var walked = 0;
            while (walked < add && s.shown < s.full.length) {
                // a flavor macro opening: reveal its markup instantly (free)
                // so the body types already-styled; HOLD freezes the reveal at
                // the opening until the kind resolves past the stream edge
                var fe = flavorOpenEdge(s.full, s.shown);
                if (fe === HOLD) break;
                if (fe > s.shown) { s.shown = fe; continue; }
                // the same edge for wiki links: [[ touches the cursor, the
                // brackets (and a two-part link's hidden send-side) vanish
                // instantly, and the choice starts typing already styled
                var we = wikiOpenEdge(s.full, s.shown);
                if (we === HOLD) break;
                if (we > s.shown) { s.shown = we; continue; }
                // and the matching closing braces leap too (free), so a flavor
                // macro never shows raw {{kind| or }} while it types
                if (s.full.charAt(s.shown) === "}" && s.full.charAt(s.shown + 1) === "}") {
                    s.shown += 2;
                    continue;
                }
                // the closing ]] of an OPEN wiki link leaps the same way:
                // still inside a link means an unclosed [[ sits behind the
                // cursor (an earlier ]] would have closed it), and the
                // token renders complete the moment the pair lands
                if (s.full.charAt(s.shown) === "]" && s.full.charAt(s.shown + 1) === "]" &&
                        s.full.lastIndexOf("[[", s.shown) > s.full.lastIndexOf("]]", s.shown - 1)) {
                    s.shown += 2;
                    continue;
                }
                s.shown++;
                walked++;
                var end = skipOpenEnd(s.full, s.shown);
                if (end > s.shown) s.shown = end > s.full.length ? s.full.length : end;
                restAt(s);
                if (Date.now() < restUntil) break;   // the beat lands WHERE the punctuation is
            }
            n -= walked;
            typed += walked;
            if (Date.now() < restUntil) break;
        }
        return typed;
    }
    /* every character that APPEARS clacks: one keystrike per typed char,
     * staggered a few milliseconds so a frameful of them reads as a
     * typewriter roll, not a single clap. NOT throttled - the sound is
     * the reveal itself. Skips and watchdog flushes paint instantly and
     * stay silent (hundreds of keys in one clap would be pain). */
    function keyRoll(n) {
        if (n <= 0) return;
        // a set that ships typing_loop.<audio> owns the typewriter's
        // voice: the bed takes over, this call just keeps it alive
        if (typingLoopActive()) { typingLoopTap(); return; }
        var sc = window.AdvSoundscape;
        // "key" is the typewriter's OWN cue (a sfx/type_key.* file can
        // replace its clack); it falls back to the plain stream "token"
        var fn = sc && (sc.key || sc.token);
        if (!fn) return;
        // phones voice a frameful of characters with at most a few keys
        // (the roll still reads as typing; the silent characters ride along)
        var keys = window.AdvPerf ? AdvPerf.keysPerRoll(n) : n;
        for (var i = 0; i < keys; i++) fn.call(sc, i * 0.003);
    }

    /* -------------------------
     * typing sound loop
     * The asset pack decides the typewriter's voice: ship a
     * typing_loop.<audio> file in its sfx_builtin/ shelf (the
     * campaign's file over the default base) and its bed REPLACES the
     * per-character clacks - faded IN when text starts typing, OUT on
     * beat-gaps (the same 380 ms stall the caret withdraws on), on
     * skip, on turn reset and on game teardown. The element keeps its
     * loop position across fades, so resuming continues the texture
     * instead of restarting it. No file, no change: per-key stays.
     * ------------------------- */
    var twLoop = null;      // the loop element, lazily built
    var twLoopSrc = "";     // url it currently carries
    var twLoopFade = null;  // active volume-ramp interval
    var twLoopTo = -1;      // the interval's current target (-1 = none)
    var twLoopAt = 0;       // performance.now of the last landed char
    var twLoopWatch = 0;    // idle watchdog (the reveal's rAF tick stops
                            // once the passage is fully painted, so the
                            // bed cannot rely on it to ever time out)
    function typingLoopUrl() {
        return (window.AdvFX && window.AdvFX.typingLoopUrl)
            ? (window.AdvFX.typingLoopUrl() || "") : "";
    }
    function typingLoopActive() { return typingLoopUrl() !== ""; }
    function twRamp(to, step) {
        // 40 ms volume staircase; at 0 it pauses the element and the
        // next tap resumes from the same loop position. A ramp already
        // heading for the SAME target is left alone: typing taps land
        // many times per second, and restarting the staircase on every
        // tap used to starve it - the volume barely crawled and only
        // rose in the rare gaps between taps.
        if (!twLoop || twLoopTo === to) return;
        twLoopTo = to;
        clearInterval(twLoopFade);
        twLoopFade = setInterval(function () {
            var up = to >= twLoop.volume;
            var v = twLoop.volume + (up ? step : -step);
            if (up ? v >= to : v <= to) v = to;
            twLoop.volume = Math.max(0, Math.min(1, v));
            if (v === to) {
                clearInterval(twLoopFade);
                twLoopFade = null;
                if (to <= 0) { try { twLoop.pause(); } catch (e) {} }
            }
        }, 40);
    }
    function typingLoopTap() {
        twLoopAt = performance.now();
        if (cfg.sound_enabled === false) return;
        var url = typingLoopUrl();
        if (!url) return;
        if (!twLoop || twLoopSrc !== url) {
            // first tap, or a set switch swapped the bed under us
            if (!twLoop) {
                twLoop = new Audio();
                twLoop.loop = true;
                twLoop.preload = "auto";
            }
            twLoop.src = url;
            twLoopSrc = url;
            twLoop.volume = 0;
            twLoopTo = -1;    // fresh element: forget the old ramp target
        }
        // ride the same sliders as every cue (world sound volume x webui
        // master) and the typing_volume slider, but land ABOVE the
        // per-key ticks: their 0.9 scale suits a short grating tick,
        // while a soft continuous texture reads calm even at 1.6x
        var tv = (cfg.typing_volume == null ? 100 : cfg.typing_volume) / 100;
        var target = (window.AdvAudio && window.AdvAudio.uiVolume)
            ? window.AdvAudio.uiVolume(tv * 1.6) : tv * 1.6;
        target = Math.max(0, Math.min(1, target));
        if (target <= 0) return;   // slider at zero: stay silent
        // self-contained idle watchdog: no landed character for a beat
        // ends the bed - which is exactly what a finished stream does
        // once the reveal catches up (the caret may keep blinking via
        // .adv-caret-stay; that is the SET's look, not a typing state)
        clearTimeout(twLoopWatch);
        twLoopWatch = setTimeout(typingLoopStop, 380);
        if (twLoop.paused) {
            var p = twLoop.play();
            if (p && p.catch) p.catch(function () {});
        }
        twRamp(target, Math.max(0.04, target / 3));   // ~0.1 s snap fade-in
    }
    function typingLoopStop(fast) {
        twLoopAt = 0;
        clearTimeout(twLoopWatch);
        if (!twLoop || twLoop.paused) return;
        twRamp(0, Math.max(0.04, twLoop.volume / 3)); // ~0.1 s, from wherever it sits
    }

    /* the caret sprite: a tiny effect riding just right of the character
     * being typed. This engine only creates #adv-caret and parks it at
     * the point just past the last painted character of the live
     * passage (fixed coords, the sprite centers itself via
     * translate(-50%,-50%)); the LOOK is a chrome slot - a set's root
     * caret.css IS its effect (fantasy ships sparkles, scifi ships tech
     * chips). The engine only steers .adv-caret-on on and off - the
     * SHEET owns the look AND the fade: the base state hides with
     * opacity+visibility plus a transition pair (fast fade IN while
     * .adv-caret-on is on, slower fade OUT before visibility kills the
     * element - never a snapped display:none), so the sprite arrives and
     * withdraws like a cursor should. On while characters land; off on
     * skip, settle, reset, and whenever typing stalls on a beat or a
     * hold.
     *
     * EMISSION: while typing, the engine also drops PARTICLES at the
     * caret's current spot - <i class="adv-caret-p v0|v1|v2"> born at
     * those fixed coords and LEFT THERE (the engine picks the variant
     * at random; the sheet uses v0/v1/v2 to scatter glyph, offset and
     * timing so the trail never reads as a metronome). The caret moves
     * on, the particles twinkle out where they fell. Sheets style
     * .adv-caret-p (default: unstyled, hence invisible - a set that
     * ships nothing simply emits no trail) and their particle animation
     * must be FINITE: the engine recycles each particle on
     * animationend, with a 3s safety net. A slower second channel drops
     * .adv-caret-ghost elements (one per ~55ms) at the caret's
     * abandoned centre - sheets that style them get a fading after-
     * image TRAIL of the caret itself; unstyled, they are invisible. */
    var caretEl = null;
    var caretLastType = 0;   // performance.now() of the last landed char
    var caretLive = 0;       // emitted particles still in the document
    var caretEmitAt = 0;     // throttle: one spawn per this often (ms)
    var caretGhostAt = 0;    // throttle for the halo's ghost trail
    function caretGhost(now) {
        // the halo's after-image: every ~30ms a .adv-caret-ghost is
        // LEFT at the caret's abandoned centre so the caret streams a
        // fading trail of itself. the sheet styles (and fades) it -
        // finite animation, engine recycles on animationend + 2s net.
        // phones trail far less often; low-power phones trail not at all.
        var ghostMs = window.AdvPerf ? AdvPerf.caretGhostMs() : 30;
        if (!ghostMs || now - caretGhostAt < ghostMs) return;
        caretGhostAt = now;
        var g = document.createElement("i");
        g.className = "adv-caret-ghost";
        g.style.left = caretEl.style.left;
        g.style.top = caretEl.style.top;
        g.addEventListener("animationend", function () {
            if (g.parentNode) g.parentNode.removeChild(g);
        });
        setTimeout(function () {
            if (g.parentNode) g.parentNode.removeChild(g);
        }, 2000);
        document.body.appendChild(g);
    }
    function emitCaret(now) {
        // emission throttle and live-particle ceiling: 8ms/480 on desktop,
        // stepped right down on phones (36ms/90, 55ms/36 low-power)
        var throttle = window.AdvPerf ? AdvPerf.caretThrottle() : 8;
        var cap = window.AdvPerf ? AdvPerf.caretCap() : 480;
        if (caretLive > cap || now - caretEmitAt < throttle) return;
        caretEmitAt = now;
        var p = document.createElement("i");
        p.className = "adv-caret-p v" + (Math.random() * 3 | 0);
        p.style.left = caretEl.style.left;
        p.style.top = caretEl.style.top;
        p.addEventListener("animationend", function () {
            if (p.parentNode) { p.parentNode.removeChild(p); caretLive--; }
        });
        // a sheet that forgets a finite animation must not leak nodes
        setTimeout(function () {
            if (p.parentNode) { p.parentNode.removeChild(p); caretLive--; }
        }, 3000);
        document.body.appendChild(p);
        caretLive++;
        caretGhost(now);
    }
    // anchor: the last PAINTED character of the live passage's CONTENT.
    // a collapsed range (a zero-width cursor) must never be measured -
    // engines answer it with an empty rect, and the sprite ended up at
    // the fallback's right-middle. instead: one-character ranges walked
    // BACKWARDS from the tail, so trailing whitespace and hidden nodes
    // keep stepping back until a real character box answers. the docked
    // "or type something else" prompt form (#adv-prompt) is never the
    // cursor's target - its input is not prose - but everything else
    // the passage typed (choice pills included) anchors fine.
    function caretAnchorRect() {
        var turns = document.querySelectorAll("#messages .turn");
        var last = turns.length ? turns[turns.length - 1] : null;
        if (!last) return null;
        var walker = document.createTreeWalker(last, NodeFilter.SHOW_TEXT, null);
        var nodes = [], nd;
        while ((nd = walker.nextNode())) nodes.push(nd);
        var range = document.createRange();
        var rect = null;
        for (var i = nodes.length - 1; i >= 0; i--) {
            var len = nodes[i].textContent.length;
            if (!len) continue;
            if (nodes[i].parentElement &&
                    nodes[i].parentElement.closest("#adv-prompt")) continue;
            range.setStart(nodes[i], len - 1);
            range.setEnd(nodes[i], len);
            var r = range.getBoundingClientRect();
            if (r.width || r.height) { rect = r; break; }
        }
        if (!rect && last.lastElementChild) {
            rect = last.lastElementChild.getBoundingClientRect();
        }
        if (!rect || (!rect.width && !rect.height)) return null;
        return rect;
    }
    function placeCaret() {
        // the typewriter_caret setting switches the sprite off wholesale
        // (the setting ships at page load, so a reload applies a change)
        if (cfg.typewriter_caret === false) { hideCaret(); return; }
        if (!caretEl) {
            caretEl = document.createElement("div");
            caretEl.id = "adv-caret";
            document.body.appendChild(caretEl);
        }
        var rect = caretAnchorRect();
        if (!rect) { hideCaret(); return; }
        caretEl.style.left = Math.round(rect.right + 4) + "px";
        caretEl.style.top = Math.round(rect.top + rect.height / 2) + "px";
        caretEl.classList.add("adv-caret-on");
        // stay lives from the first typed character until the TURN
        // retires (user message / chat switch / out of game), immune to
        // pause/settle hides - sheets that key their look off it (scifi)
        // get a persistent cursor through beats and after stream end
        caretEl.classList.add("adv-caret-stay");
        caretLastType = performance.now();
        emitCaret(caretLastType);
    }
    function hideCaret() {
        if (caretEl) caretEl.classList.remove("adv-caret-on");
    }
    function retireCaret() {
        // full caret death for the turn: even persistent (stay-keyed)
        // sheets go invisible - fired on user message, chat switch and
        // leaving the game, never on pauses or stream end
        if (caretEl) {
            caretEl.classList.remove("adv-caret-on");
            caretEl.classList.remove("adv-caret-stay");
        }
    }
    // the sprite rides fixed VIEWPORT coords, so every scroll must
    // re-read the anchor's box or it floats over the text: any scroller
    // (capture phase), rAF-coalesced, and only while some caret class
    // is actually up - no listeners waking on plain chat scrolling
    var caretRepos = 0;
    function caretReposition() {
        if (caretRepos || !caretEl) return;
        if (!caretEl.classList.contains("adv-caret-on") &&
                !caretEl.classList.contains("adv-caret-stay")) return;
        caretRepos = requestAnimationFrame(function () {
            caretRepos = 0;
            if (!caretEl) return;
            var r = caretAnchorRect();
            if (!r) return;
            caretEl.style.left = Math.round(r.right + 4) + "px";
            caretEl.style.top = Math.round(r.top + r.height / 2) + "px";
        });
    }
    document.addEventListener("scroll", caretReposition, true);
    window.addEventListener("resize", caretReposition);

    /* -------------------------
     * the hold: stream parked until the reveal catches up
     * ------------------------- */
    var pumpStarted = 0;
    function pump() {
        // stall guard: a released message whose core handler never settles
        // must not strand the queue behind a stuck pumping flag
        if (pumping && Date.now() - pumpStarted < 10000) return;
        if (!queue.length) { holdStarted = 0; pumping = false; return; }
        pumping = true;
        pumpStarted = Date.now();
        // NOTE: parked payloads must NEVER re-enter our own wrapper on
        // release - a stream_complete that found the hold still on would
        // be re-parked, handed back, re-parked... a synchronous recursion
        // that overflows the stack and silently kills the reveal loop.
        // Drain straight through the captured inner chain instead.
        (function step() {
            if (!queue.length) {
                pumping = false;
                holdStarted = 0;
                return;
            }
            var d = queue.shift();
            var r;
            try { r = origRef(d); } catch (e) {}
            if (r && r.then) r.then(step, step);
            else step();
        })();
    }
    function flush() {
        for (var i = 0; i < segs.length; i++) {
            if (segs[i]) segs[i].shown = segs[i].full.length;
        }
        scanRevealed();   // a skipped flush's syncToStore returns early -
        syncToStore();    // this still cues the sounds it just revealed
    }
    function abandonQueue() {
        queue = [];
        holdStarted = 0;
        holdChat = null;
    }
    function skip() {
        skipped = true;
        restUntil = 0;
        flush();
        hideCaret();   // the passage painted instantly: no cursor to chase
        typingLoopStop(true);   // and no typing bed either
        pump();
        updateSkip();
    }

    /* -------------------------
     * the tick
     * ------------------------- */
    function ensureLoop() {
        if (rafOn) return;
        rafOn = true;
        lastT = performance.now();
        requestAnimationFrame(tick);
    }
    function tick(now) {
        var dt = Math.min(100, now - lastT);
        lastT = now;
        if (enabled() && !skipped && !paused()) {
            if (Date.now() < restUntil) {
                // resting on a punctuation beat: the accumulator FREEZES,
                // so the pause reads as a breath and not as a burst of
                // characters the moment it lifts
            } else {
                if (restUntil) { restUntil = 0; accChars = 0; }
                if (lag() > 0) {
                    accChars += cps() * dt / 1000;
                    var n = Math.floor(accChars);
                    if (n >= 1) {
                        accChars -= n;
                        var tv = advance(n);
                        if (tv > 0) lastTypedAt = now;   // progress resets the stall clock
                        keyRoll(tv);
                        syncToStore();
                        placeCaret();   // parks the sprite just painted (1-frame lag is invisible here)
                    }
                }
            }
        }
        // typing STALLED - a punctuation beat, a sound/badge hold, or a
        // tail waiting on characters that stopped landing: no keystroke
        // for a beat-gap means the cursor should not sit there either,
        // so withdraw it (the sheet fades out) and let the next
        // character bring it right back
        if (caretEl && caretEl.classList.contains("adv-caret-on") &&
                now - caretLastType > 380) hideCaret();
        // the typing bed keeps the very same beat-gap contract as the
        // caret: no landed character for a beat fades it out, the next
        // character fades it right back in (independent of the caret
        // setting - the bed is the SET's choice, not the user's)
        if (twLoop && !twLoop.paused && twLoopAt &&
                now - twLoopAt > 380) typingLoopStop();
        // shown while typing lags AND while the tail holds the stream open
        // on a sound or badge beat - skipping works for both
        var lagNow = lag();
        if (lagNow !== lastLag) { lastLag = lagNow; lastLagAt = Date.now(); }
        // the pill appears ONLY once the stream has finished and the
        // reveal is what keeps the world waiting - while generation is
        // still running there is nothing to skip to yet
        updateSkip(holdStarted > 0 && !skipped);
        if (holdStarted) {
            if (currentChat() !== holdChat || !wsUp()) {
                // switched away or the socket died: reveal everything and
                // abandon the parked lifecycle - the reconnect / reload
                // path resyncs the page with the backend on its own
                flush();
                abandonQueue();
                rafOn = false;   // let a later ensureLoop() restart cleanly
                updateSkip(false);
                hideCaret();
                return;
            }
            // release on LAG ONLY (a sound/badge beat delays the typing
            // mid-passage but must never gate stream completion). the
            // watchdog is stall-based: characters landing reset the clock,
            // an intentional sound/badge pause exempts it (blockers are
            // bounded, they always expire on their own), so a long cozy
            // passage types out UNINTERRUPTED however long it takes -
            // only a hold where nothing moves for the cap force-releases
            if (!paused() && Date.now() - lastLagAt > HOLD_CAP_MS) {
                blockers = {};
                skipped = true;
                flush();
                hideCaret();
            }
            if (lagNow <= 0 || skipped) pump();
        }
        if (lag() > 0 || holdStarted || queue.length) requestAnimationFrame(tick);
        else { rafOn = false; updateSkip(false); hideCaret(); }   // stream settled: the
    }                                                // skip pill goes too

    /* -------------------------
     * skip button
     * ------------------------- */
    var skipBtn = null;
    function skipEligible() {
        // the passage itself stays clickable for choices, so no capture-phase
        // shortcut there: it would eat the first click of a real [[option]].
        // Escape mirrors the pill: only after the stream has finished
        return enabled() && !skipped && holdStarted > 0;
    }
    function ensureSkipBtn() {
        if (skipBtn && document.body.contains(skipBtn)) return skipBtn;
        skipBtn = document.createElement("button");
        skipBtn.id = "adv-tw-skip";
        skipBtn.type = "button";
        skipBtn.title = "Finish typing  (Esc)";
        skipBtn.textContent = "Skip \u00BB";   // "Skip »" - plain double chevron, no emoji
        skipBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            skip();
        });
        document.body.appendChild(skipBtn);
        return skipBtn;
    }
    var skipPosAt = 0;
    function updateSkip(on) {
        if (on === undefined) on = holdStarted > 0 && !skipped;
        if (!on) {
            if (skipBtn) skipBtn.classList.remove("adv-tw-on");
            return;
        }
        var btn = ensureSkipBtn();
        // floats at the BOTTOM of the page, centered over the story column:
        // adventures hide the normal input bar entirely (the story's own
        // prompt docks inside the passage's choice rail), so this is a free
        // -standing pill above it, never part of it. measured against
        // #messages so it tracks the story column (the sidebar shifts it),
        // refreshed twice a second while up
        var now = Date.now();
        if (now - skipPosAt > 500) {
            skipPosAt = now;
            var box = document.getElementById("messages") || document.getElementById("chat-window");
            if (box) {
                var r = box.getBoundingClientRect();
                btn.style.left = (r.left + r.width / 2 - btn.offsetWidth / 2) + "px";
                btn.style.top = (r.bottom - btn.offsetHeight - 14) + "px";
            }
        }
        btn.classList.add("adv-tw-on");
    }
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (e.defaultPrevented) return;
        var modal = document.querySelector(".modal, .backing, dialog[open]");
        if (modal) return;
        if (skipEligible()) skip();
    });

    /* -------------------------
     * websocket gate
     * wraps window.handleWebSocketMessage (the games module's wrapper
     * included) so this runs FIRST: park the lifecycle while typing and
     * hand the core only typed prefixes. Released messages drain straight
     * through the captured inner chain, in order, never back through here.
     * ------------------------- */
    var PASS_ALWAYS = { log: 1, token_usage: 1, context_size: 1, pong: 1 };
    var ABORT_HOLD = { sync: 1, chat_switched: 1, refresh_page: 1, shutdown: 1, ready: 1 };

    function wrapType() {
        if (typeof window.handleWebSocketMessage !== "function") {
            setTimeout(wrapType, 200);
            return;
        }
        origRef = window.handleWebSocketMessage;
        window.handleWebSocketMessage = function (data) {
            try {
                var t = data && data.type;
                // our own reveal deliveries pass through unconditionally -
                // they must paint even while a hold parks the real stream
                if (data && data.advSynthetic) return origRef.apply(this, arguments);
                if (t === "turn_final_delta") {
                    // the reveal owns this text while the typewriter rules:
                    // swallow the append (the core's store would run ahead
                    // of the reveal) and hand it to the segment tracker.
                    // skipped/off/inactive: pass through and stream plain.
                    var fd = data.delta;
                    if (fd && typeof fd.text === "string" && fd.text &&
                            enabled() && advActive() && !skipped) {
                        feedFinalDelta(fd.text);
                        return undefined;
                    }
                }
                if (queue.length) {
                    // a hold is in flight: stream_complete arrived while the
                    // reveal still lagged (or rode a sound/badge beat). the
                    // typing syncs the turn objects itself, so the parked
                    // turn_finals (snapshots of prefixes LONG since passed)
                    // are pure staleness - drop them, never replay them.
                    if (t === "turn_final" || t === "turn_step") return undefined;
                    if (PASS_ALWAYS[t]) return origRef.apply(this, arguments);
                    if (ABORT_HOLD[t]) {
                        // a resync/reload event supersedes the parked
                        // lifecycle: reveal everything and DROP the queue -
                        // the page re-syncs through this very event, and
                        // replaying a stale stream_complete after a chat
                        // switch could inject a phantom user turn
                        flush();
                        abandonQueue();
                        return origRef.apply(this, arguments);
                    }
                    queue.push(data);
                    ensureLoop();
                    return undefined;
                }
                var on = enabled() && advActive();
                if (on) {
                    if (t === "user_message_added" || t === "chat_switched" || t === "sync") reset();
                    if (t === "stream_complete" && behind()) {
                        // generation ended but the passage has not: park
                        // the lifecycle (input stays locked, completion
                        // chime and delta flush wait) and let the tick
                        // release it the moment the last character lands.
                        // lag ONLY decides the hold - a sound/badge beat
                        // never gates the release (it could re-arm forever)
                        if (lag() > 0) {
                            queue.push(data);
                            holdStarted = Date.now();
                            holdChat = currentChat();
                            lastLag = lag();
                            lastLagAt = holdStarted;
                            ensureLoop();
                            return undefined;
                        }
                    }
                }
            } catch (e) { /* the show goes on */ }
            return origRef.apply(this, arguments);
        };
    }
    /* a long-stalled stream_complete (blocked tab, dead socket) never
       strands the player: the watchdog in tick force-releases past the cap,
       and coming back to a hidden tab fast-forwards the typing outright */
    var hiddenFor = 0;
    var hiddenAt = 0;
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) { hiddenAt = Date.now(); return; }
        if (!hiddenAt) return;
        hiddenFor = Date.now() - hiddenAt;
        hiddenAt = 0;
        if (hiddenFor > 8000 && (lag() > 0 || queue.length)) {
            flush();
            ensureLoop();
        }
    });

    /* with the typewriter ON, the raw token stream must be SILENT: the
     * soundscape keys (token's crisp strike, quill's heavier one) fire
     * per raw token, which is a rhythm independent of what the player
     * sees. the reveal makes its own keystrokes instead - one per
     * character that appears (keyRoll) - so every drop of token,
     * typing and typewriter is force-dropped while a campaign is up.
     * after a SKIP the turn is plain streaming again (text appears as
     * tokens arrive), so the keys come back for its remainder. the
     * response_start blip is additionally dropped while a synthetic
     * delivery is inside the handler. wraps outermost of all the play()
     * wrappers (this file loads last among the adventure scripts). */
    var myPlay = null;
    function patchAudio() {
        if (typeof AudioManager === "undefined" || !AudioManager.play) return;
        if (myPlay && AudioManager.play === myPlay) return;   // still outermost
        var op = AudioManager.play;
        myPlay = function (id) {
            if (window.__advTwSynthetic && id === "response_start") return;
            if (!skipped && enabled() && advActive() &&
                    (id === "token" || id === "typing" || id === "typewriter")) return;
            return op.apply(AudioManager, arguments);
        };
        AudioManager.play = myPlay;
    }
    patchAudio();
    // the module's soundscape wraps play() too - re-assert outermost so
    // the in-world keystroke obeys the flag no matter who wrapped when
    setInterval(patchAudio, 2000);

    window.AdvType = {
        gate: gate,
        behind: behind,
        skip: skip,
        // called on every in/out-of-game transition: drain any parked
        // lifecycle message so the input unlocks and the turn finalizes,
        // flush the reveal, then wipe all per-turn state (segs, queue,
        // skipped, blockers, skip pill) so the next turn starts clean
        // without needing a page reload.
        teardown: function () {
            try { flush(); } catch (e) {}
            try { pump(); } catch (e) {}
            segs = [];
            sfxIdx = [];
            pulseIdx = [];
            imgIdx = [];
            sdIdx = [];
            blockers = {};
            restUntil = 0;
            holdStarted = 0;
            holdChat = null;
            skipped = false;
            rafOn = false;
            lastTypedAt = performance.now();
            updateSkip(false);
            retireCaret();
            typingLoopStop(true);
        },
        /* openTurn(): called for the turn_final that OPENS a fresh turn
           (the core flips live=true only inside its own handler, so the
           socket hook must gate this payload too - and gating needs the
           per-turn state wiped first, else the previous turn's segments
           would mis-seed this one) */
        openTurn: function () { reset(); },
        /* hold(key, ms): pause the reveal; the key dedupes a burst of
           triggers (a chip volley stays ONE pause, extended on each hit) */
        hold: function (key, ms) {
            if (!pauseOn() || !enabled()) return;
            var until = Date.now() + Math.max(0, parseInt(ms, 10) || 0);
            blockers[key] = Math.max(blockers[key] || 0, until);
            if (queue.length || holdStarted) ensureLoop();
        },
        release: function (key) {
            delete blockers[key];
            if (queue.length || holdStarted) ensureLoop();
        },
        /* isBusy(): is the reveal still running - characters waiting to be
           typed, a sound/badge beat holding the cursor, or a parked stream
           lifecycle? games.js rides this flag on the state heartbeat
           (?typing=1) so the backend holds tool calls until the passage
           has finished typing (AdventureGamesModule._await_typing) - the
           world then only ever moves after the player watched the words
           that moved it land. */
        isBusy: isBusy
    };

    wrapType();
})();
