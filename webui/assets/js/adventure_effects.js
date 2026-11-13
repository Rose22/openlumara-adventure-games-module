/* -- AI GENERATED CODE (Qwen3.8 Flash Next) :: (2026-11-09) harness:openlumara
   adventure_games :: per-set visual pack (split module).

   Loads what the campaign's asset pack ships in overlays/, weather/,
   skies/, pulses/ and text_decoration/: per name a {css, shader} URL
   pair plus, for the two layered kinds (weather and skies), the inlined
   particle specs, from ONE /fx fetch (chat-scoped, rescanned live like
   every other asset map). The payload also carries the CHROME slots -
   single files in a set's root, the campaign's own already picked over
   the default base, file for file: thinking.svg (url handed to plus.js
   through AdvFX.thinkingSvgUrl() - it injects the sigil's markup) with
   thinking.css as its skin, dice.css + dice.json (the roll flourish's
   look and its glyphs, the latter read by games.js via
   AdvFX.diceLook()), caret.css (the typewriter cursor sprite's look,
   positioned by type.js), typing_loop.<audio> (a set's optional typing
   bed replacing the per-key clacks, handed to type.js through
   AdvFX.typingLoopUrl()), and thinking_loop.<audio> (an optional hum
   riding the thinking indicator, handed to plus.js through
   AdvFX.thinkingLoopUrl()) - both beds live in sfx_builtin/, scanned by
   stem. Stylesheets ride in as <link> tags
   appended AFTER the module's own css, so a set's re-skin of a
   built-in look wins by cascade and a brand-new name simply works. The
   <name>.glsl urls are kept for the shader runtime
   (adventure_shaders.js), which swaps a live canvas in wherever the
   campaign actually uses a shader asset.

   The text_decoration entries are the INLINE kind: their sheets skin
   {{name|text}} spans in the prose, and their vocabulary (tdList/tdAlt/
   tdRender) feeds the flavor-macro regexes - the decoration names ARE
   the macro kinds the engines match, nothing hardcoded. A sidecar spec
   may name a "render" mode ("sparkle"/"woozy") for looks that need the
   engines' DOM builders instead of plain css.

   When the pack lands (or switches), "adv:fx" fires: the pulse-name
   and decoration-name regexes in games/type/plus rebuild themselves from
   AdvFX.pulseAlt()/tdAlt(), the weather and sky engines re-apply with
   fresh specs, and custom pulses that fired before their sheet existed
   replay from the queue.
   Like sfx_builtin the DEFAULT SET is the global base: its folders ship
   the base pack of overlays, weather kinds, sky kinds, pulses and text
   decorations, and the campaign's set overrides those files one by one
   (sheets load after
   the module css, so a re-skin wins by cascade). The pack IS the
   vocabulary - no name list is hardcoded here. */
