/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-08) harness:openlumara
   adventure_games: passage view, Twine wiki-link choices, stats sidebar,
   dice popups, delta chips, journal and rewind. */
(function () {
    var cfg = window.ADV_CONFIG || {};

    /* {{img|name}} scene-art. The /images route maps each stem to its
       served URL (any format), cached here so the marked renderer can resolve
       it synchronously. Boot + periodic rescan pick up new drops; anything
       rendered before the map is loaded gets patched in by advFillImgs (run
       on every messages mutation), so a picture never stays blank. */
    var ADV_IMG_URLS = {};
    var imgFetching = false;
    var imgGen = 0;
    function advFillImgs() {
        var box = document.getElementById("messages");
        if (!box) return;
        var imgs = box.querySelectorAll("img.adv-img[data-img]");
        for (var i = 0; i < imgs.length; i++) {
            var el = imgs[i];
            if (el.getAttribute("src")) continue;
            var src = ADV_IMG_URLS[String(el.getAttribute("data-img") || "").toLowerCase()] || "";
            if (!src) continue;
            el.setAttribute("src", src);
            var cap = el.parentNode && el.parentNode.querySelector(".adv-img-pending");
            if (cap) cap.remove();
            advRevealImg(el);
        }
    }
    // asset packs: the /images route answers for the CURRENT chat's campaign
    // pack, so the chat rides along on every fetch and a {{img}} can only
    // ever resolve to a picture of the pack game_start chose.
    // adventure_plus.js calls advResetImgMap the moment a campaign switches
    // sets; the generation counter makes a response that raced the reset
    // drop its stale map instead of caching it.
    function advAssetQ() {
        var chat = null;
        try { chat = Alpine.store("chat").selectedChat; } catch (e) {}
        return chat ? ("?chat=" + encodeURIComponent(chat)) : "";
    }
    function advLoadImgMap() {
        if (imgFetching) return;
        // simpleApiFetch is a core global that may not exist this early
        // (classic scripts run at parse time) - retry until it shows up.
        if (typeof simpleApiFetch !== "function") { setTimeout(advLoadImgMap, 300); return; }
        imgFetching = true;
        var gen = imgGen;
        simpleApiFetch("/api/ext/adventure_games/images" + advAssetQ())
            .then(function (d) {
                imgFetching = false;
                if (gen !== imgGen) { advLoadImgMap(); return; }   // raced a set switch
                ADV_IMG_URLS = (d && d.images) || {};
                advFillImgs();
            })
            .catch(function () { imgFetching = false; });
    }
    window.advResetImgMap = function () {
        imgGen++;
        ADV_IMG_URLS = {};
        if (!imgFetching) advLoadImgMap();
    };
    window.advImgSrc = function (name) {
        return ADV_IMG_URLS[String(name || "").trim().toLowerCase()] || "";
    };
    window.advFillImgs = advFillImgs;
    advLoadImgMap();
    // only chats that actually run a campaign keep rescanning the art map
    // (fresh asset drops); game-less chats stay completely silent. the
    // moment a campaign APPEARS, refresh() pulls the map immediately.
    setInterval(function () {
        var st = null;
        try { st = Alpine.store("adv"); } catch (e) {}
        if (st && st.campaign) { advLoadImgMap(); advLoadSfxMap(); }
    }, 30000);

    /* {{sfx|name}} existence check. The /sfx route maps each cue stem the
       campaign's set carries to its served file - exactly the shelf a
       {{sfx}} macro can play (the built-in stamps on the second shelf are
       all on cueUser's blocklist), so a macro naming a sound that is not
       in it describes silence and the whole chip hides. Same shape as the
       art map: boot + periodic rescan; while the first fetch is in flight
       advSfxKnown answers true (nothing is provably missing yet) and the
       chip wears a data-sfx attr, so advPruneSfx - run on every map
       arrival and with plus.js's debounced style pass - sweeps the chips
       that rendered before the map landed. */
    var ADV_SFX_NAMES = {};
    var sfxMapReady = false;
    var sfxFetching = false;
    var sfxGen = 0;
    function advPruneSfx() {
        if (!sfxMapReady) return;
        var box = document.getElementById("messages");
        if (!box) return;
        var els = box.querySelectorAll(".adv-macro-sfx[data-sfx]");
        for (var i = 0; i < els.length; i++) {
            if (!ADV_SFX_NAMES[String(els[i].getAttribute("data-sfx") || "").toLowerCase()])
                els[i].remove();
        }
    }
    function advLoadSfxMap() {
        if (sfxFetching) return;
        if (typeof simpleApiFetch !== "function") { setTimeout(advLoadSfxMap, 300); return; }
        sfxFetching = true;
        var gen = sfxGen;
        simpleApiFetch("/api/ext/adventure_games/sfx" + advAssetQ())
            .then(function (d) {
                sfxFetching = false;
                if (gen !== sfxGen) { advLoadSfxMap(); return; }   // raced a set switch
                ADV_SFX_NAMES = (d && d.sfx) || {};
                sfxMapReady = true;
                advPruneSfx();
            })
            .catch(function () { sfxFetching = false; });
    }
    window.advResetSfxMap = function () {
        sfxGen++;
        sfxMapReady = false;
        ADV_SFX_NAMES = {};
        if (!sfxFetching) advLoadSfxMap();
    };
    window.advSfxKnown = function (name) {
        if (!sfxMapReady) return true;   // map in flight: render, prune later
        return !!ADV_SFX_NAMES[String(name || "").trim().toLowerCase()];
    };
    window.advPruneSfx = advPruneSfx;
    advLoadSfxMap();

    /* scene-art arrival ceremony: when a picture lands in a LIVE passage
       at the reveal cursor it unrolls top-to-bottom - the .adv-img-wrap
       frame grows from zero while image_insertion sounds, a soft mask band
       rides the reveal edge, and the typewriter holds its breath until the
       wipe lands. Reloads, chat switches and journal views paint flat:
       only the story's first delivery gets the ceremony. Streaming
       re-renders recreate every macro node, so per-image state lives in
       this per-turn key->state table, NOT on the element: the ticker
       re-finds the picture's nodes by turn+key every frame and repaints
       the fresh ones, so the curtain never visibly restarts. The key is
       stem + "#" + occurrence (stem: data-img, else the url's filename -
       stable from pending to resolved; occurrence: the n-th same-stem
       picture of the passage, claimed by the arrival queue below). */
    var ADV_DECODE_MS = 4000;
    /* the unroll no longer runs on a fixed clock: the reveal edge travels
       at the story's OWN tempo. the typewriter's cps becomes a pixel rate
       (ADV_WIPE_PPC pixels per character typed), so a taller picture takes
       proportionally longer than a short banner and a brisk GM unrolls
       briskly - and the edge moves at a CONSTANT speed (linear, like the
       typing itself; no ease-out ramp). ADV_WIPE_MS only survives as the
       fallback for when no height is known. ADV_WIPE_MAX only catches
       pathological cases - it MUST stay above the slowest legal typewriter
       speed's own worst case (cps 20 at PPC 6 = 768px in 6.4s, huge
       pictures beyond), or the cap silently swallows the scaling and the
       PPC knob reads as dead (the 6000 cap ate every Rosie test at cps
       30). Also provisions the typewriter hold, which is armed before the
       height is known and released early on done. */
    var ADV_WIPE_MS = 2000;
    var ADV_WIPE_MAX = 12000;
    var ADV_WIPE_PPC = 6;
    function advWipeMs(natPx) {
        var cps = parseFloat(cfg && cfg.typewriter_speed);
        if (!isFinite(cps) || cps <= 0) cps = 150;
        var ms = ((natPx || 0) / (cps * ADV_WIPE_PPC)) * 1000;
        if (!isFinite(ms) || ms <= 0) return ADV_WIPE_MS;
        // phones hold the unroll to a shorter ceiling (6s / 4s low-power)
        var ceiling = window.AdvPerf ? AdvPerf.wipeMax(ADV_WIPE_MAX) : ADV_WIPE_MAX;
        return Math.max(700, Math.min(ceiling, ms));
    }
    /* the wipe's soft edge (v16): a mask band on the FRAME, never on the
       img element (masking the img was v12's failure - it painted the
       whole picture visible). the mask is sized to the holder's current
       box, so one constant gradient string keeps the transparent band
       exactly at the reveal edge as the frame grows. when the frame is
       fully open a short "settling" phase fades the band clear, so the
       last rows of the picture wash in instead of snapping visible. */
    var ADV_FADE_PX = 30;
    var ADV_SETTLE_MS = 340;
    // floated art's sideways reveal races ahead of the vertical open:
    // the sweep crosses the frame at this multiple of the drop speed, so
    // the side wipe lands early and the rest unrolls downward
    var ADV_SIDE_BOOST = 2.5;
    /* state lives PER PASSAGE, keyed through a WeakMap on the turn node -
       the same trick the audio module uses to fire a sound once per
       passage: re-renders recreate the img nodes but the turn node
       persists, and a NEW passage reusing the same picture gets its very
       own ceremony. keys: stalled | decoding | wiping | settling | done */
    var turnArt = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    // tq: per-stem queue of NODE INDICES an arrival has claimed a ceremony
    // for (see advImgArrive) - the scan consumes a target when the node at
    // that document index shows up
    // wid: the float frame's FINAL laid-out width (captured before the
    // wipe collapses it) - the picture pins to it while the frame opens,
    // so a side reveal slices instead of squashing
    var artGlobal = { keys: {}, nat: {}, tq: {}, wid: {} };
    function artStore(el) {
        if (!turnArt) return artGlobal;
        var t;
        try { t = el.closest(".turn") || document.documentElement; }
        catch (e) { t = document.documentElement; }
        var s = turnArt.get(t);
        if (!s) { s = { keys: {}, nat: {}, tq: {}, wid: {} }; turnArt.set(t, s); }
        return s;
    }

    function imgKeyOf(el) {
        // stable_diffusion art keys on its token, pending or resolved
        var sdk = el.getAttribute("data-sd");
        if (sdk) return String(sdk).toLowerCase();
        var k = el.getAttribute("data-img");
        if (k) return String(k).toLowerCase();
        var file = String(el.getAttribute("src") || "").split("/").pop().split("?")[0];
        return file.replace(/\.[a-z0-9]+$/i, "").toLowerCase() || "art";
    }
    /* the STATE key is stem + "#" + occurrence: the n-th same-stem picture
       of a passage is its own ceremony, so a repeat drop never replays the
       earlier one. This variant derives the occurrence from the DOM (the
       scan keeps its own counters and passes the key in explicitly). */
    function imgOccKeyOf(el) {
        var stem = imgKeyOf(el);
        var box = document.getElementById("messages");
        if (!box) return stem + "#1";
        var all = box.querySelectorAll("img.adv-img");
        var mine = null;
        try { mine = el.closest(".turn"); } catch (e) {}
        var n = 0;
        for (var i = 0; i < all.length; i++) {
            var t = null;
            try { t = all[i].closest(".turn"); } catch (e) {}
            if (t !== mine || imgKeyOf(all[i]) !== stem) continue;
            n++;
            if (all[i] === el) break;
        }
        return stem + "#" + (n || 1);
    }
    function advImgReduced() {
        try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
    }
    function holdImg(key, ms) {
        if (window.AdvType) { try { window.AdvType.hold("adv-img:" + key, ms); } catch (e) {} }
    }
    function freeImg(key) {
        if (window.AdvType) { try { window.AdvType.release("adv-img:" + key); } catch (e) {} }
    }
    /* the wipe runs in JS, frame by frame, NOT as a CSS animation: the
       streaming re-renders rebuild the story DOM constantly, and a CSS
       animation depends on its element surviving every frame plus the
       stylesheet actually being the fresh one. this ticker re-finds the
       picture's nodes by turn+key every single frame and writes the
       frame's inline height (and its edge mask), so the curtain is always
       painted exactly where the clock says - even on nodes born one frame
       ago, and inline style outranks any cached stylesheet. */
    var activeWipes = [];   // {store, key, stem, turn, started, wipeMs, settleAt}
    var wipeRaf = false;
    function sameTurnNodes(turn, key) {
        var out = [];
        var box = document.getElementById("messages");
        if (!box) return out;
        var hash = key.lastIndexOf("#");
        var stem = hash < 0 ? key : key.slice(0, hash);
        var want = hash < 0 ? 1 : (parseInt(key.slice(hash + 1), 10) || 1);
        var all = box.querySelectorAll("img.adv-img");
        var seen = {};   // stem -> occurrences counted in this turn so far
        for (var j = 0; j < all.length; j++) {
            var t = null;
            try { t = all[j].closest(".turn"); } catch (e) {}
            if (t !== turn) continue;
            var sk = imgKeyOf(all[j]);
            seen[sk] = (seen[sk] || 0) + 1;
            if (sk === stem && seen[sk] === want) out.push(all[j]);
        }
        return out;
    }
    /* the ceremony grows the FRAME open rather than clipping the picture:
       clip-path reserves the full box from the first frame (the page jumps
       to the bottom of a picture that is still hidden), while a collapsing
       .adv-img-wrap takes no space while shut and its growth drags the
       autoscroll down as the image unrolls. */
    function wipeHolderOf(el) {
        var w = el && el.parentNode;
        if (w && w.classList && w.classList.contains("adv-img-wrap")) return w;
        return el;
    }
    /* the core autoscroll (the x-auto-scroll directive) pumps the chat to
       the bottom only on CHILD mutations of the messages box - our
       per-frame frame-height writes are style attributes, invisible to it,
       so a picture taller than the viewport unrolled out of sight. while a
       wipe grows the frame we do that following ourselves, on the same
       contract as the directive: resting inside its 50px bottom tolerance
       means "reading the bottom", pinned to the reveal edge every frame;
       anything past it means the player scrolled away and stays untouched.
       the verdict is measured BEFORE the frame's growth is applied, so a
       fast wipe's own growth can never count as "scrolled away". */
    function wipeTick() {
        wipeRaf = false;
        var now = Date.now();
        var still = [];
        var box = document.getElementById("messages");
        var follow = !!box &&
            (box.scrollHeight - box.scrollTop - box.clientHeight) < 50;
        var grew = false;
        for (var i = 0; i < activeWipes.length; i++) {
            var w = activeWipes[i];
            var st = w.store.keys[w.key];
            var nodes = sameTurnNodes(w.turn, w.key);
            var k;
            if (st === "wiping") {
                var p = (now - w.started) / (w.wipeMs || ADV_WIPE_MS);
                if (p > 1) p = 1;
                var open = p;   // constant edge speed, like the typing itself
                var horiz = w.dir && w.store.wid[w.stem] ? w.dir : "";
                for (k = 0; k < nodes.length; k++) {
                    // per-frame measurement first (responsive-honest), the
                    // decode-captured display height as fallback
                    var nat = nodes[k].offsetHeight || w.store.nat[w.stem] || 0;
                    var h = Math.round(nat * open);
                    var hold = wipeHolderOf(nodes[k]);
                    hold.style.overflow = "hidden";
                    hold.style.height = h + "px";
                    var maskDir = "to bottom";
                    if (horiz) {
                        // the frame widens faster than it grows tall
                        // (ADV_SIDE_BOOST) - the sweep crosses the frame
                        // in a flash and the remainder unrolls downward;
                        // the picture stays pinned to its FINAL width and
                        // anchored to the float's edge, so the reveal
                        // slices in from that side, never squashing, and
                        // the prose rewraps around it every frame
                        hold.style.width = Math.min(Math.round(h * ADV_SIDE_BOOST), w.store.wid[w.stem]) + "px";
                        hold.style.textAlign = horiz === "right" ? "right" : "left";
                        nodes[k].style.width = w.store.wid[w.stem] + "px";
                        nodes[k].style.maxWidth = "none";
                        maskDir = horiz === "right" ? "to bottom left" : "to bottom right";
                    }
                    // both spellings: Chrome only grew an unprefixed
                    // mask-image very late, the -webkit- one always works
                    hold.style.maskImage = hold.style.webkitMaskImage =
                        "linear-gradient(" + maskDir + ", #000 calc(100% - " + ADV_FADE_PX +
                        "px), rgba(0,0,0,0))";
                }
                grew = true;
                if (p < 1) { still.push(w); continue; }
                // the frame is fully open - but ripping the soft band away
                // on this very frame snapped the picture's last rows sharp.
                // hand over to a short settle instead: the band's
                // transparent stop fades up to opaque, so the reveal edge
                // dissolves into full clarity instead of vanishing.
                if (w.store.keys[w.key] === "wiping") {
                    w.store.keys[w.key] = "settling";
                    w.settleAt = now;
                }
                still.push(w);
                continue;
            }
            if (st === "settling") {
                var q = (now - w.settleAt) / ADV_SETTLE_MS;
                if (q >= 1) {
                    for (k = 0; k < nodes.length; k++) {
                        var holdD = wipeHolderOf(nodes[k]);
                        holdD.style.height = ""; holdD.style.overflow = "";
                        holdD.style.width = ""; holdD.style.textAlign = "";
                        holdD.style.maskImage = holdD.style.webkitMaskImage = "";
                        // let the CSS own the picture again (final width)
                        nodes[k].style.width = ""; nodes[k].style.maxWidth = "";
                    }
                    if (w.store.keys[w.key] === "settling") { w.store.keys[w.key] = "done"; freeImg(w.key); }
                    continue;
                }
                // the frame stays exactly as the wipe left it (fully open);
                // only the soft band washes out, its far-edge alpha rising
                // from transparent to solid across the settle
                var a = q.toFixed(3);
                var maskDirS = w.dir && w.store.wid[w.stem]
                    ? (w.dir === "right" ? "to bottom left" : "to bottom right")
                    : "to bottom";
                for (k = 0; k < nodes.length; k++) {
                    var holdS = wipeHolderOf(nodes[k]);
                    holdS.style.maskImage = holdS.style.webkitMaskImage =
                        "linear-gradient(" + maskDirS + ", #000 calc(100% - " + ADV_FADE_PX +
                        "px), rgba(0,0,0," + a + "))";
                }
                still.push(w);
                continue;
            }
            if (st === "decoding") {
                // frame stays collapsed to nothing while the pixels are on
                // their way: no reserved blank space, no scroll jump
                var dirC = w.dir && w.store.wid[w.stem] ? w.dir : "";
                for (k = 0; k < nodes.length; k++) {
                    var holdC = wipeHolderOf(nodes[k]);
                    holdC.style.overflow = "hidden";
                    holdC.style.height = "0px";
                    if (dirC) {
                        holdC.style.width = "0px";
                        holdC.style.textAlign = dirC === "right" ? "right" : "left";
                    }
                }
                still.push(w);
                continue;
            }
            // done, failed or rewound away: nothing may keep the frame shut
            for (k = 0; k < nodes.length; k++) {
                var holdF = wipeHolderOf(nodes[k]);
                holdF.style.height = ""; holdF.style.overflow = "";
                holdF.style.width = ""; holdF.style.textAlign = "";
                holdF.style.maskImage = holdF.style.webkitMaskImage = "";
                nodes[k].style.width = ""; nodes[k].style.maxWidth = "";
            }
        }
        if (grew && follow) box.scrollTo({ top: box.scrollHeight, behavior: "instant" });
        activeWipes = still;
        if (activeWipes.length) { wipeRaf = true; requestAnimationFrame(wipeTick); }
    }
    function wipeGo() {
        if (!wipeRaf) { wipeRaf = true; requestAnimationFrame(wipeTick); }
    }
    /* claimed: this call already carries an arrival's ceremony (the scan
       consumed a node target for it). every other caller - advFillImgs
       patching late pixels in - may only RESUME a ceremony that was
       already claimed (stalled), never start a fresh one: without this
       rule a picture that painted flat (no arrival for it) would wipe the
       moment its src lands. */
    function advRevealImg(el, storeOpt, keyOpt, claimed) {
        var store = storeOpt || artStore(el);
        var key = keyOpt || imgOccKeyOf(el);
        var st = store.keys[key];
        if (claimed === undefined) claimed = st === "stalled";
        if (!claimed) return;
        if (st === "decoding" || st === "wiping" || st === "settling" || st === "done") return;
        if (advImgReduced()) {
            store.keys[key] = "done";
            return;
        }
        var src = el.getAttribute("src") || "";
        if (!src) {
            store.keys[key] = "stalled";
            return;   // wait for real pixels
        }
        var turn = null;
        try { turn = el.closest(".turn"); } catch (e) {}
        store.keys[key] = "decoding";
        var stem = key.lastIndexOf("#") > 0 ? key.slice(0, key.lastIndexOf("#")) : key;
        if (el.offsetHeight) store.nat[stem] = el.offsetHeight;
        // floated art opens from its anchor corner: a left float sweeps
        // rightward from its top-left, a right float from its top-right.
        // the sideways leg runs at ADV_SIDE_BOOST times the vertical
        // speed, and both axes advance constantly per frame, so the
        // layout - and the text flowing around the frame - keeps pace
        // with the wipe instead of snapping.
        var hold0 = wipeHolderOf(el);
        var dir = "";
        if (hold0.classList) {
            if (hold0.classList.contains("adv-img-left")) dir = "left";
            else if (hold0.classList.contains("adv-img-right")) dir = "right";
        }
        // capture the frame's FINAL width before the collapse erases it
        if (dir && !store.wid[stem]) {
            var wf0 = hold0.offsetWidth || el.offsetWidth;
            if (wf0) store.wid[stem] = wf0;
        }
        // collapse the frame to nothing right away - the ticker grows it
        // back open, so nothing ever reserves the picture's full height
        hold0.style.overflow = "hidden";
        hold0.style.height = "0px";
        if (dir && store.wid[stem]) hold0.style.width = "0px";
        // provisioned for the slowest legal unroll; freeImg releases the
        // instant this particular wipe actually lands
        holdImg(key, ADV_DECODE_MS + ADV_WIPE_MAX + 1500);
        // one ticker entry per reveal: it paints every frame, and every
        // freshly re-created node, through the decode and the whole wipe
        activeWipes.push({ store: store, key: key, stem: stem, turn: turn,
            started: 0, wipeMs: 0, settleAt: 0, dir: dir });
        wipeGo();
        // a detached probe survives the passage's re-renders; a load
        // listener bolted onto the img itself would not survive them
        var probe = new Image();
        var giveUp = function () {
            if (store.keys[key] === "decoding") {
                store.keys[key] = "done";
                freeImg(key);
            }
        };
        var timer = setTimeout(giveUp, ADV_DECODE_MS);
        probe.onload = function () {
            clearTimeout(timer);
            if (store.keys[key] !== "decoding") return;
            store.keys[key] = "wiping";
            // capture the DISPLAY height here, at decode-complete: a node
            // inside the collapsed frame measures 0, and without a real
            // number the wipe would grow 0 -> 0 and the picture would only
            // snap visible when the ticker finished. the probe is decoded,
            // so its aspect ratio turns the node's laid-out width into the
            // exact height the wipe should grow to.
            var liveN = sameTurnNodes(turn, key);
            var natNow = 0;
            for (var q = 0; q < liveN.length; q++) {
                if (liveN[q].offsetHeight > 0) { natNow = liveN[q].offsetHeight; break; }
                var wShown = liveN[q].offsetWidth || wipeHolderOf(liveN[q]).offsetWidth;
                if (wShown && probe.naturalWidth) {
                    natNow = wShown * probe.naturalHeight / probe.naturalWidth;
                    break;
                }
            }
            if (!natNow && probe.naturalHeight) natNow = probe.naturalHeight;
            if (natNow) store.nat[stem] = Math.round(natNow);
            // last-ditch float width: normally captured before the frame
            // collapsed at claim time; if that saw zero (an un-laid-out
            // node), best-effort the CSS frame slot so the ticker still
            // has a side to sweep - with no width at all it falls back
            // to the plain top-down open
            if (dir && !store.wid[stem] && probe.naturalWidth)
                store.wid[stem] = Math.min(320, probe.naturalWidth);
            try { window.AdvAudio.cue("image_insertion", false, true); } catch (e) {}
            // the curtain rises the instant the pixels are ready, timed
            // from the picture's real height at the story's typing tempo
            for (var j = 0; j < activeWipes.length; j++) {
                if (activeWipes[j].store === store && activeWipes[j].key === key) {
                    activeWipes[j].started = Date.now();
                    activeWipes[j].wipeMs = advWipeMs(store.nat[stem]);
                }
            }
            wipeGo();
        };
        probe.onerror = giveUp;
        probe.src = src;
    }
    /* the LIVE verdict: a picture only earns its ceremony while the story
       is actually arriving. stream.state alone is NOT enough - the core
       flips it to "idle" the instant the wire goes quiet, while the
       typewriter may still be mid-reveal for seconds after (it parks the
       lifecycle itself). the live TURN is the authoritative signal: the
       reveal keeps it alive exactly as long as the passage is still being
       written, and chat switches / reloads never have one. */
    function artIsLive() {
        try {
            var s = Alpine.store("stream");
            if (!s) return false;
            if (s.state !== "idle") return true;
            return !!(s.turn && s.turn.live === true);
        } catch (e) { return false; }
    }
    /* the TRUE arrival trigger is the typewriter's reveal-scan
       (adventure_type.js), exactly like {{sfx}} and the pulses: it calls
       advImgArrive the instant a {{img|name}} macro's closing "}}" crosses
       the typing cursor - position-stable, once per occurrence, and text
       behind the wake line of a mid-stream activation is seeded as
       already-seen so it never fires. An arrival queues a ceremony aimed
       at a NODE INDEX, not an occurrence count: the pictures of this stem
       in the live turn SO FAR, plus one - exactly the picture THIS macro
       is about to summon. A picture painted into the page before its macro
       reached the cursor (a first-chunk delivery, a wake adoption) has no
       ceremony aimed at it and stays flat forever, and a later arrival
       never re-wipes it either: the queue always lands on the newest node,
       so ceremony and node stay aligned even when the DOM ran ahead of
       the reveal. */
    window.advImgArrive = function (name) {
        // the reveal-scan hands over the macro's whole text group, so a
        // side tail ({{img|name|left}}) rides along - the ceremony keys on
        // the stem only; the side is pure layout
        var stem = String(name || "").split("|")[0].trim().toLowerCase();
        if (!stem) return;
        var turns = document.querySelectorAll("#messages .turn");
        var last = turns.length ? turns[turns.length - 1] : null;
        if (!last) return;
        var s = artStore(last);
        var allImg = document.querySelectorAll("img.adv-img");
        var inLast = 0;
        for (var q = 0; q < allImg.length; q++) {
            var t = null;
            try { t = allImg[q].closest(".turn"); } catch (e) {}
            if (t === last && imgKeyOf(allImg[q]) === stem) inLast++;
        }
        var tq = s.tq[stem] || (s.tq[stem] = []);
        tq.push(inLast + 1);
    };
    var scanId = 0;
    /* floated art hugs the TOP of its host paragraph: the browser can only
       ever start a float on the line where its markup sits, so a macro
       written mid-paragraph would drop the picture in mid-air (and the
       right-side float of a typed-out paragraph sank to its very bottom).
       lifting the frame to the paragraph's first slot makes the whole
       paragraph flow around it. the move never scrambles the ceremony's
       node indices: floats are lifted in document order and stacked in
       that same order, so same-stem occurrences keep their source
       sequence, and the whole pass runs in the observer microtask -
       before any paint, so the lift itself is never seen. already-placed
       frames are skipped, so the re-placement never mutates the DOM
       again, which keeps the observer from echoing. */
    function advPlaceImgFloats() {
        var box = document.getElementById("messages");
        if (!box) return;
        var wraps = box.querySelectorAll(".adv-img-wrap.adv-img-left, .adv-img-wrap.adv-img-right");
        if (!wraps.length) return;
        /* one floated frame per paragraph, always: two frames sharing a
           host would sandwich the prose between a left and a right float.
           a paragraph holding more than one is split: every frame past
           the first opens a fresh paragraph (same tag, same classes) that
           takes it and everything that followed in source, so each
           picture keeps its own stretch of prose and the clearing rules
           stack those sections one below the other. the split only ever
           moves a frame that still sits among its own text (once lifted,
           each paragraph holds exactly one and the pass no-ops), the
           ceremony counts image nodes in document order which splitting
           preserves, and it happens before grouping so the sections
           below lift normally. */
        var seenHosts = [];
        for (var s = 0; s < wraps.length; s++) {
            var h = wraps[s].parentElement;
            if (!h || seenHosts.indexOf(h) !== -1) continue;
            seenHosts.push(h);
            var kids = [];
            for (var c0 = h.firstChild; c0; c0 = c0.nextSibling) kids.push(c0);
            var frames = 0, cur = h;
            for (var s2 = 0; s2 < kids.length; s2++) {
                var nd = kids[s2];
                if (!(nd.nodeType === 1 && nd.classList && nd.classList.contains("adv-img-wrap") &&
                      (nd.classList.contains("adv-img-left") || nd.classList.contains("adv-img-right")))) continue;
                if (frames > 0) {
                    var np = document.createElement(h.tagName);
                    np.className = h.className.replace(/\s*\badv-float-host\b/, "");
                    cur.parentNode.insertBefore(np, cur.nextSibling);
                    while (nd) { var nx = nd.nextSibling; np.appendChild(nd); nd = nx; }
                    cur = np;
                    frames = 0;
                }
                frames++;
            }
        }
        var hosts = [], groups = [];
        for (var i = 0; i < wraps.length; i++) {
            var p = wraps[i].parentElement;
            if (!p) continue;
            var g = hosts.indexOf(p);
            if (g === -1) { g = hosts.length; hosts.push(p); groups.push([]); }
            groups[g].push(wraps[i]);
        }
        for (var q = 0; q < groups.length; q++) {
            var list = groups[q], host = hosts[q];
            // the slot the LAST floated frame belongs in: right before the
            // first piece of real content hugging the paragraph top (other
            // lifted frames are not content, everything else is)
            var tail = null;
            // does the host hold prose of its own yet? lifted frames are
            // not content; whitespace-only text nodes are not content
            // either - only real text or other elements are
            var hasContent = false;
            for (var c = host.firstChild; c; c = c.nextSibling) {
                if (c.nodeType === 1 && c.classList && c.classList.contains("adv-img-wrap")) continue;
                if (tail === null) tail = c;
                if (c.nodeType === 3) {
                    if (c.textContent.trim() !== "") { hasContent = true; break; }
                    continue;
                }
                hasContent = true;
                break;
            }
            // walk backwards so each frame lines up behind the one after
            // it: the stack at the top ends in the very source order
            for (var k = list.length - 1; k >= 0; k--) {
                var w = list[k];
                var slot = (k === list.length - 1) ? tail : list[k + 1];
                if (slot === null) {
                    if (w !== host.lastChild) host.appendChild(w);
                    continue;
                }
                if (w.nextSibling !== slot) host.insertBefore(w, slot);
            }
            // clearing: the picture keeps only its own paragraph's company
            // (its lines flow around the frame), every block AFTER the
            // host paragraph starts fully below the picture, and the host
            // container becomes a float-containment root so a picture in
            // the last paragraph can never lean into the next passage.
            // but a frame that arrived before its paragraph was written
            // (a macro leading the stream, host still empty) must NOT
            // clear: the prose still to come belongs BESIDE the picture,
            // so the class is withheld until the host actually holds text
            // - the pass reruns on every scan, so it lands the moment the
            // first words stream in. add/remove are both no-ops when the
            // token is already in (or not in) its place, so these
            // attribute writes can never echo the observer.
            if (hasContent) host.classList.add("adv-float-host");
            else host.classList.remove("adv-float-host");
            if (host.parentElement) host.parentElement.classList.add("adv-bfc");
        }
    }
    window.advPlaceImgFloats = advPlaceImgFloats;
    function advScanNewImgs() {
        scanId++;
        advPlaceImgFloats();
        var box = document.getElementById("messages");
        if (!box) return;
        var imgs = box.querySelectorAll("img.adv-img");
        if (!imgs.length) return;
        var turns = box.querySelectorAll(".turn");
        var lastTurn = turns.length ? turns[turns.length - 1] : null;
        var live = null;
        for (var i = 0; i < imgs.length; i++) {
            var el = imgs[i];
            var store = artStore(el);
            // occurrence number of this node among same-stem pictures of
            // its passage, recounted fresh every scan (document order is
            // macro order and only ever grows)
            if (store._sid !== scanId) { store._sid = scanId; store._cnt = {}; }
            var stem = imgKeyOf(el);
            var n = (store._cnt[stem] = (store._cnt[stem] || 0) + 1);
            var key = stem + "#" + n;
            var st = store.keys[key];
            if (!st) {
                var host = null;
                try { host = el.closest(".turn"); } catch (e) {}
                if (host !== lastTurn) {
                    store.keys[key] = "done";
                    continue;
                }
                var tq = store.tq[stem];
                if (!(tq && tq.length && tq[0] === n)) {
                    // no ceremony is aimed at this node yet: while the
                    // story still arrives it waits for its own arrival;
                    // once the stream has settled it never will - flat
                    // (that is a picture the DOM rendered ahead of the
                    // reveal, or a reload/chat-switch paint)
                    if (live === null) live = artIsLive();
                    if (!live) store.keys[key] = "done";
                    continue;
                }
                tq.shift();   // this node IS the picture the cursor summoned
                advRevealImg(el, store, key, true);
                continue;
            }
            // stalled and the pixels have since arrived on a fresh node:
            // resume - without this the stalled flag dead-ends the picture
            // forever whenever the src lands via a re-render instead of advFillImgs
            if (st === "stalled") {
                if (el.getAttribute("src")) advRevealImg(el, store, key);
                continue;
            }
            // in flight: the ticker paints from now on, no class work left
            if (st === "decoding" || st === "wiping" || st === "settling") { wipeGo(); continue; }
        }
    }
    window.advScanNewImgs = advScanNewImgs;
    // safety net next to the observer passes: a slow poll can never miss a
    // picture, worst case the ceremony starts a few hundred ms later
    setInterval(advScanNewImgs, 500);
    // flat-mark the art that was already on the page before any live turn
    // could claim it as its own arrival
    setTimeout(advScanNewImgs, 1500);

    var LS_MODE = "adv_mode";            // {chatId: true/false} - manual passage-view overrides
    var LS_CAMPAIGNS = "adv_campaigns";  // [chatId,..] - lets the pre-paint head script know
    var LS_LAST_CHAT = "adv_last_chat";  // chat that was open on last visit

    var WIKI_RE = /\[\[([^\[\]]+)\]\]/g;
    // a wiki link mid-stream (same partial-render concept as the flavor
    // macros): the body is still growing and the closing ]] may not have
    // arrived yet (one stray ] can slip in at a chunk boundary)
    var WIKI_PARTIAL_RE = /^\[\[([^\[\]]*)\]{0,2}$/;
    var COND_RE = /\s*\(([^()]+?)\s*(\d+)\s*\+\)\s*$/;

    function lsGet(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; }
        catch (e) { return fallback; }
    }
    function lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function currentChat() {
        try { return Alpine.store("chat").selectedChat; } catch (e) { return null; }
    }

    // Alpine stores are reactive proxies - all state mutations MUST go through
    // Alpine.store("adv") or components never re-render. Never mutate `adv` raw.
    function A() {
        return Alpine.store("adv") || adv;
    }

    /* -------------------------
     * adv store
     * ------------------------- */
    var adv = {
        campaign: null,
        active: false,
        _prev: null,
        _ready: false,

        computeActive: function (chatId) {
            var overrides = lsGet(LS_MODE, {});
            var forced = overrides[chatId];
            if (forced === true || forced === false) return forced;
            // no manual override: a campaign drives the view, unless the
            // backend says the player stepped out (survives a reload).
            return !!this.campaign && !this.campaign.paused;
        },

        applyMode: function () {
            // entering or leaving a game? fade the old world out through a
            // curtain, flip the whole interface underneath it (theme, header,
            // passage view - all swap instantly, but hidden), then reveal
            var was = document.documentElement.classList.contains("adv-on");
            if (modeTransition) return;
            if (curtainArmed && was !== this.active && !prefersReducedMotion()) {
                curtainSwap(this);
                return;
            }
            curtainArmed = true;
            this._applyModeNow();
        },

        _applyModeNow: function () {
            var root = document.documentElement;
            // only wipe/reveal on a REAL transition. _applyModeNow also runs
            // on every heartbeat refresh while the game stays active, and a
            // teardown there would erase the typewriter mid-reveal.
            var flipped = this._wasActive !== this.active;
            this._wasActive = this.active;
            root.classList.toggle("adv-on", this.active);
            root.classList.toggle("adv-ended", this.active && !!(this.campaign && this.campaign.ended));
            this.paintGameOver();
            this.paintPlaceholder();
            if (this.active) {
                advMarkCurrent();
                // fresh content is styled by the marked extensions at parse
                // time; the one-off catch-up sweep for pre-campaign cached
                // passages lives in adventure_plus.js (adv:state watcher)
                dockInput();
            } else {
                undockInput();
            }
            // entering or leaving the game: wipe the typewriter's half-typed
            // reveal and release whatever its hold parked. a parked
            // stream_complete would otherwise lock the input and stall every
            // later scene/sound update until the page was reloaded.
            if (flipped && window.AdvType && window.AdvType.teardown) {
                try { window.AdvType.teardown(); } catch (e) {}
            }
            try { window.dispatchEvent(new CustomEvent("adv:state", { detail: { active: this.active } })); } catch (e) {}
        },

        paintGameOver: function () {
            var el = document.getElementById("adv-gameover");
            if (!el) return;
            if (this.active && this.campaign && this.campaign.ended) {
                el.innerHTML = '<span class="adv-go-title">' + esc(this.campaign.ending || "Game Over") + "</span>"
                    + esc(this.campaign.epitaph || "");
            } else {
                el.innerHTML = "";
            }
        },

        paintPlaceholder: function () {
            // touch the custom prompt bar early so it exists even if boot
            // ran before the first dock; it carries its own placeholder
            promptBar();
        },

        refresh: function (chatId, animate) {
            var self = this;
            chatId = chatId || currentChat();
            if (!chatId) return Promise.resolve();
            lsSet(LS_LAST_CHAT, chatId);

            // the typewriter's "still revealing prose" flag rides every poll
            // (live-computed, so any caller reports truthfully): the backend
            // holds tool calls while it stays 1, so the world never moves
            // while the player is still watching a passage type out
            var twBusy = (window.AdvType && window.AdvType.isBusy && window.AdvType.isBusy()) ? 1 : 0;
            return simpleApiFetch("/api/ext/adventure_games/state?chat=" + encodeURIComponent(chatId) + "&typing=" + twBusy)
                .then(function (data) {
                    var hadCampaign = !!self.campaign;
                    var prevPack = self.campaign ? self.campaign.asset_pack : null;
                    self.campaign = (data && data.campaign) || null;
                    /* a campaign appearing (or a restart onto another asset
                       pack) swaps the scene-art map AND the registered
                       font faces: pull both right away instead of waiting
                       for the gated polls below */
                    if (self.campaign && (!hadCampaign || self.campaign.asset_pack !== prevPack)) {
                        advLoadImgMap();
                        if (window.advReloadFontFaces) window.advReloadFontFaces();
                    }

                    var known = lsGet(LS_CAMPAIGNS, []);
                    if (self.campaign && known.indexOf(chatId) === -1) known.push(chatId);
                    if (!self.campaign) known = known.filter(function (c) { return c !== chatId; });
                    lsSet(LS_CAMPAIGNS, known);

                    self.active = self.computeActive(chatId);
                    self.applyMode();

                    if (animate && self._prev && self.campaign) {
                        showDeltas(self._prev, self.campaign);
                    }
                    self._prev = self.campaign ? JSON.parse(JSON.stringify(self.campaign)) : null;
                })
                .catch(function (e) { console.warn("adventure_games: state fetch failed", e); });
        },

        consumeRoll: function (chatId) {
            chatId = chatId || currentChat();
            if (!chatId) return Promise.resolve();
            return simpleApiPost("/api/ext/adventure_games/consume_roll", { chat: chatId })
                .then(function (roll) {
                    var coinRoll = roll && roll.kind === "coin";
                    if (roll && (coinRoll ? !!roll.side : roll.rolls && roll.rolls.length)) {
                        showDice(roll);
                        try { window.dispatchEvent(new CustomEvent("adv:dice", { detail: roll })); } catch (e) {}
                    }
                })
                .catch(function () {});
        },

        toggleMode: function () {
            var chatId = currentChat();
            if (!chatId) return;
            var overrides = lsGet(LS_MODE, {});
            overrides[chatId] = !this.active;
            lsSet(LS_MODE, overrides);
            this.active = !this.active;
            this.applyMode();
            // keep the backend in step: passage view off = paused
            try { simpleApiPost("/api/ext/adventure_games/set_paused", { chat: chatId, paused: !this.active }); } catch (e) {}
        },

        exitAdventure: function () {
            var chatId = currentChat();
            if (!chatId) return;
            var overrides = lsGet(LS_MODE, {});
            overrides[chatId] = false;
            lsSet(LS_MODE, overrides);
            this.active = false;
            this.applyMode();
            // freeze the campaign backend-side so the clock/world-tag stop too
            try { simpleApiPost("/api/ext/adventure_games/set_paused", { chat: chatId, paused: true }); } catch (e) {}
        },

        reenterAdventure: function () {
            var chatId = currentChat();
            if (!chatId) return;
            var overrides = lsGet(LS_MODE, {});
            overrides[chatId] = true;
            lsSet(LS_MODE, overrides);
            this.active = true;
            this.applyMode();
            // resume the campaign backend-side
            try { simpleApiPost("/api/ext/adventure_games/set_paused", { chat: chatId, paused: false }); } catch (e) {}
        },

        

        rewindLast: function () {
            var history = Alpine.store("chat").turnHistory || [];
            if (history.length === 0) return;
            var last = history[history.length - 1];
            var start = last;
            if (last.role === "assistant" && history.length > 1) {
                var before = history[history.length - 2];
                if (before.role === "user") start = before;
            }
            var firstIndex = start.first_message_index;

            var chatId = currentChat();
            simpleApiPost("/api/ext/adventure_games/rewind", { chat: chatId, first_index: firstIndex })
                .then(function () {
                    return simpleSocketSend({ type: "message_delete", index: firstIndex });
                })
                .then(function () {
                    /* rewinding the very first passage can empty the chat -
                       tell the clear-detector this blank page was earned,
                       not wiped */
                    advJustRewound[chatId] = Date.now();
                    /* the restored campaign carries OLD sfx/stinger stamps;
                       the adv:state watcher reads this timestamp and re-arms
                       its stamp trackers instead of replaying an undone sound */
                    window._advRewindTs = Date.now();
                    this._prev = null;
                    return this.refresh(chatId, false);
                }.bind(this));
        },

        /* journal modal helper: assistant turns -> clean passage texts */
        journalPassages: function () {
            var history = Alpine.store("chat").turnHistory || [];
            var out = [];
            history.forEach(function (turn, i) {
                if (turn.role !== "assistant") return;
                var finals = turn.final_messages || [];
                if (!finals.length) return;
                var msg = finals[finals.length - 1];
                var text = "";
                if (typeof msg.content === "string") text = msg.content;
                else if (Array.isArray(msg.content)) {
                    text = msg.content.filter(function (b) { return b && b.type === "text"; })
                        .map(function (b) { return b.text; }).join("\n\n");
                }
                if (!text) return;
                // wiki links become their plain display text in the journal
                text = text.replace(/\[\[([^\[\]]+)\]\]/g, function (m, inner) {
                    var bits = inner.split("|");
                    return bits[0].trim();
                });
                // text macros become their plain text
                text = text.replace(/\{\{sfx\|[^{}]+\}\}/g, "");
                // the journal has no live url map: name the picture softly
                // (a |left/|right/|center placement tail is not part of it)
                text = text.replace(/\{\{img\|([^{}]+)\}\}/g, function (m0, n) {
                    return "\u{1F5BC} " + String(n).split("|")[0].trim().replace(/_/g, " ");
                });
                // stable_diffusion art rides in as {{sd|token}} tags; the sd
                // extension exposes the manifest names through window.sdImgName
                text = text.replace(/\{\{sd\|([a-z0-9]{7})(?:\|[^{}]*)?\}\}/g, function (m0, tk) {
                    return "\u{1F5BC} " + (window.sdImgName ? window.sdImgName(tk) : "generated image");
                });
                text = text.replace(/\{\{(stat|item|status|statusoff|music|quest|questdone|questfail|questoff|subgoal|subdone)\|[^{}]+\}\}/g, "");
                PULSE_STRIP_RE.lastIndex = 0;
                text = text.replace(PULSE_STRIP_RE, function (m0, k, t) { return t || ""; });
                // text decorations keep only their decorated words
                var tdAlt = (window.AdvFX && window.AdvFX.tdAlt) ? window.AdvFX.tdAlt() : "";
                if (tdAlt)
                    text = text.replace(new RegExp("\\{\\{(?:" + tdAlt + ")\\|([^{}]+)\\}\\}", "g"), "$1");
                out.push({ n: out.length + 1, text: text });
            });
            return out;
        }
    };

    /* -------------------------
     * wiki link conversion
     * ------------------------- */
    function advStatReady() { return adv.active && adv.campaign; }

    function evaluateCondition(text) {
        // returns {base, ok, label} - label like "Requires Charm 60+"
        var m = text.match(COND_RE);
        if (!m) return { base: text, ok: true, label: "" };
        var statName = m[1].trim();
        var need = parseInt(m[2], 10);
        var base = text.slice(0, m.index).trim();
        var stat = adv.campaign && adv.campaign.stats && adv.campaign.stats[statName];
        if (!stat) return { base: base || text, ok: true, label: "" };
        var ok = stat.value >= need;
        return { base: base || text, ok: ok, label: "Requires " + statName + " " + need + "+" };
    }

    function makeChoiceAnchor(inner, campaign) {
        var parts = inner.split("|");
        var display = (parts.length > 1 ? parts[1] : parts[0]).trim();
        var send = (parts.length > 1 ? parts[0] : parts[0]).trim();

        var cond = evaluateCondition(display);
        display = cond.base;
        // condition always lives on the visible text; the sent message keeps it too
        // only when it was part of the send-side (keep symmetry)
        var sendCond = evaluateCondition(send);
        send = sendCond.base;

        var a = document.createElement("a");
        a.href = "#";
        a.className = "adv-choice";
        a.textContent = display;
        a.dataset.send = send;
        if (!cond.ok) {
            a.classList.add("adv-disabled");
            a.title = cond.label;
        }
        return a;
    }

    function advConvert(root) {
        if (!root || !adv.active) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue || node.nodeValue.indexOf("[[") === -1) return NodeFilter.FILTER_REJECT;
                var p = node.parentElement;
                if (p && p.closest("code, pre, .adv-choice, script, style")) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        nodes.forEach(function (node) {
            var text = node.nodeValue;
            WIKI_RE.lastIndex = 0;
            if (!WIKI_RE.test(text)) return;
            WIKI_RE.lastIndex = 0;

            var frag = document.createDocumentFragment();
            var last = 0, m;
            while ((m = WIKI_RE.exec(text)) !== null) {
                if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                frag.appendChild(makeChoiceAnchor(m[1], adv.campaign));
                last = m.index + m[0].length;
            }
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        });
    }

    // exposed for adventure_plus.js's one-off catch-up sweep (passages that
    // were rendered and cached before this chat's campaign was discovered)
    window.advConvert = advConvert;

    /* After a chat.reloadChat() the turn bubbles only its trailing content
       messages - any prose the GM streamed mid-turn (before dice rolls,
       before other tool calls, between thinking beats) was folded into
       chain steps, which adventures hide. Rebuild the latest finished turn
       so every streamed segment shows, in order, with the real final
       bubble last. Live turns are handled by advInstallWsHook below, which
       accumulates the stream append-only before the core handler sees it. */
    function advRepairPassage() {
        var chatStore = null;
        try { chatStore = Alpine.store("chat"); } catch (e) { return; }
        var hist = chatStore && chatStore.turnHistory;
        if (!hist || !hist.length) return;
        var t = null;
        for (var ti = hist.length - 1; ti >= 0; ti--) {
            var cand = hist[ti];
            if (cand && cand.role === "assistant" && cand.live !== true) { t = cand; break; }
        }
        if (!t || t.advRepaired || t.advKept) return;
        t.advRepaired = true;
        var extras = [];
        (t.steps || []).forEach(function (s) {
            var c = s && s.content;
            if (typeof c === "string" && c.trim() && extras.indexOf(c.trim()) === -1) {
                extras.push(c.trim());
            }
        });
        if (!extras.length) return;
        var built = [];
        extras.forEach(function (c) {
            built.push({ role: "assistant", type: "content", content: c });
        });
        (t.final_messages || []).forEach(function (m) {
            if (m && m.type === "content" && typeof m.content === "string"
                    && extras.indexOf(m.content.trim()) !== -1) return;
            built.push(m);
        });
        t.final_messages = built;
    }
    window.advRepairPassage = advRepairPassage;

    /* a cleared chat is a cleared campaign: the core /clear command (and
       the header's trash button, which sends it) leaves no trace modules
       can hook, so the page itself plays detective - when a chat that HAS
       a campaign sits idle with a completely empty passage page, the
       history was wiped, and the backend is told to wipe the campaign
       with it. the saw-passage flag keeps a never-rendered chat (fresh
       open, mid-load) from ever counting as cleared. */
    var advSawPassage = {};
    var advJustRewound = {};
    function advDetectClear() {
        var chatId = currentChat();
        if (!chatId) return;
        var busy = false;
        try { busy = Alpine.store("stream").state !== "idle"; } catch (e) { return; }
        if (busy) return;
        var box = document.getElementById("messages");
        if (!box) return;
        if (box.querySelectorAll(".turn").length > 0) { advSawPassage[chatId] = true; return; }
        if (!advSawPassage[chatId]) return;
        // a rewind that just emptied the page is not a chat clear
        if (Date.now() - (advJustRewound[chatId] || 0) < 5000) return;
        delete advSawPassage[chatId];   // fire once, then the refresh settles it
        simpleApiPost("/api/ext/adventure_games/chat_cleared", { chat: chatId })
            .then(function () {
                var st = Alpine.store("adv");
                st._prev = null;
                return st.refresh(chatId, false);
            })
            .catch(function () {});
    }

    /* the passage page is append-only, and that is enforced entirely here:
       the core stream machine retracts the provisional final bubble every
       time the GM pauses to think again or calls a tool (the prose folds
       back into a chain step, which adventures hide). instead of patching
       the webui's websocket handler, this module wraps the socket's
       onmessage and rewrites turn_final payloads BEFORE the core handler
       runs: retracted segments stay pinned on the page, and new segments
       append after them. outside adventures (and in normal chats) the
       payload passes through completely untouched. */
    function advAccumulateFinal(turn, incoming) {
        const kept = turn.advKept || (turn.advKept = []);
        const tail = turn.advTail || null;
        if (!Array.isArray(incoming)) incoming = [];

        if (incoming.length === 0) {
            // retract: pin the shown bubble onto the page. returning the
            // kept list instead of [] is what keeps a turn that ends on a
            // tool call (or a re-think) from collapsing into a blank page.
            if (tail) { kept.push(tail); turn.advTail = null; }
            return kept.slice();
        }

        if (incoming.length > 1) {
            // an authoritative FULL snapshot (the backend knows every
            // segment of the turn and sends them all, in order): trust it
            // wholesale - accumulating onto it would duplicate the very
            // segments it already contains
            turn.advKept = [];
            turn.advTail = null;
            return incoming;
        }

        const first = incoming[0];
        const fc = typeof first.content === "string" ? first.content : "";
        const tc = tail && typeof tail.content === "string" ? tail.content : null;
        if (tc !== null && fc.length >= tc.length && fc.startsWith(tc)) {
            // the same provisional message grew (or was re-broadcast): swap tail
            turn.advTail = first;
        } else if (tc !== null) {
            // a fresh segment began without a retract in between:
            // archive the old bubble, the new one takes its place on top
            kept.push(tail);
            turn.advTail = first;
        } else {
            // no bubble showing: either a brand-new segment or the final
            // echo of one we already pinned. an exact copy of a kept
            // segment is the echo - re-appending it would double the text
            const fkey = fc.trim();
            const echo = fkey !== "" && kept.some(function (k) {
                return k && typeof k.content === "string" && k.content.trim() === fkey;
            });
            turn.advTail = echo ? null : first;
        }
        const out = kept.slice();
        if (turn.advTail) out.push(turn.advTail);
        return out;
    }

    function advPatchSocket(ws) {
        if (!ws || ws.advWsHooked) return;
        var orig = ws.onmessage;
        if (typeof orig !== "function") return; // core handler not attached yet; the sweep retries
        ws.advWsHooked = true;
        ws.onmessage = function (event) {
            try {
                var adv = Alpine.store("adv");
                if (adv && adv.active) {
                    var data = JSON.parse(event.data);
                    if (data && data.type === "turn_final") {
                        var stream = Alpine.store("stream");
                        // the live turn is an OBJECT {role, live, steps,
                        // final_messages} - the empty reset state is [].
                        // only pre-patch while the core will reuse the live
                        // object (live === true); on the empty reset it
                        // opens a fresh turn with nothing to keep, and the
                        // payload must pass through untouched
                        if (stream && stream.turn && stream.turn.live === true) {
                            data.messages = advAccumulateFinal(stream.turn, data.messages || []);
                            // typewriter: full segments in, typed prefixes
                            // out - the core (and marked) only ever see
                            // what the player has actually read
                            if (window.AdvType) data.messages = window.AdvType.gate(data.messages);
                            event = { data: JSON.stringify(data) };
                        } else if (window.AdvType && Array.isArray(data.messages) &&
                                data.messages.some(function (m) {
                                    return m && m.type === "content" &&
                                        typeof m.content === "string" && m.content.length;
                                })) {
                            // the delivery that OPENS a fresh turn: the core
                            // flips live=true only inside its own handler, so
                            // the branch above misses exactly this one - and
                            // passing it raw painted the whole first chunk at
                            // once, ahead of the reveal and the img arrival
                            // scan (the "pictures sometimes pop in flat" bug:
                            // macros in that chunk got no arrival, and later
                            // arrivals claimed the wrong, already-painted
                            // nodes). open the reveal state fresh, gate from
                            // zero; there is nothing to accumulate yet (the
                            // turn has no earlier segments to keep).
                            window.AdvType.openTurn();
                            data.messages = window.AdvType.gate(data.messages);
                            event = { data: JSON.stringify(data) };
                        }
                    }
                }
            } catch (e) { /* never let the show stop for the stagehands */ }
            return orig.call(ws, event);
        };
    }

    /* the socket object is recreated on every (re)connect, so wrap the
       connector itself - the patched function is what every later reconnect
       calls, through the global scope. the repeating sweep then patches the
       fresh socket (a connect is never instant, so it always runs after the
       core handler has been attached). */
    function advInstallWsHook() {
        if (window.socket) advPatchSocket(window.socket);
        if (window.connectWebSocket && !window.connectWebSocket.advHooked) {
            var wrapped = function () {
                return window.connectWebSocket.advOrig.apply(window, arguments);
            };
            wrapped.advHooked = true;
            wrapped.advOrig = window.connectWebSocket;
            window.connectWebSocket = wrapped;
        }
    }
    setInterval(advInstallWsHook, 900);

    function advMarkCurrent() {
        // the last turn is the page. when the player picks an action the
        // new turn becomes current immediately: the old passage blanks and
        // the Thinking.. overlay takes the stage; once the new passage has
        // started streaming, its card persists through every later stage of
        // the turn (tool calls, prompt rounds) all by itself, since the
        // streaming assistant message stays mounted
        var turns = document.querySelectorAll("#messages .turn");
        for (var i = 0; i < turns.length; i++) {
            turns[i].classList.toggle("adv-current", i === turns.length - 1);
        }
    }

    /* -------------------------
     * marked.js extensions: wiki links, text macros and speaker lines are
     * proper markdown tokens now, so adventure content is styled during
     * PARSE instead of by post-render DOM surgery. Tokenizers check whether
     * an adventure is active at render time, so normal chats keep the stock
     * markdown pipeline. (window.advConvert below stays only as a catch-up
     * for old passages that were rendered/cached before a campaign existed.)
     * ------------------------- */
    // the decoration vocabulary is dynamic: the campaign's asset pack ships
    // text_decoration/ sheets and the AdvFX pack IS the flavor vocabulary
    // (adv:fx rebuilds these regexes the moment it lands; the reserved pipe
    // kinds below stay hardcoded either way, so the alternation is never empty)
    function advTdAlt() {
        return (window.AdvFX && window.AdvFX.tdAlt) ? window.AdvFX.tdAlt() : "";
    }
    function buildGlyphRe() {
        // group 1: kind, group 2: content - one opener per group, closed
        // in the same piece (the old head opened a ( too many and left it
        // dangling: unterminated group, thrown at parse, whole file dead)
        var td = advTdAlt();
        return new RegExp("^\\{\\{(" + (td ? td + "|" : "") +
            "sfx|stat|item|status|statusoff|music|img|quest(?:done|fail|off)?|subgoal|subdone)\\|([^{}]+)\\}\\}");
    }
    var GLYPH_MACRO_RE = buildGlyphRe();
    // flavor kinds whose BODY is prose: while a macro is still open (no }}
    // yet, typewriter mid-word), match it so the words already land inside
    // their styled span instead of showing raw {{kind|... braces. the
    // complete form above is matched first, so this only ever fires on the
    // trailing edge; sparkle/woozy renderers work on partial text unchanged.
    // null while the pack has not landed: no decoration names exist yet.
    function buildGlyphPartialRe() {
        var td = advTdAlt();
        return td ? new RegExp("^\\{\\{(" + td + ")\\|([^{}]*)$") : null;
    }
    var GLYPH_PARTIAL_RE = buildGlyphPartialRe();
    /* made-up macros: {{whatever|This macro doesn't exist}} names no
       decoration, state or pulse the vocabularies own. An AI hallucination
       is not an error to put on screen - the BODY is prose, so a last-resort
       branch renders just its text, unstyled, the braces vanished. The
       known vocabularies always win (this runs after them in the tokenizer),
       and reserved state kinds stay untouched (lookahead below): their
       streaming partials belong to the skip pipeline, never to prose. */
    var UNKNOWN_KIND_NOT = "(?!stat\\||item\\||statusoff\\||status\\||music\\||sfx\\||img\\||sd\\|" +
        "quest\\||questdone\\||questfail\\||questoff\\||subgoal\\||subdone\\|)";
    // group 1: the macro's plain-text body
    var UNKNOWN_MACRO_RE = new RegExp("^\\{\\{" + UNKNOWN_KIND_NOT + "[a-z][a-z0-9_-]*\\|([^{}]*)\\}\\}");
    var UNKNOWN_PARTIAL_RE = new RegExp("^\\{\\{" + UNKNOWN_KIND_NOT + "[a-z][a-z0-9_-]*\\|([^{}]*)$");
    // kinds that mutate the campaign at detection time (vs pure styling)
    var STATE_MACRO_KINDS = {
        stat: 1, item: 1, status: 1, statusoff: 1, music: 1,
        quest: 1, questdone: 1, questfail: 1, questoff: 1, subgoal: 1, subdone: 1
    };
    // one-shot pulse macros: {{flash}} / {{poof}}. a |tail is tolerated -
    // AIs sometimes narrate through the pulse ({{flash|the seal breaks}}):
    // the pulse still fires (the reveal scan reads it) and the tail renders
    // as plain prose
    // one-shot pulse macro names are dynamic: the campaign's asset pack can
    // ship pulses/, and the AdvFX pack widens the vocabulary (adv:fx
    // rebuilds these two regexes; the |tail stays tolerated)
    function advPulseAlt() {
        // no hardcoded fallback: the AdvFX pack IS the pulse vocabulary;
        // the adv:fx event rebuilds these regexes when it lands
        return (window.AdvFX && window.AdvFX.pulseAlt) ? window.AdvFX.pulseAlt() : "";
    }
    function buildPulseRe() {
        return new RegExp("^\\{\\{(" + advPulseAlt() + ")(?:\\|([^{}]*))?\\}\\}");
    }
    function buildPulseStripRe() {
        return new RegExp("\\{\\{(" + advPulseAlt() + ")(?:\\|([^{}]*))?\\}\\}", "g");
    }
    var PULSE_MACRO_RE = buildPulseRe();
    var PULSE_STRIP_RE = buildPulseStripRe();
    window.addEventListener("adv:fx", function () {
        PULSE_MACRO_RE = buildPulseRe();
        PULSE_STRIP_RE = buildPulseStripRe();
        GLYPH_MACRO_RE = buildGlyphRe();
        GLYPH_PARTIAL_RE = buildGlyphPartialRe();
    });
    var SPEAKER_RE = /^\*\*([^*\n]{1,40}):\*\*([ \t]+\S[^\n]*)/;

    /* {{sparkle|..}}: little glowing four-point stars scattered over the
       text - the phrase as a whole wears 4+ stars, dealt over a seeded
       shuffle of its words. positions roll from a hash of the word and
       its slot, never Math.random - the typewriter re-renders the passage
       dozens of times a second and a fresh roll per pass would make the
       stars jitter. seeding per WORD freezes earlier stars while the last
       word is still being typed. each star claims one of n lanes across
       its word so they spread out instead of clustering, and all tops
       sit inside the letter band - never above or below the text.
       (builds an HTML string: marked renderers have no DOM here) */
    function sparkleSeed(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }
    function sparkleRoll(seed, n) {
        var x = (seed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0 || 1;
        x ^= x << 13; x = x >>> 0;
        x ^= x >>> 17;
        x ^= x << 5; x = x >>> 0;
        return x / 4294967296;
    }
    function sparkleStarHTML(seed, i, n) {
        var lane = 90 / n;
        var left = (lane * i + sparkleRoll(seed, i * 6 + 1) * lane).toFixed(1);
        var top = (sparkleRoll(seed, i * 6 + 2) * 0.5 + 0.15).toFixed(2);
        var sz = (sparkleRoll(seed, i * 6 + 3) * 0.14 + 0.24).toFixed(2);
        var dur = (sparkleRoll(seed, i * 6 + 4) * 2.6 + 4).toFixed(2);
        var dly = (-sparkleRoll(seed, i * 6 + 5) * 5).toFixed(2);
        return '<i class="adv-sparkle-dot" style="left:' + left + "%;top:" + top +
            "em;width:" + sz + "em;height:" + sz + "em;--adv-sdur:" + dur +
            "s;--adv-sdelay:" + dly + 's"></i>';
    }
    function sparkleHTML(text) {
        var chunks = String(text).split(/(\s+)/).filter(function (c) { return c.length; });
        var words = [];
        chunks.forEach(function (c) { if (!/^\s+$/.test(c)) words.push(c); });
        if (!words.length)
            return '<span class="adv-macro adv-macro-sparkle">' + esc(text) + "</span>";
        // each word derives its OWN star count from a seed that is fixed
        // the moment the word lands (chunk + slot), never from the phrase
        // as a whole. the old phrase-wide shuffle re-drew every word's count
        // (and its lane layout) whenever a later word streamed in, so the
        // stars visibly re-seeded on close; a per-word seed freezes earlier
        // words while the last one types, and the layout never changes again.
        var html = "", slot = 0;
        chunks.forEach(function (chunk) {
            if (/^\s+$/.test(chunk)) { html += esc(chunk); return; }
            slot += 1;
            var seed = sparkleSeed(chunk + "|" + slot);
            var n = 1 + Math.floor(sparkleRoll(seed, 0) * 2.6); // 1..3 per word
            if (window.AdvPerf) n = Math.min(n, AdvPerf.sparkleWordMax(n)); // phone: fewer/none
            var stars = "";
            for (var k = 0; k < n; k++) stars += sparkleStarHTML(seed, k, n);
            html += '<span class="adv-sparkle-w">' + esc(chunk) + stars + "</span>";
        });
        return '<span class="adv-macro adv-macro-sparkle">' + html + "</span>";
    }

    function advActiveNow() {
        try { return !!(Alpine.store("adv") && Alpine.store("adv").active); } catch (e) { return false; }
    }

    // small mirrors of adventure_plus.js's helpers: marked renderers run in
    // this file, outside the plus module's IIFE scope
    function advWebuiMode() {
        try {
            var m = Alpine.store("theme").mode;
            if (m === "light" || m === "dark") return m;
        } catch (e) {}
        try {
            var lm = localStorage.getItem("themeMode");
            if (lm === "light" || lm === "dark") return lm;
        } catch (e) {}
        return "dark";
    }
    function advPalVars(pal) {
        if (!pal) return null;
        if (pal.variants) return pal.variants[advWebuiMode()] || pal.variants.dark;
        return pal;
    }
    function advSpeakerColor(name, palette) {
        var h = 0;
        for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
        var light = palette && palette.dark === false ? 42 : 68;
        return "hsl(" + h + " 55% " + light + "%)";
    }

    /* Inline state macros ({{stat|Gold -15}}, {{item|Torch +1}},
     * {{status|Poisoned 3t}}, {{statusoff|Poisoned}}, {{music|tavern_1}}):
     * the renderer
     * POSTs each one the INSTANT it parses, mid-stream - no tool call, no
     * waiting for the passage to finish. Guards against replay: they only
     * fire while the stream is running (a page reload or history re-render
     * must never re-apply old mutations), deduped per turn like the sound
     * cues, and the turn-scoped key rides along so even a resent POST
     * lands exactly once server-side. */
    var statFired = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    // macro kinds whose badge pops once the backend diff comes back; music
    // changes the screen itself - no chip, no pause
    var CHIP_MACRO_KINDS = { stat: 1, item: 1, status: 1, statusoff: 1 };
    function advStateMacro(kind, text) {
        var busy = false;
        try { busy = Alpine.store("stream").state !== "idle"; } catch (e) {}
        if (!busy) return;
        var turns = document.querySelectorAll("#messages .turn");
        var t = turns[turns.length - 1] || document.documentElement;
        if (statFired) {
            var set = statFired.get(t);
            if (!set) { set = {}; statFired.set(t, set); }
            if (set[kind + ":" + text]) return;
            set[kind + ":" + text] = 1;
        }
        /* The badge for this change blooms as soon as the backend diff
         * comes back - so pin the typewriter HERE, at the trigger: the
         * prose waits exactly at the word that changed the world instead
         * of running on while the roundtrip is in flight. showChip re-arms
         * the same key when the chip actually arrives (max semantics, so
         * the waits chain), and this cap keeps the story free if the POST
         * is ever rejected and no chip follows. */
        /* the pause belongs to the CHANGE, not to the macro: an item
         * mention moves nothing, so the prose must keep flowing.
         * advItemMoves mirrors the backend's _macro_item: only an
         * explicit delta hands an item over - a bare name is a pure
         * mention that never touches the pack, held or not. */
        if (CHIP_MACRO_KINDS[kind] && (kind !== "item" || advItemMoves(text)) &&
            window.AdvType) {
            window.AdvType.hold("badge", 1800);
        }
        var chat = null;
        try { chat = Alpine.store("chat").selectedChat; } catch (e) {}
        if (!chat) return;
        var p = simpleApiPost("/api/ext/adventure_games/state_macro",
            { chat: chat, kind: kind, text: text, key: turns.length + ":" + kind + ":" + text });
        if (p && p.catch) p.catch(function () {});
    }

    /* Visible echoes for state macros. The typewriter only ever hands
     * marked the revealed prefix, so a macro renders into the prose the
     * moment its closing "}}" types past - item picks up their icon and
     * name (a bare no-delta name is a mention and styles the same), stat
     * changes a row of signed pills. advDeltaSegs serves stat
     * ("Name +N, Other -M"; a bare number counts as positive, a bare
     * name parses as delta null); stat segments without a number stay
     * raw. Item segments run through advItemSegs instead, which mirrors
     * the backend's fuller item parse on top: an optional "~ description"
     * tail and an optional leading icon run are stripped off the name. */
    function advDeltaSegs(text) {
        var out = [];
        String(text || "").split(",").forEach(function (seg) {
            seg = seg.trim();
            if (!seg) return;
            var m = /^(.+?)\s*([+-]?\d+)$/.exec(seg);
            out.push(m ? { name: m[1].trim(), delta: parseInt(m[2], 10) }
                       : { name: seg, delta: null });
        });
        return out;
    }
    function advIconOf(mapping, name) {
        // case-insensitive entry lookup, icon + trailing space or ""
        if (!mapping || !name) return "";
        var key = null;
        if (mapping[name]) key = name;
        else {
            var lower = String(name).toLowerCase();
            for (var k in mapping) {
                if (String(k).toLowerCase() === lower) { key = k; break; }
            }
        }
        var e = key ? mapping[key] : null;
        return e && e.icon ? e.icon + " " : "";
    }
    function advEntryOf(mapping, name) {
        // case-insensitive entry lookup, the mapped value or null
        if (!mapping || !name) return null;
        if (mapping[name]) return mapping[name];
        var lower = String(name).toLowerCase();
        for (var k in mapping) {
            if (String(k).toLowerCase() === lower) return mapping[k];
        }
        return null;
    }
    function advItemSegs(text) {
        // mirror of the backend's _macro_item parse: an optional
        // "~ description" tail and an optional leading icon run are
        // stripped before the name (the description belongs to the entry,
        // never to the badge), then an optional trailing number decides
        // the delta (a bare number counts as positive, a bare name
        // parses as delta null - a PURE MENTION that never moves the pack)
        var out = [];
        String(text || "").split(",").forEach(function (seg) {
            seg = seg.trim();
            if (!seg) return;
            var desc = "";
            var md = /^(.*?)\s*~\s*(.+)$/.exec(seg);
            if (md) { seg = md[1].trim(); desc = md[2].trim(); }
            var icon = "";
            var mi = /^([^\w\s]+)\s+(.+)$/.exec(seg);
            if (mi) { icon = mi[1]; seg = mi[2].trim(); }
            var m = /^(.+?)\s*([+-]?\d+)$/.exec(seg);
            out.push(m ? { name: m[1].trim(), delta: parseInt(m[2], 10), icon: icon, desc: desc }
                       : { name: seg, delta: null, icon: icon, desc: desc });
        });
        return out;
    }
    function advItemMoves(text) {
        // mirror of the backend's _macro_item: ONLY an explicit delta
        // hands an item over; a bare "Name" is a pure mention that never
        // touches the inventory, held or not - so it never pauses the prose
        var moved = false;
        advItemSegs(text).forEach(function (s) {
            if (s.delta !== null) moved = true;
        });
        return moved;
    }
    /* the cure echo picks its verb from the condition itself: a timed
     * status was always going to wear off, so it "faded"; a permanent
     * one is "removed". decided on first sight and memoized per turn
     * element, because the backend delete can clear the status from the
     * store while the same passage re-parses mid-stream */
    var statusoffWords = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    function advStatusoffWord(name) {
        var memo = null;
        if (statusoffWords) {
            var turns = document.querySelectorAll("#messages .turn");
            var t = turns[turns.length - 1] || document.documentElement;
            memo = statusoffWords.get(t);
            if (!memo) { memo = {}; statusoffWords.set(t, memo); }
            if (memo[name]) return memo[name];
        }
        var word = "removed";
        var camp = null;
        try { camp = Alpine.store("adv").campaign; } catch (e) {}
        var s = advEntryOf(camp && camp.statuses, name);
        if (s && s.turns) word = "faded";
        if (memo) memo[name] = word;
        return word;
    }
    function advMacroInner(kind, text) {
        var camp = null;
        try { camp = Alpine.store("adv").campaign; } catch (e) {}
        if (kind === "item") {
            var seen = {};
            return advItemSegs(text).map(function (s) {
                var lk = s.name.toLowerCase();
                if (seen[lk]) return "";
                seen[lk] = 1;
                // every mention signs itself, delta or none: a bare
                // {{item|Silver key}} reads exactly like the pickup
                // badge - the icon rides the macro itself, else the
                // one the pack holds for it - it just never moves the
                // world or pauses the prose. a ~description tail stays
                // with the entry and never shows on the badge.
                return '<span class="adv-macro-item">' +
                    (s.icon ? s.icon + " "
                            : advIconOf(camp && camp.inventory, s.name) || "\u{1F392} ") +
                    esc(s.name) + "</span>";
            }).filter(Boolean).join(" ");
        }
        if (kind === "stat") {
            return advDeltaSegs(text).map(function (s) {
                if (s.delta === null) return esc(s.name);
                var sign = s.delta > 0 ? "+" + s.delta : String(s.delta);
                return '<span class="adv-m-stat' +
                    (s.delta < 0 ? " adv-m-stat-bad" : "") + '">'
                    + advIconOf(camp && camp.stats, s.name) +
                    esc(s.name) + " " + sign + "</span>";
            }).join(" ");
        }
        if (kind === "status" || kind === "statusoff") {
            // mirror of the backend's _macro_status parsing: optional
            // leading symbol run = icon, optional "Nt" tail = turns.
            // The inline echo shows icon + name; a cure reads
            // "Name faded" (a timed condition) or "Name removed" (a
            // permanent one) in soft ink. Turn counts stay sidebar
            // business.
            return String(text || "").split(",").map(function (seg) {
                seg = seg.trim();
                if (!seg) return "";
                var icon = "";
                var m = /^([^\w\s]+)\s*/.exec(seg);
                if (m) { icon = m[1]; seg = seg.slice(m[0].length); }
                seg = seg.replace(/\s+\d+t$/i, "").trim();
                if (!seg) return "";
                if (!icon) icon = advIconOf(camp && camp.statuses, seg).trim();
                if (kind === "statusoff") {
                    return '<span class="adv-macro-status adv-macro-status-off">' +
                        (icon ? esc(icon) + " " : "") + esc(seg) +
                        ' <span class="adv-macro-status-removed">' +
                        advStatusoffWord(seg) + "</span></span>";
                }
                return '<span class="adv-macro-status">' +
                    (icon ? esc(icon) + " " : "\u2728 ") + esc(seg) + "</span>";
            }).filter(Boolean).join(" ");
        }
        // music: invisible anchor - the crossfading soundtrack is its own
        // announcement
        return "";
    }

    /* The renderer leaves an invisible zero-size anchor (adv-macromark)
     * where a state macro was streamed, so a delta chip triggered by that
     * macro can bloom right under the words that caused it instead of in
     * the center stack. Tool-driven changes have no anchor - they keep the
     * center popup. Name matching is case-insensitive containment in the
     * macro's raw text (which may comma-chain several deltas); the last
     * anchor in the current turn wins, being closest to the diff. */
    function markerOrigin(kinds, name) {
        var scope = document.querySelector("#messages .turn.adv-current");
        if (!scope || !name) return null;
        var lower = String(name).toLowerCase();
        for (var i = 0; i < kinds.length; i++) {
            var marks = scope.querySelectorAll('.adv-macromark[data-kind="' + kinds[i] + '"]');
            for (var j = marks.length - 1; j >= 0; j--) {
                var dt = (marks[j].getAttribute("data-text") || "").toLowerCase();
                if (dt.indexOf(lower) !== -1) return marks[j].getBoundingClientRect();
            }
        }
        return null;
    }

    function registerMarkedExtensions() {
        if (typeof window.marked === "undefined" || !window.marked.use) {
            setTimeout(registerMarkedExtensions, 250);
            return;
        }
        window.marked.use({ extensions: [
            {
                name: "advWiki",
                level: "inline",
                start: function (src) {
                    var i = src.indexOf("[[");
                    return i === -1 ? undefined : i;
                },
                tokenizer: function (src) {
                    if (!advActiveNow()) return undefined;
                    var m = /^\[\[([^\[\]]+)\]\]/.exec(src);
                    if (m) return { type: "advWiki", raw: m[0], inner: m[1] };
                    m = WIKI_PARTIAL_RE.exec(src);
                    if (m) return { type: "advWiki", raw: m[0], inner: m[1], partial: true };
                    return undefined;
                },
                renderer: function (token) {
                    if (token.partial) {
                        // the link-in-progress render (same concept as the
                        // partial flavor macros): it wears the choice look
                        // from its very first character, but stays inert -
                        // a span, never a click target - until the real ]]
                        // lands and the complete token takes over. the
                        // display side lives after the pipe; before the
                        // pipe resolves there is nothing visible of it yet.
                        var disp = String(token.inner || "");
                        var p = disp.indexOf("|");
                        if (p !== -1) disp = disp.slice(p + 1);
                        if (!disp.trim()) return "";
                        return '<span class="adv-choice adv-choice-pending">' +
                            esc(disp) + "</span>";
                    }
                    return makeChoiceAnchor(token.inner).outerHTML;
                }
            },
            {
                name: "advMacro",
                level: "inline",
                start: function (src) {
                    var i = src.indexOf("{{");
                    return i === -1 ? undefined : i;
                },
                tokenizer: function (src) {
                    if (!advActiveNow()) return undefined;
                    var m = GLYPH_MACRO_RE.exec(src);
                    if (m) return { type: "advMacro", raw: m[0], kind: m[1], text: m[2] };
                    m = PULSE_MACRO_RE.exec(src);
                    if (m) return { type: "advMacro", raw: m[0], kind: m[1], text: m[2] || "" };
                    if (GLYPH_PARTIAL_RE) {
                        m = GLYPH_PARTIAL_RE.exec(src);
                        if (m) return { type: "advMacro", raw: m[0], kind: m[1], text: m[2], partial: true };
                    }
                    // nothing in the vocabulary owns this kind: its body is
                    // still prose - render it plain (partial included, so a
                    // streaming made-up macro shows its words from the
                    // first keystroke, never raw braces)
                    m = UNKNOWN_MACRO_RE.exec(src);
                    if (m) return { type: "advMacro", raw: m[0], kind: "", text: m[1], plain: true };
                    m = UNKNOWN_PARTIAL_RE.exec(src);
                    if (m) return { type: "advMacro", raw: m[0], kind: "", text: m[1], plain: true };
                    return undefined;
                },
                renderer: function (token) {
                    if (token.plain)
                        // a hallucinated kind: just its words, no markup
                        return esc(token.text);
                    if (token.kind === "img") {
                        // {{img|name}} or {{img|name|left|right|center}}: the
                        // side places the frame - left/right float the picture
                        // beside the paragraph the macro sits in (prose wraps
                        // around it), center (the default) owns its full-width
                        // block line. resolved now -> real src; unknown/not-yet-
                        // loaded -> a data-img placeholder advFillImgs swaps
                        // for the picture the instant the map lands (or the
                        // name shows as a caption if it is genuinely missing).
                        var bits = String(token.text || "").split("|");
                        var name = bits[0].trim();
                        var side = bits.length > 1 ? bits[1].trim().toLowerCase() : "";
                        var cls = (side === "left" || side === "right")
                            ? " adv-img-" + side : "";
                        var src = window.advImgSrc ? window.advImgSrc(name) : "";
                        var label = esc(name.replace(/_/g, " "));
                        var attrs = 'class="adv-img" alt="' + label + '" loading="lazy"';
                        if (src) return '<span class="adv-img-wrap' + cls + '"><img ' + attrs +
                            ' src="' + esc(src) + '"></span>';
                        return '<span class="adv-img-wrap' + cls + '"><img ' + attrs +
                            ' data-img="' + esc(name.toLowerCase()) + '">' +
                            '<span class="adv-img-pending">\u{1F5BC} ' + label + "</span></span>";
                    }
                    if (token.kind === "sfx") {
                        var sn = String(token.text || "").trim().toLowerCase();
                        // a cue the campaign's set does not carry hides
                        // entirely - a speaker tag for a sound that can
                        // never play is just noise (advSfxKnown answers
                        // true while the map is still in flight; the
                        // data-sfx tag lets advPruneSfx sweep chips that
                        // rendered before the map landed)
                        if (window.advSfxKnown && !window.advSfxKnown(sn)) return "";
                        // audio is NOT fired here: the typewriter's reveal
                        // scan (adventure_type.js) cues every macro exactly
                        // once, the instant its closing braces reveal -
                        // position-based, so the same sound may play again
                        // later in the SAME passage. on screen the sound
                        // signs itself: a speaker tag, underscores softened
                        return '<span class="adv-macro adv-macro-sfx" data-sfx="' + esc(sn) +
                            '">\u{1F50A} ' + esc(sn.replace(/_/g, " ")) + "</span>";
                    }
                    if (STATE_MACRO_KINDS[token.kind]) {
                        // world mutation, fired at detection time: the POST
                        // goes out the instant the macro streams past (see
                        // advStateMacro above); the sidebar catches the new
                        // value on its next heartbeat and pops the delta
                        // chip at this anchor - right where the words that
                        // changed it sit. item and stat macros also leave
                        // a visible echo in the prose itself (icon + name,
                        // a signed pill); the other kinds stay invisible -
                        // they announce themselves on screen already
                        advStateMacro(token.kind, token.text);
                        var inner = advMacroInner(token.kind, token.text);
                        return '<span class="adv-macromark' + (inner ? " adv-shown" : "") +
                            '" data-kind="' + token.kind +
                            '" data-text="' + esc(token.text) + '">' + inner + "</span>";
                    }
                    if (window.AdvFX ? window.AdvFX.pulseKnown(token.kind)
                        : (token.kind === "flash" || token.kind === "poof")) {
                        // one-shot overlay pulse (built-in or shipped by
                        // the campaign's set), no glyph. nothing fires
                        // here: the typewriter's reveal scan
                        // (adventure_type.js) cues each pulse exactly once,
                        // the instant its closing braces reveal - so a
                        // pulse may repeat within the same passage.
                        // a tolerated |tail lands as plain prose.
                        if (token.text) return esc(token.text);
                        return "";
                    }
                    if (window.AdvFX && AdvFX.tdRender &&
                            AdvFX.tdRender(token.kind) === "sparkle")
                        return sparkleHTML(token.text);
                    // every other decoration: a plain span its css sheet skins
                    // (a sheetless kind that slipped through the regex stays a
                    // harmless unstyled span)
                    return '<span class="adv-macro adv-macro-' + token.kind + '">' + esc(token.text) + "</span>";
                }
            },
            {
                name: "advSpeaker",
                level: "inline",
                start: function (src) {
                    var i = src.indexOf("**");
                    return i === -1 ? undefined : i;
                },
                tokenizer: function (src) {
                    if (!advActiveNow()) return undefined;
                    var m = SPEAKER_RE.exec(src);
                    if (!m) return undefined;
                    // the spoken words are re-lexed as inline markdown, so
                    // macros and wiki links inside dialogue keep working
                    return {
                        type: "advSpeaker", raw: m[0], name: m[1],
                        tokens: this.lexer.inlineTokens(m[2], [])
                    };
                },
                renderer: function (token) {
                    var st = null;
                    try { st = Alpine.store("adv"); } catch (e) {}
                    var c = st && st.active ? st.campaign : null;
                    var color = advSpeakerColor(token.name, advPalVars(c ? c.palette : null));
                    return '<span class="adv-dialogue" style="color:' + color + '">'
                        + '<strong class="adv-speaker">' + esc(token.name) + ':</strong>'
                        + this.parser.parseInline(token.tokens) + "</span>";
                }
            }
        ] });
    }
    registerMarkedExtensions();

    /* -------------------------
     * custom story prompt: the core #input is hidden in adventure mode
     * (moving it into the Alpine-managed turn subtree was fragile - x-for
     * re-renders could strand it inside a hidden turn). Instead the page
     * gets its own custom form: a slim single-line input + send button that
     * docks as the last entry of the current passage's choice rail, or as
     * the page footer when there are no choices.
     * ------------------------- */
    function promptBar() {
        var el = document.getElementById("adv-prompt");
        if (el) return el;
        el = document.createElement("form");
        el.id = "adv-prompt";
        // .adv-choice so the rail paints it as just another option; the
        // chevron arrives via ::before, like the other entries
        el.className = "adv-choice";
        el.innerHTML = '<input type="text" autocomplete="off" placeholder="Or do something else\u2026" aria-label="Or do something else">'
            + '<button type="submit">Send</button>';
        el.addEventListener("submit", function (e) {
            e.preventDefault();
            var inp = el.querySelector("input");
            var text = inp.value.trim();
            if (!text) return;
            var busy = false;
            try { busy = Alpine.store("stream").state !== "idle"; } catch (err) {}
            if (busy) return;
            inp.value = "";
            try {
                Alpine.store("chat").send(text);
                try { window.dispatchEvent(new CustomEvent("adv:choice")); } catch (e2) {}
            } catch (err) {
                console.warn("adventure_games: prompt send failed", err);
            }
            inp.focus();
        });
        document.body.appendChild(el);
        return el;
    }

    // the last block on the page that holds choice links: the consolidated
    // rail if it formed, else the final paragraph containing .adv-choice
    function choiceAnchor(card) {
        var rail = card.querySelector(".adv-choices");
        if (rail) return rail;
        var anchor = null;
        for (var i = 0; i < card.children.length; i++) {
            var k = card.children[i];
            if (k.id === "adv-prompt") continue;
            if (k.querySelector && k.querySelector(".adv-choice")) anchor = k;
        }
        return anchor;
    }

    function dockInput() {
        var bar = promptBar();
        var card = document.querySelector("#messages .turn.adv-current .message.assistant");
        if (!card) {
            // no passage card yet (welcome screen): keep the bar parked
            undockInput();
            return;
        }
        // the custom prompt is the last entry OF the [[actions]] list when
        // the passage has one - inside the rail, so it shares the pill
        // column's width and spacing; passages without choices fall back to
        // the pinned page footer.
        var anchor = choiceAnchor(card);
        if (anchor) {
            bar.classList.remove("footer");
            // (re-)append even when already inside, if the rail folded it
            // in mid-list - the prompt is always the last entry
            if (bar.parentNode !== anchor || anchor.lastElementChild !== bar) {
                anchor.appendChild(bar);
            }
            bar.classList.add("on");
        } else {
            // no choices on this page: the floating footer prompt must not
            // haunt the GM mid-sentence - it only appears once the stream
            // has settled and the passage truly offers nothing to click.
            // (The observer fires another dock when the last delta lands.)
            var busy = false;
            try { busy = Alpine.store("stream").state !== "idle"; } catch (err) {}
            if (busy) {
                undockInput();
                return;
            }
            bar.classList.add("footer");
            if (bar.parentNode !== card) card.appendChild(bar);
            bar.classList.add("on");
        }
    }

    function undockInput() {
        var bar = document.getElementById("adv-prompt");
        if (!bar) return;
        bar.classList.remove("on");
        if (bar.parentNode !== document.body) document.body.appendChild(bar);
    }

    /* -------------------------
     * mode curtain: a full-screen fade used only when the adventure mode
     * actually flips. The heavy swap (theme vars, header, passage view,
     * input dock) happens while the screen is dark, so the interface never
     * pops into existence - it is revealed. Skipped on page load (the mode
     * is established silently) and under reduced-motion.
     * ------------------------- */
    var modeTransition = false;
    var curtainArmed = false;
    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    function curtainSwap(store) {
        modeTransition = true;
        var c = document.getElementById("adv-curtain");
        if (!c) {
            c = document.createElement("div");
            c.id = "adv-curtain";
            document.body.appendChild(c);
        }
        // fade the current world to black
        c.classList.add("on");
        setTimeout(function () {
            // behind the cover: swap everything (applyMode -> theme,
            // banner, dock, adv:state watchers all run now)
            store._applyModeNow();
            // let the freshly painted interface settle one frame, then lift
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { c.classList.remove("on"); });
            });
        }, 360);
        setTimeout(function () { modeTransition = false; }, 800);
    }

    /* -------------------------
     * choice clicks
     * ------------------------- */
    document.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest(".adv-choice");
        if (!a) return;
        // the prompt form wears .adv-choice so the rail paints it as another
        // entry, but it submits through its own handler - never here
        if (a.id === "adv-prompt" || a.closest("#adv-prompt")) return;
        e.preventDefault();
        // a choice still being written has no send target yet: inert
        if (a.classList.contains("adv-choice-pending")) return;
        if (a.classList.contains("adv-disabled")) return;

        var busy = false;
        try { busy = Alpine.store("stream").state !== "idle"; } catch (err) {}
        if (busy) return;

        try {
            Alpine.store("chat").send(a.dataset.send);
            try { window.dispatchEvent(new CustomEvent("adv:choice")); } catch (e2) {}
        } catch (err) {
            console.warn("adventure_games: send failed", err);
        }
    }, true);

    /* -------------------------
     * fx: delta chips + dice
     * ------------------------- */
    function fxLayer() {
        var el = document.getElementById("adv-fx");
        if (!el) {
            el = document.createElement("div");
            el.id = "adv-fx";
            document.body.appendChild(el);
        }
        /* anchor exactly like the thinking rune: centered in the CHAT
           WINDOW, not the viewport - the sidebar shifts the story column,
           so a plain 50% sits visibly left of the rune. the CSS keeps the
           transform (-50%/-100%); top here replaces its 50%-minus-offset,
           re-measured every time a popup shows (sidebar toggles included) */
        var win = document.getElementById("chat-window");
        if (win) {
            var r = win.getBoundingClientRect();
            el.style.left = (r.left + r.width / 2) + "px";
            el.style.top = (r.top + r.height / 2 - 84) + "px";
        }
        return el;
    }

    function showChip(text, bad, origin) {
        // the macro trigger already paused the typewriter for this badge
        // (advStateMacro); the chip's arrival re-arms the same key, so the
        // prose waits for the pop to be READABLE and resumes as the fade
        // begins; one key for the whole volley, extended with each chip
        if (window.AdvType) window.AdvType.hold("badge", 1300);
        // phones keep a short queue: the oldest badge gives up its slot so
        // a big volley of stat changes never stacks a wall of popups
        if (window.AdvPerf) {
            var mx = AdvPerf.chipMax();
            if (mx > 0) {
                var liveChips = document.querySelectorAll(".adv-chip");
                for (var cull = liveChips.length - mx + 1, ci = 0; ci < cull; ci++) liveChips[ci].remove();
            }
        }
        var chip = document.createElement("div");
        chip.className = "adv-chip" + (bad ? " adv-chip-bad" : "");
        chip.textContent = text;
        if (origin) {
            // macro-triggered: bloom above the spot in the passage where
            // the macro was streamed. the chip's own keyframes own its
            // transform, so a zero-size fixed holder does the centering
            var holder = document.createElement("div");
            holder.className = "adv-chip-at";
            holder.style.left = (origin.left + origin.width / 2) + "px";
            holder.style.top = (origin.top - 4) + "px";
            holder.appendChild(chip);
            document.body.appendChild(holder);
            setTimeout(function () { holder.remove(); }, 1600);
            return;
        }
        fxLayer().appendChild(chip);
        setTimeout(function () { chip.remove(); }, 1600);
    }

    /* center-screen dice flourish: two dice fall from above, bounce and roll
       to rest on an invisible floor line; a beat later the final total
       replaces them; it holds until the GM starts typing the outcome, then
       fades away */
    var drTimers = [];
    function drClear() {
        drTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
        drTimers = [];
    }
    function currentPassageLength() {
        var turns = document.querySelectorAll("#messages .turn");
        var last = turns[turns.length - 1];
        return last && last.textContent ? last.textContent.length : 0;
    }
    var drLive = null;
    var drBorn = 0;
    var drStartLen = 0;
    function drTotalText(roll) {
        if (roll.kind === "coin") {
            var s = String(roll.side || "");
            return s.charAt(0).toUpperCase() + s.slice(1);
        }
        return roll.total;
    }
    function drSetTotal(root, roll) {
        var t = root.querySelector(".adv-dr-total");
        if (t) t.textContent = drTotalText(roll);
        var rsn = root.querySelector(".adv-dr-reason");
        if (roll.reason) {
            if (!rsn) {
                rsn = document.createElement("div");
                rsn.className = "adv-dr-reason";
                root.appendChild(rsn);
            }
            rsn.innerHTML = esc(roll.reason);
        } else if (rsn) {
            rsn.remove();
        }
    }
    function drPulseTotal(root) {
        var t = root.querySelector(".adv-dr-total");
        if (!t) return;
        t.style.animation = "none";
        void t.offsetWidth;
        t.style.animation = "";
    }
    function showDice(roll) {
        var root = document.getElementById("adv-diceroll");
        var phase = root ? root.className : "";
        if (phase.indexOf("rolling") === 0 || phase === "show-total") {
            /* another roll landed while this flourish is still up (GM rolls
               several times a turn). fold it in instead of restarting, so
               the total never turns back into tumbling dice: still-rolling
               dice adopt the new total for their landing, and a visible
               total just pops to the new number. */
            drLive = roll;
            drBorn = Date.now();
            drStartLen = currentPassageLength();
            if (phase === "show-total") {
                drSetTotal(root, roll);
                drPulseTotal(root);
                // this folded-in roll is visible at once - release the
                // tool call the backend is pacing on it
                if (window.AdvBeats) window.AdvBeats.ack("dice");
            }
            return;
        }
        drClear();
        if (!root) {
            root = document.createElement("div");
            root.id = "adv-diceroll";
            document.body.appendChild(root);
        }
        /* hug the overlay to the CHAT WINDOW like the thinking rune and the
           popup stack do - the sidebar shifts the story column, so the
           viewport's 50% is not the story's center. with the overlay boxed
           to the window, every left:50%/top:50% child (dice, total, reason,
           floor line) centers on the story automatically; inline w/h beat
           the CSS inset's right/bottom, and the dimming follows the stage.
           re-measured per roll, so sidebar toggles are absorbed */
        var win = document.getElementById("chat-window");
        if (win) {
            var rect = win.getBoundingClientRect();
            root.style.left = rect.left + "px";
            root.style.top = rect.top + "px";
            root.style.width = rect.width + "px";
            root.style.height = rect.height + "px";
        } else {
            root.style.left = root.style.top = "";
            root.style.width = root.style.height = "";
        }
        drLive = roll;
        var coin = roll.kind === "coin";
        // the pack may dress the performers differently: dice/<name>.json
        // carries glyph overrides - six "faces" and the coin's "heads"/
        // "tails" (dice.json asset, folded by AdvFX). Built-in unicode
        // pips and the sun/moon coin stay when the pack ships none.
        var look = (window.AdvFX && window.AdvFX.diceLook) ? (window.AdvFX.diceLook() || {}) : {};
        var faces = (look.faces && look.faces.length) ? look.faces
            : ["\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];
        var heads = look.heads || "\u2600";
        var tails = look.tails || "\u263E";
        root.innerHTML =
            (coin
                ? '<div class="adv-dr-coinwrap"><div class="adv-dr-coin">'
                    + '<span class="adv-dr-coin-face adv-dr-coin-heads">' + esc(heads) + "</span>"
                    + '<span class="adv-dr-coin-face adv-dr-coin-tails">' + esc(tails) + "</span>"
                    + "</div></div>"
                : '<div class="adv-dr-dice"><span class="adv-dr-die adv-die-a">' + esc(faces[3] || faces[0]) + "</span>"
                    + '<span class="adv-dr-die adv-die-b">' + esc(faces[1] || faces[0]) + "</span></div>") +
            '<div class="adv-dr-floor"></div>' +
            '<div class="adv-dr-total">' + drTotalText(roll) + "</div>" +
            (roll.reason ? '<div class="adv-dr-reason">' + esc(roll.reason) + "</div>" : "");
        /* the side class decides where the coin finally lands (which face
           ends turned toward the player); dice just roll */
        root.className = coin ? "rolling adv-dr-is-" + (roll.side === "tails" ? "tails" : "heads") : "rolling";

        var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var dice = root.querySelectorAll(".adv-dr-die");
        if (!reduced && dice.length) {
            // faces array hoisted to the roll's glyph spec above; the
            // modulo keeps a short custom faces list fully in bounds
            var setFaces = function () {
                dice[0].textContent = faces[Math.floor(Math.random() * 6) % faces.length];
                dice[1].textContent = faces[Math.floor(Math.random() * 6) % faces.length];
            };
            setFaces();
            /* faces flash fast while falling, slower as friction takes hold
               (phones tick the faces at half the rate - a re-roll every
               140ms reads just as tumble-y, at half the paint cost) */
            var mul = window.AdvPerf ? AdvPerf.diceTickMul() : 1;
            var ivFast = setInterval(setFaces, 70 * mul);
            drTimers.push(ivFast);
            drTimers.push(setTimeout(function () {
                clearInterval(ivFast);
                var ivMid = setInterval(setFaces, 150 * mul);
                drTimers.push(ivMid);
                drTimers.push(setTimeout(function () {
                    clearInterval(ivMid);
                    var ivSlow = setInterval(setFaces, 280 * mul);
                    drTimers.push(ivSlow);
                    drTimers.push(setTimeout(function () { clearInterval(ivSlow); }, 1490));
                }, 400));
            }, 880));
        }
        /* the dice animation comes to rest at 1500ms; let them sit on the
           floor for a good beat before the total replaces them (the latest
           folded-in roll, if any) */
        drTimers.push(setTimeout(function () {
            drSetTotal(root, drLive || roll);
            root.className = "show-total";
            // the result is on screen: release the roll_dice / coinflip
            // tool call the backend is pacing on this flourish
            if (window.AdvBeats) window.AdvBeats.ack("dice");
        }, reduced ? 0 : 2600));

        drBorn = Date.now();
        drStartLen = currentPassageLength();
        var watch = setInterval(function () {
            var age = Date.now() - drBorn;
            var narrating = currentPassageLength() > drStartLen + 40;
            /* never cut the total short: it only appears at 2600ms, so the
               early exit waits until the number has held ~1 full second */
            if (age > 5000 || (age > 3700 && narrating)) {
                clearInterval(watch);
                root.className = "out";
                drTimers.push(setTimeout(function () { root.className = ""; }, 600));
            }
        }, 140);
        drTimers.push(watch);
    }

    function showDeltas(prev, next) {
        var fx = { stats: [], gained: [], lost: [] };
        Object.keys(next.stats || {}).forEach(function (name) {
            var oldV = prev.stats && prev.stats[name] ? prev.stats[name].value : null;
            if (oldV === null) {
                // brand-new stat (stat_add): announce the unlock
                var nicon = next.stats[name].icon ? next.stats[name].icon + " " : "";
                showChip("\u2728 " + nicon + name, false);
                return;
            }
            if (oldV === next.stats[name].value) return;
            var d = next.stats[name].value - oldV;
            var icon = next.stats[name].icon ? next.stats[name].icon + " " : "";
            showChip(icon + name + " " + (d > 0 ? "+" : "") + d, d < 0, markerOrigin(["stat"], name));
            fx.stats.push({ name: name, delta: d });
            var row = document.querySelector('.adv-panel [data-stat="' + CSS.escape(name) + '"]');
            if (row) {
                row.classList.add("adv-flash");
                setTimeout(function () { row.classList.remove("adv-flash"); }, 950);
            }
        });
        Object.keys(next.inventory || {}).forEach(function (name) {
            var had = prev.inventory && prev.inventory[name];
            if (had) return;
            var icon = next.inventory[name].icon ? next.inventory[name].icon + " " : "";
            showChip("\u{1F392} " + icon + name, false, markerOrigin(["item"], name));
            fx.gained.push(name);
        });
        Object.keys(prev.inventory || {}).forEach(function (name) {
            if (next.inventory && next.inventory[name]) return;
            showChip("\u{1F392} " + name + " lost", true, markerOrigin(["item"], name));
            fx.lost.push(name);
        });
        Object.keys(prev.stats || {}).forEach(function (name) {
            if (next.stats && next.stats[name]) return;
            showChip(name + " gone", true);
        });
        // status conditions appearing / clearing
        Object.keys(next.statuses || {}).forEach(function (name) {
            if (prev.statuses && prev.statuses[name]) return;
            var s = next.statuses[name];
            showChip((s.icon ? s.icon + " " : "") + name, false, markerOrigin(["status"], name));
        });
        Object.keys(prev.statuses || {}).forEach(function (name) {
            if (next.statuses && next.statuses[name]) return;
            showChip(name + " cleared", true, markerOrigin(["statusoff"], name));
        });
        // quests: new, advanced, resolved
        Object.keys(next.quests || {}).forEach(function (name) {
            var q = next.quests[name];
            var old = prev.quests && prev.quests[name];
            if (!old) {
                showChip("\u{1F4DC} " + (q.icon ? q.icon + " " : "") + name, false);
            } else if (q.status === "done" && old.status !== "done") {
                showChip("\u2714 " + name, false);
            } else if (q.status === "failed" && old.status !== "failed") {
                showChip("\u2716 " + name, true);
            } else if (q.status === "active" && (q.subgoals || []).length) {
                // a beat just ticked off: show the running tally. the quest's
                // final beat lands in the "done" branch above instead, since
                // the backend closes the quest in the same stroke
                var wasDone = 0, nowDone = 0;
                (old.subgoals || []).forEach(function (g) { if (g.done) wasDone++; });
                (q.subgoals || []).forEach(function (g) { if (g.done) nowDone++; });
                if (nowDone > wasDone)
                    showChip("\u{1F4DC} " + name + " \u2611 " + nowDone + "/" + q.subgoals.length, false);
            }
        });
        // scene moves get no chip anymore - the title card
        // (adventure_beats.js) is the scene's announcement now
        try { window.dispatchEvent(new CustomEvent("adv:delta", { detail: fx })); } catch (e) {}
    }

    /* -------------------------
     * websocket + DOM hooks
     * ------------------------- */
    function wrapSocket() {
        if (typeof window.handleWebSocketMessage !== "function") {
            setTimeout(wrapSocket, 200);
            return;
        }
        var orig = window.handleWebSocketMessage;
        window.handleWebSocketMessage = function (data) {
            var result = orig.apply(this, arguments);
            try {
                var t = data && data.type;
                if (t === "stream_complete") {
                    setTimeout(function () {
                        A().refresh(null, true).then(function () {
                            return A().consumeRoll(null);
                        });
                    }, 250);
                } else if (t === "chat_switched") {
                    A()._prev = null;
                    setTimeout(function () { A().refresh(data.id, false); }, 250);
                } else if (t === "adv:campaign") {
                    /* backend push: this chat's campaign appeared, vanished
                       or changed pause state. the type is unknown to the
                       core switch, so the frame arrives untouched; other
                       chats' frames are ignored - switching to them refreshes
                       through the chat_switched branch anyway. */
                    var sel = null;
                    try { sel = Alpine.store("chat").selectedChat; } catch (e) {}
                    if (data.chat && String(data.chat) === String(sel)) {
                        A().refresh(data.chat, false);
                    }
                }
            } catch (e) {}
            return result;
        };
    }

    var moPending = null;
    function onMessagesChanged() {
        if (moPending) return;
        moPending = setTimeout(function () {
            moPending = null;
            advMarkCurrent();
            // no content conversion here anymore: marked extensions handle
            // wiki links / macros / speakers as the message is rendered
            // patch in any scene-art that was still waiting on the url map
            advFillImgs();
            // ceremony backup net: plus.js's synchronous observer usually
            // claims this first, but the scan is idempotent either way
            advScanNewImgs();
            // x-for re-renders can drop the docked prompt bar; re-home it
            if (adv.active) dockInput();
        }, 80);
    }

    var observerAttached = false;
    function boot(retries) {
        var messages = document.getElementById("messages");
        if (messages && !observerAttached) {
            observerAttached = true;
            new MutationObserver(onMessagesChanged).observe(messages, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
        // placeholder may not exist at boot yet
        setTimeout(function () { adv.paintPlaceholder(); }, 600);

        // the chat store loads asynchronously after Alpine boots; wait for it
        var chatId = null;
        try { chatId = Alpine.store("chat").selectedChat; } catch (e) {}
        if (!chatId && retries > 0) {
            setTimeout(function () { boot(retries - 1); }, 300);
            return;
        }
        advMarkCurrent();
        A().refresh(null, false).then(function () {
            A()._ready = true;
        });
    }

    wrapSocket();

    // alpine.min.js loads with `defer`, so window.Alpine does not exist yet
    // while this classic script parses. registering on the alpine:init event
    // (same pattern as the core init.js) guarantees $store.adv is present by
    // the time any component expression evaluates for the first time.
    function startUp() {
        Alpine.store("adv", adv);
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", function () { boot(40); });
        } else {
            boot(40);
        }
    }
    // Live sync: a plain heartbeat instead of an Alpine.effect on the stream
    // store. The effect version only started polling once adv.active was
    // already true - so set_scene fired mid-stream stayed invisible until
    // the stream finished. Chats WITHOUT a campaign are never polled at
    // all: game_start pushes an adv:campaign websocket frame (handled in
    // wrapSocket) that activates the passage view instantly and silently.
    var syncBusy = false;
    setInterval(function () {
        if (!window.Alpine || syncBusy) return;
        var st = null;
        try { st = Alpine.store("adv"); } catch (e) { return; }
        if (!st || !st._ready) return;
        /* safety sweep for reload paths without the stream_complete hook
           (chat switches, sync): re-append mid-turn prose that the backend
           history renders into hidden chain steps. no-op once a turn has
           been repaired, so this is cheap even at idle */
        if (st.active) advRepairPassage();
        /* a cleared chat is a cleared campaign */
        if (st.campaign) advDetectClear();
        var busy = false;
        try { busy = Alpine.store("stream").state !== "idle"; } catch (e) { return; }
        if (!busy) return;
        if (!st.active) return;
        syncBusy = true;
        function done() { syncBusy = false; }
        st.refresh(null, true)
            .then(function () { return st.consumeRoll(null); })
            .then(done, done);
    }, 450);

    if (window.Alpine) {
        startUp();
    } else {
        document.addEventListener("alpine:init", startUp);
    }

    /* sidebar panel Alpine data */
    window.advPanel = function () {
        return {
            get campaign() {
                var s = Alpine.store("adv");
                return s ? s.campaign : null;
            },
            barWidth: function (s) {
                if (s.max == null) return "0%";
                var min = s.min != null ? s.min : 0;
                var pct = ((s.value - min) / (s.max - min)) * 100;
                return Math.max(0, Math.min(100, pct)) + "%";
            },
            isLow: function (s) {
                if (s.max == null) return false;
                var min = s.min != null ? s.min : 0;
                return (s.value - min) / (s.max - min) <= 0.25;
            },
            // bar stats (value/max) first, plain counters grouped below;
            // stable order within each group
            statList: function () {
                var c = this.campaign;
                if (!c) return [];
                var out = [];
                Object.keys(c.stats || {}).forEach(function (name) {
                    out.push({ name: name, s: c.stats[name] });
                });
                out.sort(function (a, b) {
                    return (a.s.max != null ? 0 : 1) - (b.s.max != null ? 0 : 1);
                });
                return out;
            },
            rewind: function () { Alpine.store("adv").rewindLast(); },
            journal: function () { Alpine.store("ui").openModal("adventure_journal"); },
            exit: function () { Alpine.store("adv").exitAdventure(); },
            reenter: function () { Alpine.store("adv").reenterAdventure(); },
            dayPart: function (hour) {
                var h = hour | 0;
                if (h >= 5 && h < 8) return "· dawn";
                if (h >= 8 && h < 12) return "· morning";
                if (h >= 12 && h < 17) return "· afternoon";
                if (h >= 17 && h < 20) return "· dusk";
                if (h >= 20) return "· night";
                return "· deep night";
            },
            get active() {
                var s = Alpine.store("adv");
                return s ? s.active : false;
            }
        };
    };
})();
