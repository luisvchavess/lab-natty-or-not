/* ============================================================
   FUSCA A JATO — enemies.js
   Todos os inimigos comuns (caricaturas genéricas de políticos)
   e os 4 chefes intermediários. Cada um tem comportamento
   (update) e desenho (draw). Contrato: docs/ENGINE.md §4.
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Enemies) return;
  const M = G.m, TAU = Math.PI * 2, PI = Math.PI, DOWN = Math.PI / 2;
  const INK = '#101418';
  const sfx = (n) => G.call(G.Audio, 'sfx', n);

  // Cores de tiro inimigo (saturadas, legíveis contra o cenário e os tiros do Zé)
  const COL = {
    pink: '#ff3d7f', red: '#ff2a4a', orange: '#ff8c1a', magenta: '#ff3dd8',
    violet: '#c86bff', nota50: '#ff9f1c', nota10: '#ff4d4d',
  };

  // ======================================================================
  // Estilos de tiro próprios (prefixo en_)
  // ======================================================================
  const BS = G.BulletStyles;
  function glowOn(x, c, b) { x.shadowColor = c; x.shadowBlur = b; }
  // Onda sonora: arco convexo na direção do movimento (o sprite gira junto com o tiro)
  BS.define('en_onda', { r: 4, size: 16, rotate: true, paint(x, s, c) {
    x.lineCap = 'round';
    glowOn(x, c, 6); x.strokeStyle = c; x.lineWidth = s * 0.3;
    x.beginPath(); x.arc(-s * 0.38, 0, s * 0.58, -0.8, 0.8); x.stroke();
    x.shadowBlur = 0; x.strokeStyle = '#fff'; x.lineWidth = s * 0.11; x.stroke();
  } });
  // Nota musical (trio elétrico)
  BS.define('en_nota', { r: 4.5, size: 18, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c;
    x.beginPath(); x.ellipse(-s * 0.1, s * 0.24, s * 0.22, s * 0.16, -0.45, 0, TAU); x.fill();
    x.fillRect(s * 0.06, -s * 0.42, s * 0.1, s * 0.68);
    x.beginPath(); x.moveTo(s * 0.16, -s * 0.42); x.quadraticCurveTo(s * 0.44, -s * 0.28, s * 0.34, -s * 0.02);
    x.quadraticCurveTo(s * 0.3, -s * 0.2, s * 0.16, -s * 0.2); x.closePath(); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(-s * 0.1, s * 0.24, s * 0.11, s * 0.07, -0.45, 0, TAU); x.fill();
  } });
  // Cédula de real (laranja = nota de 50, vermelha = nota de 10)
  BS.define('en_cedula', { r: 4.5, size: 20, rotate: true, paint(x, s, c) {
    const w = s * 0.9, h = s * 0.5;
    glowOn(x, c, 5); x.fillStyle = c; x.fillRect(-w / 2, -h / 2, w, h);
    x.shadowBlur = 0; x.strokeStyle = '#fff'; x.lineWidth = 1.4; x.strokeRect(-w / 2 + 1.2, -h / 2 + 1.2, w - 2.4, h - 2.4);
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(-w * 0.12, 0, h * 0.26, 0, TAU); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(w * 0.14, -h * 0.22, w * 0.2, h * 0.44);
  } });
  // Imposto: disco laranja com "%"
  BS.define('en_imposto', { r: 5, size: 15, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.47, 0, TAU); x.fill();
    x.shadowBlur = 0; x.strokeStyle = '#fff'; x.lineWidth = s * 0.11; x.lineCap = 'round';
    x.beginPath(); x.moveTo(s * 0.2, -s * 0.24); x.lineTo(-s * 0.2, s * 0.24); x.stroke();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(-s * 0.17, -s * 0.16, s * 0.09, 0, TAU); x.fill();
    x.beginPath(); x.arc(s * 0.17, s * 0.17, s * 0.09, 0, TAU); x.fill();
  } });

  // ======================================================================
  // Utilidades
  // ======================================================================
  // nível de dificuldade: 0 (fase 1) .. 3 (fase 4), +1.5 no 2º Mandato
  const lvl = () => { const g = G.game; return g ? (g.stageIdx || 0) + (g.loop > 1 ? 1.5 : 0) : 0; };
  const spd = (v) => v * (1 + 0.065 * lvl());                       // velocidade de tiro por fase
  const ivl = (v) => v * Math.max(0.55, 1 - 0.1 * lvl());           // intervalo entre ataques por fase
  const first = (a, b) => M.rand(a, b) * Math.max(0.55, 1 - 0.13 * lvl()); // demora do 1º tiro
  const loop2 = () => !!(G.game && G.game.loop > 1);
  const player = () => G.game && G.game.player;
  const bossDying = () => !!(G.game && G.game.boss && G.game.boss.state === 'dying');
  function farFromPlayer(x, y, d) { const p = player(); return !p || !p.alive || M.dist2(x, y, p.x, p.y) > d * d; }
  // Pode atirar? Na tela, acima de 68% da altura e longe do jogador (nada de tiro "na cara").
  function okShot(e, minD) {
    if (e.y < 24 || e.y > G.H * 0.68 || e.x < 6 || e.x > G.W - 6) return false;
    return farFromPlayer(e.x, e.y, minD || 95);
  }
  const aim = (e) => G.aim(e.x, e.y);

  // Falas: no máximo uma bolha nova a cada ~2,6 s na tela toda (force ignora a fila)
  function talk(e, lines, chance, dur, force) {
    const g = G.game; if (!g || e.dead) return;
    if (e.y < 70 || e.y > G.H * 0.75 || e.x < 0 || e.x > G.W) return; // longe do HUD
    if (!force) {
      if ((g._enTalk || 0) > g.t) return;
      if (chance != null && Math.random() > chance) return;
    }
    G.say(e, typeof lines === 'string' ? lines : M.pick(lines), dur || 1.8);
    g._enTalk = g.t + (force ? 1.4 : 2.6);
  }

  // Revanche no 2º Mandato: alguns inimigos soltam tiros ao cair
  function revenge(e, n, speed) {
    if (!loop2() || bossDying() || !okShot(e, 115)) return;
    const o = { style: 'small', color: COL.pink };
    if (n <= 1) G.pat.aimed(e.x, e.y, spd(speed || 105), o);
    else G.pat.aimedFan(e.x, e.y, n, 0.55, spd(speed || 95), o);
  }

  // Mão de um personagem (para encaixar adereços)
  function hand(size, pose, t, seed, right, facing) {
    const A = G.Art.personAnchors;
    if (A) { const a = A(size, { pose, t, seed, facing }); return right ? a.handR : a.handL; }
    const s = size / 100; return { x: (right ? 24 : -24) * s * (facing || 1), y: 33 * s };
  }
  // Desenha um político com o flash de dano já resolvido
  function person(ctx, e, size, spec, o, dx, dy) {
    o = o || {};
    o.t = e.t; o.flash = G.isFlash(e);
    G.Art.person(ctx, e.x + (dx || 0), e.y + (dy || 0), size, spec, o);
  }
  const fcol = (c, fl) => (fl ? '#ffffff' : c);
  function rrect(ctx, x, y, w, h, r) { G.roundRect(ctx, x, y, w, h, r); }
  function inked(ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw || 1.5; ctx.stroke(); }

  // ======================================================================
  // Movimento genérico por opções (opts.path)
  //  'line'  : vx, vy (+ amp/freq = zigue-zague)
  //  'bez'   : pts [[x,y] × (3n+1)] e dur — curvas (formações, conga). Depois segue reto.
  //  'stop'  : entra até (tx,ty) em inT s, paira hold s (sway), sai por exit: 'up'|'down'|'left'|'right'|'side'
  //  'curve' : ang, spd, turn (rad/s), flip (s para inverter a curva), turnStop
  //  'side'  : passagem horizontal: dir, spd, amp
  // ======================================================================
  function initMove(e, o, defs) {
    const P = (e.data.P = Object.assign({}, defs || {}, o || {}));
    const d = e.data;
    d.path = (o && o.path) || (o && o.pts ? 'bez' : o && o.ty != null ? 'stop' : P.path || 'line');
    d.x0 = e.x; d.y0 = e.y; d.bx = e.x;
    d.ph = P.phase != null ? P.phase : Math.random() * TAU;
    if (d.path === 'line') { e.vx = P.vx || 0; e.vy = P.vy != null ? P.vy : P.spd || 80; }
    if (d.path === 'curve') { d.ang = P.ang != null ? P.ang : DOWN; d.spd = P.spd || 140; d.turn = P.turn || 0; d.nextFlip = P.flip || 0; }
    if (d.path === 'stop') {
      d.mv = 'in'; d.tx = P.tx != null ? P.tx : e.x; d.ty = P.ty != null ? P.ty : 120;
      d.tx = M.clamp(d.tx, 26, G.W - 26);
    }
    if (d.path === 'side') { d.dir = P.dir || (e.x < G.W / 2 ? 1 : -1); d.spd = P.spd || 180; }
  }
  function leave(e, how) {
    const d = e.data, P = d.P || {};
    d.mv = 'out'; d.leaving = true;
    const s = P.exitSpd || 130;
    if (how === 'side') how = e.x < G.W / 2 ? 'left' : 'right';
    if (how === 'down') { d.evx = 0; d.evy = s; }
    else if (how === 'left') { d.evx = -s * 1.3; d.evy = -s * 0.2; }
    else if (how === 'right') { d.evx = s * 1.3; d.evy = -s * 0.2; }
    else { d.evx = 0; d.evy = -s; }
    if (d.path !== 'stop') { d.path = 'stop'; e.vx = e.vx || 0; e.vy = e.vy || 0; }
  }
  const BZ = { x: 0, y: 0 };
  function bezAt(pts, u) {
    const n = ((pts.length - 1) / 3) | 0;
    let k = Math.floor(u * n); if (k > n - 1) k = n - 1; if (k < 0) k = 0;
    const t = M.clamp(u * n - k, 0, 1), i = k * 3, mt = 1 - t;
    const a = pts[i], b = pts[i + 1], c = pts[i + 2], d = pts[i + 3];
    const k0 = mt * mt * mt, k1 = 3 * mt * mt * t, k2 = 3 * mt * t * t, k3 = t * t * t;
    BZ.x = k0 * a[0] + k1 * b[0] + k2 * c[0] + k3 * d[0];
    BZ.y = k0 * a[1] + k1 * b[1] + k2 * c[1] + k3 * d[1];
    return BZ;
  }
  function move(e, dt) {
    const d = e.data, P = d.P || {};
    switch (d.path) {
      case 'bez': {
        const dur = P.dur || 4;
        if (e.t <= dur && P.pts && P.pts.length >= 4) {
          const px = e.x, py = e.y;
          const q = bezAt(P.pts, e.t / dur);
          e.x = q.x; e.y = q.y;
          if (dt > 0 && e.t > dt * 1.5) { e.vx = (e.x - px) / dt; e.vy = (e.y - py) / dt; }
        } else { e.x += e.vx * dt; e.y += e.vy * dt; }
        break;
      }
      case 'stop': {
        if (d.mv === 'in') {
          const inT = P.inT || 1.3;
          const k = M.clamp(e.t / inT, 0, 1), q = M.easeOutCubic(k);
          e.x = M.lerp(d.x0, d.tx, q); e.y = M.lerp(d.y0, d.ty, q);
          if (k >= 1) { d.mv = 'hold'; d.holdT = 0; }
        } else if (d.mv === 'hold') {
          d.holdT += dt;
          const sw = P.sway != null ? P.sway : 14;
          e.x = d.tx + Math.sin(d.holdT * 1.1) * sw;
          e.y = d.ty + Math.sin(d.holdT * 1.7) * 3;
          e.vx = 0; e.vy = 0;
          if (d.holdT >= (P.hold != null ? P.hold : 4)) leave(e, P.exit || 'up');
        } else {
          e.vx = M.approach(e.vx, d.evx, 260 * dt);
          e.vy = M.approach(e.vy, d.evy, 260 * dt);
          e.x += e.vx * dt; e.y += e.vy * dt;
        }
        break;
      }
      case 'curve': {
        if (P.flip && e.t > d.nextFlip) { d.turn = -d.turn; d.nextFlip += P.flip; }
        if (P.turnStop == null || e.t < P.turnStop) d.ang += d.turn * dt;
        e.vx = Math.cos(d.ang) * d.spd; e.vy = Math.sin(d.ang) * d.spd;
        e.x += e.vx * dt; e.y += e.vy * dt;
        break;
      }
      case 'side': {
        e.vx = d.dir * d.spd; e.vy = P.vy || 0;
        e.x += e.vx * dt;
        e.y = d.y0 + (P.vy || 0) * e.t + Math.sin(e.t * (P.freq || 3) + d.ph) * (P.amp != null ? P.amp : 6);
        break;
      }
      default: { // line
        d.bx += e.vx * dt;
        e.y += e.vy * dt;
        e.x = P.amp ? d.bx + (Math.sin(e.t * (P.freq || 2) + d.ph) - Math.sin(d.ph)) * P.amp : d.bx;
      }
    }
    escapeCheck(e);
  }
  // saiu da tela indo embora → some (fugiu; sem recompensa). Evita "inimigos fantasmas" segurando o 'clear'.
  function escapeCheck(e) {
    if (e.t > 1 && ((e.y < -60 && e.vy < 0) || (e.y > G.H + 60 && e.vy > 0) || (e.x < -70 && e.vx < 0) || (e.x > G.W + 70 && e.vx > 0))) {
      e.dead = true; e.escaped = true;
    }
  }

  // ======================================================================
  // Moldura comum: brilho de "carregador" de item, etiqueta de apresentação
  // ======================================================================
  const INTRO = {
    cabo: ['CABO ELEITORAL', 'distribui santinho do 171'],
    fantasma: ['VEREADOR FANTASMA', 'só aparece pra receber'],
    deputado: ['DEPUTADO DO CENTRÃO', 'apoia quem pagar mais'],
    assessor: ['ASSESSOR DA RACHADINHA', 'acerta que ele racha!'],
    lobista: ['LOBISTA', 'derruba e a mala é sua'],
    marqueteiro: ['MARQUETEIRO', 'blinda os aliados: mire nele!'],
    bot: ['BOT DE FAKE NEWS', 'vem em bando e mergulha'],
    carro_som: ['CARRO DE SOM', 'passe pela brecha da onda'],
    sindicalista: ['SINDICALISTA', 'GREVE! em leque'],
    leao: ['LEÃO DA RECEITA', 'morde seu Pix! derrube e restitui'],
    ministro: ['MINISTRO', 'são 38. Por enquanto.'],
    motoqueiro: ['MOTOCIATA', 'passa jogando tiro pra baixo'],
    drone: ['DRONE DO GABINETE', 'piscou vermelho? sai da mira'],
  };
  function introduce(e) {
    const run = G.run, info = INTRO[e.kind];
    if (!info || !run || run.loop > 1) return;
    const seen = run._enSeen || (run._enSeen = {});
    if (seen[e.kind]) return;
    seen[e.kind] = 1;
    e.data.tag = info; e.data.tagT = 0;
  }
  function drawTag(ctx, e) {
    const d = e.data, T = d.tagT || 0, DUR = 3.4;
    if (!d.tag || T <= 0 || T > DUR) return;
    const a = Math.min(1, T / 0.25, (DUR - T) / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '10px ' + G.FONT_DISPLAY;
    const w1 = ctx.measureText(d.tag[0]).width;
    ctx.font = '700 11px ' + G.FONT_BODY;
    const w2 = ctx.measureText(d.tag[1]).width;
    const w = Math.max(w1, w2) + 16, h = 31;
    const x = M.clamp(e.x - w / 2, 4, G.W - w - 4);
    let y = e.y + e.r + 12;
    if (y + h > G.H * 0.72) y = e.y - e.r - h - 34;
    ctx.fillStyle = 'rgba(16,20,24,0.88)'; rrect(ctx, x, y, w, h, 7); ctx.fill();
    ctx.strokeStyle = G.C.yellow; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = G.C.yellow; ctx.font = '10px ' + G.FONT_DISPLAY; ctx.fillText(d.tag[0], x + w / 2, y + 10.5);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 11px ' + G.FONT_BODY; ctx.fillText(d.tag[1], x + w / 2, y + 22.5);
    ctx.restore();
  }
  function carrierType(e) {
    const dr = e.drop; if (!dr) return null;
    const l = Array.isArray(dr) ? dr : [dr];
    for (const k of ['life', 'power', 'shield', 'bomb', 'cafe']) if (l.indexOf(k) >= 0) return k;
    return null;
  }
  function carrierColor(type, g) {
    if (type === 'power') return (G.WEAPONS[G.WEAPON_ORDER[Math.floor(g.t / 0.6) % 4]] || {}).color || '#fff';
    return { life: '#ff5d8f', shield: '#4cc9f0', bomb: '#f4f1e8', cafe: '#d4a373' }[type] || '#fff';
  }
  function drawCarrierUnder(ctx, e, g, type) {
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 8);
    const c = carrierColor(type, g);
    ctx.save();
    ctx.globalAlpha = 0.16 + 0.12 * pulse;
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 9 + pulse * 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -g.t * 30;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  const BADGE_ITEM = { type: 'power', wtype: 'voto', cycle: false, t: 0 };
  function drawCarrierBadge(ctx, e, g, type) {
    const bx = M.clamp(e.x + e.r + 7, 9, G.W - 9), by = e.y - e.r - 2 + Math.sin(g.t * 5) * 1.5;
    BADGE_ITEM.type = type; BADGE_ITEM.t = g.t;
    BADGE_ITEM.wtype = G.WEAPON_ORDER[Math.floor(g.t / 0.6) % 4];
    ctx.save(); ctx.translate(bx, by); ctx.scale(0.62, 0.62);
    G.call(G.Art, 'pickup', ctx, type, 0, 0, g.t, BADGE_ITEM);
    ctx.restore();
  }
  // Define com moldura: chama introdução, desenha carregador/etiqueta em volta do desenho próprio
  function define(kind, def) {
    const draw = def.draw, update = def.update, init = def.init;
    def.init = function (e, o, g) {
      // fases mais adiantadas: inimigos comuns mais resistentes (o Zé também chega mais forte)
      if (!def.big && !def.noScale && g) { const k = 1 + 0.2 * (g.stageIdx || 0); e.hp *= k; e.maxHp = e.hp; }
      if (init) init.call(this, e, o || {}, g);
      if (o && o.ambient) e.ignoreClear = true; // pipoca de fundo não segura a fase
      introduce(e);
    };
    def.update = function (e, dt, g) {
      if (update) update.call(this, e, dt, g); else { e.x += e.vx * dt; e.y += e.vy * dt; }
      if (e.data.tag && e.y > 26) e.data.tagT += dt;
    };
    def.draw = function (ctx, e, g) {
      const ct = e.big ? null : carrierType(e);
      if (ct) drawCarrierUnder(ctx, e, g, ct);
      ctx.save();
      if (draw) draw.call(this, ctx, e, g);
      ctx.restore();
      if (ct) drawCarrierBadge(ctx, e, g, ct);
      if (e.data.tag) drawTag(ctx, e);
    };
    G.Enemies.define(kind, def);
  }

  // Barrinha de vida dos chefes intermediários
  function mbBar(ctx, x, y, w, frac, label) {
    frac = M.clamp(frac, 0, 1);
    y = Math.max(54, y);
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,22,0.78)'; rrect(ctx, x - w / 2 - 3, y - 3, w + 6, 10, 3); ctx.fill();
    ctx.fillStyle = '#3a0d14'; ctx.fillRect(x - w / 2, y, w, 4);
    ctx.fillStyle = frac > 0.5 ? G.C.yellow : frac > 0.25 ? G.C.orange : G.C.red;
    ctx.fillRect(x - w / 2, y, w * frac, 4);
    if (label) {
      ctx.font = '9px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(label, x, y - 4);
      ctx.fillStyle = '#ffffff'; ctx.fillText(label, x, y - 4);
    }
    ctx.restore();
  }
  // Anel de aviso (telegrafia de ataque)
  function warnRing(ctx, x, y, r, k, color) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.5 * k;
    ctx.strokeStyle = color || COL.red; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function bang(ctx, x, y, t, color) { // "!" de alerta
    ctx.save();
    const s = 1 + Math.sin(t * 30) * 0.12;
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.font = '15px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('!', 0, 0);
    ctx.fillStyle = color || G.C.yellow; ctx.fillText('!', 0, 0);
    ctx.restore();
  }

  // ======================================================================
  // CABO ELEITORAL — pipoca: formações, santinhos lentos
  // ======================================================================
  const CABO = [
    { skin: '#d9a273', hair: 'short', hairColor: '#2a1d14', body: 'tshirt', shirt: '#ffd23f', hat: 'cap', hatColor: '#1b3fa0', seed: 1 },
    { skin: '#f0c49c', hair: 'side', hairColor: '#4a3020', body: 'tshirt', shirt: '#e63946', hat: 'cap', hatColor: '#f4f1e8', seed: 2 },
    { skin: '#9a6644', hair: 'curly', hairColor: '#1a1a1a', body: 'tshirt', shirt: '#00a651', hat: 'cap', hatColor: '#ffd23f', seed: 3 },
    { skin: '#e8b48a', hair: 'long', hairColor: '#6a3d22', body: 'tshirt', shirt: '#ff8c1a', seed: 4 },
  ];
  const CABO_LINES = ['VOTE 171!', 'Pega um santinho!', 'Confirma! É 171!', 'Olha o santinho!', 'Vai um adesivo?', 'Meu candidato é honesto!', 'Tem sanduíche no comício!'];
  function drawFlag(ctx, x, y, t, color, fl) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = fcol('#5a4632', fl); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -19); ctx.stroke();
    const w1 = Math.sin(t * 9) * 1.6, w2 = Math.sin(t * 9 + 1.5) * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -19); ctx.quadraticCurveTo(7, -20 + w1, 14, -19 + w2);
    ctx.lineTo(14, -10 + w2); ctx.quadraticCurveTo(7, -11 + w1, 0, -10); ctx.closePath();
    inked(ctx, fcol('#ffffff', fl), 1.1);
    if (!fl) {
      ctx.fillStyle = color; ctx.fillRect(1, -18.5 + w1 * 0.4, 12.5, 3);
      ctx.fillStyle = INK; ctx.font = '6px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('171', 7, -12.6 + w1 * 0.5);
    }
    ctx.restore();
  }
  define('cabo', {
    hp: 3, r: 12, score: 100, pix: 1,
    init(e, o) {
      initMove(e, o, { spd: 75 });
      const d = e.data;
      d.spec = CABO[o.v != null ? o.v % CABO.length : M.randi(0, CABO.length - 1)];
      d.fire = o.fire != null ? o.fire : 1;
      d.ft = first(0.8, 1.6);
      d.flagC = M.pick(['#e63946', '#1b3fa0', '#00a651']);
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      if (!d.fire || d.leaving) return;
      d.ft -= dt;
      if (d.ft <= 0) {
        d.ft = ivl(M.rand(2.3, 3.1)) / d.fire;
        if (okShot(e)) {
          const o = { style: 'santinho', color: COL.red };
          if (lvl() >= 2 && Math.random() < 0.5) G.pat.aimedFan(e.x, e.y, 3, 0.38, spd(92), o);
          else G.pat.aimed(e.x, e.y, spd(92), o);
          sfx('enemy_shot');
          talk(e, CABO_LINES, 0.1);
        }
      }
    },
    draw(ctx, e) {
      const d = e.data, size = 31;
      person(ctx, e, size, d.spec, { pose: 'wave' });
      const h = hand(size, 'wave', e.t, d.spec.seed, true);
      drawFlag(ctx, e.x + h.x, e.y + h.y, e.t, d.flagC, G.isFlash(e));
    },
    onDeath(e) { revenge(e, 3, 88); },
  });

  // ======================================================================
  // VEREADOR FANTASMA — some e aparece; anel de tiros ao se materializar
  // ======================================================================
  const GHOST = { skin: '#dfe3ff', hair: 'combover', hairColor: '#a7add6', body: 'suit', suit: '#6870a8', shirt: '#eef0ff', tie: '#ff5d8f', glasses: 'round', face: 'long', seed: 5 };
  const GHOST_LINES = ['PRESENTE!', 'Só vim bater o ponto!', 'Cadê meu salário?', 'Buuu! Sou vereador!', 'Home office, viu?', 'Vim só pra assinar!'];
  function ghostSpot(e) {
    const p = player();
    let best = null, bd = -1;
    for (let i = 0; i < 5; i++) {
      const x = M.rand(40, G.W - 40), y = M.rand(78, G.H * 0.42);
      const dd = p ? M.dist2(x, y, p.x, p.y) : 1e6;
      const dm = M.dist2(x, y, e.x, e.y);
      const sc = Math.min(dd, 260 * 260) - Math.max(0, dm - 220 * 220) * 0.5;
      if (sc > bd) { bd = sc; best = { x, y }; }
    }
    return best;
  }
  define('fantasma', {
    hp: 7, r: 14, score: 320, pix: 3,
    init(e, o) {
      const d = e.data;
      d.st = 'off'; d.stT = o.delay != null ? o.delay : 0.9; d.alpha = 0.15; e.invuln = true;
      d.tx = M.clamp(o.tx != null ? o.tx : e.x, 30, G.W - 30); d.ty = o.ty != null ? o.ty : M.rand(85, G.H * 0.36);
      d.cycles = o.cycles || 3; d.n = 0;
    },
    update(e, dt) {
      const d = e.data;
      d.stT -= dt;
      const ease = 1 - Math.pow(0.03, dt);
      switch (d.st) {
        case 'off': // quase invisível, flutuando até o próximo ponto
          e.invuln = true;
          d.alpha = M.approach(d.alpha, 0.15, dt * 2);
          e.x += (d.tx - e.x) * ease; e.y += (d.ty - e.y) * ease;
          if (d.stT <= 0 && M.dist2(e.x, e.y, d.tx, d.ty) < 400) { d.st = 'in'; d.stT = 0.6; sfx('ghost'); }
          break;
        case 'in': // aparecendo (anel de aviso)
          d.alpha = M.approach(d.alpha, 1, dt / 0.6);
          if (d.alpha > 0.7) e.invuln = false;
          if (d.stT <= 0) {
            d.st = 'on'; d.stT = ivl(2.6); d.shot2 = false; d.alpha = 1;
            if (okShot(e, 85)) {
              const n = Math.round(10 + lvl() * 1.6);
              G.pat.ring(e.x, e.y, n, spd(78), { style: 'orb', color: COL.violet }, Math.random() * TAU);
              if (lvl() >= 2.5) G.pat.ring(e.x, e.y, n, spd(62), { style: 'small', color: COL.magenta }, Math.random() * TAU);
              sfx('enemy_shot2');
            }
            talk(e, GHOST_LINES, 0.35);
          }
          break;
        case 'on':
          e.invuln = false;
          e.y += Math.sin(e.t * 3) * 6 * dt;
          if (!d.shot2 && d.stT < 1.0) { d.shot2 = true; if (okShot(e)) G.pat.aimed(e.x, e.y, spd(110), { style: 'small', color: COL.violet }); }
          if (d.stT <= 0) { d.st = 'out'; d.stT = 0.45; }
          break;
        case 'out':
          d.alpha = M.approach(d.alpha, 0.15, dt / 0.45);
          if (d.alpha < 0.55) e.invuln = true;
          if (d.stT <= 0) {
            d.n++;
            if (d.n >= d.cycles) d.st = 'gone';
            else { d.st = 'off'; d.stT = 1.0; const s = ghostSpot(e); d.tx = s.x; d.ty = s.y; }
          }
          break;
        default: // 'gone': vai embora sem ninguém ver (como sempre)
          e.invuln = true; e.y -= 80 * dt; d.alpha = M.approach(d.alpha, 0, dt * 0.6);
          if (e.y < -40 || d.alpha <= 0) { e.dead = true; e.escaped = true; }
      }
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e), size = 36, s = size / 100;
      if (d.st === 'in') {
        const k = 1 - d.stT / 0.6;
        warnRing(ctx, e.x, e.y, e.r + 4 + (1 - k) * 26, k, COL.violet);
      }
      ctx.globalAlpha = d.alpha * (d.st === 'on' ? 0.92 + Math.sin(g.t * 9) * 0.06 : 1);
      person(ctx, e, size, GHOST, { pose: 'up', mood: d.st === 'on' ? 'laugh' : 'normal' });
      // lençol no lugar das pernas
      const x = e.x, y0 = e.y + 30 * s, y1 = e.y + 74 * s, hw = 22 * s;
      ctx.beginPath();
      ctx.moveTo(x - hw, y0 - 2);
      ctx.lineTo(x + hw, y0 - 2);
      ctx.quadraticCurveTo(x + hw * 0.9, y1 - 8 * s, x + hw * 0.55, y1 + Math.sin(e.t * 8) * 3 * s);
      for (let i = 1; i <= 3; i++) {
        const xx = x + hw * 0.55 - (hw * 1.1 * i) / 3;
        ctx.quadraticCurveTo(xx + hw * 0.18, y1 - 10 * s, xx, y1 + Math.sin(e.t * 8 + i * 1.7) * 3 * s);
      }
      ctx.quadraticCurveTo(x - hw * 0.9, y1 - 8 * s, x - hw, y0 - 2);
      ctx.closePath();
      ctx.fillStyle = fl ? '#ffffff' : 'rgba(200,206,255,0.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(16,20,24,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    },
  });

  // ======================================================================
  // DEPUTADO DO CENTRÃO — paira e solta leque mirado; Pix extra
  // ======================================================================
  const DEP = [
    { skin: '#e8b48a', hair: 'slick', hairColor: '#3a3a3a', body: 'suit', suit: '#5b6375', shirt: '#f2f2f2', tie: '#e63946', face: 'jowl', seed: 6 },
    { skin: '#f0c49c', hair: 'combover', hairColor: '#7a6a5a', body: 'suit', suit: '#4a4f5c', shirt: '#f2f2f2', tie: '#ffd23f', face: 'jowl', glasses: 'square', seed: 7 },
    { skin: '#c68a5e', hair: 'gray', hairColor: '#c9c9c9', body: 'suit', suit: '#6b6f7a', shirt: '#f2f2f2', tie: '#1b3fa0', face: 'round', mustache: true, seed: 8 },
  ];
  const DEP_LINES = ['Sou base do governo!', 'Qual governo? Qualquer um!', 'Emenda liberada!', 'Toma lá, dá cá!', 'Meu voto tem preço!', 'Depende do cargo...', 'Vota comigo, ganha ponte!'];
  function drawSack(ctx, x, y, fl) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-3, -3); ctx.quadraticCurveTo(-9, 2, -8, 8); ctx.quadraticCurveTo(0, 13, 8, 8); ctx.quadraticCurveTo(9, 2, 3, -3); ctx.closePath();
    inked(ctx, fcol('#c79a52', fl), 1.2);
    ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(0, -1); ctx.lineTo(4, -4); ctx.lineTo(0, -6); ctx.closePath(); inked(ctx, fcol('#a57a38', fl), 1);
    if (!fl) { ctx.fillStyle = '#2d6a1f'; ctx.font = '8px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 4.5); }
    ctx.restore();
  }
  define('deputado', {
    hp: 12, r: 15, score: 420, pix: 6,
    init(e, o) {
      initMove(e, o, { path: 'stop', ty: M.rand(95, 165), hold: 5 + lvl() * 0.4, inT: 1.4, exit: 'up' });
      const d = e.data;
      d.spec = DEP[o.v != null ? o.v % DEP.length : M.randi(0, DEP.length - 1)];
      d.ft = 0.6;
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      if (d.mv !== 'hold' && d.path === 'stop') return;
      if (d.path !== 'stop' && e.t < 1) return;
      d.ft -= dt;
      if (d.ft <= 0) {
        d.ft = ivl(1.55);
        if (okShot(e)) {
          const many = lvl() >= 2;
          G.pat.aimedFan(e.x, e.y + 4, many ? 5 : 3, many ? 0.62 : 0.34, spd(112), { style: 'rice', color: COL.pink });
          sfx('enemy_shot2');
          talk(e, DEP_LINES, 0.22);
        }
      }
    },
    draw(ctx, e) {
      const d = e.data, size = 38;
      person(ctx, e, size, d.spec, { mood: 'smug' });
      const h = hand(size, 'idle', e.t, d.spec.seed, false);
      drawSack(ctx, e.x + h.x - 2, e.y + h.y + 3, G.isFlash(e));
    },
  });

  // ======================================================================
  // ASSESSOR DA RACHADINHA — ao cair, racha em duas metades (literalmente)
  // ======================================================================
  const ASS = [
    { skin: '#f0c49c', hair: 'side', hairColor: '#3a2a20', body: 'shirt', shirt: '#dfe8ff', tie: '#1b3fa0', glasses: 'square', face: 'long', seed: 9 },
    { skin: '#c68a5e', hair: 'short', hairColor: '#111111', body: 'shirt', shirt: '#fff1c9', tie: '#e63946', glasses: 'round', seed: 10 },
  ];
  const ASS_LINES = ['Meu salário? Metade é dele.', 'Sou assessor de confiança!', 'Divide comigo?', 'Cargo comissionado!'];
  function drawPapers(ctx, x, y, t, fl) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.15 + Math.sin(t * 4) * 0.05);
    ctx.beginPath(); ctx.rect(-6, -5, 12, 9); inked(ctx, fcol('#b5844a', fl), 1);
    ctx.beginPath(); ctx.rect(-5, -7, 10, 8); inked(ctx, fcol('#ffffff', fl), 0.9);
    if (!fl) { ctx.fillStyle = '#7a8090'; ctx.fillRect(-3.5, -5, 7, 1); ctx.fillRect(-3.5, -3, 5, 1); ctx.fillStyle = COL.red; ctx.fillRect(-3.5, -1, 7, 1.2); }
    ctx.restore();
  }
  define('assessor', {
    hp: 8, r: 13, score: 260, pix: 2,
    init(e, o) {
      initMove(e, o, { vy: 70, amp: 46, freq: 2.3 });
      e.data.v = o.v != null ? o.v % ASS.length : M.randi(0, ASS.length - 1);
      e.data.ft = first(0.8, 1.6);
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      if (d.leaving) return;
      d.ft -= dt;
      if (d.ft <= 0) {
        d.ft = ivl(M.rand(2.1, 2.7));
        if (okShot(e)) { G.pat.aimed(e.x, e.y, spd(105), { style: 'rice', color: COL.orange }); sfx('enemy_shot'); talk(e, ASS_LINES, 0.08); }
      }
    },
    draw(ctx, e) {
      const d = e.data, size = 33, sp = ASS[d.v];
      person(ctx, e, size, sp, { pose: 'hold' });
      drawPapers(ctx, e.x, e.y + 12, e.t, G.isFlash(e));
    },
    onDeath(e) {
      if (bossDying() || !G.game) return;
      for (const side of [-1, 1]) {
        const h = G.spawnEnemy('assessor_meio', e.x + side * 5, e.y, { side, v: e.data.v });
        if (h && side < 0) talk(h, 'RACHOU!', 1, 1.1, true);
      }
      G.count('rachadinha');
      G.burst(e.x, e.y, 10, { colors: ['#ffffff', '#7ed957', '#ffd23f'], type: 'paper', speed: 160, life: 0.8, grav: 120 });
      sfx('split');
    },
  });
  define('assessor_meio', {
    hp: 3, r: 9, score: 140, pix: 1,
    init(e, o) {
      const d = e.data;
      d.side = o.side || 1; d.v = o.v || 0; d.rot = 0; d.shot = false;
      e.vx = d.side * M.rand(115, 145); e.vy = -M.rand(50, 75);
      // nunca nasce "em cima" do jogador: perto dele, as metades ficam inofensivas por um instante
      if (!farFromPlayer(e.x, e.y, 95)) { e.harmless = true; d.safeT = 0.6; }
    },
    update(e, dt) {
      const d = e.data;
      if (d.safeT > 0) { d.safeT -= dt; if (d.safeT <= 0) e.harmless = false; }
      e.vy = Math.min(e.vy + 95 * dt, 70);
      e.vx *= Math.pow(0.7, dt);
      e.x += e.vx * dt; e.y += e.vy * dt;
      d.rot += d.side * 2.4 * dt;
      if (!d.shot && e.t > 0.42) {
        d.shot = true;
        if (okShot(e, 100)) {
          G.pat.aimed(e.x, e.y, spd(108), { style: 'small', color: COL.pink });
          if (loop2()) G.pat.aimed(e.x, e.y, spd(85), { style: 'small', color: COL.pink }, 0.25 * d.side);
          sfx('enemy_shot');
        }
      }
      if (e.x < -40 || e.x > G.W + 40 || e.y > G.H + 40) { e.dead = true; e.escaped = true; }
    },
    draw(ctx, e) {
      const d = e.data, size = 33, fl = G.isFlash(e);
      ctx.translate(e.x, e.y); ctx.rotate(d.rot);
      ctx.save();
      ctx.beginPath(); if (d.side < 0) ctx.rect(-30, -30, 30, 60); else ctx.rect(0, -30, 30, 60); ctx.clip();
      G.Art.person(ctx, 0, 0, size, ASS[d.v], { t: e.t, flash: fl, mood: 'hurt', pose: 'hold', lookX: 0, lookY: 0, autoLook: false });
      ctx.restore();
      // borda rasgada
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const yy = -18 + i * 4.6, xx = (i % 2 ? 1.8 : -1.8) * d.side * -1; if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.strokeStyle = fl ? '#fff' : '#fff6c2'; ctx.lineWidth = 2; ctx.stroke();
    },
    onDeath(e) { revenge(e, 1, 100); },
  });

  // ======================================================================
  // LOBISTA — tanque com maleta; espirais de cédulas; deixa a mala
  // ======================================================================
  const LOB = { skin: '#e0a882', hair: 'slick', hairColor: '#1a1a1a', body: 'suit', suit: '#1d2333', shirt: '#f4f1e8', tie: '#ffd23f', glasses: 'dark', face: 'square', seed: 11 };
  const LOB_LINES = ['Vamos fazer negócio?', 'Pra você, um precinho!', 'Nota fiscal? Precisa não.', 'É só um agrado!', 'Tô só de passagem...'];
  function drawBriefcase(ctx, x, y, w, h, open, t, fl, label) {
    ctx.save(); ctx.translate(x, y);
    // alça
    ctx.strokeStyle = fcol('#3b2414', fl); ctx.lineWidth = Math.max(1.5, w * 0.08);
    ctx.beginPath(); ctx.moveTo(-w * 0.16, -h / 2); ctx.lineTo(-w * 0.16, -h / 2 - h * 0.22); ctx.lineTo(w * 0.16, -h / 2 - h * 0.22); ctx.lineTo(w * 0.16, -h / 2); ctx.stroke();
    if (open > 0.02) {
      // tampa aberta + dinheiro aparecendo
      const lh = h * 0.55 * open;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2 - w * 0.06, -h / 2 - lh); ctx.lineTo(-w / 2 + w * 0.06, -h / 2 - lh); ctx.closePath();
      inked(ctx, fcol('#5c3a1e', fl), Math.max(1, w * 0.05));
      if (!fl) {
        ctx.fillStyle = '#7ed957';
        for (let i = 0; i < 4; i++) { const bx = -w * 0.36 + i * w * 0.2, by = -h / 2 - 2 - Math.abs(Math.sin(t * 14 + i)) * lh * 0.7; ctx.fillRect(bx, by, w * 0.16, h * 0.18); }
        G.call(G.Art, 'glow', ctx, 0, -h / 2, w * 0.7, '#fff0a0', 0.55 * open);
      }
    }
    ctx.beginPath(); rrect(ctx, -w / 2, -h / 2, w, h, Math.max(1.5, h * 0.14));
    inked(ctx, fcol('#8b5a2b', fl), Math.max(1, w * 0.05));
    if (!fl) {
      ctx.fillStyle = '#6e4420'; ctx.fillRect(-w / 2 + 1, -h * 0.3, w - 2, h * 0.08);
      // fechos dourados na borda de cima
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w * 0.38, -h * 0.56, w * 0.13, h * 0.24); ctx.fillRect(w * 0.25, -h * 0.56, w * 0.13, h * 0.24);
      if (label) {
        ctx.font = (h * (label.length > 2 ? 0.4 : 0.5)).toFixed(1) + 'px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = h * 0.12; ctx.strokeStyle = INK; ctx.strokeText(label, 0, h * 0.14);
        ctx.fillStyle = '#ffd23f'; ctx.fillText(label, 0, h * 0.14);
      }
    }
    ctx.restore();
  }
  define('lobista', {
    hp: 26, r: 18, score: 900, pix: 10,
    init(e, o) {
      initMove(e, o, { path: 'stop', ty: M.rand(100, 150), hold: 7.5, inT: 1.7, exit: 'up', sway: 10 });
      e.drop = e.drop ? [].concat(e.drop, 'mala') : 'mala';
      const d = e.data;
      d.cyc = 'wait'; d.ct = 0.7; d.ang = Math.random() * TAU; d.open = 0; d.dir = M.chance(0.5) ? 1 : -1; d.st = 0;
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      const hold = d.mv === 'hold';
      if (hold) {
        d.ct -= dt;
        if (d.cyc === 'wait' && d.ct <= 0) { d.cyc = 'fire'; d.ct = 2.1; d.st = 0.35; talk(e, LOB_LINES, 0.4); }
        else if (d.cyc === 'fire') {
          d.st -= dt;
          if (d.st <= 0) {
            d.st = 0.12;
            const arms = lvl() >= 3 ? 3 : 2;
            const mx = e.x + 11, my = e.y + 20;
            if (okShot(e, 80)) {
              for (let i = 0; i < arms; i++) G.fire(mx, my, d.ang + (i * TAU) / arms, spd(86), { style: 'en_cedula', color: COL.nota50 });
              if (((e.t * 8) | 0) % 3 === 0) sfx('enemy_shot');
            }
            d.ang += 0.3 * d.dir;
          }
          if (d.ct <= 0) { d.cyc = 'wait'; d.ct = ivl(1.7); d.dir = -d.dir; }
        }
      }
      d.open = M.approach(d.open, hold && d.cyc === 'fire' ? 1 : 0, dt * 4);
    },
    draw(ctx, e) {
      const d = e.data, size = 46;
      person(ctx, e, size, LOB, { mood: d.open > 0.5 ? 'laugh' : 'smug' });
      const h = hand(size, 'idle', e.t, LOB.seed, true);
      drawBriefcase(ctx, e.x + h.x + 1, e.y + h.y + 6, 19, 13, d.open, e.t, G.isFlash(e), '$');
    },
  });

  // ======================================================================
  // MARQUETEIRO — blinda (shieldT) quem está perto; alvo prioritário; foge
  // ======================================================================
  const MKT = { skin: '#f0c49c', hair: 'pompadour', hairColor: '#2a2a2a', body: 'shirt', shirt: '#ff5d8f', glasses: 'square', beard: 'goatee', beardColor: '#2a2a2a', seed: 12 };
  const MKT_LINES = ['É tudo narrativa!', 'Engajamento, gente!', 'Bora lacrar!', 'Isso aí é fake!', 'A culpa é do algoritmo!', 'Ângulo bom, sorri!'];
  define('marqueteiro', {
    hp: 14, r: 14, score: 800, pix: 6,
    init(e, o) {
      initMove(e, o, { path: 'stop', ty: M.rand(80, 120), hold: 10, inT: 1.5, exit: 'up', exitSpd: 190, sway: 22 });
      const d = e.data;
      d.links = []; d.ft = 1.8; d.ring = { x: e.x, y: e.y };
    },
    update(e, dt, g) {
      const wasLeaving = e.data.leaving;
      move(e, dt);
      const d = e.data;
      if (d.leaving && !wasLeaving) talk(e, ['Fui! Tenho outra campanha.', 'Minha parte já caiu!'], 1, 1.6, true);
      d.links.length = 0;
      if (!d.leaving && e.y > 20) {
        for (const o of g.enemies) {
          if (o === e || o.dead || o.big || o.kind === 'marqueteiro' || o.kind === 'maleta' || o.y < -5) continue;
          if (M.dist2(o.x, o.y, e.x, e.y) < 150 * 150) {
            o.shieldT = Math.max(o.shieldT, 0.12);
            if (d.links.length < 6) d.links.push(o);
          }
        }
      }
      if (d.mv === 'hold') {
        d.ft -= dt;
        if (d.ft <= 0) {
          d.ft = ivl(2.6);
          if (okShot(e)) { G.pat.aimedFan(e.x, e.y, 5, 0.9, spd(84), { style: 'star', color: COL.magenta }); sfx('enemy_shot2'); }
          talk(e, MKT_LINES, 0.3);
        }
      }
    },
    draw(ctx, e, g) {
      const d = e.data, size = 36, fl = G.isFlash(e);
      const h = hand(size, 'wave', e.t, MKT.seed, true);
      // pau de selfie com ring light
      const rx = e.x + h.x + 5, ry = e.y + h.y - 15;
      // feixes de luz para os blindados (por baixo do personagem)
      for (const o of d.links) {
        if (o.dead) continue;
        const a = Math.atan2(o.y - ry, o.x - rx), nx = -Math.sin(a), ny = Math.cos(a), w = o.r + 5;
        ctx.globalAlpha = 0.16 + Math.sin(g.t * 10) * 0.04;
        ctx.fillStyle = '#fff3a8';
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(o.x + nx * w, o.y + ny * w); ctx.lineTo(o.x - nx * w, o.y - ny * w); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.strokeStyle = G.C.yellow; ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 5]); ctx.lineDashOffset = -g.t * 40;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(o.x, o.y); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      person(ctx, e, size, MKT, { pose: 'wave', mood: d.leaving ? 'laugh' : 'smug' });
      ctx.strokeStyle = fcol('#444b58', fl); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(e.x + h.x, e.y + h.y); ctx.lineTo(rx, ry + 6); ctx.stroke();
      if (!fl) G.call(G.Art, 'glow', ctx, rx, ry, 15, '#fff6c8', 0.7 + Math.sin(g.t * 12) * 0.15);
      ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.arc(rx, ry, 6, 0, TAU); ctx.stroke();
      ctx.strokeStyle = fl ? '#fff' : '#fffbe6'; ctx.lineWidth = 2.4; ctx.stroke();
    },
  });

  // ======================================================================
  // BOT DE FAKE NEWS — enxame em curvas; às vezes mergulha (com aviso)
  // ======================================================================
  const BOT_LINES = ['FAKE!', 'Compartilha!', 'Vi no zap!', 'Repassa urgente!', 'FAKE!'];
  define('bot', {
    hp: 1, r: 8, score: 60, pix: 0,
    init(e, o) {
      initMove(e, o, { path: 'curve', spd: 140 });
      const d = e.data;
      d.dive = o.dive || 0; d.diveAt = o.diveAt || M.rand(1.0, 2.2); d.state = 'fly'; d.decided = false;
      // da fase 3 em diante, alguns bots também atiram
      d.fire = o.fire != null ? o.fire : lvl() >= 2 && Math.random() < 0.45;
      d.fireAt = o.fireAt || M.rand(0.8, 1.8);
      d.face = M.randi(0, 2);
    },
    update(e, dt) {
      const d = e.data, P = d.P;
      if (d.state === 'fly') {
        move(e, dt);
        if (d.dive && !d.decided && e.t > d.diveAt && e.y > 50 && e.y < G.H * 0.48 && e.x > 20 && e.x < G.W - 20) {
          d.decided = true;
          const p = player();
          if (p && p.alive && farFromPlayer(e.x, e.y, 140) && (d.dive === true || Math.random() < d.dive)) { d.state = 'aim'; d.st = 0.5; }
        }
        if (d.fire && !d.fired && e.t > d.fireAt && e.y > 30) { d.fired = true; if (okShot(e, 110)) G.pat.aimed(e.x, e.y, spd(112), { style: 'small', color: COL.magenta }); }
        if (Math.random() < dt * 0.35) talk(e, BOT_LINES, 0.5, 1.1);
      } else if (d.state === 'aim') {
        d.st -= dt;
        if (d.st <= 0) {
          d.state = 'dive';
          const a = aim(e), v = spd(245);
          e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v;
          sfx('dash');
        }
      } else {
        e.x += e.vx * dt; e.y += e.vy * dt;
        escapeCheck(e);
      }
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e);
      const jx = d.state === 'aim' ? Math.sin(e.t * 70) * 1.5 : 0;
      ctx.translate(e.x + jx, e.y);
      if (d.state === 'dive') ctx.rotate(Math.atan2(e.vy, e.vx) - DOWN);
      // hélice
      const pw = 9 * Math.abs(Math.cos(e.t * 38));
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -10); ctx.stroke();
      ctx.strokeStyle = fl ? '#fff' : '#c9d3e6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-pw, -10.5); ctx.lineTo(pw, -10.5); ctx.stroke();
      // corpo (celularzinho)
      rrect(ctx, -8.5, -6.5, 17, 14, 4); inked(ctx, fcol('#2b2f3a', fl), 1.5);
      const alarm = d.state === 'aim' && ((e.t * 16) | 0) % 2 === 0;
      rrect(ctx, -6.5, -4.5, 13, 9, 2.5);
      ctx.fillStyle = fl ? '#fff' : alarm ? '#ffffff' : d.state !== 'fly' ? COL.red : COL.magenta; ctx.fill();
      if (!fl) {
        // olhinhos maus
        ctx.fillStyle = alarm ? COL.red : '#ffffff';
        ctx.beginPath(); ctx.moveTo(-4.5, -2); ctx.lineTo(-1.2, -0.6); ctx.lineTo(-1.6, 1.6); ctx.lineTo(-4.4, 1.2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4.5, -2); ctx.lineTo(1.2, -0.6); ctx.lineTo(1.6, 1.6); ctx.lineTo(4.4, 1.2); ctx.closePath(); ctx.fill();
      }
      // bracinhos
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-8.5, 1); ctx.lineTo(-11, 4 + Math.sin(e.t * 20) * 1.5); ctx.moveTo(8.5, 1); ctx.lineTo(11, 4 - Math.sin(e.t * 20) * 1.5); ctx.stroke();
      if (d.state === 'aim') bang(ctx, 0, -19, g.t, COL.red);
    },
    onDeath(e) { revenge(e, 1, 110); },
  });

  // ======================================================================
  // CARRO DE SOM — caminhonete lenta; ondas sonoras em anel com brecha
  // ======================================================================
  function drawSoundTruck(ctx, x, y, t, beat, fl, bannerC) {
    const C = (c) => fcol(c, fl);
    ctx.save(); ctx.translate(x, y);
    // rodas
    ctx.fillStyle = C('#15171c');
    rrect(ctx, -25, 14, 10, 13, 3); ctx.fill(); rrect(ctx, 15, 14, 10, 13, 3); ctx.fill();
    // carroceria
    rrect(ctx, -24, -6, 48, 28, 6); inked(ctx, C('#f4f1e8'), 2);
    // faixa VOTE 171
    ctx.fillStyle = C(bannerC); ctx.fillRect(-23, 9, 46, 9);
    if (!fl) {
      ctx.fillStyle = '#ffffff'; ctx.font = '7px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('VOTE 171', 0, 13.8);
    }
    // para-brisa com motorista
    ctx.beginPath(); ctx.moveTo(-17, 6); ctx.lineTo(-14, -3); ctx.lineTo(14, -3); ctx.lineTo(17, 6); ctx.closePath(); inked(ctx, C('#1d3557'), 1.3);
    if (!fl) {
      ctx.fillStyle = '#d9a273'; ctx.beginPath(); ctx.arc(-6, 2.5, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(10, -2); ctx.lineTo(7, 5); ctx.lineTo(2, 5); ctx.closePath(); ctx.fill();
      // faróis
      ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(-19, 19.5, 2.4, 0, TAU); ctx.arc(19, 19.5, 2.4, 0, TAU); ctx.fill();
    }
    // alto-falantes (cornetas) no teto, pulsando com a batida
    const k = 1 + beat * 0.28;
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sd * 10, -10); ctx.rotate(sd * 0.55); ctx.scale(k, k);
      ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(3, 3); ctx.lineTo(7, -9); ctx.lineTo(-7, -9); ctx.closePath(); inked(ctx, C('#9aa5b8'), 1.4);
      ctx.beginPath(); ctx.ellipse(0, -9, 7, 2.4, 0, 0, TAU); inked(ctx, C('#2b2f3a'), 1.2);
      ctx.restore();
    }
    ctx.fillStyle = C('#5b6375'); ctx.fillRect(-4, -12, 8, 6);
    // ondinhas visuais
    if (!fl && beat > 0.05) {
      ctx.strokeStyle = 'rgba(255,61,216,' + (beat * 0.8).toFixed(2) + ')'; ctx.lineWidth = 2;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 16, -20, 8 + (1 - beat) * 10, sd < 0 ? PI * 0.9 : -PI * 0.6, sd < 0 ? PI * 1.6 : -PI * 0.1); ctx.stroke(); }
    }
    ctx.restore();
  }
  define('carro_som', {
    hp: 40, r: 24, score: 1300, pix: 12,
    init(e, o) {
      initMove(e, o, { vy: 24, amp: 0 });
      const d = e.data;
      d.ft = 1.5; d.beat = 0; d.col = M.pick([COL.magenta, COL.orange]); d.ring2 = 0;
      d.banner = M.pick(['#e63946', '#1b3fa0', '#00a651']);
      sfx('siren');
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      d.beat = Math.max(0, d.beat - dt * 2.6);
      d.ft -= dt;
      const n = 20 + Math.round(lvl()) * 2;
      // anel com brecha; a 2ª batida ("tum-TUM") sai com metade dos tiros, encaixada nos vãos
      const fire = (off, half) => {
        const gapHalf = (2.6 * TAU) / n, step = TAU / n;
        if (!half) d.gapA = aim(e) + M.rand(-0.7, 0.7);
        for (let i = 0; i < n; i++) {
          if (half && i % 2) continue;
          const a = off + i * step;
          if (Math.abs(M.wrapAngle(a - d.gapA)) < gapHalf) continue;
          G.fire(e.x, e.y - 4, a, spd(84), { style: 'en_onda', color: d.col });
        }
        d.beat = 1;
        sfx('enemy_shot2');
      };
      const can = e.y < G.H * 0.5 && okShot(e, 70);
      if (d.ft <= 0) {
        d.ft = ivl(2.2);
        if (can) { d.off = Math.random() * TAU; fire(d.off, false); if (lvl() >= 1) d.ring2 = 0.3; }
      }
      if (d.ring2 > 0) { d.ring2 -= dt; if (d.ring2 <= 0 && can) fire(d.off + PI / n, true); }
    },
    draw(ctx, e) {
      const d = e.data;
      drawSoundTruck(ctx, e.x, e.y, e.t, Math.max(d.beat, d.ft < 0.3 ? (0.3 - d.ft) * 2 : 0), G.isFlash(e), d.banner);
    },
  });

  // ======================================================================
  // SINDICALISTA — megafone; leques largos em rajadas, balão "GREVE!"
  // ======================================================================
  const SIND = { skin: '#c68a5e', hair: 'short', hairColor: '#222222', body: 'tshirt', shirt: '#e63946', hat: 'cap', hatColor: '#b81d2a', mustache: true, beard: 'stubble', face: 'round', brows: 'bushy', seed: 13 };
  const SIND_LINES = ['GREVE!', 'GREVE GERAL!', 'Ninguém trabalha hoje!', 'É GREVE, companheiro!'];
  function drawMegaphone(ctx, x, y, ang, k, fl) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(4, -3); ctx.lineTo(13, -7.5); ctx.lineTo(13, 7.5); ctx.lineTo(4, 3); ctx.lineTo(-2, 3); ctx.closePath();
    inked(ctx, fcol('#f4f1e8', fl), 1.4);
    ctx.fillStyle = fcol('#e63946', fl); ctx.fillRect(4, -3.6, 3, 7.2);
    ctx.beginPath(); ctx.ellipse(13, 0, 2.2, 7.5, 0, 0, TAU); inked(ctx, fcol('#2b2f3a', fl), 1.1);
    ctx.restore();
  }
  define('sindicalista', {
    hp: 16, r: 15, score: 650, pix: 5,
    init(e, o) {
      initMove(e, o, { path: 'stop', ty: M.rand(100, 160), hold: 7.5, inT: 1.4, exit: 'up' });
      const d = e.data;
      d.cyc = 'wait'; d.ct = 0.9; d.burst = 0; d.bt = 0; d.aimA = DOWN;
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      if (d.mv !== 'hold') { d.cyc = 'wait'; return; }
      d.ct -= dt;
      if (d.cyc === 'wait') { d.aimA = M.clamp(aim(e), DOWN - 0.8, DOWN + 0.8); if (d.ct <= 0) { d.cyc = 'wind'; d.ct = 0.7; } }
      else if (d.cyc === 'wind') {
        if (d.ct > 0.15) d.aimA = M.clamp(aim(e), DOWN - 0.8, DOWN + 0.8);
        if (d.ct <= 0) { d.cyc = 'fire'; d.burst = 0; d.bt = 0; talk(e, SIND_LINES, 1, 1.2, (e.data.saidT || 0) < e.t); e.data.saidT = e.t + 3; sfx('shout'); }
      } else if (d.cyc === 'fire') {
        d.bt -= dt;
        if (d.bt <= 0) {
          const n = 9 + Math.round(lvl()), spread = 1.45;
          if (okShot(e, 90)) G.pat.fan(e.x, e.y + 6, d.aimA + (d.burst % 2 ? spread / (n - 1) / 2 : 0), n, spread, spd(100 + d.burst * 9), { style: 'rice', color: COL.orange });
          d.burst++; d.bt = 0.24;
          if (d.burst >= 3) { d.cyc = 'wait'; d.ct = ivl(2.0); }
        }
      }
    },
    draw(ctx, e, g) {
      const d = e.data, size = 38;
      const wind = d.cyc === 'wind', firing = d.cyc === 'fire';
      person(ctx, e, size, SIND, { pose: 'point', mood: firing || wind ? 'angry' : 'normal', mouth: firing ? 1 : 0 });
      const h = hand(size, 'point', e.t, SIND.seed, true);
      const shake = wind ? Math.sin(e.t * 60) * 1.2 : 0;
      drawMegaphone(ctx, e.x + h.x + shake, e.y + h.y, d.aimA, wind ? 1.15 : 1, G.isFlash(e));
      if (wind) bang(ctx, e.x - 12, e.y - 26, g.t, G.C.yellow);
    },
  });

  // ======================================================================
  // LEÃO DA RECEITA — espreita, avisa e dá o bote: morde 15% do seu Pix
  // (contato não mata: harmless). Derrube enquanto ele foge = RESTITUIÇÃO.
  // ======================================================================
  function drawLion(ctx, x, y, o) {
    const fl = o.flash, C = (c) => fcol(c, fl), t = o.t;
    ctx.save(); ctx.translate(x, y);
    ctx.scale(o.sx || 1, o.sy || 1);
    // rabo
    ctx.strokeStyle = C('#c96a14'); ctx.lineWidth = 3; ctx.lineCap = 'round';
    const tw = Math.sin(t * 5) * 6;
    ctx.beginPath(); ctx.moveTo(10, 16); ctx.quadraticCurveTo(26, 14 + tw, 24, 2 + tw); ctx.stroke();
    ctx.fillStyle = C('#7a3d0a'); ctx.beginPath(); ctx.arc(24, 1 + tw, 3.2, 0, TAU); ctx.fill();
    // corpo de terno (servidor da Receita)
    ctx.beginPath(); ctx.moveTo(-13, 26); ctx.quadraticCurveTo(-14, 10, -7, 7); ctx.lineTo(7, 7); ctx.quadraticCurveTo(14, 10, 13, 26); ctx.closePath();
    inked(ctx, C('#1f2a44'), 1.6);
    ctx.beginPath(); ctx.moveTo(-4, 7); ctx.lineTo(0, 15); ctx.lineTo(4, 7); ctx.closePath(); ctx.fillStyle = C('#f2f2f2'); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1.6, 8); ctx.lineTo(1.6, 8); ctx.lineTo(2.2, 15); ctx.lineTo(0, 18); ctx.lineTo(-2.2, 15); ctx.closePath(); ctx.fillStyle = C('#ffd23f'); ctx.fill();
    // patas (erguidas no bote)
    const py = o.pounce ? 6 : 24, px = o.pounce ? 15 : 9;
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sd * px, py, 4.6, 4, 0, 0, TAU); inked(ctx, C('#f5c04a'), 1.3);
      if (!fl) { ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(sd * px + i * 1.8, py + (o.pounce ? -3.5 : 2)); ctx.lineTo(sd * px + i * 2.2, py + (o.pounce ? -6 : 4.5)); } ctx.stroke(); }
    }
    // juba
    const bristle = o.bristle || 0;
    ctx.beginPath();
    const n = 14, R1 = 19 + bristle * 3, R0 = 14.5;
    for (let i = 0; i < n * 2; i++) {
      const a = (i * PI) / n + Math.sin(t * 3) * 0.04, rr = i % 2 ? R0 : R1 + Math.sin(t * 7 + i) * 0.8;
      const px2 = Math.cos(a) * rr, py2 = -4 + Math.sin(a) * rr * 0.95;
      if (i) ctx.lineTo(px2, py2); else ctx.moveTo(px2, py2);
    }
    ctx.closePath(); inked(ctx, C('#d96d12'), 1.8);
    ctx.beginPath(); ctx.arc(0, -4, 14, 0, TAU); ctx.fillStyle = C('#b8560c'); ctx.fill();
    // orelhas
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 9, -14, 3.6, 0, TAU); inked(ctx, C('#f5c04a'), 1.2); }
    // rosto
    ctx.beginPath(); ctx.ellipse(0, -3, 11.5, 12, 0, 0, TAU); inked(ctx, C('#f5c04a'), 1.6);
    if (!fl) {
      // viseira verde de contador
      ctx.fillStyle = 'rgba(34,163,90,0.9)';
      ctx.beginPath(); ctx.moveTo(-12, -11); ctx.quadraticCurveTo(0, -18, 12, -11); ctx.lineTo(13, -7.5); ctx.quadraticCurveTo(0, -13, -13, -7.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = '5px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('IR', 0, -11.6);
      // olhos
      const red = o.eyesRed;
      ctx.fillStyle = red ? '#ff2a4a' : '#ffffff';
      ctx.beginPath(); ctx.ellipse(-4.6, -4, 2.8, 2.6, 0, 0, TAU); ctx.ellipse(4.6, -4, 2.8, 2.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = red ? '#fff' : INK;
      const lx = M.clamp(o.lookX || 0, -1, 1) * 1.1;
      ctx.beginPath(); ctx.arc(-4.6 + lx, -3.6, 1.3, 0, TAU); ctx.arc(4.6 + lx, -3.6, 1.3, 0, TAU); ctx.fill();
      // sobrancelhas bravas
      ctx.strokeStyle = '#7a3d0a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-8, -8.6); ctx.lineTo(-2, -6.4); ctx.moveTo(8, -8.6); ctx.lineTo(2, -6.4); ctx.stroke();
      // focinho
      ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.ellipse(-2.6, 3, 3.6, 2.8, 0, 0, TAU); ctx.ellipse(2.6, 3, 3.6, 2.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a2a10'; ctx.beginPath(); ctx.moveTo(-2.4, -0.4); ctx.lineTo(2.4, -0.4); ctx.lineTo(0, 2.2); ctx.closePath(); ctx.fill();
      // boca
      if (o.mouth > 0.1) {
        ctx.fillStyle = '#5a1a1a'; ctx.beginPath(); ctx.ellipse(0, 7.5, 4.5, 2 + o.mouth * 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-3.4, 5.5); ctx.lineTo(-2.2, 8.5); ctx.lineTo(-1, 5.5); ctx.moveTo(3.4, 5.5); ctx.lineTo(2.2, 8.5); ctx.lineTo(1, 5.5); ctx.fill();
      } else {
        ctx.strokeStyle = '#5a2a10'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-3.5, 6.4); ctx.quadraticCurveTo(0, 8, 3.5, 6.4); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function lionBite(e) {
    const g = G.game, run = G.run, p = g.player;
    const d = e.data;
    if (d.bit) return;
    d.bit = true;
    let steal = Math.max(5, Math.round(run.pix * 0.15));
    steal = Math.min(steal, Math.max(0, run.pix));
    run.pix = Math.max(0, run.pix - steal);
    // tira também do que ainda não foi pro cofre (o save), sem ficar negativo
    const unc = Math.max(0, g.pixStage - g.pixCommitted);
    g.pixStage -= Math.min(unc, steal);
    d.stolen = steal;
    if (steal > 0) {
      G.text(p.x, p.y - 34, 'MORDIDA DO LEÃO -R$ ' + steal, { color: G.C.orange, size: 13, life: 1.7, vy: -22 });
      G.burst(p.x, p.y - 8, 12, { colors: [G.C.pix, '#ffffff'], speed: 150, life: 0.5 });
    } else {
      G.text(p.x, p.y - 34, 'MORDIDA DO LEÃO: ISENTO!', { color: G.C.orange, size: 12, life: 1.6, vy: -22 });
    }
    G.shake(4);
    G.vibrate(80);
    sfx('bite');
    e.vx *= -0.15; e.vy = -110; // quica pra trás e foge com o dinheiro
    talk(e, steal > 0 ? ['NHAC! Imposto pago!', 'Mordida de 15%!', 'Leão agradece!'] : 'Sem Pix? Que pena.', 1, 1.6, true);
    d.st = 'flee';
  }
  define('leao', {
    hp: 30, r: 17, score: 1500, pix: 8, harmless: true,
    init(e, o) {
      const d = e.data;
      d.st = 'enter'; d.stT = 0; d.y0 = e.y; d.x0 = e.x;
      d.ty = o.ty != null ? o.ty : M.rand(G.H * 0.17, G.H * 0.25);
      d.tx = M.clamp(o.tx != null ? o.tx : e.x, 40, G.W - 40);
      d.pounces = 0; d.maxP = o.pounces || (loop2() ? 3 : 2); d.dir = M.chance(0.5) ? 1 : -1;
      d.stolen = 0; d.bit = false; d.mouth = 0; d.fired = false;
    },
    update(e, dt) {
      const d = e.data, p = player();
      d.stT += dt;
      d.mouth = M.approach(d.mouth, d.st === 'pounce' || d.st === 'aim' ? 1 : 0, dt * 5);
      switch (d.st) {
        case 'enter': {
          const k = M.clamp(d.stT / 1.3, 0, 1);
          e.x = M.lerp(d.x0, d.tx, M.easeOutCubic(k)); e.y = M.lerp(d.y0, d.ty, M.easeOutCubic(k));
          if (k >= 1) { d.st = 'prowl'; d.stT = 0; d.prowlT = M.rand(1.5, 2.2); }
          break;
        }
        case 'prowl': { // anda de um lado pro outro, de olho em você
          e.x += d.dir * 75 * dt;
          if (e.x < 36 || e.x > G.W - 36) { d.dir = -d.dir; e.x = M.clamp(e.x, 36, G.W - 36); }
          e.y = M.lerp(e.y, d.ty, 1 - Math.pow(0.1, dt)) + Math.sin(d.stT * 8) * 0.4;
          if (!d.fired && d.stT > 0.7) {
            d.fired = true;
            if (okShot(e, 110)) { G.pat.aimedFan(e.x, e.y + 4, lvl() >= 3 ? 5 : 3, 0.5, spd(100), { style: 'en_imposto', color: COL.orange }); sfx('enemy_shot'); }
          }
          if (d.stT > d.prowlT && p && p.alive && !p.entering) {
            if (d.pounces >= d.maxP) { d.st = 'flee'; talk(e, ['Até o próximo IR!', 'Volto em abril!'], 1, 1.6, true); break; }
            d.st = 'aim'; d.stT = 0;
            d.lx = M.clamp(p.x, 20, G.W - 20); d.ly = M.clamp(p.y, e.y + 60, G.H - 40);
            sfx('shout');
            talk(e, ['Cadê a nota fiscal?', 'Declarou tudo?', 'Malha fina!', 'GRRR... imposto!'], 0.7, 1.2);
          }
          break;
        }
        case 'aim': { // aviso: agacha, olhos vermelhos, linha tracejada até o alvo
          const tAim = loop2() ? 0.72 : 0.85;
          if (d.stT >= tAim) {
            d.st = 'pounce'; d.stT = 0; d.pounces++;
            const a = Math.atan2(d.ly - e.y, d.lx - e.x), v = loop2() ? 600 : 520;
            e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v;
            d.plen = Math.hypot(d.lx - e.x, d.ly - e.y) + 40;
            d.trav = 0;
            sfx('dash');
          }
          break;
        }
        case 'pounce': {
          const step = Math.hypot(e.vx, e.vy) * dt;
          e.x += e.vx * dt; e.y += e.vy * dt; d.trav += step;
          if (p && p.alive && !p.entering && p.inv <= 0 && p.bombT <= 0 && M.dist2(e.x, e.y, p.x, p.y) < (e.r + 10) * (e.r + 10)) { lionBite(e); break; }
          if (d.trav >= d.plen || e.y > G.H - 30 || e.x < 10 || e.x > G.W - 10) { d.st = 'back'; d.stT = 0; }
          break;
        }
        case 'back': { // errou: volta para a espreita
          e.vx *= Math.pow(0.02, dt); e.vy *= Math.pow(0.02, dt);
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (d.stT > 0.35) {
            e.y = M.approach(e.y, d.ty, 210 * dt);
            if (Math.abs(e.y - d.ty) < 2) { d.st = 'prowl'; d.stT = 0; d.prowlT = M.rand(1.0, 1.7); d.fired = false; }
          }
          break;
        }
        default: { // 'flee': sai correndo pra cima (dá pra derrubar e pegar de volta)
          e.vx = M.approach(e.vx, 0, 400 * dt);
          e.vy = M.approach(e.vy, -(d.stolen ? 150 : 190), 500 * dt);
          e.x += e.vx * dt; e.y += e.vy * dt;
          e.x = M.clamp(e.x, 16, G.W - 16);
          if (e.y < -50) { e.dead = true; e.escaped = true; }
        }
      }
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e), p = player();
      const aiming = d.st === 'aim';
      if (aiming) {
        // linha do bote + mira com "%"
        const k = d.stT / 0.85;
        ctx.save();
        ctx.strokeStyle = COL.orange; ctx.globalAlpha = 0.18;
        ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(d.lx, d.ly); ctx.stroke();
        ctx.globalAlpha = 0.6 + 0.35 * Math.sin(g.t * 28);
        ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -g.t * 70;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(d.lx, d.ly, 16 - k * 6, 0, TAU); ctx.stroke();
        ctx.font = '11px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = COL.orange; ctx.fillText('%', d.lx, d.ly);
        ctx.restore();
      }
      const pounce = d.st === 'pounce';
      const sq = aiming ? 1 - Math.min(1, d.stT / 0.5) * 0.12 : 1;
      drawLion(ctx, e.x, e.y, {
        t: e.t, flash: fl, sx: aiming ? 2 - sq : pounce ? 0.92 : 1, sy: aiming ? sq : pounce ? 1.12 : 1,
        pounce: pounce || d.st === 'back', eyesRed: aiming || pounce, mouth: d.mouth, bristle: aiming ? 1 : 0,
        lookX: p ? (p.x - e.x) / 100 : 0,
      });
      if (aiming) bang(ctx, e.x, e.y - 32, g.t, COL.orange);
      if (d.st === 'flee' && d.stolen > 0) {
        // saco de Pix roubado nas costas
        ctx.save(); ctx.translate(e.x + 15, e.y - 8 + Math.sin(e.t * 12) * 1.5);
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); inked(ctx, fcol(G.C.pix, fl), 1.3);
        if (!fl) { ctx.fillStyle = '#fff'; ctx.font = '7px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R$', 0, 0.5); }
        ctx.restore();
      }
    },
    onDeath(e) {
      const d = e.data;
      if (d.stolen > 0) {
        const back = Math.round(d.stolen * 1.5);
        G.dropPix(e.x, e.y, back);
        G.text(e.x, e.y - 24, 'RESTITUIÇÃO! +R$ ' + back, { color: G.C.greenL, size: 13, life: 1.6, vy: -24 });
        sfx('pix_big');
      }
    },
  });

  // ======================================================================
  // MINISTRO — grupos: conga e formação em V, tiros mirados
  // ======================================================================
  const MIN = [
    { skin: '#e8b48a', hair: 'gray', hairColor: '#cfcfcf', body: 'suit', suit: '#1f2a44', shirt: '#f2f2f2', tie: '#e63946', face: 'jowl', seed: 14 },
    { skin: '#c68a5e', hair: 'bald', hairColor: '#333333', body: 'suit', suit: '#2b2b2b', shirt: '#f2f2f2', tie: '#ffd23f', glasses: 'square', seed: 15 },
    { skin: '#f0c49c', hair: 'bun', hairColor: '#4a3020', body: 'suit', suit: '#7a2e3a', shirt: '#f4f1e8', face: 'oval', seed: 16 },
    { skin: '#9a6644', hair: 'short', hairColor: '#1a1a1a', body: 'suit', suit: '#34508a', shirt: '#f2f2f2', tie: '#00a651', mustache: true, seed: 17 },
    { skin: '#e0a882', hair: 'combover', hairColor: '#6b5a48', body: 'suit', suit: '#4a4f5c', shirt: '#f2f2f2', tie: '#ff8c1a', face: 'long', glasses: 'round', seed: 18 },
    { skin: '#f0c49c', hair: 'long', hairColor: '#c9a15a', body: 'suit', suit: '#1b3fa0', shirt: '#ffffff', face: 'oval', seed: 19 },
  ];
  const MIN_LINES = ['Sou o 39º ministro!', 'Ministério do Puxadinho!', 'Ministro de quê? Sei lá!', 'Tô só de passagem!', 'Ministério da Picanha!', 'Reunião? Só se tiver café.'];
  define('ministro', {
    hp: 6, r: 12, score: 220, pix: 2,
    init(e, o) {
      initMove(e, o, { vy: 80 });
      const d = e.data;
      d.v = o.v != null ? o.v % MIN.length : M.randi(0, MIN.length - 1);
      d.fire = o.fire != null ? o.fire : 1;
      d.ft = first(0.8, 1.9);
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      if (!d.fire || d.leaving) return;
      d.ft -= dt;
      if (d.ft <= 0) {
        d.ft = ivl(M.rand(2.2, 3.0)) / d.fire;
        if (okShot(e)) { G.pat.aimed(e.x, e.y, spd(120), { style: 'rice', color: COL.pink }); sfx('enemy_shot'); talk(e, MIN_LINES, 0.08); }
      }
    },
    draw(ctx, e) {
      const d = e.data;
      person(ctx, e, 31, MIN[d.v], { pose: d.P && d.P.conga ? 'hold' : 'idle', facing: e.vx < -20 ? -1 : 1 });
    },
    onDeath(e) { revenge(e, 1, 105); },
  });

  // ======================================================================
  // MOTOQUEIRO DA MOTOCIATA — passagens rápidas pelas laterais soltando tiros pra baixo
  // (o chefão Bolsonário pode usar este id como escolta: opts dir/vx/spd/ty)
  // ======================================================================
  const MOTO = [
    { skin: '#e0a882', hair: 'none', body: 'tshirt', shirt: '#ffd23f', hat: 'helmet', hatColor: '#00a651', seed: 20 },
    { skin: '#c68a5e', hair: 'none', body: 'tshirt', shirt: '#00a651', hat: 'helmet', hatColor: '#ffd23f', seed: 21 },
    { skin: '#f0c49c', hair: 'none', body: 'tshirt', shirt: '#ffffff', hat: 'helmet', hatColor: '#1b3fa0', glasses: 'dark', seed: 22 },
  ];
  define('motoqueiro', {
    hp: 8, r: 14, score: 320, pix: 2,
    init(e, o) {
      const d = e.data;
      d.dir = o.dir || (o.vx ? Math.sign(o.vx) : e.x < G.W / 2 ? 1 : -1);
      d.spd = Math.abs(o.vx || 0) || o.spd || 205;
      d.ty = o.ty != null ? o.ty : e.y < 40 ? M.rand(110, 200) : e.y;
      d.ft = M.rand(0.2, 0.5); d.smoke = 0; d.v = o.v != null ? o.v % MOTO.length : M.randi(0, MOTO.length - 1);
      d.fire = o.fire != null ? o.fire : 1;
      d.ph = Math.random() * TAU;
      sfx('motor');
    },
    update(e, dt) {
      const d = e.data;
      e.vx = d.dir * d.spd;
      e.x += e.vx * dt;
      const dy = d.ty - e.y;
      e.vy = Math.abs(dy) > 1 ? M.clamp(dy * 4, -260, 260) : 0;
      e.y += e.vy * dt;
      d.bounce = Math.abs(Math.sin(e.t * 9 + d.ph)) * 1.6;
      d.ft -= dt;
      if (d.ft <= 0) {
        d.ft = ivl(0.44) / d.fire;
        if (d.fire && e.x > 14 && e.x < G.W - 14 && e.y > 30 && e.y < G.H * 0.6) {
          const o = { style: 'small', color: COL.orange, accel: 170, maxSpd: spd(210) };
          if (lvl() >= 2) { G.fire(e.x - d.dir * 6, e.y + 10, DOWN - 0.22, spd(55), o); G.fire(e.x - d.dir * 6, e.y + 10, DOWN + 0.22, spd(55), o); }
          else G.fire(e.x - d.dir * 6, e.y + 10, DOWN, spd(55), o);
        }
      }
      d.smoke -= dt;
      if (d.smoke <= 0 && e.x > -10 && e.x < G.W + 10) {
        d.smoke = 0.08;
        G.part({ x: e.x - d.dir * 16, y: e.y + 8, vx: -d.dir * 30, vy: -10, type: 'smoke', size: 3, life: 0.45, color: 'rgba(200,200,210,0.35)', drag: 0.92 });
      }
      escapeCheck(e);
    },
    draw(ctx, e) {
      const d = e.data, fl = G.isFlash(e), C = (c) => fcol(c, fl);
      ctx.translate(e.x, e.y - d.bounce);
      if (d.dir < 0) ctx.scale(-1, 1);
      // bandeira verde-amarela
      ctx.strokeStyle = C('#5a4632'); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-13, 2); ctx.lineTo(-15, -26); ctx.stroke();
      const w = Math.sin(e.t * 14) * 2;
      ctx.beginPath(); ctx.moveTo(-15, -26); ctx.quadraticCurveTo(-21, -27 + w, -28, -25 - w); ctx.lineTo(-27, -16 - w); ctx.quadraticCurveTo(-21, -18 + w, -15, -17); ctx.closePath();
      inked(ctx, C('#00a651'), 1);
      if (!fl) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-17, -21.5); ctx.lineTo(-21, -24 + w * 0.5); ctx.lineTo(-25.5, -21 - w * 0.5); ctx.lineTo(-21, -18.5 + w * 0.5); ctx.closePath(); ctx.fill(); }
      // piloto
      G.Art.person(ctx, -1, -12, 27, MOTO[d.v], { t: e.t, flash: fl, pose: 'drive', lookX: 0.8, lookY: 0.3, autoLook: false, mood: 'laugh' });
      // rodas
      for (const wx of [-13, 13]) {
        ctx.beginPath(); ctx.arc(wx, 10, 6.5, 0, TAU); inked(ctx, C('#1a1c22'), 1.4);
        ctx.fillStyle = C('#9aa5b8'); ctx.beginPath(); ctx.arc(wx, 10, 2.4, 0, TAU); ctx.fill();
        if (!fl) { ctx.strokeStyle = '#6b7383'; ctx.lineWidth = 0.8; const a = e.t * 25; ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 5, 10 + Math.sin(a) * 5); ctx.lineTo(wx - Math.cos(a) * 5, 10 - Math.sin(a) * 5); ctx.stroke(); }
      }
      // quadro + tanque
      ctx.beginPath(); ctx.moveTo(-15, 6); ctx.lineTo(-8, 0); ctx.lineTo(9, -2); ctx.lineTo(14, 4); ctx.lineTo(6, 8); ctx.lineTo(-10, 8); ctx.closePath();
      inked(ctx, C('#00a651'), 1.5);
      if (!fl) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-4, 1); ctx.lineTo(8, -0.5); ctx.lineTo(10, 2.5); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill(); }
      // guidão, farol e escapamento
      ctx.strokeStyle = C('#c9d3e6'); ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(15, -7); ctx.lineTo(11, -9); ctx.stroke();
      ctx.fillStyle = C('#ffe28a'); ctx.beginPath(); ctx.arc(17, -1, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = C('#c9d3e6'); ctx.fillRect(-19, 6.5, 9, 2.6);
    },
  });

  // ======================================================================
  // DRONE DO GABINETE — paira; pisca vermelho e solta rajada de agulhas mirada
  // ======================================================================
  define('drone', {
    hp: 6, r: 12, score: 300, pix: 2,
    init(e, o) {
      initMove(e, o, { path: 'stop', ty: M.rand(90, G.H * 0.4), hold: 8, inT: 1.2, exit: 'side', sway: 26 });
      const d = e.data;
      d.cyc = 'idle'; d.ct = M.rand(0.5, 1.1); d.lockA = DOWN; d.n = 0; d.bt = 0;
    },
    update(e, dt) {
      move(e, dt);
      const d = e.data;
      if (d.mv !== 'hold') { d.cyc = 'idle'; return; }
      d.ct -= dt;
      if (d.cyc === 'idle') { if (d.ct <= 0) { d.cyc = 'warn'; d.ct = 0.65; } }
      else if (d.cyc === 'warn') {
        if (d.ct > 0.22) d.lockA = aim(e); // trava a mira um pouco antes de atirar
        if (d.ct <= 0) { d.cyc = 'fire'; d.n = 0; d.bt = 0; }
      } else if (d.cyc === 'fire') {
        d.bt -= dt;
        if (d.bt <= 0) {
          if (okShot(e, 90)) { G.fire(e.x, e.y + 7, d.lockA, spd(182), { style: 'needle', color: COL.red }); sfx('enemy_shot'); }
          d.n++; d.bt = 0.075;
          if (d.n >= (lvl() >= 2 ? 5 : 4)) { d.cyc = 'idle'; d.ct = ivl(1.7); }
        }
      }
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e), C = (c) => fcol(c, fl);
      const warn = d.cyc === 'warn';
      if (warn && d.ct < 0.4) {
        // mira laser fininha
        ctx.save(); ctx.globalAlpha = 0.35 + 0.3 * Math.sin(g.t * 40);
        ctx.strokeStyle = COL.red; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y + 6); ctx.lineTo(e.x + Math.cos(d.lockA) * 220, e.y + 6 + Math.sin(d.lockA) * 220); ctx.stroke();
        ctx.restore();
      }
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.sin(e.t * 2) * 0.06);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-13, -9); ctx.lineTo(13, 9); ctx.moveTo(13, -9); ctx.lineTo(-13, 9); ctx.stroke();
      ctx.strokeStyle = C('#6b7383'); ctx.lineWidth = 1.8; ctx.stroke();
      for (const [rx, ry] of [[-13, -9], [13, -9], [-13, 9], [13, 9]]) {
        ctx.fillStyle = 'rgba(220,230,245,0.35)'; ctx.beginPath(); ctx.ellipse(rx, ry, 7.5, 3, 0, 0, TAU); ctx.fill();
        const a = e.t * 40 + rx;
        ctx.strokeStyle = C('#e6ecf5'); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(rx - Math.cos(a) * 7, ry - Math.sin(a) * 2.6); ctx.lineTo(rx + Math.cos(a) * 7, ry + Math.sin(a) * 2.6); ctx.stroke();
      }
      rrect(ctx, -8, -6.5, 16, 13, 4); inked(ctx, C('#3a3f4b'), 1.5);
      const blink = warn && ((e.t * 18) | 0) % 2 === 0;
      if (!fl && blink) G.call(G.Art, 'glow', ctx, 0, 4, 14, '#ff2a4a', 0.8);
      ctx.beginPath(); ctx.arc(0, 4, 3.6, 0, TAU); inked(ctx, fl ? '#fff' : blink ? '#ff2a4a' : '#1d2233', 1.2);
      if (!fl) {
        ctx.fillStyle = warn ? '#ff8a9a' : '#4cc9f0'; ctx.beginPath(); ctx.arc(-1, 3, 1.1, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(-5, -4.5, 10, 2.4);
      }
    },
  });

  // ======================================================================
  // CHEFES INTERMEDIÁRIOS — ciclo comum: entra → luta (padrões) → foge se demorar
  // ======================================================================
  function mbStart(e, o, dur, homeY) {
    const d = e.data;
    d.st = 'enter'; d.stT = 0; d.y0 = e.y; d.homeY = homeY; d.dur = o.dur || dur; d.fightT = 0;
    d.patI = 0; d.pat = null; d.patT = 0; d.pt = 0;
    if (!e.drop) e.drop = ['power', 'bomb'];
  }
  function mbEnter(e, dt, T) {
    const d = e.data; d.stT += dt;
    const k = M.clamp(d.stT / T, 0, 1);
    e.y = M.lerp(d.y0, d.homeY, M.easeOutCubic(k));
    if (k >= 1) { d.st = 'fight'; d.stT = 0; }
  }
  // próximo padrão da lista (pula os marcados como "só na metade final" enquanto hp > 55%)
  function mbNext(e, list, durs) {
    const d = e.data;
    let p = list[d.patI++ % list.length];
    if (p.charAt(0) === '*') { p = p.slice(1); if (e.hp / e.maxHp > 0.55) p = list[d.patI++ % list.length].replace('*', ''); }
    d.pat = p; d.patT = durs[p] || 4; d.pt = 0.6; d.pn = 0;
    return p;
  }
  function mbFlee(e, text) {
    const d = e.data;
    d.st = 'leave'; d.stT = 0;
    talk(e, text, 1, 2.2, true);
    G.text(e.x, e.y + 40, 'FUGIU!', { color: G.C.orange, size: 14, life: 1.4, vy: -20 });
  }
  function mbDeath(e, msg) {
    G.clearBullets(true);
    G.confetti(e.x, e.y, 28);
    G.shake(8);
    if (msg) G.text(G.W / 2, Math.max(110, e.y + 36), msg, { color: G.C.yellow, size: 15, life: 1.8, vy: -18 });
  }
  // Zona de acerto extra (invisível) presa a um chefe intermediário largo: repassa o dano ao "pai".
  // Ignora bomba (o pai já leva a dele) e não soma em dobro com o jato d'água (que atravessa tudo).
  define('mb_hit', {
    hp: 1e9, r: 20, score: 1, pix: 0, harmless: true, keepOffscreen: true, noScale: true, ignoreClear: true,
    init(e, o) { e.data.parent = o.parent; e.data.dx = o.dx || 0; e.data.dy = o.dy || 0; },
    update(e) {
      const P = e.data.parent;
      if (!P || P.dead) { e.dead = true; e.escaped = true; return; }
      e.x = P.x + e.data.dx; e.y = P.y + e.data.dy;
    },
    onHit(e, dmg, g) {
      e.hp = 1e9;
      const P = e.data.parent;
      if (!P || P.dead || dmg > 10) return;
      const bm = g.beam;
      if (bm && G.run && G.run.weapon === 'jato' && P.y < bm.y0 && Math.abs(P.x - bm.x) < P.r + bm.w / 2) return;
      G.hitEnemy(P, dmg);
    },
    draw() {},
  });
  function mbHitZone(parent, dx, dy, r) { return G.spawnEnemy('mb_hit', parent.x + dx, parent.y + dy, { parent, dx, dy, r }); }

  // anel com brecha (ondas sonoras)
  function gappedRing(x, y, n, speed, color, gapN, gapJit) {
    const gapA = G.aim(x, y) + M.rand(-gapJit, gapJit), gapHalf = ((gapN / 2) * TAU) / n, step = TAU / n;
    const off = Math.random() * step;
    for (let i = 0; i < n; i++) {
      const a = off + i * step;
      if (Math.abs(M.wrapAngle(a - gapA)) < gapHalf) continue;
      G.fire(x, y, a, speed, { style: 'en_onda', color });
    }
  }

  // ----------------------------------------------------------------------
  // TRIO ELÉTRICO DO CANDIDATO (fase 1)
  // caminhão de trio com torres de som (destrutíveis) e o candidato dançando
  // ----------------------------------------------------------------------
  const TRIO_C = { skin: '#e8b48a', hair: 'pompadour', hairColor: '#3a2a20', body: 'suit', suit: '#f4f1e8', shirt: '#ffd23f', tie: '#e63946', sash: ['#e63946', '#ffd23f'], grin: true, seed: 30 };
  const TRIO_LINES = ['Tira o pé do chão!', 'Vem pro trio, eleitor!', 'Mão pro alto quem é 171!', 'Aí, galera do Plano!', 'Promessa é dívida... né?'];
  const TRIO_DUR = { rings: 5.2, santinhos: 3.8, notas: 3.6 };
  function drawTrio(ctx, e, g) {
    const d = e.data, fl = G.isFlash(e), C = (c) => fcol(c, fl), t = e.t;
    ctx.save(); ctx.translate(e.x, e.y);
    // rodas
    ctx.fillStyle = C('#15171c');
    for (const sx of [-1, 1]) { rrect(ctx, sx * 56 - 11, 30, 22, 17, 5); ctx.fill(); }
    // mastros e faixa VOTE 171
    ctx.strokeStyle = C('#c9d3e6'); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-46, -22); ctx.lineTo(-46, -88); ctx.moveTo(46, -22); ctx.lineTo(46, -88); ctx.stroke();
    const sway = Math.sin(t * 3) * 1.5;
    ctx.beginPath(); ctx.moveTo(-48, -97); ctx.quadraticCurveTo(0, -99 + sway, 48, -97); ctx.lineTo(48, -79); ctx.quadraticCurveTo(0, -81 + sway, -48, -79); ctx.closePath();
    inked(ctx, C('#e63946'), 2);
    if (!fl) {
      ctx.fillStyle = '#ffffff'; ctx.font = '12px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('VOTE 171', 0, -88 + sway * 0.5);
    }
    // palco (deck) com grade e luzinhas
    rrect(ctx, -70, -24, 140, 16, 3); inked(ctx, C('#2b2f3a'), 2);
    ctx.strokeStyle = C('#9aa5b8'); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-68, -33); ctx.lineTo(68, -33);
    for (let i = -4; i <= 4; i++) { ctx.moveTo(i * 16, -33); ctx.lineTo(i * 16, -24); }
    ctx.stroke();
    if (!fl) {
      const cs = ['#ff3dd8', '#ffd23f', '#4cc9f0', '#3ddc84'];
      for (let i = 0; i < 12; i++) {
        const on = ((t * 6 + i) | 0) % 2 === 0;
        ctx.fillStyle = on ? cs[i % 4] : 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(-62 + i * 11.3, -16, 2.2, 0, TAU); ctx.fill();
      }
    }
    // candidato dançando no palco
    const pose = Math.floor(t * 2.4) % 2 ? 'up' : 'wave';
    G.Art.person(ctx, 0, -50 - Math.abs(Math.sin(t * 4.8)) * 3, 54, TRIO_C, { t, flash: fl, pose, mood: d.pat === 'santinhos' || d.pat === 'notas' ? 'laugh' : 'smug', mouth: d.beat, lookX: 0, autoLook: false });
    // carroceria
    rrect(ctx, -74, -8, 148, 42, 8); inked(ctx, C('#ffd23f'), 2.4);
    ctx.fillStyle = C('#00a651'); ctx.fillRect(-73, 6, 146, 8);
    ctx.fillStyle = C('#1b3fa0'); ctx.fillRect(-73, 14, 146, 3);
    // cabine
    ctx.beginPath(); ctx.moveTo(-24, 33); ctx.lineTo(-20, 18); ctx.lineTo(20, 18); ctx.lineTo(24, 33); ctx.closePath(); inked(ctx, C('#1d3557'), 1.6);
    if (!fl) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(6, 20); ctx.lineTo(13, 20); ctx.lineTo(10, 31); ctx.lineTo(3, 31); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(-40, 27, 3.6, 0, TAU); ctx.arc(40, 27, 3.6, 0, TAU); ctx.fill();
      ctx.font = '10px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText('TRIO', -46, 1); ctx.strokeText('171', 46, 1);
      ctx.fillStyle = '#e63946'; ctx.fillText('TRIO', -46, 1); ctx.fillText('171', 46, 1);
    }
    ctx.restore();
    if (d.st === 'fight') mbBar(ctx, e.x, e.y - 112, 110, e.hp / e.maxHp, 'TRIO ELÉTRICO');
  }
  define('trio', {
    hp: 480, r: 42, score: 15000, pix: 40, big: true, keepOffscreen: true,
    init(e, o) {
      mbStart(e, o, 45, 172);
      const d = e.data;
      d.kids = [];
      for (const side of [-1, 1]) { const k = G.spawnEnemy('trio_caixa', e.x + side * 92, e.y - 4, { parent: e, side }); if (k) d.kids.push(k); }
      mbHitZone(e, -54, 14, 24); mbHitZone(e, 54, 14, 24); // carroceria larga
      d.beat = 0; d.ring = 0;
      G.banner('TRIO ELÉTRICO', 'DO CANDIDATO 171', { small: true, color: G.C.orange, dur: 2.2 });
      sfx('siren');
    },
    update(e, dt) {
      const d = e.data;
      d.beat = Math.max(0, d.beat - dt * 2.5);
      if (d.st === 'enter') { e.x = G.W / 2; mbEnter(e, dt, 3.0); if (d.st === 'fight') talk(e, TRIO_LINES[0], 1, 2, true); return; }
      if (d.st === 'leave') {
        d.stT += dt; e.y -= (40 + d.stT * 120) * dt;
        if (e.y < -160) { e.dead = true; e.escaped = true; for (const k of d.kids) k.dead = true; }
        return;
      }
      d.fightT += dt;
      e.x = G.W / 2 + Math.sin(d.fightT * 0.45) * 46;
      if (d.fightT > d.dur) { mbFlee(e, 'Acabou o comício!'); return; }
      if (!d.pat || d.patT <= 0) { mbNext(e, ['rings', 'santinhos', 'rings', '*notas'], TRIO_DUR); if (Math.random() < 0.6) talk(e, TRIO_LINES, 1, 1.8); }
      d.patT -= dt; d.pt -= dt;
      if (d.pt > 0) return;
      const cx = e.x, cy = e.y - 50;
      if (d.pat === 'rings') {
        const alive = d.kids.filter((k) => !k.dead);
        if (alive.length) {
          const k = alive[d.ring++ % alive.length];
          gappedRing(k.x, k.y - 8, 30, spd(78), k.data.side < 0 ? COL.magenta : COL.orange, 4, 0.5);
          k.data.beat = 1; d.pt = ivl(0.95);
        } else { gappedRing(cx, cy, 24, spd(80), COL.magenta, 4, 0.5); d.pt = ivl(1.15); }
        d.beat = 1; sfx('enemy_shot2');
      } else if (d.pat === 'santinhos') {
        const big = d.pn % 3 === 2;
        G.pat.aimedFan(cx, cy, big ? 7 : 5, big ? 0.95 : 0.6, spd(104), { style: 'santinho', color: COL.red });
        d.pn++; d.pt = 0.42; d.beat = 0.8; sfx('enemy_shot');
      } else if (d.pat === 'notas') {
        d.ang = (d.ang || 0) + 0.24;
        for (let i = 0; i < 3; i++) G.fire(cx, cy, d.ang + (i * TAU) / 3, spd(90), { style: 'en_nota', color: COL.pink });
        d.pt = 0.1; d.beat = 1;
        if (d.pn++ % 4 === 0) sfx('enemy_shot');
      }
    },
    draw(ctx, e, g) { drawTrio(ctx, e, g); },
    onDeath(e) {
      for (const k of e.data.kids) if (!k.dead) G.killEnemy(k);
      if (!bossDying()) mbDeath(e, 'O TRIO PAROU!');
    },
  });
  define('trio_caixa', {
    hp: 110, r: 21, score: 3000, pix: 8, keepOffscreen: true, noScale: true,
    init(e, o) { e.data.parent = o.parent; e.data.side = o.side || 1; e.data.beat = 0; },
    update(e, dt) {
      const d = e.data, P = d.parent;
      if (!P || P.dead) { if (!e.dead) { e.dead = true; e.escaped = true; } return; }
      e.x = P.x + d.side * 92; e.y = P.y - 4;
      d.beat = Math.max(0, d.beat - dt * 3);
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e), C = (c) => fcol(c, fl);
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.strokeStyle = C('#2b2f3a'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-d.side * 15, 10); ctx.quadraticCurveTo(-d.side * 22, 20, -d.side * 18, 30); ctx.stroke();
      rrect(ctx, -15, -33, 30, 66, 4); inked(ctx, C('#1d2029'), 2);
      const k = 1 + d.beat * 0.22;
      for (const cy of [-12, 14]) {
        ctx.beginPath(); ctx.arc(0, cy, 10.5, 0, TAU); inked(ctx, C('#2f3440'), 1.4);
        ctx.fillStyle = C('#4a5060'); ctx.beginPath(); ctx.arc(0, cy, 7 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = C('#9aa5b8'); ctx.beginPath(); ctx.arc(0, cy, 2.6, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = C('#3a3f4b'); ctx.fillRect(-7, -29, 14, 5);
      if (!fl) {
        const on = ((g.t * 5) | 0) % 2 === 0;
        ctx.fillStyle = on ? '#ff2a4a' : '#4cc9f0'; ctx.beginPath(); ctx.arc(0, -37, 3, 0, TAU); ctx.fill();
        if (d.beat > 0.1) { ctx.strokeStyle = 'rgba(255,255,255,' + (d.beat * 0.6).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 14, 12 + (1 - d.beat) * 12, 0, TAU); ctx.stroke(); }
      }
      ctx.restore();
      if (e.hp < e.maxHp) mbBar(ctx, e.x, e.y - 46, 30, e.hp / e.maxHp, null);
    },
    onDeath(e) {
      if (!bossDying() && e.data.parent && !e.data.parent.dead) {
        G.text(e.x, e.y - 30, 'SEM SOM!', { color: G.C.yellow, size: 13, life: 1.2 });
        talk(e.data.parent, ['Ei! Minha caixa de som!', 'Cadê o som, DJ?!'], 1, 1.6, true);
      }
    },
  });

  // ----------------------------------------------------------------------
  // LOBISTA-MOR (fase 2) — a MALA abre e cospe espirais de cédulas;
  // arremessa malinhas que estouram em anel se você não atirar nelas
  // ----------------------------------------------------------------------
  const LOBMOR = { skin: '#e0a882', hair: 'slick', hairColor: '#111111', body: 'suit', suit: '#141a28', shirt: '#f4f1e8', tie: '#ffd23f', glasses: 'dark', face: 'jowl', templeColor: '#9aa0a6', seed: 31 };
  const LOBMOR_LINES = ['Todo mundo tem seu preço!', 'Aceita uma malinha?', 'Pode contar, tá tudo aí!', 'É só um agrado, campeão!', 'Isso aqui é consultoria!'];
  const LOBMOR_DUR = { mala: 3.4, maletas: 2.8, propina: 2.8 };
  define('lobista_mor', {
    hp: 700, r: 40, score: 20000, pix: 50, big: true, keepOffscreen: true,
    init(e, o) {
      mbStart(e, o, 45, 165);
      const d = e.data;
      d.open = 0; d.dir = 1; d.ang = 0;
      if (!o.drop) e.drop = ['power', 'shield'];
      mbHitZone(e, 0, 58, 22); // a MALA também leva tiro
      G.banner('LOBISTA-MOR', 'O DONO DA MALA', { small: true, color: G.C.orange, dur: 2.2 });
      sfx('laugh');
    },
    update(e, dt) {
      const d = e.data;
      d.open = M.approach(d.open, d.pat === 'mala' && d.st === 'fight' ? 1 : 0, dt * 3);
      if (d.st === 'enter') { e.x = G.W / 2; mbEnter(e, dt, 3.0); if (d.st === 'fight') talk(e, 'Vamos conversar, meu jovem.', 1, 2, true); return; }
      if (d.st === 'leave') {
        d.stT += dt; e.y -= (30 + d.stT * 140) * dt;
        if (e.y < -140) { e.dead = true; e.escaped = true; }
        return;
      }
      d.fightT += dt;
      e.x = G.W / 2 + Math.sin(d.fightT * 0.5) * 58;
      e.y = d.homeY + Math.sin(d.fightT * 0.9) * 6;
      if (d.fightT > d.dur) { mbFlee(e, 'Meu jatinho chegou!'); return; }
      const late = e.hp / e.maxHp < 0.5;
      if (!d.pat || d.patT <= 0) { mbNext(e, ['mala', 'maletas', 'propina', 'maletas'], LOBMOR_DUR); d.dir = -d.dir; if (Math.random() < 0.6) talk(e, LOBMOR_LINES, 1, 1.8); }
      d.patT -= dt; d.pt -= dt;
      if (d.pt > 0) return;
      const mx = e.x, my = e.y + 50;
      if (d.pat === 'mala') {
        if (d.open < 0.8) return;
        const arms = late ? 6 : 4;
        for (let i = 0; i < arms; i++) G.fire(mx, my - 10, d.ang + (i * TAU) / arms, spd(90), { style: 'en_cedula', color: COL.nota50 });
        d.ang += 0.19 * d.dir; d.pt = 0.12;
        if (d.pn++ % 3 === 0) sfx('enemy_shot');
      } else if (d.pat === 'maletas') {
        const n = late ? 5 : 3;
        if (d.pn < n) {
          const p = player(), px = p ? p.x : G.W / 2;
          const tx = M.clamp(px + (d.pn - (n - 1) / 2) * 78, 28, G.W - 28), ty = M.rand(G.H * 0.36, G.H * 0.52);
          G.spawnEnemy('maleta', e.x + (d.pn % 2 ? 40 : -40), e.y + 20, { tx, ty });
          d.pn++; d.pt = 0.2; sfx('whoosh');
        } else d.pt = 99;
      } else if (d.pat === 'propina') {
        G.pat.aimedFan(mx, my - 6, 7, 0.95, spd(110), { style: 'en_cedula', color: COL.nota10 });
        d.pn++; d.pt = 0.5; sfx('enemy_shot2');
      }
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e);
      G.Art.person(ctx, e.x, e.y, 112, LOBMOR, { t: e.t, flash: fl, pose: 'hold', mood: d.open > 0.4 ? 'laugh' : d.pat === 'propina' ? 'smug' : 'normal', mouth: d.open * 0.6 });
      drawBriefcase(ctx, e.x, e.y + 54, 62, 36, d.open, e.t, fl, 'MALA');
      if (d.st === 'fight') mbBar(ctx, e.x, e.y - 72, 110, e.hp / e.maxHp, 'LOBISTA-MOR');
    },
    onDeath(e) { if (!bossDying()) mbDeath(e, 'A MALA É DO POVO!'); },
  });
  // malinha arremessada: atire nela (vira Pix) antes que estoure em anel
  define('maleta', {
    hp: 5, r: 10, score: 200, pix: 3, noScale: true,
    init(e, o) {
      const d = e.data;
      d.sx = e.x; d.sy = e.y; d.tx = o.tx != null ? o.tx : e.x; d.ty = o.ty != null ? o.ty : G.H * 0.45;
      d.ft = o.flight || 0.9; d.fuse = o.fuse || 1.4; d.spin = M.rand(7, 11) * (M.chance(0.5) ? 1 : -1); d.rot = 0;
    },
    update(e, dt) {
      const d = e.data;
      if (e.t < d.ft) {
        const k = e.t / d.ft;
        e.x = M.lerp(d.sx, d.tx, k); e.y = M.lerp(d.sy, d.ty, k) - Math.sin(k * PI) * 70;
        d.rot += d.spin * dt;
      } else {
        e.x = d.tx; e.y = d.ty;
        d.rot = M.lerp(d.rot, 0, 0.2);
        if (e.t >= d.ft + d.fuse) {
          const n = Math.round(11 + lvl());
          G.pat.ring(e.x, e.y, n, spd(82), { style: 'en_cedula', color: COL.nota10, delay: 0.22 }, Math.random() * TAU);
          G.burst(e.x, e.y, 10, { colors: ['#7ed957', '#ffffff', '#8b5a2b'], type: 'paper', speed: 140 });
          sfx('enemy_shot2');
          e.dead = true; e.escaped = true;
        }
      }
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e);
      const fuseK = e.t > d.ft ? (e.t - d.ft) / d.fuse : 0;
      if (fuseK > 0) {
        const blink = Math.sin(g.t * (14 + fuseK * 30)) > 0;
        warnRing(ctx, e.x, e.y, 16 - fuseK * 5, blink ? 1 : 0.3, COL.nota10);
      }
      ctx.translate(e.x, e.y); ctx.rotate(d.rot);
      const k = 1 + fuseK * 0.18;
      ctx.scale(k, k);
      drawBriefcase(ctx, 0, 1, 19, 13, 0, e.t, fl || (fuseK > 0.6 && ((g.t * 16) | 0) % 2 === 0), '$');
    },
    onDeath(e) { if (!bossDying() && Math.random() < 0.4) G.text(e.x, e.y - 14, 'PROPINA RECUSADA!', { color: G.C.pix, size: 10, life: 0.9 }); },
  });

  // ----------------------------------------------------------------------
  // SERVIDOR DO GABINETE (fase 3) — rack voador: solta bots, varre com lasers
  // (com aviso) e levanta muralhas de "fake news" com brecha
  // ----------------------------------------------------------------------
  const SERV_DUR = { bots: 4.4, laser: 4.8, muro: 5.4 };
  const SERV_LINES = ['Disparo em massa!', 'Isso é tudo verdade!', 'Compartilhe antes que apaguem!', 'Recebi de um amigo!'];
  function drawServer(ctx, e, g) {
    const d = e.data, fl = G.isFlash(e), C = (c) => fcol(c, fl), t = e.t;
    ctx.save(); ctx.translate(e.x, e.y);
    // propulsores
    for (const sx of [-1, 1]) {
      if (!fl) {
        const fh = 10 + Math.sin(t * 40 + sx) * 3;
        ctx.fillStyle = 'rgba(76,201,240,0.7)'; ctx.beginPath(); ctx.moveTo(sx * 18 - 5, 46); ctx.lineTo(sx * 18 + 5, 46); ctx.lineTo(sx * 18, 46 + fh + 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.moveTo(sx * 18 - 3, 46); ctx.lineTo(sx * 18 + 3, 46); ctx.lineTo(sx * 18, 46 + fh); ctx.closePath(); ctx.fill();
      }
      rrect(ctx, sx * 18 - 6, 38, 12, 9, 2); inked(ctx, C('#5b6375'), 1.4);
    }
    // antenas
    ctx.strokeStyle = C('#9aa5b8'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-20, -52); ctx.lineTo(-28, -80); ctx.moveTo(20, -52); ctx.lineTo(28, -80); ctx.stroke();
    if (!fl) {
      const on = ((t * 4) | 0) % 2;
      ctx.fillStyle = on ? '#ff2a4a' : '#ffd23f'; ctx.beginPath(); ctx.arc(-28, -81, 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = on ? '#ffd23f' : '#ff2a4a'; ctx.beginPath(); ctx.arc(28, -81, 3.5, 0, TAU); ctx.fill();
    }
    // gabinete (rack)
    rrect(ctx, -34, -54, 68, 96, 6); inked(ctx, C('#252a36'), 2.4);
    // emissores de laser nas laterais
    const lz = d.pat === 'laser' && d.st === 'fight';
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.arc(sx * 33, 10, 5, 0, TAU); inked(ctx, C(lz ? '#ff2a4a' : '#3a3f4b'), 1.4);
      if (lz && !fl) G.call(G.Art, 'glow', ctx, sx * 33, 10, 14, '#ff2a4a', 0.7);
    }
    // tela com carinha
    rrect(ctx, -26, -47, 52, 32, 4); inked(ctx, C('#0d1b2a'), 1.6);
    if (!fl) {
      const angry = d.pat === 'laser' || d.pat === 'muro';
      ctx.fillStyle = angry ? '#ff2a4a' : '#3ddc84';
      ctx.font = '8px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (((t * 1.5) | 0) % 3 === 2) ctx.fillText('FAKE', 0, -31);
      else {
        // olhos de pixel
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          if (angry) { ctx.moveTo(sx * 15, -38); ctx.lineTo(sx * 5, -34); ctx.lineTo(sx * 5, -29); ctx.lineTo(sx * 15, -29); }
          else ctx.rect(sx * 10 - 4, -38, 8, 8);
          ctx.fill();
        }
        ctx.fillRect(-8, -23, 16, 2.5);
      }
    }
    // gavetas com LEDs
    for (let i = 0; i < 4; i++) {
      const y = -11 + i * 12.5;
      ctx.fillStyle = C('#323846'); ctx.fillRect(-28, y, 56, 10);
      if (!fl) {
        for (let j = 0; j < 6; j++) {
          const h = Math.sin(i * 7.3 + j * 3.1 + Math.floor(t * 8 + i + j) * 1.7);
          ctx.fillStyle = h > 0.5 ? '#3ddc84' : h > -0.2 ? '#ffd23f' : '#ff2a4a';
          ctx.fillRect(-24 + j * 5, y + 3.5, 2.6, 2.6);
        }
        ctx.fillStyle = '#5b6375'; ctx.fillRect(8, y + 3, 16, 3.5);
      }
    }
    if (!fl) {
      ctx.fillStyle = '#ffd23f'; ctx.font = '6px ' + G.FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('GABINETE', 0, 38);
    }
    ctx.restore();
    if (d.st === 'fight') mbBar(ctx, e.x, e.y - 98, 110, e.hp / e.maxHp, 'SERVIDOR DO GABINETE');
  }
  define('servidor', {
    hp: 820, r: 44, score: 25000, pix: 55, big: true, keepOffscreen: true,
    init(e, o) {
      mbStart(e, o, 46, 168);
      e.data.gapI = 9;
      G.banner('SERVIDOR DO GABINETE', 'FÁBRICA DE FAKE NEWS', { small: true, color: G.C.orange, dur: 2.2 });
      sfx('charge');
    },
    update(e, dt, g) {
      const d = e.data;
      if (d.st === 'enter') { e.x = G.W / 2; mbEnter(e, dt, 3.0); return; }
      if (d.st === 'leave') {
        d.stT += dt; e.y -= (40 + d.stT * 150) * dt;
        if (e.y < -140) { e.dead = true; e.escaped = true; }
        return;
      }
      d.fightT += dt;
      e.x = G.W / 2 + Math.sin(d.fightT * 0.4) * 50;
      e.y = d.homeY + Math.sin(d.fightT * 1.3) * 5;
      if (d.fightT > d.dur) { mbFlee(e, 'Vou formatar tudo!'); return; }
      const late = e.hp / e.maxHp < 0.5;
      if (!d.pat || d.patT <= 0) { mbNext(e, ['bots', 'laser', 'muro'], SERV_DUR); if (Math.random() < 0.5) talk(e, SERV_LINES, 1, 1.8); }
      d.patT -= dt; d.pt -= dt;
      if (d.pat === 'laser' && late && d.patT < 3.4 && d.patT > 1.8) {
        d.nt = (d.nt || 0) - dt;
        if (d.nt <= 0) { d.nt = 0.42; if (okShot(e, 120)) G.pat.aimed(e.x, e.y + 40, spd(120), { style: 'needle', color: COL.magenta }); }
      }
      if (d.pt > 0) return;
      if (d.pat === 'bots') {
        const n = late ? 16 : 12;
        const bots = g.enemies.reduce((c, o) => c + (o.kind === 'bot' && !o.dead ? 1 : 0), 0);
        if (d.pn < n && bots < 22) {
          const sd = d.pn % 2 ? 1 : -1;
          G.spawnEnemy('bot', e.x + sd * 36, e.y + 12, { path: 'curve', ang: sd > 0 ? 0.15 : PI - 0.15, spd: 135, turn: sd * 1.3, turnStop: 1.9, dive: late ? 0.35 : 0.12 });
          d.pn++; d.pt = 0.19;
          if (d.pn % 4 === 1) sfx('spawn');
        } else d.pt = 0.3;
      } else if (d.pat === 'laser') {
        for (const sd of [-1, 1]) {
          const rate = 0.5;
          G.laser({ owner: e, ox: sd * 33, oy: 10, ang: DOWN - sd * 0.85, len: 1000, width: 12, warn: 1.0, life: 1.5, color: '#ff2a4a',
            update(l, ldt) { if (l.t >= l.warn) l.ang += sd * rate * ldt; } });
        }
        d.pt = 99;
      } else if (d.pat === 'muro') {
        if (d.pn === 0) G.text(G.W / 2, e.y + 70, 'FAKE NEWS!', { color: COL.red, size: 18, life: 1.2, vy: 30 });
        const rows = late ? 9 : 7;
        if (d.pn < rows) {
          const slots = 20, step = (G.W - 20) / (slots - 1);
          d.gapI = M.clamp(d.gapI + M.randi(-2, 2), 2, slots - 3);
          if (d.pn === 0) { const p = player(); d.gapI = M.clamp(Math.round(((p ? p.x : G.W / 2) - 10) / step) + M.randi(-3, 3), 2, slots - 3); }
          for (let i = 0; i < slots; i++) {
            if (Math.abs(i - d.gapI) <= 1) continue;
            G.fire(10 + i * step, e.y + 50, DOWN, spd(100), { style: 'needle', color: COL.red });
          }
          d.pn++; d.pt = late ? 0.5 : 0.6;
          sfx('enemy_shot');
        } else d.pt = 99;
      }
    },
    draw(ctx, e, g) { drawServer(ctx, e, g); },
    onDeath(e) { if (!bossDying()) mbDeath(e, 'SERVIDOR DERRUBADO!'); },
  });

  // ----------------------------------------------------------------------
  // COMITIVA DOS 38 MINISTROS (fase 4) — conga de ministros atrás do chefe.
  // Cada ministro é um inimigo. Acertou o chefe? A fila revida em "ola".
  // Derrubou o chefe? Todo mundo é demitido em cadeia.
  // ----------------------------------------------------------------------
  const COMI_N = 37, COMI_SP = 15, COMI_V = 100, HIST = 460;
  const COMI_CHEF = { skin: '#e8b48a', hair: 'gray', hairColor: '#d6d6d6', body: 'suit', suit: '#141a28', shirt: '#f4f1e8', tie: '#e63946', sash: ['#ffd23f', '#e63946'], hat: 'tophat', hatColor: '#141a28', face: 'jowl', seed: 32 };
  const COMI_LINES = ['Reunião ministerial!', 'Todo mundo atrás de mim!', 'Mais um ministério? Cria!', 'Viagem oficial, gente!'];
  function comiPath(tau, out) {
    out.x = G.W / 2 + Math.sin(tau * 0.9) * (G.W / 2 - 46);
    out.y = G.H * 0.3 + Math.sin(tau * 1.8 + 0.6) * G.H * 0.13;
    return out;
  }
  const CP = { x: 0, y: 0 }, CP2 = { x: 0, y: 0 };
  function histAt(d, k, out) {
    k = Math.min(k, HIST - 1);
    let i = d.hi - k; if (i < 0) i += HIST;
    out.x = d.hx[i]; out.y = d.hy[i];
    return out;
  }
  define('comitiva', {
    hp: 260, r: 19, score: 20000, pix: 40, big: true, keepOffscreen: true,
    init(e, o) {
      const d = e.data;
      d.st = 'enter'; d.fightT = 0; d.dur = o.dur || 48; d.tau = 0; d.ripCd = 0;
      d.hx = new Float32Array(HIST); d.hy = new Float32Array(HIST); d.hi = 0;
      for (let i = 0; i < HIST; i++) { d.hx[i] = e.x; d.hy[i] = e.y; }
      d.ft = 1.5; d.rt = 4.5; d.facing = 1; d.photoT = 6; d.pause = 0;
      if (!e.drop) e.drop = ['power', 'bomb'];
      // os ministros nascem antes do chefe (ficam desenhados por baixo dele), do último para o primeiro
      d.segs = [];
      for (let i = COMI_N; i >= 1; i--) {
        const s = G.spawnEnemy('comitiva_seg', e.x, e.y, { leader: e, idx: i });
        if (s) d.segs.push(s);
      }
      d.total = e.hp + d.segs.reduce((a, s) => a + s.maxHp, 0);
      comiPath(0, CP); d.ex = CP.x; d.ey = CP.y;
      G.banner('COMITIVA DOS 38 MINISTROS', 'VIAGEM OFICIAL', { small: true, color: G.C.orange, dur: 2.4 });
      sfx('laugh');
    },
    update(e, dt, g) {
      const d = e.data;
      // sem a fila (menos de 6 ministros), o chefe entra em pânico: anda devagar e posa mais (recompensa por limpar a conga)
      let alive = 0; for (const sg of d.segs) if (!sg.dead) alive++;
      const lonely = alive < 6;
      if (lonely && d.st === 'fight' && !d.saidLonely) { d.saidLonely = true; talk(e, 'Cadê meus ministros?!', 1, 1.8, true); }
      const v = lonely && d.st === 'fight' ? COMI_V * 0.65 : COMI_V;
      const px = e.x;
      if (d.st === 'enter') { // vai em linha reta até o começo do percurso
        const a = Math.atan2(d.ey - e.y, d.ex - e.x), dist = Math.hypot(d.ex - e.x, d.ey - e.y);
        if (dist <= v * dt) { e.x = d.ex; e.y = d.ey; d.st = 'fight'; talk(e, 'Reunião ministerial!', 1, 2, true); }
        else { e.x += Math.cos(a) * v * dt; e.y += Math.sin(a) * v * dt; }
      } else if (d.st === 'fight') {
        d.fightT += dt;
        // "FOTO OFICIAL!": a fila para e o chefe fica parado posando (hora de mirar nele)
        d.photoT -= dt;
        if (d.photoT <= 0 && d.pause <= 0 && e.y > 70) {
          d.pause = 2.0; d.photoT = lonely ? 4.5 : 7.5;
          talk(e, 'FOTO OFICIAL! Sorriam!', 1, 1.5, true);
          G.part({ x: e.x, y: e.y, type: 'flash', size: 40, life: 0.18, color: '#ffffff' });
          if (okShot(e, 90)) G.pat.ring(e.x, e.y, 18, spd(80), { style: 'star', color: COL.magenta }, Math.random() * TAU);
          sfx('stamp');
        }
        if (d.pause > 0) { d.pause -= dt; d.hold = true; }
        else {
          d.hold = false;
          // avança no percurso com velocidade constante
          comiPath(d.tau, CP); comiPath(d.tau + 0.01, CP2);
          const ds = Math.hypot(CP2.x - CP.x, CP2.y - CP.y) / 0.01 || 1;
          d.tau += (v * dt) / ds;
          comiPath(d.tau, CP); e.x = CP.x; e.y = CP.y;
        }
        if (d.fightT > d.dur) { d.st = 'leave'; talk(e, 'Acabou a viagem oficial!', 1, 2, true); }
        // ataques do chefe
        d.ft -= dt; d.rt -= dt;
        if (d.ft <= 0) { d.ft = ivl(1.4); if (okShot(e)) { G.pat.aimedFan(e.x, e.y, 3, 0.36, spd(122), { style: 'rice', color: COL.pink }); sfx('enemy_shot2'); } }
        if (d.rt <= 0) { d.rt = ivl(4.6); if (okShot(e, 90)) { G.pat.ring(e.x, e.y, 14, spd(88), { style: 'orb', color: COL.orange }, Math.random() * TAU); sfx('enemy_shot2'); } }
        if (Math.random() < dt * 0.2) talk(e, COMI_LINES, 0.6);
      } else { // 'leave': sai por cima e espera a fila toda sair
        e.y -= v * dt;
        if (e.y < -60 && !alive) { e.dead = true; e.escaped = true; }
      }
      if (Math.abs(e.x - px) > 0.05) d.facing = e.x < px ? -1 : 1;
      // grava o rastro (os ministros seguem o rastro); parado = a fila também para
      if (d.st !== 'fight') d.hold = false;
      if (!d.hold) { d.hi = (d.hi + 1) % HIST; d.hx[d.hi] = e.x; d.hy[d.hi] = e.y; }
    },
    onHit(e, dmg, g) {
      const d = e.data;
      if (g.t < d.ripCd || d.st !== 'fight') return;
      d.ripCd = g.t + ivl(1.7);
      let k = 0;
      for (const s of d.segs) if (!s.dead && s.data.idx % 3 === 0) { s.data.fireAt = g.t + 0.12 + s.data.idx * 0.025; k++; }
      if (k && Math.random() < 0.3) talk(e, ['Revida, pessoal!', 'Defendam o chefe!'], 1, 1.4);
    },
    draw(ctx, e, g) {
      const d = e.data;
      person(ctx, e, 46, COMI_CHEF, { pose: d.hold ? 'up' : 'wave', facing: d.facing, mood: d.st === 'leave' || d.hold ? 'laugh' : 'smug' });
      if (d.st === 'fight') {
        let hp = Math.max(0, e.hp), n = 1;
        for (const s of d.segs) if (!s.dead) { hp += Math.max(0, s.hp); n++; }
        mbBar(ctx, e.x, e.y - 46, 96, hp / d.total, n + (n === 1 ? ' MINISTRO' : ' MINISTROS'));
      }
    },
    onDeath(e, g) {
      const d = e.data;
      if (bossDying()) return;
      // demissão em cadeia, do primeiro ao último da fila
      const alive = d.segs.filter((s) => !s.dead).sort((a, b) => a.data.idx - b.data.idx);
      alive.forEach((s, i) => { s.data.dieAt = g.t + 0.25 + i * 0.07; });
      mbDeath(e, 'COMITIVA DEMITIDA!');
    },
  });
  define('comitiva_seg', {
    hp: 15, r: 11, score: 300, pix: 1, keepOffscreen: true, noScale: true,
    init(e, o) {
      const d = e.data;
      d.leader = o.leader; d.idx = o.idx || 1; d.v = d.idx % MIN.length; d.facing = 1; d.fireAt = 0; d.dieAt = 0;
    },
    update(e, dt, g) {
      const d = e.data, L = d.leader;
      if (d.dieAt && g.t >= d.dieAt) { G.killEnemy(e); if (Math.random() < 0.3) G.text(e.x, e.y - 14, 'DEMITIDO!', { color: G.C.yellow, size: 10, life: 0.8 }); return; }
      if (!L) { e.dead = true; return; }
      const px = e.x;
      if (!d.dieAt) {
        histAt(L.data, Math.round((d.idx * COMI_SP) / (COMI_V * G.DT)), CP);
        e.x = CP.x; e.y = CP.y;
        if (Math.abs(e.x - px) > 0.05) d.facing = e.x < px ? -1 : 1;
      }
      if (L.dead && !d.dieAt && L.escaped) { e.dead = true; e.escaped = true; return; }
      if (L.data.st === 'leave' && e.y < -30) { e.dead = true; e.escaped = true; return; }
      if (d.fireAt && g.t >= d.fireAt) {
        d.fireAt = 0;
        if (okShot(e, 100)) { G.pat.aimed(e.x, e.y, spd(110), { style: 'small', color: COL.pink }); if (d.idx % 9 === 0) sfx('enemy_shot'); }
      }
      if (loop2() && L.data.st === 'fight' && Math.random() < dt * 0.06 && okShot(e, 120)) G.pat.aimed(e.x, e.y, spd(100), { style: 'small', color: COL.pink });
    },
    draw(ctx, e) {
      const d = e.data;
      const L = d.leader, posing = L && L.data.hold;
      person(ctx, e, 28, MIN[d.v], { pose: posing ? 'up' : 'hold', facing: d.facing, mood: d.dieAt ? 'hurt' : posing ? 'laugh' : 'normal' });
    },
  });
})();
