/*! TrooFestive · Troopod · Black Friday moments: Add to cart burst, reward, page loader, cursor. Loads after
 * troo-blackfriday-look.js and uses its kit (window.TrooFestive._kit). Each look has its own version of each moment:
 *   Black Tie   gold foil confetti and curled ribbons; a black gift box that opens on a golden ticket; a gold coin loader;
 *               a gold tag cursor with a few glints behind it (desktop)
 *   Cyber Neon  a burst of neon sparks and pixels; an "unlocked" card; a neon ring loader
 *   Red Tag     a paper confetti popper; a scratch card; a red ring loader
 *   Quiet       a small ring of gold glints; a plain reward card; a thin black ring loader
 * TrooFestive.moments.start(config) / .stop(). Never blocks a click, never prevents default. The reward only shows
 * when the merchant has set a real code. Reduced motion: no particles, no spin.
 */
/* global TrooFestive:writable */
(function () {
  'use strict';
  var T = window.TrooFestive; if (!T || T.moments) return;
  var K = T._kit, MAXZ = K.MAXZ, RM = K.RM, bgLight = K.bgLight, canvasFor = K.canvasFor, esc = K.esc, fixedAncestor = K.fixedAncestor, merge = K.merge, ours = K.ours, hexA = K.hexA;

  var MDEF = {
    neonCursor: true,                 // Cyber Neon: a pixel-art neon arrow and a trail of neon pixels (desktop mouse)
    cursor: false, trail: true,       // Black Tie only: the gold tag cursor and glints behind it (desktop mouse)
    burst: true,                      // Add to cart / Buy now
    loader: true,                     // while the next page loads
    reward: false, rewardEvery: false, rewardCode: '', rewardText: '15% off', // rewardEvery: after every add (demos)
    rewardEarly: true,                // also offer it once per visit, 10 s after the shopper starts scrolling, not only after Add to cart
    assets: {}
  };
  var COPY = {
    tie:   { tag: 'A gift for you', eye: 'Black Friday', title: 'Your Black Friday gift', open: 'Open your gift' },
    neon:  { tag: 'A gift for you', eye: 'Cyber Week', title: 'Your Cyber Week gift', open: 'Open your gift' },
    red:   { tag: 'Scratch to win', eye: 'Black Friday', title: 'Scratch to reveal your code', open: 'Open the scratch card' },
    quiet: { tag: 'A thank-you', eye: 'Black Friday', title: 'A little thank-you', open: 'Open your reward' }
  };
  var MC = null, mLd = null, mLdT = 0, mOn = false, mCan = null, mCtx = null, mParts = [], mRaf = 0, mLast = 0, mOff = [], mStyle = null, mLastBurst = 0;
  var FINE = window.matchMedia && matchMedia('(pointer: fine)').matches;
  function look() { return T.look(); }
  function A(k) { return MC.assets[k]; }

  function mon(t, ev, fn, o) { t.addEventListener(ev, fn, o); mOff.push(function () { t.removeEventListener(ev, fn, o); }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mCanvas() {
    if (mCan) return;
    mCan = document.createElement('canvas'); mCan.className = 'troo-bf-x'; mCan.setAttribute('aria-hidden', 'true');
    mCan.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:' + (MAXZ - 1) + ';display:block';
    document.documentElement.appendChild(mCan); mCtx = mCan.getContext('2d'); mSize(); mon(window, 'resize', mSize);
  }
  function mSize() { if (!mCan) return; var d = Math.min(window.devicePixelRatio || 1, 2); mCan.width = innerWidth * d; mCan.height = innerHeight * d; mCtx.setTransform(d, 0, 0, d, 0, 0); }
  function mAdd(p) { if (mParts.length < 420) mParts.push(p); }
  function mKick() { if (!mRaf) { mLast = performance.now(); mRaf = requestAnimationFrame(mLoop); } }
  // runs only while something is in flight, then stops: nothing animates between moments
  function mLoop(now) {
    var dt = Math.min(48, now - mLast) / 16.67; mLast = now;
    mCtx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = mParts.length - 1; i >= 0; i--) {
      var p = mParts[i]; if (p.delay > 0) { p.delay -= dt * 16.67; continue; }
      p.age += dt * 16.67; if (p.age >= p.life) { mParts.splice(i, 1); continue; }
      p.px = p.x; p.py = p.y; p.vy += p.g * dt; p.vx *= Math.pow(p.drag || 0.985, dt); p.vy *= Math.pow(p.drag || 0.985, dt); p.x += p.vx * dt; p.y += p.vy * dt;
      var ft = p.age / p.life, a = 1 - ft; a = a * a * (3 - 2 * a);
      if (p.bloom) { var ba = ft < 0.25 ? ft / 0.25 : 1 - (ft - 0.25) / 0.75, br = p.r * (0.55 + 0.6 * Math.min(1, ft * 2.5));
        var gr = mCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, br); gr.addColorStop(0, p.bc[0]); gr.addColorStop(0.35, p.bc[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
        mCtx.globalAlpha = Math.max(0, ba) * (p.alpha || 1); mCtx.fillStyle = gr; mCtx.beginPath(); mCtx.arc(p.x, p.y, br, 0, 6.283); mCtx.fill(); continue; }
      if (p.spr || p.conf) { // foil and paper: tumble (the flip is a squash), fade over the last quarter
        p.rot += p.vr * dt;
        mCtx.save(); mCtx.globalAlpha = ft > 0.72 ? 1 - (ft - 0.72) / 0.28 : Math.min(1, ft * 8); mCtx.translate(p.x, p.y); mCtx.rotate(p.rot);
        mCtx.scale(1, p.flip ? Math.cos(p.age / 110 + p.ph) : 1);
        if (p.spr) mCtx.drawImage(p.spr, -p.w / 2, -p.w / 2, p.w, p.w);
        else { mCtx.fillStyle = p.c; mCtx.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6); }
        mCtx.restore(); continue;
      }
      if (p.glint) { var gs = p.r * (0.6 + 0.6 * Math.sin(Math.min(1, ft * 1.4) * Math.PI)); mCtx.globalAlpha = a; mCtx.drawImage(p.glint, p.x - gs, p.y - gs, gs * 2, gs * 2); continue; }
      if (p.pixel) { mCtx.globalAlpha = a * (Math.random() < 0.2 ? 0.3 : 1); mCtx.fillStyle = p.c; mCtx.shadowColor = p.c; mCtx.shadowBlur = 6; mCtx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); mCtx.shadowBlur = 0; continue; }
      a *= p.alpha || 1;
      if (p.streak) { mCtx.globalAlpha = a; mCtx.strokeStyle = p.c; mCtx.lineWidth = p.r; mCtx.lineCap = 'round'; mCtx.beginPath(); mCtx.moveTo(p.px, p.py); mCtx.lineTo(p.x, p.y); mCtx.stroke(); }
      mCtx.globalAlpha = a * 0.25; mCtx.fillStyle = p.c; mCtx.beginPath(); mCtx.arc(p.x, p.y, p.r * 1.9, 0, 6.283); mCtx.fill();
      mCtx.globalAlpha = a; mCtx.fillStyle = p.core || p.c; mCtx.beginPath(); mCtx.arc(p.x, p.y, p.r * 0.9, 0, 6.283); mCtx.fill();
    }
    mCtx.globalAlpha = 1;
    if (mParts.length) mRaf = requestAnimationFrame(mLoop); else { mRaf = 0; mCtx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* the rendered confetti sheet, cut into one canvas per piece (the last four pieces are curled ribbons) */
  var cut = {};
  function pieces(k) {
    if (cut[k]) return cut[k];
    var u = A(k); if (!u) return null;
    var im = new Image(); im.src = u; cut[k] = { ready: false, flat: [], curl: [] };
    im.onload = function () {
      var n = Math.round(im.naturalWidth / im.naturalHeight), s = im.naturalHeight;
      for (var i = 0; i < n; i++) { var c = document.createElement('canvas'); c.width = c.height = s; c.getContext('2d').drawImage(im, i * s, 0, s, s, 0, 0, s, s); (i >= n - 4 ? cut[k].curl : cut[k].flat).push(c); }
      cut[k].ready = true;
    };
    return cut[k];
  }

  /* ---------------------------------------------------------------- Add to cart, per look */
  function foilBurst(x, y) { // Black Tie: foil pieces and curled ribbons thrown up from the button, a warm gold bloom
    var P = pieces('confettiGold'), i, an, sp;
    mAdd({ x: x, y: y, vx: 0, vy: 0, g: 0, drag: 1, r: 80, life: 750, age: 0, bloom: true, alpha: 0.55, bc: ['rgba(255,236,190,.95)', 'rgba(222,176,84,.45)'] });
    if (P && P.ready) {
      for (i = 0; i < 34; i++) { an = rnd(-2.7, -0.45); sp = rnd(5, 10.5); mAdd({ x: x, y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0.22, drag: 0.972, spr: P.flat[i % P.flat.length], flip: true, ph: rnd(0, 6), w: rnd(13, 22), rot: rnd(0, 6.283), vr: rnd(-0.14, 0.14), life: rnd(1400, 2000), age: 0 }); }
      for (i = 0; i < 6; i++) { an = rnd(-2.3, -0.85); sp = rnd(5, 8); mAdd({ x: x, y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0.2, drag: 0.975, spr: P.curl[i % P.curl.length], w: rnd(26, 36), rot: rnd(-0.6, 0.6), vr: rnd(-0.05, 0.05), life: rnd(1500, 2000), age: 0 }); }
    } else for (i = 0; i < 40; i++) { an = rnd(-2.7, -0.45); sp = rnd(5, 10); mAdd({ x: x, y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0.2, drag: 0.97, conf: true, flip: true, ph: rnd(0, 6), c: ['#E2B85A', '#F6DFA0', '#14110C', '#B8892E'][i % 4], w: rnd(6, 10), rot: rnd(0, 6.283), vr: rnd(-0.2, 0.2), life: rnd(1300, 1800), age: 0 }); }
    var g = K.glint('#E8C063'); for (i = 0; i < 8; i++) mAdd({ x: x + rnd(-90, 90), y: y - rnd(20, 120), vx: 0, vy: rnd(-0.3, 0), g: 0, drag: 1, glint: g, r: rnd(7, 13), life: rnd(500, 800), age: 0, delay: rnd(150, 550) });
  }
  function popper(x, y) { // Red Tag: a paper popper, a tight cone of red, white and black confetti
    var P = pieces('confettiRed'), i, an, sp, dk = bgLight(x, y - 40) === false;
    for (i = 0; i < 46; i++) {
      an = rnd(-2.05, -1.1); sp = rnd(8, 14);
      var o = { x: x, y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0.3, drag: 0.955, flip: true, ph: rnd(0, 6), rot: rnd(0, 6.283), vr: rnd(-0.22, 0.22), life: rnd(1300, 1900), age: 0 };
      if (P && P.ready) { o.spr = (i % 7 === 0 ? P.curl : P.flat)[i % (i % 7 === 0 ? P.curl.length : P.flat.length)]; o.w = i % 7 === 0 ? rnd(24, 32) : rnd(12, 19); }
      else { o.conf = true; o.c = ['#D7261E', dk ? '#FFFFFF' : '#EDEDED', '#111111'][i % 3]; o.w = rnd(6, 10); }
      mAdd(o);
    }
  }
  function neonBurst(x, y) { // Cyber Neon: sparks and pixels in the accent, with white-hot cores
    var c = K.accent(), i, an, sp;
    for (i = 0; i < 36; i++) { an = rnd(-2.9, -0.25); sp = rnd(3.5, 9); mAdd({ x: x + rnd(-8, 8), y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0.1, drag: 0.965, r: rnd(1.3, 2.2), c: c, core: '#FFFFFF', life: rnd(800, 1300), age: 0, streak: true, delay: rnd(0, 90) }); }
    for (i = 0; i < 22; i++) { an = rnd(-2.9, -0.25); sp = rnd(2, 6); mAdd({ x: x, y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0.06, drag: 0.97, pixel: true, r: rnd(1.6, 2.8), c: i % 4 ? c : '#FFFFFF', life: rnd(900, 1400), age: 0 }); }
    mAdd({ x: x, y: y, vx: 0, vy: 0, g: 0, drag: 1, r: 70, life: 600, age: 0, bloom: true, alpha: 0.6, bc: [hexA(c, 0.8), hexA(c, 0.25)] });
  }
  function glintRing(x, y) { // Quiet: eight gold glints that open out and fade
    var g = K.glint('#E8C063');
    for (var i = 0; i < 8; i++) { var an = i / 8 * 6.283 + rnd(-0.2, 0.2), sp = rnd(1.6, 2.6); mAdd({ x: x, y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 0.4, g: 0, drag: 0.94, glint: g, r: rnd(7, 11), life: rnd(600, 850), age: 0 }); }
  }
  function celebrate(x, y) {
    if (RM) return;
    var now = Date.now(); if (now - mLastBurst < 600) return; mLastBurst = now;
    mCanvas(); var L = look();
    if (L === 'neon') neonBurst(x, y); else if (L === 'red') popper(x, y); else if (L === 'quiet') glintRing(x, y); else foilBurst(x, y);
    mKick();
    try { navigator.vibrate && navigator.vibrate(16); } catch (e) {}
  }

  /* is this click on Add to cart / Buy now? (text, Shopify forms, common classes; from the Diwali engine) */
  var BUY_RE = /^(add to (cart|bag|basket)|buy (it )?now|add|buy|order now|grab (the )?deal)$/i;
  function buyButton(t) {
    var b = t && t.closest && t.closest('button,input[type=submit],[role=button],a');
    if (!b || ours(b)) return null;
    var txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    var form = b.closest('form'), act = form && form.getAttribute('action') || '';
    if (/\/cart\/add/.test(act) || b.name === 'add' || /add to (cart|bag|basket)|buy (it )?now/i.test(txt) || b.matches('[data-add-to-cart],.product-form__submit,[class*="add-to-cart" i],[class*="addtocart" i],[class*="buy-now" i],[id*="add-to-cart" i]')) return b;
    return BUY_RE.test(txt) && /add|buy|deal/i.test(txt) ? b : null;
  }
  // checkout apps (GoKwik, Shopflo) catch 'click' first: a tap is read from pointer events at the window
  function mClicks() {
    var down = null, last = 0;
    function fire(b) {
      var now = Date.now(); if (now - last < 900) return; last = now;
      if (MC.burst) { var r = b.getBoundingClientRect(); celebrate(r.left + r.width / 2, r.top + Math.min(r.height / 2, 24)); }
      if (MC.reward && MC.rewardCode) maybeReward();
    }
    mon(window, 'pointerdown', function (e) { var b = e.button ? null : buyButton(e.target); down = b ? { b: b, t: Date.now(), x: e.clientX, y: e.clientY } : null; }, true);
    mon(window, 'pointerup', function (e) { var d = down; down = null; if (d && Date.now() - d.t < 800 && Math.abs(e.clientX - d.x) < 12 && Math.abs(e.clientY - d.y) < 12 && buyButton(e.target) === d.b) fire(d.b); }, true);
    mon(window, 'click', function (e) { var b = buyButton(e.target); if (b) fire(b); }, true);
  }

  /* ---------------------------------------------------------------- cursor (Black Tie, desktop mouse) */
  // Cyber Neon: a pixel-art arrow in the neon colour with a one-pixel dark edge (reads on white and on dark pages)
  var ARROW = ['X', 'XX', 'XoX', 'XooX', 'XoooX', 'XooooX', 'XoooooX', 'XooooooX', 'XoooooooX', 'XooooooooX', 'XoooooXXXXX', 'XooXooX', 'XoX XooX', 'XX  XooX', 'X    XooX', '     XooX', '      XX'];
  function pixelCursor(px) {
    var c = document.createElement('canvas'); c.width = 12 * px; c.height = 18 * px; var x = c.getContext('2d'), col = K.accent();
    ARROW.forEach(function (row, y) { for (var i = 0; i < row.length; i++) { var ch = row[i]; if (ch === ' ') continue; x.fillStyle = ch === 'X' ? '#0A0A0C' : col; x.fillRect(i * px, y * px, px, px); } });
    x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(px, 2 * px, px, px); // a glint on the tip
    return c.toDataURL('image/png');
  }
  function neonCursor() {
    var a = pixelCursor(2), b = pixelCursor(4);
    function c(fb) { return 'cursor:url("' + a + '") 1 1,' + fb + ';cursor:-webkit-image-set(url("' + a + '") 1x,url("' + b + '") 2x) 1 1,' + fb; }
    mStyle = document.createElement('style'); mStyle.id = 'troo-bf-cursor';
    mStyle.textContent = 'html,body,body *{' + c('auto') + '}a,a *,button,button *,[role=button],[role=button] *,label,summary,select{' + c('pointer') + '}input,textarea,[contenteditable="true"]{cursor:text}';
    (document.head || document.documentElement).appendChild(mStyle);
  }
  function neonTrail() { // small square pixels that drop off the pointer and fade, flickering a little
    if (RM) return; var lx = null, ly = null, acc = 0, col = K.accent();
    mon(document, 'pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (lx !== null) acc += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
      if (acc < 14) return; acc = 0; mCanvas();
      mAdd({ x: lx + 3 + rnd(-2, 2), y: ly + 4 + rnd(-2, 2), vx: rnd(-0.25, 0.25), vy: rnd(0.15, 0.6), g: 0.01, drag: 0.98, pixel: true, r: rnd(1.4, 2.4), c: Math.random() < 0.25 ? '#FFFFFF' : col, life: rnd(420, 700), age: 0 });
      mKick();
    }, { passive: true });
  }
  function mCursor() {
    if (look() === 'neon') { if (FINE && MC.neonCursor) { neonCursor(); neonTrail(); } return; }
    var u = A('cursorTag'); if (!FINE || !u || look() !== 'tie') return;
    mStyle = document.createElement('style'); mStyle.id = 'troo-bf-cursor';
    var c = function (fb) { return 'cursor:url("' + u + '") 4 3,' + fb; };
    mStyle.textContent = 'html,body,body *{' + c('auto') + '}a,a *,button,button *,[role=button],[role=button] *,label,summary,select{' + c('pointer') + '}input,textarea,[contenteditable="true"]{cursor:text}';
    (document.head || document.documentElement).appendChild(mStyle);
  }
  function mTrail() {
    if (!FINE || RM || look() !== 'tie') return;
    var lx = null, ly = null, acc = 0, g = K.glint('#E8C063');
    mon(document, 'pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (lx !== null) acc += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
      if (acc < 26) return; acc = 0; mCanvas();
      mAdd({ x: lx + rnd(-4, 4) + 8, y: ly + rnd(-2, 6) + 10, vx: rnd(-0.2, 0.2), vy: rnd(0.1, 0.5), g: 0, drag: 0.99, glint: g, r: rnd(4, 7), life: rnd(450, 700), age: 0 });
      mKick();
    }, { passive: true });
  }
  function mTaps() { // phones: a few small glints where the shopper taps (Black Tie)
    if (RM || look() !== 'tie') return;
    var g = K.glint('#E8C063');
    mon(document, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse') return; mCanvas();
      for (var i = 0; i < 5; i++) { var an = rnd(0, 6.283), sp = rnd(0.8, 1.8); mAdd({ x: e.clientX, y: e.clientY, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0, drag: 0.94, glint: g, r: rnd(5, 8), life: rnd(380, 520), age: 0 }); }
      mKick();
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- the reward (needs a real code from the merchant)
     Once per visit after the first add ('pending' until opened or closed, so a store that jumps to the cart page
     still shows it there). Small, in a corner, opened by the shopper: never a pop-up over the page. */
  function rwState(v) { try { if (v) sessionStorage.setItem('troo-bf-reward', v); return sessionStorage.getItem('troo-bf-reward'); } catch (e) { return null; } }
  function overlayOpen() {
    var e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); if (!e || ours(e) || e === document.body || e === document.documentElement) return false;
    var f = fixedAncestor(e); if (!f) return false; var r = f.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * 0.45;
  }
  function maybeReward() {
    var st = rwState(); if ((st === 'done' && !MC.rewardEvery) || document.querySelector('.bfm-reward')) return;
    rwState('pending');
    var tries = 0;
    (function wait() { setTimeout(function () { if (!mOn) return; if (overlayOpen() && ++tries < 4) wait(); else showReward(); }, tries ? 1500 : 1300); })();
  }
  function rewardCSS() {
    if (document.getElementById('troo-bf-mcss')) return;
    var c = K.accent(), s = document.createElement('style'); s.id = 'troo-bf-mcss';
    s.textContent = '.bfm-reward,.bfm-reward *{box-sizing:border-box}.bfm-reward{position:fixed;right:14px;bottom:96px;z-index:' + MAXZ + ';display:flex;flex-direction:column;align-items:flex-end;gap:8px;transform:translateY(14px);opacity:0;transition:transform .35s cubic-bezier(0.23,1,0.32,1),opacity .22s ease;font:14px/1.4 "Avenir Next","Helvetica Neue",system-ui,sans-serif}' +
      '.bfm-left{right:auto;left:14px;align-items:flex-start}.bfm-left .bfm-card{transform-origin:bottom left}.bfm-in{transform:none;opacity:1}' +
      '.bfm-btn{border:0;background:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}.bfm-btn .art{display:block;background-size:100% 100%;filter:drop-shadow(0 10px 14px rgba(0,0,0,.35))}' +
      '.bfm-in .bfm-btn .art{animation:bfm-wb 1.1s ease-in-out .5s 2;transform-origin:50% 80%}@keyframes bfm-wb{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}' +
      '.bfm-tag{font:700 10.5px/1 "Avenir Next","Helvetica Neue",system-ui,sans-serif;letter-spacing:.06em;border-radius:20px;padding:5px 10px;white-space:nowrap}.bfm-open .bfm-tag{opacity:0}' +
      '.bfm-card{position:relative;overflow:hidden;width:280px;border-radius:18px;padding:20px 20px 16px;text-align:left;order:-1;box-shadow:0 24px 50px -16px rgba(0,0,0,.6);transform:translateY(10px) scale(.97);opacity:0;transform-origin:bottom right;transition:transform .32s cubic-bezier(0.23,1,0.32,1),opacity .2s ease}.bfm-c-in{transform:none;opacity:1}' +
      '.bfm-eye{font:700 10px/1 "Avenir Next","Helvetica Neue",system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase}.bfm-k{font:600 15px/1.25 "Avenir Next","Helvetica Neue",system-ui,sans-serif;margin-top:8px}' +
      '.bfm-amt{font:700 44px/1 Didot,"Bodoni 72","Playfair Display",Georgia,serif;letter-spacing:-.01em;margin:10px 0 16px}' +
      '.bfm-code{position:relative;display:flex;align-items:stretch;border-radius:12px;overflow:hidden}.bfm-val{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:8px 12px}' +
      '.bfm-val small{font:700 9px/1 system-ui,sans-serif;letter-spacing:.22em}.bfm-val b{font:700 15px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.06em;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.bfm-copy{flex:none;border:0;margin:0;padding:0 14px;cursor:pointer;font:800 12px/1 system-ui,sans-serif;letter-spacing:.08em}.bfm-note{font:400 11px/1.3 system-ui,sans-serif;margin-top:10px;opacity:.7}' +
      '.bfm-x{position:absolute;top:10px;right:10px;z-index:2;width:22px;height:22px;border:0;border-radius:50%;background:rgba(0,0,0,.35);font:15px/22px system-ui,sans-serif;color:#FFF;padding:0;cursor:pointer}' +
      '.bfm-scratch{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;border-radius:12px;transition:opacity .4s ease}.bfm-reveal{border:0;background:none;padding:0;margin-top:8px;font:600 11px/1 system-ui,sans-serif;text-decoration:underline;cursor:pointer;color:inherit;opacity:.75}' +
      // Black Tie: black card, fine gold edge, gold type
      '.bfm-tie .bfm-tag{color:#E8C877;background:#0B0B0D;border:1px solid rgba(233,196,106,.55)}.bfm-tie .bfm-card{background:radial-gradient(120% 80% at 100% 0,#2A2214 0,#0E0D0C 55%,#080807 100%);border:1px solid rgba(233,196,106,.4);color:#F3ECDD}' +
      '.bfm-tie .bfm-eye{color:#CFAE62}.bfm-tie .bfm-amt{background:linear-gradient(180deg,#FFF1C2,#E2B85A 55%,#B8892E);-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '.bfm-tie .bfm-code{border:1px solid rgba(233,196,106,.5);background:rgba(255,255,255,.03)}.bfm-tie .bfm-val small{color:#CFAE62}.bfm-tie .bfm-val b{color:#FFF}.bfm-tie .bfm-copy{background:linear-gradient(180deg,#F4D88E,#C99B3F);color:#1A1205}' +
      // Cyber Neon: black card, neon edge and type
      '.bfm-neon .bfm-tag{color:' + c + ';background:#0A0A0C;border:1px solid ' + hexA(c, 0.6) + ';box-shadow:0 0 12px ' + hexA(c, 0.35) + '}.bfm-neon .bfm-card{background:#0A0A0C;border:1.5px solid ' + c + ';box-shadow:0 0 22px ' + hexA(c, 0.35) + ',0 24px 50px -16px rgba(0,0,0,.6);color:#F2F2F2}' +
      '.bfm-neon .bfm-eye{color:' + c + '}.bfm-neon .bfm-amt{font-family:"Avenir Next","Helvetica Neue",system-ui,sans-serif;font-weight:800;color:' + c + ';text-shadow:0 0 18px ' + hexA(c, 0.6) + '}' +
      '.bfm-neon .bfm-code{border:1.5px dashed ' + hexA(c, 0.6) + '}.bfm-neon .bfm-val small{color:' + c + '}.bfm-neon .bfm-val b{color:#fff}.bfm-neon .bfm-copy{background:' + c + ';color:#0A0A0C}' +
      '.bfm-neon .bfm-btn .art{display:block;filter:none}' +
      // Red Tag: white card, red band, scratch foil over the code
      '.bfm-red .bfm-tag{color:#fff;background:#D7261E}.bfm-red .bfm-card{background:#FFF;color:#141414;border-top:8px solid #D7261E}.bfm-red .bfm-eye{color:#D7261E}.bfm-red .bfm-amt{font-family:Futura,"Avenir Next Condensed","Arial Black",sans-serif;font-weight:800;color:#D7261E}' +
      '.bfm-red .bfm-code{border:1.5px solid #141414}.bfm-red .bfm-val small{color:#D7261E}.bfm-red .bfm-val b{color:#141414}.bfm-red .bfm-copy{background:#141414;color:#fff}' +
      // Quiet: plain black and white
      '.bfm-quiet .bfm-tag{color:#fff;background:#111}.bfm-quiet .bfm-card{background:#fff;color:#111;border:1px solid #E6E6E6}.bfm-quiet .bfm-eye{color:#8A8A8A}.bfm-quiet .bfm-code{border:1px solid #DDD}.bfm-quiet .bfm-val small{color:#8A8A8A}.bfm-quiet .bfm-copy{background:#111;color:#fff}' +
      '.bfm-quiet .bfm-btn .art{width:12px;height:12px;border-radius:50%;background:#E2B85A;box-shadow:0 0 0 4px rgba(226,184,90,.25)}' +
      (RM ? '.bfm-reward,.bfm-card,.bfm-scratch{transition:none}.bfm-btn .art{animation:none!important}' : '');
    (document.head || document.documentElement).appendChild(s);
  }
  function artHTML(L, open) {
    if (L === 'tie') { var u = A(open ? 'giftOpen' : 'giftClosed'); return u ? '<span class="art" style="width:' + (open ? 52 : 70) + 'px;height:64px;background-image:url(\'' + u + '\');background-size:contain;background-repeat:no-repeat;background-position:center bottom"></span>' : ''; }
    if (L === 'red') { var r = A('tagRedPct'); return r ? '<span class="art" style="width:34px;height:92px;background-image:url(\'' + r + '\');transform-origin:50% 0"></span>' : ''; }
    if (L === 'neon') { // a gift box drawn in neon tube: box, lid, ribbon and a bow; the lid lifts when opened
      var c = K.accent(), lid = open ? 'transform="translate(-4 -9) rotate(-14 32 22)"' : '';
      return '<span class="art"><svg width="62" height="62" viewBox="0 0 64 64" style="overflow:visible;filter:drop-shadow(0 0 4px ' + c + ') drop-shadow(0 0 10px ' + hexA(c, 0.55) + ')" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' +
        '<rect x="12" y="30" width="40" height="27" rx="2.5" fill="#0A0A0C"/><path d="M32 30V57"/>' +
        '<g ' + lid + '><rect x="9" y="22" width="46" height="9" rx="2" fill="#0A0A0C"/><path d="M32 22V31"/>' +
        '<path d="M32 22C27 13 18 13 19 18 20 22 27 22 32 22ZM32 22C37 13 46 13 45 18 44 22 37 22 32 22Z" fill="#0A0A0C"/></g>' +
        '<g stroke="#FFFFFF" stroke-width=".8" opacity=".75"><rect x="12" y="30" width="40" height="27" rx="2.5"/><rect x="9" y="22" width="46" height="9" rx="2" ' + lid + '/></g></svg></span>';
    }
    return '<span class="art"></span>';
  }
  function showReward() {
    if (!mOn || !MC.rewardCode) return;
    rewardCSS();
    var L = look(), C = COPY[L] || COPY.tie;
    // the first bottom corner where it covers no text, button, chat bubble or other fixed widget
    var SPOTS = [['right', 96], ['right', 18], ['left', 96], ['left', 18]], spot = null;
    function fixedAt(x, y) { return document.elementsFromPoint(x, y).some(function (e) { return e !== document.documentElement && e !== document.body && !ours(e) && fixedAncestor(e); }); }
    SPOTS.some(function (sp) {
      var l = sp[0] === 'right' ? innerWidth - 14 - 130 : 14, t = innerHeight - sp[1] - 92;
      if (fixedAt(l + 30, t + 40) || fixedAt(l + 100, t + 70) || fixedAt(l + 65, t + 10) || !K.areaFree(l, t, 130, 92, 6, 4)) return false;
      spot = sp; return true;
    });
    // every corner is taken (a country or cookie pop-up, text): try again in 2 s, for up to half a minute
    if (!spot) { showReward.tries = (showReward.tries || 0) + 1; if (showReward.tries < 15) { setTimeout(showReward, 2000); return; } spot = SPOTS[0]; }
    showReward.tries = 0;
    var el = document.createElement('div'); el.className = 'bfm-reward bfm-' + L + (spot[0] === 'left' ? ' bfm-left' : ''); el.style.bottom = spot[1] + 'px';
    el.innerHTML = '<button type="button" class="bfm-btn" aria-label="' + esc(C.open) + '">' + artHTML(L, false) + '<span class="bfm-tag">' + esc(C.tag) + '</span></button>';
    document.documentElement.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('bfm-in'); });
    // a cart drawer, pop-up or sticky bar that opens later under the closed gift: it steps out of the way until that closes
    // (it must never sit on a price, a total or a checkout button)
    var guard = setInterval(function () {
      if (!el.isConnected) { clearInterval(guard); return; }
      if (el.classList.contains('bfm-open')) return;
      var r = el.getBoundingClientRect(), under = false;
      [[0.5, 0.35], [0.5, 0.85], [0.15, 0.6], [0.85, 0.6]].some(function (f) {
        return (under = document.elementsFromPoint(r.left + r.width * f[0], r.top + r.height * f[1]).some(function (e) {
          if (ours(e) || e === document.documentElement || e === document.body) return false;
          var fa = fixedAncestor(e); if (!fa) return false; var fr = fa.getBoundingClientRect(); return fr.width * fr.height > innerWidth * innerHeight * 0.12 || /cart|drawer|modal|dialog|popup|checkout/i.test((fa.id || '') + ' ' + (fa.className && fa.className.baseVal === undefined ? fa.className : ''));
        }));
      });
      el.style.opacity = under ? '0' : ''; el.style.pointerEvents = under ? 'none' : ''; el.style.visibility = under ? 'hidden' : '';
    }, 600);
    mOff.push(function () { clearInterval(guard); });
    var btn = el.querySelector('.bfm-btn');
    btn.onclick = function () {
      if (el.classList.contains('bfm-open')) return; el.classList.add('bfm-open'); rwState('done');
      var art = btn.querySelector('.art'); if ((L === 'tie' || L === 'neon') && art) art.outerHTML = artHTML(L, true);
      var r = btn.getBoundingClientRect(); mLastBurst = 0; celebrate(r.left + r.width / 2, r.top + 20);
      var card = document.createElement('div'); card.className = 'bfm-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', C.title);
      card.innerHTML = '<button type="button" class="bfm-x" aria-label="Close">&times;</button><div class="bfm-eye">' + esc(C.eye) + '</div><div class="bfm-k">' + esc(C.title) + '</div><div class="bfm-amt">' + esc(MC.rewardText) + '</div>' +
        '<div class="bfm-code"><span class="bfm-val"><small>CODE</small><b>' + esc(MC.rewardCode) + '</b></span><button type="button" class="bfm-copy">COPY</button></div><div class="bfm-note" aria-live="polite">Apply at checkout</div>';
      el.appendChild(card); requestAnimationFrame(function () { card.classList.add('bfm-c-in'); });
      var copy = card.querySelector('.bfm-copy'), note = card.querySelector('.bfm-note');
      copy.onclick = function () {
        var done = function () { copy.textContent = 'COPIED'; note.textContent = 'Code copied. Apply it at checkout'; };
        var pick = function () { var rg = document.createRange(); rg.selectNodeContents(card.querySelector('.bfm-val b')); var s = getSelection(); s.removeAllRanges(); s.addRange(rg); note.textContent = 'Code selected. Copy it and apply at checkout'; };
        try { navigator.clipboard.writeText(MC.rewardCode).then(done, pick); } catch (e) { pick(); }
      };
      if (L === 'red') scratch(card);
      function close() { rwState('done'); document.removeEventListener('keydown', onKey); el.classList.remove('bfm-in'); setTimeout(function () { el.remove(); }, 260); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onKey);
      card.querySelector('.bfm-x').onclick = close;
      setTimeout(function () { try { (L === 'red' ? card.querySelector('.bfm-reveal') : copy).focus({ preventScroll: true }); } catch (e) {} }, 60);
    };
  }
  // Red Tag: rendered silver foil over the code; scratch it off (or press Reveal: keyboard and screen readers)
  function scratch(card) {
    var box = card.querySelector('.bfm-code'), u = A('scratchFoil'); if (!box) return;
    var w = box.offsetWidth, h = box.offsetHeight, v = canvasFor(w, h, 2), x = v.x, gone = false;
    v.c.className = 'bfm-scratch'; v.c.setAttribute('aria-hidden', 'true'); box.appendChild(v.c);
    var rv = document.createElement('button'); rv.type = 'button'; rv.className = 'bfm-reveal'; rv.textContent = 'Reveal the code'; box.parentNode.insertBefore(rv, box.nextSibling);
    function cover(im) {
      if (im) x.drawImage(im, 0, 0, w, h); else { x.fillStyle = '#C9C9CC'; x.fillRect(0, 0, w, h); }
      x.fillStyle = 'rgba(60,60,64,.75)'; x.font = '700 11px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SCRATCH HERE', w / 2, h / 2);
    }
    if (u) { var im = new Image(); im.onload = function () { cover(im); }; im.src = u; cover(null); } else cover(null);
    function reveal() { if (gone) return; gone = true; v.c.style.opacity = '0'; setTimeout(function () { v.c.remove(); rv.remove(); }, 420); }
    rv.onclick = reveal;
    var down = false, moves = 0;
    function at(e) { var r = v.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    v.c.addEventListener('pointerdown', function (e) { down = true; try { v.c.setPointerCapture(e.pointerId); } catch (er) {} rub(e); });
    v.c.addEventListener('pointermove', function (e) { if (down) rub(e); });
    v.c.addEventListener('pointerup', function () { down = false; });
    function rub(e) {
      var p = at(e); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(p[0], p[1], 15, 0, 6.2832); x.fill(); x.globalCompositeOperation = 'source-over';
      if (++moves % 8) return; // every few strokes: how much is cleared?
      var d = x.getImageData(0, 0, v.c.width, v.c.height).data, clear = 0, n = 0;
      for (var i = 3; i < d.length; i += 4 * 37) { n++; if (d[i] < 40) clear++; }
      if (clear / n > 0.45) reveal();
    }
  }

  /* ---------------------------------------------------------------- page loader (keep in sync with loader-early.js) */
  function loaderHTML() {
    var L = look(), c = K.accent();
    if (L === 'tie' && A('coin')) return '<span class="bfl-coin" style="background-image:url(\'' + A('coin') + '\')"></span>';
    var ring = L === 'neon' ? c : L === 'red' ? '#D7261E' : '#111', base = L === 'neon' ? hexA(c, 0.18) : L === 'red' ? '#F6D4D2' : '#E6E6E6';
    return '<svg viewBox="-20 -20 40 40" width="30" height="30" style="display:block;overflow:visible' + (L === 'neon' ? ';filter:drop-shadow(0 0 4px ' + c + ')' : '') + '"><circle r="15" fill="none" stroke="' + base + '" stroke-width="2.6"/><g class="bfl-w"><circle r="15" fill="none" stroke="' + ring + '" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="24 71"/></g>' +
      (L === 'red' ? '<text y="4.5" text-anchor="middle" font-family="Futura,Arial Black,sans-serif" font-weight="800" font-size="13" fill="#D7261E">%</text>' : '') + '</svg>';
  }
  function showLoader(ms) {
    if (mLd || !mOn) return;
    var hb = (T.last && T.last.header) || 0, top = Math.round(Math.max(14, Math.min(innerHeight * 0.3, hb - scrollY + 14)));
    mLd = document.createElement('div'); mLd.className = 'bfm-loader bfm-l-' + look(); mLd.setAttribute('role', 'status'); mLd.setAttribute('aria-label', 'Loading');
    mLd.style.top = top + 'px'; mLd.innerHTML = loaderHTML(); document.documentElement.appendChild(mLd);
    clearTimeout(mLdT); mLdT = setTimeout(hideLoader, ms || 8000);
  }
  function hideLoader() { clearTimeout(mLdT); if (!mLd) return; var e = mLd; mLd = null; e.classList.add('out'); setTimeout(function () { e.remove(); }, 260); }
  function mLoader() {
    var st = document.createElement('style'); st.className = 'bfm-loader-css';
    st.textContent = '.bfm-loader{position:fixed;left:50%;z-index:' + MAXZ + ';width:44px;height:44px;margin-left:-22px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;' +
      'box-shadow:0 6px 18px rgba(20,16,10,.18),0 1px 3px rgba(20,16,10,.14);animation:bfli .32s cubic-bezier(.2,.9,.3,1.25) both}.bfm-l-neon{background:#0A0A0C}' +
      '.bfm-loader.out{animation:bflo .24s ease-in both}.bfm-loader .bfl-w{animation:bflr .9s linear infinite;transform-origin:0 0}' +
      '.bfl-coin{display:block;width:30px;height:30px;background-size:100% 100%;animation:bflc 1.1s linear infinite}@keyframes bflc{0%{transform:scaleX(1)}25%{transform:scaleX(.08)}50%{transform:scaleX(-1)}75%{transform:scaleX(.08)}100%{transform:scaleX(1)}}' +
      '@keyframes bfli{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}@keyframes bflo{to{opacity:0;transform:scale(.5)}}@keyframes bflr{to{transform:rotate(360deg)}}' +
      (RM ? '.bfm-loader,.bfm-loader *{animation:none!important}' : '');
    document.documentElement.appendChild(st); mOff.push(function () { st.remove(); hideLoader(); });
    function soon() { if (!mLd) { clearTimeout(mLdT); mLdT = setTimeout(showLoader, 120); } }
    mon(window, 'beforeunload', function () { showLoader(6000); });
    mon(window, 'click', function (e) {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
      if (u.origin !== location.origin || !/^https?:$/.test(u.protocol) || (u.pathname === location.pathname && u.search === location.search)) return;
      if (!e.defaultPrevented) { soon(); return; }
      var from = location.href, t0 = Date.now();
      (function wait() { if (location.href !== from) { showLoader(); settle(); return; } if (Date.now() - t0 < 900) setTimeout(wait, 40); })();
    });
    function settle() {
      var shown = Date.now(), quiet = Date.now(), mo2 = new MutationObserver(function () { quiet = Date.now(); });
      if (document.body) mo2.observe(document.body, { childList: true, subtree: true });
      (function check() { var now = Date.now(); if (!mLd || now - shown > 4000 || (now - shown > 600 && now - quiet > 350)) { mo2.disconnect(); hideLoader(); return; } setTimeout(check, 100); })();
    }
    mon(window, 'submit', function (e) { var f = e.target; if (e.defaultPrevented || !f || (f.target && f.target !== '_self')) return; soon(); });
    mon(window, 'pageshow', function (e) { if (e.persisted) hideLoader(); });
    mon(window, 'keydown', function (e) { if (e.key === 'Escape') hideLoader(); });
  }

  function momentsStart(c) {
    momentsStop();
    MC = merge(MDEF, c || {}); MC.assets = merge({}, (c || {}).assets); mOn = true;
    if (look() === 'tie') pieces('confettiGold'); if (look() === 'red') pieces('confettiRed'); // cut the sheets ahead of the first add
    if (MC.cursor || (look() === 'neon' && MC.neonCursor)) mCursor();
    if (MC.trail) mTrail();
    if ((MC.cursor || MC.trail) && !FINE) mTaps();
    if (MC.burst || (MC.reward && MC.rewardCode)) mClicks();
    if (MC.loader) mLoader();
    if (MC.reward && MC.rewardCode && rwState() === 'pending') setTimeout(showReward, 1200);
    else if (MC.reward && MC.rewardCode && MC.rewardEarly && (rwState() !== 'done' || MC.rewardEvery)) { // the gift waits in the corner, shopper opens it
      var early = function () { if (!mOn || document.querySelector('.bfm-reward') || (rwState() === 'done' && !MC.rewardEvery)) return; maybeReward(); };
      // 30 s after the shopper starts scrolling (someone browsing, not someone who just landed)
      // shown right away (a second and a half after the page settles), once per visit
      var tEarly = setTimeout(early, 1500); mOff.push(function () { clearTimeout(tEarly); });
    }
    return { cursor: !!mStyle, fine: FINE };
  }
  function momentsStop() {
    mOn = false; mOff.forEach(function (f) { f(); }); mOff = [];
    cancelAnimationFrame(mRaf); mRaf = 0; mParts = []; cut = {};
    [mCan, mStyle, document.querySelector('.bfm-reward'), document.getElementById('troo-bf-mcss')].forEach(function (e) { e && e.remove(); }); mCan = mCtx = mStyle = null;
  }
  T.moments = { start: momentsStart, stop: momentsStop, isOn: function () { return mOn; },
    burstAt: function (x, y) { if (MC) { mLastBurst = 0; celebrate(x, y); } },
    previewLoader: function () { if (!MC) return; showLoader(); setTimeout(hideLoader, 3000); },
    previewReward: function () { if (!MC) return; if (!MC.rewardCode) MC.rewardCode = 'BLACKFRIDAY15'; rwState('pending'); var o = document.querySelector('.bfm-reward'); o && o.remove(); showReward(); } };
})();
