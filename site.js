/* Renov8ers LLC acquisitions pages (offer, sign, deals): talk to the acquisitions engine (engine-config.js), with a timeout and the next
   address as a fallback. Exposes window.RE = {call, money, esc, pad, q}. */
(function () {
  'use strict';
  function call(action, payload) {
    var urls = (window.R8_ENGINE_URLS || []).filter(Boolean);
    var body = JSON.stringify(Object.assign({ action: action }, payload || {}));
    return new Promise(function (resolve, reject) {
      (function next(i) {
        if (i >= urls.length) return reject(new Error('offline'));
        var ctrl = new AbortController();
        var to = setTimeout(function () { ctrl.abort(); }, 15000);
        fetch(urls[i].replace(/\/$/, '') + '/api/renov8ers', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, signal: ctrl.signal })
          .then(function (r) { clearTimeout(to); return r.json(); })
          .then(resolve)
          .catch(function () { clearTimeout(to); next(i + 1); });
      })(0);
    });
  }
  function money(n) { n = Number(n) || 0; return '$' + Math.round(n).toLocaleString('en-US'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function q(k) { return new URLSearchParams(location.search).get(k) || ''; }
  function countUp(el, to) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = money(to); return; }
    var t0 = performance.now(), d = 900;
    (function f(t) { var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3); el.textContent = money(to * e); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  function pad(canvas) {
    var g = canvas.getContext('2d'), drawing = false, inked = false;
    function size() { var r = canvas.getBoundingClientRect(); canvas.width = r.width * 2; canvas.height = r.height * 2;
      g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#16181d'; }
    size(); addEventListener('resize', function () { if (!inked) size(); });
    function pt(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * 2, (e.clientY - r.top) * 2]; }
    canvas.addEventListener('pointerdown', function (e) { drawing = true; canvas.setPointerCapture(e.pointerId); g.beginPath(); var p = pt(e); g.moveTo(p[0], p[1]); });
    canvas.addEventListener('pointermove', function (e) { if (!drawing) return; var p = pt(e); g.lineTo(p[0], p[1]); g.stroke(); inked = true; });
    addEventListener('pointerup', function () { drawing = false; });
    return {
      clear: function () { g.clearRect(0, 0, canvas.width, canvas.height); inked = false; },
      empty: function () { return !inked; },
      png: function () {   // dark ink on a transparent background for the printed agreement
        var c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
        var x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
        var im = x.getImageData(0, 0, c.width, c.height), d = im.data;
        for (var i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { d[i] = 17; d[i + 1] = 17; d[i + 2] = 17; } }
        x.putImageData(im, 0, 0); return c.toDataURL('image/png');
      }
    };
  }
  /* Printed-letter codes kept on the site itself (offer-codes.js, built by tools/offer_letters.py): each offer is encrypted with
     its own code, so the page still shows it when the engine can't be reached. Resolves to the offer, or null. */
  function local(code) {
    var c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length === 6) c = 'R8' + c;
    var S = window.crypto && crypto.subtle, T = new TextEncoder();
    if (!S || !window.R8_CODES || c.length !== 8) return Promise.resolve(null);
    return S.importKey('raw', T.encode(c), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return S.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: T.encode('renov8ers-offers'), iterations: 120000 }, k, 384); })
      .then(function (bits) {
        var b = new Uint8Array(bits), id = Array.prototype.map.call(b.slice(0, 16), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        var blob = window.R8_CODES[id]; if (!blob) return null;
        var raw = Uint8Array.from(atob(blob), function (ch) { return ch.charCodeAt(0); });
        return S.importKey('raw', b.slice(16, 48), 'AES-GCM', false, ['decrypt'])
          .then(function (ak) { return S.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, ak, raw.slice(12)); })
          .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
      }).catch(function () { return null; });
  }
  window.RE = { call: call, money: money, esc: esc, q: q, pad: pad, countUp: countUp, local: local };
})();
