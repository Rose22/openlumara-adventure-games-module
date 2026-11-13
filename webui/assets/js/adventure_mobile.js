/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-11) harness:openlumara
   adventure_games :: phone performance mode.

   One tiny decision-maker shared by every other engine file: when the
   core webui says this is a phone screen (Alpine store "ui".isMobile -
   the same width<=768 verdict the core itself maintains, with a plain
   innerWidth fallback for the loads that beat Alpine's init), the whole
   show steps down a gear instead of stuttering through it:

     - WebGL shaders render into a smaller buffer (they ride CSS-scaled
       into the same box: same look, a fraction of the fill rate) and
       fewer custom shaders run at once
     - weather/sky particle fields shrink
     - the SVG page refraction (a whole-window displacement filter) is
       refused outright
     - the typewriter paints at a capped frame gap, its caret sheds
       fewer particles and skips its ghost trail on low-power devices
     - ambience beds are NEVER capped (full mix on phones too), sparkle
       decorations slim down, woozy letters render as plain text
     - a "adv-phone" (+ "adv-lowpower") class rides on <html> so the css
       sheet (adventure_mobile.css) can drop the expensive primitives:
       backdrop-filter, big blurs, blend modes, the giant death-curtain
       box-shadow

   LOW-POWER guess: navigator.deviceMemory <= 4 or hardwareConcurrency
   <= 4 (phones that report neither stay on the regular phone tier).

   Every helper answers the DESKTOP default while this mode is off, so
   the other files can call it unconditionally. A phone that rotates
   into tablet width flips live: the class updates and "adv:perf" fires
   so plus.js re-stages the layers at the new budget. */
(function () {
    var cfg = window.ADV_CONFIG || {};
    var enabled = cfg.phone_performance_mode !== false;

    var mobile = false;   // cached verdict (polled + event-refreshed)

    function phoneNow() {
        if (!enabled) return false;
        // the core's own store first: it is the single source of truth for
        // "phone" in this interface (index.html keeps it current on resize)
        try {
            var s = window.Alpine && Alpine.store("ui");
            if (s && typeof s.isMobile === "boolean") return s.isMobile;
        } catch (e) {}
        // pre-Alpine / store-less fallback: the same threshold the core uses
        return (window.innerWidth || 9999) <= 768;
    }
    function lowNow() {
        try {
            if (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4) return true;
            if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4) return true;
        } catch (e) {}
        return false;
    }

    function apply() {
        var now = phoneNow();
        var low = now && lowNow();
        var h = document.documentElement;
        // the very first pass only paints classes; a flip AFTER that is a
        // real mode change and earns the re-stage event
        var flipping = mobile !== now;
        mobile = now;
        h.classList.toggle("adv-phone", now);
        h.classList.toggle("adv-lowpower", now && low);
        if (flipping && window.AdvPerf) {
            // shader canvases mounted under the old budget get re-created
            // at the new one (plus.js owns the re-stage)
            try { window.dispatchEvent(new CustomEvent("adv:perf")); } catch (e) {}
        }
    }
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    // cheap safety net: the Alpine store can settle after our first read,
    // and some embedded webviews resize without firing either event
    setInterval(apply, 3000);

    // scale a default down only while the phone tier is active
    function step(desktop, phone, lowpower) {
        if (!mobile) return desktop;
        return lowNow() ? lowpower : phone;
    }

    window.AdvPerf = {
        version: "2026-11-11-phone-perf",
        isPhone: function () { return mobile; },
        lowPower: function () { return mobile && lowNow(); },
        enabled: function () { return enabled; },

        // weather/sky motes: fewer of them, hard-capped, never below 3
        particleCount: function (n) {
            if (!mobile || n <= 0) return n;
            var v = Math.round(n * (lowNow() ? 0.35 : 0.6));
            v = Math.min(v, n, lowNow() ? 12 : 26);
            return Math.max(v, Math.min(n, lowNow() ? 2 : 3));
        },

        // shader buffer scale (multiplies the loader's own choice);
        // phones never render above css-pixel density
        shaderScale: function (base) {
            if (!mobile) return base;
            return Math.min(base * (lowNow() ? 0.45 : 0.7), 1);
        },
        // simultaneous custom (weather/overlay) shaders
        shaderMax: function (dflt) {
            if (!mobile) return dflt;
            return Math.min(dflt, lowNow() ? 1 : 2);
        },

        // the SVG displacement page-bend: refused on phones
        refractAllowed: function () { return !mobile; },

        // typewriter: paint cadence, speed ceiling
        paintGapMs: function () { return step(0, 26, 36); },
        cpsCap: function (v) { return mobile ? Math.min(v, lowNow() ? 160 : 240) : v; },

        // caret particles: slower emission, smaller field, ghost trail off
        caretThrottle: function () { return step(8, 36, 55); },
        caretCap: function () { return step(480, 90, 36); },
        caretGhostMs: function () { return step(30, 120, 0); },
        keysPerRoll: function (n) { return mobile ? Math.min(n, lowNow() ? 3 : 6) : n; },

        // ambience beds: no cap, even on phones (0 = all). the old
        // 2-layer phone trim (1 on low-power) is gone: android turns out
        // to take the full mix, and a trimmed bed silently lost its
        // texture layers - better the whole world audible than a
        // stuttering half of it
        maxAmbienceLoops: function () { return 0; },

        // inline decorations: stars per word (0 = none), woozy as plain text
        sparkleWordMax: function (n) { return mobile ? (lowNow() ? 0 : Math.min(n, 1)) : n; },
        woozyPlain: function () { return mobile; },

        // thinking-spark motes shed off the prompt charge meter
        thinkSparkCap: function (dflt) { return mobile ? Math.min(dflt, lowNow() ? 4 : 12) : dflt; },

        // image reveal: shorter unroll ceiling, dice face flashes tick slower
        wipeMax: function (dflt) { return mobile ? Math.min(dflt, lowNow() ? 4000 : 6000) : dflt; },
        diceTickMul: function () { return step(1, 2, 2); },

        // floating delta badges alive at once (0 = unlimited)
        chipMax: function () { return step(0, 4, 2); },

        // MutationObserver passes coalesce into one per frame on phones
        observerCoalesce: function () { return mobile; },

        // the fumble screen-shake rattles the whole chat window: skip it
        shakeAllowed: function () { return !mobile; }
    };
})();
