/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-08) harness:openlumara
   adventure_games :: sound engine (split module).

   Owns the audio side of the immersion wave, deliberately kept out of
   the ever-growing adventure_plus.js:
   - the shared WebAudio lowpass chain: every looping bed is routed
     through it, so daydream muffles the whole mix (the world going
     soft, exactly like being out of it) and snowfall hushes it
   - the world-bound beds: rain (set_scene weather=) makes it patter, embers
     crackle, stars (set_scene sky=) chirp - what you see becomes what you
     hear, riding quietly under whatever ambience loop is playing
   - the dynamic sound-cue library: built-in synthesized cues (coin_flip,
     quest, stage, pickup, status, cleanse, crit, fumble), each one
     overridden by a real sound file the moment a matching file lands in
     the module's webui/assets/sfx/ folder. {{sfx|name}} macros fire
     through cue() from the typewriter's reveal scan (adventure_type.js,
     position-cued so repeats of one name play on); the backend's
     automatic event stamps (campaign.sfx_event) replay as quest chimes,
     coin pings...
   - the tool-only stinger: a musical cue-moment one-shot that pauses
     the soundtrack, holds the GM's caption on screen for its duration,
     and keeps its own tool call waiting until it has played out

   Talks to the other adventure scripts only through window.AdvAudio. */
