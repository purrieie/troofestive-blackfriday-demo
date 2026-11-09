/*! TrooFestive · Troopod · Black Friday mode for any storefront
 * Built on the Halloween engine (troofestive-halloween/engine/troo-halloween-look.js): same header detection, content
 * checks, one shared 10 Hz clock and sliced rendering. New: the Black Friday looks and their decor.
 *
 * TrooFestive.start(config)   turn the look on (config shape: see DEFAULTS); calling it again re-applies new settings
 * TrooFestive.stop()          remove every trace, the page is exactly as before
 * TrooFestive.moments.start() cursor, Add to cart burst, reward, page loader (troo-blackfriday-moments.js, loaded after)
 *
 * Enhance, never interfere (the brief, and what the research found on 23 real store homepages):
 * - The store's own bar and hero carry the offer. We frame it; we never write an offer for the store.
 * - Deal tags tell the truth: the percent is read from the card's own crossed-out price, or the merchant's own text
 *   (BOGO stores). No crossed-out price and no merchant text: no tag.
 * - The countdown only runs to a real end the merchant sets. It never resets, and it is gone once the sale ends
 *   (India's CCPA fines fake timers).
 * - Never change the store's colours or layout: every piece is an overlay with pointer-events:none and aria-hidden,
 *   except the button glow, a box-shadow on the store's own buttons through one data-bf-cta attribute.
 * - Nothing may become the page's Largest Contentful Paint: images are painted through -webkit-cross-fade() (bgi()).
 * - Motion that ends. Hanging tags sway and glints twinkle on the shared clock (5 frames a second, asleep after 60 s
 *   idle); the neon frame and the price slash draw once and stay still. Reduced motion: everything still.
 * - Pieces check the live page first (contentAt) and step aside from text, buttons and prices.
 */
