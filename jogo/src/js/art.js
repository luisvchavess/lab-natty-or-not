/* ============================================================
   FUSCA A JATO — art.js
   Arte do jogo (tudo desenhado em canvas, sem imagens):
   - G.Art.person   caricaturas "cabeção" (todos os políticos)
   - G.Art.player   o Fusca 78 azul-celeste a jato do Zé (visto de cima)
   - G.Art.pickup   itens (Pix, mala, P, delação, habeas corpus, 13º, café)
   - ícones do HUD  (vida, delação, armas)
   - G.Art.scene    ilustrações da história (estilo gibi)
   - G.Art.titleArt arte da tela de título
   - retratos       Zé, Vó Dirce e o Rádio
   Estende o G.Art do core com Object.assign (mesmas assinaturas).
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Art) return;

  const TAU = Math.PI * 2;
  const PI = Math.PI;
  const INK = '#101418';
  const WHITE = '#ffffff';
  const SHADE_RGBA = 'rgba(42,24,64,0.26)'; // o único tom de sombra (chapado)
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const FD = () => G.FONT_DISPLAY;
  const FB = () => G.FONT_BODY;

  // ======================================================================
  // Cores: escurecer/clarear com cache (aceita qualquer cor CSS)
  // ======================================================================
  const scratch = document.createElement('canvas').getContext('2d');
  const rgbCache = new Map();
  function rgb(c) {
    let v = rgbCache.get(c);
    if (v) return v;
    if (rgbCache.size > 3000) rgbCache.clear();
    scratch.fillStyle = '#000000';
    scratch.fillStyle = c;
    const s = scratch.fillStyle;
    if (s[0] === '#') v = [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16), 1];
    else { const m = s.match(/[\d.]+/g) || [0, 0, 0]; v = [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1]; }
    rgbCache.set(c, v);
    return v;
  }
  // cache em 3 níveis (cor alvo → cor → k): nenhuma string é montada por quadro
  const mixCache = new Map();
  function mix(c1, c2, k) {
    let a = mixCache.get(c2);
    if (!a) { a = new Map(); mixCache.set(c2, a); }
    let b = a.get(c1);
    if (!b) { if (a.size > 3000) a.clear(); b = new Map(); a.set(c1, b); }
    let v = b.get(k);
    if (v !== undefined) return v;
    const p = rgb(c1), q = rgb(c2);
    const r = Math.round(p[0] + (q[0] - p[0]) * k), g = Math.round(p[1] + (q[1] - p[1]) * k), bl = Math.round(p[2] + (q[2] - p[2]) * k);
    v = p[3] < 1 ? 'rgba(' + r + ',' + g + ',' + bl + ',' + p[3] + ')' : 'rgb(' + r + ',' + g + ',' + bl + ')';
    b.set(k, v);
    return v;
  }
  const shade = (c, k) => mix(c, '#2a1840', k == null ? 0.3 : k);
  const tint = (c, k) => mix(c, WHITE, k == null ? 0.35 : k);
  function rgba(c, a) { const v = rgb(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }

  // ======================================================================
  // Caminhos (cada um começa com moveTo: dá para juntar vários num path só)
  // ======================================================================
  function E(c, x, y, rx, ry, rot) {
    if (!(rx > 0) || !(ry > 0)) return;
    if (rot) { c.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); c.ellipse(x, y, rx, ry, rot, 0, TAU); }
    else { c.moveTo(x + rx, y); c.ellipse(x, y, rx, ry, 0, 0, TAU); }
    c.closePath();
  }
  function O(c, x, y, r) { if (!(r > 0)) return; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); c.closePath(); }
  function RR(c, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function fillP(c, col) { c.fillStyle = col; c.fill(); }
  function strokeP(c, col, w) { c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  // preenche com contorno de tinta (contorno por fora: traço grosso antes do preenchimento)
  function inked(c, col, lw) { c.strokeStyle = INK; c.lineWidth = lw * 2; c.stroke(); c.fillStyle = col; c.fill(); }

  // Brilho radial em cache (sem shadowBlur). Gradiente unitário, escalado na hora.
  const gradCache = new WeakMap();
  function radial(ctx, color) {
    let m = gradCache.get(ctx);
    if (!m) { m = new Map(); gradCache.set(ctx, m); }
    let gr = m.get(color);
    if (!gr) {
      gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, rgba(color, 0.9));
      gr.addColorStop(0.4, rgba(color, 0.4));
      gr.addColorStop(1, rgba(color, 0));
      m.set(color, gr);
    }
    return gr;
  }
  function glow(ctx, x, y, r, color, alpha) {
    if (!(r > 0) || !(alpha > 0)) return;
    if (ctx === G.ctx && G.quality === 'low') return; // qualidade baixa: sem halos no jogo (gradiente por pixel)
    ctx.save();
    ctx.translate(x, y); ctx.scale(r, r);
    ctx.globalAlpha *= Math.min(1, alpha);
    ctx.fillStyle = radial(ctx, color);
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // O Chrome grava os comandos de um canvas e só rasteriza no 1º uso: desenhar num canvas
  // de 1 px força a rasterização na hora em que o sprite nasce (e não no meio de um quadro).
  let BAKE = null;
  function bake(cv) {
    try {
      if (!BAKE) { const b = document.createElement('canvas'); b.width = 1; b.height = 1; BAKE = b.getContext('2d'); }
      BAKE.drawImage(cv, 0, 0, 1, 1);
    } catch (e) { /* nada */ }
    return cv;
  }
  // Sprites pré-renderizados (itens muito repetidos, ex.: 200 moedas de Pix)
  const spriteCache = new Map();
  function sprite(key, w, h, paint) {
    let c = spriteCache.get(key);
    if (c) return c;
    const k = 3;
    c = document.createElement('canvas');
    c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    const x = c.getContext('2d');
    x.scale(k, k); x.translate(w / 2, h / 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    try { paint(x); } catch (err) { G.reportError(err, 'art.sprite ' + key); }
    c._w = w; c._h = h;
    spriteCache.set(key, bake(c));
    return c;
  }
  function drawSprite(ctx, spr, x, y) { ctx.drawImage(spr, x - spr._w / 2, y - spr._h / 2, spr._w, spr._h); }

  // ======================================================================
  // G.Art.person — caricatura "cabeção"
  // Unidades: 100 = altura total. Centro (0,0) = meio do personagem.
  // Cabeça centrada em y≈-14 (raio 27), corpo de 8 a 41, pés até ~50.
  // ======================================================================
  // estado da chamada atual (person não é reentrante)
  let U1 = 1;        // 1 px em unidades
  let LW = 3;        // contorno em unidades
  let DET = false;   // tamanho bom para detalhes
  let BIG = false;   // tamanho de retrato
  let FL = false;    // flash branco
  let BLINK = null;  // força olho fechado/aberto (sprites em cache)
  let NO_EMOTES = false;

  // Poses: [mãoE x,y, controleE x,y, mãoD x,y, controleD x,y] (lado direito = +x)
  const HANDS = [0, 0, 0, 0, 0, 0, 0, 0];
  // sw = balanço lento (-1..1), fast = oscilação da pose (-1..1)
  const POSE_FREQ = { wave: 12, up: 14, fist: 9 };
  function poseHands(pose, sw, fast) {
    let a;
    switch (pose) {
      case 'wave': { const w = fast * 4; a = [-24, 33 + sw * 1.6, -25, 20, 27 + w, -6, 30, 10]; break; }
      case 'up': { const w = fast * 1.5; a = [-28, -7 + w, -30, 10, 28, -7 - w, 30, 10]; break; }
      case 'fist': { const w = Math.abs(fast) * 4; a = [-27, 1 - w, -31, 18, 27, 1 - w, 31, 18]; break; }
      case 'point': a = [-24, 33 + sw * 1.6, -25, 20, 36, 12, 27, 13]; break;
      case 'hold': a = [-9, 30, -24, 30, 9, 30, 24, 30]; break;
      case 'drive': a = [-15, 25, -25, 26, 15, 25, 25, 26]; break;
      case 'knit': a = [-12, 20, -26, 26, 12, 20, 26, 26]; break;
      case 'shrug': a = [-34, 15, -27, 26, 34, 15, 27, 26]; break;
      case 'cross': a = [11, 25, -22, 30, -11, 25, 22, 30]; break;
      default: a = [-24, 33 + sw * 1.6, -25, 20, 24, 33 - sw * 1.6, 25, 20];
    }
    for (let i = 0; i < 8; i++) HANDS[i] = a[i];
    return HANDS;
  }

  function torsoPath(c) {
    c.moveTo(-22, 41);
    c.quadraticCurveTo(-24.5, 13, -13, 8.5);
    c.lineTo(13, 8.5);
    c.quadraticCurveTo(24.5, 13, 22, 41);
    c.quadraticCurveTo(0, 44.5, -22, 41);
    c.closePath();
  }
  function bodyMain(spec, body) {
    if (body === 'suit') return spec.suit || '#2b3445';
    if (body === 'uniform') return spec.suit || '#4f6b3a';
    if (body === 'cardigan') return spec.suit || '#ff8fc0';
    return spec.shirt || '#ffffff';
  }

  function drawBody(c, spec, body, legSw, skin) {
    const main = FL ? WHITE : bodyMain(spec, body);
    const pants = FL ? WHITE : spec.pants || (body === 'suit' || body === 'uniform' ? shade(main, 0.32) : body === 'cardigan' ? '#7d6b9e' : '#34508a');
    const sw = legSw;
    // contorno: pernas + sapatos + tronco
    c.beginPath();
    RR(c, -11, 36, 8.5, 9.5, 2.5); RR(c, 2.5, 36, 8.5, 9.5, 2.5);
    E(c, -7.5, 46.4 + sw, 6.3, 3.3); E(c, 7.5, 46.4 - sw, 6.3, 3.3);
    torsoPath(c);
    strokeP(c, INK, LW * 2);
    c.beginPath(); RR(c, -11, 36, 8.5, 9.5, 2.5); RR(c, 2.5, 36, 8.5, 9.5, 2.5); fillP(c, pants);
    c.beginPath(); E(c, -7.5, 46.4 + sw, 6.3, 3.3); E(c, 7.5, 46.4 - sw, 6.3, 3.3); fillP(c, FL ? WHITE : '#2a1d18');
    c.beginPath(); torsoPath(c); fillP(c, main);
    if (!FL) {
      const shirt = spec.shirt || '#f2f2f2';
      if (body === 'suit') {
        c.beginPath(); c.moveTo(-8.5, 8.5); c.lineTo(0, 27); c.lineTo(8.5, 8.5); c.closePath(); fillP(c, shirt);
        // lapelas
        c.beginPath();
        c.moveTo(-8.5, 8.6); c.lineTo(-13.5, 10.5); c.lineTo(-1.2, 28.5); c.lineTo(0, 27); c.closePath();
        c.moveTo(8.5, 8.6); c.lineTo(13.5, 10.5); c.lineTo(1.2, 28.5); c.lineTo(0, 27); c.closePath();
        fillP(c, shade(main, 0.22));
        if (spec.tie) drawTie(c, spec.tie, 27);
        if (DET) { c.beginPath(); O(c, 2.2, 33, 1.2); O(c, 2.2, 38, 1.2); fillP(c, shade(main, 0.45)); }
        if (spec.pin) drawPin(c, spec.pin, spec.pinShape);
      } else if (body === 'shirt') {
        c.beginPath(); c.moveTo(0, 10); c.lineTo(0, 41); strokeP(c, shade(main, 0.25), Math.max(1.3, U1));
        c.beginPath();
        c.moveTo(-9.5, 8.2); c.lineTo(-0.5, 9.5); c.lineTo(-5, 15.5); c.closePath();
        c.moveTo(9.5, 8.2); c.lineTo(0.5, 9.5); c.lineTo(5, 15.5); c.closePath();
        fillP(c, tint(main, 0.4));
        if (spec.tie) drawTie(c, spec.tie, 27);
        else if (DET) { c.beginPath(); O(c, 0, 20, 1); O(c, 0, 28, 1); O(c, 0, 36, 1); fillP(c, shade(main, 0.35)); }
        if (spec.pin) drawPin(c, spec.pin, spec.pinShape);
      } else if (body === 'tshirt') {
        c.beginPath(); E(c, 0, 8.8, 8, 4.2); fillP(c, skin);
        c.beginPath(); c.ellipse(0, 8.8, 8, 4.2, 0, 0.05, PI - 0.05); strokeP(c, shade(main, 0.3), Math.max(1.6, U1));
        if (spec.pin) drawPin(c, spec.pin, spec.pinShape);
      } else if (body === 'tank') {
        // ombros e decote à mostra
        c.beginPath();
        c.moveTo(-13, 8.5); c.quadraticCurveTo(-24.5, 13, -23.4, 25); c.quadraticCurveTo(-13, 22, -9, 8.5); c.closePath();
        c.moveTo(13, 8.5); c.quadraticCurveTo(24.5, 13, 23.4, 25); c.quadraticCurveTo(13, 22, 9, 8.5); c.closePath();
        c.moveTo(-5.5, 8.5); c.quadraticCurveTo(0, 22, 5.5, 8.5); c.closePath();
        fillP(c, skin);
      } else if (body === 'uniform') {
        c.beginPath(); c.moveTo(-6, 8.5); c.lineTo(0, 16); c.lineTo(6, 8.5); c.closePath(); fillP(c, shade(main, 0.25));
        c.beginPath(); RR(c, -20, 9.5, 8, 3.2, 1.2); RR(c, 12, 9.5, 8, 3.2, 1.2); fillP(c, '#e8c547');
        c.beginPath(); for (let i = 0; i < 3; i++) { O(c, -4.5, 21 + i * 6.5, 1.3); O(c, 4.5, 21 + i * 6.5, 1.3); } fillP(c, '#e8c547');
        if (DET) { c.beginPath(); c.rect(-17, 17, 3, 2.2); fillP(c, '#e63946'); c.beginPath(); c.rect(-14, 17, 3, 2.2); fillP(c, '#3ddc84'); c.beginPath(); c.rect(-11, 17, 3, 2.2); fillP(c, '#ffd23f'); }
      } else if (body === 'cardigan') {
        c.beginPath(); c.moveTo(-6, 8.5); c.lineTo(6, 8.5); c.lineTo(3.5, 42.5); c.lineTo(-3.5, 42.5); c.closePath(); fillP(c, shirt === '#f2f2f2' ? '#fff4f8' : shirt);
        c.beginPath(); for (let i = 0; i < 3; i++) O(c, -5, 18 + i * 7.5, 1.4); fillP(c, tint(main, 0.55));
        if (DET) {
          // gola rendada e colar de pérolas
          c.beginPath(); for (let i = -2; i <= 2; i++) O(c, i * 2.6, 11.5 + Math.abs(i) * -0.5 + (i * i) * 0.35, 1.1); fillP(c, '#fffdf2');
        }
      }
      if (spec.sash) drawSash(c, spec.sash);
      // sombra chapada no lado direito do tronco
      c.beginPath();
      c.moveTo(13, 8.5); c.quadraticCurveTo(24.5, 13, 22, 41); c.quadraticCurveTo(17.5, 42.6, 13.5, 43); c.quadraticCurveTo(18.5, 22, 8.5, 8.5); c.closePath();
      fillP(c, SHADE_RGBA);
    }
  }
  function drawTie(c, col, bottom) {
    c.beginPath();
    c.moveTo(-2.6, 9.6); c.lineTo(2.6, 9.6); c.lineTo(1.8, 13); c.lineTo(-1.8, 13); c.closePath();
    c.moveTo(-1.8, 13); c.lineTo(1.8, 13); c.lineTo(3.6, bottom - 4); c.lineTo(0, bottom + 0.5); c.lineTo(-3.6, bottom - 4); c.closePath();
    fillP(c, col);
    if (DET) { c.beginPath(); c.moveTo(-1.8, 13); c.lineTo(1.8, 13); strokeP(c, shade(col, 0.35), Math.max(0.9, U1 * 0.8)); }
  }
  function drawPin(c, col, shape) {
    c.beginPath();
    if (shape === 'star') starPath(c, -14.5, 19, 3.4, 1.4, 5); else O(c, -14.5, 19, 2.5);
    fillP(c, col);
  }
  function starPath(c, x, y, r1, r2, n) {
    for (let i = 0; i < n * 2; i++) {
      const a = -PI / 2 + i * PI / n, r = i % 2 ? r2 : r1;
      if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  function drawSash(c, sash) {
    c.save();
    c.beginPath(); torsoPath(c); c.clip();
    c.beginPath(); c.moveTo(-17, 8); c.lineTo(-7.5, 8); c.lineTo(25, 37); c.lineTo(22, 46); c.closePath(); fillP(c, sash[0]);
    c.beginPath(); c.moveTo(-13.6, 8); c.lineTo(-10.6, 8); c.lineTo(24.5, 40); c.lineTo(23.5, 43); c.closePath(); fillP(c, sash[1] || sash[0]);
    if (DET) { c.beginPath(); O(c, 15, 34, 3.2); fillP(c, '#1b3fa0'); c.beginPath(); O(c, 15, 34, 1.6); fillP(c, '#ffd23f'); }
    c.restore();
  }

  function drawArms(c, H, spec, body, skin, pose) {
    const sleeve = FL ? WHITE : body === 'tank' ? skin : bodyMain(spec, body);
    const aw = 8.6;
    c.beginPath();
    c.moveTo(-16, 14); c.quadraticCurveTo(H[2], H[3], H[0], H[1]);
    c.moveTo(16, 14); c.quadraticCurveTo(H[6], H[7], H[4], H[5]);
    strokeP(c, INK, aw + LW * 2);
    strokeP(c, sleeve, aw);
    // punho da camisa (terno)
    if (!FL && DET && (body === 'suit' || body === 'uniform')) {
      c.beginPath();
      cuff(c, H[0], H[1], H[2], H[3]); cuff(c, H[4], H[5], H[6], H[7]);
      strokeP(c, spec.shirt || '#f2f2f2', 3.2);
    }
    if (pose === 'point') {
      c.beginPath(); c.moveTo(H[4] + 2, H[5] - 0.6); c.lineTo(H[4] + 9.5, H[5] - 0.6);
      strokeP(c, INK, 3.6 + LW * 2); strokeP(c, skin, 3.6);
    }
    c.beginPath(); O(c, H[0], H[1], 4.9 + LW); O(c, H[4], H[5], 4.9 + LW); fillP(c, INK);
    c.beginPath(); O(c, H[0], H[1], 4.9); O(c, H[4], H[5], 4.9); fillP(c, skin);
    if (DET && !FL) { c.beginPath(); O(c, H[0] - 1.5, H[1] - 1.6, 1.4); O(c, H[4] - 1.5, H[5] - 1.6, 1.4); fillP(c, 'rgba(255,255,255,0.35)'); }
  }
  function cuff(c, hx, hy, cx, cy) {
    const dx = hx - cx, dy = hy - cy, d = Math.hypot(dx, dy) || 1;
    const px = hx - (dx / d) * 4.6, py = hy - (dy / d) * 4.6;
    c.moveTo(px - (dy / d) * 3.4, py + (dx / d) * 3.4); c.lineTo(px + (dy / d) * 3.4, py - (dx / d) * 3.4);
  }

  // ---------- cabeça ----------
  function headPath(c, shape, cx, cy, rx, ry) {
    if (shape === 'square') {
      c.moveTo(cx, cy - ry);
      c.bezierCurveTo(cx + rx * 0.82, cy - ry, cx + rx, cy - ry * 0.72, cx + rx, cy - ry * 0.12);
      c.bezierCurveTo(cx + rx, cy + ry * 0.55, cx + rx * 0.88, cy + ry, cx, cy + ry);
      c.bezierCurveTo(cx - rx * 0.88, cy + ry, cx - rx, cy + ry * 0.55, cx - rx, cy - ry * 0.12);
      c.bezierCurveTo(cx - rx, cy - ry * 0.72, cx - rx * 0.82, cy - ry, cx, cy - ry);
      c.closePath();
    } else if (shape === 'jowl') {
      c.moveTo(cx, cy - ry);
      c.bezierCurveTo(cx + rx * 0.72, cy - ry, cx + rx * 0.9, cy - ry * 0.55, cx + rx * 0.93, cy - ry * 0.05);
      c.bezierCurveTo(cx + rx * 1.06, cy + ry * 0.62, cx + rx * 0.7, cy + ry, cx, cy + ry);
      c.bezierCurveTo(cx - rx * 0.7, cy + ry, cx - rx * 1.06, cy + ry * 0.62, cx - rx * 0.93, cy - ry * 0.05);
      c.bezierCurveTo(cx - rx * 0.9, cy - ry * 0.55, cx - rx * 0.72, cy - ry, cx, cy - ry);
      c.closePath();
    } else E(c, cx, cy, rx, ry, 0);
  }

  // Cabelos: part = 'back' (atrás da cabeça) ou 'front'. Retorna true se desenhou algo.
  function hairPath(c, hair, cx, cy, rx, ry, part) {
    const F = part === 'front';
    switch (hair) {
      case 'side':
        if (!F) return false;
        c.moveTo(cx - rx * 1.04, cy + 2);
        c.bezierCurveTo(cx - rx * 1.1, cy - ry * 0.95, cx - rx * 0.5, cy - ry * 1.2, cx + rx * 0.08, cy - ry * 1.14);
        c.bezierCurveTo(cx + rx * 0.78, cy - ry * 1.1, cx + rx * 1.12, cy - ry * 0.68, cx + rx * 1.04, cy + 2);
        c.quadraticCurveTo(cx + rx * 0.9, cy - ry * 0.36, cx + rx * 0.62, cy - ry * 0.47);
        c.quadraticCurveTo(cx + rx * 0.08, cy - ry * 0.68, cx - rx * 0.32, cy - ry * 0.45);
        c.quadraticCurveTo(cx - rx * 0.62, cy - ry * 0.27, cx - rx * 0.8, cy - ry * 0.33);
        c.quadraticCurveTo(cx - rx * 0.92, cy - ry * 0.12, cx - rx * 1.04, cy + 2);
        c.closePath();
        return true;
      case 'short':
        if (!F) return false;
        c.moveTo(cx - rx * 1.03, cy);
        c.bezierCurveTo(cx - rx * 1.07, cy - ry * 0.98, cx - rx * 0.45, cy - ry * 1.13, cx, cy - ry * 1.1);
        c.bezierCurveTo(cx + rx * 0.45, cy - ry * 1.13, cx + rx * 1.07, cy - ry * 0.98, cx + rx * 1.03, cy);
        c.quadraticCurveTo(cx + rx * 0.9, cy - ry * 0.45, cx + rx * 0.45, cy - ry * 0.6);
        c.quadraticCurveTo(cx, cy - ry * 0.52, cx - rx * 0.45, cy - ry * 0.6);
        c.quadraticCurveTo(cx - rx * 0.9, cy - ry * 0.45, cx - rx * 1.03, cy);
        c.closePath();
        return true;
      case 'slick':
        if (!F) return false;
        c.moveTo(cx - rx * 1.03, cy - 1);
        c.bezierCurveTo(cx - rx * 1.08, cy - ry * 1.05, cx - rx * 0.4, cy - ry * 1.2, cx, cy - ry * 1.16);
        c.bezierCurveTo(cx + rx * 0.4, cy - ry * 1.2, cx + rx * 1.08, cy - ry * 1.05, cx + rx * 1.03, cy - 1);
        c.quadraticCurveTo(cx + rx * 0.82, cy - ry * 0.55, cx + rx * 0.36, cy - ry * 0.64);
        c.quadraticCurveTo(cx + rx * 0.1, cy - ry * 0.6, cx, cy - ry * 0.47);
        c.quadraticCurveTo(cx - rx * 0.1, cy - ry * 0.6, cx - rx * 0.36, cy - ry * 0.64);
        c.quadraticCurveTo(cx - rx * 0.82, cy - ry * 0.55, cx - rx * 1.03, cy - 1);
        c.closePath();
        return true;
      case 'bob':
        if (!F) {
          c.moveTo(cx - rx * 1.2, cy + ry * 0.62);
          c.bezierCurveTo(cx - rx * 1.36, cy - ry * 0.9, cx - rx * 0.7, cy - ry * 1.26, cx, cy - ry * 1.22);
          c.bezierCurveTo(cx + rx * 0.7, cy - ry * 1.26, cx + rx * 1.36, cy - ry * 0.9, cx + rx * 1.2, cy + ry * 0.62);
          c.quadraticCurveTo(cx, cy + ry * 0.8, cx - rx * 1.2, cy + ry * 0.62);
          c.closePath();
          return true;
        }
        c.moveTo(cx - rx * 1.22, cy + ry * 0.64);
        c.bezierCurveTo(cx - rx * 1.32, cy - ry * 0.9, cx - rx * 0.6, cy - ry * 1.24, cx, cy - ry * 1.19);
        c.bezierCurveTo(cx + rx * 0.6, cy - ry * 1.24, cx + rx * 1.32, cy - ry * 0.9, cx + rx * 1.22, cy + ry * 0.64);
        c.quadraticCurveTo(cx + rx * 1.02, cy + ry * 0.7, cx + rx * 0.86, cy + ry * 0.5);
        c.quadraticCurveTo(cx + rx * 0.94, cy - ry * 0.28, cx + rx * 0.55, cy - ry * 0.5);
        c.quadraticCurveTo(cx + rx * 0.05, cy - ry * 0.28, cx - rx * 0.42, cy - ry * 0.56);
        c.quadraticCurveTo(cx - rx * 0.92, cy - ry * 0.36, cx - rx * 0.86, cy + ry * 0.5);
        c.quadraticCurveTo(cx - rx * 1.02, cy + ry * 0.7, cx - rx * 1.22, cy + ry * 0.64);
        c.closePath();
        return true;
      case 'long':
        if (!F) {
          c.moveTo(cx - rx * 1.16, cy + ry * 1.3);
          c.bezierCurveTo(cx - rx * 1.42, cy - ry * 0.6, cx - rx * 0.8, cy - ry * 1.26, cx, cy - ry * 1.2);
          c.bezierCurveTo(cx + rx * 0.8, cy - ry * 1.26, cx + rx * 1.42, cy - ry * 0.6, cx + rx * 1.16, cy + ry * 1.3);
          c.quadraticCurveTo(cx, cy + ry * 1.42, cx - rx * 1.16, cy + ry * 1.3);
          c.closePath();
          return true;
        }
        c.moveTo(cx - rx * 1.12, cy + ry * 0.9);
        c.bezierCurveTo(cx - rx * 1.28, cy - ry * 0.95, cx - rx * 0.5, cy - ry * 1.22, cx, cy - ry * 1.16);
        c.bezierCurveTo(cx + rx * 0.5, cy - ry * 1.22, cx + rx * 1.28, cy - ry * 0.95, cx + rx * 1.12, cy + ry * 0.9);
        c.quadraticCurveTo(cx + rx * 0.98, cy + ry * 0.95, cx + rx * 0.84, cy + ry * 0.62);
        c.quadraticCurveTo(cx + rx * 0.92, cy - ry * 0.4, cx + rx * 0.05, cy - ry * 0.62);
        c.quadraticCurveTo(cx - rx * 0.92, cy - ry * 0.4, cx - rx * 0.84, cy + ry * 0.62);
        c.quadraticCurveTo(cx - rx * 0.98, cy + ry * 0.95, cx - rx * 1.12, cy + ry * 0.9);
        c.closePath();
        return true;
      case 'bald':
        if (!F) return false;
        E(c, cx - rx * 0.93, cy - ry * 0.08, rx * 0.17, ry * 0.3, 0.15);
        E(c, cx + rx * 0.93, cy - ry * 0.08, rx * 0.17, ry * 0.3, -0.15);
        return true;
      case 'gray': // calvície em "ferradura": laterais onduladas penteadas para trás + um topete ralo
        if (!F) return false;
        for (let i = 0; i < 2; i++) {
          const sd = i ? 1 : -1;
          c.moveTo(cx + sd * rx * 1.05, cy + ry * 0.14);
          c.bezierCurveTo(cx + sd * rx * 1.16, cy - ry * 0.3, cx + sd * rx * 1.0, cy - ry * 0.8, cx + sd * rx * 0.52, cy - ry * 0.95);
          c.quadraticCurveTo(cx + sd * rx * 0.72, cy - ry * 0.72, cx + sd * rx * 0.7, cy - ry * 0.58);
          c.quadraticCurveTo(cx + sd * rx * 0.86, cy - ry * 0.5, cx + sd * rx * 0.8, cy - ry * 0.3);
          c.quadraticCurveTo(cx + sd * rx * 0.92, cy - ry * 0.1, cx + sd * rx * 0.86, cy + ry * 0.12);
          c.closePath();
        }
        c.moveTo(cx - rx * 0.3, cy - ry * 0.97);
        c.quadraticCurveTo(cx, cy - ry * 1.12, cx + rx * 0.32, cy - ry * 0.99);
        c.quadraticCurveTo(cx + rx * 0.05, cy - ry * 0.9, cx - rx * 0.3, cy - ry * 0.97);
        c.closePath();
        return true;
      case 'combover':
        if (!F) return false;
        E(c, cx - rx * 0.92, cy - ry * 0.15, rx * 0.2, ry * 0.36, 0.2);
        E(c, cx + rx * 0.92, cy - ry * 0.15, rx * 0.2, ry * 0.36, -0.2);
        E(c, cx + rx * 0.05, cy - ry * 0.86, rx * 0.86, ry * 0.12, -0.12);
        E(c, cx + rx * 0.1, cy - ry * 0.66, rx * 0.8, ry * 0.08, -0.08);
        return true;
      case 'curly':
        if (!F) {
          for (let i = 0; i < 9; i++) {
            const a = PI * 0.86 + (i * PI * 1.28) / 8;
            O(c, cx + Math.cos(a) * rx * 1.0, cy + Math.sin(a) * ry * 0.98, rx * (i % 2 ? 0.3 : 0.34));
          }
          return true;
        }
        E(c, cx, cy - ry * 0.82, rx * 0.86, ry * 0.32);
        for (let i = 0; i < 5; i++) O(c, cx + (i - 2) * rx * 0.36, cy - ry * 0.6 + (i % 2) * -ry * 0.07, rx * 0.22);
        return true;
      case 'bun':
        if (!F) { O(c, cx, cy - ry * 1.12, rx * 0.38); return true; }
        c.moveTo(cx - rx * 1.03, cy + 2);
        c.bezierCurveTo(cx - rx * 1.1, cy - ry * 1.08, cx + rx * 1.1, cy - ry * 1.08, cx + rx * 1.03, cy + 2);
        c.quadraticCurveTo(cx + rx * 0.85, cy - ry * 0.5, cx, cy - ry * 0.62);
        c.quadraticCurveTo(cx - rx * 0.85, cy - ry * 0.5, cx - rx * 1.03, cy + 2);
        c.closePath();
        return true;
      case 'spiky':
        if (!F) return false;
        c.moveTo(cx - rx * 1.03, cy);
        c.lineTo(cx - rx * 1.12, cy - ry * 0.75);
        c.lineTo(cx - rx * 0.8, cy - ry * 0.95);
        c.lineTo(cx - rx * 0.72, cy - ry * 1.32);
        c.lineTo(cx - rx * 0.3, cy - ry * 1.08);
        c.lineTo(cx, cy - ry * 1.45);
        c.lineTo(cx + rx * 0.3, cy - ry * 1.08);
        c.lineTo(cx + rx * 0.74, cy - ry * 1.3);
        c.lineTo(cx + rx * 0.8, cy - ry * 0.95);
        c.lineTo(cx + rx * 1.12, cy - ry * 0.75);
        c.lineTo(cx + rx * 1.03, cy);
        c.quadraticCurveTo(cx + rx * 0.8, cy - ry * 0.5, cx, cy - ry * 0.55);
        c.quadraticCurveTo(cx - rx * 0.8, cy - ry * 0.5, cx - rx * 1.03, cy);
        c.closePath();
        return true;
      case 'pompadour':
        if (!F) return false;
        c.moveTo(cx - rx * 1.03, cy);
        c.bezierCurveTo(cx - rx * 1.18, cy - ry * 1.05, cx - rx * 0.5, cy - ry * 1.6, cx + rx * 0.3, cy - ry * 1.5);
        c.bezierCurveTo(cx + rx * 1.05, cy - ry * 1.4, cx + rx * 1.18, cy - ry * 0.8, cx + rx * 1.03, cy);
        c.quadraticCurveTo(cx + rx * 0.85, cy - ry * 0.55, cx + rx * 0.3, cy - ry * 0.66);
        c.quadraticCurveTo(cx - rx * 0.2, cy - ry * 0.72, cx - rx * 0.55, cy - ry * 0.55);
        c.quadraticCurveTo(cx - rx * 0.9, cy - ry * 0.4, cx - rx * 1.03, cy);
        c.closePath();
        return true;
      default:
        return false; // 'none'
    }
  }
  function hairShine(c, hair, cx, cy, rx, ry) {
    c.beginPath();
    if (hair === 'bald') { E(c, cx - rx * 0.34, cy - ry * 0.7, rx * 0.26, ry * 0.11, -0.45); fillP(c, 'rgba(255,255,255,0.45)'); return; }
    if (hair === 'none' || hair === 'gray' || hair === 'combover') return;
    if (hair === 'curly') { O(c, cx - rx * 0.62, cy - ry * 0.72, rx * 0.08); O(c, cx + rx * 0.1, cy - ry * 0.9, rx * 0.08); fillP(c, 'rgba(255,255,255,0.35)'); return; }
    c.moveTo(cx - rx * 0.55, cy - ry * 0.88);
    c.quadraticCurveTo(cx - rx * 0.1, cy - ry * 1.08, cx + rx * 0.4, cy - ry * 0.96);
    strokeP(c, 'rgba(255,255,255,0.28)', 2.4);
  }

  // Chapéus: lista de peças {p: caminho, c: índice de cor, eo: evenodd}
  // c: 0 cor principal, 1 sombra, 2 escuro, 3 dourado, 4 faixa vermelha, 5 vidro
  const HATS = {
    cap: [
      { c: 0, p(c, x, y, rx, ry) { c.moveTo(x - rx * 1.04, y - ry * 0.44); c.bezierCurveTo(x - rx * 1.07, y - ry * 1.34, x + rx * 1.07, y - ry * 1.34, x + rx * 1.04, y - ry * 0.44); c.quadraticCurveTo(x, y - ry * 0.58, x - rx * 1.04, y - ry * 0.44); c.closePath(); } },
      { c: 1, p(c, x, y, rx, ry) { c.moveTo(x - rx * 0.95, y - ry * 0.5); c.quadraticCurveTo(x, y - ry * 0.66, x + rx * 0.95, y - ry * 0.5); c.quadraticCurveTo(x + rx * 1.0, y - ry * 0.37, x + rx * 0.6, y - ry * 0.35); c.quadraticCurveTo(x, y - ry * 0.28, x - rx * 0.6, y - ry * 0.35); c.quadraticCurveTo(x - rx * 1.0, y - ry * 0.37, x - rx * 0.95, y - ry * 0.5); c.closePath(); } },
    ],
    military: [
      { c: 0, p(c, x, y, rx, ry) { c.moveTo(x - rx * 0.96, y - ry * 0.5); c.lineTo(x - rx * 1.28, y - ry * 1.12); c.quadraticCurveTo(x, y - ry * 1.5, x + rx * 1.28, y - ry * 1.12); c.lineTo(x + rx * 0.96, y - ry * 0.5); c.closePath(); } },
      { c: 1, p(c, x, y, rx, ry) { RR(c, x - rx * 0.98, y - ry * 0.72, rx * 1.96, ry * 0.24, 2); } },
      { c: 2, p(c, x, y, rx, ry) { c.moveTo(x - rx * 0.9, y - ry * 0.5); c.quadraticCurveTo(x, y - ry * 0.6, x + rx * 0.9, y - ry * 0.5); c.quadraticCurveTo(x + rx * 0.7, y - ry * 0.3, x, y - ry * 0.28); c.quadraticCurveTo(x - rx * 0.7, y - ry * 0.3, x - rx * 0.9, y - ry * 0.5); c.closePath(); } },
    ],
    helmet: [
      { c: 0, eo: true, p(c, x, y, rx, ry) { E(c, x, y - 1, rx * 1.2, ry * 1.15); RR(c, x - rx * 0.8, y - ry * 0.6, rx * 1.6, ry * 1.68, rx * 0.6); } },
      { c: 5, p(c, x, y, rx, ry) { RR(c, x - rx * 0.92, y - ry * 1.0, rx * 1.84, ry * 0.36, 6); } },
    ],
    cowboy: [
      { c: 1, p(c, x, y, rx, ry) { E(c, x, y - ry * 0.6, rx * 1.8, ry * 0.26); } },
      { c: 0, p(c, x, y, rx, ry) { c.moveTo(x - rx * 0.72, y - ry * 0.62); c.bezierCurveTo(x - rx * 0.82, y - ry * 1.48, x - rx * 0.3, y - ry * 1.32, x, y - ry * 1.22); c.bezierCurveTo(x + rx * 0.3, y - ry * 1.32, x + rx * 0.82, y - ry * 1.48, x + rx * 0.72, y - ry * 0.62); c.closePath(); } },
    ],
    hardhat: [
      { c: 0, p(c, x, y, rx, ry) { c.moveTo(x - rx * 1.05, y - ry * 0.48); c.bezierCurveTo(x - rx * 1.05, y - ry * 1.38, x + rx * 1.05, y - ry * 1.38, x + rx * 1.05, y - ry * 0.48); c.closePath(); } },
      { c: 1, p(c, x, y, rx, ry) { RR(c, x - rx * 1.28, y - ry * 0.58, rx * 2.56, ry * 0.2, 3); } },
    ],
    beret: [
      { c: 0, p(c, x, y, rx, ry) { E(c, x - 2, y - ry * 0.84, rx * 1.1, ry * 0.4, -0.12); O(c, x + 4, y - ry * 1.22, 2.4); } },
    ],
    tophat: [
      { c: 0, p(c, x, y, rx, ry) { RR(c, x - rx * 0.78, y - ry * 1.98, rx * 1.56, ry * 1.3, 3); } },
      { c: 0, p(c, x, y, rx, ry) { E(c, x, y - ry * 0.7, rx * 1.48, ry * 0.17); } },
    ],
    crown: [
      { c: 3, p(c, x, y, rx, ry) { c.moveTo(x - rx * 0.86, y - ry * 0.62); c.lineTo(x - rx * 0.98, y - ry * 1.36); c.lineTo(x - rx * 0.5, y - ry * 1.04); c.lineTo(x, y - ry * 1.52); c.lineTo(x + rx * 0.5, y - ry * 1.04); c.lineTo(x + rx * 0.98, y - ry * 1.36); c.lineTo(x + rx * 0.86, y - ry * 0.62); c.closePath(); } },
    ],
  };
  const HAT_COLOR = { cap: '#2366d1', military: '#3d5a3d', helmet: '#16181d', cowboy: '#a0703c', hardhat: '#ffd23f', beret: '#2a2a2a', tophat: '#1a1a1a', crown: '#ffd23f' };
  function hatCol(i, base) {
    if (FL) return WHITE;
    switch (i) {
      case 1: return shade(base, 0.38);
      case 2: return '#15171c';
      case 3: return '#ffd23f';
      case 4: return '#c0283a';
      case 5: return '#6fa8d8';
      default: return base;
    }
  }
  function drawHat(c, hat, spec, x, y, rx, ry, t) {
    const def = HATS[hat];
    if (!def) return;
    const base = spec.hatColor || HAT_COLOR[hat];
    for (let i = 0; i < def.length; i++) {
      const pc = def[i];
      c.beginPath(); pc.p(c, x, y, rx, ry); c.fillStyle = hatCol(pc.c, base); c.fill(pc.eo ? 'evenodd' : 'nonzero');
      // linha interna entre as peças (ex.: aba do boné)
      if (i > 0 && !FL) strokeP(c, INK, Math.max(LW * 0.55, U1 * 0.9));
    }
    if (FL) return;
    // detalhes
    if (hat === 'cap') {
      c.beginPath(); O(c, x, y - ry * 1.08, 2); fillP(c, shade(base, 0.3));
      if (DET) {
        c.beginPath(); c.moveTo(x, y - ry * 1.06); c.quadraticCurveTo(x - rx * 0.45, y - ry * 0.9, x - rx * 0.55, y - ry * 0.52);
        c.moveTo(x, y - ry * 1.06); c.quadraticCurveTo(x + rx * 0.45, y - ry * 0.9, x + rx * 0.55, y - ry * 0.52);
        strokeP(c, shade(base, 0.25), Math.max(1, U1 * 0.8));
        c.beginPath(); RR(c, x - 5.2, y - ry * 0.98, 10.4, 7, 2.5); fillP(c, '#ffffff');
        if (spec.hatLogo) {
          c.fillStyle = base; c.font = '900 6.4px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(spec.hatLogo, x, y - ry * 0.98 + 3.8);
        }
      }
    } else if (hat === 'military') {
      c.beginPath(); O(c, x, y - ry * 0.9, 3.6); fillP(c, '#ffd23f');
      c.beginPath(); c.moveTo(x - rx * 0.8, y - ry * 0.55); c.lineTo(x + rx * 0.8, y - ry * 0.55); strokeP(c, '#ffd23f', 1.6);
    } else if (hat === 'helmet') {
      c.beginPath(); RR(c, x - 3, y - ry * 1.15, 6, ry * 0.5, 2.5); fillP(c, (spec && spec.hatStripe) || '#ffd23f');
      if (DET) { c.beginPath(); E(c, x - rx * 0.62, y - ry * 0.5, 2.4, 6, 0.3); fillP(c, 'rgba(255,255,255,0.3)'); }
    } else if (hat === 'cowboy') {
      c.beginPath(); c.moveTo(x - rx * 0.76, y - ry * 0.78); c.quadraticCurveTo(x, y - ry * 0.86, x + rx * 0.76, y - ry * 0.78); strokeP(c, '#5a3618', 3.4);
    } else if (hat === 'hardhat') {
      c.beginPath(); RR(c, x - 3, y - ry * 1.22, 6, ry * 0.7, 3); fillP(c, tint(base, 0.4));
    } else if (hat === 'tophat') {
      c.beginPath(); c.rect(x - rx * 0.78, y - ry * 0.98, rx * 1.56, ry * 0.18); fillP(c, '#c0283a');
    } else if (hat === 'crown' && DET) {
      c.beginPath(); O(c, x, y - ry * 0.82, 2.2); fillP(c, '#e63946');
      c.beginPath(); O(c, x - rx * 0.55, y - ry * 0.8, 1.8); O(c, x + rx * 0.55, y - ry * 0.8, 1.8); fillP(c, '#4cc9f0');
    }
  }

  function beardPath(c, cx, cy, rx, ry) {
    c.moveTo(cx - rx * 0.99, cy - 1);
    c.bezierCurveTo(cx - rx * 1.06, cy + ry * 1.05, cx - rx * 0.45, cy + ry * 1.34, cx, cy + ry * 1.3);
    c.bezierCurveTo(cx + rx * 0.45, cy + ry * 1.34, cx + rx * 1.06, cy + ry * 1.05, cx + rx * 0.99, cy - 1);
    c.bezierCurveTo(cx + rx * 0.8, cy + ry * 0.34, cx + rx * 0.45, cy + ry * 0.4, cx, cy + ry * 0.36);
    c.bezierCurveTo(cx - rx * 0.45, cy + ry * 0.4, cx - rx * 0.8, cy + ry * 0.34, cx - rx * 0.99, cy - 1);
    c.closePath();
  }
  function mustachePath(c, mx, my, k) {
    c.moveTo(mx, my - 1.6 * k);
    c.bezierCurveTo(mx - 4 * k, my - 4.6 * k, mx - 10 * k, my - 3.6 * k, mx - 12 * k, my + 1.6 * k);
    c.bezierCurveTo(mx - 9 * k, my + 3.3 * k, mx - 4 * k, my + 2.3 * k, mx, my + 1);
    c.bezierCurveTo(mx + 4 * k, my + 2.3 * k, mx + 9 * k, my + 3.3 * k, mx + 12 * k, my + 1.6 * k);
    c.bezierCurveTo(mx + 10 * k, my - 3.6 * k, mx + 4 * k, my - 4.6 * k, mx, my - 1.6 * k);
    c.closePath();
  }

  function drawEyes(c, mood, ex, ey, lookX, lookY, blink, skin) {
    const lwE = Math.max(2.3, 1.15 * U1);
    c.lineWidth = lwE; c.strokeStyle = INK;
    if (mood === 'laugh') {
      c.beginPath();
      for (let i = 0; i < 2; i++) { const x = i ? ex : -ex; c.moveTo(x - 4.6, ey + 1.6); c.quadraticCurveTo(x, ey - 5.4, x + 4.6, ey + 1.6); }
      c.stroke();
      return;
    }
    if (mood === 'hurt') {
      c.beginPath();
      c.moveTo(-ex - 4, ey - 3.6); c.lineTo(-ex + 3.2, ey); c.lineTo(-ex - 4, ey + 3.6);
      c.moveTo(ex + 4, ey - 3.6); c.lineTo(ex - 3.2, ey); c.lineTo(ex + 4, ey + 3.6);
      c.stroke();
      return;
    }
    if (blink) {
      c.beginPath();
      for (let i = 0; i < 2; i++) { const x = i ? ex : -ex; c.moveTo(x - 4.2, ey + 0.5); c.quadraticCurveTo(x, ey + 3, x + 4.2, ey + 0.5); }
      c.stroke();
      return;
    }
    const px = lookX * 1.5, py = lookY * 1.2 + 0.4;
    if (mood === 'shock') {
      c.beginPath(); O(c, -ex, ey, 5.8); O(c, ex, ey, 5.8); fillP(c, WHITE); strokeP(c, INK, Math.max(1.4, U1 * 0.9));
      c.beginPath(); O(c, -ex + px, ey + py, 1.8); O(c, ex + px, ey + py, 1.8); fillP(c, INK);
      return;
    }
    if (BIG) {
      c.beginPath(); E(c, -ex, ey, 5.1, 6.2); E(c, ex, ey, 5.1, 6.2); fillP(c, WHITE); strokeP(c, INK, Math.max(1.3, U1 * 0.8));
      c.beginPath(); E(c, -ex + px, ey + py + 0.3, 3.5, 4); E(c, ex + px, ey + py + 0.3, 3.5, 4); fillP(c, INK);
      c.beginPath(); O(c, -ex + px - 1.2, ey + py - 1.3, 1.25); O(c, ex + px - 1.2, ey + py - 1.3, 1.25); fillP(c, WHITE);
    } else {
      c.beginPath(); E(c, -ex + px * 0.6, ey + py * 0.5, 3.3, 4.4); E(c, ex + px * 0.6, ey + py * 0.5, 3.3, 4.4); fillP(c, INK);
      if (DET) { c.beginPath(); O(c, -ex + px * 0.6 - 1, ey - 1.5, 1.15); O(c, ex + px * 0.6 - 1, ey - 1.5, 1.15); fillP(c, WHITE); }
    }
    // pálpebras (humor)
    const lidH = BIG ? 7 : 5;
    if (mood === 'angry') {
      c.beginPath();
      c.moveTo(-ex - 6.5, ey - lidH - 1); c.lineTo(-ex + 6.5, ey - lidH - 1); c.lineTo(-ex + 6.5, ey - 0.6); c.lineTo(-ex - 6.5, ey - lidH + 1.6); c.closePath();
      c.moveTo(ex + 6.5, ey - lidH - 1); c.lineTo(ex - 6.5, ey - lidH - 1); c.lineTo(ex - 6.5, ey - 0.6); c.lineTo(ex + 6.5, ey - lidH + 1.6); c.closePath();
      fillP(c, skin);
      c.beginPath(); c.moveTo(-ex - 5.5, ey - lidH + 2); c.lineTo(-ex + 5.5, ey - 1.2); c.moveTo(ex + 5.5, ey - lidH + 2); c.lineTo(ex - 5.5, ey - 1.2);
      strokeP(c, INK, lwE);
    } else if (mood === 'smug' || mood === 'tired') {
      c.beginPath(); c.rect(-ex - 6.5, ey - lidH - 1.5, 13, lidH + 1.2); c.rect(ex - 6.5, ey - lidH - 1.5, 13, lidH + 1.2); fillP(c, skin);
      c.beginPath(); c.moveTo(-ex - 5.2, ey - 0.4); c.lineTo(-ex + 5.2, ey - 0.4); c.moveTo(ex - 5.2, ey - 0.4); c.lineTo(ex + 5.2, ey - 0.4);
      strokeP(c, INK, lwE);
      if (mood === 'tired' && DET) {
        c.beginPath();
        c.moveTo(-ex - 4, ey + 5); c.quadraticCurveTo(-ex, ey + 7.5, -ex + 4, ey + 5);
        c.moveTo(ex - 4, ey + 5); c.quadraticCurveTo(ex, ey + 7.5, ex + 4, ey + 5);
        strokeP(c, 'rgba(70,40,90,0.45)', Math.max(1.6, U1));
      }
    }
  }

  function drawBrows(c, mood, spec, ex, by, browC) {
    const bushy = spec.brows === 'bushy';
    let type = spec.brows === 'bushy' ? 'normal' : spec.brows || 'normal';
    if (mood === 'angry') type = 'angry';
    else if (mood === 'hurt' || mood === 'sad' || mood === 'tired') type = 'worried';
    else if (mood === 'shock') type = 'up';
    else if (mood === 'smug') type = 'smug';
    else if (mood === 'laugh') type = type === 'angry' ? 'normal' : type;
    c.beginPath();
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      let yi = 0.5, yo = 0.5, ym = -2;
      if (type === 'angry') { yi = 3.4; yo = -2.2; ym = 0.6; }
      else if (type === 'worried') { yi = -2.6; yo = 1.6; ym = -0.6; }
      else if (type === 'determined') { yi = 2; yo = -1; ym = 0; }
      else if (type === 'up') { yi = -3.4; yo = -3; ym = -5.5; }
      else if (type === 'smug') { if (sd > 0) { yi = -2.4; yo = -2.8; ym = -5; } else { yi = 1.4; yo = 0.4; ym = 0; } }
      const xi = sd * (ex - 5.2), xo = sd * (ex + 5.6);
      c.moveTo(xo, by + yo);
      c.quadraticCurveTo(sd * ex, by + ym, xi, by + yi);
    }
    c.strokeStyle = browC;
    c.lineWidth = Math.max(bushy ? 5.6 : 3.7, (bushy ? 1.7 : 1.2) * U1);
    c.stroke();
  }

  function drawMouth(c, mood, mo, mx, my, spec, t) {
    let m = clamp(mo || 0, 0, 1);
    const lwM = Math.max(2.3, 1.1 * U1);
    if (mood === 'laugh') m = Math.max(m, 0.8);
    if (mood === 'shock') m = Math.max(m, 0.5);
    c.lineWidth = lwM; c.strokeStyle = INK;
    if (m < 0.08) {
      if (spec.grin && (mood === 'normal' || mood === 'smug')) {
        c.beginPath();
        c.moveTo(mx - 10, my - 3); c.quadraticCurveTo(mx, my + 7, mx + 10, my - 3); c.quadraticCurveTo(mx, my + 1.2, mx - 10, my - 3); c.closePath();
        fillP(c, WHITE); strokeP(c, INK, lwM * 0.8);
        if (DET) { c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(mx + i * 3.3, my - 0.6 + Math.abs(i) * -0.5); c.lineTo(mx + i * 3.3, my + 2.4 - Math.abs(i) * 0.7); } strokeP(c, 'rgba(16,20,24,0.5)', Math.max(0.8, U1 * 0.6)); }
        return;
      }
      c.beginPath();
      if (mood === 'angry') { c.moveTo(mx - 6, my + 2); c.quadraticCurveTo(mx, my - 3, mx + 6, my + 2); }
      else if (mood === 'sad') { c.moveTo(mx - 6, my + 2.4); c.quadraticCurveTo(mx, my - 2.6, mx + 6, my + 2.4); }
      else if (mood === 'hurt') { c.moveTo(mx - 6.5, my); c.quadraticCurveTo(mx - 3.2, my - 2.8, mx, my); c.quadraticCurveTo(mx + 3.2, my + 2.8, mx + 6.5, my); }
      else if (mood === 'smug') { c.moveTo(mx - 6, my + 0.6); c.quadraticCurveTo(mx + 1.5, my + 3.2, mx + 7.5, my - 3); }
      else if (mood === 'tired') { c.moveTo(mx - 5, my + 1); c.lineTo(mx + 5, my + 0.4); }
      else { c.moveTo(mx - 6.5, my - 1.2); c.quadraticCurveTo(mx, my + 4.6, mx + 6.5, my - 1.2); }
      c.stroke();
      return;
    }
    const dark = '#5a1622';
    if (mood === 'angry') {
      const h = 4 + m * 5;
      c.beginPath(); RR(c, mx - 8, my - 2.6, 16, h, 2.4); fillP(c, WHITE); strokeP(c, INK, lwM * 0.85);
      c.beginPath(); c.moveTo(mx - 8, my - 2.6 + h / 2); c.lineTo(mx + 8, my - 2.6 + h / 2);
      for (let i = -1; i <= 1; i++) { c.moveTo(mx + i * 4, my - 2.6); c.lineTo(mx + i * 4, my - 2.6 + h); }
      strokeP(c, 'rgba(16,20,24,0.55)', Math.max(0.8, U1 * 0.6));
      return;
    }
    if (mood === 'shock' || mood === 'hurt') {
      c.beginPath(); E(c, mx, my + 1, 3 + m * 2.2, 3 + m * 3.6); fillP(c, dark); strokeP(c, INK, lwM * 0.8);
      return;
    }
    if (mood === 'laugh') { // boca em "D" (sem clip: dentes e língua cabem dentro)
      const w = 8.6, h = 6 + m * 5;
      c.beginPath(); c.moveTo(mx - w, my - 2.5); c.lineTo(mx + w, my - 2.5); c.bezierCurveTo(mx + w, my + h, mx - w, my + h, mx - w, my - 2.5); c.closePath();
      fillP(c, dark);
      if (DET) {
        c.beginPath(); c.moveTo(mx - w * 0.9, my - 2.5); c.lineTo(mx + w * 0.9, my - 2.5); c.lineTo(mx + w * 0.78, my - 0.2); c.lineTo(mx - w * 0.78, my - 0.2); c.closePath(); fillP(c, WHITE);
        c.beginPath(); E(c, mx, my + h * 0.5, w * 0.42, h * 0.2); fillP(c, '#ef6b7b');
      }
      c.beginPath(); c.moveTo(mx - w, my - 2.5); c.lineTo(mx + w, my - 2.5); c.bezierCurveTo(mx + w, my + h, mx - w, my + h, mx - w, my - 2.5); c.closePath();
      strokeP(c, INK, lwM * 0.85);
      return;
    }
    // falando (normal, smug, sad, tired)
    const w = 5.6 + m * 1.8, h = 1.6 + m * 6.2;
    const yc = my + h * 0.3;
    c.beginPath(); E(c, mx, yc, w, h); fillP(c, dark);
    if (m > 0.28 && DET) {
      c.beginPath(); E(c, mx, yc - h * 0.62, w * 0.62, h * 0.24); fillP(c, WHITE);
      if (m > 0.5) { c.beginPath(); E(c, mx, yc + h * 0.5, w * 0.5, h * 0.3); fillP(c, '#ef6b7b'); }
    }
    c.beginPath(); E(c, mx, yc, w, h); strokeP(c, INK, lwM * 0.8);
  }

  function drawEmotes(c, mood, spec, rx, ry, hy, t) {
    // veia de raiva
    if (mood === 'angry') {
      const vx = rx * 0.6, vy = hy - ry * 0.72, r = 3.1 * (1 + 0.14 * Math.sin(t * 16));
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1;
        const a = Math.atan2(-sy, -sx);
        c.moveTo(vx + sx * r + Math.cos(a - 0.85) * r * 0.85, vy + sy * r + Math.sin(a - 0.85) * r * 0.85);
        c.arc(vx + sx * r, vy + sy * r, r * 0.85, a - 0.85, a + 0.85);
      }
      strokeP(c, INK, Math.max(3.6, 2.2 * U1)); strokeP(c, '#ff3b4e', Math.max(1.8, 1.1 * U1));
    }
    // gota de suor
    if (mood === 'hurt' || mood === 'tired' || mood === 'shock' || spec.sweat) {
      const cyc = (t * 0.55 + (spec.seed || 0) * 0.3) % 1;
      const dx = rx * 0.9, dy = hy - ry * 0.42 + cyc * 9;
      const a = cyc < 0.85 ? 1 : 1 - (cyc - 0.85) / 0.15;
      const ga = c.globalAlpha; c.globalAlpha = ga * a;
      c.beginPath(); c.moveTo(dx, dy - 4.6); c.quadraticCurveTo(dx + 3.4, dy + 0.4, dx, dy + 2.8); c.quadraticCurveTo(dx - 3.4, dy + 0.4, dx, dy - 4.6); c.closePath();
      fillP(c, '#bdf0ff'); strokeP(c, INK, Math.max(1.2, U1 * 0.8));
      c.globalAlpha = ga;
    }
    if (mood === 'shock' && DET) {
      c.beginPath();
      for (let i = -1; i <= 1; i++) { const a = -PI / 2 + i * 0.5; c.moveTo(Math.cos(a) * (ry * 1.25), hy + Math.sin(a) * (ry * 1.25)); c.lineTo(Math.cos(a) * (ry * 1.5), hy + Math.sin(a) * (ry * 1.5)); }
      strokeP(c, INK, Math.max(1.8, U1));
    }
  }

  function headRX(shape) { return shape === 'round' ? 27 : shape === 'long' ? 22.5 : shape === 'square' || shape === 'jowl' ? 26 : 25; }
  function headRY(shape) { return shape === 'round' ? 26 : shape === 'long' ? 28.5 : shape === 'square' || shape === 'jowl' ? 26.5 : 27; }
  function drawHead(c, spec, o, mood, hy, t, skin, lookX, lookY) {
    const shape = spec.face || 'oval';
    const rx = headRX(shape), ry = headRY(shape);
    const hair = spec.hair || 'side';
    const hat = spec.hat || null;
    const hairC = FL ? WHITE : spec.hairColor || (hair === 'gray' ? '#c3c7cd' : '#2a2a2a');
    const beard = spec.beard || null;
    const beardC = FL ? WHITE : spec.beardColor || spec.hairColor || '#444444';
    const hasEars = !(hair === 'bob' || hair === 'long' || hair === 'curly') && hat !== 'helmet';
    const earY = hy + 2;

    // ---- contorno (silhueta inteira num traço só) ----
    c.beginPath();
    hairPath(c, hair, 0, hy, rx, ry, 'back');
    if (hasEars) { E(c, -rx + 0.5, earY, 4.7, 6.6); E(c, rx - 0.5, earY, 4.7, 6.6); }
    headPath(c, shape, 0, hy, rx, ry);
    if (beard === 'full') beardPath(c, 0, hy, rx, ry);
    hairPath(c, hair, 0, hy, rx, ry, 'front');
    if (hat && HATS[hat]) for (const pc of HATS[hat]) pc.p(c, 0, hy, rx, ry);
    strokeP(c, INK, LW * 2);

    // ---- cabelo de trás ----
    c.beginPath(); if (hairPath(c, hair, 0, hy, rx, ry, 'back')) fillP(c, hairC);
    // ---- orelhas ----
    if (hasEars) {
      c.beginPath(); E(c, -rx + 0.5, earY, 4.7, 6.6); E(c, rx - 0.5, earY, 4.7, 6.6); fillP(c, skin);
      if (DET) { c.beginPath(); E(c, -rx + 0.2, earY + 0.5, 2, 3.4); E(c, rx - 0.2, earY + 0.5, 2, 3.4); fillP(c, SHADE_RGBA); }
    }
    // ---- rosto + sombra chapada ----
    c.beginPath(); headPath(c, shape, 0, hy, rx, ry); fillP(c, skin);
    if (!FL) {
      c.beginPath(); headPath(c, shape, 0, hy, rx, ry); headPath(c, shape, -2.2, hy - 2.5, rx * 0.9, ry * 0.9);
      c.fillStyle = SHADE_RGBA; c.fill('evenodd');
    }
    const fx = lookX * 3.2, fy = lookY * 2.2;
    const ex = 9.6, ey = hy - 1 + fy;
    if (!FL) {
      // barba por fazer
      if (beard === 'stubble') {
        const ga = c.globalAlpha; c.globalAlpha = ga * 0.3;
        c.beginPath();
        c.moveTo(-rx * 0.92, hy + 2);
        c.quadraticCurveTo(-rx * 0.86, hy + ry * 0.98, 0, hy + ry);
        c.quadraticCurveTo(rx * 0.86, hy + ry * 0.98, rx * 0.92, hy + 2);
        c.quadraticCurveTo(rx * 0.5, hy + ry * 0.5, fx, hy + ry * 0.4);
        c.quadraticCurveTo(-rx * 0.5, hy + ry * 0.5, -rx * 0.92, hy + 2);
        c.closePath();
        fillP(c, beardC);
        c.globalAlpha = ga;
      }
      // rugas
      if (spec.wrinkles && DET) {
        c.beginPath();
        c.moveTo(-7, hy - ry * 0.62); c.quadraticCurveTo(0, hy - ry * 0.67, 7, hy - ry * 0.62);
        c.moveTo(-5, hy - ry * 0.54); c.quadraticCurveTo(0, hy - ry * 0.58, 5, hy - ry * 0.54);
        c.moveTo(-ex - 7.5, ey + 1); c.lineTo(-ex - 9.5, ey + 3); c.moveTo(ex + 7.5, ey + 1); c.lineTo(ex + 9.5, ey + 3);
        strokeP(c, 'rgba(90,50,40,0.35)', Math.max(1.2, U1 * 0.8));
      }
      // bochechas coradas
      if (DET || spec.cheeks) {
        c.beginPath(); E(c, -15.5 + fx, hy + 8 + fy, 4.6, 2.9); E(c, 15.5 + fx, hy + 8 + fy, 4.6, 2.9);
        fillP(c, spec.cheeks ? 'rgba(255,90,110,0.42)' : 'rgba(255,90,100,0.24)');
      }
    }
    // barba cheia
    if (beard === 'full') {
      c.beginPath(); beardPath(c, 0, hy, rx, ry); fillP(c, beardC);
      if (DET && !FL) {
        c.beginPath();
        c.moveTo(-rx * 0.7, hy + ry * 0.75); c.quadraticCurveTo(-rx * 0.55, hy + ry * 0.95, -rx * 0.62, hy + ry * 1.1);
        c.moveTo(rx * 0.7, hy + ry * 0.75); c.quadraticCurveTo(rx * 0.55, hy + ry * 0.95, rx * 0.62, hy + ry * 1.1);
        c.moveTo(-3, hy + ry * 1.05); c.quadraticCurveTo(0, hy + ry * 1.18, 3, hy + ry * 1.05);
        strokeP(c, shade(beardC, 0.28), Math.max(1.4, U1));
      }
    } else if (beard === 'goatee') {
      c.beginPath(); E(c, fx * 0.6, hy + ry * 0.86, 5.6, 5); fillP(c, beardC);
    }
    if (!FL) {
      const mx = fx, my = hy + 15.5 + fy;
      drawMouth(c, mood, o.mouth, mx, my, spec, t);
      if (spec.mustache || beard === 'full') {
        c.beginPath(); mustachePath(c, fx, hy + 12 + fy, beard === 'full' ? 1.05 : 0.95); fillP(c, beardC);
        if (DET) strokeP(c, INK, Math.max(1, U1 * 0.7));
      }
      // nariz
      const nk = spec.nose === 'big' ? 1.45 : spec.nose === 'small' ? 0.72 : 1 + (hash((spec.seed || 0) + 1) - 0.5) * 0.3;
      c.beginPath(); E(c, fx * 1.15, hy + 7.3 + fy, 4.4 * nk, 3.6 * nk); fillP(c, shade(skin, 0.2));
      if (BIG) { c.beginPath(); c.ellipse(fx * 1.15, hy + 7.3 + fy, 4.4 * nk, 3.6 * nk, 0, 0.25, PI - 0.25); strokeP(c, 'rgba(16,20,24,0.45)', Math.max(1, U1 * 0.7)); }
      if (DET) { c.beginPath(); E(c, fx * 1.15 - 1.3 * nk, hy + 6.1 + fy, 1.4 * nk, 1 * nk); fillP(c, 'rgba(255,255,255,0.5)'); }
      // olhos
      const ph = (spec.seed || 0) * 1.37;
      const blink = BLINK != null ? BLINK : mood !== 'laugh' && mood !== 'hurt' && ((t + ph) % 3.4) < 0.13;
      const efx = fx * 0.8; // os olhos acompanham o giro do rosto
      c.translate(efx, 0);
      drawEyes(c, mood, ex, ey, lookX, lookY, blink, skin);
      if (spec.glasses) drawGlasses(c, spec.glasses, ex, ey, -rx + 1.5 - efx, rx - 1.5 - efx);
      c.translate(-efx, 0);
    }
    // ---- cabelo da frente ----
    c.beginPath();
    if (hairPath(c, hair, 0, hy, rx, ry, 'front')) {
      fillP(c, hairC);
      if (DET && !FL) {
        if (hair !== 'curly') strokeP(c, INK, LW * 0.5);
        else {
          c.beginPath();
          for (let i = 0; i < 5; i++) { const cx = (i - 2) * rx * 0.36, cy = hy - ry * 0.6 + (i % 2) * -ry * 0.07; c.moveTo(cx + rx * 0.1, cy + ry * 0.04); c.arc(cx, cy + ry * 0.02, rx * 0.1, 0.2, PI * 1.3); }
          strokeP(c, shade(hairC, 0.22), Math.max(1.2, U1 * 0.8));
        }
        if (hair === 'gray') {
          c.beginPath();
          c.moveTo(-rx * 0.98, hy - ry * 0.2); c.quadraticCurveTo(-rx * 0.86, hy - ry * 0.55, -rx * 0.62, hy - ry * 0.8);
          c.moveTo(rx * 0.98, hy - ry * 0.2); c.quadraticCurveTo(rx * 0.86, hy - ry * 0.55, rx * 0.62, hy - ry * 0.8);
          strokeP(c, shade(hairC, 0.3), Math.max(1.2, U1 * 0.8));
        }
        hairShine(c, hair, 0, hy, rx, ry);
      }
    }
    if (!FL && spec.templeColor && (hair === 'side' || hair === 'slick' || hair === 'short')) {
      c.beginPath(); E(c, -rx * 0.98, hy - 2, 2.8, 5.6, 0.1); E(c, rx * 0.98, hy - 2, 2.8, 5.6, -0.1); fillP(c, spec.templeColor);
    }
    // ---- chapéu ----
    if (hat) drawHat(c, hat, spec, 0, hy, rx, ry, t);
    if (!FL) {
      const browC = spec.browColor || spec.hairColor || '#2a2a2a';
      c.translate(fx * 0.8, 0);
      drawBrows(c, mood, spec, ex, ey - 8.6, browC);
      c.translate(-fx * 0.8, 0);
      if (!NO_EMOTES) drawEmotes(c, mood, spec, rx, ry, hy, t);
    }
    return { rx, ry };
  }
  function drawGlasses(c, type, ex, ey, earL, earR) {
    c.beginPath();
    if (type === 'round') { O(c, -ex, ey, 7.4); O(c, ex, ey, 7.4); }
    else { RR(c, -ex - 8, ey - 5.6, 16, 11.2, 3); RR(c, ex - 8, ey - 5.6, 16, 11.2, 3); }
    if (type === 'dark') fillP(c, '#161b2b');
    else { const ga = c.globalAlpha; c.globalAlpha = ga * 0.22; fillP(c, '#dff4ff'); c.globalAlpha = ga; }
    const gw = Math.max(2, 1.05 * U1);
    strokeP(c, INK, gw);
    c.beginPath();
    c.moveTo(-ex + 7, ey - 1.2); c.quadraticCurveTo(0, ey - 3.6, ex - 7, ey - 1.2);
    if (DET) { c.moveTo(-ex - 7.4, ey - 1.5); c.lineTo(earL, ey - 2.6); c.moveTo(ex + 7.4, ey - 1.5); c.lineTo(earR, ey - 2.6); }
    strokeP(c, INK, gw);
    if (DET || type === 'dark') {
      c.beginPath();
      c.moveTo(-ex - 3.5, ey - 1); c.lineTo(-ex - 0.5, ey - 4);
      c.moveTo(ex - 3.5, ey - 1); c.lineTo(ex - 0.5, ey - 4);
      strokeP(c, 'rgba(255,255,255,0.7)', Math.max(1.3, U1 * 0.8));
    }
  }

  /**
   * G.Art.person(ctx, x, y, size, spec, o) — mesmas chaves do core, mais extras opcionais:
   * spec extra: face ('oval'|'round'|'square'|'long'|'jowl'), nose ('small'|'big'), grin (sorriso de dentes),
   *   wrinkles, cheeks (bochecha corada forte), sweat (suor), templeColor (têmporas grisalhas), pants,
   *   pinShape ('star'), hatLogo (letra no boné), arms:false, pose (padrão de pose);
   *   hair extra: 'short'|'long'|'bun'|'spiky'|'pompadour'|'combover'; body extra: 'shirt'|'uniform'|'cardigan';
   *   hat extra: 'cowboy'|'hardhat'|'beret'|'tophat'|'crown'; brows extra: 'determined'.
   * o extra: pose ('idle'|'wave'|'up'|'fist'|'point'|'hold'|'drive'|'shrug'|'cross'), arms:false, lookY -1..1,
   *   autoLook:false (no jogo os olhos seguem o Fusca), moods extra: 'tired'|'shock'|'sad'.
   */
  function setScale(size, flash) {
    const s = size / 100;
    FL = !!flash;
    U1 = 1 / s;
    LW = (0.55 + 3.1 * s) / s;
    DET = size >= 44 && !FL;
    BIG = size >= 72;
  }
  function needEmotes(mood, spec) { return mood === 'angry' || mood === 'hurt' || mood === 'tired' || mood === 'shock' || !!spec.sweat; }

  // ---------- cache de sprites (só no canvas do jogo e tamanhos < 70 px) ----------
  // Cada personagem vira até 3 imagens: corpo, cabeça e braços erguidos. As animações
  // (balanço, piscada, boca, olhar) são quantizadas; gotas de suor e a veia de raiva continuam ao vivo.
  const pcache = new Map(), pseen = new Map();
  let pRes = 0, pPixels = 0;
  // P_MAX: com braços erguidos, piscadas e flash aquecidos, cada combinação tem 17 a 33 imagens;
  // com 600 a fase 4 (e a 2) girava o LRU e repintava no quadro o que ainda estava na tela
  // (partida inteira a ts 3: 572 sprites pintados em quadros com 600, 181 com 900). A memória
  // continua presa pelo P_BUDGET.
  const P_MAX = 900, P_BUDGET = 5.5e6; // no máximo ~22 MB de sprites
  // Troca de resolução do canvas (degrau da qualidade automática, giro da tela): o cache antigo
  // vira "velho" (pStale) em vez de ser jogado fora. Um sprite velho continua sendo desenhado,
  // escalado pelo caminho não exato, até ser repintado na resolução nova: nos primeiros ~10 s só
  // em segundo plano (na frente da fila de aquecimento); depois disso o que não foi usado no
  // último segundo sai e o que ainda está na tela é repintado no quadro, dentro do teto por
  // quadro. O mapa velho some quando esvazia (ou de vez aos 20 s).
  let pStale = null, pStalePx = 0, pStaleT = 0, pStaleChk = -1, pStaleHit = false, pStaleLate = false;
  const STALE_MS = 10000;
  let pFramed = 0; // sprites pintados dentro de quadros (testes/perfil: cacheStats().framed)
  const BOX_BODY = [-50, 2, 100, 58], BOX_HEAD = [-53, -77, 106, 106], BOX_ARMS = [-47, -21, 94, 48];
  // Teto de sprites NOVOS por quadro: uma onda inteira de ministros (ou a entrada de um chefão)
  // pintava 20+ sprites no mesmo quadro (35–55 ms a 4x). Passou do teto, o personagem sai em
  // vetor nesse quadro e o sprite nasce num dos próximos (ou no aquecimento em segundo plano).
  const P_PER_FRAME = 2;
  let pFrame = -1, pMade = 0;
  // contador de quadros próprio (o g.frame para nos diálogos, mas o chefão continua desenhado)
  let rafN = 0;
  if (typeof requestAnimationFrame !== 'undefined') { const tick = () => { rafN++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  function frameId() { return rafN; }
  // repinta na resolução nova um sprite velho que está na tela (o estado de setScale vai junto)
  function staleJob(key, box, s, res, paint) {
    const sz = Math.round(s * 100), fl = FL;
    WARM.q.unshift(() => {
      if (res !== pRes || pcache.has(key)) return;
      setScale(sz, fl);
      partSprite(key, box, s, res, paint, true);
    });
    pumpWarmSoon();
  }
  function frameRoom() {
    const f = frameId();
    if (f !== pFrame) { pFrame = f; pMade = 0; }
    if (pMade >= P_PER_FRAME) return false;
    pMade++;
    return true;
  }
  function partSprite(key, box, s, res, paint, force) {
    let cv = pcache.get(key);
    if (cv) { pcache.delete(key); pcache.set(key, cv); return cv; } // LRU
    const stale = pStale !== null ? pStale.get(key) : undefined;
    if (!force) {
      if (stale !== undefined) {
        // sprite da resolução anterior: desenha o velho (escalado) e pede a repintura em segundo
        // plano, na frente da fila. Repintar dentro do quadro logo de cara gastava o teto inteiro
        // por ~10 s depois do degrau de qualidade, justo quando o jogo já está pesado; só depois
        // dos 10 s (pStaleLate) o que sobrou na tela é trocado no quadro, dentro do teto.
        stale._hit = rafN;
        if (!pStaleLate || !frameRoom()) {
          pStaleHit = true;
          if (!stale._rq) { stale._rq = 1; staleJob(key, box, s, res, paint); }
          return stale;
        }
        pFramed++;
      } else {
        const n = (pseen.get(key) || 0) + 1;      // só guarda o que aparece mais de uma vez
        if (n < 2) { if (pseen.size > 3000) pseen.clear(); pseen.set(key, n); return null; }
        if (!frameRoom()) return null;            // fica para o próximo quadro (pseen continua em 1)
        pseen.delete(key);
        pFramed++;
      }
    }
    if (stale !== undefined) { pStale.delete(key); pStalePx -= stale.width * stale.height; }
    const k = s * res;
    cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(box[2] * k)); cv.height = Math.max(1, Math.ceil(box[3] * k));
    pPixels += cv.width * cv.height;
    while (pcache.size && (pcache.size >= P_MAX || pPixels > P_BUDGET)) {
      const old = pcache.keys().next().value, oc = pcache.get(old);
      pPixels -= oc.width * oc.height; pcache.delete(old);
    }
    const x = cv.getContext('2d');
    x.scale(k, k); x.translate(-box[0], -box[1]);
    x.lineJoin = 'round'; x.lineCap = 'round';
    try { paint(x); } catch (err) { G.reportError(err, 'art.person sprite'); }
    pcache.set(key, bake(cv));
    return cv;
  }
  const q2 = (v) => Math.round(v * 2) / 2;
  // Chave de cache de um spec. Os chamadores reaproveitam objetos constantes (o Centrão desenha 7–16
  // cabeças por quadro): o JSON.stringify sai uma vez por objeto, guardado num WeakMap, e vira um id
  // curto ('#12'), igual para specs de mesmo conteúdo (as chaves dos sprites ficam pequenas). Um objeto
  // novo a cada quadro continua funcionando (só paga o stringify, como antes). null = spec não serializável.
  const specKeys = new WeakMap(), specIds = new Map();
  function specKey(spec) {
    if (!spec || typeof spec !== 'object') return null;
    let k = specKeys.get(spec);
    if (k === undefined) {
      let js = null;
      try { js = JSON.stringify(spec); } catch (e) { /* circular etc. */ }
      if (js == null) k = null;
      else {
        k = specIds.get(js);
        if (k === undefined) { k = '#' + specIds.size; specIds.set(js, k); }
      }
      specKeys.set(spec, k);
    }
    return k;
  }
  // Cópia exata (pixel a pixel, sem filtro) quando a transformação final é só uma translação na escala
  // do sprite (o padrão blitExact do bosses.js): ~4x mais barata na rasterização em CPU.
  let EXACT = true;
  // resolução dos sprites do jogo (px do aparelho por px lógico); muda com a qualidade
  function gameRes() {
    const res = G.canvas ? G.canvas.width / G.W : 0;
    if (res > 0 && res !== pRes) changeRes(res);
    else if (pStale !== null && rafN !== pStaleChk) { // uma checagem por quadro
      pStaleChk = rafN;
      const age = performance.now() - pStaleT;
      if (!pStale.size || age > STALE_MS * 2) dropStale();
      else if (age > STALE_MS && !pStaleLate) {
        // 10 s: solta o que não apareceu no último ~1 s; o resto é trocado no quadro (no teto)
        pStaleLate = true;
        for (const [key, cv] of pStale) if (!(rafN - (cv._hit || -1e9) <= 60)) { pStalePx -= cv.width * cv.height; pStale.delete(key); }
        if (!pStale.size) dropStale();
      }
    }
    return res;
  }
  // (sem encolher os canvas na hora: zerar a largura de ~150 canvas custou 44 ms num quadro a 4x;
  // o coletor de lixo devolve a memória, como no pcache)
  function dropStale() {
    pStale = null; pStalePx = 0; pStaleLate = false;
  }
  function changeRes(res) {
    const first = !(pRes > 0);
    pRes = res;
    // o cache atual vira velho (somado ao velho de uma troca anterior, até o mesmo orçamento);
    // os sprites com resolução própria (arte do título, chave com '@') continuam valendo
    const st = pStale !== null ? pStale : new Map();
    if (pStale === null) pStalePx = 0;
    const own = [];
    for (const [key, cv] of pcache) {
      if (key.indexOf('@') >= 0) { own.push(key, cv); continue; }
      const prev = st.get(key);
      if (prev !== undefined) { st.delete(key); pStalePx -= prev.width * prev.height; }
      st.set(key, cv); pStalePx += cv.width * cv.height;
    }
    pcache.clear(); pPixels = 0;
    for (let i = 0; i < own.length; i += 2) { pcache.set(own[i], own[i + 1]); pPixels += own[i + 1].width * own[i + 1].height; }
    while (st.size && pStalePx > P_BUDGET) { // os menos usados saem primeiro
      const k0 = st.keys().next().value, c0 = st.get(k0);
      pStalePx -= c0.width * c0.height; st.delete(k0);
    }
    for (const cv of st.values()) cv._rq = 0; // a fila antiga (com os pedidos de repintura) vai embora
    pStale = st.size ? st : null; pStalePx = pStale !== null ? pStalePx : 0;
    pStaleT = performance.now(); pStaleChk = rafN; pStaleLate = false;
    // aquecimento: a fila antiga era da resolução anterior; repõe já quem está na tela agora
    // (visto nos últimos ~90 quadros), do mais recente para o mais antigo, até a fila encher
    const live = [];
    if (!first) for (const e of WARM.live.values()) if (rafN - e.f <= 90) live.push(e);
    live.sort((a, b) => b.f - a.f);
    clearWarmQueue(); WARM.seen.clear(); WARM.live.clear();
    for (const e of live) if (queueWarm(e.sk, e.sz, e.spec, e.mood, e.pose, e.big, e.mq)) { WARM.seen.set(e.id, 2); WARM.live.set(e.id, e); }
  }
  // resOver: resolução própria (arte do título, fora do canvas do jogo)
  function personCached(ctx, x, y, size, spec, o, mood, face, lookX, lookY, resOver) {
    const res = resOver || gameRes();
    if (!(res > 0)) return false;
    const sz = Math.round(size);
    const s = sz / 100;
    const t = o.t || 0, seed = spec.seed || 0;
    let sk = specKey(spec);
    if (sk === null) return false;
    if (resOver) sk += '@' + resOver;
    const flash = !!o.flash;
    const body = spec.body || 'suit';
    const hasBody = body !== 'none' && !o.bust;
    const pose = o.pose || spec.pose || 'idle';
    const raised = pose === 'up' || pose === 'wave' || pose === 'fist';
    const arms = hasBody && o.arms !== false && spec.arms !== false;
    const sw = q2(Math.sin(t * 6 + seed));
    const fast = POSE_FREQ[pose] ? q2(Math.sin(t * POSE_FREQ[pose])) : 0;
    const ph = seed * 1.37;
    // variações quantizadas (no flash o rosto não aparece: uma imagem só)
    const blink = !flash && mood !== 'laugh' && mood !== 'hurt' && ((t + ph) % 3.4) < 0.13;
    const mq = flash ? 0 : Math.round(clamp(o.mouth || 0, 0, 1) * 3) / 3;
    const lx = flash ? 0 : clamp(Math.round(lookX), -1, 1);
    const ly = flash ? 0 : lookY > 0.25 ? 0.5 : lookY < -0.25 ? -0.5 : 0;
    const base = sk + '|' + sz + '|' + (flash ? 1 : 0);
    const skin = flash ? WHITE : spec.skin || '#e8b48a';
    if (!resOver) noteWarm(sk, sz, spec, mood, pose, false);
    setScale(sz, flash);
    pStaleHit = false;
    let bodyS = null, armS = null;
    if (hasBody) {
      bodyS = partSprite(base + '|b|' + pose + '|' + sw + '|' + (arms ? 1 : 0), BOX_BODY, s, res, (c) => {
        drawBody(c, spec, body, sw * 1.1, skin);
        if (arms && !raised) drawArms(c, poseHands(pose, sw, fast), spec, body, skin, pose);
      });
      if (!bodyS) return false;
      if (arms && raised) {
        armS = partSprite(base + '|a|' + pose + '|' + fast, BOX_ARMS, s, res, (c) => drawArms(c, poseHands(pose, sw, fast), spec, body, skin, pose));
        if (!armS) return false;
      }
    }
    const headS = partSprite(base + '|h|' + mood + '|' + (blink ? 1 : 0) + '|' + mq + '|' + lx + '|' + ly, BOX_HEAD, s, res, (c) => {
      BLINK = blink; NO_EMOTES = true;
      drawHead(c, spec, { mouth: mq }, mood, -14, t, skin, lx, ly);
      BLINK = null; NO_EMOTES = false;
    });
    if (!headS) return false;
    // desenha
    const bob = mood === 'laugh' ? -Math.abs(Math.sin(t * 12 + seed)) * 2.4 : Math.sin(t * 6 + seed) * 1.2;
    const hx = mood === 'hurt' ? Math.sin(t * 50) * 0.9 : 0;
    const k = size / sz; // corrige o arredondamento do tamanho
    ctx.save();
    ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (flash) ctx.scale(1.07 * face * k, 0.93 * k); else ctx.scale(face * k, k);
    let m = null;
    if (EXACT && !flash && k === 1 && !pStaleHit && ctx.getTransform) { // sprite velho: tamanho de outra resolução, vai escalado
      m = ctx.getTransform();
      if (m.b !== 0 || m.c !== 0 || Math.abs(Math.abs(m.a) - res) > 0.02 || Math.abs(m.d - res) > 0.02) m = null;
    }
    if (m) {
      // na escala do sprite: copia na grade do aparelho (a origem do sprite já é box * s * res)
      const r = s * res;
      ctx.setTransform(m.a < 0 ? -1 : 1, 0, 0, 1, Math.round(m.e), Math.round(m.f));
      ctx.imageSmoothingEnabled = false;
      if (bodyS) ctx.drawImage(bodyS, Math.round(BOX_BODY[0] * r), Math.round(BOX_BODY[1] * r));
      ctx.drawImage(headS, Math.round((BOX_HEAD[0] + hx) * r), Math.round((BOX_HEAD[1] + bob) * r));
      if (armS) ctx.drawImage(armS, Math.round(BOX_ARMS[0] * r), Math.round(BOX_ARMS[1] * r));
      if (!flash && needEmotes(mood, spec)) ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); // o restore() desfaz o resto
    } else {
      if (bodyS) ctx.drawImage(bodyS, BOX_BODY[0] * s, BOX_BODY[1] * s, BOX_BODY[2] * s, BOX_BODY[3] * s);
      ctx.drawImage(headS, (BOX_HEAD[0] + hx) * s, (BOX_HEAD[1] + bob) * s, BOX_HEAD[2] * s, BOX_HEAD[3] * s);
      if (armS) ctx.drawImage(armS, BOX_ARMS[0] * s, BOX_ARMS[1] * s, BOX_ARMS[2] * s, BOX_ARMS[3] * s);
    }
    if (!flash && needEmotes(mood, spec)) {
      ctx.scale(s, s); ctx.translate(hx, 0);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const shape = spec.face || 'oval';
      drawEmotes(ctx, mood, spec, headRX(shape), headRY(shape), -14 + bob, t);
    }
    ctx.restore();
    return true;
  }

  // Personagens grandes (chefões, ≥ 70 px): só o CORPO vira sprite (pose × balanço × flash,
  // ~10 imagens); a cabeça continua em vetor (expressões, boca e olhar variam demais).
  // Corta mais ou menos pela metade o custo por quadro de um chefão.
  function personBodyCached(ctx, x, y, size, spec, o, mood, face, lookX, lookY) {
    const body = spec.body || 'suit';
    if (body === 'none' || o.bust) return false;
    const res = gameRes();
    if (!(res > 0)) return false;
    const sz = Math.round(size), s = sz / 100;
    const t = o.t || 0, seed = spec.seed || 0;
    const sk = specKey(spec);
    if (sk === null) return false;
    const flash = !!o.flash;
    const pose = o.pose || spec.pose || 'idle';
    const raised = pose === 'up' || pose === 'wave' || pose === 'fist';
    const arms = o.arms !== false && spec.arms !== false;
    const sw = q2(Math.sin(t * 6 + seed));
    const skin = flash ? WHITE : spec.skin || '#e8b48a';
    noteWarm(sk, sz, spec, mood, pose, true);
    setScale(sz, flash);
    pStaleHit = false;
    const bodyS = partSprite(bodyKey(sk, sz, flash, pose, sw, arms), BOX_BODY, s, res, (c) => paintBigBody(c, spec, body, skin, pose, sw, arms, raised));
    if (!bodyS) return false;
    setScale(size, flash);
    const k = size / sz;
    ctx.save();
    ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (flash) ctx.scale(1.07 * face * k, 0.93 * k); else ctx.scale(face * k, k);
    let m = null;
    if (EXACT && !flash && k === 1 && !pStaleHit && ctx.getTransform) {
      m = ctx.getTransform();
      if (m.b !== 0 || m.c !== 0 || Math.abs(Math.abs(m.a) - res) > 0.02 || Math.abs(m.d - res) > 0.02) m = null;
    }
    if (m) { // corpo copiado na grade do aparelho (ver personCached); a cabeça segue em vetor
      ctx.setTransform(m.a < 0 ? -1 : 1, 0, 0, 1, Math.round(m.e), Math.round(m.f));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bodyS, Math.round(BOX_BODY[0] * s * res), Math.round(BOX_BODY[1] * s * res));
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.imageSmoothingEnabled = true;
    } else ctx.drawImage(bodyS, BOX_BODY[0] * s, BOX_BODY[1] * s, BOX_BODY[2] * s, BOX_BODY[3] * s);
    ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const bob = mood === 'laugh' ? -Math.abs(Math.sin(t * 12 + seed)) * 2.4 : Math.sin(t * 6 + seed) * 1.2;
    const hx = mood === 'hurt' ? Math.sin(t * 50) * 0.9 : 0;
    if (hx) ctx.translate(hx, 0);
    drawHead(ctx, spec, o, mood, -14 + bob, t, skin, lookX, lookY);
    if (hx) ctx.translate(-hx, 0);
    if (arms && raised) drawArms(ctx, poseHands(pose, Math.sin(t * 6 + seed), POSE_FREQ[pose] ? Math.sin(t * POSE_FREQ[pose]) : 0), spec, body, skin, pose);
    ctx.restore();
    return true;
  }
  function bodyKey(sk, sz, flash, pose, sw, arms) { return sk + '|' + sz + '|' + (flash ? 1 : 0) + '|B|' + pose + '|' + sw + '|' + (arms ? 1 : 0); }
  function paintBigBody(c, spec, body, skin, pose, sw, arms, raised) {
    drawBody(c, spec, body, sw * 1.1, skin);
    if (arms && !raised) drawArms(c, poseHands(pose, sw, 0), spec, body, skin, pose);
  }

  // ---------- aquecimento em segundo plano ----------
  // Quando um personagem novo aparece (2ª vez que o vemos no mesmo tamanho), as variações
  // mais comuns (balanço, olhar para os lados/para baixo, flash do acerto) são pintadas fora
  // do quadro, em fatias de ~3 ms entre os quadros. G.Art.prewarm(lista) faz o mesmo antes
  // de o personagem entrar (introdução da fase, aviso do chefão).
  // WARM.seen: id → 1 (visto uma vez) | 2 (já na fila); WARM.live: id → quem foi para a fila e
  // em que quadro apareceu por último (na troca de resolução, quem está na tela volta para a fila).
  // q2: fila de baixa prioridade (cabeças piscando), só anda com a fila principal vazia
  const WARM = { q: [], q2: [], seen: new Map(), live: new Map(), timer: 0 };
  const WARM_CAP = 400; // tarefas na fila principal (cada combinação pequena: 17 a 27)
  const SWAYS = [-1, -0.5, 0, 0.5, 1];
  const LOOKS = [[-1, 0.5], [0, 0.5], [1, 0.5], [-1, 0], [0, 0], [1, 0]];
  function noteWarm(sk, sz, spec, mood, pose, big) {
    const id = sk + '|' + sz + '|' + mood + '|' + pose;
    const n = WARM.seen.get(id) || 0;
    if (n >= 2) { const e = WARM.live.get(id); if (e !== undefined) e.f = rafN; return; }
    if (WARM.seen.size > 1500) { WARM.seen.clear(); WARM.live.clear(); }
    // 2ª vez: vai para a fila; fila cheia = continua em 1 e tenta de novo na próxima aparição
    if (n === 1 && queueWarm(sk, sz, spec, mood, pose, big)) markWarm(id, sk, sz, spec, mood, pose, big, rafN);
    else WARM.seen.set(id, 1);
  }
  function markWarm(id, sk, sz, spec, mood, pose, big, f, mq) {
    WARM.seen.set(id, 2);
    WARM.live.set(id, { id, sk, sz, spec, mood, pose, big, f, mq: mq || 0 });
  }
  // Põe na fila as variações de uma combinação (spec × tamanho × humor × pose). false = fila cheia.
  // Ordem: sem flash (corpo nos 5 balanços, braços erguidos nas 5 fases, cabeça em 6 olhares),
  // flash (corpo, braços, cabeça); as cabeças piscando (~4% do tempo) vão para a fila q2.
  // mq: abertura da boca já quantizada (0, 1/3, 2/3, 1) das cabeças sem flash (quem fala muito,
  // como o Centrão bravo/rindo, aquece também a boca aberta: ver prewarm); o flash não tem rosto.
  function queueWarm(sk, sz, spec, mood, pose, big, mq, bust) {
    mq = mq || 0;
    if (WARM.q.length > WARM_CAP) return false;
    const body = bust ? 'none' : spec.body || 'suit'; // bust: só a cabeça (como person(..., { bust: true }))
    const raised = pose === 'up' || pose === 'wave' || pose === 'fist';
    const arms = body !== 'none' && spec.arms !== false;
    const res = pRes, s = sz / 100;
    const J = (fn) => WARM.q.push(fn);
    const head = (flash, skin, blink, L) => (blink ? WARM.q2 : WARM.q).push(() => {
      if (res !== pRes) return;
      setScale(sz, flash);
      const m = flash ? 0 : mq;
      partSprite(sk + '|' + sz + '|' + (flash ? 1 : 0) + '|h|' + mood + '|' + (blink ? 1 : 0) + '|' + m + '|' + L[0] + '|' + L[1], BOX_HEAD, s, res, (c) => {
        BLINK = blink; NO_EMOTES = true;
        drawHead(c, spec, { mouth: m }, mood, -14, 0, skin, L[0], L[1]);
        BLINK = null; NO_EMOTES = false;
      }, true);
    });
    // com a boca aberta só as cabeças mudam: corpo, braços e flash são os da boca fechada
    const onlyHeads = mq > 0 && (WARM.seen.get(sk + '|' + sz + '|' + mood + '|' + pose) || 0) >= 2;
    for (const flash of [false, true]) {
      if (onlyHeads && flash) break;
      const skin = flash ? WHITE : spec.skin || '#e8b48a';
      if (body !== 'none' && !onlyHeads) for (const sw of SWAYS) {
        J(() => {
          if (res !== pRes) return;
          setScale(sz, flash);
          if (big) partSprite(bodyKey(sk, sz, flash, pose, sw, arms), BOX_BODY, s, res, (c) => paintBigBody(c, spec, body, skin, pose, sw, arms, raised), true);
          else partSprite(sk + '|' + sz + '|' + (flash ? 1 : 0) + '|b|' + pose + '|' + sw + '|' + (arms ? 1 : 0), BOX_BODY, s, res, (c) => {
            drawBody(c, spec, body, sw * 1.1, skin);
            if (arms && !raised) drawArms(c, poseHands(pose, sw, 0), spec, body, skin, pose);
          }, true);
        });
      }
      if (big) continue;
      // braços erguidos (aceno, punho, mãos para cima): uma imagem por fase da oscilação
      if (arms && raised && !onlyHeads) for (const fq of SWAYS) {
        J(() => {
          if (res !== pRes) return;
          setScale(sz, flash);
          partSprite(sk + '|' + sz + '|' + (flash ? 1 : 0) + '|a|' + pose + '|' + fq, BOX_ARMS, s, res, (c) => drawArms(c, poseHands(pose, 0, fq), spec, body, skin, pose), true);
        });
      }
      // cabeça: olhando para baixo (o Fusca quase sempre está embaixo) e reto; no flash, uma só
      if (flash) head(true, skin, false, [0, 0]);
      else for (const L of LOOKS) head(false, skin, false, L);
    }
    if (!big && mood !== 'laugh' && mood !== 'hurt' && WARM.q2.length < WARM_CAP) { const skin = spec.skin || '#e8b48a'; for (const L of LOOKS) head(false, skin, true, L); }
    pumpWarmSoon();
    return true;
  }
  function pumpWarmSoon() { if (!WARM.timer && (WARM.q.length || WARM.q2.length)) WARM.timer = setTimeout(pumpWarm, 0); }
  function clearWarmQueue() { WARM.q.length = 0; WARM.q2.length = 0; }
  function pumpWarm() {
    WARM.timer = 0;
    const left = () => WARM.q.length + WARM.q2.length;
    if (typeof document !== 'undefined' && document.hidden) { if (left()) WARM.timer = setTimeout(pumpWarm, 150); return; }
    const t0 = performance.now();
    while (left() && performance.now() - t0 < 3) {
      const fn = WARM.q.length ? WARM.q.shift() : WARM.q2.shift();
      try { fn(); } catch (err) { G.reportError(err, 'art.warm'); clearWarmQueue(); }
    }
    if (left()) WARM.timer = setTimeout(pumpWarm, 4);
  }
  // G.Art.prewarm(lista): lista = [{ spec, size, mood?, pose?, mouth?, bust? }] — pinta antes de o personagem
  // aparecer. mouth (0..1, quantizada como no jogo) aquece as cabeças falando (ex.: { mood: 'angry',
  // mouth: 0.6 }); sem mouth, a boca fechada. bust: true aquece só as cabeças (sem corpo nem braços).
  // Sem lista: aquece os sprites dos itens (ver warmItems).
  function prewarm(list) {
    if (!list) { warmItems(); return; }
    const res = gameRes();
    if (!(res > 0)) return;
    for (const it of [].concat(list)) {
      if (!it || !it.spec || !(it.size > 1)) continue;
      const sk = specKey(it.spec);
      if (sk === null) continue;
      const sz = Math.round(it.size), pose = it.pose || it.spec.pose || 'idle', mood = it.mood || 'normal';
      // mesma quantização de personCached (a chave da cabeça tem que bater)
      const mq = it.mouth != null && sz < 70 ? Math.round(clamp(+it.mouth || 0, 0, 1) * 3) / 3 : 0;
      const bust = !!it.bust;
      const id = sk + '|' + sz + '|' + mood + '|' + pose + (mq ? '|m' + mq : '') + (bust ? '|bust' : '');
      if ((WARM.seen.get(id) || 0) >= 2) continue;
      // só marca como feito o que entrou na fila (fila cheia: fica para a 2ª aparição no jogo)
      if (WARM.seen.size > 1500) { WARM.seen.clear(); WARM.live.clear(); }
      if (queueWarm(sk, sz, it.spec, mood, pose, sz >= 70, mq, bust)) markWarm(id, sk, sz, it.spec, mood, pose, sz >= 70, -1e9, mq);
    }
  }

  /**
   * G.Art.person(ctx, x, y, size, spec, o) — mesmas chaves do core, mais extras opcionais:
   * spec extra: face ('oval'|'round'|'square'|'long'|'jowl'), nose ('small'|'big'), grin (sorriso de dentes),
   *   wrinkles, cheeks (bochecha corada forte), sweat (suor), templeColor (têmporas grisalhas), pants,
   *   pinShape ('star'), hatLogo (letra no boné), arms:false, pose (padrão de pose);
   *   hair extra: 'short'|'long'|'bun'|'spiky'|'pompadour'|'combover'; body extra: 'shirt'|'uniform'|'cardigan';
   *   hat extra: 'cowboy'|'hardhat'|'beret'|'tophat'|'crown'; brows extra: 'determined'.
   * o extra: pose ('idle'|'wave'|'up'|'fist'|'point'|'hold'|'drive'|'shrug'|'cross'), arms:false, lookY -1..1,
   *   autoLook:false (no jogo os olhos seguem o Fusca), cache:false, moods extra: 'tired'|'shock'|'sad'.
   */
  function person(ctx, x, y, size, spec, o) {
    o = o || {};
    spec = spec || {};
    if (!(size > 1)) return;
    const t = o.t || 0;
    const mood = o.mood || 'normal';
    const face = o.facing === -1 ? -1 : 1;
    let lookX = o.lookX, lookY = o.lookY;
    const inGame = ctx === G.ctx;
    if (lookX == null && o.autoLook !== false && inGame && G.state === 'play' && G.game && G.game.player && G.game.player.alive) {
      const p = G.game.player;
      lookX = clamp((p.x - x) / 120, -1, 1) * face;
      if (lookY == null) lookY = clamp((p.y - y) / 220, -1, 1) * 0.7;
    }
    lookX = clamp(lookX || 0, -1.5, 1.5);
    lookY = clamp(lookY || 0, -1.5, 1.5);
    if (o.cache !== false && G.canvas) {
      if (inGame) {
        if (size < 70) { if (personCached(ctx, x, y, size, spec, o, mood, face, lookX, lookY)) return; }
        else if (size <= 260 && personBodyCached(ctx, x, y, size, spec, o, mood, face, lookX, lookY)) return;
      } else if (o.cacheRes > 0 && size < 70 && personCached(ctx, x, y, size, spec, o, mood, face, lookX, lookY, o.cacheRes)) return;
    }
    const s = size / 100;
    setScale(size, o.flash);
    const seed = spec.seed || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (FL) ctx.scale(1.07 * s * face, 0.93 * s); else ctx.scale(s * face, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const bob = mood === 'laugh' ? -Math.abs(Math.sin(t * 12 + seed)) * 2.4 : Math.sin(t * 6 + seed) * 1.2;
    const hx = mood === 'hurt' ? Math.sin(t * 50) * 0.9 : 0;
    const hy = -14 + bob;
    const body = spec.body || 'suit';
    const hasBody = body !== 'none' && !o.bust;
    const pose = o.pose || spec.pose || 'idle';
    const raised = pose === 'up' || pose === 'wave' || pose === 'fist';
    const arms = hasBody && o.arms !== false && spec.arms !== false;
    const skin = FL ? WHITE : spec.skin || '#e8b48a';
    const sw = Math.sin(t * 6 + seed);
    const H = poseHands(pose, sw, POSE_FREQ[pose] ? Math.sin(t * POSE_FREQ[pose]) : 0);
    if (hasBody) {
      drawBody(ctx, spec, body, Math.sin(t * 8 + seed * 2) * 1.1, skin);
      if (arms && !raised) drawArms(ctx, H, spec, body, skin, pose);
    }
    if (hx) ctx.translate(hx, 0);
    drawHead(ctx, spec, o, mood, hy, t, skin, lookX, lookY);
    if (hx) ctx.translate(-hx, 0);
    if (arms && raised) drawArms(ctx, H, spec, body, skin, pose);
    ctx.restore();
  }

  // Pontos úteis para encaixar adereços (relativos a x,y, já com escala e facing)
  function personAnchors(size, o) {
    o = o || {};
    const s = size / 100, f = o.facing === -1 ? -1 : 1;
    const pose = o.pose || 'idle', t = o.t || 0, seed = o.seed || 0;
    const H = poseHands(pose, Math.sin(t * 6 + seed), POSE_FREQ[pose] ? Math.sin(t * POSE_FREQ[pose]) : 0);
    return {
      head: { x: 0, y: -14 * s, r: 27 * s },
      mouth: { x: 0, y: 1.5 * s },
      handL: { x: H[0] * s * f, y: H[1] * s },
      handR: { x: H[4] * s * f, y: H[5] * s },
      top: -42 * s, bottom: 50 * s,
    };
  }

  // ======================================================================
  // O FUSCA (visto de cima) — G.Art.player
  // ======================================================================
  const CAR = { body: '#6cc3ee', fender: '#58b2e2', roof: '#a3dcf6', glass: '#1d3557', chrome: '#e3e9f0', stripe: '#ffffff' };
  function carBodyPath(c) {
    c.moveTo(0, -20.5);
    c.bezierCurveTo(5.6, -20.5, 8.7, -18.4, 8.8, -13);
    c.lineTo(9.6, 3);
    c.bezierCurveTo(10.2, 13, 8, 19.6, 0, 19.9);
    c.bezierCurveTo(-8, 19.6, -10.2, 13, -9.6, 3);
    c.lineTo(-8.8, -13);
    c.bezierCurveTo(-8.7, -18.4, -5.6, -20.5, 0, -20.5);
    c.closePath();
  }
  function carFenders(c) {
    E(c, -9.7, -11, 4.9, 8.3); E(c, 9.7, -11, 4.9, 8.3);
    E(c, -10, 10, 5.3, 8.9); E(c, 10, 10, 5.3, 8.9);
  }
  function drawFlame(c, t, len, wide) {
    const L = len + Math.sin(t * 31) * 2 + Math.sin(t * 53) * 1.4;
    const y0 = 24.6;
    const tear = (w, l, col) => {
      c.beginPath();
      c.moveTo(-w, y0);
      c.bezierCurveTo(-w * 1.1, y0 + l * 0.45, -w * 0.35, y0 + l * 0.85, 0, y0 + l);
      c.bezierCurveTo(w * 0.35, y0 + l * 0.85, w * 1.1, y0 + l * 0.45, w, y0);
      c.closePath();
      fillP(c, col);
    };
    glow(c, 0, y0 + 3, 11 * wide, '#ff8c1a', 0.55);
    tear(4.4 * wide, L + 6, 'rgba(76,201,240,0.8)');
    tear(3.7 * wide, L, '#ff8c1a');
    tear(2.3 * wide, L * 0.62, '#ffd23f');
    tear(1.2 * wide, L * 0.32, '#ffffff');
  }
  function roofGadget(c, w, lv, t, wc) {
    const lw = 1.1;
    c.lineWidth = lw * 2;
    switch (w) {
      case 'boca': { // megafone(s)
        const horn = (dx, k) => {
          c.beginPath(); c.moveTo(dx - 1.6 * k, -1.5); c.lineTo(dx + 1.6 * k, -1.5); c.lineTo(dx + 4.6 * k, -10.5); c.lineTo(dx - 4.6 * k, -10.5); c.closePath();
          inked(c, '#ffd23f', lw);
          c.beginPath(); E(c, dx, -10.5, 4.6 * k, 1.5 * k); inked(c, '#7a5a00', lw * 0.7);
          c.beginPath(); c.rect(dx - 0.8 * k, -9, 1.6 * k, 6); fillP(c, '#fff4c2');
        };
        c.beginPath(); RR(c, -3.4, -3.6, 6.8, 3.4, 1.4); inked(c, '#4a505c', lw);
        if (lv >= 2) { horn(-3.2, 0.78); horn(3.2, 0.78); } else horn(0, 1);
        break;
      }
      case 'panela': { // pilha de panelas
        const n = lv >= 3 ? 3 : lv >= 2 ? 2 : 1;
        for (let i = n - 1; i >= 0; i--) {
          const py = -3 - i * 2.3, pr = 3.9 - i * 0.5;
          c.beginPath(); c.moveTo(pr - 0.5, py); c.lineTo(pr + 4.2, py - 1.4); strokeP(c, INK, 2.8); strokeP(c, '#6b4a2b', 1.4);
          c.beginPath(); O(c, 0, py, pr); inked(c, '#c9d3e6', lw);
          c.beginPath(); O(c, 0, py, pr * 0.62); fillP(c, '#8f9bb3');
        }
        break;
      }
      case 'jato': { // canhão d'água
        const barrel = (dx) => { c.beginPath(); RR(c, dx - 1.3, -12, 2.6, 9.5, 1); inked(c, '#4cc9f0', lw); c.beginPath(); c.rect(dx - 1.6, -12.6, 3.2, 1.6); fillP(c, INK); };
        if (lv >= 2) { barrel(-2.4); barrel(2.4); } else barrel(0);
        c.beginPath(); O(c, 0, -2.6, 3.3); inked(c, '#2a9fd0', lw);
        c.beginPath(); O(c, -1, -3.5, 1.1); fillP(c, '#e8fbff');
        break;
      }
      default: { // voto: mini-urna lançadora com a tecla CONFIRMA
        const tube = (dx) => { c.beginPath(); RR(c, dx - 1.3, -12, 2.6, 6, 0.9); inked(c, '#2fbf5b', lw); };
        if (lv >= 2) { tube(-2.6); tube(2.6); } else tube(0);
        c.beginPath(); RR(c, -4.6, -7, 9.2, 6.6, 1.5); inked(c, '#efe8d6', lw);
        c.beginPath(); c.rect(-3.6, -5.8, 3.2, 2.4); fillP(c, '#1d3b2b');
        c.beginPath(); RR(c, 0.6, -5.4, 3.2, 2.2, 0.6); fillP(c, '#2fbf5b');
        c.beginPath(); c.rect(-3.6, -2.6, 7.4, 1); fillP(c, '#bdb4a0');
      }
    }
  }
  function pod(c, x, y, wc, big, t, lv) {
    c.beginPath(); E(c, x, y, big ? 2 : 1.8, big ? 4.6 : 4); inked(c, wc, 1);
    c.beginPath(); O(c, x, y - (big ? 3.2 : 2.8), 1); fillP(c, lv >= 5 && Math.sin(t * 12) > 0 ? WHITE : tint(wc, 0.6));
  }
  function player(ctx, x, y, o) {
    o = o || {};
    const c = ctx;
    const t = o.t || 0;
    const tilt = clamp(o.tilt || 0, -1, 1);
    const wtype = G.WEAPONS[o.weapon] ? o.weapon : 'voto';
    const lv = clamp(o.level || 1, 1, 5);
    const wc = G.WEAPONS[wtype].color;
    c.save();
    c.translate(x, y);
    // auras e efeitos fora da rotação
    if (o.bomb) glow(c, 0, 0, 44 + Math.sin(t * 10) * 4, '#ffd23f', 0.6);
    if (lv >= 5) glow(c, 0, 2, 32 + Math.sin(t * 6) * 3, wc, 0.55);
    if (o.shield) glow(c, 0, 0, 27, '#4cc9f0', 0.22);
    if (o.cafe) {
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const sx = (i & 1 ? 1 : -1) * (17 + (i >> 1) * 4);
        const yy = -24 + ((t * 300 + i * 23) % 56);
        c.moveTo(sx, yy); c.lineTo(sx, yy + 9 + (i >> 1) * 2);
      }
      strokeP(c, 'rgba(255,255,255,0.55)', 1.3);
      // vapor do cafezinho
      c.beginPath();
      for (let i = 0; i < 2; i++) {
        const sx = i ? 3.2 : -3.2, ph = t * 6 + i * 2;
        c.moveTo(sx, -24);
        c.bezierCurveTo(sx + Math.sin(ph) * 2.6, -27, sx - Math.sin(ph) * 2.6, -30, sx + Math.sin(ph + 1) * 1.5, -33);
      }
      strokeP(c, 'rgba(255,240,220,0.75)', 1.4);
    }
    c.rotate(tilt * 0.16);
    c.scale(1 - Math.abs(tilt) * 0.1, 1);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // chama do jato (atrás de tudo)
    drawFlame(c, t, (o.cafe ? 15 : 11) + (o.bomb ? 3 : 0), o.cafe ? 1.12 : 1);
    // sombra projetada (dá altura)
    c.beginPath(); E(c, 3.5, 5.5, 15, 21.5); fillP(c, 'rgba(0,0,0,0.3)');
    // pneus (os da frente esterçam)
    const steer = tilt * 0.4;
    c.fillStyle = '#1a1d22';
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      c.save(); c.translate(sd * 12.6, -11); c.rotate(steer); c.beginPath(); RR(c, -1.9, -3.8, 3.8, 7.6, 1.2); c.fill(); c.restore();
      c.beginPath(); RR(c, sd * 13 - 2, 6, 4, 8.2, 1.2); c.fill();
    }
    const lw = 1.15;
    // contorno geral
    c.beginPath(); carFenders(c); carBodyPath(c); strokeP(c, INK, lw * 2);
    c.beginPath(); carFenders(c); fillP(c, CAR.fender);
    c.beginPath(); carBodyPath(c); fillP(c, CAR.body);
    // brilho nos paralamas (lado esquerdo) e sombra chapada (lado direito)
    c.beginPath(); E(c, -11.4, -12.5, 1.6, 4.5, 0.1); E(c, -11.8, 8.5, 1.7, 5, 0.1); fillP(c, 'rgba(255,255,255,0.4)');
    c.beginPath(); c.moveTo(8.8, -13); c.lineTo(9.6, 3); c.bezierCurveTo(10.2, 13, 8, 19.6, 0, 19.9); c.bezierCurveTo(5, 18.5, 7.2, 13, 7, 3); c.lineTo(6.6, -13); c.closePath();
    fillP(c, SHADE_RGBA);
    // capô: faixas brancas (o centro fica azul para o ponto de colisão aparecer)
    c.fillStyle = CAR.stripe;
    c.fillRect(-3.4, -19.6, 1.7, 9.4); c.fillRect(1.7, -19.6, 1.7, 9.4);
    // faróis redondos na ponta dos paralamas
    c.beginPath(); O(c, -9.7, -17.4, 2.6); O(c, 9.7, -17.4, 2.6); inked(c, CAR.chrome, 0.8);
    c.beginPath(); O(c, -9.7, -17.7, 1.7); O(c, 9.7, -17.7, 1.7); fillP(c, '#fff6c8');
    // cabine: vidro em volta do teto (para-brisa, laterais, vigia traseiro)
    const rx0 = -tilt * 0.6;
    c.beginPath(); RR(c, -8.5, -10, 17, 21.8, 7); inked(c, CAR.glass, 0.75);
    c.beginPath(); c.moveTo(-5.6, -9.2); c.lineTo(-3.2, -9.2); c.lineTo(-4.6, -6.2); c.lineTo(-7, -6.2); c.closePath(); fillP(c, 'rgba(255,255,255,0.4)');
    // teto
    c.beginPath(); RR(c, -6.9 + rx0, -5.4, 13.8, 13, 5.4); inked(c, CAR.roof, 0.55);
    c.fillStyle = CAR.stripe;
    c.fillRect(-3.4 + rx0, -5, 1.7, 12.2); c.fillRect(1.7 + rx0, -5, 1.7, 12.2);
    c.beginPath(); E(c, -4.9 + rx0, -1.6, 0.9, 3, 0); fillP(c, 'rgba(255,255,255,0.6)');
    // tampa do motor: venezianas dos dois lados da turbina
    c.beginPath();
    for (let i = 0; i < 3; i++) { const yy = 13.6 + i * 1.9; c.moveTo(-7.2, yy); c.lineTo(-4.4, yy); c.moveTo(4.4, yy); c.lineTo(7.2, yy); }
    strokeP(c, 'rgba(16,20,24,0.6)', 0.9);
    // para-choques cromados
    c.beginPath(); RR(c, -9.6, -22.4, 19.2, 2.3, 1.1); RR(c, -9.6, 19.3, 19.2, 2.3, 1.1); inked(c, CAR.chrome, 0.7);
    // turbina amarrada na tampa traseira + bocal
    c.beginPath(); c.moveTo(-2.6, 20.4); c.lineTo(2.6, 20.4); c.lineTo(4, 25); c.lineTo(-4, 25); c.closePath(); inked(c, '#4a505c', 0.8);
    c.beginPath(); E(c, 0, 25, 3.4, 1.1); fillP(c, '#ffb347');
    c.beginPath(); RR(c, -3, 11.6, 6, 9.6, 2.6); inked(c, '#9aa5b8', 0.9);
    c.beginPath(); c.rect(-1.9, 12.4, 1.1, 8); fillP(c, 'rgba(255,255,255,0.5)');
    c.fillStyle = '#7a4a26'; c.fillRect(-6.6, 15.4, 13.2, 1.6);
    c.fillStyle = '#ffd23f'; c.fillRect(-0.7, 15.4, 1.4, 1.6);
    // nível da arma: casulos laterais
    if (lv >= 3) { pod(c, -14.6, 8.5, wc, lv >= 4, t, lv); pod(c, 14.6, 8.5, wc, lv >= 4, t, lv); }
    if (lv >= 4) { pod(c, -14, -10.5, wc, false, t, lv); pod(c, 14, -10.5, wc, false, t, lv); }
    // geringonça do teto (muda com a arma)
    c.translate(0, -4.6);
    roofGadget(c, wtype, lv, t, wc);
    c.restore();
    // papéis da delação voando em volta
    if (o.bomb) {
      c.save(); c.translate(x, y);
      for (let i = 0; i < 7; i++) {
        const a = t * 3.2 + (i * TAU) / 7, r = 25 + Math.sin(t * 5 + i) * 4;
        c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r * 0.9); c.rotate(a * 1.7 + i);
        c.beginPath(); c.rect(-2.6, -3.3, 5.2, 6.6); fillP(c, '#fffdf2'); strokeP(c, INK, 0.7);
        c.beginPath(); c.moveTo(-1.6, -1.6); c.lineTo(1.6, -1.6); c.moveTo(-1.6, 0); c.lineTo(1.6, 0); c.moveTo(-1.6, 1.6); c.lineTo(0.6, 1.6); strokeP(c, 'rgba(16,20,24,0.5)', 0.5);
        c.restore();
      }
      c.restore();
    }
  }

  // ======================================================================
  // Ícones das armas (UI usa na lojinha/ajuda; o item P também)
  // ======================================================================
  function weaponIcon(ctx, w, x, y, s) {
    const c = ctx;
    const def = G.WEAPONS[w] || G.WEAPONS.voto;
    const col = def.color;
    const k = s / 100;
    if (!(k > 0)) return;
    c.save();
    c.translate(x, y); c.scale(k, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const lw = Math.max(5, 1.1 / k);
    switch (def.id) {
      case 'boca': {
        c.beginPath(); RR(c, -44, -12, 12, 24, 4); inked(c, '#4a505c', lw);
        c.beginPath(); c.moveTo(-34, -12); c.lineTo(18, -34); c.lineTo(18, 34); c.lineTo(-34, 12); c.closePath(); inked(c, col, lw);
        c.beginPath(); E(c, 18, 0, 9, 34); inked(c, shade(col, 0.15), lw);
        c.beginPath(); E(c, 19, 0, 5, 24); fillP(c, '#5a4300');
        c.beginPath(); c.moveTo(-20, 14); c.lineTo(-24, 34); strokeP(c, INK, 13 + lw * 2); strokeP(c, '#4a505c', 13);
        c.beginPath(); c.moveTo(-26, -10); c.lineTo(10, -26); strokeP(c, 'rgba(255,255,255,0.55)', 5);
        c.beginPath();
        c.arc(30, 0, 14, -0.7, 0.7); c.moveTo(38 + Math.cos(-0.7) * 0, 0);
        strokeP(c, INK, 6);
        c.beginPath(); c.arc(32, 0, 22, -0.75, 0.75); strokeP(c, INK, 6);
        break;
      }
      case 'panela': {
        // panela de lado + colher de pau batendo na borda ("plém!")
        c.beginPath(); RR(c, -50, -6, 14, 10, 5); RR(c, 36, -6, 14, 10, 5); inked(c, '#3b3f47', lw);
        c.beginPath(); c.moveTo(-36, -8); c.lineTo(36, -8); c.lineTo(32, 30); c.quadraticCurveTo(30, 40, 20, 40); c.lineTo(-20, 40); c.quadraticCurveTo(-30, 40, -32, 30); c.closePath(); inked(c, col, lw);
        c.beginPath(); c.moveTo(-28, 0); c.lineTo(-25, 30); strokeP(c, 'rgba(255,255,255,0.7)', 6);
        c.beginPath(); c.moveTo(32, -8); c.lineTo(28, 30); c.quadraticCurveTo(27, 38, 18, 39); c.lineTo(22, -8); c.closePath(); fillP(c, SHADE_RGBA);
        c.beginPath(); RR(c, -42, -16, 84, 10, 5); inked(c, tint(col, 0.35), lw);
        c.beginPath(); c.moveTo(-6, -46); c.lineTo(30, -20); strokeP(c, INK, 9 + lw * 2); strokeP(c, '#c8955c', 9);
        c.beginPath(); E(c, -12, -50, 13, 9, 0.6); inked(c, '#c8955c', lw * 0.8);
        c.beginPath(); c.moveTo(38, -32); c.lineTo(50, -40); c.moveTo(42, -20); c.lineTo(56, -20); c.moveTo(30, -42); c.lineTo(34, -54); strokeP(c, INK, 6);
        break;
      }
      case 'jato': {
        c.beginPath();
        c.moveTo(4, -44); c.bezierCurveTo(18, -22, 36, -4, 36, 14); c.bezierCurveTo(36, 33, 21, 44, 4, 44);
        c.bezierCurveTo(-13, 44, -28, 33, -28, 14); c.bezierCurveTo(-28, -4, -10, -22, 4, -44); c.closePath();
        inked(c, col, lw);
        c.beginPath(); c.moveTo(4, 44); c.bezierCurveTo(21, 44, 36, 33, 36, 14); c.bezierCurveTo(30, 30, 18, 38, 4, 38); c.closePath(); fillP(c, SHADE_RGBA);
        c.beginPath(); E(c, -10, 12, 6, 13, 0.35); fillP(c, 'rgba(255,255,255,0.85)');
        c.beginPath(); c.moveTo(-36, -24); c.lineTo(-48, -24); c.moveTo(-38, -8); c.lineTo(-54, -8); c.moveTo(-40, 8); c.lineTo(-50, 8); strokeP(c, INK, 6);
        break;
      }
      default: { // voto: tecla CONFIRMA
        c.beginPath(); RR(c, -42, -22, 84, 54, 12); fillP(c, INK);
        c.beginPath(); RR(c, -42, -30, 84, 52, 12); inked(c, col, lw);
        c.beginPath(); RR(c, -34, -24, 68, 10, 5); fillP(c, 'rgba(255,255,255,0.35)');
        c.beginPath(); c.moveTo(-18, -2); c.lineTo(-5, 11); c.lineTo(20, -14); strokeP(c, INK, 13 + lw); strokeP(c, WHITE, 11);
      }
    }
    c.restore();
  }

  // ======================================================================
  // Itens
  // ======================================================================
  function pixFront(c) {
    c.beginPath(); c.moveTo(0, -7); c.lineTo(7, 0); c.lineTo(0, 7); c.lineTo(-7, 0); c.closePath();
    c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke(); fillP(c, '#32bcad');
    c.beginPath(); c.moveTo(0, -4.8); c.lineTo(4.8, 0); c.lineTo(0, 4.8); c.lineTo(-4.8, 0); c.closePath(); fillP(c, '#56dccb');
    c.beginPath(); c.moveTo(-3.8, -1); c.lineTo(0, -4.8); c.lineTo(1.2, -3.6); strokeP(c, 'rgba(255,255,255,0.8)', 0.9);
    c.fillStyle = '#0b4f48'; c.font = '900 5.4px ' + FB(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('R$', 0, 0.4);
  }
  function pixBack(c) {
    c.beginPath(); c.moveTo(0, -7); c.lineTo(7, 0); c.lineTo(0, 7); c.lineTo(-7, 0); c.closePath();
    c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke(); fillP(c, '#1f8f84');
    c.beginPath(); c.moveTo(0, -3.4); c.lineTo(3.4, 0); c.lineTo(0, 3.4); c.lineTo(-3.4, 0); c.closePath(); fillP(c, '#32bcad');
  }
  function pix5Paint(c) {
    c.beginPath(); RR(c, -9.5, -5.5, 19, 11, 1.6); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke(); fillP(c, '#2db3a3');
    c.beginPath(); RR(c, -8, -4, 16, 8, 1); strokeP(c, 'rgba(255,255,255,0.55)', 0.8);
    c.beginPath(); c.moveTo(-5.6, -2.6); c.lineTo(-3, 0); c.lineTo(-5.6, 2.6); c.lineTo(-8.2, 0); c.closePath(); fillP(c, '#bff5ec');
    c.beginPath(); O(c, 3.2, 0, 3.6); fillP(c, '#e9fffb');
    c.fillStyle = '#0b4f48'; c.font = '900 6.4px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('5', 3.2, 0.5);
  }
  function malaPaint(c) {
    // notas saindo da mala
    c.save(); c.translate(5, -6.5); c.rotate(-0.5); c.beginPath(); RR(c, -5, -2.6, 10, 5.2, 0.8); inked(c, '#7ed957', 0.6); c.restore();
    c.save(); c.translate(-4, -6.8); c.rotate(0.35); c.beginPath(); RR(c, -5, -2.6, 10, 5.2, 0.8); inked(c, '#5cc24a', 0.6); c.restore();
    c.beginPath(); c.moveTo(-3.6, -7.5); c.quadraticCurveTo(0, -12.5, 3.6, -7.5); c.lineWidth = 4.2; c.strokeStyle = INK; c.stroke(); strokeP(c, '#5a3618', 2.2);
    c.beginPath(); RR(c, -10.5, -7, 21, 15, 2.6); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke(); fillP(c, '#9a6534');
    c.beginPath(); c.rect(-10.5, -3.2, 21, 1.6); fillP(c, '#6e4421');
    c.beginPath(); RR(c, -10.5, -7, 21, 3.8, 2.4); fillP(c, '#b77d45');
    c.beginPath(); c.rect(-6.8, -4, 3, 3.6); c.rect(3.8, -4, 3, 3.6); fillP(c, '#ffd23f');
    c.fillStyle = '#3d2410'; c.font = '900 7px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('$', 0, 3.6);
  }
  function folderPaint(c, big) {
    // pasta parda com carimbo "DELAÇÃO"
    c.beginPath(); RR(c, -10.5, -9.5, 8.5, 4.4, 1.4); RR(c, -10.5, -7.4, 21, 15.4, 1.8);
    c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke();
    c.beginPath(); RR(c, -10.5, -9.5, 8.5, 4.4, 1.4); fillP(c, '#c9a35f');
    c.beginPath(); RR(c, -10.5, -7.4, 21, 15.4, 1.8); fillP(c, '#c9a35f');
    c.beginPath(); c.rect(-8, -8.6, 15, 3.6); fillP(c, '#fffdf2');
    c.beginPath(); RR(c, -10.5, -5, 21, 13, 1.8); fillP(c, '#e2bf7a');
    c.save(); c.rotate(-0.16);
    c.beginPath(); RR(c, -9, -2.8, 18, 6.6, 1); strokeP(c, '#d62839', 1.1);
    c.fillStyle = '#d62839'; c.font = '900 ' + (big ? 4.6 : 4.4) + 'px ' + FB(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('DELAÇÃO', 0, 0.6, 16.5);
    c.restore();
  }
  function sealPaint(c) {
    // fitas
    c.beginPath(); c.moveTo(-4, 4); c.lineTo(-7, 13); c.lineTo(-4.4, 11.6); c.lineTo(-2.4, 14); c.lineTo(-0.5, 5); c.closePath();
    c.moveTo(4, 4); c.lineTo(7, 13); c.lineTo(4.4, 11.6); c.lineTo(2.4, 14); c.lineTo(0.5, 5); c.closePath();
    c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke(); fillP(c, '#1b5fd1');
    // lacre ondulado
    c.beginPath();
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, r = i % 2 ? 9 : 10.2; if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke(); fillP(c, '#2f7cf0');
    c.beginPath(); O(c, 0, 0, 6.8); fillP(c, '#1b5fd1');
    c.beginPath(); c.arc(0, 0, 6.8, PI * 1.05, PI * 1.6); strokeP(c, 'rgba(255,255,255,0.5)', 1);
    c.fillStyle = '#ffffff'; c.font = '900 6.6px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('HC', 0, 0.6);
  }
  function envelopePaint(c) {
    c.beginPath(); RR(c, -10.5, -7, 21, 14, 1.6); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke(); fillP(c, '#fff6e6');
    c.beginPath(); c.moveTo(-10, 6.4); c.lineTo(-2.5, 0.5); c.moveTo(10, 6.4); c.lineTo(2.5, 0.5); strokeP(c, 'rgba(16,20,24,0.3)', 0.8);
    c.beginPath(); c.moveTo(-10.5, -6.6); c.lineTo(0, 1.8); c.lineTo(10.5, -6.6); c.closePath(); fillP(c, '#f2dfc0');
    c.beginPath(); c.moveTo(-10.5, -6.6); c.lineTo(0, 1.8); c.lineTo(10.5, -6.6); strokeP(c, INK, 0.9);
    c.beginPath(); O(c, 0, 1.2, 4.4); inked(c, '#e63946', 0.6);
    c.fillStyle = '#ffffff'; c.font = '900 4.6px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('13º', 0.3, 1.6);
  }
  function cupPaint(c) {
    c.beginPath(); E(c, 0, 7, 10, 2.8); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke(); fillP(c, '#f4f1e8');
    c.beginPath(); c.arc(7.2, 0.5, 3.2, -PI * 0.5, PI * 0.5); c.lineWidth = 4.4; c.strokeStyle = INK; c.stroke(); strokeP(c, '#ffffff', 2);
    c.beginPath(); c.moveTo(-7, -3.5); c.lineTo(7, -3.5); c.lineTo(5.6, 4.8); c.quadraticCurveTo(0, 7.2, -5.6, 4.8); c.closePath();
    c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke(); fillP(c, '#ffffff');
    c.beginPath(); c.moveTo(-6.6, -1.2); c.lineTo(6.6, -1.2); c.lineTo(6.2, 1); c.lineTo(-6.2, 1); c.closePath(); fillP(c, '#e63946');
    c.beginPath(); E(c, 0, -3.5, 7, 1.8); fillP(c, '#6f4e37'); strokeP(c, INK, 0.9);
    c.beginPath(); E(c, -2, -3.8, 2, 0.6); fillP(c, '#a77b5a');
  }

  // Aquece os sprites dos itens e os caches de fonte/gradiente do canvas do jogo, fora do jogo
  // (logo depois do boot e de novo se as fontes chegarem depois). A 1ª chuva de moedas de uma
  // Delação e a 1ª mala de um chefão deixam de engasgar.
  let itemsWarm = false;
  function warmItems() {
    const jobs = [
      () => sprite('pix', 18, 18, pixFront), () => sprite('pixb', 18, 18, pixBack), () => sprite('pix5', 24, 16, pix5Paint),
      () => sprite('mala', 26, 28, malaPaint), () => sprite('folder', 26, 24, (q) => folderPaint(q, true)),
      () => sprite('seal', 26, 32, sealPaint), () => sprite('envelope', 26, 20, envelopePaint), () => sprite('cup', 26, 22, cupPaint),
      () => sprite('life', 28, 18, lifePaint),
      () => { // gradientes de brilho do canvas do jogo + texto do item P (fonte já usada uma vez)
        const g = G.ctx;
        if (g) { for (const w in (G.WEAPONS || {})) radial(g, G.WEAPONS[w].color); for (const col of ['#ffd23f', '#4cc9f0', '#ff5d8f', '#ff9f43']) radial(g, col); }
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
        const x = cv.getContext('2d'); x.translate(32, 32);
        for (const ty of ['power', 'bomb', 'shield', 'life', 'cafe', 'pix', 'pix5', 'mala']) pickup(x, ty, 0, 0, 0.3, { wtype: 'voto', cycle: true });
        pickup(x, 'power', 0, 0, 0.3, { wtype: 'voto', restore: true }); // fonte menor do +1 do P da morte
        cv.width = 1;
      },
    ];
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 4) { try { jobs[i](); } catch (err) { G.reportError(err, 'art.warmItems'); } i++; }
      if (i < jobs.length) setTimeout(step, 16);
    };
    setTimeout(step, 0);
  }
  // espera o boot (canvas do jogo pronto) para aquecer
  (function waitBoot() {
    if (itemsWarm) return;
    if (G.canvas && G.state && G.state !== 'boot') { itemsWarm = true; setTimeout(warmItems, 50); return; }
    setTimeout(waitBoot, 150);
  })();
  // fontes chegaram depois do boot: refaz os sprites com texto (e o resto do cache de personagens)
  function fontsReady() {
    spriteCache.clear();
    pcache.clear(); pseen.clear(); pPixels = 0; dropStale(); clearWarmQueue(); WARM.seen.clear(); WARM.live.clear();
    TL.key = '';
    if (fuscaSpr) { fuscaSpr.c.width = 1; fuscaSpr = null; }
    warmItems();
  }

  function pickup(ctx, type, x, y, t, item) {
    const c = ctx;
    t = t || 0;
    item = item || {};
    const bob = Math.sin(t * 3.2 + x * 0.05) * 1.5;
    switch (type) {
      case 'pix': {
        const sx = Math.cos(t * 4.5 + x * 0.1);
        const spr = sx >= 0 ? sprite('pix', 18, 18, pixFront) : sprite('pixb', 18, 18, pixBack);
        c.save(); c.translate(x, y + bob * 0.6); c.scale(Math.max(0.18, Math.abs(sx)), 1); drawSprite(c, spr, 0, 0); c.restore();
        if (((t * 1.3 + x * 0.013) % 2.2) < 0.18) sparkle(c, x + 3, y - 4 + bob * 0.6, 3.2, '#ffffff');
        return;
      }
      case 'pix5': {
        c.save(); c.translate(x, y + bob); c.rotate(Math.sin(t * 3 + x) * 0.22); c.scale(1, 0.75 + 0.25 * Math.abs(Math.cos(t * 2.4)));
        drawSprite(c, sprite('pix5', 24, 16, pix5Paint), 0, 0); c.restore();
        return;
      }
      case 'mala': {
        c.save(); c.translate(x, y + bob); c.rotate(Math.sin(t * 2.4) * 0.12);
        drawSprite(c, sprite('mala', 26, 28, malaPaint), 0, 0);
        // nota escapando
        const ph = (t * 0.9) % 1;
        c.globalAlpha *= 1 - ph;
        c.translate(4 + ph * 8, -9 - ph * 12); c.rotate(ph * 5);
        c.beginPath(); RR(c, -3.6, -2, 7.2, 4, 0.6); fillP(c, '#7ed957'); strokeP(c, INK, 0.6);
        c.restore();
        return;
      }
      case 'power': {
        const w = G.WEAPONS[item.wtype] ? item.wtype : 'voto';
        const col = G.WEAPONS[w].color;
        const pulse = 1 + Math.sin(t * 8) * 0.07;
        glow(c, x, y + bob, 24, col, 0.55 + Math.sin(t * 8) * 0.15);
        c.save(); c.translate(x, y + bob);
        // marcador do tempo até trocar de arma
        if (item.cycle) {
          const ph = t < 0.5 ? 0 : ((t - 0.5) % 3) / 3;
          c.beginPath(); c.arc(0, 0, 15.5, -PI / 2, -PI / 2 + TAU * (1 - ph));
          c.lineCap = 'round'; strokeP(c, 'rgba(16,20,24,0.7)', 3.6); strokeP(c, ph > 0.8 ? '#ff5d8f' : WHITE, 1.8);
        }
        c.scale(pulse, pulse);
        c.beginPath(); O(c, 0, 0, 12.5); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); fillP(c, col);
        c.beginPath(); O(c, 0, 0, 9.4); fillP(c, '#141a2e');
        c.beginPath(); c.arc(0, 0, 11, PI * 1.1, PI * 1.55); strokeP(c, 'rgba(255,255,255,0.6)', 1.4);
        weaponIcon(c, w, 0, 0.5, 13.5);
        // etiqueta "P" (o P que caiu na morte, item.restore: "+1" dourado, devolve o nível perdido)
        const back = !!item.restore;
        c.beginPath(); O(c, 9, -9, 5.4); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke(); fillP(c, back ? '#ffd23f' : WHITE);
        c.fillStyle = INK; c.font = '900 ' + (back ? 6.4 : 7.4) + 'px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(back ? '+1' : 'P', back ? 9 : 9.2, -8.5);
        c.restore();
        // nome curto da arma ("DE VOLTA" no P da morte)
        const nm = back ? 'DE VOLTA' : WNAME[w];
        c.font = '900 7px ' + FB(); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 2.6; c.strokeStyle = INK; c.lineJoin = 'round'; c.strokeText(nm, x, y + bob + 19);
        c.fillStyle = back ? WHITE : col; c.fillText(nm, x, y + bob + 19);
        return;
      }
      case 'bomb': {
        glow(c, x, y + bob, 20, '#ffd23f', 0.4 + Math.sin(t * 6) * 0.12);
        c.save(); c.translate(x, y + bob); c.rotate(Math.sin(t * 2.6) * 0.1);
        drawSprite(c, sprite('folder', 26, 24, (q) => folderPaint(q, true)), 0, 0);
        c.restore();
        if ((t % 1.6) < 0.2) sparkle(c, x + 8, y - 8 + bob, 3.6, '#fff4c2');
        return;
      }
      case 'shield': {
        glow(c, x, y + bob, 20, '#4cc9f0', 0.45 + Math.sin(t * 6) * 0.12);
        c.save(); c.translate(x, y + bob); c.scale(Math.max(0.3, Math.abs(Math.cos(t * 2))), 1);
        drawSprite(c, sprite('seal', 26, 32, sealPaint), 0, 1);
        c.restore();
        return;
      }
      case 'life': {
        glow(c, x, y + bob, 21, '#ff5d8f', 0.45 + Math.sin(t * 6) * 0.15);
        c.save(); c.translate(x, y + bob); c.rotate(Math.sin(t * 3) * 0.12); const pl = 1 + Math.max(0, Math.sin(t * 6)) * 0.08; c.scale(pl, pl);
        drawSprite(c, sprite('envelope', 26, 20, envelopePaint), 0, 0);
        c.restore();
        return;
      }
      case 'cafe': {
        glow(c, x, y + bob, 18, '#ff9f43', 0.35);
        c.save(); c.translate(x, y + bob);
        drawSprite(c, sprite('cup', 26, 22, cupPaint), 0, 2);
        c.beginPath();
        for (let i = 0; i < 2; i++) {
          const sx = i ? 2.4 : -2.4, ph = t * 5 + i * 2.2;
          c.moveTo(sx, -3.5); c.bezierCurveTo(sx + Math.sin(ph) * 2.8, -7, sx - Math.sin(ph) * 2.8, -10, sx + Math.sin(ph + 1) * 1.6, -13.5);
        }
        c.lineCap = 'round'; strokeP(c, 'rgba(16,20,24,0.6)', 2.6); strokeP(c, '#ffffff', 1.3);
        c.restore();
        return;
      }
      default: {
        c.beginPath(); O(c, x, y, 7); fillP(c, '#ffffff');
      }
    }
  }
  const WNAME = { voto: 'VOTO', boca: 'BOCA', panela: 'PANELA', jato: 'JATO' };
  function sparkle(c, x, y, r, col) {
    c.beginPath();
    c.moveTo(x, y - r); c.lineTo(x + r * 0.25, y - r * 0.25); c.lineTo(x + r, y); c.lineTo(x + r * 0.25, y + r * 0.25);
    c.lineTo(x, y + r); c.lineTo(x - r * 0.25, y + r * 0.25); c.lineTo(x - r, y); c.lineTo(x - r * 0.25, y - r * 0.25); c.closePath();
    fillP(c, col);
  }

  // ---------- ícones do HUD ----------
  function lifePaint(c) {
    // Fusquinha de lado (silhueta clássica)
    c.beginPath();
    c.moveTo(-8, 2.6);
    c.bezierCurveTo(-8.6, -2.2, -5.4, -6.4, -1, -6.5);
    c.bezierCurveTo(2.6, -6.5, 4.6, -4, 5.6, -1.8);
    c.bezierCurveTo(7.6, -1.5, 8.4, 0.4, 8.3, 2.6);
    c.closePath();
    c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke(); fillP(c, CAR.body);
    c.beginPath(); c.moveTo(-5.4, -1.2); c.bezierCurveTo(-5, -4.4, -2.2, -5.2, -0.2, -5.1); c.lineTo(3.4, -1.4); c.closePath(); fillP(c, CAR.glass);
    c.beginPath(); c.moveTo(-1.4, -5.2); c.lineTo(-1.4, -1.2); strokeP(c, CAR.body, 0.9);
    c.beginPath(); c.moveTo(-6.4, -3.6); c.bezierCurveTo(-4.4, -6.2, -1.6, -6.6, 1.4, -6.3); strokeP(c, WHITE, 1.1);
    c.beginPath(); c.rect(7.6, 1.2, 1.4, 1.4); c.rect(-9, 1.2, 1.4, 1.4); fillP(c, CAR.chrome);
    c.beginPath(); O(c, -4.6, 3, 2.3); O(c, 4.4, 3, 2.3); fillP(c, INK);
    c.beginPath(); O(c, -4.6, 3, 0.9); O(c, 4.4, 3, 0.9); fillP(c, CAR.chrome);
    c.beginPath(); c.moveTo(-9.4, 1); c.lineTo(-11.8, -0.2); c.lineTo(-11.8, 2.6); c.closePath(); fillP(c, '#ff8c1a');
  }
  function lifeIcon(ctx, x, y, s) {
    s = s || 13;
    const k = (s / 13) * 0.74; // cabe no espaçamento de 16 px do HUD
    ctx.save(); ctx.translate(x + 0.8 * k, y); ctx.scale(k, k);
    drawSprite(ctx, sprite('life', 28, 18, lifePaint), 0, 0);
    ctx.restore();
  }
  function bombIcon(ctx, x, y, s) {
    s = s || 14;
    const k = s / 18;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    drawSprite(ctx, sprite('folder', 26, 24, (q) => folderPaint(q, true)), 0, 0);
    ctx.restore();
  }

  // ======================================================================
  // Fusca de lado (cenas da história e título)
  // len = comprimento em px; (x,y) = centro do carro no chão. o: {t, rot, jet, cozy, flame, flip}
  // ======================================================================
  function fuscaSide(ctx, x, y, len, o) {
    o = o || {};
    const c = ctx;
    const t = o.t || 0;
    const s = len / 100;
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    c.scale(s * (o.flip ? -1 : 1), s);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const lw = (o.lw || 2.2) / s;
    // chama + turbina (atrás)
    const jet = o.jet !== false;
    const ja = -0.16; // turbina levemente inclinada
    if (jet && !o.noFlame) {
      c.save(); c.translate(-36, -46); c.rotate(ja);
      const fl = (o.flame || 1);
      if (fl > 0) {
        const L = (24 + Math.sin(t * 29) * 4 + Math.sin(t * 47) * 2.5) * fl;
        const tear = (w, l, col) => {
          c.beginPath(); c.moveTo(-30, -w); c.bezierCurveTo(-30 - l * 0.45, -w * 1.1, -30 - l * 0.85, -w * 0.35, -30 - l, 0);
          c.bezierCurveTo(-30 - l * 0.85, w * 0.35, -30 - l * 0.45, w * 1.1, -30, w); c.closePath(); fillP(c, col);
        };
        glow(c, -34, 0, 22 * Math.sqrt(fl), '#ff8c1a', 0.7);
        tear(9 * Math.sqrt(fl), L + 12 * fl, 'rgba(76,201,240,0.85)');
        tear(7.5 * Math.sqrt(fl), L, '#ff8c1a');
        tear(4.8 * Math.sqrt(fl), L * 0.6, '#ffd23f');
        tear(2.4 * Math.sqrt(fl), L * 0.3, '#ffffff');
      }
      c.restore();
    }
    // rodas
    for (let i = 0; i < 2; i++) {
      const wx = i ? 31 : -31;
      c.beginPath(); O(c, wx, -9.5, 10.2); inked(c, '#1a1d22', lw);
      c.beginPath(); O(c, wx, -9.5, 5.6); fillP(c, CAR.chrome);
      c.beginPath(); O(c, wx, -9.5, 2); fillP(c, '#8a96a8');
      c.save(); c.translate(wx, -9.5); c.rotate(t * 8); c.beginPath(); c.moveTo(-4.4, 0); c.lineTo(4.4, 0); strokeP(c, '#8a96a8', 1.2); c.restore();
    }
    // carroceria
    const bodyP = () => {
      c.moveTo(-49, -12);
      c.bezierCurveTo(-52, -27, -44, -41, -26, -45.5);
      c.bezierCurveTo(-14, -49, 2, -49, 10, -44.5);
      c.bezierCurveTo(18, -40, 22, -33, 26, -28.5);
      c.bezierCurveTo(37, -27.5, 47.5, -24, 50, -15);
      c.lineTo(50, -12);
      c.closePath();
    };
    c.beginPath(); bodyP(); inked(c, CAR.body, lw);
    // sombra chapada embaixo
    c.beginPath(); c.moveTo(-49.5, -17); c.lineTo(50, -17); c.lineTo(50, -12); c.lineTo(-49, -12); c.closePath(); fillP(c, SHADE_RGBA);
    // paralamas
    c.beginPath();
    c.moveTo(16, -12); c.bezierCurveTo(18, -27, 43, -29.5, 48.5, -12); c.closePath();
    c.moveTo(-48, -12); c.bezierCurveTo(-47, -30, -19, -30, -14, -12); c.closePath();
    inked(c, CAR.fender, lw * 0.8);
    c.beginPath(); c.moveTo(20, -20); c.bezierCurveTo(24, -25, 32, -26.5, 38, -25.5); c.moveTo(-44, -21); c.bezierCurveTo(-40, -27, -31, -28, -25, -27);
    strokeP(c, 'rgba(255,255,255,0.5)', 1.6);
    // caixas de roda (por cima do paralama)
    c.beginPath(); c.arc(31, -9.5, 12.4, PI, TAU); c.arc(-31, -9.5, 12.4, PI, TAU); fillP(c, '#14161b');
    for (let i = 0; i < 2; i++) {
      const wx = i ? 31 : -31;
      c.beginPath(); O(c, wx, -9.5, 10.2); inked(c, '#1a1d22', lw * 0.7);
      c.beginPath(); O(c, wx, -9.5, 5.6); fillP(c, CAR.chrome);
      c.beginPath(); O(c, wx, -9.5, 2.2); fillP(c, '#8a96a8');
      c.beginPath(); c.arc(wx, -9.5, 5.6, PI * 1.1, PI * 1.5); strokeP(c, WHITE, 1.2);
    }
    // estribo
    c.beginPath(); RR(c, -18, -13.5, 32, 3, 1.2); inked(c, '#2a2f38', lw * 0.6);
    // janelas
    c.beginPath();
    c.moveTo(-37, -27.5); c.bezierCurveTo(-37, -36.5, -28, -43, -14, -44); c.lineTo(5, -44); c.bezierCurveTo(11, -42, 15, -36.5, 19, -29); c.lineTo(-37, -27.5); c.closePath();
    inked(c, CAR.glass, lw * 0.7);
    c.beginPath(); c.rect(-9.5, -45, 3.4, 18); fillP(c, CAR.body);
    c.beginPath(); c.moveTo(-9.5, -45); c.lineTo(-9.5, -27); c.moveTo(-6.1, -45); c.lineTo(-6.1, -27); strokeP(c, INK, lw * 0.6);
    c.beginPath(); c.moveTo(-30, -31); c.lineTo(-21, -41); c.lineTo(-17, -41); c.lineTo(-26, -31); c.closePath(); c.moveTo(-2, -31); c.lineTo(5, -41); c.lineTo(8, -41); c.lineTo(1, -31); c.closePath(); fillP(c, 'rgba(255,255,255,0.28)');
    // friso cromado, porta, maçaneta
    c.beginPath(); c.moveTo(-42, -25.5); c.lineTo(25, -25.5); strokeP(c, CAR.chrome, 1.4);
    c.beginPath(); c.moveTo(-8, -25.5); c.lineTo(-8, -14); c.moveTo(19, -27); c.lineTo(17, -14); strokeP(c, 'rgba(16,20,24,0.45)', 1);
    c.beginPath(); RR(c, 10, -23.5, 5, 1.6, 0.8); fillP(c, CAR.chrome);
    // faixa branca no teto
    c.beginPath(); c.moveTo(-34, -42.6); c.bezierCurveTo(-24, -47.2, -6, -48.6, 8, -45.4); strokeP(c, CAR.stripe, 3.4);
    // farol, lanterna e para-choques
    c.beginPath(); E(c, 45.5, -21.5, 3.4, 4.6, -0.3); inked(c, '#fff6c8', lw * 0.6);
    c.beginPath(); E(c, -46.5, -23, 1.8, 3.4, 0.3); inked(c, '#e63946', lw * 0.6);
    c.beginPath(); RR(c, 47, -14.6, 6.4, 3.4, 1.6); RR(c, -53.4, -14.6, 6.4, 3.4, 1.6); inked(c, CAR.chrome, lw * 0.6);
    // turbina amarrada
    if (jet) {
      c.save(); c.translate(-36, -46); c.rotate(ja);
      // suportes
      c.beginPath(); c.moveTo(-14, 6); c.lineTo(-10, 12); c.moveTo(12, 6); c.lineTo(10, 10); strokeP(c, INK, 3.4 + lw); strokeP(c, '#5b6375', 3.4);
      c.beginPath(); c.moveTo(-30, -6.5); c.lineTo(-40, -8.5); c.lineTo(-40, 8.5); c.lineTo(-30, 6.5); c.closePath(); inked(c, '#4a505c', lw * 0.8);
      c.beginPath(); RR(c, -31, -9, 54, 18, 8); inked(c, o.cozy ? '#ff9ecb' : '#a9b3c4', lw);
      if (o.cozy) {
        // capinha de crochê da Vó (listras + pontinhos de tricô)
        const cols = ['#ffd23f', '#3ddc84', '#4cc9f0', '#ff5d8f'];
        for (let i = 0; i < 4; i++) { c.beginPath(); c.rect(-24 + i * 11, -8.4, 5, 16.8); fillP(c, cols[i]); }
        c.beginPath();
        for (let i = 0; i < 9; i++) { const xx = -27 + i * 5.6; c.moveTo(xx - 1.6, -3); c.lineTo(xx, -1); c.lineTo(xx + 1.6, -3); c.moveTo(xx - 1.6, 3); c.lineTo(xx, 5); c.lineTo(xx + 1.6, 3); }
        strokeP(c, 'rgba(16,20,24,0.35)', 0.9);
      } else {
        c.beginPath(); c.rect(-26, -6.5, 44, 3); fillP(c, 'rgba(255,255,255,0.55)');
      }
      c.beginPath(); E(c, 23, 0, 4.5, 9.4); inked(c, '#5b6375', lw * 0.8);
      c.beginPath(); E(c, 23.6, 0, 2.6, 7); fillP(c, '#20242c');
      if (!o.noFan) {
        c.save(); c.translate(23.6, 0); c.scale(0.37, 1); c.rotate(t * 25);
        c.beginPath(); for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5); } strokeP(c, '#9aa5b8', 2.4);
        c.restore();
      }
      // cintas
      c.beginPath(); c.moveTo(-18, -9.5); c.lineTo(-17, 13); c.moveTo(6, -9.5); c.lineTo(7, 12); strokeP(c, INK, 3.6 + lw); strokeP(c, '#7a4a26', 3.6);
      c.beginPath(); c.rect(-19.5, -2, 3.6, 4); c.rect(4.6, -2, 3.6, 4); fillP(c, '#ffd23f');
      c.restore();
    }
    c.restore();
  }

  // partes animadas do Fusca de lado (mesmas coordenadas de fuscaSide, já escalado)
  function fuscaFlame(c, t, o) {
    const fl = (o.flame || 1);
    if (o.jet === false || !(fl > 0)) return;
    c.save(); c.translate(-36, -46); c.rotate(-0.16);
    const L = (24 + Math.sin(t * 29) * 4 + Math.sin(t * 47) * 2.5) * fl;
    const tear = (w, l, col) => {
      c.beginPath(); c.moveTo(-30, -w); c.bezierCurveTo(-30 - l * 0.45, -w * 1.1, -30 - l * 0.85, -w * 0.35, -30 - l, 0);
      c.bezierCurveTo(-30 - l * 0.85, w * 0.35, -30 - l * 0.45, w * 1.1, -30, w); c.closePath(); fillP(c, col);
    };
    glow(c, -34, 0, 22 * Math.sqrt(fl), '#ff8c1a', 0.7);
    tear(9 * Math.sqrt(fl), L + 12 * fl, 'rgba(76,201,240,0.85)');
    tear(7.5 * Math.sqrt(fl), L, '#ff8c1a');
    tear(4.8 * Math.sqrt(fl), L * 0.6, '#ffd23f');
    tear(2.4 * Math.sqrt(fl), L * 0.3, '#ffffff');
    c.restore();
  }
  function fuscaFan(c, t, ja) {
    c.save(); c.translate(-36, -46); c.rotate(ja); c.translate(23.6, 0); c.scale(0.37, 1); c.rotate(t * 25);
    c.beginPath(); for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5); } strokeP(c, '#9aa5b8', 2.4);
    c.restore();
  }
  // caixa da lataria em unidades do Fusca (rodas, carroceria, turbina e cintas, com folga para o contorno)
  const FUSCA_BOX = [-82, -64, 140, 70];
  // Fusca do título já GIRADO num sprite (lataria parada): colado 1:1 no pixel do aparelho.
  // Girar um sprite grande a cada quadro custa tanto quanto os vetores sem GPU, por isso o
  // ângulo é fixo; a chama e a hélice continuam ao vivo por cima/por baixo.
  let fuscaSpr = null;
  function fuscaTitleSprite(len, rot, fx, fy, o, pr) {
    const key = [len.toFixed(2), rot, fx.toFixed(2), fy.toFixed(2), pr, o.lw || 2.2].join('|');
    if (fuscaSpr && fuscaSpr.key === key) return fuscaSpr;
    if (fuscaSpr) { fuscaSpr.c.width = 1; fuscaSpr.c.height = 1; }
    const s = len / 100, co = Math.cos(rot), si = Math.sin(rot);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [bx, by] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const px = fx + s * (FUSCA_BOX[0] + bx * FUSCA_BOX[2]), py = fy + s * (FUSCA_BOX[1] + by * FUSCA_BOX[3]);
      const rx = px * co - py * si, ry = px * si + py * co;
      x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); y0 = Math.min(y0, ry); y1 = Math.max(y1, ry);
    }
    x0 = Math.floor(x0 * pr - 2) / pr; y0 = Math.floor(y0 * pr - 2) / pr;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil((x1 - x0) * pr + 4)); cv.height = Math.max(1, Math.ceil((y1 - y0) * pr + 4));
    const x = cv.getContext('2d');
    x.setTransform(pr, 0, 0, pr, -x0 * pr, -y0 * pr); x.rotate(rot);
    try { fuscaSide(x, fx, fy, len, Object.assign({}, o, { noFlame: true, noFan: true, t: 0 })); } catch (err) { G.reportError(err, 'art.fuscaSprite'); }
    fuscaSpr = { key, c: bake(cv), ox: x0, oy: y0, pr };
    return fuscaSpr;
  }

  // ======================================================================
  // Ajudantes das cenas
  // ======================================================================
  const patCache = new WeakMap();
  function halftone(ctx, color, step) {
    let m = patCache.get(ctx);
    if (!m) { m = new Map(); patCache.set(ctx, m); }
    const key = color + '|' + step;
    let p = m.get(key);
    if (p === undefined) {
      const r = 2, cv = document.createElement('canvas');
      cv.width = cv.height = Math.max(2, Math.round(step * r));
      const x = cv.getContext('2d');
      x.scale(r, r); x.fillStyle = color;
      x.beginPath(); x.arc(step * 0.25, step * 0.25, step * 0.17, 0, TAU); x.arc(step * 0.75, step * 0.75, step * 0.17, 0, TAU); x.fill();
      p = ctx.createPattern(cv, 'repeat');
      if (p && p.setTransform && typeof DOMMatrix !== 'undefined') { try { p.setTransform(new DOMMatrix().scale(1 / r)); } catch (e) { /* nada */ } }
      m.set(key, p || null);
    }
    return p;
  }
  function halftoneRect(ctx, x, y, w, h, color, step) {
    const p = halftone(ctx, color, step || 6);
    if (!p) return;
    ctx.fillStyle = p; ctx.fillRect(x, y, w, h);
  }
  function rays(ctx, cx, cy, n, r, rot, col) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i * TAU) / n, a1 = a0 + (TAU / n) * 0.5;
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r); ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r); ctx.closePath();
    }
    fillP(ctx, col);
  }
  function vgrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }
  // Santinho de campanha (número 171, sempre)
  function santinho(ctx, x, y, s, rot, color, flipK) {
    const c = ctx;
    c.save(); c.translate(x, y); c.rotate(rot || 0); if (flipK != null) c.scale(flipK < 0 ? Math.min(-0.35, flipK) : Math.max(0.35, flipK), 1);
    const w = s * 0.68, h = s;
    c.beginPath(); c.rect(-w / 2, -h / 2, w, h); fillP(c, '#ffffff'); strokeP(c, INK, Math.max(0.8, s * 0.06));
    c.fillStyle = color || '#e63946'; c.fillRect(-w / 2, -h / 2, w, h * 0.46);
    c.beginPath(); O(c, 0, -h * 0.2, w * 0.24); fillP(c, '#e8b48a');
    c.beginPath(); c.arc(0, -h * 0.29, w * 0.24, PI, TAU); fillP(c, '#2a2a2a');
    if (s >= 13) {
      c.fillStyle = INK; c.font = '900 ' + (h * 0.27).toFixed(1) + 'px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('171', 0, h * 0.24, w * 0.92);
    } else { c.fillStyle = INK; c.fillRect(-w * 0.32, h * 0.14, w * 0.64, h * 0.16); }
    c.restore();
  }
  function bill(ctx, x, y, s, rot, flipK) {
    const c = ctx;
    c.save(); c.translate(x, y); c.rotate(rot || 0); if (flipK != null) c.scale(1, flipK < 0 ? Math.min(-0.35, flipK) : Math.max(0.35, flipK));
    const w = s, h = s * 0.5;
    c.beginPath(); RR(c, -w / 2, -h / 2, w, h, s * 0.06); fillP(c, '#7ed957'); strokeP(c, INK, Math.max(0.8, s * 0.05));
    c.beginPath(); O(c, 0, 0, h * 0.3); fillP(c, '#c8f7b0');
    if (s >= 16) { c.fillStyle = '#2d6a1f'; c.font = '900 ' + (h * 0.42).toFixed(1) + 'px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('R$', 0, h * 0.04); }
    c.restore();
  }
  // texto de gibi (POW!) com contorno
  function comicText(ctx, str, x, y, size, rot, fill, stroke) {
    const c = ctx;
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    c.font = size + 'px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.32; c.strokeStyle = INK; c.strokeText(str, size * 0.06, size * 0.08);
    c.lineWidth = size * 0.22; c.strokeStyle = stroke || INK; c.strokeText(str, 0, 0);
    c.fillStyle = fill; c.fillText(str, 0, 0);
    c.restore();
  }
  function burstShape(ctx, x, y, r, n, jag, rot) {
    const c = ctx;
    c.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
    for (let i = 1; i < n * 2; i++) {
      const a = rot + (i * PI) / n, rr = i % 2 ? r * jag : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }
  function confettiRain(ctx, L, t, n, speed, seed) {
    const cols = ['#ffd23f', '#3ddc84', '#4cc9f0', '#ff5d8f', '#ffffff', '#ff8c1a'];
    const c = ctx;
    for (let i = 0; i < n; i++) {
      const h1 = hash(i + seed), h2 = hash(i * 3.1 + seed), h3 = hash(i * 7.7 + seed);
      const yy = L.y + (((t * speed * (0.6 + h2 * 0.8) + h3 * (L.h + 30)) % (L.h + 30)) - 15);
      const xx = L.x + h1 * L.w + Math.sin(t * 2 + i) * 6;
      const rot = t * (2 + h2 * 4) + i;
      c.save(); c.translate(xx, yy); c.rotate(rot); c.scale(1, 0.3 + Math.abs(Math.cos(rot * 1.3)) * 0.7);
      c.fillStyle = cols[i % cols.length]; c.fillRect(-2, -3, 4, 6);
      c.restore();
    }
  }
  function smokePuffs(ctx, x, y, t, n, r, col, drift, seed) {
    const c = ctx;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const ph = ((t * 0.18 + i / n + hash(seed + i) * 0.1) % 1);
      const yy = y - ph * r * 9;
      const xx = x + Math.sin(ph * 5 + seed) * r * 0.8 + ph * drift;
      O(c, xx, yy, r * (0.6 + ph * 1.1));
    }
    fillP(c, col);
  }
  function stars(ctx, L, t, n, maxY, seed) {
    const c = ctx;
    c.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const xx = L.x + hash(i + seed) * L.w, yy = L.y + hash(i * 2.3 + seed) * (maxY - L.y);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + hash(i) * 2) + i));
      c.globalAlpha = tw;
      const r = hash(i * 5.1) > 0.85 ? 1.4 : 0.8;
      c.fillRect(xx - r / 2, yy - r / 2, r, r);
    }
    c.globalAlpha = 1;
  }
  // Silhueta do Congresso Nacional (torres gêmeas, cúpula e cuia)
  // mode: 0 = tudo; 1 = só a parte parada (silhueta + janelas sempre acesas); 2 = só as janelas que piscam
  function congresso(ctx, cx, groundY, k, col, litCol, t, mode) {
    const c = ctx;
    mode = mode || 0;
    c.save(); c.translate(cx, groundY); c.scale(k, k);
    if (mode === 2) { congressoLit(c, litCol, t, 2); c.restore(); return; }
    c.fillStyle = col;
    c.beginPath();
    c.rect(-150, -14, 300, 14);                     // plataforma
    c.rect(-21, -128, 17, 115); c.rect(4, -128, 17, 115); // torres
    c.rect(-6, -86, 12, 9);                           // passarela
    c.moveTo(-150, -14); c.lineTo(-175, 0); c.lineTo(-150, 0); c.closePath(); // rampa
    c.fill();
    // cúpula do Senado (esquerda)
    c.beginPath(); c.ellipse(-85, -14, 30, 19, 0, PI, TAU); c.closePath(); c.fill();
    // cuia da Câmara (direita)
    c.beginPath(); c.moveTo(42, -38); c.lineTo(132, -38); c.quadraticCurveTo(118, -16, 87, -16); c.quadraticCurveTo(56, -16, 42, -38); c.closePath(); c.fill();
    c.beginPath(); c.rect(80, -18, 14, 5); c.fill();
    if (litCol) congressoLit(c, litCol, t, mode);
    c.restore();
  }
  function congressoLit(c, litCol, t, mode) {
    c.fillStyle = litCol;
    for (let tw = 0; tw < 2; tw++) {
      const x0 = tw ? 6.5 : -18.5;
      for (let r = 0; r < 18; r++) for (let q = 0; q < 3; q++) {
        const h = hash(r * 7 + q * 3 + tw * 50);
        if (h <= 0.55) continue;
        const steady = h < 0.92;
        if (mode === 1 ? steady : mode === 2 ? !steady && Math.sin(t * 3 + r + q) > 0 : steady || Math.sin(t * 3 + r + q) > 0) c.fillRect(x0 + q * 4.4, -123 + r * 6, 3, 2.6);
      }
    }
  }

  // ======================================================================
  // Cenas da história — desenhadas num quadro 360×240 ("contain"), fundo estendido
  // ======================================================================
  const ZE = { skin: '#d9a273', hair: 'short', hairColor: '#2b1d14', hat: 'cap', hatColor: '#2366d1', beard: 'stubble', beardColor: '#3a2a1e', body: 'tank', shirt: '#ffffff', brows: 'determined', browColor: '#24170f', sweat: true, seed: 3 };
  const VO = { skin: '#f0c8a0', hair: 'curly', hairColor: '#f4f4f4', browColor: '#b8b0a8', glasses: 'round', body: 'cardigan', suit: '#ff8fc0', shirt: '#fff4f8', wrinkles: true, cheeks: true, brows: 'worried', seed: 5 };
  const LWpx = (s) => 0.55 + 3.1 * s; // contorno em px para um person de escala s
  const SC = {};

  SC.urna = function (c, L, t) {
    c.fillStyle = '#17389a'; c.fillRect(L.x, L.y, L.w, L.h);
    rays(c, 180, 118, 20, 520, t * 0.15, 'rgba(255,255,255,0.07)');
    halftoneRect(c, L.x, L.y, L.w, L.h, 'rgba(255,255,255,0.07)', 7);
    // mesa
    c.fillStyle = '#8a5a34'; c.fillRect(L.x, 192, L.w, L.y + L.h - 192);
    c.fillStyle = '#6a4024'; c.fillRect(L.x, 200, L.w, 5);
    c.beginPath(); c.moveTo(L.x, 192); c.lineTo(L.x + L.w, 192); strokeP(c, INK, 3);
    // ondas de som do bipe final
    const pulse = (t * 1.6) % 1;
    c.beginPath();
    for (let i = 0; i < 3; i++) { const r = 16 + i * 12 + pulse * 10; c.moveTo(38 + Math.cos(-0.6) * r, 120 + Math.sin(-0.6) * r); c.arc(38, 120, r, -0.6, 0.6); }
    c.globalAlpha = 1 - pulse * 0.6; strokeP(c, '#ffd23f', 3); c.globalAlpha = 1;
    // sombra da urna
    c.beginPath(); E(c, 183, 196, 128, 7); fillP(c, 'rgba(0,0,0,0.35)');
    // corpo
    c.beginPath(); RR(c, 56, 64, 248, 134, 14); inked(c, '#b9af98', 3);
    c.beginPath(); RR(c, 56, 56, 248, 130, 14); inked(c, '#efe9da', 3);
    c.beginPath(); RR(c, 66, 66, 228, 112, 9); fillP(c, '#e2d9c3');
    c.beginPath(); RR(c, 66, 66, 228, 6, 3); fillP(c, 'rgba(255,255,255,0.6)');
    // brasão + "JUSTIÇA ELEITORAL"
    c.beginPath(); O(c, 82, 80, 6); inked(c, '#1b3fa0', 1.2);
    c.beginPath(); starPath(c, 82, 80, 4.2, 1.8, 5); fillP(c, '#ffd23f');
    c.fillStyle = 'rgba(16,20,24,0.75)'; c.font = '800 8px ' + FB(); c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('JUSTIÇA ELEITORAL', 92, 80.5);
    // tela
    c.beginPath(); RR(c, 76, 90, 112, 80, 6); inked(c, '#3b3f47', 2);
    const lcd = c.createLinearGradient(0, 96, 0, 164); lcd.addColorStop(0, '#dcebd2'); lcd.addColorStop(1, '#b9d1ad');
    c.beginPath(); RR(c, 82, 96, 100, 68, 3); c.fillStyle = lcd; c.fill();
    c.fillStyle = 'rgba(30,50,30,0.07)'; for (let yy = 98; yy < 164; yy += 3) c.fillRect(82, yy, 100, 1);
    c.fillStyle = '#1b2a1b'; c.font = '44px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('FIM', 132, 128, 92);
    if ((t % 1.2) < 0.8) { c.font = '800 9px ' + FB(); c.fillText('VOTOU', 132, 155); }
    // teclado
    c.beginPath(); RR(c, 196, 90, 92, 80, 6); inked(c, '#2b2e35', 2);
    c.font = '800 9px ' + FB(); c.textAlign = 'center'; c.textBaseline = 'middle';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];
    for (let i = 0; i < 12; i++) {
      if (!keys[i]) continue;
      const kx = 203 + (i % 3) * 27, ky = 94 + ((i / 3) | 0) * 14.5;
      c.beginPath(); RR(c, kx, ky, 22, 12, 3); fillP(c, '#15171c');
      c.beginPath(); RR(c, kx, ky, 22, 4, 2); fillP(c, '#3a3e48');
      c.fillStyle = '#ffffff'; c.fillText(keys[i], kx + 11, ky + 6.8);
    }
    // teclas coloridas
    const press = Math.max(0, Math.sin(t * 3.2)) ** 6;
    const ck = [['BRANCO', '#f4f1e8', 200, 25], ['CORRIGE', '#ff8c1a', 228, 25], ['CONFIRMA', '#2fbf5b', 256, 29]];
    c.font = '800 5.6px ' + FB();
    for (const [lab, col, kx, kw] of ck) {
      const dy = lab === 'CONFIRMA' ? press * 1.6 : 0;
      c.beginPath(); RR(c, kx, 153 + dy, kw, 13, 3); inked(c, col, 1);
      c.fillStyle = INK; c.fillText(lab, kx + kw / 2, 160 + dy, kw - 2);
    }
    // mão apertando CONFIRMA
    const hy = 186 + press * 3 - Math.sin(t * 3.2) * 4;
    c.save(); c.translate(276, hy); c.rotate(-0.35);
    c.beginPath(); c.moveTo(14, 18); c.lineTo(30, 70); strokeP(c, INK, 22); strokeP(c, '#3a6fd8', 17);
    c.beginPath(); RR(c, -2, -20, 7, 22, 3.5); RR(c, -8, -2, 24, 20, 8); inked(c, '#e8b48a', 1.6);
    c.beginPath(); c.moveTo(4, 2); c.lineTo(4, 10); c.moveTo(9, 3); c.lineTo(9, 10); strokeP(c, 'rgba(90,50,40,0.45)', 1.4);
    c.restore();
    if (press > 0.5) { c.beginPath(); burstShape(c, 270, 150, 16, 8, 0.55, t); fillP(c, 'rgba(255,240,150,0.85)'); }
    confettiRain(c, L, t, 46, 46, 3);
  };

  // Ombros de terno (com camisa, gravata e broche de spec) cortados embaixo por fiapos de nuvem:
  // um busto para pôr sob a cabeça de person(..., { bust: true }) nas ilustrações.
  function bustFromCloud(c, x, y, size, spec, cloud) {
    const s = size / 100;
    setScale(size, false);
    c.save();
    c.translate(x, y); c.scale(s, s);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.save();
    c.beginPath(); c.rect(-32, 0, 64, 36); c.clip();
    drawBody(c, spec, 'suit', 0, spec.skin || '#e8b48a');
    c.restore();
    c.beginPath(); for (let i = 0; i < 4; i++) O(c, -19.5 + i * 13, 37 + (i % 2) * 2, 8);
    strokeP(c, INK, 6); fillP(c, cloud);
    c.restore();
  }

  SC.briga = function (c, L, t) {
    c.fillStyle = '#e63946'; c.fillRect(L.x, L.y, L.w, L.h);
    rays(c, 180, 124, 16, 520, -t * 0.25, '#ff8c1a');
    rays(c, 180, 124, 16, 520, -t * 0.25 + 0.1, 'rgba(255,210,63,0.45)');
    halftoneRect(c, L.x, L.y, L.w, L.h, 'rgba(120,0,20,0.18)', 6);
    const cx = 180, cy = 132;
    const jx = (i) => Math.sin(t * 11 + i * 1.7) * 2.4, jy = (i) => Math.cos(t * 13 + i * 2.3) * 2.4;
    // braços e pernas saindo da nuvem
    const limbs = [
      [-2.6, 112, 'arm', '#2b3445'], [-0.5, 104, 'arm', '#5b2a86'], [0.6, 108, 'leg', '#3a3f4b'], [2.5, 110, 'leg', '#2b3445'],
      [-1.6, 116, 'arm', '#7a1f2b'], [1.5, 116, 'arm', '#2b3445'], [3.4, 104, 'leg', '#5b2a86'],
    ];
    for (let i = 0; i < limbs.length; i++) {
      const [a0, len, kind, col] = limbs[i];
      const a = a0 + Math.sin(t * 7 + i * 2) * 0.12;
      const x1 = cx + Math.cos(a) * len * 1.05, y1 = cy + Math.sin(a) * len * 0.62;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 25); c.lineTo(x1, y1);
      strokeP(c, INK, kind === 'leg' ? 17 : 15); strokeP(c, col, kind === 'leg' ? 12 : 10);
      if (kind === 'arm') { c.beginPath(); O(c, x1, y1, 9); inked(c, i % 2 ? '#e8b48a' : '#c98f62', 2.2); }
      else { c.save(); c.translate(x1, y1); c.rotate(a); c.beginPath(); E(c, 3, 0, 10, 6.5); inked(c, '#1d1410', 2.2); c.restore(); }
    }
    // nuvem da briga
    const puffs = [[0, 0, 44], [-46, 6, 34], [46, 4, 36], [-24, -26, 32], [26, -28, 34], [-62, -14, 22], [64, -12, 24], [-30, 30, 28], [30, 30, 30], [0, 34, 26], [0, -36, 26]];
    c.beginPath(); for (let i = 0; i < puffs.length; i++) O(c, cx + puffs[i][0] + jx(i), cy + puffs[i][1] + jy(i), puffs[i][2]);
    strokeP(c, INK, 7); fillP(c, '#f4f1e8');
    c.beginPath(); for (let i = 0; i < puffs.length; i++) O(c, cx + puffs[i][0] + jx(i) + 6, cy + puffs[i][1] + jy(i) + 7, puffs[i][2] * 0.72); fillP(c, 'rgba(154,165,184,0.45)');
    c.beginPath(); for (let i = 0; i < puffs.length; i += 2) O(c, cx + puffs[i][0] + jx(i) - puffs[i][2] * 0.35, cy + puffs[i][1] + jy(i) - puffs[i][2] * 0.35, puffs[i][2] * 0.22); fillP(c, '#ffffff');
    // cabeças brigando (a da esquerda: um deputado qualquer da base, de terno, gravata vermelha e
    // broche de estrela; o busto sai da nuvem)
    const pop = (i) => Math.max(0, Math.sin(t * 2.2 + i * 2.1)) * 6;
    const dpx = 118 + jx(1), dpy = 96 - pop(0);
    bustFromCloud(c, dpx, dpy, 74, { suit: '#2b3445', shirt: '#f2f2f2', tie: '#e63946', pin: '#e63946', pinShape: 'star' }, '#f4f1e8');
    person(c, dpx, dpy, 74, { skin: '#e0a882', hair: 'slick', hairColor: '#2a2a2a', body: 'none', seed: 1 }, { t, mood: 'angry', mouth: 0.6 + Math.sin(t * 14) * 0.3, bust: true, lookX: 1 });
    person(c, 246 + jx(2), 94 - pop(1), 70, { skin: '#f0c49c', hair: 'bald', hairColor: '#7a6a5a', mustache: true, glasses: 'square', body: 'none', seed: 2 }, { t, mood: 'hurt', bust: true, lookX: -1 });
    person(c, 182 + jx(3), 70 - pop(2), 64, { skin: '#b9825a', hair: 'bob', hairColor: '#1d1d1d', body: 'none', seed: 4 }, { t, mood: 'shock', bust: true });
    person(c, 222 + jx(4), 172 - pop(3) * 0.5, 54, { skin: '#e8b48a', hair: 'combover', hairColor: '#5a4632', body: 'none', seed: 7 }, { t, mood: 'laugh', bust: true, lookX: -0.6 });
    // coisas voando
    for (let i = 0; i < 9; i++) {
      const a = (i * TAU) / 9 + t * 0.5, r = 100 + ((t * 40 + i * 37) % 70);
      const x = cx + Math.cos(a) * r * 1.25, y = cy + Math.sin(a) * r * 0.75;
      if (i % 3 === 0) bill(c, x, y, 22, t * 3 + i, Math.cos(t * 4 + i));
      else santinho(c, x, y, 20, t * 2.5 + i, ['#e63946', '#1b3fa0', '#00a651', '#8e5cf7'][i % 4], Math.cos(t * 5 + i));
    }
    c.beginPath(); for (let i = 0; i < 5; i++) { const a = t * 1.5 + i * 1.3; starPath(c, cx + Math.cos(a) * 70, cy - 52 + Math.sin(a * 2) * 10, 6, 2.6, 5); } fillP(c, '#ffd23f');
    comicText(c, 'POW!', 62, 52, 30, -0.22 + Math.sin(t * 6) * 0.05, '#ffd23f', '#e63946');
    comicText(c, 'TOMA!', 300, 50, 24, 0.2 + Math.sin(t * 5) * 0.05, '#ffffff', '#1b3fa0');
    comicText(c, 'CRÁS!', 76, 200, 22, 0.12, '#3ddc84', INK);
  };

  SC.brasilia = function (c, L, t) {
    c.fillStyle = vgrad(c, L.y, 188, [0, '#2a1240', 0.42, '#7d2450', 0.72, '#e2553a', 1, '#ffb347']);
    c.fillRect(L.x, L.y, L.w, 188 - L.y);
    halftoneRect(c, L.x, L.y, L.w, 120 - L.y, 'rgba(255,255,255,0.06)', 6);
    // sol
    c.beginPath(); O(c, 180, 150, 52); fillP(c, 'rgba(255,214,120,0.9)');
    c.fillStyle = 'rgba(226,85,58,0.55)'; for (let i = 0; i < 5; i++) c.fillRect(120, 132 + i * 9, 120, 2 + i * 0.8);
    // fumaça e explosões ao fundo
    smokePuffs(c, 40, 176, t, 10, 9, 'rgba(40,20,48,0.55)', 30, 1);
    smokePuffs(c, 318, 178, t, 10, 10, 'rgba(40,20,48,0.55)', 26, 2);
    smokePuffs(c, 236, 172, t + 3, 8, 7, 'rgba(40,20,48,0.45)', 20, 3);
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.7 + i * 0.27) % 1, ex = 30 + hash(i + Math.floor(t * 0.7 + i * 0.27)) * 300;
      if (ph < 0.35) { const r = 4 + ph * 34; c.beginPath(); burstShape(c, ex, 168, r, 8, 0.5, i); c.globalAlpha = 1 - ph / 0.35; fillP(c, '#ffd23f'); c.globalAlpha = 1; }
    }
    // Congresso
    congresso(c, 180, 186, 1, '#1d1030', '#ffd27a', t);
    // fogo nas bordas
    for (let i = 0; i < 3; i++) {
      const fx = [52, 140, 298][i], fl = 6 + Math.sin(t * 9 + i) * 2;
      c.beginPath(); c.moveTo(fx - 6, 172); c.quadraticCurveTo(fx - 3, 172 - fl * 2, fx, 172 - fl * 2.6); c.quadraticCurveTo(fx + 3, 172 - fl * 2, fx + 6, 172); c.closePath(); fillP(c, '#ff8c1a');
      c.beginPath(); c.moveTo(fx - 3, 172); c.quadraticCurveTo(fx, 172 - fl * 1.6, fx + 3, 172); c.closePath(); fillP(c, '#ffd23f');
    }
    // espelho d'água
    c.fillStyle = vgrad(c, 186, L.y + L.h, [0, '#3a1e4a', 1, '#160a22']); c.fillRect(L.x, 186, L.w, L.y + L.h - 186);
    c.fillStyle = 'rgba(255,190,110,0.45)';
    for (let i = 0; i < 8; i++) { const w = 70 - i * 7 + Math.sin(t * 3 + i) * 6; c.fillRect(180 - w / 2, 190 + i * 6, w, 2); }
    c.fillStyle = 'rgba(29,16,48,0.85)'; c.fillRect(158, 190, 46, 30);
    c.beginPath(); c.moveTo(L.x, 186); c.lineTo(L.x + L.w, 186); strokeP(c, INK, 2.5);
    // aviõezinhos de santinho e papéis caindo
    for (let i = 0; i < 3; i++) {
      const px = L.x + ((t * (30 + i * 12) + i * 140) % (L.w + 80)) - 40, py = 40 + i * 26 + Math.sin(t * 2 + i) * 6;
      c.save(); c.translate(px, py); c.rotate(0.1);
      c.beginPath(); c.moveTo(12, 0); c.lineTo(-10, -6); c.lineTo(-6, 0); c.lineTo(-10, 6); c.closePath(); inked(c, '#ffffff', 1.2);
      c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, 0); strokeP(c, '#e63946', 1.4);
      c.restore();
    }
    for (let i = 0; i < 8; i++) {
      const xx = L.x + hash(i + 40) * L.w + Math.sin(t + i) * 10, yy = L.y + ((t * 22 + hash(i + 9) * 200) % 200);
      santinho(c, xx, yy, 11, t * 2 + i, ['#e63946', '#1b3fa0', '#00a651'][i % 3], Math.cos(t * 3 + i));
    }
  };

  SC.ze = function (c, L, t) {
    // noite na cidade com luzes desfocadas
    c.fillStyle = vgrad(c, L.y, L.y + L.h, [0, '#0e1630', 1, '#2a3558']); c.fillRect(L.x, L.y, L.w, L.h);
    for (let i = 0; i < 18; i++) {
      const span = L.w + 60;
      const xx = L.x + ((((hash(i) * span - t * (10 + hash(i + 3) * 14)) % span) + span) % span) - 30;
      const yy = L.y + 6 + hash(i * 2.7) * 110;
      c.globalAlpha = 0.25 + hash(i * 4.1) * 0.25;
      c.beginPath(); O(c, xx, yy, 6 + hash(i * 1.3) * 12); fillP(c, ['#ffd23f', '#ff8c1a', '#4cc9f0', '#ff5d8f'][i % 4]);
    }
    c.globalAlpha = 1;
    // carro de aplicativo (de frente)
    c.beginPath();
    c.moveTo(30, 262); c.lineTo(20, 178); c.quadraticCurveTo(22, 154, 58, 148); c.lineTo(82, 30); c.quadraticCurveTo(180, 16, 278, 30); c.lineTo(302, 148);
    c.quadraticCurveTo(338, 154, 340, 178); c.lineTo(330, 262); c.closePath();
    inked(c, '#c3cad6', 3);
    c.beginPath(); c.moveTo(302, 148); c.quadraticCurveTo(338, 154, 340, 178); c.lineTo(330, 262); c.lineTo(300, 262); c.lineTo(310, 178); c.closePath(); fillP(c, SHADE_RGBA);
    // para-brisa
    const ws = () => { c.beginPath(); c.moveTo(90, 40); c.quadraticCurveTo(180, 30, 270, 40); c.lineTo(290, 150); c.lineTo(70, 150); c.closePath(); };
    ws(); inked(c, '#1b2238', 2.5);
    c.save(); ws(); c.clip();
    // bancos
    c.beginPath(); RR(c, 98, 70, 52, 90, 14); RR(c, 202, 58, 66, 100, 14); fillP(c, '#2c3550');
    // Zé ao volante (lado direito, visto de frente)
    const zs = 118, zx = 234, zy = 114;
    person(c, zx, zy, zs, ZE, { t, mood: 'tired', pose: 'drive', lookX: -0.35, lookY: 0.25, autoLook: false });
    // painel
    c.beginPath(); c.rect(60, 143, 240, 10); fillP(c, '#232a3e');
    // volante e as mãos por cima
    c.beginPath(); c.ellipse(zx, 145, 30, 10, 0, 0, TAU); strokeP(c, INK, 8); strokeP(c, '#3b3f47', 5);
    const zk = zs / 100;
    c.beginPath(); O(c, zx - 15 * zk, zy + 25 * zk, 4.9 * zk + LWpx(zk)); O(c, zx + 15 * zk, zy + 25 * zk, 4.9 * zk + LWpx(zk)); fillP(c, INK);
    c.beginPath(); O(c, zx - 15 * zk, zy + 25 * zk, 4.9 * zk); O(c, zx + 15 * zk, zy + 25 * zk, 4.9 * zk); fillP(c, ZE.skin);
    // boletos no painel do passageiro
    const papers = [['IPVA', -0.25], ['IPTU', 0.12], ['IR', -0.08], ['ICMS', 0.22]];
    c.font = '800 7px ' + FB(); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < papers.length; i++) {
      c.save(); c.translate(98 + i * 12, 138 - (i % 2) * 6); c.rotate(papers[i][1]);
      c.beginPath(); c.rect(-11, -7, 22, 14); fillP(c, '#fffdf2'); strokeP(c, INK, 1);
      c.fillStyle = '#d62839'; c.fillText(papers[i][0], 0, 0.5); c.restore();
    }
    // cafezinho no painel
    c.beginPath(); c.moveTo(146, 132); c.lineTo(156, 132); c.lineTo(154.5, 143); c.lineTo(147.5, 143); c.closePath(); inked(c, '#ffffff', 1);
    c.beginPath(); c.moveTo(148, 128); c.quadraticCurveTo(146 + Math.sin(t * 5) * 2, 122, 150, 116); c.moveTo(153, 128); c.quadraticCurveTo(155 - Math.sin(t * 5) * 2, 122, 152, 115);
    strokeP(c, 'rgba(255,255,255,0.6)', 1.4);
    c.restore();
    // reflexo no vidro
    c.beginPath(); c.moveTo(112, 40); c.lineTo(132, 38); c.lineTo(100, 150); c.lineTo(80, 150); c.closePath(); fillP(c, 'rgba(255,255,255,0.07)');
    // retrovisor + nota fiscal pendurada
    c.beginPath(); RR(c, 132, 40, 40, 11, 5); inked(c, '#2b2e35', 2);
    c.save(); c.translate(152, 51); c.rotate(Math.sin(t * 2.4) * 0.2);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 5); strokeP(c, INK, 1);
    c.beginPath(); c.rect(-6, 5, 12, 32); fillP(c, '#fffdf2'); strokeP(c, INK, 1);
    c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(-4, 11 + i * 4); c.lineTo(i % 3 ? 4 : 1, 11 + i * 4); } strokeP(c, 'rgba(16,20,24,0.5)', 0.8);
    c.restore();
    // celular no suporte com o app
    c.beginPath(); c.moveTo(184, 150); c.lineTo(184, 132); strokeP(c, INK, 3);
    c.beginPath(); RR(c, 164, 94, 40, 40, 5); inked(c, '#111318', 2);
    c.beginPath(); RR(c, 167, 97, 34, 34, 3); fillP(c, '#f4f6fb');
    c.fillStyle = '#1b3fa0'; c.font = '800 5.4px ' + FB(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('CORRIDA', 184, 102);
    c.fillStyle = INK; c.font = '900 8px ' + FB(); c.fillText('R$ 9,90', 184, 110);
    c.fillStyle = '#d62839'; c.font = '800 5.4px ' + FB(); c.fillText('TAXAS', 184, 119); c.font = '900 7px ' + FB(); c.fillText('-R$ 7,40', 184, 126);
    // limpadores estacionados
    c.beginPath(); c.moveTo(100, 153); c.lineTo(168, 146); c.moveTo(196, 153); c.lineTo(266, 146); strokeP(c, INK, 4); strokeP(c, '#3b3f47', 2);
    // capô, faróis, grade, placa
    c.beginPath(); c.moveTo(58, 150); c.lineTo(302, 150); strokeP(c, INK, 3);
    c.beginPath(); c.moveTo(88, 164); c.quadraticCurveTo(180, 175, 272, 164); strokeP(c, 'rgba(16,20,24,0.25)', 2);
    for (let i = 0; i < 2; i++) {
      const hx = i ? 298 : 62;
      glow(c, hx, 184, 28, '#fff2b0', 0.5);
      c.beginPath(); E(c, hx, 184, 24, 11, i ? 0.12 : -0.12); inked(c, '#fff6d8', 2);
      c.beginPath(); E(c, hx + (i ? 6 : -6), 184, 8, 6); fillP(c, '#ffe9a0');
    }
    c.beginPath(); RR(c, 120, 192, 120, 24, 8); inked(c, '#20242c', 2.4);
    c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(128, 198 + i * 4.6); c.lineTo(232, 198 + i * 4.6); } strokeP(c, '#3b3f47', 1.4);
    c.beginPath(); RR(c, 148, 219, 64, 19, 2); inked(c, '#ffffff', 1.6);
    c.fillStyle = '#1b3fa0'; c.fillRect(148, 219, 64, 5);
    c.fillStyle = INK; c.font = '900 11px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('IMP0S70', 180, 231.5, 58);
    c.fillStyle = '#ffffff'; c.font = '800 3.6px ' + FB(); c.fillText('BRASIL', 180, 221.6);
    // notinhas fiscais voando no vento
    for (let i = 0; i < 5; i++) {
      const xx = L.x + L.w - ((t * (40 + i * 9) + i * 90) % (L.w + 60)) + 30, yy = 24 + i * 40 + Math.sin(t * 3 + i) * 10;
      c.save(); c.translate(xx, yy); c.rotate(Math.sin(t * 4 + i) * 0.5); c.scale(1, 0.7 + Math.abs(Math.sin(t * 3 + i)) * 0.3);
      c.beginPath(); c.rect(-5, -12, 10, 24); fillP(c, '#fffdf2'); strokeP(c, INK, 1);
      c.beginPath(); for (let k = 0; k < 5; k++) { c.moveTo(-3, -8 + k * 4); c.lineTo(3, -8 + k * 4); } strokeP(c, 'rgba(16,20,24,0.4)', 0.8);
      c.restore();
    }
  };

  SC.fusca = function (c, L, t) {
    // oficina da Vó
    c.fillStyle = '#3c4658'; c.fillRect(L.x, L.y, L.w, L.h);
    c.fillStyle = '#465166'; for (let yy = L.y + ((L.y % 16) + 16) % 16; yy < 180; yy += 16) for (let xx = L.x - 20; xx < L.x + L.w; xx += 32) c.fillRect(xx + ((yy / 16) % 2) * 16, yy, 30, 14);
    halftoneRect(c, L.x, L.y, L.w, 180 - L.y, 'rgba(0,0,0,0.12)', 6);
    // painel de ferramentas
    c.beginPath(); RR(c, 18, 40, 100, 70, 4); inked(c, '#c9a36a', 2.2);
    c.fillStyle = 'rgba(80,50,20,0.35)'; for (let yy = 46; yy < 108; yy += 8) for (let xx = 24; xx < 116; xx += 8) c.fillRect(xx, yy, 1.6, 1.6);
    c.beginPath(); c.moveTo(34, 52); c.lineTo(34, 96); c.moveTo(56, 50); c.lineTo(56, 92); c.moveTo(78, 56); c.lineTo(100, 94); strokeP(c, INK, 6);
    c.beginPath(); c.moveTo(34, 52); c.lineTo(34, 96); c.moveTo(56, 50); c.lineTo(56, 92); c.moveTo(78, 56); c.lineTo(100, 94); strokeP(c, '#9aa5b8', 3.5);
    c.beginPath(); RR(c, 50, 46, 12, 8, 2); fillP(c, '#e63946');
    // placa
    c.save(); c.translate(250, 46); c.rotate(0.04);
    c.beginPath(); RR(c, -62, -15, 124, 30, 4); inked(c, '#ffd23f', 2.2);
    c.fillStyle = '#7a1f2b'; c.font = '15px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('OFICINA DA VÓ', 0, 1.5, 114);
    c.restore();
    // prateleira com novelos
    c.beginPath(); c.rect(176, 92, 72, 4); fillP(c, '#6a4024');
    c.beginPath(); O(c, 188, 84, 8); inked(c, '#ff5d8f', 1.6);
    c.beginPath(); O(c, 206, 84, 8); inked(c, '#3ddc84', 1.6);
    c.beginPath(); O(c, 224, 84, 8); inked(c, '#4cc9f0', 1.6);
    c.beginPath(); c.rect(234, 74, 10, 18); inked(c, '#e63946', 1.4);
    // chão
    c.fillStyle = '#596274'; c.fillRect(L.x, 180, L.w, L.y + L.h - 180);
    c.beginPath(); c.moveTo(L.x, 180); c.lineTo(L.x + L.w, 180); strokeP(c, INK, 2.5);
    // lâmpada balançando + luz
    const sw = Math.sin(t * 1.4) * 0.22;
    const bx = 170 + Math.sin(sw) * 50, by = L.y + Math.cos(sw) * (50 - L.y);
    c.beginPath(); c.moveTo(170, L.y); c.lineTo(bx, by - 6); strokeP(c, INK, 1.4);
    glow(c, bx, by, 150, '#ffe9a0', 0.32);
    c.beginPath(); O(c, bx, by, 6); inked(c, '#fff6c8', 1.4);
    // Fusca com a turbina
    c.beginPath(); E(c, 168, 198, 104, 7); fillP(c, 'rgba(0,0,0,0.35)');
    fuscaSide(c, 160, 196, 196, { t, cozy: true, flame: 0.35 + Math.abs(Math.sin(t * 2)) * 0.15 });
    // Vó Dirce com a chave inglesa
    const vo = { skin: '#f0c8a0', hair: 'curly', hairColor: '#f4f4f4', glasses: 'round', body: 'cardigan', suit: '#ff8fc0', shirt: '#fff4f8', pants: '#8d6bb0', wrinkles: true, cheeks: true, seed: 5 };
    const vx = 316, vy = 152, vs = 96;
    person(c, vx, vy, vs, vo, { t, mood: 'laugh', pose: 'wave', facing: -1 });
    const an = personAnchors(vs, { pose: 'wave', t, facing: -1, seed: 5 });
    c.save(); c.translate(vx + an.handR.x, vy + an.handR.y); c.rotate(-0.6 + Math.sin(t * 12) * 0.15);
    c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -22); strokeP(c, INK, 7); strokeP(c, '#c9d3e6', 4);
    c.beginPath(); c.arc(0, -25, 6, 0.4 * PI, 2.6 * PI); strokeP(c, INK, 7); strokeP(c, '#c9d3e6', 4);
    c.restore();
    // crochê: novelo e agulhas
    c.beginPath(); O(c, 282, 206, 9); inked(c, '#ff5d8f', 1.8);
    c.beginPath(); c.arc(282, 206, 5, 0.3, 2.6); c.moveTo(276, 202); c.lineTo(288, 210); strokeP(c, 'rgba(120,0,40,0.5)', 1.2);
    c.beginPath(); c.moveTo(290, 196); c.lineTo(304, 216); c.moveTo(296, 194); c.lineTo(300, 216); strokeP(c, '#c9d3e6', 2);
    c.beginPath(); c.moveTo(273, 210); c.quadraticCurveTo(262, 222, 246, 214); strokeP(c, '#ff5d8f', 1.6);
  };

  SC.planalto = function (c, L, t) {
    // a mesma cena abre a história (ameaça) e o final: no final (G.state 'ending') o chefão
    // aparece derrotado — sem o brilho vermelho, olhos fechados, afundado atrás do palácio e
    // um carimbo de PAGO na fachada
    const won = G.state === 'ending';
    c.fillStyle = vgrad(c, L.y, 178, [0, '#060a1c', 0.6, '#1c1440', 1, '#4a1630']); c.fillRect(L.x, L.y, L.w, 178 - L.y);
    stars(c, L, t, 40, 120, 11);
    // lua
    c.beginPath(); O(c, 52, 40, 16); fillP(c, '#f4f1e8');
    c.beginPath(); O(c, 59, 36, 14); fillP(c, '#0b1026');
    // brilho vermelho ameaçador
    if (!won) glow(c, 180, 120, 180, '#e63946', 0.5);
    // silhueta barbuda gigante atrás do palácio
    const br = Math.sin(t * 1.6) * 1.5;
    c.save(); c.translate(180, won ? 104 + br * 0.5 : 96 + br);
    const sil = () => {
      c.beginPath();
      c.moveTo(-110, 80); c.quadraticCurveTo(-100, 34, -52, 26); c.lineTo(52, 26); c.quadraticCurveTo(100, 34, 110, 80); c.closePath();
      E(c, 0, -14, 44, 46);
      c.moveTo(-43, -8); c.bezierCurveTo(-48, 40, -22, 60, 0, 60); c.bezierCurveTo(22, 60, 48, 40, 43, -8); c.closePath();
      // cabelo grisalho nas laterais (ferradura)
      for (let i = 0; i < 2; i++) { const sd = i ? 1 : -1; c.moveTo(sd * 44, 4); c.bezierCurveTo(sd * 54, -14, sd * 52, -36, sd * 32, -48); c.quadraticCurveTo(sd * 40, -30, sd * 38, -12); c.closePath(); }
    };
    // luz de contorno vermelha (silhueta deslocada) + silhueta escura por cima
    c.save(); c.translate(-2.5, -2.5); sil(); fillP(c, won ? 'rgba(150,160,195,0.4)' : 'rgba(255,90,90,0.75)'); c.restore();
    c.save(); c.translate(2.5, -1.5); sil(); fillP(c, won ? 'rgba(120,130,165,0.2)' : 'rgba(255,170,90,0.35)'); c.restore();
    sil(); fillP(c, '#120914');
    // textura da barba
    c.beginPath();
    for (let i = 0; i < 5; i++) { const bx = -24 + i * 12; c.moveTo(bx - 4, 32 + Math.abs(i - 2) * -3); c.quadraticCurveTo(bx, 40 + Math.abs(i - 2) * -3, bx + 4, 32 + Math.abs(i - 2) * -3); }
    c.moveTo(-36, 4); c.quadraticCurveTo(-30, 12, -22, 10); c.moveTo(36, 4); c.quadraticCurveTo(30, 12, 22, 10);
    strokeP(c, won ? 'rgba(150,160,195,0.25)' : 'rgba(255,90,90,0.35)', 2);
    if (won) {
      // derrotado: olhos fechados (pálpebras caídas), boquinha murcha e a mão com o espeto abaixada
      c.beginPath();
      c.moveTo(-26, -16); c.quadraticCurveTo(-17, -22, -8, -16);
      c.moveTo(26, -16); c.quadraticCurveTo(17, -22, 8, -16);
      c.moveTo(-10, 20); c.quadraticCurveTo(0, 15, 10, 20);
      strokeP(c, '#9a8ea8', 2.4);
    } else {
      // olhos e sorrisinho
      c.beginPath(); c.moveTo(-26, -24); c.lineTo(-8, -18); c.lineTo(-10, -14); c.lineTo(-25, -17); c.closePath();
      c.moveTo(26, -24); c.lineTo(8, -18); c.lineTo(10, -14); c.lineTo(25, -17); c.closePath();
      fillP(c, '#ffd23f');
      c.beginPath(); c.moveTo(-16, 16); c.quadraticCurveTo(0, 28, 16, 16); c.quadraticCurveTo(0, 22, -16, 16); c.closePath(); fillP(c, '#f4f1e8');
      // mão erguida com o espeto de picanha
      c.beginPath(); c.moveTo(78, 40); c.lineTo(96, -12); strokeP(c, '#120914', 20);
      c.beginPath(); O(c, 97, -16, 12); fillP(c, '#120914');
      c.beginPath(); c.moveTo(97, -16); c.lineTo(112, -76); strokeP(c, '#8a96a8', 2.5);
      for (let i = 0; i < 3; i++) { c.beginPath(); E(c, 103 + i * 2.6, -36 - i * 12, 9, 6.5, -0.25); inked(c, i === 1 ? '#c0283a' : '#9b2335', 1.6); c.beginPath(); E(c, 101 + i * 2.6, -38 - i * 12, 7, 2, -0.25); fillP(c, '#f4e1c8'); }
    }
    c.restore();
    // holofotes
    for (let i = 0; i < 2; i++) {
      const a = -PI / 2 + Math.sin(t * 0.7 + i * 2) * 0.5 + (i ? 0.3 : -0.3);
      const x0 = i ? 300 : 60;
      c.beginPath(); c.moveTo(x0, 140); c.lineTo(x0 + Math.cos(a - 0.06) * 300, 140 + Math.sin(a - 0.06) * 300); c.lineTo(x0 + Math.cos(a + 0.06) * 300, 140 + Math.sin(a + 0.06) * 300); c.closePath();
      fillP(c, 'rgba(255,240,200,0.08)');
    }
    // Palácio do Planalto
    c.fillStyle = '#0d0f1a'; c.fillRect(L.x, 176, L.w, L.y + L.h - 176);
    c.beginPath(); c.rect(12, 128, 336, 26); fillP(c, '#2a2238');
    c.fillStyle = '#ffcf6b';
    for (let i = 0; i < 26; i++) { if (hash(i * 3.3) > 0.3) { c.globalAlpha = hash(i) > 0.8 ? 0.6 + 0.4 * Math.sin(t * 4 + i) : 0.9; c.fillRect(16 + i * 12.8, 132, 9.6, 18); } }
    c.globalAlpha = 1;
    if (!won) { c.fillStyle = '#e63946'; c.globalAlpha = 0.55; c.fillRect(146, 132, 68, 18); c.globalAlpha = 1; }
    c.beginPath(); c.rect(6, 120, 348, 9); inked(c, '#e9edf3', 1.6);
    c.beginPath(); c.rect(24, 154, 312, 22); fillP(c, '#1a1626');
    // colunas
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const cx = 22 + i * 39.5;
      c.moveTo(cx, 129); c.bezierCurveTo(cx + 10, 140, cx + 9, 166, cx + 1.5, 178); c.lineTo(cx - 1.5, 178); c.bezierCurveTo(cx - 9, 166, cx - 10, 140, cx, 129); c.closePath();
    }
    inked(c, '#e9edf3', 1.4);
    // rampa
    c.beginPath(); c.moveTo(96, 200); c.lineTo(160, 156); c.lineTo(176, 156); c.lineTo(116, 200); c.closePath(); inked(c, '#cfd6e2', 1.4);
    // churrasqueira e fumaça
    c.beginPath(); RR(c, 268, 186, 40, 12, 2); inked(c, '#3b3f47', 1.6);
    c.beginPath(); c.moveTo(272, 198); c.lineTo(268, 214); c.moveTo(304, 198); c.lineTo(308, 214); strokeP(c, INK, 2.4);
    for (let i = 0; i < 6; i++) { c.beginPath(); O(c, 274 + i * 6, 186, 1.6 + Math.abs(Math.sin(t * 7 + i)) * 1.2); fillP(c, i % 2 ? '#ff8c1a' : '#ffd23f'); }
    smokePuffs(c, 288, 182, t, 9, 7, 'rgba(200,190,210,0.28)', -60, 6);
    c.beginPath(); c.moveTo(L.x, 176); c.lineTo(L.x + L.w, 176); strokeP(c, 'rgba(255,255,255,0.12)', 1);
    if (won) { // carimbo "PAGO" na fachada (a fatura foi entregue)
      c.save(); c.translate(180, 142); c.rotate(-0.14);
      c.beginPath(); RR(c, -33, -12.5, 66, 25, 3); fillP(c, 'rgba(255,246,236,0.16)'); strokeP(c, INK, 4.6); strokeP(c, '#ff4d5e', 2.6);
      c.beginPath(); RR(c, -29, -8.6, 58, 17.2, 2); strokeP(c, 'rgba(255,77,94,0.85)', 1);
      c.font = '900 15px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3.2; c.strokeStyle = INK; c.lineJoin = 'round'; c.strokeText('PAGO', 0, 1);
      c.fillStyle = '#ff4d5e'; c.fillText('PAGO', 0, 1);
      c.restore();
    }
  };

  function sceneFallback(c, L, t, id) {
    c.fillStyle = '#1b3fa0'; c.fillRect(L.x, L.y, L.w, L.h);
    rays(c, 180, 120, 16, 420, t * 0.2, 'rgba(255,210,63,0.15)');
    comicText(c, String(id || '').toUpperCase(), 180, 120, 26, 0, '#ffd23f', INK);
  }

  function scene(ctx, id, w, h, t) {
    if (!(w > 0) || !(h > 0)) return;
    t = t || 0;
    const k = Math.min(w / 360, h / 240);
    const L = { x: 180 - w / (2 * k), y: 120 - h / (2 * k), w: w / k, h: h / k };
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
      ctx.translate(w / 2, h / 2); ctx.scale(k, k); ctx.translate(-180, -120);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const fn = SC[id];
      if (fn) fn(ctx, L, t); else sceneFallback(ctx, L, t, id);
      // vinheta de gibi
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,20,24,0.5)'; ctx.strokeRect(L.x + 1.5, L.y + 1.5, L.w - 3, L.h - 3);
    } catch (err) { G.reportError(err, 'art.scene ' + id); }
    ctx.restore();
  }

  // ======================================================================
  // Arte do título: o Fusca subindo sobre Brasília (topo livre para o logo)
  // ======================================================================
  // Camadas paradas do título (céu em gradiente; Congresso + chão) pintadas uma vez por
  // tamanho/densidade de tela e coladas 1:1. Repintar o gradiente da tela inteira e a
  // silhueta a cada quadro era a maior parte do custo do título (sem GPU).
  const TL = { key: '', sky: null, city: null, cityY: 0 };
  function titleLayer(w, h, pr, paint) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * pr)); cv.height = Math.max(1, Math.round(h * pr));
    const x = cv.getContext('2d');
    x.scale(pr, pr); x.lineJoin = 'round'; x.lineCap = 'round';
    try { paint(x); } catch (err) { G.reportError(err, 'art.titleLayer'); }
    return bake(cv);
  }
  function titleLayers(ctx, w, h, K) {
    let pr = 1;
    try { const m = ctx.getTransform(); pr = Math.hypot(m.a, m.b) || 1; } catch (e) { /* navegador antigo */ }
    const key = w + 'x' + h + '@' + pr.toFixed(3) + '@' + K.toFixed(4);
    if (TL.key === key) return TL;
    for (const cv of [TL.sky, TL.city]) if (cv) { cv.width = 1; cv.height = 1; }
    TL.key = key; TL.pr = pr;
    TL.sky = titleLayer(w, h, pr, (x) => {
      x.fillStyle = vgrad(x, 0, h, [0, '#0b1022', 0.4, '#24124a', 0.7, '#8e2450', 0.88, '#e2553a', 1, '#ffb347']);
      x.fillRect(0, 0, w, h);
    });
    // faixa de baixo com o Congresso (presa ao pixel do aparelho)
    const y0 = Math.max(0, Math.floor((h * 0.985 - 134 * K) * pr) / pr);
    TL.cityY = y0;
    TL.city = titleLayer(w, h - y0, pr, (x) => {
      x.translate(0, -y0);
      congresso(x, w * 0.5, h * 0.985, K, '#150a24', '#ffd27a', 0, 1);
      x.fillStyle = '#150a24'; x.fillRect(0, h * 0.985, w, h * 0.02);
    });
    return TL;
  }
  function titleArt(ctx, w, h, t) {
    if (!(w > 0) || !(h > 0)) return;
    t = t || 0;
    const c = ctx;
    c.save();
    try {
      c.beginPath(); c.rect(0, 0, w, h); c.clip();
      c.lineJoin = 'round'; c.lineCap = 'round';
      const u = Math.min(w / 360, h / 560);
      const K = 1.12 * Math.min(Math.max(u, w / 380), h / 480);
      const TLs = titleLayers(c, w, h, K);
      c.drawImage(TLs.sky, 0, 0, TLs.sky.width / TLs.pr, TLs.sky.height / TLs.pr);
      const L = { x: 0, y: 0, w, h };
      stars(c, L, t, 70, h * 0.5, 21);
      const cx = w * 0.5, cy = h * 0.6 + Math.sin(t * 2.2) * 6 * u;
      // raios saindo do Fusca
      c.save(); c.globalAlpha = 0.5; rays(c, cx, cy, 22, Math.max(w, h) * 1.2, t * 0.1, 'rgba(255,210,63,0.12)'); c.restore();
      // cidade
      smokePuffs(c, w * 0.12, h * 0.93, t, 10, 12 * u, 'rgba(30,14,40,0.5)', 30 * u, 1);
      smokePuffs(c, w * 0.9, h * 0.94, t + 2, 10, 13 * u, 'rgba(30,14,40,0.5)', -24 * u, 2);
      c.drawImage(TLs.city, 0, TLs.cityY, TLs.city.width / TLs.pr, TLs.city.height / TLs.pr);
      congresso(c, w * 0.5, h * 0.985, K, '#150a24', '#ffd27a', t, 2); // janelas que piscam
      // santinhos e notas voando para fora
      for (let i = 0; i < 34; i++) {
        const ph = (t * 0.22 + hash(i + 3)) % 1;
        const a = hash(i * 1.7) * TAU;
        const r = (30 + ph * Math.max(w, h) * 0.75) * u * 1.2;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85;
        c.globalAlpha = Math.min(1, ph * 4) * (1 - ph * 0.3);
        const sz = (12 + ph * 20) * u;
        if (i % 4 === 0) bill(c, x, y, sz * 1.3, t * 2 + i, Math.cos(t * 4 + i));
        else santinho(c, x, y, sz, t * 2 + i, ['#e63946', '#1b3fa0', '#00a651', '#8e5cf7'][i % 4], Math.cos(t * 5 + i));
      }
      c.globalAlpha = 1;
      // políticos sendo arremessados pela explosão de santinhos
      const POL = [
        { suit: '#5b2a86', tie: '#ffd23f', hair: 'combover', hairColor: '#7a6a5a', mustache: true, seed: 3 },
        { suit: '#2b3445', tie: '#e63946', hair: 'slick', hairColor: '#1d1d1d', glasses: 'dark', seed: 8 },
      ];
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.2 + k * 0.5) % 1;
        const dx = k ? 1 : -1, dy = k ? 0.05 : -0.3;
        const r = (40 + ph * 230) * u;
        c.save(); c.globalAlpha = Math.min(1, ph * 5) * (1 - ph);
        c.translate(cx + dx * r, cy + dy * r - Math.sin(ph * PI) * 40 * u); c.rotate(dx * ph * 7);
        person(c, 0, 0, 46 * u, POL[k], { t: t + k, mood: k ? 'shock' : 'hurt', pose: 'up', autoLook: false, cacheRes: TLs.pr });
        c.restore();
      }
      // o Fusca (girado em torno do meio da carroceria)
      const len = Math.min(220 * u, w * 0.64), rot = -1.0, fo = { t, flame: 2.6, lw: 3 * u };
      const fs = len / 100, fx = len * 0.1, fy = len * 0.3;
      c.save(); c.translate(cx, cy); c.rotate(rot); c.translate(fx, fy); c.scale(fs, fs); fuscaFlame(c, t, fo); c.restore();
      const spr = fuscaTitleSprite(len, rot, fx, fy, fo, TLs.pr), pr = TLs.pr;
      c.drawImage(spr.c, Math.round((cx + spr.ox) * pr) / pr, Math.round((cy + spr.oy) * pr) / pr, spr.c.width / pr, spr.c.height / pr);
      c.save(); c.translate(cx, cy); c.rotate(rot); c.translate(fx, fy); c.scale(fs, fs); c.lineJoin = 'round'; c.lineCap = 'round'; fuscaFan(c, t, -0.16); c.restore();
    } catch (err) { G.reportError(err, 'art.titleArt'); }
    c.restore();
  }

  // ======================================================================
  // Retratos (diálogos): Zé, Vó Dirce, Rádio Planalto
  // ======================================================================
  function boxClip(c, x, y, size) { c.beginPath(); c.rect(x - size / 2, y - size / 2, size, size); c.clip(); }

  G.Portraits.define('ze', function (ctx, x, y, size, o) {
    o = o || {};
    const mood = o.mood || 'normal';
    ctx.save();
    boxClip(ctx, x, y, size);
    const sp = size * 1.22;
    person(ctx, x, y + size * 0.13, sp, ZE, { t: o.t, mood, mouth: o.mouth, pose: mood === 'angry' ? 'fist' : mood === 'laugh' ? 'up' : 'idle', lookX: o.lookX != null ? o.lookX : 0.25, lookY: 0.1, autoLook: false });
    ctx.restore();
  });

  G.Portraits.define('vo', function (ctx, x, y, size, o) {
    o = o || {};
    const mood = o.mood || 'normal';
    const t = o.t || 0;
    ctx.save();
    boxClip(ctx, x, y, size);
    const sp = size * 1.15, py = y + size * 0.15;
    person(ctx, x, py, sp, VO, { t, mood, mouth: o.mouth, pose: 'knit', lookX: o.lookX != null ? o.lookX : -0.25, lookY: 0.1, autoLook: false });
    const s = sp / 100;
    const bob = mood === 'laugh' ? -Math.abs(Math.sin(t * 12 + 5)) * 2.4 : Math.sin(t * 6 + 5) * 1.2;
    const hx = x + (mood === 'hurt' ? Math.sin(t * 50) * 0.9 * s : 0), hy = py + (-14 + bob) * s, R = 27 * s;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // crochê nas mãos: pecinha listrada + agulhas (mãos redesenhadas por cima)
    const cy0 = py + 13 * s;
    ctx.beginPath(); ctx.moveTo(x - 3 * s, cy0 + 3 * s); ctx.lineTo(x - 15 * s, cy0 - 5 * s); ctx.moveTo(x + 3 * s, cy0 + 3 * s); ctx.lineTo(x + 15 * s, cy0 - 5 * s);
    strokeP(ctx, INK, 3.2 * s); strokeP(ctx, '#dfe6ee', 1.6 * s);
    ctx.beginPath(); RR(ctx, x - 9 * s, cy0, 18 * s, 11 * s, 2 * s); inked(ctx, '#ffd23f', 1.1 * s);
    ctx.beginPath(); ctx.rect(x - 9 * s, cy0 + 4.2 * s, 18 * s, 2.6 * s); fillP(ctx, '#ff5d8f');
    ctx.beginPath(); for (let i = 0; i < 5; i++) { const xx = x - 7 * s + i * 3.5 * s; ctx.moveTo(xx - 1.1 * s, cy0 + 1.3 * s); ctx.lineTo(xx, cy0 + 2.8 * s); ctx.lineTo(xx + 1.1 * s, cy0 + 1.3 * s); ctx.moveTo(xx - 1.1 * s, cy0 + 7.6 * s); ctx.lineTo(xx, cy0 + 9.1 * s); ctx.lineTo(xx + 1.1 * s, cy0 + 7.6 * s); }
    strokeP(ctx, 'rgba(16,20,24,0.45)', 0.7 * s);
    ctx.beginPath(); O(ctx, x - 12 * s, py + 20 * s, 4.9 * s + LWpx(s)); O(ctx, x + 12 * s, py + 20 * s, 4.9 * s + LWpx(s)); fillP(ctx, INK);
    ctx.beginPath(); O(ctx, x - 12 * s, py + 20 * s, 4.9 * s); O(ctx, x + 12 * s, py + 20 * s, 4.9 * s); fillP(ctx, VO.skin);
    // fone de rádio (headset) por cima dos cachinhos
    ctx.beginPath(); ctx.arc(hx, hy + R * 0.1, R * 1.24, PI * 1.1, PI * 1.9);
    strokeP(ctx, INK, R * 0.2); strokeP(ctx, '#5b6375', R * 0.11);
    ctx.beginPath(); RR(ctx, hx - R * 1.38, hy - R * 0.28, R * 0.34, R * 0.58, R * 0.14); RR(ctx, hx + R * 1.04, hy - R * 0.28, R * 0.34, R * 0.58, R * 0.14); inked(ctx, '#3b3f47', R * 0.05);
    ctx.beginPath(); ctx.moveTo(hx - R * 1.2, hy + R * 0.25); ctx.quadraticCurveTo(hx - R * 1.02, hy + R * 0.95, hx - R * 0.42, hy + R * 0.8);
    strokeP(ctx, INK, R * 0.12); strokeP(ctx, '#5b6375', R * 0.06);
    ctx.beginPath(); E(ctx, hx - R * 0.36, hy + R * 0.79, R * 0.12, R * 0.09); inked(ctx, '#e63946', R * 0.04);
    ctx.restore();
  });

  G.Portraits.define('radio', function (ctx, x, y, size, o) {
    o = o || {};
    const c = ctx;
    const t = o.t || 0, mood = o.mood || 'normal';
    const m = clamp(o.mouth || 0, 0, 1);
    const k = size / 92;
    c.save();
    boxClip(c, x, y, size);
    c.translate(x, y);
    let jx = 0, jy = 0, rot = 0;
    if (mood === 'angry') { jx = Math.sin(t * 45) * 1.6; }
    else if (mood === 'laugh') { jy = -Math.abs(Math.sin(t * 10)) * 4; rot = Math.sin(t * 10) * 0.05; }
    else if (mood === 'hurt') { rot = 0.12; }
    jy += -m * 2.2;
    c.translate(jx * k, jy * k); c.rotate(rot); c.scale(k, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // ondas de som
    if (m > 0.05 || mood === 'laugh') {
      const ph = (t * 3) % 1;
      c.beginPath();
      for (let i = 0; i < 2; i++) { const r = 44 + (i + ph) * 8; c.moveTo(Math.cos(-0.5) * r, 8 + Math.sin(-0.5) * r); c.arc(0, 8, r, -0.5, 0.5); c.moveTo(Math.cos(PI - 0.5) * r, 8 + Math.sin(PI - 0.5) * r); c.arc(0, 8, r, PI - 0.5, PI + 0.5); }
      c.globalAlpha *= 0.4 + m * 0.6; strokeP(c, '#ffd23f', 3.4); c.globalAlpha = 1;
    }
    // antena
    const ant = mood === 'hurt' ? 0.9 : 0.35 + Math.sin(t * 2) * 0.05;
    c.beginPath(); c.moveTo(16, -26); c.lineTo(16 + Math.sin(ant) * 34, -26 - Math.cos(ant) * 34); strokeP(c, INK, 4.4); strokeP(c, '#c9d3e6', 2.2);
    c.beginPath(); O(c, 16 + Math.sin(ant) * 34, -26 - Math.cos(ant) * 34, 3); inked(c, mood === 'angry' ? '#e63946' : '#ffd23f', 1.2);
    // armário de madeira (topo arredondado)
    c.beginPath(); c.moveTo(-40, 34); c.lineTo(-40, -6); c.bezierCurveTo(-40, -34, 40, -34, 40, -6); c.lineTo(40, 34); c.closePath();
    inked(c, '#9a5b2e', 2.4);
    c.beginPath(); c.moveTo(-40, 34); c.lineTo(40, 34); c.lineTo(40, 26); c.lineTo(-40, 26); c.closePath(); fillP(c, SHADE_RGBA);
    c.beginPath(); c.moveTo(-34, -8); c.bezierCurveTo(-33, -27, 0, -29, 14, -27); strokeP(c, 'rgba(255,255,255,0.35)', 2.6);
    // grade do alto-falante (tecido)
    c.beginPath(); c.moveTo(-30, 8); c.lineTo(-30, -6); c.bezierCurveTo(-30, -24, 30, -24, 30, -6); c.lineTo(30, 8); c.closePath();
    inked(c, '#e9d2a6', 1.4);
    c.save(); c.clip();
    c.beginPath(); for (let i = -4; i <= 4; i++) { c.moveTo(i * 6.4, -26); c.lineTo(i * 6.4, 10); } strokeP(c, '#9a5b2e', 2.6 + m * 1.6);
    c.restore();
    // mostrador com ponteiro (sintoniza quando fala)
    c.beginPath(); RR(c, -30, 12, 42, 12, 3); inked(c, '#fff4c2', 1.2);
    c.beginPath(); for (let i = 0; i < 8; i++) { c.moveTo(-26 + i * 5, 14); c.lineTo(-26 + i * 5, i % 2 ? 17 : 19); } strokeP(c, 'rgba(16,20,24,0.55)', 0.8);
    const needle = -24 + (0.5 + 0.5 * Math.sin(t * (m > 0.05 ? 9 : 0.8))) * 32 * (mood === 'hurt' ? 0.4 : 1);
    c.beginPath(); c.moveTo(needle, 13.5); c.lineTo(needle, 22.5); strokeP(c, '#e63946', 1.6);
    // botões
    const knob = (kx, a) => { c.beginPath(); O(c, kx, 18, 6); inked(c, '#3b2414', 1.2); c.beginPath(); c.moveTo(kx, 18); c.lineTo(kx + Math.cos(a) * 5, 18 + Math.sin(a) * 5); strokeP(c, '#f4e1c8', 1.6); };
    knob(22, t * 2 + m * 3); knob(34 - 2, -t * 1.5);
    // olho mágico (luz)
    const lc = mood === 'angry' ? '#ff3b4e' : mood === 'hurt' ? '#9aa5b8' : '#3ddc84';
    glow(c, 0, -16, 10 + m * 6, lc, 0.5 + m * 0.4);
    c.beginPath(); O(c, 0, -16, 3.4); inked(c, lc, 1);
    // pés
    c.beginPath(); RR(c, -36, 34, 12, 5, 2); RR(c, 24, 34, 12, 5, 2); inked(c, '#3b2414', 1.2);
    // plaquinha
    c.fillStyle = '#ffd23f'; c.font = '900 5.6px ' + FD(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('RÁDIO PLANALTO', 0, 30, 70);
    if (mood === 'hurt') {
      c.beginPath(); for (let i = 0; i < 6; i++) { const yy = -18 + i * 6 + ((t * 40) % 6); c.moveTo(-28, yy); c.lineTo(28, yy + Math.sin(t * 30 + i) * 2); } strokeP(c, 'rgba(255,255,255,0.35)', 1);
    }
    c.restore();
  });

  // ======================================================================
  // Exporta (mesmas assinaturas do core + utilitários extras)
  // ======================================================================
  Object.assign(G.Art, {
    __tag: 'art',
    person,
    personAnchors,
    player,
    pickup,
    lifeIcon,
    bombIcon,
    weaponIcon,
    scene,
    titleArt,
    fuscaSide,
    santinho,
    bill,
    glow,
    shade,
    tint,
    mix,
    comicText,
    prewarm,
    fontsReady,
    // depuração: tamanho do cache de sprites dos personagens
    cacheStats() { return { sprites: pcache.size, pixels: pPixels, pending: pseen.size, warmQueue: WARM.q.length, warmQueue2: WARM.q2.length, items: spriteCache.size, specs: specIds.size, exact: EXACT, stale: pStale !== null ? pStale.size : 0, stalePixels: pStalePx, framed: pFramed }; },
    _exact(v) { EXACT = !!v; }, // testes A/B da cópia exata
  });
})();
