/* ============================================================
   FUSCA A JATO — lule.js
   Chefão final: LULE, "O Picanheiro" — e, depois que ele "volta",
   LULE 4.0 — QUARTO MANDATO (a história se passa depois da eleição de 2026).
   (+ retrato do diálogo, estilos de tiro 'lule_' e o sub-inimigo
   'lule_companheiro'). Contrato: docs/ENGINE.md §5.

   1ª vida (4 fases): Picanha e Cervejinha · Taxa das Blusinhas ·
   Faz o L · Companheirada. Quando o HP zera, onDefeat devolve true:
   ele desaba, a tela escurece, silêncio... "ELE VOLTOU!".
   2ª vida (3 fases): Volta por Cima · Picanha Infinita · A Última Picanha.

   Cada ataque é uma "corrotina" (gerador) que faz yield de segundos,
   de uma condição (função) ou de null (próximo quadro). Várias rodam
   em paralelo (movimento, ataque A, ataque B, provocações).
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Bosses) return;
  const M = G.m, TAU = Math.PI * 2, PI = Math.PI, DOWN = Math.PI / 2, DEG = Math.PI / 180;
  const INK = '#101418', WHITE = '#ffffff';
  const sfx = (n) => G.call(G.Audio, 'sfx', n);
  const L2 = () => !!(G.game && G.game.loop > 1);
  // qualidade (ENGINE §10): partículas puramente decorativas contínuas e brilhos extras
  // 'high' tudo, 'mid' metade das partículas (sem o brilho dourado), 'low' nenhuma partícula decorativa
  const decoK = () => (G.quality === 'low' ? 0 : G.quality === 'mid' ? 0.5 : 1);

  // HP medido com o bot "humano" (tools/humanbot.js --mode ttk, só mirando): VOTO/PANELAÇO/LAVA-JATO nv.5 levam
  // ~64 s na 1ª vida + ~44 s na 2ª (≈ 110–120 s com a cena da volta) — a luta mais longa do jogo, como deve ser.
  // Nv.3: 150–210 s. Quem chega fraco não fica preso para sempre: o Lule CANSA (FAT1/FAT2) e leva até 2× de dano.
  const HP1 = 4400, HP2 = 2850, HOME_Y = 178;
  // Cansaço (anti-empate), contado por vida: começa aos FAT1 s na 1ª vida / FAT2 s na 2ª, chega a 2× em FAT_RAMP s.
  // (nv.5 com arma de alvo único termina cada vida antes disso)
  const FAT1 = 75, FAT2 = 50, FAT_RAMP = 35;
  // Lule (G.Art.person) é desenhado com este tamanho, centrado em (0, PY) relativo ao chefão
  const PS = 136, PY = -30, GY = 6; // GY: churrasqueira um pouco mais baixa

  // Cores de tiro (saturadas: leem bem contra o cenário e os tiros do Zé)
  const COL = {
    red: '#ff2a4a', pink: '#ff3d7f', hot: '#ff4fa3', magenta: '#ff3dd8', orange: '#ff8c1a',
    gold: '#ffb02e', ember: '#ff6a00', violet: '#c86bff', cream: '#fff1d6', meat: '#ff5a36',
  };

  // Lule: barba cheia grisalha, calvície grisalha, sobrancelhas grossas, rosto redondo,
  // terno escuro, gravata vermelha (desenhada à parte, para poder entortar), estrelinha vermelha.
  const SPEC = {
    skin: '#e9b38b', face: 'round', hair: 'gray', hairColor: '#cdd1d7', beard: 'full', beardColor: '#e4e6ea',
    brows: 'bushy', browColor: '#9fa4ab', body: 'suit', suit: '#252c3c', shirt: '#f3f3f3', tie: null,
    pin: '#e63946', pinShape: 'star', grin: true, wrinkles: true, nose: 'big', seed: 3,
  };
  const SPEC_SWEAT = Object.assign({}, SPEC, { sweat: true });
  const SPEC_PORTRAIT = Object.assign({}, SPEC, { tie: '#e63946' });

  // Falas (≤ 28 caracteres; só slogans e memes públicos)
  const TAUNTS = ['COMPANHEIRO!', 'FAZ O L!', 'O AMOR VENCEU!', 'TÁ CHEGANDO A PICANHA!', 'VOU TAXAR!', 'O BRASIL VOLTOU!', 'PICANHA E CERVEJINHA!'];
  const TAUNTS2 = ['QUARTO MANDATO!', 'O BRASIL VOLTOU!', 'FAZ O L!', 'TÁ CHEGANDO A PICANHA!', 'COMPANHEIRO!', 'O AMOR VENCEU!', 'VOU TAXAR!'];

  // Fases (o core usa 'at' em ordem decrescente)
  const PH1 = [
    { at: 1, name: 'Picanha e Cervejinha' },
    { at: 0.74, name: 'Taxa das Blusinhas' },
    { at: 0.48, name: 'Faz o L' },
    { at: 0.22, name: 'Companheirada' }, // menor: os companheiros seguram os tiros
  ];
  const PH2 = [
    { at: 1, name: 'Volta por Cima' },
    { at: 0.62, name: 'Picanha Infinita' },
    { at: 0.32, name: 'A Última Picanha' }, // o clímax precisa durar: ~1/3 da 2ª vida
  ];

  // ======================================================================
  // Utilidades
  // ======================================================================
  function pl() {
    const p = G.game && G.game.player;
    return p || { x: G.W / 2, y: G.H * 0.8, alive: false };
  }
  // chefão lutando "de verdade" (não na cena de volta)
  function fighting(b) { return !!(b && b.state === 'fight' && !b.data.reviving && G.game && G.game.boss === b); }
  // só atira com o jogador vivo (justo: nada de tiro na hora de renascer)
  function canShoot() {
    const g = G.game; if (!g) return false;
    const p = g.player, b = g.boss;
    return !!(p && p.alive && !p.entering) && fighting(b);
  }
  function shoot(x, y, ang, spd, o) {
    if (!canShoot() || G.game.eb.length > 430) return null;
    return G.fire(x, y, ang, spd, o);
  }
  function ring(x, y, n, spd, o, off) { for (let i = 0; i < n; i++) shoot(x, y, (off || 0) + (i * TAU) / n, spd, o); }
  function fan(x, y, ang, n, spread, spd, o) {
    if (n <= 1) { shoot(x, y, ang, spd, o); return; }
    for (let i = 0; i < n; i++) shoot(x, y, ang - spread / 2 + (spread * i) / (n - 1), spd, o);
  }
  function say(b, s, dur) { G.say(b, s, dur || 2.2); }
  // dica de tutorial (só no 1º mandato, uma vez por partida)
  function hint(key, str, color) {
    const run = G.run; if (!run || run.loop > 1) return;
    const h = run._luleHints || (run._luleHints = {});
    if (h[key]) return;
    h[key] = 1;
    G.text(G.W / 2, G.H * 0.56, str, { color: color || G.C.yellow, size: 14, life: 2.6, vy: -10 });
  }
  function pose(b, name, dur) { b.data.pose = name; b.data.poseT = dur || 0.8; }

  // ---------- aquecimento (evita a travadinha no 1º quadro de cada desenho novo) ----------
  // Lule: G.Art.prewarm pinta os sprites do corpo (pose × balanço × flash) em segundo plano, uma vez por chave.
  function warmPoses(b, key, spec, list) {
    const d = b.data, w = d.warmed || (d.warmed = {});
    if (w[key] || !G.Art || !G.Art.prewarm) return;
    w[key] = 1;
    G.call(G.Art, 'prewarm', list.map((ps) => ({ spec, size: PS, mood: 'normal', pose: ps })));
  }
  // Tiros: um sprite de (estilo, cor) por passo durante a entrada (updateEnter); start() termina a fila.
  const SHOTS = [['lule_picanha', COL.meat], ['lule_picanhao', COL.ember], ['lule_lata', COL.orange], ['lule_lata_f', COL.orange],
    ['lule_espuma', COL.red], ['lule_pacote', COL.orange], ['lule_blusa', COL.hot], ['lule_blusa', COL.violet], ['lule_blusa', COL.magenta],
    ['lule_estrela', COL.red], ['lule_neon', COL.pink], ['lule_neon', COL.magenta], ['rice', COL.magenta], ['orb', COL.red],
    ['small', COL.pink], ['small', COL.orange]];
  function warmShotsStep(b, n) {
    const q = b.data.warmQ; if (!q || !q.length) return;
    for (let i = 0; i < n && q.length; i++) { const p = q.shift(); G.call(G.BulletStyles, 'sprite', p[0], p[1]); }
  }

  // ---------- corrotinas (várias em paralelo) ----------
  function co(b, gen) { b.data.cos.push({ gen, wait: 0, until: null, done: false }); }
  function killCos(b) { const L = b.data.cos; for (const c of L) c.done = true; L.length = 0; }
  function runCos(b, dt) {
    const L = b.data.cos;
    for (let i = 0; i < L.length; i++) {
      const c = L[i];
      if (c.done) continue;
      if (c.wait > 0) { c.wait -= dt; if (c.wait > 0) continue; }
      if (c.until) { if (!c.until()) continue; c.until = null; }
      for (let guard = 0; guard < 40 && !c.done; guard++) {
        let r;
        try { r = c.gen.next(); } catch (err) { G.reportError(err, 'boss:lule corrotina'); c.done = true; break; }
        if (c.done) break;
        if (r.done) { c.done = true; break; }
        const v = r.value;
        if (typeof v === 'number') { c.wait += v; if (c.wait > 0) break; }
        else if (typeof v === 'function') { if (!v()) { c.until = v; break; } }
        else break; // null: próximo quadro
      }
    }
    for (let i = L.length - 1; i >= 0; i--) if (L[i].done) L.splice(i, 1);
  }

  // Lasers do Lule: se o core "adiantar" o laser (clearBullets: troca de fase, bomba, morte),
  // ele some na hora em vez de ficar letal por mais alguns quadros. Também morre se a luta parar.
  function laserGuard(l, b) {
    const last = l.data.lt == null ? l.t : l.data.lt;
    l.data.lt = l.t;
    if (l.t - last > 0.1 || !fighting(b)) { l.t = l.warn + l.life + 1; l.data.killed = true; return true; }
    return false;
  }

  // Posição da mão do Lule (side +1 = mão direita da tela, -1 = esquerda)
  const HANDS = { idle: [24, 33], up: [28, -7], point: [36, 12], wave: [27, -6], fist: [27, 1], hold: [9, 30], shrug: [34, 15] };
  function handPos(b, side) {
    const d = b.data, ps = d.pose || 'idle', s = PS / 100;
    let hx, hy;
    if (G.Art.personAnchors) {
      const A = G.Art.personAnchors(PS, { pose: ps, t: b.t, seed: SPEC.seed });
      const h = side > 0 ? A.handR : A.handL;
      hx = h.x; hy = h.y;
    } else {
      let tb = HANDS[ps] || HANDS.idle;
      if (side < 0 && (ps === 'point' || ps === 'wave')) tb = HANDS.idle;
      hx = side * tb[0] * s; hy = tb[1] * s;
    }
    return { x: b.x + hx, y: b.y + bobY(b) + PY + hy };
  }
  const bobY = (b) => Math.sin(b.t * 2.4) * 3; // o Lule flutua de leve (desenho e mãos usam o mesmo valor)

  // ======================================================================
  // Estilos de tiro 'lule_'
  // ======================================================================
  const BS = G.BulletStyles;
  function gl(x, c, blur) { x.shadowColor = c; x.shadowBlur = blur; }
  function nogl(x) { x.shadowBlur = 0; }
  function rr(x, X, Y, w, h, r) {
    x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  function starP(x, cx, cy, r1, r2, n) {
    for (let i = 0; i < n * 2; i++) {
      const a = -PI / 2 + (i * PI) / n, r = i % 2 ? r2 : r1;
      if (i === 0) x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    x.closePath();
  }
  // Fatia de picanha (com a capa de gordura!) — usada nos tiros, na grelha e no espeto
  function picanhaShape(x, k, glowC, glowB) {
    x.save(); x.scale(k, k);
    // carne (domo)
    x.beginPath();
    x.moveTo(-8, 4.5); x.quadraticCurveTo(0, 8.2, 8, 4.5); x.lineTo(7.4, -1);
    x.quadraticCurveTo(0, -8.6, -7.4, -1); x.closePath();
    if (glowC) gl(x, glowC, glowB || 6);
    x.fillStyle = '#a8392a'; x.fill();
    nogl(x);
    x.lineWidth = 1.1; x.strokeStyle = INK; x.stroke();
    // miolo ao ponto
    x.beginPath(); x.ellipse(0, 2.2, 4.6, 2.4, 0, 0, TAU); x.fillStyle = '#e2766a'; x.fill();
    // capa de gordura (a parte boa)
    x.beginPath(); x.moveTo(-7.6, -1.2); x.quadraticCurveTo(0, -9.4, 7.6, -1.2);
    x.lineCap = 'round'; x.lineWidth = 3.4; x.strokeStyle = INK; x.stroke();
    x.lineWidth = 2.2; x.strokeStyle = '#fff0cf'; x.stroke();
    // marcas da grelha
    x.beginPath(); x.moveTo(-4.5, 4.5); x.lineTo(-1, -2.5); x.moveTo(1, 5.4); x.lineTo(4.5, -1.5);
    x.lineWidth = 1.2; x.strokeStyle = 'rgba(40,10,10,0.55)'; x.stroke();
    x.restore();
  }
  BS.define('lule_picanha', { r: 6, size: 24, rotate: true, paint(x, s, c) { x.rotate(PI / 2); picanhaShape(x, 1.15, c, 7); } });
  BS.define('lule_picanhao', { r: 21, size: 66, spin: 1.2, paint(x, s, c) {
    gl(x, c, 16); x.fillStyle = c; x.globalAlpha = 0.35; x.beginPath(); x.arc(0, 0, 27, 0, TAU); x.fill(); x.globalAlpha = 1; nogl(x);
    picanhaShape(x, 3.4, c, 12);
    // chiado (vapor)
    x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 1.6; x.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(i * 9, -24); x.quadraticCurveTo(i * 9 + 4, -28, i * 9, -31); x.stroke(); }
  } });
  function canShape(x, body, band, glowC, blur) {
    x.beginPath(); rr(x, -5, -7.5, 10, 15, 2.2);
    gl(x, glowC, blur); x.fillStyle = body; x.fill(); nogl(x);
    x.fillStyle = band; x.fillRect(-5, -2.6, 10, 5.2);
    x.fillStyle = '#ffffff'; x.globalAlpha = 0.55; x.fillRect(-3.4, -6, 1.3, 12); x.globalAlpha = 1;
    x.beginPath(); x.ellipse(0, -7.2, 4.6, 1.6, 0, 0, TAU); x.fillStyle = '#dfe4ea'; x.fill();
    x.beginPath(); rr(x, -5, -7.5, 10, 15, 2.2); x.lineWidth = 1; x.strokeStyle = INK; x.stroke();
  }
  BS.define('lule_lata', { r: 5.5, size: 18, paint(x, s, c) { canShape(x, '#ffc83d', '#e63946', c, 6); } });
  BS.define('lule_lata_f', { r: 5.5, size: 20, paint(x, s, c) {
    canShape(x, '#fff6c8', '#ff7b8a', '#ffffff', 10);
    x.beginPath(); x.arc(-2.2, -8.6, 2.4, 0, TAU); x.arc(1.4, -9.4, 2.8, 0, TAU); x.arc(3.6, -7.8, 2, 0, TAU);
    x.fillStyle = '#ffffff'; x.fill();
  } });
  // espuma de cerveja: miolo branco com aro VERMELHO (amarelo confundiria com os tiros da BOCA DE URNA)
  BS.define('lule_espuma', { r: 3.4, size: 13, paint(x, s, c) {
    gl(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, 5.6, 0, TAU); x.fill(); nogl(x);
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, 3.5, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,214,120,0.9)'; x.beginPath(); x.arc(1.2, 1.2, 1.3, 0, TAU); x.fill();
  } });
  BS.define('lule_pacote', { r: 6.5, size: 20, paint(x, s, c) {
    x.beginPath(); rr(x, -7, -6, 14, 12, 1.6);
    gl(x, c, 7); x.fillStyle = '#d0904c'; x.fill(); nogl(x);
    x.fillStyle = '#a86a32'; x.fillRect(-7, -6, 14, 3.2);
    x.fillStyle = '#f5e2b4'; x.fillRect(-1.6, -6, 3.2, 12);
    x.fillStyle = '#e63946'; x.fillRect(2.4, 0.4, 4, 4);
    x.fillStyle = '#ffffff'; x.fillRect(3.4, 1.6, 2, 0.9);
    x.beginPath(); rr(x, -7, -6, 14, 12, 1.6); x.lineWidth = 1; x.strokeStyle = INK; x.stroke();
  } });
  BS.define('lule_blusa', { r: 6, size: 20, paint(x, s, c) {
    x.beginPath();
    x.moveTo(-3, -7); x.quadraticCurveTo(0, -4.6, 3, -7); x.lineTo(8, -4.4); x.lineTo(6.4, -0.6); x.lineTo(4.6, -1.4);
    x.lineTo(5, 7); x.lineTo(-5, 7); x.lineTo(-4.6, -1.4); x.lineTo(-6.4, -0.6); x.lineTo(-8, -4.4); x.closePath();
    gl(x, c, 7); x.fillStyle = c; x.fill(); nogl(x);
    x.lineWidth = 1; x.strokeStyle = INK; x.stroke();
    x.beginPath(); x.moveTo(-3, -7); x.quadraticCurveTo(0, -4.6, 3, -7); x.lineWidth = 1.4; x.strokeStyle = '#ffffff'; x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(0, 2, 1.6, 0, TAU); x.fill();
  } });
  BS.define('lule_estrela', { r: 5.5, size: 18, spin: 4, paint(x, s, c) {
    x.beginPath(); starP(x, 0, 0, 8, 3.6, 5);
    gl(x, c, 7); x.fillStyle = c; x.fill(); nogl(x);
    x.lineWidth = 1.3; x.strokeStyle = '#ffffff'; x.stroke();
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0.6, 1.6, 0, TAU); x.fill();
  } });
  BS.define('lule_neon', { r: 3.6, size: 12, paint(x, s, c) {
    gl(x, c, 8); x.fillStyle = c; x.beginPath(); x.arc(0, 0, 4.6, 0, TAU); x.fill(); nogl(x);
    x.fillStyle = '#ffe3ee'; x.beginPath(); x.arc(0, 0, 2.6, 0, TAU); x.fill();
  } });

  // ======================================================================
  // Sub-inimigo: COMPANHEIRO (estrelinha vermelha que dança a ciranda em volta do Lule)
  // ======================================================================
  G.Enemies.define('lule_companheiro', {
    hp: 18, r: 13, score: 2000, pix: 1, keepOffscreen: true, ignoreClear: true,
    init(e, o) { e.data.i = o.i || 0; e.data.R = 0; e.data.fireT = 2 + (o.i || 0) * 0.45; },
    update(e, dt, g) {
      const b = g.boss, d = e.data;
      if (!b || b.id !== 'lule' || !fighting(b)) { // a luta parou: vai embora de mansinho
        e.y -= 90 * dt; e.x += (e.x < G.W / 2 ? -60 : 60) * dt;
        if (e.t > 12 || e.y < -40) G.killEnemy(e, { silent: true });
        return;
      }
      const bd = b.data;
      d.R = M.approach(d.R, bd.compR, 150 * dt);
      const a = bd.compA + (d.i * TAU) / 8;
      e.x = b.x + Math.cos(a) * d.R;
      e.y = b.y + 6 + Math.sin(a) * d.R * 0.9;
      d.fireT -= dt;
      if (d.fireT <= 0) {
        d.fireT = M.rand(2.8, 3.8) * (L2() ? 0.8 : 1);
        if (e.y > b.y + 20 && d.R > bd.compR * 0.8) shoot(e.x, e.y, G.aim(e.x, e.y), 118, { style: 'lule_estrela', color: COL.red });
      }
    },
    // com o Lule em cena, ele mesmo desenha os companheiros POR CIMA dele (veja drawLule)
    draw(ctx, e, g) { if (!(g.boss && g.boss.id === 'lule')) drawComp(ctx, e, g.t); },
    onDeath(e, g, opts) {
      const b = g.boss;
      if (opts && opts.silent) return;
      G.text(e.x, e.y - 12, M.pick(['VOLTA AQUI!', 'COMPANHEIRO!', 'FUI!']), { color: '#ffd23f', size: 10, life: 0.8 });
      if (b && b.id === 'lule' && fighting(b) && b.data.wantComps) b.data.respawn.push(5.2);
    },
  });

  // ======================================================================
  // Ataques (peças reutilizáveis)
  // ======================================================================

  // --- Espetinhos giratórios: 4 fatias num espeto que gira e cai em arco ---
  function tossSkewers(b, d, n, k) {
    if (!canShoot()) return;
    const p = pl();
    sfx('whoosh');
    pose(b, 'wave', 0.6);
    for (let i = 0; i < n; i++) {
      const side = (i % 2 ? 1 : -1) * (k % 2 ? -1 : 1);
      const x0 = b.x + side * 40, y0 = b.y + 12;
      const tx = M.clamp(p.x + (n === 3 && i === 2 ? 0 : side * M.rand(30, 90)) + M.rand(-30, 30), 30, G.W - 30);
      const vy0 = M.rand(-150, -120), ay = 190, vmax = (L2() ? 150 : 135) * G.game.diff;
      const sk = { x: x0, y: y0, vx: (tx - x0) / 4.2, vy: vy0, ay, vmax, a: M.rand(0, PI), w: side * M.rand(2.6, 3.4), bullets: [], t: 0 };
      for (const off of [-24, -8, 8, 24]) {
        const bl = shoot(x0, y0, 0, 0, { style: 'lule_picanha', color: COL.meat, data: { sk, off }, update: skewerBulletUpd });
        if (bl) sk.bullets.push(bl);
      }
      if (sk.bullets.length) d.skewers.push(sk);
    }
  }
  function skewerBulletUpd(bl) {
    const sk = bl.data.sk, off = bl.data.off;
    const ca = Math.cos(sk.a), sa = Math.sin(sk.a);
    bl.x = sk.x + ca * off; bl.y = sk.y + sa * off;
    bl.vx = 0; bl.vy = 0;
    bl.rot = sk.a + PI / 2;
  }
  function updSkewers(d, dt) {
    const L = d.skewers;
    for (let i = L.length - 1; i >= 0; i--) {
      const sk = L[i];
      sk.t += dt;
      sk.vy = Math.min(sk.vmax, sk.vy + sk.ay * dt);
      sk.x += sk.vx * dt; sk.y += sk.vy * dt; sk.a += sk.w * dt;
      let alive = 0;
      for (const bl of sk.bullets) if (!bl.dead) alive++;
      if (!alive || sk.t > 14) L.splice(i, 1);
    }
  }

  // --- Anel de latinhas: saem girando, chacoalham e estouram em espuma ---
  function canRing(b, n, spd, off) {
    if (!canShoot()) return;
    sfx('enemy_shot2');
    for (let i = 0; i < n; i++) {
      const fuse = 1.15 + (i % 2) * 0.2;
      shoot(b.x, b.y + 6, off + (i * TAU) / n, spd, { style: 'lule_lata', color: COL.orange, accel: -100, minSpd: 26, spin: M.rand(4, 7) * (i % 2 ? 1 : -1), data: { fuse }, update: canUpd });
    }
  }
  function canUpd(bl) {
    const d = bl.data;
    if (bl.t > d.fuse && bl.style === 'lule_lata') bl.style = 'lule_lata_f'; // vai estourar!
    if (bl.style === 'lule_lata_f') {
      bl.x += Math.sin(bl.t * 70) * 0.9; // chacoalha
      if (bl.t > d.fuse + 0.38) {
        bl.dead = true;
        if (canShoot() && G.game.eb.length < 430) {
          const n = 5, off = M.rand(0, TAU);
          for (let i = 0; i < n; i++) G.fire(bl.x, bl.y, off + (i * TAU) / n, 70, { style: 'lule_espuma', color: COL.red, accel: 14, maxSpd: 108 });
          G.part({ x: bl.x, y: bl.y, type: 'ring', size: 5, life: 0.25, color: '#fff4c2' });
          G.burst(bl.x, bl.y, 5, { colors: ['#ffffff', '#fff4c2'], speed: 90, life: 0.3, size: 2.5 });
        }
        if (Math.random() < 0.3) sfx('split');
      }
    }
  }

  // --- Picanha mirada (da mão direita) ---
  function aimedPicanha(b, n, spread, spd) {
    if (!canShoot()) return;
    pose(b, 'point', 0.7);
    const h = handPos(b, 1);
    fan(h.x, h.y, G.aim(h.x, h.y), n, spread, spd, { style: 'lule_picanha', color: COL.meat });
    sfx('enemy_shot');
  }

  // --- Faixas de chuva de encomendas (Taxa das Blusinhas) ---
  function addLane(d, col, o) {
    o = o || {};
    d.lanes.push({ x: 30 + col * 60, t: 0, warn: o.warn || 1.0, dur: o.dur || 1.3, every: o.every || 0.11, acc: 0, spd: o.spd || 190, k: col });
  }
  function laneRain(d, n, o) {
    const p = pl();
    const pc = M.clamp(Math.floor(p.x / 60), 0, 5);
    const cols = [];
    if (Math.random() < 0.55) cols.push(pc);
    let guard = 0;
    while (cols.length < n && guard++ < 40) {
      const c = M.randi(0, 5);
      if (cols.every((x) => Math.abs(x - c) > 1)) cols.push(c);
    }
    for (const c of cols) addLane(d, c, o);
    sfx('siren');
  }
  function updLanes(d, dt) {
    const L = d.lanes;
    for (let i = L.length - 1; i >= 0; i--) {
      const ln = L[i];
      ln.t += dt;
      if (ln.t >= ln.warn && ln.t < ln.warn + ln.dur) {
        ln.acc -= dt;
        while (ln.acc <= 0) {
          ln.acc += ln.every;
          const blusa = (ln.k++ % 2) === 1;
          shoot(ln.x + M.rand(-15, 15), 46, DOWN + M.rand(-0.03, 0.03), ln.spd * M.rand(0.92, 1.08), {
            style: blusa ? 'lule_blusa' : 'lule_pacote', color: blusa ? M.pick([COL.hot, COL.violet, COL.magenta]) : COL.orange, spin: M.rand(-3, 3),
          });
        }
      }
      if (ln.t > ln.warn + ln.dur + 0.2) L.splice(i, 1);
    }
  }

  // --- Carimbo gigante "TAXADO!": a sombra segue o Zé, trava e o carimbo desce ---
  // A colisão é um laser invisível (cápsula 124×64) — o desenho é todo nosso.
  function dropStamp(b, d, o) {
    if (!canShoot()) return;
    o = o || {};
    const p = pl();
    const st = { x: M.clamp(p.x, 62, G.W - 62), y: M.clamp(p.y, 110, G.H - 40), t: 0, track: o.track != null ? o.track : 0.75, warn: o.warn || 1.25, slammed: false, cancel: false, rot: M.rand(-0.12, 0.12) };
    st.end = st.warn + 1.7;
    st.laser = G.laser({
      x: st.x - 30, y: st.y, ang: 0, len: 60, width: 76, warn: st.warn, life: 0.32, color: 'rgba(0,0,0,0)',
      update(l) { if (laserGuard(l, b)) { st.cancel = true; return; } l.x = st.x - 30; l.y = st.y; l.ang = 0; },
    });
    if (!st.laser) return;
    d.stamps.push(st);
    hint('stamp', 'SAIA DA SOMBRA DO CARIMBO!', '#ff8fa3');
  }
  function updStamps(d, dt) {
    const L = d.stamps, p = pl();
    for (let i = L.length - 1; i >= 0; i--) {
      const st = L[i];
      st.t += dt;
      if (st.cancel && !st.slammed) { st.fade = (st.fade || 0) + dt; if (st.fade > 0.25) L.splice(i, 1); continue; }
      if (st.t < st.track && p.alive) {
        st.x = M.approach(st.x, M.clamp(p.x, 62, G.W - 62), 300 * dt);
        st.y = M.approach(st.y, M.clamp(p.y, 110, G.H - 40), 300 * dt);
      }
      if (!st.slammed && st.t >= st.warn) {
        st.slammed = true;
        sfx('stamp');
        G.shake(6);
        G.burst(st.x, st.y, 14, { colors: ['#ffffff', '#f4f1e8', COL.red], speed: 200, life: 0.5, type: 'spark', size: 3 });
        for (let k = 0; k < 8; k++) G.part({ x: st.x + M.rand(-50, 50), y: st.y + M.rand(-20, 20), vx: M.rand(-120, 120), vy: M.rand(-160, -40), type: 'paper', size: M.rand(3, 5), life: M.rand(0.6, 1.1), color: M.pick(['#ffffff', '#f4f1e8', '#ffd23f']), drag: 0.93, grav: 200, rot: M.rand(0, TAU), vr: M.rand(-12, 12) });
      }
      if (st.t > st.end) L.splice(i, 1);
    }
  }

  // --- Formações em forma de L (giram como um corpo rígido) ---
  const L_PTS = [[0, 0], [0, -9], [0, -18], [0, -27], [9, 0], [18, 0]];
  const L_CX = 4.5, L_CY = -9; // centróide
  function fireL(cx, cy, ang, spd, rot0, w, o) {
    o = o || {};
    const g = G.game; if (!g || !canShoot()) return;
    const k = g.diff;
    const vx = Math.cos(ang) * spd * k, vy = Math.sin(ang) * spd * k;
    const delay = o.delay || 0;
    for (const pt of L_PTS) {
      const ox = pt[0] - L_CX, oy = pt[1] - L_CY;
      const c0 = Math.cos(rot0), s0 = Math.sin(rot0);
      shoot(cx + c0 * ox - s0 * oy, cy + s0 * ox + c0 * oy, ang, 0, {
        style: 'lule_neon', color: o.color || COL.pink, delay,
        update(bl) {
          const t = Math.max(0, bl.t - delay), a = rot0 + w * t, ca = Math.cos(a), sa = Math.sin(a);
          bl.x = cx + vx * t + ca * ox - sa * oy; bl.y = cy + vy * t + sa * ox + ca * oy;
          bl.vx = 0; bl.vy = 0;
        },
      });
    }
  }
  // chuva de L caindo do alto (n letras bem espaçadas)
  function lRain(n) {
    const sp = G.W / n, off = M.rand(-12, 12);
    for (let i = 0; i < n; i++) {
      const x = M.clamp(sp * (i + 0.5) + off, 24, G.W - 24);
      fireL(x, 86, DOWN + M.rand(-0.12, 0.12), 82, M.rand(0, TAU), (i % 2 ? 1 : -1) * M.rand(1, 1.6), { delay: 0.55, color: i % 2 ? COL.pink : COL.magenta });
    }
    sfx('spawn');
  }

  // --- O "L" GIGANTE: dois lasers perpendiculares saindo do letreiro de neon (mão direita) ---
  // s = +1: o L gira no sentido horário e empurra o Zé para a ESQUERDA; s = -1: anti-horário, empurra para a DIREITA.
  // O laser "de trás" termina perto do centro da tela na altura do Zé: dá para fugir sempre para o lado certo.
  function* lSweep(b, d, s, omega, delta, opts) {
    opts = opts || {};
    d.tx = G.W / 2; d.ty = HOME_Y;
    pose(b, 'up', 99);
    d.lsign = { s, pushA: null }; // letreiro de neon aceso (desenhado na mão direita)
    say(b, 'FAZ O L!', 1.8);
    sfx('charge');
    hint('lsweep', 'FIQUE DENTRO DO L!', '#ff8fc0');
    yield 0.55;
    if (!canShoot()) { d.lsign = null; pose(b, 'idle', 0.1); return; }
    const h0 = handPos(b, 1);
    const aEnd = Math.atan2(G.H * 0.8 - h0.y, G.W / 2 - s * 12 - h0.x);
    const aA0 = aEnd - s * delta;                       // laser "de trás" (o que empurra)
    const aB0 = aA0 + s * DOWN;                         // o outro lado do L
    const warn = opts.warn || 1.2, life = delta / omega + 0.25;
    const mk = (a0) => G.laser({
      x: b.x, y: b.y, ang: a0, len: 900, width: 16, warn, life, color: COL.pink,
      update(l) {
        if (laserGuard(l, b)) return;
        const h = handPos(b, 1);
        l.x = h.x; l.y = h.y;
        const u = Math.max(0, l.t - l.warn);
        l.ang = a0 + s * Math.min(delta, omega * u);
      },
    });
    const LA = mk(aA0), LB = mk(aB0);
    if (!LA || !LB) { d.lsign = null; return; }
    d.lsign.pushA = LA;
    const t0 = b.ft;
    let n = 0;
    while (b.ft - t0 < warn + life && !LA.dead) {
      yield opts.lEvery || 0.85;
      if (b.ft - t0 > warn * 0.6 && n < (opts.maxL || 5)) {
        // a outra mão arremessa um L girando na direção do Zé
        const h = handPos(b, -1);
        fireL(h.x, h.y, G.aim(h.x, h.y) + M.rand(-0.12, 0.12), opts.lSpd || 105, M.rand(0, TAU), M.rand(1.8, 2.4) * (n % 2 ? 1 : -1));
        n++;
      }
    }
    d.lsign = null;
    pose(b, 'idle', 0.1);
  }

  // --- Espiral da ciranda ---
  function* ciranda(b, d, o) {
    o = o || {};
    const arms = o.arms || 3, every = o.every || 0.12, spd = o.spd || 115, w = o.w || 1.05, seg = o.seg || 4.2;
    let a = M.rand(0, TAU), dir = Math.random() < 0.5 ? 1 : -1;
    const tEnd = o.dur ? b.ft + o.dur : Infinity;
    while (b.ft < tEnd) {
      for (let t = 0; t < seg && b.ft < tEnd; t += every) {
        for (let i = 0; i < arms; i++) shoot(b.x, b.y + 8, a + (i * TAU) / arms, spd, { style: 'rice', color: o.color || COL.magenta });
        a += dir * w * every;
        if (((t / every) | 0) % 3 === 0) sfx('enemy_shot');
        yield every;
      }
      // "volta e meia vamos dar": pausa curta e troca o sentido
      if (b.ft < tEnd) {
        G.text(b.x, b.y + 92, 'VOLTA E MEIA!', { color: '#ffd1f4', size: 11, life: 0.8, vy: -20 });
        yield 0.55;
        dir = -dir;
      }
    }
  }

  // --- Companheiros em órbita (bloqueiam os tiros do Zé) ---
  function* spawnComps(b, d, n) {
    d.wantComps = true;
    d.compR = 92;
    for (let i = 0; i < n; i++) {
      if (!fighting(b)) return;
      G.spawnEnemy('lule_companheiro', b.x, b.y + 6, { i, hp: 18 });
      sfx('spawn');
      yield 0.18;
    }
  }
  function compAlive() {
    const g = G.game; let n = 0;
    if (g) for (const e of g.enemies) if (!e.dead && e.kind === 'lule_companheiro') n++;
    return n;
  }
  function freeCompSlot() {
    const used = {};
    for (const e of G.game.enemies) if (!e.dead && e.kind === 'lule_companheiro') used[e.data.i] = 1;
    for (let i = 0; i < 8; i++) if (!used[i]) return i;
    return -1;
  }
  function killComps(silent) {
    const g = G.game; if (!g) return;
    for (const e of g.enemies) if (!e.dead && e.kind === 'lule_companheiro') G.killEnemy(e, { silent: !!silent });
  }

  // --- Picanha gigante que persegue o Zé ---
  function giantPicanha(b) {
    const h = { x: b.x, y: b.y + 40 };
    return shoot(h.x, h.y, G.aim(h.x, h.y), 40, {
      style: 'lule_picanhao', color: COL.ember, keep: true, life: 999, delay: 0.6,
      update(bl, dt) {
        const p = pl();
        const sp = Math.min((L2() ? 92 : 80) * G.game.diff, bl.spd + 40 * dt);
        bl.spd = sp;
        if (p.alive) {
          const want = Math.atan2(p.y - bl.y, p.x - bl.x);
          bl.ang += M.clamp(M.wrapAngle(want - bl.ang), -1.35 * dt, 1.35 * dt);
        }
        bl.vx = Math.cos(bl.ang) * sp; bl.vy = Math.sin(bl.ang) * sp;
        if (Math.random() < 0.25 * decoK()) G.part({ x: bl.x + M.rand(-14, 14), y: bl.y - 16, vx: M.rand(-10, 10), vy: -50, type: 'smoke', size: 4, life: 0.5, color: 'rgba(230,230,240,0.35)' });
      },
    });
  }

  // ======================================================================
  // FASES
  // ======================================================================
  function startPhase(b, idx) {
    const d = b.data;
    killCos(b);
    d.lanes.length = 0; d.stamps.length = 0; d.lsign = null;
    d.wantComps = false;
    if (d.life === 1 && idx !== 3) killComps(false);
    d.pose = 'idle'; d.poseT = 0;
    const list = d.life === 1 ? [ph1, ph2, ph3, ph4] : [ph5, ph6, ph7];
    const fn = list[M.clamp(idx, 0, list.length - 1)];
    co(b, fn(b, d));
    co(b, chatter(b, d));
  }
  // provocações aleatórias de vez em quando
  function* chatter(b, d) {
    yield M.rand(7, 9);
    for (;;) {
      if (!(b.sayT > 0)) say(b, M.pick(d.life === 1 ? TAUNTS : TAUNTS2), 2);
      yield M.rand(7.5, 10.5);
    }
  }
  function* wander(b, d, amp, every) {
    for (;;) {
      const p = pl();
      d.tx = M.clamp(G.W / 2 + (p.x - G.W / 2) * 0.35 + M.rand(-amp, amp), 95, G.W - 95);
      d.ty = HOME_Y + M.rand(-8, 6);
      yield M.rand(every * 0.8, every * 1.2);
    }
  }

  // ---------- 1. PICANHA E CERVEJINHA ----------
  function* ph1(b, d) {
    say(b, 'COMPANHEIRO!', 2);
    co(b, wander(b, d, 50, 2.4));
    yield 1.2;
    let k = 0;
    for (;;) {
      tossSkewers(b, d, L2() ? 3 : 2, k);
      yield 0.9;
      aimedPicanha(b, 3, 0.32, 150);
      yield 0.8;
      canRing(b, L2() ? 14 : 12, 165, k * 0.31);
      yield 1.1;
      aimedPicanha(b, 5, 0.6, 145);
      yield 0.6;
      if (k % 2) { tossSkewers(b, d, 2, k + 1); yield 0.6; }
      k++;
    }
  }

  // ---------- 2. TAXA DAS BLUSINHAS ----------
  function* ph2(b, d) {
    say(b, 'VOU TAXAR!', 2);
    d.tx = G.W / 2; d.ty = HOME_Y;
    yield 1.0;
    co(b, wander(b, d, 70, 3));
    // trilha A: chuva de encomendas em colunas
    co(b, (function* () { for (;;) { laneRain(d, 2, { spd: L2() ? 210 : 190 }); yield L2() ? 2.3 : 2.7; } })());
    // trilha B: carimbo TAXADO!
    co(b, (function* () { yield 1.4; for (;;) { dropStamp(b, d); say(b, 'TAXADO!', 1.2); yield L2() ? 3.0 : 3.6; } })());
    // trilha C: encomendas miradas
    yield 0.8;
    for (;;) {
      if (canShoot()) {
        pose(b, 'point', 0.7);
        const h = handPos(b, 1);
        fan(h.x, h.y, G.aim(h.x, h.y), L2() ? 5 : 3, 0.5, 140, { style: 'lule_pacote', color: COL.orange, spin: 3 });
        sfx('enemy_shot');
      }
      yield 1.75;
    }
  }

  // ---------- 3. FAZ O L ----------
  function* ph3(b, d) {
    d.tx = G.W / 2; d.ty = HOME_Y;
    yield 0.9;
    let s = pl().x > G.W / 2 ? 1 : -1; // começa empurrando o Zé para longe de onde ele está
    for (;;) {
      yield* lSweep(b, d, s, 0.3, 40 * DEG, { maxL: L2() ? 5 : 3 });
      yield 0.5;
      lRain(L2() ? 5 : 4);
      say(b, 'É O L, COMPANHEIRO!', 1.4);
      yield 1.6;
      aimedPicanha(b, 3, 0.4, 140);
      yield 1.0;
      s = -s;
    }
  }

  // ---------- 4. COMPANHEIRADA ----------
  function* ph4(b, d) {
    say(b, 'COMPANHEIRADA!', 2);
    d.tx = G.W / 2; d.ty = HOME_Y;
    yield* spawnComps(b, d, 8);
    hint('comps', 'DERRUBE OS COMPANHEIROS!', '#ffd23f');
    co(b, wander(b, d, 40, 3.5));
    yield 0.6;
    say(b, 'CIRANDA, CIRANDINHA!', 1.8);
    co(b, ciranda(b, d, { arms: L2() ? 5 : 4, every: 0.13, spd: 112, w: 0.95 }));
    // e de vez em quando a roda inteira estica e encolhe
    for (;;) {
      yield 5.5;
      d.compR = 128; sfx('whoosh');
      yield 1.6;
      d.compR = 92;
    }
  }

  // ---------- 5. VOLTA POR CIMA (remix de tudo, mais rápido) ----------
  function* ph5(b, d) {
    co(b, wander(b, d, 60, 2.2));
    yield 0.8;
    let k = 0, s = 1;
    for (;;) {
      // A: espetinhos + latinhas
      tossSkewers(b, d, 3, k);
      yield 0.8;
      canRing(b, L2() ? 14 : 12, 175, k * 0.27);
      yield 1.0;
      aimedPicanha(b, 5, 0.55, 165);
      yield 0.8;
      tossSkewers(b, d, 3, k + 1);
      yield 1.2;
      // B: carimbos + colunas
      for (let i = 0; i < 2; i++) {
        laneRain(d, 2, { spd: 215, warn: 0.9 });
        yield 0.7;
        dropStamp(b, d, { track: 0.55, warn: 1.1 }); // 0,55 s entre a trava (contorno piscando) e a batida
        yield 1.7;
      }
      yield 0.8;
      // C: o L gigante, mais rápido
      s = pl().x > G.W / 2 ? 1 : -1;
      yield* lSweep(b, d, s, 0.38, 46 * DEG, { warn: 1.1, maxL: 4, lEvery: 0.75, lSpd: 115 });
      yield 0.4;
      lRain(L2() ? 6 : 5);
      yield 1.4;
      // D: rodinha rápida de ciranda
      co(b, ciranda(b, d, { arms: 4, every: 0.13, spd: 125, w: 1.2, seg: 2.2, dur: 4.6 }));
      yield 5.2;
      k += 2;
    }
  }

  // ---------- 6. PICANHA INFINITA (desespero: espiral densa com brechas + chuva de picanha) ----------
  function* ph6(b, d) {
    say(b, 'TÁ CHEGANDO A PICANHA!', 2.4);
    d.tx = G.W / 2; d.ty = HOME_Y - 6;
    d.fire = 1;
    yield 1.0;
    // espiral de 5 braços com giro que oscila (mas nunca fecha as brechas)
    co(b, (function* () {
      let a = 0;
      const arms = L2() ? 6 : 5;
      for (;;) {
        const w = 0.82 + 0.16 * Math.sin(b.ft * 0.55);
        for (let i = 0; i < arms; i++) shoot(b.x, b.y + 10, a + (i * TAU) / arms, 120, { style: 'orb', color: COL.red });
        a += w * 0.12;
        if (Math.random() < 0.3) sfx('enemy_shot');
        yield 0.12;
      }
    })());
    // chuva de picanha lá do alto, com aviso (aparecem transparentes antes de cair)
    co(b, (function* () {
      let x = M.rand(30, G.W - 30), dx = 47;
      for (;;) {
        x += dx; if (x > G.W - 24 || x < 24) { dx = -dx; x += 2 * dx; }
        shoot(x, 52, DOWN, M.rand(125, 150), { style: 'lule_picanha', color: COL.meat, delay: 0.35, spin: M.rand(-5, 5) });
        yield L2() ? 0.26 : 0.32;
      }
    })());
    // tremedeira + picanha mirada em fila (não dá para ficar parado)
    for (let k = 0; ; k++) {
      G.shake(2.2);
      yield 1.1;
      if (k % 2 === 1 && canShoot()) {
        pose(b, 'point', 0.6);
        const h = handPos(b, 1);
        G.pat.stream(h.x, h.y, G.aim(h.x, h.y), 3, 130, 175, { style: 'lule_picanha', color: COL.meat });
        sfx('enemy_shot');
      }
    }
  }

  // ---------- 7. A ÚLTIMA PICANHA ----------
  function* ph7(b, d) {
    d.fire = 2;
    say(b, 'A ÚLTIMA PICANHA!', 2.2);
    pose(b, 'up', 1.2);
    d.tx = G.W / 2; d.ty = HOME_Y;
    sfx('charge');
    yield 0.9;
    hint('picanhao', 'FUJA DA PICANHA GIGANTE!', '#ffb02e');
    d.picanhao = giantPicanha(b);
    co(b, (function* () { // se a picanha sumir (bomba), volta outra
      for (;;) {
        yield 0.5;
        if (!d.picanhao || d.picanhao.dead) { yield 1.6; if (fighting(b)) { pose(b, 'up', 0.8); d.picanhao = giantPicanha(b); say(b, 'TEM MAIS PICANHA!', 1.4); } }
      }
    })());
    let k = 0;
    for (;;) {
      yield 1.1;
      ring(b.x, b.y + 8, L2() ? 18 : 15, 98, { style: 'small', color: k % 2 ? COL.pink : COL.orange }, k * 0.21);
      sfx('enemy_shot2');
      k++;
    }
  }

  // ======================================================================
  // A VOLTA DO LULE (cena entre as duas vidas)
  // ======================================================================
  function startRevive(b, g) {
    const d = b.data;
    d.reviving = true; d.revT = 0; d.revStep = 0;
    b.invuln = true; b.harmless = true; b.hp = 0; b.dmgMul = 1;
    b.phases = [{ at: 1, name: '' }]; b.phase = 0; // nenhuma troca de fase durante a cena
    killCos(b);
    d.lanes.length = 0; d.stamps.length = 0; d.lsign = null; d.wantComps = false; d.respawn.length = 0;
    G.clearBullets(true);
    killComps(false);
    G.call(G.Audio, 'stopMusic');
    sfx('boss_down');
    G.hitstop(0.35); G.flash(0.7, '#ffffff'); G.shake(10);
    G.addScore(150000, b.x, b.y, true);
    G.addApproval(15);
    b.sayText = null; b.sayT = 0;
  }
  function updateRevive(b, dt, g) {
    const d = b.data;
    d.revT += dt;
    const t = d.revT;
    // nada de tiro durante a cena
    for (const bl of g.eb) bl.dead = true;
    if (t < 2.3) {
      if (Math.random() < 0.3) { G.explode(b.x + M.rand(-60, 60), b.y + M.rand(-70, 50), 2, { confetti: true }); sfx('explode_m'); }
      b.x = d.revX + Math.sin(t * 40) * 1.5;
      d.dim = 0;
    } else if (d.revStep === 0) {
      d.revStep = 1;
      b.x = d.revX;
      G.explode(b.x, b.y, 4); G.flash(0.9, '#ffffff'); sfx('explode_l');
      g.stamp = { text: 'CASSADO!', t: 0, x: b.x, y: b.y };
      G.dropPix(b.x, b.y, 60);
      d.slumpTo = 1;
    }
    if (d.revStep >= 1 && d.revStep < 3) d.dim = Math.min(0.7, d.dim + dt * 0.55);
    if (d.revStep === 1 && t > 4.3) { d.revStep = 2; say(b, '...', 1.1); }
    if (d.revStep === 2 && t > 5.0 && !d.beat) { d.beat = 1; sfx('charge'); d.pinGlow = 1; }
    if (d.revStep === 2 && t > 5.7) {
      d.revStep = 3;
      // ELE VOLTOU!
      G.flash(0.85, '#ff2a4a'); G.shake(13); G.hitstop(0.12);
      sfx('laugh'); sfx('explode_l');
      G.banner('ELE VOLTOU!', 'LULE 4.0 — QUARTO MANDATO', { color: '#ff3b4e', dur: 3.2 });
      b.name = 'LULE 4.0';
      d.life = 2; d.slumpTo = 0;
      b.maxHp = HP2 * d.hpMul; b.hp = 0;
      d.refill0 = t;
      say(b, 'QUARTO MANDATO!', 2.6);
      for (let i = 0; i < 26; i++) {
        const a = (i * TAU) / 26;
        G.part({ x: b.x, y: b.y - 20, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, type: 'spark', size: 4, life: 0.7, color: i % 2 ? '#ff2a4a' : '#ffd23f', drag: 0.92 });
      }
      G.part({ x: b.x, y: b.y - 20, type: 'ring', size: 30, life: 0.6, color: '#ff2a4a' });
      // recompensa por derrubar a 1ª vida
      G.drop('power', b.x - 30, b.y + 70, { vy: -60 });
      G.drop('bomb', b.x + 30, b.y + 70, { vy: -60 });
    }
    if (d.revStep >= 3) {
      d.dim = Math.max(0, d.dim - dt * 0.6);
      b.hp = b.maxHp * M.clamp((t - d.refill0) / 2.2, 0, 1); // barra enchendo de novo
      if (Math.random() < 0.25 * (0.4 + 0.6 * decoK())) G.part({ x: b.x + M.rand(-70, 70), y: b.y + M.rand(-80, 60), vx: 0, vy: -60, type: 'spark', size: 2.5, life: 0.5, color: '#ff5d6e' });
    }
    if (d.revStep === 3 && t > d.refill0 + 2.5) {
      d.revStep = 4;
      b.hp = b.maxHp;
      const lines = G.STORY && G.STORY.boss && G.STORY.boss.lule && G.STORY.boss.lule.voltou;
      if (lines && lines.length && !G.debug.skipDialogue) G.dialogue(lines, () => finishRevive(b));
      else finishRevive(b);
    }
  }
  function finishRevive(b) {
    const d = b.data;
    if (!d.reviving) return;
    const g = G.game;
    if (!g || g.boss !== b) return;
    d.reviving = false; d.revived = true; d.life = 2;
    d.dim = 0; d.slumpTo = 0; d.pinGlow = 0;
    d.lifeT0 = b.ft; b.dmgMul = 1; d.fat = 0; // o cansaço recomeça na 2ª vida
    b.invuln = false; b.harmless = false;
    G.setBossPhases(b, PH2, 1);
    b.invulnT = 1.2;
    G.call(G.Audio, 'music', 'boss_final');
    // "FASE" é o nome das etapas e o core anuncia as fases do chefão como "Nº TURNO". Mandato novo,
    // contagem nova: depois deste vêm "2º TURNO — Picanha Infinita" e "3º TURNO — A Última Picanha".
    G.banner('NOVO MANDATO', PH2[0].name, { color: G.C.yellow, dur: 1.8, small: true });
    startPhase(b, 0);
  }

  // ======================================================================
  // DESENHO
  // ======================================================================
  const glowCache = new Map();
  function glow(c, x, y, r, color, alpha) {
    if (!(r > 0) || !(alpha > 0)) return;
    let gr = glowCache.get(color);
    if (!gr || gr.ctx !== c) {
      const g0 = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g0.addColorStop(0, color); g0.addColorStop(1, 'rgba(0,0,0,0)');
      gr = { ctx: c, g: g0 };
      glowCache.set(color, gr);
    }
    c.save(); c.translate(x, y); c.scale(r, r); c.globalAlpha *= Math.min(1, alpha);
    c.fillStyle = gr.g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
  }
  function RR(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function E(c, x, y, rx, ry, rot) { rot = rot || 0; c.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
  function inked(c, fill, lw) { c.lineWidth = (lw || 1.5) * 2; c.strokeStyle = INK; c.stroke(); c.fillStyle = fill; c.fill(); }
  function txt(c, s, x, y, size, color, o) {
    o = o || {};
    c.font = size + 'px ' + (o.font || G.FONT_DISPLAY);
    c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.stroke; c.strokeStyle = o.strokeColor || INK; c.strokeText(s, x, y, o.maxW || 999); }
    c.fillStyle = color; c.fillText(s, x, y, o.maxW || 999);
  }

  // chama de foguete (para baixo)
  function flame(c, x, y, w, len, t) {
    const L = len + Math.sin(t * 31 + x) * 2.5;
    const tear = (ww, l, col) => {
      c.beginPath(); c.moveTo(x - ww, y);
      c.bezierCurveTo(x - ww * 1.1, y + l * 0.45, x - ww * 0.35, y + l * 0.85, x, y + l);
      c.bezierCurveTo(x + ww * 0.35, y + l * 0.85, x + ww * 1.1, y + l * 0.45, x + ww, y);
      c.closePath(); c.fillStyle = col; c.fill();
    };
    tear(w * 1.2, L + 5, 'rgba(255,90,30,0.55)');
    tear(w, L, '#ff8c1a');
    tear(w * 0.62, L * 0.62, '#ffd23f');
    tear(w * 0.3, L * 0.3, '#ffffff');
  }
  // labaredas subindo (grelha pegando fogo)
  function fireTongues(c, x0, x1, y, h, t, n) {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n, ph = t * 9 + i * 1.7;
      const hh = h * (0.7 + 0.3 * Math.sin(ph)) * (i % 2 ? 0.8 : 1);
      for (const [k, col] of [[1, '#ff6a00'], [0.62, '#ffd23f']]) {
        c.beginPath(); c.moveTo(x - 7 * k, y);
        c.quadraticCurveTo(x - 6 * k, y - hh * 0.6 * k, x + Math.sin(ph) * 3, y - hh * k);
        c.quadraticCurveTo(x + 6 * k, y - hh * 0.6 * k, x + 7 * k, y);
        c.closePath(); c.fillStyle = col; c.fill();
      }
    }
  }
  // espeto com 3 pedaços de picanha (adereço na mão). ang = direção do espeto a partir da mão.
  function drawSkewerProp(c, x, y, ang, fl) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-8, 0); c.lineTo(58, 0);
    c.lineWidth = 4.4; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 2.2; c.strokeStyle = fl ? WHITE : '#cfd6df'; c.stroke();
    c.beginPath(); RR(c, -12, -3.4, 12, 6.8, 2.5); inked(c, fl ? WHITE : '#8a5a2b', 1.1);
    if (!fl) for (const px of [20, 33, 46]) { c.save(); c.translate(px, 0); picanhaShape(c, 0.95); c.restore(); }
    else { c.beginPath(); for (const px of [20, 33, 46]) E(c, px, 0, 7.5, 7); c.fillStyle = WHITE; c.fill(); }
    c.restore();
  }
  function drawCanProp(c, x, y, rot, k, fl, dent) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k);
    c.beginPath(); RR(c, -5, -7.5, 10, 15, 2.2); inked(c, fl ? WHITE : '#ffc83d', 0.9);
    if (!fl) {
      c.fillStyle = '#e63946'; c.fillRect(-5, -2.6, 10, 5.2);
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-3.4, -6, 1.3, 12);
      c.beginPath(); E(c, 0, -7.2, 4.6, 1.5); c.fillStyle = '#dfe4ea'; c.fill();
      if (dent) { c.beginPath(); c.moveTo(1, -4); c.lineTo(5, -1); c.lineTo(1.5, 2); c.lineWidth = 1; c.strokeStyle = 'rgba(16,20,24,0.6)'; c.stroke(); }
    }
    c.restore();
  }
  // gravata (desenhada à parte para poder entortar quando ele apanha)
  function drawTie(c, ang, fl) {
    const s = PS / 100;
    c.save(); c.translate(0, PY + 9.6 * s); c.rotate(ang); c.scale(s, s);
    c.beginPath();
    c.moveTo(-2.8, 0); c.lineTo(2.8, 0); c.lineTo(2, 3.6); c.lineTo(-2, 3.6); c.closePath();
    c.moveTo(-2, 3.6); c.lineTo(2, 3.6); c.lineTo(3.8, 14); c.lineTo(0, 18.6); c.lineTo(-3.8, 14); c.closePath();
    c.fillStyle = fl ? WHITE : '#e63946'; c.fill();
    c.lineWidth = 0.9; c.strokeStyle = 'rgba(16,20,24,0.55)'; c.stroke();
    c.restore();
  }
  // letreiro de neon em forma de L (luz, nunca mão)
  function drawNeonL(c, px, py, aStem, aFoot, alpha, t) {
    if (alpha <= 0) return;
    const x1 = px + Math.cos(aStem) * 54, y1 = py + Math.sin(aStem) * 54;
    const x2 = px + Math.cos(aFoot) * 34, y2 = py + Math.sin(aFoot) * 34;
    const fl = 0.82 + 0.18 * Math.sin(t * 37) * Math.sin(t * 13);
    c.save();
    c.globalAlpha *= alpha;
    glow(c, px + (x1 - px) * 0.4, py + (y1 - py) * 0.4, 60, 'rgba(255,61,127,0.55)', fl);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(px, py); c.lineTo(x2, y2);
    c.lineWidth = 15; c.strokeStyle = 'rgba(255,61,127,0.28)'; c.stroke();
    c.lineWidth = 8; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 6.5; c.strokeStyle = '#ff3d7f'; c.stroke();
    c.globalAlpha *= fl;
    c.lineWidth = 2.6; c.strokeStyle = '#ffe1ec'; c.stroke();
    c.restore();
  }
  // um companheiro (estrela vermelha sorridente, de mãos dadas na ciranda)
  function drawComp(c, e, t) {
    const fl = G.isFlash(e);
    const d = e.data;
    c.save(); c.translate(e.x, e.y);
    const bob = Math.sin(t * 8 + d.i) * 1.5;
    c.translate(0, bob);
    // bracinhos abertos (tangentes à roda)
    const g = G.game, b = g && g.boss;
    const ta = b ? Math.atan2(e.y - b.y, e.x - b.x) + DOWN : 0;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-Math.cos(ta) * 18, -Math.sin(ta) * 18); c.lineTo(Math.cos(ta) * 18, Math.sin(ta) * 18);
    c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 2.6; c.strokeStyle = fl ? WHITE : '#ff6b7a'; c.stroke();
    c.beginPath(); E(c, -Math.cos(ta) * 18, -Math.sin(ta) * 18, 3, 3); E(c, Math.cos(ta) * 18, Math.sin(ta) * 18, 3, 3);
    inked(c, fl ? WHITE : '#ffd8c2', 0.8);
    c.rotate(Math.sin(t * 5 + d.i) * 0.18);
    c.beginPath(); starP(c, 0, 0, 15, 7, 5);
    c.lineWidth = 5; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = fl ? WHITE : '#e63946'; c.fill();
    if (!fl) {
      c.beginPath(); starP(c, -1.5, -1.5, 9, 4.5, 5); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
      c.fillStyle = INK; c.beginPath(); E(c, -3.2, -1.5, 1.4, 2); E(c, 3.2, -1.5, 1.4, 2); c.fill();
      c.beginPath(); c.arc(0, 1.6, 3.4, 0.25, PI - 0.25); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke();
      c.fillStyle = 'rgba(255,170,170,0.8)'; c.beginPath(); E(c, -6, 2.4, 1.8, 1.1); E(c, 6, 2.4, 1.8, 1.1); c.fill();
    }
    c.restore();
  }

  // A churrasqueira-foguete (na frente do Lule)
  function drawGrill(c, b, d, t, fl, heat) {
    const C = (x) => (fl ? WHITE : x);
    // jatos debaixo da churrasqueira (apagam quando ele desaba)
    if (!fl && !(d.slump > 0.4)) { flame(c, -44, 63, 6.5, 13 + heat * 9, t); flame(c, 44, 63, 6.5, 13 + heat * 9, t + 0.3); }
    // pernas
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-52, 42); c.lineTo(-58, 62); c.moveTo(52, 42); c.lineTo(58, 62); c.moveTo(-22, 50); c.lineTo(-24, 62); c.moveTo(22, 50); c.lineTo(24, 62);
    c.lineWidth = 5.5; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = C('#59606e'); c.stroke();
    // bocais dos jatos
    c.beginPath(); RR(c, -52, 54, 16, 10, 3); RR(c, 36, 54, 16, 10, 3); inked(c, C('#4a505c'), 1.3);
    // grelha (topo) com brasa
    c.beginPath(); E(c, 0, 15, 77, 8.5); inked(c, C('#262a33'), 1.5);
    if (!fl) {
      for (let i = 0; i < 9; i++) {
        const x = -64 + i * 16, f = 0.55 + 0.45 * Math.sin(t * 7 + i * 1.9);
        c.globalAlpha = 0.6 + 0.4 * f;
        c.beginPath(); E(c, x, 15 + (i % 2) * 1.5, 7.5, 3.4); c.fillStyle = f > 0.6 ? '#ffb02e' : '#ff5a1f'; c.fill();
      }
      c.globalAlpha = 1;
      c.beginPath(); for (let i = -4; i <= 4; i++) { c.moveTo(i * 16 - 5, 8.5); c.lineTo(i * 16 + 5, 21.5); }
      c.lineWidth = 1.3; c.strokeStyle = 'rgba(200,205,215,0.75)'; c.stroke();
    }
    // espetinhos na grelha
    for (const [y, x0] of [[11, -60], [17, -20]]) {
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + 82, y - 2); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.lineWidth = 1.4; c.strokeStyle = C('#cfd6df'); c.stroke();
      if (!fl) for (let k = 0; k < 3; k++) { c.save(); c.translate(x0 + 18 + k * 19, y - 1 - k * 0.5); c.rotate(-0.04); picanhaShape(c, 0.62); c.restore(); }
    }
    // labaredas quando apanhou bastante
    if (heat > 0.5 && !fl) fireTongues(c, -62, 62, 14, 14 + heat * 10, t, 6);
    // tambor (meio barril vermelho)
    c.beginPath();
    c.moveTo(-74, 19); c.lineTo(74, 19); c.bezierCurveTo(74, 46, 52, 57, 0, 57); c.bezierCurveTo(-52, 57, -74, 46, -74, 19); c.closePath();
    inked(c, C(d.life === 2 ? '#b8181f' : '#cf2f2c'), 1.6);
    if (!fl) {
      c.save(); c.clip();
      c.fillStyle = 'rgba(42,24,64,0.28)'; c.fillRect(-80, 42, 160, 20);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(-80, 22, 160, 5);
      c.beginPath(); c.moveTo(-40, 19); c.quadraticCurveTo(-42, 44, -36, 56); c.moveTo(40, 19); c.quadraticCurveTo(42, 44, 36, 56);
      c.lineWidth = 3; c.strokeStyle = 'rgba(40,10,20,0.4)'; c.stroke();
      c.restore();
      // aro do tambor
      c.beginPath(); RR(c, -77, 17, 154, 5, 2.5); inked(c, '#8c1d22', 0.8);
      // plaquinha: PICANHA — EM BREVE
      c.save(); c.translate(0, 35); c.rotate(-0.04);
      c.beginPath(); RR(c, -33, -11, 66, 22, 3); inked(c, '#fff4dc', 1.2);
      txt(c, 'PICANHA', 0, -3.2, 10.5, '#d1262f', { maxW: 58 });
      c.font = '800 7px ' + G.FONT_BODY; c.fillStyle = '#3a2a20'; c.textAlign = 'center'; c.fillText('EM BREVE', 0, 6.4);
      c.restore();
      // latinhas na beirada
      drawCanProp(c, -66, 6, -0.08, 1, false, d.dmg >= 2);
      drawCanProp(c, -55, 8, 0.1, 0.92, false, false);
    }
  }

  // nuvem de fumaça (atrás do Lule); lista própria, em coordenadas do mundo
  function updSmoke(d, b, dt, heat) {
    d.smokeT -= dt;
    if (d.smokeT <= 0 && b.state !== 'warning') {
      d.smokeT = 0.16 - heat * 0.06;
      if (d.smoke.length < 10 + 16 * decoK()) d.smoke.push({ x: b.x + M.rand(-60, 60), y: b.y + 10, vx: M.rand(-8, 8), r: M.rand(5, 9), t: 0, life: M.rand(1.6, 2.4), dark: heat > 0.5 || d.slump > 0.3 });
    }
    for (let i = d.smoke.length - 1; i >= 0; i--) {
      const s = d.smoke[i];
      s.t += dt; s.y -= (34 + s.t * 10) * dt; s.x += s.vx * dt + Math.sin(s.t * 2 + i) * 6 * dt; s.r += 9 * dt;
      if (s.t > s.life) d.smoke.splice(i, 1);
    }
  }
  function drawSmoke(c, d) {
    for (const s of d.smoke) {
      const k = s.t / s.life;
      c.globalAlpha = 0.28 * (1 - k) * Math.min(1, s.t * 4);
      c.fillStyle = s.dark ? '#4a4652' : '#d7d9e0';
      c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }

  // telegrafia: faixas de chuva de encomendas
  function drawLanes(c, d) {
    for (const ln of d.lanes) {
      const warn = ln.t < ln.warn;
      const a = warn ? 0.14 + 0.14 * Math.abs(Math.sin(ln.t * 12)) : 0.07;
      const x0 = ln.x - 28;
      c.globalAlpha = a; c.fillStyle = '#ff8c1a'; c.fillRect(x0, 46, 56, G.H - 46);
      c.globalAlpha = warn ? 0.85 : 0.35;
      c.fillStyle = '#ffd9a8'; c.fillRect(x0, 46, 2, G.H - 46); c.fillRect(x0 + 54, 46, 2, G.H - 46);
      if (warn) {
        // setinhas descendo
        c.globalAlpha = 0.8; c.fillStyle = '#ffffff';
        const off = (ln.t * 120) % 70;
        for (let y = 100 + off; y < G.H - 20; y += 70) {
          c.beginPath(); c.moveTo(ln.x - 9, y - 6); c.lineTo(ln.x, y + 3); c.lineTo(ln.x + 9, y - 6); c.lineTo(ln.x + 9, y - 1); c.lineTo(ln.x, y + 8); c.lineTo(ln.x - 9, y - 1); c.closePath(); c.fill();
        }
        // caixinha "TAXA" no alto
        c.globalAlpha = 1;
        c.beginPath(); RR(c, ln.x - 15, 72, 30, 22, 3); inked(c, '#d0904c', 1.1);
        c.fillStyle = '#f5e2b4'; c.fillRect(ln.x - 2, 72, 4, 22);
        txt(c, '20%', ln.x, 84, 9, '#ffffff', { stroke: 3 });
      }
      c.globalAlpha = 1;
    }
  }
  // telegrafia + carimbo
  function drawStamps(c, d) {
    for (const st of d.stamps) {
      const fade = st.cancel ? Math.max(0, 1 - (st.fade || 0) / 0.25) : 1;
      c.save(); c.translate(st.x, st.y); c.globalAlpha = fade;
      if (!st.slammed) {
        const k = M.clamp(st.t / st.warn, 0, 1);
        const locked = st.t >= st.track;
        // sombra crescendo
        c.globalAlpha = fade * (0.18 + 0.45 * k);
        c.fillStyle = '#05060a';
        c.beginPath(); RR(c, -62 * (0.6 + 0.4 * k), -32 * (0.6 + 0.4 * k), 124 * (0.6 + 0.4 * k), 64 * (0.6 + 0.4 * k), 12); c.fill();
        // contorno da área
        c.globalAlpha = fade * (locked ? 0.6 + 0.4 * Math.abs(Math.sin(st.t * 22)) : 0.55);
        c.setLineDash([8, 6]); c.lineDashOffset = -st.t * 50;
        c.lineWidth = locked ? 3 : 2; c.strokeStyle = locked ? '#ff2a4a' : '#ff8fa3';
        c.beginPath(); RR(c, -62, -32, 124, 64, 12); c.stroke();
        c.setLineDash([]);
        // carimbo descendo do céu (grande → tamanho real)
        const sc = 1.9 - 0.9 * k * k, yy = -80 * (1 - k * k);
        c.globalAlpha = fade * (0.25 + 0.55 * k);
        c.translate(0, yy); c.scale(sc, sc); c.rotate(st.rot);
        stampBody(c, 1);
      } else {
        const u = st.t - st.warn;
        // marca de tinta "TAXADO!" (inofensiva) que vai sumindo
        const a = u < 1.1 ? 1 : Math.max(0, 1 - (u - 1.1) / 0.6);
        c.rotate(st.rot);
        c.globalAlpha = fade * a * 0.85;
        c.lineWidth = 4; c.strokeStyle = '#e63946';
        c.beginPath(); RR(c, -56, -24, 112, 48, 7); c.stroke();
        txt(c, 'TAXADO!', 0, 1, 23, '#e63946', { maxW: 100 });
        // carimbo subindo de volta
        if (u < 0.45) {
          const lift = u < 0.12 ? 0 : (u - 0.12) / 0.33;
          c.globalAlpha = fade * (1 - lift);
          c.translate(0, -lift * 70); c.scale(1 + lift * 0.6, 1 + lift * 0.6);
          stampBody(c, 1);
        }
      }
      c.restore();
    }
  }
  function stampBody(c, k) {
    // cabo de madeira + base de borracha vermelha
    c.beginPath(); RR(c, -14, -50, 28, 30, 8); inked(c, '#8a5a2b', 1.4);
    c.beginPath(); E(c, 0, -52, 16, 9); inked(c, '#a8723c', 1.4);
    c.beginPath(); RR(c, -60, -22, 120, 44, 8); inked(c, '#3a3f4a', 1.6);
    c.beginPath(); RR(c, -58, 8, 116, 14, 6); inked(c, '#e63946', 1.2);
    txt(c, 'TAXADO!', 0, -6, 17, '#ffd23f', { maxW: 100, stroke: 3 });
  }
  // setas indicando o giro do L
  function drawLSweepHints(c, d, b) {
    const ls = d.lsign; if (!ls || !ls.pushA) return;
    const l = ls.pushA;
    if (l.dead || l.t >= l.warn) return;
    const dir = ls.s; // +1 gira no sentido horário da tela
    c.save(); c.fillStyle = '#ffffff'; c.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(l.t * 10));
    for (let r = 120; r < 760; r += 95) {
      const x = l.x + Math.cos(l.ang) * r, y = l.y + Math.sin(l.ang) * r;
      if (x < -10 || x > G.W + 10 || y > G.H + 10) continue;
      const na = l.ang + dir * DOWN; // direção para onde o laser vai varrer
      c.save(); c.translate(x + Math.cos(na) * 16, y + Math.sin(na) * 16); c.rotate(na); c.scale(1.5, 1.5);
      c.beginPath(); c.moveTo(9, 0); c.lineTo(-4, -7); c.lineTo(-1, 0); c.lineTo(-4, 7); c.closePath();
      c.lineWidth = 2; c.strokeStyle = 'rgba(16,20,24,0.6)'; c.stroke(); c.fill();
      c.restore();
    }
    c.restore();
  }
  // varas dos espetinhos voadores (atrás das fatias)
  function drawSkewerRods(c, d) {
    c.lineCap = 'round';
    for (const sk of d.skewers) {
      let alive = 0;
      for (const bl of sk.bullets) if (!bl.dead) alive++;
      if (alive < 2) continue;
      const ca = Math.cos(sk.a), sa = Math.sin(sk.a);
      c.beginPath(); c.moveTo(sk.x - ca * 39, sk.y - sa * 39); c.lineTo(sk.x + ca * 39, sk.y + sa * 39);
      c.lineWidth = 3.4; c.strokeStyle = 'rgba(16,20,24,0.8)'; c.stroke();
      c.lineWidth = 1.6; c.strokeStyle = '#d8dee6'; c.stroke();
    }
  }

  // 4 estrelas douradas girando em volta da cabeça: "quarto mandato" (side -1 = metade de trás)
  function halo(c, t, fl, side) {
    const hy = PY - 14 * PS / 100 - 44;
    for (let i = 0; i < 4; i++) {
      const a = t * 2 + (i * TAU) / 4, sn = Math.sin(a);
      if ((sn >= 0) !== (side > 0)) continue;
      const sx = Math.cos(a) * 46, sy = hy + sn * 7, k = 0.85 + 0.2 * sn;
      c.beginPath(); starP(c, sx, sy, 8 * k, 3.6 * k, 5); c.lineWidth = 2.6; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = fl ? WHITE : '#ffd23f'; c.fill();
    }
  }

  function drawLule(ctx, b, g) {
    const d = b.data; if (!d || !d.cos) return;
    const c = ctx, t = b.t;
    const fl = G.isFlash(b);
    const frac = b.maxHp > 0 ? b.hp / b.maxHp : 1;
    let heat = d.life === 2 ? (d.fire ? 0.7 + 0.3 * d.fire : 0.35) : (b.state === 'fight' ? M.clamp((0.5 - frac) * 2, 0, 1) : 0);
    if (d.reviving && d.revStep >= 1 && d.revStep < 3) heat = 0; // desmaiado: só fumacinha
    const leaving = b.state === 'leaving', dying = b.state === 'dying';
    // fora da luta o core não chama update: anima fumaça e queda aqui
    if (b.state !== 'fight') {
      const dt = M.clamp(g.t - (d.lastT == null ? g.t : d.lastT), 0, 0.05);
      updSmoke(d, b, dt, dying ? 1 : 0);
      d.slump = dying ? Math.min(0.45, b.t * 0.5) : leaving ? M.approach(d.slump, 0, dt * 2) : d.slump;
    }
    d.lastT = g.t;

    // tela escurecendo na cena da volta (o Lule fica "no holofote")
    if (d.dim > 0) {
      c.fillStyle = 'rgba(4,4,10,' + d.dim.toFixed(3) + ')';
      c.fillRect(-30, -30, G.W + 60, G.H + 60);
      glow(c, b.x, b.y, 170, 'rgba(255,240,200,0.18)', 1);
    }
    drawLanes(c, d);
    drawSmoke(c, d);
    // aura do 4º mandato
    if (d.life === 2 && !fl) {
      const pul = 0.85 + 0.15 * Math.sin(t * 5);
      glow(c, b.x, b.y - 14, 160 * pul, 'rgba(255,36,56,0.95)', 1);
      if (G.quality === 'high') glow(c, b.x, b.y - 50, 80, 'rgba(255,210,63,0.5)', pul); // brilho extra
    }

    const bob = bobY(b);
    c.save();
    c.translate(b.x, b.y + bob);
    // desabando (cena da volta / morte)
    const sl = d.slump;
    if (sl > 0) { c.translate(0, 66); c.rotate(-0.42 * sl); c.translate(0, -66 + 22 * sl); }
    if (leaving) c.rotate(Math.sin(t * 6) * 0.08);

    // ----- mood / boca -----
    let mood = 'smug', mouth = 0, ps = d.pose || 'idle';
    if (d.moodT > 0) mood = d.moodOv;
    if (b.sayT > 0) { mood = d.life === 2 ? 'laugh' : 'normal'; mouth = 0.25 + 0.55 * Math.abs(Math.sin(t * 15)); }
    if (d.life === 2 && frac < 0.1 && b.state === 'fight' && !(b.sayT > 0)) mood = 'angry';
    if (dying) { mood = 'hurt'; mouth = 0.5; ps = 'shrug'; }
    if (leaving) { mood = 'laugh'; ps = 'wave'; }
    if (d.reviving) {
      if (d.revStep < 1) { mood = 'hurt'; ps = 'shrug'; mouth = 0.6; }
      else if (d.revStep < 3) { mood = 'hurt'; ps = 'idle'; mouth = 0; }
      else { mood = 'laugh'; ps = 'up'; }
    }
    if (b.state === 'talk' || b.state === 'enter') { mood = 'smug'; }

    // ----- Lule -----
    const p = pl();
    const lookX = M.clamp((p.x - b.x) / 120, -1, 1), lookY = M.clamp((p.y - b.y) / 220, -1, 1) * 0.7;
    const spec = d.dmg >= 1 || d.life === 2 ? SPEC_SWEAT : SPEC;
    if (d.life === 2) halo(c, t, fl, -1);
    G.Art.person(c, 0, PY, PS, spec, { t, mood, mouth, flash: fl, pose: ps, lookX: d.revStep === 1 || d.revStep === 2 ? 0 : lookX, lookY, autoLook: false });
    drawTie(c, d.life === 2 ? 0.05 : d.dmg >= 1 ? 0.32 + Math.sin(t * 3) * 0.06 : 0.02, fl);
    // estrelinha pulsando (o "coração" voltando a bater)
    if (d.pinGlow > 0 && !fl) glow(c, -14.5 * PS / 100, PY + 19 * PS / 100, 22 + 8 * Math.sin(t * 14), 'rgba(255,60,80,0.9)', 1);
    if (d.life === 2) halo(c, t, fl, 1);

    // ----- churrasqueira na frente -----
    c.translate(0, GY);
    drawGrill(c, b, d, t, fl, leaving ? 1 : heat);
    c.translate(0, -GY);

    // ----- adereços nas mãos -----
    const hr = handPos(b, 1), hl = handPos(b, -1);
    const hrx = hr.x - b.x, hry = hr.y - b.y - bob, hlx = hl.x - b.x, hly = hl.y - b.y - bob;
    const ls = d.lsign;
    if (!ls) {
      let ang;
      if (ps === 'idle') ang = PI + 0.12;                        // grelhando
      else if (ps === 'point') ang = Math.atan2(p.y - hr.y, p.x - hr.x); // apontando o espeto pro Zé
      else if (ps === 'up' || ps === 'wave') ang = -1.05 + Math.sin(t * 9) * 0.12;
      else ang = -0.4;
      drawSkewerProp(c, hrx, hry, ang, fl);
    }
    drawCanProp(c, hlx, hly - 4, ps === 'up' ? -0.25 : 0.12, 1.25, fl, d.dmg >= 2);
    // letreiro de neon do L (luz, segurado na mão direita); os lasers saem do canto dele
    if (ls) drawNeonL(c, hrx, hry, -PI / 2, 0, Math.min(1, (d.lsignT || 0) * 5), t);
    c.restore();

    // companheiros (por cima do Lule)
    for (const e of g.enemies) if (!e.dead && e.kind === 'lule_companheiro') drawComp(c, e, g.t);
    drawSkewerRods(c, d);
    drawLSweepHints(c, d, b);
    drawStamps(c, d);
    // CARNÊ 12x esvoaçando quando ele foge
    if (leaving) {
      c.save(); c.translate(b.x + 20, b.y + 66);
      c.rotate(0.15 + Math.sin(t * 7) * 0.12);
      c.beginPath(); RR(c, -6, 0, 60, 18, 2); inked(c, '#fff4dc', 1);
      c.font = '800 9px ' + G.FONT_BODY; c.fillStyle = '#d1262f'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('CARNÊ 12x', 24, 9.5);
      c.restore();
    }
    // balão de fala logo abaixo da barra de vida
    b.bubbleY = b.y - Math.max(104, b.y - 86);
  }

  // ======================================================================
  // DEFINIÇÃO DO CHEFÃO
  // ======================================================================
  const HB = [[-46, 42, 25], [46, 42, 25], [0, 46, 26], [0, -4, 28], [0, -49, 36]]; // grelha primeiro (o jato para nela)

  G.Bosses.define('lule', {
    name: 'LULE', title: 'O Picanheiro', hp: HP1, r: 44, homeY: HOME_Y,
    score: 500000, pix: 400, music: 'boss_final', defeatText: 'A CONTA CHEGOU!',
    phases: PH1,
    init(b) {
      const d = b.data;
      d.cos = []; d.lanes = []; d.stamps = []; d.skewers = []; d.smoke = []; d.respawn = [];
      d.smokeT = 0; d.life = 1; d.pose = 'idle'; d.poseT = 0; d.moodT = 0; d.moodOv = 'hurt';
      d.compA = 0; d.compR = 92; d.wantComps = false; d.dim = 0; d.slump = 0; d.slumpTo = 0; d.dmg = 0;
      d.tx = b.homeX; d.ty = HOME_Y; d.hitAcc = 0;
      d.hpMul = b.maxHp / HP1; // 2º mandato: o core já multiplicou o HP
      b.hitboxes = HB.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      b.phases = PH1.slice();
      warmPoses(b, 'p1', SPEC, ['idle', 'wave', 'point']);
      d.warmQ = SHOTS.slice();
    },
    updateEnter(b) { warmShotsStep(b, 1); },
    start(b) { warmShotsStep(b, 99); startPhase(b, 0); },
    update(b, dt, g) {
      const d = b.data;
      d.poseT -= dt; if (d.poseT <= 0 && d.pose !== 'idle' && !d.lsign) d.pose = 'idle';
      d.lsignT = d.lsign ? (d.lsignT || 0) + dt : 0;
      d.moodT -= dt;
      d.slump = M.approach(d.slump, d.slumpTo, dt * 2.2);
      const heat = d.life === 2 ? 0.6 : M.clamp((0.5 - b.hp / b.maxHp) * 2, 0, 1);
      updSmoke(d, b, dt, heat);
      if (d.reviving) { updateRevive(b, dt, g); return; }
      // cansaço por vida: a luta de quem chega fraco não vira um moedor sem fim (bons jogadores nem percebem)
      const lf = b.ft - (d.lifeT0 || 0), fat = M.clamp((lf - (d.life === 1 ? FAT1 : FAT2)) / FAT_RAMP, 0, 1);
      b.dmgMul = 1 + fat; d.fat = fat;
      if (fat > 0 && d.fatSaid !== d.life) {
        d.fatSaid = d.life;
        say(b, d.life === 1 ? 'TÔ CANSADO, COMPANHEIRO...' : 'ESSE MANDATO TÁ PESADO...', 2.2);
        G.text(b.x, b.y + 84, 'CANSOU!', { color: G.C.yellow, size: 14, life: 1.4 });
      }
      const frac = b.hp / b.maxHp;
      d.dmg = d.life === 1 ? (frac < 0.25 ? 2 : frac < 0.5 ? 1 : 0) : 2;
      // movimento suave
      const f = 1 - Math.exp(-2.2 * dt);
      b.x += (M.clamp(d.tx, 80, G.W - 80) - b.x) * f;
      b.y += (d.ty - b.y) * f;
      d.compA += dt * (L2() ? 1.05 : 0.85);
      // 4º mandato: faíscas vermelhas e douradas subindo em volta dele
      if (d.life === 2 && Math.random() < dt * 10 * decoK()) {
        const a = M.rand(0, TAU);
        G.part({ x: b.x + Math.cos(a) * 78, y: b.y - 10 + Math.sin(a) * 70, vx: 0, vy: M.rand(-70, -40), type: 'spark', size: 2.4, life: 0.55, color: Math.random() < 0.7 ? '#ff3b4e' : '#ffd23f', drag: 0.96 });
      }
      // companheiros que caíram voltam depois de um tempinho
      if (d.wantComps) {
        for (let i = d.respawn.length - 1; i >= 0; i--) {
          d.respawn[i] -= dt;
          if (d.respawn[i] <= 0) {
            d.respawn.splice(i, 1);
            const slot = freeCompSlot();
            if (slot >= 0 && compAlive() < 8) { G.spawnEnemy('lule_companheiro', b.x, b.y + 6, { i: slot, hp: 18 }); sfx('spawn'); }
          }
        }
      }
      runCos(b, dt);
      updSkewers(d, dt);
      updLanes(d, dt);
      updStamps(d, dt);
    },
    onPhase(b, idx) {
      const d = b.data;
      if (d.reviving) return;
      // o que vem a seguir: suado (HP < 50% e a 2ª vida inteira), a cena da volta e os espetinhos da 2ª vida
      if (d.life === 1 && idx === 1) warmPoses(b, 'sw', SPEC_SWEAT, ['idle', 'point', 'up']);
      if (d.life === 1 && idx === 3) warmPoses(b, 'sw2', SPEC_SWEAT, ['shrug', 'wave']);
      startPhase(b, idx);
    },
    onHit(b, dmg) {
      const d = b.data;
      d.hitAcc += dmg;
      if (dmg >= 40) { d.moodT = 0.6; d.moodOv = 'hurt'; }
    },
    onDefeat(b, g) {
      const d = b.data;
      if (d.reviving) return true;              // nunca morre no meio da cena
      if (!d.revived) { d.revX = b.x; startRevive(b, g); return true; }
      return false;                             // 2ª vez: agora é de verdade
    },
    onDeath(b, g) {
      const d = b.data;
      killCos(b);
      d.lanes.length = 0; d.stamps.length = 0; d.skewers.length = 0; d.lsign = null; d.wantComps = false; d.respawn.length = 0;
      d.reviving = false; d.dim = 0; d.fire = 0; d.picanhao = null;
      for (const l of g.lasers) if (l.data && l.data.lt != null) { l.t = l.warn + l.life + 1; }
      say(b, 'TÁ BOM, TÁ BOM!', 2.4);
      d.slumpTo = 0.5;
    },
    draw(ctx, b, g) { drawLule(ctx, b, g); },
  });

  // ======================================================================
  // RETRATO (diálogos)
  // ======================================================================
  G.Portraits.define('lule', function (ctx, x, y, size, o) {
    o = o || {};
    const t = o.t || 0, mood = o.mood || 'smug';
    const g = G.game, four = !!(g && g.boss && g.boss.id === 'lule' && g.boss.data && g.boss.data.life === 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.clip();
    if (four) glow(ctx, x, y - size * 0.05, size * 0.6, 'rgba(255,40,60,0.5)', 1);
    const sp = size * 1.2, py = y + size * 0.14;
    G.Art.person(ctx, x, py, sp, four ? Object.assign({}, SPEC_PORTRAIT, { sweat: true }) : SPEC_PORTRAIT,
      { t, mood: mood === 'normal' ? 'smug' : mood, mouth: o.mouth, pose: 'up', lookX: o.lookX != null ? o.lookX : -0.3, lookY: 0.1, autoLook: false });
    // espeto de picanha na mão erguida
    const s = sp / 100;
    const hx = x + 28 * s, hy = py - 7 * s;
    ctx.save(); ctx.translate(hx, hy); ctx.scale(s * 0.72, s * 0.72);
    drawSkewerProp(ctx, 0, 0, -1.72 + Math.sin(t * 3) * 0.06, false);
    ctx.restore();
    if (four) {
      for (let i = 0; i < 4; i++) {
        const a = t * 2.2 + (i * TAU) / 4;
        if (Math.sin(a) < -0.2) continue;
        ctx.beginPath(); starP(ctx, x + Math.cos(a) * 34 * s, py - 50 * s + Math.sin(a) * 7 * s, 7 * s, 3.2 * s, 5);
        ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#ffd23f'; ctx.fill();
      }
    }
    ctx.restore();
  });
})();
