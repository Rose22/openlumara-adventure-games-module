/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-10) harness:openlumara
   adventure_games :: minimal GLSL loader for sky backdrops, weathers,
   overlays and pulses. Rebuilt from scratch, deliberately tiny: fetch ->
   size -> gl -> draw, one rAF, degrade to css on failure.

   API (used by adventure_plus.js and adventure_beats.js):
     AdvShaders.sky(name)          canvas | null  (caller appends to #adv-sky)
     AdvShaders.weather(kind)      canvas | null  (caller appends to #adv-weather)
     AdvShaders.overlay(name)      canvas | null  (caller appends to #adv-effects)
     AdvShaders.shot(name)         canvas | null  (caller appends to #adv-pulses)
     AdvShaders.shotMs(name, dflt) lifetime for a mounted pulse
     AdvShaders.available() / has(kind, name)
   glsl urls come from the visual pack: AdvFX.shader(kind, name).

   THE ONE RULE (hard-won, see bug hunt 2026-11-10): a shot's drawing
   buffer is sized 1:1 with its css box FIRST, the webgl context is
   created SECOND, and both happen only once the canvas is already
   mounted, visible and sized. Anything else - context on a detached
   canvas, on the default 300x150 buffer, or buffer resized after draws -
   gets a compositor layer chromium never lands: the shader renders,
   readPixels inside the frame proves every pixel, the screen stays
   empty. Firefox re-attaches lazily, so every symptom looked like a
   firefox-only feature.

   Failure is graceful by design: fetch/compile/link errors log once and
   the canvas degrades back to the plain css-styled div (weather skies
   simply vanish - their particles carry the look). The css sheet stays a
   complete fallback for every shader asset. */
(function () {
    var cfg = window.ADV_CONFIG || {};
    var MAX = (typeof cfg.shader_max === "number") ? cfg.shader_max : 3;
    var VERT = "attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }";
    var UNAMES = ["u_time", "u_resolution", "u_aspect", "u_accent",
                  "u_ink", "u_page", "u_dark", "u_progress"];
    var shots = [];
    var raf = 0;
    var lastPal = 0;
    var pal = { accent: [0.91, 0.47, 0.98], ink: [0.95, 0.89, 0.96], page: [0.13, 0.06, 0.15] };

    function available() {
        return cfg.shaders_enabled !== false && MAX > 0 &&
            !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
    function has(kind, name) {
        return available() && !!(window.AdvFX && AdvFX.shader && AdvFX.shader(kind, name));
    }

    // the shader_max budget only counts the CUSTOM kinds (weathers and
    // held overlays); a sky and a pulse each get their own slot, exactly
    // as the setting's description promises. phones clamp the budget
    // further through AdvPerf. live = still mounted and not given up.
    function customMax() {
        var m = MAX;
        if (window.AdvPerf) m = AdvPerf.shaderMax(m);
        return m;
    }
    function customLive(kind, name) {
        var n = 0;
        for (var i = 0; i < shots.length; i++) {
            var s = shots[i];
            if (s.dead || !s.cv.isConnected) continue;
            if (s.kind !== "weather" && s.kind !== "overlays") continue;
            // a re-mount of the very same asset (a fresh scene restaging
            // the same weather) does not compete with itself
            if (s.kind === kind && s.name === name) continue;
            n++;
        }
        return n;
    }

    // internal buffer scale for a new shot: the setting's fixed
    // percentage when nonzero, else DYNAMIC by how many shaders animate
    // (150% for one, 100% for two, 75% for three or more), then stepped
    // down by the phone mode. the css box keeps its size (the canvas
    // carries width/height:100%), so a smaller buffer just means fewer
    // pixels to fill - the same look rendered cheaper. sized ONCE before
    // getContext, never after (see the header's ONE RULE).
    function bufferScale() {
        var s;
        var pct = parseFloat(cfg.shader_resolution);
        if (isFinite(pct) && pct > 0) {
            s = pct / 100;
        } else {
            var live = 0;
            for (var i = 0; i < shots.length; i++) {
                if (!shots[i].dead && shots[i].cv.isConnected) live++;
            }
            s = live <= 1 ? 1.5 : (live === 2 ? 1.0 : 0.75);
        }
        if (window.AdvPerf) s = AdvPerf.shaderScale(s);
        return Math.max(0.25, Math.min(1.5, s));
    }

    function make(kind, name, cls) {
        if (!has(kind, name)) return null;
        // the custom kinds share the (phone-clamped) budget; the caller
        // receives null and quietly keeps the plain css div
        if ((kind === "weather" || kind === "overlays") &&
                customLive(kind, name) >= customMax()) return null;
        var cv = document.createElement("canvas");
        cv.className = cls;
        cv.style.opacity = "1";
        var shot = { kind: kind, name: name, url: AdvFX.shader(kind, name),
                     cv: cv, src: null, gl: null, prog: null, u: null,
                     t0: 0, dur: 1600, dead: false };
        shots.push(shot);
        fetch(shot.url).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.text();
        }).then(function (src) {
            if (shot.dead) return;
            var m = /\/\/\s*duration:\s*([0-9.]+)/.exec(src);
            if (m) shot.dur = Math.min(60000, Math.max(50, parseFloat(m[1]) * 1000));
            shot.src = src;
            kick();
        }, function (e) { fail(shot, e); });
        return cv;
    }

    // the birth order: SIZE, then getContext, then compile. never again.
    function init(shot, now) {
        var cv = shot.cv;
        var f = bufferScale();
        cv.width = Math.max(2, Math.round(cv.clientWidth * f));
        cv.height = Math.max(2, Math.round(cv.clientHeight * f));
        var gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: false,
                                          antialias: false, depth: false, stencil: false });
        if (!gl) { fail(shot, new Error("webgl unavailable")); return; }
        function sh(type, src) {
            var h = gl.createShader(type);
            gl.shaderSource(h, src);
            gl.compileShader(h);
            if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) {
                var log = gl.getShaderInfoLog(h) || "compile failed";
                gl.deleteShader(h);
                throw new Error(log);
            }
            return h;
        }
        // precision normalization: the classic hash() noise stack multiplies
        // coordinates past mediump's 65504 ceiling into infinity, and
        // fract(sin(inf)) poisons the whole pixel with NaN - chromium
        // faithfully honors mediump and composites those pixels as NOTHING
        // (invisible weather, zero console noise), while firefox quietly
        // promotes every precision to highp, which is why the same shader
        // rendered fine in librewolf. the loader upgrades every mediump
        // declaration to the highp-guard block at compile time, so the
        // whole asset pack - and any third-party one - renders identically
        // everywhere. the #else branch keeps GPUs without highp working.
        // precision upgrade FIRST (the replacement must hit the shader's
        // own declaration), dither wrap second
        var frag = String(shot.src).replace(
            /precision\s+mediump\s+float\s*;/,
            "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n" +
            "#else\nprecision mediump float;\n#endif");
        var vs = sh(gl.VERTEX_SHADER, VERT);
        var fs = sh(gl.FRAGMENT_SHADER, frag);
        var p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.bindAttribLocation(p, 0, "a_pos");
        gl.linkProgram(p);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            var log = gl.getProgramInfoLog(p) || "link failed";
            gl.deleteProgram(p);
            throw new Error(log);
        }
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);   // one quad, straight alpha: blending would corrupt it
        shot.gl = gl;
        shot.prog = p;
        shot.t0 = now;
        shot.u = {};
        UNAMES.forEach(function (n) { shot.u[n] = gl.getUniformLocation(p, n); });
    }

    function hex2rgb(str, fb) {
        var m = /^#([0-9a-f]{3,8})$/i.exec(String(str || "").trim());
        if (!m) return fb;
        var h = m[1];
        if (h.length >= 6) return [parseInt(h.substr(0, 2), 16) / 255,
                                   parseInt(h.substr(2, 2), 16) / 255,
                                   parseInt(h.substr(4, 2), 16) / 255];
        if (h.length >= 3) return [parseInt(h[0], 16) / 17, parseInt(h[1], 16) / 17,
                                   parseInt(h[2], 16) / 17];
        return fb;
    }
    function readPal() {
        try {
            var cs = getComputedStyle(document.documentElement);
            pal.accent = hex2rgb(cs.getPropertyValue("--adv-accent"), pal.accent);
            pal.ink = hex2rgb(cs.getPropertyValue("--adv-ink"), pal.ink);
            pal.page = hex2rgb(cs.getPropertyValue("--adv-page"), pal.page);
        } catch (e) {}
    }
    function darkLevel() {
        try {
            var st = Alpine.store("adv");
            var c = st && st.active ? st.campaign : null;
            return Math.max(0, Math.min(1, (c && c.light ? c.light : 0) / 100));
        } catch (e) { return 0; }
    }

    function draw(shot, now) {
        var gl = shot.gl;
        if (!gl || gl.isContextLost()) return;   // eviction freezes the last frame
        var w = shot.cv.width, h = shot.cv.height;
        if (!w || !h) return;
        var u = shot.u;
        var t = (now - shot.t0) / 1000;
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(shot.prog);
        if (u.u_time) gl.uniform1f(u.u_time, t);
        if (u.u_resolution) gl.uniform2f(u.u_resolution, w, h);
        if (u.u_aspect) gl.uniform1f(u.u_aspect, w / h);
        if (u.u_accent) gl.uniform3fv(u.u_accent, pal.accent);
        if (u.u_ink) gl.uniform3fv(u.u_ink, pal.ink);
        if (u.u_page) gl.uniform3fv(u.u_page, pal.page);
        if (u.u_dark) gl.uniform1f(u.u_dark, darkLevel());
        if (u.u_progress) gl.uniform1f(u.u_progress, Math.min(1, t * 1000 / shot.dur));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function fail(shot, err) {
        shot.dead = true;
        console.error("[adventure shaders] " + shot.kind + " '" + shot.name +
            "' failed (" + shot.url + "): " + ((err && err.message) || err) +
            " - the css fallback is playing");
        var el = shot.cv;
        if (el && el.parentNode && shot.kind !== "weather" && shot.kind !== "skies") {
            // swap back to the plain div so its css sheet paints instead
            // (the two LAYERED kinds need no swap: their canvas is one child
            // of a layer the engine rebuilds anyway, so removal alone lets
            // the layer's own css and motes fall back in)
            var alt = document.createElement("div");
            alt.id = el.id;
            alt.className = el.className;
            if (el.dataset.fx) alt.dataset.fx = el.dataset.fx;
            el.parentNode.replaceChild(alt, el);
        } else if (el) {
            el.remove();
        }
        // tell the engine: this asset's shader gave up, css resumes.
        // (adv:fx-fail carries kind + name so only the owning kind reacts)
        try {
            window.dispatchEvent(new CustomEvent("adv:fx-fail",
                { detail: { kind: shot.kind, name: shot.name } }));
        } catch (e) {}
    }

    function frame() {
        raf = 0;
        shots = shots.filter(function (s) { return !s.dead && s.cv.isConnected; });
        if (!shots.length) return;               // nothing mounted: sleep
        raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        var now = performance.now();
        if (now - lastPal > 1000) { lastPal = now; readPal(); }
        shots.forEach(function (s) {
            if (!s.src) return;                  // still fetching
            if (!s.prog) {
                // wait until the canvas is really on screen and sized,
                // that is the only birth chromium composites (see header)
                if (!s.cv.isConnected || s.cv.clientWidth === 0) return;
                try { init(s, now); } catch (e) { fail(s, e); }
                return;                          // first pixels next frame
            }
            draw(s, now);
        });
    }
    function kick() {
        if (!raf && shots.length) raf = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) kick();
    });

    // overlays held before the pack landed upgrade the moment it says they have one
    window.addEventListener("adv:fx", function () {
        var holder = document.getElementById("adv-effects");
        if (!holder) return;
        Array.prototype.slice.call(holder.children).forEach(function (el) {
            var name = el.dataset.fx;
            if (!name || el.tagName === "CANVAS" || !has("overlays", name)) return;
            var cv = make("overlays", name, el.className);
            if (!cv) return;
            cv.id = el.id;
            cv.dataset.fx = name;
            el.parentNode.replaceChild(cv, el);
            kick();
        });
    });

    window.AdvShaders = {
        version: "2026-11-10-minimal-nodither",
        available: available,
        has: has,
        sky: function (name) {
            var cv = make("skies", name, "adv-skshader adv-skshader-" + name);
            if (cv) kick();
            return cv;
        },
        weather: function (kind) {
            var cv = make("weather", kind, "adv-wshader adv-wshader-" + kind);
            if (cv) kick();
            return cv;
        },
        overlay: function (name) {
            var cv = make("overlays", name, "adv-fx adv-fx-" + name);
            if (cv) kick();
            return cv;
        },
        shot: function (name) {
            var cv = make("pulses", name, "adv-fx adv-fx-" + name);
            if (cv) kick();
            return cv;
        },
        shotMs: function (name, dflt) {
            for (var i = shots.length - 1; i >= 0; i--) {
                if (shots[i].kind === "pulses" && shots[i].name === name)
                    return shots[i].dur + 300;
            }
            return dflt;
        },
        _debug: function () {
            return { version: "2026-11-10-minimal-nodither", loop: !!raf,
                     shots: shots.map(function (s) {
                         return { kind: s.kind, name: s.name, src: !!s.src,
                                  prog: !!s.prog, lost: s.gl ? s.gl.isContextLost() : null,
                                  onscreen: s.cv.isConnected,
                                  buf: s.cv.width + "x" + s.cv.height,
                                  css: s.cv.clientWidth + "x" + s.cv.clientHeight };
                     }) };
        }
    };
})();
