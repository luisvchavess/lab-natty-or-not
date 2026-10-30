/* ============================================================
   FUSCA A JATO — bg.js  (módulo CENÁRIOS)
   Brasília vista de cima (pop chapado, leve vista 3/4), rolando
   para baixo enquanto o Fusca voa para cima.
   G.BG.draw(ctx, id, scrollY, t, W, H) pinta a tela inteira a cada quadro.
   ids: menu, rodoviaria, esplanada, paranoa, planalto.

   Como funciona
   - O chão é uma pilha de BLOCOS (chunks) de 360 px de largura,
     pré-renderizados uma única vez em canvas fora da tela (RNG com
     semente → sempre igual). Todos os blocos de uma fase têm as mesmas
     pistas/margens nas bordas, então encaixam sem emenda.
   - O mundo tem posição própria (S.pos). Normalmente anda junto com
     scrollY; quando o chefão aparece, o próximo bloco é o MARCO da fase
     (Torre de TV, Congresso, Alvorada, Planalto): o mundo acelera,
     freia e ESTACIONA com o marco atrás do chefão. Saiu o chefão, volta.
   - Por quadro: 1–2 drawImage do chão, trânsito/brilhos baratos,
     faixas "por cima" (plataforma da Rodoviária, Ponte JK), camada
     translúcida rápida (névoa/nuvens/fumaça/santinhos), tinta do
     horário e vinheta do chefão. Nada de shadowBlur em tempo real.
   - Legibilidade: luminância média-baixa, contraste baixo nos detalhes,
     nenhum pontinho claro redondo (nada que pareça tiro).
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G) return;
  const TAU = Math.PI * 2;
  const WW = 360; // largura lógica do mundo

  // =================================================================
  // Utilidades
  // =================================================================
  function rng(seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.r = (lo, hi) => lo + f() * (hi - lo);
    f.i = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
    return f;
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function approach(v, tg, s) { return v < tg ? Math.min(v + s, tg) : Math.max(v - s, tg); }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  // Liberar um canvas grande (largura = 1) custa ~1 ms a 4x: os da fase anterior saem
  // aos poucos pelo relógio da pré-construção, nunca todos no 1º quadro da fase nova.
  const FREEQ = [];
  function freeCanvas(c) { if (c && c.width > 1) FREEQ.push(c); }
  function drainFree(budgetMs) {
    const t0 = performance.now();
    while (FREEQ.length && performance.now() - t0 < budgetMs) { const c = FREEQ.shift(); c.width = 1; c.height = 1; }
  }
  // O Chrome grava os comandos de um canvas e só rasteriza quando ele é usado pela
  // 1ª vez: sem isto, o custo da construção caía no 1º quadro da fase (~23 ms a 4x).
  // Desenhar num canvas de 1 px força a rasterização na hora da construção.
  let BAKE = null;
  function bake(c) {
    if (!c) return c;
    try {
      if (!BAKE) { const b = document.createElement('canvas'); b.width = 1; b.height = 1; BAKE = b.getContext('2d'); }
      BAKE.drawImage(c, 0, 0, 1, 1);
    } catch (e) { /* nada */ }
    return c;
  }
  // canvas com coordenadas lógicas (w×h px do jogo) na resolução res
  function surface(w, h, res) { const c = mkCanvas(w * res, h * res); const x = c.getContext('2d'); x.scale(res, res); return { c, x }; }

  // =================================================================
  // Primitivas (usadas só na pré-renderização)
  // =================================================================
  function rect(x, c, X, Y, w, h) { x.fillStyle = c; x.fillRect(X, Y, w, h); }
  function rrPath(x, X, Y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  function rrect(x, c, X, Y, w, h, r) { x.fillStyle = c; rrPath(x, X, Y, w, h, r); x.fill(); }
  function circ(x, c, X, Y, r) { x.fillStyle = c; x.beginPath(); x.arc(X, Y, Math.max(0.1, r), 0, TAU); x.fill(); }
  function ell(x, c, X, Y, rx, ry, rot) { x.fillStyle = c; x.beginPath(); x.ellipse(X, Y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); x.fill(); }
  function poly(x, c, p) { x.fillStyle = c; x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); x.fill(); }
  function seg(x, c, w, x1, y1, x2, y2) { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); }
  function txt(x, s, X, Y, size, c, o) {
    o = o || {};
    x.font = (o.w || '400') + ' ' + size + 'px ' + (o.body ? G.FONT_BODY : G.FONT_DISPLAY);
    x.fillStyle = c; x.textAlign = o.align || 'center'; x.textBaseline = 'middle';
    if (o.maxW) x.fillText(s, X, Y, o.maxW); else x.fillText(s, X, Y);
  }
  function lgrad(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]); return g; }
  // poça de luz macia (postes à noite). rgb = '255,170,90'
  function pool(x, X, Y, r, rgb, a) {
    const g = x.createRadialGradient(X, Y, 0, X, Y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(0.5, 'rgba(' + rgb + ',' + (a * 0.45) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2);
  }
  // textura discreta (pequenas manchas, contraste baixíssimo)
  function speckle(x, R, X, Y, w, h, n, c1, c2) {
    for (let i = 0; i < n; i++) { x.fillStyle = R() < 0.5 ? c1 : c2; x.fillRect(X + R() * w, Y + R() * h, R.r(1, 3), R.r(1, 2.5)); }
  }

  // ---------- sombras e prédios em vista 3/4 ----------
  // Convenção: um objeto de altura z tem o TELHADO deslocado z px para cima;
  // a fachada da frente (de baixo) aparece entre o telhado e o chão.
  function shadowBox(x, P, X, Y, w, d, z) {
    const dx = z * P.sx, dy = z * P.sy;
    poly(x, P.shadow, [X, Y, X + w, Y, X + w + dx, Y + dy, X + w + dx, Y + d + dy, X + dx, Y + d + dy, X, Y + d]);
  }
  function winGrid(x, X, Y, w, h, c, lit, litP, R, rowH, colW) {
    const ww = Math.max(1, colW * 0.6), wh = Math.max(0.8, rowH * 0.5);
    for (let yy = Y + 1.2; yy + wh <= Y + h - 0.8; yy += rowH) {
      for (let xx = X + 1.4; xx + ww <= X + w - 1; xx += colW) {
        x.fillStyle = (R && lit && R() < litP) ? lit : c;
        x.fillRect(xx, yy, ww, wh);
      }
    }
  }
  // Prédio: pegada no chão (X,Y,w,d), altura z.
  function box(x, P, X, Y, w, d, z, o) {
    o = o || {};
    if (!o.noShadow) shadowBox(x, P, X, Y, w, d, z);
    const fy = Y + d - z;
    if (z > 0) {
      rect(x, o.facade || P.facade, X, fy, w, z);
      if (o.win !== false && z > 3) winGrid(x, X, fy, w, z, o.win || P.win, o.lit === undefined ? P.winLit : o.lit, o.litP != null ? o.litP : P.litP, o.R, o.rowH || 3, o.colW || 4);
      rect(x, 'rgba(0,0,0,0.2)', X, Y + d - 1, w, 1);
    }
    rect(x, o.roof || P.roof[0], X, Y - z, w, d);
    x.strokeStyle = o.edge || P.edge; x.lineWidth = 1; x.strokeRect(X + 0.5, Y - z + 0.5, w - 1, d - 1);
    rect(x, 'rgba(255,255,255,0.06)', X + 1, Y - z + 1, w - 2, 1);
  }
  // tralha de telhado: ar-condicionado, caixa d'água
  function roofJunk(x, P, R, X, Y, w, d) {
    const n = R.i(1, 4);
    for (let i = 0; i < n; i++) {
      const bw = R.r(3, 8), bh = R.r(3, 6);
      const bx = X + R.r(2, Math.max(2, w - bw - 2)), by = Y + R.r(2, Math.max(2, d - bh - 2));
      rect(x, 'rgba(0,0,0,0.22)', bx + 1, by + 1, bw, bh);
      rect(x, R() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)', bx, by, bw, bh);
    }
  }

  // ---------- vegetação ----------
  function treeC(x, P, R, X, Y, rad, n, rmin, rmax) {
    rmin = rmin || 3; rmax = rmax || 6.5;
    const pts = [];
    for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()) * rad; pts.push(X + Math.cos(a) * d, Y + Math.sin(a) * d * 0.8, R.r(rmin, rmax)); }
    for (let i = 0; i < pts.length; i += 3) circ(x, P.shadow, pts[i] + pts[i + 2] * 0.7, pts[i + 1] + pts[i + 2] * 0.5, pts[i + 2]);
    for (let i = 0; i < pts.length; i += 3) {
      const tx = pts[i], ty = pts[i + 1], r = pts[i + 2];
      circ(x, R.pick(P.tree), tx, ty, r);
      circ(x, R.pick(P.tree), tx + r * 0.45, ty + r * 0.2, r * 0.7); // copa torta do cerrado
      circ(x, P.treeHi, tx - r * 0.3, ty - r * 0.35, r * 0.5);
    }
  }
  function fronds(x, c, r) {
    x.fillStyle = c; x.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + 0.3;
      x.moveTo(0, 0);
      x.lineTo(Math.cos(a - 0.25) * r * 0.45, Math.sin(a - 0.25) * r * 0.45);
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      x.lineTo(Math.cos(a + 0.25) * r * 0.45, Math.sin(a + 0.25) * r * 0.45);
      x.closePath();
    }
    x.fill();
  }
  function palm(x, P, X, Y, r) {
    x.save(); x.translate(X + r * 0.9, Y + r * 0.35); fronds(x, P.shadow, r); x.restore();
    x.save(); x.translate(X, Y - 3); fronds(x, P.palm || P.tree[0], r); x.restore();
  }
  // trilha de terra no gramado ("caminho de rato"): curta, curva e escura — nunca parece um laser
  function trail(x, P, R, x1, y1, x2, y2) {
    const dy = y2 - y1;
    if (Math.abs(dy) > 46) y2 = y1 + Math.sign(dy) * 46;
    x.strokeStyle = P.path; x.lineWidth = 2.6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(x1, y1);
    x.quadraticCurveTo((x1 + x2) / 2 + R.r(-10, 10), (y1 + y2) / 2 + R.r(-16, 16), x2, y2);
    x.stroke();
  }

  // ---------- veículos e gente ----------
  function car(x, X, Y, color, ang) {
    x.save(); x.translate(X, Y); if (ang) x.rotate(ang);
    rrect(x, 'rgba(0,0,0,0.3)', -2.2, -4.3, 6, 11, 2);
    rrect(x, color, -3, -5.5, 6, 11, 2);
    rect(x, 'rgba(18,24,36,0.6)', -2.3, -3.1, 4.6, 2.1);
    rect(x, 'rgba(18,24,36,0.45)', -2.3, 2.5, 4.6, 1.5);
    rect(x, 'rgba(255,255,255,0.1)', -2, -0.9, 4, 3.2);
    x.restore();
  }
  function bus(x, X, Y, color, ang, len) {
    len = len || 28;
    x.save(); x.translate(X, Y); if (ang) x.rotate(ang);
    rrect(x, 'rgba(0,0,0,0.3)', -2.6, -len / 2 + 2, 8, len, 2);
    rrect(x, color, -4, -len / 2, 8, len, 2);
    rect(x, 'rgba(225,230,240,0.18)', -3, -len / 2 + 3, 6, len - 6);
    rect(x, 'rgba(18,24,36,0.55)', -3.3, -len / 2 + 0.8, 6.6, 1.8);
    rect(x, 'rgba(30,36,48,0.4)', -2.2, -len * 0.12, 4.4, 5);
    rect(x, 'rgba(30,36,48,0.3)', -2.2, len * 0.22, 4.4, 3);
    x.restore();
  }
  function crowd(x, P, R, X, Y, w, h, n, oval) {
    for (let i = 0; i < n; i++) {
      let px, py;
      if (oval) { const a = R() * TAU, d = Math.sqrt(R()); px = X + w / 2 + Math.cos(a) * d * w / 2; py = Y + h / 2 + Math.sin(a) * d * h / 2; }
      else { px = X + R() * w; py = Y + R() * h; }
      x.fillStyle = R.pick(P.crowd); x.fillRect(px - 0.9, py - 0.5, 1.8, 1.7);
      x.fillStyle = 'rgba(18,14,18,0.5)'; x.fillRect(px - 0.5, py - 0.9, 1, 0.9);
    }
  }
  // Outdoor de campanha "VOTE 171" (painel em pé, visto de frente/cima)
  function billboard(x, P, R, X, Y, w, o) {
    o = o || {};
    const ph = Math.round(w * 0.42), z = 6;
    rect(x, P.shadow, X + 2 + z * P.sx, Y - 1, w, 3);
    rect(x, '#1c1f28', X + w * 0.2, Y - z, 1.3, z); rect(x, '#1c1f28', X + w * 0.8 - 1.3, Y - z, 1.3, z);
    const py = Y - z - ph;
    rect(x, '#191c25', X - 1, py - 1, w + 2, ph + 2);
    rect(x, P.board, X, py, w, ph);
    const band = o.band || R.pick(P.bands);
    rect(x, band, X, py, w * 0.36, ph);
    // cabeção genérico do candidato
    circ(x, P.skin, X + w * 0.18, py + ph * 0.58, ph * 0.27);
    rect(x, '#2a2526', X + w * 0.18 - ph * 0.27, py + ph * 0.25, ph * 0.54, ph * 0.16);
    rect(x, 'rgba(25,20,25,0.7)', X + w * 0.18 - ph * 0.12, py + ph * 0.66, ph * 0.24, ph * 0.06);
    const label = o.label || 'VOTE';
    txt(x, label, X + w * 0.68, py + ph * 0.3, Math.max(3, ph * 0.26), P.ink, { maxW: w * 0.6 });
    txt(x, o.num || '171', X + w * 0.68, py + ph * 0.7, Math.max(4, ph * 0.46), band, { maxW: w * 0.6 });
  }
  // asfalto com remendos, bordas e tracejado (período 32 alinhado pela base do bloco)
  function road(x, P, R, X, w, h, lanes, ya, yb) {
    ya = ya || 0; yb = yb == null ? h : yb;
    rect(x, P.asphalt, X, ya, w, yb - ya);
    const n = Math.floor((yb - ya) / 45);
    for (let i = 0; i < n; i++) {
      const pw = R.r(6, w * 0.45), ph = R.r(8, 40);
      rect(x, R() < 0.5 ? P.asphalt2 : P.asphalt3, X + R.r(1, w - pw - 1), R.r(ya + 2, Math.max(ya + 2, yb - ph - 2)), pw, ph);
    }
    rect(x, P.laneEdge, X + 1.5, ya, 1, yb - ya); rect(x, P.laneEdge, X + w - 2.5, ya, 1, yb - ya);
    const lw = w / lanes;
    for (let k = 1; k < lanes; k++) {
      const lx = X + k * lw - 0.5;
      for (let y = h - 23; y > -14; y -= 32) if (y >= ya && y + 14 <= yb) rect(x, P.lane, lx, y, 1, 14);
    }
  }
  // faixa de pedestre atravessando uma pista vertical
  function zebra(x, P, X, w, Y) { for (let xx = X + 2; xx < X + w - 2; xx += 4) rect(x, P.zebra, xx, Y, 2, 9); }
  // estrada desenhada como caminho (curvas): calçada, borda e asfalto
  function roadPath(x, P, pts, w) {
    const path = () => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length - 2; i += 2) { const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2; x.quadraticCurveTo(pts[i], pts[i + 1], mx, my); } x.lineTo(pts[pts.length - 2], pts[pts.length - 1]); };
    x.lineCap = 'butt'; x.lineJoin = 'round';
    path(); x.strokeStyle = P.walk; x.lineWidth = w + 8; x.stroke();
    path(); x.strokeStyle = P.laneEdge2 || P.curb; x.lineWidth = w; x.stroke();
    path(); x.strokeStyle = P.asphalt; x.lineWidth = w - 3; x.stroke();
  }

  // =================================================================
  // Paletas
  // =================================================================
  const PAL = {};
  // Fase 1: hora azul, frio, postes ainda acesos
  PAL.rodoviaria = {
    grass: '#28414a', grass2: '#2c464d', g1: 'rgba(120,170,170,0.05)', g2: 'rgba(0,0,0,0.06)', path: 'rgba(70,60,45,0.28)',
    asphalt: '#212838', asphalt2: '#252c3d', asphalt3: '#1e2433', lane: 'rgba(185,200,225,0.22)', laneEdge: 'rgba(185,200,225,0.13)', zebra: 'rgba(190,200,220,0.2)',
    walk: '#343d52', curb: '#3e485e', plaza: '#374157', plaza2: '#3d475d', lot: '#283040', lotLine: 'rgba(190,200,220,0.14)',
    roof: ['#425072', '#4a5675', '#3c4764', '#4f5a72', '#455a6d'], facade: '#293146', edge: 'rgba(12,16,30,0.45)',
    win: 'rgba(140,170,215,0.14)', winLit: 'rgba(255,196,120,0.40)', litP: 0.3,
    tree: ['#1b3537', '#1f3c3b', '#183133', '#23423f'], treeHi: 'rgba(130,185,170,0.11)', palm: '#1f3c3b',
    shadow: 'rgba(6,10,22,0.3)', sx: 0.45, sy: 0.3,
    cars: ['#6e4450', '#435a7e', '#6f7582', '#5c5f46', '#80704f', '#544868', '#7c828c', '#3d6060'],
    bus: ['#376a8a', '#4b7550', '#8a6038', '#6a4a7a'],
    crowd: ['#5a4f60', '#4c5a6a', '#665a50', '#45524f', '#6e5658', '#7a6e4c', '#4f6470'],
    board: '#8c877c', ink: '#211e26', skin: '#b08a6c', bands: ['#93403c', '#3a5688', '#387a52', '#94762c', '#6a4488'],
    tent: ['#5a4146', '#3b4a62', '#57533a', '#3a564a', '#4a3f5c', '#5a473a'],
    beams: '255,225,170', beamA: 0.1, light: '255,190,120', lightA: 0.09,
    deck: '#3f4961', tower: '#66718b', towerD: '#454e66', water: '#2c4b62',
  };
  // Fase 2: tarde, quente, sombras longas
  PAL.esplanada = {
    grass: '#435b35', lawn: '#466237', lawn2: '#4b683b', g1: 'rgba(210,220,150,0.05)', g2: 'rgba(0,0,0,0.05)', path: 'rgba(110,90,55,0.26)',
    asphalt: '#3d4047', asphalt2: '#42454d', asphalt3: '#383b42', lane: 'rgba(230,228,215,0.24)', laneEdge: 'rgba(230,228,215,0.15)', zebra: 'rgba(230,228,215,0.22)',
    walk: '#5b5a53', curb: '#66655d', plaza: '#625f56', plaza2: '#6a675d', lot: '#47494d', lotLine: 'rgba(230,228,215,0.16)',
    roof: ['#6c7581', '#707985', '#68717c'], facade: '#3b4855', edge: 'rgba(20,24,32,0.38)',
    win: 'rgba(150,190,210,0.28)', winLit: 'rgba(255,215,150,0.32)', litP: 0.08,
    tree: ['#324d2b', '#38572f', '#2d4728'], treeHi: 'rgba(200,220,140,0.12)', palm: '#34502c',
    shadow: 'rgba(18,22,30,0.34)', sx: 0.95, sy: 0.32,
    cars: ['#764646', '#45607c', '#767a82', '#5e6246', '#86744e', '#544868', '#868a90', '#3d5e5a', '#2e3138'],
    bus: ['#3a6e8c', '#4d7a52'],
    crowd: ['#5e5048', '#47525e', '#644e4e', '#4e5a40', '#6e6040', '#4a4a56', '#6a5450'],
    board: '#aaa392', ink: '#24212a', skin: '#c99a76', bands: ['#a8443e', '#3f5f9a', '#3f8a5a', '#a8842e'],
    tent: ['#6a4644', '#3f5068', '#6a623e', '#3f5e4e', '#6a5040'],
    marble: '#7b7a75', marble2: '#666561', glassDark: '#2f3742', water: '#36596a', water2: '#3d6677',
    flagG: '#2f7a46', flagY: '#b89a34', flagB: '#2b4a7a',
    tow: '#80838a', towD: '#62646a', towWin: 'rgba(40,50,64,0.55)',
  };
  // Menu: Esplanada no crepúsculo, janelas acesas
  PAL.menu = Object.assign({}, PAL.esplanada, {
    board: '#5e5a52', skin: '#8a6a52', bands: ['#6a3030', '#2a3f6a', '#2a5a3a', '#6a5420'],
    grass: '#25302d', lawn: '#283530', lawn2: '#2b3833', g1: 'rgba(150,140,200,0.04)', g2: 'rgba(0,0,0,0.06)', path: 'rgba(15,12,10,0.22)',
    asphalt: '#1f2029', asphalt2: '#22232d', asphalt3: '#1c1d26', lane: 'rgba(210,200,220,0.16)', laneEdge: 'rgba(210,200,220,0.1)', zebra: 'rgba(210,200,220,0.14)',
    walk: '#33303b', curb: '#3a3743', plaza: '#35323d', lot: '#25252e', lotLine: 'rgba(210,200,220,0.1)',
    roof: ['#3b3e4e', '#3e4152', '#383b4a'], facade: '#252836', edge: 'rgba(0,0,0,0.4)',
    win: 'rgba(110,120,170,0.14)', winLit: 'rgba(255,196,120,0.55)', litP: 0.45,
    tree: ['#18221f', '#1b2622', '#151e1b'], treeHi: 'rgba(200,150,180,0.06)',
    shadow: 'rgba(0,0,0,0.28)', sx: 0.3, sy: 0.2,
    cars: ['#5a3a44', '#3a4a66', '#5c5f68', '#4a4c3a', '#6a5e48', '#2e3036'],
    crowd: ['#4a4252', '#3e4a56', '#564a44'],
    beams: '255,220,170', beamA: 0.13, light: '255,180,110', lightA: 0.12,
    flagG: '#1f4a30', flagY: '#7a6630', flagB: '#1d2f52',
  });
  // Fase 3: pôr do sol no Lago Paranoá
  PAL.paranoa = {
    water: '#2b3559', water2: '#2f3a60', ripple: 'rgba(160,170,230,0.08)', ripple2: 'rgba(10,10,30,0.12)', shallow: '#384c6c', sand: '#7a6652',
    grass: '#3a4f35', grass2: '#3f5539', g1: 'rgba(255,190,120,0.05)', g2: 'rgba(0,0,0,0.06)', path: 'rgba(90,70,45,0.24)',
    asphalt: '#36363f', asphalt2: '#3a3a44', asphalt3: '#32323a', lane: 'rgba(235,215,190,0.22)', laneEdge: 'rgba(235,215,190,0.14)', zebra: 'rgba(235,215,190,0.2)',
    walk: '#5a5050', curb: '#625858', plaza: '#5a5254', lot: '#40404a', lotLine: 'rgba(235,215,190,0.14)',
    roof: ['#7a4c3e', '#6e5246', '#565a68', '#7d6450', '#5e4a48'], facade: '#47393f', edge: 'rgba(30,15,20,0.4)',
    win: 'rgba(255,190,140,0.18)', winLit: 'rgba(255,200,130,0.4)', litP: 0.2,
    tree: ['#283d27', '#2e452b', '#243824'], treeHi: 'rgba(255,180,110,0.12)', palm: '#2c4329',
    shadow: 'rgba(22,12,30,0.36)', sx: 1.15, sy: 0.22,
    pool: '#3a7a84', poolEdge: '#8a8078', hull: '#aaa49a', hull2: '#7d6e5e', sail: 'rgba(205,195,180,0.75)',
    cars: ['#7a4652', '#46628a', '#7f8592', '#957f57', '#2e3138'],
    crowd: ['#7a6a5c', '#5a6a7a', '#8a6a6a', '#a08a5a'],
    marble: '#958c84', marble2: '#7a726b', glassDark: '#2c2a36', arch: '#bdb2a4', archD: '#8c8278', deck: '#3b3b45',
    emu: '#6e6458',
    beams: '255,215,170', beamA: 0.06, light: '255,180,110', lightA: 0.08,
  };
  // Fase 4: noite, céu vermelho-alaranjado, churrasco do Lule
  PAL.planalto = {
    grass: '#18241f', grass2: '#1b2822', g1: 'rgba(255,170,110,0.03)', g2: 'rgba(0,0,0,0.08)', path: 'rgba(10,8,6,0.22)',
    asphalt: '#1b1c25', asphalt2: '#1f2029', asphalt3: '#18191f', lane: 'rgba(220,200,180,0.16)', laneEdge: 'rgba(220,200,180,0.1)', zebra: 'rgba(220,200,180,0.15)',
    walk: '#2a2833', curb: '#322f3b', plaza: '#282530', plaza2: '#2d2a36', pave: '#292631', paveLine: 'rgba(210,180,170,0.06)', lot: '#202029', lotLine: 'rgba(220,200,180,0.1)',
    roof: ['#33313e', '#393645', '#2f2d39'], facade: '#24222e', edge: 'rgba(0,0,0,0.4)',
    win: 'rgba(110,120,160,0.12)', winLit: 'rgba(255,190,110,0.45)', litP: 0.45,
    tree: ['#14201b', '#17241e', '#121c18'], treeHi: 'rgba(255,160,100,0.06)', palm: '#16221d',
    shadow: 'rgba(0,0,0,0.3)', sx: 0.25, sy: 0.18,
    cars: ['#4a3036', '#2e3a52', '#4a4c56', '#151519', '#151519', '#3a3c2e'],
    crowd: ['#4a4252', '#3e4a56', '#564a44', '#5a3a3a', '#3a4a3a'],
    board: '#6e685e', ink: '#1a181e', skin: '#9a7458', bands: ['#7a2a2a', '#2a3f6a', '#2a5a3a', '#7a6020'],
    tent: ['#5a2e2e', '#2e3e5a', '#5a5028', '#2e5040'],
    marble: '#6e6874', marble2: '#57525e', glassDark: '#1a1822', water: '#1c2433', water2: '#212a3a',
    carpet: '#3e1a24', carpetEdge: 'rgba(190,150,80,0.22)',
    tow: '#5a5866', towD: '#46444f', towWin: 'rgba(255,190,110,0.32)',
    beams: '255,220,170', beamA: 0.14, light: '255,170,100', lightA: 0.085,
    flagG: '#1d5e37', flagY: '#9c8228', flagB: '#203a6c', flagW: '#a8a49a',
  };

  // =================================================================
  // Registro de fases
  // =================================================================
  // def = { pal, speed, first, firstAt, kinds:{nome:{h, paint, over:[y0,y1], paintOver, lanes, park}},
  //         next(S,g,n), traffic:[...], anim(ctx,S,W,H,t), upper(ctx,S,W,H,t), tint:[stops] }
  const STAGES = {};
  function loopPick(S, list, n) {
    let k = list[Math.floor(hash1(n * 7.31 + list.length * 3.7) * list.length) % list.length];
    if (k === S.lastLoop) k = list[(list.indexOf(k) + 1) % list.length];
    S.lastLoop = k;
    return k;
  }

  // =================================================================
  // FASE 1 — RODOVIÁRIA DO PLANO (hora azul)
  // Seção: lado 0–56 | calçada | pista 62–127 (5 faixas) | canteiro 131–229 | pista 233–298 | lado 304–360
  // =================================================================
  function base1(x, P, R, h) {
    rect(x, P.grass, 0, 0, WW, h);
    for (let i = 0; i < h / 50; i++) { const ph = R.r(20, 60); rect(x, P.grass2, R.r(-10, 330), R.r(0, h - ph), R.r(20, 70), ph); }
    speckle(x, R, 0, 0, WW, h, h * 0.6, P.g1, P.g2);
    rect(x, P.walk, 56, 0, 6, h); rect(x, P.walk, 127, 0, 4, h); rect(x, P.walk, 229, 0, 4, h); rect(x, P.walk, 298, 0, 6, h);
    rect(x, P.curb, 61, 0, 1, h); rect(x, P.curb, 127, 0, 1, h); rect(x, P.curb, 232, 0, 1, h); rect(x, P.curb, 298, 0, 1, h);
    road(x, P, R, 62, 65, h, 5);
    road(x, P, R, 233, 65, h, 5);
  }
  function parkingLot(x, P, R, X, Y, w, h) {
    rect(x, P.lot, X, Y, w, h);
    rect(x, P.lotLine, X, Y, w, 1); rect(x, P.lotLine, X, Y + h - 1, w, 1);
    for (let ry = Y + 3; ry + 12 <= Y + h - 2; ry += 18) {
      for (let cx = X + 2; cx + 7 <= X + w - 1; cx += 8) {
        rect(x, P.lotLine, cx, ry, 0.8, 12);
        if (R() < 0.7) car(x, cx + 4.4, ry + 6, R.pick(P.cars), R() < 0.5 ? 0 : Math.PI);
      }
    }
  }
  // preenche uma faixa lateral com estacionamentos, prédios, árvores e outdoors
  function side1(x, P, R, X, w, y0, y1) {
    let y = y0;
    while (y1 - y >= 64) {
      const hh = Math.min(y1 - y, 32 * R.i(2, 5));
      const r = R();
      if (r < 0.28) parkingLot(x, P, R, X + 3, y + 5, w - 6, hh - 10);
      else if (r < 0.62) {
        const z = R.i(8, 16), d = Math.max(16, Math.min(hh - z - 14, R.i(24, 64)));
        box(x, P, X + 5, y + z + 5, w - 13, d, z, { roof: R.pick(P.roof), R });
        roofJunk(x, P, R, X + 5, y + 5, w - 13, d);
        if (hh - d - z > 34) treeC(x, P, R, X + w / 2, y + z + d + 20, 8, 3);
      } else if (r < 0.9) {
        for (let k = 0; k < hh / 36; k++) treeC(x, P, R, X + R.r(12, w - 12), y + R.r(16, hh - 18), 8, R.i(2, 4));
        if (R() < 0.5) trail(x, P, R, X, y + R.r(10, hh - 10), X + w, y + R.r(10, hh - 10));
      } else {
        billboard(x, P, R, X + w / 2 - 20, y + hh * 0.62, 40);
        treeC(x, P, R, X + R.r(10, w - 10), y + hh - 16, 6, 2);
      }
      y += hh;
    }
  }
  // canteiro central (gramado, trilhas, cerrado, outdoors, ponto de ônibus)
  function median1(x, P, R, y0, y1, o) {
    o = o || {};
    const X = 131, w = 98;
    for (let i = 0; i < (y1 - y0) / 120; i++) trail(x, P, R, X + R.r(0, 20), y0 + R.r(10, y1 - y0 - 10), X + w - R.r(0, 20), y0 + R.r(10, y1 - y0 - 10));
    let y = y0 + 20;
    while (y < y1 - 30) {
      if (o.boards !== false && R() < 0.2 && y + 50 < y1) { billboard(x, P, R, X + R.r(14, 40), y + 34, R.pick([44, 52])); y += 60; continue; }
      if (R() < 0.18 && y + 30 < y1) {
        // ponto de ônibus na borda do canteiro, com gente esperando
        const right = R() < 0.5, bx = right ? X + w - 16 : X + 3;
        box(x, P, bx, y + 14, 13, 6, 4, { roof: '#55607a', win: false });
        crowd(x, P, R, bx - 1, y + 16, 15, 6, R.i(4, 9));
        y += 34; continue;
      }
      treeC(x, P, R, X + R.r(16, w - 16), y + R.r(0, 10), R.r(6, 14), R.i(2, 6));
      y += R.r(26, 46);
    }
  }
  function busBay(x, P, R, X, Y, w, h, ang) {
    rect(x, P.plaza, X, Y, w, h);
    rect(x, P.plaza2, X, Y, w, 2); rect(x, P.plaza2, X, Y + h - 2, w, 2);
    const n = Math.floor((w - 8) / 15);
    for (let i = 0; i < n; i++) {
      const bx = X + 10 + i * 15;
      rect(x, 'rgba(255,255,255,0.05)', bx + 5, Y + 4, 3, h - 8); // ilha de embarque
      crowd(x, P, R, bx + 4, Y + 6, 5, h - 12, R.i(2, 7));
      if (R() < 0.8) bus(x, bx, Y + h / 2, R.pick(P.bus), ang, 26);
    }
  }
  function kiosk(x, P, R, X, Y, label, col) {
    box(x, P, X, Y, 18, 8, 5, { roof: col || R.pick(P.tent), win: false });
    for (let i = 0; i < 4; i++) rect(x, 'rgba(255,255,255,0.08)', X + 1 + i * 4.5, Y - 5, 2, 8);
    if (label) txt(x, label, X + 9, Y - 1, 3.6, 'rgba(240,235,220,0.55)', { body: true, w: 800, maxW: 17 });
  }
  // barraca de feira: lona listrada com telhado em pirâmide
  function tent(x, P, R, X, Y, s, col) {
    shadowBox(x, P, X, Y, s, s, 3);
    const ty = Y - 3, m = s / 2;
    rect(x, col, X, ty, s, s);
    for (let i = 1; i < s - 1; i += 3) rect(x, 'rgba(255,255,255,0.05)', X + i, ty, 1.4, s);
    poly(x, 'rgba(0,0,0,0.16)', [X + s, ty, X + s, ty + s, X + m, ty + m]);
    poly(x, 'rgba(0,0,0,0.08)', [X, ty + s, X + s, ty + s, X + m, ty + m]);
    poly(x, 'rgba(255,255,255,0.04)', [X, ty, X + s, ty, X + m, ty + m]);
  }
  // Torre de TV: tripé, fuste em treliça, mirante e antena (vista 3/4, bem alta)
  function torreTV(x, P, cx, by, Ht) {
    x.lineCap = 'round';
    seg(x, P.shadow, 8, cx + 4, by + 2, cx + Ht * P.sx, by + Ht * P.sy);
    seg(x, P.shadow, 16, cx + 12, by + 4, cx + Ht * P.sx * 0.45, by + Ht * P.sy * 0.45);
    ell(x, P.shadow, cx + 8, by + 6, 34, 10);
    const zt = 36, jy = by - zt;
    seg(x, P.towerD, 4, cx, by - 14, cx, jy);       // pé de trás
    seg(x, P.tower, 4.5, cx - 32, by + 6, cx - 3, jy); // pés da frente
    seg(x, P.tower, 4.5, cx + 32, by + 6, cx + 3, jy);
    seg(x, P.towerD, 1.2, cx - 22, by - 2, cx + 22, by - 2);
    const top = by - Ht;
    poly(x, P.tower, [cx - 6, jy, cx + 6, jy, cx + 3.2, top + 40, cx - 3.2, top + 40]);
    poly(x, P.towerD, [cx + 1.5, jy, cx + 6, jy, cx + 3.2, top + 40, cx + 0.8, top + 40]);
    for (let yy = jy - 4; yy > top + 46; yy -= 9) seg(x, 'rgba(20,24,36,0.35)', 0.8, cx - 4, yy, cx + 4, yy - 8);
    const my = by - Ht * 0.45;
    rect(x, P.towerD, cx - 17, my - 2, 34, 7);
    rect(x, P.tower, cx - 17, my - 5, 34, 4);
    rect(x, 'rgba(255,200,130,0.25)', cx - 15, my + 1, 30, 1.5);
    rect(x, P.towerD, cx - 8, top + 36, 16, 5);
    rect(x, P.tower, cx - 8, top + 34, 16, 3);
    seg(x, P.towerD, 2.2, cx, top + 34, cx, top + 4);
    seg(x, P.tower, 1, cx, top + 20, cx, top);
  }
  function fountain(x, P, cx, cy, r) {
    ell(x, P.plaza2, cx, cy, r + 5, (r + 5) * 0.8);
    ell(x, P.water, cx, cy, r, r * 0.8);
    ell(x, 'rgba(150,190,220,0.08)', cx - r * 0.2, cy - r * 0.2, r * 0.6, r * 0.45);
  }

  STAGES.rodoviaria = {
    pal: PAL.rodoviaria, first: 'rodo', firstAt: 0, bossKind: 'torre',
    kinds: {
      // Partida: a plataforma da Rodoviária atravessa o Eixo (as pistas passam por baixo)
      rodo: {
        h: 608, over: [190, 348],
        paint(x, P, R, h, F) {
          base1(x, P, R, h);
          side1(x, P, R, 0, 56, 0, 128); side1(x, P, R, 304, 56, 0, 128);
          median1(x, P, R, 0, 120, { boards: false });
          // baias de ônibus (norte e sul da plataforma)
          busBay(x, P, R, 4, 126, 52, 62, -0.6); busBay(x, P, R, 304, 126, 52, 62, 0.6);
          busBay(x, P, R, 131, 126, 98, 62, -0.6);
          busBay(x, P, R, 4, 352, 52, 62, 0.6); busBay(x, P, R, 304, 352, 52, 62, -0.6);
          busBay(x, P, R, 131, 352, 98, 62, 0.6);
          zebra(x, P, 62, 65, 340); zebra(x, P, 233, 65, 340); zebra(x, P, 62, 65, 420); zebra(x, P, 233, 65, 420);
          median1(x, P, R, 432, h - 10);
          side1(x, P, R, 0, 56, 432, h); side1(x, P, R, 304, 56, 432, h);
        },
        paintOver(x, P, R) {
          const y0 = 196, y1 = 330;
          x.fillStyle = lgrad(x, 0, y1, 0, y1 + 18, [0, 'rgba(5,8,18,0.5)', 1, 'rgba(5,8,18,0)']);
          x.fillRect(0, y1, WW, 18);
          rect(x, P.deck, 0, y0, WW, y1 - y0);
          rect(x, '#4a5470', 0, y0, WW, 3); rect(x, 'rgba(0,0,0,0.3)', 0, y1 - 5, WW, 5);
          for (let i = 0; i < 5; i++) rect(x, 'rgba(150,180,225,0.07)', 12, y0 + 14 + i * 23, 336, 6);
          for (let xx = 30; xx < WW; xx += 30) rect(x, 'rgba(0,0,0,0.1)', xx, y0 + 3, 1, y1 - y0 - 8);
          x.save(); x.globalAlpha = 0.2; txt(x, 'RODOVIÁRIA', 180, (y0 + y1) / 2 + 2, 38, '#c2cbe0'); x.restore();
          crowd(x, P, R, 6, y0 + 6, 348, y1 - y0 - 14, 110);
          kiosk(x, P, R, 24, y0 + 22, 'PASTEL', '#8a5a3a'); kiosk(x, P, R, 52, y0 + 22, 'CALDO', '#3f7a5a');
          kiosk(x, P, R, 290, y0 + 100, 'PASTEL', '#8a4a48'); kiosk(x, P, R, 318, y0 + 100, 'CAFÉ', '#6a4a7a');
          kiosk(x, P, R, 286, y0 + 22, 'CHIP', '#3f5f8a'); kiosk(x, P, R, 40, y0 + 100, 'R$ 1,99', '#8a7a3a');
          billboard(x, P, R, 150, y0 + 26, 60, { label: 'VOTE', num: '171' });
        },
      },
      a: { h: 512, paint(x, P, R, h) { base1(x, P, R, h); median1(x, P, R, 0, h); side1(x, P, R, 0, 56, 0, h); side1(x, P, R, 304, 56, 0, h); } },
      // terminal de ônibus no canteiro
      b: {
        h: 512,
        paint(x, P, R, h) {
          base1(x, P, R, h);
          const y0 = 64, y1 = h - 64;
          rect(x, P.plaza, 131, y0, 98, y1 - y0);
          rect(x, P.plaza2, 131, y0, 98, 2); rect(x, P.plaza2, 131, y1 - 2, 98, 2);
          for (let y = y0 + 20; y < y1 - 20; y += 34) {
            bus(x, 141, y + 8, R.pick(P.bus), 0, 28); if (R() < 0.8) bus(x, 219, y + 10, R.pick(P.bus), Math.PI, 28);
          }
          for (let y = y0 + 12; y < y1 - 30; y += 70) {
            box(x, P, 156, y + 50, 48, 9, 4, { roof: '#4d5874', win: false });
            crowd(x, P, R, 152, y + 6, 56, 54, 50);
          }
          zebra(x, P, 62, 65, y0 - 12); zebra(x, P, 233, 65, y0 - 12); zebra(x, P, 62, 65, y1 + 3); zebra(x, P, 233, 65, y1 + 3);
          median1(x, P, R, 0, y0 - 14, { boards: false }); median1(x, P, R, y1 + 14, h, { boards: false });
          side1(x, P, R, 0, 56, 0, h); side1(x, P, R, 304, 56, 0, h);
        },
      },
      // comício com carro de som no canteiro
      c: {
        h: 448,
        paint(x, P, R, h, F) {
          base1(x, P, R, h);
          const cy = h / 2;
          rect(x, P.plaza, 131, cy - 90, 98, 180);
          crowd(x, P, R, 136, cy - 70, 88, 150, 420, true);
          // carro de som
          box(x, P, 160, cy - 40, 40, 16, 10, { roof: '#5a4a6e', facade: '#2a2236', win: false });
          rect(x, '#1c1a24', 162, cy - 52, 8, 6); rect(x, '#1c1a24', 190, cy - 52, 8, 6);
          rect(x, P.board, 152, cy - 70, 56, 12); rect(x, '#a8443e', 152, cy - 70, 16, 12);
          txt(x, 'VOTE 171', 188, cy - 64, 7, P.ink, { maxW: 38 });
          // bandeirinhas em mastros (animadas)
          for (let i = 0; i < 6; i++) {
            const fx = 140 + R.r(0, 80), fy = cy - 60 + R.r(0, 120);
            seg(x, 'rgba(20,20,30,0.7)', 0.8, fx, fy, fx, fy - 9);
            F.flags.push({ x: fx, y: fy - 9, w: 7, h: 4.5, c: R.pick(P.bands) });
          }
          median1(x, P, R, 0, cy - 96, { boards: false }); median1(x, P, R, cy + 96, h, { boards: false });
          side1(x, P, R, 0, 56, 0, h); side1(x, P, R, 304, 56, 0, h);
        },
      },
      // cruzamento: a via transversal passa POR BAIXO do Eixo (tesourinha)
      d: {
        h: 384,
        paint(x, P, R, h) {
          base1(x, P, R, h);
          const cy = h / 2;
          // via transversal nos lados e no canteiro
          for (const [X0, X1] of [[0, 62], [127, 233], [298, 360]]) {
            rect(x, P.walk, X0, cy - 18, X1 - X0, 36);
            rect(x, P.asphalt, X0, cy - 14, X1 - X0, 28);
            for (let xx = X0 + 4; xx < X1 - 8; xx += 20) rect(x, P.lane, xx, cy - 0.5, 10, 1);
          }
          // sombra das pistas do Eixo sobre a transversal (viaduto)
          for (const X of [62, 233]) { rect(x, 'rgba(0,0,0,0.25)', X + 65, cy - 14, 6, 28); rect(x, 'rgba(0,0,0,0.12)', X - 4, cy - 14, 4, 28); }
          // alças curvas (tesourinhas) nos lados
          x.lineCap = 'butt';
          for (const [cx, s] of [[30, 1], [330, -1]]) {
            x.strokeStyle = P.walk; x.lineWidth = 16; x.beginPath(); x.arc(cx, cy - 46 * s, 32, 0, TAU); x.stroke();
            x.strokeStyle = P.asphalt; x.lineWidth = 11; x.beginPath(); x.arc(cx, cy - 46 * s, 32, 0, TAU); x.stroke();
            treeC(x, P, R, cx, cy - 46 * s, 8, 3);
          }
          median1(x, P, R, 0, cy - 30, { boards: false }); median1(x, P, R, cy + 30, h);
          side1(x, P, R, 0, 56, cy + 30, h); side1(x, P, R, 304, 56, 0, cy - 30);
          billboard(x, P, R, 4, cy + 96, 48, { label: 'CONFIA', num: '171' });
        },
      },
      // Chefão: Torre de TV + Feira da Torre (o Centrão adora uma feira)
      torre: {
        h: 704, park: { local: 420, screen: 160 },
        paint(x, P, R, h, F) {
          base1(x, P, R, h);
          const cx = 180, by = 500;
          // praça da torre no canteiro
          rect(x, P.plaza, 131, 300, 98, 330);
          for (let y = 306; y < 624; y += 16) rect(x, 'rgba(255,255,255,0.025)', 131, y, 98, 1);
          fountain(x, P, cx, 585, 26); F.fount.push({ x: cx, y: 585, r: 26 });
          // feira nos dois lados
          for (const X0 of [2, 304]) {
            rect(x, P.plaza, X0, 250, 54, 400);
            // barracas em fileiras duplas com corredores
            for (let y = 262; y < 630; y += 30) {
              for (const xx of [X0 + 4, X0 + 17, X0 + 33]) if (R() < 0.75) tent(x, P, R, xx, y + 3, 12, R.pick(P.tent));
              for (const xx of [X0 + 4, X0 + 17, X0 + 33]) if (R() < 0.55) tent(x, P, R, xx, y + 16, 12, R.pick(P.tent));
            }
            crowd(x, P, R, X0 + 1, 255, 52, 390, 70);
          }
          kiosk(x, P, R, 140, 318, 'PASTEL', '#8a4a48'); kiosk(x, P, R, 202, 318, 'VOTOS', '#8a7a3a');
          crowd(x, P, R, 136, 330, 88, 290, 50);
          // placas da feira
          rect(x, '#3a3346', 10, 236, 40, 9); txt(x, 'FEIRA DA TORRE', 30, 240.5, 4.2, 'rgba(240,225,200,0.6)', { body: true, w: 800, maxW: 38 });
          rect(x, '#3a3346', 310, 236, 46, 9); txt(x, 'TOMA LÁ, DÁ CÁ', 333, 240.5, 4.2, 'rgba(240,225,200,0.6)', { body: true, w: 800, maxW: 44 });
          torreTV(x, P, cx, by, 210);
          median1(x, P, R, 0, 240, { boards: false });
          side1(x, P, R, 0, 56, 0, 240); side1(x, P, R, 304, 56, 0, 240);
          median1(x, P, R, 640, h, { boards: false });
        },
      },
    },
    next(S, g, n) {
      const f = S.flags;
      if (g && g.boss && !f.boss) { f.boss = true; f.after = false; return 'torre'; }
      if (f.boss && !f.after) { f.after = true; return 'a'; }
      return loopPick(S, ['a', 'b', 'a', 'c', 'd', 'b'], n);
    },
    traffic: [
      { x: 68.5, dir: -1, v: 34, n: 2, bus: true }, { x: 81.5, dir: -1, v: 70, n: 4 }, { x: 94.5, dir: -1, v: 85, n: 3 },
      { x: 107.5, dir: -1, v: 95, n: 3 }, { x: 120.5, dir: -1, v: 105, n: 2 },
      { x: 239.5, dir: 1, v: 75, n: 2 }, { x: 252.5, dir: 1, v: 60, n: 3 }, { x: 265.5, dir: 1, v: 50, n: 4 },
      { x: 278.5, dir: 1, v: 40, n: 3 }, { x: 291.5, dir: 1, v: 26, n: 2, bus: true },
    ],
    upper: 'mist', santinhos: 4,
    tint: [0, 'rgba(255,165,140,0.13)', 0.35, 'rgba(120,130,200,0.04)', 0.7, 'rgba(10,18,50,0.06)', 1, 'rgba(8,14,40,0.2)'],
  };

  // =================================================================
  // FASE 2 — ESPLANADA DOS MINISTÉRIOS (tarde)
  // Seção: via 0–8 | ministérios 12–84 | calçada | pista 92–120 | gramado 120–240 | pista 240–268 | calçada | ministérios 276–348 | via 352–360
  // Alturas dos blocos múltiplas de 64 (faixas do gramado alternam a cada 32).
  // =================================================================
  const MINIS = ['MIN. DO TOMA LÁ DÁ CÁ', 'MIN. DA PICANHA', 'MIN. DO VENTO ESTOCADO', 'MIN. DA META DOBRADA', 'MIN. DAS EMENDAS',
    'MIN. DO SIGILO (100 ANOS)', 'MIN. DO CAFEZINHO', 'MIN. DA RACHADINHA', 'MIN. DO PIX', 'MIN. DAS BLUSINHAS', 'MIN. DO MIMIMI',
    'MIN. DO JET SKI', 'MIN. DO LEITE CONDENSADO', 'MIN. DA MANDIOCA', 'MIN. DO 171', 'MIN. DA MOTOCIATA', 'MIN. DA REUNIÃO INÚTIL',
    'MIN. DO FERIADÃO', 'MIN. DOS MINISTÉRIOS', 'MIN. DA CERVEJINHA', 'MIN. DO CARGO VAGO', 'MIN. DA FILA', 'MIN. DO ASSESSOR DO ASSESSOR',
    'MIN. DO PUXADINHO', 'MIN. DA PAUTA-BOMBA', 'MIN. DO RECESSO', 'MIN. DA SAUDADE', 'MIN. DO CARIMBO'];
  function base2(x, P, R, h, o) {
    o = o || {};
    rect(x, P.grass, 0, 0, WW, h);
    speckle(x, R, 0, 0, WW, h, h * 0.4, P.g1, P.g2);
    for (let y = h - 32, i = 0; y > -32; y -= 32, i++) rect(x, i % 2 ? P.lawn2 : P.lawn, 120, y, 120, 32);
    speckle(x, R, 120, 0, 120, h, h * 0.25, P.g1, P.g2);
    rect(x, P.walk, 84, 0, 8, h); rect(x, P.walk, 268, 0, 8, h);
    road(x, P, R, 92, 28, h, 2); road(x, P, R, 240, 28, h, 2);
    rect(x, P.asphalt, 0, 0, 8, h); rect(x, P.asphalt, 352, 0, 8, h);
    rect(x, P.walk, 8, 0, 3, h); rect(x, P.walk, 349, 0, 3, h);
    // mastros com bandeirinhas ao longo do gramado
    if (o.flags !== false && o.F) {
      for (let y = h - 40; y > 20; y -= 64) {
        for (const fx of [124, 234]) {
          seg(x, 'rgba(20,20,25,0.6)', 0.8, fx, y, fx, y - 10);
          o.F.flags.push({ x: fx, y: y - 10, w: 8, h: 5, br: true });
        }
      }
    }
  }
  function ministry(x, P, R, X, Y, label) {
    const w = 72, d = 15, z = 15;
    box(x, P, X, Y, w, d, z, { roof: R.pick(P.roof), win: P.win, lit: P.winLit, litP: P.litP, R, rowH: 2.6, colW: 3 });
    for (let k = 0; k < 6; k++) rect(x, 'rgba(0,0,0,0.12)', X + 3 + k * 12, Y - z + d - 3, 8, 1.5); // brises
    rect(x, 'rgba(255,255,255,0.05)', X + 2, Y - z + 2, w - 4, 3);
    if (label) txt(x, label, X + w / 2, Y - z + d / 2 + 0.5, 5.6, 'rgba(25,30,40,0.38)', { body: true, w: 800, maxW: w - 6 });
  }
  function ministryRow(x, P, R, side, y0, y1, labels) {
    const X = side < 0 ? 12 : 276;
    let li = 0;
    for (let y = y0 + 30; y + 34 <= y1; y += 64) {
      // estacionamento no vão entre prédios
      const ly = y + 18;
      if (ly + 30 < y1) {
        if (R() < 0.6) {
          rect(x, P.lot, X + 2, ly, 68, 28);
          for (let cx = X + 4; cx + 7 < X + 70; cx += 8) { if (R() < 0.42) car(x, cx + 3.5, ly + 7, R.pick(P.cars), 0); if (R() < 0.42) car(x, cx + 3.5, ly + 21, R.pick(P.cars), Math.PI); }
        } else {
          // jardim com árvores entre os blocos
          for (let k = 0; k < 3; k++) treeC(x, P, R, X + 12 + k * 24 + R.r(-4, 4), ly + 14, 5, 2, 3, 5);
        }
      }
      ministry(x, P, R, X, y, labels ? labels[li++ % labels.length] : null);
    }
  }
  function pickLabels(R, n) { const out = []; for (let i = 0; i < n; i++) out.push(MINIS[Math.floor(R() * MINIS.length)]); return out; }
  // Catedral de Brasília: 16 colunas curvas (coroa), vista 3/4
  function catedral(x, P, R, cx, cy) {
    ell(x, P.plaza, cx, cy, 44, 36);
    ell(x, P.water, cx, cy + 2, 40, 31);
    ell(x, 'rgba(255,255,255,0.05)', cx - 6, cy - 4, 30, 20);
    ell(x, P.shadow, cx + 12, cy + 6, 30, 22);
    const zt = 26, r0 = 30;
    ell(x, '#3d5a74', cx, cy - zt * 0.45, 24, 20);
    ell(x, 'rgba(160,200,220,0.12)', cx - 5, cy - zt * 0.55, 13, 10);
    const cols = [];
    for (let i = 0; i < 16; i++) cols.push(i * TAU / 16);
    cols.sort((a, b) => Math.sin(a) - Math.sin(b)); // de trás para a frente
    for (const a of cols) {
      const bx = cx + Math.cos(a) * r0, byy = cy + Math.sin(a) * r0 * 0.8;
      const tx = cx + Math.cos(a) * 6, ty = cy - zt + Math.sin(a) * 4.5;
      const ox = cx + Math.cos(a) * 12, oy = cy - zt - 7 + Math.sin(a) * 8;
      x.strokeStyle = Math.sin(a) > 0 ? P.marble : P.marble2; x.lineWidth = 2.6; x.lineCap = 'round';
      x.beginPath(); x.moveTo(bx, byy); x.quadraticCurveTo(cx + Math.cos(a) * r0 * 0.45, cy - zt * 0.4 + Math.sin(a) * r0 * 0.5, tx, ty); x.lineTo(ox, oy); x.stroke();
    }
    ell(x, P.marble, cx, cy - zt - 1, 6, 4);
    // campanário
    seg(x, P.shadow, 3, cx + 44, cy - 6, cx + 60, cy);
    rect(x, P.marble2, cx + 40, cy - 34, 4, 30);
    rect(x, P.marble, cx + 38, cy - 36, 8, 3);
  }
  // Museu Nacional: cúpula branca com rampa
  function museu(x, P, cx, cy, r) {
    ell(x, P.shadow, cx + r * 0.5, cy + 4, r * 1.05, r * 0.6);
    ell(x, P.marble2, cx, cy, r, r * 0.62);
    x.fillStyle = lgrad(x, cx - r, cy - r, cx + r, cy + r * 0.3, [0, P.marble, 1, P.marble2]);
    x.beginPath(); x.ellipse(cx, cy - r * 0.18, r, r * 0.8, 0, Math.PI, 0); x.ellipse(cx, cy, r, r * 0.62, 0, 0, Math.PI); x.fill();
    x.strokeStyle = 'rgba(40,40,50,0.35)'; x.lineWidth = 1.6;
    x.beginPath(); x.ellipse(cx, cy - r * 0.1, r * 1.04, r * 0.7, 0, 0.1, 2.4); x.stroke();
  }
  // Itamaraty / Palácio da Justiça: caixa com arcos na fachada sobre espelho d'água
  function arcPalace(x, P, R, X, Y, w, d, z, falls) {
    rect(x, P.water, X - 8, Y - z - 8, w + 16, d + z + 26);
    rect(x, 'rgba(255,255,255,0.04)', X - 8, Y - z - 8, w + 16, 2);
    shadowBox(x, P, X, Y, w, d, z);
    const fy = Y + d - z;
    rect(x, P.glassDark, X, fy, w, z);
    const n = Math.floor(w / 6);
    for (let i = 0; i <= n; i++) rect(x, P.marble, X + i * (w / n) - 0.8, fy, 1.6, z);
    x.fillStyle = P.marble;
    for (let i = 0; i < n; i++) { const a0 = X + i * (w / n); x.beginPath(); x.moveTo(a0, fy); x.lineTo(a0 + w / n, fy); x.lineTo(a0 + w / n, fy + 3); x.quadraticCurveTo(a0 + w / n / 2, fy - 1, a0, fy + 3); x.fill(); }
    if (falls) for (let i = 0; i < n; i += 2) rect(x, 'rgba(200,225,235,0.22)', X + i * (w / n) + 2, fy + 3, 2, z - 1);
    rect(x, P.marble, X - 2, Y - z - 1, w + 4, d + 1);
    rect(x, 'rgba(0,0,0,0.08)', X + 4, Y - z + 3, w - 8, d - 6);
    // reflexo na água
    rect(x, 'rgba(255,255,255,0.05)', X + 4, Y + d + 2, w - 8, 6);
  }
  // Congresso Nacional: torres em H, plataforma, cúpula (Senado) e cuia (Câmara)
  function congresso(x, P, R, cx, by, night) {
    // espelho d'água na frente
    rect(x, P.walk, cx - 140, by + 6, 280, 48);
    rect(x, P.water, cx - 136, by + 10, 272, 40);
    rect(x, 'rgba(255,255,255,0.05)', cx - 136, by + 10, 272, 2);
    for (const tx of [cx - 14, cx + 14]) rect(x, night ? 'rgba(255,190,110,0.1)' : 'rgba(220,225,230,0.08)', tx - 7, by + 14, 14, 30);
    // torres gêmeas (bem altas): sombra longa
    const tw = 16, td = 12, tz = 118, ty = by - 98;
    for (const tx of [cx - 23, cx + 7]) shadowBox(x, P, tx, ty, tw, td, tz);
    for (const tx of [cx - 23, cx + 7]) {
      const fy = ty + td - tz;
      rect(x, P.tow, tx, fy, tw, tz);
      for (let yy = fy + 3; yy < ty + td - 2; yy += 3.6) {
        x.fillStyle = P.towWin; x.fillRect(tx + 1.5, yy, tw - 3, 1.6);
        if (night && R() < 0.35) { x.fillStyle = 'rgba(255,200,120,0.35)'; x.fillRect(tx + 1.5 + R.i(0, 3) * 3, yy, 3, 1.6); }
      }
      rect(x, 'rgba(0,0,0,0.14)', tx + tw - 4, fy, 4, tz);
      rect(x, P.towD, tx, fy - td, tw, td);
      rect(x, 'rgba(255,255,255,0.08)', tx, fy - td, tw, 1);
    }
    // passarela que forma o H
    const hy = ty + td - 64;
    rect(x, P.tow, cx - 7, hy, 14, 10);
    for (let yy = hy + 2; yy < hy + 9; yy += 3.6) rect(x, P.towWin, cx - 6, yy, 12, 1.6);
    rect(x, P.towD, cx - 7, hy - 3, 14, 3);
    // plataforma (Anexo/plenários): baixa e larga
    const pw = 300, pd = 70, pz = 12, px = cx - pw / 2, py = by - pd;
    shadowBox(x, P, px, py, pw, pd, pz);
    rect(x, P.glassDark, px, by - pz, pw, pz);
    for (let xx = px + 4; xx < px + pw - 2; xx += 9) rect(x, P.marble2, xx, by - pz, 1.4, pz);
    if (night) for (let xx = px + 6; xx < px + pw - 6; xx += 9) if (R() < 0.6) rect(x, 'rgba(255,190,110,0.3)', xx, by - pz + 2, 6, pz - 4);
    rect(x, P.marble, px, py - pz, pw, pd);
    rect(x, 'rgba(255,255,255,0.06)', px, py - pz, pw, 2);
    for (let yy = py - pz + 10; yy < by - pz - 4; yy += 12) rect(x, 'rgba(0,0,0,0.04)', px + 4, yy, pw - 8, 1);
    // rampa de acesso ao teto
    poly(x, P.marble2, [cx - 74, by - pz, cx - 44, by - pz, cx - 40, by + 22, cx - 78, by + 22]);
    poly(x, 'rgba(0,0,0,0.12)', [cx - 44, by - pz, cx - 40, by + 22, cx - 37, by + 22, cx - 41, by - pz]);
    // Senado: cúpula (esquerda)
    const sx = cx - 76, sy = py - pz + 38;
    ell(x, 'rgba(0,0,0,0.18)', sx + 8, sy + 4, 30, 16);
    x.fillStyle = lgrad(x, sx - 28, sy - 30, sx + 24, sy + 10, [0, night ? '#7a7584' : '#8f8d87', 1, night ? '#4a4652' : '#6a6964']);
    x.beginPath(); x.ellipse(sx, sy, 28, 16, 0, 0, Math.PI); x.ellipse(sx, sy - 4, 28, 22, 0, Math.PI, 0); x.fill();
    ell(x, 'rgba(255,255,255,0.08)', sx - 8, sy - 14, 10, 5);
    // Câmara: cuia (direita) — pé estreito e borda larga
    const kx = cx + 76, ky = py - pz + 40;
    ell(x, 'rgba(0,0,0,0.18)', kx + 12, ky + 4, 40, 14);
    ell(x, P.marble2, kx, ky, 12, 6);
    x.fillStyle = night ? '#4f4b58' : '#7a7974';
    x.beginPath(); x.moveTo(kx - 48, ky - 18); x.quadraticCurveTo(kx - 30, ky + 6, kx - 12, ky); x.lineTo(kx + 12, ky); x.quadraticCurveTo(kx + 30, ky + 6, kx + 48, ky - 18); x.closePath(); x.fill();
    ell(x, night ? '#6e6a78' : '#8d8b85', kx, ky - 18, 48, 15);
    x.fillStyle = lgrad(x, kx, ky - 30, kx, ky - 6, [0, night ? '#3a3742' : '#5e5d59', 1, night ? '#5a5664' : '#8a8984']);
    x.beginPath(); x.ellipse(kx, ky - 17.5, 44, 12.5, 0, 0, TAU); x.fill();
  }

  STAGES.esplanada = {
    pal: PAL.esplanada, first: 'catedral', firstAt: 0, bossKind: 'congresso',
    kinds: {
      catedral: {
        h: 640,
        paint(x, P, R, h, F) {
          base2(x, P, R, h, { F });
          // lado esquerdo: Catedral; lado direito: Museu Nacional e Biblioteca
          rect(x, P.plaza, 12, 250, 72, 190);
          catedral(x, P, R, 46, 360);
          crowd(x, P, R, 14, 395, 68, 40, 50);
          rect(x, P.plaza, 276, 250, 72, 220);
          museu(x, P, 312, 320, 30);
          box(x, P, 282, 440, 60, 20, 16, { roof: '#6a737e', facade: '#2e3640', win: 'rgba(20,20,25,0.5)', rowH: 4, colW: 2 });
          ministryRow(x, P, R, -1, 440, h, pickLabels(R, 4)); ministryRow(x, P, R, 1, 470, h, pickLabels(R, 4));
          ministryRow(x, P, R, -1, 0, 250, pickLabels(R, 4)); ministryRow(x, P, R, 1, 0, 250, pickLabels(R, 4));
          for (let i = 0; i < 4; i++) trail(x, P, R, 122, R.r(20, h - 20), 238, R.r(20, h - 20));
          crowd(x, P, R, 130, 300, 100, 120, 40);
        },
      },
      a: {
        h: 512,
        paint(x, P, R, h, F) {
          base2(x, P, R, h, { F });
          ministryRow(x, P, R, -1, 0, h, pickLabels(R, 8)); ministryRow(x, P, R, 1, 0, h, pickLabels(R, 8));
          for (let i = 0; i < 3; i++) trail(x, P, R, 122, R.r(20, h - 20), 238, R.r(20, h - 20));
          for (let i = 0; i < 3; i++) crowd(x, P, R, R.r(130, 210), R.r(30, h - 50), 18, 18, R.i(3, 9));
        },
      },
      // manifestação dividida por grade (cada lado com sua bandeira)
      b: {
        h: 512,
        paint(x, P, R, h, F) {
          base2(x, P, R, h, { F });
          ministryRow(x, P, R, -1, 0, h, pickLabels(R, 8)); ministryRow(x, P, R, 1, 0, h, pickLabels(R, 8));
          const y0 = 150, y1 = 370;
          for (let y = y0; y < y1; y += 4) rect(x, 'rgba(200,200,190,0.28)', 179.5, y, 1, 2.5);
          crowd(x, P, R, 126, y0 + 6, 48, y1 - y0 - 12, 230);
          crowd(x, P, R, 186, y0 + 6, 48, y1 - y0 - 12, 230);
          for (let i = 0; i < 6; i++) {
            const lx = 130 + R.r(0, 40), rx = 190 + R.r(0, 40), fy = y0 + 20 + R.r(0, y1 - y0 - 40);
            seg(x, 'rgba(20,20,25,0.6)', 0.8, lx, fy, lx, fy - 9); F.flags.push({ x: lx, y: fy - 9, w: 7, h: 4.5, br: true });
            seg(x, 'rgba(20,20,25,0.6)', 0.8, rx, fy + 8, rx, fy - 1); F.flags.push({ x: rx, y: fy - 1, w: 7, h: 4.5, c: '#7a3636' });
          }
          rect(x, P.board, 126, y0 - 14, 50, 9); txt(x, 'FORA TODOS', 151, y0 - 9.5, 5, P.ink, { maxW: 46 });
          rect(x, P.board, 186, y0 - 14, 50, 9); txt(x, 'FORA TODOS', 211, y0 - 9.5, 5, P.ink, { maxW: 46 });
        },
      },
      // fila gigante para o protocolo (senha 171)
      c: {
        h: 512,
        paint(x, P, R, h, F) {
          base2(x, P, R, h, { F });
          ministryRow(x, P, R, -1, 0, h, pickLabels(R, 8)); ministryRow(x, P, R, 1, 0, h, pickLabels(R, 8));
          box(x, P, 150, 140, 60, 18, 7, { roof: P.roof[1], facade: P.facade, win: false });
          rect(x, P.board, 152, 112, 56, 9); txt(x, 'PROTOCOLO · SENHA 171', 180, 116.5, 4.4, P.ink, { body: true, w: 800, maxW: 54 });
          // a fila serpenteia pelo gramado
          x.strokeStyle = 'rgba(0,0,0,0.0)';
          let px = 180, py = 162;
          for (let i = 0; i < 200; i++) {
            const k = i / 200;
            const fx = 180 + Math.sin(k * 16) * 44, fy = 162 + k * 300;
            x.fillStyle = R.pick(P.crowd); x.fillRect(fx + R.r(-1.2, 1.2) - 0.8, fy + R.r(-1, 1), 1.6, 1.6);
            px = fx; py = fy;
          }
          crowd(x, P, R, px - 10, py, 20, 10, 12);
        },
      },
      itamaraty: {
        h: 512,
        paint(x, P, R, h, F) {
          base2(x, P, R, h, { F });
          rect(x, P.grass, 0, 160, 92, 230); rect(x, P.grass, 268, 160, 92, 230);
          arcPalace(x, P, R, 14, 280, 68, 46, 16, false);
          arcPalace(x, P, R, 278, 280, 68, 46, 16, true);
          treeC(x, P, R, 30, 370, 10, 4); treeC(x, P, R, 330, 370, 10, 4);
          ministryRow(x, P, R, -1, 384, h, pickLabels(R, 2)); ministryRow(x, P, R, 1, 384, h, pickLabels(R, 2));
          ministryRow(x, P, R, -1, 0, 160, pickLabels(R, 2)); ministryRow(x, P, R, 1, 0, 160, pickLabels(R, 2));
          for (let i = 0; i < 3; i++) trail(x, P, R, 122, R.r(20, h - 20), 238, R.r(20, h - 20));
        },
      },
      // Chefão: Congresso Nacional
      congresso: {
        h: 768, park: { local: 404, screen: 128 }, lanes: [[650, 768]],
        paint(x, P, R, h, F) {
          rect(x, P.grass, 0, 0, WW, h);
          speckle(x, R, 0, 0, WW, h, h * 0.4, P.g1, P.g2);
          // gramado central chega até o espelho d'água
          for (let y = h - 32, i = 0; y > 600; y -= 32, i++) rect(x, i % 2 ? P.lawn2 : P.lawn, 120, y, 120, 32);
          rect(x, P.lawn, 60, 560, 240, 50);
          // pistas que contornam o Congresso e voltam ao eixo lá em cima
          roadPath(x, P, [106, h + 4, 106, 650, 106, 600, 30, 540, 26, 420, 26, 300, 30, 200, 106, 140, 106, 90, 106, -4], 28);
          roadPath(x, P, [254, h + 4, 254, 650, 254, 600, 330, 540, 334, 420, 334, 300, 330, 200, 254, 140, 254, 90, 254, -4], 28);
          for (let y = h - 23; y > 650; y -= 32) { rect(x, P.lane, 105.5, y, 1, 14); rect(x, P.lane, 253.5, y, 1, 14); }
          for (let y = h - 23 - 32 * Math.ceil((h - 23 - 90) / 32); y > -14; y -= 32) { if (y < 80) { rect(x, P.lane, 105.5, y, 1, 14); rect(x, P.lane, 253.5, y, 1, 14); } }
          rect(x, P.asphalt, 0, 0, 8, h); rect(x, P.asphalt, 352, 0, 8, h);
          // gramado/praça atrás
          for (let i = 0; i < 6; i++) treeC(x, P, R, R.r(130, 230), R.r(30, 220), 10, R.i(3, 6));
          for (let i = 0; i < 6; i++) { treeC(x, P, R, R.r(46, 70), R.r(200, 560), 8, 3); treeC(x, P, R, R.r(290, 314), R.r(200, 560), 8, 3); }
          congresso(x, P, R, 180, 556, false);
          crowd(x, P, R, 70, 612, 220, 30, 60);
          for (let i = 0; i < 3; i++) trail(x, P, R, 122, R.r(640, h - 20), 238, R.r(640, h - 20));
        },
      },
      after: {
        h: 512,
        paint(x, P, R, h, F) { base2(x, P, R, h, { F }); ministryRow(x, P, R, -1, 0, h, pickLabels(R, 8)); ministryRow(x, P, R, 1, 0, h, pickLabels(R, 8)); },
      },
    },
    next(S, g, n) {
      const f = S.flags;
      if (g && g.boss && !f.boss) { f.boss = true; f.after = false; return 'congresso'; }
      if (f.boss && !f.after) { f.after = true; return 'after'; }
      if (g && g.t > 110 && !f.ita && !f.boss) { f.ita = true; return 'itamaraty'; }
      return loopPick(S, ['a', 'b', 'a', 'c'], n);
    },
    traffic: [
      { x: 99, dir: -1, v: 80, n: 4 }, { x: 113, dir: -1, v: 60, n: 4 },
      { x: 247, dir: 1, v: 55, n: 4 }, { x: 261, dir: 1, v: 35, n: 3 },
    ],
    upper: 'clouds',
    tint: [0, 'rgba(255,200,120,0.12)', 0.5, 'rgba(255,190,110,0.05)', 1, 'rgba(60,40,30,0.1)'],
  };

  // Menu: a Esplanada no crepúsculo, bem devagar
  STAGES.menu = {
    pal: PAL.menu, first: 'a', firstAt: 0, speed: 0.45,
    kinds: { a: STAGES.esplanada.kinds.a, after: STAGES.esplanada.kinds.after },
    next(S, g, n) { return n % 2 ? 'after' : 'a'; },
    traffic: [
      { x: 99, dir: -1, v: 70, n: 4 }, { x: 113, dir: -1, v: 50, n: 3 },
      { x: 247, dir: 1, v: 45, n: 4 }, { x: 261, dir: 1, v: 30, n: 3 },
    ],
    upper: 'dusk', santinhos: 4, lamps: true,
    tint: [0, 'rgba(255,120,90,0.2)', 0.25, 'rgba(150,60,120,0.12)', 0.6, 'rgba(30,20,70,0.1)', 1, 'rgba(5,5,20,0.4)'],
  };

  // =================================================================
  // FASE 3 — LAGO PARANOÁ (pôr do sol)
  // Margens nas bordas dos blocos sempre em x=66 (esq.) e x=294 (dir.).
  // =================================================================
  // margem: x(y) volta exatamente para "base" em y=0 e y=per (encaixe sem emenda).
  // from='bottom' mede a partir da base do bloco (para blocos cuja base encosta no lago padrão).
  function shoreFn(R, base, per, dir, h, from) {
    const a1 = R.r(-14, 24), a2 = R.r(-9, 9), k2 = R.i(2, 3);
    const f = (y) => base + dir * (a1 * (1 - Math.cos(TAU * y / per)) / 2 + a2 * (1 - Math.cos(TAU * k2 * y / per)) / 2);
    return from === 'bottom' ? (y) => f(h - y) : f;
  }
  function landPoly(x, c, fx, h, left, y0, y1, grow) {
    y0 = y0 || 0; y1 = y1 == null ? h : y1; grow = grow || 0;
    x.fillStyle = c; x.beginPath();
    // passa 2 px das bordas do bloco para não deixar fresta antisserrilhada na emenda
    x.moveTo(left ? -2 : WW + 2, y0 - 2);
    x.lineTo(fx(y0) + (left ? grow : -grow), y0 - 2);
    for (let y = y0; y <= y1 + 0.1; y += 6) x.lineTo(fx(Math.min(y, y1)) + (left ? grow : -grow), Math.min(y, y1));
    x.lineTo(fx(y1) + (left ? grow : -grow), y1 + 2);
    x.lineTo(left ? -2 : WW + 2, y1 + 2); x.closePath(); x.fill();
  }
  function waterBase(x, P, R, h, y0, y1) {
    y0 = y0 || 0; y1 = y1 == null ? h : y1;
    rect(x, P.water, 0, y0, WW, y1 - y0);
    for (let i = 0; i < (y1 - y0) / 22; i++) { const ry = R.r(5, 14), cy = R.r(y0 + ry, Math.max(y0 + ry, y1 - ry)); ell(x, P.water2, R.r(0, WW), cy, R.r(30, 80), ry); }
    for (let i = 0; i < (y1 - y0) * 0.7; i++) rect(x, R() < 0.7 ? P.ripple : P.ripple2, R.r(0, WW), R.r(y0, y1 - 2), R.r(4, 14), 1);
  }
  function glints(R, F, h, xl, xr, n, y0, y1) {
    y0 = y0 || 0; y1 = y1 == null ? h : y1;
    for (let i = 0; i < n; i++) {
      const y = R.r(y0 + 4, y1 - 4);
      const a = xl ? xl(y) + 8 : 10, b = xr ? xr(y) - 8 : WW - 10;
      if (b - a < 10) continue;
      F.glints.push({ x: R.r(a, b - 10), y, w: R.r(5, 13), p: R() * TAU, s: R.r(1.2, 2.6) });
    }
  }
  function boatShape(x, P, X, Y, len, ang, col) {
    x.save(); x.translate(X, Y); x.rotate(ang);
    const w = len * 0.36;
    x.fillStyle = P.shadow; x.beginPath(); x.moveTo(len / 2 + 2, 2); x.quadraticCurveTo(0, w + 2, -len / 2 + 2, w * 0.6 + 2); x.lineTo(-len / 2 + 2, -w * 0.6 + 2); x.quadraticCurveTo(0, -w + 2, len / 2 + 2, 2); x.fill();
    x.fillStyle = col || P.hull; x.beginPath(); x.moveTo(len / 2, 0); x.quadraticCurveTo(0, w, -len / 2, w * 0.6); x.lineTo(-len / 2, -w * 0.6); x.quadraticCurveTo(0, -w, len / 2, 0); x.fill();
    rect(x, P.hull2, -len * 0.25, -w * 0.4, len * 0.35, w * 0.8);
    x.restore();
  }
  function sailboat(x, P, X, Y, ang) {
    boatShape(x, P, X, Y, 12, ang);
    x.save(); x.translate(X, Y - 4); x.rotate(ang);
    poly(x, P.sail, [-4, 0, 5, -0.5, -4, -3]);
    x.restore();
  }
  function hipRoof(x, P, X, Y, w, d, z, col) {
    shadowBox(x, P, X, Y, w, d, z);
    rect(x, P.facade, X, Y + d - z, w, z);
    rect(x, 'rgba(255,200,140,0.12)', X + 2, Y + d - z + 1, 2, 2); rect(x, 'rgba(255,200,140,0.12)', X + w - 5, Y + d - z + 1, 2, 2);
    const ry = Y - z;
    rect(x, col, X - 1, ry, w + 2, d);
    poly(x, 'rgba(255,220,180,0.1)', [X - 1, ry, X + w + 1, ry, X + w - d / 2, ry + d / 2, X + d / 2, ry + d / 2]);
    poly(x, 'rgba(0,0,0,0.12)', [X + d / 2, ry + d / 2, X + w - d / 2, ry + d / 2, X + w + 1, ry + d, X - 1, ry + d]);
    seg(x, 'rgba(0,0,0,0.2)', 0.7, X + d / 2, ry + d / 2, X + w - d / 2, ry + d / 2);
  }
  // casarão à beira do lago com piscina, deque e píer
  function mansion(x, P, R, F, xs, y, left) {
    const landW = left ? xs : WW - xs;
    if (landW < 40 || R() < 0.18) { for (let k = 0; k < 3; k++) treeC(x, P, R, left ? R.r(8, Math.max(9, xs - 10)) : R.r(xs + 10, WW - 8), y + R.r(-16, 16), 8, 3); return; }
    if (R() < 0.15) { // quadra de tênis
      const tx = left ? R.r(6, Math.max(7, xs - 34)) : R.r(xs + 8, WW - 34);
      rect(x, '#3d5a52', tx, y - 12, 26, 18); x.strokeStyle = 'rgba(220,220,210,0.25)'; x.lineWidth = 0.7; x.strokeRect(tx + 2.5, y - 9.5, 21, 13); seg(x, 'rgba(220,220,210,0.25)', 0.7, tx + 13, y - 9.5, tx + 13, y + 3.5);
      treeC(x, P, R, left ? tx + 6 : tx + 20, y + 16, 6, 2);
      return;
    }
    const hw = R.i(20, 26), hd = R.i(12, 15), hz = R.i(5, 7);
    const hx = left ? R.r(4, Math.max(4, xs - hw - 22)) : R.r(xs + 18, Math.max(xs + 18, WW - hw - 4));
    // gramado do lote com cerca viva
    const lx0 = left ? 0 : xs - 2, lx1 = left ? xs + 2 : WW;
    rect(x, 'rgba(255,220,160,0.03)', lx0, y - 26, lx1 - lx0, 54);
    hipRoof(x, P, hx, y - 4, hw, hd, hz, R.pick(P.roof));
    // piscina entre a casa e a água
    const pw = R.i(9, 13), ph = R.i(5, 7);
    const pxx = left ? Math.min(xs - pw - 4, hx + hw + 3) : Math.max(xs + 4, hx - pw - 3);
    rrect(x, P.poolEdge, pxx - 1.5, y + 6, pw + 3, ph + 3, 1.5);
    rrect(x, P.pool, pxx, y + 7.5, pw, ph, 1.2);
    rect(x, 'rgba(255,255,255,0.08)', pxx + 1, y + 8, pw - 2, 1);
    palm(x, P, left ? hx - 2 : hx + hw + 4, y - 14, 6);
    if (R() < 0.7) treeC(x, P, R, left ? R.r(6, 20) : R.r(WW - 20, WW - 6), y + 16, 6, 2);
    // píer com lancha
    const pl = R.r(14, 24), pyy = y + R.r(-12, 12);
    rect(x, P.shadow, left ? xs + 1 : xs - pl + 1, pyy + 1.5, pl, 3);
    rect(x, P.hull2, left ? xs - 2 : xs - pl + 2, pyy, pl, 2.6);
    if (R() < 0.75) boatShape(x, P, left ? xs + pl * 0.6 : xs - pl * 0.6, pyy + 6, R.r(10, 15), R.r(-0.2, 0.2) + (left ? 0 : Math.PI));
  }
  function shores(x, P, R, h, F, xl, xr, o) {
    o = o || {};
    // margem: raso → areia → terra
    landPoly(x, P.shallow, xl, h, true, 0, h, 6); landPoly(x, P.shallow, xr, h, false, 0, h, 6);
    landPoly(x, P.sand, xl, h, true, 0, h, 2); landPoly(x, P.sand, xr, h, false, 0, h, 2);
    landPoly(x, P.grass, xl, h, true); landPoly(x, P.grass, xr, h, false);
    speckle(x, R, 0, 0, 70, h, h * 0.15, P.g1, P.g2); speckle(x, R, 290, 0, 70, h, h * 0.15, P.g1, P.g2);
    // avenida da orla (beira do bloco)
    rect(x, P.asphalt, 0, 0, 7, h); rect(x, P.asphalt, 353, 0, 7, h);
    if (o.lots !== false) {
      for (let y = 40; y < h - 34; y += R.r(58, 74)) mansion(x, P, R, F, xl(y), y, true);
      for (let y = 70; y < h - 34; y += R.r(58, 74)) mansion(x, P, R, F, xr(y), y, false);
    }
  }
  function lakeChunk(x, P, R, h, F, extra) {
    const xl = shoreFn(R, 66, h, 1), xr = shoreFn(R, 294, h, -1);
    waterBase(x, P, R, h);
    if (extra) extra(xl, xr);
    shores(x, P, R, h, F, xl, xr);
    glints(R, F, h, xl, xr, Math.round(h * 0.13));
    return { xl, xr };
  }

  STAGES.paranoa = {
    pal: PAL.paranoa, first: 'shore', firstAt: 0, bossKind: 'alvorada',
    kinds: {
      // partida: a orla da cidade (Pontão) e o lago se abrindo à frente
      shore: {
        h: 544, lanes: [[0, 330]],
        paint(x, P, R, h, F) {
          const xl = shoreFn(R, 66, h * 2.2, 1), xr = shoreFn(R, 294, h * 2.2, -1);
          rect(x, P.grass, 0, 0, WW, h);
          speckle(x, R, 0, 0, WW, h, h * 0.4, P.g1, P.g2);
          // água: das margens padrão no topo até a orla curva em y≈330
          const water = (grow, c) => {
            x.fillStyle = c; x.beginPath();
            x.moveTo(xl(0) - grow, -1);
            for (let y = 0; y <= 260; y += 6) x.lineTo(xl(y) - grow, y);
            x.quadraticCurveTo(xl(300) - grow, 330 + grow, 140, 336 + grow);
            x.quadraticCurveTo(180, 344 + grow, 220, 334 + grow);
            x.quadraticCurveTo(xr(300) + grow, 330 + grow, xr(260) + grow, 260);
            for (let y = 260; y >= 0; y -= 6) x.lineTo(xr(y) + grow, y);
            x.lineTo(xr(0) + grow, -1); x.closePath(); x.fill();
          };
          water(4, P.sand); water(0, P.shallow); water(-6, P.water);
          for (let i = 0; i < 60; i++) rect(x, P.ripple, R.r(90, 270), R.r(4, 300), R.r(4, 12), 1);
          // avenida da orla
          rect(x, P.walk, 0, 400, WW, 36); road(x, P, R, 0, WW, h, 1, 404, 432);
          for (let xx = 6; xx < WW; xx += 24) rect(x, P.lane, xx, 417.5, 12, 1);
          // Pontão: restaurantes com decks sobre a água
          for (const [px, w] of [[96, 40], [160, 40], [224, 40]]) {
            rect(x, P.hull2, px + w / 2 - 2, 330, 4, 34);
            box(x, P, px, 380, w, 18, 6, { roof: R.pick(P.roof), R, win: 'rgba(255,190,140,0.2)' });
            rect(x, 'rgba(120,90,60,0.6)', px - 4, 362, w + 8, 6);
            crowd(x, P, R, px - 2, 360, w + 4, 8, 14);
          }
          for (let y = 30; y < 260; y += 70) { mansion(x, P, R, F, xl(y), y, true); mansion(x, P, R, F, xr(y + 30), y + 30, false); }
          for (let i = 0; i < 8; i++) palm(x, P, R.r(10, 350), R.r(445, h - 20), R.r(5, 7));
          for (let i = 0; i < 6; i++) treeC(x, P, R, R.r(10, 350), R.r(450, h - 20), 8, 3);
          parkingLot(x, P, R, 120, 448, 120, 40);
          sailboat(x, P, 150, 200, 0.4); sailboat(x, P, 205, 120, -0.3); boatShape(x, P, 180, 290, 14, 1.2);
          glints(R, F, h, xl, xr, 40, 0, 290);
        },
      },
      a: { h: 512, paint(x, P, R, h, F) { lakeChunk(x, P, R, h, F, () => { sailboat(x, P, R.r(120, 240), R.r(60, 450), R.r(-0.6, 0.6)); }); } },
      // marina com píeres em pente
      b: {
        h: 512,
        paint(x, P, R, h, F) {
          lakeChunk(x, P, R, h, F, (xl, xr) => {
            const y0 = 140;
            for (let i = 0; i < 4; i++) {
              const y = y0 + i * 40, xs = xr(y);
              rect(x, P.hull2, xs - 46, y, 48, 3);
              for (let k = 0; k < 5; k++) { boatShape(x, P, xs - 40 + k * 9, y - 6, 10, -Math.PI / 2); if (R() < 0.8) boatShape(x, P, xs - 40 + k * 9, y + 9, 10, Math.PI / 2); }
            }
            sailboat(x, P, R.r(110, 170), R.r(60, 450), R.r(-0.6, 0.6));
          });
        },
      },
      // ilhota no meio do lago
      c: {
        h: 512,
        paint(x, P, R, h, F) {
          lakeChunk(x, P, R, h, F, () => {
            const ix = R.r(130, 210), iy = R.r(180, 330);
            ell(x, P.shallow, ix, iy, 40, 30); ell(x, P.sand, ix, iy, 33, 24); ell(x, P.grass, ix, iy, 30, 21);
            for (let i = 0; i < 5; i++) treeC(x, P, R, ix + R.r(-18, 18), iy + R.r(-10, 10), 6, 3);
            F.island = { x: ix, y: iy, r: 42 };
          });
          if (F.island) F.glints = F.glints.filter((g) => Math.hypot(g.x - F.island.x, (g.y - F.island.y) * 1.3) > F.island.r);
        },
      },
      // Ponte JK: três arcos assimétricos cruzando o tabuleiro na diagonal
      jk: {
        h: 480, over: [160, 268],
        paint(x, P, R, h, F) {
          const L = lakeChunk(x, P, R, h, F);
          F.glints = F.glints.filter((g) => g.y < 210 || g.y > 270);
          const dy0 = 226, dy1 = 244;
          // sombras do tabuleiro e dos arcos na água
          rect(x, P.shadow, 0, dy1 + 3, WW, 9);
          for (const [a, b] of [[22, 132], [132, 242], [242, 352]]) {
            x.strokeStyle = P.shadow; x.lineWidth = 5; x.beginPath();
            for (let i = 0; i <= 24; i++) {
              const u = i / 24, gx = a + (b - a) * u, gy = dy1 + (dy0 - dy1) * u, z = Math.sin(u * Math.PI) * 58 * (1 - 0.25 * u);
              const sxp = gx + z * P.sx * 0.9, syp = gy + z * P.sy + 6;
              if (i) x.lineTo(sxp, syp); else x.moveTo(sxp, syp);
            }
            x.stroke();
          }
          // cabeceiras em terra
          rect(x, P.walk, 0, dy0 - 4, L.xl(235) + 6, dy1 - dy0 + 8); rect(x, P.walk, L.xr(235) - 6, dy0 - 4, WW, dy1 - dy0 + 8);
        },
        paintOver(x, P, R) {
          const dy0 = 226, dy1 = 244;
          rect(x, P.deck, 0, dy0, WW, dy1 - dy0);
          rect(x, P.arch, 0, dy0, WW, 1.5); rect(x, P.archD, 0, dy1 - 1.5, WW, 1.5);
          for (let xx = 4; xx < WW; xx += 24) rect(x, 'rgba(235,215,190,0.25)', xx, (dy0 + dy1) / 2 - 0.5, 12, 1);
          rect(x, 'rgba(0,0,0,0.25)', 0, dy1, WW, 3);
          for (const [a, b] of [[22, 132], [132, 242], [242, 352]]) {
            const pts = [];
            for (let i = 0; i <= 32; i++) {
              const u = i / 32, gx = a + (b - a) * u, gy = dy1 + (dy0 - dy1) * u;
              const z = Math.sin(u * Math.PI) * 58 * (1 - 0.25 * u);
              pts.push(gx, gy, gy - z);
            }
            // estais verticais do arco até o tabuleiro
            for (let i = 2; i < 31; i += 2) seg(x, 'rgba(210,200,185,0.35)', 0.6, pts[i * 3], pts[i * 3 + 2], pts[i * 3], pts[i * 3 + 1] - 2);
            for (const [w, c] of [[5, P.archD], [3.2, P.arch]]) {
              x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.beginPath();
              for (let i = 0; i <= 32; i++) { const X = pts[i * 3] + (w > 4 ? 0.8 : 0), Y = pts[i * 3 + 2] + (w > 4 ? 0.8 : 0); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }
              x.stroke();
            }
            rect(x, P.archD, a - 3, dy1 - 1, 6, 5); rect(x, P.archD, b - 3, dy0 - 4, 6, 5);
          }
        },
      },
      // Chefão: Palácio da Alvorada na margem (com as emas no gramado)
      alvorada: {
        h: 704, park: { local: 262, screen: 150 }, lanes: [[430, 704]],
        paint(x, P, R, h, F) {
          const xl = shoreFn(R, 66, h * 2, 1, h, 'bottom'), xr = shoreFn(R, 294, h * 2, -1, h, 'bottom');
          rect(x, P.grass, 0, 0, WW, h);
          speckle(x, R, 0, 0, WW, h, h * 0.5, P.g1, P.g2);
          const water = (grow, c) => {
            x.fillStyle = c; x.beginPath();
            x.moveTo(xl(h) - grow, h + 1);
            for (let y = h; y >= 470; y -= 6) x.lineTo(xl(y) - grow, y);
            x.quadraticCurveTo(xl(430) - grow, 404 - grow, 120, 400 - grow);
            x.quadraticCurveTo(180, 392 - grow, 240, 402 - grow);
            x.quadraticCurveTo(xr(430) + grow, 404 - grow, xr(470) + grow, 470);
            for (let y = 470; y <= h; y += 6) x.lineTo(xr(y) + grow, y);
            x.lineTo(xr(h) + grow, h + 1); x.closePath(); x.fill();
          };
          water(4, P.sand); water(0, P.shallow); water(-6, P.water);
          for (let i = 0; i < 90; i++) rect(x, P.ripple, R.r(80, 280), R.r(420, h - 2), R.r(4, 12), 1);
          for (let y = 520; y < h - 30; y += 70) { mansion(x, P, R, F, xl(y), y, true); mansion(x, P, R, F, xr(y + 30), y + 30, false); }
          // píer do palácio
          rect(x, P.hull2, 176, 396, 6, 40); boatShape(x, P, 190, 432, 16, 0.3);
          // gramado e caminho
          rect(x, 'rgba(255,220,160,0.04)', 20, 120, 320, 270);
          rect(x, P.walk, 174, 0, 12, 160);
          // espelho d'água na frente do palácio
          rect(x, P.marble2, 92, 286, 176, 34); rect(x, P.water, 95, 289, 170, 28);
          for (let i = 0; i < 9; i++) rect(x, 'rgba(255,230,200,0.06)', 98 + i * 19, 292, 7, 22);
          alvorada(x, P, R, 180, 272);
          // capela ao lado
          shadowBox(x, P, 300, 250, 18, 14, 10);
          x.fillStyle = P.marble; x.beginPath(); x.moveTo(300, 254); x.quadraticCurveTo(304, 232, 318, 228); x.quadraticCurveTo(312, 246, 318, 264); x.lineTo(300, 264); x.fill();
          for (let i = 0; i < 10; i++) treeC(x, P, R, R.r(16, 344), R.r(20, 120), 9, R.i(3, 5));
          for (let i = 0; i < 6; i++) { treeC(x, P, R, R.r(14, 70), R.r(150, 380), 8, 3); treeC(x, P, R, R.r(290, 346), R.r(290, 380), 8, 3); }
          box(x, P, 162, 40, 10, 8, 6, { roof: '#5e4a48', win: false });
          F.emus.push({ x: 120, y: 350, p: 0 }, { x: 140, y: 362, p: 2 }, { x: 250, y: 352, p: 4 });
          glints(R, F, h, xl, xr, 50, 440, h);
        },
      },
      land: {
        h: 512, lanes: [],
        paint(x, P, R, h) {
          rect(x, P.grass, 0, 0, WW, h);
          speckle(x, R, 0, 0, WW, h, h * 0.6, P.g1, P.g2);
          rect(x, P.walk, 174, 0, 12, h);
          for (let i = 0; i < 40; i++) treeC(x, P, R, R.r(10, 350), R.r(20, h - 20), 10, R.i(3, 6));
        },
      },
    },
    next(S, g, n) {
      const f = S.flags;
      if (g && g.boss && !f.boss) { f.boss = true; f.after = false; return 'alvorada'; }
      if (f.boss) return 'land';
      if (g && g.t > 75 && !f.jk) { f.jk = true; return 'jk'; }
      return loopPick(S, ['a', 'b', 'a', 'c'], n);
    },
    anim: animLake,
    upper: 'sunset', sun: { x: 0.5, y: -0.02, r: 0.75, rgb: '255,150,70', a: 0.22 },
    tint: [0, 'rgba(255,120,70,0.16)', 0.3, 'rgba(255,100,90,0.06)', 0.65, 'rgba(120,60,120,0.05)', 1, 'rgba(30,15,50,0.24)'],
  };
  // Jet skis em zigue-zague e lanchas, com esteira (só onde há água)
  const LAKE_BOATS = [
    { x: 175, amp: 60, w: 0.55, v: 70, ofs: 120, jet: true, c: '#a8842e' },
    { x: 200, amp: 46, w: 0.8, v: -55, ofs: 520, jet: true, c: '#93403c' },
    { x: 150, amp: 30, w: 0.3, v: 95, ofs: 820, jet: true, c: '#3a5688' },
    { x: 222, amp: 10, w: 0.15, v: -30, ofs: 300, jet: false, c: '#aaa49a' },
    { x: 140, amp: 8, w: 0.12, v: 38, ofs: 660, jet: false, c: '#9a948a' },
  ];
  function animLake(ctx, st, W, H, t) {
    const r = laneRanges(st, H), L = 1000;
    const posAt = (b, tt) => {
      let y = H + st.pos - b.ofs - b.v * tt;
      y = ((y % L) + L) % L - 60;
      return [b.x + Math.sin(tt * b.w + b.ofs) * b.amp, y];
    };
    ctx.lineCap = 'round';
    for (const b of LAKE_BOATS) {
      const [x, y] = posAt(b, t);
      if (y < -40 || y > H + 40 || !inRanges(r, y)) continue;
      const [px, py] = posAt(b, t - 0.05);
      const ang = Math.atan2(y - py, x - px);
      // esteira: rastro curvo + "V" que abre para trás
      // rastro curto e largo (espuma), afinando — nunca uma linha longa e fina
      let qx = x, qy = y;
      for (let k = 1; k <= 5; k++) {
        const q = posAt(b, t - k * 0.09);
        if (Math.abs(q[1] - qy) > 60) break;
        ctx.strokeStyle = 'rgba(215,220,240,' + (0.17 - k * 0.028).toFixed(3) + ')'; ctx.lineWidth = (b.jet ? 3.2 : 4.4) - k * 0.35;
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(q[0], q[1]); ctx.stroke();
        qx = q[0]; qy = q[1];
      }
      const back = ang + Math.PI, len = b.jet ? 22 : 30;
      ctx.strokeStyle = 'rgba(215,220,240,0.1)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(back - 0.38) * len, y + Math.sin(back - 0.38) * len);
      ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(back + 0.38) * len, y + Math.sin(back + 0.38) * len);
      ctx.stroke();
      // casco
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const l = b.jet ? 7 : 13, w = b.jet ? 2.6 : 4.4;
      ctx.fillStyle = 'rgba(10,10,30,0.3)'; ctx.fillRect(-l / 2 + 1.5, -w / 2 + 1.5, l, w);
      ctx.fillStyle = b.c; ctx.beginPath(); ctx.moveTo(l / 2 + 1.5, 0); ctx.lineTo(l / 4, -w / 2); ctx.lineTo(-l / 2, -w / 2); ctx.lineTo(-l / 2, w / 2); ctx.lineTo(l / 4, w / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(30,24,30,0.7)'; ctx.fillRect(-l * 0.2, -w * 0.3, l * 0.3, w * 0.6);
      ctx.restore();
    }
  }
  function alvorada(x, P, R, cx, by) {
    const w = 190, d = 30, z = 13, X = cx - w / 2, Y = by - d;
    shadowBox(x, P, X, Y, w, d, z);
    rect(x, P.marble2, X - 6, Y - 4, w + 12, d + 8);
    const fy = Y + d - z;
    rect(x, P.glassDark, X, fy, w, z);
    rect(x, 'rgba(255,190,130,0.12)', X + 4, fy + 3, w - 8, z - 5);
    const n = 11, cw = w / n;
    x.fillStyle = P.marble;
    for (let i = 0; i < n; i++) {
      const c0 = X + i * cw, c1 = c0 + cw;
      x.beginPath(); x.moveTo(c0, fy); x.lineTo(c1, fy);
      x.quadraticCurveTo(c1 - cw * 0.12, fy + z * 0.7, c0 + cw * 0.5, by + 1);
      x.quadraticCurveTo(c0 + cw * 0.12, fy + z * 0.7, c0, fy);
      x.fill();
    }
    rect(x, P.marble, X - 4, Y - z - 2, w + 8, d + 3);
    rect(x, 'rgba(255,255,255,0.07)', X - 4, Y - z - 2, w + 8, 2);
    rect(x, 'rgba(0,0,0,0.06)', X + 6, Y - z + 6, w - 12, d - 12);
  }

  // =================================================================
  // FASE 4 — PRAÇA DOS TRÊS PODERES (noite, céu vermelho do churrasco)
  // Seção: grama 0–34 | pista 38–98 (4 faixas) | passeio 102–258 | pista 262–322 | grama 326–360
  // =================================================================
  function lampPost(x, P, X, Y, glow) {
    if (glow) pool(x, X + 3, Y + 3, 22, P.light, P.lightA);
    rect(x, 'rgba(0,0,0,0.4)', X - 0.8, Y - 0.8, 2.4, 2.4);
    seg(x, '#3a3644', 1, X, Y, X, Y - 8);
    rect(x, 'rgba(255,215,160,0.4)', X - 2, Y - 9, 4, 1.4);
  }
  function base4(x, P, R, h) {
    rect(x, P.grass, 0, 0, WW, h);
    speckle(x, R, 0, 0, WW, h, h * 0.4, P.g1, P.g2);
    rect(x, P.walk, 34, 0, 4, h); rect(x, P.walk, 98, 0, 4, h); rect(x, P.walk, 258, 0, 4, h); rect(x, P.walk, 322, 0, 4, h);
    road(x, P, R, 38, 60, h, 4); road(x, P, R, 262, 60, h, 4);
    rect(x, P.pave, 102, 0, 156, h);
    for (let y = h - 24; y > -24; y -= 24) rect(x, P.paveLine, 102, y, 156, 1);
    for (let xx = 102 + 26; xx < 258; xx += 26) rect(x, P.paveLine, xx, 0, 1, h);
    rect(x, P.grass2, 104, 0, 12, h); rect(x, P.grass2, 244, 0, 12, h);
    for (let y = h - 40; y > 10; y -= 64) { lampPost(x, P, 110, y, true); lampPost(x, P, 250, y, true); lampPost(x, P, 30, y - 32, true); lampPost(x, P, 330, y - 32, true); }
    for (let i = 0; i < h / 50; i++) { treeC(x, P, R, R.r(6, 28), R.r(20, h - 20), 6, R.i(2, 4)); treeC(x, P, R, R.r(332, 354), R.r(20, h - 20), 6, R.i(2, 4)); }
  }
  function barricade(x, P, X, Y, w) { for (let xx = X; xx < X + w; xx += 3) rect(x, 'rgba(170,170,180,0.3)', xx, Y, 2.2, 1.4); rect(x, 'rgba(170,170,180,0.18)', X, Y + 1.4, w, 0.6); }
  function foodCart(x, P, R, X, Y, label, F) {
    box(x, P, X, Y, 14, 8, 4, { roof: '#4a3a34', win: false });
    rect(x, 'rgba(255,140,60,0.35)', X + 2, Y - 3, 10, 2); // brasa
    circ(x, R.pick(P.tent), X + 7, Y - 10, 7);
    x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 0.6; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; seg(x, 'rgba(0,0,0,0.2)', 0.6, X + 7, Y - 10, X + 7 + Math.cos(a) * 7, Y - 10 + Math.sin(a) * 7); }
    if (label) { rect(x, P.board, X - 4, Y + 2, 22, 5); txt(x, label, X + 7, Y + 4.6, 3.6, P.ink, { body: true, w: 800, maxW: 21 }); }
    if (F) F.smoke.push({ x: X + 7, y: Y - 4, s: 0.5 });
  }
  function tvVan(x, P, X, Y) {
    rrect(x, 'rgba(0,0,0,0.3)', X + 1.5, Y + 1.5, 9, 18, 2);
    rrect(x, '#5e5c66', X, Y, 9, 18, 2);
    rect(x, 'rgba(20,20,30,0.6)', X + 1, Y + 1, 7, 2);
    ell(x, '#7a7884', X + 4.5, Y + 10, 3.5, 3.5);
    ell(x, '#5a5862', X + 4.5, Y + 10, 2, 2);
  }
  function protestSign(x, P, R, X, Y, s) {
    const w = s.length * 2.6 + 6;
    rect(x, 'rgba(0,0,0,0.3)', X + 1, Y + 1, w, 6);
    rect(x, P.board, X, Y, w, 6);
    txt(x, s, X + w / 2, Y + 3.2, 4, P.ink, { body: true, w: 800, maxW: w - 2 });
  }
  const SIGNS = ['CADÊ A PICANHA?', 'MENOS IMPOSTO', 'ENTREGA A FATURA', 'QUEREMOS CERVEJINHA', 'FORA TODOS', 'VOTE 171', 'DEVOLVE MEU PIX', 'NOTA FISCAL JÁ'];
  function promenade4(x, P, R, h, F, y0, y1) {
    let y = y0 + 20;
    while (y < y1 - 40) {
      const r = R();
      if (r < 0.3) {
        // grupo de manifestantes atrás da grade
        barricade(x, P, 124, y, 112); barricade(x, P, 124, y + 30, 112);
        crowd(x, P, R, 128, y + 4, 104, 24, 120);
        protestSign(x, P, R, R.r(126, 170), y + 8, R.pick(SIGNS)); protestSign(x, P, R, R.r(180, 200), y + 16, R.pick(SIGNS));
        y += 56;
      } else if (r < 0.55) {
        foodCart(x, P, R, R.r(126, 150), y + 14, R.pick(['ESPETINHO', 'CHURRAS 171', 'CERVEJA']), F);
        foodCart(x, P, R, R.r(200, 222), y + 22, R.pick(['ESPETINHO', 'PASTEL', 'MILHO']), F);
        crowd(x, P, R, 126, y, 110, 34, 30);
        y += 50;
      } else if (r < 0.75) {
        tvVan(x, P, 122, y); tvVan(x, P, 228, y + 10);
        crowd(x, P, R, 140, y + 2, 80, 20, 25);
        y += 40;
      } else {
        // comitiva de carros pretos estacionada
        for (let k = 0; k < 4; k++) car(x, 132 + k * 9, y + 10, '#151519', 0);
        for (let k = 0; k < 3; k++) car(x, 200 + k * 9, y + 14, '#151519', Math.PI);
        y += 40;
      }
    }
  }
  // Palácio do Planalto: laje longa sobre colunas, rampa e tapete vermelho
  function planaltoPalace(x, P, R, cx, by) {
    const w = 250, d = 44, z = 18, X = cx - w / 2, Y = by - d;
    // holofotes no chão
    for (let xx = X + 10; xx < X + w; xx += 24) pool(x, xx, by + 2, 18, '255,180,110', 0.16);
    shadowBox(x, P, X, Y, w, d, z);
    rect(x, P.marble2, X - 8, Y - 2, w + 16, d + 8);
    const fy = Y + d - z;
    rect(x, P.glassDark, X + 6, fy, w - 12, z);
    for (let xx = X + 10; xx < X + w - 8; xx += 6) rect(x, 'rgba(255,190,110,0.28)', xx, fy + 4, 4, z - 7);
    const n = 16, cw = w / n;
    x.fillStyle = P.marble;
    for (let i = 0; i <= n; i++) {
      const cm = X + i * cw;
      x.beginPath(); x.moveTo(cm, fy - 1);
      x.quadraticCurveTo(cm + cw * 0.42, fy + z * 0.5, cm, by + 1);
      x.quadraticCurveTo(cm - cw * 0.42, fy + z * 0.5, cm, fy - 1); x.fill();
    }
    rect(x, P.marble, X - 4, Y - z - 2, w + 8, d + 3);
    rect(x, 'rgba(255,200,140,0.08)', X - 4, Y - z - 2, w + 8, 2);
    for (let yy = Y - z + 8; yy < Y + d - z - 4; yy += 10) rect(x, 'rgba(0,0,0,0.06)', X + 4, yy, w - 8, 1);
    // espelho d'água na frente
    rect(x, P.water, X + 6, by + 6, w / 2 - 30, 12); rect(x, P.water, cx + 24, by + 6, w / 2 - 30, 12);
    rect(x, 'rgba(255,170,100,0.08)', X + 6, by + 6, w / 2 - 30, 2); rect(x, 'rgba(255,170,100,0.08)', cx + 24, by + 6, w / 2 - 30, 2);
    // rampa
    poly(x, P.marble2, [cx - 20, fy + 2, cx + 20, fy + 2, cx + 22, by + 38, cx - 22, by + 38]);
    poly(x, 'rgba(0,0,0,0.2)', [cx + 20, fy + 2, cx + 22, by + 38, cx + 25, by + 38, cx + 23, fy + 2]);
  }
  // mastro da bandeira (a bandeira em si é animada)
  function mast(x, P, X, Y, Ht) {
    seg(x, P.shadow, 2.5, X + 2, Y + 1, X + Ht * P.sx + 2, Y + Ht * P.sy + 1);
    ell(x, P.marble2, X, Y, 6, 3.5);
    pool(x, X, Y, 16, '255,180,110', 0.14);
    seg(x, '#8a8694', 1.6, X, Y, X, Y - Ht);
    seg(x, 'rgba(255,220,180,0.35)', 0.6, X - 0.5, Y, X - 0.5, Y - Ht);
  }

  STAGES.planalto = {
    pal: PAL.planalto, first: 'start', firstAt: 0, bossKind: 'praca',
    kinds: {
      // partida: atrás do Congresso, torres iluminadas
      start: {
        h: 576, lanes: [[0, 250]],
        paint(x, P, R, h, F) {
          base4(x, P, R, h);
          rect(x, P.grass, 0, 250, WW, h - 250);
          speckle(x, R, 0, 250, WW, h - 250, 200, P.g1, P.g2);
          rect(x, P.walk, 0, 250, WW, 26); road(x, P, R, 0, WW, h, 1, 253, 273);
          congresso(x, P, R, 180, 470, true);
          for (let i = 0; i < 8; i++) treeC(x, P, R, R.r(10, 350), R.r(520, h - 16), 8, 3);
          for (let xx = 20; xx < WW; xx += 60) lampPost(x, P, xx, 282, true);
        },
      },
      a: { h: 512, paint(x, P, R, h, F) { base4(x, P, R, h); promenade4(x, P, R, h, F, 0, h); } },
      b: {
        h: 512,
        paint(x, P, R, h, F) {
          base4(x, P, R, h);
          // faixão gigante sobre o passeio
          promenade4(x, P, R, h, F, 0, 200);
          rect(x, 'rgba(0,0,0,0.3)', 120, 232, 124, 14); rect(x, '#5a2a2a', 118, 230, 124, 14);
          txt(x, 'PICANHA PRO POVO (EM BREVE)', 180, 237.5, 6, 'rgba(240,220,190,0.55)', { body: true, w: 800, maxW: 118 });
          crowd(x, P, R, 120, 248, 120, 30, 140);
          promenade4(x, P, R, h, F, 290, h);
        },
      },
      // Chefão: Praça dos Três Poderes — Planalto, bandeirão, STF, Pombal, churrasqueira
      praca: {
        h: 768, park: { local: 190, screen: 126 }, lanes: [[640, 768]],
        paint(x, P, R, h, F) {
          rect(x, P.grass, 0, 0, WW, h);
          speckle(x, R, 0, 0, WW, h, 300, P.g1, P.g2);
          // pistas chegando e virando na transversal
          rect(x, P.walk, 34, 600, 4, h - 600); rect(x, P.walk, 98, 600, 4, h - 600); rect(x, P.walk, 258, 600, 4, h - 600); rect(x, P.walk, 322, 600, 4, h - 600);
          road(x, P, R, 38, 60, h, 4, 640, h); road(x, P, R, 262, 60, h, 4, 640, h);
          rect(x, P.walk, 0, 596, WW, 48); road(x, P, R, 0, WW, h, 1, 600, 640);
          for (let xx = 6; xx < WW; xx += 24) rect(x, P.lane, xx, 619.5, 12, 1);
          rect(x, P.pave, 102, 644, 156, h - 644);
          // a praça: piso de pedra em grade
          rect(x, P.pave, 0, 210, WW, 386);
          for (let y = 590; y > 210; y -= 24) rect(x, P.paveLine, 0, y, WW, 1);
          for (let xx = 12; xx < WW; xx += 24) rect(x, P.paveLine, xx, 210, 1, 386);
          rect(x, P.grass2, 0, 0, WW, 212);
          for (let i = 0; i < 14; i++) treeC(x, P, R, R.r(10, 350), R.r(16, 110), 9, R.i(3, 5));
          // tapete vermelho: da rampa até lá embaixo (pra receber o Fusca)
          rect(x, P.carpet, 169, 220, 22, 376);
          rect(x, P.carpetEdge, 169, 220, 1, 376); rect(x, P.carpetEdge, 190, 220, 1, 376);
          for (let y = 566; y > 230; y -= 30) rect(x, 'rgba(0,0,0,0.1)', 169, y, 22, 1);
          planaltoPalace(x, P, R, 180, 190);
          rect(x, P.carpet, 169, 196, 22, 32);
          // STF à direita
          for (let xx = 276; xx < 350; xx += 18) pool(x, xx, 412, 14, '255,180,110', 0.14);
          shadowBox(x, P, 270, 388, 80, 22, 12);
          rect(x, P.glassDark, 274, 398, 72, 12);
          x.fillStyle = P.marble;
          for (let i = 0; i < 8; i++) { const c0 = 270 + i * 10; x.beginPath(); x.moveTo(c0 + 1, 398); x.lineTo(c0 + 9, 398); x.quadraticCurveTo(c0 + 5, 404, c0 + 5, 411); x.quadraticCurveTo(c0 + 5, 404, c0 + 1, 398); x.fill(); }
          rect(x, P.marble, 268, 374, 84, 24);
          txt(x, 'STF', 310, 386, 7, 'rgba(20,18,26,0.4)');
          // Pombal (à esquerda): duas lâminas altas
          shadowBox(x, P, 34, 470, 22, 6, 34);
          rect(x, P.marble2, 34, 442, 22, 34); rect(x, P.glassDark, 39, 446, 12, 26);
          rect(x, P.marble, 32, 436, 26, 8);
          // Panteão (pomba estilizada) e os Candangos
          poly(x, P.marble2, [276, 520, 330, 508, 346, 520, 330, 534]);
          poly(x, P.marble, [276, 516, 330, 504, 346, 516, 330, 528]);
          ell(x, P.marble2, 120, 520, 6, 3); rect(x, '#6a6070', 117, 506, 2, 14); rect(x, '#6a6070', 121, 506, 2, 14);
          // churrasqueira do Lule (a fumaça sai daqui)
          box(x, P, 222, 262, 26, 10, 5, { roof: '#2a2626', facade: '#1e1b1e', win: false });
          for (let i = 0; i < 5; i++) rect(x, 'rgba(255,120,50,0.45)', 224 + i * 5, 254, 3, 3);
          for (let i = 0; i < 4; i++) seg(x, 'rgba(200,190,170,0.5)', 0.7, 223, 255 + i * 2, 247, 255 + i * 2);
          box(x, P, 252, 270, 8, 6, 4, { roof: '#2a4a7a', facade: '#1a2a4a', win: false });
          box(x, P, 252, 280, 8, 6, 4, { roof: '#7a2a2a', facade: '#4a1a1a', win: false });
          rect(x, '#3a2a2a', 210, 284, 40, 7); txt(x, 'CHURRASCO DO LULE', 230, 287.6, 3.4, 'rgba(240,220,190,0.6)', { body: true, w: 800, maxW: 39 });
          F.grill = { x: 235, y: 252 };
          crowd(x, P, R, 200, 296, 70, 20, 30);
          // mastro do bandeirão
          mast(x, P, 66, 430, 156);
          F.bigflag = { x: 66, y: 430 - 156 };
          for (let xx = 30; xx < WW; xx += 64) { lampPost(x, P, xx, 330, true); lampPost(x, P, xx + 32, 560, true); }
          crowd(x, P, R, 110, 560, 50, 20, 30); crowd(x, P, R, 200, 560, 50, 20, 30);
          for (let k = 0; k < 4; k++) car(x, 60 + k * 9, 600 - 14, '#151519', Math.PI / 2);
        },
      },
      // o patão inflável dos protestos contra imposto (o Zé aprova)
      c: {
        h: 512,
        paint(x, P, R, h, F) {
          base4(x, P, R, h);
          promenade4(x, P, R, h, F, 0, 150);
          const cx = 180, cy = 290;
          crowd(x, P, R, 112, cy - 70, 136, 140, 260, true);
          ell(x, 'rgba(0,0,0,0.35)', cx + 10, cy + 10, 40, 30);
          ell(x, '#8e7a2a', cx, cy, 38, 28);                  // corpo
          ell(x, '#a28c32', cx - 6, cy - 6, 26, 18);
          ell(x, '#8e7a2a', cx + 4, cy - 30, 17, 15);          // cabeça
          ell(x, '#a28c32', cx + 1, cy - 33, 10, 8);
          poly(x, '#9a5a24', [cx + 4, cy - 44, cx + 16, cy - 50, cx + 26, cy - 44, cx + 14, cy - 40]); // bico
          rect(x, '#1a1612', cx - 4, cy - 36, 3, 3); rect(x, '#1a1612', cx + 10, cy - 36, 3, 3);
          rect(x, 'rgba(0,0,0,0.3)', 119, cy + 47, 124, 13); rect(x, '#2e3f2a', 117, cy + 45, 124, 13);
          txt(x, 'NÃO VOU PAGAR O PATO', 179, cy + 51.5, 7, 'rgba(235,225,180,0.6)', { body: true, w: 800, maxW: 118 });
          promenade4(x, P, R, h, F, 380, h);
        },
      },
      after: { h: 512, paint(x, P, R, h, F) { base4(x, P, R, h); promenade4(x, P, R, h, F, 0, h); } },
    },
    next(S, g, n) {
      const f = S.flags;
      if (g && g.boss && !f.boss) { f.boss = true; f.after = false; return 'praca'; }
      if (f.boss && !f.after) { f.after = true; return 'after'; }
      return loopPick(S, ['a', 'b', 'a', 'c'], n);
    },
    traffic: [
      { x: 45.5, dir: -1, v: 90, n: 2 }, { x: 60.5, dir: -1, v: 70, n: 3, convoy: true }, { x: 75.5, dir: -1, v: 80, n: 2 }, { x: 90.5, dir: -1, v: 100, n: 1 },
      { x: 269.5, dir: 1, v: 60, n: 2 }, { x: 284.5, dir: 1, v: 45, n: 2 }, { x: 299.5, dir: 1, v: 35, n: 3, convoy: true }, { x: 314.5, dir: 1, v: 25, n: 1 },
    ],
    upper: 'smoke', puffs: true, // fumaça da churrasqueira e das barracas
    tint: [0, 'rgba(255,110,45,0.24)', 0.2, 'rgba(255,90,50,0.08)', 0.45, 'rgba(40,30,90,0.05)', 1, 'rgba(4,6,28,0.32)'],
  };

  // =================================================================
  // Estado, caches e rolagem
  // =================================================================
  // Um CONJUNTO de cache por fase e resolução: blocos do chão, sprites do trânsito,
  // nuvens e as camadas de tela cheia (tinta, vinheta do chefão). Ele fica pronto ANTES
  // de a fase começar: a pré-construção (PRE, mais abaixo) trabalha nas telas de
  // resultado/loja/título/história, um item por vez. Durante o jogo, o que faltar entra
  // numa fila e sai no máximo um item a cada 250 ms — nada é construído de surpresa
  // no meio da luta (a vinheta do chefão ficava para o 1º quadro do chefão: 146 ms a 4x).
  const caches = {};      // cacheId -> { kinds: {nome: {c,h,feats,over}}, ov: {chave: {c,W,H,res}}, spr, up }
  let S = null;           // estado corrente
  let EDGE = null;        // faixas vermelhas da borda (iguais em todas as fases)
  const MAP = ['rodoviaria', 'esplanada', 'paranoa', 'planalto'];
  const Q_DPR = { high: 2, mid: 1.5, low: 1 }; // mesma regra do core (resize)
  const PLAY_GAP = 250;   // ms entre construções durante o jogo
  const PRE_GAP = 140;    // ms entre construções nas telas (resultado, loja, título)
  const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const quality = () => G.quality || 'high';
  // para os testes: últimas construções (nome, ms, estado do jogo)
  const BUILDS = [];
  function logBuild(id, item, ms) { BUILDS.push({ id, item, ms: Math.round(ms * 10) / 10, state: G.state, t: G.game ? Math.round(G.game.t * 10) / 10 : -1 }); if (BUILDS.length > 120) BUILDS.shift(); }

  // resolução dos caches = escala real da tela (para desenhar 1:1, sem filtro: no
  // Canvas sem GPU, ampliar uma imagem com filtro custa ~13x mais que copiar 1:1).
  // Telas muito grandes (tablet) ficam em 2,5 e passam a usar filtro.
  function quantRes(k) { return k <= 2.6 ? Math.max(0.5, Math.round(k * 1000) / 1000) : 2.5; }
  function getCache(cacheId) {
    let c = caches[cacheId];
    if (!c) c = caches[cacheId] = { kinds: {}, ov: {}, spr: null, up: null, puffs: null };
    return c;
  }
  function freeKind(k) { if (k) { freeCanvas(k.c); if (k.over) freeCanvas(k.over.c); } }
  function freeSprites(spr) { if (spr) for (const set of [spr.up, spr.down]) for (const l of [set.car, set.bus]) for (const c of l) freeCanvas(c); }
  function freeUpper(up) { if (up) { for (const sh of up.shapes) freeCanvas(sh.c); for (const sh of up.dark) freeCanvas(sh.c); } }
  function freeCache(cacheId) {
    const c = caches[cacheId];
    if (!c) return;
    for (const k in c.kinds) freeKind(c.kinds[k]);
    for (const k in c.ov) freeCanvas(c.ov[k].c);
    freeSprites(c.spr); freeUpper(c.up);
    if (c.puffs) for (const k in c.puffs) freeCanvas(c.puffs[k]);
    delete caches[cacheId];
  }
  // Fica na memória só o conjunto em uso, o do menu e o que está sendo pré-construído
  // (a fase anterior inteira ficava viva: ~25 MB de canvas a mais; o iOS limita a memória de canvas).
  function pruneCaches() {
    const keep = {};
    if (S) keep[S.cacheId] = 1;
    for (const id in PRE.keep) keep[id] = 1;
    for (const id in caches) if (!keep[id]) freeCache(id);
    if (EDGE && S && (EDGE.res !== S.res || quality() !== 'high')) { freeCanvas(EDGE.c); freeCanvas(EDGE.r); EDGE = null; }
  }
  // contexto mínimo para pintar um item de uma fase (não precisa do estado de rolagem)
  function paintCtx(id, res) { const def = STAGES[id]; return { id, def, P: def.pal, res }; }
  // Constrói um item de um conjunto. Devolve true se trabalhou (false = já estava pronto).
  // Itens: 'spr' (trânsito), 'up' (nuvens), 'ov0' (tinta), 'ov1' (vinheta do chefão), 'edge', ou o nome de um bloco.
  function buildItem(pc, cache, item, W, H) {
    const t0 = nowMs();
    switch (item) {
      case 'spr':
        if (cache.spr) return false;
        cache.spr = buildSprites(pc);
        break;
      case 'up': {
        const U = UPPER[pc.def.upper];
        if (!U || cache.up) return false;
        cache.up = buildUpper(pc, U);
        break;
      }
      case 'puff': {
        if (!pc.def.puffs || cache.puffsAll) return false;
        const P = cache.puffs || (cache.puffs = {});
        for (let rb = 2; rb <= 44; rb += 2) if (!P[rb]) P[rb] = buildPuff(pc.res, rb);
        cache.puffsAll = true;
        break;
      }
      case 'ov0': case 'ov1': {
        if ((item === 'ov1' && !pc.def.bossKind) || cache.ov[item + '|' + H]) return false;
        for (const k in cache.ov) if (k.indexOf(item + '|') === 0) { freeCanvas(cache.ov[k].c); delete cache.ov[k]; } // altura antiga
        cache.ov[item + '|' + H] = buildOverlay(pc, W, H, item === 'ov1');
        break;
      }
      case 'edge':
        if (!pc.def.bossKind || (EDGE && EDGE.H === H && EDGE.res === pc.res)) return false;
        if (EDGE) { freeCanvas(EDGE.c); freeCanvas(EDGE.r); }
        EDGE = buildEdge(pc, H);
        break;
      default:
        if (!pc.def.kinds[item] || cache.kinds[item]) return false;
        cache.kinds[item] = buildKind(pc, item);
    }
    logBuild(pc.id, item, nowMs() - t0);
    return true;
  }
  // ordem de construção: o que aparece primeiro vem antes; o marco e a vinheta do chefão por último
  function itemsFor(def) {
    const L = ['spr', def.first, 'ov0'];
    const ks = Object.keys(def.kinds);
    if (ks.indexOf('a') >= 0 && L.indexOf('a') < 0) L.push('a');
    if (def.upper && quality() !== 'low') L.push('up'); // sem nuvens na qualidade baixa
    if (def.puffs) L.push('puff');
    for (const k of ks) if (L.indexOf(k) < 0 && k !== def.bossKind) L.push(k);
    if (def.bossKind) { L.push(def.bossKind, 'ov1'); if (quality() === 'high') L.push('edge'); }
    return L;
  }
  function isBuilt(st, item, H) {
    const c = st.cache;
    switch (item) {
      case 'spr': return !!c.spr;
      case 'up': return !!c.up || !UPPER[st.def.upper];
      case 'puff': return !!c.puffsAll || !st.def.puffs;
      case 'ov0': case 'ov1': return !!c.ov[item + '|' + H] || (item === 'ov1' && !st.def.bossKind);
      case 'edge': return !!(EDGE && EDGE.H === H && EDGE.res === st.res) || !st.def.bossKind;
      default: return !!c.kinds[item] || !st.def.kinds[item];
    }
  }
  function queueItem(st, item) { if (st.queue.indexOf(item) < 0) st.queue.push(item); }
  function queueMissing(st, H) { st.queue = itemsFor(st.def).filter((it) => !isBuilt(st, it, H)); }
  // fila da fase em andamento: 1 item a cada 4 quadros; jogando, no máximo 1 a cada 250 ms
  function processQueue(st, W, H) {
    if (!st.queue.length) return;
    if (st.delay > 0) { st.delay--; return; }
    const t0 = nowMs();
    if (G.state === 'play' && t0 - st.lastBuild < PLAY_GAP) return;
    while (st.queue.length) {
      const it = st.queue.shift();
      if (buildItem(st.pc, st.cache, it, W, H)) { st.lastBuild = nowMs(); st.delay = 3; return; }
    }
  }

  function buildKind(st, name) {
    const kd = st.def.kinds[name];
    const res = st.res, h = kd.h;
    const s = surface(WW, h, res);
    const F = { glints: [], flags: [], fount: [], smoke: [], emus: [] };
    const R = rng(hashStr(st.id + ':' + name));
    try { kd.paint(s.x, st.P, R, h, F); } catch (err) { G.reportError(err, 'bg.paint ' + st.id + '/' + name); }
    sealRow(s.c, h * res);
    bake(s.c);
    let over = null;
    if (kd.over && kd.paintOver) {
      const oy0 = kd.over[0], oh = kd.over[1] - kd.over[0];
      const o = surface(WW, oh, res);
      o.x.translate(0, -oy0);
      try { kd.paintOver(o.x, st.P, rng(hashStr(st.id + ':' + name + ':over')), h, F); } catch (err) { G.reportError(err, 'bg.over ' + st.id + '/' + name); }
      sealRow(o.c, oh * res);
      over = { c: bake(o.c), y0: oy0, h: oh };
    }
    return { c: s.c, h, feats: F, over };
  }
  // a última linha do canvas fica "meio pintada" quando h*res não é inteiro: copia a de cima
  function sealRow(c, hr) {
    const r = Math.floor(hr);
    if (c.height <= r || r < 1) return;
    const x = c.getContext('2d');
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, r, c.width, c.height - r);
    x.drawImage(c, 0, r - 1, c.width, 1, 0, r, c.width, c.height - r);
    x.restore();
  }
  // Desenha uma faixa [topo, topo+h) (em px lógicos) de um cache, com as bordas
  // presas a linhas inteiras do aparelho: blocos vizinhos se encostam sem fresta e o blit fica 1:1.
  function blitBand(ctx, st, img, top, h, W, H) {
    const q = st.k, res = st.res;
    const mD = st.shaking ? Math.ceil(30 * q) : 0; // margem extra durante o tremor
    const tD = Math.round(top * q), bD = Math.round((top + h) * q), HD = Math.ceil(H * q - 0.001) + mD;
    const y0 = Math.max(-mD, tD), y1 = Math.min(HD, bD);
    if (y1 <= y0) return;
    const f = res / q;
    let sy = (y0 - tD) * f, sh = (y1 - y0) * f;
    if (st.crisp) { sy = Math.round(sy); sh = Math.min(Math.round(sh), img.height - sy); }
    if (sh <= 0) return;
    ctx.drawImage(img, 0, sy, img.width, sh, 0, y0 / q, (img.width / res) * (W / WW), (y1 - y0) / q);
  }
  // bloco pronto (ou construído agora: só acontece se a fila não deu conta a tempo)
  function kindOf(st, name) {
    let k = st.cache.kinds[name];
    if (!k) { const t0 = nowMs(); k = st.cache.kinds[name] = buildKind(st, name); logBuild(st.id, name + '!', nowMs() - t0); }
    return k;
  }
  function resolveId(id) {
    if (STAGES[id]) return id;
    const g = G.game;
    if (g && MAP[g.stageIdx]) return MAP[g.stageIdx]; // fase de teste do core etc.
    return 'rodoviaria';
  }
  // libera os canvases do estado (os do conjunto de cache ficam; o iOS demora a devolver memória de canvas)
  function disposeState(o) {
    if (!o) return;
    freeCanvas(o.flagImg); o.flagImg = null;
  }
  function initState(id, g, res, scrollY, t, H) {
    disposeState(S);
    const def = STAGES[id];
    const cacheId = id + '@' + res;
    const st = {
      id, def, P: def.pal, g, res, cacheId, cache: getCache(cacheId), pc: paintCtx(id, res),
      pos: 0, lastScroll: scrollY, lastT: t, dt: 0, seq: [], n: 1, mul: def.speed || 1,
      bossK: 0, boss: null, park: null, flags: {}, lastLoop: null, cloudPos: 0, ranges: [],
      queue: [], delay: 3, lastBuild: 0, traffic: null, flagImg: null, k: res, crisp: true,
    };
    const fk = kindOf(st, def.first);
    st.seq.push({ kind: def.first, y0: -(def.firstAt || 0), h: fk.h, n: 0 });
    queueMissing(st, H);
    buildTraffic(st);
    S = st;
    // começou uma fase: o resto (menu, fase anterior) sai da memória; a pré-construção recomeça na próxima tela
    if (id !== 'menu') { PRE.key = ''; PRE.jobs = []; PRE.i = 0; PRE.keep = {}; }
    pruneCaches();
    return st;
  }
  let lastSeen = null; // última escala real (ctx do jogo) — a pré-construção usa a mesma resolução
  function ensure(ctx, id, scrollY, t, H) {
    const g = id === 'menu' ? null : (G.game || null); // o menu nunca olha para uma fase antiga
    let k = 2, tx = 0, ty = 0;
    try { const m = ctx.getTransform(); k = Math.hypot(m.a, m.b) || 2; tx = m.e; ty = m.f; } catch (e) { /* navegador antigo */ }
    const res = quantRes(k);
    lastSeen = { k, scale: G.view ? G.view.scale : 0, q: quality() };
    if (!S || S.id !== id || S.g !== g || scrollY < S.lastScroll - 2 || t < S.lastT - 1) initState(id, g, res, scrollY, t, H);
    else if (res !== S.res) {
      // a tela mudou de tamanho: espera estabilizar e refaz só os caches (o mundo continua)
      if (S.pendRes === res) S.pendN++; else { S.pendRes = res; S.pendN = 0; }
      if (S.pendN > 12) rescale(S, res, H);
    }
    S.k = k; S.tx = tx; S.ty = ty;
    S.crisp = Math.abs(S.res - k) < 0.002;
    return S;
  }
  function rescale(st, res, H) {
    disposeState(st);
    st.res = res; st.cacheId = st.id + '@' + res; st.cache = getCache(st.cacheId); st.pc = paintCtx(st.id, res);
    st.pendRes = null;
    queueMissing(st, H);
    pruneCaches();
  }
  // rolagem própria: acompanha scrollY, mas acelera/estaciona no marco do chefão
  function advance(st, scrollY, t, H) {
    let dS = scrollY - st.lastScroll; if (!(dS > 0) || dS > 300) dS = 0;
    let dt = t - st.lastT; if (!(dt > 0) || dt > 0.25) dt = 0;
    st.lastScroll = scrollY; st.lastT = t; st.dt = dt;
    const g = st.g;
    const boss = g && g.boss && !g.boss.dead ? g.boss : null;
    st.boss = boss;
    st.bossK = approach(st.bossK, boss && boss.state !== 'leaving' ? 1 : 0, dt * 0.7);
    const vb = (g && g.scrollSpeed) || 42;
    let target = st.def.speed || 1;
    // chefão chegou e o marco ainda não entrou na fila: acelera até ele aparecer
    if (boss && st.def.bossKind && !st.flags.boss && boss.state !== 'leaving') target = 4.2;
    // fase vencida (diálogo final, resultado, loja): o mundo para, como num diálogo
    if (G.state === 'clear' && st.g) target = 0;
    const pk = st.park;
    if (pk) {
      const ch = pk.chunk;
      const D = (ch.y0 + ch.h - pk.local) - H + pk.screen - st.pos; // quanto falta rolar até o marco ficar no lugar
      if (pk.state === 'go') {
        if (!boss) pk.state = 'free';
        else if (D <= 0.5) pk.state = 'hold';
        else target = Math.min(5.2, Math.max(0.22, Math.sqrt(2 * 80 * D) / vb));
      }
      if (pk.state === 'hold') { target = 0; if (!boss || boss.state === 'leaving') pk.state = 'free'; }
      if (pk.state === 'free') st.park = null;
    }
    st.mul = approach(st.mul, target, dt * 3.2);
    st.pos += dS * st.mul;
    // camada de cima anda mais rápido (paralaxe) e nunca para de todo
    st.cloudPos += dS * st.mul * 1.6 + dt * 16;
  }
  function fill(st, H) {
    let last = st.seq[st.seq.length - 1], guard = 0;
    while (last.y0 + last.h < st.pos + H + 34 && guard++ < 8) { // +34: margem do tremor de tela
      const name = st.def.next(st, st.g, st.n);
      const kd = kindOf(st, name);
      const ch = { kind: name, y0: last.y0 + last.h, h: kd.h, n: st.n++ };
      st.seq.push(ch);
      const park = st.def.kinds[name].park;
      if (park && st.g && st.g.boss) st.park = { chunk: ch, local: park.local, screen: park.screen, state: 'go' };
      last = ch;
    }
    while (st.seq.length > 1 && st.seq[0].y0 + st.seq[0].h < st.pos - 34) st.seq.shift();
  }
  // y de tela do topo de um bloco (encaixado no pixel do aparelho)
  function chunkTop(st, ch, H) { const top = H + st.pos - (ch.y0 + ch.h); return Math.round(top * st.k) / st.k; }

  // =================================================================
  // Pré-construção (fora do jogo): a próxima fase enquanto o resultado e a
  // Lojinha estão na tela; no título/história, o fundo do menu e a 1ª fase.
  // Um item por vez, com folga de 140 ms entre eles (a tela de resultado parada
  // esconde o engasgo). Roda pelo draw() e por um relógio próprio, porque o
  // título e a história não desenham o fundo.
  // =================================================================
  const PRE = { key: '', jobs: [], i: 0, next: 0, keep: {} };
  function preTargets() {
    const st = G.state, g = G.game;
    if (st === 'clear' && g) { const nx = MAP[(g.stageIdx | 0) + 1]; return nx ? [nx] : null; }
    if (st === 'menu' || st === 'ending' || (st === 'intro' && !g)) {
      const sv = G.save || {}, un = sv.unlocked || 1;
      // provável próxima escolha: a 1ª fase (ou o 2º Mandato) ou a fase mais nova liberada
      const stage = st === 'intro' || sv.cleared || un <= 1 ? 'rodoviaria' : MAP[Math.min(3, un - 1)];
      return st === 'intro' ? [stage] : ['menu', stage];
    }
    return null;
  }
  // Resultado/loja com a próxima fase a caminho: o mundo parado só mostra os blocos visíveis.
  // O resto do conjunto da fase vencida sai já (pico de memória: ~13 Mpx em vez de ~19).
  function trimForClear(st) {
    if (!st || st.id === 'menu' || st.trimmed) return;
    st.trimmed = true;
    const vis = {};
    for (const ch of st.seq) vis[ch.kind] = 1;
    const c = st.cache;
    for (const k in c.kinds) if (!vis[k]) { freeKind(c.kinds[k]); delete c.kinds[k]; }
    if (st.bossK < 0.004) for (const k in c.ov) if (k.indexOf('ov1|') === 0) { freeCanvas(c.ov[k].c); delete c.ov[k]; }
    st.queue.length = 0;
  }
  function predictRes() {
    const v = G.view, q = quality();
    if (!v || !(v.scale > 0)) return 0;
    if (lastSeen && lastSeen.scale === v.scale && lastSeen.q === q) return quantRes(lastSeen.k);
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, Q_DPR[q] || 2);
    return quantRes(v.scale * dpr);
  }
  function prebuildPump() {
    if (!G.canvas || (typeof document !== 'undefined' && document.hidden)) return;
    const ids = preTargets();
    if (!ids) return;
    // telas do menu: um estado de fase antiga (o título não desenha fundo) não segura mais a memória dela
    if (S && S.id !== 'menu' && G.state !== 'clear' && (!G.game || S.g !== G.game)) { disposeState(S); S = null; }
    const t0 = nowMs();
    if (t0 < PRE.next) return;
    const res = predictRes();
    if (!res) return;
    const W = G.W || 360, H = G.H || 640;
    const key = ids.join(',') + '@' + res + '@' + H + '@' + quality();
    if (PRE.key !== key) {
      if (G.state === 'clear') trimForClear(S);
      PRE.key = key; PRE.i = 0; PRE.jobs = []; PRE.keep = {};
      for (const id of ids) {
        if (!STAGES[id]) continue;
        const cid = id + '@' + res, pc = paintCtx(id, res);
        PRE.keep[cid] = 1;
        for (const it of itemsFor(pc.def)) PRE.jobs.push({ cid, pc, it });
      }
      pruneCaches();
    }
    while (PRE.i < PRE.jobs.length) {
      const j = PRE.jobs[PRE.i++];
      let did = false;
      try { did = buildItem(j.pc, getCache(j.cid), j.it, W, H); } catch (err) { G.reportError(err, 'bg.prebuild ' + j.cid + '/' + j.it); }
      if (did) { PRE.next = nowMs() + PRE_GAP; return; }
    }
  }
  if (typeof setInterval !== 'undefined') setInterval(() => { try { drainFree(3); prebuildPump(); } catch (err) { G.reportError(err, 'bg.prebuild'); } }, 100);

  // =================================================================
  // Sprites e trânsito
  // =================================================================
  function beam(x, P, cx, y0, dir, len) {
    if (!P.beams) return;
    const y1 = y0 + dir * len;
    const g = x.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(' + P.beams + ',' + P.beamA + ')'); g.addColorStop(1, 'rgba(' + P.beams + ',0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(cx - 2.6, y0); x.lineTo(cx + 2.6, y0); x.lineTo(cx + 5, y1); x.lineTo(cx - 5, y1); x.closePath(); x.fill();
  }
  function buildSprites(pc) {
    const P = pc.P, res = pc.res;
    const mk = (w, h, fn) => { const s = surface(w, h, res); fn(s.x); s.c.lw = w; s.c.lh = h; return bake(s.c); };
    const cols = P.cars, bcols = P.bus || ['#376a8a'];
    const spr = { up: { car: [], bus: [] }, down: { car: [], bus: [] } };
    for (const c of cols) {
      spr.up.car.push(mk(12, 34, (x) => { beam(x, P, 6, 11.5, -1, 11); car(x, 6, 17, c, 0); }));
      spr.down.car.push(mk(12, 34, (x) => { beam(x, P, 6, 22.5, 1, 11); car(x, 6, 17, c, Math.PI); }));
    }
    for (const c of bcols) {
      spr.up.bus.push(mk(14, 52, (x) => { beam(x, P, 7, 12, -1, 12); bus(x, 7, 26, c, 0, 28); }));
      spr.down.bus.push(mk(14, 52, (x) => { beam(x, P, 7, 40, 1, 12); bus(x, 7, 26, c, Math.PI, 28); }));
    }
    return spr;
  }
  function buildTraffic(st) {
    const T = st.def.traffic; if (!T) { st.traffic = null; return; }
    const R = rng(hashStr(st.id + ':traffic'));
    const nCar = st.P.cars.length, nBus = (st.P.bus || [0]).length;
    st.traffic = T.map((ln) => {
      const ofs = [], col = [];
      for (let i = 0; i < ln.n; i++) {
        if (ln.convoy) { for (let k = 0; k < 3; k++) { ofs.push(R.r(0, 900) + k * 16); col.push(-1); } }
        else { ofs.push(R.r(0, 900)); col.push(R.i(0, (ln.bus ? nBus : nCar) - 1)); }
      }
      return { x: ln.x, dir: ln.dir, v: ln.v, bus: !!ln.bus, ofs, col };
    });
    // carro preto oficial para comitivas
    const black = st.P.cars.indexOf('#151519');
    st.blackIdx = black >= 0 ? black : 0;
  }
  function inRanges(r, y) { for (let i = 0; i < r.length; i += 2) if (y >= r[i] && y <= r[i + 1]) return true; return false; }
  // faixas de tela (y0,y1,...) onde os blocos visíveis têm pista (ou água, no lago)
  function laneRanges(st, H) {
    const r = st.ranges; r.length = 0;
    for (const ch of st.seq) {
      const top = H + st.pos - (ch.y0 + ch.h);
      if (top > H + 40 || top + ch.h < -40) continue;
      const lanes = st.def.kinds[ch.kind].lanes;
      if (!lanes) r.push(top, top + ch.h);
      else for (const l of lanes) r.push(top + l[0], top + l[1]);
    }
    return r;
  }
  function drawTraffic(ctx, st, H, t) {
    const T = st.traffic, spr = st.cache.spr;
    if (!T) return;
    if (!spr) { queueItem(st, 'spr'); return; } // ainda na fila: o trânsito aparece em instantes
    const r = laneRanges(st, H);
    const L = 900;
    ctx.imageSmoothingEnabled = !st.crisp;
    for (const ln of T) {
      const set = ln.dir > 0 ? spr.up : spr.down;
      const list = ln.bus ? set.bus : set.car;
      for (let i = 0; i < ln.ofs.length; i++) {
        let y = H + st.pos - ln.ofs[i] - ln.dir * ln.v * t;
        y = ((y % L) + L) % L - 50;
        if (y > H + 30 || !inRanges(r, y)) continue;
        const img = list[ln.col[i] < 0 ? st.blackIdx : ln.col[i]] || list[0];
        ctx.drawImage(img, snap(st, ln.x - img.lw / 2), snap(st, y - img.lh / 2), img.width / st.res, img.height / st.res);
      }
    }
    ctx.imageSmoothingEnabled = true;
  }

  // =================================================================
  // Detalhes animados dos blocos (brilhos d'água, bandeiras, fonte, emas, bandeirão)
  // =================================================================
  function buildFlagImg(st) {
    const P = st.P, s = surface(56, 38, st.res), x = s.x;
    rect(x, P.flagG, 0, 0, 56, 38);
    poly(x, P.flagY, [28, 4, 52, 19, 28, 34, 4, 19]);
    circ(x, P.flagB, 28, 19, 9.5);
    x.strokeStyle = P.flagW || '#bdb8ae'; x.lineWidth = 1.6; x.beginPath(); x.arc(28, 27, 12, -2.2, -0.95); x.stroke();
    return bake(s.c);
  }
  function drawFeats(ctx, st, W, H, t) {
    for (const ch of st.seq) {
      const top = chunkTop(st, ch, H);
      if (top > H + 60 || top + ch.h < -60) continue;
      const F = st.cache.kinds[ch.kind].feats;
      // brilhos do sol na água: tracinhos horizontais (nunca bolinhas)
      if (F.glints.length) {
        ctx.fillStyle = st.id === 'paranoa' ? '#ffcf9a' : '#cfe4f0';
        for (const gl of F.glints) {
          const y = top + gl.y; if (y < -2 || y > H + 2) continue;
          const band = Math.exp(-((gl.x - 180) * (gl.x - 180)) / 9000) * (0.35 + 0.65 * (1 - y / H));
          const a = Math.sin(t * gl.s + gl.p); if (a <= 0.15) continue;
          ctx.globalAlpha = a * a * (0.1 + 0.32 * band);
          ctx.fillRect(gl.x, y, gl.w, 1.2);
        }
        ctx.globalAlpha = 1;
      }
      // bandeirinhas tremulando
      for (const f of F.flags) {
        const y = top + f.y; if (y < -10 || y > H + 10) continue;
        const sw = f.w / 3;
        for (let i = 0; i < 3; i++) {
          const o = Math.sin(t * 7 + f.x * 0.3 + i * 1.1) * 0.9;
          ctx.fillStyle = f.br ? st.P.flagG || '#2f7a46' : f.c;
          ctx.fillRect(f.x + i * sw, y + o, sw + 0.4, f.h);
        }
        if (f.br) { ctx.fillStyle = st.P.flagY || '#b89a34'; ctx.fillRect(f.x + f.w * 0.3, top + f.y + 1.2 + Math.sin(t * 7 + f.x * 0.3 + 1.1) * 0.9, f.w * 0.4, f.h - 2.4); }
      }
      // fonte: ondinhas concêntricas
      for (const fo of F.fount) {
        const y = top + fo.y; if (y < -40 || y > H + 40) continue;
        ctx.strokeStyle = 'rgba(170,205,230,0.5)'; ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const p = ((t * 0.5 + k / 3) % 1);
          ctx.globalAlpha = (1 - p) * 0.5;
          ctx.beginPath(); ctx.ellipse(fo.x, y, 4 + p * (fo.r - 5), (4 + p * (fo.r - 5)) * 0.8, 0, 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // emas do Alvorada andando e bicando
      for (const e of F.emus) {
        const ex = e.x + Math.sin(t * 0.25 + e.p) * 16, y = top + e.y + Math.cos(t * 0.2 + e.p) * 4;
        if (y < -10 || y > H + 10) continue;
        const dir = Math.cos(t * 0.25 + e.p) >= 0 ? 1 : -1;
        const peck = Math.max(0, Math.sin(t * 2.2 + e.p * 3)) > 0.85;
        ctx.fillStyle = 'rgba(20,10,20,0.3)'; ctx.fillRect(ex - 2, y + 2, 6, 1.5);
        ctx.fillStyle = st.P.emu || '#6e6458';
        ctx.beginPath(); ctx.ellipse(ex, y, 3.2, 2.2, 0, 0, TAU); ctx.fill();
        ctx.fillRect(ex + dir * 2, peck ? y - 1 : y - 5, 1, peck ? 2 : 5);
        ctx.fillRect(ex + dir * 2 - (dir < 0 ? 1 : 0), peck ? y + 1 : y - 6, 2, 1.4);
        const step = Math.sin(t * 6 + e.p) * 1.2;
        ctx.fillRect(ex - 1 + step, y + 2, 0.8, 2); ctx.fillRect(ex + 1 - step, y + 2, 0.8, 2);
      }
      // bandeirão do Brasil no mastro da Praça (fatias com onda)
      if (F.bigflag) {
        const bx = F.bigflag.x, by = top + F.bigflag.y;
        if (by > -60 && by < H + 10) {
          if (!st.flagImg) st.flagImg = buildFlagImg(st);
          const img = st.flagImg, n = 14, fw = 56, fh = 38, sw = fw / n, iw = img.width / n;
          for (let i = 0; i < n; i++) {
            const u = i / n, amp = 1 + u * 4;
            const o = Math.sin(t * 3.2 - u * 6) * amp, sh = Math.cos(t * 3.2 - u * 6);
            ctx.drawImage(img, i * iw, 0, iw + 0.5, img.height, bx + 1 + i * sw, by + o + u * 3, sw + 0.4, fh - u * 3);
            if (sh > 0.2) { ctx.fillStyle = 'rgba(0,0,0,' + (sh * 0.22).toFixed(2) + ')'; ctx.fillRect(bx + 1 + i * sw, by + o + u * 3, sw + 0.4, fh - u * 3); }
          }
        }
      }
    }
  }
  function drawOvers(ctx, st, W, H) {
    for (const ch of st.seq) {
      const k = st.cache.kinds[ch.kind]; if (!k || !k.over) continue;
      const top = H + st.pos - (ch.y0 + ch.h) + k.over.y0;
      if (top + k.over.h <= 0 || top >= H) continue;
      ctx.imageSmoothingEnabled = !st.crisp;
      blitBand(ctx, st, k.over.c, top, k.over.h, W, H);
      ctx.imageSmoothingEnabled = true;
    }
  }

  // =================================================================
  // Camada de cima (névoa, nuvens, fumaça) e santinhos voando
  // =================================================================
  function puffSprite(rgb) {
    const c = mkCanvas(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(0.45, 'rgba(' + rgb + ',0.55)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return c;
  }
  // Fumaça (churrasqueira, barraquinhas): baforadas em tamanhos fixos de 2 em 2 px,
  // pintadas na resolução da tela e desenhadas 1:1. Ampliar o pincel de 64 px com
  // filtro a cada quadro era a parte mais cara da camada de cima na fase 4.
  const PUFF_RGB = '118,112,114';
  function buildPuff(res, rb) {
    const s = surface(rb * 2, rb * 2, res), x = s.x;
    const g = x.createRadialGradient(rb, rb, 0, rb, rb, rb);
    g.addColorStop(0, 'rgba(' + PUFF_RGB + ',1)'); g.addColorStop(0.45, 'rgba(' + PUFF_RGB + ',0.55)'); g.addColorStop(1, 'rgba(' + PUFF_RGB + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, rb * 2, rb * 2);
    const c = bake(s.c); c.rb = rb;
    return c;
  }
  function puffAt(st, r) {
    const rb = Math.max(2, Math.round(r / 2) * 2);
    const P = st.cache.puffs || (st.cache.puffs = {}); // normalmente já veio da pré-construção
    return P[rb] || (P[rb] = buildPuff(st.res, rb));
  }
  function drawPuff(ctx, st, x, y, r) {
    const c = puffAt(st, r), rb = c.rb;
    ctx.drawImage(c, snap(st, x - rb), snap(st, y - rb), c.width / st.res, c.height / st.res);
  }
  // Camada de cima: nuvens/névoa/fumaça como SPRITES soltos (pintados na resolução
  // da tela e desenhados 1:1) — só custa a área que ocupam, ao contrário de um
  // ladrilho de tela cheia.
  const UPPER = {
    mist:   { rgb: '160,180,225', shapes: 5, puffs: [4, 7], sz: [22, 46], a: 0.22, stretch: 2.6, inst: 6, alpha: 0.4 },
    clouds: { rgb: '245,240,230', shapes: 4, puffs: [5, 8], sz: [18, 34], a: 0.3, stretch: 1.4, inst: 6, alpha: 0.45, shadow: true },
    sunset: { rgb: '255,170,150', shapes: 5, puffs: [4, 7], sz: [20, 40], a: 0.26, stretch: 2, inst: 7, alpha: 0.5 },
    smoke:  { rgb: '108,104,112', shapes: 5, puffs: [5, 8], sz: [22, 44], a: 0.3, stretch: 1.5, inst: 8, alpha: 0.5, boss: 7 },
    dusk:   { rgb: '230,150,190', shapes: 5, puffs: [4, 7], sz: [22, 44], a: 0.22, stretch: 2.2, inst: 7, alpha: 0.45 },
  };
  const UL = 1000; // comprimento do laço vertical das nuvens
  function buildUpper(st, U) {
    const R = rng(hashStr(st.id + ':up')), brush = puffSprite(U.rgb), res = st.res;
    const shapes = [], dark = [];
    for (let i = 0; i < U.shapes; i++) {
      const sz = R.r(U.sz[0], U.sz[1]);
      const bw = Math.ceil(sz * 2 * U.stretch + sz * 2.2), bh = Math.ceil(sz * 2.3);
      const s = surface(bw, bh, res);
      const parts = R.i(U.puffs[0], U.puffs[1]);
      for (let k = 0; k < parts; k++) {
        const pr = sz * R.r(0.5, 1), pw = pr * U.stretch;
        const px = bw / 2 + R.r(-1, 1) * Math.max(0, bw / 2 - pw), py = bh / 2 + R.r(-0.25, 0.25) * sz;
        s.x.globalAlpha = U.a * U.alpha * R.r(0.55, 1); // alpha já embutido: desenha com globalAlpha 1 (mais barato)
        s.x.drawImage(brush, px - pw, py - pr, pw * 2, pr * 2);
      }
      shapes.push({ c: bake(s.c), w: s.c.width / res, h: s.c.height / res });
      if (U.shadow) { // versão escura = sombra da nuvem no chão
        const d = surface(bw, bh, res);
        d.x.setTransform(1, 0, 0, 1, 0, 0); d.x.globalAlpha = 0.4; d.x.drawImage(s.c, 0, 0); d.x.globalAlpha = 1;
        d.x.globalCompositeOperation = 'source-in'; d.x.fillStyle = 'rgb(10,14,24)'; d.x.fillRect(0, 0, d.c.width, d.c.height);
        dark.push({ c: bake(d.c), w: d.c.width / res, h: d.c.height / res });
      }
    }
    brush.width = 1; brush.height = 1;
    const mkInst = (n) => { const a = []; for (let i = 0; i < n; i++) a.push({ s: i % shapes.length, x: R.r(-50, WW - 40), y: (i + R.r(0, 0.8)) * UL / n, v: R.r(0.85, 1.15), p: R() * TAU }); return a; };
    return { shapes, dark, inst: mkInst(U.inst), inst2: U.boss ? mkInst(U.boss) : null };
  }
  function snap(st, v) { return Math.round(v * st.k) / st.k; }
  function drawCloudSet(ctx, st, set, list, inst, off, alpha, W, H, t) {
    if (alpha <= 0.003) return;
    ctx.globalAlpha = alpha > 0.995 ? 1 : alpha;
    for (const it of inst) {
      const sh = list[it.s];
      const y = (((it.y + off * it.v) % UL) + UL) % UL - sh.h;
      if (y > H || y + sh.h < 0) continue;
      const x = it.x + Math.sin(t * 0.07 + it.p) * 14;
      ctx.drawImage(sh.c, snap(st, x), snap(st, y), sh.w, sh.h);
    }
  }
  function santinhoSprite(col) {
    // pintado pequeno e ampliado → fica desfocado (perto da câmera)
    const c = mkCanvas(12, 16), x = c.getContext('2d');
    rect(x, '#d8d2c4', 2, 1, 8, 13); rect(x, col, 2, 1, 8, 4); rect(x, 'rgba(40,30,30,0.6)', 3.5, 8, 5, 1); rect(x, 'rgba(40,30,30,0.6)', 3.5, 10, 4, 1);
    return bake(c);
  }
  function drawUpper(ctx, st, W, H, t) {
    const def = st.def, U = UPPER[def.upper], q = quality();
    // qualidade baixa: sem nuvens/névoa (a fumaça da churrasqueira e das barracas fica)
    if (U && q !== 'low' && !(G.BG.skip && G.BG.skip.clouds)) {
      const set = st.cache.up;
      if (!set) queueItem(st, 'up');
      else {
        ctx.imageSmoothingEnabled = !st.crisp;
        // sombras das nuvens no chão (só de dia): andam com o chão, um pouco mais devagar que as nuvens
        if (U.shadow && q === 'high') drawCloudSet(ctx, st, set, set.dark, set.inst, st.cloudPos * 0.75 + 120, 1, W, H, t);
        drawCloudSet(ctx, st, set, set.shapes, set.inst, st.cloudPos, 1, W, H, t);
        // fumaça extra na chegada do chefão: enfeite, só na qualidade alta
        if (set.inst2 && st.bossK > 0.01 && q === 'high') drawCloudSet(ctx, st, set, set.shapes, set.inst2, st.cloudPos * 1.3 + 500, st.bossK * 0.8, W, H, t);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 1;
      }
    }
    // fumaça da churrasqueira do Lule (sai do marco e vem descendo) e das barraquinhas
    let smoked = false;
    for (const ch of st.seq) {
      const F = st.cache.kinds[ch.kind] && st.cache.kinds[ch.kind].feats;
      if (!F || (!F.grill && !F.smoke.length)) continue;
      const top = chunkTop(st, ch, H);
      if (!smoked) { smoked = true; ctx.imageSmoothingEnabled = !st.crisp; }
      if (F.grill) {
        const gx = F.grill.x, gy = top + F.grill.y;
        if (gy > -160 && gy < H + 40) {
          const n = 7, k = 0.6 + st.bossK * 0.6;
          for (let i = 0; i < n; i++) {
            const p = (t * 0.12 + i / n) % 1;
            const px = gx + p * 70 + Math.sin(t * 0.8 + i) * 8, py = gy - 6 + p * 150 - Math.sin(p * Math.PI) * 30;
            const a = Math.min(1, (1 - p) * p * 4) * 0.32 * k;
            if (a < 0.01) continue;
            ctx.globalAlpha = a;
            drawPuff(ctx, st, px, py, 8 + p * 34);
          }
        }
      }
      for (const sm of F.smoke) {
        const sy = top + sm.y; if (sy < -60 || sy > H + 20) continue;
        for (let i = 0; i < 2; i++) {
          const p = (t * 0.25 + i / 2 + sm.x * 0.01) % 1;
          const a = (1 - p) * 0.2;
          if (a < 0.01) continue;
          ctx.globalAlpha = a;
          drawPuff(ctx, st, sm.x + p * 18, sy - p * 10, 4 + p * 12);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (smoked) ctx.imageSmoothingEnabled = true;
    // santinhos de campanha voando perto da câmera (grandes, translúcidos, desfocados)
    const ns = (G.BG.skip && G.BG.skip.sant) ? 0 : def.santinhos || 0;
    if (ns) {
      if (!st.sant) st.sant = ['#a8443e', '#3f5f9a', '#3f8a5a', '#a8842e'].map(santinhoSprite);
      const L = H + 120;
      for (let i = 0; i < ns; i++) {
        const sp = 70 + hash1(i * 3.3) * 60;
        const y = ((hash1(i * 7.7) * L + st.cloudPos * 0.6 + t * sp * 0.3) % L) - 60;
        const x = hash1(i * 5.1) * W + Math.sin(t * 0.7 + i * 2) * 26;
        const flip = Math.cos(t * 1.7 + i);
        ctx.save();
        ctx.translate(x, y); ctx.rotate(t * (0.6 + hash1(i) * 1.2) * (i % 2 ? 1 : -1));
        ctx.scale(flip * 0.9 + (flip >= 0 ? 0.1 : -0.1), 1);
        ctx.globalAlpha = 0.12;
        ctx.drawImage(st.sant[i % st.sant.length], -15, -20, 30, 40);
        ctx.restore();
      }
    }
    // biguás voando sobre o lago (fase 3)
    if (st.id === 'paranoa') {
      ctx.strokeStyle = 'rgba(30,18,30,0.45)'; ctx.lineWidth = 1.2;
      const cx0 = ((t * 22) % (W + 200)) - 100, cy0 = H * 0.3 + Math.sin(t * 0.1) * 60;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const bx = cx0 - i * 12 - (i % 2) * 6, by = cy0 + i * 9 * (i % 2 ? 1 : -0.6), f = Math.sin(t * 8 + i) * 2.2;
        ctx.moveTo(bx - 4, by - f); ctx.lineTo(bx, by); ctx.lineTo(bx + 4, by - f);
      }
      ctx.stroke();
    }
  }

  // =================================================================
  // Tinta do horário (faixas sólidas translúcidas — gradiente em tela cheia
  // é caro sem GPU) + vinheta/borda de perigo do chefão
  // =================================================================
  function parseRGBA(s) { const m = String(s).match(/[\d.]+/g) || [0, 0, 0, 0]; return [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1]; }
  function buildBands(stops, n) {
    const st = []; for (let i = 0; i < stops.length; i += 2) st.push([stops[i], parseRGBA(stops[i + 1])]);
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      let j = 0; while (j < st.length - 2 && u > st[j + 1][0]) j++;
      const a = st[j], b = st[Math.min(j + 1, st.length - 1)];
      const f = b[0] > a[0] ? Math.max(0, Math.min(1, (u - a[0]) / (b[0] - a[0]))) : 0;
      const c = a[1].map((v, q) => v + (b[1][q] - v) * f);
      out.push(c[3] < 0.004 ? null : 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + c[3].toFixed(3) + ')');
    }
    return out;
  }
  function drawBands(ctx, st, bands, W, H) {
    const n = bands.length, k = st.k;
    let y0 = 0;
    for (let i = 0; i < n; i++) {
      const y1 = i === n - 1 ? H : Math.round(((i + 1) * H / n) * k) / k;
      if (bands[i]) { ctx.fillStyle = bands[i]; ctx.fillRect(0, y0, W, y1 - y0); }
      y0 = y1;
    }
  }
  // Camadas de tela cheia pré-renderizadas na resolução da tela (blit 1:1; em meia
  // resolução o blit ampliado com filtro custaria ~13x mais por quadro sem GPU):
  //  ov0 = tinta do horário; ov1 = tinta + escurecida + vinheta + bordas vermelhas (chefão).
  // Por quadro: 1 blit com globalAlpha 1 (barato); só na transição (1,4 s) são 2.
  // tinta do horário em faixas sólidas de 4 px do aparelho (presas ao pixel: sem emendas).
  // Na tinta fraquinha (alpha ≤ 0,4) não dá para ver degrau, e pintar faixas sólidas custa
  // ~1/15 de avaliar um gradiente na tela inteira sem GPU.
  function tintBands(x, stops, Wd, Hd) {
    const st = []; for (let i = 0; i < stops.length; i += 2) st.push([stops[i], parseRGBA(stops[i + 1])]);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    let last = '';
    for (let y = 0; y < Hd; y += 4) {
      const u = (y + 2) / Hd;
      let j = 0; while (j < st.length - 2 && u > st[j + 1][0]) j++;
      const a = st[j], b = st[Math.min(j + 1, st.length - 1)];
      const f = b[0] > a[0] ? Math.max(0, Math.min(1, (u - a[0]) / (b[0] - a[0]))) : 0;
      const al = a[1][3] + (b[1][3] - a[1][3]) * f;
      if (al < 0.002) continue;
      const col = 'rgba(' + Math.round(a[1][0] + (b[1][0] - a[1][0]) * f) + ',' + Math.round(a[1][1] + (b[1][1] - a[1][1]) * f) + ',' + Math.round(a[1][2] + (b[1][2] - a[1][2]) * f) + ',' + al.toFixed(4) + ')';
      if (col !== last) { x.fillStyle = col; last = col; }
      x.fillRect(0, y, Wd, Math.min(4, Hd - y));
    }
    x.restore();
  }
  function buildOverlay(st, W, H, boss) {
    const s = surface(W, H, st.res), x = s.x;
    if (st.def.tint) tintBands(x, st.def.tint, s.c.width, s.c.height);
    if (st.def.sun) { // brilho do sol baixo à frente (pôr do sol no lago)
      const sn = st.def.sun;
      x.save(); x.translate(W * sn.x, H * sn.y); x.scale(1.5, 1);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, W * sn.r);
      g.addColorStop(0, 'rgba(' + sn.rgb + ',' + sn.a + ')'); g.addColorStop(0.5, 'rgba(' + sn.rgb + ',' + (sn.a * 0.35) + ')'); g.addColorStop(1, 'rgba(' + sn.rgb + ',0)');
      x.fillStyle = g; x.fillRect(-W, -H, W * 2, H * 2); x.restore();
    }
    if (boss) {
      x.fillStyle = 'rgba(5,3,12,0.15)'; x.fillRect(0, 0, W, H);
      // vinheta: gradiente radial pintado em 1/8 da resolução e ampliado uma vez só (é bem suave;
      // avaliar o gradiente na tela inteira custava ~15 ms sem GPU)
      const q = 8, v = surface(W, H, st.res / q), vx = v.x;
      const cx = W / 2, cy = H * 0.46, sy = (H / W) * 0.8;
      vx.translate(cx, cy); vx.scale(1, sy);
      const g = vx.createRadialGradient(0, 0, W * 0.36, 0, 0, W * 0.86);
      g.addColorStop(0, 'rgba(6,0,12,0)'); g.addColorStop(0.55, 'rgba(6,0,12,0.24)'); g.addColorStop(1, 'rgba(6,0,12,0.62)');
      vx.fillStyle = g; vx.fillRect(-W, -H / sy, W * 2, (H * 2) / sy);
      x.save(); x.imageSmoothingEnabled = true;
      x.drawImage(v.c, 0, 0, v.c.width, v.c.height, 0, 0, v.c.width * q / st.res, v.c.height * q / st.res);
      x.restore();
      v.c.width = 1; v.c.height = 1;
      edgeGrad(x, W, H, 0.16);
    }
    return { c: bake(s.c), W, H, res: st.res };
  }
  function edgeGrad(x, W, H, a) {
    const w = 46;
    x.fillStyle = lgrad(x, 0, 0, w, 0, [0, 'rgba(255,60,30,' + a + ')', 0.4, 'rgba(255,60,30,' + (a * 0.3) + ')', 1, 'rgba(255,60,30,0)']);
    x.fillRect(0, 0, w, H);
    x.fillStyle = lgrad(x, W, 0, W - w, 0, [0, 'rgba(255,60,30,' + a + ')', 0.4, 'rgba(255,60,30,' + (a * 0.3) + ')', 1, 'rgba(255,60,30,0)']);
    x.fillRect(W - w, 0, w, H);
  }
  // faixas laterais vermelhas extras para a pulsação (estreitas → baratas)
  function buildEdge(st, H) {
    const w = 46, s = surface(w, H, st.res), r = surface(w, H, st.res);
    s.x.fillStyle = lgrad(s.x, 0, 0, w, 0, [0, 'rgba(255,60,30,0.9)', 0.4, 'rgba(255,60,30,0.25)', 1, 'rgba(255,60,30,0)']); s.x.fillRect(0, 0, w, H);
    r.x.fillStyle = lgrad(r.x, w, 0, 0, 0, [0, 'rgba(255,60,30,0.9)', 0.4, 'rgba(255,60,30,0.25)', 1, 'rgba(255,60,30,0)']); r.x.fillRect(0, 0, w, H);
    return { c: bake(s.c), r: bake(r.c), H, res: st.res };
  }
  function blitFull(ctx, st, ov, a) {
    if (a <= 0.003) return;
    ctx.globalAlpha = a > 0.995 ? 1 : a;
    ctx.drawImage(ov.c, 0, 0, ov.c.width, ov.c.height, 0, 0, ov.c.width / ov.res, ov.c.height / ov.res);
  }
  // camada ainda na fila (tela mudou de tamanho, fase aberta direto num teste): faixas sólidas, sem travar
  function fallbackTint(ctx, st, W, H, a, boss) {
    if (a <= 0.003) return;
    if (!st.tintB) st.tintB = st.def.tint ? buildBands(st.def.tint, 12) : [];
    ctx.globalAlpha = a > 0.995 ? 1 : a;
    drawBands(ctx, st, st.tintB, W, H);
    if (boss) { ctx.fillStyle = 'rgba(5,3,12,0.22)'; ctx.fillRect(0, 0, W, H); }
  }
  function drawOverlay(ctx, st, W, H, t) {
    const k = (G.BG.skip && G.BG.skip.boss) ? 0 : st.bossK, q = quality();
    const ok = (o) => o && o.W === W && o.res === st.res;
    ctx.imageSmoothingEnabled = !st.crisp;
    if (k < 0.995) {
      const o = st.cache.ov['ov0|' + H];
      if (ok(o)) blitFull(ctx, st, o, 1 - k); else { queueItem(st, 'ov0'); fallbackTint(ctx, st, W, H, 1 - k, false); }
    }
    if (k > 0.005) {
      const o = st.cache.ov['ov1|' + H];
      if (ok(o)) blitFull(ctx, st, o, k); else { queueItem(st, 'ov1'); fallbackTint(ctx, st, W, H, k, true); }
    }
    // borda de perigo pulsando (enfeite: só na qualidade alta)
    if (k > 0.01 && q === 'high') {
      const e = EDGE;
      if (!e || e.H !== H || e.res !== st.res) queueItem(st, 'edge');
      else {
        const p = 0.5 + 0.5 * Math.sin(t * 3.2);
        if (p > 0.05) {
          const ew = e.c.width / e.res, eh = e.c.height / e.res;
          ctx.globalAlpha = k * p * 0.12;
          ctx.drawImage(e.c, 0, 0, e.c.width, e.c.height, 0, 0, ew, eh);
          ctx.drawImage(e.r, 0, 0, e.c.width, e.c.height, snap(st, W - ew), 0, ew, eh);
        }
      }
    }
    ctx.imageSmoothingEnabled = true;
    // planalto: brilho do churrasco pulsando no alto (só as faixas de cima; sem ele na qualidade baixa)
    if (st.id === 'planalto' && q !== 'low') {
      if (!st.glowB) st.glowB = buildBands([0, 'rgba(255,100,40,0.16)', 0.3, 'rgba(255,100,40,0)', 1, 'rgba(255,100,40,0)'], 28);
      const a = 0.5 + 0.5 * Math.sin(t * 1.3) * Math.sin(t * 0.7 + 1);
      if (a > 0.03) { ctx.globalAlpha = a; drawBands(ctx, st, st.glowB, W, H); }
    }
    ctx.globalAlpha = 1;
  }

  // =================================================================
  // API pública
  // =================================================================
  function draw(ctx, id, scrollY, t, W, H) {
    W = W || G.W || 360; H = H || G.H || 640;
    scrollY = +scrollY || 0; t = +t || 0;
    id = resolveId(id);
    const st = ensure(ctx, id, scrollY, t, H);
    advance(st, scrollY, t, H);
    fill(st, H);
    // o que faltar do conjunto da fase sai da fila aos poucos
    processQueue(st, W, H);
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // tremor de tela (o core translada o canvas): cancela a fração de pixel para manter
    // o blit 1:1 rápido, e pinta uma margem para não sobrar borda sem fundo
    const fx = st.tx - Math.round(st.tx), fy = st.ty - Math.round(st.ty);
    if (fx || fy) ctx.translate(-fx / st.k, -fy / st.k);
    st.shaking = Math.abs(st.tx) > 0.5 || Math.abs(st.ty) > 0.5;
    if (st.shaking) { ctx.fillStyle = st.P.edgeFill || st.P.grass; ctx.fillRect(-30, -30, W + 60, H + 60); }
    // chão: blocos desenhados 1:1 (sem filtro) quando a resolução bate com a tela
    ctx.imageSmoothingEnabled = !st.crisp;
    for (const ch of st.seq) {
      const top = H + st.pos - (ch.y0 + ch.h);
      if (top + ch.h <= 0 || top >= H) continue;
      blitBand(ctx, st, kindOf(st, ch.kind).c, top, ch.h, W, H);
    }
    ctx.imageSmoothingEnabled = true;
    const sk = G.BG.skip; // só para medir custo nos testes
    if (!sk || !sk.traffic) { drawTraffic(ctx, st, H, t); if (st.def.anim) st.def.anim(ctx, st, W, H, t); }
    if (!sk || !sk.feats) drawFeats(ctx, st, W, H, t);
    if (!sk || !sk.overs) drawOvers(ctx, st, W, H);
    if (!sk || !sk.upper) drawUpper(ctx, st, W, H, t);
    if (!sk || !sk.overlay) drawOverlay(ctx, st, W, H, t);
    ctx.restore();
    // fora do jogo (resultado, loja, diálogo do fim): adianta a próxima fase
    if (G.state !== 'play') prebuildPump();
  }
  // memória de canvas (testes): conjuntos vivos e megapixels
  function cacheStats() {
    const sets = {};
    let px = 0;
    const add = (id, c) => { if (c && c.width > 1) { const n = c.width * c.height; sets[id] = (sets[id] || 0) + n; px += n; } };
    for (const id in caches) {
      const c = caches[id];
      for (const k in c.kinds) { add(id, c.kinds[k].c); if (c.kinds[k].over) add(id, c.kinds[k].over.c); }
      for (const k in c.ov) add(id, c.ov[k].c);
      if (c.spr) for (const set of [c.spr.up, c.spr.down]) for (const l of [set.car, set.bus]) for (const cv of l) add(id, cv);
      if (c.up) { for (const sh of c.up.shapes) add(id, sh.c); for (const sh of c.up.dark) add(id, sh.c); }
      if (c.puffs) for (const k in c.puffs) add(id, c.puffs[k]);
    }
    if (EDGE) { add('edge', EDGE.c); add('edge', EDGE.r); }
    for (const id in sets) sets[id] = +(sets[id] / 1e6).toFixed(2);
    return { sets, mpx: +(px / 1e6).toFixed(2), built: Object.keys(caches).map((id) => id + ':' + Object.keys(caches[id].kinds).join('/') + ' ov=' + Object.keys(caches[id].ov).join('/')), pre: PRE.key, preLeft: PRE.jobs.length - PRE.i };
  }

  G.BG = G.BG || {};
  Object.assign(G.BG, {
    __tag: 'bg',
    draw,
    ids: Object.keys(STAGES),
    skip: null, // testes de custo: { traffic, feats, overs, upper, clouds, sant, overlay, boss } pula partes do desenho
    // as fontes chegaram depois do boot: os outdoors pintados com a fonte reserva são refeitos
    // (os conjuntos fora de uso são descartados e a pré-construção recomeça; o da tela atual fica)
    fontsReady() {
      for (const id in caches) if (!S || id !== S.cacheId) freeCache(id);
      PRE.key = ''; PRE.jobs = []; PRE.i = 0; PRE.keep = {};
    },
    // para testes: estado atual (posição do mundo, blocos visíveis, estacionamento no chefão)
    _state() { return S; },
    debugState() { return S ? { id: S.id, pos: Math.round(S.pos), mul: +S.mul.toFixed(2), park: S.park ? S.park.state : null, bossK: +S.bossK.toFixed(2), seq: S.seq.map((c) => c.kind), res: S.res, crisp: S.crisp, built: Object.keys(S.cache.kinds), queue: S.queue.slice() } : null; },
    builds() { return BUILDS.slice(); },
    cacheStats,
  });
})();