(function () {
    var gen = 0;
    var ready = false;
    var weatherSpecs = {};   // name -> {css, shader, spec} entries from /fx
    var skySpecs = {};       // same shape, for the sky backdrop layer
    var shaders = { overlays: {}, weather: {}, skies: {}, pulses: {} };  // kind -> name -> glsl url
    var pulseList = [];
    var decorationSpecs = {};  // name -> {css, spec} inline entries from /fx
    var decorationList = [];
    var diceLookSpec = {};     // faces/heads/tails from the dice.json slot
    var thinkingSvgUrl = "";   // the thinking sigil's svg (plus.js injects it)
    var typingLoopUrl = "";    // the pack's optional typing bed (read by type.js)
    var thinkingLoopUrl = "";  // the pack's optional thinking hum (read by plus.js)
    var thinkTextSpec = {};    // thinking_text.json: the pack's words under the sigil
    var links = {};          // css url -> <link> element (source order kept)
    var queue = [];          // custom pulses that fired before the pack was ready

    function chatQ() {
        var chat = null;
        try { chat = Alpine.store("chat").selectedChat; } catch (e) {}
        return chat ? ("?chat=" + encodeURIComponent(chat)) : "";
    }

    // diff-sync the stylesheet set: a same-url sheet keeps its link
    // untouched (no flicker, no restarted animations), missing ones are
    // created, stale ones removed. links append to head AFTER the module
    // css - that source order is what makes an override win.
    function syncLinks(want) {
        Object.keys(links).forEach(function (u) {
            if (want[u]) return;
            try { links[u].parentNode.removeChild(links[u]); } catch (e) {}
            delete links[u];
        });
        Object.keys(want).forEach(function (u) {
            if (links[u]) return;
            var el = document.createElement("link");
            el.rel = "stylesheet";
            el.href = u;
            el.setAttribute("data-advfx", "1");
            document.head.appendChild(el);
            links[u] = el;
        });
    }

    function applyMaps(data) {
        data = data || {};
        // every entry is now {css, shader} (empty strings = absent): the
        // css sheets link in as before, the glsl urls are handed to the
        // shader runtime (adventure_shaders.js) through AdvFX.shader()
        var want = {};
        var sh = { overlays: {}, weather: {}, skies: {}, pulses: {} };
        // the inline kind links its sheets too, but is NOT a screen
        // vocabulary: its names build the {{name|text}} decoration regexes
        // (tdList below) and its specs carry a render mode, never a shader
        var tdMap = data.text_decoration || {};
        Object.keys(tdMap).forEach(function (n) {
            var entry = tdMap[n] || {};
            if (entry.css) want[entry.css] = 1;
        });
        decorationSpecs = tdMap;
        decorationList = Object.keys(tdMap).sort();
        // the chrome slots: single files sitting in a set's root
        // (thinking.svg + thinking.css, dice.css + dice.json, caret.css).
        // The backend already picked the campaign pack's file over the
        // default base's, file for file - each slot is just {css} (plus
        // the sigil's svg url, handed to plus.js through
        // AdvFX.thinkingSvgUrl(), and the dice glyph spec).
        var chromeThink = data.thinking || {};
        thinkingSvgUrl = chromeThink.svg || "";
        thinkingLoopUrl = chromeThink.loop || "";
        if (chromeThink.css) want[chromeThink.css] = 1;
        // the words under the sigil: css rides the pack, the merged json
        // spec is handed to plus.js through AdvFX.thinkText()
        var chromeThinkText = chromeThink.text || {};
        if (chromeThinkText.css) want[chromeThinkText.css] = 1;
        thinkTextSpec = (chromeThinkText.spec && typeof chromeThinkText.spec === "object")
            ? chromeThinkText.spec : {};
        var chromeDice = data.dice || {};
        if (chromeDice.css) want[chromeDice.css] = 1;
        diceLookSpec = (chromeDice.spec && typeof chromeDice.spec === "object")
            ? chromeDice.spec : {};
        var chromeCaret = data.caret || {};
        if (chromeCaret.css) want[chromeCaret.css] = 1;
        typingLoopUrl = ((data.typing || {}).loop) || "";
        ["overlays", "pulses"].forEach(function (kind) {
            var map = data[kind] || {};
            Object.keys(map).forEach(function (n) {
                var entry = map[n] || {};
                if (entry.css) want[entry.css] = 1;
                if (entry.shader) sh[kind][n] = entry.shader;
            });
        });
        // the two layered kinds carry an inlined particle spec beside the
        // urls: the weather foreground and the sky backdrop
        ["weather", "skies"].forEach(function (kind) {
            var map = data[kind] || {};
            Object.keys(map).forEach(function (n) {
                var entry = map[n] || {};
                if (entry.css) want[entry.css] = 1;
                if (entry.shader) sh[kind][n] = entry.shader;
            });
            if (kind === "weather") weatherSpecs = map;
            else skySpecs = map;
        });
        syncLinks(want);
        shaders = sh;
        // the pulse vocabulary the macro engines build their regexes
        // from: exactly the names the pack ships - files are everything
        pulseList = Object.keys(data.pulses || {}).sort();
        ready = true;
        try { window.dispatchEvent(new CustomEvent("adv:fx")); } catch (e) {}
        // custom pulses that fired before their stylesheet had a chance:
        // replay them now that the name and the look both exist
        var q = queue;
        queue = [];
        q.forEach(function (p) {
            if (window.AdvBeats) { try { window.AdvBeats.oneShot(p.n, p.f); } catch (e) {} }
        });
    }

    // fetch the current chat's pack; every switch bumps the generation, so
    // a response that raced it drops instead of caching the old pack's map.
    // failure never poisons anything: a blipping backend (server restarts
    // mid-page-load!) must keep the last good pack alive and retry with a
    // gentle backoff - one lost fetch used to strand the whole tab on an
    // empty map until the asset PACK happened to change, and the only
    // trigger (plus.js) fires on pack changes, never on plain chat switches.
    var hadPack = false;
    var noChatTries = 0;
    var retryT = null;

    function scheduleRetry(delay) {
        if (retryT) clearTimeout(retryT);
        retryT = setTimeout(function () { retryT = null; reload(); }, delay);
    }

    function reload() {
        var myGen = ++gen;
        ready = false;
        var q = chatQ();
        try {
            Promise.resolve(simpleApiFetch("/api/ext/adventure_games/fx" + q))
                .then(function (d) {
                    if (myGen !== gen) return;   // raced a switch
                    applyMaps(d || {});
                    hadPack = true;
                    // answering without a chat means the store may not
                    // have picked a chat yet: the reply is base-vocabulary
                    // only, so peek again a few times before settling
                    if (!q && noChatTries < 4) { noChatTries++; scheduleRetry(1500); }
                })
                .catch(function () {
                    if (myGen !== gen) return;
                    // base vocabulary only if we NEVER had a pack;
                    // otherwise keep what we have and stay ready with it
                    if (!hadPack) applyMaps({});
                    else ready = true;
                    console.warn("[adv fx] pack fetch failed - keeping the " +
                        (hadPack ? "last pack" : "base vocabulary") +
                        ", retrying shortly");
                    scheduleRetry(3000);
                });
        } catch (e) {
            if (!hadPack) applyMaps({});
            else ready = true;
            scheduleRetry(3000);
        }
    }

    // the chat itself is a reload trigger now: the plus.js watcher only
    // refetches when the asset PACK differs from the last seen one, so a
    // chat switch between same-pack (or pack-less) campaigns could keep a
    // stale or chatless map forever - watch the store directly.
    function watchChat() {
        try {
            var st = window.Alpine && window.Alpine.store("chat");
            if (!st || typeof st.$watch !== "function") return false;
            var seen = st.selectedChat;
            st.$watch("selectedChat", function (now) {
                if (now === seen) return;
                seen = now;
                noChatTries = 0;
                reload();
            });
            return true;
        } catch (e) { return false; }
    }
    if (!watchChat()) window.addEventListener("load", watchChat);

    // first fetch at load; the plus.js watcher reloads on every campaign
    // discovery and on every asset-pack switch after that
    setTimeout(reload, 300);

    window.AdvFX = {
        reload: reload,
        ready: function () { return ready; },
        pulseList: function () { return pulseList.slice(); },
        pulseAlt: function () { return pulseList.join("|"); },
        pulseKnown: function (name) { return pulseList.indexOf(String(name || "")) !== -1; },
        // the inline text-decoration vocabulary: exactly the names the
        // pack's text_decoration/ sheets ship - files are everything here
        // too, and the macro engines (games/type/plus) build their flavor
        // regexes from tdAlt() and rebuild them on adv:fx
        tdList: function () { return decorationList.slice(); },
        tdAlt: function () { return decorationList.join("|"); },
        tdKnown: function (name) { return decorationList.indexOf(String(name || "")) !== -1; },
        // the sidecar render mode of one decoration ("" for plain css
        // styling; "sparkle"/"woozy" opt into the engines' DOM builders)
        tdRender: function (name) {
            var entry = decorationSpecs[String(name || "").toLowerCase()];
            return (entry && entry.spec && entry.spec.render) ? String(entry.spec.render) : "";
        },
        // the pack's particle spec for a weather kind (its fields override
        // the engine's built-in table one by one), null when absent
        weatherSpec: function (name) {
            var entry = weatherSpecs[String(name || "").toLowerCase()];
            return (entry && entry.spec) || null;
        },
        // the pack's particle spec for a sky kind, same contract
        skySpec: function (name) {
            var entry = skySpecs[String(name || "").toLowerCase()];
            return (entry && entry.spec) || null;
        },
        // the pack's dice flourish glyphs: {faces: [six glyphs],
        // heads: char, tails: char} from the dice.json root slot -
        // {} when no spec ships, and games.js keeps the built-in
        // unicode pips and the sun/moon coin
        diceLook: function () { return diceLookSpec; },
        // the url of the winner thinking sigil's svg (the pack's root
        // slot); plus.js fetches its text and injects it into
        // #adv-thinking, re-checking every time adv:fx fires
        thinkingSvgUrl: function () { return thinkingSvgUrl; },
        // the url of the pack's typing bed (its typing_loop.<audio> root
        // slot, any audio extension); type.js replaces the per-key
        // clacks with this loop whenever the url is non-empty, and the
        // empty string keeps classic per-character strikes
        typingLoopUrl: function () { return typingLoopUrl; },
        // the url of the pack's thinking bed (its thinking_loop.<audio>
        // root slot); plus.js fades this in while the thinking indicator
        // is up and out when it leaves - silence when the string is empty
        thinkingLoopUrl: function () { return thinkingLoopUrl; },
        // the pack's words under the thinking sigil: the merged
        // thinking_text.json spec ({thinking, tool}); plus.js reads it on
        // every adv:fx and swaps the live label, falling back to its own
        // neutral wording when a set ships none
        thinkText: function () { return thinkTextSpec; },
        // the pack's GLSL url for an asset ("overlays"|"weather"|"skies"|"pulses"),
        // empty string when the name ships no shader
        shader: function (kind, name) {
            var m = shaders[String(kind || "")];
            return (m && m[String(name || "").toLowerCase()]) || "";
        },
        // called by adventure_beats when a custom pulse fires while the
        // pack is still in flight; AdvFX replays it the moment it lands
        queuePulse: function (name, forced) {
            if (queue.length < 8) queue.push({ n: name, f: !!forced });
        }
    };
})();
