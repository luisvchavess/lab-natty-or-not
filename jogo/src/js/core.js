/* ============================================================
   FUSCA A JATO — core.js
   Motor do jogo: loop, entrada (toque/teclado), entidades, tiros,
   colisões, jogador, itens, framework de chefões, roteiro de fases,
   HUD, save e fluxo de telas.
   Os outros módulos (art, bg, audio, enemies, stages, bosses, ui)
   ESTENDEM o que está aqui. Veja docs/ENGINE.md.
   ============================================================ */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const TAU = Math.PI * 2;
  G.TAU = TAU;
  G.W = 360;
  G.H = 640;
  G.DT = 1 / 60;

  G.FONT_DISPLAY = '"Bungee", "Arial Black", Impact, sans-serif';
  G.FONT_BODY = '"Barlow Semi Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';

  // Paleta base do jogo (use nos módulos para manter a identidade)
  G.C = {
    green: '#00a651', greenL: '#3ddc84', yellow: '#ffd23f', blue: '#1b3fa0', blueL: '#4cc9f0',
    red: '#e63946', white: '#ffffff', ink: '#101418', pix: '#32bcad', paper: '#f4f1e8',
    orange: '#ff8c1a', pink: '#ff5d8f', purple: '#8e5cf7', gray: '#9aa5b8',
  };

  // ===================== Matemática =====================
  const M = (G.m = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    dist2: (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    chance: (p) => Math.random() < p,
    sign: (v) => (v < 0 ? -1 : 1),
    approach: (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t)),
    wrapAngle: (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; },
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInCubic: (t) => t * t * t,
    easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    segDist2(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t - px, cy = ay + dy * t - py;
      return cx * cx + cy * cy;
    },
  });

  // Formata número com pontos: 1234567 -> "1.234.567"
  G.fmt = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  G.fmtMoney = (n) => 'R$ ' + G.fmt(n);

  // ===================== Erros (para testes) =====================
  G.errors = [];
  G.reportError = function (err, where) {
    const msg = (where ? '[' + where + '] ' : '') + (err && err.stack ? err.stack : String(err));
    G.errors.push(msg);
    if (G.errors.length > 50) G.errors.shift();
    try { console.error(msg); } catch (e) { /* nada */ }
  };
  window.addEventListener('error', (e) => G.reportError(e.error || e.message, 'window'));
  // Chama fn com proteção: um erro num módulo não derruba o jogo inteiro.
  // Sem "...args" (rest) para não alocar um array a cada chamada: até 6 argumentos vão direto.
  function safe(fn, where, a, b, c, d, e, f) {
    if (typeof fn !== 'function') return undefined;
    try {
      switch (arguments.length) {
        case 2: return fn();
        case 3: return fn(a);
        case 4: return fn(a, b);
        case 5: return fn(a, b, c);
        case 6: return fn(a, b, c, d);
        case 7: return fn(a, b, c, d, e);
        case 8: return fn(a, b, c, d, e, f);
        default: return fn.apply(null, Array.prototype.slice.call(arguments, 2));
      }
    } catch (err) { G.reportError(err, where); return undefined; }
  }
  // Chama obj[name](...args) preservando o this. Usado para módulos e defs.
  function call(obj, name, a, b, c, d, e, f) {
    const fn = obj && obj[name];
    if (typeof fn !== 'function') return undefined;
    try {
      switch (arguments.length) {
        case 2: return fn.call(obj);
        case 3: return fn.call(obj, a);
        case 4: return fn.call(obj, a, b);
        case 5: return fn.call(obj, a, b, c);
        case 6: return fn.call(obj, a, b, c, d);
        case 7: return fn.call(obj, a, b, c, d, e);
        case 8: return fn.call(obj, a, b, c, d, e, f);
        default: return fn.apply(obj, Array.prototype.slice.call(arguments, 2));
      }
    } catch (err) { G.reportError(err, (obj.__tag ? obj.__tag + '.' : '') + name); return undefined; }
  }
  G.safe = safe;
  G.call = call;

  // ===================== Save =====================
  const SAVE_KEY = 'fusca-a-jato.save.v1';
  function defaultSave() {
    return {
      pix: 0, upgrades: {}, unlocked: 1, best: 0, cleared: false, cleared2: false, seenIntro: false,
      achievements: {}, counters: {},
      // quality: 'auto' (o jogo escolhe pelo desempenho) | 'high' | 'mid' | 'low'
      settings: { music: true, sfx: true, sens: 1.25, vibrate: true, shake: true, hitbox: true, quality: 'auto' },
      qualityTier: 'high', // nível escolhido pelo modo automático (lembrado entre sessões)
    };
  }
  function loadSave() {
    const s = defaultSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        Object.assign(s, d);
        s.settings = Object.assign(defaultSave().settings, d.settings || {});
        s.upgrades = d.upgrades || {};
        s.achievements = d.achievements || {};
        s.counters = d.counters || {};
      }
    } catch (e) { /* storage bloqueado: segue com save em memória */ }
    return s;
  }
  G.save = loadSave();
  G.saveGame = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* nada */ } };
  G.resetSave = function () { G.save = defaultSave(); G.saveGame(); };
  G.upg = (id) => G.save.upgrades[id] || 0;
  G.upgradeCost = function (id) {
    const u = G.UPGRADES.find((x) => x.id === id);
    if (!u) return null;
    const lv = G.upg(id);
    return lv >= u.costs.length ? null : u.costs[lv];
  };
  // Compra uma melhoria. Retorna true se comprou.
  G.buyUpgrade = function (id) {
    const cost = G.upgradeCost(id);
    if (cost == null || G.save.pix < cost) return false;
    G.save.pix -= cost;
    G.save.upgrades[id] = G.upg(id) + 1;
    G.saveGame();
    call(G.Audio, 'sfx', 'buy');
    // Comprou na "Parada na estrada" (entre fases): vale já para a partida em andamento.
    if (G.run && G.state === 'clear') {
      const r = G.run;
      if (id === 'vida') { r.lives = Math.min(9, r.lives + 1); r.baseLives++; }
      if (id === 'bomba') { r.bombs = Math.min(6, r.bombs + 1); r.baseBombs++; }
      if (id === 'arma') { r.level = Math.min(G.MAX_LEVEL, r.level + 1); r.pp = 0; }
    }
    return true;
  };

  // ===================== Qualidade gráfica =====================
  // G.quality: 'high' | 'mid' | 'low'. Os módulos leem G.quality na hora de desenhar
  // (bg: menos camadas; art: sem halos; bosses: menos partículas decorativas; audio: sem reverb).
  // O modo 'auto' mede o intervalo real entre quadros (inclui a rasterização) e desce um nível
  // quando o jogo fica lento por 2,5 s seguidos. Sobe de novo só no começo de uma fase.
  const Q_ORDER = ['low', 'mid', 'high'];
  const Q_DPR = { high: 2, mid: 1.5, low: 1 };
  const Q_PARTS = { high: 600, mid: 450, low: 300 };
  function qualityFromSave() {
    const s = G.save.settings.quality || 'auto';
    if (s !== 'auto' && Q_DPR[s]) return s;
    return Q_DPR[G.save.qualityTier] ? G.save.qualityTier : 'high';
  }
  G.quality = qualityFromSave();
  G.qualityAuto = () => (G.save.settings.quality || 'auto') === 'auto' && !G.debug.qualityForced;
  // ui.js chama: G.setQuality('auto'|'high'|'mid'|'low'). Escolher 'auto' de novo recomeça do 'high'.
  G.setQuality = function (q) {
    if (q !== 'auto' && !Q_DPR[q]) return;
    G.save.settings.quality = q;
    if (q === 'auto') G.save.qualityTier = 'high';
    G.debug.qualityForced = false;
    G.saveGame();
    applyQuality();
  };
  function applyQuality() {
    const q = G.debug.qualityForced || qualityFromSave();
    if (q === G.quality) return;
    G.quality = q;
    if (canvas) resize();
  }

  // ===================== Conquistas =====================
  G.unlock = function (id) {
    if (G.save.achievements[id]) return false;
    const a = (G.ACHIEVEMENTS || []).find((x) => x.id === id);
    if (!a) return false;
    G.save.achievements[id] = Date.now();
    G.saveGame();
    call(G.UI, 'toast', { title: 'Conquista!', text: a.name, kind: 'achievement' });
    call(G.Audio, 'sfx', 'achievement');
    return true;
  };
  // Contador persistente (soma n). Libera conquistas com counter/goal.
  G.count = function (counter, n) {
    const c = G.save.counters;
    c[counter] = (c[counter] || 0) + (n == null ? 1 : n);
    for (const a of G.ACHIEVEMENTS || []) {
      if (a.counter === counter && c[counter] >= a.goal) G.unlock(a.id);
    }
    return c[counter];
  };

  // ===================== Registros (módulos usam define) =====================
  G.Enemies = { defs: {}, define(kind, def) { def.__tag = 'enemy:' + kind; this.defs[kind] = def; } };
  G.Bosses = { defs: {}, define(id, def) { def.__tag = 'boss:' + id; this.defs[id] = def; } };
  G.Stages = { list: [], add(stage) { this.list.push(stage); }, byId(id) { return this.list.find((s) => s.id === id); } };
  G.Portraits = { defs: {}, define(id, fn) { this.defs[id] = fn; } };

  // ===================== Estilos de tiro inimigo (sprites em cache) =====================
  // def: { r: raio de colisão, size: tamanho do sprite em px lógicos, rotate: gira na direção do tiro,
  //        spin: gira sozinho (rad/s), paint(ctx, size, color) desenha centrado em (0,0) }
  const BS = (G.BulletStyles = {
    defs: {},
    cache: {}, // cache[estilo][cor] (dois níveis: sem montar string a cada tiro, a cada quadro)
    define(name, def) {
      this.defs[name] = def;
      delete this.cache[name];
    },
    sprite(name, color) {
      let byName = this.cache[name];
      if (!byName) byName = this.cache[name] = {};
      let c = byName[color];
      if (c) return c;
      const def = this.defs[name] || this.defs.orb;
      const k = 3; // resolução do sprite
      const pad = 6;
      const s = def.size + pad * 2;
      c = document.createElement('canvas');
      c.width = c.height = Math.ceil(s * k);
      const x = c.getContext('2d');
      x.scale(k, k);
      x.translate(s / 2, s / 2);
      try { def.paint(x, def.size, color); } catch (err) { G.reportError(err, 'bulletstyle ' + name); }
      c._s = s;
      byName[color] = c;
      return c;
    },
  });
  function glow(x, color, blur) { x.shadowColor = color; x.shadowBlur = blur; }
  BS.define('orb', { r: 5, size: 14, paint(x, s, c) {
    glow(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.42, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, s * 0.24, 0, TAU); x.fill();
  } });
  BS.define('small', { r: 3.2, size: 9, paint(x, s, c) {
    glow(x, c, 5); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.45, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, s * 0.22, 0, TAU); x.fill();
  } });
  BS.define('big', { r: 10, size: 26, paint(x, s, c) {
    glow(x, c, 10); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.44, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(0, 0, s * 0.27, 0, TAU); x.fill();
  } });
  BS.define('needle', { r: 3, size: 18, rotate: true, paint(x, s, c) {
    glow(x, c, 5); x.fillStyle = c; x.beginPath(); x.ellipse(0, 0, s * 0.5, s * 0.16, 0, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, s * 0.36, s * 0.07, 0, 0, TAU); x.fill();
  } });
  BS.define('rice', { r: 3.5, size: 14, rotate: true, paint(x, s, c) {
    glow(x, c, 5); x.fillStyle = c; x.beginPath(); x.ellipse(0, 0, s * 0.45, s * 0.25, 0, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, s * 0.28, s * 0.12, 0, 0, TAU); x.fill();
  } });
  BS.define('star', { r: 5, size: 16, spin: 5, paint(x, s, c) {
    glow(x, c, 6); x.fillStyle = c; x.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.22 : s * 0.5; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    x.closePath(); x.fill(); x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, s * 0.13, 0, TAU); x.fill();
  } });
  // Cédula de dinheiro (verde)
  BS.define('bill', { r: 5, size: 20, rotate: true, paint(x, s, c) {
    glow(x, c, 4); x.fillStyle = c; x.fillRect(-s * 0.5, -s * 0.26, s, s * 0.52);
    x.shadowBlur = 0; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1; x.strokeRect(-s * 0.42, -s * 0.18, s * 0.84, s * 0.36);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(0, 0, s * 0.11, 0, TAU); x.fill();
  } });
  // Santinho de campanha (papel branco com faixa colorida)
  BS.define('santinho', { r: 5, size: 18, spin: 7, paint(x, s, c) {
    glow(x, c, 4); x.fillStyle = '#fff'; x.fillRect(-s * 0.32, -s * 0.45, s * 0.64, s * 0.9);
    x.shadowBlur = 0; x.fillStyle = c; x.fillRect(-s * 0.32, -s * 0.45, s * 0.64, s * 0.3);
    x.fillStyle = '#222'; x.fillRect(-s * 0.2, s * 0.02, s * 0.4, s * 0.06); x.fillRect(-s * 0.2, s * 0.16, s * 0.3, s * 0.06);
  } });
  BS.define('coin', { r: 5, size: 14, paint(x, s, c) {
    glow(x, c, 5); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.45, 0, TAU); x.fill();
    x.shadowBlur = 0; x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, s * 0.3, 0, TAU); x.stroke();
  } });

  // ===================== Desenho de personagens (base compartilhada) =====================
  // G.Art.person: desenha um político/pessoa em estilo "cabeção" a partir de uma spec.
  // O módulo art.js pode melhorar esta função mantendo a MESMA assinatura.
  G.Art = {
    // Cor com flash de dano (branco quando atingido)
    col(c, o) { return o && o.flash ? '#ffffff' : c; },
    /**
     * @param ctx
     * @param x,y   centro da cabeça+corpo (ponto do meio do personagem)
     * @param size  altura total em px lógicos
     * @param spec  {skin, hair:'side'|'slick'|'bob'|'bald'|'gray'|'curly'|'none', hairColor,
     *               beard:null|'full'|'stubble'|'goatee', beardColor, mustache, glasses:null|'round'|'square'|'dark',
     *               brows:'normal'|'angry'|'worried'|'bushy', browColor, body:'suit'|'tank'|'tshirt'|'none',
     *               suit, shirt, tie, sash:[c1,c2]|null, hat:null|'cap'|'military'|'helmet', hatColor, pin}
     * @param o     {t, mood:'normal'|'angry'|'laugh'|'hurt'|'smug', mouth:0..1, flash, alpha, facing, bust}
     */
    person(ctx, x, y, size, spec, o) {
      o = o || {};
      spec = spec || {};
      const A = G.Art;
      const C = (c) => A.col(c, o);
      const t = o.t || 0;
      const s = size / 100;
      ctx.save();
      ctx.translate(x, y);
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      if (o.facing === -1) ctx.scale(-1, 1);
      const bob = Math.sin(t * 6) * 1.2 * s;
      const headR = 27 * s;
      const headY = -14 * s + bob;
      // ---- corpo ----
      const body = spec.body || 'suit';
      if (body !== 'none' && !o.bust) {
        const sw = 30 * s, sh = 36 * s, by = 12 * s;
        ctx.fillStyle = C(body === 'suit' ? spec.suit || '#2b3445' : spec.shirt || '#ffffff');
        ctx.beginPath();
        ctx.moveTo(-sw, by + sh); ctx.quadraticCurveTo(-sw, by, -sw * 0.45, by - 4 * s);
        ctx.lineTo(sw * 0.45, by - 4 * s); ctx.quadraticCurveTo(sw, by, sw, by + sh); ctx.closePath(); ctx.fill();
        if (body === 'suit') {
          ctx.fillStyle = C(spec.shirt || '#f2f2f2');
          ctx.beginPath(); ctx.moveTo(-9 * s, by - 4 * s); ctx.lineTo(0, by + 18 * s); ctx.lineTo(9 * s, by - 4 * s); ctx.closePath(); ctx.fill();
          if (spec.tie) {
            ctx.fillStyle = C(spec.tie);
            ctx.beginPath(); ctx.moveTo(-3 * s, by - 2 * s); ctx.lineTo(3 * s, by - 2 * s); ctx.lineTo(4 * s, by + 14 * s); ctx.lineTo(0, by + 19 * s); ctx.lineTo(-4 * s, by + 14 * s); ctx.closePath(); ctx.fill();
          }
          if (spec.pin) { ctx.fillStyle = C(spec.pin); ctx.beginPath(); ctx.arc(-17 * s, by + 6 * s, 2.6 * s, 0, TAU); ctx.fill(); }
        }
        if (spec.sash) {
          ctx.save(); ctx.beginPath();
          ctx.moveTo(-sw, by + sh); ctx.quadraticCurveTo(-sw, by, -sw * 0.45, by - 4 * s); ctx.lineTo(sw * 0.45, by - 4 * s); ctx.quadraticCurveTo(sw, by, sw, by + sh); ctx.closePath(); ctx.clip();
          ctx.strokeStyle = C(spec.sash[0]); ctx.lineWidth = 9 * s;
          ctx.beginPath(); ctx.moveTo(-sw * 0.7, by - 6 * s); ctx.lineTo(sw * 0.9, by + sh); ctx.stroke();
          ctx.strokeStyle = C(spec.sash[1]); ctx.lineWidth = 3.5 * s; ctx.stroke();
          ctx.restore();
        }
      }
      // ---- cabeça ----
      ctx.fillStyle = C(spec.skin || '#e8b48a');
      ctx.beginPath(); ctx.ellipse(0, headY, headR * 0.92, headR, 0, 0, TAU); ctx.fill();
      // orelhas
      ctx.beginPath(); ctx.ellipse(-headR * 0.92, headY + 2 * s, 4 * s, 6 * s, 0, 0, TAU); ctx.ellipse(headR * 0.92, headY + 2 * s, 4 * s, 6 * s, 0, 0, TAU); ctx.fill();
      // barba
      const beardC = C(spec.beardColor || spec.hairColor || '#444');
      if (spec.beard === 'full') {
        ctx.fillStyle = beardC;
        ctx.beginPath(); ctx.moveTo(-headR * 0.9, headY);
        ctx.quadraticCurveTo(-headR * 0.9, headY + headR * 1.25, 0, headY + headR * 1.18);
        ctx.quadraticCurveTo(headR * 0.9, headY + headR * 1.25, headR * 0.9, headY);
        ctx.quadraticCurveTo(headR * 0.5, headY + headR * 0.55, 0, headY + headR * 0.5);
        ctx.quadraticCurveTo(-headR * 0.5, headY + headR * 0.55, -headR * 0.9, headY); ctx.fill();
      } else if (spec.beard === 'stubble') {
        ctx.fillStyle = 'rgba(40,40,40,0.25)';
        ctx.beginPath(); ctx.ellipse(0, headY + headR * 0.55, headR * 0.7, headR * 0.42, 0, 0, Math.PI); ctx.fill();
      } else if (spec.beard === 'goatee') {
        ctx.fillStyle = beardC; ctx.beginPath(); ctx.ellipse(0, headY + headR * 0.82, headR * 0.22, headR * 0.2, 0, 0, TAU); ctx.fill();
      }
      // cabelo
      const hairC = C(spec.hairColor || '#2a2a2a');
      ctx.fillStyle = hairC;
      const hair = spec.hair || 'side';
      if (hair === 'side' || hair === 'slick') {
        ctx.beginPath(); ctx.ellipse(0, headY - headR * 0.55, headR * 0.95, headR * 0.55, 0, Math.PI, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-headR * 0.3, headY - headR * 0.62, headR * 0.72, headR * 0.35, -0.2, 0, TAU); ctx.fill();
        if (hair === 'slick') { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(0, headY - headR * 0.2, headR * 0.7, -2.6, -0.6); ctx.stroke(); }
      } else if (hair === 'bob') {
        ctx.beginPath(); ctx.ellipse(0, headY - headR * 0.3, headR * 1.08, headR * 0.85, 0, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.fillRect(-headR * 1.08, headY - headR * 0.35, headR * 0.32, headR * 0.95);
        ctx.fillRect(headR * 0.76, headY - headR * 0.35, headR * 0.32, headR * 0.95);
      } else if (hair === 'gray') {
        ctx.beginPath(); ctx.ellipse(-headR * 0.7, headY - headR * 0.35, headR * 0.35, headR * 0.45, 0.3, 0, TAU); ctx.ellipse(headR * 0.7, headY - headR * 0.35, headR * 0.35, headR * 0.45, -0.3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, headY - headR * 0.82, headR * 0.6, headR * 0.25, 0, 0, TAU); ctx.fill();
      } else if (hair === 'curly') {
        for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; ctx.beginPath(); ctx.arc(Math.cos(a) * headR * 0.85, headY + Math.sin(a) * headR * 0.85, headR * 0.32, 0, TAU); ctx.fill(); }
      } else if (hair === 'bald') {
        ctx.beginPath(); ctx.ellipse(-headR * 0.85, headY - headR * 0.1, headR * 0.18, headR * 0.35, 0, 0, TAU); ctx.ellipse(headR * 0.85, headY - headR * 0.1, headR * 0.18, headR * 0.35, 0, 0, TAU); ctx.fill();
      }
      // chapéu
      if (spec.hat === 'cap' || spec.hat === 'military') {
        ctx.fillStyle = C(spec.hatColor || (spec.hat === 'military' ? '#3d5a3d' : '#1b3fa0'));
        ctx.beginPath(); ctx.ellipse(0, headY - headR * 0.6, headR * 0.98, headR * 0.55, 0, Math.PI, TAU); ctx.fill();
        ctx.fillRect(-headR * 1.05, headY - headR * 0.62, headR * 2.1, headR * 0.18);
        if (spec.hat === 'military') { ctx.fillStyle = C('#ffd23f'); ctx.beginPath(); ctx.arc(0, headY - headR * 0.85, headR * 0.12, 0, TAU); ctx.fill(); }
      } else if (spec.hat === 'helmet') {
        ctx.fillStyle = C(spec.hatColor || '#111');
        ctx.beginPath(); ctx.ellipse(0, headY - headR * 0.1, headR * 1.1, headR * 1.08, 0, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      }
      // sobrancelhas
      const mood = o.mood || 'normal';
      const browC = C(spec.browColor || spec.hairColor || '#2a2a2a');
      const ex = headR * 0.38, ey = headY - headR * 0.05;
      ctx.strokeStyle = browC; ctx.lineCap = 'round';
      ctx.lineWidth = (spec.brows === 'bushy' ? 4.5 : 3) * s;
      const browTilt = mood === 'angry' || spec.brows === 'angry' ? 0.45 : mood === 'hurt' || spec.brows === 'worried' ? -0.4 : 0;
      for (const sd of [-1, 1]) {
        const by0 = ey - 9 * s;
        ctx.beginPath();
        ctx.moveTo(sd * (ex - 7 * s), by0 + browTilt * 6 * s);
        ctx.lineTo(sd * (ex + 6 * s), by0 - browTilt * 3 * s);
        ctx.stroke();
      }
      // olhos
      const blink = (Math.sin(t * 1.7 + (spec.seed || 0)) > 0.985) || mood === 'laugh';
      ctx.fillStyle = C('#ffffff');
      if (!blink && mood !== 'hurt') {
        ctx.beginPath(); ctx.ellipse(-ex, ey, 5.5 * s, 6 * s, 0, 0, TAU); ctx.ellipse(ex, ey, 5.5 * s, 6 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = C('#1a1a1a');
        const lookX = (o.lookX || 0) * 2 * s;
        ctx.beginPath(); ctx.arc(-ex + lookX, ey + 1 * s, 2.8 * s, 0, TAU); ctx.arc(ex + lookX, ey + 1 * s, 2.8 * s, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = C('#1a1a1a'); ctx.lineWidth = 2.2 * s;
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          if (mood === 'hurt') { ctx.moveTo(sd * ex - 4 * s, ey - 4 * s); ctx.lineTo(sd * ex + 4 * s, ey + 4 * s); ctx.moveTo(sd * ex + 4 * s, ey - 4 * s); ctx.lineTo(sd * ex - 4 * s, ey + 4 * s); }
          else { ctx.arc(sd * ex, ey + 2 * s, 4.5 * s, Math.PI * 1.1, Math.PI * 1.9); }
          ctx.stroke();
        }
      }
      // óculos
      if (spec.glasses) {
        ctx.strokeStyle = C('#111'); ctx.lineWidth = 2 * s;
        if (spec.glasses === 'dark') { ctx.fillStyle = C('#111'); }
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          if (spec.glasses === 'round') ctx.arc(sd * ex, ey, 8 * s, 0, TAU);
          else { const gw = 16 * s, gh = 11 * s; ctx.rect(sd * ex - gw / 2, ey - gh / 2, gw, gh); }
          if (spec.glasses === 'dark') ctx.fill(); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(-ex + 7 * s, ey); ctx.lineTo(ex - 7 * s, ey); ctx.stroke();
      }
      // nariz
      ctx.fillStyle = C('rgba(0,0,0,0.13)');
      ctx.beginPath(); ctx.ellipse(0, headY + headR * 0.22, 5 * s, 6.5 * s, 0, 0, TAU); ctx.fill();
      // bigode
      if (spec.mustache || spec.beard === 'full') {
        ctx.fillStyle = beardC;
        ctx.beginPath(); ctx.ellipse(-6 * s, headY + headR * 0.45, 8 * s, 3.6 * s, 0.15, 0, TAU); ctx.ellipse(6 * s, headY + headR * 0.45, 8 * s, 3.6 * s, -0.15, 0, TAU); ctx.fill();
      }
      // boca
      const mo = o.mouth != null ? o.mouth : 0;
      const my = headY + headR * 0.62;
      ctx.fillStyle = C('#5a1a1a');
      if (mood === 'laugh' || mo > 0.05) {
        const h = mood === 'laugh' ? 8 * s : (2 + mo * 8) * s;
        ctx.beginPath(); ctx.ellipse(0, my, 8 * s, h, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = C('#ffffff'); ctx.fillRect(-6 * s, my - h * 0.85, 12 * s, Math.min(3 * s, h * 0.5));
      } else {
        ctx.strokeStyle = C('#5a1a1a'); ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        if (mood === 'angry' || mood === 'hurt') ctx.arc(0, my + 5 * s, 7 * s, Math.PI * 1.2, Math.PI * 1.8);
        else if (mood === 'smug') { ctx.moveTo(-7 * s, my); ctx.quadraticCurveTo(2 * s, my + 4 * s, 8 * s, my - 3 * s); }
        else ctx.arc(0, my - 3 * s, 7 * s, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    },
    // Fallbacks simples (art.js substitui):
    player(ctx, x, y, o) {
      o = o || {};
      ctx.save(); ctx.translate(x, y); ctx.rotate((o.tilt || 0) * 0.3);
      ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.moveTo(-5, 14); ctx.lineTo(0, 22 + Math.random() * 6); ctx.lineTo(5, 14); ctx.fill();
      ctx.fillStyle = A_col('#7ec8e3', o); ctx.beginPath(); ctx.ellipse(0, 0, 12, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.ellipse(0, -3, 7, 8, 0, 0, TAU); ctx.fill();
      ctx.restore();
    },
    pickup(ctx, type, x, y, t, o) {
      o = o || {};
      const colors = { pix: G.C.pix, pix5: G.C.pix, mala: '#8b5a2b', bomb: '#f4f1e8', shield: '#4cc9f0', life: '#ff5d8f', cafe: '#6f4e37' };
      const c = type === 'power' ? (G.WEAPONS[o.wtype] || G.WEAPONS.voto).color : colors[type] || '#fff';
      const r = type === 'pix' ? 5 : type === 'pix5' ? 7 : 10;
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (r >= 10) { ctx.fillStyle = '#111'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(type === 'power' ? 'P' : type[0].toUpperCase(), x, y + 1); }
    },
    lifeIcon(ctx, x, y, s) { ctx.fillStyle = '#7ec8e3'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.4, s * 0.5, 0, 0, TAU); ctx.fill(); },
    bombIcon(ctx, x, y, s) { ctx.fillStyle = '#f4f1e8'; ctx.fillRect(x - s * 0.35, y - s * 0.45, s * 0.7, s * 0.9); },
    weaponIcon(ctx, w, x, y, s) { ctx.fillStyle = (G.WEAPONS[w] || G.WEAPONS.voto).color; ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, TAU); ctx.fill(); },
    // Ilustração para os painéis da história (UI chama). scene = 'urna'|'briga'|'brasilia'|'ze'|'fusca'|'planalto'
    scene(ctx, scene, w, h, t) {
      ctx.fillStyle = '#1b3fa0'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffd23f'; ctx.font = '20px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.fillText(scene.toUpperCase(), w / 2, h / 2);
    },
  };
  function A_col(c, o) { return o && o.flash ? '#fff' : c; }

  // Retrato para diálogos (quadrado). Usa G.Portraits[id] se existir, senão um busto genérico.
  G.drawPortrait = function (ctx, id, x, y, size, o) {
    const fn = G.Portraits.defs[id];
    if (fn) return safe(fn, 'portrait ' + id, ctx, x, y, size, o || {});
    const specs = {
      ze: { skin: '#d9a273', hair: 'none', hat: 'cap', hatColor: '#1b3fa0', beard: 'stubble', body: 'tank', shirt: '#ffffff' },
      vo: { skin: '#f0c8a0', hair: 'curly', hairColor: '#dcdcdc', glasses: 'round', body: 'tshirt', shirt: '#ff9ecb' },
    };
    G.Art.person(ctx, x, y + size * 0.12, size * 1.1, specs[id] || { hair: 'side' }, Object.assign({ bust: false }, o || {}));
  };

  // ===================== Fallbacks de módulos =====================
  G.Audio = {
    init() {}, unlock() {}, sfx() {}, music() {}, stopMusic() {}, setMusicOn() {}, setSfxOn() {},
  };
  G.BG = {
    draw(ctx, stageId, scrollY, t, W, H) {
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0d1b3d'); gr.addColorStop(1, '#173a2a');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      const off = scrollY % 40;
      for (let y = off - 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    },
  };
  // A UI de verdade (ui.js) substitui G.UI inteiro. Este fallback deixa o jogo jogável sem ela.
  G.UI = makeFallbackUI();

  // ===================== Canvas & redimensionamento =====================
  let canvas, ctx, viewEl;
  let scale = 1, dpr = 1;
  G.view = { x: 0, y: 0, w: 360, h: 640, scale: 1 };
  let coarseMQ = null, wasPhoneLand = false;
  function resize() {
    const r = viewEl.getBoundingClientRect();
    const vw = Math.max(200, r.width), vh = Math.max(300, r.height);
    // Celular deitado: o jogo é em pé. Pausa e pede para girar (a dica é um ::after do body).
    try { if (!coarseMQ && window.matchMedia) coarseMQ = window.matchMedia('(pointer: coarse)'); } catch (e) { /* nada */ }
    const land = vw > vh * 1.15 && !!(coarseMQ && coarseMQ.matches);
    document.body.classList.toggle('rotate-hint', land);
    // celular (tela baixa) acabou de deitar: pausa uma vez. Tablet deitado continua jogável (base.css só avisa).
    const phoneLand = land && vh < 560;
    if (phoneLand && !wasPhoneLand && G.state === 'play') G.pause();
    wasPhoneLand = phoneLand;
    G.H = Math.round(M.clamp((G.W * vh) / vw, 600, 780));
    scale = Math.min(vw / G.W, vh / G.H);
    dpr = Math.min(window.devicePixelRatio || 1, Q_DPR[G.quality] || 2);
    btnRect = null; frozenState = null; hudCache.k = 0;
    const cw = Math.round(G.W * scale), ch = Math.round(G.H * scale);
    const left = Math.round(r.left + (vw - cw) / 2), top = Math.round(r.top + (vh - ch) / 2);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.style.left = left + 'px'; canvas.style.top = top + 'px';
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    G.view = { x: left, y: top, w: cw, h: ch, scale };
    const ui = document.getElementById('ui');
    if (ui) { ui.style.left = left + 'px'; ui.style.top = top + 'px'; ui.style.width = cw + 'px'; ui.style.height = ch + 'px'; }
    const hud = document.getElementById('hud');
    if (hud) { hud.style.left = left + 'px'; hud.style.top = top + 'px'; hud.style.width = cw + 'px'; hud.style.height = ch + 'px'; }
    document.documentElement.style.setProperty('--gs', scale.toFixed(4));
    if (G.game && G.game.player) {
      const p = G.game.player;
      p.x = M.clamp(p.x, 12, G.W - 12); p.y = M.clamp(p.y, 50, G.H - 24);
    }
  }
  // Converte coordenadas da tela (clientX/Y) para coordenadas lógicas do jogo
  G.toLogical = (cx, cy) => ({ x: (cx - G.view.x) / G.view.scale, y: (cy - G.view.y) / G.view.scale });

  // ===================== Entrada =====================
  // fx/fy: dedo no momento da âncora; ax/ay: carro no momento da âncora; lx/ly: última posição do dedo
  const input = (G.input = { active: false, id: null, fx: 0, fy: 0, ax: 0, ay: 0, lx: 0, ly: 0, keys: {} });
  let bombTap = null; // toque que começou no botão da Delação: vira bomba só se for um toque rápido e parado
  function anchorTouch(e) {
    const p = G.game.player;
    const L = G.toLogical(e.clientX, e.clientY);
    input.active = true; input.id = e.pointerId;
    input.fx = input.lx = L.x; input.fy = input.ly = L.y; input.ax = p.x; input.ay = p.y;
    p.tx = p.x; p.ty = p.y;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  }
  // O dedo que continuou na tela (morte, entrada do carro, recontagem, volta da pausa)
  // passa a pilotar a partir de onde o carro está agora, sem pulo.
  function reanchor() {
    const g = G.game; if (!g || !input.active) return;
    const p = g.player;
    input.fx = input.lx; input.fy = input.ly; input.ax = p.x; input.ay = p.y;
    p.tx = p.x; p.ty = p.y;
  }
  function setupInput() {
    canvas.addEventListener('pointerdown', (e) => {
      call(G.Audio, 'unlock');
      if (G.state !== 'play' || !G.game) return;
      e.preventDefault();
      if (input.active && input.id !== e.pointerId) return; // um dedo pilota
      anchorTouch(e);
    }, { passive: false });
    const move = (e) => {
      if (!input.active || e.pointerId !== input.id || !G.game) return;
      e.preventDefault();
      const p = G.game.player;
      const L = G.toLogical(e.clientX, e.clientY);
      input.lx = L.x; input.ly = L.y;
      // carro morto, entrando ou mundo congelado (volta da pausa): só guarda onde o dedo está
      if (!p.alive || p.entering || G.game.resumeT > 0 || (G.state !== 'play' && G.state !== 'clear')) return;
      const sens = G.save.settings.sens || 1.25;
      p.tx = input.ax + (L.x - input.fx) * sens;
      p.ty = input.ay + (L.y - input.fy) * sens;
      // reancora quando bate na borda, para a volta responder na hora
      const cx = M.clamp(p.tx, 12, G.W - 12), cy = M.clamp(p.ty, 50, G.H - 24);
      if (cx !== p.tx) { input.ax += cx - p.tx; p.tx = cx; }
      if (cy !== p.ty) { input.ay += cy - p.ty; p.ty = cy; }
    };
    canvas.addEventListener('pointermove', move, { passive: false });
    const end = (e) => {
      if (bombTap && bombTap.id === e.pointerId) {
        // toque rápido e parado no botão = Delação; se arrastou ou segurou, era só o dedão voltando a pilotar
        const quick = e.type === 'pointerup' && performance.now() - bombTap.t < 300 && Math.hypot(e.clientX - bombTap.x, e.clientY - bombTap.y) < 14;
        bombTap = null;
        if (quick) G.bomb();
      }
      if (e.pointerId === input.id) { input.active = false; input.id = null; }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'slow', ShiftRight: 'slow' };
    window.addEventListener('keydown', (e) => {
      call(G.Audio, 'unlock');
      if (map[e.code]) { input.keys[map[e.code]] = true; if (G.state === 'play') e.preventDefault(); }
      if ((e.code === 'KeyX' || e.code === 'Space' || e.code === 'KeyB') && G.state === 'play') { G.bomb(); e.preventDefault(); }
      if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') G.pause(); else if (G.state === 'pause') G.resume(); }
    });
    window.addEventListener('keyup', (e) => { if (map[e.code]) input.keys[map[e.code]] = false; });
    window.addEventListener('blur', () => { input.keys = {}; input.active = false; if (G.state === 'play') G.pause(); });
    // App para o fundo: pausa e grava o Pix da fase (o sistema do celular pode matar a aba lá atrás).
    // Ao voltar: se o jogo entrou em 'play' escondido (cartão da fase avança sozinho), pausa também.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (G.state === 'play') G.pause(); saveProgress(); }
      else if (G.state === 'play') G.pause();
    });
    window.addEventListener('pagehide', () => { if (G.state === 'play') G.pause(); saveProgress(); });

    const bombBtn = document.getElementById('btnBomb');
    if (bombBtn) {
      bombBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); call(G.Audio, 'unlock');
        if (G.state !== 'play' || !G.game) return;
        // segundo dedo (o outro já pilota) ou mouse: intenção clara, solta na hora
        if ((input.active && input.id !== e.pointerId) || e.pointerType === 'mouse') { G.bomb(); return; }
        // dedão que voltou à tela em cima do botão: começa a pilotar; vira bomba no pointerup se foi um toque
        anchorTouch(e);
        bombTap = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY };
      }, { passive: false });
      bombBtn.addEventListener('pointermove', move, { passive: false }); // caso a captura pelo canvas falhe
      bombBtn.addEventListener('pointerup', end);
      bombBtn.addEventListener('pointercancel', end);
    }
    const pauseBtn = document.getElementById('btnPause');
    if (pauseBtn) {
      pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (G.state === 'play') G.pause(); }, { passive: false });
    }
  }
  G.vibrate = function (ms) { if (!G.save.settings.vibrate) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* nada */ } };

  // ===================== Estado do jogo =====================
  G.state = 'boot'; // boot | menu | intro | play | dialogue | pause | clear | over | ending
  G.run = null;     // dados da partida (vidas, bombas, arma, placar...)
  G.game = null;    // dados da fase atual (entidades)
  let menuT = 0;

  function newGame(stageIdx) {
    const st = G.Stages.list[stageIdx];
    const g = {
      t: 0, frame: 0, stageIdx, stage: st, loop: G.run.loop,
      diff: G.run.loop > 1 ? 1.15 : 1, // multiplicador de velocidade dos tiros inimigos
      player: null, enemies: [], eb: [], pb: [], pickups: [], parts: [], texts: [], lasers: [], fx: [],
      boss: null, banner: null, stamp: null, shake: 0, hitstop: 0, flashA: 0, flashC: '#fff',
      scrollY: 0, scrollSpeed: st && st.scrollSpeed ? st.scrollSpeed : 42,
      approval: 30, approvalIdle: 0, delacao: 0,
      kills: 0, hits: 0, bombsUsed: 0, bombsUsedBoss: 0, grazes: 0, pixStage: 0, pixCommitted: 0,
      script: null, cleared: false, canFire: false, introT: 0, beam: null, grazeSfxT: 0, inDialogue: false,
      resumeT: 0, rank: null,
    };
    return g;
  }
  function makePlayer() {
    return {
      x: G.W / 2, y: G.H + 40, tx: G.W / 2, ty: G.H * 0.8, r: 3.2, grazeR: 20,
      alive: true, inv: 3, shield: G.upg('habeas') > 0, cafe: 0, tilt: 0, lastX: G.W / 2,
      fireT: 0, panT: 0, respawnT: 0, bombT: 0, t: 0, entering: true,
    };
  }

  // ===================== API de spawn & tiros =====================
  // Inimigo genérico de teste (os de verdade vêm do enemies.js)
  G.Enemies.define('dummy', {
    hp: 6, r: 14, score: 100, pix: 2,
    update(e, dt) { e.y += 70 * dt; e.x += Math.sin(e.t * 2) * 40 * dt; if (e.t > 1 && ((e.t * 10) | 0) % 15 === 0 && !e.data.f) { e.data.f = 1; G.pat.aimed(e.x, e.y, 130, { style: 'small' }); } if (((e.t * 10) | 0) % 15 !== 0) e.data.f = 0; },
    draw(ctx, e) { G.Art.person(ctx, e.x, e.y, 34, { suit: '#444', tie: '#c00' }, { t: e.t, flash: e.flash > 0 }); },
  });

  G.spawnEnemy = function (kind, x, y, o) {
    const g = G.game; if (!g) return null;
    const def = G.Enemies.defs[kind];
    if (!def) { G.reportError('Inimigo inexistente: ' + kind, 'spawnEnemy'); return null; }
    o = o || {};
    const hpMul = g.loop > 1 ? 1.3 : 1;
    const e = {
      kind, def, x, y, vx: o.vx || 0, vy: o.vy || 0, r: o.r || def.r || 14,
      hp: (o.hp || def.hp || 5) * hpMul, t: 0, flash: 0, dead: false,
      score: o.score != null ? o.score : def.score != null ? def.score : 100, pix: o.pix != null ? o.pix : def.pix != null ? def.pix : 1,
      drop: o.drop || null, big: o.big != null ? o.big : !!def.big, o, data: {},
      invuln: false, shieldT: 0, harmless: !!def.harmless, sayText: null, sayT: 0,
      ignoreClear: !!def.ignoreClear,
    };
    e.maxHp = e.hp;
    if (def.init) call(def, 'init', e, o, g);
    g.enemies.push(e);
    return e;
  };

  // Tiro inimigo. ang em radianos (0 = direita, PI/2 = para baixo). spd em px/s.
  // o: {style, color, r, accel, maxSpd, minSpd, turn, ax, ay, life, delay, update(b,dt,g), data, keep}
  G.fire = function (x, y, ang, spd, o) {
    const g = G.game; if (!g) return null;
    o = o || {};
    const style = o.style || 'orb';
    const def = BS.defs[style] || BS.defs.orb;
    spd *= g.diff;
    const b = {
      x, y, ang, spd, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      ax: o.ax || 0, ay: o.ay || 0, accel: o.accel || 0, maxSpd: o.maxSpd || 9999, minSpd: o.minSpd != null ? o.minSpd : -9999,
      turn: o.turn || 0, style, color: o.color || '#ff4d6d', r: o.r != null ? o.r : def.r,
      t: 0, life: o.life || 14, delay: o.delay || 0, grazed: false, dead: false,
      rot: ang, spin: o.spin != null ? o.spin : def.spin || 0, update: o.update || null, data: o.data || {}, keep: !!o.keep,
    };
    if (g.eb.length < 1400) g.eb.push(b);
    return b;
  };
  G.aim = function (x, y) { const p = G.game && G.game.player; return p ? Math.atan2(p.y - y, p.x - x) : Math.PI / 2; };
  G.pat = {
    ring(x, y, n, spd, o, off) { const out = []; for (let i = 0; i < n; i++) out.push(G.fire(x, y, (off || 0) + (i * TAU) / n, spd, o)); return out; },
    fan(x, y, ang, n, spread, spd, o) {
      const out = [];
      if (n <= 1) { out.push(G.fire(x, y, ang, spd, o)); return out; }
      for (let i = 0; i < n; i++) out.push(G.fire(x, y, ang - spread / 2 + (spread * i) / (n - 1), spd, o));
      return out;
    },
    aimed(x, y, spd, o, offset) { return G.fire(x, y, G.aim(x, y) + (offset || 0), spd, o); },
    aimedFan(x, y, n, spread, spd, o) { return G.pat.fan(x, y, G.aim(x, y), n, spread, spd, o); },
    // linha de tiros com velocidades crescentes (efeito "trem")
    stream(x, y, ang, n, spd0, spd1, o) { const out = []; for (let i = 0; i < n; i++) out.push(G.fire(x, y, ang, spd0 + ((spd1 - spd0) * i) / Math.max(1, n - 1), o)); return out; },
  };

  // Laser com aviso. o: {x,y,ang,len,width,warn,life,color,sweep,owner,ox,oy,update(l,dt,g)}
  G.laser = function (o) {
    const g = G.game; if (!g) return null;
    const l = {
      x: o.x, y: o.y, ang: o.ang != null ? o.ang : Math.PI / 2, len: o.len || 1000, width: o.width || 14,
      warn: o.warn != null ? o.warn : 0.9, life: o.life || 1.2, t: 0, color: o.color || '#ff2a4a',
      sweep: o.sweep || 0, owner: o.owner || null, ox: o.ox || 0, oy: o.oy || 0, update: o.update || null, dead: false, data: o.data || {},
    };
    g.lasers.push(l);
    call(G.Audio, 'sfx', 'laser_warn');
    return l;
  };

  // Itens. type: pix|pix5|mala|power|bomb|shield|life|cafe
  // o P troca de arma a cada G.POWER_CYCLE segundos (ui.js lê para o Como Jogar)
  G.POWER_CYCLE = 3;
  G.drop = function (type, x, y, o) {
    const g = G.game; if (!g) return null;
    o = o || {};
    if (g.pickups.length > 260 && (type === 'pix' || type === 'pix5')) return null;
    const it = {
      type, x, y, vx: o.vx != null ? o.vx : M.rand(-50, 50), vy: o.vy != null ? o.vy : M.rand(-170, -90),
      t: 0, r: type === 'pix' ? 7 : 11, dead: false, magnet: !!o.magnet,
      wtype: o.wtype || G.WEAPON_ORDER[(Math.random() * 4) | 0], cycle: o.cycle != null ? o.cycle : true,
      restore: !!o.restore, // P que caiu na morte: devolve o nível perdido direto
    };
    g.pickups.push(it);
    return it;
  };
  // Espalha N moedas de Pix
  G.dropPix = function (x, y, amount, o) {
    let left = Math.round(amount);
    while (left > 0) {
      if (left >= 25 && M.chance(0.5)) { G.drop('mala', x, y, o); left -= 25; }
      else if (left >= 5) { G.drop('pix5', x, y, o); left -= 5; }
      else { G.drop('pix', x, y, o); left -= 1; }
    }
  };

  // ===================== Efeitos =====================
  G.part = function (o) {
    const g = G.game; if (!g || g.parts.length >= (Q_PARTS[G.quality] || 600)) return null;
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.6, t: 0, size: 3, color: '#fff', type: 'dot', drag: 0.9, grav: 0, rot: 0, vr: 0, alpha: 1 }, o);
    g.parts.push(p);
    return p;
  };
  G.burst = function (x, y, n, o) {
    o = o || {};
    if (G.quality === 'low') n = (n + 1) >> 1;
    const colors = o.colors || [o.color || '#ffd23f'];
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + M.rand(-(o.spread || 0.6), o.spread || 0.6) : M.rand(0, TAU);
      const sp = M.rand(o.speedMin || 40, o.speed || 220);
      G.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: M.rand(0.25, o.life || 0.6), size: M.rand(1.5, o.size || 3.5),
        color: M.pick(colors), type: o.type || 'spark', drag: o.drag || 0.9, grav: o.grav || 0, rot: M.rand(0, TAU), vr: M.rand(-10, 10) });
    }
  };
  // size: 1 pequeno, 2 médio, 3 grande, 4 chefão
  G.explode = function (x, y, size, o) {
    o = o || {};
    size = size || 1;
    G.part({ x, y, type: 'ring', size: 6 * size, life: 0.35 + size * 0.08, color: o.ring || '#fff4c2' });
    G.part({ x, y, type: 'flash', size: 18 * size, life: 0.12 + size * 0.03, color: '#ffffff' });
    G.burst(x, y, 6 + size * 6, { colors: o.colors || ['#ffd23f', '#ff8c1a', '#ffffff', '#e63946'], speed: 120 + size * 70, size: 2 + size, life: 0.5 + size * 0.1 });
    for (let i = 0; i < size * 2; i++) G.part({ x: x + M.rand(-6, 6) * size, y: y + M.rand(-6, 6) * size, vx: M.rand(-30, 30), vy: M.rand(-40, 10), type: 'smoke', size: 6 + size * 4, life: 0.6 + size * 0.15, color: 'rgba(60,60,70,0.5)', drag: 0.95 });
    if (o.confetti !== false) G.confetti(x, y, Math.min(12, 3 + size * 3));
    if (size >= 2) G.shake(size * 2.5);
  };
  // Santinhos e notas voando (assinatura visual das "cassações")
  const CONFETTI_COLORS = ['#ffffff', '#ffd23f', '#3ddc84', '#4cc9f0', '#ff5d8f'];
  G.confetti = function (x, y, n) {
    if (G.quality === 'low') n = (n + 1) >> 1;
    for (let i = 0; i < n; i++) {
      const a = M.rand(0, TAU), sp = M.rand(40, 170);
      G.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, type: 'paper', size: M.rand(3, 5), life: M.rand(0.8, 1.4), color: M.pick(CONFETTI_COLORS), drag: 0.93, grav: 90, rot: M.rand(0, TAU), vr: M.rand(-12, 12) });
    }
  };
  G.text = function (x, y, str, o) {
    const g = G.game; if (!g) return;
    o = o || {};
    if (g.texts.length > 40) g.texts.shift();
    g.texts.push({ x, y, str, color: o.color || '#fff', size: o.size || 12, life: o.life || 0.9, t: 0, vy: o.vy != null ? o.vy : -40, font: o.font || G.FONT_DISPLAY, stroke: o.stroke !== false && (G.quality !== 'low' || (o.size || 12) >= 16) });
  };
  G.shake = function (m) { const g = G.game; if (g && G.save.settings.shake) g.shake = Math.min(14, Math.max(g.shake, m)); };
  G.flash = function (a, c) { const g = G.game; if (g) { g.flashA = Math.max(g.flashA, a); g.flashC = c || '#fff'; } };
  G.hitstop = function (s) { const g = G.game; if (g) g.hitstop = Math.max(g.hitstop, s); };
  G.banner = function (title, sub, o) {
    const g = G.game; if (!g) return;
    o = o || {};
    g.banner = { title, sub: sub || '', t: 0, dur: o.dur || 2.4, color: o.color || G.C.yellow, small: !!o.small };
  };
  // Balão de fala sobre uma entidade (inimigo ou chefão)
  // true enquanto a entidade deve aparecer branca (dano)
  G.isFlash = (ent) => !!(ent && ent.flash > 0);
  G.say = function (ent, text, dur) { if (!ent) return; ent.sayText = text; ent.sayT = dur || 2.2; };

  // Converte tiros inimigos em brilho (opcionalmente em Pix)
  G.clearBullets = function (toPix) {
    const g = G.game; if (!g) return;
    let n = 0;
    for (const b of g.eb) {
      if (b.dead) continue;
      b.dead = true;
      if (toPix && n < 70) { G.drop('pix', b.x, b.y, { vx: 0, vy: -30, magnet: true }); n++; }
      else if (n < 140) G.part({ x: b.x, y: b.y, type: 'dot', size: 2.5, life: 0.35, color: b.color, vy: -30 });
      n++;
    }
    // laser ainda avisando some; laser já ativo encerra logo
    for (const l of g.lasers) { if (l.t < l.warn) l.dead = true; else if (l.t < l.warn + l.life - 0.25) l.t = l.warn + l.life - 0.25; }
  };

  // ===================== Placar / aprovação =====================
  G.mult = function () { const g = G.game; return g ? 1 + g.approval / 25 : 1; };
  // Vidas extras por pontuação. Contam os pontos da partida inteira (run.total), que a recontagem
  // NÃO zera: cada marca só dá vida uma vez por partida.
  const EXTENDS = [500000, 1500000, 3000000, 6000000];
  function checkExtends(run) {
    while ((run.extGiven || 0) < EXTENDS.length && (run.total || 0) >= EXTENDS[run.extGiven || 0]) {
      run.extGiven = (run.extGiven || 0) + 1;
      run.lives = Math.min(9, run.lives + 1);
      G.text(G.W / 2, G.H * 0.45, 'VIDA EXTRA!', { color: '#ff5d8f', size: 18, life: 1.6, vy: -20 });
      call(G.Audio, 'sfx', 'extend');
    }
  }
  G.addScore = function (base, x, y, showText) {
    const run = G.run; if (!run) return 0;
    const pts = Math.round(base * G.mult());
    run.score += pts;
    run.total = (run.total || 0) + pts;
    if (run.total >= EXTENDS[run.extGiven || 0]) checkExtends(run);
    if (showText && x != null) G.text(x, y, G.fmt(pts), { color: '#fff', size: 10, life: 0.7 });
    return pts;
  };
  G.addApproval = function (v) { const g = G.game; if (!g) return; g.approval = M.clamp(g.approval + v, 0, 100); if (v > 0) g.approvalIdle = 0; };

  // ===================== Dano =====================
  G.hitEnemy = function (e, dmg) {
    const g = G.game;
    if (e.dead || e.invuln) return false;
    if (e.shieldT > 0) dmg *= 0.25;
    e.hp -= dmg;
    if (!(e.flashCd > 0)) { e.flash = 0.05; e.flashCd = 0.13; }
    if (e.def.onHit) call(e.def, 'onHit', e, dmg, g);
    if (e.hp <= 0 && !e.dead) G.killEnemy(e);
    return true;
  };
  G.killEnemy = function (e, opts) {
    const g = G.game;
    if (e.dead) return;
    e.dead = true;
    opts = opts || {};
    if (!opts.silent) {
      g.kills++;
      G.count('kills');
      G.addScore(e.score, e.x, e.y, e.big);
      G.addApproval(e.big ? 4 : 1.2);
      if (e.pix > 0) G.dropPix(e.x, e.y, e.pix);
      if (e.drop) {
        const list = Array.isArray(e.drop) ? e.drop : [e.drop];
        for (const d of list) { const it = G.drop(d, e.x, e.y, { vy: -120, wtype: d === 'power' && e.dropW ? e.dropW : undefined }); if (it && d === 'power' && e.dropW) it.wtype0 = e.dropW; }
      }
      const sz = e.big ? 3 : e.r > 20 ? 2 : 1;
      G.explode(e.x, e.y, sz);
      if (e.big) {
        G.text(e.x, e.y - 10, M.pick(['CASSADO!', 'RENUNCIOU!', 'IMPEACHMENT!', 'FICHA SUJA!']), { color: G.C.red, size: 16, life: 1.2, vy: -25 });
        G.hitstop(0.06);
      }
      call(G.Audio, 'sfx', sz >= 3 ? 'explode_l' : sz === 2 ? 'explode_m' : 'explode_s');
    }
    if (e.def.onDeath) call(e.def, 'onDeath', e, g, opts);
  };
  G.hitBoss = function (b, dmg) {
    const g = G.game;
    if (!b || b.state !== 'fight' || b.invuln || b.invulnT > 0) {
      if (b && Math.random() < 0.15) G.part({ x: b.x + M.rand(-20, 20), y: b.y + M.rand(-10, 30), type: 'dot', size: 2, color: '#9ad', life: 0.2 });
      return false;
    }
    dmg *= b.dmgMul != null ? b.dmgMul : 1;
    b.hp -= dmg;
    if (!(b.flashCd > 0)) { b.flash = 0.045; b.flashCd = 0.2; }
    G.game.approvalIdle = 0; // acertar o chefão segura a aprovação
    if (b.def.onHit) call(b.def, 'onHit', b, dmg, g);
    if (b.hp <= 0) {
      b.hp = 0;
      const keep = b.def.onDefeat ? call(b.def, 'onDefeat', b, g) : false;
      if (keep !== true) startBossDeath(b);
    }
    return true;
  };

  // ===================== Chefões =====================
  // Caixas de colisão do chefão: as do módulo, ou um círculo padrão reaproveitado (sem alocar por tiro).
  function bossBoxes(b) {
    if (b.hitboxes) return b.hitboxes;
    let d = b._hb;
    if (!d) d = b._hb = [{ dx: 0, dy: 0, r: b.r }];
    d[0].r = b.r;
    return d;
  }
  G.bossBoxes = bossBoxes;
  G.spawnBoss = function (id, o) {
    const g = G.game; if (!g) return null;
    const def = G.Bosses.defs[id];
    if (!def) { G.reportError('Chefão inexistente: ' + id, 'spawnBoss'); return null; }
    const hpMul = g.loop > 1 ? 1.25 : 1;
    const b = {
      id, def, name: def.name || id.toUpperCase(), title: def.title || '',
      x: G.W / 2, y: -160, homeX: G.W / 2, homeY: def.homeY || 150, r: def.r || 40, hitboxes: null,
      hp: (def.hp || 2000) * hpMul, t: 0, ft: 0, state: 'warning', flash: 0, invuln: true, invulnT: 0,
      phase: 0, phases: def.phases || [{ at: 1, name: '' }], dead: false, data: {}, mood: 'normal', mouth: 0,
      sayText: null, sayT: 0, dmgMul: 1, o: o || {},
    };
    b.maxHp = b.hp;
    g.boss = b;
    g.bombsUsedBoss = 0;
    if (def.init) call(def, 'init', b, g);
    G.banner('ALERTA!', 'CHEFÃO SE APROXIMANDO', { color: G.C.red, dur: 2.4 });
    call(G.Audio, 'sfx', 'warning');
    call(G.Audio, 'stopMusic');
    return b;
  };
  function bossPreDialogue(b) {
    const lines = G.STORY && G.STORY.boss && G.STORY.boss[b.id] && G.STORY.boss[b.id].pre;
    return lines && lines.length ? lines : null;
  }
  function updateBoss(dt) {
    const g = G.game, b = g.boss; if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.flashCd > 0) b.flashCd -= dt;
    b.invulnT = Math.max(0, b.invulnT - dt);
    if (b.sayT > 0) b.sayT -= dt;
    const def = b.def;
    if (b.state === 'warning') {
      if (b.t > 2.4) { b.state = 'enter'; b.t = 0; }
    } else if (b.state === 'enter') {
      const k = M.clamp(b.t / 2.2, 0, 1);
      b.y = M.lerp(-160, b.homeY, M.easeOutCubic(k));
      b.x = b.homeX;
      if (def.updateEnter) call(def, 'updateEnter', b, dt, g);
      if (k >= 1) {
        const lines = bossPreDialogue(b);
        const begin = () => {
          b.state = 'fight'; b.t = 0; b.ft = 0; b.invuln = false;
          call(G.Audio, 'music', def.music || (g.stage && g.stage.bossMusic) || 'boss');
          if (def.start) call(def, 'start', b, g);
          G.banner(b.name, b.title, { color: G.C.yellow, dur: 2 });
        };
        b.state = 'talk';
        if (lines && !G.debug.skipDialogue) G.dialogue(lines, begin); else begin();
      }
    } else if (b.state === 'fight') {
      b.ft += dt;
      if (def.update) call(def, 'update', b, dt, g);
      checkBossPhase(b);
    } else if (b.state === 'dying') {
      if (Math.random() < 0.35) {
        G.explode(b.x + M.rand(-b.r, b.r), b.y + M.rand(-b.r, b.r), 2, { confetti: true });
        call(G.Audio, 'sfx', 'explode_m');
      }
      b.x += Math.sin(b.t * 40) * 1.2;
      if (b.t > 2.6) {
        b.state = 'leaving'; b.t = 0;
        G.explode(b.x, b.y, 4);
        G.flash(0.8, '#fff');
        call(G.Audio, 'sfx', 'explode_l');
        g.stamp = { text: def.defeatText || 'CASSADO!', t: 0, x: b.x, y: b.y };
        call(G.Audio, 'sfx', 'stamp');
      }
    } else if (b.state === 'leaving') {
      if (b.t > 1.2) { b.y -= (b.t - 1.2) * 600 * dt; b.x += Math.sin(b.t * 3) * 60 * dt; }
      if (b.t > 3.2) { b.dead = true; g.boss = null; }
    }
  }
  function checkBossPhase(b) {
    const frac = b.hp / b.maxHp;
    let idx = 0;
    for (let i = 0; i < b.phases.length; i++) if (frac <= b.phases[i].at) idx = i;
    if (idx > b.phase) {
      b.phase = idx;
      b.invulnT = 1.0;
      G.clearBullets(false);
      G.hitstop(0.08);
      G.shake(5);
      G.flash(0.35, '#fff');
      const ph = b.phases[idx];
      // "º TURNO" (e não "FASE", que é o nome das etapas do jogo): ninguém aceita o resultado mesmo
      if (ph && ph.name) G.banner((idx + 1) + 'º TURNO', ph.name, { color: G.C.yellow, dur: 1.8, small: true });
      call(G.Audio, 'sfx', 'phase');
      if (b.def.onPhase) call(b.def, 'onPhase', b, idx, G.game);
    }
  }
  // Para o módulo do chefão trocar a lista de fases (ex.: Lule "voltou")
  G.setBossPhases = function (b, phases, hpFrac) {
    b.phases = phases; b.phase = 0;
    if (hpFrac != null) b.hp = b.maxHp * hpFrac;
  };
  function startBossDeath(b) {
    const g = G.game;
    b.state = 'dying'; b.t = 0; b.invuln = true;
    G.clearBullets(true);
    for (const e of g.enemies) G.killEnemy(e, { silent: false });
    G.hitstop(0.35);
    G.flash(0.6, '#fff');
    G.shake(10);
    call(G.Audio, 'stopMusic');
    call(G.Audio, 'sfx', 'boss_down');
    G.addScore(b.def.score || 100000, b.x, b.y, true);
    G.addApproval(30);
    G.dropPix(b.x, b.y, b.def.pix || 120, { magnet: false });
    G.count('boss_' + b.id);
    G.unlock(b.id);
    if (g.bombsUsedBoss === 0) G.unlock('bico_calado');
    if (b.def.onDeath) call(b.def, 'onDeath', b, g);
  }

  // ===================== Diálogo dentro da fase =====================
  G.dialogue = function (lines, done) {
    const g = G.game;
    const prev = G.state;
    if (g) { g.inDialogue = true; G.clearBullets(false); }
    G.state = 'dialogue';
    setPlayButtons(false);
    call(G.UI, 'dialogue', lines, () => {
      if (g) g.inDialogue = false;
      reanchor(); // um dedo que ficou na tela durante a conversa pilota de onde o carro está
      if (G.state === 'dialogue') G.state = prev === 'dialogue' ? 'play' : prev;
      if (G.state === 'play') setPlayButtons(true);
      if (done) safe(done, 'dialogue.done');
    });
  };

  // ===================== Roteiro da fase (geradores) =====================
  // A fase define script: function* (S) { ... yield 2; yield 'clear'; yield S.boss('lule'); }
  function makeStageAPI() {
    const S = {
      get g() { return G.game; },
      get W() { return G.W; },
      get H() { return G.H; },
      m: M,
      spawn: (kind, x, y, o) => G.spawnEnemy(kind, x, y, o),
      wait: (s) => s,
      // espera não haver inimigos (máx. timeout s)
      clear: (timeout) => ({ until: () => !G.game.enemies.some((e) => !e.dead && !e.ignoreClear), timeout: timeout || 25 }),
      boss: (id) => {
        G.spawnBoss(id);
        return { until: () => !G.game.boss };
      },
      banner: (t, s, o) => G.banner(t, s, o),
      music: (name) => call(G.Audio, 'music', name),
      dialogue: (lines) => { G.dialogue(lines); return { until: () => !G.game.inDialogue }; },
      // yield* S.repeat(5, 0.4, (i) => S.spawn(...))
      repeat: function* (n, interval, fn) { for (let i = 0; i < n; i++) { fn(i); if (i < n - 1) yield interval; } },
      drop: (type, x, y, o) => G.drop(type, x, y, o),
      text: (x, y, s, o) => G.text(x, y, s, o),
    };
    return S;
  }
  const STAGE_API = makeStageAPI();
  G.S = STAGE_API;
  function toWait(v) {
    if (v == null) return { t: 0.0001 };
    if (typeof v === 'number') return { t: v };
    if (typeof v === 'function') return { until: v, elapsed: 0 };
    if (v === 'clear') return { until: () => !G.game.enemies.some((e) => !e.dead && !e.ignoreClear), elapsed: 0, timeout: 25 };
    if (typeof v === 'object') return { until: v.until, timeout: v.timeout, elapsed: 0, t: v.t };
    return { t: 0.0001 };
  }
  function runScript(dt) {
    const g = G.game, sc = g.script;
    if (!sc || sc.done) return;
    if (sc.wait) {
      const w = sc.wait;
      if (typeof w.t === 'number') { w.t -= dt; if (w.t > 0) return; }
      else if (w.until) {
        w.elapsed += dt;
        let ok = false;
        try { ok = w.until(g); } catch (err) { G.reportError(err, 'script.until'); ok = true; }
        if (!ok && !(w.timeout && w.elapsed >= w.timeout)) return;
      }
      sc.wait = null;
    }
    let guard = 0;
    while (!sc.wait && !sc.done && guard++ < 200) {
      let r;
      try { r = sc.gen.next(); } catch (err) { G.reportError(err, 'stage.script'); sc.done = true; break; }
      if (r.done) { sc.done = true; break; }
      sc.wait = toWait(r.value);
    }
    if (sc.done && !g.cleared) { g.clearT = 1.6; g.cleared = true; }
  }

  // ===================== Jogador: armas =====================
  function shot(x, y, ang, spd, dmg, type, extra) {
    const g = G.game;
    const b = { x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, dmg, type, r: type === 'panela' ? 9 : 6, t: 0, dead: false };
    if (extra) Object.assign(b, extra);
    g.pb.push(b);
    return b;
  }
  const UP = -Math.PI / 2, DEG = Math.PI / 180;
  // VOTO: pares [deslocamento x, ângulo em graus] por nível
  const VOTO_SETS = [
    [-5, 0, 5, 0],
    [-8, 0, 0, 0, 8, 0],
    [-10, 0, -3.5, 0, 3.5, 0, 10, 0],
    [-10, 0, -3.5, 0, 3.5, 0, 10, 0, -14, -7, 14, 7],
    [-12, 0, -6, 0, 0, 0, 6, 0, 12, 0, -15, -8, 15, 8],
  ];
  // BOCA DE URNA: leque (n, abertura em graus) + um feixe central reto (ns tiros) em todo nível,
  // para não virar arma-armadilha contra chefão (o leque sozinho só acertava com o tiro do meio).
  const BOCA_N = [3, 5, 5, 7, 9], BOCA_SPREAD = [28, 46, 52, 66, 84], BOCA_CORE = [2, 3, 3, 4, 4];
  function fireWeapon(p) {
    const run = G.run, lv = run.level, w = run.weapon;
    const x = p.x, y = p.y - 14;
    if (w === 'voto') {
      const set = VOTO_SETS[lv - 1];
      for (let i = 0; i < set.length; i += 2) shot(x + set[i], y, UP + set[i + 1] * DEG, 640, 1, 'voto');
    } else if (w === 'boca') {
      const n = BOCA_N[lv - 1], spread = BOCA_SPREAD[lv - 1] * DEG, ns = BOCA_CORE[lv - 1];
      for (let i = 0; i < n; i++) shot(x, y, UP - spread / 2 + (spread * i) / (n - 1), 560, 0.7, 'boca');
      for (let i = 0; i < ns; i++) shot(x + (i - (ns - 1) / 2) * 6, y, UP, 620, 1.0, 'boca');
    } else if (w === 'panela') {
      shot(x, y, UP, 640, 0.7, 'voto');
      if (lv >= 4) { shot(x - 9, y, UP, 640, 0.6, 'voto'); shot(x + 9, y, UP, 640, 0.6, 'voto'); }
    }
    // jato é contínuo (ver updateBeam)
    if (w === 'jato' && lv >= 3) {
      shot(x - 10, y + 6, UP - 14 * DEG, 560, 0.55, 'gota');
      shot(x + 10, y + 6, UP + 14 * DEG, 560, 0.55, 'gota');
      if (lv >= 5) { shot(x - 12, y + 6, UP - 28 * DEG, 540, 0.5, 'gota'); shot(x + 12, y + 6, UP + 28 * DEG, 540, 0.5, 'gota'); }
    }
    call(G.Audio, 'sfx', 'shot_' + w);
  }
  function firePans(p) {
    const lv = G.run.level;
    const n = [1, 2, 2, 3, 4][lv - 1];
    for (let i = 0; i < n; i++) {
      const side = n === 1 ? (p.panSide = -(p.panSide || 1)) : i % 2 ? 1 : -1;
      const a = UP + side * (40 + (i >> 1) * 22) * DEG;
      shot(p.x + side * 10, p.y - 4, a, 300, 3.2, 'panela', { homing: true, spin: 0 });
    }
    call(G.Audio, 'sfx', 'shot_panela');
  }
  function fireInterval() {
    const base = { voto: 0.09, boca: 0.11, panela: 0.1, jato: 0.16 }[G.run.weapon] || 0.1;
    let k = 1 - 0.1 * G.upg('turbo');
    if (G.game.player.cafe > 0) k *= 0.66;
    return base * k;
  }
  function nearestTarget(x, y) {
    const g = G.game;
    let best = null, bd = 1e12;
    for (const e of g.enemies) {
      if (e.dead || e.invuln || e.y < -10 || e.y > G.H) continue;
      const d = M.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (g.boss && g.boss.state === 'fight' && !g.boss.invuln) {
      const d = M.dist2(x, y, g.boss.x, g.boss.y) * 0.8;
      if (d < bd) best = g.boss;
    }
    return best;
  }
  // LAVA-JATO: jato contínuo que atravessa a coluna. O primeiro alvo (o mais perto do carro) leva
  // dano cheio; os de trás levam 60% (chefes intermediários, "big", sempre levam cheio).
  const BEAM_HITS = [];
  const byYDesc = (a, b) => b.y - a.y;
  function updateBeam(dt) {
    const g = G.game, p = g.player, run = G.run;
    if (run.weapon !== 'jato' || !p.alive || !g.canFire) { g.beam = null; return; }
    const lv = run.level;
    const w = 7 + lv * 2.6;
    let dps = 20 + lv * 11;
    dps *= 1 + 0.1 * G.upg('turbo');
    if (p.cafe > 0) dps *= 1.35;
    const x0 = p.x, y0 = p.y - 16;
    let top = -10;
    const hits = BEAM_HITS;
    hits.length = 0;
    for (const e of g.enemies) {
      if (e.dead || e.invuln || e.y > y0 || e.y < -20) continue;
      if (Math.abs(e.x - x0) < e.r + w / 2) hits.push(e);
    }
    if (hits.length > 1) hits.sort(byYDesc);
    for (let i = 0; i < hits.length; i++) {
      const e = hits[i];
      G.hitEnemy(e, dps * dt * (i === 0 || e.big ? 1 : 0.6));
      if (Math.random() < 0.35) G.part({ x: e.x + M.rand(-6, 6), y: e.y + e.r * 0.5, vx: M.rand(-80, 80), vy: M.rand(-20, 60), type: 'dot', size: 2.5, color: '#bdf3ff', life: 0.3, grav: 300 });
    }
    hits.length = 0;
    const b = g.boss;
    if (b && b.state === 'fight') {
      const boxes = bossBoxes(b);
      for (const hb of boxes) {
        const bx = b.x + hb.dx, by = b.y + hb.dy;
        if (by < y0 && Math.abs(bx - x0) < hb.r + w / 2) {
          G.hitBoss(b, dps * dt);
          top = Math.max(top, by + hb.r * 0.6);
          if (Math.random() < 0.4) G.part({ x: x0 + M.rand(-w, w) / 2, y: by + hb.r * 0.6, vx: M.rand(-90, 90), vy: M.rand(0, 80), type: 'dot', size: 2.5, color: '#bdf3ff', life: 0.3, grav: 300 });
          break;
        }
      }
    }
    const bm = g.beam || (g.beam = { x: 0, y0: 0, top: 0, w: 0, t: 0 });
    bm.x = x0; bm.y0 = y0; bm.top = top; bm.w = w; bm.t += dt;
  }

  // ===================== Jogador: atualização =====================
  function updatePlayer(dt) {
    const g = G.game, p = g.player, run = G.run;
    p.t += dt;
    if (p.inv > 0) p.inv -= dt;
    if (p.cafe > 0) p.cafe -= dt;
    if (p.bombT > 0) p.bombT -= dt;
    if (!p.alive) {
      p.respawnT -= dt;
      if (p.respawnT <= 0) {
        if (run.lives <= 0) { gameOver(); return; }
        // o dedo que ficou na tela continua valendo: reancora quando o carro terminar de entrar
        p.alive = true; p.entering = true; p.x = G.W / 2; p.y = G.H + 30; p.tx = G.W / 2; p.ty = G.H * 0.8; p.inv = 3;
      }
      return;
    }
    if (p.entering) {
      p.y = M.approach(p.y, G.H * 0.8, 260 * dt);
      p.x = M.approach(p.x, G.W / 2, 260 * dt);
      p.tx = p.x; p.ty = p.y;
      if (Math.abs(p.y - G.H * 0.8) < 1) { p.entering = false; reanchor(); }
    } else {
      const k = input.keys;
      const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0), ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (kx || ky) {
        const spd = k.slow ? 115 : 235, n = kx && ky ? Math.SQRT1_2 : 1;
        p.tx = p.x + kx * spd * n * dt; p.ty = p.y + ky * spd * n * dt;
      }
      if (G.debug.auto) autopilot(p, dt);
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), maxStep = 1500 * dt;
      if (d > maxStep) { p.x += (dx / d) * maxStep; p.y += (dy / d) * maxStep; } else { p.x = p.tx; p.y = p.ty; }
      p.x = M.clamp(p.x, 12, G.W - 12);
      p.y = M.clamp(p.y, 50, G.H - 24);
    }
    const vx = (p.x - p.lastX) / dt;
    p.tilt = M.lerp(p.tilt, M.clamp(vx / 400, -1, 1), 0.25);
    p.lastX = p.x;
    // tiro automático
    if (g.canFire) {
      p.fireT -= dt;
      if (p.fireT <= 0) { fireWeapon(p); p.fireT += fireInterval(); if (p.fireT < 0) p.fireT = 0; }
      if (run.weapon === 'panela') {
        p.panT -= dt;
        if (p.panT <= 0) { firePans(p); p.panT = (run.level >= 3 ? 0.22 : 0.27) * (1 - 0.1 * G.upg('turbo')) * (p.cafe > 0 ? 0.66 : 1); }
      }
    }
  }
  // Piloto automático simples (debug/testes): fica embaixo do alvo e foge de tiros próximos
  function autopilot(p) {
    const g = G.game;
    let tx = G.W / 2;
    const tgt = g.boss && g.boss.state === 'fight' ? g.boss : nearestTarget(p.x, p.y);
    if (tgt) tx = tgt.x;
    let ty = G.H * 0.82;
    let fx = 0, fy = 0;
    for (const b of g.eb) {
      const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 3600 && d2 > 0.01) { const d = Math.sqrt(d2); fx += (dx / d) * (60 - d); fy += (dy / d) * (60 - d); }
    }
    p.tx = M.clamp(M.lerp(p.x, tx, 0.08) + fx * 0.5, 12, G.W - 12);
    p.ty = M.clamp(M.lerp(p.y, ty, 0.08) + fy * 0.3, 50, G.H - 24);
  }

  function hurtPlayer() {
    const g = G.game, p = g.player, run = G.run;
    if (!p.alive || p.inv > 0 || p.bombT > 0 || p.entering || G.debug.god) return;
    if (p.shield) {
      p.shield = false; p.inv = 1.6;
      G.part({ x: p.x, y: p.y, type: 'ring', size: 30, life: 0.4, color: '#4cc9f0' });
      G.burst(p.x, p.y, 16, { colors: ['#4cc9f0', '#ffffff'], speed: 200 });
      G.text(p.x, p.y - 20, 'HABEAS CORPUS!', { color: '#4cc9f0', size: 13 });
      clearNear(p.x, p.y, 70);
      call(G.Audio, 'sfx', 'shield_break');
      G.vibrate(60);
      return;
    }
    p.alive = false;
    p.respawnT = 1.5;
    run.lives--;
    g.hits++; run.hits = (run.hits || 0) + 1;
    G.count('deaths');
    g.approval *= 0.4;
    G.explode(p.x, p.y, 3, { colors: ['#7ec8e3', '#ffffff', '#ffd23f', '#ff8c1a'] });
    G.flash(0.5, '#ff3355');
    G.shake(10);
    G.hitstop(0.12);
    G.vibrate(220);
    call(G.Audio, 'sfx', 'player_die');
    const lostLevel = run.level > 1;
    run.level = Math.max(1, run.level - 1);
    run.pp = Math.min(run.pp || 0, Math.max(0, powerNeed(run.level) - 1));
    // o nível perdido cai como um P "de volta" (cor da arma, sem piscar): pegou, recupera o nível na hora
    if (lostLevel) G.drop('power', p.x, Math.min(p.y, G.H * 0.6), { vy: -200, wtype: run.weapon, cycle: false, restore: true });
    else if (M.chance(0.5)) G.drop('power', p.x, Math.min(p.y, G.H * 0.6), { vy: -200, wtype: run.weapon });
    run.bombs = Math.max(run.bombs, run.baseBombs);
    G.clearBullets(false);
    g.beam = null;
  }
  function clearNear(x, y, r) {
    const g = G.game;
    for (const b of g.eb) if (!b.dead && M.dist2(x, y, b.x, b.y) < r * r) { b.dead = true; G.part({ x: b.x, y: b.y, type: 'dot', size: 2, color: b.color, life: 0.3 }); }
  }

  // Bomba: DELAÇÃO PREMIADA
  G.bomb = function () {
    const g = G.game, run = G.run;
    if (!g || G.state !== 'play' || !g.player.alive || g.player.entering || g.resumeT > 0) return false;
    if (run.bombs <= 0 || g.player.bombT > 0) { if (run.bombs <= 0) call(G.Audio, 'sfx', 'denied'); return false; }
    // Não gasta à toa: cinemática da volta do Lule (invulnerável e inofensivo), chefão já caindo, fase acabando.
    const bs = g.boss;
    if (g.cleared || (bs && (bs.state === 'dying' || bs.state === 'leaving' || (bs.state === 'fight' && ((bs.invuln && bs.harmless) || (bs.data && bs.data.reviving)))))) {
      call(G.Audio, 'sfx', 'denied');
      return false;
    }
    run.bombs--;
    g.bombsUsed++; g.bombsUsedBoss++;
    const p = g.player;
    p.bombT = 3.0;
    g.bombFx = { t: 0, x: p.x, y: p.y };
    G.clearBullets(true);
    for (const e of g.enemies) if (!e.dead) G.hitEnemy(e, e.big ? 30 : 45);
    if (g.boss && g.boss.state === 'fight' && !g.boss.invuln && g.boss.invulnT <= 0) G.hitBoss(g.boss, Math.min(220, g.boss.maxHp * 0.045));
    G.flash(0.9, '#ffffff');
    G.shake(9);
    G.hitstop(0.1);
    G.text(G.W / 2, G.H * 0.42, 'DELAÇÃO PREMIADA!', { color: G.C.yellow, size: 20, life: 1.6, vy: -15 });
    for (let i = 0; i < 40; i++) G.part({ x: p.x, y: p.y, vx: M.rand(-320, 320), vy: M.rand(-420, 120), type: 'paper', size: M.rand(4, 7), life: M.rand(0.9, 1.6), color: M.pick(['#ffffff', '#f4f1e8', '#ffd23f']), drag: 0.96, grav: 120, rot: M.rand(0, TAU), vr: M.rand(-10, 10) });
    call(G.Audio, 'sfx', 'bomb');
    G.vibrate(120);
    return true;
  };

  // Quantos P para subir do nível lv para lv+1
  const POWER_NEED = [0, 1, 2, 3, 3];
  function powerNeed(lv) { return POWER_NEED[lv] || 3; }
  G.powerNeed = powerNeed;
  function collectPickup(it) {
    const g = G.game, run = G.run, p = g.player;
    it.dead = true;
    switch (it.type) {
      case 'pix': case 'pix5': case 'mala': {
        const v = it.type === 'pix' ? 1 : it.type === 'pix5' ? 5 : 25;
        run.pix += v; g.pixStage += v;
        G.addScore(v * 20);
        if (it.type !== 'pix') G.text(it.x, it.y - 8, '+R$ ' + v, { color: G.C.pix, size: 11, life: 0.7 });
        call(G.Audio, 'sfx', it.type === 'pix' ? 'pix' : 'pix_big');
        return;
      }
      case 'power': {
        // Todo P fortalece a arma (barra de progresso: 1, 2, 3, 3 P por nível); a cor escolhe QUAL arma.
        // O P "de volta" (caiu na morte) devolve um nível inteiro na hora, seja qual for a cor.
        const wcol = (w) => (G.WEAPONS[w] || G.WEAPONS.voto).color;
        let switched = false;
        if (!it.restore && it.wtype && it.wtype !== run.weapon && G.WEAPONS[it.wtype]) { run.weapon = it.wtype; switched = true; }
        let msg = null;
        if (run.level >= G.MAX_LEVEL) {
          G.addScore(5000, it.x, it.y, true);
          msg = switched ? G.WEAPONS[run.weapon].name + '!' : 'NÍVEL MÁXIMO';
        } else if (it.restore) {
          run.level++;
          msg = 'NÍVEL ' + run.level + ' DE VOLTA!';
        } else {
          run.pp = (run.pp || 0) + 1;
          const need = powerNeed(run.level);
          if (run.pp >= need) {
            run.pp = 0; run.level++;
            msg = (switched ? G.WEAPONS[run.weapon].name + ' ' : '') + 'NÍVEL ' + run.level + '!';
          } else {
            msg = (switched ? G.WEAPONS[run.weapon].name + ' · ' : 'FORÇA ') + run.pp + '/' + need;
          }
        }
        G.text(p.x, p.y - 24, msg, { color: wcol(run.weapon), size: 13 });
        if (run.level >= G.MAX_LEVEL) G.unlock('arsenal');
        G.addScore(1000);
        call(G.Audio, 'sfx', 'powerup');
        return;
      }
      case 'bomb':
        run.bombs = Math.min(6, run.bombs + 1);
        G.text(p.x, p.y - 24, '+1 DELAÇÃO', { color: G.C.paper, size: 12 });
        call(G.Audio, 'sfx', 'item'); return;
      case 'shield':
        p.shield = true;
        G.text(p.x, p.y - 24, 'HABEAS CORPUS', { color: '#4cc9f0', size: 12 });
        call(G.Audio, 'sfx', 'item'); return;
      case 'life':
        run.lives = Math.min(9, run.lives + 1);
        G.text(p.x, p.y - 24, '13º SALÁRIO! +1 VIDA', { color: '#ff5d8f', size: 13 });
        call(G.Audio, 'sfx', 'extend'); return;
      case 'cafe':
        p.cafe = 10;
        G.text(p.x, p.y - 24, 'CAFEZINHO!', { color: '#d4a373', size: 12 });
        call(G.Audio, 'sfx', 'item'); return;
    }
  }

  // ===================== Atualização do mundo =====================
  function compact(arr) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) { const o = arr[i]; if (!o.dead) arr[j++] = o; }
    arr.length = j;
  }
  function updateGame(dt) {
    const g = G.game, p = g.player, run = G.run;
    // volta da pausa: mundo congelado por ~1 s ("PRONTO? VAI!") para o dedão voltar à tela.
    // Nada se mexe (nem o carro, então pausar não serve de truque); um toque novo já ancora o dedo.
    if (g.resumeT > 0) { g.resumeT -= dt; reanchor(); return; }
    if (g.hitstop > 0) { g.hitstop -= dt; return; }
    g.t += dt; g.frame++;
    g.scrollY += g.scrollSpeed * dt;
    if (!g.canFire) { g.introT += dt; if (g.introT > 0.6 && !p.entering) g.canFire = true; }
    if (G.state === 'play') runScript(dt);
    updatePlayer(dt);
    if (G.state !== 'play' && G.state !== 'clear') return; // gameOver pode mudar o estado
    updateBeam(dt);

    // --- tiros do jogador ---
    const W = G.W, H = G.H;
    for (const b of g.pb) {
      b.t += dt;
      if (b.homing) {
        b.spin += dt * 14;
        if (b.t > 0.12) {
          if (!b.target || b.target.dead || (b.target.state && b.target.state !== 'fight')) b.target = nearestTarget(b.x, b.y);
          let a = Math.atan2(b.vy, b.vx);
          let sp = Math.min(560, Math.hypot(b.vx, b.vy) + 900 * dt);
          if (b.target) { const want = Math.atan2(b.target.y - b.y, b.target.x - b.x); a += M.clamp(M.wrapAngle(want - a), -7 * dt, 7 * dt); }
          b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30 || b.t > 3) b.dead = true;
    }
    // colisão tiro do jogador x inimigos/chefão
    const boss = g.boss;
    for (const b of g.pb) {
      if (b.dead) continue;
      for (const e of g.enemies) {
        if (e.dead || e.invuln) continue;
        const rr = e.r + b.r;
        if (M.dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          G.hitEnemy(e, b.dmg);
          b.dead = true;
          hitSpark(b);
          break;
        }
      }
      if (b.dead || !boss || boss.state !== 'fight') continue;
      const boxes = bossBoxes(boss);
      for (const hb of boxes) {
        const rr = hb.r + b.r;
        if (M.dist2(b.x, b.y, boss.x + hb.dx, boss.y + hb.dy) < rr * rr) {
          const ok = G.hitBoss(boss, b.dmg);
          b.dead = true;
          hitSpark(b, !ok);
          break;
        }
      }
    }

    // --- inimigos ---
    for (const e of g.enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.flashCd > 0) e.flashCd -= dt;
      if (e.shieldT > 0) e.shieldT -= dt;
      if (e.sayT > 0) e.sayT -= dt;
      if (e.def.update) call(e.def, 'update', e, dt, g);
      else { e.x += e.vx * dt; e.y += e.vy * dt; }
      if (!e.def.keepOffscreen && e.t > 1.5 && (e.y > H + 90 || e.x < -110 || e.x > W + 110 || (e.y < -240 && e.t > 8))) { e.dead = true; e.escaped = true; }
      // contato com o jogador
      if (!e.dead && !e.harmless && !e.invuln && p.alive) {
        const rr = e.r * 0.75 + p.r;
        if (M.dist2(e.x, e.y, p.x, p.y) < rr * rr) hurtPlayer();
      }
    }
    if (boss) {
      updateBoss(dt);
      if (boss.state === 'fight' && p.alive && !boss.harmless) {
        const boxes = bossBoxes(boss);
        for (const hb of boxes) {
          const rr = hb.r * 0.7 + p.r;
          if (M.dist2(boss.x + hb.dx, boss.y + hb.dy, p.x, p.y) < rr * rr) { hurtPlayer(); break; }
        }
      }
    }

    // --- tiros inimigos ---
    const pr = p.r, gr = p.grazeR;
    if (g.grazeSfxT > 0) g.grazeSfxT -= dt;
    for (const b of g.eb) {
      if (b.dead) continue;
      b.t += dt;
      if (b.delay > 0) { b.delay -= dt; continue; }
      if (b.accel) { b.spd = M.clamp(b.spd + b.accel * dt, b.minSpd, b.maxSpd); }
      if (b.turn) b.ang += b.turn * dt;
      if (b.accel || b.turn) { b.vx = Math.cos(b.ang) * b.spd; b.vy = Math.sin(b.ang) * b.spd; }
      if (b.ax || b.ay) { b.vx += b.ax * dt; b.vy += b.ay * dt; }
      if (b.update) { try { b.update(b, dt, g); } catch (err) { G.reportError(err, 'bullet.update'); b.update = null; } }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.spin) b.rot += b.spin * dt; else if (b.vx || b.vy) b.rot = Math.atan2(b.vy, b.vx);
      if (b.t > b.life || (!b.keep && b.t > 0.3 && (b.x < -50 || b.x > W + 50 || b.y < -80 || b.y > H + 50))) { b.dead = true; continue; }
      if (!p.alive || p.entering) continue;
      const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
      const hr = pr + b.r * 0.8;
      if (d2 < hr * hr) {
        if (p.bombT > 0 || p.inv > 0 || G.debug.god) { if (p.bombT > 0) b.dead = true; continue; }
        b.dead = true;
        hurtPlayer();
        continue;
      }
      if (!b.grazed && d2 < (gr + b.r) * (gr + b.r) && p.inv <= 0) {
        b.grazed = true;
        g.grazes++; run.grazes++;
        G.addScore(40);
        G.addApproval(0.3);
        g.delacao += 1.4;
        if (g.delacao >= 100) {
          g.delacao = 0;
          G.drop('bomb', p.x, p.y - 60, { vy: -60, magnet: true });
          G.text(p.x, p.y - 30, 'DELAÇÃO CARREGADA!', { color: G.C.yellow, size: 12 });
        }
        G.part({ x: (b.x + p.x) / 2, y: (b.y + p.y) / 2, type: 'spark', size: 2, color: '#ffffff', life: 0.2, vx: dx * 4, vy: dy * 4 });
        if (g.grazeSfxT <= 0) { call(G.Audio, 'sfx', 'graze'); g.grazeSfxT = 0.06; }
        if (run.grazes === 300) G.unlock('por_um_fio');
      }
    }

    // --- lasers ---
    for (const l of g.lasers) {
      l.t += dt;
      if (l.owner) { l.x = l.owner.x + l.ox; l.y = l.owner.y + l.oy; if (l.owner.dead) l.t = Math.max(l.t, l.warn + l.life - 0.2); }
      if (l.update) { try { l.update(l, dt, g); } catch (err) { G.reportError(err, 'laser.update'); l.update = null; } }
      l.ang += l.sweep * dt;
      if (l.t > l.warn + l.life) { l.dead = true; continue; }
      if (l.t >= l.warn && l.t < l.warn + l.life - 0.1 && p.alive && !p.entering) {
        const ex = l.x + Math.cos(l.ang) * l.len, ey = l.y + Math.sin(l.ang) * l.len;
        const hr = p.r + l.width * 0.38;
        if (M.segDist2(p.x, p.y, l.x, l.y, ex, ey) < hr * hr) hurtPlayer();
        if (!l.sfx) { l.sfx = true; call(G.Audio, 'sfx', 'laser'); }
      }
    }

    // --- itens ---
    // o ímã (Chave Pix) e a coleta automática no alto da tela NÃO puxam o P: a cor é escolha do jogador
    const magR = 46 + G.upg('ima') * 28;
    const autoCollect = p.alive && p.y < H * 0.3;
    for (const it of g.pickups) {
      if (it.dead) continue;
      it.t += dt;
      if (it.type === 'power' && it.cycle && it.t > 0.5) {
        const idx = Math.floor((it.t - 0.5) / G.POWER_CYCLE) % 4;
        const start = G.WEAPON_ORDER.indexOf(it.wtype0 || (it.wtype0 = it.wtype));
        it.wtype = G.WEAPON_ORDER[(start + idx) % 4];
      }
      const d2 = M.dist2(it.x, it.y, p.x, p.y);
      const isP = it.type === 'power' && !it.restore; // o P "de volta" (morte) pode ser puxado: cor não importa
      const pull = isP ? 30 : magR;
      if (p.alive && (it.magnet || (autoCollect && !isP) || d2 < pull * pull)) {
        const a = Math.atan2(p.y - it.y, p.x - it.x);
        const sp = 520;
        it.vx = M.lerp(it.vx, Math.cos(a) * sp, 0.25); it.vy = M.lerp(it.vy, Math.sin(a) * sp, 0.25);
      } else {
        it.vx *= 0.96;
        it.vy = Math.min(it.vy + 240 * dt, it.type === 'pix' ? 80 : 60);
      }
      it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.type !== 'pix' && it.type !== 'pix5' && it.type !== 'mala') it.x = M.clamp(it.x, 10, W - 10);
      if (p.alive && d2 < (it.r + 14) * (it.r + 14)) collectPickup(it);
      if (it.y > H + 30 || it.t > 25) it.dead = true;
    }

    // --- partículas, textos ---
    for (const q of g.parts) {
      q.t += dt;
      if (q.t >= q.life) { q.dead = true; continue; }
      const k = q.drag; // passo fixo de 1/60: pow(drag, dt*60) === drag
      q.vx *= k; q.vy = q.vy * k + q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    }
    for (const tx of g.texts) { tx.t += dt; tx.y += tx.vy * dt; if (tx.t > tx.life) tx.dead = true; }
    if (g.banner) { g.banner.t += dt; if (g.banner.t > g.banner.dur) g.banner = null; }
    if (g.stamp) { g.stamp.t += dt; if (g.stamp.t > 3) g.stamp = null; }
    if (g.bombFx) { g.bombFx.t += dt; if (g.bombFx.t < 1.1) G.clearBullets(true); if (g.bombFx.t > 1.4) g.bombFx = null; }
    g.shake = Math.max(0, g.shake - dt * 30);
    g.flashA = Math.max(0, g.flashA - dt * 2.2);
    // aprovação cai devagar quando você não derruba ninguém
    g.approvalIdle += dt;
    if (g.approvalIdle > 2.5) g.approval = Math.max(0, g.approval - dt * 3);

    compact(g.pb); compact(g.eb); compact(g.enemies); compact(g.pickups); compact(g.parts); compact(g.texts); compact(g.lasers);

    // fim da fase
    if (g.cleared && G.state === 'play') {
      g.clearT -= dt;
      for (const it of g.pickups) { it.magnet = true; if (it.type === 'power') lockPower(it); }
      if (g.clearT <= 0) G.stageClear();
    }
  }
  // P puxado no fim da fase vira da arma atual (sobe o nível / vale pontos), sem trocar de arma sem querer
  function lockPower(it) { if (!it.restore && G.run) { it.wtype = G.run.weapon; it.cycle = false; } }
  function hitSpark(b, tink) {
    const c = tink ? '#9ab' : b.type === 'voto' ? '#b9ffd6' : b.type === 'boca' ? '#fff1a8' : b.type === 'panela' ? '#ffffff' : '#bdf3ff';
    G.part({ x: b.x, y: b.y, type: 'dot', size: tink ? 1.5 : 2.5, color: c, life: 0.15, vy: 40 });
    if (b.type === 'panela') { G.burst(b.x, b.y, 4, { colors: ['#ffffff', '#c9d3e6'], speed: 150, life: 0.25 }); call(G.Audio, 'sfx', 'pan_hit'); }
    else call(G.Audio, 'sfx', tink ? 'tink' : 'hit');
  }

  // ===================== Renderização =====================
  function render() {
    const g = G.game;
    const k = scale * dpr;
    let ox = 0, oy = 0;
    if (g && g.shake > 0 && G.state !== 'pause') { ox = M.rand(-g.shake, g.shake); oy = M.rand(-g.shake, g.shake); }
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    const W = G.W, H = G.H;
    const stageId = g && g.stage ? g.stage.bg || g.stage.id : 'menu';
    const scroll = g ? g.scrollY : menuT * 30;
    const tt = g ? g.t : menuT;
    if (G.state === 'menu' || G.state === 'boot' || !g) {
      // telas opacas do menu cobrem tudo: não precisa desenhar o fundo
      const kind = G.UI && G.UI.current ? safe(G.UI.current, 'ui.current') : null;
      if (!/^(title|story|roll)$/.test(kind || '')) call(G.BG, 'draw', ctx, 'menu', menuT * 30, menuT, W, H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    const bgOk = call(G.BG, 'draw', ctx, stageId, scroll, tt, W, H);
    if (bgOk === undefined && G.errors.length && /bg\.draw/.test(G.errors[G.errors.length - 1])) { ctx.fillStyle = '#0d1b3d'; ctx.fillRect(-20, -20, W + 40, H + 40); }

    // itens
    for (const it of g.pickups) {
      const blink = it.t > 20 && ((it.t * 8) | 0) % 2;
      if (!blink) call(G.Art, 'pickup', ctx, it.type, it.x, it.y, it.t, it);
    }
    // inimigos
    for (const e of g.enemies) {
      if (e.dead) continue;
      ctx.save();
      if (e.def.draw) call(e.def, 'draw', ctx, e, g);
      else G.Art.person(ctx, e.x, e.y, e.r * 2.4, {}, { t: e.t, flash: e.flash > 0 });
      ctx.restore();
      if (e.shieldT > 0) {
        ctx.strokeStyle = 'rgba(255,210,63,' + (0.5 + 0.3 * Math.sin(g.t * 20)) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, TAU); ctx.stroke();
      }
    }
    // chefão
    const b = g.boss;
    if (b && b.state !== 'warning') {
      ctx.save();
      if (b.def.draw) call(b.def, 'draw', ctx, b, g);
      else G.Art.person(ctx, b.x, b.y, b.r * 2.6, {}, { t: b.t, flash: b.flash > 0, mood: b.mood, mouth: b.mouth });
      ctx.restore();
      if (b.state === 'leaving' && b.t > 1.2) { /* sai voando */ }
    }
    // jato d'água
    if (g.beam) drawBeam(g.beam);
    // tiros do jogador
    drawPlayerShots(g);
    // jogador
    const p = g.player;
    if (p.alive) {
      const blink = p.inv > 0 && ((p.t * 16) | 0) % 2 === 0 && !p.entering;
      if (!blink) {
        const po = PLAYER_DRAW_OPTS;
        po.t = p.t; po.tilt = p.tilt; po.shield = p.shield; po.weapon = G.run.weapon; po.level = G.run.level; po.cafe = p.cafe > 0; po.bomb = p.bombT > 0;
        call(G.Art, 'player', ctx, p.x, p.y, po);
      }
      if (p.shield) {
        ctx.strokeStyle = 'rgba(76,201,240,' + (0.55 + 0.25 * Math.sin(p.t * 8)) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, TAU); ctx.stroke();
      }
      if (G.save.settings.hitbox && !p.entering) {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#e63946'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 0.8, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    // partículas
    drawParticles(g, k, ox, oy);
    // balões de fala (por baixo dos tiros inimigos: um balão nunca esconde uma bala)
    for (const e of g.enemies) if (e.sayT > 0 && e.sayText) drawBubble(e.x, e.y - (e.bubbleY || e.r + 8), e.sayText);
    if (b && b.sayT > 0 && b.sayText) drawBubble(b.x, b.y - (b.bubbleY || b.r + 14), b.sayText);
    // tiros inimigos (sempre por cima, para ficarem legíveis)
    drawEnemyBullets(g, k, ox, oy);
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    // lasers
    for (const l of g.lasers) drawLaser(l, g);
    // textos flutuantes
    for (const tx of g.texts) {
      const a = M.clamp(1 - (tx.t / tx.life) * (tx.t / tx.life), 0, 1);
      ctx.globalAlpha = a;
      const sz = tx.size * (tx.t < 0.1 ? 0.6 + tx.t * 4 : 1);
      ctx.font = sz + 'px ' + tx.font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (tx.stroke) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(tx.str, tx.x, tx.y); }
      ctx.fillStyle = tx.color; ctx.fillText(tx.str, tx.x, tx.y);
      ctx.globalAlpha = 1;
    }
    if (g.stamp) drawStamp(g.stamp);
    // efeito da bomba
    if (g.bombFx) {
      const t = g.bombFx.t;
      ctx.strokeStyle = 'rgba(255,240,180,' + Math.max(0, 1 - t) + ')'; ctx.lineWidth = 10 * (1 - t * 0.6);
      ctx.beginPath(); ctx.arc(g.bombFx.x, g.bombFx.y, t * 700, 0, TAU); ctx.stroke();
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawHUD(g, k);
    if (g.banner) drawBanner(g.banner);
    if (g.resumeT > 0 && G.state === 'play') drawResume(g.resumeT);
    if (b && b.state === 'warning') drawWarning(b.t);
    if (g.flashA > 0) { ctx.globalAlpha = Math.min(1, g.flashA); ctx.fillStyle = g.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (G.debug.hitboxes) drawDebugHitboxes(g);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  const PLAYER_DRAW_OPTS = {};
  // "PRONTO? ... VAI!" na volta da pausa
  function drawResume(t) {
    const go = t < RESUME_T * 0.4;
    const txt = go ? 'VAI!' : 'PRONTO?';
    const k = go ? 1 + (RESUME_T * 0.4 - t) * 1.2 : 1;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,22,' + (go ? 0.15 : 0.35) + ')'; ctx.fillRect(0, 0, G.W, G.H);
    ctx.translate(G.W / 2, G.H * 0.45); ctx.scale(k, k);
    ctx.globalAlpha = go ? Math.min(1, t / (RESUME_T * 0.4) + 0.2) : 1;
    ctx.font = (go ? 44 : 34) + 'px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = go ? G.C.greenL : G.C.yellow; ctx.fillText(txt, 0, 0);
    if (!go) { ctx.font = '700 14px ' + G.FONT_BODY; ctx.fillStyle = '#fff'; ctx.fillText('ENCOSTE O DEDO NA TELA', 0, 34); }
    ctx.restore();
  }
  function drawPlayerShots(g) {
    for (const b of g.pb) {
      if (b.type === 'voto') {
        ctx.fillStyle = 'rgba(61,220,132,0.35)'; ctx.fillRect(b.x - 3, b.y - 6, 6, 16);
        ctx.fillStyle = '#b9ffd6'; ctx.fillRect(b.x - 1.6, b.y - 7, 3.2, 12);
      } else if (b.type === 'boca') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ctx.fillStyle = 'rgba(255,210,63,0.35)'; ctx.fillRect(-3.5, -6, 7, 12);
        ctx.fillStyle = '#fff4c2'; ctx.fillRect(-2, -5, 4, 9);
        ctx.restore();
      } else if (b.type === 'panela') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin || 0);
        ctx.fillStyle = '#5b6375'; ctx.fillRect(4, -1.5, 9, 3);
        ctx.fillStyle = '#d7deea'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9aa5b8'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
        ctx.restore();
      } else if (b.type === 'gota') {
        ctx.fillStyle = 'rgba(76,201,240,0.45)'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, TAU); ctx.fill();
      }
    }
  }
  function drawBeam(bm) {
    const top = bm.top, x = bm.x, w = bm.w, h = bm.y0 - top;
    if (h <= 0) return;
    const wob = Math.sin(bm.t * 40) * 1.2;
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(x - w * 0.9 + wob, top, w * 1.8, h);
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#7fe0ff';
    ctx.fillRect(x - w / 2 - wob, top, w, h);
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w * 0.18, top, w * 0.36, h);
    // gotas subindo
    ctx.fillStyle = '#e8fbff';
    for (let i = 0; i < 6; i++) {
      const yy = bm.y0 - ((bm.t * 900 + i * 97) % h);
      ctx.fillRect(x + Math.sin(i * 7 + bm.t * 30) * w * 0.6 - 1, yy, 2, 6);
    }
    // boca do jato
    ctx.fillStyle = 'rgba(232,251,255,0.9)';
    ctx.beginPath(); ctx.ellipse(x, bm.y0, w * 0.9, 5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawEnemyBullets(g, k, ox, oy) {
    const tx = ox * k, ty = oy * k;
    for (const b of g.eb) {
      if (b.dead) continue;
      const def = BS.defs[b.style] || BS.defs.orb;
      const spr = BS.sprite(b.style, b.color);
      const s = spr._s;
      let alpha = 1;
      if (b.delay > 0) alpha = 0.35;
      else if (b.t < 0.08) alpha = 0.5 + b.t * 6;
      ctx.globalAlpha = alpha;
      if (def.rotate || b.spin) {
        const a = def.rotate && !b.spin ? b.rot : b.rot;
        const c = Math.cos(a) * k, sn = Math.sin(a) * k;
        ctx.setTransform(c, sn, -sn, c, b.x * k + tx, b.y * k + ty);
        ctx.drawImage(spr, -s / 2, -s / 2, s, s);
      } else {
        ctx.setTransform(k, 0, 0, k, b.x * k + tx, b.y * k + ty);
        ctx.drawImage(spr, -s / 2, -s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawLaser(l) {
    const ex = l.x + Math.cos(l.ang) * l.len, ey = l.y + Math.sin(l.ang) * l.len;
    ctx.save();
    ctx.lineCap = 'round';
    if (l.t < l.warn) {
      const a = 0.35 + 0.35 * Math.sin(l.t * 30);
      ctx.strokeStyle = l.color; ctx.globalAlpha = a; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]); ctx.lineDashOffset = -l.t * 60;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const lt = l.t - l.warn;
      const fadeIn = Math.min(1, lt / 0.08), fadeOut = Math.min(1, (l.life - lt) / 0.15);
      const w = l.width * fadeIn * Math.max(0, fadeOut) * (1 + Math.sin(l.t * 50) * 0.06);
      ctx.globalAlpha = 0.4; ctx.strokeStyle = l.color; ctx.lineWidth = w * 1.8;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w * 0.4; ctx.stroke();
    }
    ctx.restore();
  }
  function drawParticles(g, k, ox, oy) {
    const tx = ox * k, ty = oy * k;
    let moved = false; // o 'paper' usa setTransform direto (sem save/restore por papel)
    for (const q of g.parts) {
      const f = 1 - q.t / q.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, f * 1.4)) * q.alpha;
      if (q.type === 'paper') {
        const c = Math.cos(q.rot), sn = Math.sin(q.rot), sy = Math.abs(Math.cos(q.rot * 1.7)) + 0.2;
        ctx.setTransform(k * c, k * sn, -k * sn * sy, k * c * sy, q.x * k + tx, q.y * k + ty);
        ctx.fillStyle = q.color; ctx.fillRect(-q.size * 0.6, -q.size * 0.8, q.size * 1.2, q.size * 1.6);
        moved = true;
        continue;
      }
      if (moved) { ctx.setTransform(k, 0, 0, k, tx, ty); moved = false; }
      switch (q.type) {
        case 'spark': {
          ctx.strokeStyle = q.color; ctx.lineWidth = q.size * 0.7;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); ctx.stroke();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = q.color; ctx.lineWidth = 3 * f + 0.5;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + (1 - f) * 3), 0, TAU); ctx.stroke();
          break;
        }
        case 'flash': {
          ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.6 + f * 0.6), 0, TAU); ctx.fill();
          break;
        }
        case 'smoke': {
          ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.4 - f * 0.6), 0, TAU); ctx.fill();
          break;
        }
        default: {
          ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + f * 0.6), 0, TAU); ctx.fill();
        }
      }
    }
    if (moved) ctx.setTransform(k, 0, 0, k, tx, ty);
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  G.roundRect = (c, x, y, w, h, r) => { const old = ctx; ctx = c; roundRect(x, y, w, h, r); ctx = old; };
  function drawBubble(x, y, text) {
    ctx.font = '700 12px ' + G.FONT_BODY;
    const w = Math.min(200, ctx.measureText(text).width + 16), h = 22;
    let bx = M.clamp(x - w / 2, 4, G.W - w - 4);
    const by = Math.max(4, y - h - 8);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#101418'; ctx.lineWidth = 2;
    roundRect(bx, by, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(M.clamp(x - 5, bx + 8, bx + w - 14), by + h - 1); ctx.lineTo(M.clamp(x, bx + 10, bx + w - 8), by + h + 7); ctx.lineTo(M.clamp(x + 6, bx + 14, bx + w - 4), by + h - 1); ctx.fill();
    ctx.fillStyle = '#101418'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + w / 2, by + h / 2 + 1, w - 10);
  }
  function drawStamp(st) {
    const t = st.t;
    const sc = t < 0.18 ? 2.4 - (t / 0.18) * 1.4 : 1;
    const a = t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.6) : 1;
    ctx.save();
    ctx.font = '34px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // mede antes: o carimbo inteiro (girado) sempre cabe na tela ("A CONTA CHEGOU!", "IMPEACHMENT!")
    const w = ctx.measureText(st.text).width + 30;
    const rw = w * Math.cos(0.22) + 56 * Math.sin(0.22);
    const fit = Math.min(1, (G.W - 24) / rw);
    const hw = (rw * fit) / 2;
    ctx.translate(M.clamp(st.x, hw + 12, G.W - hw - 12), M.clamp(st.y, 100, G.H * 0.5));
    ctx.rotate(-0.22); ctx.scale(sc * fit, sc * fit); ctx.globalAlpha = a;
    ctx.strokeStyle = '#e63946'; ctx.lineWidth = 5; roundRect(-w / 2, -28, w, 56, 6); ctx.stroke();
    ctx.lineWidth = 2; roundRect(-w / 2 + 6, -22, w - 12, 44, 4); ctx.stroke();
    ctx.fillStyle = '#e63946'; ctx.fillText(st.text, 0, 2);
    ctx.restore();
  }
  function drawBanner(bn) {
    const t = bn.t, d = bn.dur;
    const inK = M.clamp(t / 0.25, 0, 1), outK = M.clamp((d - t) / 0.3, 0, 1);
    const a = Math.min(inK, outK);
    const y = bn.small ? G.H * 0.3 : G.H * 0.38;
    ctx.save();
    ctx.globalAlpha = a;
    const bh = bn.small ? 54 : 74;
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.fillRect(0, y - bh / 2, G.W, bh);
    ctx.fillStyle = bn.color; ctx.fillRect(0, y - bh / 2, G.W, 3); ctx.fillRect(0, y + bh / 2 - 3, G.W, 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const slide = (1 - M.easeOutCubic(inK)) * 80;
    ctx.font = (bn.small ? 20 : 30) + 'px ' + G.FONT_DISPLAY;
    ctx.lineWidth = 4; ctx.strokeStyle = '#000';
    ctx.strokeText(bn.title, G.W / 2 - slide, y - (bn.sub ? 9 : 0), G.W - 20);
    ctx.fillStyle = bn.color; ctx.fillText(bn.title, G.W / 2 - slide, y - (bn.sub ? 9 : 0), G.W - 20);
    if (bn.sub) {
      ctx.font = '700 ' + (bn.small ? 13 : 15) + 'px ' + G.FONT_BODY;
      ctx.fillStyle = '#ffffff'; ctx.fillText(bn.sub.toUpperCase(), G.W / 2 + slide, y + (bn.small ? 13 : 19), G.W - 20);
    }
    ctx.restore();
  }
  function drawWarning(t) {
    const a = 0.25 + 0.25 * Math.sin(t * 12);
    ctx.save();
    ctx.globalAlpha = a; ctx.fillStyle = '#e63946';
    ctx.fillRect(0, 0, G.W, 10); ctx.fillRect(0, G.H - 10, G.W, 10);
    ctx.restore();
  }
  function drawDebugHitboxes(g) {
    ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1;
    for (const e of g.enemies) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke(); }
    if (g.boss) for (const hb of bossBoxes(g.boss)) { ctx.beginPath(); ctx.arc(g.boss.x + hb.dx, g.boss.y + hb.dy, hb.r, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = '#f0f';
    for (const b of g.eb) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.8, 0, TAU); ctx.stroke(); }
  }

  // ---------- HUD ----------
  // A faixa de cima (votos, Pix, vidas, aprovação) vai para um canvas guardado e só é redesenhada
  // quando algum valor muda (no máximo ~15x/s para o placar). A barra do chefão e a arma são diretas.
  const HUD_BAND_H = 48;
  const hudCache = { c: null, x: null, k: 0, t: -1e9, score: -1, pix: -1, lives: -1, apr: -1 };
  function paintHudBand(g, run, k) {
    const W = G.W, hc = hudCache;
    if (!hc.c || hc.k !== k) {
      if (!hc.c) hc.c = document.createElement('canvas');
      hc.c.width = Math.ceil(W * k); hc.c.height = Math.ceil(HUD_BAND_H * k);
      hc.x = hc.c.getContext('2d'); hc.k = k; hc.score = -1;
      hc.grad = null;
    }
    const x = hc.x;
    x.setTransform(k, 0, 0, k, 0, 0);
    x.clearRect(0, 0, W, HUD_BAND_H);
    if (!hc.grad) {
      hc.grad = x.createLinearGradient(0, 0, 0, 46);
      hc.grad.addColorStop(0, 'rgba(8,12,22,0.85)'); hc.grad.addColorStop(1, 'rgba(8,12,22,0)');
    }
    x.fillStyle = hc.grad; x.fillRect(0, 0, W, 46);
    x.textBaseline = 'alphabetic';
    // placar = votos
    x.textAlign = 'left';
    x.font = '700 10px ' + G.FONT_BODY; x.fillStyle = 'rgba(255,255,255,0.7)';
    x.fillText('VOTOS', 8, 12);
    x.font = '15px ' + G.FONT_DISPLAY; x.fillStyle = '#ffffff';
    x.fillText(G.fmt(run.score), 8, 28);
    // pix (deixa espaço para o botão de pausa à direita)
    x.textAlign = 'right';
    x.font = '700 10px ' + G.FONT_BODY; x.fillStyle = 'rgba(255,255,255,0.7)';
    x.fillText('PIX', W - 50, 12);
    x.font = '15px ' + G.FONT_DISPLAY; x.fillStyle = G.C.pix;
    x.fillText(G.fmtMoney(run.pix), W - 50, 28);
    // vidas
    for (let i = 0; i < Math.min(run.lives, 6); i++) call(G.Art, 'lifeIcon', x, 14 + i * 16, 40, 13);
    if (run.lives > 6) { x.textAlign = 'left'; x.font = '700 11px ' + G.FONT_BODY; x.fillStyle = '#fff'; x.fillText('x' + run.lives, 14 + 6 * 16, 44); }
    // aprovação (multiplicador)
    const ax = W / 2 - 50, ay = 36, aw = 100;
    x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(ax, ay, aw, 5);
    const ap = Math.round(g.approval) / 100;
    x.fillStyle = ap > 0.66 ? G.C.greenL : ap > 0.33 ? G.C.yellow : G.C.red;
    x.fillRect(ax, ay, aw * ap, 5);
    x.textAlign = 'center'; x.font = '700 10px ' + G.FONT_BODY; x.fillStyle = 'rgba(255,255,255,0.85)';
    x.fillText('APROVAÇÃO ' + Math.round(g.approval) + '%  ×' + G.mult().toFixed(1).replace('.', ','), W / 2, ay - 3);
  }
  function drawHUD(g, k) {
    const run = G.run; if (!run) return;
    const W = G.W, hc = hudCache;
    k = k || scale * dpr;
    // faixa de cima (guardada)
    const apr = Math.round(g.approval);
    const now = performance.now();
    const changed = hc.score !== run.score || hc.pix !== run.pix || hc.apr !== apr || hc.lives !== run.lives;
    if (!hc.c || hc.k !== k || (changed && (hc.lives !== run.lives || now - hc.t >= 66))) {
      paintHudBand(g, run, k);
      hc.score = run.score; hc.pix = run.pix; hc.apr = apr; hc.lives = run.lives; hc.t = now;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(hc.c, 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.textBaseline = 'alphabetic';
    // chefão
    const b = g.boss;
    if (b && (b.state === 'fight' || b.state === 'talk' || b.state === 'enter')) {
      const bx = 10, by = 52, bw = W - 20;
      ctx.fillStyle = 'rgba(8,12,22,0.7)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 18);
      const frac = b.state === 'enter' ? M.clamp(b.t / 2.2, 0, 1) : b.hp / b.maxHp;
      ctx.fillStyle = '#3a0d14'; ctx.fillRect(bx, by + 9, bw, 5);
      ctx.fillStyle = b.invulnT > 0 || b.invuln ? '#9aa5b8' : G.C.red; ctx.fillRect(bx, by + 9, bw * frac, 5);
      ctx.fillStyle = '#ffd23f';
      for (const ph of b.phases) if (ph.at < 1) ctx.fillRect(bx + bw * ph.at - 1, by + 7, 2, 9);
      ctx.textAlign = 'left'; ctx.font = '10px ' + G.FONT_DISPLAY; ctx.fillStyle = '#ffffff';
      ctx.fillText(b.name, bx, by + 7);
      if (b.phases[b.phase] && b.phases[b.phase].name) {
        ctx.textAlign = 'right'; ctx.font = '700 10px ' + G.FONT_BODY; ctx.fillStyle = '#ffd23f';
        ctx.fillText(b.phases[b.phase].name.toUpperCase(), bx + bw, by + 7);
      }
    }
    // arma (canto inferior esquerdo); fica transparente quando o Fusca passa por baixo
    const p = g.player;
    const wdef = G.WEAPONS[run.weapon] || G.WEAPONS.voto;
    const wy = G.H - 14;
    if (p.alive && p.y > G.H - 64 && p.x < 150) ctx.globalAlpha = 0.3;
    ctx.textAlign = 'left'; ctx.font = '11px ' + G.FONT_DISPLAY; ctx.fillStyle = wdef.color;
    ctx.fillText(wdef.name, 10, wy - 8);
    const need = powerNeed(run.level);
    for (let i = 0; i < G.MAX_LEVEL; i++) {
      ctx.fillStyle = i < run.level ? wdef.color : 'rgba(255,255,255,0.18)';
      ctx.fillRect(10 + i * 12, wy - 3, 9, 5);
      // progresso para o próximo nível (cada P enche um pedaço)
      if (i === run.level && run.pp > 0) {
        const a = ctx.globalAlpha;
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = wdef.color;
        ctx.fillRect(10 + i * 12, wy - 3, 9 * Math.min(1, run.pp / need), 5);
        ctx.globalAlpha = a;
      }
    }
    if (p.cafe > 0) { ctx.fillStyle = '#d4a373'; ctx.font = '700 10px ' + G.FONT_BODY; ctx.fillText('CAFEZINHO ' + Math.ceil(p.cafe) + 's', 74, wy + 2); }
    ctx.globalAlpha = 1;
    updateDomHud();
  }
  let lastBombs = -1, lastFill = -1, lastNear = false, btnRect = null;
  function updateDomHud() {
    const btn = document.getElementById('btnBomb');
    if (!btn || !G.run || !G.game) return;
    if (G.run.bombs !== lastBombs) {
      lastBombs = G.run.bombs;
      const c = btn.querySelector('.count');
      if (c) c.textContent = G.run.bombs;
      btn.classList.toggle('empty', G.run.bombs <= 0);
    }
    const f = Math.round(G.game.delacao);
    if (f !== lastFill) { lastFill = f; btn.style.setProperty('--fill', f + '%'); }
    // Fusca passando por baixo do botão da Delação: o botão fica quase transparente (continua apertável)
    const p = G.game.player;
    if (!btnRect || !btnRect.width) { const r = btn.getBoundingClientRect(); btnRect = r.width ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width } : null; }
    let near = false;
    if (btnRect && p.alive) {
      const px = G.view.x + p.x * G.view.scale, py = G.view.y + p.y * G.view.scale, m = 28;
      near = px > btnRect.left - m && px < btnRect.right + m && py > btnRect.top - m && py < btnRect.bottom + m;
    }
    if (near !== lastNear) { lastNear = near; btn.style.opacity = near ? '0.25' : ''; }
  }
  function setPlayButtons(show) {
    document.body.classList.toggle('in-play', !!show);
    btnRect = null; // o botão só tem tamanho quando aparece
  }

  // ===================== Fluxo =====================
  G.toMenu = function () {
    G.state = 'menu';
    G.game = null;
    setPlayButtons(false);
    call(G.Audio, 'music', 'menu');
    call(G.UI, 'title');
  };
  G.startRun = function (stageIdx, loop) {
    stageIdx = stageIdx || 0;
    loop = loop || 1;
    const lives = 3 + G.upg('vida');
    const bombs = 2 + G.upg('bomba');
    G.run = {
      loop, stageIdx, startStage: stageIdx, score: 0, lives, baseLives: lives, bombs, baseBombs: bombs,
      weapon: 'voto', level: Math.min(G.MAX_LEVEL, 1 + G.upg('arma')), pp: 0, continues: 0, maxContinues: 3, grazes: 0, pix: 0, hits: 0,
      total: 0, extGiven: 0, // pontos da partida inteira (a recontagem não zera) e vidas extras já dadas
    };
    G.count('runs');
    const go = () => G.startStage(stageIdx);
    // a abertura em 6 painéis passa só na primeira vez (G.UI pode oferecer "rever a história")
    if (stageIdx === 0 && loop === 1 && !G.debug.skipStory && !G.save.seenIntro) {
      G.state = 'intro';
      setPlayButtons(false);
      call(G.Audio, 'music', 'story');
      call(G.UI, 'story', G.STORY.intro, () => { G.save.seenIntro = true; G.saveGame(); go(); });
    } else go();
  };
  G.startStage = function (idx) {
    if (G.debug.isolated && !G.Stages.list[idx]) idx = 0; // teste isolado sem stages.js
    const st = G.Stages.list[idx];
    if (!st) { G.finishGame(); return; }
    G.run.stageIdx = idx;
    qualityStageStart();
    const g = (G.game = newGame(idx));
    g.player = makePlayer();
    g.script = null;
    G.state = 'intro';
    setPlayButtons(false);
    input.active = false;
    call(G.Audio, 'music', st.music || 'stage' + (idx + 1));
    const begin = () => {
      G.state = 'play';
      setPlayButtons(true);
      try { g.script = { gen: st.script(STAGE_API), wait: null, done: false }; }
      catch (err) { G.reportError(err, 'stage.script init'); g.script = { done: true }; }
    };
    const story = G.STORY.stages[st.id];
    const afterIntro = () => {
      if (story && story.intro && story.intro.length && !G.debug.skipDialogue && !(G.run.loop > 1)) {
        G.state = 'dialogue';
        call(G.UI, 'dialogue', story.intro, begin);
      } else begin();
    };
    if (G.debug.skipUI) afterIntro();
    else call(G.UI, 'stageIntro', { index: idx, stage: st, loop: G.run.loop, total: G.Stages.list.length }, afterIntro);
  };
  function commitPix() {
    const g = G.game; if (!g) return;
    const d = g.pixStage - g.pixCommitted;
    if (d > 0) { G.save.pix += d; G.count('pixTotal', d); g.pixCommitted = g.pixStage; }
    if (G.run && G.run.score > G.save.best) G.save.best = G.run.score;
    G.saveGame();
  }
  G.commitPix = commitPix;
  // Grava o que já foi ganho (app indo para o fundo / aba fechando)
  function saveProgress() { if (G.game && G.run) commitPix(); else G.saveGame(); }
  // Nota da fase. S: sem morrer e no máximo 1 Delação (bomba não é pecado). A: sem morrer.
  // B: até 1 / 2 / 4 / 6 mortes nas fases 1..4 (a régua acompanha a dificuldade; medido com o bot
  // "humano": nas fases 3 e 4 um jogador bom morre 4 a 8 vezes). C: o resto.
  const RANK_B = [1, 2, 4, 6];
  G.rankFor = function (hits, bombs, stageIdx) {
    if (hits === 0) return bombs <= 1 ? 'S' : 'A';
    return hits <= RANK_B[M.clamp(stageIdx | 0, 0, RANK_B.length - 1)] ? 'B' : 'C';
  };
  G.stageClear = function () {
    const g = G.game, run = G.run;
    if (!g || G.state === 'clear') return;
    G.state = 'clear';
    setPlayButtons(false);
    g.canFire = false; g.beam = null; g.player.inv = 999;
    for (const it of g.pickups) if (!it.dead) { if (it.type === 'power') lockPower(it); collectPickup(it); }
    const noHit = g.hits === 0, noBomb = g.bombsUsed === 0;
    const rank = G.rankFor(g.hits, g.bombsUsed, g.stageIdx);
    g.rank = rank;
    const bonus = {
      fichaLimpa: noHit ? 50000 : 0,
      semDelacao: noBomb ? 20000 : 0,
      raspao: g.grazes * 100,
      aprovacao: Math.round(g.approval) * 500,
    };
    let total = 0; for (const k in bonus) total += bonus[k];
    total = Math.round(total * (run.loop > 1 ? 1.5 : 1));
    run.score += total;
    run.total = (run.total || 0) + total;
    checkExtends(run);
    // Pix da nota: cresce com a fase (fases difíceis pagam mais) e dobra no 2º Mandato
    const pixBonus = Math.round({ S: 250, A: 160, B: 90, C: 40 }[rank] * (1 + 0.25 * g.stageIdx) * (run.loop > 1 ? 2 : 1));
    run.pix += pixBonus; g.pixStage += pixBonus;
    commitPix();
    if (noHit) G.unlock('ficha_limpa');
    G.save.unlocked = Math.max(G.save.unlocked, Math.min(G.Stages.list.length, g.stageIdx + 2));
    G.saveGame();
    call(G.Audio, 'music', 'clear');
    const stats = {
      index: g.stageIdx, stage: g.stage, rank, bonus, bonusTotal: total, pixBonus, pixStage: g.pixStage,
      kills: g.kills, hits: g.hits, bombsUsed: g.bombsUsed, grazes: g.grazes, score: run.score, time: g.t,
      last: g.stageIdx >= G.Stages.list.length - 1, loop: run.loop,
    };
    const next = () => {
      if (stats.last) { G.finishGame(); return; }
      if (G.debug.skipUI) { G.startStage(g.stageIdx + 1); return; }
      call(G.UI, 'shop', { fromRun: true, next: g.stageIdx + 1 }, () => G.startStage(g.stageIdx + 1));
    };
    const showResults = () => { if (G.debug.skipUI) next(); else call(G.UI, 'stageClear', stats, next); };
    const lastBoss = g.stage && g.stage.boss;
    const post = lastBoss && G.STORY.boss[lastBoss] && G.STORY.boss[lastBoss].post;
    if (post && !G.debug.skipDialogue) call(G.UI, 'dialogue', post, showResults);
    else showResults();
  };
  function gameOver() {
    const g = G.game, run = G.run;
    if (G.state === 'over') return;
    G.state = 'over';
    setPlayButtons(false);
    input.active = false;
    commitPix();
    call(G.Audio, 'music', 'gameover');
    const info = { score: run.score, stage: g.stage, index: g.stageIdx, continuesLeft: run.maxContinues - run.continues, pix: G.save.pix, best: G.save.best };
    if (G.debug.autoContinue && info.continuesLeft > 0) { G.continueRun(); return; }
    call(G.UI, 'gameOver', info, {
      onContinue: () => G.continueRun(),
      onQuit: () => G.toMenu(),
    });
  }
  // "Pedir recontagem": continua de onde parou, mas zera o placar
  G.continueRun = function () {
    const g = G.game, run = G.run;
    if (!g || run.continues >= run.maxContinues) return false;
    run.continues++;
    run.score = 0; // o placar zera; run.total não (vidas extras não se repetem)
    run.lives = run.baseLives;
    run.bombs = run.baseBombs;
    const p = g.player;
    p.alive = true; p.entering = true; p.x = G.W / 2; p.y = G.H + 30; p.tx = G.W / 2; p.ty = G.H * 0.8; p.inv = 3.5;
    G.clearBullets(false);
    G.state = 'play';
    setPlayButtons(true);
    // música certa para o momento: chefão chegando/caindo ou cinemática da volta do Lule = silêncio
    const b = g.boss;
    if (b && (b.state !== 'fight' || (b.data && b.data.reviving))) call(G.Audio, 'stopMusic');
    else call(G.Audio, 'music', b ? (b.def.music || g.stage.bossMusic || 'boss') : (g.stage.music || 'stage' + (g.stageIdx + 1)));
    return true;
  };
  G.finishGame = function () {
    const run = G.run;
    commitPix();
    if (run.loop > 1) { G.save.cleared2 = true; G.unlock('reeleito'); }
    G.save.cleared = true;
    G.saveGame();
    G.state = 'ending';
    setPlayButtons(false);
    call(G.Audio, 'music', 'victory');
    call(G.UI, 'ending', { loop: run.loop, score: run.score, best: G.save.best }, () => G.toMenu());
  };
  G.pause = function () {
    if (G.state !== 'play') return;
    G.state = 'pause';
    setPlayButtons(false);
    input.active = false;
    call(G.Audio, 'sfx', 'pause');
    call(G.UI, 'pause', {
      onResume: () => G.resume(),
      onQuit: () => { commitPix(); G.toMenu(); },
    });
  };
  G.resume = function () {
    if (G.state !== 'pause') return;
    G.state = 'play';
    if (G.game) G.game.resumeT = RESUME_T;
    setPlayButtons(true);
    call(G.UI, 'hidePause');
  };
  const RESUME_T = 1.0;

  // ===================== Loop =====================
  let last = 0, acc = 0;
  let frozenState = null; // pausa / fim de jogo parado: desenha uma vez e deixa a imagem quieta
  // Medidor do modo de qualidade automático (intervalo real do rAF, que inclui rasterizar e compor)
  const QM = { ema: 16.7, slowT: 0, stageMax: 0, stageN: 0 };
  function qualityMeter(dtMs) {
    if (G.state !== 'play' || !G.game || G.game.t <= 3 || dtMs >= 120 || dtMs <= 0 || document.hidden) return;
    QM.ema += (dtMs - QM.ema) * 0.05;
    QM.slowT = QM.ema > 22 ? QM.slowT + dtMs : 0;
    QM.stageN++;
    if (QM.stageN > 120 && QM.ema > QM.stageMax) QM.stageMax = QM.ema;
    if (QM.slowT > 2500 && G.qualityAuto()) {
      QM.slowT = 0; QM.ema = 16.7;
      const i = Q_ORDER.indexOf(G.quality);
      if (i > 0) { G.save.qualityTier = Q_ORDER[i - 1]; G.saveGame(); applyQuality(); }
    }
  }
  // Começo de fase: sobe um nível se a fase anterior inteira rodou com folga (tela de 90/120 Hz)
  function qualityStageStart() {
    if (G.qualityAuto() && QM.stageN > 600 && QM.stageMax > 0 && QM.stageMax < 12) {
      const i = Q_ORDER.indexOf(G.quality);
      if (i >= 0 && i < Q_ORDER.length - 1) { G.save.qualityTier = Q_ORDER[i + 1]; G.saveGame(); applyQuality(); }
    }
    QM.stageMax = 0; QM.stageN = 0; QM.slowT = 0; QM.ema = 16.7;
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!last) last = ts;
    const dtMs = ts - last;
    let dt = dtMs / 1000;
    last = ts;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    qualityMeter(dtMs);
    const ts2 = G.debug.timeScale || 1;
    acc += dt * ts2;
    let steps = 0;
    const maxSteps = 6 * Math.ceil(ts2);
    while (acc >= G.DT && steps < maxSteps) {
      step(G.DT);
      acc -= G.DT;
      steps++;
    }
    if (steps >= maxSteps) acc = 0;
    // Telas de 90/120 Hz: sem passo de simulação, o quadro seria idêntico; não redesenha.
    if (steps === 0 && (G.state === 'play' || G.state === 'clear')) return;
    // Pausado (ou fim de jogo sem nada se mexendo): uma imagem só, o celular descansa.
    if (G.state === 'pause' || (G.state === 'over' && (!G.game || G.game.parts.length === 0))) {
      if (frozenState === G.state) return;
      frozenState = G.state;
    } else frozenState = null;
    try { render(); } catch (err) { G.reportError(err, 'render'); }
  }
  function step(dt) {
    menuT += dt;
    if (G.game && (G.state === 'play' || G.state === 'clear')) {
      try { updateGame(dt); } catch (err) { G.reportError(err, 'update'); }
    } else if (G.game && G.state === 'dialogue') {
      // mundo congelado, só partículas e textos andam
      const g = G.game;
      for (const q of g.parts) { q.t += dt; if (q.t >= q.life) q.dead = true; }
      compact(g.parts);
    }
    if (G.state === 'over' && G.game) {
      const g = G.game;
      for (const q of g.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.t >= q.life) q.dead = true; }
      compact(g.parts);
    }
  }

  // ===================== Debug / testes =====================
  G.debug = {
    god: false, auto: false, timeScale: 1, hitboxes: false, skipUI: false, skipDialogue: false, skipStory: false, autoContinue: false,
    qualityForced: null, // ?quality=high|mid|low (testes): fixa a qualidade e desliga o modo automático
    qualityMeter() { return { quality: G.quality, ema: +QM.ema.toFixed(1), slowMs: Math.round(QM.slowT), stageMax: +QM.stageMax.toFixed(1), n: QM.stageN }; },
    // pula direto para o chefão da fase atual
    toBoss() {
      const g = G.game; if (!g || !g.stage || !g.stage.boss) return;
      for (const e of g.enemies) e.dead = true;
      g.eb.length = 0;
      const id = g.stage.boss;
      g.script = { gen: (function* () { yield 0.5; yield STAGE_API.boss(id); })(), wait: null, done: false };
      G.state = 'play';
    },
    killBoss() { const g = G.game; const b = g && g.boss; if (b && b.state === 'fight') G.hitBoss(b, (b.hp + 1) / Math.max(0.01, b.dmgMul != null ? b.dmgMul : 1)); },
    hurtBoss(frac) { const g = G.game; if (g && g.boss && g.boss.state === 'fight') G.hitBoss(g.boss, g.boss.maxHp * frac); },
    spawnBoss(id) {
      const g = G.game; if (!g) return;
      for (const e of g.enemies) e.dead = true;
      g.eb.length = 0;
      g.script = { gen: (function* () { yield 0.3; yield STAGE_API.boss(id); })(), wait: null, done: false };
      G.state = 'play';
    },
    stage(i, loop) { G.debug.skipStory = true; G.startRun(i, loop || 1); },
    give(type, wtype) { const g = G.game; if (g) G.drop(type, g.player.x, g.player.y - 40, { wtype, cycle: false, magnet: true }); },
    weapon(w, lv) { if (G.run) { G.run.weapon = w; G.run.level = lv || G.run.level; } },
    stats() {
      const g = G.game;
      return g ? { state: G.state, stage: g.stage && g.stage.id, t: +g.t.toFixed(1), enemies: g.enemies.length, eb: g.eb.length, pb: g.pb.length, parts: g.parts.length, boss: g.boss ? { id: g.boss.id, state: g.boss.state, hp: Math.round(g.boss.hp), phase: g.boss.phase } : null, lives: G.run.lives, score: G.run.score, level: G.run.level, weapon: G.run.weapon, quality: G.quality, errors: G.errors.length } : { state: G.state, quality: G.quality, errors: G.errors.length };
    },
  };
  function readParams() {
    let q;
    try { q = new URLSearchParams(location.search); } catch (e) { return {}; }
    const o = {};
    for (const [k, v] of q) o[k] = v;
    return o;
  }

  // ===================== UI fallback (substituída por ui.js) =====================
  function makeFallbackUI() {
    const el = () => document.getElementById('ui');
    function screen(html) { const u = el(); if (!u) return null; u.innerHTML = '<div class="fb-screen">' + html + '</div>'; u.classList.add('open'); return u; }
    function close() { const u = el(); if (u) { u.innerHTML = ''; u.classList.remove('open'); } }
    function btn(u, sel, fn) { const b = u && u.querySelector(sel); if (b) b.addEventListener('click', () => { call(G.Audio, 'unlock'); fn(); }); }
    const UI = {
      title() {
        const u = screen('<h1>FUSCA A JATO</h1><p>Guerra em Brasília</p><button id="fbPlay">JOGAR</button>');
        btn(u, '#fbPlay', () => { close(); G.startRun(0); });
      },
      story(panels, done) { close(); done(); },
      stageIntro(info, done) { close(); G.banner('FASE ' + (info.index + 1), info.stage.name || '', { dur: 2.2 }); done(); },
      dialogue(lines, done) {
        let i = 0;
        const show = () => {
          if (i >= lines.length) { close(); done(); return; }
          const l = lines[i];
          const u = screen('<div class="fb-dialog"><b>' + ((G.CAST[l.who] || {}).name || l.who) + '</b><p>' + l.text + '</p><button id="fbNext">OK</button></div>');
          btn(u, '#fbNext', () => { i++; show(); });
        };
        show();
      },
      stageClear(stats, done) {
        const u = screen('<h2>FASE CONCLUÍDA</h2><p>Nota ' + stats.rank + ' · ' + G.fmt(stats.score) + ' votos</p><button id="fbNext">CONTINUAR</button>');
        btn(u, '#fbNext', () => { close(); done(); });
      },
      shop(o, done) { close(); done(); },
      gameOver(info, h) {
        const u = screen('<h2>DERROTADO NAS URNAS</h2><p>' + G.fmt(info.score) + ' votos</p>' + (info.continuesLeft > 0 ? '<button id="fbCont">PEDIR RECONTAGEM (' + info.continuesLeft + ')</button>' : '') + '<button id="fbQuit">MENU</button>');
        btn(u, '#fbCont', () => { close(); h.onContinue(); });
        btn(u, '#fbQuit', () => { close(); h.onQuit(); });
      },
      pause(h) {
        const u = screen('<h2>PAUSA</h2><button id="fbRes">CONTINUAR</button><button id="fbQuit">SAIR</button>');
        btn(u, '#fbRes', () => { close(); h.onResume(); });
        btn(u, '#fbQuit', () => { close(); h.onQuit(); });
      },
      hidePause() { close(); },
      ending(info, done) {
        const u = screen('<h2>FIM!</h2><p>' + G.fmt(info.score) + ' votos</p><button id="fbNext">MENU</button>');
        btn(u, '#fbNext', () => { close(); done(); });
      },
      toast(o) { /* sem toast no fallback */ },
    };
    UI.fallbackDialogue = UI.dialogue;
    return UI;
  }

  // ===================== Boot =====================
  // Fontes chegaram depois do boot (main.js chama): redesenha o que tinha texto guardado em cache.
  G.fontsReady = function () {
    hudCache.k = 0;
    call(G.BG, 'fontsReady'); call(G.Art, 'fontsReady'); call(G.UI, 'fontsReady');
  };
  G.boot = function () {
    canvas = document.getElementById('game');
    viewEl = document.getElementById('viewport') || document.body;
    ctx = canvas.getContext('2d');
    G.canvas = canvas; G.ctx = ctx;
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    setupInput();
    call(G.Audio, 'init');
    // estágio de teste quando nenhum módulo de fases foi carregado
    if (!G.Stages.list.length) {
      G.Bosses.define('teste', { name: 'CHEFÃO TESTE', hp: 300, r: 36, update(b, dt) { b.x = G.W / 2 + Math.sin(b.ft) * 100; if (((b.ft * 10) | 0) % 8 === 0 && !b.data.f) { b.data.f = 1; G.pat.ring(b.x, b.y, 16, 120, { style: 'orb', color: '#ff5d8f' }, b.ft); } if (((b.ft * 10) | 0) % 8 !== 0) b.data.f = 0; } });
      G.Stages.add({ id: 'teste', name: 'Fase de Teste', boss: 'teste', script: function* (S) { for (let i = 0; i < 6; i++) { S.spawn('dummy', 60 + i * 48, -20); yield 0.4; } yield S.clear(); yield S.boss('teste'); } });
    }
    const P = readParams();
    // ?god=0 desliga (não liga): só para as chaves liga/desliga, nunca para stage/loop/ts
    for (const k of ['god', 'auto', 'skipui', 'hitboxes', 'autocontinue', 'boss']) if (P[k] === '0' || P[k] === 'false') delete P[k];
    if (P.god) G.debug.god = true;
    if (P.auto) G.debug.auto = true;
    if (P.ts) G.debug.timeScale = +P.ts || 1;
    if (P.skipui) { G.debug.skipUI = true; G.debug.skipDialogue = true; G.debug.skipStory = true; }
    if (P.hitboxes) G.debug.hitboxes = true;
    if (P.autocontinue) G.debug.autoContinue = true;
    if (P.mods) G.debug.isolated = true;
    if (P.quality && Q_DPR[P.quality]) { G.debug.qualityForced = P.quality; applyQuality(); }
    G.state = 'menu';
    requestAnimationFrame(frame);
    if (P.stage != null) {
      G.debug.skipStory = true;
      G.startRun(+P.stage || 0, +P.loop || 1);
      if (P.boss) setTimeout(() => G.debug.toBoss(), 300);
      if (P.bossid) setTimeout(() => G.debug.spawnBoss(P.bossid), 300);
    } else {
      call(G.Audio, 'music', 'menu');
      call(G.UI, 'title');
    }
  };
})();