(function () {
    var cfg = window.ADV_CONFIG || {};

    function sfxOn() { return cfg.sound_enabled !== false; }
    function vol() { return (cfg.sfx_volume == null ? 50 : cfg.sfx_volume) / 100; }
    // ride the webui master SFX volume too, so its slider keeps working
    function masterVol() {
        if (typeof AudioManager !== "undefined" && typeof AudioManager.volume === "number") {
            return AudioManager.volume;
        }
        return 1;
    }

    /* asset packs: every map route (/loops, /sfx, /music, /stingers) answers
     * for the CURRENT chat's campaign pack, so the chat rides along on each
     * fetch and the AI can only ever hit assets game_start's asset_pack
     * holds. adventure_plus.js calls resetAssetMaps() the moment a campaign
     * switches sets; the generation counter makes any fetch that raced the
     * switch drop its stale map instead of caching it. */
    var mapGen = 0;
    function assetQ() {
        var chat = null;
        try { chat = Alpine.store("chat").selectedChat; } catch (e) {}
        return chat ? ("?chat=" + encodeURIComponent(chat)) : "";
    }

    /* typewriter liaison: synthesized cues push this end-time forward as
     * they schedule their tones, so a cue can hold the reveal for exactly
     * as long as the sound it just scheduled (window.AdvType) */
    var synthEndsAt = 0;
    function trackSynth(when, dur) {
        var end = Date.now() + (when + dur + 0.1) * 1000;
        if (end > synthEndsAt) synthEndsAt = end;
    }

    var audioCtx = null;
    function ctx() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                // witness every flip of the context's own state, including
                // the ones the OS performs without asking anybody: when a
                // system-driven re-wake lands it here, revive() puts every
                // element the interruption paused back on the air.
                audioCtx.addEventListener("statechange", function () { revive(audioCtx); });
            } catch (e) {}
        }
        return audioCtx;
    }

    /* autoplay policies (the mobile audio killer): a phone keeps a fresh
     * AudioContext SUSPENDED until a real gesture resumes it, and every
     * element routed through it - music, ambience beds, weather/sky beds,
     * stingers - is silent while it sleeps. the cruel part: a routed
     * element's play() still RESOLVES (the element is playing, feeding a
     * dead graph), so no rejection ever fires and no retry path ever runs.
     * the old one-shot wake was not enough - it armed only from a few call
     * sites and disarmed on the very next pointerdown, so a game_start
     * arriving over a websocket hours after the last tap started the whole
     * world inaudible until some unrelated click happened.
     *
     * AND ANDROID KEEPS DOING IT (2026-11 field report): the phone does
     * not suspend the context once at boot and then leave it alone - it
     * pulls a RUNNING context back under again and again after the first
     * unlock. every screen-off, every notification, every app grabbing
     * audio focus, every tab park ("suspended", on newer chromes also
     * "interrupted"). the old one-shot unlock retired its listeners the
     * first time the context ran, so after any later interruption the
     * world stayed silent: the reported "every tap gives a second of
     * audio, then nothing" is exactly that - a stray resume lands (a tap
     * blip through the AudioManager hook), the graph briefly wakes, the
     * OS yanks it back down, and NOTHING is left listening.
     *
     * so the wake is PERMANENT and state-driven now:
     * - the gesture listeners never retire; tryResume answers instantly
     *   on a running context and pokes resume() on anything else
     * - a statechange watcher (see ctx()) catches the OS's own flips
     *   both ways, so even an unasked-for re-wake gets acted on
     * - a slow watchdog covers the no-new-gesture case: once ANY tap
     *   happened this session, sticky activation lets resume() land
     *   from a timer too - the context resurfaces by itself in seconds
     * - every return to running re-plays the loops (the system can
     *   pause the routed <audio> ELEMENTS themselves, and a live graph
     *   fed by paused elements is still silence), and the first wake
     *   lights a whisper-quiet keepalive source so chromium's power
     *   logic has a reason to leave the pipeline alone. */
    var unlockArmed = false;
    var wokeOnce = false;
    var keepPulse = null;
    function armUnlock() {
        if (unlockArmed) return;
        unlockArmed = true;
        window.addEventListener("pointerdown", wakeFromGesture, true);
        window.addEventListener("keydown", wakeFromGesture, true);
        document.addEventListener("visibilitychange", tryResume);
        window.addEventListener("pageshow", tryResume);
        setInterval(tryResume, 3000);
    }
    /* the context is BORN inside a real gesture: any tap (or key) of the
     * session creates it and resumes it in the same activation. the old
     * lazy birth - the first cue hours later, from an async callback -
     * started the world suspended, and android chrome routinely ignores
     * resumes that never touch a gesture moment: hence the "I still have
     * to tap the screen once after starting the adventure" dance. With
     * this, the Send tap that STARTS the game already wakes the audio
     * world before game_start even reaches the browser. */
    function wakeFromGesture() {
        ctx();
        tryResume();
    }
    function tryResume() {
        var c = audioCtx;
        if (!c) return;
        if (c.state === "running") {
            // drain the wake queue here too: flushPending used to run ONCE
            // at first unlock, so cues that got autoplay-rejected during
            // any later interruption sat in the queue forever - the real
            // "{{sfx} macros often don't play". The watchdog and every
            // tap/visibility flip run through this line, so a stranded
            // cue sounds again within seconds. (No-op on an empty queue.)
            flushPending();
            return;
        }
        try {
            var p = c.resume();
            if (p && p.then) {
                p.then(function () { revive(c); }, function () {});
            } else {
                revive(c);
            }
        } catch (e) {}
    }
    /* called on every landing in the RUNNING state, whoever put it
     * there: the first one drains the autoplay queue and lights the
     * keepalive; every one of them re-seats any loop the interruption
     * paused at the element level. */
    function revive(c) {
        if (!c || c.state !== "running") return;
        if (!wokeOnce) {
            wokeOnce = true;
            flushPending();
            keepAlive(c);
        }
        // nothing else to re-seat: every long sound is a graph voice now,
        // and sources suspend AND resume with the context itself - the
        // element-era class of "the OS paused the loop behind my back"
        // simply no longer exists here.
    }
    // an inaudible steady source: chromium's power logic goes after
    // contexts with nothing rendering, and a live stream keeps the
    // android audio pipeline warm through screen-off blips. a 40 Hz
    // sine at a gain a hundredfold below audibility - the meters see
    // it, no ear ever will.
    function keepAlive(c) {
        if (keepPulse) return;
        try {
            var o = c.createOscillator();
            var g = c.createGain();
            o.type = "sine";
            o.frequency.value = 40;
            g.gain.value = 0.00001;
            o.connect(g); g.connect(c.destination);
            o.start();
            keepPulse = o;
        } catch (e) {}
    }
    function wake() {
        armUnlock();
        ctx();
        // the page may already carry sticky activation (android chrome
        // lets a resume through from async callbacks once ANY tap happened)
        tryResume();
    }
    /* loops must not start until the context is created AND running.
     * routing an <audio> into a SUSPENDED graph makes it play silently
     * forever: play() resolves, the element "plays", but the dead graph
     * renders nothing - this is why the soundtrack failed on game_start
     * and on every mid-game track switch (both run async, far from any
     * tap), while re-entering a game worked (the tap right before woke
     * the context). whenReady runs fn immediately on a running graph,
     * otherwise on the first 500ms tick where it is. */
    var waiters = [];
    var waiterTimer = 0;
    function whenReady(fn) {
        if (!audioCtx || audioCtx.state === "running") { fn(); return; }
        wake();
        waiters.push(fn);
        if (waiterTimer) return;
        waiterTimer = setInterval(function () {
            if (!audioCtx || audioCtx.state !== "running") return;
            clearInterval(waiterTimer);
            waiterTimer = 0;
            var q = waiters;
            waiters = [];
            q.forEach(function (f) { try { f(); } catch (e) {} });
        }, 500);
    }

    /* one-shot cues that got autoplay-rejected are NOT lost: they line up
     * in a small queue and play the moment the world wakes. deduped by url
     * and bounded, so a long silent stretch replays each sound once, not
     * as a burst. (loops need no queue: their play() resolved all along,
     * they simply start sounding through the graph as it resumes) */
    var pending = [];
    function queueCue(url, v) {
        for (var i = 0; i < pending.length; i++) {
            if (pending[i].url === url) return;
        }
        pending.push({ url: url, v: v });
        if (pending.length > 6) pending.shift();
    }
    function flushPending() {
        var q = pending;
        pending = [];
        q.forEach(function (it) {
            // ride the cue buffers on the graph when they decoded; the
            // bare element stays the last-ditch fallback only
            cueBuf(it.url, function (buf) {
                var c = liveCtx();
                if (buf && c) {
                    try {
                        var s = c.createBufferSource();
                        var g = c.createGain();
                        s.buffer = buf;
                        g.gain.value = it.v;
                        s.connect(g); g.connect(c.destination);
                        s.start();
                    } catch (e) {}
                    return;
                }
                try {
                    var el = new Audio(it.url);
                    el.volume = it.v;
                    var p = el.play();
                    if (p && p.catch) p.catch(function () {});
                } catch (e) {}
            });
        });
    }

    // a context that still sleeps answers null: scheduling tones into it
    // would stack them up to fire in a burst the instant it wakes. every
    // tone/noise call site already handles a null context.
    function liveCtx() {
        var c = ctx();
        if (!c) return null;
        if (c.state && c.state !== "running") { wake(); return null; }
        return c;
    }

    function tone(freq, dur, type, gain, when) {
        var c = liveCtx();
        if (!c) return;
        when = when || 0;
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = type || "sine";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, c.currentTime + when);
        g.gain.linearRampToValueAtTime(gain * vol(), c.currentTime + when + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
        o.connect(g); g.connect(c.destination);
        o.start(c.currentTime + when);
        o.stop(c.currentTime + when + dur + 0.05);
        trackSynth(when, dur + 0.05);
    }
    function noise(dur, gain, freq, when) {
        var c = liveCtx();
        if (!c) return;
        when = when || 0;
        var len = Math.max(1, Math.floor(c.sampleRate * dur));
        var buf = c.createBuffer(1, len, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = c.createBufferSource();
        src.buffer = buf;
        var f = c.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = freq;
        var g = c.createGain();
        g.gain.value = gain * vol();
        src.connect(f); f.connect(g); g.connect(c.destination);
        src.start(c.currentTime + when);
        trackSynth(when, dur);
    }

    /* -------------------------
     * shared lowpass chain (daydream-ducking, snow hush)
     * synths above stay OUTSIDE the chain on purpose: a sound cue should
     * cut through the muffle, only the ambient beds go soft with the world
     * ------------------------- */
    var chain = { master: null, lp: null, failed: false, target: 19000 };
    function ensureChain() {
        if (chain.master || chain.failed) return chain.master;
        var c = ctx();
        if (!c) { chain.failed = true; return null; }
        try {
            var lp = c.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 19000;
            var master = c.createGain();
            master.connect(lp);
            lp.connect(c.destination);
            chain.master = master;
            chain.lp = lp;
            chain.target = 19000;
        } catch (e) { chain.failed = true; }
        return chain.master;
    }
    // what every voice plugs into: the master chain when it exists, the
    // raw destination when the chain failed to build
    function chainBus() {
        var m = ensureChain();
        return m || ctx().destination;
    }

    /* -------------------------
     * buffer transport (2026-11 Android rewrite)
     * Long audio (soundtrack, ambience layers, bound beds, stingers) used
     * to be <audio> elements routed into the context with
     * createMediaElementSource. On Android that is a leak machine: chrome
     * hard-caps a process at TEN concurrent output audio streams and every
     * playback past the cap fails SILENTLY (audio_manager_base.cc
     * "Number of opened output audio streams 10 exceed the max allowed
     * number 10" -> AUDIO_RENDERER_ERROR; same mechanism documented in
     * open-webui#29969), and a MediaElementAudioSourceNode pins its
     * element for as long as the context runs (crbug 323694454), so every
     * track switch, weather change and scene restaging leaked another
     * stream until the whole tab went audio-dead. Routed elements also
     * sleep through suspensions and miss gestures - the "music silent on
     * game_start, fine on re-enter" dance.
     * The cues path (fetch -> decode -> AudioBufferSourceNode on the
     * shared, gesture-unlocked context) demonstrably works on phones, so
     * EVERYTHING rides it now: the page holds exactly ONE system stream
     * (the context itself), src.loop gives seamless loops, gain-node
     * automation gives sample-accurate crossfades, and stop() releases
     * the nodes for the collector. Memory is bounded by the loop cache
     * below (decoded PCM is heavy - 6 entries, oldest evicted).
     * ------------------------- */
    var longBufs = {};   // url -> decoded AudioBuffer (null while decoding)
    var longOrder = [];  // eviction order, newest last
    function loopBuf(url, cb) {
        var c = liveCtx();
        if (!c) { cb(null); return; }
        if (longBufs[url] !== undefined) { cb(longBufs[url]); return; }
        longBufs[url] = null;
        try {
            fetch(url).then(function (r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.arrayBuffer();
            }).then(function (ab) {
                return new Promise(function (res, rej) {
                    c.decodeAudioData(ab, res, rej);
                });
            }).then(function (buf) {
                longBufs[url] = buf;
                longOrder.push(url);
                if (longOrder.length > 6) {
                    var old = longOrder.shift();
                    if (old !== url && longBufs[old]) delete longBufs[old];
                }
                cb(buf);
            }, function () { longBufs[url] = null; cb(null); });
        } catch (e) { longBufs[url] = null; cb(null); }
    }
    // sample-accurate gain ramp (replaces the old setInterval volume
    // staircases on elements); done fires right after the ramp lands
    function fadeGain(g, target, ms, done) {
        try {
            var t = ctx().currentTime;
            g.gain.cancelScheduledValues(t);
            g.gain.setValueAtTime(g.gain.value, t);
            if (ms > 0) g.gain.linearRampToValueAtTime(target, t + ms / 1000);
            else g.gain.value = target;
        } catch (e) { try { g.gain.value = target; } catch (e2) {} }
        if (done) setTimeout(done, Math.max(0, ms || 0) + 30);
    }
    // a live looping voice on the shared graph
    function makeVoice(buf) {
        var c = ctx();
        var g = c.createGain();
        g.gain.value = 0;
        g.connect(chainBus());
        var s = c.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(g);
        s.start();
        return {
            gain: g,
            src: s,
            fade: function (target, ms, done) { fadeGain(g, target, ms, done); },
            // fade out (optional), then release the nodes entirely
            stop: function (ms) {
                if (ms > 0) fadeGain(g, 0, ms);
                setTimeout(function () { try { s.stop(); } catch (e) {} },
                    Math.max(0, ms || 0) + 40);
            }
        };
    }
    // the public door (window.AdvAudio.loop): waits for a running graph,
    // decodes (cached) and hands a ready-and-started voice to cb - or
    // null when the file cannot be fetched/decoded.
    function loop(url, cb) {
        whenReady(function () {
            loopBuf(url, function (buf) {
                if (!buf || !liveCtx()) { cb(null); return; }
                cb(makeVoice(buf));
            });
        });
    }
    // muffle targets: daydream drags the mix under water, snow
    // hushes it to a soft winter quiet, anything else flings it wide open
    function duck(c) {
        if (!chain.lp) return;
        var fx = (c && c.effects) || {};
        var has = function (n) { return Object.prototype.hasOwnProperty.call(fx, n); };
        var target = 19000;
        if (has("daydream")) target = 480;
        else if (c && c.weather === "snow") target = 1200;
        if (target === chain.target) return;
        chain.target = target;
        try { chain.lp.frequency.setTargetAtTime(target, ctx().currentTime, 0.5); } catch (e) {}
    }

    /* -------------------------
     * world-bound ambience beds (weather + sky)
     * the convention: drop a loop named weather_<kind>.ogg (or
     * sky_<kind>.ogg for a backdrop) into the ambience folder
     * (weather_rain, weather_storm, sky_stars..) and that kind gets its
     * own sound automatically - no code change. kinds without their own
     * file fall back to the curated lists below, tried in order against
     * the installed loop library. a bound bed never doubles a stem the
     * main ambience bed carries, and the sky bed never doubles the stem
     * the weather bed just claimed.
     * ------------------------- */
    var BEDS = {
        storm: ["rain", "wind"],
        blizzard: ["wind"],
        hail: ["rain"],
        bloodrain: ["rain"],
        whirlwind: ["wind"],
        sandstorm: ["wind"],
        moonrays: ["stars", "summer-night"],
        rain: ["rain"],
        snow: ["snow", "wind"],
        embers: ["embers", "fireplace"],
        cindersnow: ["embers", "fireplace"],
        heat: ["summer-night"],
        heatstroke: ["summer-night"],
        sunny: ["summer-night"],
        stars: ["stars", "summer-night"],
        starmotes: ["stars", "summer-night"],
        meteorshower: ["stars", "summer-night"],
        fallingstars: ["stars", "summer-night"],
        petals: ["petals", "summer-night"],
        glitter: ["glitter", "summer-night"]
    };
    /* curated fallbacks for the SKY bed: what a backdrop listens like when
       the pack ships no sky_<kind> loop. the weather list above stays as it
       was (a third-party set may still name a weather after one of these),
       so kinds that moved to skies/ keep their sounds. */
    var SKYBEDS = {
        rainhaze: ["rain"],
        thunderhead: ["rain", "wind"],
        snowglow: ["snow", "wind"],
        whiteout: ["wind"],
        coldfront: ["rain"],
        desert: ["wind"],
        sandwall: ["wind"],
        cloudy: ["wind"],
        fog: ["wind"],
        sunny: ["summer-night"],
        heat: ["summer-night"],
        heatstroke: ["summer-night"],
        stars: ["stars", "summer-night"],
        moonrays: ["stars", "summer-night"],
        starmotes: ["stars", "summer-night"],
        meteorshower: ["stars", "summer-night"],
        fallingstars: ["stars", "summer-night"],
        underwater: ["underwater"]
    };
    var loopUrls = null;
    function resolveLoop(track, cb) {
        if (loopUrls && loopUrls[track] !== undefined) { cb(loopUrls[track]); return; }
        loopUrls = null;
        var gen = mapGen;
        simpleApiFetch("/api/ext/adventure_games/loops" + assetQ())
            .then(function (data) {
                if (gen !== mapGen) { cb(""); return; }   // raced a set switch
                loopUrls = (data && data.loops) || {};
                cb(loopUrls[track] || "");
            })
            .catch(function () { cb(""); });
    }
    /* one bound bed: a single loop that follows one kind of the world.
       makeBed builds the two twins - the weather bed ("weather_" prefix,
       BEDS fallbacks) and the sky bed ("sky_" prefix, SKYBEDS) - each with
       its own element and track token. */
    function makeBed(prefix, curated) {
        var bed = { voice: null, track: "__unset__" };
        function candidates(kind) {
            var cands = [prefix + kind];
            (curated[kind] || []).forEach(function (c) {
                if (cands.indexOf(c) === -1) cands.push(c);
            });
            return cands;
        }
        /* walk the kind's candidate list (prefixed stem first) until a stem
           with an actually-installed loop turns up; async only while the
           loop library is unknown or a candidate must be probed. `wanted`
           is the stem set() picked - the token the probe checks on every
           hop */
        function start(wanted, cands, ci) {
            if (bed.track !== wanted) return;                 // kind switched again
            if (ci >= cands.length) { bed.track = ""; return; } // nothing installed
            resolveLoop(cands[ci], function (url) {
                if (bed.track !== wanted) return;             // switched while fetching
                if (!url) { start(wanted, cands, ci + 1); return; } // not installed
                play(wanted, url);
            });
        }
        function play(want, url) {
            var v = Math.max(0.05, Math.min(0.9,
                ((cfg.ambience_volume == null ? 35 : cfg.ambience_volume) / 100) * 0.8)) * 0.55;
            // loop() carries the when-ready wait and the decode itself;
            // the older bed keeps playing until this voice actually exists
            loop(url, function (voice) {
                // kind switched or muted while resolving, or decode failed
                if (!voice || bed.track !== want) { if (voice) voice.stop(0); return; }
                var old = bed.voice;
                bed.voice = voice;
                voice.fade(v, 800);
                if (old) old.stop(900);
            });
        }
        function set(kind, avoid) {
            var want = "";
            if (sfxOn() && kind) {
                var cands = candidates(kind);
                for (var i = 0; i < cands.length; i++) {
                    if (avoid.indexOf(cands[i]) === -1) { want = cands[i]; break; }
                }
            }
            if (want === bed.track) return;
            bed.track = want;
            if (!want) {
                if (bed.voice) { bed.voice.stop(900); bed.voice = null; }
                return;
            }
            start(want, candidates(kind), 0);
        }
        return { set: set, bed: bed };
    }
    var weatherBedX = makeBed("weather_", BEDS);
    var skyBedX = makeBed("sky_", SKYBEDS);
    // the ambience bed is a layered spec ("rain:70,wind") - strip the
    // volumes; a bound bed never doubles a stem it already carries
    function bedAvoid(c) {
        return String((c && c.ambience) || "").split(",").map(function (part) {
            return part.split(":")[0].trim();
        });
    }
    function weatherBed(c) {
        weatherBedX.set((c && c.weather) || "", bedAvoid(c));
    }
    function skyBed(c) {
        var avoid = bedAvoid(c);
        // ...and the sky bed never doubles the stem the weather bed claimed
        if (weatherBedX.bed.track) avoid.push(weatherBedX.bed.track);
        skyBedX.set((c && c.sky) || "", avoid);
    }

    /* -------------------------
     * music soundtrack (webui/assets/music/, seamless loops, crossfade)
     * rides over ambience and the weather bed, through the same lowpass
     * chain so daydream muffles the whole world equally. changing
     * tracks crossfades old -> music_crossfade ms; "off" fades to silence.
     * ------------------------- */
    var music = { voice: null, track: "__unset__" };
    var MUSIC_FADE = 2500;
    var musicUrls = null;
    function resolveMusic(track, cb) {
        if (musicUrls && musicUrls[track] !== undefined) { cb(musicUrls[track]); return; }
        musicUrls = null;
        var gen = mapGen;
        simpleApiFetch("/api/ext/adventure_games/music" + assetQ())
            .then(function (data) {
                if (gen !== mapGen) { cb(""); return; }   // raced a set switch
                musicUrls = (data && data.music) || {};
                cb(musicUrls[track] || "");
            })
            .catch(function () { cb(""); });
    }
    function musicTarget() {
        return Math.max(0.05, Math.min(0.9, ((cfg.music_volume == null ? 40 : cfg.music_volume) / 100) * 0.85));
    }
    function setMusic(c) {
        var want = sfxOn() && c && c.music ? String(c.music) : "";
        if (want === music.track) return;
        music.track = want;
        if (!want) {
            var dying = music.voice;
            music.voice = null;
            if (dying) dying.stop(MUSIC_FADE);
            return;
        }
        resolveMusic(want, function (url) {
            if (music.track !== want) return;      // switched while fetching
            if (!url) return;                       // track file not installed
            // loop() carries the when-ready wait and the decode (cached,
            // so a return to a just-played track crossfades instantly);
            // the old track only lets go once the new voice truly plays
            loop(url, function (voice) {
                if (!voice || music.track !== want) { if (voice) voice.stop(0); return; }
                var old = music.voice;
                music.voice = voice;
                voice.fade(musicTarget(), MUSIC_FADE);
                if (old) old.stop(MUSIC_FADE);
            });
        });
    }

    /* -------------------------
     * sound cue library (files override synths)
     * ------------------------- */
    var cueUrls = null;
    var buiUrls = null;
    var cueWaiters = null;
    function cueUrl(name, cb) {
        var read = function () { return (cueUrls && cueUrls[name]) || (buiUrls && buiUrls[name]) || ""; };
        if (cueUrls && buiUrls) { cb(read()); return; }
        // one in-flight load: everything asked during it waits on the same
        // response (typing sounds file-check per token - without this the
        // first instants of a passage would fire a fetch per keystrike)
        // each waiter is wrapped in its own closure so it resolves with
        // its OWN cue name, not the name that happened to start the load
        var mine = function () { cb(read()); };
        if (cueWaiters) { cueWaiters.push(mine); return; }
        cueWaiters = [mine];
        function settled() {
            var waiting = cueWaiters || [];
            cueWaiters = null;
            waiting.forEach(function (f) { f(); });
        }
        function map(url) {
            try {
                return Promise.resolve(simpleApiFetch(url))
                    .then(function (d) { return (d && d.sfx) || {}; })
                    .catch(function () { return {}; });
            } catch (e) { return Promise.resolve({}); }
        }
        // two shelves: the player's sfx/ library first, then the built-in
        // stamp sounds from sfx_builtin/ (event stamps resolve their files
        // here; {{sfx}} macros never SEE the second shelf - cueUser()
        // blocks those names long before this lookup). Both shelves are
        // the campaign pack's: the backend already merged the pack's stamp
        // overrides over the default pack's sfx_builtin/ base.
        var gen = mapGen;
        Promise.all([
            map("/api/ext/adventure_games/sfx" + assetQ()),
            map("/api/ext/adventure_games/sfx_builtin" + assetQ())
        ]).then(function (maps) {
            // a raced switch: stay uncached and let the next lookup refetch
            if (gen === mapGen) {
                cueUrls = maps[0];
                buiUrls = maps[1];
            }
            settled();
        });
    }
    var cueSynth = {
        // the coin's bright double ping, the quest's four-note fanfare,
        // the stage-advance tick, the item blip, the curse zap, the
        // cleanse shimmer, and the crit/fumble bookends
        coin_flip: function () { tone(1568, 0.1, "sine", 0.09); tone(2093, 0.55, "sine", 0.07, 0.05); tone(2637, 0.45, "sine", 0.045, 0.09); },
        quest: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.55, "sine", 0.09, i * 0.1); }); },
        // the sub-goal check-off: a pen-tick of noise followed by a two-note
        // rising plink - a little "done!" that always fits under the full
        // quest fanfare (which stays in C: 523/659/784/1046)
        stage: function () { noise(0.02, 0.15, 3200); tone(783.99, 0.08, "triangle", 0.05, 0.02); tone(1174.66, 0.18, "triangle", 0.06, 0.09); },
        pickup: function () { tone(880, 0.09, "sine", 0.08); tone(1318.5, 0.14, "sine", 0.07, 0.06); },
        status: function () { tone(196, 0.22, "sawtooth", 0.06); noise(0.16, 0.1, 700); tone(147, 0.3, "sawtooth", 0.05, 0.08); },
        cleanse: function () { tone(1046.5, 0.4, "sine", 0.07); tone(1568, 0.5, "sine", 0.05, 0.12); noise(0.25, 0.05, 5200, 0.05); },
        crit: function () { [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { tone(f, 0.5, "triangle", 0.07, i * 0.06); }); },
        fumble: function () { tone(138, 0.4, "sawtooth", 0.1); tone(110, 0.5, "sawtooth", 0.09, 0.12); noise(0.3, 0.12, 300); },
        // arriving somewhere new (set_scene with a fresh location): a
        // soft air whoosh settling into a rising open fifth. Any
        // scene_change.* file in sfx_builtin/ replaces it wholesale.
        scene_change: function () { noise(0.4, 0.05, 900); tone(392, 0.35, "sine", 0.06); tone(587.33, 0.45, "sine", 0.05, 0.14); },
        // (image_insertion has NO synth fallback on purpose: the picture
        // arrival is silent unless a real image_insertion.<audio> file is
        // installed in sfx/ or the pack's sfx_builtin/ shelf)
        // nightfall: rings with the day-rollover sleep curtain (the beats
        // watcher fires it, never a macro) - a soft blanket of low noise and
        // a descending triad settling down, eyes closing. a set's
        // sfx_builtin/sleep.<audio> replaces this fallback wholesale.
        sleep: function () { noise(0.7, 0.03, 500); tone(523.25, 0.45, "sine", 0.05); tone(392, 0.55, "sine", 0.05, 0.16); tone(261.63, 0.9, "sine", 0.055, 0.32); },
        // dawn: rings when the clock crosses morning o'clock - two high
        // birdsong chirps over a rising open chord, light spreading.
        // a set's sfx_builtin/morning.<audio> replaces this fallback.
        morning: function () { tone(1318.5, 0.12, "sine", 0.045); tone(1568, 0.14, "sine", 0.045, 0.16); tone(523.25, 0.7, "triangle", 0.05, 0.34); tone(659.25, 0.7, "triangle", 0.045, 0.42); tone(783.99, 0.95, "triangle", 0.04, 0.5); }
    };
    /* fire-once guard, keyed by the story turn's DOM node. token
     * streaming re-parses the WHOLE growing passage on every update, so
     * a time-window dedupe loops: the window expires mid-passage and the
     * same macro fires again (and again). Re-parses always hit the same
     * turn node - a name plays at most ONCE per passage, guaranteed -
     * while the next passage gets a fresh node and plays freely. */
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
    /* every cue prefers real files over synths: the /sfx library is keyed
     * by file STEM, so any extension works (mp3, wav, ogg, ...) - the
     * backend maps each name to the first file it finds for it. */
    /* hold: story cues ({{sfx}} reveal-scan, event stamps) pause the
     * typewriter until the sound has played out. Interface sounds
     * (fileFirst) never hold: a choice chime should not stall the next
     * passage. */
    var playSeq = 0;
    /* THE ANDROID FIX for "{{sfx} macros often don't play": a bare <audio>
     * element re-asks the autoplay gate at EVERY call, and android hands
     * an app only a limited number of system audio streams - with the
     * world's beds all playing (music + ambience layers + bound beds,
     * uncapped since 2026-11), plain cue elements routinely got a silent
     * rejection. A decoded buffer played through the SHARED, gesture-
     * unlocked context sidesteps both problems entirely: no per-element
     * gate, no extra system stream, and the exact duration is known up
     * front, so the typewriter hold lands precise instead of estimated.
     * The bare element path survives as the fallback for the first play
     * of a not-yet-decoded cue (and while the context sleeps). */
    var cueBufs = {};    // url -> AudioBuffer (null while decoding)
    var cueOrder = [];   // cache eviction order, newest last
    function cueBuf(url, cb) {
        var c = liveCtx();
        if (!c) { cb(null); return; }
        if (cueBufs[url] !== undefined) { cb(cueBufs[url]); return; }
        cueBufs[url] = null;                      // a decode is in flight
        try {
            fetch(url).then(function (r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.arrayBuffer();
            }).then(function (ab) {
                return new Promise(function (res, rej) {
                    c.decodeAudioData(ab, res, rej);
                });
            }).then(function (buf) {
                cueBufs[url] = buf;
                cueOrder.push(url);
                if (cueOrder.length > 24) {
                    var old = cueOrder.shift();
                    if (cueBufs[old] && old !== url) delete cueBufs[old];
                }
                cb(buf);
            }, function () { cueBufs[url] = null; cb(null); });
        } catch (e) { cueBufs[url] = null; cb(null); }
    }
    function playFile(url, hold, scale) {
        var v = vol() * 0.9 * masterVol() * (scale == null ? 1 : scale);
        if (v <= 0) return;   // a zero-scale cue (typing_volume at 0) stays silent
        var target = Math.max(0.05, Math.min(1, v));
        cueBuf(url, function (buf) {
            var c = liveCtx();
            if (buf && c) {
                // cues stay OUTSIDE the lowpass chain (same as the synths):
                // a sound cue should cut through the daydream muffle
                var src = c.createBufferSource();
                var g = c.createGain();
                src.buffer = buf;
                g.gain.value = target;
                src.connect(g);
                g.connect(c.destination);
                if (hold && window.AdvType) {
                    var key = "sfx:file" + (++playSeq);
                    window.AdvType.hold(key, Math.min(15000, buf.duration * 1000 + 120));
                    src.addEventListener("ended", function () {
                        if (window.AdvType) window.AdvType.release(key);
                    });
                }
                src.start();
                return;
            }
            playFileEl(url, target, hold);
        });
    }
    function playFileEl(url, target, hold) {
        var el = new Audio(url);
        el.volume = target;
        var key = "";
        if (hold && window.AdvType) {
            var t0 = Date.now();
            key = "sfx:file" + (++playSeq);
            window.AdvType.hold(key, 2600);
            el.addEventListener("loadedmetadata", function () {
                if (!window.AdvType || !isFinite(el.duration) || el.duration <= 0) return;
                var left = el.duration * 1000 - (Date.now() - t0) + 120;
                window.AdvType.hold(key, Math.min(15000, Math.max(0, left)));
            });
            el.addEventListener("ended", function () {
                if (window.AdvType) window.AdvType.release(key);
            });
            el.addEventListener("error", function () {
                if (window.AdvType) window.AdvType.release(key);
            });
        }
        var p = el.play();
        if (p && p.catch) p.catch(function () {
            // autoplay blocked: the cue is not thrown away - it waits in
            // the wake queue (drained on the next wake OR by the running
            // watchdog above) and sounds the moment the world is audible
            wake();
            queueCue(url, el.volume);
            if (key && window.AdvType) window.AdvType.release(key);
        });
    }
    function cue(name, silent, forced) {
        name = String(name || "").trim().toLowerCase();
        if (!name) return;
        // forced = already replay-proof callers (backend event stamps,
        // the typewriter's reveal scan): they bypass the passage guard
        if (!forced && !onceThisTurn("sfx:" + name)) return;
        if (silent || !sfxOn()) return;
        var synth = function () {
            if (!cueSynth[name]) return;
            wake();
            synthEndsAt = Date.now();
            cueSynth[name]();
            // the scheduled tones pushed synthEndsAt as they were laid out:
            // hold the reveal for exactly that tail
            if (window.AdvType) window.AdvType.hold("sfx:" + name, synthEndsAt - Date.now());
        };
        cueUrl(name, function (url) {
            if (url) { playFile(url, true); return; }
            synth();
        });
    }
    /* the {{sfx}} macro's door in: everything the PLAYER dropped in the
       sfx/ library, and NOTHING else. built-in stamp sounds are the
       interface's own vocabulary (backend event stamps, dice juice) -
       blocked by name even if a same-named file lands in sfx/, so an AI
       can never chime a quest or ping a coin by accident. mirrors
       module.py's BUILTIN_SFX. */
    var BUILTIN_CUES = { coin_flip: 1, dice_roll: 1, quest: 1, stage: 1, pickup: 1, status: 1, cleanse: 1, crit: 1, fumble: 1,
        chime: 1, stat_up: 1, stat_down: 1, thump: 1,
        send: 1, reply_start: 1, complete: 1, reasoning: 1,
        token: 1, type_key: 1, quill: 1, image_insertion: 1,
        typing_loop: 1, thinking_loop: 1, scene_change: 1, sleep: 1, morning: 1 };
    function cueUser(name) {
        name = String(name || "").trim().toLowerCase();
        if (!name || BUILTIN_CUES[name]) return;
        cue(name, false, true);
    }
    /* the UI volume chain (world sound volume x webui master SFX)
     * exposed, so floating elements like the typewriter bed can ride the
     * same sliders as the cues. Multiply by your own scale - same meaning
     * as fileFirst's scale (the per-key ticks use typingVol at 0.9). */
    function uiVolume(scale) {
        return Math.max(0, Math.min(1, vol() * masterVol() * (scale == null ? 1 : scale)));
    }
    /* fileFirst: a hardcoded interface sound that wants a file check.
     * Plays the installed file of that cue name (ANY extension) if there
     * is one, otherwise runs the given synth fallback. No per-passage
     * guard - these are event-driven interface sounds, not streamed
     * macros, and the events themselves fire once. */
    function fileFirst(name, fallback, scale) {
        name = String(name || "").trim().toLowerCase();
        if (!name || !sfxOn()) return;
        cueUrl(name, function (url) {
            if (url) { playFile(url, false, scale); return; }
            if (fallback) { wake(); fallback(); }
        });
    }

    /* automatic event signatures: the backend stamps campaign.sfx_event
       on tool results (coin_flip, quest, stage, pickup, status, cleanse); the
       counter lets the same sound replay back-to-back. event(ev, fresh)
       runs on every heartbeat: a FRESH campaign sighting (page load or a
       new game_start) only arms on the current stamp, so old stamps never
       replay - and the next live stamp plays even when it is the very
       first one of the campaign. */
    var armed = false, lastN = null;
    function event(ev, fresh) {
        var has = !!(ev && typeof ev.n === "number");
        if (fresh) { armed = true; lastN = has ? ev.n : null; return; }
        if (!armed) return;
        if (has && ev.n !== lastN) { lastN = ev.n; cue(ev.name, false, true); }
    }

    /* -------------------------
     * stingers (webui/assets/stingers/)
     * the tool-only big siblings of the plain sound effects: longer,
     * musical one-shots scoring a cue moment (a reveal, a level-up, a death).
     * No {{stinger}} macro exists by design - play_stinger is the only
     * door in. While one plays, the soundtrack fades out and pauses; when
     * the stinger ends the track resumes (held position) and fades back
     * in. The stinger itself rides the same lowpass chain as the music,
     * so it belongs to the world it interrupts.
     * ------------------------- */
    var STING_FADE_OUT = 350, STING_FADE_IN = 900;
    var stinger = { src: null, name: "" };
    var stingerUrls = null;
    /* beat handshake: play_stinger holds its tool call until the browser
       reports the stinger played out (kind "stinger") - fire-and-forget
       report, same shape as the scene cards in adventure_beats.js */
    function ack(kind) {
        try {
            var chat = Alpine.store("chat").selectedChat;
            if (!chat) return;
            var p = simpleApiPost("/api/ext/adventure_games/anim_done",
                { chat: chat, kind: kind });
            if (p && p.catch) p.catch(function () {});
        } catch (e) {}
    }
    /* the AI's line about what the sound is scoring, held on screen for
       exactly the stinger's duration: fade in on the first frame, fade
       out when the music moment passes */
    function showCaption(text) {
        hideCaption(true);
        if (!text) return;
        var el = document.createElement("div");
        el.id = "adv-stinger-caption";
        el.textContent = String(text);
        document.body.appendChild(el);
        if (window.AdvBounds) window.AdvBounds.fit(el, window.AdvBounds.box());
        requestAnimationFrame(function () { el.classList.add("adv-stinger-show"); });
    }
    function hideCaption(now) {
        var el = document.getElementById("adv-stinger-caption");
        if (!el) return;
        el.classList.remove("adv-stinger-show");
        setTimeout(function () { try { el.remove(); } catch (e) {} }, now ? 0 : 900);
    }
    function resolveStinger(name, cb) {
        if (stingerUrls && stingerUrls[name] !== undefined) { cb(stingerUrls[name] || ""); return; }
        stingerUrls = null;
        var gen = mapGen;
        simpleApiFetch("/api/ext/adventure_games/stingers" + assetQ())
            .then(function (data) {
                if (gen !== mapGen) { cb(""); return; }   // raced a set switch
                stingerUrls = (data && data.stingers) || {};
                cb(stingerUrls[name] || "");
            })
            .catch(function () { cb(""); });
    }
    function playStinger(name, desc) {
        name = String(name || "").trim().toLowerCase();
        if (!name || !sfxOn()) { ack("stinger"); return; }  // nothing will play:
        //                                                   free the held call
        resolveStinger(name, function (url) {
            if (!url) { ack("stinger"); return; }           // file not installed
            var started = false;
            var fail = function () {
                if (started) return;
                started = true;
                // nothing will sound (and its end is unknowable) - the
                // held tool call goes free right now
                wake();
                if (window.AdvType) window.AdvType.release("stinger");
                hideCaption(true);
                ack("stinger");
            };
            // a stinger whose audio world never wakes must not hold the GM
            // hostage: fifteen seconds, then the call goes free regardless
            var bail = setTimeout(fail, 15000);
            whenReady(function () {
                loopBuf(url, function (buf) {
                    var c = liveCtx();
                    if (!buf || !c) { clearTimeout(bail); fail(); return; }
                    clearTimeout(bail);
                    // a fresh fire cuts any stinger still mid-flight; its
                    // ended is dropped by the identity check in finish, so
                    // no stale ack leaks - the live wait belongs to the NEW
                    // stinger
                    if (stinger.src) { try { stinger.src.stop(); } catch (e) {} }
                    var g = c.createGain();
                    g.gain.value = Math.max(0.05, Math.min(1, vol() * 0.9 * masterVol()));
                    g.connect(chainBus());   // the true cue moment rides the
                    // same lowpass chain as the music it interrupts
                    var s = c.createBufferSource();
                    s.buffer = buf;
                    s.connect(g);
                    stinger.src = s;
                    stinger.name = name;
                    started = true;
                    showCaption(desc);
                    // the musical cue moment outranks the prose: the
                    // typewriter waits for the whole stinger, and the
                    // buffer knows its exact length up front
                    if (window.AdvType)
                        window.AdvType.hold("stinger", Math.min(30000, buf.duration * 1000 + 900));
                    var finish = function () {
                        if (stinger.src !== s) return;  // a newer stinger took over
                        stinger.src = null;
                        if (window.AdvType) window.AdvType.release("stinger");
                        hideCaption(false);
                        var m = music.voice;
                        if (m) fadeGain(m.gain, musicTarget(), STING_FADE_IN);
                        ack("stinger");                 // releases the held tool call
                    };
                    s.addEventListener("ended", finish);
                    // the soundtrack bows out for the cue moment: faded to
                    // silence but left running quietly (a looping buffer
                    // voice has no pause - it simply keeps spinning behind
                    // the mute and swells back in from wherever it got to)
                    if (music.voice) fadeGain(music.voice.gain, 0, STING_FADE_OUT);
                    s.start();
                });
            });
        });
    }
    /* backend stinger stamps (campaign.stinger_event) ride the same
       fresh-arm/counter pattern as the sfx events above */
    var stingArmed = false, stingLastN = null;
    function stingerEvent(ev, fresh) {
        var has = !!(ev && typeof ev.n === "number");
        if (fresh) { stingArmed = true; stingLastN = has ? ev.n : null; return; }
        if (!stingArmed) return;
        if (has && ev.n !== stingLastN) {
            stingLastN = ev.n;
            // playStinger acks on every path (played, sound off, file
            // missing, autoplay blocked) so the held call always frees
            playStinger(ev.name, ev.desc);
        }
    }

    /* asset-pack switch: drop every cached stem->map (a fetch already in
       flight sees the generation bump and drops its stale answer instead
       of caching it) and twist the music / weather-bed / sky-bed track
       sentinels, so
       the next heartbeat re-resolves AND restarts whatever the world should
       be playing, from the new set's folders. sfx_builtin is per-set now
       (a set can override the stamp sounds), so its map resets too; the
       live campaign is re-applied by the caller. */
    function resetAssetMaps() {
        mapGen++;
        loopUrls = null;
        musicUrls = null;
        cueUrls = null;
        buiUrls = null;
        stingerUrls = null;
        music.track = "__unset__";
        weatherBedX.bed.track = "__unset__";
        skyBedX.bed.track = "__unset__";
    }

    // boot: arm the gesture unlock with the page itself. no context is
    // created here (a tap-free page pays nothing); the first tap or
    // send-key of the session BIRTHS and wakes it inside real user
    // activation (wakeFromGesture) - long before any game_start needs
    // it, which is exactly what stops the "tap once after starting the
    // adventure" ritual: the very tap that sends /start is a wake tap.
    armUnlock();

    window.AdvAudio = {
        // the buffer transport (see "buffer transport" above): loop(url,
        // cb) hands back a started, chain-routed looping voice with
        // .fade(target, ms) / .stop(fadeMs) - everything long-running in
        // the adventure plays through this, never through an <audio>
        loop: loop,
        duck: duck,
        weatherBed: weatherBed,
        skyBed: skyBed,
        music: setMusic,
        cue: cue,
        cueUser: cueUser,
        event: event,
        stingerEvent: stingerEvent,
        fileFirst: fileFirst,
        uiVolume: uiVolume,
        resetAssetMaps: resetAssetMaps,
        wake: wake,
        // the module's ONE shared context: phones cap how many contexts a
        // page may hold and each fresh one needs a gesture unlock of its
        // own, so every synth in every adventure script rides this one.
        // answers null while the context still sleeps (caller skips the
        // sound - better a silent key than a tone burst on wake).
        sharedCtx: liveCtx
    };
})();