/* global TrooFestive:writable */
(function () {
  'use strict';
  if (window.TrooFestive && window.TrooFestive.version) return;

  /* The four looks from research/directions.html. Each piece can still be switched off on its own (features). */
  var LOOKS = {
    tie:   { name: 'Black Tie',  hang: ['tagBlack', 'tagGold'], sash: 'ribbonTie', sticker: 'gold', drift: true, glint: 'gold', chip: 'tie', frame: true, slash: false, cta: 'gold', label: 'Black Friday ends in' },
    neon:  { name: 'Cyber Neon', hang: ['neonPct', 'neonSale'], sash: '', sticker: 'neon', drift: false, glint: 'neon', chip: 'led', frame: true, slash: false, cta: 'neon', label: 'Cyber Week ends in' },
    red:   { name: 'Red Tag',    hang: ['tagRedPct', 'tagRedSale'], sash: 'ribbonRed', sticker: 'red', drift: false, glint: 'circle', chip: 'red', frame: true, slash: true, cta: 'red', label: 'Deals end in' },
    quiet: { name: 'Quiet',      hang: null, sash: '', sticker: 'pill', drift: false, glint: 'gold', chip: 'quiet', frame: true, slash: false, cta: '', label: 'Sale ends in' }
  };
  var ACCENTS = { lime: '#C8F31D', cyan: '#3BF0FF', pink: '#FF3EA5' };
  var DEFAULTS = {
    look: 'neon',
    subtle: false,     // Subtle: nothing hanging, no ribbon, no frame, no slash, no flakes; tags, countdown and glints stay
    accent: 'lime',    // Cyber Neon only: lime | cyan | pink | a #hex
    features: {
      hang: true,      // price tags hanging from the bottom of the header (Black Tie, Red Tag)
      sash: true,      // a satin ribbon across one top corner of the hero (Black Tie, Red Tag)
      tags: true,      // deal stickers on product photos with the real percent (or the merchant's text)
      glint: true,     // glints, a neon underline or a marker circle on the store's own Sale link
      countdown: true, // a small countdown chip under the header, to countdown.ends only
      drift: true,     // gold glints twinkling in the side margins (Black Tie)
      frame: true,     // a frame traced once around the hero: gold foil, neon tube, red, or a fine gold line (Quiet)
      slash: true,     // a red marker slash drawn once over crossed-out prices (Red Tag)
      cta: true,       // a steady glow on Shop now / Add to cart / Buy now
      hover: false,    // desktop: a frame traces round a product card under the mouse (off: frames stay on the first banner and the product photo)
      shine: true,     // product page: a light sweeps across the main Add to cart a few times
      titles: true,    // a small glint beside section titles (Best sellers, New arrivals)
      price: true,     // product page: a small "Black Friday price" label beside a real sale price
      cart: true,      // a frame round the cart drawer when it opens
      footer: true,    // a slim Black Friday ribbon along the top edge of the footer
      banners: false,  // (off) frames round banners further down the page
      dividers: true,  // a small gold ornament in the gap above section titles
      topstring: true, // a string of small lights swagging along the very top of the page (the Diwali top string)
      hdrline: false,  // (off, Jaanya: too much) a tube along the header's bottom edge (neon, gold foil, red) with a light running along it now and then
      thread: true     // lights down both edges that light up as the shopper scrolls (the Diwali side strands)
    },
    countdown: { ends: '2026-11-30T23:59', starts: '', label: '' }, // shopper's local time; label '' = the look's own
    tagText: '',       // shown on product cards that have no crossed-out price (e.g. "B1G1"); '' = no tag there
    sashText: 'Black Friday',
    headerSelector: '',
    assets: {}         // data URLs: tagBlack tagGold tagRedPct tagRedSale ribbonTie ribbonRed
                       // giftClosed giftOpen coin confettiGold confettiRed scratchFoil cursorTag
  };

  var cfg, LK, root, style, fixedLayer, timers = {}, mo, on = false, lastUrl = '';
  var MAXZ = 2147483647;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function F(k) { // a feature is on when its switch is on, the look has it, and Subtle doesn't drop it
    if (!cfg.features[k]) return false;
    if (cfg.subtle && /^(hang|sash|drift|frame|slash|footer|shine|banners|dividers|thread|hdrline|topstring)$/.test(k)) return false;
    return k === 'hang' ? !!LK.hang : k === 'sash' ? !!LK.sash : k === 'drift' ? LK.drift : k === 'frame' ? LK.frame : k === 'slash' ? LK.slash : k === 'tags' ? !!LK.sticker : k === 'cta' ? !!LK.cta : true;
  }
  function accent() { var a = cfg.accent || 'lime'; return ACCENTS[a] || (/^#[0-9a-f]{6}$/i.test(a) ? a : ACCENTS.lime); }

  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b || {}) if (b[k] !== undefined && b[k] !== null && b[k] !== '') o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') ? merge(a[k], b[k]) : b[k]; return o; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function vis(e) { var r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0.05; }
  function ours(e) { return !!(e && e.closest && e.closest('#troo-bf,#troo-bf-fx,.troo-bf-x,.bfm-reward,.bfm-loader')); }
  function fixedAncestor(e) { while (e && e !== document.body && e !== document.documentElement) { var p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; e = e.parentElement; } return null; }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  // Decor must never become the page's Largest Contentful Paint. Chrome does not count generated images, so each
  // decor image is painted as itself cross-faded with itself: pixel-identical, but not an LCP candidate.
  var XF = !!(window.CSS && CSS.supports && CSS.supports('background-image', '-webkit-cross-fade(url(a.png), url(a.png), 100%)'));
  function bgi(u) { return XF ? "-webkit-cross-fade(url('" + u + "'), url('" + u + "'), 100%)" : "url('" + u + "')"; }
  function A(k) { return cfg.assets[k]; }
  var imgs = {};
  function img(k) { // a decor image for canvas drawing, loaded once; re-renders when it arrives
    var u = A(k); if (!u) return null;
    var o = imgs[k]; if (o && o.src === u) return o.complete && o.naturalWidth ? o : null;
    o = imgs[k] = new Image(); o.onload = function () { if (on) schedule(50); }; o.src = u; return null;
  }

  /* Is there real content (text, a control, a photo) at this point of the viewport? (from the Diwali engine) */
  function bgBanner(e) { var r = e.getBoundingClientRect(); return r.width >= innerWidth * 0.86 && r.height >= 180; }
  function contentAt(x, y, onPhoto) {
    var els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    for (var i = 0; i < els.length; i++) {
      var e = els[i]; if (ours(e)) continue;
      if (e === document.documentElement || e === document.body) return false;
      var t = e.tagName;
      if (/^(IMG|VIDEO|CANVAS|PICTURE|BUTTON|INPUT|SELECT|TEXTAREA|svg|SVG|IFRAME)$/.test(t)) {
        if (t === 'IMG' || t === 'VIDEO' || t === 'PICTURE' || t === 'CANVAS') { if (onPhoto) return false; return !bgBanner(e); }
        return true;
      }
      for (var n = e.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) {
          var rg = document.createRange(); rg.selectNodeContents(n); var rs = rg.getClientRects();
          for (var j = 0; j < rs.length; j++) if (x >= rs[j].left - 6 && x <= rs[j].right + 6 && y >= rs[j].top - 4 && y <= rs[j].bottom + 4) return true;
        }
      }
      var er = e.getBoundingClientRect();
      if (er.width < innerWidth * 0.86 && er.height < 160) {
        var ic = e.closest('a,button,[role=button],[role=img],[aria-label],label,summary');
        if (ic) { var ia = ic.getBoundingClientRect(); if (ia.width < innerWidth * 0.5 && ia.height < 90) return true; }
        var pb = '', pa = '';
        if (er.width < 220 && er.height < 90 && e.children.length === 0) { pb = getComputedStyle(e, '::before').content; pa = getComputedStyle(e, '::after').content; }
        if (er.width < innerWidth * 0.6 && er.height < 100 && ((e.textContent || '').trim() || e.querySelector('img,svg,button,input'))) return true;
        if ((pb && pb !== 'none' && pb !== 'normal' && pb !== '""') || (pa && pa !== 'none' && pa !== 'normal' && pa !== '""')) return true;
      }
      var bg = getComputedStyle(e).backgroundImage; if (bg && bg !== 'none' && bg.indexOf('url(') > -1) { if (onPhoto) return false; return !bgBanner(e); }
      return false;
    }
    return false;
  }
  function areaFree(l, t, w, h, nx, ny, onPhoto) { for (var i = 0; i < (nx || 3); i++) for (var j = 0; j < (ny || 4); j++) { var x = l + w * (i + 0.5) / (nx || 3), y = t + h * (j + 0.5) / (ny || 4); if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; if (contentAt(x, y, onPhoto)) return false; } return true; }
  function bgLight(x, y) { // is the page light behind this point? unknown (an image) counts as light
    var e = document.elementFromPoint(Math.max(1, Math.min(innerWidth - 2, x)), Math.max(1, Math.min(innerHeight - 2, y)));
    for (; e && e.nodeType === 1; e = e.parentElement) {
      if (/^(IMG|VIDEO|PICTURE|CANVAS)$/.test(e.tagName)) return null;
      var cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage.indexOf('url(') > -1) return null;
      var m = (cs.backgroundColor || '').match(/[\d.]+/g);
      if (m && m.length >= 3 && (m.length < 4 || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 > 0.55;
    }
    return true;
  }

  /* Pieces are kept by key: a re-render that places the same piece in the same spot writes nothing (session-recording
     scripts on stores react to every DOM change). Pieces not placed in a render are removed at its end. */
  var live = {}, seen = {};
  // what this render has already placed (viewport rects): later pieces step around earlier ones
  var taken = [], sashL = -1e4, out0 = {}, hdrMem = null;
  function hit(l, t, w, h) { return taken.some(function (r) { return l < r[0] + r[2] && l + w > r[0] && t < r[1] + r[3] && t + h > r[1]; }); }
  function put(key, fixed, css, build) {
    seen[key] = 1; var p = live[key];
    if (!p) {
      var d = document.createElement('div'); d.className = 'troo-bf-x'; d.setAttribute('aria-hidden', 'true');
      p = live[key] = { el: d, fixed: fixed, css: '' };
      if (typeof build === 'string') d.innerHTML = build; else if (build) build(d, p);
      (fixed ? fixedLayer : root).appendChild(d);
    }
    css = 'position:' + (fixed ? 'fixed' : 'absolute') + ';pointer-events:none;margin:0;padding:0;' + css;
    if (p.css !== css) { p.el.style.cssText = css; p.css = css; }
    return p;
  }
  function sweep() { for (var k in live) if (!seen[k]) { live[k].el.remove(); delete live[k]; } seen = {}; }
  function dropAll() { for (var k in live) live[k].el.remove(); live = {}; seen = {}; }

  /* The clock (from the Halloween engine): ten frames a second while the shopper is active, five after 4 s idle, and
     asleep after 60 s idle until the shopper does something. Drawers can skip frames or pause off screen. */
  var DPR = Math.min(window.devicePixelRatio || 1, 2), drawers = [], clock = 0, ticks = 0, active = performance.now(), IDLE = 4000, SLEEP = 60000, wakeOn = false;
  var WAKE = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'touchstart', 'keydown'];
  function wake() { active = performance.now(); if (!clock && drawers.length && !document.hidden) clock = setInterval(tick, 100); }
  function listenWake(v) {
    if (v === wakeOn) return; wakeOn = v;
    WAKE.forEach(function (t) { (v ? addEventListener : removeEventListener)(t, wake, { passive: true, capture: true }); });
    document[v ? 'addEventListener' : 'removeEventListener']('visibilitychange', wake);
  }
  function tick() {
    if (document.hidden) return;
    var now = performance.now(), idle = now - active, slow = idle > IDLE ? 2 : 1, t = now / 1000; ticks++;
    if (idle > SLEEP) { clearInterval(clock); clock = 0; return; }
    drawers = drawers.filter(function (d) { return d.el.isConnected; });
    if (!drawers.length) { clearInterval(clock); clock = 0; return; }
    for (var i = 0; i < drawers.length; i++) { var d = drawers[i]; if (ticks % ((d.every || 1) * slow) || (d.visible && !d.visible())) continue; d.draw(t); }
  }
  function addDrawer(d, animated) {
    d.draw(performance.now() / 1000); if (!animated || RM) return;
    drawers.push(d); listenWake(true);
    if (!clock) clock = setInterval(tick, 100);
  }
  function canvasFor(w, h, dpr) {
    dpr = dpr || DPR;
    var c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    c.style.cssText = 'display:block;width:' + w + 'px;height:' + h + 'px;pointer-events:none;margin:0;padding:0;border:0;max-width:none';
    var x = c.getContext('2d'); x.scale(dpr, dpr); return { c: c, x: x };
  }
  function twinkle(t, p, d) { return 0.5 - 0.5 * Math.cos((((t + d) / p) % 1) * 6.2832); }
  /* A four-point glint (light, so it is drawn, not an image): a bright core and two thin rays. */
  var glintSpr = {};
  function glint(col) {
    if (glintSpr[col]) return glintSpr[col];
    var S = 48, v = canvasFor(S, S, 2), x = v.x, m = S / 2;
    var g = x.createRadialGradient(m, m, 0, m, m, m * 0.42); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, hexA(col, 0.9)); g.addColorStop(1, hexA(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(m, m, m * 0.42, 0, 6.2832); x.fill();
    [[0, 1], [1, 0]].forEach(function (d) {
      var lg = d[0] ? x.createLinearGradient(0, m, S, m) : x.createLinearGradient(m, 0, m, S);
      lg.addColorStop(0, hexA(col, 0)); lg.addColorStop(0.5, 'rgba(255,255,255,.95)'); lg.addColorStop(1, hexA(col, 0)); x.fillStyle = lg;
      x.beginPath(); if (d[0]) { x.moveTo(0, m); x.lineTo(m, m - 1.3); x.lineTo(S, m); x.lineTo(m, m + 1.3); } else { x.moveTo(m, 0); x.lineTo(m + 1.3, m); x.lineTo(m, S); x.lineTo(m - 1.3, m); } x.fill();
    });
    return (glintSpr[col] = v.c);
  }

  /* ---------------------------------------------------------------- the countdown
     Only to a real end the merchant set (countdown.ends, shopper's local time). Hidden before countdown.starts and
     after the end. Minutes, not seconds: calm, and it changes the page once a minute at most. */
  function endsAt() { var e = cfg.countdown && cfg.countdown.ends; var d = e ? new Date(e) : null; return d && !isNaN(d) ? d.getTime() : 0; }
  function startsAt() { var s = cfg.countdown && cfg.countdown.starts; var d = s ? new Date(s) : null; return d && !isNaN(d) ? d.getTime() : 0; }
  function left() { var e = endsAt(), s = startsAt(), n = Date.now(); if (!e || n >= e || (s && n < s)) return 0; return e - n; }
  function fmt(ms) {
    var m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d ? d + 'd ' + p(h) + 'h ' + p(mm) + 'm' : h ? h + 'h ' + p(mm) + 'm' : Math.max(1, mm) + ' min';
  }
  // a real 5x7 dot-matrix face for the LED countdown (a scaled-down system font turns to mush)
  var DOTS = { '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111',
    '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
    '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110',
    '9': '01110100011000101111000010001001100', 'D': '11100100101000110001100011001011100', 'H': '10001100011000111111100011000110001',
    'M': '10001110111010110101100011000110001', ' ': '00000000000000000000000000000000000' };
  function led(text, col, h) {
    var step = h / 7, cols = 0, chars = String(text).split('');
    chars.forEach(function (ch) { cols += (ch === ' ' ? 3 : 5) + 1; });
    var v = canvasFor(Math.ceil(cols * step), Math.ceil(h)), x = v.x, cx0 = 0;
    chars.forEach(function (ch) {
      var g = DOTS[ch] || DOTS[' '], wd = ch === ' ' ? 3 : 5;
      for (var yy = 0; yy < 7; yy++) for (var xx = 0; xx < wd; xx++) {
        var lit = ch !== ' ' && g[yy * 5 + xx] === '1', px = (cx0 + xx) * step + step / 2, py = yy * step + step / 2;
        if (!lit) { x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.arc(px, py, step * 0.28, 0, 6.2832); x.fill(); continue; }
        x.shadowColor = col; x.shadowBlur = 4; x.fillStyle = col; x.beginPath(); x.arc(px, py, step * 0.4, 0, 6.2832); x.fill();
        x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(px, py, step * 0.15, 0, 6.2832); x.fill();
      }
      cx0 += wd + 1;
    });
    return v.c;
  }
  function chipHTML(text) {
    var lab = esc((cfg.countdown && cfg.countdown.label) || LK.label);
    if (LK.chip === 'led') return '<div class="bfc bfc-led"><span class="l">' + lab + '</span><span class="ledw"></span></div>';
    return '<div class="bfc bfc-' + LK.chip + '"><span class="l">' + lab + '</span><b>' + esc(text) + '</b></div>';
  }
  function fillChip(p, text) {
    if (p.text === text) return; p.text = text;
    if (LK.chip === 'led') { var w = p.el.querySelector('.ledw'); if (w) { w.innerHTML = ''; w.appendChild(led(text.toUpperCase(), accent(), innerWidth < 640 ? 12 : 16)); } }
    else { var b = p.el.querySelector('b'); if (b) b.textContent = text; }
  }
  // The store runs its own countdown in the top bar or header: ours would only repeat it, or worse, disagree with it.
  // Reads the text in the band above the header's bottom edge (the first few hundred text nodes are enough: bars and
  // headers come first in the page), plus anything named countdown or timer near the top.
  function storeHasTimer(hb) {
    var t = '', n, k = 0, tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while ((n = tw.nextNode()) && k < 600) {
      var v = n.nodeValue; if (!v || !v.trim()) continue; k++;
      var p = n.parentElement; if (!p || ours(p)) continue;
      var r = p.getBoundingClientRect(); if (r.bottom > -10 && r.top < hb + 60 && r.height) t += ' ' + v;
      if (t.length > 3000) break;
    }
    [].forEach.call(document.querySelectorAll('[class*="countdown" i],[class*="timer" i],[id*="countdown" i]'), function (e) { var r = e.getBoundingClientRect(); if (r.height && r.top < hb + 200 && r.bottom > -10) t += ' 00:00:00'; });
    return /(ends?|ending|left|expires?)\s+in\b|\b\d{1,2}\s*:\s*\d{2}\s*:\s*\d{2}\b|\d+\s*(d|days?)\s*:?\s*\d+\s*(h|hrs?|hours?)\b|\d+\s*(hours?|hrs)\W+\d+\s*(min|mins|minutes)\b/i.test(t);
  }

  /* ---------------------------------------------------------------- real deals on product cards */
  var STRUCK = 's,del,strike,[class*="compare" i],[class*="was-price" i],[class*="price--regular" i],[class*="regular-price" i],[class*="old-price" i],[class*="price-old" i],[class*="original-price" i],[class*="strike" i],[class*="mrp" i],[class*="list-price" i],[class*="line-through" i],[style*="line-through"],[class*="price" i] span,[class*="price" i] div';
  var PRICE_RE = /(₹|rs\.?|inr|\$|£|€|usd|aed|aud|cad)\s?\d|\d[\d.,]*\s?(₹|€|£|kr|zł)/i;
  function num(t) {
    var m = String(t).replace(/\s/g, '').match(/\d[\d.,]*/); if (!m) return 0; var s = m[0].replace(/[.,]$/, '');
    var lc = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    if (lc > -1) { var tail = s.slice(lc + 1); if (tail.length === 3 && (s.split(s[lc]).length > 2 || s.indexOf(s[lc] === ',' ? '.' : ',') < 0)) s = s.replace(/[.,]/g, ''); else s = s.slice(0, lc).replace(/[.,]/g, '') + '.' + tail; }
    var v = parseFloat(s); return isFinite(v) ? v : 0;
  }
  function struck(e) { return /^(S|DEL|STRIKE)$/.test(e.tagName) || /line-through/.test(getComputedStyle(e).textDecorationLine || getComputedStyle(e).textDecoration || ''); }
  function ownText(e) { var t = ''; for (var n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) t += n.nodeValue; return t.trim(); }
  // the shopper's price next to a crossed-out one: the nearest price-looking text that isn't struck and is lower
  function nowPrice(sEl, was) {
    for (var up = sEl.parentElement, k = 0; up && k < 4; up = up.parentElement, k++) {
      if (k >= 2 && up.getBoundingClientRect().width > innerWidth * 0.62) break; // past the card: another product's price
      var best = null;
      // the box itself counts too: stores often write "<span><s>$150</s> $99</span>" (own text = the new price)
      [up].concat([].slice.call(up.querySelectorAll('*'))).some(function (e) {
        if (e === sEl || sEl.contains(e) || ours(e)) return false;
        var t = ownText(e); if (!t || t.length > 40 || !(PRICE_RE.test(t) || /^\d[\d.,]*$/.test(t))) return false;
        if (struck(e) || (e.parentElement && struck(e.parentElement)) || !vis(e)) return false;
        var v = num(t); if (v > 0 && v < was) { best = { el: e, v: v }; return true; } return false;
      });
      if (best) return best;
    }
    return null;
  }
  // the product photo a price belongs to: the card around it (narrower than the page) and its first real image
  // the strip right of a price: free when no text, control or image overlaps it (the price row's own box doesn't count)
  function besideFree(l, t, w, h, priceEl) {
    var box = priceEl.parentElement && priceEl.parentElement.parentElement || priceEl.parentElement, hitR = function (r) { return r.left < l + w && r.right > l && r.top < t + h && r.bottom > t; };
    var tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), n;
    while ((n = tw.nextNode())) { if (!n.nodeValue.trim()) continue; var rg = document.createRange(); rg.selectNodeContents(n); if ([].some.call(rg.getClientRects(), hitR)) return false; }
    if ([].some.call(box.querySelectorAll('button,a,input,select,img,svg'), function (e) { return hitR(e.getBoundingClientRect()); })) return false;
    var top = document.elementFromPoint(Math.min(innerWidth - 1, l + w / 2), Math.min(innerHeight - 1, t + h / 2));
    return !top || ours(top) || top.contains(priceEl) || box.contains(top);
  }
  function cardPhoto(e, W) {
    for (var a = e.parentElement, k = 0; a && a !== document.body && k < 10; a = a.parentElement, k++) {
      var r = a.getBoundingClientRect(); if (r.width > W * 0.62) return null;
      var im = [].filter.call(a.querySelectorAll('img,picture,video'), function (i) { var ir = i.getBoundingClientRect(); return ir.width >= 80 && ir.height >= 80 && vis(i); })[0];
      if (im && im.getBoundingClientRect().width < 120) return { card: a, photo: im, small: true }; // a swatch or variant thumbnail
      if (im) return { card: a, photo: im };
    }
    return null;
  }
  // a photo outside the screen sideways, or a slide hidden by its slider: no sticker (it would float over another one)
  function clipped(el, W) {
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2; if (r.right <= 4 || r.left >= W - 4) return true;
    for (var a = el.parentElement, k = 0; a && a !== document.body && k < 14; a = a.parentElement, k++) {
      if (!/(hidden|auto|scroll|clip)/.test(getComputedStyle(a).overflowX)) continue;
      var ar = a.getBoundingClientRect(); if (cx < ar.left || cx > ar.right) return true;
    }
    return false;
  }
  // a tagged photo that moves (a slider changing slide, a swipe): its sticker hides until the next placement
  function watch() {
    var moved = false;
    for (var k in live) {
      var p = live[k]; if (!p.anchor || p.el.style.visibility === 'hidden') continue;
      var r = p.anchor.isConnected ? p.anchor.getBoundingClientRect() : null;
      if (!r || !r.width || Math.abs(r.left + scrollX - p.ax) > 4 || Math.abs(r.top + scrollY - p.ay) > 4) { p.el.style.visibility = 'hidden'; moved = true; }
    }
    if (moved) schedule(350);
  }
  function anchor(p, el) { var r = el.getBoundingClientRect(); p.anchor = el; p.ax = r.left + scrollX; p.ay = r.top + scrollY; p.el.style.visibility = ''; }
  function mainPhoto(W, V) { // product page: the biggest image in the page's first screen and a half (in the page, not the current screen)
    var best = null, ba = 0;
    [].forEach.call(document.querySelectorAll('img,video'), function (i) { if (ours(i) || i.closest('[class*="related" i],[class*="recommend" i],[class*="upsell" i],[class*="you-may" i],[class*="also" i]')) return; var r = i.getBoundingClientRect(); if (r.width < Math.min(W * 0.3, 260) || r.top + scrollY > V * 1.2 || r.bottom + scrollY < 0 || r.width > W * 0.98 && r.height < 200) return; var a = r.width * r.height; if (a > ba && vis(i)) { ba = a; best = i; } });
    return best;
  }
  /* Deal tags are small flat pills in the corner of the photo (the round seals read cheap at product-card size):
     Black Tie black with gold type and a hairline gold edge; Red Tag solid red, white type; Cyber Neon black with a
     neon edge. H is the pill height (about 21 px on cards, 25 on a product page's main photo). */
  function pillSize(H, text) { var fs = Math.round(H * 0.5); return [Math.round(String(text).length * fs * 0.66 + fs * 1.5), H]; }
  function stickerHTML(H, text) {
    var fs = Math.round(H * 0.5), c = accent(), k = LK.sticker;
    var st = k === 'neon' ? 'background:rgba(10,10,12,.88);border:1px solid ' + c + ';color:' + c + ';box-shadow:0 0 8px ' + hexA(c, 0.4)
      : k === 'red' ? 'background:#D7261E;color:#fff'
      : 'background:#0B0B0D;border:1px solid rgba(226,184,90,.7);color:#EBCB7E';
    return '<div class="bfs" style="height:' + H + 'px;font-size:' + fs + 'px;padding:0 ' + Math.round(fs * 0.75) + 'px;' + st + '">' + esc(text) + '</div>';
  }

  /* ---------------------------------------------------------------- hero, header, page */
  function pageType() {
    if (cfg && cfg.pageType) return cfg.pageType;
    try { var m = window.ShopifyAnalytics && ShopifyAnalytics.meta && ShopifyAnalytics.meta.page && ShopifyAnalytics.meta.page.pageType; if (m) return m === 'collection' || m === 'searchresults' ? 'collection' : m === 'product' ? 'product' : m === 'home' ? 'home' : m; } catch (e) {}
    var p = location.pathname, og = document.querySelector('meta[property="og:type"]'), ogt = og ? (og.content || '').toLowerCase() : '';
    if (/product/.test(ogt)) return 'product';
    var buys = [].filter.call(document.querySelectorAll('button,a,input[type=submit]'), function (e) { return /^(add to (cart|bag)|buy (it )?now)$/i.test((e.innerText || e.value || '').trim()) && vis(e); }).length;
    if (p === '/' || /^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(p)) return 'home';
    if (/\/products?\/|\/p\/|\/dp\//.test(p) && buys >= 1 && buys <= 3) return 'product';
    if (buys >= 4 || /collection|categor|\/c\/|shop|search/.test(p)) return 'collection';
    return 'other';
  }
  function findHeader() {
    var W = innerWidth, hdr = null;
    if (cfg.headerSelector) { hdr = document.querySelector(cfg.headerSelector); if (hdr) return hdr; }
    ['header', '[class*="header" i]', '[id*="header" i]', 'nav'].some(function (s) {
      [].forEach.call(document.querySelectorAll(s), function (e) { if (ours(e) || !vis(e)) return; var r = e.getBoundingClientRect(); if (r.top < 120 && r.top > -10 && r.height >= 32 && r.height <= 260 && r.width >= W * 0.9) { if (!hdr || r.bottom > hdr.getBoundingClientRect().bottom) hdr = e; } });
      return hdr;
    });
    return hdr;
  }
  // the first big block under the header: a banner, slideshow or video (home and collection pages)
  function findHero(hb, W, V) {
    function ok(a) { var r = a.getBoundingClientRect(); return r.width >= W * 0.85 && r.height >= Math.min(200, V * 0.28) && r.height <= V * 3 && r.top >= hb - 160 && r.top <= hb + 220 && !fixedAncestor(a); }
    for (var y = Math.max(hb + 30, 40); y < Math.min(V * 0.8, hb + 320); y += 40) {
      var stack = document.elementsFromPoint ? document.elementsFromPoint(W / 2, y) : [];
      for (var i = 0; i < stack.length; i++) {
        var e = stack[i]; if (ours(e) || e === document.body || e === document.documentElement) continue;
        for (var a = e; a && a !== document.body; a = a.parentElement) { if (ok(a)) return a; if (a.getBoundingClientRect().height > V * 3) break; }
        break;
      }
    }
    // fallback: the biggest picture on the first screen, widened to the full-width box around it
    var best = null, ba = 0;
    [].forEach.call(document.querySelectorAll('img,video,picture'), function (m) { if (ours(m)) return; var r = m.getBoundingClientRect(); if (r.width < W * 0.5 || r.height < 180 || r.top > V * 0.7 || r.bottom < hb + 40) return; var ar = r.width * r.height; if (ar > ba && vis(m)) { ba = ar; best = m; } });
    for (var b = best; b && b !== document.body; b = b.parentElement) { if (ok(b)) return b; }
    return null;
  }
  // true when the header sits on top of the hero and you can see the hero through it (transparent header over a
  // full-bleed banner): every layer between the header's middle row and the hero is see-through
  function overHero(hdr, hr, hero) {
    var r = hero.getBoundingClientRect(); if (!hr || r.top > hr.top + hr.height * 0.5 || r.bottom < hr.bottom + 120) return false;
    var clear = function (e) { var cs = getComputedStyle(e), m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor), a = m ? m[1].split(',') : []; return (a.length < 4 || +a[3] < 0.15) && cs.backgroundImage === 'none' && !(cs.backdropFilter && cs.backdropFilter !== 'none'); };
    var y = hr.top + hr.height / 2; if (y < 0) return false;
    return [6, innerWidth - 6].every(function (x) {
      var els = document.elementsFromPoint(x, y);
      for (var i = 0; i < els.length; i++) { var e = els[i]; if (ours(e)) continue; if (e === hero || hero.contains(e) || e.contains(hero) || e === document.body || e === document.documentElement) return true; if (!clear(e)) return false; }
      return true;
    });
  }
  // the part of the hero the frame goes round: at most the first screen
  function heroBox(hero, hb) { var r = hero.getBoundingClientRect(), top = Math.max(r.top, hb); return { left: r.left, right: r.right, width: r.width, top: top, bottom: Math.min(r.bottom, Math.max(top + 200, innerHeight - 12)) }; }
  // A still picture whose words may be baked in (common on Indian stores: mCaffeine, Pilgrim): the page check can't
  // see text inside an image, so nothing is laid over one. True when the first picture under this point is a still
  // image (or a background image) and its slide has no live headline-sized text. A video, or a slide with a live
  // headline (Brooklinen, Ridge), is fine.
  var stillWhy = '';
  function stillUnder(x, y) {
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    var els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [], pic = null;
    for (var i = 0; i < els.length && !pic; i++) {
      var e = els[i]; if (ours(e)) continue; if (e === document.body || e === document.documentElement) break;
      if (e.tagName === 'VIDEO') return false;
      if (e.tagName === 'IMG' || e.tagName === 'PICTURE') pic = e;
      else { var bg = getComputedStyle(e).backgroundImage; if (bg && bg.indexOf('url(') > -1) pic = e; }
    }
    if (!pic) return false;
    stillWhy = pic.tagName + '.' + String(pic.className || '').slice(0, 30);
    var ph = pic.getBoundingClientRect().height;
    // up through the boxes that are still the banner itself (about the picture's height), where an overlaid headline lives
    for (var a = pic, k = 0; a && a !== document.body && k < 9 && a.getBoundingClientRect().height <= ph * 1.35 + 60; a = a.parentElement, k++) {
      var tw = document.createTreeWalker(a, NodeFilter.SHOW_TEXT), n, c = 0;
      while ((n = tw.nextNode()) && c < 200) { c++; var pe = n.parentElement; if (!n.nodeValue.trim() || !pe || ours(pe) || !vis(pe)) continue; var pr = pe.getBoundingClientRect(); if (pr.right < x - innerWidth * 0.9 || parseFloat(getComputedStyle(pe).fontSize) < 22) continue; if (Math.abs(pr.top - y) < innerHeight) return false; }
    }
    return true;
  }
  // the store's own Sale / Black Friday / Deals link in the header or menu
  var SALE_RE = /^(sale|sales|the sale|shop (the )?sale|black friday|black friday (sale|deals?)|cyber (monday|week)( sale| deals?)?|bfcm|deals?|offers?|flash (sale|deals?)|clearance|outlet|% ?off|bf sale)$/i;
  function saleLink(hdr, hb) {
    var best = null;
    [].some.call(document.querySelectorAll('header a,nav a,[class*="header" i] a,[class*="menu" i] a,[class*="nav" i] a'), function (a) {
      if (ours(a)) return false; var t = (a.innerText || '').replace(/\s+/g, ' ').trim(); if (!t || !SALE_RE.test(t) || !vis(a)) return false;
      var r = a.getBoundingClientRect(); if (r.top < -5 || r.bottom > hb + 6 || r.height > 60 || r.width > 240) return false;
      best = a; return true;
    });
    return best;
  }
  function hdrZ(h) { var z = h ? parseInt(getComputedStyle(h).zIndex, 10) : NaN; return isFinite(z) ? z : 0; }

  function css() {
    var s = '', c = accent();
    s += '#troo-bf,#troo-bf *,#troo-bf-fx *{box-sizing:border-box}#troo-bf-fx{display:contents!important}#troo-bf div,#troo-bf-fx div{display:block}';
    s += '#troo-bf canvas,#troo-bf-fx canvas,.troo-bf-x canvas{display:block!important;max-width:none!important}';
    // deal stickers: the rendered sticker art, the number set over it in type
    s += '.bfs{display:inline-flex!important;align-items:center;white-space:nowrap;border-radius:3px;font-family:"Avenir Next","Helvetica Neue",Arial,sans-serif;font-weight:700;letter-spacing:.04em;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.18)}';
    s += '.bfp{display:inline-flex!important;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:#111;color:#F0D99A;font:700 11px/1 "Avenir Next","Helvetica Neue",Arial,sans-serif;letter-spacing:.02em;white-space:nowrap}';
    // the hero corner ribbon
    s += '.bfr{position:absolute;overflow:hidden}.bfr i{position:absolute;display:flex!important;align-items:center;justify-content:center;background-size:100% 100%;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35));font-style:normal;white-space:nowrap;text-transform:uppercase;font-family:"Avenir Next","Helvetica Neue",Arial,sans-serif;font-weight:700}';
    s += '.bfr-tie i b{background:linear-gradient(180deg,#FFF3CC 0,#EBC777 45%,#B98A30 100%);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}.bfr-red i b{color:#fff;font-weight:800}';
    // countdown chips
    s += '@media (max-width:639px){.bfc{height:26px!important;padding:0 10px!important;gap:6px!important;font-size:9px!important;letter-spacing:.08em!important}.bfc b{font-size:11px!important}}';
    s += '.bfc{display:inline-flex!important;align-items:center;gap:9px;height:30px;padding:0 13px;border-radius:999px;font:600 10.5px/1 "Avenir Next","Helvetica Neue",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;box-shadow:0 6px 18px -6px rgba(0,0,0,.35)}';
    s += '.bfc b{font:700 13px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.02em;text-transform:none;font-variant-numeric:tabular-nums}';
    s += '.bfc-tie{background:#0B0B0D;border:1px solid rgba(233,196,106,.55);color:#BFA971}.bfc-tie b{background:linear-gradient(180deg,#FFF1C2,#E2B85A 55%,#B8892E);-webkit-background-clip:text;background-clip:text;color:transparent}';
    s += '.bfc-red{background:#D7261E;color:#FFE3E0}.bfc-red b{color:#fff}.bfc-quiet{background:#111;color:#B9B9B9}.bfc-quiet b{color:#fff}';
    s += '.bfc-led{background:#0A0A0C;border:1px solid ' + hexA(c, 0.45) + ';color:' + hexA(c, 0.8) + ';height:36px;box-shadow:0 0 14px ' + hexA(c, 0.25) + '}.bfc-led .ledw{display:block}';
    // the store's own buttons: a steady glow (a pulse would repaint the store's page)
    var glow = { gold: '0 0 0 1.5px #D9AE52,0 0 18px rgba(217,174,82,.55)', neon: '0 0 0 1.5px ' + c + ',0 0 16px ' + hexA(c, 0.6), red: '0 0 0 1.5px #D7261E,0 0 16px rgba(215,38,30,.42)' }[LK.cta];
    if (glow) s += '[data-bf-cta]{box-shadow:' + glow + '!important}';
    var lc = lookCol();
    s += '.bfh{position:fixed;pointer-events:none;border-radius:8px;opacity:0;transition:opacity .18s ease;z-index:' + (MAXZ - 7) + ';' + frameCSS(lc) + '}.bfh.on{opacity:1;animation:bfhin .4s cubic-bezier(.3,.7,.4,1) both}';
    s += '@keyframes bfhin{from{clip-path:inset(0 100% 100% 0 round 8px)}to{clip-path:inset(0 0 0 0 round 8px)}}';
    s += '.bfcart{border-radius:2px;' + frameCSS(lc) + ';animation:bfhin .5s cubic-bezier(.3,.7,.4,1) both}';
    s += '.bfsh{position:absolute;inset:0;overflow:hidden}.bfsh i{position:absolute;top:-30%;bottom:-30%;width:38%;left:-60%;transform:skewX(-20deg);background:linear-gradient(100deg,transparent 0,' + shineCol() + ' 50%,transparent 100%);animation:bfshine 4.5s ease-in-out 1.6s 4}';
    s += '@keyframes bfshine{0%{left:-60%}30%{left:130%}100%{left:130%}}';
    s += '.bff{display:flex!important;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;font:700 10px/1 "Avenir Next","Helvetica Neue",Arial,sans-serif;letter-spacing:.32em;text-transform:uppercase}';
    s += '@keyframes bfdraw{to{stroke-dashoffset:0}}.bfsl path,.bfcirc path{animation:bfdraw .55s cubic-bezier(.3,.7,.4,1) .2s both}';
    if (RM) s += '#troo-bf *,#troo-bf-fx *{animation:none!important;transition:none!important}.bfsl path,.bfcirc path{stroke-dashoffset:0!important}';
    style.textContent = s;
  }
  function clearMarks() { [].forEach.call(document.querySelectorAll('[data-bf-cta]'), function (e) { e.removeAttribute('data-bf-cta'); }); }

  /* ---------------------------------------------------------------- pieces */
  /* Cyber Neon's hanging tags: drawn (neon is light, not an object), in the same proportions as the rendered tags so
     they hang the same way: a dark card, a glowing neon outline and eyelet, "%" or "SALE" in neon, the cord on top. */
  var neonTags = {};
  function neonTag(k) {
    var c0 = accent(), key = k + c0; if (neonTags[key]) return neonTags[key];
    var W2 = 150, H2 = 407, c = document.createElement('canvas'); c.width = W2; c.height = H2; var x = c.getContext('2d');
    var top = 150, l = 22, r2 = W2 - 22, b = H2 - 14, cut = 40, hx = W2 / 2, hy = top + 36;
    x.strokeStyle = hexA(c0, 0.9); x.lineWidth = 3; x.shadowColor = c0; x.shadowBlur = 8; x.beginPath(); x.moveTo(hx, 0); x.lineTo(hx, hy - 9); x.stroke(); // cord
    x.beginPath(); x.moveTo(l + cut, top); x.lineTo(r2 - cut, top); x.lineTo(r2, top + cut); x.lineTo(r2, b); x.lineTo(l, b); x.lineTo(l, top + cut); x.closePath();
    x.shadowBlur = 0; x.fillStyle = 'rgba(10,10,12,.92)'; x.fill();
    x.shadowColor = c0; x.shadowBlur = 18; x.strokeStyle = c0; x.lineWidth = 6; x.stroke(); x.shadowBlur = 0; x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2; x.stroke();
    x.shadowColor = c0; x.shadowBlur = 10; x.strokeStyle = c0; x.lineWidth = 5; x.beginPath(); x.arc(hx, hy, 9, 0, 6.2832); x.stroke();
    var txt = k === 'neonPct' ? '%' : 'SALE', fs = k === 'neonPct' ? 110 : 40;
    x.font = '800 ' + fs + 'px "Avenir Next","Helvetica Neue",Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; if (k !== 'neonPct') x.letterSpacing = '4px';
    x.fillStyle = c0; x.shadowBlur = 16; x.fillText(txt, hx, top + (b - top) * 0.6); x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText(txt, hx, top + (b - top) * 0.6);
    c.naturalWidth = W2; c.naturalHeight = H2; return (neonTags[key] = c);
  }
  // Price tags hanging on their cords from the bottom of the header, at the outer edges (where heroes keep empty).
  // Each sways a little on the shared clock. They hide if they would cover the store's text or buttons.
  // small, like a real swing tag: two at the left edge on desktop (one a little lower), one on phones
  var HANG = { d: [[0.035, 0, 26, 4, 0], [0.068, 1, 21, 20, 2.1]], m: [[0.07, 0, 20, 2, 0]] };
  function placeHang(W, hb, z) {
    var mob = W < 640, u = 1;
    (mob ? HANG.m : HANG.d).forEach(function (o, i) {
      var k = LK.hang[o[1]], im = k.indexOf('neon') === 0 ? neonTag(k) : img(k); if (!im) return;
      var tw = Math.round(o[2] * u), th = Math.round(tw * im.naturalHeight / im.naturalWidth), cord = Math.round(o[3] * u), pad = Math.ceil(tw * 0.5);
      var cw = tw + pad * 2, ch = th + cord + 6, x = Math.round(W * o[0] - cw / 2), top = Math.round(hb + scrollY - 2);
      // the outer tag sits at the very edge, where banners keep no words; the inner one stays off still pictures
      if (hit(x + pad, hb, tw, cord + th) || (i > 0 && stillUnder(x + cw / 2, hb + cord + th * 0.6))) return; taken.push([x + pad, hb, tw, cord + th]);
      var key = 'hang' + i + k + cw + 'x' + ch;
      var p = put(key, false, 'left:' + x + 'px;top:' + top + 'px;width:' + cw + 'px;height:' + ch + 'px;z-index:' + z, function (d, p) {
        var v = canvasFor(cw, ch); d.appendChild(v.c); p.v = v;
        addDrawer({ el: d, every: 2, visible: function () { return d.style.visibility !== 'hidden'; }, draw: function (t) {
          var x = v.x, m = cw / 2; x.clearRect(0, 0, cw, ch);
          x.save(); x.translate(m, 0); if (!RM) x.rotate(0.03 * Math.sin((t + o[4]) * 6.2832 / 7.5) + 0.008 * Math.sin((t + o[4]) * 6.2832 / 2.9)); x.translate(-m, 0);
          x.strokeStyle = k.indexOf('neon') === 0 ? hexA(accent(), 0.9) : k === 'tagBlack' ? 'rgba(214,176,96,.95)' : k === 'tagGold' ? 'rgba(20,18,16,.85)' : 'rgba(235,232,226,.95)'; x.lineWidth = 1;
          if (cord) { x.beginPath(); x.moveTo(m, 0); x.lineTo(m, cord + 2); x.stroke(); }
          x.shadowColor = 'rgba(0,0,0,.16)'; x.shadowBlur = 3; x.shadowOffsetY = 1.5;
          x.drawImage(im, m - tw / 2, cord, tw, th); x.restore();
        } }, true);
      });
      var r = p.el.getBoundingClientRect(); // checked whenever it is on screen: titles and banners that settle late move under it
      if (r.bottom > 0 && r.top < innerHeight) p.el.style.visibility = areaFree(r.left + cw * 0.3, r.top + th * 0.42 + cord, cw * 0.4, th * 0.5, 2, 3) ? '' : 'hidden';
    });
  }
  // A satin ribbon across the hero's top corner, cut off by the hero's edges like a real sash.
  function placeSash(hero, hb, W, z, pdp) {
    var u = A(LK.sash); if (!u || !hero) return;
    var r = hero.getBoundingClientRect(), top = Math.max(r.top, hb), mob = W < 640;
    var S = pdp ? Math.round(Math.min(Math.max(r.width * 0.2, 104), mob ? 120 : 150)) : mob ? 132 : Math.round(Math.min(Math.max(r.width * 0.16, 120), 210)), bt = Math.round(Math.min(Math.max(S * 0.2, 28), 38));
    var text = cfg.sashText || 'Black Friday', fs = Math.round(bt * 0.4), ls = 0.2;
    // the band shows about 0.72 S x 1.41 of its length inside the corner: the words must fit in 85% of that
    var room = S * 0.72 * 1.414 * 0.85, need = function () { return text.length * fs * 0.7 + (text.length - 1) * fs * ls; };
    while (need() > room && fs > 8) { if (ls > 0.08) ls -= 0.04; else fs -= 0.5; }
    // top right first; top left if the store has text or a button there
    var sides = ['right', 'left'], side = null;
    for (var i = 0; i < sides.length && !side; i++) {
      var L = sides[i] === 'right' ? r.right - S : r.left, ok = true;
      // the band runs from (0.28 S, 0) to (S, 0.72 S) in the corner box (mirrored on the left): sample along it, and a
      // little either side of its centre line
      for (var s2 = 0.08; s2 <= 0.92 && ok; s2 += 0.12) for (var off = -0.35; off <= 0.35 && ok; off += 0.35) {
        var bxp = S * (0.28 + 0.72 * s2) - off * bt * 0.7, byp = S * 0.72 * s2 + off * bt * 0.7;
        var px = sides[i] === 'right' ? L + bxp : L + S - bxp, py = top + byp;
        if (contentAt(px, py, true)) ok = false;
      }
      if (ok) side = sides[i];
    }
    if (!side) { out0.sash = 'no free corner'; return; }
    var mx = side === 'right' ? r.right - S * 0.36 : r.left + S * 0.36, my = top + S * 0.36;
    if (!pdp && stillUnder(mx, my) || !pdp && stillUnder(side === 'right' ? r.right - S * 0.15 : r.left + S * 0.15, top + S * 0.57)) { out0.sash = 'still picture: ' + stillWhy; return; }
    var left = side === 'right' ? r.right - S : r.left, bw = Math.round(S * 1.55), c = S * 0.36;
    taken.push([left, top, S, S * 0.8]); if (side === 'right') sashL = left;
    var bx = side === 'right' ? S - c : c, rot = side === 'right' ? 45 : -45;
    put('sash' + side + S + LK.sash + text, false, 'left:' + Math.round(left) + 'px;top:' + Math.round(top + scrollY) + 'px;width:' + S + 'px;height:' + S + 'px;z-index:' + z,
      '<div class="bfr bfr-' + (LK.sash === 'ribbonRed' ? 'red' : 'tie') + '" style="inset:0"><i style="width:' + bw + 'px;height:' + bt + 'px;left:' + Math.round(bx - bw / 2) + 'px;top:' + Math.round(c - bt / 2) + 'px;transform:rotate(' + rot + 'deg);background-image:' + bgi(u) + ';font-size:' + fs + 'px;letter-spacing:' + (fs * ls).toFixed(1) + 'px"><b>' + esc(text) + '</b></i></div>');
  }
  // Cyber Neon: a neon tube traced once around the inside edge of the hero, then a steady glow (no clock).
  function placeFrame(hero, hb, W, z, pdp) {
    if (!hero) return; var r = pdp ? hero.getBoundingClientRect() : heroBox(hero, hb), top = r.top;
    if (r.left < 0 || r.right > W) { var cl = Math.max(0, r.left), cr = Math.min(W, r.right); r = { left: cl, right: cr, width: cr - cl, top: r.top, bottom: r.bottom }; }
    var pad = 14, inset = pdp ? 4 : W < 640 ? 7 : 11, w = Math.round(r.width + pad * 2), h = Math.round(r.bottom - top + pad * 2), c = accent(), K = cfg.look;
    // each look's frame: [glow colour, glow width, line colour(s), line width, highlight, flicker]
    var ST = { neon: [c, 6, [c], 2.6, 'rgba(255,255,255,.85)', true], tie: ['#E8C063', 5, ['#FFF1C2', '#E2B85A', '#B8892E'], 2.6, 'rgba(255,248,220,.9)', false],
      red: ['#D7261E', 5, ['#D7261E'], 2.8, 'rgba(255,255,255,.55)', false], quiet: ['', 0, ['#C9A24E'], 1.2, '', false] }[K] || [];
    return put('frame' + (pdp ? 'p' : '') + w + 'x' + h + c + K, false, 'left:' + Math.round(r.left - pad) + 'px;top:' + Math.round(top + scrollY - pad) + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + z, function (d) {
      var v = canvasFor(w, h), x = v.x; d.appendChild(v.c);
      var L = pad + inset, T = pad + inset, Wd = w - 2 * (pad + inset), Hd = h - 2 * (pad + inset), rad = Math.min(18, Hd / 6), per = 2 * (Wd + Hd);
      function path() { x.beginPath(); x.moveTo(L + Wd / 2, T); x.arcTo(L + Wd, T, L + Wd, T + Hd, rad); x.arcTo(L + Wd, T + Hd, L, T + Hd, rad); x.arcTo(L, T + Hd, L, T, rad); x.arcTo(L, T, L + Wd, T, rad); x.closePath(); }
      function paint(k, on) { // k: share of the tube drawn; on: the flicker
        x.clearRect(0, 0, w, h); if (!on) return; x.lineCap = 'round'; x.setLineDash(k < 1 ? [per * k, per] : []);
        if (ST[0]) { path(); x.shadowColor = ST[0]; x.shadowBlur = K === 'neon' ? 16 : 10; x.strokeStyle = hexA(ST[0], K === 'neon' ? 0.55 : 0.35); x.lineWidth = ST[1]; x.stroke(); }
        var col = ST[2][0]; if (ST[2].length > 1) { col = x.createLinearGradient(0, 0, w, h); ST[2].forEach(function (cc, i) { col.addColorStop(i / (ST[2].length - 1), cc); }); col.addColorStop(0.5, '#E2B85A'); } // foil: light to deep gold
        path(); x.shadowColor = ST[0] || 'transparent'; x.shadowBlur = ST[0] ? 6 : 0; x.strokeStyle = col; x.lineWidth = ST[3]; x.stroke();
        if (ST[4]) { path(); x.shadowBlur = 0; x.strokeStyle = ST[4]; x.lineWidth = 0.9; x.stroke(); }
      }
      if (RM) { paint(1, true); return; }
      var t0 = performance.now(), FL = ST[5] ? [1, 0, 1, 1, 0, 1] : [];
      (function step(now) { // a short trace (and a flicker for neon), then it stops for good
        var e = (now - t0) / 1300;
        if (e < 1) { paint(1 - Math.pow(1 - e, 3), true); requestAnimationFrame(step); return; }
        var f = Math.floor((now - t0 - 1300) / 70); if (f < FL.length) { paint(1, FL[f]); requestAnimationFrame(step); return; }
        paint(1, true); later7();
      })(t0);
      /* every 7 s a short light runs once round the frame (light catching foil; a pulse on neon), then it rests.
         Skipped while the tab is hidden, the frame is off screen, or nobody has moved for a minute. */
      var seg = Math.min(per * 0.16, 260), hl = K === 'neon' ? '#FFFFFF' : K === 'red' ? 'rgba(255,215,210,.95)' : K === 'quiet' ? 'rgba(255,236,190,.95)' : 'rgba(255,250,228,1)';
      function later7() { setTimeout(run, 7000); }
      function run() {
        if (!d.isConnected) return;
        var rr = d.getBoundingClientRect();
        if (document.hidden || rr.bottom < 0 || rr.top > innerHeight || performance.now() - active > SLEEP || d.style.visibility === 'hidden') { later7(); return; }
        var s0 = performance.now();
        (function go(now) {
          var e = (now - s0) / 1600; if (e >= 1 || !d.isConnected) { paint(1, true); later7(); return; }
          paint(1, true); var ez = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
          x.setLineDash([seg, per]); x.lineDashOffset = -ez * per; path(); x.shadowColor = ST[0] || hl; x.shadowBlur = 12; x.strokeStyle = hl; x.lineWidth = ST[3] + 0.8; x.globalAlpha = Math.sin(e * Math.PI); x.stroke(); x.globalAlpha = 1; x.lineDashOffset = 0; x.setLineDash([]);
          requestAnimationFrame(go);
        })(s0);
      }
    });
  }
  // the Sale link: twinkling glints (gold looks), a neon underline (Cyber Neon), a red marker circle (Red Tag)
  function placeGlint(a, fixedHdr) {
    var rg = document.createRange(); rg.selectNodeContents(a); var tr = rg.getBoundingClientRect(); // the words, not the link's (often header-tall) box
    var r = tr.width && tr.height ? tr : a.getBoundingClientRect(), fx = !!fixedHdr, top = fx ? r.top : r.top + scrollY, kind = LK.glint, pad = 16;
    if (kind === 'circle') {
      var w = Math.round(r.width + 22), h = Math.round(r.height + 14), d = 'M' + (w * 0.62) + ' 3 C' + (w * 0.98) + ' 2,' + (w + 1) + ' ' + (h * 0.84) + ',' + (w * 0.52) + ' ' + (h - 2) + ' S-2 ' + (h * 0.7) + ',' + (w * 0.12) + ' ' + (h * 0.22) + ' S' + (w * 0.6) + ' 0,' + (w * 0.86) + ' ' + (h * 0.3);
      put('glintc' + w + 'x' + h, fx, 'left:' + Math.round(r.left - 11) + 'px;top:' + Math.round(top - 7) + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + (MAXZ - 6),
        '<svg class="bfcirc" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="overflow:visible"><path d="' + d + '" fill="none" stroke="#D7261E" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="' + (w * 3) + '" stroke-dashoffset="' + (w * 3) + '"/></svg>');
      return;
    }
    if (kind === 'neon') {
      var c = accent(), uw = Math.round(r.width + 8);
      put('glintn' + uw + c, fx, 'left:' + Math.round(r.left - 4 - 8) + 'px;top:' + Math.round(top + r.height - 2 - 8) + 'px;width:' + (uw + 16) + 'px;height:20px;z-index:' + (MAXZ - 6), function (d) {
        var v = canvasFor(uw + 16, 20), x = v.x; d.appendChild(v.c);
        function paint(on) { x.clearRect(0, 0, uw + 16, 20); if (!on) return; x.lineCap = 'round'; x.shadowColor = c; x.shadowBlur = 8; x.strokeStyle = c; x.lineWidth = 2; x.beginPath(); x.moveTo(9, 9); x.lineTo(uw + 7, 9); x.stroke(); x.shadowBlur = 0; x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 0.7; x.stroke(); }
        if (RM) { paint(true); return; }
        var FL = [1, 0, 0, 1, 0, 1, 1, 0, 1], i = 0; (function f() { paint(FL[i]); if (++i < FL.length) setTimeout(f, 90); })();
      });
      return;
    }
    var w2 = Math.round(r.width + pad * 2), h2 = Math.round(r.height + pad * 2), col = '#E8C063';
    put('glintg' + w2 + 'x' + h2, fx, 'left:' + Math.round(r.left - pad) + 'px;top:' + Math.round(top - pad) + 'px;width:' + w2 + 'px;height:' + h2 + 'px;z-index:' + (MAXZ - 6), function (d) {
      var v = canvasFor(w2, h2), g = glint(col); d.appendChild(v.c);
      var pts = [[w2 - pad * 0.55, pad * 0.62, 15, 0], [pad * 0.5, h2 - pad * 0.7, 11, 1.3], [w2 - pad * 1.3, h2 - pad * 0.35, 8, 2.1]];
      addDrawer({ el: d, every: 1, draw: function (t) {
        var x = v.x; x.clearRect(0, 0, w2, h2);
        pts.forEach(function (p) { var k = RM ? 0.8 : twinkle(t, 2.6, p[3]); if (k < 0.04) return; var s = p[2] * (0.55 + 0.45 * k); x.globalAlpha = k; x.drawImage(g, p[0] - s, p[1] - s, s * 2, s * 2); });
        x.globalAlpha = 1;
      } }, true);
    });
  }
  // Black Tie: gold glints twinkling here and there in the side margins (the Apple and Kylie sparkle), slowly
  var flakes = null;
  function placeDrift(W, V) {
    var key = W + 'x' + V; if (flakes && flakes.key === key) return; dropDrift(); if (RM) return;
    var mob = W < 768, n = mob ? 3 : 6, band = Math.max(16, Math.min(W * (mob ? 0.045 : 0.07), 96)), bw = Math.ceil(band + 20), list = [];
    for (var i = 0; i < n * 2; i++) list.push({ side: i % 2, x: 10 + Math.random() * band, y: 60 + Math.random() * (V - 120), sz: (mob ? 7 : 9) + Math.random() * 7, p: 3.2 + Math.random() * 2.6, d: Math.random() * 9 });
    flakes = { key: key, els: [], views: [], list: list, bw: bw, V: V, g: glint('#E8C063') };
    ['left', 'right'].forEach(function (side) {
      var e = document.createElement('div'), v = canvasFor(bw, V, 1); e.className = 'troo-bf-x'; e.setAttribute('aria-hidden', 'true');
      e.style.cssText = 'position:fixed;top:0;' + side + ':0;width:' + bw + 'px;height:' + V + 'px;pointer-events:none;z-index:' + (MAXZ - 4) + ';margin:0;padding:0;line-height:0;contain:strict' + (side === 'right' ? ';transform:scaleX(-1)' : '');
      e.appendChild(v.c); document.documentElement.appendChild(e); flakes.els.push(e); flakes.views.push(v);
    });
    addDrawer({ el: flakes.els[0], every: 2, draw: drawDrift }, true);
  }
  function drawDrift(t) {
    var S = flakes; if (!S) return;
    S.views.forEach(function (v, side) {
      var x = v.x; x.clearRect(0, 0, S.bw, S.V);
      S.list.forEach(function (o) {
        if (o.side !== side) return;
        var cyc = Math.floor((t + o.d) / o.p), k = twinkle(t, o.p, o.d); if (k < 0.05) return;
        var yy = 60 + (((o.y + cyc * 197) % (S.V - 120)) + (S.V - 120)) % (S.V - 120), s = o.sz * (0.5 + 0.5 * k); // each twinkle somewhere new
        x.globalAlpha = k; x.drawImage(S.g, o.x - s, yy - s, s * 2, s * 2);
      });
      x.globalAlpha = 1;
    });
  }
  function dropDrift() { if (flakes) flakes.els.forEach(function (e) { e.remove(); }); flakes = null; }

  /* ---------------------------------------------------------------- more moments on the page */
  function lookCol() { return cfg.look === 'neon' ? accent() : cfg.look === 'red' ? '#D7261E' : cfg.look === 'quiet' ? '#C9A24E' : '#D9AE52'; }
  function shineCol() { return cfg.look === 'neon' ? hexA(accent(), 0.55) : cfg.look === 'tie' ? 'rgba(255,236,190,.6)' : 'rgba(255,255,255,.45)'; }
  // the look's frame line in CSS: gold foil gradient (Black Tie), neon glow, red, a fine gold line (Quiet)
  function frameCSS(c) {
    if (cfg.look === 'tie') return 'border:1.5px solid transparent;background:linear-gradient(#0000,#0000) padding-box,linear-gradient(135deg,#FFF1C2,#E2B85A 45%,#B8892E 70%,#F3D98C) border-box;box-shadow:0 0 14px rgba(226,184,90,.35)';
    if (cfg.look === 'neon') return 'border:1.5px solid ' + c + ';box-shadow:0 0 12px ' + hexA(c, 0.55) + ',inset 0 0 8px ' + hexA(c, 0.25);
    if (cfg.look === 'red') return 'border:1.5px solid ' + c + ';box-shadow:0 0 12px ' + hexA(c, 0.3);
    return 'border:1px solid ' + c;
  }
  // 1. desktop: a frame traces round the product card under the mouse (one element, moved; hidden on scroll)
  var hov = null, hovCard = null, FINE = window.matchMedia && matchMedia('(pointer: fine)').matches;
  function cardAt(t) {
    if (!t || !t.closest || ours(t) || t.closest('header,nav,[class*="drawer" i]')) return null;
    var best = null, W = innerWidth;
    for (var a = t, k = 0; a && a !== document.body && k < 12; a = a.parentElement, k++) {
      var r = a.getBoundingClientRect(); if (r.width > W * 0.5 || r.height > innerHeight * 0.95) break;
      if (r.width < 140 || r.height < 180 || r.height > innerHeight * 0.85 || a.querySelector('h1,form,select,input,button[name="add"]') || !PRICE_RE.test(a.innerText || '')) continue;
      var big = [].some.call(a.querySelectorAll('img'), function (i) { var ir = i.getBoundingClientRect(); return ir.width >= r.width * 0.6 && ir.height >= 100; });
      if (big) best = a;
    }
    return best;
  }
  function onOver(e) {
    if (!on || !F('hover')) return;
    var c = cardAt(e.target); if (c === hovCard) return; hovCard = c;
    if (!hov) { hov = document.createElement('div'); hov.className = 'troo-bf-x bfh'; hov.setAttribute('aria-hidden', 'true'); document.documentElement.appendChild(hov); }
    if (!c) { hov.classList.remove('on'); return; }
    var r = c.getBoundingClientRect(); hov.style.left = (r.left - 4) + 'px'; hov.style.top = (r.top - 4) + 'px'; hov.style.width = (r.width + 8) + 'px'; hov.style.height = (r.height + 8) + 'px';
    hov.classList.remove('on'); void hov.offsetWidth; hov.classList.add('on');
  }
  function hideHov() { if (hov && hovCard) { hovCard = null; hov.classList.remove('on'); } }
  // 2. product page: a light sweeps across the main Add to cart button, four times, then stops
  function placeShine(lo, hi, sy) {
    var best = null, ba = 0;
    [].forEach.call(document.querySelectorAll('button,input[type=submit],a'), function (e) {
      var t = (e.innerText || e.value || '').replace(/\s+/g, ' ').trim(); if (!/^(add to (cart|bag|basket)|buy (it )?now)\b/i.test(t) || ours(e) || !vis(e)) return;
      var r = e.getBoundingClientRect(); if (r.bottom < lo || r.top > hi || r.height > 90 || r.width < 100 || fixedAncestor(e)) return;
      if (r.width * r.height > ba) { ba = r.width * r.height; best = e; }
    });
    if (!best) return;
    var r = best.getBoundingClientRect(), br = getComputedStyle(best).borderRadius;
    anchor(put('shine' + Math.round(r.left) + '_' + Math.round(r.top + sy) + 'x' + Math.round(r.width), false, 'left:' + Math.round(r.left) + 'px;top:' + Math.round(r.top + sy) + 'px;width:' + Math.round(r.width) + 'px;height:' + Math.round(r.height) + 'px;border-radius:' + br + ';overflow:hidden;z-index:' + (MAXZ - 8), '<div class="bfsh" style="border-radius:' + br + '"><i></i></div>'), best);
  }
  // 3. a small glint beside section titles (at most three on a screen)
  function* placeTitles(W, V, lo, hi, sy, hb, pt, z) {
    var n = 0, rows = [], col = lookCol();
    yield* each(document.querySelectorAll('h1,h2,h3,[class*="title" i],[class*="heading" i]'), function (e) {
      if (n >= 3) return false;
      if (ours(e) || e.closest('header,nav,footer,[class*="menu" i],[class*="drawer" i],a,button')) return;
      if (!/^H[1-6]$/.test(e.tagName) && e.querySelector('h1,h2,h3,h4,h5,h6')) return;
      if (pt === 'product' && e.tagName === 'H1') return;
      var r = e.getBoundingClientRect(); if (!r.width || r.top < hb || r.top < 0 || r.bottom > V || r.height > 70) return;
      var t = (e.innerText || '').trim(); if (t.length < 3 || t.length > 40 || t.indexOf('\n') > -1 || !vis(e)) return;
      var fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 18) return;
      var rg = document.createRange(); rg.selectNodeContents(e); var tr = rg.getBoundingClientRect(); if (!tr.width) return;
      if (rows.some(function (y) { return Math.abs(y - tr.top) < 30; })) return;
      var S = Math.round(Math.min(26, fs * 0.9)), gx = Math.round(tr.right + 6), gy = Math.round(tr.top + tr.height / 2 - S / 2 - fs * 0.25);
      if (gx + S > W - 4 || !areaFree(gx, gy, S, S, 2, 2) || stillUnder(gx + S / 2, gy + S / 2) && !areaFree(gx, gy, S, S, 2, 2)) return;
      rows.push(tr.top); n++;
      if (F('dividers')) placeDivider(e, tr, W, sy, z);
      put('ttl' + gx + '_' + (gy + sy) + col, false, 'left:' + gx + 'px;top:' + (gy + sy) + 'px;width:' + S + 'px;height:' + S + 'px;z-index:' + z, function (d) {
        var v = canvasFor(S, S), g = glint(col), ph = Math.random() * 3; d.appendChild(v.c);
        addDrawer({ el: d, every: 2, draw: function (tt) { var k = RM ? 0.85 : 0.35 + 0.65 * twinkle(tt, 3.4, ph), s2 = S * (0.6 + 0.4 * k) / 2; v.x.clearRect(0, 0, S, S); v.x.globalAlpha = k; v.x.drawImage(g, S / 2 - s2, S / 2 - s2, s2 * 2, s2 * 2); v.x.globalAlpha = 1; } }, true);
      });
    });
  }
  // 4. product page: "Black Friday price" beside a real sale price (only when a crossed-out price is there)
  function placePriceLabel(pp, W, sy, z) {
    var text = cfg.look === 'neon' ? 'Cyber Week price' : 'Black Friday price', nr = pp.now.el.getBoundingClientRect(), sr = pp.sr, ps = pillSize(20, text);
    var line = Math.abs((sr.top + sr.bottom) / 2 - (nr.top + nr.bottom) / 2) < Math.max(nr.height, 12) * 0.6, px = (line ? Math.max(nr.right, sr.right) : nr.right) + 10, py = nr.top + nr.height / 2 - 10;
    if (px + ps[0] > W - 6 || !besideFree(px, py, ps[0], 20, pp.now.el)) { px = Math.min(nr.left, line ? sr.left : nr.left); py = Math.max(nr.bottom, line ? sr.bottom : 0) + 6; }
    if (px + ps[0] > W - 6 || !besideFree(px, py, ps[0], 20, pp.now.el)) return;
    var keep = LK.sticker; if (keep === 'pill') LK.sticker = 'gold';
    var html = stickerHTML(20, text); LK.sticker = keep;
    anchor(put('plabel' + Math.round(px) + '_' + Math.round(py + sy), false, 'left:' + Math.round(px) + 'px;top:' + Math.round(py + sy) + 'px;z-index:' + z, html), pp.now.el);
  }
  // 5. a frame round the cart drawer while it is open
  function placeCart(W, V) {
    var dr = null;
    [].some.call(document.querySelectorAll('cart-drawer,cart-notification,[id*="cart" i],[class*="cart-drawer" i],[class*="drawer" i][class*="cart" i],[class*="mini-cart" i],[class*="minicart" i],[class*="side-cart" i]'), function (e) {
      if (ours(e) || !vis(e)) return false;
      var r = e.getBoundingClientRect(); if (r.width < 260 || r.height < V * 0.55 || r.top > 12 || r.right < W * 0.4 || r.left > W - 200) return false;
      var cs = getComputedStyle(e); if (cs.position !== 'fixed' && !fixedAncestor(e)) return false;
      dr = e; return true;
    });
    if (!dr) return;
    var r = dr.getBoundingClientRect();
    put('cartf' + Math.round(r.left) + 'x' + Math.round(r.width), true, 'left:' + Math.round(r.left + 6) + 'px;top:' + Math.round(Math.max(0, r.top) + 6) + 'px;width:' + Math.round(r.width - 12) + 'px;height:' + Math.round(Math.min(r.bottom, V) - Math.max(0, r.top) - 12) + 'px;z-index:' + (MAXZ - 3), '<div class="bfcart" style="position:absolute;inset:0"></div>');
  }
  // 6. a slim Black Friday ribbon along the top edge of the footer, where it covers nothing
  function placeFooter(W, lo, hi, sy, z) {
    var ft = null;
    [].some.call(document.querySelectorAll('footer,[class*="footer" i],[id*="footer" i]'), function (e) { if (ours(e) || !vis(e)) return false; var r = e.getBoundingClientRect(); if (r.width < W * 0.9 || r.height < 80 || fixedAncestor(e)) return false; ft = e; return true; });
    if (!ft) return; var r = ft.getBoundingClientRect(); if (r.top < lo || r.top > hi) return;
    var H = 24, top = r.top - H / 2; if (top > -H && top < innerHeight && !areaFree(W * 0.06, top, W * 0.88, H, 10, 2)) return;
    var word = cfg.look === 'neon' ? 'Cyber Week' : 'Black Friday', rep = new Array(Math.ceil(W / 190) + 1).join(word + '   \u00b7   '), st, inner = esc(rep);
    if (cfg.look === 'tie') st = 'background-image:' + bgi(A('ribbonTie')) + ';background-size:100% 100%;color:#E9C677';
    else if (cfg.look === 'red') st = 'background-image:' + bgi(A('ribbonRed')) + ';background-size:100% 100%;color:#fff';
    else if (cfg.look === 'neon') st = 'background:#0A0A0C;border-top:1px solid ' + accent() + ';border-bottom:1px solid ' + accent() + ';box-shadow:0 0 10px ' + hexA(accent(), 0.4) + ';color:' + accent() + ';text-shadow:0 0 6px ' + hexA(accent(), 0.7);
    else { st = 'background:linear-gradient(transparent 11px,#C9A24E 11px,#C9A24E 12px,transparent 12px);color:#8E7232'; inner = '<span style="background:#fff;padding:0 14px;letter-spacing:.32em">' + esc(word) + '</span>'; }
    put('foot' + Math.round(r.top + sy) + cfg.look, false, 'left:0;top:' + Math.round(top + sy) + 'px;width:' + W + 'px;height:' + H + 'px;z-index:' + z, '<div class="bff" style="position:absolute;inset:0;' + st + '">' + inner + '</div>');
  }

  // 7. further down: the look's frame traced round each big banner as it comes into view (at most four on screen)
  function placeBanners(W, V, lo, hi, sy, hero, z, pt) {
    var n = 0, done = [];
    [].forEach.call(document.querySelectorAll('img,video'), function (m) {
      if (n >= 4 || ours(m) || (hero && hero.contains(m)) || m.closest('header,nav,footer,[class*="drawer" i]')) return;
      var r = m.getBoundingClientRect(); if (r.width < W * 0.6 || r.height < 160 || r.bottom < 0 || r.top > V || r.top + sy < (innerHeight * 0.6)) return;
      if (pt === 'product' && r.top + sy < V * 1.2) return; // the main product photo has its own frame
      var box = m; for (var u = m.parentElement; u && u !== document.body; u = u.parentElement) { var ur = u.getBoundingClientRect(); if (ur.width > r.width * 1.12 || ur.height > r.height * 1.12 || ur.left > r.left + 2 || ur.right < r.right - 2 || ur.top > r.top + 2 || ur.bottom < r.bottom - 2) break; box = u; } // only boxes that hold the whole picture
      if (done.some(function (d) { return d.contains(box) || box.contains(d); }) || clipped(box, W) || fixedAncestor(box)) return;
      done.push(box); n++;
      var fp = placeFrame(box, -1e4, W, z, true); if (fp) anchor(fp, box);
    });
    for (var k in live) if (/^framep/.test(k) && !seen[k]) { var rr = live[k].el.getBoundingClientRect(); if (rr.bottom < 0 || rr.top > V) seen[k] = 1; } // off screen: keep
  }
  // 8. a small ornament in the gap above a section title: a hairline fading at both ends, a diamond and a glint
  function placeDivider(e, tr, W, sy, z) {
    var w = Math.min(200, Math.max(120, tr.width * 0.8)), h = 18, cs = getComputedStyle(e), centred = cs.textAlign === 'center' || Math.abs((tr.left + tr.right) / 2 - W / 2) < 40;
    var x0 = Math.round(centred ? (tr.left + tr.right) / 2 - w / 2 : tr.left), y0 = Math.round(tr.top - h - 8);
    if (y0 < 0 || !areaFree(x0, y0, w, h, 5, 1)) return;
    var col = lookCol();
    put('div' + x0 + '_' + (y0 + sy) + col, false, 'left:' + x0 + 'px;top:' + (y0 + sy) + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + z, function (d) {
      var v = canvasFor(w, h), x = v.x, m = centred ? w / 2 : 30; d.appendChild(v.c);
      var g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, hexA(col, 0)); g.addColorStop(m / w, hexA(col, 0.95)); g.addColorStop(1, hexA(col, 0));
      if (!centred) { g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, hexA(col, 0.95)); g.addColorStop(1, hexA(col, 0)); }
      if (cfg.look === 'neon') { x.shadowColor = col; x.shadowBlur = 6; }
      x.strokeStyle = g; x.lineWidth = 1; x.beginPath(); x.moveTo(centred ? 0 : 14, h / 2); x.lineTo(w, h / 2); x.stroke();
      x.shadowBlur = 0; x.fillStyle = col; x.beginPath(); x.moveTo(m, h / 2 - 4.5); x.lineTo(m + 4.5, h / 2); x.lineTo(m, h / 2 + 4.5); x.lineTo(m - 4.5, h / 2); x.closePath(); x.fill();
      var gl = glint('#FFF6DA'); x.drawImage(gl, m - 9, h / 2 - 9, 18, 18);
    });
  }
  /* 9. Lights down both edges that light up as you scroll (the Diwali and Halloween side strands, in each look's
     colours): a fine wire with small bulbs; every bulb above the shopper's place on the page is lit, with a slow chase
     running down to a bright head that rides the scroll. Canvas only, redrawn on scroll and by the shared clock. */
  var sprites = {}, sides = null;
  function sprite(key, r, stops) {
    if (sprites[key]) return sprites[key];
    var S = Math.max(2, Math.ceil(r * 2 * DPR)), c = document.createElement('canvas'); c.width = c.height = S;
    var x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); stops.forEach(function (st) { g.addColorStop(st[0], st[1]); });
    x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, 6.2832); x.fill(); return (sprites[key] = c);
  }
  function blit(x, im, cx, cy, r, a) { if (a <= 0.02) return; x.globalAlpha = Math.min(1, a); x.drawImage(im, cx - r, cy - r, r * 2, r * 2); }
  function chase(t, k) { var q = ((t - k * 0.2) / 1.0) % 1; if (q < 0) q += 1; return q < 0.1 ? 0.38 + 6.2 * q : 0.38 + 0.62 * Math.max(0, 1 - (q - 0.1) / 0.5); }
  function bulbs(light) { // [colour, pale core] x 5 chase groups, and the wire, per look
    var K = cfg.look, c = accent();
    if (K === 'neon') return { wire: light ? '#2A2A2E' : '#5A5A62', dim: light ? '#E4E4E8' : '#2E2E34', b: [[c, '#FFFFFF'], [c, '#FFFFFF'], [c, '#FFFFFF'], [c, '#FFFFFF'], [c, '#FFFFFF']] };
    if (K === 'red') return { wire: light ? '#2B2121' : '#8C7B78', dim: light ? '#F1D9D6' : '#4A3533', b: [['#E2231A', '#FFD6D2'], ['#C81810', '#FFC9C2'], ['#E2231A', '#FFD6D2'], ['#FF4A3D', '#FFE0DC'], ['#C81810', '#FFC9C2']] };
    var g = [['#D9A23A', '#FFF0C8'], ['#E8B547', '#FFF4D6'], ['#C9922E', '#FFE7B8'], ['#F2C766', '#FFF8E2'], ['#D9A23A', '#FFF0C8']];
    return { wire: light ? '#3A2E1A' : '#A88E5C', dim: light ? '#EADFC6' : '#4A4030', b: g };
  }
  function placeThread(W, V) {
    var light = bgLight(W * 0.02, V * 0.5) !== false, key = W + 'x' + V + cfg.look + light + accent();
    if (sides && sides.key === key) { sideProgress(true); return; } dropThread();
    var u = Math.max(1, Math.min(1.3, W / 390)), P = bulbs(light), quiet = cfg.look === 'quiet', gap = (quiet ? 34 : 22) * u, n = Math.max(6, Math.floor((V - 8) / gap)), amp = 1.4 * u, x0 = 10 * u, w = Math.ceil(x0 + 16 * u), r = (quiet ? 1.6 : 2.3) * u, ys = [], xs = [];
    function wx(yy) { return x0 + amp * Math.sin(yy / (38 * u)); }
    var base = canvasFor(w, V), b = base.x;
    b.strokeStyle = P.wire; b.globalAlpha = quiet ? 0.5 : 0.85; b.lineWidth = (quiet ? 0.8 : 1.15) * u; b.beginPath(); b.moveTo(wx(-4), -4);
    for (var y = 2; y <= V + 6; y += 6) b.lineTo(wx(y), y);
    b.stroke(); b.globalAlpha = 0.85;
    for (var i = 0; i < n; i++) { y = 6 + gap * (i + 0.5); var bx = wx(y) + (i % 2 ? 1.5 : -1.5) * u; ys.push(y); xs.push(bx); b.beginPath(); b.arc(bx, y, r * 0.85, 0, 6.2832); b.fillStyle = P.dim; b.fill(); }
    var G = { n: n, w: w, ys: ys, xs: xs, wx: wx, base: base, r: r, u: u, P: P,
      halos: P.b.map(function (c, k) { return sprite('bh' + c[0] + k + u, r * 3.6, [[0, hexA(c[0], 0.75)], [0.45, hexA(c[0], 0.28)], [1, hexA(c[0], 0)]]); }),
      cores: P.b.map(function (c, k) { return sprite('bc' + c[0] + k + u, r * 1.15, [[0, '#FFFFFF'], [0.35, c[1]], [1, c[0]]]); }),
      hhalo: sprite('hh' + P.b[0][0] + u, r * 6.5, [[0, hexA(P.b[0][0], 0.9)], [0.4, hexA(P.b[0][0], 0.35)], [1, hexA(P.b[0][0], 0)]]), gl: glint(cfg.look === 'neon' ? accent() : cfg.look === 'red' ? '#FF5A4D' : '#E8C063') };
    sides = { key: key, g: G, H: V, lit: 0, hy: -1, els: [], views: [], raf: 0 };
    ['left', 'right'].forEach(function (side) {
      var e = document.createElement('div'), v = canvasFor(G.w, V); e.className = 'troo-bf-x'; e.setAttribute('aria-hidden', 'true');
      e.style.cssText = 'position:fixed;top:0;' + side + ':0;width:' + G.w + 'px;height:' + V + 'px;pointer-events:none;z-index:' + (MAXZ - 3) + ';line-height:0;margin:0;padding:0;contain:strict' + (side === 'right' ? ';transform:scaleX(-1)' : '');
      e.appendChild(v.c); document.documentElement.appendChild(e); sides.els.push(e); sides.views.push(v);
    });
    sideProgress(true);
    addDrawer({ el: sides.els[0], every: 2, draw: drawSides }, true);
  }
  function drawSides(t) {
    if (!sides) return;
    var G = sides.g, H = sides.H, x = sides.views[0].x, r = G.r, anim = !RM, i;
    x.globalAlpha = 1; x.clearRect(0, 0, G.w, H); x.drawImage(G.base.c, 0, 0, G.w, H);
    for (i = 0; i < sides.lit; i++) { var k = i % 5, a = anim ? chase(t, k) : 1; blit(x, G.halos[k], G.xs[i], G.ys[i], r * 3.6, a); blit(x, G.cores[k], G.xs[i], G.ys[i], r * 1.15, a); }
    var hy = sides.hy < 0 ? G.ys[0] : sides.hy, hx = G.wx(hy), pulse = anim ? 0.5 - 0.5 * Math.cos((t / 1.1) * Math.PI) : 1, gs = 9 * G.u * (0.85 + 0.3 * pulse);
    blit(x, G.hhalo, hx, hy, r * 6.5 * (0.8 + 0.35 * pulse), 0.7 + 0.3 * pulse);
    x.globalAlpha = 1; x.drawImage(G.gl, hx - gs, hy - gs, gs * 2, gs * 2);
    var R = sides.views[1].x; R.globalAlpha = 1; R.clearRect(0, 0, G.w, H); R.drawImage(sides.views[0].c, 0, 0, G.w, H);
  }
  function sideProgress(force) {
    if (!sides) return; sides.raf = 0;
    var G = sides.g, ys = G.ys, max = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) - innerHeight;
    var p = max > 40 ? Math.min(1, Math.max(0, scrollY / max)) : 1, hy = ys[0] + p * (ys[ys.length - 1] - ys[0]), changed = force === true;
    if (Math.abs(hy - sides.hy) > 0.5) { sides.hy = hy; changed = true; }
    var lit = 0; while (lit < ys.length && ys[lit] <= hy + 1) lit++;
    if (lit !== sides.lit) { sides.lit = lit; changed = true; }
    if (changed) drawSides(performance.now() / 1000);
  }
  function dropThread() { if (sides) { cancelAnimationFrame(sides.raf); sides.els.forEach(function (e) { e.remove(); }); sides = null; } }

  // 12. a string of small lights in shallow swags along the very top of the page, twinkling in a slow chase. They may
  //     cross the top bar (that is the look); they stay within its top 16 px, clear of its words.
  function placeTopString(W) {
    var H = 18, light = bgLight(W / 2, 4) !== false;
    put('topstr', false, 'left:0;top:0;width:' + W + 'px;height:' + H + 'px;z-index:' + (MAXZ - 9), function (d) {
      var v = canvasFor(W, H), x = v.x, P = bulbs(light), u = 1, n = Math.max(3, Math.round(W / 90)), sw = W / n, sag = 6, pts = [];
      for (var i = 0; i <= n * 6; i++) { var px = i * sw / 6, f = (px % sw) / sw; pts.push([px, 2 + sag * 4 * f * (1 - f)]); }
      var bs = []; for (var j = 0; j < W; j += 15) { var f2 = (j % sw) / sw; bs.push([j + 7, 2 + sag * 4 * f2 * (1 - f2) + 4]); }
      var halos = P.b.map(function (c, k) { return sprite('th' + c[0] + k, 6.5, [[0, hexA(c[0], 0.8)], [0.45, hexA(c[0], 0.3)], [1, hexA(c[0], 0)]]); });
      var cores = P.b.map(function (c, k) { return sprite('tc' + c[0] + k, 2.1, [[0, '#FFFFFF'], [0.35, c[1]], [1, c[0]]]); });
      d.appendChild(v.c);
      addDrawer({ el: d, every: 2, draw: function (t) {
        x.clearRect(0, 0, W, H); x.globalAlpha = 0.85; x.strokeStyle = P.wire; x.lineWidth = 1; x.beginPath(); pts.forEach(function (p, i) { i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }); x.stroke();
        bs.forEach(function (b, i) { var k = i % 5, a = RM ? 1 : chase(t, k); blit(x, halos[k], b[0], b[1], 6.5, a); blit(x, cores[k], b[0], b[1], 2.1, a); });
        x.globalAlpha = 1;
      } }, true);
    });
  }
  // 10. a tube along the header's bottom edge, in the look's style, with a light running along it every 7 s
  function placeHdrLine(W, y, fixed) {
    var H = 12, K = cfg.look, c = lookCol();
    put('hdrline' + (fixed ? 1 : 0), fixed, 'left:0;top:' + Math.round(y - H / 2) + 'px;width:' + W + 'px;height:' + H + 'px;z-index:' + (MAXZ - 9), function (d) {
      var v = canvasFor(W, H), x = v.x, m = H / 2, run = -1; d.appendChild(v.c);
      function line() {
        x.clearRect(0, 0, W, H); x.lineCap = 'round';
        var g = c; if (K === 'tie') { g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#B8892E'); g.addColorStop(0.3, '#FFF1C2'); g.addColorStop(0.55, '#E2B85A'); g.addColorStop(0.8, '#F3D98C'); g.addColorStop(1, '#B8892E'); }
        if (K !== 'quiet') { x.shadowColor = c; x.shadowBlur = K === 'neon' ? 8 : 5; x.strokeStyle = hexA(c, K === 'neon' ? 0.5 : 0.3); x.lineWidth = K === 'neon' ? 4 : 3; x.beginPath(); x.moveTo(0, m); x.lineTo(W, m); x.stroke(); }
        x.shadowBlur = K === 'neon' ? 3 : 0; x.strokeStyle = g; x.lineWidth = K === 'quiet' ? 1 : 1.6; x.beginPath(); x.moveTo(0, m); x.lineTo(W, m); x.stroke();
        if (K === 'neon') { x.shadowBlur = 0; x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.6; x.stroke(); }
        if (run >= 0) { var px = run * (W + 300) - 150, lg = x.createLinearGradient(px - 150, 0, px + 150, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, K === 'neon' ? '#FFFFFF' : 'rgba(255,248,225,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
          x.shadowColor = c; x.shadowBlur = 10; x.strokeStyle = lg; x.lineWidth = 2.4; x.beginPath(); x.moveTo(Math.max(0, px - 150), m); x.lineTo(Math.min(W, px + 150), m); x.stroke(); x.shadowBlur = 0; }
      }
      line(); if (RM) return;
      function later() { setTimeout(go, 7000); }
      function go() {
        if (!d.isConnected) return; if (document.hidden || performance.now() - active > SLEEP) { later(); return; }
        var t0 = performance.now(); (function f(now) { var e = (now - t0) / 1500; if (e >= 1 || !d.isConnected) { run = -1; line(); later(); return; } run = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2; line(); requestAnimationFrame(f); })(t0);
      }
      setTimeout(go, 2500);
    });
  }

  /* 11. The store's own discount badges ("-40%", "40% OFF", "Save 20%", "SALE") get the look's tag laid exactly over
     them, with the same words: found by their text and size, next to a product photo. The badge stays underneath. */
  var BADGE_RE = /^(-|–)?\s?\d{1,2}\s?%(\s?off)?$|^(save|flat|upto|up to)\s?\d{1,2}\s?%(\s?off)?$|^\d{1,2}\s?%\s?off$|^sale$|^on sale$/i;
  function* reskinBadges(W, lo, hi, sy, z, cards) {
    var n = 0, doneB = new Set();
    yield* each(document.querySelectorAll('span,div,p,b,strong,em,small,label,i,li,mark'), function (e0) {
      if (n >= 24) return false; if (ours(e0)) return;
      var t = ownText(e0).replace(/\s+/g, ' '); if (!t || t.length > 14 || !BADGE_RE.test(t)) return; // the element holding the words
      // the badge is the outermost box around just these words (a pill, its padding and background)
      var e = e0; while (e.parentElement && e.parentElement !== document.body && (e.parentElement.innerText || '').replace(/\s+/g, ' ').trim() === t && e.parentElement.getBoundingClientRect().width < 170) e = e.parentElement;
      if (doneB.has(e)) return; doneB.add(e);
      var r = e.getBoundingClientRect(); if (r.width < 18 || r.width > 170 || r.height < 12 || r.height > 60 || r.bottom < lo || r.top > hi || !vis(e) || fixedAncestor(e) || clipped(e, W)) return;
      if (e.closest('header,nav,footer,button,a[href*="cart" i]')) return;
      var cp = cardPhoto(e, W); if (!cp) { var mp = mainPhoto(W, innerHeight); if (!mp) return; var mr = mp.getBoundingClientRect(); if (r.left > mr.right + 40 || r.right < mr.left - 40 || r.top > mr.bottom || r.bottom < mr.top - 40) return; cp = { photo: mp }; }
      var text = /^sale$|^on sale$/i.test(t) ? 'Sale' : t.replace(/^–/, '-').replace(/\s?off$/i, ' off').replace(/^(\d)/, '$1');
      var h = Math.max(Math.round(r.height), 20), ps = pillSize(h, text), w = Math.max(Math.round(r.width), ps[0]);
      var left = Math.round(r.left + r.width / 2 - w / 2); if (r.left < (cp.photo.getBoundingClientRect().left + 20)) left = Math.round(r.left); // keep a corner badge in its corner
      var html = stickerHTML(h, text).replace('class="bfs" style="', 'class="bfs" style="width:' + w + 'px;justify-content:center;');
      anchor(put('badge' + Math.round(r.left) + '_' + Math.round(r.top + sy) + text, false, 'left:' + left + 'px;top:' + Math.round(r.top + sy + r.height / 2 - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + z, html), e);
      if (cp.photo) cards.add(cp.photo); n++;
    });
  }

  /* ---------------------------------------------------------------- render (sliced, from the Halloween engine) */
  var job = null, sliceT0 = 0, SLICE = 8;
  function over() { return cfg && cfg.sliced && performance.now() - sliceT0 > SLICE; }
  function* each(list, fn) { for (var q = 0; q < list.length; q++) { if (fn(list[q], q) === false) return; if (over()) yield; } }
  function later(f) { if (window.scheduler && scheduler.postTask) scheduler.postTask(f, { priority: 'background' }); else setTimeout(f, 0); }
  function render() {
    if (job) { try { job.return(); } catch (e) {} job = null; }
    var g, r;
    try { g = draw(); } catch (e) { if (window.console) console.warn('TrooFestive:', e); return; }
    if (!cfg.sliced) {
      try { sliceT0 = performance.now(); do { r = g.next(); } while (!r.done); return r.value; } catch (e) { if (window.console) console.warn('TrooFestive:', e); return; }
    }
    job = g;
    (function step() {
      if (job !== g) return;
      sliceT0 = performance.now();
      try { do { r = g.next(); } while (!r.done && !over()); } catch (e) { job = null; if (window.console) console.warn('TrooFestive:', e); return; }
      if (r.done) { job = null; return; }
      later(step);
    })();
    return TrooFestive.last;
  }

  function* draw() {
    if (!on || !document.body) return;
    var t0 = performance.now(), W = document.documentElement.clientWidth || innerWidth, V = innerHeight, sy = scrollY, pt = pageType(), out = { page: pt, look: cfg.look };
    var lo = -V * 0.6, hi = V * 2, ctaPlan = new Map(); taken = []; sashL = -1e4; out0 = out; out.pdpFrameTop = 0;
    if (root.style.opacity) root.style.opacity = '';

    /* header (a sticky header keeps its place; decor in the page goes just under its z-index, so it slides under it) */
    var hdr = findHeader(), hr = hdr ? hdr.getBoundingClientRect() : null, hdrFixed = hdr && fixedAncestor(hdr);
    // headers that hide while scrolling: keep the last one seen in place (its bottom edge in the page)
    if (hdr && hr.bottom > 0) hdrMem = { el: hdr, doc: hr.bottom + sy, fixed: hdrFixed };
    else if (hdrMem && hdrMem.el.isConnected && sy < V * 2) { hdr = hdrMem.el; hdrFixed = hdrMem.fixed; hr = { top: hdrMem.doc - sy - 60, bottom: hdrMem.doc - sy }; }
    if (!hdrFixed) [W * 0.5, W * 0.25, W * 0.75].some(function (x) { var e = document.elementFromPoint(x, 12); var f = e && !ours(e) && fixedAncestor(e); if (!f) return false; var fr = f.getBoundingClientRect(); if (fr.top <= 2 && fr.height >= 32 && fr.height <= 260 && fr.width >= W * 0.9) { hdrFixed = f; if (!hdr || hr.bottom <= 0) { hdr = f; hr = fr; } return true; } });
    var hb = hr ? Math.max(0, hr.bottom) : 0, hbDoc = hr ? hr.bottom + sy : 0, zh = hdrFixed ? hdrZ(hdrFixed) : 0, zIn = zh > 1 ? zh - 1 : hdrFixed ? 1 : 30;
    if (!hdrFixed && hr && hr.bottom < 0) hb = 0;
    out.header = Math.round(hbDoc); out.z = zIn;
    yield;

    /* hero pieces: only near the top of home and collection pages */
    var atTop = sy < V * 0.9, hero = (F('sash') || F('frame') || F('hang')) && pt !== 'product' && atTop ? findHero(hbDoc - sy, W, V) : null;
    if (hero && (F('sash') || F('frame'))) {
      out.hero = true;
      // a see-through header laid over the hero (Gymshark): the frame goes round the whole hero, logo and all
      // the banner starts underneath the header (a see-through header laid over it): the frame takes in the whole banner
      var fhb = hbDoc - sy, hrt = hero.getBoundingClientRect().top; if (hdr && (overHero(hdr, hr, hero) || (hr && hrt < hr.bottom - 24))) { fhb = Math.max(0, hrt); out.hdrOver = true; }
      if (F('frame')) { placeFrame(hero, fhb, W, zIn); out.frame = true; out0.frameTop = heroBox(hero, hbDoc - sy).top + sy + (W < 640 ? 7 : 11); }
      if (F('sash')) placeSash(hero, hbDoc - sy, W, zIn);
    } else if (!atTop) for (var k0 in live) if (/^(frame|sash)/.test(k0)) seen[k0] = 1; // scrolled away: keep them where they are
    /* product page: the same frame (and ribbon) round the main product photo; they follow it if the gallery moves */
    if (pt === 'product' && (F('frame') || F('sash'))) {
      var mp = mainPhoto(W, V), box = mp;
      for (var up2 = mp && mp.parentElement; up2 && up2 !== document.body; up2 = up2.parentElement) { var ur = up2.getBoundingClientRect(), mr = mp.getBoundingClientRect(); if (ur.width > mr.width * 1.15 || ur.height > mr.height * 1.15) break; box = up2; }
      if (box && !clipped(box, W) && box.getBoundingClientRect().bottom > 0) {
        out.pdpPhoto = true;
        if (F('frame')) { var fp = placeFrame(box, -1e4, W, zIn, true); if (fp) { anchor(fp, box); out0.pdpFrameTop = box.getBoundingClientRect().top + sy + 4; } }
        if (F('sash')) placeSash(box, -1e4, W, zIn, true);
      } else for (var k2 in live) if (/^(framep|sash)/.test(k2)) seen[k2] = 1;
    }
    yield;
    if (F('hang') && hr) { /* small tags at the screen's edge; each still checks the spot under it */ if (atTop) placeHang(W, hbDoc - sy, zIn); else for (var k1 in live) if (/^hang/.test(k1)) { seen[k1] = 1; var hr1 = live[k1].el.getBoundingClientRect(); if (hr1.bottom > 0 && hr1.top < V && !areaFree(hr1.left + hr1.width * 0.3, hr1.top + hr1.height * 0.45, hr1.width * 0.4, hr1.height * 0.45, 2, 3)) live[k1].el.style.visibility = 'hidden'; } }
    yield;

    /* the countdown chip, under the header: right on desktop, centred on phones; skipped if the store has its own */
    var ms = left();
    if (F('countdown') && ms > 0 && !atTop && live.chip) seen.chip = 1; // scrolled down: it stays where it was placed
    else if (F('countdown') && ms > 0 && atTop && !storeHasTimer(hbDoc - sy)) {
      var mob = W < 640, cw = LK.chip === 'led' ? (mob ? 232 : 330) : mob ? 220 : 290, cy0 = out.frame ? Math.max(hbDoc + 12, out0.frameTop + 14) : hbDoc + 12, cy = cy0, cx = null, right = false, chipZ = zIn;
      // desktop: right under the header, else just left of a ribbon in the right corner, else centred, else left.
      // [left edge of the chip, does its text hug the right]; only the part with text is checked. Phones: centred under
      // the header, else at the bottom of the banner. Never on a still banner picture (its words may be baked in).
      var spots = mob ? [[(W - cw) / 2, 0]] : [[W - cw - 18, 1], [sashL - cw - 10, 1], [(W - cw) / 2, 0], [18, 0]];
      var rows = [cy0]; if (hero) { var hbx = heroBox(hero, hbDoc - sy), hbot = hero.getBoundingClientRect().bottom; rows.push(hbx.bottom + sy - 30 - (out.frame ? 20 : 12)); rows.push(hbot + sy + 8); if (out.frame) rows.push(out0.frameTop - 14); }
      if (!hero && out0.pdpFrameTop) rows.push(out0.pdpFrameTop - 14); // product page: on the photo frame's top edge
      var edgeRow = (hero && out.frame) || (!hero && out0.pdpFrameTop) ? rows.length - 1 : -1; // then just below the banner; last, set into the frame's top edge
      var spotsEdge = mob ? [[(W - cw) / 2, 0], [W - cw - 14, 1], [14, 0]] : spots;
      for (var ri = 0; ri < rows.length && cx === null; ri++) for (var si = 0; si < (ri === edgeRow ? spotsEdge : spots).length && cx === null; si++) {
        cy = rows[ri]; var sp0 = (ri === edgeRow ? spotsEdge : spots)[si]; var s0 = sp0[0], tx = mob ? s0 + 12 : sp0[1] ? s0 + cw * 0.3 : s0, tw0 = mob ? cw - 24 : cw * 0.7; if (s0 < 8 || s0 + cw > W - 8) continue;
        if (cy - sy < 0 || cy - sy > innerHeight * 1.5) continue;
        var onEdge = ri === edgeRow && ri > 0; // on the frame line: only its lower half touches the picture's top margin
        if (!hit(tx, cy - sy, tw0, 34) && areaFree(tx + 4, cy - sy, tw0 - 8, 30, 4, 2) && (onEdge || (!stillUnder(tx + tw0 * 0.25, cy - sy + 15) && !stillUnder(tx + tw0 * 0.75, cy - sy + 15)))) { cx = s0; right = !!sp0[1]; taken.push([tx, cy - sy, tw0, 34]); chipZ = onEdge ? MAXZ - 10 : zIn; }
      }
      if (cx !== null) {
        var cp = put('chip', false, 'left:' + Math.round(cx) + 'px;top:' + Math.round(cy) + 'px;width:' + cw + 'px;text-align:' + (mob ? 'center' : right ? 'right' : 'left') + ';z-index:' + chipZ, chipHTML(''));
        fillChip(cp, fmt(ms)); out.countdown = fmt(ms);
      }
    }
    yield;

    /* the Sale link */
    if (F('glint') && hr) { var sl = saleLink(hdr, hb + 4); if (sl) { placeGlint(sl, hdrFixed || fixedAncestor(sl)); out.saleLink = (sl.innerText || '').trim(); } }
    yield;

    /* deal tags on product photos: the real percent from the card's own prices */
    var tagged = 0, cards = new Set();
    if (F('tags')) yield* reskinBadges(W, lo, hi, sy, zIn, cards);
    if (F('tags') || F('slash')) {
      var pdpDone = false, pdpPrice = null;
      yield* each(document.querySelectorAll(STRUCK), function (s) {
        if (tagged >= 16) return false;
        if (ours(s) || !struck(s)) return;
        var r = s.getBoundingClientRect(); if (!r.width || r.bottom < lo || r.top > hi || r.height > 60) return;
        var was = num(s.innerText || s.textContent); if (!was || !vis(s)) return;
        var now = nowPrice(s, was); if (!now) return;
        var pct = Math.round((1 - now.v / was) * 100); if (pct < 3 || pct > 95) return;
        var fx = fixedAncestor(s); if (fx && fx !== document.body) return; // a sticky add-to-cart bar: leave it alone
        if (clipped(s, W)) return;
        if (F('slash')) { // a red marker stroke drawn once over the crossed-out price
          var sw = Math.round(r.width + 8), sh = Math.max(14, Math.round(r.height));
          var sp = put('slash' + Math.round(r.left) + '_' + Math.round(r.top + sy), false, 'left:' + Math.round(r.left - 4) + 'px;top:' + Math.round(r.top + sy) + 'px;width:' + sw + 'px;height:' + sh + 'px;z-index:' + zIn,
            '<svg class="bfsl" width="' + sw + '" height="' + sh + '" viewBox="0 0 ' + sw + ' ' + sh + '"><path d="M2 ' + (sh * 0.72) + ' Q' + (sw * 0.5) + ' ' + (sh * 0.38) + ' ' + (sw - 2) + ' ' + (sh * 0.3) + '" fill="none" stroke="#D7261E" stroke-width="2.2" stroke-linecap="round" opacity=".92" stroke-dasharray="' + (sw * 1.3) + '" stroke-dashoffset="' + (sw * 1.3) + '"/></svg>'); anchor(sp, s);
        }
        if (!F('tags')) return;
        var text = '-' + pct + '%';
        // the store already shows this percent on the card (its own "34% off" badge or pill): don't say it twice
        var own = cardPhoto(s, W), near = own ? own.card : s.parentElement && s.parentElement.parentElement && s.parentElement.parentElement.parentElement;
        if (near && new RegExp('(^|[^\\d])' + pct + '\\s?%').test(near.innerText || '')) text = 'Deal';
        if (text === 'Deal' && LK.sticker !== 'pill') { if (own && own.photo) cards.add(own.photo); return; } // its own badge is reskinned instead
        if (LK.sticker === 'pill') { // Quiet: a small "23% off" pill right beside the shopper's price (unless the card says it)
          if (text !== '-' + pct + '%') return;
          var nr = now.el.getBoundingClientRect(), sr = r, pw = 18 + String(pct).length * 7 + 26;
          if (cards.has(now.el)) return; cards.add(now.el);
          // after the last price on the line (the old price may come second), else just under the price line
          var line = Math.abs((sr.top + sr.bottom) / 2 - (nr.top + nr.bottom) / 2) < Math.max(nr.height, 12) * 0.6, rx = line ? Math.max(nr.right, sr.right) : nr.right;
          var px = rx + 8, py = nr.top + nr.height / 2 - 10, lim = (cardPhoto(s, W) || {}).card, cr = lim ? lim.getBoundingClientRect() : { right: W - 4 };
          if (px + pw > Math.min(cr.right, W - 4) || !besideFree(px, py, pw, 20, now.el)) { px = Math.min(nr.left, line ? sr.left : nr.left); py = Math.max(nr.bottom, line ? sr.bottom : 0) + 4; }
          if (px + pw < W - 4 && besideFree(px, py, pw, 20, now.el)) { anchor(put('pill' + Math.round(px) + '_' + Math.round(py + sy), false, 'left:' + Math.round(px) + 'px;top:' + Math.round(py + sy) + 'px;z-index:' + zIn, '<span class="bfp">' + pct + '% off</span>'), now.el); tagged++; }
          return;
        }
        var cp2 = cardPhoto(s, W); if (cp2 && cp2.small) return; // too small for a sticker (and not the product's main photo)
        var ph = cp2 && cp2.photo;
        if (!ph && pt === 'product' && !pdpDone) { ph = mainPhoto(W, V); pdpDone = true; pdpPrice = { s: s, sr: r, now: now }; }
        if (!ph || cards.has(ph) || clipped(ph, W)) return; cards.add(ph);
        var pr = ph.getBoundingClientRect(), S = pr.width > 420 ? 25 : 21, ps = pillSize(S, text), sw2 = ps[0], sh2 = ps[1];
        var spots2 = [[pr.right - sw2 - 8, pr.top + 8], [pr.left + 8, pr.top + 8]], at = null;
        for (var q = 0; q < spots2.length && !at; q++) if (spots2[q][1] > hb - 2 || !hdrFixed) { if (areaFree(spots2[q][0] + 4, spots2[q][1] + 4, sw2 - 8, sh2 - 8, 3, 3, true)) at = spots2[q]; }
        if (!at) return;
        var html = stickerHTML(S, text); if (!html) return;
        anchor(put('tag' + Math.round(at[0]) + '_' + Math.round(at[1] + sy) + text + LK.sticker + S, false, 'left:' + Math.round(at[0]) + 'px;top:' + Math.round(at[1] + sy) + 'px;width:' + sw2 + 'px;height:' + sh2 + 'px;z-index:' + zIn, html), ph);
        tagged++;
      });
      // the merchant's own deal text (a BOGO store) on cards that have a price but nothing crossed out
      if (F('tags') && cfg.tagText && LK.sticker !== 'pill') {
        var tt = String(cfg.tagText).slice(0, 10);
        yield* each(document.querySelectorAll('[class*="price" i]'), function (p) {
          if (tagged >= 16) return false; if (ours(p)) return;
          var r = p.getBoundingClientRect(); if (!r.width || r.bottom < lo || r.top > hi || r.height > 60 || !PRICE_RE.test(p.innerText || '')) return;
          var cp3 = cardPhoto(p, W); if (!cp3 || cp3.small || cards.has(cp3.photo) || clipped(cp3.photo, W)) return; cards.add(cp3.photo);
          var pr3 = cp3.photo.getBoundingClientRect(), S3 = 21, ps3 = pillSize(S3, tt), sw3 = ps3[0], sh3 = ps3[1];
          var at3 = [pr3.right - sw3 - 6, pr3.top + 6]; if (!areaFree(at3[0] + 4, at3[1] + 4, sw3 - 8, sh3 - 8, 3, 3, true)) at3 = [pr3.left + 6, pr3.top + 6];
          if (!areaFree(at3[0] + 4, at3[1] + 4, sw3 - 8, sh3 - 8, 3, 3, true)) return;
          anchor(put('tagm' + Math.round(at3[0]) + '_' + Math.round(at3[1] + sy) + tt + S3, false, 'left:' + Math.round(at3[0]) + 'px;top:' + Math.round(at3[1] + sy) + 'px;width:' + sw3 + 'px;height:' + sh3 + 'px;z-index:' + zIn, stickerHTML(S3, tt)), cp3.photo);
          tagged++;
        });
      }
    }
    out.tags = tagged;
    if (F('price') && pt === 'product' && typeof pdpPrice !== 'undefined' && pdpPrice) placePriceLabel(pdpPrice, W, sy, zIn);
    yield;
    if (F('shine') && pt === 'product') placeShine(lo, hi, sy);
    if (F('titles')) yield* placeTitles(W, V, lo, hi, sy, hbDoc - sy, pt, zIn);
    if (F('cart')) placeCart(W, V); else for (var kc in live) if (/^cartf/.test(kc)) seen[kc] = 0;
    if (F('footer')) placeFooter(W, lo, hi, sy, zIn);
    // frames stay on the first banner and the product photo only (banners further down and card hover were too much)
    if (F('thread')) placeThread(W, V); else dropThread();
    if (F('topstring')) placeTopString(W); else for (var kt in live) if (kt === 'topstr') delete seen[kt];
    // (the line under the header was removed on Jaanya's call; placeHdrLine is kept for reference only)
    yield;
    if (F('drift')) placeDrift(W, V); else dropDrift();

    /* the store's own buttons: a steady glow on at most 6 */
    if (F('cta')) {
      var cands = [], ctaRe = /^(shop now|shop all|shop (the )?(collection|sale|edit|deals?)|shop black friday|add to cart|add to bag|buy now|buy it now|explore( now)?|view all|grab (the )?deal|shop deals)$/i, ctas = 0;
      yield* each(document.querySelectorAll('a,button,input[type=submit]'), function (e) {
        if (ctas >= 40) return false;
        var tc = (e.textContent || e.value || '').replace(/\s+/g, ' ').trim(); if (tc.length > 80 || !/cart|bag|buy|shop|explore|view|deal/i.test(tc)) return;
        var t = (e.innerText || e.value || '').replace(/\s+/g, ' ').replace(/[\s·•|–-]*[$£€₹]\s?[\d.,]+.*$/, '').trim();
        if (!ctaRe.test(t) || ours(e) || !vis(e) || e.closest('header,nav,[class*="menu" i],[class*="drawer" i]')) return;
        var r = e.getBoundingClientRect(); if (r.bottom < lo || r.top > hi || r.height > 90) return;
        ctas++; cands.push([r.width * r.height, e]);
      });
      cands.sort(function (a, b) { return b[0] - a[0]; }).slice(0, 2).forEach(function (c) { ctaPlan.set(c[1], '1'); }); // the main buttons only, not every card
    }
    [].forEach.call(document.querySelectorAll('[data-bf-cta]'), function (e) { if (!ctaPlan.has(e)) e.removeAttribute('data-bf-cta'); });
    ctaPlan.forEach(function (v, e) { if (e.getAttribute('data-bf-cta') !== v) e.setAttribute('data-bf-cta', v); });

    sweep();
    out.ms = Math.round(performance.now() - t0);
    TrooFestive.last = out;
    if (cfg.debug) try { document.documentElement.setAttribute('data-troo-bf-last', JSON.stringify(out)); } catch (e) {}
    return out;
  }

  // Re-rendering re-checks the page, so it stays rare: DOM-triggered re-renders at most every 3 s, scrolling and
  // resizing after a short pause. The countdown chip updates itself once a minute.
  var pending = false, lastRun = 0, renders = 0;
  function schedule(ms) { pending = true; clearTimeout(timers.r); timers.r = setTimeout(function () { (window.requestIdleCallback || setTimeout)(function () { pending = false; lastRun = performance.now(); renders++; render(); }, { timeout: 300 }); }, ms); }
  function onMutations(list) {
    if (pending || document.hidden) return;
    for (var i = 0, n = 0; i < list.length && n < 12; i++) {
      var add = list[i].addedNodes;
      for (var j = 0; j < add.length && n < 12; j++) {
        var e = add[j]; if (e.nodeType !== 1 || ours(e)) continue; n++;
        var r = e.getBoundingClientRect();
        if (r.height >= 40 && r.width >= 100 && r.bottom > -innerHeight * 0.6 && r.top < innerHeight * 2) { schedule(Math.max(600, 3000 - (performance.now() - lastRun))); return; }
      }
    }
  }
  function onScroll(ev) {
    hideHov(); if (sides && !sides.raf) sides.raf = requestAnimationFrame(sideProgress);
    var t = ev && ev.target, inner = t && t.nodeType === 1 && t !== document.documentElement && t !== document.body;
    if (inner && (t.clientHeight < innerHeight * 0.6 || t.scrollHeight <= t.clientHeight + 4)) return;
    if (inner && root && root.style.opacity !== '0') root.style.opacity = '0';
    schedule(180);
  }
  function onResize() { schedule(250); }
  function onRoute() { if (location.href !== lastUrl) { lastUrl = location.href; schedule(700); } }
  function minute() { var p = live.chip; if (!p) return; var ms = left(); if (ms <= 0) { schedule(0); return; } fillChip(p, fmt(ms)); }

  function start(c) {
    cfg = merge(DEFAULTS, c || {}); cfg.assets = merge({}, (c || {}).assets); cfg.features = merge(DEFAULTS.features, (c || {}).features);
    cfg.countdown = merge(DEFAULTS.countdown, (c || {}).countdown);
    if (!LOOKS[cfg.look]) cfg.look = 'tie'; LK = LOOKS[cfg.look];
    if (on) { css(); clearMarks(); dropAll(); dropDrift(); render(); return TrooFestive.last; }
    on = true; lastUrl = location.href;
    style = document.createElement('style'); style.id = 'troo-bf-css'; (document.head || document.documentElement).appendChild(style); css();
    root = document.createElement('div'); root.id = 'troo-bf'; root.setAttribute('aria-hidden', 'true'); root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none';
    fixedLayer = document.createElement('div'); fixedLayer.id = 'troo-bf-fx'; fixedLayer.setAttribute('aria-hidden', 'true'); fixedLayer.style.cssText = 'display:contents;pointer-events:none';
    document.documentElement.appendChild(root); document.documentElement.appendChild(fixedLayer);
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    addEventListener('resize', onResize); addEventListener('popstate', onRoute);
    timers.route = setInterval(onRoute, 800); timers.min = setInterval(minute, 30000); timers.watch = setInterval(function () { if (!document.hidden) watch(); }, 1000);
    if (document.readyState !== 'complete') addEventListener('load', function () { schedule(300); }, { once: true });
    timers.late1 = setTimeout(function () { schedule(0); }, 2500); timers.late2 = setTimeout(function () { schedule(0); }, 6000);
    mo = new MutationObserver(onMutations); mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', onClickLater, { passive: true, capture: true }); // a cart drawer opening changes classes, not the DOM
    return render();
  }
  function onClickLater() { clearTimeout(timers.c1); clearTimeout(timers.c2); timers.c1 = setTimeout(function () { schedule(0); }, 700); timers.c2 = setTimeout(function () { schedule(0); }, 1700); }
  function stop() {
    if (!on) return; on = false;
    clearTimeout(timers.r); clearTimeout(timers.late1); clearTimeout(timers.late2); clearInterval(timers.route); clearInterval(timers.min); clearInterval(timers.watch); mo && mo.disconnect();
    document.removeEventListener('scroll', onScroll, { capture: true }); removeEventListener('resize', onResize); removeEventListener('popstate', onRoute);
    document.removeEventListener('pointerover', onOver, { capture: true }); document.removeEventListener('click', onClickLater, { capture: true }); if (hov) { hov.remove(); hov = null; hovCard = null; }
    dropAll(); dropDrift(); dropThread(); [root, fixedLayer, style].forEach(function (e) { e && e.remove(); }); listenWake(false); clearMarks(); drawers = [];
  }

  var kit = { areaFree: areaFree, MAXZ: MAXZ, RM: RM, bgLight: bgLight, canvasFor: canvasFor, esc: esc, fixedAncestor: fixedAncestor, merge: merge, ours: ours, hexA: hexA, glint: glint, bgi: bgi, accent: function () { return accent(); }, looks: LOOKS };
  window.TrooFestive = { version: '1.0', festival: 'blackfriday', looks: LOOKS, renders: function () { return renders; }, moments: null, start: start, stop: stop, render: function () { return render(); },
    defaults: DEFAULTS, isOn: function () { return on; }, look: function () { return cfg && LOOKS[cfg.look] ? cfg.look : 'tie'; }, cfg: function () { return cfg; }, pageType: pageType, _kit: kit,
    _debug: { contentAt: contentAt, areaFree: areaFree, num: num, fmt: fmt, left: left } };
})();
