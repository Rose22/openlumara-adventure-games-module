/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-08) harness:openlumara
   adventure_games :: immersion layer. Theme override, day/night tint,
   sky & weather particles, ambience + synthesized SFX, AI banner, text
   macros, per-speaker colors, choice rail, forced sidebar, campaign
   launcher. */
(function () {
    var cfg = window.ADV_CONFIG || {};

    function A() { try { return Alpine.store("adv"); } catch (e) { return null; } }
    function reducedMotion() {
        return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    function streamBusy() {
        try { return Alpine.store("stream").state !== "idle"; } catch (e) { return false; }
    }
    // the webui's current dark/light mode
    function webuiMode() {
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
    // campaign palettes carry light+dark variants; resolve the one matching
    // the webui mode (custom flat dict palettes pass through unchanged)
    function palVars(pal) {
        if (!pal) return null;
        if (pal.variants) return pal.variants[webuiMode()] || pal.variants.dark;
        return pal;
    }

    /* -------------------------
     * campaign identity: full webui + passage theme override.
     * Written as INLINE vars on <html>: the core theme store also writes
     * its palette inline, so a stylesheet at :root loses to it - which is
     * why the sidebar background and primary page color used to ignore the
     * campaign palette.
     * ------------------------- */
    var advVarKeys = null;
    function clearThemeVars() {
        if (!advVarKeys) return;
        var root = document.documentElement;
        advVarKeys.forEach(function (k) { root.style.removeProperty(k); });
        advVarKeys = null;
        // the core theme store ALSO writes its palette inline on <html> -
        // the campaign vars overwrote those values, so simply removing our
        // keys would leave holes. ask the store to re-apply its own values.
        try {
            var t = Alpine.store("theme");
            if (t && typeof t.apply === "function") t.apply(t.family, t.mode);
        } catch (e) {}
    }
    function applyTheme() {
        var st = A();
        var c = st && st.active ? st.campaign : null;
        var p = c && c.palette ? palVars(c.palette) : null;
        if (!c || !p) {
            clearThemeVars();
            return;
        }
        var vars = {
            "--adv-accent": p.accent, "--adv-link": p.link, "--adv-link-hover": p.link_hover,
            "--adv-page": p.page, "--adv-ink": p.ink, "--adv-ink-soft": p.ink_soft, "--adv-line": p.line,
            "--bg-primary": p.ui_bg1, "--bg-secondary": p.ui_bg2, "--bg-tertiary": p.ui_bg3,
            "--bg-message-ai": p.page, "--bg-sidebar": p.ui_bg1, "--bg-input": p.ui_bg2,
            "--text-primary": p.ui_text, "--text-secondary": p.ui_text_soft, "--text-muted": p.ui_text_muted,
            "--border-color": p.ui_border, "--border-message": p.ui_border, "--border-sidebar": p.ui_border,
            "--accent": p.accent
        };
        if (c.font) {
            // the campaign font must ride the module's OWN text channels:
            // the passage is styled with --adv-serif and all chrome (the
            // banner, headings, chips, the panel, the journal) with
            // --adv-sans, both defined on :root inside adventure_games.css
            // - so --font-primary alone never touched the story text. The
            // inline write wins over the sheet, and clearThemeVars hands
            // both names back to the module on game exit; --font-primary/
            // --font-display keep the surrounding core UI in step.
            vars["--adv-serif"] = c.font;
            vars["--adv-sans"] = c.font;
            vars["--font-primary"] = c.font;
            vars["--font-display"] = c.font;
        }
        var root = document.documentElement;
        var keys = Object.keys(vars);
        if (advVarKeys && advVarKeys.length === keys.length
            && keys.every(function (k) { return root.style.getPropertyValue(k) === vars[k]; })) {
            return; // unchanged (fires often from the live-sync heartbeat)
        }
        clearThemeVars();
        advVarKeys = keys;
        keys.forEach(function (k) { root.style.setProperty(k, vars[k]); });
    }

    /* -------------------------
     * real font files (fonts/ asset kind). The /fonts route hands over
     * the campaign pack's real font files (over the default base) as
     * name -> {family, urls:[{url, format}]}; every stem gets an
     * @font-face registered under its family ("adv-<name>"), and the
     * campaign's resolved font stack - baked server-side by game_start -
     * already names that family, so applyTheme's --font-primary picks
     * it up the moment the face lands. Plain text stacks
     * (fonts/<name>.txt) resolve entirely in the backend and need
     * nothing here.
     * ------------------------- */
    var fontGen = 0, fontFetching = false;
    function advFontsQ() {
        var chat = null;
        try { chat = Alpine.store("chat").selectedChat; } catch (e) {}
        return chat ? ("?chat=" + encodeURIComponent(chat)) : "";
    }
    function advLoadFontFaces() {
        if (fontFetching) return;
        // simpleApiFetch is a core global that may not exist this early
        // (classic scripts run at parse time) - retry until it shows up
        if (typeof simpleApiFetch !== "function") { setTimeout(advLoadFontFaces, 300); return; }
        fontFetching = true;
        var gen = fontGen;
        simpleApiFetch("/api/ext/adventure_games/fonts" + advFontsQ())
            .then(function (d) {
                fontFetching = false;
                if (gen !== fontGen) { advLoadFontFaces(); return; }   // raced a set switch
                var faces = (d && d.fonts) || {};
                var css = "";
                Object.keys(faces).forEach(function (name) {
                    var f = faces[name] || {};
                    var urls = f.urls || [];
                    if (!f.family || !urls.length) return;
                    var src = urls.map(function (u) {
                        return "url('" + u.url + "')" +
                            (u.format ? " format('" + u.format + "')" : "");
                    }).join(",");
                    css += "@font-face{font-family:'" + f.family + "';src:" + src +
                        ";font-display:swap;font-style:normal;}\n";
                });
                var el = document.getElementById("adv-font-faces");
                if (!el) {
                    el = document.createElement("style");
                    el.id = "adv-font-faces";
                    document.head.appendChild(el);
                }
                if (el.textContent !== css) el.textContent = css;
                try { window.dispatchEvent(new CustomEvent("adv:fonts")); } catch (e) {}
            })
            .catch(function () { fontFetching = false; });
    }
    // games.js calls this the moment a campaign appears or switches asset
    // sets (same trigger as the scene-art map); the generation bump makes
    // an in-flight answer from the OLD set drop instead of caching.
    window.advReloadFontFaces = function () { fontGen++; advLoadFontFaces(); };
    advLoadFontFaces();
    // only live campaigns keep rescanning for fresh font drops
    setInterval(function () {
        var st = null;
        try { st = Alpine.store("adv"); } catch (e) {}
        if (st && st.campaign) advLoadFontFaces();
    }, 30000);

    /* -------------------------
     * day/night tint
     * ------------------------- */
    function applyTint() {
        var el = document.getElementById("adv-tint");
        if (!el) {
            el = document.createElement("div");
            el.id = "adv-tint";
            document.body.appendChild(el);
            // tint over the story, not the monitor (adventure_bounds.js)
            if (window.AdvBounds) window.AdvBounds.fit(el, window.AdvBounds.box());
        }
        var st = A();
        var c = st && st.active ? st.campaign : null;
        var period = "";
        if (c && c.clock && cfg.daynight_tint !== false) {
            var h = c.clock.hour | 0;
            if (h >= 5 && h < 8) period = "dawn";
            else if (h >= 8 && h < 12) period = "morning";
            else if (h >= 12 && h < 17) period = "afternoon";
            else if (h >= 17 && h < 20) period = "dusk";
            else if (h >= 20) period = "night";
            else period = "deepnight";
        }
        el.className = "adv-tint" + (period ? " adv-tint-" + period : "");
        // a palette may carry its own day/night moods: the "tint" map of
        // the ACTIVE variant (see palettes/AI_GUIDE.md) names a CSS
        // background per period. inline style wins over the neutral
        // fallback class; an empty string hands the period back to the
        // module's built-in tint.
        var pal = c && c.palette ? palVars(c.palette) : null;
        var t = (period && pal && pal.tint) ? String(pal.tint[period] || "") : "";
        // cache on the element (style readback comes normalized, and the
        // node can be rebuilt by the bounds fitter)
        if (el._advTint !== t) { el._advTint = t; el.style.background = t; }
    }

    /* -------------------------
     * sky & weather particles - one generic engine for two layers
     * the WEATHER layer (#adv-weather) is the foreground: falling motes.
     * the SKY layer (#adv-sky) sits under it: the backdrop everything
     * rides over - washes, shader skies and its own slow particle kinds
     * (twinkling stars, drifting cloud blobs, rising bubbles). Both layers
     * roll particles from a SPEC: count, dur:[s,s] travel time,
     * size:[px,px] (vw:true makes them viewport-wide banks), top/left:
     * [%,%] spawn bands, height:[px,px] for shapes taller than wide, and
     * glyphs:[..] + font:[px,px] for text particles. The LOOK is always
     * per-kind CSS (.adv-weather-<kind> / .adv-sky-<kind> on .adv-wp);
     * this engine only lays out. Every kind's look and spec ships as
     * FILES: the default asset pack's weather/ and skies/ folders are the
     * global base (one <name>.css plus a <name>.json per kind) and the
     * campaign's set overrides those files one by one and may add kinds
     * of its own - so a brand-new kind needs only files, never code.
     * Weather kinds with no spec anywhere get the calm default of 42
     * plain motes; SKY kinds default to none - a backdrop adds particles
     * only when its json asks for them.
     * ------------------------- */
    function advRand(pair, dflt) {
        var a = (pair && typeof pair[0] === "number") ? pair[0] : dflt[0];
        var b = (pair && typeof pair[1] === "number") ? pair[1] : dflt[1];
        return a + Math.random() * (b - a);
    }
    // the particle spec comes straight from the visual pack: the default
    // asset pack's weather/ or skies/ <name>.json merged under the campaign
    // pack's own fields (the /fx route merges them one by one server-side).
    function weatherSpecFor(kind) {
        return (window.AdvFX && window.AdvFX.weatherSpec(kind)) || {};
    }
    function skySpecFor(kind) {
        return (window.AdvFX && window.AdvFX.skySpec(kind)) || {};
    }
    /* page refraction - the generic "bends the ACTUAL page" channel.
       A WebGL canvas can never sample the DOM behind it and Chromium's
       backdrop-filter cannot reference SVG filters, so anything that
       wants to distort the CONTENT (text, art, everything) must
       displace the chat window itself through an injected SVG filter -
       a reusable engine service (any weather kind opts in from its
       json; every field is
       optional and the filter chain is REBUILT per arm containing only
       the members requested (no idle passes):
         "refract": { "scale": 9, "freq": [0.0045, 0.007], "speed": 9,
                      "octaves": 2, "type": "fractalNoise",
                      "blur": 0, "shake": 0, "morph": 0, "poster": 0,
                      "gamma": 1, "convolve": "sharpen|emboss|edges",
                      "duotone": { "shadow": "#1a0b22", "light": "#ffd9f2" },
                      "sheen": 3, "scan": 0, "grain": 0, "sat": 1,
                      "hue": 0, "glow": { "size": 0, "color": "#bfe9ff" } }
       chain order: bend -> shake -> morph -> blur -> poster -> gamma ->
       convolve -> duotone -> sheen -> scanlines -> grain -> sat -> hue ->
       glow. low freq + slow speed = water swell, high freq + small scale
       = heat shimmer, type "turbulence" swirls; `speed` is the SEAMLESS
       LOOP length in seconds (the rAF walks every animated parameter
       around a closed path, integer multiples for faster life - nothing
       ever ping-pongs). sheen is an orbiting feSpecularLighting on the
       noise bumpmap (wet things), scan a CRT line darkness (0-1, 4px
       pitch), morph positive erodes (decay) negative dilates (bleed),
       hue counts WHOLE rainbow turns per loop. CSS reads the filter
       through --adv-refract-bf (adventure_plus.css: html.adv-refract
       #chat-window). Exported as window.AdvRefract.set for anything else
       that learns it wants it. */
    var refractOn = null, refractLoop = 0, refractNext = 0;
    function refractNum(v, lo, hi, dflt) {
        return (typeof v === "number" && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : dflt;
    }
    var REFRACT_KERNELS = {
        sharpen: "0 -1 0 -1 5 -1 0 -1 0",
        emboss: "-2 -1 0 -1 1 1 0 1 2",
        edges: "-1 -1 -1 -1 8 -1 -1 -1 -1"
    };
    function refractRgb(c) {
        var m = (typeof c === "string") ? /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c) : null;
        return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : null;
    }
    // assemble the chain from ONLY what this arm requested: an unused
    // primitive would still cost a full-window pass, so absence IS the
    // neutral default
    function refractChain(p) {
        var s = '<feTurbulence id="adv-refract-noise" type="' + p.type + '" baseFrequency="'
            + p.freq[0] + ' ' + p.freq[1] + '" numOctaves="' + p.oct + '" seed="5" result="n"/>'
            + '<feDisplacementMap id="adv-refract-map" in="SourceGraphic" in2="n" scale="'
            + p.scale + '" xChannelSelector="R" yChannelSelector="G" result="d"/>';
        var out = "d", i;
        if (p.shake > 0) {
            s += '<feOffset id="adv-refract-shake" in="' + out + '" dx="0" dy="0" result="sk"/>';
            out = "sk";
        }
        if (p.morph !== 0) {
            s += '<feMorphology id="adv-refract-morph" in="' + out + '" operator="'
                + (p.morph > 0 ? "erode" : "dilate") + '" radius="' + Math.abs(p.morph).toFixed(2)
                + '" result="mo"/>';
            out = "mo";
        }
        if (p.blur > 0) {
            s += '<feGaussianBlur id="adv-refract-blur" in="' + out + '" stdDeviation="'
                + p.blur + '" result="b"/>';
            out = "b";
        }
        if (p.poster >= 2) {
            var tab = [];
            for (i = 0; i < p.poster; i++) tab.push((i / (p.poster - 1)).toFixed(3));
            s += '<feComponentTransfer id="adv-refract-poster" in="' + out + '" result="po">'
                + '<feFuncR type="discrete" tableValues="' + tab.join(" ") + '"/>'
                + '<feFuncG type="discrete" tableValues="' + tab.join(" ") + '"/>'
                + '<feFuncB type="discrete" tableValues="' + tab.join(" ") + '"/>'
                + '</feComponentTransfer>';
            out = "po";
        }
        if (p.gamma !== 1) {
            s += '<feComponentTransfer id="adv-refract-gamma" in="' + out + '" result="gm">'
                + '<feFuncR type="gamma" amplitude="1" exponent="' + p.gamma + '" offset="0"/>'
                + '<feFuncG type="gamma" amplitude="1" exponent="' + p.gamma + '" offset="0"/>'
                + '<feFuncB type="gamma" amplitude="1" exponent="' + p.gamma + '" offset="0"/>'
                + '</feComponentTransfer>';
            out = "gm";
        }
        if (p.kernel) {
            s += '<feConvolveMatrix id="adv-refract-convolve" in="' + out + '" order="3" kernelMatrix="'
                + REFRACT_KERNELS[p.kernel] + '" preserveAlpha="true" result="cv"/>';
            out = "cv";
        }
        if (p.duo) {
            var sd = p.duo[0], lt = p.duo[1], row = [];
            for (i = 0; i < 3; i++) {
                row.push((0.2126 * (lt[0] - sd[0])).toFixed(4),
                         (0.7152 * (lt[0] - sd[0])).toFixed(4),
                         (0.0722 * (lt[0] - sd[0])).toFixed(4), "0", sd[i].toFixed(4));
            }
            s += '<feColorMatrix id="adv-refract-duo" in="' + out + '" type="matrix" values="'
                + row.join(" ") + ' 0 0 0 1 0" result="dt"/>';
            out = "dt";
        }
        if (p.sheen > 0) {
            s += '<feSpecularLighting id="adv-refract-sheen" in="n" surfaceScale="' + p.sheen
                + '" specularConstant="0.9" specularExponent="' + p.sheenExp
                + '" lighting-color="' + p.sheenC
                + '" result="sp"><fePointLight id="adv-refract-sheenlight" x="200" y="150" z="'
                + p.sheenZ + '"/></feSpecularLighting>'
                + '<feComposite in="sp" in2="SourceAlpha" operator="in" result="spi"/>'
                + '<feComposite in="' + out + '" in2="spi" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="sh"/>';
            out = "sh";
        }
        if (p.scan > 0) {
            s += '<feImage href="data:image/svg+xml;utf8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4">'
                + '<rect width="4" height="4" fill="#fff"/>'
                + '<rect width="4" height="1" fill="#000" fill-opacity="' + p.scan.toFixed(2)
                + '"/></svg>') + '" x="0" y="0" width="4" height="4" preserveAspectRatio="none" result="sli"/>'
                + '<feTile in="sli" result="slt"/>'
                + '<feBlend in="' + out + '" in2="slt" mode="multiply" result="sc"/>';
            out = "sc";
        }
        if (p.grain > 0) {
            var g = p.grain, o = (0.5 - 0.5 * g).toFixed(3);
            s += '<feTurbulence id="adv-refract-grain" type="fractalNoise" baseFrequency="0.78" numOctaves="2" seed="11" result="gn"/>'
                + '<feColorMatrix id="adv-refract-grainamt" in="gn" type="matrix" values="'
                + g + ' 0 0 0 ' + o + ' 0 ' + g + ' 0 0 ' + o + ' 0 0 ' + g + ' 0 ' + o
                + ' 0 0 0 0 1" result="gnc"/>'
                + '<feBlend id="adv-refract-grainblend" in="' + out + '" in2="gnc" mode="overlay" result="g"/>';
            out = "g";
        }
        if (p.sat !== 1) {
            s += '<feColorMatrix id="adv-refract-sat" in="' + out + '" type="saturate" values="'
                + p.sat + '" result="s"/>';
            out = "s";
        }
        if (p.hueN) {
            s += '<feColorMatrix id="adv-refract-hue" in="' + out + '" type="hueRotate" values="0" result="h"/>';
            out = "h";
        }
        if (p.glowS > 0) {
            s += '<feDropShadow id="adv-refract-glow" in="' + out + '" dx="0" dy="0" stdDeviation="'
                + p.glowS + '" flood-color="' + p.glowC + '" flood-opacity="0.75"/>';
        }
        return s;
    }
    function ensureRefractFilter() {
        if (document.getElementById("adv-refract-filter")) return;
        var svgNS = "http://www.w3.org/2000/svg";
        var svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "0");
        svg.setAttribute("height", "0");
        svg.style.position = "fixed";
        // color-interpolation-filters=sRGB is NOT cosmetic: SVG filters
        // default to linearRGB, where every pixel is converted before the
        // ops and transparent reads as transparent BLACK. blurring or
        // displacing soft-alpha art ({{sparkle}}/{{glow}} halos, any drop
        // shadow) then drags that black into the glow edges and paints a
        // solid dark gray outline around every bright soft shape. in sRGB
        // the passes blend against the real backdrop and the halos stay
        // clean. also makes sat/hue/duotone match the authored colors.
        svg.innerHTML = '<filter id="adv-refract-filter" color-interpolation-filters="sRGB"'
            + ' x="-5%" y="-5%" width="110%" height="110%"></filter>';
        document.body.appendChild(svg);
        document.documentElement.style.setProperty("--adv-refract-bf", "url(#adv-refract-filter)");
    }
    function refractBreath(now) {
        if (!refractOn) { refractLoop = 0; return; }   // retire when disarmed
        refractLoop = window.requestAnimationFrame(refractBreath);
        if (now < refractNext) return;
        refractNext = now + 55;                        // ~18 fps: slow morphs
        var p = refractOn, t = now / 1000;
        // one full turn per `speed` seconds around a closed ELLIPSE in
        // frequency space: position and velocity both match at the seam,
        // so the distortion swims round and round instead of each axis
        // ping-ponging - a seamless loop by construction. `speed` is the
        // loop length in seconds.
        var a = 6.28318 * (t % p.speed) / p.speed;
        var fx = p.freq[0] * (1.0 + 0.3 * Math.cos(a));
        var fy = p.freq[1] * (1.0 + 0.3 * Math.sin(a));
        var turb = document.getElementById("adv-refract-noise");
        if (turb) turb.setAttribute("baseFrequency", fx.toFixed(5) + " " + fy.toFixed(5));
        // NB: blur is deliberately CONSTANT - breathing it (±30% on the
        // loop) read as a distracting pulse over text; the haze level the
        // kind asked for stays exactly that hazy
        // hue drifts a whole number of full rainbow turns per loop, so
        // hueRotate(360k) = hueRotate(0): seamless for free
        if (p.hueN) {
            var hue = document.getElementById("adv-refract-hue");
            if (hue) hue.setAttribute("values",
                (360 * p.hueN * ((t % p.speed) / p.speed)).toFixed(1));
        }
        // grain boils and glow pulses on INTEGER multiples of the loop
        // angle - faster life, same seamless period
        if (p.grain > 0) {
            var gn = document.getElementById("adv-refract-grain");
            if (gn) gn.setAttribute("baseFrequency",
                (0.78 + 0.05 * Math.cos(4 * a)).toFixed(4));
        }
        if (p.glowS > 0) {
            var glow = document.getElementById("adv-refract-glow");
            if (glow) glow.setAttribute("stdDeviation",
                (p.glowS * (1 + 0.25 * Math.sin(3 * a + 2.1))).toFixed(2));
        }
        // quake jitter on stacked harmonics: chaotic-looking, yet the
        // whole sum still closes on itself every loop
        if (p.shake > 0) {
            var sk = document.getElementById("adv-refract-shake");
            if (sk) {
                sk.setAttribute("dx", (p.shake * (0.6 * Math.sin(7 * a)
                    + 0.4 * Math.sin(11 * a + 1.3))).toFixed(2));
                sk.setAttribute("dy", (p.shake * (0.6 * Math.sin(5 * a + 2.7)
                    + 0.4 * Math.sin(9 * a))).toFixed(2));
            }
        }
        // the sheen light orbits the window once per loop: wet things
        if (p.sheen > 0) {
            var lt = document.getElementById("adv-refract-sheenlight");
            if (lt) {
                lt.setAttribute("x", (window.innerWidth * (0.5 + 0.45 * Math.cos(a))).toFixed(0));
                lt.setAttribute("y", (window.innerHeight * (0.5 + 0.35 * Math.sin(a))).toFixed(0));
            }
        }
    }
    function setPageRefract(cfg) {
        // a whole-window SVG displacement filter breathing every frame is
        // the single most brutal effect on a phone GPU: refused outright
        // (the weather/sky claims stay recorded, so the bend returns by
        // itself when the screen grows back past the phone threshold)
        var on = cfg && !reducedMotion() &&
                (!window.AdvPerf || AdvPerf.refractAllowed()) ? {
            scale: refractNum(cfg.scale, 1, 40, 9),
            freq: (cfg.freq && cfg.freq.length === 2) ?
                [refractNum(cfg.freq[0], 0.0005, 0.05, 0.0045),
                 refractNum(cfg.freq[1], 0.0005, 0.05, 0.007)] :
                [0.0045, 0.007],
            speed: refractNum(cfg.speed, 1, 120, 9),
            oct: refractNum(cfg.octaves, 1, 4, 2),
            blur: refractNum(cfg.blur, 0, 8, 0),
            type: cfg.type === "turbulence" ? "turbulence" : "fractalNoise",
            // colour grade: sat 1 = untouched, 0 = drained memory, 3 =
            // hyperreal; hue = WHOLE rainbow turns per loop (any integer
            // loops seamlessly, negative drifts the other way)
            sat: refractNum(cfg.sat, 0, 4, 1),
            hueN: Math.round(refractNum(cfg.hue, -3, 3, 0)),
            // film grain: 0..1 amount, boiling on the loop
            grain: refractNum(cfg.grain, 0, 1, 0),
            // bloom: soft coloured halo, "glow": 10 or
            // "glow": { "size": 10, "color": "#7fd8ff" }
            glowS: (cfg.glow && typeof cfg.glow === "object")
                ? refractNum(cfg.glow.size, 0, 40, 0)
                : refractNum(cfg.glow, 0, 40, 0),
            glowC: (cfg.glow && cfg.glow.color) || "#bfe9ff",
            // geometry extras: shake = px quake jitter, morph = +erode
            // (decay) / -dilate (bleed)
            shake: refractNum(cfg.shake, 0, 20, 0),
            morph: refractNum(cfg.morph, -2, 2, 0),
            // tone extras: poster = discrete levels (CRT!), gamma for
            // brightness curves, convolve preset, duotone colour pair
            poster: Math.round(refractNum(cfg.poster, 0, 32, 0)),
            gamma: refractNum(cfg.gamma, 0.2, 3, 1),
            kernel: REFRACT_KERNELS[cfg.convolve] ? String(cfg.convolve) : "",
            duo: (cfg.duotone && cfg.duotone.shadow && cfg.duotone.light)
                ? (function () {
                    var a = refractRgb(cfg.duotone.shadow);
                    var b = refractRgb(cfg.duotone.light);
                    return (a && b) ? [a, b] : null;
                })() : null,
            // wet sheen: orbiting specular highlight riding the noise
            // bumpmap; "sheen": 3 or { "scale", "exponent", "color", "z" }
            sheen: refractNum((cfg.sheen && typeof cfg.sheen === "object")
                ? cfg.sheen.scale : cfg.sheen, 0, 10, 0),
            sheenExp: refractNum(cfg.sheen && cfg.sheen.exponent, 1, 128, 18),
            sheenC: (cfg.sheen && cfg.sheen.color) || "#cfeaff",
            sheenZ: refractNum(cfg.sheen && cfg.sheen.z, 40, 600, 150),
            // CRT scanlines: 0-1 line darkness on a 4px pitch
            scan: refractNum(cfg.scan, 0, 1, 0)
        } : null;
        var h = document.documentElement;
        if (on) {
            ensureRefractFilter();
            // rebuild the chain from scratch: requested members only,
            // all values baked in (the breath then only animates)
            document.getElementById("adv-refract-filter").innerHTML = refractChain(on);
            refractOn = on;
            h.classList.add("adv-refract");
            if (!refractLoop) refractLoop = window.requestAnimationFrame(refractBreath);
        } else {
            refractOn = null;
            h.classList.remove("adv-refract");
        }
    }
    window.AdvRefract = { set: setPageRefract };
    // the page-bend channel is claimed by the two LAYERED kinds: a weather
    // kind and a sky kind each carry one in their json. the foreground
    // weather outranks the backdrop sky, and a layer without a claim hands
    // the channel back to the other one automatically (syncRefract is the
    // only door - both appliers set their holder, then call it).
    var wxRefract = null, skyRefract = null;
    function syncRefract() { setPageRefract(wxRefract || skyRefract); }
    // dev console hook: preview a weather kind with NO campaign running -
    //   advTestWeather("storm")                  default pack
    //   advTestWeather("heatstroke", "fantasy")  any installed pack
    //   advTestWeather("")                       clear the weather
    // and its backdrop twin advTestSky(name, pack) for the skies folder.
    // they fake the tiny slice of campaign state the appliers read, pries
    // the css gate open (html.adv-on) and re-run the immersion passes
    // immediately. a real campaign start overwrites this fake state as
    // usual, and reduced-motion / weather_effects=false still win.
    window.advTestWeather = function (kind, pack) {
        var st = A();
        if (!st) { console.warn("[adv] no adv store yet - reload and try again"); return; }
        st.active = true;
        st.campaign = Object.assign(st.campaign || {}, {
            title: "weather preview",
            weather: String(kind || ""),
            asset_pack: String(pack || "")
        });
        document.documentElement.classList.add("adv-on");
        if (window.AdvFX) {
            if (arguments.length > 1) AdvFX.reload();
            else if (!AdvFX.ready()) AdvFX.reload();
        }
        applyTheme();
        applyTint();
        applySky();
        applyWeather();
        console.log("[adv] weather =", String(kind || "(off)"),
                    "| pack =", String(pack || "default"));
    };
    // backdrop twin of advTestWeather: advTestSky("stars"), advTestSky("")
    window.advTestSky = function (kind, pack) {
        var st = A();
        if (!st) { console.warn("[adv] no adv store yet - reload and try again"); return; }
        st.active = true;
        st.campaign = Object.assign(st.campaign || {}, {
            title: "sky preview",
            sky: String(kind || ""),
            asset_pack: String(pack || "")
        });
        document.documentElement.classList.add("adv-on");
        if (window.AdvFX) {
            if (arguments.length > 1) AdvFX.reload();
            else if (!AdvFX.ready()) AdvFX.reload();
        }
        applyTheme();
        applyTint();
        applySky();
        applyWeather();
        console.log("[adv] sky =", String(kind || "(off)"),
                    "| pack =", String(pack || "default"));
    };
    var weatherKind = null;
    var skyKind = null;
    // adv:fx-fail listeners for the current shader_only kinds, if any
    var wxFailWatch = null;
    var skyFailWatch = null;
    // the mote field both layers share: rolls count/dur/size/bands/glyphs
    // from the kind's spec. dfltCount covers kinds that ship no json at
    // all - weather defaults to 42 motes, skies to none.
    function spawnMotes(el, spec, dfltCount) {
        var count = (typeof spec.count === "number") ? spec.count : dfltCount;
        // phones thin the field out (factor + hard cap, never empty)
        if (window.AdvPerf) count = AdvPerf.particleCount(count);
        for (var i = 0; i < count; i++) {
            var d = document.createElement("span");
            d.className = "adv-wp";
            d.style.left = advRand(spec.left, [0, 100]).toFixed(1) + "%";
            // top stays unset unless the spec rolls a band: the CSS gives
            // the resting spot (top for falling kinds, bottom for rising)
            if (spec.top) d.style.top = advRand(spec.top, [0, 100]).toFixed(1) + "%";
            d.style.animationDuration = advRand(spec.dur, [6, 16]).toFixed(2) + "s";
            d.style.animationDelay = (-Math.random() * 14).toFixed(2) + "s";
            if (spec.glyphs && spec.glyphs.length) {
                // text particles: timewarp's clocks, a set's own runes...
                d.textContent = String(spec.glyphs[(Math.random() * spec.glyphs.length) | 0]);
                d.style.fontSize = advRand(spec.font, [11, 26]).toFixed(1) + "px";
            } else if (spec.size) {
                var w = advRand(spec.size, [2, 5]);
                d.style.width = w.toFixed(1) + (spec.vw ? "vw" : "px");
                if (spec.height) d.style.height = advRand(spec.height, [2, 5]).toFixed(1) + "px";
                else if (!spec.vw) d.style.height = w.toFixed(1) + "px";
            }
            el.appendChild(d);
        }
    }

    // the BACKDROP layer: washes, shader skies and slow sky particles
    // (stars, cloud banks, bubbles). It rides under the weather motes and
    // above the day/night tint; a shipped skies/<name>.glsl is the live
    // sky, the css sheet the full fallback.
    function applySky() {
        var st = A();
        var c = st && st.active ? st.campaign : null;
        var kind = (c && c.sky) || "";
        if (cfg.weather_effects === false || reducedMotion()) kind = "";
        // like the weather pass: hold until the visual pack has landed,
        // whose adv:fx event re-runs this very function
        if (kind && window.AdvFX && !window.AdvFX.ready()) {
            skyKind = null;
            return;
        }
        if (kind === skyKind) return;
        skyKind = kind;

        var el = document.getElementById("adv-sky");
        if (!el) {
            el = document.createElement("div");
            el.id = "adv-sky";
            // same z-band as the weather layer, so DOM order is what keeps
            // the sky UNDER it: insert before #adv-weather (and a weather
            // div created later lands after this one anyway)
            document.body.insertBefore(el, document.getElementById("adv-weather") || null);
            // the sky falls over the story window (adventure_bounds.js)
            if (window.AdvBounds) window.AdvBounds.fit(el, window.AdvBounds.box());
        }
        el.innerHTML = "";
        el.className = "adv-sky" + (kind ? " adv-sky-" + kind : " adv-sky-off");
        // this layer's page-bend claim resets with the kind; the spec
        // below re-arms it when the kind ships one (the weather layer's
        // own claim outranks it - see syncRefract)
        skyRefract = null;
        if (!kind) { syncRefract(); return; }

        var spec = skySpecFor(kind);
        var cv = null;
        if (window.AdvShaders) {
            cv = AdvShaders.sky(kind);
            if (cv) el.appendChild(cv);
        }
        // spec "shader_only": while this kind's shader actually paints,
        // the kind's own css stands down (veil and motes hidden - they
        // stay in the dom, cheap while display:none). the loader fires
        // adv:fx-fail the moment the sky gives up (fetch, compile,
        // context), and the css instantly falls back in.
        if (skyFailWatch) {
            window.removeEventListener("adv:fx-fail", skyFailWatch);
            skyFailWatch = null;
        }
        if (cv && spec.shader_only) {
            el.classList.add("adv-sky-shader");
            skyFailWatch = function (e) {
                var d = e.detail || {};
                if (d.kind === "skies" && d.name === kind) {
                    el.classList.remove("adv-sky-shader");
                    window.removeEventListener("adv:fx-fail", skyFailWatch);
                    skyFailWatch = null;
                }
            };
            window.addEventListener("adv:fx-fail", skyFailWatch);
        }
        // the kind may bend the page itself too (generic "refract" field)
        if (spec.refract) skyRefract = spec.refract;
        syncRefract();
        spawnMotes(el, spec, 0);
    }

    function applyWeather() {
        var st = A();
        var c = st && st.active ? st.campaign : null;
        var kind = (c && c.weather) || "";
        if (cfg.weather_effects === false || reducedMotion()) kind = "";
        // every kind's LOOK and SHAPE now ships inside the visual pack (the
        // default pack carries the base) - hold the pass (leaving the
        // sentinel unset) until AdvFX lands, whose adv:fx event re-runs
        // this very function.
        if (kind && window.AdvFX && !window.AdvFX.ready()) {
            weatherKind = null;
            return;
        }
        if (kind === weatherKind) return;
        weatherKind = kind;

        var el = document.getElementById("adv-weather");
        if (!el) {
            el = document.createElement("div");
            el.id = "adv-weather";
            document.body.appendChild(el);
            // weather falls through the story window (adventure_bounds.js)
            if (window.AdvBounds) window.AdvBounds.fit(el, window.AdvBounds.box());
        }
        el.innerHTML = "";
        el.className = "adv-weather" + (kind ? " adv-weather-" + kind : " adv-weather-off");
        // this layer's page-bend claim resets with the kind; the spec
        // below re-arms it when the kind ships one, otherwise the sky's
        // claim (if any) takes the channel back
        wxRefract = null;
        if (!kind) { syncRefract(); return; }

        var spec = weatherSpecFor(kind);
        // a shipped weather/<kind>.glsl paints the FOREGROUND on a canvas
        // over the sky layer: the kind's css keeps working either way and
        // the motes ride on top of the shader (a plain backdrop belongs to
        // skies/<kind>.glsl, not here)
        var sky = null;
        if (window.AdvShaders) {
            sky = AdvShaders.weather(kind);
            if (sky) el.appendChild(sky);
        }
        // spec "shader_only": when this kind ships a shader AND shaders are
        // on, the kind's own css stands down - a class hides the veil and
        // the motes (they stay in the dom, cheap while display:none). the
        // loader fires adv:fx-fail the moment the sky gives up (fetch,
        // compile, context), and the css instantly falls back in.
        if (wxFailWatch) {
            window.removeEventListener("adv:fx-fail", wxFailWatch);
            wxFailWatch = null;
        }
        if (sky && spec.shader_only) {
            el.classList.add("adv-weather-sky");
            wxFailWatch = function (e) {
                var d = e.detail || {};
                if (d.kind === "weather" && d.name === kind) {
                    el.classList.remove("adv-weather-sky");
                    window.removeEventListener("adv:fx-fail", wxFailWatch);
                    wxFailWatch = null;
                }
            };
            window.addEventListener("adv:fx-fail", wxFailWatch);
        }
        // the kind may bend the page itself too (generic "refract" field)
        if (spec.refract) wxRefract = spec.refract;
        syncRefract();
        spawnMotes(el, spec, 42);
    }

    /* -------------------------
     * story-window overlay moods (set_scene effects= / screen_effect tool)
     * one persistent div per HELD overlay: adding or removing one never
     * restarts the others' animations. The one-shot pulses (flash, poof)
     * are text macros and never live here - see adventure_beats.js
     * ------------------------- */
    function applyEffects() {
        var st = A();
        var c = st && st.active ? st.campaign : null;
        var fx = (c && c.effects) || {};
        // daydream skips the overlay: the story text itself gets the
        // bloom (soft blur + halo on every assistant message - see css)
        document.documentElement.classList.toggle("adv-daydream",
            Object.prototype.hasOwnProperty.call(fx, "daydream"));
        var holder = document.getElementById("adv-effects");
        if (!holder) {
            holder = document.createElement("div");
            holder.id = "adv-effects";
            document.body.appendChild(holder);
            // overlay moods wash over the story window, not the monitor
            // (adventure_bounds.js pins the holder; .adv-fx children are
            // absolute so they inherit its box)
            if (window.AdvBounds) window.AdvBounds.fit(holder, window.AdvBounds.box());
        }
        Array.prototype.slice.call(holder.children).forEach(function (el) {
            var name = el.dataset.fx;
            // key-presence, NOT truthiness: held overlays carry nonce 0, which
            // is falsy - a truthy check here would delete every steady effect.
            if (!Object.prototype.hasOwnProperty.call(fx, name)) {
                el.remove();
            }
        });
        Object.keys(fx).forEach(function (name) {
            // daydream restyles the page itself, not an overlay
            if (name === "daydream") return;
            if (document.getElementById("adv-fx-" + name)) return;
            // a shipped <name>.glsl swaps the div for a live shader canvas
            // (adventure_shaders.js); id, classes and data-fx stay identical,
            // so the css sheet styles the canvas exactly like the div
            var el = (window.AdvShaders && window.AdvShaders.overlay(name)) ||
                     document.createElement("div");
            el.id = "adv-fx-" + name;
            el.dataset.fx = name;
            el.className = "adv-fx adv-fx-" + name;
            holder.appendChild(el);
        });
    }

    /* -------------------------
     * ambience audio (this module's own ambience folder)
     * ------------------------- */
    // beds: stem -> live AdvAudio voice (decoded buffer on the shared
    // context - see adventure_audio.js); sig: the last seen
    // "stem:vol,..." signature of the campaign's ambience bed
    var audio = { ctx: null, beds: {}, sig: "__unset__" };

    function stopBed(b, ms) {
        if (b && b.stop) b.stop(ms);
    }

    // loop files live in the campaign's asset pack (webui/assets/asset_packs/
    // <pack>/ambience/); the /loops route lists them for the requesting chat's
    // campaign (stem -> served url) so any extension works and new drops
    // become options without touching code. The chat rides along on every
    // fetch; the adv:state watcher calls resetBeds() on an asset-pack
    // switch, and the generation counter makes a fetch that raced the
    // switch drop its stale map instead of caching it.
    var loopUrls = null;
    var loopGen = 0;
    function loopAssetQ() {
        var chat = null;
        try { chat = Alpine.store("chat").selectedChat; } catch (e) {}
        return chat ? ("?chat=" + encodeURIComponent(chat)) : "";
    }
    function resolveTrack(track, cb) {
        if (loopUrls && loopUrls[track] !== undefined) { cb(loopUrls[track]); return; }
        loopUrls = null;
        var gen = loopGen;
        simpleApiFetch("/api/ext/adventure_games/loops" + loopAssetQ())
            .then(function (data) {
                if (gen !== loopGen) { cb(""); return; }   // raced a set switch
                loopUrls = (data && data.loops) || {};
                cb(loopUrls[track] || "");
            })
            .catch(function () { cb(""); });
    }
    // an asset-pack switch: the same stem may now point at a different file,
    // so every bed fades out and the sig forces a full rebuild from the new
    // set on the next applyAmbience pass (which runs right after this in
    // the adv:state watcher)
    function resetBeds() {
        loopGen++;
        loopUrls = null;
        Object.keys(audio.beds).forEach(function (stem) { stopBed(audio.beds[stem], 0); });
        audio.beds = {};
        audio.sig = "__unset__";
    }

    /* the ambience bed: several loops layered at once, each with a volume
     * percentage relative to the overall ambience setting. The campaign
     * sends a spec like "rain:70,summer-night"; every heartbeat the sig
     * (stems + volumes) decides what to fade IN, what to fade OUT, and
     * what merely needs rebalancing. All loops ride the shared lowpass
     * chain, so daydream muffles the whole mix equally. */
    function parseBed(c) {
        var spec = (cfg.sound_enabled !== false && c && c.ambience) ? String(c.ambience) : "";
        var out = [];
        spec.split(",").forEach(function (part) {
            var bits = part.split(":");
            var stem = (bits[0] || "").trim();
            if (!stem) return;
            var v = parseInt(bits[1], 10);
            v = isNaN(v) ? 100 : Math.max(0, Math.min(100, v));
            out.push({ stem: stem, vol: v });
        });
        // (the phone trim this cap used to enforce is gone - AdvPerf
        // answers 0 = play every layer, on phones too)
        var cap = window.AdvPerf ? AdvPerf.maxAmbienceLoops() : 0;
        if (cap > 0 && out.length > cap) {
            out.sort(function (a, b) { return b.vol - a.vol; });
            out = out.slice(0, cap);
        }
        return out;
    }
    function applyAmbience() {
        var st = A();
        var c = st && st.active ? st.campaign : null;
        var want = parseBed(c);
        var sig = want.map(function (l) { return l.stem + ":" + l.vol; }).sort().join(",");
        if (sig === audio.sig) return;
        audio.sig = sig;

        var beds = audio.beds;
        var names = want.map(function (l) { return l.stem; });
        // loops that fell out of the bed fade away and release
        Object.keys(beds).forEach(function (stem) {
            if (names.indexOf(stem) === -1) { stopBed(beds[stem], 900); delete beds[stem]; }
        });
        if (!want.length) return;

        var base = Math.max(0.05, Math.min(0.9,
            ((cfg.ambience_volume == null ? 35 : cfg.ambience_volume) / 100) * 0.8));
        want.forEach(function (layer) {
            var target = Math.min(0.9, base * layer.vol / 100);
            var playing = beds[layer.stem];
            // re-balanced layer: the voice fades in BOTH directions and
            // cancels its previous ramp, so tweaks crossfade cleanly
            if (playing) { playing.fade(target, 900); return; }
            resolveTrack(layer.stem, function (url) {
                // gone again (or muted) while the library was resolving
                if (audio.sig.indexOf(layer.stem + ":") === -1) return;
                if (!url) return;                    // loop file not installed
                if (!(window.AdvAudio && window.AdvAudio.loop)) return;
                // the sound engine's buffer transport: decode once, play on
                // the shared lowpass-routed context (daydream muffles the
                // mix), zero <audio> elements - the Android stream cap and
                // every autoplay gate stop being our problem
                window.AdvAudio.loop(url, function (voice) {
                    if (!voice || audio.sig.indexOf(layer.stem + ":") === -1) {
                        if (voice) voice.stop(0);    // raced away: release
                        return;
                    }
                    beds[layer.stem] = voice;
                    voice.fade(target, 1200);
                });
            });
        });
    }

    /* -------------------------
     * soft synthesized SFX
     * ------------------------- */
    function ctx() {
        // ride the sound engine's ONE shared context: phones cap how many
        // AudioContexts a page may hold, and every fresh one needs its own
        // gesture unlock - this second context used to be created and then
        // NEVER woken, so typing keys, dice clatter and the delta chimes
        // stayed inaudible on phones no matter what was tapped. sharedCtx
        // answers null while the shared context still sleeps (the tone/noise
        // below bail on null: a skipped key beats a burst when it wakes)
        // and the persistent unlock in adventure_audio.js wakes it on the
        // player's next tap or key.
        if (window.AdvAudio && window.AdvAudio.sharedCtx) return window.AdvAudio.sharedCtx();
        if (!audio.ctx) {
            try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
        return audio.ctx;
    }
    function vol() {
        return (cfg.sfx_volume == null ? 50 : cfg.sfx_volume) / 100;
    }
    /* keystroke-only volume (typing_volume setting): multiplies the
     * typewriter's per-character keys and the token-stream keys (which are
     * the same synth - the typewriter just plays them per REVEALED char).
     * Rides on top of vol(), so it trims the keys independently of the
     * other cues. */
    function typingVol() {
        return (cfg.typing_volume == null ? 100 : cfg.typing_volume) / 100;
    }
    function tone(freq, dur, type, gain, when) {
        var c = ctx();
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
    }
    function noise(dur, gain, freq, when) {
        var c = ctx();
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
    }
    function sfxOn() { return cfg.sound_enabled !== false; }
    /* every hardcoded sound first checks the sfx folder for a file of its
     * cue name (ANY extension - the backend maps stems to the first file
     * it finds): drop dice_roll.mp3, thump.ogg or chime.wav in there and
     * it replaces the synth with no code change. AdvAudio.fileFirst does
     * the lookup and the sfxOn gate; the bare synth is the last resort. */
    function fileOr(name, synth, scale) {
        if (window.AdvAudio && window.AdvAudio.fileFirst) {
            window.AdvAudio.fileFirst(name, synth, scale);
            return;
        }
        if (sfxOn()) synth();
    }
    var sfx = {
        chime: function () { fileOr("chime", function () { tone(880, 0.3, "sine", 0.10); tone(1318.5, 0.4, "sine", 0.075, 0.06); }); },
        up: function () { fileOr("stat_up", function () { tone(660, 0.22, "sine", 0.09); tone(990, 0.26, "sine", 0.08, 0.09); tone(1320, 0.3, "sine", 0.06, 0.18); }); },
        down: function () { fileOr("stat_down", function () { tone(523, 0.28, "sine", 0.09); tone(330, 0.38, "sine", 0.08, 0.12); }); },
        dice: function () { fileOr("dice_roll", function () { for (var i = 0; i < 5; i++) noise(0.045, 0.22, 2200 + Math.random() * 1800, i * 0.07); tone(170, 0.09, "triangle", 0.1, 0.42); }); },
        thump: function () { fileOr("thump", function () { tone(56, 0.16, "sine", 0.3); tone(56, 0.14, "sine", 0.24, 0.26); }); }
    };

    /* -------------------------
     * full soundscape: while a campaign is active, every standard webui
     * sound is replaced with an in-world equivalent (same hook pattern as
     * crt_terminal: wrap AudioManager's functions; it is a top-level const
     * in utils/audio.js, so it must be referenced as a bare identifier).
     * The originals are skipped entirely - per-sound webui toggles do not
     * apply while immersed, our own sfx_enabled setting governs.
     * ------------------------- */
    function advOn() { var s = A(); return !!(s && s.active); }
    // ride the webui master SFX volume too, so its slider keeps working
    function masterVol() {
        if (typeof AudioManager !== "undefined" && typeof AudioManager.volume === "number") {
            return AudioManager.volume;
        }
        return 1;
    }
    function mtone(freq, dur, type, gain, when) { tone(freq, dur, type, gain * masterVol(), when); }
    function mnoise(dur, gain, freq, when) { noise(dur, gain * masterVol(), freq, when); }
    // the built-in felt knock under both key cues (token stream +
    // typewriter); sfx/ files of the cue names replace it wholesale
    function knock(when, tv) {
        mnoise(0.045, 0.058 * tv, 680 + Math.random() * 370, when);
        mtone(210 + Math.random() * 80, 0.06, "sine", 0.036 * tv, when);
    }

    var soundscape = {
        // message sent: a short parchment rustle with a quill lift
        send: function () { fileOr("send", function () { mnoise(0.16, 0.09, 1500); mtone(392, 0.14, "triangle", 0.045, 0.03); }); },
        // reply begins: the storybook creaks open
        start: function () { fileOr("reply_start", function () { mtone(150, 0.35, "sine", 0.05); mnoise(0.3, 0.07, 600); mtone(220, 0.25, "sine", 0.04, 0.13); }); },
        // passage finished: a five-note harp glissando
        complete: function () {
            fileOr("complete", function () {
                var notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
                notes.forEach(function (f, i) { tone(f, 0.5, "sine", 0.07 * masterVol(), i * 0.085); });
            });
        },
        // reasoning done: a soft two-tone brass bell
        reasoning: function () { fileOr("reasoning", function () { mtone(659.25, 0.45, "sine", 0.05); mtone(987.77, 0.55, "sine", 0.028, 0.07); }); },
        // typing (core fires this alongside token): a heavier key -
        // same dry keystrike as token's, pitched a touch lower; the low
        // triangle "bodies" layered a constant undertone rumble under the
        // typing, so keys are pure strikes now
        quill: function () {
            fileOr("quill", function () {
                mnoise(0.016, 0.05 * typingVol(), 1400 + Math.random() * 900);
            }, typingVol());
        },
        // token streamed: the soft felt-key "tok", MIXED TO BE HEARD.
        // the first cut drowned under the ambience beds, so the band sits
        // at 680-1050 Hz (where the ear is sensitive and the fire/music
        // have a hole) and rides well above them, while the 45 ms rounded
        // decay keeps it a cushioned knock instead of the old clack. a
        // stronger sine body gives each key a plump fundamental that
        // survives masking even when the noise tail blends in. optional
        // `when` offset (seconds) lets a burst of keystrikes stagger into
        // a roll - the typewriter plays one PER CHARACTER this way.
        // with the typewriter OFF this is the ONLY key cue (raw stream).
        token: function (when) {
            var tv = typingVol();
            fileOr("token", function () { knock(when, tv); }, tv);
        },
        // the typewriter's own per-character key (its keyRoll calls
        // this): a set can dress the reveal in its own clack by dropping
        // type_key.* into sfx/ - that file wins here, then the token
        // file, then the built-in knock. the synth chain mirrors
        // token's, so type_key only ever colors the TYPEWRITER.
        key: function (when) {
            var tv = typingVol();
            fileOr("type_key", function () {
                fileOr("token", function () { knock(when, tv); }, tv);
            }, tv);
        }
    };
    // the typewriter types its own keystrokes through this (it loads after
    // this file, so it picks the export up at its own init)
    window.AdvSoundscape = soundscape;

    // processing loop: a slow fireside pendulum - tick... tock...
    var procTimer = null;
    function soundscapeLoop() {
        if (procTimer) return;
        var beat = function () { mtone(96, 0.12, "sine", 0.035); mtone(72, 0.16, "sine", 0.02, 0.2); };
        beat();
        procTimer = setInterval(beat, 1500);
    }
    function soundscapeStop() {
        if (procTimer) { clearInterval(procTimer); procTimer = null; }
    }

    // true only while actual story text streams - not during reasoning,
    // tool calls or tool processing
    function contentStreaming() {
        try { return Alpine.store("stream").state === "streaming"; } catch (e) { return false; }
    }

    function advSound(id) {
        if (id === "send_message") { soundscape.send(); return true; }
        if (id === "response_start") { soundscape.start(); return true; }
        if (id === "completion") { soundscape.complete(); return true; }
        if (id === "reasoning_end") { soundscape.reasoning(); return true; }
        if (id === "typing" || id === "typewriter") {
            // keystrokes only accompany written content; while the GM
            // ponders or works with tools the pendulum alone keeps time
            // (return true regardless, so the original sound stays muted too)
            if (contentStreaming()) soundscape.quill();
            return true;
        }
        if (id === "token") {
            // the core fires "token" on ANY turn-step growth, including
            // reasoning deltas - gate it to visible content as well, or
            // the keys clack away while the GM is merely pondering
            if (contentStreaming()) soundscape.token();
            return true;
        }
        return false;
    }

    var audioHooked = false;
    function hookWebAudio() {
        if (typeof AudioManager === "undefined") { setTimeout(hookWebAudio, 250); return; }
        if (audioHooked) return;
        audioHooked = true;

        var origPlay = AudioManager.play;
        AudioManager.play = function (id) {
            if (sfxOn() && advOn()) {
                var c = ctx();
                // not just "suspended": android also parks a context in
                // the "interrupted" state (calls, alarms, audio-focus
                // theft) and that one needs the very same nudge
                if (c && c.state !== "running") c.resume();
                if (advSound(id)) return;
            }
            return origPlay.apply(AudioManager, arguments);
        };

        var origProc = AudioManager.playProcessingSound;
        AudioManager.playProcessingSound = function () {
            if (sfxOn() && advOn()) { soundscapeLoop(); return; }
            return origProc.apply(AudioManager, arguments);
        };

        var origProcStop = AudioManager.stopProcessingSound;
        AudioManager.stopProcessingSound = function () {
            soundscapeStop();
            return origProcStop.apply(AudioManager, arguments);
        };
    }
    hookWebAudio();

    /* -------------------------
     * AI banner (raw HTML, sanitized)
     * ------------------------- */
    function applyBanner() {
        var el = document.getElementById("adv-banner");
        if (!el) return;
        var st = A();
        var c = st && st.active ? st.campaign : null;
        var html = (c && c.banner) || "";
        if (!html) {
            el.innerHTML = "";
            el.style.display = "none";
            return;
        }
        el.innerHTML = window.DOMPurify
            ? DOMPurify.sanitize(html, { ADD_ATTR: ["style", "class"] })
            : "";
        el.style.display = "block";
    }

    /* -------------------------
     * sidebar forcing
     * ------------------------- */
    var lastForced = null;
    function forceAdventureTab() {
        var st = A();
        var want = !!(st && st.active);
        var tabBtn = document.querySelector('.sidebar-tab[data-tab="adventure_games/adventure"]');
        // only force on the INACTIVE -> ACTIVE transition. re-forcing on
        // every heartbeat made the panel impossible to close (it snapped
        // back open ~450ms later), which was worst on mobile where the
        // tabbar is hidden while immersed - closing now works via the ✕
        // button in the panel; the header's ⚜ reopens it.
        if (want && lastForced !== true) {
            try { Alpine.store("ui").sidebarCollapsed = false; } catch (e) {}
            if (tabBtn && !tabBtn.classList.contains("active")) tabBtn.click();
        } else if (!want && lastForced === true) {
            var advActive = document.querySelector('.sidebar-tab[data-tab="adventure_games/adventure"].active');
            if (advActive) {
                var home = document.querySelector('.sidebar-tab[data-tab=""]');
                if (home) home.click();
            }
        }
        lastForced = want;
    }

    /* -------------------------
     * prose styling: macros, speaker colors, choice rail
     * ------------------------- */
    // both name alternations are dynamic: the asset packs ship pulses/ and
    // text_decoration/ skins and the AdvFX pack IS the vocabulary (rebuilt
    // on adv:fx). The decoration names are the flavor kinds - nothing
    // hardcoded here.
    // group 1+2: glyph macros with content; group 3: pulses, with an
    // optional tolerated narration tail in group 4
    function advPulseAlt() {
        // no hardcoded fallback: until the pack lands there simply are
        // no pulse names
        return (window.AdvFX && window.AdvFX.pulseAlt) ? window.AdvFX.pulseAlt() : "";
    }
    function advTdAlt() {
        return (window.AdvFX && window.AdvFX.tdAlt) ? window.AdvFX.tdAlt() : "";
    }
    function buildMacroRe() {
        // groups: 1=decoration kind, 2=its content, 3=pulse name, 4=pulse
        // tail, 5=unknown kind, 6=its content. The unknown branch catches
        // macros the AI made up (a kind no vocabulary owns) so their braces
        // vanish and only the body shows - reserved state kinds are excluded
        // (they belong to the marked skip pipeline, not to this styling
        // pass), and known kinds never reach it since earlier branches win.
        // each branch carries its own closing parens, so the pattern stays
        // balanced whatever the dynamic vocabularies hold - or don't hold yet
        var td = advTdAlt();
        var kindBranch = "(" + (td ? td + "|" : "") + "sfx|img)\\|([^{}]+)";
        var pulseBranch = "(" + advPulseAlt() + ")(?:\\|([^{}]*))?";
        var unknownBranch = "(?!stat\\||item\\||statusoff\\||status\\||music\\||sd\\||quest\\||" +
            "questdone\\||questfail\\||questoff\\||subgoal\\||subdone\\|)" +
            "([a-z][a-z0-9_-]*)\\|([^{}]*)";
        return new RegExp("\\{\\{(?:" + kindBranch + "|" + pulseBranch + "|" + unknownBranch + ")\\}\\}", "g");
    }
    var MACRO_RE = buildMacroRe();
    window.addEventListener("adv:fx", function () {
        MACRO_RE = buildMacroRe();
    });

    /* woozy words reel one LETTER at a time: wrap every word whole (so
       lines still break between words, never mid-word) and stagger each
       letter's animation by a negative slice - the wobble is already
       mid-flight on every glyph, so it travels through the text like a
       wave from the very first frame */
    function woozyLetters(host, text) {
        var idx = 0;
        text.split(/(\s+)/).forEach(function (chunk) {
            if (!chunk) return;
            if (/^\s+$/.test(chunk)) {
                host.appendChild(document.createTextNode(chunk));
                return;
            }
            var word = document.createElement("span");
            word.className = "adv-woozy-w";
            Array.prototype.forEach.call(chunk, function (ch) {
                var l = document.createElement("i");
                l.className = "adv-woozy-l";
                l.textContent = ch;
                // base delay rides a custom property so the phase pass can
                // add the continuity offset on top of the wave stagger
                l.style.setProperty("--adv-lbase", (-idx * 0.09) + "s");
                idx += 1;
                word.appendChild(l);
            });
            host.appendChild(word);
        });
    }

    /* sparkle: little glowing four-point stars scattered over the text -
       the phrase as a whole wears 4+ stars, dealt over a seeded shuffle
       of its words. every position is rolled from a hash
       of the word and its slot, never Math.random - the typewriter
       rebuilds this markup dozens of times a second, and a fresh roll per
       pass would make the stars jitter madly while you read. seeding per
       WORD (not per phrase) keeps even earlier words' stars frozen while
       the last one is still being typed. each star claims one of n lanes
       across the word; tops stay inside the letter band. (DOM twin of the
       games.js builder, for macros that arrive outside the marked
       pipeline - parsed prose is already handled there) */
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
    function sparkleStar(w, seed, i, n) {
        var lane = 90 / n;
        var d = document.createElement("i");
        d.className = "adv-sparkle-dot";
        d.style.left = (lane * i + sparkleRoll(seed, i * 6 + 1) * lane).toFixed(1) + "%";
        d.style.top = (sparkleRoll(seed, i * 6 + 2) * 0.5 + 0.15).toFixed(2) + "em";
        var sz = (sparkleRoll(seed, i * 6 + 3) * 0.14 + 0.24).toFixed(2);
        d.style.width = sz + "em";
        d.style.height = sz + "em";
        d.style.setProperty("--adv-sdur", (sparkleRoll(seed, i * 6 + 4) * 2.6 + 4).toFixed(2) + "s");
        d.style.setProperty("--adv-sdelay", (-sparkleRoll(seed, i * 6 + 5) * 5).toFixed(2) + "s");
        w.appendChild(d);
    }
    function sparkleScatter(host, text) {
        var chunks = String(text).split(/(\s+)/).filter(function (c) { return c.length; });
        var words = [];
        chunks.forEach(function (c) { if (!/^\s+$/.test(c)) words.push(c); });
        if (!words.length) { host.textContent = text; return; }
        // per-word self-derived star count (see the games.js twin): a word's
        // layout is fixed by its own chunk+slot seed, so earlier words freeze
        // as later ones stream in and the phrase never re-seeds on close.
        var slot = 0;
        chunks.forEach(function (chunk) {
            if (/^\s+$/.test(chunk)) {
                host.appendChild(document.createTextNode(chunk));
                return;
            }
            slot += 1;
            var w = document.createElement("span");
            w.className = "adv-sparkle-w";
            w.textContent = chunk;
            var seed = sparkleSeed(chunk + "|" + slot);
            var n = 1 + Math.floor(sparkleRoll(seed, 0) * 2.6); // 1..3 per word
            if (window.AdvPerf) n = Math.min(n, AdvPerf.sparkleWordMax(n)); // phone: fewer/none
            for (var k = 0; k < n; k++) sparkleStar(w, seed, k, n);
            host.appendChild(w);
        });
    }

    function macroPass(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue || node.nodeValue.indexOf("{{") === -1) return NodeFilter.FILTER_REJECT;
                var p = node.parentElement;
                if (p && (p.closest("code, pre, script, style, .adv-macro"))) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        nodes.forEach(function (node) {
            var text = node.nodeValue;
            MACRO_RE.lastIndex = 0;
            if (!MACRO_RE.test(text)) return;
            MACRO_RE.lastIndex = 0;
            var frag = document.createDocumentFragment();
            var last = 0, m;
            while ((m = MACRO_RE.exec(text)) !== null) {
                if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                if (m[5]) {
                    // a macro the AI made up: its body is prose - drop the
                    // words in plain and let the braces vanish with the token
                    if (m[6]) frag.appendChild(document.createTextNode(m[6]));
                    last = m.index + m[0].length;
                    continue;
                }
                if (m[1] === "sfx") {
                    // the DOM twin of the marked sfx chip: a cue the
                    // campaign's set does not carry hides entirely
                    // (advSfxKnown), and the data-sfx attr lets
                    // advPruneSfx re-check chips rendered while the map
                    // was still in flight
                    var sname = String(m[2] || "").trim().toLowerCase();
                    if (window.advSfxKnown && !window.advSfxKnown(sname)) {
                        last = m.index + m[0].length;
                        continue;
                    }
                    var sspan = document.createElement("span");
                    sspan.className = "adv-macro adv-macro-sfx";
                    sspan.setAttribute("data-sfx", sname);
                    sspan.textContent = "\u{1F50A} " + sname.replace(/_/g, " ");
                    frag.appendChild(sspan);
                    last = m.index + m[0].length;
                    continue;
                }
                var kind = m[1] || m[3];
                var span = document.createElement("span");
                span.className = "adv-macro adv-macro-" + kind;
                // DOM builders are picked by the decoration's sidecar render
                // mode, not by a hardcoded name: a set's own decoration may
                // opt into sparkle or woozy just like the base ones
                var tdRender = window.AdvFX && AdvFX.tdRender ? AdvFX.tdRender(kind) : "";
                // phones skip the per-letter DOM builders: woozy falls
                // through to the plain-text branch (its css sheet still
                // skins the whole span, just without letter choreography)
                if (tdRender === "woozy" && window.AdvPerf && AdvPerf.woozyPlain()) tdRender = "";
                if (tdRender === "woozy") woozyLetters(span, m[2]);
                else if (tdRender === "sparkle") sparkleScatter(span, m[2]);
                else if (m[1] === "img") {
                    // DOM twin of the marked renderer: resolve via the shared
                    // url map, else leave a data-img placeholder that
                    // advFillImgs patches in once the map is cached.
                    // same stem + side split as the marked renderer: the
                    // side places the frame (left/right float beside the
                    // paragraph, center/bare keeps the block line)
                    var bits = (m[2] || "").split("|");
                    var raw = bits[0].trim();
                    var side = bits.length > 1 ? bits[1].trim().toLowerCase() : "";
                    span.classList.add("adv-img-wrap");
                    if (side === "left" || side === "right") span.classList.add("adv-img-" + side);
                    var img = document.createElement("img");
                    img.className = "adv-img";
                    img.alt = raw.replace(/_/g, " ");
                    img.loading = "lazy";
                    var src = window.advImgSrc ? window.advImgSrc(raw) : "";
                    if (src) img.src = src;
                    else img.setAttribute("data-img", raw.toLowerCase());
                    span.appendChild(img);
                    if (!src) {
                        var cap = document.createElement("span");
                        cap.className = "adv-img-pending";
                        cap.textContent = "\u{1F5BC} " + raw.replace(/_/g, " ");
                        span.appendChild(cap);
                    }
                    frag.appendChild(span);
                    last = m.index + m[0].length;
                    continue;
                }
                else span.textContent = m[2] || m[4] || "";
                frag.appendChild(span);
                last = m.index + m[0].length;
            }
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        });
    }

    /* -------------------------
     * macro phase continuity
     * streaming rebuilds the passage markup on every token/frame (the
     * typewriter hands marked only the typed prefix, so the live message
     * re-renders up to sixty times a second): every macro span is then a
     * brand-new element and its CSS loop animation restarts from zero,
     * which froze whispers, shines and flickers in their first instants.
     * fix: remember when each macro occurrence FIRST appeared, per turn,
     * and stamp every (re)born span with a negative --adv-phase equal to
     * the elapsed time - the browser then starts the animation already
     * mid-cycle, so the loop reads as unbroken across every rebuild.
     * occurrences are matched by slot: streaming only appends, so the
     * turn's macro sequence keeps its order, and order + kind + text is
     * enough to recognise the same occurrence in the fresh markup. the
     * pass runs from the MutationObserver callback, a microtask that
     * lands BEFORE the browser paints the new spans - the reset never
     * becomes visible even for the frames between old and new.
     * ------------------------- */
    var macroStore = typeof WeakMap !== "undefined" ? new WeakMap() : null;

    function macroKindOf(el) {
        var m = /(?:^| )adv-macro-([\w-]+)/.exec(el.className || "");
        return m ? m[1] : "?";
    }

    function macroPhasePass() {
        if (!macroStore) return;
        var root = document.getElementById("messages");
        if (!root) return;
        var els = root.querySelectorAll(".adv-macro");
        if (!els.length) return;
        var turns = root.querySelectorAll(".turn");
        var store = macroStore.get(root);
        if (!store) { store = { turns: {} }; macroStore.set(root, store); }
        var now = performance.now();
        // group the spans by their turn's ordinal (stable while the chat
        // is displayed - turns only ever append)
        var byTurn = {};
        for (var i = 0; i < els.length; i++) {
            var host = els[i].closest(".turn");
            var ti = host ? String(Array.prototype.indexOf.call(turns, host)) : "-1";
            if (byTurn[ti]) byTurn[ti].push(els[i]);
            else byTurn[ti] = [els[i]];
        }
        for (var key in byTurn) {
            var list = byTurn[key];
            var arr = store.turns[key];
            if (!arr) arr = store.turns[key] = [];
            // reuse the recorded births while the sequence still agrees
            var n = 0;
            for (; n < list.length; n++) {
                if (n >= arr.length) break;
                if (arr[n].kind !== macroKindOf(list[n])) break;
                if (arr[n].text !== list[n].textContent) break;
            }
            if (n < arr.length) arr.length = n;   // passage rewrote: re-key the tail
            for (var j = n; j < list.length; j++)
                arr.push({ kind: macroKindOf(list[j]), text: list[j].textContent, t0: now });
            for (var k = 0; k < list.length; k++)
                list[k].style.setProperty("--adv-phase", (-(now - arr[k].t0) / 1000) + "s");
        }
    }

    function speakerColor(name, palette) {
        var h = 0;
        for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
        var light = palette && palette.dark === false ? 42 : 68;
        return "hsl(" + h + " 55% " + light + "%)";
    }

    // color everything the speaker says: gather the siblings that follow the
    // name tag up to the next <strong> (a new speaker) into one span
    function dressLine(s, color) {
        var nodes = [];
        var node = s.nextSibling;
        while (node) {
            if (node.nodeName === "STRONG") break;
            nodes.push(node);
            node = node.nextSibling;
        }
        if (!nodes.length) return;
        var hasText = nodes.some(function (n) {
            return (n.nodeType === 3 ? n.nodeValue : (n.textContent || "")).trim().length > 0;
        });
        if (!hasText) return;
        var span = document.createElement("span");
        span.className = "adv-dialogue";
        s.parentNode.insertBefore(span, nodes[0]);
        nodes.forEach(function (n) { span.appendChild(n); });
        span.style.color = color;
    }

    function speakerPass(root) {
        var st = A();
        var c = st ? st.campaign : null;
        var pal = palVars(c ? c.palette : null);
        root.querySelectorAll(".message.assistant strong").forEach(function (s) {
            if (s.classList.contains("adv-speaker")) {
                // recolor (a dark/light mode flip changes the variant the
                // cached inline color was picked from) and absorb any prose
                // streaming appended after the wrapped line since the last pass
                var rc = speakerColor((s.textContent || "").replace(/:[\s\u00a0]*$/, "").trim(), pal);
                s.style.color = rc;
                var span = s.nextElementSibling;
                if (span && span.classList.contains("adv-dialogue")) span.style.color = rc;
                if (span && span.classList.contains("adv-dialogue")) {
                    var node = span.nextSibling;
                    var extra = [];
                    while (node) {
                        if (node.nodeName === "STRONG") break;
                        extra.push(node);
                        node = node.nextSibling;
                    }
                    extra.forEach(function (n) { span.appendChild(n); });
                }
                return;
            }
            // markdown turns **Mags:** into <strong>Mags:</strong> - the colon
            // lives INSIDE the tag, so check both that and the trailing-text
            // variant ("<strong>Mags</strong>: ...")
            var own = (s.textContent || "").trim();
            var named = "";
            if (/:[\s\u00a0]*$/.test(own)) named = own.replace(/:[\s\u00a0]*$/, "");
            else {
                var nxt = s.nextSibling;
                if (nxt && nxt.nodeType === 3 && /^\s*:/.test(nxt.nodeValue)) named = own;
            }
            if (!named || named.length > 40) return;
            s.classList.add("adv-speaker");
            var color = speakerColor(named, pal);
            s.style.color = color;
            dressLine(s, color);
        });
    }

    function railPass(root) {
        root.querySelectorAll(".turn.adv-current .message.assistant").forEach(function (card) {
            var kids = Array.prototype.slice.call(card.children);
            var trails = [];
            for (var i = kids.length - 1; i >= 0; i--) {
                var k = kids[i];
                if (k.tagName === "NAV") { break; }
                // the prompt form wears .adv-choice for its pill look but is
                // no link - exclude it from the trail counting
                var links = k.querySelectorAll ? Array.prototype.slice.call(k.querySelectorAll(".adv-choice:not(#adv-prompt)")) : [];
                if (!links.length) break;
                var anchors = k.getElementsByTagName("a").length;
                var textBits = Array.prototype.slice.call(k.childNodes).some(function (n) {
                    return n.nodeType === 3 && n.nodeValue.trim().length > 0;
                });
                if (links.length === anchors && !textBits) trails.unshift(k);
                else break;
            }
            if (trails.length < 2) return;
            var nav = document.createElement("nav");
            nav.className = "adv-choices";
            card.insertBefore(nav, trails[0]);
            trails.forEach(function (t) {
                Array.prototype.slice.call(t.querySelectorAll(".adv-choice")).forEach(function (a) {
                    nav.appendChild(a);
                    nav.appendChild(document.createTextNode(" "));
                });
                // the custom prompt bar may have docked inside one of these
                // paragraphs before the rail formed - rescue it rather than
                // destroying it with the trail; games.js then re-homes it as
                // the rail's last entry on the next observer pass
                var pb = t.querySelector("#adv-prompt");
                if (pb) card.appendChild(pb);
                if (t.parentNode) t.parentNode.removeChild(t);
            });
        });
    }

    // fresh content is styled by the marked extensions at parse time now.
    // stylePassSoon remains ONLY as the one-off catch-up sweep for passages
    // that were rendered (and markdown-cached) before the campaign was
    // discovered - e.g. reloading a page into an existing game.
    var stylePending = null;
    function stylePassSoon() {
        if (stylePending) return;
        stylePending = setTimeout(function () {
            stylePending = null;
            var st = A();
            if (!st || !st.active) return;
            var root = document.getElementById("messages");
            if (!root) return;
            if (window.advConvert) window.advConvert(root);
            macroPass(root);
            // sweep sfx chips that rendered while the cue-name map was
            // still in flight and name a sound the pack does not carry
            if (window.advPruneSfx) { try { window.advPruneSfx(); } catch (e) {} }
            speakerPass(root);
            railPass(root);
            macroPhasePass();
        }, 170);
    }

    // what the MutationObserver still runs while streaming: purely the
    // structural choice-rail consolidation, no content styling anymore
    var railPending = null;
    function railPassSoon() {
        if (railPending) return;
        railPending = setTimeout(function () {
            railPending = null;
            var st = A();
            if (!st || !st.active) return;
            var root = document.getElementById("messages");
            if (!root) return;
            railPass(root);
        }, 170);
    }

    /* -------------------------
     * low-health heartbeat
     * ------------------------- */
    var lastThump = 0;
    function maybeThump() {
        var st = A();
        var c = st && st.active ? st.campaign : null;
        if (!c || !sfxOn()) return;
        var low = Object.keys(c.stats || {}).some(function (n) {
            var s = c.stats[n];
            return s.max != null && s.value <= s.max * 0.25;
        });
        if (low && Date.now() - lastThump > 9000) {
            lastThump = Date.now();
            sfx.thump();
        }
    }

    /* -------------------------
     * wiring
     * ------------------------- */

    // key of the last swept campaign (chat + title). marked extensions can
    // only style content rendered AFTER the campaign was known; anything
    // rendered before then (page reload into an existing game) gets exactly
    // one DOM catch-up sweep, never a per-mutation hook.
    var sweptKey = "";
    var lastAssetPack = null;
    window.addEventListener("adv:state", function () {
        var st = A();
        // an asset-pack switch (a game_start on another pack, a rewind
        // back to one, a new campaign): drop every cached stem->url map
        // before anything re-applies. The applyAmbience pass below rebuilds
        // the layered bed, and the AdvAudio.music / weatherBed calls
        // further down restart theirs past the __unset__ sentinels - all
        // re-resolved from the new pack's folders.
        var packNow = st && st.active && st.campaign ? (st.campaign.asset_pack || "") : "";
        if (packNow !== lastAssetPack) {
            lastAssetPack = packNow;
            resetBeds();
            if (window.AdvAudio && window.AdvAudio.resetAssetMaps) window.AdvAudio.resetAssetMaps();
            if (window.advResetImgMap) window.advResetImgMap();
            if (window.advResetSfxMap) window.advResetSfxMap();
            // the visual pack too: the new pack's overlays/weather/skies/
            // pulses sheets and particle specs swap in (adv:fx re-runs the
            // passes that depend on them)
            if (window.AdvFX && window.AdvFX.reload) window.AdvFX.reload();
        }
        applyTheme();
        applyTint();
        applySky();
        applyWeather();
        applyEffects();
        applyAmbience();
        applyBanner();
        forceAdventureTab();
        var c0 = st && st.active ? st.campaign : null;
        var key = "";
        try { key = (Alpine.store("chat").selectedChat || "") + "|" + (st && st.campaign ? st.campaign.title || "" : ""); } catch (e) {}
        var fresh = false;
        if (st && st.active && key && key !== sweptKey) {
            sweptKey = key;
            fresh = true;
            stylePassSoon();
        } else if (!st || !st.active) {
            sweptKey = "";
        }
        // split-module sound hooks: the daydream/snow lowpass, the weather-
        // and sky-bound beds under the mix, the automatic event stamps
        // (quest chimes, coin pings...) and the tool-only musical stingers
        // (fade the soundtrack out & pause, resume it back in) - audio js
        // a rewind rolls the event stamps back to older values: during a
        // short settle window after one, arm the stamp trackers on whatever
        // stamp is current instead of letting the rolled-back stamp fire a
        // sound that was just undone (the diff-based ambience/music/weather/
        // overlay appliers above DO react - the world itself must rewind)
        var settling = false;
        try { settling = (Date.now() - (window._advRewindTs || 0)) < 1500; } catch (e) {}
        if (window.AdvAudio) {
            window.AdvAudio.duck(c0);
            window.AdvAudio.music(c0);
            window.AdvAudio.weatherBed(c0);
            window.AdvAudio.skyBed(c0);
            window.AdvAudio.event(c0 && c0.sfx_event, fresh || settling);
            window.AdvAudio.stingerEvent(c0 && c0.stinger_event, fresh || settling);
        }
        // split-module story beats: title cards, sleep & death curtains,
        // torch-logic darkness (adventure_beats.js)
        if (window.AdvBeats) {
            window.AdvBeats.state(c0, fresh);
            window.AdvBeats.nightfall(c0);
        }
        maybeThump();

        // leaving the adventure while a processing loop runs? silence it
        if (!(st && st.active)) soundscapeStop();
    });

    // the visual pack landed or switched: rebuild the current sky and
    // weather from the merged specs (resetting the sentinels forces the
    // appliers past their same-kind guards - held custom kinds finally get
    // their particles, and a reshaped built-in re-rolls). overlay divs need
    // nothing: their sheets simply arrive, and CSS animations start as the
    // sheet parses.
    window.addEventListener("adv:fx", function () {
        weatherKind = null;
        skyKind = null;
        applySky();
        applyWeather();
        // the thinking sigil of the (new) set too - its sheets already
        // linked, now the svg markup follows
        if (window.advReloadThinking) window.advReloadThinking();
    });

    /* big "Thinking.." indicator with spinner, shown while the AI is busy
     * being invisible: reasoning, prompt-evaluating between tool rounds, or
     * processing tool calls (chain hidden). Gone the moment visible output
     * (streaming) starts. Toggled via html.adv-thinking - see plus css. */
    var THINK_STATES = {
        message_sending: true, message_received: true,
        thinking: true, processing: true, processing_tools: true, calling_tools: true
    };
    /* the sigil itself is an ASSET now (chrome slot: <pack>/thinking.svg):
     * the fx pack carries the winner url (the campaign's pack's file over
     * the default base), this fetches its text and injects it into
     * #adv-thinking; the look rides in with the same pack's sheets. The
     * ward below stays as the last-resort fallback for the window before
     * the pack lands - or with no default pack installed at all. adv:fx
     * re-runs the check, so a fresh drop or a pack switch swaps the live
     * sigil the moment the pack reloads. */
    var RUNE_FALLBACK = '<svg class="adv-rune" viewBox="0 0 100 100" aria-hidden="true">'
        + '<g class="adv-rune-ring">'
        + '<circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.5"/>'
        + '<path id="adv-rune-path" d="M50,50 m-34,0 a34,34 0 1,1 68,0 a34,34 0 1,1 -68,0" fill="none" stroke="none"/>'
        + '<text class="adv-rune-glyphs"><textPath href="#adv-rune-path" startOffset="0">\u16A0 \u16A2 \u16A6 \u16A8 \u16B1 \u16B2 \u16B7 \u16B9 \u16BA \u16BE \u16C1 \u16C3 </textPath></text>'
        + '</g>'
        + '<g class="adv-rune-erring">'
        + '<circle cx="50" cy="50" r="21" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 6" opacity="0.8"/>'
        + '</g>'
        + '<g class="adv-rune-core">'
        + '<path d="M50 36 L62 57 L38 57 Z" fill="currentColor" opacity="0.9"/>'
        + '</g>'
        + '</svg>';
    var thinkSvg = "", thinkUrlSeen = null;
    function advThinkMarkup() { return thinkSvg || RUNE_FALLBACK; }
    function advSetThinkSvg(txt) {
        if (txt === thinkSvg) return;
        thinkSvg = txt;
        // swap the live sigil mid-beat too (a set switch lands instantly)
        var el = document.getElementById("adv-thinking");
        if (el) {
            el.innerHTML = advThinkMarkup();
            syncThinkWord(el);   // the innerHTML swap took the word with it
        }
    }
    /* the words under the sigil (chrome slot: thinking_text.json + css):
     * a set names its own wait wording per phase - "consulting the
     * spellbook" while the GM ponders, "conjuring" while tool calls run -
     * and skins the line (and its animation) in thinking_text.css.
     * Unnamed phase keeps the neutral fallback; the whole look is still
     * just a div under the rune, so a set's sheet can restyle freely. */
    // the tool beat: the model writing its tool calls out loud
    var THINK_TOOL_STATES = { calling_tools: true };
    // the prompt-evaluating beat: the request is away and the tokens have
    // not started - the GM is waiting on the wire, not pondering or
    // rolling. tool RESULTS running (processing_tools) borrow this beat
    // too: the wait keeps wearing the world's gathering wording instead
    // of dropping silent mid-turn
    var THINK_PROMPT_STATES = { message_sending: true, message_received: true,
                                processing: true, processing_tools: true };
    var THINK_FALLBACK = { thinking: "Thinking\u2026", prompt: "Waiting\u2026", tool: "Working\u2026" };
    // a phase's wording may be ONE string or a LIST of them; with a list
    // the line rotates to a new random entry every 2-5 s (never the same
    // word twice in a row), so a long ponder feels alive instead of a
    // frozen caption. The spin state keys on phase + list content, so a
    // set switch or a phase change simply starts a fresh spin.
    var SPIN_MIN_MS = 2000, SPIN_MAX_MS = 5000;
    var thinkSpin = { key: "", idx: 0, next: 0 };
    function spinNextAt() { return Date.now() + SPIN_MIN_MS + Math.random() * (SPIN_MAX_MS - SPIN_MIN_MS); }
    function advThinkWord() {
        var spec = {};
        try { spec = (window.AdvFX && window.AdvFX.thinkText) ? (window.AdvFX.thinkText() || {}) : {}; } catch (e) {}
        var phase = "thinking";
        try {
            var st = Alpine.store("stream").state;
            if (THINK_TOOL_STATES[st]) phase = "tool";
            else if (THINK_PROMPT_STATES[st]) phase = "prompt";
        } catch (e) {}
        var v = spec[phase], list = [];
        if (Array.isArray(v)) {
            for (var i = 0; i < v.length; i++) {
                if (v[i] !== undefined && v[i] !== null && String(v[i]).trim()) list.push(String(v[i]));
            }
        } else if (v !== undefined && v !== null && String(v).trim()) {
            list.push(String(v));
        }
        if (!list.length) return { text: THINK_FALLBACK[phase], phase: phase };
        var key = phase + "\u0000" + list.join("\u0000");
        if (thinkSpin.key !== key) {
            thinkSpin.key = key;
            thinkSpin.idx = Math.floor(Math.random() * list.length);
            thinkSpin.next = spinNextAt();
        } else if (list.length > 1 && Date.now() >= thinkSpin.next) {
            var n = thinkSpin.idx;
            while (n === thinkSpin.idx) n = Math.floor(Math.random() * list.length);
            thinkSpin.idx = n;
            thinkSpin.next = spinNextAt();
        }
        return { text: list[thinkSpin.idx % list.length], phase: phase };
    }
    function syncThinkWord(el) {
        var w = el.querySelector(".adv-think-word");
        if (!w) {
            w = document.createElement("div");
            w.className = "adv-think-word";
            el.appendChild(w);
        }
        var word = advThinkWord();
        // the words live in an inner span: every change swaps the element,
        // so the base sheet's fade-in restarts on each new word (and a set's
        // opacity breathing on the outer div keeps running underneath it)
        var sp = w.firstElementChild;
        if (!sp || sp.textContent !== word.text) {
            var n = document.createElement("span");
            n.textContent = word.text;
            if (sp) w.replaceChild(n, sp);
            else w.appendChild(n);
        }
        // phase rides a class, so a set's css can style each beat apart
        w.classList.toggle("adv-think-tool", word.phase === "tool");
        w.classList.toggle("adv-think-prompt", word.phase === "prompt");
        // the prompt beat hands its css a fill meter: --adv-think-charge
        // climbs 0 -> 1 with the prompt evaluation, so a set can let the
        // words THEMSELVES show how far along the wait is (glow warming,
        // blur burning off) with no bar, no pill, no traditional UI at all.
        // on the same meter thinkSparks() sheds motes off the line - a
        // sheet lights them by styling .adv-think-spark (fantasy does);
        // unstyled they are zero-size and invisible, same opt-out as the
        // caret particles.
        if (word.phase === "prompt") {
            var c = thinkCharge();
            w.style.setProperty("--adv-think-charge", c.toFixed(3));
            thinkSparks(w, c);
        } else {
            thinkChargeAt = 0;
            w.style.setProperty("--adv-think-charge", "0");
        }
    }
    var THINK_SPARK_CAP = 36;
    var thinkSparksMotion = null;
    function thinkSparks(w, c) {
        // charge-rate motes rising off the charging line: expected spawns
        // per tick are 3 * charge, so the incantation starts calm and ends
        // in a swirl. particles are plain empty <i> chips absolutely
        // positioned over the line; the pack's sheet decides everything a
        // mote looks like and whether it is visible at all.
        if (thinkSparksMotion === null) {
            try {
                thinkSparksMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            } catch (e) { thinkSparksMotion = true; }
        }
        if (!thinkSparksMotion) return;
        var roll = c * 3;
        var n = Math.floor(roll) + (Math.random() < roll % 1 ? 1 : 0);
        if (n < 1) return;
        var live = w.querySelectorAll(".adv-think-spark").length;
        var cap = window.AdvPerf ? AdvPerf.thinkSparkCap(THINK_SPARK_CAP) : THINK_SPARK_CAP;
        if (live >= cap) return;
        if (live + n > cap) n = cap - live;
        for (var i = 0; i < n; i++) {
            var p = document.createElement("i");
            p.className = "adv-think-spark";
            // triangular horizontal spread biased to the line's middle,
            // where the glyphs actually sit; motes lift off near the baseline
            p.style.left = (50 + (Math.random() + Math.random() - 1) * 45).toFixed(1) + "%";
            p.style.top = (55 + Math.random() * 45).toFixed(1) + "%";
            p.style.setProperty("--adv-sp-dx", ((Math.random() * 2 - 1) * 16).toFixed(1) + "px");
            p.style.setProperty("--adv-sp-s", (0.55 + Math.random() * 0.9).toFixed(2));
            p.style.animationDuration = (1.2 + Math.random() * 1.2).toFixed(2) + "s";
            p.addEventListener("animationend", function () { this.remove(); });
            w.appendChild(p);
            // safety net: a sheet that sets the spark animation to none
            // never fires animationend, and the motes would pile up forever
            (function (node) { setTimeout(function () { node.remove(); }, 4000); })(p);
        }
    }
    var thinkChargeAt = 0;
    function thinkCharge() {
        // real progress when the backend reports it: the router's model-load
        // percent first (a swap precedes any eval), then llama.cpp-style
        // prompt-eval progress - cache lines excluded, they were never
        // pending. A backend that reports nothing gets an eased synthetic
        // fill over ~12 s, so the effect still reads as movement; the
        // moment a real number lands the synthetic clock resets.
        // state-blind on purpose, exactly like the webui's own
        // promptprogress getter: the backend keeps streaming prompt_progress
        // DURING tool-result rounds (the longer next-round prompt re-evaluates
        // while the state stays processing_tools), and clears the store at
        // tool_call_delta, so the gauge refills honestly round after round -
        // only the unmeasurable work between (the tool actually running)
        // falls to the synthetic ramp.
        var p = -1;
        try {
            var st = Alpine.store("stream");
            if (st.modelLoad && typeof st.modelLoad.percent === "number") {
                p = st.modelLoad.percent / 100;
            } else {
                var pr = st.processing || {};
                if (typeof pr.percent === "number" && pr.percent > 0) p = pr.percent / 100;
                else {
                    var cache = pr.cache || 0;
                    var tot = (pr.total || 0) - cache;
                    if (tot > 0) p = ((pr.processed || 0) - cache) / tot;
                }
            }
        } catch (e) {}
        if (p >= 0) { thinkChargeAt = 0; return Math.max(0, Math.min(1, p)); }
        if (!thinkChargeAt) thinkChargeAt = Date.now();
        return Math.min(0.95, (Date.now() - thinkChargeAt) / 12000);
    }
    function advSyncThinkingSvg() {
        // the url rides on the fx pack (AdvFX.thinkingSvgUrl()); same
        // url as last time means the running sigil stays untouched
        var url = (window.AdvFX && window.AdvFX.thinkingSvgUrl)
            ? window.AdvFX.thinkingSvgUrl() : "";
        if (url === thinkUrlSeen) return;
        thinkUrlSeen = url;
        if (!url) { advSetThinkSvg(""); return; }
        fetch(url).then(function (r) { return r.ok ? r.text() : ""; })
            .then(function (txt) {
                if (thinkUrlSeen === url) advSetThinkSvg(String(txt || "").trim());
            })
            .catch(function () {
                if (thinkUrlSeen === url) advSetThinkSvg("");   // fallback keeps its place
            });
    }
    // adv:fx (the pack reloading on campaign/asset-pack changes) re-picks
    // the sigil from the new pack
    window.advReloadThinking = function () { thinkUrlSeen = null; advSyncThinkingSvg(); };
    /* thinking bed: a pack shipping thinking_loop.<audio> in its
     * sfx_builtin/ shelf gets a hum that follows the indicator - faded in as the
     * sigil appears, faded out when it leaves (answer streamed, game
     * exited, chain shown). The want-guard keeps the volume staircase
     * restarting only on real transitions, so syncThinking may call this
     * on every watch tick for free; the bed keeps its loop position
     * across thinking beats. */
    var thLoop = null, thLoopSrc = "", thLoopFade = null, thLoopWant = null;
    function thRamp(to, step) {
        // 40 ms volume staircase; at 0 it pauses the element, so the
        // next fade-in resumes from the same spot
        if (!thLoop) return;
        clearInterval(thLoopFade);
        thLoopFade = setInterval(function () {
            var up = to >= thLoop.volume;
            var v = thLoop.volume + (up ? step : -step);
            if (up ? v >= to : v <= to) v = to;
            thLoop.volume = Math.max(0, Math.min(1, v));
            if (v === to) {
                clearInterval(thLoopFade);
                thLoopFade = null;
                if (to <= 0) { try { thLoop.pause(); } catch (e) {} }
            }
        }, 40);
    }
    function thinkingLoopSet(on) {
        var url = (window.AdvFX && window.AdvFX.thinkingLoopUrl)
            ? (window.AdvFX.thinkingLoopUrl() || "") : "";
        if (on && url && sfxOn()) {
            if (thLoopWant === true) return;
            thLoopWant = true;
            if (!thLoop || thLoopSrc !== url) {
                if (!thLoop) {
                    thLoop = new Audio();
                    thLoop.loop = true;
                    thLoop.preload = "auto";
                }
                thLoop.src = url;
                thLoopSrc = url;
                thLoop.volume = 0;
            }
            if (thLoop.paused) {
                var p = thLoop.play();
                if (p && p.catch) p.catch(function () {});
            }
            thRamp(0.16, 0.02);   // ~0.3 s fade-in, background level
        } else {
            if (thLoopWant === false) return;
            thLoopWant = false;
            if (thLoop && !thLoop.paused) thRamp(0, 0.016);   // ~0.4 s fade-out
        }
    }
    function syncThinking() {
        var want = false;
        try {
            want = !!(Alpine.store("adv").active)
                && !!THINK_STATES[Alpine.store("stream").state]
                && document.documentElement.classList.contains("adv-hide-chain");
        } catch (e) {}
        if (want) {
            var el = document.getElementById("adv-thinking");
            if (!el) {
                el = document.createElement("div");
                el.id = "adv-thinking";
                el.innerHTML = advThinkMarkup();
                document.body.appendChild(el);
            }
            // center inside the CHAT WINDOW, not the whole viewport - the
            // sidebar shifts the story column right, so a plain 50% of the
            // window sat visibly left of the passage. (element is position:
            // fixed, getBoundingClientRect is in the same coordinate space)
            var win = document.getElementById("chat-window");
            if (win) {
                var r = win.getBoundingClientRect();
                el.style.left = (r.left + r.width / 2) + "px";
                el.style.top = (r.top + r.height / 2) + "px";
            }
            // every tick re-reads the phase: thinking -> tool processing
            // swaps the word (and its .adv-think-tool class) in place
            syncThinkWord(el);
        }
        document.documentElement.classList.toggle("adv-thinking", want);
        thinkingLoopSet(want);
    }

    /* floating ⚜ button: the adventure hides the core header (and with it
     * the mobile hamburger), so the campaign panel gets its own toggle.
     * Rewind/Journal duties already live inside the panel. */
    function ensurePanelToggle() {
        if (document.getElementById("adv-panel-toggle")) return;
        var b = document.createElement("button");
        b.id = "adv-panel-toggle";
        b.setAttribute("type", "button");
        // mobile-only, and only while the overlay is closed - Alpine reacts
        // to store changes, so it hides itself the moment the panel opens
        // (desktop keeps its always-visible sidebar during adventures)
        b.setAttribute("x-data", "({ get visible() { var a = $store.adv; var ui = $store.ui; return !!(a && a.active) && ui.isMobile && !ui.showSidebar; } })");
        b.setAttribute("x-show", "visible");
        b.setAttribute("x-cloak", "");
        b.title = "Show the campaign panel";
        b.textContent = "\u269C";
        b.addEventListener("click", function () {
            var ui;
            try { ui = Alpine.store("ui"); } catch (e) { return; }
            ui.showSidebar = true;
            var t = document.querySelector('.sidebar-tab[data-tab="adventure_games/adventure"]');
            if (t && !t.classList.contains("active")) t.click();
        });
        document.body.appendChild(b);
    }

    /* world watcher: react to webui dark/light toggles (repick palette
     * variant + recolor speakers) and keep the thinking overlay in sync */
    var lastMode = null;
    setInterval(function () {
        var mode = webuiMode();
        if (lastMode !== null && mode !== lastMode) {
            applyTheme();
            stylePassSoon();
        }
        lastMode = mode;
        syncThinking();
    }, 250);
    window.addEventListener("adv:delta", function (e) {
        if (!sfxOn()) return;
        var d = (e && e.detail) || {};
        (d.stats || []).forEach(function (s) { sfx[s.delta > 0 ? "up" : "down"](); });
    });
    window.addEventListener("adv:choice", function () { if (sfxOn()) sfx.chime(); });
    window.addEventListener("adv:dice", function (e) {
        if (sfxOn()) sfx.dice();
        // crit & fumble juice (gold shimmer / red flash + shake) lives in
        // adventure_beats.js and judges the rolled dice itself
        if (window.AdvBeats) window.AdvBeats.dice(e && e.detail);
    });

    // phone-mode flip (adventure_mobile.js fires it when the screen grows
    // past or shrinks under the phone threshold): the layers mounted under
    // the old budget get rebuilt at the new one. dropping the sentinels
    // makes the appliers treat everything as a fresh kind; the canvas
    // children go with them (a canvas that already exists is never
    // re-made), and the shader loader prunes the detached shots itself.
    window.addEventListener("adv:perf", function () {
        weatherKind = null;
        skyKind = null;
        var holder = document.getElementById("adv-effects");
        if (holder) {
            Array.prototype.slice.call(holder.children).forEach(function (el) {
                if (el.tagName === "CANVAS") el.remove();
            });
        }
        applySky();
        applyWeather();
        applyEffects();
    });

    // restyle whenever the message area changes (file one converts wiki links there first)
    function attachObserver() {
        var messages = document.getElementById("messages");
        if (!messages) { setTimeout(attachObserver, 300); return; }
        // macroPhasePass runs synchronously here: the observer callback is
        // a microtask, so fresh macro spans get their --adv-phase offset
        // before the browser ever paints them (no visible animation reset
        // across streaming re-renders). railPassSoon stays throttled - it
        // is pure structure (choice-rail consolidation); content styling
        // is handled by the marked extensions during parse.
        var obsQueued = false;
        function obsPass() {
            macroPhasePass();
            // scene-art ceremony too: this observer is a microtask, so a
            // freshly revealed picture gets its hold + hidden state before
            // the browser ever paints another character
            if (window.advScanNewImgs) { try { window.advScanNewImgs(); } catch (e) {} }
            railPassSoon();
        }
        new MutationObserver(function () {
            // desktop stays synchronous (zero-frame animation resets);
            // phones coalesce the burst of mutations a streaming frame
            // causes into ONE pass per painted frame
            if (window.AdvPerf && AdvPerf.observerCoalesce()) {
                if (obsQueued) return;
                obsQueued = true;
                requestAnimationFrame(function () {
                    obsQueued = false;
                    obsPass();
                });
                return;
            }
            obsPass();
        }).observe(messages, { childList: true, subtree: true });
        ensurePanelToggle();
        // tabbar hidden while immersed
        var style = document.createElement("style");
        style.textContent = "html.adv-on .sidebar-tabbar { display: none !important; }";
        document.head.appendChild(style);
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", attachObserver);
    } else {
        attachObserver();
    }
})();
