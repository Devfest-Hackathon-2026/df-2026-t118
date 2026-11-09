// three.js island diorama — window.Island.mount(el, opts) / window.Island.snapshot(opts, w, h)
// opts: { style:'clay'|'diorama', character:'poko'|'tomori'|'fumi', phase:'day'|'morning'|'night',
//         cards:[{kind,title,color,unknown}], bundle:bool, building:0..1|null, empty:bool,
//         anim:null|'birth'|'addCard'|'settle'|'build', charAt:'default'|'build'|'bundle',
//         zoom, focus:'character', onCardTap(i), onCharTap() }
(function () {
  const C = { terra: 0xe05a47, teal: 0x427c89, mustard: 0xf5b738, lime: 0x98d447, lilac: 0xad8be3, cream: 0xfbf6ec, ink: 0x2b2622, grass: 0x7ab567, grass2: 0x93c77c, sand: 0xeee2c8, clay: 0xd8cbb3, wood: 0xc79a5c };
  const PH = {
    day: { hemi: [0xfff4e6, 0x9b8d7c, 0.9], key: [0xffe9cf, 1.55, [6, 10, 5]], fill: [0x9fd3e6, 0.35], win: 0.22, sea: 0x86c3cf, exp: 1.05 },
    morning: { hemi: [0xffe8d6, 0xa08070, 0.85], key: [0xffc58f, 1.7, [8, 5.5, 3]], fill: [0xa8c8ff, 0.3], win: 0.3, sea: 0x95c4cc, exp: 1.05 },
    night: { hemi: [0x5b6fa8, 0x1a1d2a, 0.6], key: [0xa9b8ff, 0.5, [-5, 9, 3]], fill: [0x7a6cff, 0.18], win: 1.7, sea: 0x31506e, exp: 1.12 }
  };
  const FONT = '"Zen Maru Gothic","Hiragino Maru Gothic ProN",sans-serif';
  const cache = {}; let CLAY = false, PUFFY = false;
  // --- plasticine look: seeded noise, bump + mottle textures, lumpy / rounded geometry ---
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function h3(x, y, z) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function noise3(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf); const L = (a, b, t) => a + (b - a) * t; const c = (i, j, k) => h3(xi + i, yi + j, zi + k); return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w); }
  function fbm(x, y, z) { return noise3(x, y, z) * 0.65 + noise3(x * 2.3 + 7, y * 2.3, z * 2.3) * 0.35; }
  let CT = null;
  function clayTex() {
    if (CT) return CT; const R = rng(11);
    const paint = (base, amt, fine) => tex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 320; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 70, lt = R() > 0.5; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, lt ? 'rgba(255,255,255,' + amt + ')' : 'rgba(0,0,0,' + amt + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, a0 = R() * 6.28; for (let k = 0; k < 7; k++) { g.strokeStyle = 'rgba(0,0,0,' + amt * 0.9 + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 4 + k * 3.2, a0, a0 + 1.6 + R()); g.stroke(); } }
      for (let i = 0; i < 160; i++) { const x = R() * w, y = R() * h, l = 6 + R() * 26, a = R() * 6.28; g.strokeStyle = R() > 0.5 ? 'rgba(255,255,255,' + amt + ')' : 'rgba(0,0,0,' + amt + ')'; g.lineWidth = 0.8 + R() * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.6 + 4, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      const d = g.getImageData(0, 0, w, h), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (R() - 0.5) * fine; p[i] += n; p[i + 1] += n; p[i + 2] += n; } g.putImageData(d, 0, 0);
    });
    const bump = paint('#808080', 0.14, 8); bump.encoding = THREE.LinearEncoding;
    const mott = paint('#f4f4f4', 0.05, 4);
    [bump, mott].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5); });
    return (CT = { bump, mott });
  }
  function m(c, o) {
    const k = c + '|' + (o ? JSON.stringify(o) : '') + (CLAY ? '|c' : ''); if (PUFFY && cache[k + '|p']) return cache[k + '|p']; if (!PUFFY && cache[k]) return cache[k];
    const base = { color: c, roughness: 0.8, metalness: 0 };
    if (PUFFY) return (cache[k + '|p'] = cache[k + '|p'] || new THREE.MeshPhysicalMaterial(Object.assign(base, { roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.5 }, o || {})));
    if (CLAY) { const t = clayTex(); Object.assign(base, { roughness: 0.74, bumpMap: t.bump, bumpScale: 0.016, map: t.mott }); }
    return (cache[k] = new THREE.MeshStandardMaterial(Object.assign(base, o || {})));
  }
  function M(g, mt, x, y, z, cs) { const o = new THREE.Mesh(g, mt); o.position.set(x || 0, y || 0, z || 0); o.castShadow = cs !== false; o.receiveShadow = true; return o; }
  let SEED = 0;
  function lump(geo, amp, freq, dirFn, recompute) {
    const p = geo.attributes.position, v = new THREE.Vector3(), d = new THREE.Vector3(), sd = (SEED++ % 50) * 3.1;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); dirFn(v, d, i); if (d.lengthSq() < 1e-9) continue; const n = (fbm(v.x * freq + sd, v.y * freq, v.z * freq) - 0.5) * 2 * amp; v.addScaledVector(d, n); p.setXYZ(i, v.x, v.y, v.z); }
    p.needsUpdate = true; if (recompute) geo.computeVertexNormals(); return geo;
  }
  function roundBox(w, h, d, r) {
    r = Math.min(r, Math.min(w, h, d) / 2 - 0.001); const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6), p = g.attributes.position, nr = g.attributes.normal, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); q.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z))); v.sub(q); const l = v.length(); if (l > 1e-6) { v.divideScalar(l); nr.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, q.x + v.x * r, q.y + v.y * r, q.z + v.z * r); } }
    return CLAY ? lump(g, Math.min(w, h, d) * 0.035, 3.2, (v, dd, i) => dd.fromBufferAttribute(nr, i), false) : g;
  }
  function puffCyl(a, b, h, seg) {
    const r = Math.max(0.005, Math.min(h * 0.45, Math.min(a, b) * 0.45)); const pts = [new THREE.Vector2(0, -h / 2)];
    for (let i = 0; i <= 8; i++) { const t = -Math.PI / 2 + (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(b - r + Math.cos(t) * r, -h / 2 + r + Math.sin(t) * r)); }
    for (let i = 0; i <= 8; i++) { const t = (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(a - r + Math.cos(t) * r, h / 2 - r + Math.sin(t) * r)); }
    pts.push(new THREE.Vector2(0, h / 2)); return new THREE.LatheGeometry(pts, Math.max(seg || 24, 40));
  }
  const B = (w, h, d) => PUFFY ? roundBox(w, h, d, Math.min(w, h, d) * 0.42) : (CLAY ? roundBox(w, h, d, Math.min(w, h, d) * 0.24) : new THREE.BoxGeometry(w, h, d));
  const Cy = (a, b, h, s) => PUFFY ? puffCyl(Math.max(a, 0.004), Math.max(b, 0.004), h, s) : (CLAY ? lump(new THREE.CylinderGeometry(a, b, h, Math.max(s || 24, 28), 3), Math.max(a, b) * 0.035, 1.6 / Math.max(0.15, Math.max(a, b)), (v, d) => d.set(v.x, 0, v.z).normalize(), false) : new THREE.CylinderGeometry(a, b, h, s || 24));
  const S = (r, a, b) => PUFFY ? new THREE.SphereGeometry(r, 36, 26) : (CLAY ? lump(new THREE.SphereGeometry(r, Math.max(a || 20, 24), Math.max(b || 16, 18)), r * 0.07, 2.2 / r, (v, d) => d.copy(v).normalize(), true) : new THREE.SphereGeometry(r, a || 20, b || 16));
  const clamp = (k) => Math.max(0, Math.min(1, k));
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const easeBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  function tex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, maxW, maxLines) { const lines = []; let cur = ''; for (const ch of text) { if (g.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; if (lines.length === maxLines) break; } else cur += ch; } if (lines.length < maxLines && cur) lines.push(cur); if (lines.length === maxLines && lines.join('').length < text.length) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; return lines; }

  function cardTex(card) {
    return tex(320, 400, (g, w, h) => {
      g.fillStyle = '#ffffff'; rr(g, 0, 0, w, h, 34); g.fill();
      if (card.unknown) {
        g.fillStyle = '#f3ede9'; rr(g, 16, 16, w - 32, h - 32, 24); g.fill();
        g.fillStyle = '#c94a38'; g.font = '900 170px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('？', w / 2, h / 2 - 20);
        g.fillStyle = '#58413d'; g.font = '700 28px ' + FONT; g.fillText('どうしたい？', w / 2, h - 62); return;
      }
      g.save(); rr(g, 16, 16, w - 32, 250, 24); g.clip(); g.fillStyle = card.color || '#e05a47'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 12; for (let i = -h; i < w + h; i += 30) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 300, 300); g.stroke(); } g.restore();
      g.font = '700 20px "Space Grotesk",sans-serif'; const kw = g.measureText(card.kind || '').width;
      g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, 32, 32, kw + 28, 38, 19); g.fill(); g.fillStyle = '#1d1b19'; g.textBaseline = 'middle'; g.fillText(card.kind || '', 46, 52);
      g.font = '700 27px ' + FONT; g.textBaseline = 'alphabetic'; wrap(g, card.title || '', w - 60, 2).forEach((l, i) => g.fillText(l, 30, 310 + i * 38));
    });
  }
  const backTex = () => tex(64, 80, (g, w, h) => { g.fillStyle = '#ffffff'; rr(g, 0, 0, w, h, 7); g.fill(); });
  function signTex(text, bg, fg) { return tex(64, 64 * text.length + 24, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg || '#fff'; g.font = '900 46px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; [...text].forEach((ch, i) => g.fillText(ch, w / 2, 12 + 32 + i * 64)); }); }
  function stripeTex(a, b) { return tex(128, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, h); } }); }

  function tree(x, y, z, c, s) { const t = new THREE.Group(); t.add(M(Cy(0.05, 0.08, 0.36, 8), m(0x6b4a33), 0, 0.18, 0)); const f = m(c, { roughness: 0.9 }); t.add(M(S(0.28, 14, 12), f, 0, 0.5, 0)); t.add(M(S(0.2, 12, 10), f, 0.14, 0.42, 0.1)); t.add(M(S(0.17, 12, 10), f, -0.12, 0.64, -0.05)); t.position.set(x, y, z); t.scale.setScalar(s || 1); return t; }

  // ---------- characters ----------
  function charPoko() {
    const g = new THREE.Group(); const body = M(S(0.26, 28, 22), m(C.mustard, { roughness: 0.55 }), 0, 0.28, 0); body.scale.set(1, 1.12, 0.96); g.add(body);
    [-0.08, 0.08].forEach((x) => { g.add(M(S(0.03, 12, 10), m(C.ink, { roughness: 0.25 }), x, 0.33, 0.235, false)); const gl = new THREE.Mesh(S(0.009, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); gl.position.set(x + 0.009, 0.343, 0.262); g.add(gl); });
    [-0.14, 0.14].forEach((x) => { const ch = new THREE.Mesh(S(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: C.terra, transparent: true, opacity: 0.5 })); ch.position.set(x, 0.25, 0.2); ch.scale.set(1, 0.55, 0.6); g.add(ch); });
    g.add(M(Cy(0.012, 0.014, 0.1, 6), m(C.lime), 0, 0.6, 0)); const l1 = M(S(0.05, 10, 8), m(C.lime), 0.045, 0.655, 0); l1.scale.set(1.5, 0.3, 0.8); l1.rotation.z = 0.5; g.add(l1); const l2 = M(S(0.04, 10, 8), m(C.lime), -0.04, 0.645, 0); l2.scale.set(1.4, 0.3, 0.8); l2.rotation.z = -0.5; g.add(l2);
    return { g, idle(t) { g.children[0].scale.y = 1.12 + Math.sin(t * 2.4) * 0.04; g.position.y = g.userData.baseY + Math.abs(Math.sin(t * 2.4)) * 0.025; } };
  }
  function charTomori(night) {
    const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf6e6c8, emissive: 0xffa94d, emissiveIntensity: night ? 0.95 : 0.3, roughness: 0.75 });
    const body = M(S(0.24, 30, 22), mat, 0, 0.44, 0); body.scale.set(1, 1.18, 1); inner.add(body);
    for (let i = -3; i <= 3; i++) { const y = i * 0.075; const r = 0.24 * Math.sqrt(Math.max(0, 1 - Math.pow(y / 0.283, 2))) + 0.002; const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 6, 44), m(0xd2ad78)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.44 + y; inner.add(ring); }
    inner.add(M(Cy(0.1, 0.12, 0.06, 20), m(C.ink, { roughness: 0.4 }), 0, 0.73, 0)); inner.add(M(Cy(0.12, 0.1, 0.06, 20), m(C.ink, { roughness: 0.4 }), 0, 0.15, 0));
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 6, 20, Math.PI), m(C.ink)); h.position.y = 0.76; inner.add(h);
    inner.add(M(Cy(0.014, 0.014, 0.1, 6), m(C.terra), 0, 0.07, 0, false)); inner.add(M(S(0.03, 10, 8), m(C.terra), 0, 0.01, 0, false));
    [-0.075, 0.075].forEach((x) => inner.add(M(S(0.026, 12, 10), m(C.ink, { roughness: 0.25 }), x, 0.47, 0.232, false)));
    [-0.12, 0.12].forEach((x) => { const ch = new THREE.Mesh(S(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: C.terra, transparent: true, opacity: 0.55 })); ch.position.set(x, 0.41, 0.21); ch.scale.set(1, 0.55, 0.5); inner.add(ch); });
    if (night) { const pl = new THREE.PointLight(0xffb066, 1.4, 3.2, 2); pl.position.y = 0.44; inner.add(pl); }
    return { g, idle(t) { inner.position.y = 0.1 + Math.sin(t * 1.6) * 0.04; inner.rotation.z = Math.sin(t * 1.1) * 0.06; } };
  }
  function charFumi() {
    const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner); const red = m(0xd9483b, { roughness: 0.5 });
    inner.add(M(Cy(0.2, 0.2, 0.4, 30), red, 0, 0.32, 0)); inner.add(M(new THREE.SphereGeometry(0.2, 30, 14, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, 0.52, 0));
    inner.add(M(Cy(0.215, 0.215, 0.04, 30), m(0xb73a2f, { roughness: 0.5 }), 0, 0.5, 0));
    inner.add(M(B(0.17, 0.028, 0.03), m(C.ink), 0, 0.44, 0.19, false));
    const env = M(B(0.13, 0.085, 0.012), m(C.cream), 0, 0.475, 0.2, false); env.rotation.z = 0.12; inner.add(env);
    inner.add(M(B(0.22, 0.12, 0.012), m(C.cream), 0, 0.3, 0.198, false));
    [-0.05, 0.05].forEach((x) => inner.add(M(S(0.02, 10, 8), m(C.ink, { roughness: 0.25 }), x, 0.31, 0.206, false)));
    [-0.08, 0.08].forEach((x) => { inner.add(M(Cy(0.028, 0.028, 0.09, 8), m(C.ink), x, 0.07, 0)); const f = M(S(0.04, 10, 8), m(C.ink), x, 0.025, 0.02); f.scale.set(1, 0.5, 1.4); inner.add(f); });
    return { g, idle(t) { inner.rotation.z = Math.sin(t * 2.2) * 0.05; inner.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02; } };
  }
  function makeChar(kind, night) { return kind === 'tomori' ? charTomori(night) : kind === 'fumi' ? charFumi() : charPoko(); }

  // ---------- islands ----------
  const K = { pink: 0xf1a1b4, lime: 0xc6df5a, green: 0x4fb45e, green2: 0x93cf62, blue: 0x4f6ad9, sky: 0x7dbde8, orange: 0xf3a243, red: 0xe2553f, cream: 0xf4ecdc, brown: 0xa8714a, ink: 0x3a2e2a, yellow: 0xf6d25a };
  function coil(r, tube, c, y, x, z) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 96), m(c)); t.rotation.x = Math.PI / 2; t.position.set(x || 0, y, z || 0); t.castShadow = true; t.receiveShadow = true; return t; }
  function clayTree(x, y, z, c, s, tall) { const t = new THREE.Group(); t.add(M(Cy(0.055, 0.075, 0.34, 10), m(K.brown), 0, 0.17, 0)); if (tall) { [0.42, 0.66, 0.86].forEach((yy, i) => t.add(M(S(0.24 - i * 0.05, 18, 14), m(c), 0, yy, 0))); } else { t.add(M(S(0.3, 20, 16), m(c), 0, 0.52, 0)); t.add(M(S(0.19, 16, 12), m(c), 0.17, 0.42, 0.1)); } t.position.set(x, y, z); t.scale.setScalar(s || 1); return t; }
  function stripeMat(a, b, n) { const t = tex(256, 64, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * w) / n, 0, w / n + 1, h); } }); const ct = clayTex(); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.74, bumpMap: ct.bump, bumpScale: 0.016 }); }
  function clayIsland(G, o, P) {
    const top = 0.3; const seaC = o.phase === 'night' ? 0x2c4170 : o.phase === 'morning' ? 0x93c3e6 : K.sky;
    const R0 = o.empty ? 2.3 : 4.35;
    G.add(M(Cy(R0, R0 + 0.08, 0.36, 72), m(seaC, { roughness: 0.6 }), 0, -0.62, 0, false)); G.add(coil(R0 + 0.04, 0.1, o.phase === 'night' ? 0x22315a : K.blue, -0.45));
    const wv = o.empty ? [[1.95, 0.4], [1.9, 2.6], [2.0, 4.4]] : [[3.75, 0.3], [3.9, 1.5], [3.7, 2.7], [3.85, 3.9], [3.8, 5.1]];
    wv.forEach(([r, a]) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 24, 2.2), m(0xffffff)); w.position.set(Math.cos(a) * r, -0.43, Math.sin(a) * r); w.rotation.set(Math.PI / 2, 0, a + 0.4); w.castShadow = true; G.add(w); });
    if (o.empty) {
      G.add(M(Cy(1.55, 1.75, 0.42, 40), m(K.cream), 0, -0.33, 0)); G.add(M(Cy(1.25, 1.4, 0.46, 36), m(K.lime), 0, 0.07, 0)); G.add(coil(1.26, 0.085, K.green, top));
      G.add(clayTree(-0.6, top, -0.45, K.green, 0.9)); [[0.6, -0.5, K.pink], [0.85, -0.1, K.yellow], [-0.8, 0.45, K.pink]].forEach(([x, z, c]) => G.add(M(S(0.06, 12, 10), m(c), x, top + 0.04, z)));
      return { top, bundle: [0.55, top, 0.4], build: [0.5, top, -0.35], extraBuilds: [[-0.45, top, 0.35], [0.1, top, -0.65], [0.75, top, 0.15]], char: [0.05, top, 0.35] };
    }
    G.add(M(Cy(3.2, 3.45, 0.42, 56), m(K.cream), 0, -0.33, 0));
    G.add(M(Cy(2.85, 3.0, 0.46, 56), m(K.lime), 0, 0.07, 0)); G.add(coil(2.86, 0.1, K.green, top));
    G.add(M(Cy(1.45, 1.62, 0.5, 40), m(K.green2), -0.75, 0.53, -0.55)); G.add(coil(1.46, 0.08, K.green, 0.78, -0.75, -0.55));
    const h = new THREE.Group(); h.position.set(-0.8, 0.78, -0.55);
    h.add(M(B(1.0, 0.8, 0.9), m(K.pink), 0, 0.4, 0)); const roof = M(new THREE.ConeGeometry(0.88, 0.6, 4, 3), m(K.red), 0, 1.1, 0); roof.rotation.y = Math.PI / 4; h.add(roof);
    h.add(M(Cy(0.075, 0.085, 0.34, 14), m(K.orange), 0.3, 1.17, -0.18));
    const wn = M(Cy(0.13, 0.13, 0.05, 24), o._win, -0.22, 0.47, 0.46, false); wn.rotation.x = Math.PI / 2; h.add(wn); const fr = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 10, 32), m(K.blue)); fr.position.set(-0.22, 0.47, 0.475); h.add(fr);
    h.add(M(B(0.24, 0.42, 0.08), m(K.blue), 0.22, 0.21, 0.46)); h.add(M(S(0.025, 10, 8), m(K.yellow), 0.3, 0.22, 0.51, false)); G.add(h);
    const sh = new THREE.Group(); sh.position.set(-1.95, top, 0.55); sh.add(M(Cy(0.14, 0.2, 0.6, 16), m(K.cream), 0, 0.3, 0)); sh.add(M(new THREE.SphereGeometry(0.42, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), m(K.red), 0, 0.55, 0)); [[0.2, 0.86, 0.2], [-0.22, 0.86, 0.15], [0.02, 0.95, -0.2], [0.3, 0.72, -0.15]].forEach(([x, y, z]) => sh.add(M(S(0.06, 12, 10), m(K.cream), x, y, z, false))); G.add(sh);
    const um = new THREE.Group(); um.position.set(2.45, -0.12, 1.6); um.add(M(Cy(0.025, 0.025, 0.95, 8), m(K.cream), 0, 0.47, 0)); const cn = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.32, 20, 1, true), stripeMat('#4fb45e', '#4f6ad9', 12)); cn.position.y = 0.95; cn.castShadow = true; um.add(cn); um.add(M(S(0.05, 12, 10), m(K.orange), 0, 1.13, 0)); um.rotation.z = -0.12; G.add(um);
    const tw = M(roundBox(0.62, 0.035, 0.36, 0.015), stripeMat('#f1a1b4', '#f4ecdc', 8), 1.85, -0.1, 2.15); tw.rotation.y = 0.5; G.add(tw);
    G.add(clayTree(-2.0, top, -0.7, K.green, 1)); G.add(clayTree(0.4, top, -1.9, K.green2, 0.95, true)); G.add(clayTree(2.2, top, 0.55, K.green, 0.85)); G.add(clayTree(-1.25, top, 1.75, K.lime, 0.8, true));
    [[1.7, 1.6], [1.35, 1.35], [1.0, 1.15], [0.6, 0.9], [0.2, 0.6], [-0.15, 0.3]].forEach(([x, z], i) => { const p = M(S(0.11, 14, 10), m(i % 2 ? K.cream : 0xe9dcc6), x, top, z); p.scale.set(1, 0.28, 1); G.add(p); });
    [[1.9, -0.9, K.pink], [2.1, -0.6, K.yellow], [-0.2, -1.6, K.pink], [-2.3, 0.1, K.yellow], [0.9, 2.2, K.pink], [-0.6, 2.3, K.yellow], [2.5, -0.2, K.pink]].forEach(([x, z, c]) => G.add(M(S(0.055, 12, 10), m(c), x, top + 0.04, z)));
    // #42: 建物の左手前 (build から -0.75, +0.55) は一段高い丘の内側に入り、平地の高さ top では体が埋まる。
    // 丘・建物（1〜4棟）・束・木を避けた平地を、建物が建ったあとの立ち位置にする
    return { top, bundle: [0.75, top, 1.55], build: [1.3, top, -0.6], extraBuilds: [[-1.4, top, 1.25], [0.35, top, -1.35], [1.85, top, 0.65]], char: [-0.35, top, 1.2], charBuild: [1.0, top, 0.35] };
  }

  function speckleMat(base, dot, glossy) { const t = tex(512, 512, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const R = rng(5); for (let i = 0; i < 520; i++) { g.fillStyle = dot; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 5, 0, 7); g.fill(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.34, clearcoat: glossy ? 0.9 : 0.5, clearcoatRoughness: 0.2 }); }
  function glossStripe(a, b, n, rx, ry) { const t = tex(256, 256, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * w) / n, 0, w / n + 1, h); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.18 }); }
  function noodle(pts, r, mat, closed) { const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), !!closed, 'catmullrom', 0.5); const g = new THREE.TubeGeometry(c, closed ? 160 : 90, r, 20, !!closed); const ms = new THREE.Mesh(g, mat); ms.castShadow = ms.receiveShadow = true; if (!closed) { [0, 1].forEach((t) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat); e.position.copy(c.getPoint(t)); e.castShadow = true; ms.add(e); }); } return ms; }
  const PU = { pink: 0xf7a6d6, pink2: 0xf9c6e4, lime: 0xa9e24c, yellow: 0xf6c13c, blue: 0x2f5fd8, sky: 0x9cc9f0, cream: 0xf6f1e6, orange: 0xf39a3a };
  function puffyIsland(G, o, P) {
    const top = 0.3, night = o.phase === 'night'; const R0 = o.empty ? 2.3 : 4.3;
    G.add(M(puffCyl(R0, R0, 0.42, 64), m(night ? 0x2a3f72 : PU.sky, { roughness: 0.18, clearcoat: 1 }), 0, -0.62, 0, false));
    const ring = []; for (let i = 0; i < 48; i++) { const t = (i / 48) * Math.PI * 2, rr2 = R0 - 0.38 + Math.sin(t * 9) * 0.08; ring.push([Math.cos(t) * rr2, -0.4 + Math.sin(t * 5) * 0.02, Math.sin(t) * rr2]); } G.add(noodle(ring, 0.06, m(0xffffff, { roughness: 0.2 }), true));
    const grass = m(0x9fdc3c, { roughness: 0.42 });
    if (o.empty) {
      G.add(M(puffCyl(1.55, 1.7, 0.5, 48), grass, 0, -0.06, 0)); G.add(clayTree(-0.6, 0.19, -0.45, PU.lime, 0.9));
      [[0.65, -0.5, PU.pink], [0.85, -0.1, PU.yellow], [-0.8, 0.45, PU.pink]].forEach(([x, z, c]) => G.add(M(S(0.08), m(c), x, 0.24, z)));
      return { top: 0.19, bundle: [0.55, 0.19, 0.4], build: [0.5, 0.19, -0.35], extraBuilds: [[-0.45, 0.19, 0.35], [0.1, 0.19, -0.65], [0.75, 0.19, 0.15]], char: [0.05, 0.19, 0.35] };
    }
    G.add(M(puffCyl(3.15, 3.3, 0.62, 64), grass, 0, -0.01, 0));
    G.add(M(puffCyl(1.45, 1.55, 0.6, 48), m(PU.pink, { roughness: 0.28 }), -0.75, 0.5, -0.55));
    const h = new THREE.Group(); h.position.set(-0.8, 0.8, -0.55);
    h.add(M(roundBox(0.95, 0.78, 0.85, 0.2), glossStripe('#ffffff', '#6f9be8', 10, 1, 1), 0, 0.39, 0));
    const dome = M(new THREE.SphereGeometry(0.62, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), m(PU.yellow), 0, 0.74, 0); dome.scale.y = 0.75; h.add(dome);
    h.add(M(S(0.1), m(PU.pink), 0, 1.24, 0));
    h.add(M(roundBox(0.24, 0.4, 0.1, 0.06), m(PU.blue), 0.2, 0.22, 0.43)); const wn = M(puffCyl(0.11, 0.11, 0.06, 24), o._win, -0.22, 0.46, 0.44, false); wn.rotation.x = Math.PI / 2; h.add(wn); G.add(h);
    G.add(noodle([[1.5, top - 0.02, 0.6], [1.85, 0.9, 0.75], [2.15, 0.55, 1.15], [1.75, 0.35, 1.35], [1.65, 0.95, 1.6], [2.0, 1.15, 1.75]], 0.13, m(PU.pink, { roughness: 0.22 })));
    const bear = new THREE.Group(); bear.position.set(-2.0, top, 0.6); const bm = glossStripe('#ffffff', '#7fa6e6', 14, 2, 1);
    bear.add(M(S(0.3), bm, 0, 0.35, 0)); bear.add(M(S(0.2), bm, 0, 0.78, 0)); [[-0.14, 0.95], [0.14, 0.95]].forEach(([x, y]) => bear.add(M(S(0.08), bm, x, y, 0))); [[-0.3, 0.45], [0.3, 0.45]].forEach(([x, y]) => bear.add(M(S(0.1), bm, x, y, 0.05))); G.add(bear);
    G.add(clayTree(-2.0, top, -0.8, PU.lime, 1)); G.add(clayTree(0.4, top, -1.9, PU.lime, 0.95, true)); G.add(clayTree(2.2, top, -0.2, PU.lime, 0.8));
    [[0.2, -1.2, PU.yellow], [-1.3, 1.6, PU.yellow], [0.9, 2.1, PU.orange], [2.3, -0.9, PU.pink2], [-0.4, 2.2, PU.pink2]].forEach(([x, z, c]) => { const f = new THREE.Group(); f.position.set(x, top, z); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; f.add(M(S(0.07), m(c), Math.cos(a) * 0.08, 0.08, Math.sin(a) * 0.08)); } f.add(M(S(0.06), m(0xffffff), 0, 0.12, 0)); G.add(f); });
    [[1.6, 1.6], [1.25, 1.3], [0.85, 1.05], [0.45, 0.8], [0.05, 0.55]].forEach(([x, z]) => { const p = M(S(0.11), m(PU.cream), x, top, z); p.scale.set(1, 0.3, 1); G.add(p); });
    // #42: 建物の左手前 (build から -0.75, +0.55) は一段高い丘の内側に入り、平地の高さ top では体が埋まる。
    // 丘・建物（1〜4棟）・束・木を避けた平地を、建物が建ったあとの立ち位置にする
    return { top, bundle: [0.75, top, 1.55], build: [1.3, top, -0.6], extraBuilds: [[-1.4, top, 1.25], [0.35, top, -1.35], [1.85, top, 0.65]], char: [-0.35, top, 1.2], charBuild: [1.0, top, 0.35] };
  }

  function dioramaIsland(G, o, P) {
    const top = 0.0;
    G.add(M(Cy(4.4, 4.4, 0.3, 64), m(P.sea, { roughness: 0.3, transparent: true, opacity: 0.94 }), 0, -0.72, 0, false));
    const W = o.empty ? 2.4 : 5.0, D = o.empty ? 2.0 : 4.2;
    G.add(M(B(W, 0.3, D), m(0x7d5c43), 0, -0.47, 0)); G.add(M(B(W, 0.2, D), m(0xa9845f), 0, -0.22, 0)); G.add(M(B(W, 0.12, D), m(0xd5cbb8), 0, -0.06, 0));
    if (o.empty) {
      G.add(M(B(W, 0.025, 0.6), m(0x55565c), 0, 0.012, 0.35)); G.add(tree(-0.75, top, -0.5, C.grass, 0.85));
      const p = new THREE.Group(); p.position.set(0.85, 0, -0.55); p.add(M(Cy(0.03, 0.035, 1.5, 8), m(0x8c8578), 0, 0.75, 0)); p.add(M(B(0.03, 0.03, 0.36), m(0x8c8578), 0, 1.4, 0)); G.add(p);
      return { top, bundle: [0.5, top, 0.6], build: [0.4, top, -0.4], extraBuilds: [[-0.45, top, 0.4], [0.1, top, -0.65], [0.75, top, 0.15]], char: [-0.1, top, 0.55] };
    }
    G.add(M(B(W, 0.025, 1.1), m(0x55565c, { roughness: 0.9 }), 0, 0.012, 0.35));
    [0.2, 0.5].forEach((z) => G.add(M(B(W, 0.02, 0.035), m(0x9a9aa0, { metalness: 0.5, roughness: 0.4 }), 0, 0.035, z, false)));
    for (let i = 0; i < 5; i++) G.add(M(B(0.12, 0.008, 0.9), m(0xf2efe8), -1.45 + i * 0.22, 0.03, 0.35, false));
    const shops = [{ x: -1.85, w: 0.95, h: 1.05, c: 0xe9dcc4, s: '喫茶', sc: '#c94a38', aw: ['#c94a38', '#fbf6ec'] }, { x: -0.85, w: 0.9, h: 1.5, c: 0xf1e7d6, s: '本屋', sc: '#427c89', aw: ['#427c89', '#fbf6ec'] }, { x: 0.12, w: 0.8, h: 0.95, c: 0xdfe6d3, s: '花', sc: '#2f6b1d', aw: ['#2f6b1d', '#fbf6ec'] }];
    shops.forEach((s) => {
      const g = new THREE.Group(); g.position.set(s.x, 0, -1.25);
      g.add(M(B(s.w, s.h, 0.95), m(s.c), 0, s.h / 2, 0)); g.add(M(B(s.w + 0.08, 0.07, 1.03), m(0x4b5a63), 0, s.h + 0.035, 0));
      g.add(M(B(s.w * 0.7, 0.36, 0.02), o._win, 0, 0.26, 0.48, false));
      if (s.h > 1.2) [-0.2, 0.2].forEach((x) => g.add(M(B(0.22, 0.2, 0.02), o._win, x, 1.1, 0.48, false)));
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(s.w + 0.04, 0.3), new THREE.MeshStandardMaterial({ map: stripeTex(s.aw[0], s.aw[1]), side: THREE.DoubleSide, roughness: 0.8 })); aw.position.set(0, 0.56, 0.6); aw.rotation.x = -1.0; aw.castShadow = true; g.add(aw);
      const sg = new THREE.Mesh(B(0.14, 0.14 * s.s.length + 0.1, 0.05), new THREE.MeshStandardMaterial({ map: signTex(s.s, s.sc), roughness: 0.6 })); sg.position.set(s.w / 2 + 0.02, s.h - 0.25 - 0.07 * s.s.length, 0.38); sg.castShadow = true; g.add(sg);
      G.add(g);
    });
    const lot = M(B(1.4, 0.02, 1.25), m(0xb79a74), 1.55, 0.01, -1.2); G.add(lot);
    for (let i = 0; i < 6; i++) G.add(M(B(0.03, 0.18, 0.03), m(0xe8c05a), 0.88 + i * 0.27, 0.09, -0.54));
    const poles = [-2.25, -0.4, 1.3]; poles.forEach((x) => { G.add(M(Cy(0.03, 0.036, 1.95, 8), m(0x8c8578), x, 0.975, -0.22)); G.add(M(B(0.035, 0.035, 0.44), m(0x8c8578), x, 1.78, -0.22)); G.add(M(Cy(0.04, 0.04, 0.12, 8), m(0x6f6a60), x + 0.05, 1.55, -0.22)); });
    const lm = new THREE.LineBasicMaterial({ color: 0x2b2622 });
    for (let i = 0; i < poles.length - 1; i++) [-0.18, 0.18].forEach((dz) => { const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(poles[i] + (poles[i + 1] - poles[i]) * t, 1.78 - Math.sin(t * Math.PI) * 0.13, -0.22 + dz)); } G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm)); });
    [[-2.25, 2.5], [1.3, 2.5]].forEach(([x, x2]) => [-0.18, 0.18].forEach((dz) => { const pts = []; const tx = x < 0 ? -2.5 : 2.5; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector3(x + (tx - x) * t, 1.78 - Math.sin(t * Math.PI / 2) * 0.1, -0.22 + dz)); } G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm)); }));
    const vm = new THREE.Group(); vm.position.set(-2.05, 0, 1.55); vm.add(M(B(0.3, 0.55, 0.24), m(0xf2f0ea), 0, 0.275, 0)); vm.add(M(B(0.24, 0.26, 0.02), o._win, 0, 0.36, 0.125, false)); vm.add(M(B(0.3, 0.06, 0.25), m(C.terra), 0, 0.52, 0)); G.add(vm);
    [[-1.55, 1.6], [-1.25, 1.62]].forEach(([x, z]) => { G.add(M(Cy(0.08, 0.06, 0.12, 12), m(0xb9754f), x, 0.06, z)); G.add(M(S(0.13, 12, 10), m(C.grass2), x, 0.2, z)); });
    const lan = new THREE.Group(); lan.position.set(2.2, 0, 1.6); lan.add(M(Cy(0.02, 0.02, 0.9, 6), m(C.ink), 0, 0.45, 0)); lan.add(M(S(0.09, 14, 12), new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffb45a, emissiveIntensity: P.win * 0.8 }), 0, 0.95, 0)); G.add(lan);
    if (o.phase === 'night') { const pl = new THREE.PointLight(0xffb45a, 1.2, 3, 2); pl.position.set(2.2, 1.0, 1.6); G.add(pl); }
    G.add(tree(2.15, top, -0.15, C.grass, 0.85));
    const tram = new THREE.Group(); tram.position.set(0, 0.04, 0.35);
    tram.add(M(B(1.15, 0.22, 0.4), m(0x3f7d63, { roughness: 0.55 }), 0, 0.14, 0)); tram.add(M(B(1.15, 0.24, 0.4), m(0xf3ead6, { roughness: 0.55 }), 0, 0.37, 0)); tram.add(M(B(1.0, 0.13, 0.405), new THREE.MeshStandardMaterial({ color: 0x334048, emissive: 0xffd28a, emissiveIntensity: P.win * 0.6, roughness: 0.2 }), 0, 0.38, 0, false)); tram.add(M(B(1.05, 0.05, 0.36), m(0x6f7378), 0, 0.51, 0));
    const pg = M(B(0.02, 0.32, 0.02), m(C.ink), 0.05, 0.66, 0, false); pg.rotation.z = 0.5; tram.add(pg); G.add(tram);
    o._tram = tram;
    return { top, bundle: [0.85, top, 1.5], build: [1.55, top, -1.2], extraBuilds: [[-1.35, top, 1.25], [0.2, top, 1.25], [1.75, top, 1.15]], char: [-0.55, top, 1.45] };
  }

  // B1〜B6: ユースケース連動の3D建物ライブラリ
  // kind: 'atelier' | 'kitchen_cafe' | 'study_tower' | 'greenhouse' | 'boutique' | 'pavilion'
  function makeBuilding(style, p, spot, win, kind) {
    const bKind = kind || 'atelier';
    const root = new THREE.Group(); root.position.set(spot[0], spot[1], spot[2]); const body = new THREE.Group(); root.add(body);
    let w = 0.86, d = 0.84, H = 1.6;

    if (bKind === 'kitchen_cafe') {
      // B2: 小さなベーカリー＆キッチン（クリーム壁＋赤白オーニング＋煙突＋丸テーブル＆マグ）
      w = 0.92; d = 0.84; H = 1.48;
      body.add(M(B(w, 0.82, d), m(0xfbf2de), 0, 0.41, 0));
      const roof = M(new THREE.ConeGeometry(0.76, 0.52, 4, 3), m(0xe05a47), 0, 1.06, 0); roof.rotation.y = Math.PI / 4; body.add(roof);
      // 煙突と湯気
      body.add(M(Cy(0.075, 0.085, 0.36, 14), m(0xb84a39), 0.28, 1.18, -0.16));
      body.add(M(S(0.065, 12, 10), m(0xffffff), 0.31, 1.44, -0.16, false));
      body.add(M(S(0.048, 12, 10), m(0xffffff), 0.36, 1.56, -0.14, false));
      // しましまオーニング（日よけ）と窓・ドア
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.28), new THREE.MeshStandardMaterial({ map: stripeTex('#e05a47', '#fbf6ec'), side: THREE.DoubleSide }));
      aw.position.set(0, 0.62, 0.52); aw.rotation.x = -0.95; body.add(aw);
      body.add(M(B(0.44, 0.28, 0.03), win, -0.14, 0.38, 0.43, false));
      body.add(M(B(0.22, 0.36, 0.03), m(C.wood), 0.24, 0.18, 0.43, false));
      const sg = new THREE.Mesh(B(0.14, 0.3, 0.05), new THREE.MeshStandardMaterial({ map: signTex('珈琲', '#e05a47') })); sg.position.set(0.5, 0.72, 0.34); body.add(sg);
      // 店先の丸テーブル＆マグカップ
      body.add(M(Cy(0.16, 0.16, 0.03, 18), m(0xffffff), -0.36, 0.22, 0.58));
      body.add(M(Cy(0.025, 0.03, 0.22, 10), m(C.wood), -0.36, 0.11, 0.58));
      body.add(M(Cy(0.04, 0.035, 0.07, 12), m(0xe05a47), -0.36, 0.26, 0.58));
    } else if (bKind === 'study_tower') {
      // B3: 知恵の書斎タワー（2段ネイビー＆ウッド調タワー＋時計丸窓＋積み重なった本＋看板「書斎」）
      w = 0.84; d = 0.82; H = 1.78;
      body.add(M(B(w, 0.76, d), m(0x364968), 0, 0.38, 0));
      body.add(M(B(w + 0.08, 0.06, d + 0.08), m(C.wood), 0, 0.78, 0));
      body.add(M(B(w * 0.84, 0.62, d * 0.84), m(0x4b6587), 0, 1.1, 0));
      const roof = M(new THREE.ConeGeometry(0.64, 0.48, 4, 3), m(0xf5b738), 0, 1.62, 0); roof.rotation.y = Math.PI / 4; body.add(roof);
      const cw = M(Cy(0.14, 0.14, 0.04, 24), win, 0, 1.12, 0.36, false); cw.rotation.x = Math.PI / 2; body.add(cw);
      body.add(M(B(0.46, 0.28, 0.03), win, -0.12, 0.42, 0.42, false));
      body.add(M(B(0.22, 0.36, 0.03), m(C.wood), 0.22, 0.18, 0.42, false));
      const sg = new THREE.Mesh(B(0.14, 0.32, 0.05), new THREE.MeshStandardMaterial({ map: signTex('書斎', '#427c89') })); sg.position.set(0.46, 0.98, 0.32); body.add(sg);
      // 入り口横の積み重なった本モチーフ
      [0xe05a47, 0x427c89, 0xf5b738].forEach((bc, idx) => {
        body.add(M(B(0.26, 0.065, 0.2), m(bc), -0.34, 0.035 + idx * 0.068, 0.54));
      });
    } else if (bKind === 'greenhouse') {
      // B4: ガラスの温室＆プランター（半透明ミントのかまぼこ型ドーム屋根＋白いフレーム＋双葉プランター）
      w = 0.94; d = 0.86; H = 1.42;
      body.add(M(B(w, 0.44, d), m(0xeef7f2), 0, 0.22, 0));
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x8be0c0,
        emissive: 0x55c49b,
        emissiveIntensity: 0.18,
        roughness: 0.15,
        transparent: true,
        opacity: 0.78,
        clearcoat: 1,
      });
      const vault = M(new THREE.SphereGeometry(0.56, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), glassMat, 0, 0.44, 0);
      vault.scale.set(0.86, 1.05, 0.8); body.add(vault);
      [-0.24, 0, 0.24].forEach((x) => {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.02, 8, 28, Math.PI), m(0xffffff));
        rib.position.set(x, 0.44, 0); rib.rotation.y = Math.PI / 2; body.add(rib);
      });
      body.add(M(B(0.24, 0.38, 0.03), win, 0, 0.22, 0.44, false));
      const sg = new THREE.Mesh(B(0.14, 0.3, 0.05), new THREE.MeshStandardMaterial({ map: signTex('温室', '#2e9e6b') })); sg.position.set(0.5, 0.56, 0.34); body.add(sg);
      // 入り口横のプランター木箱と双葉
      body.add(M(B(0.46, 0.16, 0.2), m(C.wood), -0.18, 0.08, 0.56));
      [-0.32, -0.18, -0.04].forEach((px, idx) => {
        body.add(M(S(0.065, 12, 10), m(idx === 1 ? 0x4fb45e : C.lime), px, 0.2, 0.56));
      });
    } else if (bKind === 'boutique') {
      // B5: ドレッサー・ブティック（ラベンダー＆ピーチサロン＋アーチ鏡面窓＋屋根上のリボン飾り）
      w = 0.88; d = 0.82; H = 1.58;
      body.add(M(B(w, 0.8, d), m(0xc39ce8), 0, 0.4, 0));
      const dome = M(new THREE.SphereGeometry(0.56, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), m(0xf7a6d6), 0, 0.78, 0);
      body.add(dome);
      // 屋根上のリボン・クラウン飾り
      body.add(M(S(0.075, 14, 12), m(0xf5b738), 0, 1.36, 0));
      const bowL = M(new THREE.ConeGeometry(0.11, 0.22, 14), m(0xe05a47), -0.11, 1.36, 0); bowL.rotation.z = -Math.PI / 2; body.add(bowL);
      const bowR = M(new THREE.ConeGeometry(0.11, 0.22, 14), m(0xe05a47), 0.11, 1.36, 0); bowR.rotation.z = Math.PI / 2; body.add(bowR);
      // アーチショーウィンドウ
      body.add(M(B(0.38, 0.44, 0.03), win, -0.14, 0.34, 0.42, false));
      body.add(M(B(0.22, 0.36, 0.03), m(0xfbf6ec), 0.22, 0.18, 0.42, false));
      const sg = new THREE.Mesh(B(0.14, 0.3, 0.05), new THREE.MeshStandardMaterial({ map: signTex('装い', '#ad8be3') })); sg.position.set(0.48, 0.68, 0.34); body.add(sg);
    } else if (bKind === 'pavilion') {
      // B6: カルチャー＆フォトテント（多角錐サーカステント屋根＋カメラレンズ風丸窓＋フラッグガーランド）
      w = 0.9; d = 0.9; H = 1.62;
      body.add(M(Cy(0.46, 0.48, 0.78, 16), m(0xfbf6ec), 0, 0.39, 0));
      const tent = M(new THREE.ConeGeometry(0.68, 0.62, 8, 2), m(0xf5b738), 0, 1.08, 0); body.add(tent);
      body.add(M(S(0.07, 12, 10), m(0xe05a47), 0, 1.42, 0));
      // カメラレンズ風ファインダー丸窓
      const lensOuter = M(Cy(0.17, 0.17, 0.08, 24), m(C.ink), 0, 0.46, 0.46, false); lensOuter.rotation.x = Math.PI / 2; body.add(lensOuter);
      const lensInner = M(Cy(0.12, 0.12, 0.09, 24), win, 0, 0.46, 0.47, false); lensInner.rotation.x = Math.PI / 2; body.add(lensInner);
      // ガーランド球
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        body.add(M(S(0.045, 10, 8), m(i % 2 ? 0xe05a47 : 0x427c89), Math.cos(a) * 0.56, 0.78, Math.sin(a) * 0.56));
      }
      const sg = new THREE.Mesh(B(0.14, 0.3, 0.05), new THREE.MeshStandardMaterial({ map: signTex('写真', '#427c89') })); sg.position.set(0.48, 0.64, 0.34); body.add(sg);
    } else if (style === 'diorama') {
      w = 1.0; d = 0.85; H = 1.35; body.add(M(B(w, 1.3, d), m(0xf2e8d4), 0, 0.65, 0)); body.add(M(B(1.1, 0.08, 0.95), m(0x4b5a63), 0, 1.34, 0));
      body.add(M(B(0.72, 0.38, 0.02), win, 0, 0.27, 0.43, false)); [-0.24, 0.24].forEach((x) => body.add(M(B(0.24, 0.22, 0.02), win, x, 0.95, 0.43, false)));
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.28), new THREE.MeshStandardMaterial({ map: stripeTex('#ad8be3', '#fbf6ec'), side: THREE.DoubleSide })); aw.position.set(0, 0.56, 0.56); aw.rotation.x = -1.0; body.add(aw);
      const sg = new THREE.Mesh(B(0.15, 0.32, 0.05), new THREE.MeshStandardMaterial({ map: signTex('制作', '#4f6ad9') })); sg.position.set(0.52, 0.95, 0.34); body.add(sg);
    } else {
      // B1: 制作アトリエ（パステルブルー壁＋ピンクドーム屋根＋大きな天窓＋イーゼル＆看板「制作」）
      w = 0.86; d = 0.82; H = 1.62;
      body.add(M(B(w, 0.8, d), m(0x4f6ad9), 0, 0.4, 0));
      const rf = PUFFY ? M(new THREE.SphereGeometry(0.56, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), m(0xf7a6d6), 0, 0.78, 0) : M(new THREE.ConeGeometry(0.66, 0.55, 4, 3), m(0xf3a243), 0, 1.07, 0);
      rf.rotation.y = Math.PI / 4; body.add(rf);
      const rw = M(Cy(0.14, 0.14, 0.03, 24), win, -0.1, 0.52, 0.42, false); rw.rotation.x = Math.PI / 2; body.add(rw);
      body.add(M(B(0.2, 0.32, 0.03), m(C.teal), 0.2, 0.16, 0.42, false));
      body.add(M(Cy(0.01, 0.01, 0.42, 6), m(C.ink), 0, 1.5, 0, false));
      body.add(M(B(0.18, 0.11, 0.01), m(C.terra), 0.09, 1.64, 0, false));
      const sg = new THREE.Mesh(B(0.14, 0.3, 0.05), new THREE.MeshStandardMaterial({ map: signTex('制作', '#4f6ad9') })); sg.position.set(0.47, 0.68, 0.32); body.add(sg);
      // アトリエ前のミニ画架（イーゼル）＆キャンバス
      body.add(M(Cy(0.015, 0.015, 0.38, 6), m(C.wood), -0.36, 0.19, 0.56));
      body.add(M(B(0.24, 0.2, 0.03), m(0xffffff), -0.36, 0.24, 0.58));
      body.add(M(B(0.18, 0.12, 0.035), m(0xf5b738), -0.36, 0.24, 0.585));
    }

    body.scale.y = Math.max(0.001, p);
    const sc = new THREE.Group(); const sm = m(C.wood); const hw = w / 2 + 0.08, hd = d / 2 + 0.08;
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([x, z]) => sc.add(M(Cy(0.014, 0.014, H, 6), sm, x, H / 2, z)));
    [0.45, 0.9, H - 0.05].forEach((y) => { sc.add(M(B(hw * 2, 0.02, 0.02), sm, 0, y, hd)); sc.add(M(B(hw * 2, 0.02, 0.02), sm, 0, y, -hd)); sc.add(M(B(0.02, 0.02, hd * 2), sm, hw, y, 0)); sc.add(M(B(0.02, 0.02, hd * 2), sm, -hw, y, 0)); });
    [[-hw - 0.15, hd + 0.1], [hw + 0.12, hd + 0.15]].forEach(([x, z]) => sc.add(M(new THREE.ConeGeometry(0.05, 0.14, 12), m(0xf08a3c), x, 0.07, z)));
    sc.visible = p < 1; root.add(sc);
    return { root, body, sc };
  }
  function makeBundle(spot) {
    const g = new THREE.Group(); g.position.set(spot[0], spot[1], spot[2]);
    ['#e05a47', '#427c89', '#f5b738'].forEach((c, i) => { const s = M(B(0.5, 0.04, 0.62), m(new THREE.Color(c).getHex()), 0, 0.025 + i * 0.045, 0); s.rotation.y = (i - 1) * 0.18; g.add(s); });
    g.add(M(B(0.09, 0.16, 0.66), m(C.cream), 0, 0.08, 0)); g.add(M(Cy(0.012, 0.012, 0.62, 6), m(C.wood), 0.32, 0.31, -0.22)); g.add(M(B(0.22, 0.13, 0.01), m(C.terra), 0.43, 0.55, -0.22));
    return g;
  }
  // ---------- stickers (die-cut photo with white border) ----------
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  function removeBg(c) {
    const g = c.getContext('2d'), w = c.width, h = c.height, d = g.getImageData(0, 0, w, h), p = d.data;
    const A = (x, y) => p[(y * w + x) * 4 + 3];
    if (A(0, 0) < 10 && A(w - 1, 0) < 10 && A(0, h - 1) < 10 && A(w - 1, h - 1) < 10) return; // already transparent
    let r = 0, gg = 0, b = 0, n = 0; const add = (x, y) => { const i = (y * w + x) * 4; r += p[i]; gg += p[i + 1]; b += p[i + 2]; n++; };
    for (let x = 0; x < w; x += 3) { add(x, 0); add(x, h - 1); } for (let y = 0; y < h; y += 3) { add(0, y); add(w - 1, y); }
    r /= n; gg /= n; b /= n; const TH = 38 * 38 * 3;
    const near = (i) => { const dr = p[i] - r, dg = p[i + 1] - gg, db = p[i + 2] - b; return dr * dr + dg * dg + db * db < TH; };
    const seen = new Uint8Array(w * h), st = [];
    const push = (x, y) => { const k = y * w + x; if (!seen[k] && near(k * 4)) { seen[k] = 1; st.push(k); } };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; p[k * 4 + 3] = 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
    g.putImageData(d, 0, 0);
  }
  function hash(str) { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 9973; return h; }
  function drawPlaceholder(g, S, pad, o) {
    const cx = S / 2, cy = S / 2, R = S / 2 - pad, seed = hash(o.label || o.color) / 300;
    g.beginPath();
    if (o.shape === 'rect') { const w = R * 1.5, h = R * 1.9; rr(g, cx - w / 2, cy - h / 2, w, h, R * 0.12); }
    else { for (let i = 0; i <= 140; i++) { const t = i / 140 * Math.PI * 2; const k = 0.86 + 0.08 * Math.sin(3 * t + seed) + 0.05 * Math.sin(5 * t + seed * 2.3) + 0.03 * Math.sin(2 * t + seed * 4); const x = cx + Math.cos(t) * R * k * 0.82, y = cy + Math.sin(t) * R * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } }
    g.closePath(); g.save(); g.clip(); g.fillStyle = o.color || '#e05a47'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = S * 0.025; for (let i = -S; i < S * 2; i += S * 0.06) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    if (o.label) { g.font = '500 ' + Math.round(S * 0.042) + 'px "JetBrains Mono",monospace'; const tw = g.measureText(o.label).width; g.fillStyle = 'rgba(0,0,0,.28)'; rr(g, cx - tw / 2 - 12, cy - S * 0.035, tw + 24, S * 0.07, 6); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.label, cx, cy); }
    g.restore();
  }
  // makeSticker(src|null, {removeBg, border, shadow, shape, color, label}) -> Promise<{url, aspect}>
  async function makeSticker(src, o) {
    o = o || {}; const S = o.size || 512, bw = o.border != null ? o.border : Math.round(S * 0.034), pad = bw + (o.shadow === false ? 3 : 22);
    const a = document.createElement('canvas'); a.width = a.height = S; const ag = a.getContext('2d');
    if (src) {
      const img = await loadImg(src); const k = Math.min((S - 2 * pad) / img.width, (S - 2 * pad) / img.height); const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(img, 0, 0, w, h); if (o.removeBg !== false) removeBg(t);
      ag.drawImage(t, (S - w) / 2, (S - h) / 2);
    } else drawPlaceholder(ag, S, pad, o);
    const ol = document.createElement('canvas'); ol.width = ol.height = S; const og = ol.getContext('2d');
    [bw, bw * 0.6, bw * 0.3].forEach((rad) => { for (let i = 0; i < 32; i++) { const t = (i / 32) * Math.PI * 2; og.drawImage(a, Math.cos(t) * rad, Math.sin(t) * rad); } });
    og.globalCompositeOperation = 'source-in'; og.fillStyle = '#ffffff'; og.fillRect(0, 0, S, S);
    const out = document.createElement('canvas'); out.width = out.height = S; const g = out.getContext('2d');
    if (o.shadow !== false) { g.shadowColor = 'rgba(60,40,25,.26)'; g.shadowBlur = S * 0.03; g.shadowOffsetY = S * 0.012; }
    g.drawImage(ol, 0, 0); g.shadowColor = 'transparent'; g.drawImage(a, 0, 0);
    if (o.tape) { g.save(); g.translate(S / 2, pad + S * 0.02); g.rotate(-0.12); g.fillStyle = 'rgba(246,214,137,.88)'; g.fillRect(-S * 0.13, -S * 0.03, S * 0.26, S * 0.06); g.restore(); }
    const d = g.getImageData(0, 0, S, S).data; let x0 = S, y0 = S, x1 = 0, y1 = 0;
    for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) if (d[(y * S + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) { x0 = y0 = 0; x1 = y1 = S - 1; }
    const tw = x1 - x0 + 2, th = y1 - y0 + 2; const tc = document.createElement('canvas'); tc.width = tw; tc.height = th; tc.getContext('2d').drawImage(out, -x0, -y0);
    return { url: tc.toDataURL('image/png'), aspect: tw / th };
  }

  const FLOAT = [[-1.45, 2.55, 0.7], [1.4, 2.85, -0.3], [0.05, 3.45, 1.15], [-0.3, 2.45, -1.35]];

  function buildScene(o, aspect) {
    o = Object.assign({ style: 'clay', character: 'poko', phase: 'day', cards: [] }, o);
    const P = PH[o.phase] || PH.day; const night = o.phase === 'night'; CLAY = o.style === 'clay' || !o.style; PUFFY = o.style === 'puffy'; SEED = 0;
    o._win = new THREE.MeshStandardMaterial({ color: 0xffe7a0, emissive: 0xffc46b, emissiveIntensity: P.win, roughness: 0.4 });
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100);
    scene.add(new THREE.HemisphereLight(P.hemi[0], P.hemi[1], P.hemi[2]));
    const key = new THREE.DirectionalLight(P.key[0], P.key[1]); key.position.set(...P.key[2]); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = sc.bottom = -5.5; sc.right = sc.top = 5.5; sc.near = 1; sc.far = 30; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; scene.add(key);
    const fill = new THREE.DirectionalLight(P.fill[0], P.fill[1]); fill.position.set(-7, 4, -6); scene.add(fill);
    const pivot = new THREE.Group(); scene.add(pivot); const world = new THREE.Group(); pivot.add(world);
    const spots = o.style === 'diorama' ? dioramaIsland(world, o, P) : o.style === 'puffy' ? puffyIsland(world, o, P) : clayIsland(world, o, P);
    if (PUFFY && o._r) { scene.environment = getEnv(o._r); scene.children.forEach((l) => { if (l.isHemisphereLight) l.intensity *= 0.55; if (l.isDirectionalLight) l.intensity *= 0.9; }); }
    let bld = null;
    if (o.building != null) {
      bld = makeBuilding(o.style, o.anim === 'build' ? 0 : o.building, spots.build, o._win, o.buildingKind);
      world.add(bld.root);
    }
    if (Array.isArray(o.extraBuildings) && Array.isArray(spots.extraBuilds)) {
      o.extraBuildings.slice(0, spots.extraBuilds.length).forEach((ebKind, idx) => {
        const eb = makeBuilding(o.style, 1, spots.extraBuilds[idx], o._win, ebKind);
        eb.root.scale.setScalar(0.88);
        world.add(eb.root);
      });
    }
    let bun = null; if (o.bundle) { bun = makeBundle(spots.bundle); world.add(bun); if (o.anim === 'settle') bun.scale.setScalar(0.001); }
    const ch = makeChar(o.character, night); const charBuild = spots.charBuild || [spots.build[0] - 0.75, spots.top, spots.build[2] + 0.55]; const cpos = o.charAt === 'build' ? charBuild : o.charAt === 'bundle' ? [spots.bundle[0] - 0.5, spots.top, spots.bundle[2]] : spots.char;
    ch.g.position.set(...cpos); ch.g.userData.baseY = cpos[1]; ch.g.rotation.y = 0.35; world.add(ch.g);
    const pending = [];
    const cards = (o.cards || []).slice(0, 4).map((c, i) => {
      if (c.sticker && !c.unknown) {
        const g = new THREE.Group(); const t = new THREE.Texture(); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
        pending.push(loadImg(c.sticker).then((im) => { t.image = im; t.needsUpdate = true; }).catch(() => {}));
        let w = 1.3, h = w / (c.aspect || 0.8); if (h > 1.55) { h = 1.55; w = h * (c.aspect || 0.8); }
        const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.08, roughness: 0.55, side: THREE.DoubleSide });
        const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); f.castShadow = true; f.userData.idx = i;
        f.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 }); g.add(f);
        const fp = FLOAT[i]; g.position.set(...fp); g.userData = { fp, i }; world.add(g); return g;
      }
      const g = new THREE.Group(); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.4), new THREE.MeshStandardMaterial({ map: cardTex(c), alphaTest: 0.5, roughness: 0.6 })); f.castShadow = true; f.userData.idx = i; g.add(f);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.4), new THREE.MeshStandardMaterial({ map: backTex(), alphaTest: 0.5 })); b.rotation.y = Math.PI; b.position.z = -0.005; b.userData.idx = i; g.add(b);
      const fp = FLOAT[i]; g.position.set(...fp); g.userData = { fp, i }; world.add(g); return g;
    });
    scene.traverse((ob) => { if (ob.isLight && !ob.userData.lin) { ob.color.convertSRGBToLinear(); if (ob.groundColor) ob.groundColor.convertSRGBToLinear(); ob.userData.lin = 1; } const ms = ob.material ? (Array.isArray(ob.material) ? ob.material : [ob.material]) : []; ms.forEach((mt) => { if (mt.userData.lin) return; if (mt.color) mt.color.convertSRGBToLinear(); if (mt.emissive) mt.emissive.convertSRGBToLinear(); mt.userData.lin = 1; }); });
    let dist = 16, tgt = new THREE.Vector3(0, 0.95, 0), el = 0.52;
    function fit(a) { const half = Math.min(15 * Math.PI / 180, Math.atan(Math.tan(15 * Math.PI / 180) * a)); const R = o.focus === 'character' ? 0.75 : o.empty ? 2.0 : 3.15; dist = R / Math.sin(half); if (o.focus === 'character') { tgt.set(cpos[0], cpos[1] + 0.38, cpos[2]); el = 0.22; } else if (o.empty) tgt.set(0, 0.35, 0); }
    fit(aspect);
    let zoom = 1;
    function placeCam() { const d = dist / ((o.zoom || 1) * zoom); camera.position.set(tgt.x, tgt.y + d * Math.sin(el), tgt.z + d * Math.cos(el)); camera.lookAt(tgt); }
    if (o.focus === 'character') { pivot.rotation.y = 0; ch.g.rotation.y = 0; }
    placeCam();
    let time = 0; const startChar = ch.g.position.clone(); const tv = new THREE.Vector3();
    function tick(dt) {
      time += dt; const t = time;
      if (o.anim === 'birth') { const k = clamp(t / 1.9); const s = Math.max(0.001, easeBack(k)); world.scale.set(s, s, s); world.position.y = -1.0 * (1 - easeOut(k)); }
      cards.forEach((g, i) => {
        const fp = g.userData.fp; let y = fp[1] + Math.sin(t * 1.4 + i * 2.1) * 0.08, x = fp[0], z = fp[2], s = 1;
        if (o.anim === 'addCard' && i === cards.length - 1) { const k = clamp((t - 0.1) / 1.3); s = Math.max(0.001, easeBack(k)); y = spots.top + (y - spots.top) * easeOut(k); }
        if (o.anim === 'settle') { const k = clamp((t - 0.5 - i * 0.28) / 1.6), e = easeOut(k); const b = spots.bundle; x = fp[0] + (b[0] - fp[0]) * e; z = fp[2] + (b[2] - fp[2]) * e; y = y + (b[1] + 0.25 - y) * e; s = 1 - 0.75 * e; g.visible = k < 1; }
        g.position.set(x, y, z); g.scale.setScalar(s);
      });
      if (bun && o.anim === 'settle') { const k = clamp((t - 2.75) / 0.6); bun.scale.setScalar(Math.max(0.001, easeBack(k))); }
      if (bld && o.anim === 'build') { const k = clamp((t - 0.7) / 2.3); bld.body.scale.y = Math.max(0.001, k < 1 ? easeOut(k) : 1); bld.sc.visible = k < 1; }
      if (o._tram) o._tram.position.x = Math.sin(t * 0.25) * 1.75;
      ch.idle(t);
      if (o.anim === 'build') { const k = easeOut(clamp(t / 0.8)); tv.set(charBuild[0], charBuild[1], charBuild[2]); ch.g.position.x = startChar.x + (tv.x - startChar.x) * k; ch.g.position.z = startChar.z + (tv.z - startChar.z) * k; }
      scene.updateMatrixWorld(); cards.forEach((g) => g.lookAt(camera.position));
    }
    return { scene, camera, pivot, tick, cards, ch, pending, setAspect(a) { camera.aspect = a; fit(a); camera.updateProjectionMatrix(); placeCam(); }, setZoom(z) { if (z !== zoom) { zoom = z; placeCam(); } } };
  }
  const ENVS = new WeakMap();
  function getEnv(r) {
    if (ENVS.has(r)) return ENVS.get(r);
    const es = new THREE.Scene(); const sky = tex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#f7eef4'); gr.addColorStop(0.55, '#dfe9f5'); gr.addColorStop(1, '#b9c7d6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
    [[4, 6, 3, 5, 3], [-6, 3, -2, 3, 4]].forEach(([x, y, z, w, hh]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p); });
    const pm = new THREE.PMREMGenerator(r); const t = pm.fromScene(es, 0.03).texture; pm.dispose(); ENVS.set(r, t); return t;
  }
  function dispose(scene) { scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material && ob.material.map) ob.material.map.dispose(); }); }
  function mkRenderer(snap) { const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!snap }); r.setClearColor(0x000000, 0); r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; return r; }

  function mount(el, opts) {
    const r = mkRenderer(false); const cv = r.domElement; cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab'; el.appendChild(cv);
    let st = null, W = 1, H = 1, alive = true;
    function size() { W = el.clientWidth || 390; H = el.clientHeight || 500; r.setSize(W, H, false); if (st) st.setAspect(W / H); }
    function build(o) { if (st) dispose(st.scene); r.toneMappingExposure = (PH[o.phase] || PH.day).exp * (o.style === 'puffy' ? 0.9 : 1); st = buildScene(Object.assign({}, o, { _r: r }), W / H); st.pivot.rotation.y = rotY; }
    let rotY = -0.55, tRot = -0.55, tilt = 0, tTilt = 0, zoom = 1, tZoom = 1; const ptrs = new Map(); let downAt = null, pinch0 = 0, zoom0 = 1;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); downAt = { x: e.clientX, y: e.clientY, moved: 0 }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = tZoom; } cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; if (downAt) downAt.moved += Math.abs(dx) + Math.abs(dy); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; tZoom = Math.max(0.75, Math.min(2.2, zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / (pinch0 || 1))); } else { tRot += dx * 0.009; tTilt = Math.max(-0.12, Math.min(0.35, tTilt + dy * 0.004)); } });
    const up = (e) => { ptrs.delete(e.pointerId); cv.style.cursor = 'grab'; if (downAt && downAt.moved < 6 && ptrs.size === 0) pick(e); if (!ptrs.size) downAt = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); tZoom = Math.max(0.75, Math.min(2.2, tZoom * (e.deltaY > 0 ? 0.92 : 1.08))); }, { passive: false });
    const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
    function pick(e) { const b = cv.getBoundingClientRect(); v2.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(v2, st.camera); const hit = ray.intersectObjects(st.cards, true)[0]; if (hit && opts.onCardTap) return opts.onCardTap(hit.object.userData.idx); if (ray.intersectObject(st.ch.g, true)[0] && opts.onCharTap) opts.onCharTap(); }
    size(); build(opts); const ro = new ResizeObserver(size); ro.observe(el);
    let last = performance.now();
    function loop(now) { if (!alive) return; requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!ptrs.size) tRot += dt * 0.05; rotY += (tRot - rotY) * 0.1; tilt += (tTilt - tilt) * 0.1; zoom += (tZoom - zoom) * 0.12; st.pivot.rotation.y = rotY; st.pivot.rotation.x = tilt; st.setZoom(zoom); st.tick(dt); r.render(st.scene, st.camera); }
    requestAnimationFrame(loop);
    return { set(o) { opts = o; build(o); }, destroy() { alive = false; ro.disconnect(); dispose(st.scene); r.dispose(); cv.remove(); } };
  }
  let SR = null;
  function snapshot(opts, w, h) {
    if (!SR) SR = mkRenderer(true); SR.setPixelRatio(2); SR.setSize(w, h, false); SR.toneMappingExposure = (PH[opts.phase] || PH.day).exp * (opts.style === 'puffy' ? 0.9 : 1);
    const st = buildScene(Object.assign({}, opts, { anim: null, _r: SR }), w / h); st.pivot.rotation.y = opts.rot != null ? opts.rot : -0.55; st.tick(opts.t || 0.6);
    SR.render(st.scene, st.camera); const url = SR.domElement.toDataURL('image/png'); dispose(st.scene); return url;
  }
  async function snapshotAsync(opts, w, h) {
    if (!SR) SR = mkRenderer(true); const st = buildScene(Object.assign({}, opts, { anim: null, _r: SR }), w / h); await Promise.all(st.pending);
    SR.setPixelRatio(2); SR.setSize(w, h, false); SR.toneMappingExposure = (PH[opts.phase] || PH.day).exp * (opts.style === 'puffy' ? 0.9 : 1);
    st.pivot.rotation.y = opts.rot != null ? opts.rot : -0.55; st.tick(opts.t || 0.6); SR.render(st.scene, st.camera); const url = SR.domElement.toDataURL('image/png'); dispose(st.scene); return url;
  }
  window.Island = { mount, snapshot, snapshotAsync, makeSticker };
})();
