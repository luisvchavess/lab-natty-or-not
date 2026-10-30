/* ============================================================
   FUSCA A JATO — bosses.js
   Chefões 1–3: O CENTRÃO, DILMÃE e CAPITÃO BOLSONÁRIO
   (+ retratos dos diálogos, estilos de tiro 'bs_' e
   sub-inimigos 'bs_' que eles soltam). Contrato: docs/ENGINE.md §5.
   Cada fase de chefão é um gerador ("corrotina") que faz yield de
   segundos, de uma condição ou de null (próximo quadro).
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Bosses) return;
  const M = G.m, TAU = Math.PI * 2, PI = Math.PI, DOWN = Math.PI / 2;
  const INK = '#101418', WHITE = '#ffffff';
  const sfx = (n) => G.call(G.Audio, 'sfx', n);
  const L2 = () => !!(G.game && G.game.loop > 1);
  const clamp = M.clamp;
  // qualidade (ENGINE §10): partículas puramente decorativas contínuas (fumacinha, respingos)
  // 'high' todas, 'mid' metade, 'low' nenhuma. Multiplica a taxa de emissão.
  const decoK = () => (G.quality === 'low' ? 0 : G.quality === 'mid' ? 0.5 : 1);

  // Cores de tiro (saturadas, legíveis contra cenário e tiros do Zé)
  const COL = {
    pink: '#ff3d7f', red: '#ff2a4a', orange: '#ff8c1a', magenta: '#ff3dd8', gold: '#ffb02e',
    violet: '#c86bff', cream: '#fff1d6', hot: '#ff4fa3', ember: '#ff6a00',
  };

  // ======================================================================
  // Utilidades gerais
  // ======================================================================
  // posição do jogador (ou um ponto padrão)
  function pl() {
    const p = G.game && G.game.player;
    return p ? p : { x: G.W / 2, y: G.H * 0.8, alive: false };
  }
  // Só atira com o jogador vivo e o chefão lutando (justo: nada de tiro na hora de renascer)
  function canShoot() {
    const g = G.game; if (!g) return false;
    const p = g.player;
    return !!(p && p.alive) && !!(g.boss && g.boss.state === 'fight');
  }
  function shoot(x, y, ang, spd, o) {
    if (!canShoot()) return null;
    if (G.game.eb.length > 430) return null; // teto de desempenho
    const k = G.game.boss.def.spdK; // chefões mais adiantados atiram um pouco mais rápido
    return G.fire(x, y, ang, k ? spd * k : spd, o);
  }
  function ring(x, y, n, spd, o, off) { for (let i = 0; i < n; i++) shoot(x, y, (off || 0) + (i * TAU) / n, spd, o); }
  function fan(x, y, ang, n, spread, spd, o) {
    if (n <= 1) { shoot(x, y, ang, spd, o); return; }
    for (let i = 0; i < n; i++) shoot(x, y, ang - spread / 2 + (spread * i) / (n - 1), spd, o);
  }
  const aimFrom = (x, y) => G.aim(x, y);
  // Dica de tutorial (só no 1º mandato, uma vez por partida)
  function hint(key, x, y, str, color) {
    const run = G.run; if (!run || run.loop > 1) return;
    const h = run._bsHints || (run._bsHints = {});
    if (h[key]) return;
    h[key] = 1;
    G.text(x, y, str, { color: color || G.C.yellow, size: 13, life: 2.4, vy: -12 });
  }
  function say(b, s, dur) { G.say(b, s, dur || 2); }
  // Cansaço (anti-empate): luta normal termina antes; se passar de ~95 s (def.fatStart) o político
  // cansa e passa a levar mais dano (até 2× 60 s depois). d.dmgBase = armadura própria da fase.
  const FAT_START = 95, FAT_FULL = 60;
  function fatigue(b, line) {
    const d = b.data, f = clamp((b.ft - (b.def.fatStart || FAT_START)) / FAT_FULL, 0, 1);
    if (f > 0 && !d.fatSaid) { d.fatSaid = 1; say(b, line || 'CANSEI...', 2); G.text(b.x, b.y + 60, 'CANSOU!', { color: G.C.yellow, size: 14, life: 1.4 }); }
    d.fat = f;
    b.dmgMul = (d.dmgBase != null ? d.dmgBase : 1) * (1 + f);
  }
  // balão de fala sempre abaixo da barra de vida do chefão (HUD vai até y≈68)
  function bubbleAt(b, want) { b.bubbleY = Math.min(want, b.y - 104); }

  // ---------- aquecimento (evita a travadinha no 1º quadro de cada desenho novo) ----------
  // Personagens: G.Art.prewarm pinta os sprites em segundo plano (fatias entre os quadros), uma vez por chave.
  // list = [{ spec, size, mood, pose }] com os MESMOS objetos de spec e tamanhos passados a G.Art.person.
  function warmPeople(b, key, list) {
    const d = b.data, w = d.warmed || (d.warmed = {});
    if (w[key] || !G.Art || !G.Art.prewarm) return;
    w[key] = 1;
    G.call(G.Art, 'prewarm', list);
  }
  function poses(spec, size, list, mood) { return list.map((pose) => ({ spec, size, mood: mood || 'normal', pose })); }
  // Tiros: um sprite de (estilo, cor) por passo durante a entrada do chefão (updateEnter); start() termina a fila.
  function warmShots(b, pairs) { b.data.warmQ = pairs.slice(); }
  function warmShotsStep(b, n) {
    const q = b.data.warmQ; if (!q || !q.length) return;
    for (let i = 0; i < n && q.length; i++) { const p = q.shift(); G.call(BS, 'sprite', p[0], p[1]); }
  }

  // ---------- corrotinas ----------
  // slot 0 = sequência principal da fase; slot 1 = pressão de fundo (roda em paralelo)
  function co(b, gen, slot) { const d = b.data; (d.cos || (d.cos = []))[slot || 0] = gen ? { gen, wait: 0, until: null } : null; }
  function stopCo(b) { b.data.cos = []; }
  function runCo(b, dt) {
    const L = b.data.cos; if (!L) return;
    for (let i = 0; i < L.length; i++) if (L[i]) stepCo(b, L, i, dt);
  }
  function stepCo(b, L, i, dt) {
    const c = L[i];
    if (c.wait > 0) { c.wait -= dt; if (c.wait > 0) return; }
    if (c.until) { if (!c.until()) return; c.until = null; }
    for (let guard = 0; guard < 40; guard++) {
      let r;
      try { r = c.gen.next(); } catch (err) { G.reportError(err, 'boss:' + b.id + ' corrotina'); L[i] = null; return; }
      if (L[i] !== c) return; // trocada no meio (mudança de fase)
      if (r.done) { L[i] = null; return; }
      const v = r.value;
      if (typeof v === 'number') { c.wait += v; if (c.wait > 0) return; }
      else if (typeof v === 'function') { if (!v()) { c.until = v; return; } }
      else return; // null: próximo quadro
    }
  }
  // espera s segundos chamando fn(u 0..1) a cada quadro
  function* tween(b, s, fn) {
    const t0 = b.ft;
    for (;;) {
      const u = Math.min(1, (b.ft - t0) / s);
      fn(u);
      if (u >= 1) return;
      yield null;
    }
  }
  // movimento suave até (d.tx, d.ty)
  function glide(b, dt, k) {
    const d = b.data, f = 1 - Math.exp(-(k || 3) * dt);
    b.x += (d.tx - b.x) * f; b.y += (d.ty - b.y) * f;
  }

  // ---------- avisos visuais (telegrafia) ----------
  // fx: {kind, life, layer:'under'|'top', ...}; coordenadas de tela
  function fx(b, o) { o.t = 0; b.data.fx.push(o); return o; }
  function updFx(b, dt) {
    const L = b.data.fx;
    for (let i = L.length - 1; i >= 0; i--) { const f = L[i]; f.t += dt; if (f.upd) f.upd(f, dt); if (f.t >= f.life) L.splice(i, 1); }
  }
  function drawFx(c, b, layer) {
    const L = b.data.fx; if (!L || !L.length) return;
    for (const f of L) {
      if ((f.layer || 'top') !== layer) continue;
      const k = f.t / f.life;
      c.save();
      if (f.kind === 'aim') {
        // linha de mira tracejada piscando
        const a = 0.35 + 0.45 * Math.abs(Math.sin(f.t * 22));
        c.globalAlpha = a; c.strokeStyle = f.color || COL.red; c.lineWidth = 1.6;
        c.setLineDash([7, 6]); c.lineDashOffset = -f.t * 70;
        c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x + Math.cos(f.ang) * (f.len || 500), f.y + Math.sin(f.ang) * (f.len || 500)); c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 1; c.fillStyle = f.color || COL.red;
        c.beginPath(); c.arc(f.x, f.y, 3 + 3 * k, 0, TAU); c.fill();
      } else if (f.kind === 'circle') {
        // alvo no chão encolhendo
        c.globalAlpha = 0.25 + 0.5 * k; c.strokeStyle = f.color || COL.red; c.lineWidth = 2;
        c.beginPath(); c.arc(f.x, f.y, f.r * (1.6 - 0.6 * k), 0, TAU); c.stroke();
      } else if (f.kind === 'row') {
        // faixa horizontal de aviso com setas (pedalada / jet ski)
        const a = 0.25 + 0.35 * Math.abs(Math.sin(f.t * 14));
        c.globalAlpha = a; c.fillStyle = f.color || COL.red;
        c.fillRect(0, f.y - (f.h || 22) / 2, G.W, f.h || 22);
        c.globalAlpha = Math.min(1, a + 0.35);
        c.fillStyle = '#ffffff';
        const dir = f.dir || 1, off = ((f.t * 90) % 40) * dir;
        for (let x = -40; x < G.W + 40; x += 40) {
          const xx = x + off;
          c.beginPath(); c.moveTo(xx - 6 * dir, f.y - 6); c.lineTo(xx + 4 * dir, f.y); c.lineTo(xx - 6 * dir, f.y + 6); c.lineTo(xx - 2 * dir, f.y); c.closePath(); c.fill();
        }
        if (f.label) { c.globalAlpha = 1; txt(c, f.label, dir > 0 ? G.W - 74 : 74, f.y + (f.h || 22) / 2 + 10, 12, '#ffffff', { stroke: 3.5 }); }
      }
      c.restore();
    }
  }

  // ---------- desenho ----------
  function E(c, x, y, rx, ry, rot) { rot = rot || 0; c.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
  function O(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function inked(c, fill, lw) { c.fillStyle = fill; c.fill(); c.lineWidth = lw || 2; c.strokeStyle = INK; c.stroke(); }
  function outl(c, fill, lw) { c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); c.fillStyle = fill; c.fill(); } // contorno por fora
  function txt(c, s, x, y, size, color, o) {
    o = o || {};
    c.font = (o.weight ? o.weight + ' ' : '') + size + 'px ' + (o.font || G.FONT_DISPLAY);
    c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.stroke) {
      c.lineWidth = o.stroke; c.strokeStyle = o.strokeColor || INK; c.lineJoin = 'round';
      if (o.maxW) c.strokeText(s, x, y, o.maxW); else c.strokeText(s, x, y);
    }
    c.fillStyle = color;
    if (o.maxW) c.fillText(s, x, y, o.maxW); else c.fillText(s, x, y);
  }
  // texto que acompanha uma faixa curva (y = baseY + sag*(1-(x/halfW)^2))
  const CT_CACHE = {}; // larguras das letras por texto/tamanho (measureText é caro)
  function curvedText(c, s, baseY, sag, halfW, size, color) {
    c.font = size + 'px ' + G.FONT_DISPLAY;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const key = s + '|' + size + '|' + (document.fonts ? document.fonts.status : ''); // refaz quando a fonte terminar de carregar
    let ws = CT_CACHE[key];
    if (!ws) { ws = CT_CACHE[key] = []; let tot = 0; for (let i = 0; i < s.length; i++) { const cw = c.measureText(s[i]).width; ws.push(cw); tot += cw; } ws.total = tot; }
    const w = ws.total, maxW = halfW * 1.8, k = w > maxW ? maxW / w : 1;
    let x = -w * k / 2;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i], cw = ws[i] * k, cx = x + cw / 2;
      const y = baseY + sag * (1 - (cx / halfW) * (cx / halfW));
      const ang = Math.atan((-2 * sag * cx) / (halfW * halfW));
      c.save(); c.translate(cx, y); c.rotate(ang); c.scale(k, 1);
      c.fillStyle = color; c.fillText(ch, 0, 0);
      c.restore();
      x += cw;
    }
  }
  // gota de suor animada
  function sweatDrop(c, x, y, t, ph) {
    const cyc = (t * 0.9 + ph) % 1;
    const yy = y + cyc * 10, a = cyc < 0.8 ? 1 : 1 - (cyc - 0.8) / 0.2;
    c.save(); c.globalAlpha *= a;
    c.beginPath(); c.moveTo(x, yy - 5); c.quadraticCurveTo(x + 3.8, yy + 0.5, x, yy + 3); c.quadraticCurveTo(x - 3.8, yy + 0.5, x, yy - 5); c.closePath();
    inked(c, '#bdf0ff', 1.2);
    c.restore();
  }
  // rasgo no terno (zigue-zague com o branco da camisa)
  function rip(c, x, y, w, h, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    c.beginPath(); c.moveTo(-w / 2, 0);
    const n = 5;
    for (let i = 1; i <= n; i++) c.lineTo(-w / 2 + (w * i) / n, (i % 2 ? -h : -h * 0.35));
    for (let i = n - 1; i >= 0; i--) c.lineTo(-w / 2 + (w * i) / n + w / (2 * n), (i % 2 ? h : h * 0.4));
    c.closePath();
    inked(c, '#f4f1e8', 1.3);
    c.restore();
  }
  // estrelinhas de tontura
  function dizzy(c, x, y, t, r) {
    c.save();
    for (let i = 0; i < 4; i++) {
      const a = t * 4 + (i * TAU) / 4, sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.35;
      c.beginPath();
      for (let j = 0; j < 10; j++) { const aa = -PI / 2 + (j * PI) / 5, rr = j % 2 ? 2.2 : 5; c.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); }
      c.closePath(); inked(c, '#ffd23f', 1.2);
    }
    c.restore();
  }
  // olhar para o jogador (para G.Art.person dentro de transformações locais)
  function lookAt(wx, wy) {
    const p = pl();
    return [clamp((p.x - wx) / 120, -1, 1), clamp((p.y - wy) / 220, -1, 1) * 0.7];
  }
  const hand = (size, pose, t, seed, right, facing) => {
    const A = G.Art.personAnchors;
    if (A) { const a = A(size, { pose, t, seed, facing }); return right ? a.handR : a.handL; }
    const s = size / 100; return { x: (right ? 24 : -24) * s * (facing || 1), y: 33 * s };
  };

  // ======================================================================
  // Estilos de tiro (prefixo bs_) — pintados uma vez por cor (podem usar shadowBlur)
  // ======================================================================
  const BS = G.BulletStyles;
  function glowOn(x, c, b) { x.shadowColor = c; x.shadowBlur = b; }
  // ficha "171" (o número de todo político do jogo)
  BS.define('bs_171', { r: 4.6, size: 17, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.46, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, s * 0.33, 0, TAU); x.fill();
    x.fillStyle = c; x.font = '900 ' + (s * 0.36) + 'px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('171', 0, s * 0.03, s * 0.6);
  } });
  // moeda do toma-lá-dá-cá (brilho rosa + aro vermelho: é tiro, não é item — o dinheiro do jogo é verde-água)
  BS.define('bs_moeda', { r: 5, size: 16, spin: 7, paint(x, s, c) {
    glowOn(x, '#ff3d7f', 7); x.fillStyle = c; x.beginPath(); x.ellipse(0, 0, s * 0.46, s * 0.46, 0, 0, TAU); x.fill();
    x.shadowBlur = 0;
    x.strokeStyle = '#ff2a4a'; x.lineWidth = s * 0.12; x.beginPath(); x.arc(0, 0, s * 0.47, 0, TAU); x.stroke();
    x.strokeStyle = '#ffffff'; x.lineWidth = s * 0.08; x.beginPath(); x.arc(0, 0, s * 0.32, 0, TAU); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '900 ' + (s * 0.44) + 'px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('$', 0, s * 0.03);
  } });
  // cédula da emenda / pedalada (gira na direção do tiro)
  BS.define('bs_cedula', { r: 4.5, size: 21, rotate: true, paint(x, s, c) {
    const w = s * 0.9, h = s * 0.48;
    glowOn(x, c, 5); x.fillStyle = c; x.fillRect(-w / 2, -h / 2, w, h);
    x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.lineWidth = 1.3; x.strokeRect(-w / 2 + 1.3, -h / 2 + 1.3, w - 2.6, h - 2.6);
    x.fillStyle = '#ffffff'; x.font = '900 ' + (s * 0.3) + 'px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('R$', 0, s * 0.02);
  } });

  // ======================================================================
  // 1) O CENTRÃO — bolha de ternos fundidos com cabecinhas
  // ======================================================================
  const SIDE = [
    { main: '#e63946', dark: '#9e1b28', acc: '#ffffff', name: 'vermelho' },
    { main: '#00a651', dark: '#00703a', acc: '#ffd23f', name: 'verde-amarelo' },
  ];
  // calombos do corpo: x, y, rx, ry, cor do terno (ordem = de trás pra frente)
  const CEN_LUMPS = [
    [-26, 37, 31, 22, '#5d6575'], [26, 37, 31, 22, '#626a7a'], [0, 45, 30, 17, '#575f6f'],
    [-45, 12, 33, 31, '#6b7384'], [45, 12, 33, 31, '#666e7f'], [0, -4, 50, 44, '#737b8c'],
  ];
  const CEN_SLOTS = [];
  for (let i = 0; i < 8; i++) { const a = PI * (1.06 + (0.88 * i) / 7); CEN_SLOTS.push([Math.cos(a) * 60, Math.sin(a) * 50 - 8]); }
  // cabecinhas: arquétipos genéricos de deputado
  const CEN_HEADS = [
    { skin: '#e8b48a', hair: 'slick', hairColor: '#3a3a3a', face: 'jowl', body: 'none', seed: 31 },
    { skin: '#f0c49c', hair: 'combover', hairColor: '#7a6a5a', face: 'jowl', glasses: 'square', body: 'none', seed: 32 },
    { skin: '#c68a5e', hair: 'gray', hairColor: '#c9c9c9', face: 'round', mustache: true, body: 'none', seed: 33 },
    { skin: '#d9a273', hair: 'bald', hairColor: '#555555', face: 'round', grin: true, body: 'none', seed: 34 },
    { skin: '#f2c9a5', hair: 'pompadour', hairColor: '#2a2a2a', face: 'long', body: 'none', seed: 35 },
    { skin: '#b97a50', hair: 'short', hairColor: '#1a1a1a', face: 'square', mustache: true, body: 'none', seed: 36 },
    { skin: '#eab38c', hair: 'side', hairColor: '#5a3a22', face: 'oval', glasses: 'round', body: 'none', seed: 37 },
    { skin: '#e0a77e', hair: 'bald', hairColor: '#777777', face: 'jowl', beard: 'goatee', beardColor: '#777777', body: 'none', seed: 38 },
  ];
  const CEN_HEADS_SW = CEN_HEADS.map((s) => Object.assign({}, s, { sweat: true }));
  const CEN_SKIN = '#e9b48c';
  function cenSlot(i, pop) { const k = 0.66 + 0.4 * pop; return [CEN_SLOTS[i][0] * k, CEN_SLOTS[i][1] * k - 4 * pop]; }
  // posição da cabeça i (em coordenadas de tela) — usada para atirar
  function cenHeadPos(b, i, gx) {
    const d = b.data, ghost = gx != null, cx = ghost ? gx : b.x, cy = ghost ? d.ghost.y : b.y;
    if (d.orbit) { const a = d.orbit.ang + (i * TAU) / 8; return [cx + Math.cos(a) * d.orbit.R, cy + Math.sin(a) * d.orbit.R]; }
    const p = cenSlot(i, d.pops[i]);
    return [cx + p[0] * (ghost ? -1 : 1), cy + p[1]]; // o reflexo é espelhado
  }

  // cabecinha com gola (dentro do sistema local do Centrão)
  function cenHead(c, x, y, i, S, fl) {
    const sd = SIDE[S.side | 0], C = (col) => (fl ? WHITE : col);
    // gola (no reflexo translúcido ela some atrás do corpo: não desenha)
    if (!S.ghost) {
      c.beginPath(); c.moveTo(x - 10, y + 17); c.lineTo(x - 7.5, y + 7); c.lineTo(x + 7.5, y + 7); c.lineTo(x + 10, y + 17); c.closePath();
      inked(c, C('#6b7384'), 1.6);
    }
    if (!fl && !S.ghost) {
      c.beginPath(); c.moveTo(x - 4, y + 7); c.lineTo(x, y + 13); c.lineTo(x + 4, y + 7); c.closePath(); c.fillStyle = '#f2f2f2'; c.fill();
      c.beginPath(); c.moveTo(x - 1.4, y + 8); c.lineTo(x + 1.4, y + 8); c.lineTo(x + 2, y + 15); c.lineTo(x - 2, y + 15); c.closePath(); c.fillStyle = sd.main; c.fill();
    }
    const spec = (S.hp < 0.66 ? CEN_HEADS_SW : CEN_HEADS)[i];
    const mood = S.hmood ? S.hmood[i] : 'smug';
    const lk = S.look ? S.look : null;
    G.Art.person(c, x, y + 4.8, 34, spec, { t: (S.t || 0) + i * 0.77, mood, mouth: mood === 'laugh' || mood === 'angry' ? 0.6 : 0, flash: fl, bust: true, lookX: lk ? lk[0] : 0, lookY: lk ? lk[1] : 0.2, autoLook: false });
    if (S.warn && S.warn[i] > 0 && !fl) txt(c, '!', x + 9, y - 13, 12, G.C.yellow, { stroke: 3 });
  }
  function cenTorso(c, L, i, sd, hp) {
    if (i >= 3) {
      // calombos laterais: gola, camisa e gravata (de quem estiver ganhando)
      const rot = i === 3 ? -0.3 : 0.3;
      c.save(); c.translate(L[0] + (i === 3 ? -4 : 4), L[1] - L[3] * 0.5); c.rotate(rot);
      c.beginPath(); c.moveTo(-9, -6); c.lineTo(0, 14); c.lineTo(9, -6); c.closePath(); c.fillStyle = '#f2f2f2'; c.fill();
      c.beginPath(); c.moveTo(-9, -6); c.lineTo(-14, -2); c.lineTo(-1, 16); c.lineTo(0, 14); c.closePath();
      c.moveTo(9, -6); c.lineTo(14, -2); c.lineTo(1, 16); c.lineTo(0, 14); c.closePath();
      c.fillStyle = 'rgba(16,20,24,0.25)'; c.fill();
      const loose = hp < 0.45 ? 0.5 : 0;
      c.save(); c.rotate(loose * (i === 3 ? 1 : -1));
      c.beginPath(); c.moveTo(-2.4, -5); c.lineTo(2.4, -5); c.lineTo(3.4, 9); c.lineTo(0, 13.5); c.lineTo(-3.4, 9); c.closePath();
      inked(c, sd.main, 1.1);
      c.restore();
      // broche (bandeirinha)
      c.beginPath(); c.rect(-13, 3, 5, 3.6); c.fillStyle = sd.main; c.fill();
      if (sd.acc !== '#ffffff') { c.fillStyle = sd.acc; c.fillRect(-12, 4, 3, 1.6); }
      c.restore();
    } else {
      // calombos de baixo: botões e lencinho no bolso
      c.fillStyle = 'rgba(16,20,24,0.45)';
      c.beginPath(); O(c, L[0] - 4, L[1] - 4, 1.8); O(c, L[0] - 4, L[1] + 4, 1.8); c.fill();
      c.beginPath(); c.moveTo(L[0] + 8, L[1] - 6); c.lineTo(L[0] + 18, L[1] - 6); c.lineTo(L[0] + 16, L[1] - 1); c.lineTo(L[0] + 10, L[1] - 1); c.closePath();
      c.fillStyle = sd.main; c.fill();
    }
  }
  // rostão, parte fixa (vai para o sprite): pele, sombra, topete, bochechas e nariz
  function cenFaceBase(c, fl) {
    c.beginPath(); E(c, 0, -2, 39, 34);
    outl(c, fl ? WHITE : CEN_SKIN, 3);
    if (fl) return;
    c.save(); c.beginPath(); E(c, 0, -2, 39, 34); c.clip();
    c.fillStyle = 'rgba(120,60,30,0.14)'; c.beginPath(); E(c, 14, 10, 34, 30); c.fill();
    c.restore();
    // topete ralo
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(-26, -28); c.quadraticCurveTo(-2, -42, 24, -30);
    c.moveTo(-20, -31); c.quadraticCurveTo(2, -40, 27, -25); c.moveTo(-14, -33); c.quadraticCurveTo(6, -38, 29, -20); c.stroke();
    // bochechas
    c.fillStyle = 'rgba(255,90,90,0.28)'; c.beginPath(); E(c, -27, 5, 7, 4.5); E(c, 27, 5, 7, 4.5); c.fill();
    // nariz de batata (não encosta nos olhos nem na boca)
    c.beginPath(); E(c, 0, -1, 7, 6); inked(c, '#dc9c74', 1.6);
  }
  // rostão, parte viva (todo quadro): olhos, sobrancelhas, boca, suor e curativo
  const EYE_SIDES = [-1, 1];
  const LID_SMUG = Math.asin(0.3), LID_NORMAL = Math.asin(0.7); // linha da pálpebra 3 / 7 px acima do centro do olho (raio 10)
  function cenFaceLive(c, S, fl) {
    if (fl) return;
    const t = S.t || 0, mood = S.mood || 'smug', hp = S.hp;
    // olhos
    const lx = (S.look ? S.look[0] : 0) * 3.5, ly = (S.look ? S.look[1] : 0) * 3;
    for (const s of EYE_SIDES) {
      const ex = s * 16, ey = -13;
      if (mood === 'hurt') {
        c.strokeStyle = INK; c.lineWidth = 2.6;
        c.beginPath(); c.moveTo(ex - 5, ey - 5); c.lineTo(ex + 5, ey + 5); c.moveTo(ex + 5, ey - 5); c.lineTo(ex - 5, ey + 5); c.stroke();
      } else if (mood === 'laugh') {
        c.strokeStyle = INK; c.lineWidth = 2.8;
        c.beginPath(); c.arc(ex, ey + 3, 6, PI * 1.1, PI * 1.9); c.stroke();
      } else {
        c.beginPath(); E(c, ex, ey, 8.5, 10); inked(c, '#ffffff', 2);
        c.fillStyle = INK; c.beginPath(); O(c, ex + lx, ey + 1 + ly, 4.2); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); O(c, ex + lx - 1.4, ey - 0.6 + ly, 1.3); c.fill();
        if (mood === 'smug' || mood === 'normal') {
          // pálpebra pesada (malandro): o pedaço do olho acima da linha (arco + corda, sem clip)
          const la = mood === 'smug' ? LID_SMUG : LID_NORMAL;
          c.beginPath(); c.ellipse(ex, ey, 8.5, 10, 0, PI + la, TAU - la); c.closePath();
          c.fillStyle = CEN_SKIN; c.fill();
          c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - 8, ey - (mood === 'smug' ? 3 : 7)); c.lineTo(ex + 8, ey - (mood === 'smug' ? 3 : 7)); c.stroke();
        }
      }
      // sobrancelhas grossas
      const tilt = mood === 'angry' ? 0.5 : mood === 'hurt' ? -0.4 : mood === 'smug' ? (s > 0 ? -0.35 : 0.1) : 0;
      c.strokeStyle = '#2f2f2f'; c.lineWidth = 4.6;
      c.beginPath(); c.moveTo(ex - s * 8, ey - 14 + tilt * 5); c.lineTo(ex + s * 7, ey - 15 - tilt * 4 * s * s); c.stroke();
    }
    // sorrisão (boca grande com dente de ouro)
    const open = clamp((S.mouth || 0) + (mood === 'laugh' ? 0.55 : 0), 0, 1);
    const my = 8;
    if (mood === 'hurt') {
      c.beginPath(); c.moveTo(-22, my + 6); c.quadraticCurveTo(0, my - 2, 22, my + 6); c.lineTo(22, my + 14); c.quadraticCurveTo(0, my + 6, -22, my + 14); c.closePath();
      inked(c, '#ffffff', 2.4);
      c.strokeStyle = 'rgba(16,20,24,0.5)'; c.lineWidth = 1.2; c.beginPath();
      for (let x = -15; x <= 15; x += 6) { c.moveTo(x, my + 2); c.lineTo(x, my + 14); }
      c.moveTo(-22, my + 10); c.quadraticCurveTo(0, my + 2, 22, my + 10); c.stroke();
    } else {
      const top = my + 8 - open * 3, bot = my + 24 + open * 12;
      c.beginPath(); c.moveTo(-29, my - 3); c.quadraticCurveTo(0, top, 29, my - 3); c.quadraticCurveTo(0, bot, -29, my - 3); c.closePath();
      c.fillStyle = '#5a1a1a'; c.fill();
      c.save(); c.clip();
      if (open > 0.25) { c.fillStyle = '#ef6b7b'; c.beginPath(); E(c, 0, (top + bot) / 2 + 8, 13, 7); c.fill(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-29, my - 3); c.quadraticCurveTo(0, top, 29, my - 3); c.lineTo(29, my + 4); c.quadraticCurveTo(0, top + 9, -29, my + 4); c.closePath(); c.fill();
      c.fillStyle = '#ffd23f'; c.fillRect(7, my, 6, 9);
      c.strokeStyle = 'rgba(16,20,24,0.35)'; c.lineWidth = 1; c.beginPath();
      for (let x = -21; x <= 21; x += 7) { c.moveTo(x, my - 4); c.lineTo(x, my + 10); }
      c.stroke();
      c.restore();
      c.beginPath(); c.moveTo(-29, my - 3); c.quadraticCurveTo(0, top, 29, my - 3); c.quadraticCurveTo(0, bot, -29, my - 3); c.closePath();
      c.strokeStyle = INK; c.lineWidth = 2.4; c.stroke();
      c.beginPath(); c.arc(-31, my - 6, 4, 0.4, 1.9); c.moveTo(35, my - 3); c.arc(31, my - 6, 4, 1.25, 2.75); c.stroke();
    }
    // estados de dano
    if (hp < 0.66) { sweatDrop(c, -36, -18, t, 0); sweatDrop(c, 37, -12, t, 0.45); }
    if (hp < 0.25) {
      // curativo em X na testa
      c.save(); c.translate(-20, -27);
      for (const r of [0.6, -0.6]) { c.save(); c.rotate(r); rr(c, -9, -3, 18, 6, 2); inked(c, '#f3d6b0', 1.2); c.restore(); }
      c.restore();
    }
  }
  function rr(c, x, y, w, h, r) { G.roundRect(c, x, y, w, h, r); }
  // ---------- sprites na resolução do aparelho (desempenho) ----------
  // Desenhos vetoriais caros e quase fixos (o corpo do Centrão, a maleta) vão para canvas fora da tela e são
  // reaproveitados. Só no canvas do jogo e na escala 1 (o retrato do diálogo continua vetorial).
  // Pintar um sprite grande no mesmo quadro em que ele é usado custa caro (o navegador rasteriza tudo na hora:
  // 15-45 ms com a CPU 4× mais lenta). Por isso eles são pintados ANTES, numa fila (sprWant), em fatias: uma
  // fatia (paint) por quadro, e o navegador rasteriza cada fatia no fim do próprio quadro.
  const sprCache = new Map();   // chave → canvas pronto (cv._res = resolução em que foi pintado)
  const sprStale = new Map();   // pintados na resolução anterior: desenhados escalados até a fila repintar
  const sprRecipe = new Map();  // chave → { box, steps() } (receita, para repintar na troca de resolução)
  const sprQ = [];              // fila: { key, box, steps: [fn(x)], i, cv, x, res }
  let sprRes = 0;
  function devRes() { return G.canvas && G.ctx ? G.canvas.width / G.W : 0; }
  function fontKey() { return document.fonts ? document.fonts.status : ''; } // refaz o texto quando a fonte chegar
  // troca de qualidade (resolução): os prontos viram "velhos" e voltam para a fila, na ordem em que estavam
  function sprCheckRes() {
    const res = devRes();
    if (res === sprRes) return res;
    const redo = [];
    for (const [k, cv] of sprCache) { if (cv._res > 0) sprStale.set(k, cv); redo.push(k); }
    for (const j of sprQ) redo.push(j.key);
    sprCache.clear(); sprQ.length = 0; sprRes = res;
    if (res > 0) for (const k of redo) { const r = sprRecipe.get(k); if (r) sprQ.push(sprJob(k, r.box, r.steps)); }
    return res;
  }
  function sprReset() { sprCache.clear(); sprStale.clear(); sprRecipe.clear(); sprQ.length = 0; sprRes = devRes(); }
  function sprJob(key, box, steps) { return { key, box, steps: steps(), i: 0, cv: null, x: null, res: 0 }; }
  // pinta a próxima fatia de um trabalho; true = terminou (entra no cache)
  function sprStepJob(j) {
    const res = sprRes;
    if (!j.cv || j.res !== res) {
      j.res = res; j.i = 0;
      j.cv = document.createElement('canvas');
      j.cv.width = Math.max(1, Math.ceil(j.box[2] * res)); j.cv.height = Math.max(1, Math.ceil(j.box[3] * res));
      j.x = j.cv.getContext('2d');
      if (!j.x) { j.i = j.steps.length; return true; }
      j.x.setTransform(res, 0, 0, res, -j.box[0] * res, -j.box[1] * res);
      j.x.lineJoin = 'round'; j.x.lineCap = 'round';
    }
    const x = j.x;
    if (x) {
      x.save();
      try { j.steps[j.i](x); } catch (err) { G.reportError(err, 'bosses sprite ' + j.key); }
      x.restore();
    }
    j.i++;
    if (j.i < j.steps.length) return false;
    if (x) sprPut(j.key, j.cv);
    return true;
  }
  function sprPut(key, cv) {
    if (sprCache.size >= 32) sprCache.delete(sprCache.keys().next().value); // rede de segurança (o mais antigo)
    cv._res = sprRes;
    sprCache.set(key, cv);
    const old = sprStale.get(key);
    if (old) { sprStale.delete(key); old.width = old.height = 1; }
  }
  // pede um sprite para logo (sem pintar agora). steps() devolve as fatias: [fn(ctx), ...]
  function sprWant(key, box, steps) {
    if (!sprRecipe.has(key)) sprRecipe.set(key, { box, steps });
    if (sprCheckRes() > 0 && !sprCache.has(key) && !sprQ.some((j) => j.key === key)) sprQ.push(sprJob(key, box, steps));
  }
  // uma fatia da fila (chamado no máximo uma vez por quadro). true = ainda tem trabalho
  function sprStep() {
    if (!sprQ.length || !(sprCheckRes() > 0)) return false;
    if (sprStepJob(sprQ[0])) sprQ.shift();
    return sprQ.length > 0;
  }
  // descarta sprites (pronto, velho, na fila e receita) cuja chave satisfaz drop(key)
  function sprDrop(drop) {
    for (const k of Array.from(sprCache.keys())) if (drop(k)) sprCache.delete(k);
    for (const k of Array.from(sprStale.keys())) if (drop(k)) { sprStale.get(k).width = 1; sprStale.delete(k); }
    for (const k of Array.from(sprRecipe.keys())) if (drop(k)) sprRecipe.delete(k);
    for (let i = sprQ.length - 1; i >= 0; i--) if (drop(sprQ[i].key)) sprQ.splice(i, 1);
  }
  // sprGet: só consulta (sem alocar nada por quadro). Um sprite da resolução anterior serve até sair o novo.
  function sprGet(key) {
    sprCheckRes();
    return sprCache.get(key) || sprStale.get(key) || null;
  }
  // precisa AGORA: termina o trabalho da fila (ou pinta tudo de uma vez, como antes). paint = fn(ctx) ou steps()
  function sprite(key, box, paint, steps) {
    const res = sprCheckRes();
    if (!(res > 0)) return null;
    const cv = sprCache.get(key);
    if (cv) return cv;
    if (steps && !sprRecipe.has(key)) sprRecipe.set(key, { box, steps });
    let k = sprQ.findIndex((j) => j.key === key);
    const j = k >= 0 ? sprQ[k] : sprJob(key, box, steps || (() => [paint]));
    while (!sprStepJob(j));
    if (k >= 0) sprQ.splice(k, 1);
    return sprCache.get(key) || null;
  }
  // Cola um sprite feito por sprite() no lugar do box. exact = a transformação atual não tem escala (só ±1):
  // copia pixel a pixel, alinhado à grade do aparelho e sem suavização (bem mais barato na CPU; idêntico na tela).
  function blitExact(c, spr, box, exact) {
    if (exact && c.getTransform) {
      const m = c.getTransform(), res = spr._res || sprRes;
      if (m.b === 0 && m.c === 0 && Math.abs(Math.abs(m.a) - res) < 0.02 && Math.abs(m.d - res) < 0.02) {
        c.save();
        c.setTransform(m.a < 0 ? -1 : 1, 0, 0, 1, Math.round(m.e), Math.round(m.f));
        c.imageSmoothingEnabled = false;
        c.drawImage(spr, Math.round(box[0] * res), Math.round(box[1] * res));
        c.restore();
        return;
      }
    }
    c.drawImage(spr, box[0], box[1], box[2], box[3]);
  }
  // maleta (desenho compartilhado: na mão e sub-inimigo)
  function caseKey(w, fl, label) { return 'case|' + w + '|' + (fl ? 1 : 0) + '|' + (label || '') + '|' + fontKey(); }
  function caseSteps(w, fl, label) { return () => [(x2) => briefcaseVec(x2, 0, 0, w, 0, fl, label)]; }
  function caseBox(w) { const B = w * 0.7 + 2; return [-B, -B, 2 * B, 2 * B]; }
  function caseWant(w, label) { for (const fl of [false, true]) sprWant(caseKey(w, fl, label), caseBox(w), caseSteps(w, fl, label)); }
  function briefcase(c, x, y, w, rot, fl, label) {
    if (c === G.ctx) {
      const B = w * 0.7 + 2, key = caseKey(w, fl, label);
      const spr = sprGet(key) || sprite(key, caseBox(w), null, caseSteps(w, fl, label));
      if (spr) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.drawImage(spr, -B, -B, 2 * B, 2 * B); c.restore(); return; }
    }
    briefcaseVec(c, x, y, w, rot, fl, label);
  }
  function briefcaseVec(c, x, y, w, rot, fl, label) {
    const C = (col) => (fl ? WHITE : col);
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    const h = w * 0.7;
    c.beginPath(); c.moveTo(-w * 0.18, -h / 2); c.lineTo(-w * 0.18, -h / 2 - w * 0.16); c.lineTo(w * 0.18, -h / 2 - w * 0.16); c.lineTo(w * 0.18, -h / 2);
    c.strokeStyle = INK; c.lineWidth = Math.max(2, w * 0.14); c.stroke();
    c.strokeStyle = C('#5a3418'); c.lineWidth = Math.max(1, w * 0.07); c.stroke();
    rr(c, -w / 2, -h / 2, w, h, w * 0.12); inked(c, C('#8b5a2b'), Math.max(1.3, w * 0.07));
    if (!fl) {
      c.fillStyle = '#6b4220'; c.fillRect(-w / 2 + 1, -h * 0.08, w - 2, h * 0.16);
      c.fillStyle = '#ffd23f'; c.fillRect(-w * 0.32, -h * 0.16, w * 0.12, h * 0.3); c.fillRect(w * 0.2, -h * 0.16, w * 0.12, h * 0.3);
      if (label) {
        c.fillStyle = '#f4f1e8'; c.fillRect(-w * 0.36, h * 0.12, w * 0.72, h * 0.3);
        txt(c, label, 0, h * 0.27 + 0.3, w * 0.17, '#e63946', { maxW: w * 0.66 });
      }
    }
    c.restore();
  }
  // bandeirinha do lado
  function sideFlag(c, x, y, sd, t, fl) {
    const C = (col) => (fl ? WHITE : col);
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x + 2, y - 30); c.stroke();
    c.strokeStyle = C('#c9a36a'); c.lineWidth = 1.6; c.stroke();
    const w = Math.sin(t * 9) * 2.2;
    c.beginPath(); c.moveTo(x + 2, y - 30); c.quadraticCurveTo(x + 12, y - 33 + w, x + 22, y - 29 - w); c.lineTo(x + 21, y - 17 - w); c.quadraticCurveTo(x + 12, y - 20 + w, x + 2, y - 17); c.closePath();
    inked(c, C(sd.main), 1.4);
    if (!fl) {
      if (sd.acc !== '#ffffff') { c.fillStyle = sd.acc; c.beginPath(); c.moveTo(x + 5, y - 23.5); c.lineTo(x + 12, y - 28 + w * 0.5); c.lineTo(x + 19, y - 23.5 - w * 0.5); c.lineTo(x + 12, y - 19 + w * 0.5); c.closePath(); c.fill(); }
      else { c.fillStyle = '#ffffff'; c.beginPath(); for (let j = 0; j < 10; j++) { const aa = -PI / 2 + (j * PI) / 5, r = j % 2 ? 1.6 : 3.8; c.lineTo(x + 12 + Math.cos(aa) * r, y - 23.5 + w * 0.2 + Math.sin(aa) * r); } c.closePath(); c.fill(); }
    }
  }

  // corpo do Centrão (ternos fundidos, torsos, rasgos, faixa com o letreiro). wobble = balanço de cada calombo
  // (só no desenho vetorial: o retrato do diálogo). Área ocupada: CEN_BOX.
  const CEN_BOX = [-86, -56, 172, 126];
  const NO_WOB = () => 1;
  // p0..p1 (para pintar o sprite em fatias; sem eles, tudo): 0 contorno, 1-6 calombos, 7 rasgos e faixa
  function cenBody(c, sd, fl, hp, t, wobble, banner, p0, p1) {
    if (p0 == null) { p0 = 0; p1 = 7; }
    const C = (col) => (fl ? WHITE : col);
    const wob = wobble ? (i, a) => 1 + 0.035 * Math.sin(t * 2.4 + i * 1.9 + a) : NO_WOB;
    // corpo: contorno único por fora + calombos
    if (p0 <= 0) {
      c.beginPath();
      for (let i = 0; i < CEN_LUMPS.length; i++) { const L = CEN_LUMPS[i]; E(c, L[0], L[1], L[2] * wob(i, 0), L[3] * wob(i, 1.3)); }
      c.lineWidth = 6; c.strokeStyle = INK; c.stroke();
    }
    for (let i = Math.max(0, p0 - 1), n = Math.min(CEN_LUMPS.length, p1); i < n; i++) {
      const L = CEN_LUMPS[i], rx = L[2] * wob(i, 0), ry = L[3] * wob(i, 1.3);
      c.beginPath(); E(c, L[0], L[1], rx, ry);
      c.fillStyle = C(L[4]); c.fill();
      if (fl) continue;
      c.save(); c.clip();
      c.fillStyle = 'rgba(16,20,24,0.2)'; c.beginPath(); E(c, L[0] + rx * 0.4, L[1] + ry * 0.5, rx * 0.95, ry * 0.75); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); E(c, L[0] - rx * 0.35, L[1] - ry * 0.45, rx * 0.5, ry * 0.35); c.fill();
      c.restore();
      c.lineWidth = 1.6; c.strokeStyle = 'rgba(16,20,24,0.4)'; c.beginPath(); E(c, L[0], L[1], rx, ry); c.stroke();
      if (i < 5) cenTorso(c, L, i, sd, hp);
    }
    if (p1 < 7) return;
    // rasgos (dano)
    if (!fl && hp < 0.45) { rip(c, -55, 22, 16, 5, 0.5); rip(c, 52, 28, 14, 4.5, -0.4); }
    if (!fl && hp < 0.25) { rip(c, -20, 46, 13, 4, 0.1); rip(c, 30, 4, 10, 3.5, 1.2); }
    // faixa
    c.beginPath(); c.moveTo(-58, 37); c.quadraticCurveTo(0, 55, 58, 37); c.lineTo(58, 49); c.quadraticCurveTo(0, 67, -58, 49); c.closePath();
    inked(c, C(sd.main), 2.4);
    if (!fl) {
      c.beginPath(); c.moveTo(-58, 47); c.quadraticCurveTo(0, 65, 58, 47); c.lineTo(58, 49); c.quadraticCurveTo(0, 67, -58, 49); c.closePath();
      c.fillStyle = sd.dark; c.fill();
      curvedText(c, banner, 43.5, 8.6, 58, 8.4, sd.acc);
    }
  }
  // sprite do corpo + parte fixa do rosto: muda só com o lado, o estado de dano, o letreiro e o flash
  const HP_ST = [1, 0.4, 0.2]; // hp usado no desenho de cada estado de dano (ver hpSt em drawCentrao)
  function cenBodyKey(side, fl, hpSt, banner) { return fl ? 'cenF' : 'cen|' + side + '|' + hpSt + '|' + banner + '|' + fontKey(); }
  // as fatias do corpo (5, uma por quadro na fila); o flash é barato (sem sombras nem detalhes): uma só
  function cenBodySteps(side, fl, hpSt, banner) {
    const sd = SIDE[side], hp = HP_ST[hpSt];
    if (fl) return () => [(x) => { cenBody(x, sd, true, 1, 0, false, ''); cenFaceBase(x, true); }];
    return () => [
      (x) => cenBody(x, sd, false, hp, 0, false, banner, 0, 3),
      (x) => cenBody(x, sd, false, hp, 0, false, banner, 4, 5),
      (x) => cenBody(x, sd, false, hp, 0, false, banner, 6, 6),
      (x) => cenBody(x, sd, false, hp, 0, false, banner, 7, 7),
      (x) => cenFaceBase(x, false),
    ];
  }
  function cenBodySprite(side, fl, hpSt, banner) {
    const key = cenBodyKey(side, fl, hpSt, banner);
    return sprGet(key) || sprite(key, CEN_BOX, null, cenBodySteps(side, fl, hpSt, banner));
  }
  function cenBodyWant(side, fl, hpSt, banner) { sprWant(cenBodyKey(side, fl, hpSt, banner), CEN_BOX, cenBodySteps(side, fl, hpSt, banner)); }

  // sapatinhos (muitos pés), braços com maleta e bandeira
  function cenShoes(c, t, fl) {
    c.beginPath();
    for (let i = 0; i < 6; i++) { const sx = -42 + i * 16.8, hop = Math.max(0, Math.sin(t * 7 + i * 1.7)) * 2.5; E(c, sx, 62 - hop, 7, 4.2); }
    inked(c, fl ? WHITE : '#2a1d18', 2);
  }
  function cenArms(c, S, sd, fl, t) {
    const C = (col) => (fl ? WHITE : col);
    const aL = S.armL || 0, aR = S.armR || 0;
    const hLx = M.lerp(-86, -82, aL), hLy = M.lerp(34, -26, aL) + Math.sin(t * 3) * 1.5;
    const hRx = M.lerp(86, 84, aR), hRy = M.lerp(28, -20, aR) + Math.sin(t * 3 + 1) * 1.5;
    c.beginPath();
    c.moveTo(-62, 22); c.quadraticCurveTo(M.lerp(-84, -76, aL), M.lerp(24, 4, aL), hLx, hLy);
    c.moveTo(62, 22); c.quadraticCurveTo(M.lerp(84, 76, aR), M.lerp(20, 2, aR), hRx, hRy);
    c.lineWidth = 15; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 10; c.strokeStyle = C('#6b7384'); c.stroke();
    if (S.holdCase) briefcase(c, hLx - 2, hLy + 9, 22, -0.15 + aL * 0.5, fl, 'EMENDA');
    c.beginPath(); O(c, hLx, hLy, 6.2); O(c, hRx, hRy, 6.2); inked(c, C(CEN_SKIN), 2);
    sideFlag(c, hRx - 2, hRy, sd, t, fl);
  }
  // O REFLEXO (fase 2) é translúcido e não leva dano: pés, corpo, rosto (sorrisinho olhando pra frente), braços em
  // repouso e bandeira ficam todos num sprite só. As cabecinhas e a maleta (com a mão por cima) são ao vivo.
  const GH_BOX = [-104, -58, 216, 130];
  const GH_FACE = { t: 0, mood: 'smug', mouth: 0, look: [0, 0.25], hp: 1, armL: 0, armR: 0, holdCase: false };
  function cenGhostKey(side, hpSt, banner) { return 'cenG|' + side + '|' + hpSt + '|' + banner + '|' + fontKey(); }
  function cenGhostSteps(side, hpSt, banner) {
    const sd = SIDE[side], hp = HP_ST[hpSt];
    return () => [
      (x) => { cenShoes(x, 0, false); cenBody(x, sd, false, hp, 0, false, banner, 0, 3); },
      (x) => cenBody(x, sd, false, hp, 0, false, banner, 4, 5),
      (x) => cenBody(x, sd, false, hp, 0, false, banner, 6, 6),
      (x) => cenBody(x, sd, false, hp, 0, false, banner, 7, 7),
      (x) => { cenFaceBase(x, false); GH_FACE.hp = hpSt ? 0.5 : 1; cenFaceLive(x, GH_FACE, false); },
      (x) => cenArms(x, GH_FACE, sd, false, 0),
    ];
  }
  function cenGhostSprite(side, hpSt, banner) {
    const key = cenGhostKey(side, hpSt, banner);
    return sprGet(key) || sprite(key, GH_BOX, null, cenGhostSteps(side, hpSt, banner));
  }
  function cenGhostWant(side, hpSt, banner) { sprWant(cenGhostKey(side, hpSt, banner), GH_BOX, cenGhostSteps(side, hpSt, banner)); }

  /**
   * Desenha o Centrão. k = escala (1 = jogo). S = estado visual:
   * {t, flash, side, flipX, pops[8], hmood[8], warn[8], mood, mouth, look[2], hp, banner, armL, armR, holdCase, sq, alpha, ghost, orbit{ang,R}, noShadow}
   * No jogo o corpo vem de um sprite (cenBodySprite); cabeças, olhos, boca, braços e bandeira são desenhados ao vivo.
   * O reflexo (S.ghost) usa um sprite só (cenGhostSprite) + as cabecinhas.
   */
  function drawCentrao(c, x, y, k, S) {
    const fl = !!S.flash;
    const t = S.t || 0, hp = S.hp != null ? S.hp : 1;
    const side = S.side | 0, sd = SIDE[side], banner = S.banner || 'TOMA LÁ DÁ CÁ';
    const game = k === 1 && c === G.ctx;
    // no jogo, o "amassadinho" de cada tiro (sq ≤ 0,03) é ignorado: assim o sprite do corpo é copiado pixel a pixel
    // (sem filtro bilinear, que é o que mais pesa no celular sem GPU). O "pulo" dos anéis (sq 0,06) continua.
    const sq = game && S.sq <= 0.03 ? 0 : S.sq || 0;
    const fx = S.flipX != null ? S.flipX : 1;
    c.save();
    c.translate(x, y);
    if (S.alpha != null) c.globalAlpha *= S.alpha;
    c.scale(k * fx * (1 + sq), k * (1 - sq));
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (!S.ghost && !S.noShadow) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(0, 68, 66, 9, 0, 0, TAU); c.fill(); }
    const hpSt = hp < 0.25 ? 2 : hp < 0.45 ? 1 : 0;
    const exact = sq === 0 && (fx === 1 || fx === -1);
    const ghostSpr = game && S.ghost && !S.orbit && !fl ? cenGhostSprite(side, hpSt, banner) : null;
    if (!ghostSpr) cenShoes(c, t, fl);
    // cabecinhas atrás do corpo
    if (!S.orbit) for (let i = 0; i < 8; i++) { const pop = S.pops ? S.pops[i] : 0.5; if (pop < 0.06) continue; const p = cenSlot(i, pop); cenHead(c, p[0], p[1], i, S, fl); }
    if (ghostSpr) {
      blitExact(c, ghostSpr, GH_BOX, exact);
      // maleta na mão esquerda (braço em repouso: mão em -86, 34), com a mão por cima, como em cenArms
      if (S.holdCase) { briefcase(c, -88, 43, 22, -0.15, false, 'EMENDA'); c.beginPath(); O(c, -86, 34, 6.2); inked(c, CEN_SKIN, 2); }
      c.restore(); return;
    }
    // corpo + rosto
    const spr = game ? cenBodySprite(side, fl, hpSt, banner) : null;
    if (spr) {
      blitExact(c, spr, CEN_BOX, exact);
      cenFaceLive(c, S, fl);
    } else {
      cenBody(c, sd, fl, hp, t, true, banner);
      cenFaceBase(c, fl);
      cenFaceLive(c, S, fl);
    }
    cenArms(c, S, sd, fl, t);
    // cabeças em órbita (fúria final)
    if (S.orbit) {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = S.orbit.ang + (i * TAU) / n;
        const hx = Math.cos(a) * S.orbit.R, hy = Math.sin(a) * S.orbit.R;
        cenHead(c, hx, hy, i, S, fl);
      }
    }
    c.restore();
  }

  // balões do "Fundão" para a fuga
  function balloons(c, x, y, t, k) {
    const cols = ['#e63946', '#ffd23f', '#00a651', '#4cc9f0', '#ff5d8f'];
    for (let i = 0; i < 5; i++) {
      const bx = x + (i - 2) * 26 * k + Math.sin(t * 2 + i) * 4, by = y - (70 + (i % 2) * 22) * k + Math.cos(t * 2.4 + i) * 3;
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + (i - 2) * 8, y - 36 * k); c.quadraticCurveTo(bx + 5, (by + y - 36 * k) / 2, bx, by + 17 * k); c.stroke();
      c.beginPath(); E(c, bx, by, 15 * k, 18 * k); inked(c, cols[i], 2);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); E(c, bx - 5 * k, by - 7 * k, 4 * k, 6 * k, -0.4); c.fill();
      if (i === 2) txt(c, 'FUNDÃO', bx, by + 1, 6.5 * k, '#ffffff', { stroke: 2, maxW: 26 * k });
    }
  }

  // ---------- sub-inimigo: maleta da EMENDA (atire antes que estoure!) ----------
  G.Enemies.define('bs_emenda', {
    hp: 9, r: 12, score: 300, pix: 3, harmless: true, keepOffscreen: true,
    init(e, o) {
      const d = e.data;
      d.x0 = e.x; d.y0 = e.y; d.tx = o.tx; d.ty = o.ty;
      d.fl = o.flight || 0.8; d.fuse0 = d.fuse = o.fuse || 2.8; d.n = o.n || 14; d.rot = 0; d.tick = 3;
      d.col = o.col || COL.orange;
    },
    update(e, dt) {
      const d = e.data;
      if (e.t < d.fl) {
        const u = e.t / d.fl;
        e.x = M.lerp(d.x0, d.tx, u); e.y = M.lerp(d.y0, d.ty, u) - Math.sin(u * PI) * 70;
        d.rot += dt * 11;
        return;
      }
      d.rot = M.approach(M.wrapAngle(d.rot), 0, dt * 8);
      e.x = d.tx; e.y = d.ty + Math.sin(e.t * 4) * 2;
      d.fuse -= dt;
      if (Math.ceil(d.fuse) < d.tick && d.fuse > 0) { d.tick = Math.ceil(d.fuse); sfx('tink'); }
      if (d.fuse <= 0) {
        // estourou: emenda liberada!
        d.burst = true;
        const o = { style: 'bs_cedula', color: d.col };
        ring(e.x, e.y, d.n, 98, o, Math.random() * TAU);
        G.burst(e.x, e.y, 12, { colors: ['#8b5a2b', '#ffd23f', '#3ddc84'], speed: 160 });
        G.confetti(e.x, e.y, 6);
        G.text(e.x, e.y - 16, 'LIBERADA!', { color: COL.orange, size: 11, life: 0.9 });
        sfx('explode_s');
        G.killEnemy(e, { silent: true });
      }
    },
    draw(ctx, e) {
      const d = e.data, fl = G.isFlash(e);
      const hover = e.t >= d.fl;
      if (hover) {
        // pavio: anel que se esvazia (fica vermelho no fim)
        const k = clamp(d.fuse / d.fuse0, 0, 1), late = d.fuse < 1;
        const blink = late && ((e.t * 10) | 0) % 2;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,20,24,0.6)';
        ctx.beginPath(); ctx.arc(e.x, e.y, 18, 0, TAU); ctx.stroke();
        ctx.strokeStyle = blink ? '#ffffff' : late ? COL.red : G.C.yellow; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(e.x, e.y, 18, -PI / 2, -PI / 2 + TAU * k); ctx.stroke();
      }
      briefcase(ctx, e.x, e.y, 24, d.rot, fl, 'EMENDA');
    },
    onDeath(e, g, opts) {
      if (opts && opts.silent) return;
      G.text(e.x, e.y - 16, 'VETADA!', { color: G.C.greenL, size: 12, life: 1 });
      G.confetti(e.x, e.y, 5);
    },
  });

  // ---------- sub-inimigo: deputadinho puxa-saco (cura o Centrão se chegar) ----------
  const APOIO_SPECS = [
    { skin: '#e8b48a', hair: 'slick', hairColor: '#3a3a3a', body: 'suit', suit: '#6b7384', tie: '#e63946', face: 'jowl', seed: 51 },
    { skin: '#c68a5e', hair: 'bald', hairColor: '#444444', body: 'suit', suit: '#5d6575', tie: '#e63946', face: 'round', mustache: true, seed: 52 },
    { skin: '#f0c49c', hair: 'combover', hairColor: '#7a6a5a', body: 'suit', suit: '#737b8c', tie: '#e63946', glasses: 'square', seed: 53 },
  ];
  const APOIO_SPECS_G = APOIO_SPECS.map((s) => Object.assign({}, s, { tie: '#00a651' }));
  G.Enemies.define('bs_apoio', {
    hp: 6, r: 11, score: 220, pix: 2, harmless: true, keepOffscreen: true,
    init(e, o) {
      const d = e.data;
      d.spd = o.spd || 48; d.side = o.side || (e.x < G.W / 2 ? -1 : 1); d.v = M.randi(0, 2); d.ph = Math.random() * TAU;
    },
    update(e, dt, g) {
      const d = e.data, b = g.boss;
      if (!b || b.state !== 'fight') return;
      const tx = b.x + d.side * 34, ty = b.y + 46;
      const a = Math.atan2(ty - e.y, tx - e.x);
      const sp = d.spd * (e.t < 0.6 ? 1.6 : 1);
      e.x += Math.cos(a) * sp * dt; e.y += Math.sin(a) * sp * dt;
      d.face = Math.cos(a) < 0 ? -1 : 1;
      if (M.dist2(e.x, e.y, tx, ty) < 18 * 18) {
        if (b.def.heal) b.def.heal(b, e);
        G.killEnemy(e, { silent: true });
      }
    },
    draw(ctx, e, g) {
      const d = e.data, fl = G.isFlash(e), b = g && g.boss;
      const green = b && b.id === 'centrao' && b.data.side === 1;
      const spec = (green ? APOIO_SPECS_G : APOIO_SPECS)[d.v];
      const hop = Math.abs(Math.sin(e.t * 11 + d.ph)) * 3;
      ctx.save();
      ctx.translate(e.x, e.y - hop);
      ctx.rotate(0.12 * (d.face || 1));
      G.Art.person(ctx, 0, 0, 28, spec, { t: e.t, mood: 'laugh', pose: 'up', flash: fl, facing: d.face || 1, lookX: 0.8, lookY: -0.6, autoLook: false });
      // plaquinha "SIM"
      rr(ctx, -10, -27, 20, 9, 2); inked(ctx, fl ? WHITE : '#ffffff', 1.2);
      if (!fl) txt(ctx, 'SIM', 0, -22.3, 6.5, green ? '#00a651' : '#e63946');
      ctx.restore();
    },
    onDeath(e, g, opts) {
      if (opts && opts.silent) return;
      if (Math.random() < 0.5) G.text(e.x, e.y - 14, 'NÃO!', { color: '#ffffff', size: 9, life: 0.6 });
    },
  });

  // ---------- ataques do Centrão ----------
  const CEN_SWAP_LINES = ['MUDEI DE LADO!', 'SOMOS OPOSIÇÃO!', 'APOIO QUEM GANHA!', 'AGORA SOMOS GOVERNO!'];
  function cenSway(b, d) {
    d.tx = b.homeX + Math.sin(b.ft * 0.55) * 62;
    d.ty = b.homeY + Math.sin(b.ft * 1.1) * 8;
  }
  function cenHover(b, d) { d.ty = b.homeY + Math.sin(b.ft * 1.6) * 6; }
  const VIS8 = [0, 1, 2, 3, 4, 5, 6, 7], VIS7 = [0, 1, 2, 3, 4, 5, 6], VIS6 = [1, 2, 3, 4, 5, 6];
  function cenVisible(b) { return b.data.nHeads === 8 ? VIS8 : b.data.nHeads === 7 ? VIS7 : VIS6; } // não alterar (use .slice())
  // fontes de tiro: o Centrão e (fase 2) o reflexo dele do outro lado
  function cenSources(b) {
    const d = b.data, out = [{ x: b.x, y: b.y, m: b.x < G.W / 2 ? 1 : -1, ghost: false }];
    if (d.ghost && d.ghost.a > 0.5) out.push({ x: d.ghost.x, y: d.ghost.y, m: d.ghost.x < G.W / 2 ? 1 : -1, ghost: true });
    return out;
  }
  // cabecinhas sobem ("!") e atiram leques mirados
  function* cenHeads(b, n, spd) {
    const d = b.data;
    const vis = cenVisible(b).slice();
    for (let k = vis.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; const tmp = vis[k]; vis[k] = vis[j]; vis[j] = tmp; }
    for (let k = 0; k < n; k++) {
      const i = vis[k % vis.length];
      d.popT[i] = 1; d.warn[i] = 0.45; d.hmood[i] = 'angry'; d.hold[i] = 1.2;
      yield 0.42;
      const nb = L2() ? 5 : 4;
      for (const s of cenSources(b)) {
        const hp = cenHeadPos(b, i, s.ghost ? s.x : null);
        fan(hp[0], hp[1] + 6, aimFrom(hp[0], hp[1]), nb, 0.5, spd || 138, { style: 'bs_171', color: s.ghost ? COL.violet : COL.pink });
      }
      sfx('enemy_shot2');
      d.hmood[i] = 'laugh';
      yield 0.32;
    }
  }
  // pressão de fundo: uma cabecinha aleatória dá um tiro mirado de vez em quando
  function* cenBg(b, every) {
    const d = b.data;
    for (;;) {
      yield every * M.rand(0.8, 1.2);
      if (d.orbit) continue;
      const vis = cenVisible(b).filter((i) => d.hold[i] <= 0);
      if (!vis.length) continue;
      const i = M.pick(vis);
      d.popT[i] = 1; d.warn[i] = 0.35; d.hmood[i] = 'angry'; d.hold[i] = 0.8;
      yield 0.35;
      for (const s of cenSources(b)) {
        const hp = cenHeadPos(b, i, s.ghost ? s.x : null);
        shoot(hp[0], hp[1] + 6, aimFrom(hp[0], hp[1]), 150, { style: 'bs_171', color: s.ghost ? COL.violet : COL.pink });
      }
      d.hmood[i] = 'laugh';
    }
  }
  // "TOMA LÁ..." moedas param no meio da tela; "...DÁ CÁ!" voam no Zé uma a uma
  function* cenTomaLa(b) {
    const d = b.data, g = G.game;
    say(b, 'TOMA LÁ...', 1.3); d.armRT = 1; d.mouthT = 0.8;
    sfx('charge');
    yield 0.5;
    const n = L2() ? 13 : 11, coins = [];
    const H = G.H, dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const tx = 34 + u * (G.W - 68), ty = H * 0.36 + Math.sin(u * PI) * H * 0.07;
      const sx = b.x + (u - 0.5) * 70, sy = b.y + 30;
      const bl = shoot(sx, sy, DOWN, 0, {
        style: 'bs_moeda', color: COL.gold, data: { sx, sy, tx, ty, T: 0.75 },
        update(q) { const k = Math.min(1, q.t / q.data.T), e2 = M.easeOutCubic(k); q.x = M.lerp(q.data.sx, q.data.tx, e2); q.y = M.lerp(q.data.sy, q.data.ty, e2); q.vx = 0; q.vy = 0; },
      });
      if (bl) coins.push(bl);
    }
    sfx('whoosh');
    yield 1.25;
    say(b, '...DÁ CÁ!', 1.3); d.mouthT = 0.8;
    // dispara em ordem (esquerda→direita ou o contrário): varredura
    for (let j = 0; j < coins.length; j++) {
      const q = coins[dir > 0 ? j : coins.length - 1 - j];
      if (!q || q.dead) continue;
      const a = aimFrom(q.x, q.y);
      q.update = null; q.ang = a; q.spd = 50 * g.diff; q.accel = 320; q.maxSpd = 205 * g.diff;
      q.vx = Math.cos(a) * q.spd; q.vy = Math.sin(a) * q.spd;
      sfx('enemy_shot');
      yield 0.075;
    }
    d.armRT = 0;
  }
  // arremessa maletas EMENDA (src: lista de fontes; mirror = espelhadas)
  function* cenEmenda(b, n) {
    const d = b.data;
    d.armLT = 1; sfx('charge');
    yield 0.45;
    const H = G.H, p = pl();
    for (const s of cenSources(b)) {
      for (let i = 0; i < n; i++) {
        let tx, ty;
        if (n === 1) tx = s.m > 0 ? G.W * 0.72 : G.W * 0.28;
        else tx = i === 0 ? G.W * 0.27 : G.W * 0.73;
        tx += M.rand(-24, 24);
        ty = M.rand(H * 0.34, H * 0.46);
        if (p.alive && p.y < ty + 140) ty = Math.max(H * 0.22, p.y - 150);
        const hx = s.x + (s.ghost ? 84 : -84), hy = s.y + 30;
        const e = G.spawnEnemy('bs_emenda', hx, hy, { tx, ty, flight: 0.8, fuse: L2() ? 2.4 : 2.8, n: L2() ? 18 : 16, col: s.ghost ? COL.violet : COL.orange });
        if (e && i === 0 && !s.ghost) hint('emenda', clamp(tx, 70, G.W - 70), ty - 30, 'ATIRE NA EMENDA!');
      }
    }
    sfx('whoosh');
    d.holdCase = false; d.caseT = 1.2;
    d.armLT = 0;
  }
  // cortina "vira-casaca": leques que giram e se curvam (espelhados com o reflexo)
  function* cenCurtain(b) {
    const d = b.data;
    for (const i of cenVisible(b)) { d.popT[i] = 1; d.hold[i] = 2.4; d.hmood[i] = 'laugh'; }
    d.armRT = 1;
    sfx('charge');
    yield 0.55;
    const n = L2() ? 10 : 8;
    for (let i = 0; i < n; i++) {
      for (const s of cenSources(b)) {
        const a0 = DOWN - s.m * (0.95 - i * 0.18);
        fan(s.x, s.y + 24, a0, 4, 0.44, 122, { style: 'bs_171', color: s.ghost ? COL.violet : COL.pink, turn: s.m * 0.22 });
      }
      sfx('enemy_shot');
      yield 0.27;
    }
    d.armRT = 0;
  }
  // anéis do balcão (com fresta)
  function* cenRings(b, k) {
    const d = b.data;
    for (let r = 0; r < k; r++) {
      d.sqT = 0.12; d.mouthT = 0.4;
      const n = L2() ? 24 : 20;
      ring(b.x, b.y + 10, n, 100, { style: 'bs_171', color: r % 2 ? COL.magenta : COL.pink }, Math.random() * TAU);
      sfx('enemy_shot2');
      yield 0.65;
    }
  }
  // muda de lado: aviso, troca de posição com o reflexo, troca de cor
  function* cenSwap(b, first) {
    const d = b.data;
    d.swapWarn = 0.8;
    say(b, first ? 'AGORA SOMOS GOVERNO!' : M.pick(CEN_SWAP_LINES), 1.8);
    sfx('charge');
    yield 0.8;
    d.mv = null;
    const x0 = b.x, x1 = first ? (b.x < G.W / 2 ? 92 : G.W - 92) : G.W - b.x, y0 = b.y;
    let flipped = false;
    sfx('whoosh');
    yield* tween(b, first ? 1.1 : 0.95, (u) => {
      const e = M.easeInOutSine(u);
      b.x = M.lerp(x0, x1, e); b.y = M.lerp(y0, b.homeY, e) + Math.sin(u * PI) * 42;
      if (d.ghost) { d.ghost.x = G.W - b.x; d.ghost.y = b.homeY - Math.sin(u * PI) * 24; }
      d.flipX = Math.max(0.07, Math.abs(Math.cos(u * PI))); // gira no próprio eixo
      if (u >= 0.5 && !flipped) { flipped = true; d.side ^= 1; G.burst(b.x, b.y, 14, { colors: [SIDE[d.side].main, '#ffffff'], speed: 180 }); }
    });
    d.flipX = 1;
    d.tx = b.x; d.ty = b.homeY;
    d.mv = cenHover;
  }
  function* cenP1(b) {
    const d = b.data;
    d.mv = cenSway; d.nHeads = 6;
    yield 0.8;
    let loop = 0;
    for (;;) {
      yield* cenHeads(b, 3);
      yield 0.7;
      yield* cenTomaLa(b);
      yield 0.9;
      yield* cenEmenda(b, 2);
      yield 1.4;
      yield* cenHeads(b, 2);
      yield 0.6;
      if (loop++ % 2 === 1) { yield* cenRings(b, 2); yield 0.6; }
      yield 0.6;
    }
  }
  function* cenP2(b) {
    const d = b.data;
    d.nHeads = 7; d.banner = 'SOMOS GOVERNO';
    // vira o casaco
    yield* tween(b, 0.8, (u) => { d.flipX = Math.max(0.07, Math.abs(Math.cos(u * TAU))); if (u > 0.25 && d.side === 0) { d.side = 1; G.burst(b.x, b.y, 16, { colors: [SIDE[1].main, SIDE[1].acc], speed: 200 }); } });
    d.flipX = 1;
    d.ghost = { x: G.W - b.x, y: b.y, a: 0 }; d.ghostBanner = d.banner;
    hint('reflexo', G.W / 2, G.H * 0.45, 'O REFLEXO NÃO LEVA DANO!', '#ffffff');
    yield* cenSwap(b, true);
    for (;;) {
      yield 0.4;
      yield* cenCurtain(b);
      yield 0.8;
      yield* cenHeads(b, 2, 120);
      yield 0.5;
      yield* cenEmenda(b, 1);
      yield 1.6;
      yield* cenSwap(b, false);
      yield 0.3;
      yield* cenHeads(b, 2, 120);
      yield 0.6;
      yield* cenTomaLa(b);
      yield 1.0;
      yield* cenSwap(b, false);
    }
  }
  function* cenP3(b) {
    const d = b.data;
    d.nHeads = 8; d.banner = 'BALCÃO ABERTO';
    // o reflexo volta pro corpo
    d.mv = null;
    const x0 = b.x, gx0 = d.ghost ? d.ghost.x : b.x;
    yield* tween(b, 0.9, (u) => {
      const e = M.easeInOutSine(u);
      b.x = M.lerp(x0, b.homeX, e); b.y = M.lerp(b.y, b.homeY, 0.2);
      if (d.ghost) { d.ghost.x = M.lerp(gx0, b.homeX, e); d.ghost.a = 1 - u; }
    });
    d.ghost = null; cenEvict(b); // (a cor do 3º turno já veio no onPhase: d.p3Side)
    say(b, 'VEM PRA BASE, PESSOAL!', 2.2);
    d.mv = cenSway; d.depOn = true; d.depT = 0.6;
    yield 1.2;
    let loop = 0;
    for (;;) {
      yield* cenRings(b, 2);
      yield 0.7;
      yield* cenHeads(b, 3, 122);
      yield 0.8;
      if (loop++ % 2 === 0) { yield* cenEmenda(b, 1); yield 1.2; }
      else { yield* cenTomaLa(b); yield 0.9; }
    }
  }
  function* cenP4(b) {
    const d = b.data;
    d.depOn = false; d.banner = 'BASE ALIADA';
    say(b, 'O CENTRÃO NUNCA CAI!', 2.4);
    d.mv = null; d.tx = b.homeX; d.ty = b.homeY + 10;
    d.mv = (bb, dd) => { dd.tx = bb.homeX + Math.sin(bb.ft * 0.4) * 30; dd.ty = bb.homeY + 12; };
    // as cabeças se soltam e giram em volta
    d.orbit = { ang: -PI / 2, R: 0, w: 1.2, dir: 1 };
    sfx('charge');
    yield* tween(b, 0.9, (u) => { d.orbit.R = M.easeOutBack(u) * 86; });
    let flipT = 0;
    for (;;) {
      // espiral: cada cabeça atira para fora
      for (let k = 0; k < 12; k++) {
        const nb = 8;
        for (let i = 0; i < nb; i++) {
          const a = d.orbit.ang + (i * TAU) / nb;
          const hx = b.x + Math.cos(a) * d.orbit.R, hy = b.y + Math.sin(a) * d.orbit.R;
          shoot(hx, hy, a, 108, { style: 'bs_171', color: i % 2 ? COL.pink : COL.magenta });
        }
        if (k % 4 === 0) sfx('enemy_shot');
        if (k % 6 === 3) { const a2 = aimFrom(b.x, b.y + 20); fan(b.x, b.y + 20, a2, 5, 0.5, 150, { style: 'bs_moeda', color: COL.gold }); d.mouthT = 0.3; }
        yield L2() ? 0.33 : 0.38;
      }
      // inverte o giro (com aviso)
      flipT++;
      for (let i = 0; i < 8; i++) d.warn[i] = 0.6;
      d.orbit.w = 0;
      sfx('charge');
      yield 0.65;
      d.orbit.dir *= -1; d.orbit.w = 1.2 + Math.min(0.4, flipT * 0.1);
    }
  }

  // ---------- sprites do Centrão: o que cada turno vai usar, pintado ANTES (fila, uma fatia por quadro) ----------
  const CEN_BAN = ['TOMA LÁ DÁ CÁ', 'SOMOS GOVERNO', 'BALCÃO ABERTO', 'BASE ALIADA']; // letreiro de cada turno
  function cenHpSt(hp) { return hp < 0.25 ? 2 : hp < 0.45 ? 1 : 0; } // igual ao drawCentrao
  function cenPlan(b) {
    const d = b.data, ph = b.state === 'fight' ? b.phase : 0, hp = b.hp / b.maxHp, s3 = d.p3Side;
    if (ph === 0) {
      cenBodyWant(0, true, 0, ''); caseWant(22, 'EMENDA'); cenBodyWant(0, false, 0, CEN_BAN[0]); caseWant(24, 'EMENDA');
      // começo do 2º turno: vira o casaco (lado 1), o reflexo aparece (lado 0) e a 1ª troca de lado
      cenBodyWant(1, false, 0, CEN_BAN[1]); cenGhostWant(0, 0, CEN_BAN[1]); cenBodyWant(0, false, 0, CEN_BAN[1]); cenGhostWant(1, 0, CEN_BAN[1]);
    } else if (ph === 1) {
      for (let st = cenHpSt(hp); st <= 1; st++) for (let sd = 0; sd < 2; sd++) { cenBodyWant(sd, false, st, CEN_BAN[1]); cenGhostWant(sd, st, CEN_BAN[1]); }
      if (hp < 0.5) cenBodyWant(s3, false, 1, CEN_BAN[2]);
    } else if (ph === 2) {
      if (d.ghost) cenGhostWant(s3 ^ 1, cenHpSt(hp), d.ghostBanner); // o reflexo voltando para o corpo
      cenBodyWant(s3, false, cenHpSt(hp), CEN_BAN[2]);
      if (hp < 0.34) cenBodyWant(s3, false, 2, CEN_BAN[2]);
      if (hp < 0.2) cenBodyWant(s3, false, 2, CEN_BAN[3]);
    } else cenBodyWant(s3, false, 2, CEN_BAN[3]);
  }
  // libera a memória do turno que passou: corpos com o letreiro de agora e do próximo; reflexo só enquanto existe
  function cenEvict(b) {
    const d = b.data, ph = b.phase;
    sprDrop((k) => {
      const p = k.split('|'), bi = CEN_BAN.indexOf(p[3]);
      if (p[0] === 'cen') return bi < ph || bi > ph + 1;
      if (p[0] === 'cenG') return ph > 1 && !d.ghost;
      return false;
    });
  }
  // durante o "ALERTA!" o core não chama nada do chefão: a fila anda por um timer (uma fatia a cada ~2 quadros)
  function sprWarm(b) {
    const tick = () => { const g = G.game; if (g && g.boss === b && b.state === 'warning' && sprStep()) setTimeout(tick, 30); };
    setTimeout(tick, 30);
  }
  // uma fatia por quadro (chamado no draw do chefão), fora dos quadros cheios de balas
  function sprPump(b, g) { if (sprQ.length && (b.state !== 'fight' || b.invulnT > 0 || g.eb.length < 120)) sprStep(); }

  const CEN_HB = [[0, -6, 46], [-46, 16, 28], [46, 16, 28], [0, 38, 30]];
  // todo (estilo, cor) que o Centrão atira (o reflexo usa violeta; as emendas estouram em laranja/violeta)
  const CEN_SHOTS = [['bs_171', COL.pink], ['bs_171', COL.violet], ['bs_171', COL.magenta], ['bs_moeda', COL.gold], ['bs_cedula', COL.orange], ['bs_cedula', COL.violet]];
  G.Bosses.define('centrao', {
    // fatStart menor: é o 1º chefão (ensina); com arma forte a luta acaba antes de ele cansar
    name: 'O CENTRÃO', title: 'Toma Lá, Dá Cá', hp: 3400, r: 46, homeY: 165, fatStart: 85,
    score: 120000, pix: 120, music: 'boss', defeatText: 'CASSADO!',
    phases: [
      { at: 1, name: 'Toma Lá, Dá Cá' },
      { at: 0.68, name: 'Muda de Lado' },
      { at: 0.38, name: 'Fisiologismo' },
      { at: 0.13, name: 'Base Aliada' },
    ],
    init(b) {
      const d = b.data;
      d.fx = []; d.side = 0; d.flipX = 1; d.nHeads = 6;
      d.pops = [0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0]; d.popT = d.pops.slice(); d.hold = [0, 0, 0, 0, 0, 0, 0, 0];
      d.hmood = ['smug', 'smug', 'smug', 'smug', 'smug', 'smug', 'smug', 'smug']; d.warn = [0, 0, 0, 0, 0, 0, 0, 0];
      d.armL = 0; d.armR = 0; d.armLT = 0; d.armRT = 0; d.sq = 0; d.sqT = 0; d.mouth = 0; d.mouthT = 0;
      d.holdCase = true; d.caseT = 0; d.tx = b.homeX; d.ty = b.homeY;
      d.ghost = null; d.orbit = null; d.banner = 'TOMA LÁ DÁ CÁ'; d.swapWarn = 0;
      d.depOn = false; d.depT = 0; d.depSide = 1;
      d.S = {}; d.GS = {}; d.ghostBanner = null; d.planT = 0;
      d.p3Side = Math.random() < 0.75 ? 0 : 1; // cor do 3º turno em diante (decidida já: os sprites saem antes)
      b.bubbleY = 72;
      b.hitboxes = CEN_HB.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      // sprites do 1º turno e do começo do 2º: pintados durante o aviso e a entrada
      sprReset(); cenPlan(b); sprWarm(b);
      // cabecinhas da 1ª fase (sorrisinho) e os tiros de todas as fases
      warmPeople(b, 'heads', CEN_HEADS.map((spec) => ({ spec, size: 34, mood: 'smug' })));
      warmShots(b, CEN_SHOTS);
    },
    updateEnter(b) { warmShotsStep(b, 1); },
    start(b) {
      warmShotsStep(b, 99);
      cenBodySprite(0, true, 0, ''); // sprite do flash (1º acerto)
      co(b, cenP1(b)); co(b, cenBg(b, 1.5), 1);
      say(b, 'TOMA LÁ, DÁ CÁ!', 2);
    },
    update(b, dt, g) {
      const d = b.data;
      updFx(b, dt);
      runCo(b, dt);
      fatigue(b, 'CANSEI DE APANHAR!');
      if (d.mv) { d.mv(b, d, dt); glide(b, dt, 2.6); }
      cenAnim(b, dt);
      if ((d.planT -= dt) <= 0) { d.planT = 0.4; cenPlan(b); }
      // deputadinhos (fase 3)
      if (d.depOn) {
        d.depT -= dt;
        let n = 0; for (const e of g.enemies) if (!e.dead && e.kind === 'bs_apoio') n++;
        if (d.depT <= 0 && n < 6) {
          d.depSide = -d.depSide;
          const x = d.depSide < 0 ? -14 : G.W + 14, y = M.rand(G.H * 0.36, G.H * 0.5);
          G.spawnEnemy('bs_apoio', x, y, { side: d.depSide, spd: L2() ? 58 : 50 });
          if (!d.depHint) { d.depHint = 1; hint('apoio', G.W / 2, G.H * 0.56, 'NÃO DEIXE O APOIO CHEGAR!'); }
          d.depT = L2() ? 1.9 : 2.5;
        }
      }
      // hitboxes acompanham as cabeças em órbita
      if (d.orbit) {
        if (b.hitboxes.length < 12) for (let i = 0; i < 8; i++) b.hitboxes.push({ dx: 0, dy: 0, r: 10 });
        for (let i = 0; i < 8; i++) { const a = d.orbit.ang + (i * TAU) / 8, h = b.hitboxes[4 + i]; h.dx = Math.cos(a) * d.orbit.R; h.dy = Math.sin(a) * d.orbit.R; }
      }
      // fumacinha quando está apanhando muito
      if (b.hp / b.maxHp < 0.25 && Math.random() < dt * 6 * decoK()) G.part({ x: b.x + M.rand(-40, 40), y: b.y - 30, vx: M.rand(-10, 10), vy: -40, type: 'smoke', size: 5, life: 0.8, color: 'rgba(80,80,90,0.45)', drag: 0.95 });
    },
    onPhase(b, idx) {
      const d = b.data;
      // letreiro novo já no 1º quadro do turno; libera os sprites do turno que passou e pede os que faltam
      d.banner = CEN_BAN[idx] || d.banner;
      if (idx === 2) d.side = d.p3Side;
      if (idx === 3) d.ghost = null;
      cenEvict(b); cenPlan(b); d.planT = 0.4;
      // próximas fases: cabecinhas suadas (HP < 66%) e os deputadinhos do apoio (fase 3, de gravata vermelha ou verde)
      if (idx === 1) {
        warmPeople(b, 'headsSw', CEN_HEADS_SW.map((spec) => ({ spec, size: 34, mood: 'smug' })));
        warmPeople(b, 'apoio', APOIO_SPECS.concat(APOIO_SPECS_G).map((spec) => ({ spec, size: 28, mood: 'laugh', pose: 'up' })));
      }
      for (let i = 0; i < 8; i++) { d.warn[i] = 0; d.hold[i] = 0; }
      d.armLT = 0; d.armRT = 0; d.flipX = 1; d.swapWarn = 0;
      if (idx === 1) { co(b, cenP2(b)); co(b, cenBg(b, 1.9), 1); }
      else if (idx === 2) { co(b, cenP3(b)); co(b, cenBg(b, 1.3), 1); }
      else if (idx === 3) { d.flipX = 1; co(b, cenP4(b)); co(b, null, 1); }
    },
    onHit(b) { b.data.sq = Math.max(b.data.sq, 0.02); },
    // chamado pelo deputadinho quando chega
    heal(b, e) {
      const d = b.data;
      const cap = b.maxHp * (b.phases[b.phase] ? b.phases[b.phase].at : 1);
      // cura pequena (≈ 37 HP no 1º mandato, 60 no 2º): não cresce junto com o HP do chefão, senão
      // ganharia da arma fraca (o jogador tem que derrubar o apoio, mas não precisa ser perfeito)
      const amt = b.maxHp * (L2() ? 0.014 : 0.011);
      b.hp = Math.min(cap, b.hp + amt);
      G.text(e.x, e.y - 18, '+APOIO', { color: G.C.greenL, size: 13, life: 1.1, vy: -30 });
      G.burst(e.x, e.y, 8, { colors: [G.C.greenL, '#ffffff'], speed: 120 });
      d.mouthT = 0.6; d.laughT = 0.8;
      sfx('item');
    },
    onDeath(b) {
      const d = b.data;
      stopCo(b); d.depOn = false; d.ghost = null; d.fx.length = 0;
      if (d.orbit) d.orbit.w = 0;
    },
    draw(ctx, b, g) {
      const d = b.data;
      sprPump(b, g);
      bubbleAt(b, 72);
      drawFx(ctx, b, 'under');
      const S = d.S, hpF = b.hp / b.maxHp;
      S.t = b.t; S.flash = G.isFlash(b); S.side = d.side; S.flipX = d.flipX; S.pops = d.pops; S.hmood = d.hmood; S.warn = d.warn;
      S.hp = b.state === 'dying' || b.state === 'leaving' ? 0.1 : hpF;
      S.mood = b.state === 'dying' ? 'hurt' : d.laughT > 0 || b.state === 'leaving' ? 'laugh' : b.invulnT > 0 ? 'angry' : 'smug';
      S.mouth = b.state === 'talk' ? 0.25 + 0.25 * Math.sin(b.t * 9) : d.mouth;
      S.look = lookAt(b.x, b.y); S.banner = d.banner; S.armL = d.armL; S.armR = d.armR; S.holdCase = d.holdCase; S.sq = d.sq;
      S.orbit = d.orbit; S.ghost = false; S.alpha = null;
      // aviso de troca de lado: pisca a cor
      if (d.swapWarn > 0 && ((b.t * 12) | 0) % 2) S.side = d.side ^ 1;
      if (d.ghost && d.ghost.a > 0.02 && b.state === 'fight') {
        const GS = d.GS;
        Object.assign(GS, S);
        GS.flash = false; GS.side = d.side ^ 1; GS.ghost = true; GS.banner = d.ghostBanner || S.banner; GS.alpha = 0.4 * d.ghost.a; GS.flipX = -S.flipX; GS.look = lookAt(d.ghost.x, d.ghost.y);
        drawCentrao(ctx, d.ghost.x, d.ghost.y, 1, GS);
      }
      if (b.state === 'leaving') balloons(ctx, b.x, b.y, b.t, Math.min(1, b.t / 0.6));
      drawCentrao(ctx, b.x, b.y, 1, S);
      drawFx(ctx, b, 'top');
    },
  });
  // animação (cabeças, braços, squash, maleta, reflexo)
  function cenAnim(b, dt) {
    const d = b.data;
    const vis = cenVisible(b);
    for (let i = 0; i < 8; i++) {
      if (d.hold[i] > 0) d.hold[i] -= dt;
      else { d.popT[i] = vis.indexOf(i) >= 0 ? 0.5 + 0.08 * Math.sin(b.ft * 2 + i) : 0; if (d.hmood[i] !== 'smug') d.hmood[i] = 'smug'; }
      if (d.warn[i] > 0) d.warn[i] -= dt;
      d.pops[i] = M.approach(d.pops[i], d.orbit ? 0 : d.popT[i], dt * 4.5);
    }
    d.armL = M.approach(d.armL, d.armLT, dt * 5);
    d.armR = M.approach(d.armR, d.armRT, dt * 5);
    if (d.sqT > 0) { d.sqT -= dt; d.sq = Math.max(d.sq, 0.06); }
    d.sq = M.approach(d.sq, 0, dt * 0.4);
    if (d.mouthT > 0) { d.mouthT -= dt; d.mouth = 0.5 + 0.4 * Math.sin(b.ft * 18); } else d.mouth = M.approach(d.mouth, 0, dt * 3);
    if (d.laughT > 0) d.laughT -= dt;
    if (d.swapWarn > 0) d.swapWarn -= dt;
    if (!d.holdCase) { d.caseT -= dt; if (d.caseT <= 0) d.holdCase = true; }
    if (d.ghost) { d.ghost.a = M.approach(d.ghost.a, 1, dt * 1.5); if (d.mv) { d.ghost.x = G.W - b.x; d.ghost.y = b.y; } }
    if (d.orbit) d.orbit.ang += d.orbit.w * d.orbit.dir * dt;
  }

  G.Portraits.define('centrao', function (ctx, x, y, size, o) {
    o = o || {};
    const t = o.t || 0, k = size / 150;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.clip();
    const mood = o.mood === 'angry' ? 'angry' : o.mood === 'hurt' ? 'hurt' : o.mood === 'laugh' ? 'laugh' : 'smug';
    const S = {
      t, side: 0, flipX: 1, pops: [0, 0.75, 0.9, 0.7, 0.85, 0.95, 0.7, 0],
      hmood: ['smug', 'laugh', 'smug', 'laugh', 'smug', 'laugh', 'smug', 'smug'], warn: null,
      mood, mouth: o.mouth || 0, look: [o.lookX != null ? o.lookX : -0.4, 0.15], hp: mood === 'hurt' ? 0.2 : 1,
      banner: 'TOMA LÁ DÁ CÁ', armL: 0.25, armR: mood === 'laugh' ? 0.8 : 0.35 + 0.1 * Math.sin(t * 3), holdCase: true, noShadow: true,
    };
    drawCentrao(ctx, x, y + size * 0.12, k * 1.35, S);
    ctx.restore();
  });

  // ======================================================================
  // 2) DILMÃE — a Estocadora de Vento
  // ======================================================================
  BS.define('bs_mandioca', { r: 6, size: 28, spin: 7, paint(x, s, c) {
    // raiz de mandioca girando (casca marrom, ponta cortada branca)
    glowOn(x, c, 8);
    x.beginPath(); x.moveTo(-s * 0.42, -s * 0.13); x.quadraticCurveTo(0, -s * 0.2, s * 0.46, 0); x.quadraticCurveTo(0, s * 0.2, -s * 0.42, s * 0.13); x.closePath();
    x.fillStyle = '#8a5a2b'; x.fill();
    x.shadowBlur = 0; x.lineWidth = 1.4; x.strokeStyle = '#101418'; x.stroke();
    x.strokeStyle = 'rgba(40,20,5,0.55)'; x.lineWidth = 1;
    x.beginPath(); for (let i = 0; i < 4; i++) { const xx = -s * 0.25 + i * s * 0.15; x.moveTo(xx, -s * 0.12); x.lineTo(xx + s * 0.03, s * 0.12); } x.stroke();
    x.beginPath(); x.ellipse(-s * 0.42, 0, s * 0.06, s * 0.13, 0, 0, TAU); x.fillStyle = '#fff6e0'; x.fill(); x.strokeStyle = c; x.lineWidth = 1.2; x.stroke();
  } });
  BS.define('bs_mandiocao', { r: 10, size: 46, spin: 3, paint(x, s, c) {
    glowOn(x, c, 12);
    x.beginPath(); x.moveTo(-s * 0.44, -s * 0.15); x.quadraticCurveTo(0, -s * 0.24, s * 0.47, 0); x.quadraticCurveTo(0, s * 0.24, -s * 0.44, s * 0.15); x.closePath();
    x.fillStyle = '#9a6430'; x.fill();
    x.shadowBlur = 0; x.lineWidth = 2; x.strokeStyle = '#101418'; x.stroke();
    x.strokeStyle = 'rgba(40,20,5,0.55)'; x.lineWidth = 1.4;
    x.beginPath(); for (let i = 0; i < 5; i++) { const xx = -s * 0.3 + i * s * 0.13; x.moveTo(xx, -s * 0.15); x.lineTo(xx + s * 0.04, s * 0.15); } x.stroke();
    x.beginPath(); x.ellipse(-s * 0.44, 0, s * 0.07, s * 0.15, 0, 0, TAU); x.fillStyle = '#fff6e0'; x.fill(); x.strokeStyle = c; x.lineWidth = 2; x.stroke();
  } });
  // semente/pedacinho de mandioca
  BS.define('bs_semente', { r: 3.2, size: 11, rotate: true, paint(x, s, c) {
    glowOn(x, c, 5); x.fillStyle = c; x.beginPath(); x.ellipse(0, 0, s * 0.46, s * 0.3, 0, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff6e0'; x.beginPath(); x.ellipse(s * 0.05, 0, s * 0.27, s * 0.15, 0, 0, TAU); x.fill();
  } });
  // redemoinho de vento estocado
  BS.define('bs_vento', { r: 4.6, size: 18, spin: -9, paint(x, s, c) {
    x.lineCap = 'round';
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.42, 0, TAU); x.fill();
    x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.lineWidth = s * 0.1;
    x.beginPath(); for (let i = 0; i <= 20; i++) { const a = i * 0.55, r = s * 0.04 + i * s * 0.017; const px = Math.cos(a) * r, py = Math.sin(a) * r; if (i === 0) x.moveTo(px, py); else x.lineTo(px, py); } x.stroke();
  } });
  // ficha "×2" da meta dobrada
  BS.define('bs_meta', { r: 5.4, size: 19, paint(x, s, c) {
    glowOn(x, c, 7); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.46, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, s * 0.34, 0, TAU); x.fill();
    x.fillStyle = c; x.font = '900 ' + (s * 0.4) + 'px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('×2', 0, s * 0.03, s * 0.62);
  } });

  const DILMA = { skin: '#efc3a0', hair: 'bob', hairColor: '#3b2618', browColor: '#3b2618', face: 'square', body: 'suit', suit: '#d62839', shirt: '#1d2433', seed: 21 };
  const DILMA_SW = Object.assign({}, DILMA, { sweat: true });
  const DIL_SIZE = 112, DIL_BIKE = 98;

  function mandiocaProp(c, x, y, len, rot, fl, glowT) {
    const C = (col) => (fl ? WHITE : col);
    c.save(); c.translate(x, y); c.rotate(rot);
    if (glowT > 0 && !fl) {
      c.globalAlpha = 0.35 + 0.3 * Math.sin(glowT * 30);
      c.fillStyle = '#fff1a8'; c.beginPath(); E(c, len * 0.45, 0, len * 0.7, len * 0.3); c.fill();
      c.globalAlpha = 1;
    }
    const w = len * 0.13;
    // raiz: ponta fina na mão, corpo comprido e meio torto, corte na outra ponta
    c.beginPath(); c.moveTo(-len * 0.12, 0);
    c.quadraticCurveTo(len * 0.08, -w * 1.1, len * 0.3, -w * 1.05); c.quadraticCurveTo(len * 0.65, -w * 0.85, len, -w * 1.05);
    c.lineTo(len, w * 1.05); c.quadraticCurveTo(len * 0.65, w * 1.25, len * 0.3, w * 1.0); c.quadraticCurveTo(len * 0.08, w * 1.1, -len * 0.12, 0);
    c.closePath();
    inked(c, C('#7a4a22'), 2);
    if (!fl) {
      c.fillStyle = 'rgba(255,220,170,0.22)'; c.beginPath(); E(c, len * 0.55, -w * 0.45, len * 0.38, w * 0.28); c.fill();
      c.strokeStyle = 'rgba(30,15,5,0.55)'; c.lineWidth = 1.1; c.beginPath();
      for (let i = 1; i < 6; i++) { const xx = len * 0.14 * i + 1; c.moveTo(xx, -w * 0.95); c.quadraticCurveTo(xx + 2, 0, xx - 1, w * 0.95); }
      c.stroke();
    }
    // corte: polpa branca com anel de casca
    c.beginPath(); E(c, len, 0, w * 0.5, w * 1.05); inked(c, C('#fff6e0'), 1.6);
    if (!fl) { c.strokeStyle = '#c79a5b'; c.lineWidth = 1.1; c.beginPath(); E(c, len, 0, w * 0.32, w * 0.75); c.stroke(); c.fillStyle = '#e8d4a8'; c.beginPath(); O(c, len, 0, w * 0.12); c.fill(); }
    c.restore();
  }
  function jarProp(c, x, y, open, t, fl, glow) {
    const C = (col) => (fl ? WHITE : col);
    c.save(); c.translate(x, y);
    const bob = Math.sin(t * 2.2 + x) * 2;
    c.translate(0, bob);
    if (open > 0.05) c.rotate(Math.sin(t * 30) * 0.06 * open);
    // vidro
    rr(c, -13, -14, 26, 30, 7);
    c.fillStyle = fl ? WHITE : 'rgba(190,232,255,0.42)'; c.fill();
    c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
    if (!fl) {
      // vento girando dentro
      c.save(); rr(c, -12, -13, 24, 28, 6); c.clip();
      c.strokeStyle = glow ? '#ffffff' : 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = t * (3 + i) + i * 2;
        c.beginPath(); c.arc(Math.cos(a) * 3, 2 + Math.sin(a * 1.3) * 4, 4 + i * 2.2, a, a + 3.6); c.stroke();
      }
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-9, -9, 3, 18);
      // rótulo
      c.fillStyle = '#f4f1e8'; c.fillRect(-11, 2, 22, 8);
      txt(c, 'VENTO', 0, 6.3, 5.4, '#1b3fa0', { maxW: 20 });
    }
    // tampa (sai voando quando abre)
    const ly = -17 - open * 14, lr = open * 0.9;
    c.save(); c.translate(open * 6, ly); c.rotate(lr);
    rr(c, -14, -3.5, 28, 7, 2); inked(c, C('#c9d3e6'), 1.8);
    c.restore();
    c.restore();
  }
  function metaBoard(c, x, y, n, pop, fl, glitch, t) {
    const C = (col) => (fl ? WHITE : col);
    c.save(); c.translate(x, y);
    // cavalete
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-14, 18); c.lineTo(-20, 44); c.moveTo(14, 18); c.lineTo(20, 44); c.moveTo(0, 18); c.lineTo(0, 46); c.stroke();
    c.strokeStyle = C('#9a6a3a'); c.lineWidth = 1.6; c.stroke();
    const sc = 1 + pop * 0.25;
    c.scale(sc, sc);
    rr(c, -27, -24, 54, 46, 4); inked(c, C('#ffffff'), 2.2);
    if (!fl) {
      c.fillStyle = '#e63946'; c.fillRect(-26, -23, 52, 11);
      txt(c, 'META', 0, -17.2, 8, '#ffffff');
      // setinha de gráfico subindo
      c.strokeStyle = 'rgba(0,166,81,0.55)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-21, 16); c.lineTo(-10, 8); c.lineTo(-2, 12); c.lineTo(18, -6); c.stroke();
      c.beginPath(); c.moveTo(18, -6); c.lineTo(12, -6); c.moveTo(18, -6); c.lineTo(18, 0); c.stroke();
      const s = glitch ? (((t * 14) | 0) % 2 ? '∞' : '64?!') : String(n);
      txt(c, s, 0, 4, s.length > 2 ? 14 : 20, glitch ? '#e63946' : INK, { maxW: 48 });
    }
    c.restore();
  }
  function bikeProp(c, dir, t, fl, part) {
    const C = (col) => (fl ? WHITE : col);
    const wr = 14, wy = 38;
    c.save(); c.scale(dir, 1);
    if (part === 'back') {
      for (const wx of [-26, 26]) {
        c.beginPath(); O(c, wx, wy, wr); c.lineWidth = 5; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = C('#2a2d36'); c.stroke();
        if (!fl) { c.strokeStyle = 'rgba(220,226,236,0.8)'; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 4; k++) { const a = t * 14 + (k * PI) / 4; c.moveTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); c.lineTo(wx - Math.cos(a) * wr, wy - Math.sin(a) * wr); } c.stroke(); }
      }
      // quadro
      c.beginPath(); c.moveTo(-26, wy); c.lineTo(-6, wy); c.lineTo(16, 18); c.lineTo(-10, 18); c.closePath(); c.moveTo(-6, wy); c.lineTo(-12, 14); c.moveTo(16, 18); c.lineTo(26, wy); c.moveTo(16, 18); c.lineTo(20, 6);
      c.lineWidth = 6; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = C('#e63946'); c.stroke();
      // pedal girando
      const pa = t * 10;
      c.beginPath(); c.moveTo(-6 + Math.cos(pa) * 7, wy + Math.sin(pa) * 7); c.lineTo(-6 - Math.cos(pa) * 7, wy - Math.sin(pa) * 7);
      c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    } else {
      // guidão + cestinha cheia de dinheiro
      c.beginPath(); c.moveTo(20, 6); c.lineTo(24, -2); c.lineTo(17, -4); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2; c.strokeStyle = C('#c9d3e6'); c.stroke();
      rr(c, 22, 2, 18, 12, 3); inked(c, C('#c8a165'), 1.6);
      if (!fl) {
        c.save(); c.translate(31, 1);
        for (let i = 0; i < 3; i++) { c.save(); c.rotate(-0.5 + i * 0.45 + Math.sin(t * 9 + i) * 0.08); c.fillStyle = i === 1 ? '#3ddc84' : '#ff9f1c'; c.fillRect(-3, -10, 6, 10); c.strokeStyle = INK; c.lineWidth = 0.8; c.strokeRect(-3, -10, 6, 10); c.restore(); }
        c.restore();
        c.strokeStyle = 'rgba(80,50,20,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(26, 4); c.lineTo(26, 13); c.moveTo(31, 4); c.lineTo(31, 13); c.moveTo(36, 4); c.lineTo(36, 13); c.stroke();
      }
    }
    c.restore();
  }
  /**
   * Desenha Dilmãe. S: {t, flash, pose, mood, mouth, look, hp, jar[2], jarGlow, board, bike, dir, raise, glowT, k, alpha, noProps}
   */
  function drawDilmae(c, x, y, S) {
    const fl = !!S.flash, t = S.t || 0, hp = S.hp != null ? S.hp : 1, k = S.k || 1;
    c.save(); c.translate(x, y); c.scale(k, k);
    if (S.alpha != null) c.globalAlpha *= S.alpha;
    c.lineJoin = 'round'; c.lineCap = 'round';
    const spec = hp < 0.6 ? DILMA_SW : DILMA;
    const lk = S.look || [0, 0.2];
    if (S.bike) {
      const dir = S.dir || 1, bob = Math.abs(Math.sin(t * 10)) * 1.5;
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(0, 56, 46, 6, 0, 0, TAU); c.fill();
      c.save(); c.translate(0, -bob);
      bikeProp(c, dir, t, fl, 'back');
      G.Art.person(c, -4 * dir, -6, DIL_BIKE, spec, { t, mood: S.mood, mouth: S.mouth, pose: 'drive', flash: fl, facing: dir, lookX: 0.9, lookY: lk[1], autoLook: false });
      bikeProp(c, dir, t, fl, 'front');
      c.restore();
    } else {
      const sz = DIL_SIZE, pose = S.pose || 'idle';
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(0, 58, 40, 7, 0, 0, TAU); c.fill();
      G.Art.person(c, 0, 0, sz, spec, { t, mood: S.mood, mouth: S.mouth, pose, flash: fl, lookX: lk[0], lookY: lk[1], autoLook: false });
      const s = sz / 100;
      // colar dourado
      if (!fl) { c.fillStyle = '#ffd23f'; c.beginPath(); for (let i = -3; i <= 3; i++) O(c, i * 2.7 * s, (11.5 + i * i * 0.3) * s, 1.25 * s); c.fill(); }
      // cabelo desgrenhado (dano)
      if (hp < 0.4 && !fl) {
        c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath();
        const hy = -14 * s - 27 * s;
        c.moveTo(-8 * s, hy + 2); c.lineTo(-14 * s, hy - 8); c.moveTo(2 * s, hy); c.lineTo(4 * s, hy - 10); c.moveTo(10 * s, hy + 2); c.lineTo(18 * s, hy - 6);
        c.stroke(); c.strokeStyle = '#3b2618'; c.lineWidth = 1.8; c.stroke();
      }
      if (hp < 0.3 && !fl) { rip(c, -15 * s, 28 * s, 12, 4, 0.4); rip(c, 14 * s, 34 * s, 10, 3.5, -0.5); }
      // mandioca na mão direita
      if (!S.noProps) {
        const h = hand(sz, pose, t, spec.seed, true, 1);
        let rot = 0.9;
        if (pose === 'up') rot = -PI / 2 - 0.15;
        else if (pose === 'point') rot = Math.atan2(lk[1] + 0.6, Math.max(0.2, lk[0] + 0.6));
        else if (pose === 'fist') rot = -1.2;
        mandiocaProp(c, h.x, h.y, 40, rot, fl, S.glowT || 0);
        if (pose === 'up' && !fl && S.glowT > 0) {
          for (let i = 0; i < 4; i++) { const a = t * 6 + (i * TAU) / 4; const sx = h.x + Math.cos(a) * 18, sy = h.y - 30 + Math.sin(a) * 10; c.fillStyle = '#fff1a8'; c.beginPath(); for (let j = 0; j < 8; j++) { const aa = (j * PI) / 4, r = j % 2 ? 1.2 : 4; c.lineTo(sx + Math.cos(aa) * r, sy + Math.sin(aa) * r); } c.closePath(); c.fill(); }
        }
      }
    }
    // potes de vento (fase 2) ou de enfeite
    if (!S.noProps && S.jar) {
      jarProp(c, -66, 16, S.jar[0], t, fl, S.jarGlow);
      jarProp(c, 66, 16, S.jar[1], t + 1.3, fl, S.jarGlow);
    }
    if (S.board) metaBoard(c, S.board.side * 82, -14, S.board.n, S.board.pop, fl, S.board.glitch, t);
    c.restore();
  }

  // posição da mão com a mandioca (tela)
  function dilHand(b) {
    const d = b.data, h = hand(DIL_SIZE, d.pose, b.t, DILMA.seed, true, 1);
    return [b.x + h.x, b.y + h.y];
  }
  // a mandioca que racha em sementes
  function splitMandioca(q) {
    if (q.t < q.data.split || q.dead) return;
    q.dead = true;
    const n = q.data.n || 8, big = q.style === 'bs_mandiocao';
    if (big) {
      ring(q.x, q.y, n, 98, { style: 'bs_semente', color: COL.hot, data: q.data.wnd ? { wnd: 1 } : null }, Math.random() * TAU);
      ring(q.x, q.y, n, 74, { style: 'bs_semente', color: COL.orange }, Math.random() * TAU);
      G.shake(3);
    } else ring(q.x, q.y, n, 92, { style: 'bs_semente', color: COL.hot, data: q.data.wnd ? { wnd: 1 } : null }, Math.random() * TAU);
    G.burst(q.x, q.y, big ? 14 : 7, { colors: ['#fff6e0', '#8a5a2b', '#ffd23f'], speed: big ? 200 : 140, life: 0.4 });
    sfx('split');
  }
  function* dilSaudacao(b, nOverride) {
    const d = b.data;
    d.pose = 'up'; d.glowT = 0.65; say(b, M.pick(['SAÚDO A MANDIOCA!', 'SAUDAÇÃO À MANDIOCA!']), 1.4); sfx('charge');
    yield 0.65;
    d.pose = 'point';
    const hp = dilHand(b), a = aimFrom(hp[0], hp[1]);
    const n = nOverride || (L2() ? 5 : 4);
    for (let k = 0; k < n; k++) {
      const ang = a + (k - (n - 1) / 2) * 0.42;
      shoot(hp[0], hp[1], ang, 138, { style: 'bs_mandioca', color: COL.orange, accel: -55, minSpd: 50, data: { split: 0.9 + k * 0.08, n: L2() ? 12 : 10, wnd: d.windy }, update: splitMandioca });
    }
    sfx('whoosh');
    yield 0.5;
    d.pose = 'idle';
  }
  function* dilMandiocao(b) {
    const d = b.data;
    d.pose = 'up'; d.glowT = 1.0; say(b, 'A MANDIOCA É NOSSA!', 1.6); sfx('charge');
    yield 0.95;
    d.pose = 'point';
    const hp = dilHand(b);
    shoot(hp[0], hp[1], aimFrom(hp[0], hp[1]), 110, { style: 'bs_mandiocao', color: COL.red, accel: -45, minSpd: 35, data: { split: 1.4, n: L2() ? 22 : 18 }, update: splitMandioca });
    sfx('whoosh');
    yield 0.6;
    d.pose = 'idle';
  }
  // varredura de sementes (com frestas)
  function* dilRaizes(b) {
    const d = b.data;
    d.pose = 'fist'; sfx('charge');
    yield 0.45;
    d.pose = 'point';
    const dir = Math.random() < 0.5 ? 1 : -1, n = 26;
    for (let i = 0; i < n; i++) {
      if (i % 6 !== 5) {
        const a = DOWN + dir * (1.2 - (2.4 * i) / (n - 1));
        shoot(b.x, b.y + 16, a, 128, { style: 'bs_semente', color: COL.hot });
        shoot(b.x, b.y + 16, a + 0.06, 102, { style: 'bs_semente', color: COL.orange });
        shoot(b.x, b.y + 16, a + 0.12, 80, { style: 'bs_semente', color: COL.hot });
      }
      if (i % 3 === 0) sfx('enemy_shot');
      yield 0.065;
    }
    d.pose = 'idle';
  }
  // pressão de fundo: um pote arrota um leque de vento mirado
  function* dilBgJars(b, every) {
    const d = b.data;
    for (;;) {
      yield every * M.rand(0.85, 1.15);
      const side = Math.random() < 0.5 ? 0 : 1;
      d.jarT[side] = 0.6;
      yield 0.32;
      const jx = b.x + (side ? 66 : -66), jy = b.y + 16;
      fan(jx, jy, aimFrom(jx, jy), 3, 0.32, 120, { style: 'bs_vento', color: COL.magenta });
      sfx('enemy_shot');
      yield 0.3;
      d.jarT[side] = 0;
    }
  }
  // fase 3: sementinhas miradas da mão
  function* dilBgSeeds(b, every) {
    for (;;) {
      yield every * M.rand(0.85, 1.15);
      const hp = dilHand(b);
      fan(hp[0], hp[1], aimFrom(hp[0], hp[1]), 3, 0.22, 150, { style: 'bs_semente', color: COL.orange });
      sfx('enemy_shot');
    }
  }
  // rajada de vento: aviso de 1 s, depois empurra o Zé e entorta os tiros
  function* dilGust(b, dir, dur) {
    const d = b.data, W = d.wind;
    const jar = dir > 0 ? 0 : 1; // o pote do lado de onde vem o vento abre
    W.dir = dir; W.warn = 1.0;
    d.jarT[jar] = 1; d.pose = 'shrug';
    say(b, M.pick(['ESTOQUEI O VENTO!', 'É O VENTO, QUERIDO!', 'SEGURA ESSE VENTO!']), 1.6);
    sfx('wind');
    yield 1.0;
    W.target = L2() ? 72 : 60; // empurrão suave: dá pra segurar com o dedão
    sfx('wind');
    const t0 = b.ft, jy = b.y + 16;
    let i = 0;
    while (b.ft - t0 < dur) {
      const a = DOWN + dir * 0.2 + M.rand(-0.55, 0.55);
      shoot(b.x + (jar ? 66 : -66), jy, a, M.rand(100, 132), { style: 'bs_vento', color: i % 2 ? COL.violet : COL.magenta, data: { wnd: 1 } });
      if (i % 5 === 0) { const hp = dilHand(b); fan(hp[0], hp[1], aimFrom(hp[0], hp[1]), 3, 0.25, 128, { style: 'bs_semente', color: COL.hot, data: { wnd: 1 } }); }
      i++;
      yield L2() ? 0.1 : 0.12;
    }
    W.target = 0; d.jarT[jar] = 0; d.pose = 'idle';
  }
  // redemoinho entre as rajadas
  function* dilRedemoinho(b) {
    const d = b.data;
    d.pose = 'up'; d.jarT[0] = d.jarT[1] = 0.4; sfx('charge');
    yield 0.5;
    const arms = L2() ? 5 : 4, dirr = Math.random() < 0.5 ? 1 : -1;
    for (let k = 0; k < 18; k++) {
      for (let a = 0; a < arms; a++) shoot(b.x, b.y + 4, dirr * k * 0.2 + (a * TAU) / arms, 106, { style: 'bs_vento', color: COL.magenta, data: { wnd: 1 } });
      if (k % 4 === 0) sfx('enemy_shot');
      yield 0.1;
    }
    d.pose = 'idle'; d.jarT[0] = d.jarT[1] = 0;
  }
  // META: cada rajada tem exatamente META tiros, e a meta dobra
  function* dilMetaVolley(b, m) {
    const d = b.data, x = b.x, y = b.y + 10, o = { style: 'bs_meta', color: m >= 16 ? COL.red : COL.pink };
    d.pose = 'point';
    if (m <= 2) fan(x, y, aimFrom(x, y), 2, 0.3, 140, o);
    else if (m === 4) fan(x, y, aimFrom(x, y), 4, 0.6, 135, o);
    else if (m === 8) ring(x, y, 8, 118, o, aimFrom(x, y));
    else if (m >= 64) {
      // dobrou a meta de verdade: 64 tiros em dois anéis
      const a0 = Math.random() * TAU;
      ring(x, y, 32, 104, { style: 'bs_meta', color: COL.red }, a0);
      sfx('enemy_shot2');
      yield 0.35;
      ring(b.x, b.y + 10, 32, 84, { style: 'bs_meta', color: COL.magenta }, a0 + PI / 32);
    }
    else if (m === 16) {
      const dirr = Math.random() < 0.5 ? 1 : -1, a0 = aimFrom(x, y);
      for (let i = 0; i < 16; i++) { shoot(b.x, b.y + 10, a0 + dirr * (i * TAU) / 16, 100, o); if (i % 4 === 0) sfx('enemy_shot'); yield 0.05; }
    } else {
      const a0 = Math.random() * TAU;
      for (let i = 0; i < 16; i++) {
        shoot(b.x, b.y + 10, a0 + (i * TAU) / 16, 96, o);
        shoot(b.x, b.y + 10, a0 - (i * TAU) / 16 + 0.1, 80, { style: 'bs_meta', color: COL.magenta });
        if (i % 4 === 0) sfx('enemy_shot');
        yield 0.06;
      }
    }
    sfx('enemy_shot2');
    yield 0.25;
    d.pose = 'idle';
  }
  function* dilMetaCycle(b) {
    const d = b.data, B = d.board;
    for (let m = 2; m <= 32; m *= 2) {
      B.n = m; B.pop = 1; B.glitch = false;
      sfx('stamp'); d.mouthT = 0.4;
      if (m >= 16) say(b, 'META: ' + m + '!', 1.0);
      yield 0.75;
      yield* dilMetaVolley(b, m);
      yield m >= 16 ? 1.1 : 0.75;
      if (m === 8) { yield* dilSaudacao(b, 2); yield 0.5; }
    }
    // atingiu a meta? dobra!
    B.glitch = true; B.pop = 1;
    say(b, 'ATINGIU? DOBRA A META!', 2.2);
    sfx('laugh');
    yield 1.1;
    B.glitch = false; B.n = 64; B.pop = 1; sfx('stamp');
    yield 0.5;
    yield* dilMetaVolley(b, 64);
    yield 1.3;
    G.confetti(b.x + B.side * 82, b.y - 14, 10);
    B.n = 2; B.pop = 1;
    yield 0.8;
  }
  // PEDALADA: atravessa a tela de bicicleta deixando chuva de notas
  function* dilDash(b, dir, y) {
    const d = b.data;
    // aparece na borda e avisa
    const edge = dir > 0 ? 40 : G.W - 40;
    d.dir = dir;
    fx(b, { kind: 'row', y: y + 24, dir, life: 0.95, label: 'PEDALADA!', color: COL.red, h: 34, layer: 'under' });
    sfx('charge');
    const sx = b.x, sy = b.y;
    yield* tween(b, 0.4, (u) => { const e = M.easeOutCubic(u); b.x = M.lerp(sx, edge, e); b.y = M.lerp(sy, y, e); });
    yield 0.55;
    sfx('dash');
    const x0 = b.x, x1 = dir > 0 ? G.W + 60 : -60, T = Math.abs(x1 - x0) / (L2() ? 430 : 385);
    // frestas garantidas na chuva
    const gaps = [M.rand(60, G.W / 2 - 30), M.rand(G.W / 2 + 30, G.W - 60)];
    let lastX = x0;
    yield* tween(b, T, (u) => {
      b.x = M.lerp(x0, x1, u);
      if (Math.abs(b.x - lastX) >= 19 && b.x > 8 && b.x < G.W - 8) {
        lastX = b.x;
        if (Math.abs(b.x - gaps[0]) > 30 && Math.abs(b.x - gaps[1]) > 30) {
          if (Math.random() < 0.45) shoot(b.x + M.rand(-6, 6), b.y + 20, DOWN + M.rand(-0.4, 0.4), M.rand(80, 110), {
            style: 'bs_cedula', color: COL.red, ay: 40, data: { ph: Math.random() * TAU, sw: M.rand(10, 20) },
            update(q) { if (q.vy > 165) q.vy = 165; q.vx = Math.sin(q.t * 3.5 + q.data.ph) * q.data.sw; },
          });
          shoot(b.x + M.rand(-4, 4), b.y + 26, DOWN + M.rand(-0.3, 0.3), M.rand(28, 70), {
            style: 'bs_cedula', color: Math.random() < 0.5 ? COL.orange : COL.red, ay: M.rand(60, 90), data: { ph: Math.random() * TAU, sw: M.rand(18, 34) },
            update(q) { if (q.vy > 150) q.vy = 150; q.vx = Math.sin(q.t * 3.5 + q.data.ph) * q.data.sw; },
          });
        }
      }
    });
    // dá a volta por fora (fica fora da tela só um instante)
    b.x = dir > 0 ? -60 : G.W + 60;
  }
  function* dilPausa(b) {
    // pausa fiscal: para num canto e joga mandioca (janela boa pra bater)
    const d = b.data, dir = b.x < 0 ? 1 : -1;
    d.dir = dir;
    const tx = dir > 0 ? G.W * 0.28 : G.W * 0.72, sx = b.x, sy = b.y;
    yield* tween(b, 0.6, (u) => { const e = M.easeOutCubic(u); b.x = M.lerp(sx, tx, e); b.y = M.lerp(sy, b.homeY, e); });
    say(b, M.pick(['NÃO FOI PEDALADA!', 'É CONTABILIDADE CRIATIVA!', 'PEDALEI NA META!']), 1.6);
    for (let k = 0; k < 3; k++) {
      d.glowT = 0.4; sfx('charge');
      yield 0.45;
      const a = aimFrom(b.x, b.y);
      fan(b.x + 20 * dir, b.y - 4, a, L2() ? 3 : 2, 0.5, 130, { style: 'bs_mandioca', color: COL.orange, accel: -55, minSpd: 50, data: { split: 0.9, n: 7 }, update: splitMandioca });
      sfx('whoosh');
      yield 0.6;
    }
    yield 0.4;
    // sai pelo outro lado
    const x0 = b.x, x1 = dir > 0 ? G.W + 60 : -60;
    d.dir = dir;
    yield* tween(b, 0.55, (u) => { b.x = M.lerp(x0, x1, M.easeInCubic(u)); });
    b.x = dir > 0 ? -60 : G.W + 60;
  }

  function* dilP1(b) {
    const d = b.data;
    d.mv = (bb, dd) => { dd.tx = bb.homeX + Math.sin(bb.ft * 0.5) * 70; dd.ty = bb.homeY + Math.sin(bb.ft * 0.9) * 10; };
    yield 0.7;
    for (;;) {
      yield* dilSaudacao(b);
      yield 0.9;
      yield* dilSaudacao(b);
      yield 0.7;
      yield* dilRaizes(b);
      yield 1.0;
      yield* dilMandiocao(b);
      yield 1.5;
    }
  }
  function* dilP2(b) {
    const d = b.data;
    d.windy = true;
    d.jarGlow = true;
    say(b, 'EU ESTOQUEI O VENTO!', 2.2);
    d.mv = (bb, dd) => { dd.tx = bb.homeX + Math.sin(bb.ft * 0.35) * 40; dd.ty = bb.homeY; };
    hint('vento', G.W / 2, G.H * 0.66, 'ARRASTE CONTRA O VENTO!', '#ffffff');
    yield 1.0;
    let dir = pl().x < G.W / 2 ? -1 : 1; // empurra pro lado mais perto da parede
    for (;;) {
      yield* dilGust(b, dir, 2.5);
      yield 0.6;
      yield* dilRedemoinho(b);
      yield 0.6;
      yield* dilSaudacao(b);
      yield 0.8;
      dir = -dir;
    }
  }
  function* dilP3(b) {
    const d = b.data;
    d.windy = false; d.wind.target = 0; d.jarT[0] = d.jarT[1] = 0;
    d.mv = (bb, dd) => { dd.tx = bb.homeX + Math.sin(bb.ft * 0.3) * 30; dd.ty = bb.homeY; };
    d.board = { n: 2, pop: 1, side: 1, glitch: false };
    G.text(G.W / 2, G.H * 0.47, '"QUANDO ATINGIR A META,', { color: '#ffffff', size: 12, life: 2.8, vy: -6 });
    G.text(G.W / 2, G.H * 0.47 + 17, 'DOBRAMOS A META!"', { color: G.C.yellow, size: 12, life: 2.8, vy: -6 });
    say(b, 'NÃO VAMOS TER META!', 2);
    yield 1.6;
    for (;;) yield* dilMetaCycle(b);
  }
  function* dilP4(b) {
    const d = b.data;
    d.board = null; d.mv = null;
    d.bike = true; d.pose = 'drive';
    say(b, 'PEDALADA FISCAL!', 1.8);
    sfx('dash');
    yield 0.9;
    const rows = [134, 184, 234];
    let dir = b.x < G.W / 2 ? 1 : -1, r = 0;
    // sai pelo lado mais perto
    const x0 = b.x, x1 = dir > 0 ? -60 : G.W + 60;
    d.dir = -dir;
    yield* tween(b, 0.5, (u) => { b.x = M.lerp(x0, x1, M.easeInCubic(u)); });
    for (;;) {
      for (let k = 0; k < 2; k++) {
        const y = Math.min(rows[r++ % 3], G.H * 0.33);
        yield* dilDash(b, dir, y);
        dir = -dir;
        yield 0.15;
      }
      yield* dilPausa(b);
      dir = b.x < 0 ? 1 : -1;
      yield 0.1;
    }
  }

  const DIL_HB = [[0, -16, 30], [0, 24, 25]], DIL_HB_BIKE = [[0, -26, 26], [0, 10, 22], [-26, 38, 16], [26, 38, 16]];
  const DIL_SHOTS = [['bs_semente', COL.hot], ['bs_semente', COL.orange], ['bs_mandioca', COL.orange], ['bs_mandiocao', COL.red],
    ['bs_vento', COL.magenta], ['bs_vento', COL.violet], ['bs_meta', COL.pink], ['bs_meta', COL.red], ['bs_meta', COL.magenta],
    ['bs_cedula', COL.red], ['bs_cedula', COL.orange]];
  G.Bosses.define('dilmae', {
    name: 'DILMÃE', title: 'A Estocadora de Vento', hp: 3600, r: 40, homeY: 168, spdK: 1.06,
    score: 160000, pix: 150, music: 'boss', defeatText: 'IMPEACHMENT!',
    phases: [
      { at: 1, name: 'Saudação à Mandioca' },
      { at: 0.72, name: 'Vento Estocado' },
      { at: 0.45, name: 'Meta Dobrada' },
      { at: 0.18, name: 'Pedalada Fiscal' },
    ],
    init(b) {
      const d = b.data;
      sprReset(); // libera os sprites do Centrão
      d.fx = []; d.pose = 'idle'; d.glowT = 0; d.mouth = 0; d.mouthT = 0;
      d.jar = [0, 0]; d.jarT = [0, 0]; d.jarGlow = false; d.windy = false;
      d.wind = { dir: 1, str: 0, target: 0, warn: 0 };
      d.board = null; d.bike = false; d.dir = 1;
      d.tx = b.homeX; d.ty = b.homeY; d.S = {};
      b.hitboxes = DIL_HB.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      warmPeople(b, 'p1', poses(DILMA, DIL_SIZE, ['idle', 'up', 'point', 'fist']));
      warmShots(b, DIL_SHOTS);
    },
    updateEnter(b) { warmShotsStep(b, 1); },
    start(b) { warmShotsStep(b, 99); co(b, dilP1(b)); co(b, dilBgJars(b, 1.7), 1); say(b, 'SAÚDO A MANDIOCA!', 1.8); },
    update(b, dt, g) {
      const d = b.data;
      updFx(b, dt);
      runCo(b, dt);
      fatigue(b, 'CANSEI. VOU ESTOCAR AR.');
      if (d.mv) { d.mv(b, d, dt); glide(b, dt, 2.4); }
      if (d.glowT > 0) d.glowT -= dt;
      if (d.mouthT > 0) { d.mouthT -= dt; d.mouth = 0.5 + 0.4 * Math.sin(b.ft * 18); } else d.mouth = M.approach(d.mouth, b.sayT > 0 ? 0.5 + 0.4 * Math.sin(b.ft * 16) : 0, dt * 4);
      for (let i = 0; i < 2; i++) d.jar[i] = M.approach(d.jar[i], d.jarT[i], dt * 3);
      if (d.board) d.board.pop = M.approach(d.board.pop, 0, dt * 3), d.board.side = b.x > G.W / 2 ? -1 : 1;
      // vento: empurra o Zé (e o ponto de ancoragem do dedo) e entorta os tiros marcados
      const W = d.wind;
      if (W.warn > 0) W.warn -= dt;
      W.str = M.approach(W.str, W.target, dt * 110);
      if (W.str > 0.5) {
        const p = g.player;
        if (p.alive && !p.entering) {
          const nx = clamp(p.x + W.dir * W.str * dt, 12, G.W - 12), dx = nx - p.x;
          p.x = nx; p.tx = clamp(p.tx + dx, 12, G.W - 12);
          if (G.input && G.input.active) G.input.ax += dx;
        }
        const acc = W.dir * W.str * 1.3 * dt;
        for (const q of g.eb) if (!q.dead && q.data && q.data.wnd) { q.vx = clamp(q.vx + acc, -170, 170); }
        if (Math.random() < dt * (12 + 18 * decoK())) G.part({ x: W.dir > 0 ? -10 : G.W + 10, y: M.rand(70, G.H - 40), vx: W.dir * M.rand(380, 560), vy: M.rand(-20, 20), type: 'spark', size: 2, life: 0.9, color: 'rgba(255,255,255,0.55)', drag: 1 });
      }
      // hitboxes por pose
      const hb = d.bike ? DIL_HB_BIKE : DIL_HB;
      if (b.hitboxes.length !== hb.length) b.hitboxes = hb.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      if (b.hp / b.maxHp < 0.2 && Math.random() < dt * 5 * decoK()) G.part({ x: b.x + M.rand(-20, 20), y: b.y - 40, vx: M.rand(-10, 10), vy: -35, type: 'smoke', size: 4, life: 0.7, color: 'rgba(80,80,90,0.4)', drag: 0.95 });
    },
    onPhase(b, idx) {
      const d = b.data;
      d.pose = 'idle'; d.glowT = 0;
      // o que vem a seguir: suada (HP < 60%) e, na pedalada, de bicicleta
      if (idx === 1) warmPeople(b, 'p2', poses(DILMA, DIL_SIZE, ['shrug']).concat(poses(DILMA_SW, DIL_SIZE, ['idle', 'up', 'point', 'shrug'])));
      if (idx === 2) warmPeople(b, 'p4', poses(DILMA_SW, DIL_BIKE, ['drive']));
      if (idx >= 2) { d.wind.target = 0; d.windy = false; }
      d.jarT[0] = d.jarT[1] = 0;
      if (idx === 1) { co(b, dilP2(b)); co(b, null, 1); }
      else if (idx === 2) { co(b, dilP3(b)); co(b, dilBgSeeds(b, 1.7), 1); }
      else if (idx === 3) { co(b, dilP4(b)); co(b, null, 1); }
    },
    onDeath(b) {
      const d = b.data;
      stopCo(b); d.wind.target = 0; d.wind.str = 0; d.fx.length = 0;
      if (b.x < 30 || b.x > G.W - 30) b.x = clamp(b.x, 60, G.W - 60);
      if (b.y < 90) b.y = 120;
    },
    draw(ctx, b) {
      const d = b.data;
      bubbleAt(b, 66);
      drawFx(ctx, b, 'under');
      // aviso e rastros do vento
      const W = d.wind;
      if (W.warn > 0) windArrow(ctx, W.dir, b.t);
      if (W.str > 1) windStreaks(ctx, W.dir, W.str, b.t);
      const S = d.S, hpF = b.hp / b.maxHp;
      const dying = b.state === 'dying', leaving = b.state === 'leaving';
      S.t = b.t; S.flash = G.isFlash(b); S.hp = dying || leaving ? 0.15 : hpF;
      S.mood = dying ? 'hurt' : leaving ? 'laugh' : b.invulnT > 0 ? 'angry' : d.pose === 'up' ? 'laugh' : hpF < 0.3 ? 'angry' : 'smug';
      S.mouth = b.state === 'talk' ? 0.3 + 0.3 * Math.sin(b.t * 10) : d.mouth;
      S.pose = dying ? 'shrug' : d.pose; S.look = lookAt(b.x, b.y);
      S.jar = b.phase <= 1 && !d.bike ? d.jar : null; S.jarGlow = d.jarGlow; S.board = dying || leaving ? null : d.board;
      S.bike = d.bike || leaving; S.dir = leaving ? 1 : d.dir; S.glowT = d.glowT; S.k = 1;
      if (leaving) {
        // foge voando de bicicleta (como no filme)
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-0.25);
        drawDilmae(ctx, 0, 0, S);
        ctx.restore();
      } else drawDilmae(ctx, b.x, b.y, S);
      drawFx(ctx, b, 'top');
    },
  });
  // seta de aviso do vento (1 s antes da rajada)
  function windArrow(c, dir, t) {
    const a = 0.45 + 0.4 * Math.abs(Math.sin(t * 12));
    c.save();
    c.globalAlpha = a;
    const y = G.H * 0.56, cx = G.W / 2;
    c.translate(cx, y); c.scale(dir, 1);
    c.beginPath();
    c.moveTo(-70, -12); c.lineTo(30, -12); c.lineTo(30, -30); c.lineTo(78, 0); c.lineTo(30, 30); c.lineTo(30, 12); c.lineTo(-70, 12); c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fill();
    c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.stroke();
    c.restore();
    c.save(); c.globalAlpha = Math.min(1, a + 0.3);
    txt(c, 'VENTO!', cx - dir * 6, y + 1, 15, '#ffffff', { stroke: 4 });
    c.restore();
  }
  // traços de vento atravessando a tela
  function windStreaks(c, dir, str, t) {
    c.save();
    c.globalAlpha = clamp(str / 90, 0, 1) * 0.55;
    c.strokeStyle = '#e8f6ff'; c.lineWidth = 1.6; c.lineCap = 'round';
    c.beginPath();
    const W = G.W + 240;
    for (let i = 0; i < 26; i++) {
      const y = 60 + ((i * 61.7) % (G.H - 90));
      const spd = 420 + (i % 5) * 70;
      let x = ((t * spd + i * 137) % W) - 120;
      if (dir < 0) x = G.W - x;
      const len = 26 + (i % 4) * 14;
      c.moveTo(x, y); c.lineTo(x - dir * len, y);
      c.moveTo(x - dir * len * 0.4, y + 4); c.lineTo(x - dir * len * 0.9, y + 4);
    }
    c.stroke();
    c.restore();
  }

  G.Portraits.define('dilmae', function (ctx, x, y, size, o) {
    o = o || {};
    const t = o.t || 0, k = size / 100;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.clip();
    const mood = o.mood || 'smug';
    const S = {
      t, flash: false, pose: mood === 'angry' ? 'fist' : mood === 'laugh' ? 'up' : 'idle', mood, mouth: o.mouth || 0,
      look: [o.lookX != null ? o.lookX : -0.35, 0.1], hp: mood === 'hurt' ? 0.2 : 1, jar: [0, 0], jarGlow: false, board: null, bike: false,
      glowT: mood === 'laugh' ? 1 : 0, k: k * 1.25,
    };
    drawDilmae(ctx, x, y + size * 0.24, S);
    ctx.restore();
  });

  // ======================================================================
  // 3) CAPITÃO BOLSONÁRIO — o Mito da Motociata
  // ======================================================================
  // fumaça do escapamento (com brasa no meio para ler como perigo)
  BS.define('bs_fumaca', { r: 5.5, size: 22, spin: 1.5, paint(x, s, c) {
    glowOn(x, c, 7);
    x.fillStyle = '#4a4e58';
    x.beginPath(); x.arc(-s * 0.14, s * 0.05, s * 0.28, 0, TAU); x.arc(s * 0.16, -s * 0.06, s * 0.27, 0, TAU); x.arc(0, s * 0.17, s * 0.25, 0, TAU); x.fill();
    x.shadowBlur = 0;
    x.fillStyle = '#6b707c'; x.beginPath(); x.arc(-s * 0.18, -s * 0.04, s * 0.13, 0, TAU); x.fill();
    x.fillStyle = c; x.beginPath(); x.arc(s * 0.02, s * 0.04, s * 0.15, 0, TAU); x.fill();
    x.fillStyle = '#fff3d0'; x.beginPath(); x.arc(s * 0.02, s * 0.04, s * 0.07, 0, TAU); x.fill();
  } });
  // gota grudenta de leite condensado
  BS.define('bs_leite', { r: 5, size: 17, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.45, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff4dc';
    x.beginPath(); x.arc(0, 0, s * 0.34, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(-s * 0.1, -s * 0.11, s * 0.1, 0, TAU); x.fill();
  } });
  // documento sigiloso (papel com tarjas pretas)
  BS.define('bs_sigilo', { r: 5, size: 19, spin: 4, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = '#ffffff'; x.fillRect(-s * 0.32, -s * 0.42, s * 0.64, s * 0.84);
    x.shadowBlur = 0; x.fillStyle = '#101418';
    x.fillRect(-s * 0.24, -s * 0.3, s * 0.48, s * 0.1); x.fillRect(-s * 0.24, -s * 0.12, s * 0.36, s * 0.1); x.fillRect(-s * 0.24, s * 0.06, s * 0.48, s * 0.1);
    x.fillStyle = c; x.fillRect(-s * 0.32, s * 0.24, s * 0.64, s * 0.1);
  } });
  // gota d'água do jet ski (aponta na direção do movimento)
  BS.define('bs_gota', { r: 4, size: 16, rotate: true, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c;
    x.beginPath(); x.moveTo(s * 0.46, 0); x.quadraticCurveTo(0, -s * 0.3, -s * 0.3, 0); x.quadraticCurveTo(0, s * 0.3, s * 0.46, 0); x.fill();
    x.beginPath(); x.arc(-s * 0.12, 0, s * 0.26, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.beginPath(); x.arc(-s * 0.1, 0, s * 0.14, 0, TAU); x.fill();
  } });
  // onda de choque do "TALKEY?" / "MIMIMI!" (arco virado para fora)
  BS.define('bs_talkey', { r: 4.5, size: 18, rotate: true, paint(x, s, c) {
    x.lineCap = 'round';
    glowOn(x, c, 7); x.strokeStyle = c; x.lineWidth = s * 0.3;
    x.beginPath(); x.arc(-s * 0.3, 0, s * 0.5, -0.85, 0.85); x.stroke();
    x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.lineWidth = s * 0.11; x.stroke();
  } });

  const BOLSO = { skin: '#f0c6a0', hair: 'side', hairColor: '#2a2420', templeColor: '#a9adb3', browColor: '#2a2420', brows: 'angry', face: 'square', body: 'shirt', shirt: '#ffffff', sash: ['#00a651', '#ffd23f'], seed: 41 };
  const BOLSO_SPECS = {};
  function bolSpec(helmet, sweat) {
    const k = (helmet ? 'h' : '') + (sweat ? 's' : '');
    return BOLSO_SPECS[k] || (BOLSO_SPECS[k] = Object.assign({}, BOLSO, helmet ? { hat: 'helmet', hatColor: '#11823f' } : null, sweat ? { sweat: true } : null));
  }
  const BOL_SIZE = 84;

  // moto (vista de lado; part 'back' = atrás do piloto, 'front' = na frente)
  function motoProp(c, t, fl, part, hp) {
    const C = (col) => (fl ? WHITE : col);
    const wr = 14;
    if (part === 'back') {
      // bandeira tremulando no bagageiro
      c.strokeStyle = INK; c.lineWidth = 3.2; c.beginPath(); c.moveTo(-36, 14); c.lineTo(-42, -40); c.stroke();
      c.strokeStyle = C('#c9d3e6'); c.lineWidth = 1.6; c.stroke();
      const w = Math.sin(t * 12) * 3;
      c.beginPath(); c.moveTo(-42, -40); c.quadraticCurveTo(-53, -43 + w, -66, -39 - w); c.lineTo(-65, -24 - w); c.quadraticCurveTo(-53, -27 + w, -41, -25); c.closePath();
      inked(c, C('#00a651'), 1.5);
      if (!fl) {
        c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(-45, -32.5); c.lineTo(-53.5, -38 + w * 0.5); c.lineTo(-62, -32 - w * 0.5); c.lineTo(-53.5, -27 + w * 0.5); c.closePath(); c.fill();
        c.fillStyle = '#1b3fa0'; c.beginPath(); O(c, -53.5, -32.5 + w * 0.1, 3.3); c.fill();
      }
      // rodas
      for (const wx of [-30, 30]) {
        c.beginPath(); O(c, wx, 30, wr); inked(c, C('#1a1c22'), 2.2);
        c.beginPath(); O(c, wx, 30, wr * 0.5); c.fillStyle = C('#9aa5b8'); c.fill();
        if (!fl) { c.strokeStyle = '#5b6375'; c.lineWidth = 1.2; c.beginPath(); for (let k = 0; k < 3; k++) { const a = t * 18 + (k * PI) / 3; c.moveTo(wx + Math.cos(a) * wr * 0.48, 30 + Math.sin(a) * wr * 0.48); c.lineTo(wx - Math.cos(a) * wr * 0.48, 30 - Math.sin(a) * wr * 0.48); } c.stroke(); }
      }
      // escapamento cromado
      c.beginPath(); c.moveTo(-6, 26); c.lineTo(-44, 22); c.lineWidth = 7; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4.4; c.strokeStyle = C('#d7deea'); c.stroke();
      // corpo / banco
      c.beginPath(); c.moveTo(-40, 14); c.quadraticCurveTo(-34, 4, -18, 6); c.lineTo(4, 8); c.lineTo(10, 24); c.lineTo(-20, 26); c.quadraticCurveTo(-34, 24, -40, 14); c.closePath();
      inked(c, C('#1f2329'), 2.2);
      c.beginPath(); c.moveTo(-26, 5); c.quadraticCurveTo(-12, 0, 2, 5); c.lineTo(2, 9); c.lineTo(-26, 9); c.closePath(); inked(c, C('#3a2a20'), 1.6);
    } else {
      // tanque verde-amarelo, garfo, farol e guidão
      c.beginPath(); c.moveTo(2, 4); c.quadraticCurveTo(16, -4, 26, 4); c.lineTo(22, 16); c.lineTo(4, 16); c.closePath();
      inked(c, C('#00a651'), 2);
      if (!fl) { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(8, 9); c.lineTo(15, 4); c.lineTo(22, 9); c.lineTo(15, 13); c.closePath(); c.fill(); }
      c.beginPath(); c.moveTo(24, 6); c.lineTo(31, 30); c.lineWidth = 5; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = C('#c9d3e6'); c.stroke();
      c.beginPath(); c.moveTo(22, -2); c.lineTo(26, -10); c.lineTo(19, -12); c.lineWidth = 4.4; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = C('#c9d3e6'); c.stroke();
      c.beginPath(); O(c, 31, 6, 4.6); inked(c, C('#ffe28a'), 1.6);
      if (hp < 0.3 && !fl) { c.fillStyle = 'rgba(16,20,24,0.5)'; c.beginPath(); O(c, 12, 12, 3); c.fill(); }
    }
  }
  function jetProp(c, t, fl, part) {
    const C = (col) => (fl ? WHITE : col);
    if (part === 'back') {
      if (!fl) {
        // "rabo de galo" de água atrás + espuma embaixo
        c.fillStyle = 'rgba(232,251,255,0.85)';
        for (let i = 0; i < 7; i++) { const k = (t * 2.6 + i / 7) % 1; c.beginPath(); O(c, -50 - k * 34, 22 - Math.sin(k * PI) * 26, 6 * (1 - k) + 1.5); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 7; i++) { const a = t * 9 + i; c.beginPath(); E(c, -54 + i * 18, 40 + Math.sin(a) * 1.5, 13 + Math.sin(a * 1.3) * 2, 4.5); c.fill(); }
      }
      // casco com bico
      c.beginPath(); c.moveTo(-52, 14); c.lineTo(30, 14); c.quadraticCurveTo(58, 12, 64, 2); c.quadraticCurveTo(56, 36, 18, 40); c.lineTo(-46, 38); c.quadraticCurveTo(-56, 30, -52, 14); c.closePath();
      inked(c, C('#f4f1e8'), 2.4);
      if (!fl) {
        c.save(); c.clip();
        c.fillStyle = '#00a651'; c.fillRect(-60, 28, 130, 14);
        c.fillStyle = '#ffd23f'; c.fillRect(-60, 24, 130, 4);
        c.fillStyle = 'rgba(16,20,24,0.15)'; c.fillRect(-60, 34, 130, 8);
        c.restore();
      }
      // banco
      c.beginPath(); c.moveTo(-40, 14); c.quadraticCurveTo(-30, 2, -6, 5); c.lineTo(8, 14); c.closePath(); inked(c, C('#1f2329'), 1.8);
    } else {
      // console com guidão e para-brisa
      c.beginPath(); c.moveTo(6, 14); c.quadraticCurveTo(14, -2, 32, 2); c.lineTo(44, 14); c.closePath(); inked(c, C('#1b3fa0'), 2);
      c.beginPath(); c.moveTo(28, 2); c.quadraticCurveTo(36, -8, 42, -6); c.lineTo(40, 4); c.closePath(); c.fillStyle = fl ? WHITE : 'rgba(190,232,255,0.7)'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(20, 4); c.lineTo(22, -6); c.lineTo(14, -8); c.lineWidth = 4.4; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = C('#c9d3e6'); c.stroke();
    }
  }
  function boxProp(c, t, fl, B, look) {
    const C = (col) => (fl ? WHITE : col);
    const w = 116, h = 92;
    c.save(); c.translate(Math.sin(t * 40) * (B.shake || 0), B.dy || 0);
    // correntes até os cadeados
    c.strokeStyle = INK; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-w / 2 + 4, -10); c.lineTo(-70, 0); c.moveTo(w / 2 - 4, -10); c.lineTo(70, 0); c.moveTo(0, h / 2 - 2); c.lineTo(0, 50); c.stroke();
    c.strokeStyle = C('#9aa5b8'); c.lineWidth = 2; c.setLineDash([3, 2]); c.stroke(); c.setLineDash([]);
    // caixa
    rr(c, -w / 2, -h / 2, w, h, 6); inked(c, C('#17191f'), 3);
    if (!fl) {
      c.fillStyle = '#262a33'; c.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, 8);
      c.fillStyle = '#9aa5b8';
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { c.beginPath(); O(c, sx * (w / 2 - 7), sy * (h / 2 - 7), 2.4); c.fill(); }
      // fresta com os olhos dele
      c.fillStyle = '#05060a'; c.fillRect(-28, -32, 56, 12);
      const lx = look ? look[0] * 2.5 : 0, ang = B.eyesT > 0;
      for (const s of [-1, 1]) {
        c.fillStyle = ang ? '#ff3b4e' : '#ffffff'; c.beginPath(); E(c, s * 11, -26, 6, 3.6); c.fill();
        c.fillStyle = INK; c.beginPath(); O(c, s * 11 + lx, -26, 2); c.fill();
        c.strokeStyle = '#2a2420'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(s * 4, -31); c.lineTo(s * 17, -33); c.stroke();
      }
      txt(c, 'SIGILO', 0, -2, 17, '#f4f1e8', { maxW: w - 16 });
      txt(c, '100 ANOS', 0, 17, 11, '#ffd23f', { maxW: w - 20 });
      // carimbo
      c.save(); c.translate(18, 31); c.rotate(-0.16);
      c.strokeStyle = '#e63946'; c.lineWidth = 1.6; rr(c, -30, -6, 60, 12, 2); c.stroke();
      txt(c, 'CONFIDENCIAL', 0, 0.5, 6.4, '#e63946', { maxW: 56 });
      c.restore();
      // rachaduras
      c.strokeStyle = 'rgba(244,241,232,0.85)'; c.lineWidth = 1.4; c.beginPath();
      if (B.cracks >= 1) { c.moveTo(-58, -20); c.lineTo(-44, -10); c.lineTo(-48, 4); c.lineTo(-36, 12); }
      if (B.cracks >= 2) { c.moveTo(58, -6); c.lineTo(44, 2); c.lineTo(48, 16); c.lineTo(36, 26); }
      c.stroke();
    }
    c.restore();
  }
  function canProp(c, x, y, sc, rot, fl) {
    const C = (col) => (fl ? WHITE : col);
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc, sc);
    rr(c, -7, -9, 14, 18, 3); inked(c, C('#1b5fd1'), 1.6);
    if (!fl) {
      c.fillStyle = '#f4f1e8'; c.fillRect(-7, -3, 14, 7);
      c.fillStyle = '#e63946'; c.fillRect(-7, 4, 14, 1.6);
      txt(c, 'LEITE', 0, 0.6, 4.2, '#1b3fa0', { maxW: 12 });
      c.fillStyle = '#d7deea'; c.beginPath(); E(c, 0, -9, 7, 2.2); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
    }
    c.restore();
  }
  /**
   * Desenha o Capitão. S: {t, flash, mode:'moto'|'stun'|'box'|'jet', dir, mood, mouth, pose, look, hp, wheelie, helmet, box, canHand, k}
   */
  function drawBolso(c, x, y, S) {
    const fl = !!S.flash, t = S.t || 0, hp = S.hp != null ? S.hp : 1, k = S.k || 1, dir = S.dir || 1;
    c.save(); c.translate(x, y); c.scale(k, k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (S.mode === 'box') {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 58, 64, 8, 0, 0, TAU); c.fill();
      boxProp(c, t, fl, S.box, S.look);
      c.restore();
      return;
    }
    const spec = bolSpec(!!S.helmet, hp < 0.7);
    const jet = S.mode === 'jet';
    if (!jet) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(0, 46, 52, 6, 0, 0, TAU); c.fill(); }
    else { c.fillStyle = 'rgba(10,30,60,0.35)'; c.beginPath(); c.ellipse(4, 44, 62, 7, 0, 0, TAU); c.fill(); }
    c.save();
    c.scale(dir, 1);
    if (S.wheelie) { c.translate(-30, 30); c.rotate(-0.3 * S.wheelie); c.translate(30, -30); }
    const bob = jet ? Math.sin(t * 5) * 2 : Math.abs(Math.sin(t * 13)) * 1.2;
    c.translate(0, -bob);
    if (jet) jetProp(c, t, fl, 'back'); else motoProp(c, t, fl, 'back', hp);
    const pose = S.pose || 'drive';
    const lk = S.look || [0, 0.2];
    // dentro do scale(dir): lookX já está no referencial do personagem
    G.Art.person(c, -2, -12, BOL_SIZE, spec, { t, mood: S.mood, mouth: S.mouth, pose, flash: fl, lookX: lk[0] * dir, lookY: lk[1], autoLook: false });
    const s = BOL_SIZE / 100;
    // faixa rasgada (dano)
    if (hp < 0.45 && !fl) rip(c, 6, 18, 9, 3, 0.6);
    if (S.canHand) {
      const h = hand(BOL_SIZE, pose, t, spec.seed, true, 1);
      canProp(c, -2 + h.x, -12 + h.y - 8, 1.1, Math.sin(t * 8) * 0.2, fl);
    }
    if (jet) jetProp(c, t, fl, 'front'); else motoProp(c, t, fl, 'front', hp);
    // capacete pendurado no guidão quando está sem ele
    if (!S.helmet && !jet && !fl) { c.beginPath(); E(c, 26, 2, 7, 6); inked(c, '#11823f', 1.4); c.fillStyle = '#6fa8d8'; c.fillRect(21, -1, 9, 2.4); }
    if (S.mode === 'stun') dizzy(c, -2, -12 - 14 * s - 34 * s, t, 20);
    c.restore();
    c.restore();
  }

  // ---------- sub-inimigo: cadeado do sigilo ----------
  G.Enemies.define('bs_cadeado', {
    hp: 30, r: 13, score: 500, pix: 4, harmless: true, keepOffscreen: true,
    init(e, o) { e.data.ox = o.ox || 0; e.data.oy = o.oy || 0; e.data.ph = Math.random() * TAU; },
    update(e, dt, g) {
      const b = g.boss, d = e.data;
      if (!b || b.id !== 'bolsonario') return;
      const B = b.data.box;
      e.x = b.x + d.ox + Math.sin(e.t * 3 + d.ph) * 1.5;
      e.y = b.y + d.oy + (B ? B.dy || 0 : 0) + Math.cos(e.t * 2.6 + d.ph) * 1.5;
    },
    draw(ctx, e) {
      const fl = G.isFlash(e), C = (col) => (fl ? WHITE : col), k = e.hp / e.maxHp;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(e.t * 3 + e.data.ph) * 0.12);
      // alça
      ctx.beginPath(); ctx.arc(0, -6, 7, PI, TAU); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = C('#c9d3e6'); ctx.stroke();
      // corpo
      rr(ctx, -11, -7, 22, 18, 4); inked(ctx, C('#ffc531'), 2.2);
      if (!fl) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-8, -5, 4, 13);
        ctx.fillStyle = INK; ctx.beginPath(); O(ctx, 0, 0, 2.8); ctx.fill(); ctx.fillRect(-1.2, 0, 2.4, 6);
        if (k < 0.66) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -7); ctx.lineTo(6, -1); ctx.lineTo(3, 3); if (k < 0.33) { ctx.moveTo(-6, 11); ctx.lineTo(-4, 5); ctx.lineTo(-8, 1); } ctx.stroke(); }
      }
      ctx.restore();
    },
    onDeath(e, g, opts) {
      const b = g.boss;
      if (b && b.id === 'bolsonario' && b.data.box) { b.data.box.cracks++; b.data.box.shake = 3; }
      if (opts && opts.silent) return;
      G.text(e.x, e.y - 18, 'QUEBRA DE SIGILO!', { color: G.C.yellow, size: 11, life: 1.1 });
      G.burst(e.x, e.y, 10, { colors: ['#ffc531', '#ffffff', '#c9d3e6'], speed: 170 });
      sfx('stamp');
    },
  });

  // ---------- ataques do Capitão ----------
  function bolHand(b) {
    const d = b.data, h = hand(BOL_SIZE, d.pose, b.t, BOLSO.seed, true, d.dir);
    return [b.x - 2 * d.dir + h.x, b.y - 12 + h.y];
  }
  // movimento em "8" pela parte de cima da tela (motociata)
  function bolEight(b, d, dt) {
    d.th += d.w * dt;
    const tx = G.W / 2 + 100 * Math.sin(d.th), ty = b.homeY + 34 * Math.sin(2 * d.th);
    const f = Math.min(1, dt * 7);
    b.x += (tx - b.x) * f; b.y += (ty - b.y) * f;
  }
  function bolPark(b, d, dt) {
    d.tx = b.homeX + Math.sin(b.ft * 0.42) * 54; d.ty = b.homeY + Math.sin(b.ft * 1.3) * 6;
    glide(b, dt, 2.2);
  }
  // fumaça que cai devagar (rastro tracejado)
  function smokeFall(q) { if (q.vy > q.data.vmax) q.vy = q.data.vmax; q.vx *= 0.985; }
  // dedo-arminha: linha de mira, depois rajada
  function* bolFinger(b, n, spd) {
    const d = b.data, prev = d.pose, w0 = d.w;
    d.pose = 'point';
    if (d.mv === bolEight) d.w = 0; // freia para mirar
    yield 0.12;
    const h = bolHand(b), a = aimFrom(h[0], h[1]);
    fx(b, { kind: 'aim', x: h[0], y: h[1], ang: a, len: 560, life: 0.55, color: COL.red });
    sfx('charge');
    yield 0.55;
    const h2 = bolHand(b);
    for (let k = 0; k < n; k++) {
      shoot(h2[0], h2[1], a, spd || 210, { style: 'needle', color: COL.red });
      if (k === 0 || (L2() && k === n - 1)) { shoot(h2[0], h2[1], a - 0.24, 185, { style: 'needle', color: COL.red }); shoot(h2[0], h2[1], a + 0.24, 185, { style: 'needle', color: COL.red }); }
      sfx('enemy_shot');
      yield 0.075;
    }
    yield 0.25;
    d.pose = prev === 'point' ? 'drive' : prev;
    if (d.mv === bolEight && d.w === 0) d.w = w0;
  }
  function bolEscort(b) {
    if (!G.Enemies.defs.motoqueiro) return;
    say(b, 'É MOTOCIATA!', 1.6);
    const y = M.rand(G.H * 0.3, G.H * 0.36);
    G.spawnEnemy('motoqueiro', -30, y, { dir: 1, ty: y, spd: 150 });
    G.spawnEnemy('motoqueiro', G.W + 30, y + 46, { dir: -1, ty: y + 46, spd: 150 });
  }
  function* bolRev(b) {
    const d = b.data;
    d.w = 0; d.smokeOn = false; d.wheelieT = 1; d.mood = 'laugh';
    say(b, M.pick(['VRUM VRUM, TALKEY?', 'É MOTOCIATA!', 'ACELERA!']), 1.4);
    sfx('motor');
    for (let i = 0, n = 4 + 6 * decoK(); i < n; i++) G.part({ x: b.x - d.dir * 44, y: b.y + 22, vx: -d.dir * M.rand(40, 120), vy: M.rand(-60, 0), type: 'smoke', size: M.rand(5, 9), life: M.rand(0.6, 1.1), color: 'rgba(90,94,104,0.55)', drag: 0.94 });
    yield 0.85;
    d.wheelieT = 0; d.mood = 'angry';
    d.w = L2() ? 1.8 : 1.6; d.smokeOn = true; d.fast = true;
    sfx('dash');
    const th0 = d.th;
    yield () => d.th - th0 >= PI;
    d.w = 0.78; d.fast = false;
  }
  // latas de leite condensado em arco, com sombra marcando onde caem
  function* bolCans(b, n) {
    const d = b.data, prevPose = d.pose;
    d.pose = 'up'; d.canHand = true; sfx('charge');
    if (Math.random() < 0.5) say(b, M.pick(['LEITE CONDENSADO!', 'É PRO PÃO, TALKEY?']), 1.4);
    yield 0.45;
    const p = pl(), H = G.H;
    const h = bolHand(b);
    for (let i = 0; i < n; i++) {
      const x1 = clamp(p.x + (i - (n - 1) / 2) * 80 + M.rand(-14, 14), 26, G.W - 26);
      // cai no máximo em 0,62H: quem fica embaixo (≈0,8H) tem folga; quem sobe vê a sombra e o círculo de alcance
      const y1 = clamp(p.y - 6 + M.rand(-36, 16), H * 0.46, H * 0.62);
      d.cans.push({ x0: h[0], y0: h[1], x1, y1, T: 1.12 + i * 0.13, t: 0, rot: M.rand(0, TAU) });
    }
    sfx('whoosh');
    d.canHand = false;
    yield 0.35;
    d.pose = prevPose === 'up' ? 'drive' : prevPose;
  }
  function stickyUpd(q) {
    // gruda no chão e some piscando no fim (fica translúcida e inofensiva)
    if (!q.data.fading && q.t > q.life - 0.55) { q.data.fading = 1; q.delay = 0.5; }
  }
  // respingo: dois anéis que freiam e grudam no chão. SPLAT_V2 define o alcance (ver splatReach)
  const SPLAT_V1 = 70, SPLAT_A1 = 150, SPLAT_V2 = 96, SPLAT_A2 = 165;
  // raio máximo (px) que o respingo atinge — é o círculo desenhado na sombra da lata
  function splatReach(b) {
    const k = (b.def.spdK || 1) * (G.game ? G.game.diff : 1), v = SPLAT_V2 * k;
    return (v * v) / (2 * SPLAT_A2) + 6;
  }
  function bolSplat(b, x, y) {
    const d = b.data;
    d.puddles.push({ x, y, t: 0, life: 4.0, rot: Math.random() * TAU });
    if (d.puddles.length > 12) d.puddles.shift();
    const n1 = L2() ? 10 : 8, off = Math.random() * TAU;
    for (let i = 0; i < n1; i++) shoot(x, y, off + (i * TAU) / n1, SPLAT_V1, { style: 'bs_leite', color: COL.hot, accel: -SPLAT_A1, minSpd: 0, life: 3.6, update: stickyUpd });
    for (let i = 0; i < 6; i++) shoot(x, y, off + PI / n1 + (i * TAU) / 6, SPLAT_V2, { style: 'bs_leite', color: COL.pink, accel: -SPLAT_A2, minSpd: 0, life: 3.4, update: stickyUpd });
    G.burst(x, y, 12, { colors: ['#fff4dc', '#ffffff', '#ffd9a0'], speed: 160, life: 0.45 });
    G.text(x, y - 18, 'PLOFT!', { color: '#fff4dc', size: 11, life: 0.7 });
    sfx('splash');
  }
  // "MIMIMI!": três ondas de arcos miradas
  function* bolMimimi(b) {
    const d = b.data;
    d.mood = 'angry'; say(b, 'MIMIMI!', 1.4); sfx('shout');
    yield 0.4;
    for (let w = 0; w < 3; w++) {
      const a = aimFrom(b.x, b.y);
      fan(b.x, b.y + 6, a, L2() ? 11 : 9, 1.05, 118 - w * 6, { style: 'bs_talkey', color: w % 2 ? COL.magenta : COL.hot });
      sfx('enemy_shot2');
      yield 0.3;
    }
  }
  // TALKEY?: duas ondas de choque em anel (com aviso)
  function* bolTalkey(b) {
    const d = b.data;
    d.pose = 'fist'; d.mood = 'angry';
    say(b, 'TALKEY?', 1.5);
    fx(b, { kind: 'circle', x: b.x, y: b.y + 6, r: 60, life: 0.7, color: COL.hot, layer: 'top', upd(f) { f.x = b.x; f.y = b.y + 6; } });
    sfx('charge');
    yield 0.7;
    sfx('shout'); G.shake(4);
    G.part({ x: b.x, y: b.y, type: 'ring', size: 22, life: 0.5, color: '#ffd23f' });
    const n = L2() ? 36 : 32, off = Math.random() * TAU;
    ring(b.x, b.y + 6, n, 108, { style: 'bs_talkey', color: COL.hot }, off);
    yield 0.42;
    ring(b.x, b.y + 6, n, 88, { style: 'bs_talkey', color: COL.magenta }, off + PI / n);
    sfx('enemy_shot2');
    yield 0.5;
    d.pose = 'drive';
  }
  function locksLeft() { let n = 0; for (const e of G.game.enemies) if (!e.dead && e.kind === 'bs_cadeado') n++; return n; }
  function* bolBoxIn(b) {
    const d = b.data;
    d.mv = (bb, dd, dt) => { dd.tx = bb.homeX; dd.ty = bb.homeY; glide(bb, dt, 3); };
    d.smokeOn = false; d.helmet = false; d.w = 0;
    say(b, 'SIGILO DE 100 ANOS!', 2);
    yield 0.6;
    d.box = { dy: -300, cracks: 0, shake: 0, eyesT: 0 };
    d.boxDrop = true;
    yield* tween(b, 0.5, (u) => { d.box.dy = M.lerp(-300, 0, M.easeInCubic(u)); });
    d.boxDrop = false;
    d.mode = 'box'; b.invuln = true;
    G.shake(7); sfx('stamp'); sfx('explode_s');
    G.burst(b.x, b.y + 46, 16, { colors: ['#9aa5b8', '#c9d3e6'], speed: 160, type: 'smoke', size: 6 });
    G.spawnEnemy('bs_cadeado', b.x - 70, b.y, { ox: -70, oy: 4 });
    G.spawnEnemy('bs_cadeado', b.x + 70, b.y, { ox: 70, oy: 4 });
    G.spawnEnemy('bs_cadeado', b.x, b.y + 58, { ox: 0, oy: 58 });
    hint('cadeado', G.W / 2, b.y + 100, 'QUEBRE OS CADEADOS!');
    d.mv = (bb, dd, dt) => { dd.tx = bb.homeX + Math.sin(bb.ft * 0.6) * 56; dd.ty = bb.homeY + 4; glide(bb, dt, 2); };
    yield 0.5;
  }
  function* bolBoxFire(b) {
    const d = b.data;
    let a = Math.random() * TAU;
    const dirr = Math.random() < 0.5 ? 1 : -1;
    const arms = L2() ? 4 : 3;
    for (let k = 0; k < 22 && locksLeft() > 0; k++) {
      for (let arm = 0; arm < arms; arm++) shoot(b.x, b.y - 4, a + (arm * TAU) / arms, 100, { style: 'bs_sigilo', color: COL.red });
      a += 0.24 * dirr;
      if (k % 4 === 0) sfx('enemy_shot');
      yield 0.12;
    }
    if (!locksLeft()) return;
    yield 0.35;
    d.box.eyesT = 0.55; sfx('charge');
    if (Math.random() < 0.5) say(b, 'VOTO IMPRESSO!', 1.4);
    yield 0.55;
    const a2 = aimFrom(b.x, b.y - 26);
    fan(b.x, b.y - 26, a2, L2() ? 7 : 5, 0.42, 180, { style: 'needle', color: COL.red });
    sfx('enemy_shot2');
    yield 0.6;
  }
  function* bolBoxOpen(b) {
    const d = b.data;
    G.explode(b.x, b.y, 2, { confetti: true });
    for (let i = 0, n = 10 + 20 * decoK(); i < n; i++) G.part({ x: b.x + M.rand(-50, 50), y: b.y + M.rand(-40, 40), vx: M.rand(-260, 260), vy: M.rand(-300, 60), type: 'paper', size: M.rand(4, 7), life: M.rand(0.9, 1.5), color: M.pick(['#ffffff', '#f4f1e8', '#17191f']), drag: 0.95, grav: 160, rot: M.rand(0, TAU), vr: M.rand(-10, 10) });
    G.text(b.x, b.y + 70, 'SIGILO QUEBRADO!', { color: G.C.yellow, size: 15, life: 1.6, vy: -20 });
    G.clearBullets(true); // a papelada vira Pix
    sfx('explode_m');
    d.box = null; d.mode = 'stun'; b.invuln = false; d.dmgBase = 2.5; d.stunT = 4.5;
    d.mood = 'hurt'; d.pose = 'shrug';
    say(b, 'MIMIMI!', 2);
    d.mv = (bb, dd, dt) => { dd.tx = bb.x; dd.ty = bb.homeY; glide(bb, dt, 2); };
    yield 4.5;
    d.dmgBase = 1; d.mode = 'moto'; d.mood = 'angry'; d.pose = 'drive';
    say(b, 'ISSO É FAKE NEWS!', 1.6);
  }
  function* bolRide(b, dur) {
    const d = b.data;
    d.th = Math.asin(clamp((b.x - G.W / 2) / 100, -1, 1));
    d.w = 1.0; d.mv = bolEight; d.smokeOn = true;
    const t0 = b.ft;
    while (b.ft - t0 < dur) {
      yield 1.1;
      yield* bolFinger(b, 3);
      yield 0.7;
      yield* bolCans(b, 2);
      yield 0.6;
    }
    d.smokeOn = false;
  }
  // jet ski: avança rente à água deixando uma cortina com duas frestas
  function* bolJetDash(b, dir, y) {
    const d = b.data;
    const edge = dir > 0 ? 44 : G.W - 44, sx = b.x, sy = b.y;
    d.dir = dir;
    yield* tween(b, 0.5, (u) => { const e = M.easeOutCubic(u); b.x = M.lerp(sx, edge, e); b.y = M.lerp(sy, y, e); });
    d.dir = dir;
    fx(b, { kind: 'row', y: y + 30, dir, life: 0.7, label: 'JET SKI!', color: COL.hot, h: 30, layer: 'under' });
    sfx('motor');
    yield 0.7;
    sfx('dash'); sfx('splash');
    const x0 = b.x, x1 = dir > 0 ? G.W + 64 : -64, T = Math.abs(x1 - x0) / (L2() ? 520 : 480);
    const g1 = M.rand(50, G.W / 2 - 40), g2 = M.rand(G.W / 2 + 40, G.W - 50);
    // brecha (meia largura): mais larga no 1º Mandato (as 4 fileiras de 2 passadas chegam a ~0,8 s uma da outra)
    const gapR = L2() ? 31 : 42;
    let lastX = x0;
    yield* tween(b, T, (u) => {
      b.x = M.lerp(x0, x1, u);
      if (Math.abs(b.x - lastX) >= 15 && b.x > 6 && b.x < G.W - 6) {
        lastX = b.x;
        if (Math.abs(b.x - g1) > gapR && Math.abs(b.x - g2) > gapR) {
          shoot(b.x, b.y + 30, DOWN, 40, { style: 'bs_gota', color: COL.hot, ay: 115, data: { vmax: 165 }, update: smokeFall });
          shoot(b.x, b.y + 30, DOWN, 12, { style: 'bs_gota', color: COL.magenta, ay: 80, data: { vmax: 130 }, update: smokeFall });
        }
        if (Math.random() < decoK()) G.part({ x: b.x - dir * 30, y: b.y + 34, vx: -dir * M.rand(30, 90), vy: M.rand(-80, -20), type: 'dot', size: 3, life: 0.5, color: '#e8fbff', grav: 300 });
      }
    });
    b.x = dir > 0 ? -64 : G.W + 64;
  }

  function* bolP1(b) {
    const d = b.data;
    d.mode = 'moto'; d.helmet = true; d.th = 0; d.w = 0.78; d.mv = bolEight; d.smokeOn = true;
    yield 0.5;
    let lap = 0;
    for (;;) {
      yield 1.5;
      yield* bolFinger(b, 3);
      yield 1.2;
      yield () => Math.abs(Math.sin(d.th)) > 0.96;
      yield* bolRev(b);
      bolEscort(b); lap++;
      yield 0.6;
      yield* bolFinger(b, 4);
    }
  }
  // pressão de fundo da fase 2: comboio da motociata passando
  function* bolBgEscort(b, every) {
    for (;;) { yield every; bolEscort(b); }
  }
  function* bolP2(b) {
    const d = b.data;
    d.smokeOn = false; d.helmet = false; d.w = 0;
    d.mv = bolPark;
    say(b, 'LEITE CONDENSADO!', 2);
    yield 1.0;
    for (;;) {
      yield* bolCans(b, L2() ? 4 : 3);
      yield 0.9;
      yield* bolFinger(b, 4);
      yield 0.6;
      yield* bolCans(b, L2() ? 5 : 4);
      yield 1.0;
      yield* bolMimimi(b);
      yield 0.9;
    }
  }
  function* bolP3(b) {
    for (;;) {
      yield* bolBoxIn(b);
      while (locksLeft() > 0) yield* bolBoxFire(b);
      yield* bolBoxOpen(b);
      yield* bolRide(b, 5);
    }
  }
  function* bolP4(b) {
    const d = b.data;
    d.mode = 'jet'; d.helmet = false; d.smokeOn = false; d.mv = null;
    G.burst(b.x, b.y + 30, 24, { colors: ['#ffffff', '#bdf3ff', '#4cc9f0'], speed: 220, grav: 300 });
    sfx('splash');
    say(b, 'JET SKI, TALKEY?', 2);
    yield 0.9;
    let dir = b.x < G.W / 2 ? 1 : -1, r = 0;
    const rows = [146, 200];
    for (;;) {
      yield* bolJetDash(b, dir, Math.min(rows[r++ % 2], G.H * 0.3)); dir = -dir;
      yield* bolJetDash(b, dir, Math.min(rows[r++ % 2], G.H * 0.3)); dir = -dir;
      // volta ao centro
      const sx = b.x;
      d.dir = sx < 0 ? 1 : -1;
      yield* tween(b, 0.7, (u) => { const e = M.easeOutCubic(u); b.x = M.lerp(sx, G.W / 2, e); b.y = M.lerp(b.y, b.homeY, 0.15); });
      yield* bolTalkey(b);
      yield 0.3;
      yield* bolFinger(b, 5);
      yield 0.4;
      if (r % 4 === 0) { yield* bolMimimi(b); yield 0.5; }
      dir = Math.random() < 0.5 ? 1 : -1;
    }
  }

  const BOL_SHOTS = [['needle', COL.red], ['bs_leite', COL.hot], ['bs_leite', COL.pink], ['bs_talkey', COL.hot], ['bs_talkey', COL.magenta],
    ['bs_sigilo', COL.red], ['bs_gota', COL.hot], ['bs_gota', COL.magenta], ['bs_fumaca', COL.ember],
    ['rice', COL.orange]]; // 'rice' laranja: os motoqueiros da escolta (enemies.js)
  const BOL_HB_MOTO = [[-2, -23, 22], [0, 14, 30], [-30, 28, 16], [30, 28, 16]], BOL_HB_BOX = [[0, 0, 56]],
    BOL_HB_JET = [[-2, -23, 22], [0, 20, 32], [-36, 26, 18], [42, 22, 18]];
  G.Bosses.define('bolsonario', {
    name: 'CAPITÃO BOLSONÁRIO', title: 'O Mito da Motociata', hp: 3800, r: 42, homeY: 170, spdK: 1.12,
    score: 220000, pix: 180, music: 'boss', defeatText: 'INELEGÍVEL!',
    phases: [
      { at: 1, name: 'Motociata' },
      { at: 0.74, name: 'Leite Condensado' },
      { at: 0.48, name: 'Sigilo de 100 Anos' },
      { at: 0.24, name: 'Jet Ski no Paranoá' },
    ],
    init(b) {
      const d = b.data;
      sprReset();
      d.fx = []; d.mode = 'moto'; d.dir = 1; d.lastX = b.x; d.th = 0; d.w = 0;
      d.helmet = true; d.mood = 'angry'; d.pose = 'drive'; d.mouth = 0; d.wheelie = 0; d.wheelieT = 0;
      d.cans = []; d.puddles = []; d.box = null; d.smokeOn = false; d.smT = 0; d.smK = 0; d.canHand = false;
      d.tx = b.homeX; d.ty = b.homeY; d.S = {};
      b.hitboxes = BOL_HB_MOTO.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      warmPeople(b, 'p1', poses(bolSpec(true, false), BOL_SIZE, ['drive', 'point']));
      warmShots(b, BOL_SHOTS);
      // a escolta da motociata (1º turno): se a luta começou direto (boss=1 / bossid=), a fase não aqueceu os motoqueiros
      G.call(G.EnemyArt, 'prewarm', ['motoqueiro']);
    },
    updateEnter(b) { if (b.t > 0.3 && !b.data.revved) { b.data.revved = true; sfx('motor'); } warmShotsStep(b, 1); },
    start(b) { warmShotsStep(b, 99); co(b, bolP1(b)); say(b, 'É MOTOCIATA, TALKEY?', 2); sfx('motor'); },
    update(b, dt, g) {
      const d = b.data;
      updFx(b, dt);
      runCo(b, dt);
      fatigue(b, 'CANSEI, TALKEY?');
      if (d.mv) d.mv(b, d, dt);
      // sentido da moto pelo movimento
      const dx = b.x - d.lastX;
      if (Math.abs(dx) > 0.25 && d.mode !== 'box' && d.mode !== 'stun') d.dir = dx > 0 ? 1 : -1;
      const spd = Math.abs(dx) / Math.max(dt, 1e-4);
      d.lastX = b.x;
      d.wheelie = M.approach(d.wheelie, d.wheelieT, dt * 4);
      if (b.sayT > 0) d.mouth = 0.45 + 0.4 * Math.sin(b.ft * 17); else d.mouth = M.approach(d.mouth, 0, dt * 4);
      if (d.box) { if (d.box.shake > 0) d.box.shake = Math.max(0, d.box.shake - dt * 8); if (d.box.eyesT > 0) d.box.eyesT -= dt; }
      // rastro de fumaça tracejado (4 puffs, 3 de folga)
      if (d.smokeOn && d.mode === 'moto' && spd > 40) {
        d.smT -= dt;
        if (d.smT <= 0) {
          d.smT = 0.075; d.smK = (d.smK + 1) % 7;
          if (d.smK < 5) shoot(b.x - d.dir * 44, b.y + 22, DOWN - d.dir * 0.5, 28, { style: 'bs_fumaca', color: COL.ember, ay: 52, data: { vmax: d.fast ? 112 : 98 }, update: smokeFall, life: 9 });
        }
      }
      if ((d.mode === 'moto' || d.mode === 'stun') && Math.random() < dt * (spd > 40 ? 14 : 4) * decoK()) G.part({ x: b.x - d.dir * 46, y: b.y + 22, vx: -d.dir * M.rand(20, 60), vy: M.rand(-30, 0), type: 'smoke', size: M.rand(3, 6), life: 0.6, color: 'rgba(120,124,134,0.4)', drag: 0.94 });
      if (d.mode === 'jet' && Math.random() < dt * 20 * decoK()) G.part({ x: b.x - d.dir * M.rand(30, 56), y: b.y + 34, vx: -d.dir * M.rand(10, 60), vy: M.rand(-60, -10), type: 'dot', size: M.rand(2, 3.5), life: 0.45, color: '#e8fbff', grav: 260 });
      // latas no ar
      for (let i = d.cans.length - 1; i >= 0; i--) {
        const cn = d.cans[i];
        cn.t += dt;
        if (cn.t >= cn.T) { d.cans.splice(i, 1); bolSplat(b, cn.x1, cn.y1); }
      }
      for (let i = d.puddles.length - 1; i >= 0; i--) { const pd = d.puddles[i]; pd.t += dt; if (pd.t > pd.life) d.puddles.splice(i, 1); }
      // hitboxes por modo
      const hb = d.mode === 'box' ? BOL_HB_BOX : d.mode === 'jet' ? BOL_HB_JET : BOL_HB_MOTO;
      if (d.hbSrc !== hb) { d.hbSrc = hb; b.hitboxes = hb.map((h) => ({ dx: h[0], dy: h[1], r: h[2] })); }
      if (b.hp / b.maxHp < 0.3 && d.mode !== 'box' && Math.random() < dt * 5 * decoK()) G.part({ x: b.x + M.rand(-24, 24), y: b.y + 10, vx: M.rand(-10, 10), vy: -40, type: 'smoke', size: 5, life: 0.8, color: 'rgba(60,60,70,0.45)', drag: 0.95 });
    },
    onPhase(b, idx, g) {
      const d = b.data;
      // limpa o estado do sigilo se a fase virar no meio
      if (d.box || d.mode === 'box' || d.mode === 'stun') {
        d.box = null; b.invuln = false; d.mode = 'moto';
        for (const e of g.enemies) if (!e.dead && e.kind === 'bs_cadeado') G.killEnemy(e, { silent: true });
      }
      d.dmgBase = 1; d.wheelieT = 0; d.pose = 'drive'; d.mood = 'angry'; d.canHand = false; d.fast = false;
      // o que vem a seguir: sem capacete (fase 2), suado (HP < 70%), tonto (sigilo quebrado) e no jet ski
      if (idx === 1) warmPeople(b, 'p2', poses(bolSpec(false, false), BOL_SIZE, ['drive', 'up', 'point']).concat(poses(bolSpec(false, true), BOL_SIZE, ['drive', 'up', 'point'])));
      if (idx === 2) warmPeople(b, 'p3', poses(bolSpec(false, true), BOL_SIZE, ['shrug', 'fist']));
      co(b, null, 1);
      if (idx === 1) { co(b, bolP2(b)); co(b, bolBgEscort(b, 8.5), 1); }
      else if (idx === 2) co(b, bolP3(b));
      else if (idx === 3) co(b, bolP4(b));
    },
    onDeath(b) {
      const d = b.data;
      stopCo(b); d.cans.length = 0; d.box = null; d.fx.length = 0; d.smokeOn = false;
      b.invuln = true; d.dmgBase = 1;
      if (b.x < 40 || b.x > G.W - 40) b.x = clamp(b.x, 70, G.W - 70);
      if (b.y < 100) b.y = 130;
    },
    draw(ctx, b) {
      const d = b.data;
      bubbleAt(b, 66);
      // poças de leite condensado (no chão, debaixo de tudo)
      for (const pd of d.puddles) {
        const a = Math.min(1, pd.t / 0.15, (pd.life - pd.t) / 0.6);
        ctx.save(); ctx.globalAlpha = Math.max(0, a) * 0.55; ctx.translate(pd.x, pd.y); ctx.rotate(pd.rot);
        ctx.fillStyle = '#fff1d6'; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const aa = (i * TAU) / 9, r = (i % 2 ? 16 : 24) * Math.min(1, pd.t / 0.2 + 0.4); O(ctx, Math.cos(aa) * r * 0.6, Math.sin(aa) * r * 0.45, r * 0.55); }
        ctx.fill();
        ctx.restore();
      }
      // sombras das latas (telegrafia): sombra crescendo + alvo piscando + círculo tracejado do alcance do respingo
      if (d.cans.length) {
        const reach = splatReach(b);
        for (const cn of d.cans) {
          const u = cn.t / cn.T;
          ctx.save();
          ctx.globalAlpha = 0.12 + 0.2 * u; ctx.fillStyle = COL.hot;
          ctx.beginPath(); ctx.arc(cn.x1, cn.y1, reach, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.45 + 0.35 * u; ctx.strokeStyle = COL.pink; ctx.lineWidth = 1.4;
          ctx.setLineDash([6, 5]); ctx.lineDashOffset = -cn.t * 30;
          ctx.beginPath(); ctx.arc(cn.x1, cn.y1, reach, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.25 + 0.5 * u; ctx.fillStyle = 'rgba(10,10,20,0.9)';
          ctx.beginPath(); ctx.ellipse(cn.x1, cn.y1, 8 + 16 * u, 4 + 7 * u, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(cn.t * 14)); ctx.strokeStyle = COL.hot; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(cn.x1, cn.y1, 26, 12, 0, 0, TAU); ctx.stroke();
          ctx.restore();
        }
      }
      drawFx(ctx, b, 'under');
      const S = d.S, hpF = b.hp / b.maxHp;
      const dying = b.state === 'dying', leaving = b.state === 'leaving';
      S.t = b.t; S.flash = G.isFlash(b); S.hp = dying || leaving ? 0.15 : hpF;
      S.mode = leaving ? 'jet' : dying && d.mode === 'box' ? 'stun' : d.mode;
      S.dir = leaving ? 1 : d.dir;
      S.mood = dying || d.mode === 'stun' ? 'hurt' : leaving ? 'laugh' : b.invulnT > 0 ? 'angry' : d.mood;
      S.mouth = b.state === 'talk' ? 0.35 + 0.3 * Math.sin(b.t * 11) : d.mouth;
      S.pose = dying ? 'shrug' : leaving ? 'wave' : d.pose;
      S.look = lookAt(b.x, b.y); S.wheelie = d.wheelie; S.helmet = d.helmet && !leaving; S.box = d.box; S.canHand = d.canHand; S.k = 1;
      if (d.boxDrop && d.box) {
        // caixa caindo por cima dele
        drawBolso(ctx, b.x, b.y, S);
        ctx.save(); ctx.translate(b.x, b.y); boxProp(ctx, b.t, false, d.box, S.look); ctx.restore();
      } else drawBolso(ctx, b.x, b.y, S);
      // latas no ar (por cima)
      for (const cn of d.cans) {
        const u = cn.t / cn.T;
        const x = M.lerp(cn.x0, cn.x1, u), y = M.lerp(cn.y0, cn.y1, u) - Math.sin(u * PI) * 150;
        canProp(ctx, x, y, 1.1 + Math.sin(u * PI) * 0.6, cn.rot + cn.t * 9, false);
      }
      drawFx(ctx, b, 'top');
    },
  });

  G.Portraits.define('bolsonario', function (ctx, x, y, size, o) {
    o = o || {};
    const t = o.t || 0, k = size / 100;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.clip();
    const mood = o.mood || 'angry';
    const pose = mood === 'laugh' ? 'up' : mood === 'hurt' ? 'shrug' : 'point';
    const sp = size * 1.18, py = y + size * 0.16;
    G.Art.person(ctx, x, py, sp, bolSpec(false, mood === 'hurt'), { t, mood, mouth: o.mouth || 0, pose, lookX: o.lookX != null ? o.lookX : -0.35, lookY: 0.1, autoLook: false });
    if (mood === 'hurt') dizzy(ctx, x, py - sp * 0.5, t, 18 * k);
    ctx.restore();
  });
})();
