/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-08) harness:openlumara
   adventure_games :: chat-window bounds (split module).

   Every screen overlay belongs to the STORY, not to the monitor: the
   day/night tint, the weather particles, the held overlay moods, the
   one-shot pulses, the torch vignette and the beat cards & curtains all
   sit over the chat window - the sidebar stays readable through a
   snowfall or a whiteout.

   The layers themselves stay exactly where they were created (position:
   fixed divs on the body, owned by adventure_plus.js / adventure_beats.js);
   this file only pins their geometry to the #chat-window rect and keeps
   them glued as the window moves: instantly on resize, and on a light
   tick besides (a sidebar slide fires no resize event). If the window
   cannot be measured the layers fall back to their plain full-screen CSS.

   Talks to the other scripts through window.AdvBounds. */
(function () {
    // every body-level story layer, in paint order. adv-diceroll measures
    // itself per roll (adventure_games.js); gluing it here too keeps the
    // stage locked to the window even when the sidebar slides mid-flourish
    // (identical inline values, so the two writers never fight)
    var IDS = ["adv-tint", "adv-weather", "adv-effects", "adv-pulses",
               "adv-torch", "adv-diceroll", "adv-beat"];

    function box() {
        var w = document.getElementById("chat-window");
        if (!w) return null;
        var r = w.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return r;
    }
    function fit(el, r) {
        if (!el || !r) return;
        el.style.left = r.left + "px";
        el.style.top = r.top + "px";
        el.style.width = r.width + "px";
        el.style.height = r.height + "px";
    }
    function sync() {
        var r = box();
        if (!r) return;
        for (var i = 0; i < IDS.length; i++) {
            fit(document.getElementById(IDS[i]), r);
        }
    }

    window.addEventListener("resize", sync);
    // sidebar toggles and theme swaps reshuffle the window silently -
    // a cheap tick re-glues the layers (a few id lookups, no layout reads
    // beyond one rect)
    setInterval(sync, 300);
    // first pass once the interface exists
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", sync);
    }
    sync();

    window.AdvBounds = { box: box, fit: fit, sync: sync };
})();
