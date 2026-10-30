/* ============================================================
   FUSCA A JATO — stages.js
   As 4 fases e seus roteiros de ondas (geradores).
   Ordem e chefões fixos: rodoviaria→centrao, esplanada→dilmae,
   paranoa→erika, planalto→lule. Contrato: docs/ENGINE.md §6.
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Stages) return;
  const M = G.m;
  const W = () => G.W, H = () => G.H;
  const now = () => (G.game ? G.game.t : 0);
  const sp = (kind, x, y, o) => G.spawnEnemy(kind, x, y, o || {});
  const opt = (o, i) => (typeof o === 'function' ? o(i) : Object.assign({}, o || {}));

  // ======================================================================
  // Tempo e trilhas paralelas
  // ======================================================================
  // espera até o tempo absoluto da fase
  const at = (t) => () => now() >= t;
  const noEnemies = () => !G.game.enemies.some((e) => !e.dead && !e.ignoreClear);
  // Roda várias trilhas ao mesmo tempo. Cada trilha é um gerador que pode dar yield de
  // segundos, de função-condição, de 'clear' ou de {until, timeout}.
  function* par(...gens) {
    const tracks = gens.filter(Boolean).map((g) => ({ g, wake: 0, cond: null, to: 0, done: false }));
    for (;;) {
      const t = now();
      let alive = 0;
      for (const tr of tracks) {
        let guard = 0;
        while (!tr.done && guard++ < 60) {
          if (tr.cond) {
            let ok = false;
            try { ok = tr.cond(); } catch (err) { ok = true; }
            if (!ok && t < tr.to) break;
            tr.cond = null;
          } else if (t < tr.wake) break;
          const r = tr.g.next();
          if (r.done) { tr.done = true; break; }
          const v = r.value;
          if (typeof v === 'number') tr.wake = t + v;
          else if (typeof v === 'function') { tr.cond = v; tr.to = t + 60; }
          else if (v === 'clear') { tr.cond = noEnemies; tr.to = t + 25; }
          else if (v && typeof v === 'object' && v.until) { tr.cond = v.until; tr.to = t + (v.timeout || 60); }
          else tr.wake = t + 0.0001;
        }
        if (!tr.done) alive++;
      }
      if (!alive) return;
      yield 0.001; // próximo quadro
    }
  }
  // atrasa um gerador
  function* after(s, gen) { yield s; yield* gen; }

  // ======================================================================
  // Caminhos (curvas Bézier, coordenadas da tela) e formações
  // ======================================================================
  const PATHS = {
    // U: desce pela esquerda, curva embaixo e sobe pela direita
    uL: () => [[52, -24], [36, H() * 0.62], [W() - 36, H() * 0.62], [W() - 52, -44]],
    // cruza do alto-esquerdo para a direita, descendo
    crossL: () => [[-24, 76], [W() * 0.35, 36], [W() * 0.62, H() * 0.48], [W() + 34, H() * 0.42]],
    // S descendo a tela toda
    sL: () => [[W() * 0.18, -24], [W() * 1.05, H() * 0.2], [-W() * 0.05, H() * 0.42], [W() * 0.82, H() + 40]],
    // gancho: entra pela lateral no meio e sai por cima
    hookL: () => [[-24, H() * 0.44], [W() * 0.55, H() * 0.56], [W() * 0.85, H() * 0.22], [W() * 0.5, -44]],
    // conga dos ministros: zigue-zague em três curvas, sai pela direita
    conga: () => [[-24, 80], [W() * 0.5, 30], [W() * 0.9, 90], [W() * 0.75, H() * 0.25], [W() * 0.6, H() * 0.38], [W() * 0.1, H() * 0.28],
      [W() * 0.2, H() * 0.45], [W() * 0.3, H() * 0.57], [W() * 0.9, H() * 0.5], [W() + 40, H() * 0.42]],
    // mergulho em laço: desce, dá a volta e sai por baixo da lateral
    loopL: () => [[W() * 0.3, -24], [W() * 0.3, H() * 0.55], [W() * 0.85, H() * 0.5], [W() * 0.7, H() * 0.25],
      [W() * 0.55, H() * 0.05], [W() * 0.1, H() * 0.2], [-40, H() * 0.42]],
  };
  // mirror=true espelha da direita para a esquerda
  function path(name, mirror) { const p = PATHS[name](); return mirror ? p.map((q) => [W() - q[0], q[1]]) : p; }
  // um inimigo seguindo uma curva
  function fly(kind, pts, dur, o) { return sp(kind, pts[0][0], pts[0][1], Object.assign({ pts, dur }, o || {})); }
  // vários na mesma curva, um atrás do outro (cobrinha)
  function* swarm(kind, n, gap, pts, dur, o) { for (let i = 0; i < n; i++) { fly(kind, pts, dur, opt(o, i)); if (i < n - 1) yield gap; } }
  // fileira horizontal simultânea
  function row(kind, n, y, o, margin) {
    const m = margin != null ? margin : 40;
    for (let i = 0; i < n; i++) sp(kind, n === 1 ? W() / 2 : m + (i * (W() - 2 * m)) / (n - 1), y, opt(o, i));
  }
  // formação em V (ponta embaixo)
  function vee(kind, n, cx, o, dx, dy) {
    dx = dx || 34; dy = dy || 26;
    for (let i = 0; i < n; i++) {
      const k = Math.ceil(i / 2), s = i % 2 ? -1 : 1;
      sp(kind, M.clamp(cx + s * k * dx, 16, W() - 16), -24 - k * dy, opt(o, i));
    }
  }
  // fila entrando pela lateral (emboscada)
  function* side(kind, n, fromLeft, y, gap, o) {
    for (let i = 0; i < n; i++) {
      sp(kind, fromLeft ? -24 : W() + 24, y, Object.assign({ path: 'side', dir: fromLeft ? 1 : -1, spd: 120 }, opt(o, i)));
      if (i < n - 1) yield gap;
    }
  }
  // chuvisco de pipoca em x aleatório
  function* drizzle(kind, dur, every, o) {
    const end = now() + dur;
    let i = 0;
    while (now() < end) { sp(kind, M.rand(30, W() - 30), -22, opt(o, i++)); yield every; }
  }
  // bando de motoboys da picanha passando pela lateral (alturas escalonadas)
  function* moto(n, fromLeft, y0, dy, gap, o) {
    for (let i = 0; i < n; i++) {
      sp('motoqueiro', fromLeft ? -30 : W() + 30, y0 + i * dy, Object.assign({ dir: fromLeft ? 1 : -1 }, opt(o, i)));
      if (i < n - 1) yield gap;
    }
  }
  // enxame de bots fazendo curva
  function* bots(n, fromLeft, y, o) {
    const x = fromLeft ? -16 : W() + 16;
    for (let i = 0; i < n; i++) {
      sp('bot', x, y, Object.assign({ path: 'curve', ang: fromLeft ? 0.35 : Math.PI - 0.35, spd: 150, turn: fromLeft ? 0.75 : -0.75, turnStop: 2.6 }, opt(o, i)));
      if (i < n - 1) yield 0.16;
    }
  }
  // enxame de bots descendo do alto em S
  function* botRain(n, x, o) {
    for (let i = 0; i < n; i++) {
      sp('bot', x, -16, Object.assign({ path: 'curve', ang: Math.PI / 2, spd: 135, turn: 1.4, flip: 1.1, phase: 0 }, opt(o, i)));
      if (i < n - 1) yield 0.17;
    }
  }
  // carregador de item (o brilho e o ícone vêm do enemies.js)
  function carrier(kind, x, y, item, o) { return sp(kind, x, y, Object.assign({ drop: item || 'power' }, o || {})); }
  // Pipoca de fundo: pequenas formações quando a tela está calma. Não segura o 'clear',
  // some durante chefes intermediários e na apresentação de um inimigo novo.
  function* ambient(kinds, every, flag) {
    let i = 0;
    while (!flag.done) {
      yield every * M.rand(0.8, 1.25) * (G.game.loop > 1 ? 0.75 : 1);
      if (flag.done) return;
      const g = G.game;
      let alive = 0, busy = false;
      for (const e of g.enemies) {
        if (e.dead) continue;
        alive++;
        if (e.big || (e.data && e.data.tag && e.data.tagT < 3.4)) busy = true;
      }
      if (busy || alive > 9) continue;
      const kind = kinds[i++ % kinds.length], fromLeft = Math.random() < 0.5;
      const o = { ambient: true, fire: 0.5 };
      const pat = M.randi(0, 2);
      if (pat === 0) { // dupla mergulhando
        const x = M.rand(60, W() - 60);
        sp(kind, x - 20, -22, Object.assign({ vy: 88, amp: 22, phase: 0 }, o));
        sp(kind, x + 20, -46, Object.assign({ vy: 88, amp: 22, phase: 0 }, o));
      } else if (pat === 1) { // trio cruzando pela lateral
        const y = M.rand(78, 150);
        for (let k = 0; k < 3; k++) sp(kind, fromLeft ? -24 - k * 30 : W() + 24 + k * 30, y + k * 8, Object.assign({ path: 'side', dir: fromLeft ? 1 : -1, spd: 128 }, o));
      } else { // trio na curva
        const pts = path('crossL', !fromLeft);
        for (let k = 0; k < 3; k++) { fly(kind, pts, 5.2, o); yield 0.36; }
      }
    }
  }
  // roda as ondas da fase com a pipoca de fundo junto
  function* withAmbient(body, kinds, every, start) {
    const flag = { done: false };
    yield* par((function* () { yield* body(); flag.done = true; })(), after(start, ambient(kinds, every, flag)));
  }
  // Aquecimento dos sprites (enemies.js): chamar uns segundos antes de um tipo novo entrar.
  // Repetir não custa nada (cada tipo é pintado uma vez por resolução).
  function pre(...kinds) { G.call(G.EnemyArt, 'prewarm', kinds); } // sem enemies.js (mods=): nada
  // Tipos das primeiras ondas: pintados já na apresentação da fase / diálogo de abertura
  // (o roteiro só começa depois) e de novo no começo do roteiro (com skipui não há apresentação).
  const OPENING = {
    rodoviaria: ['cabo', 'fantasma'],
    esplanada: ['deputado', 'cabo', 'fantasma', 'assessor'],
    paranoa: ['sindicalista', 'assessor', 'deputado', 'cabo', 'bot'],
    planalto: ['lobista', 'deputado', 'marqueteiro', 'cabo', 'ministro'],
  };
  let introWarm = null;
  setInterval(function () {
    const g = G.game;
    if (!g || g.script || introWarm === g || !g.stage || (G.state !== 'intro' && G.state !== 'dialogue')) return;
    introWarm = g;
    pre(...(OPENING[g.stage.id] || []));
  }, 250);
  // Sinais para o cenário (bg.js): g.progress (0..1, sobe nos marcos do roteiro; 1 = chegada do chefão)
  // e g.landmark (id do cartão-postal que deve passar agora: 'itamaraty' na Esplanada, 'jk' no Paranoá).
  // Também chama G.BG.landmark(id, g) se o bg.js tiver.
  function mark(p, landmark) {
    const g = G.game; if (!g) return;
    if (!(g.progress >= p)) g.progress = p;
    if (landmark) { g.landmark = landmark; G.call(G.BG, 'landmark', landmark, g); }
  }

  // chefe intermediário: entra e espera ele cair (ou fugir)
  function* midboss(kind, x, y, o) {
    const mb = sp(kind, x, y, o);
    if (!mb) return;
    yield { until: () => mb.dead, timeout: 80 };
    yield 1.4;
  }

  // ======================================================================
  // FASE 1 — RODOVIÁRIA DO PLANO (ensina tudo com calma)
  // inimigos: cabo → fantasma → deputado → carro de som; meio: Trio Elétrico
  // ======================================================================
  G.Stages.add({
    id: 'rodoviaria', name: 'Rodoviária do Plano', subtitle: 'A campanha começou',
    bg: 'rodoviaria', music: 'stage1', bossMusic: 'boss', boss: 'centrao', scrollSpeed: 40,
    script: function* (S) {
      const L2 = S.g.loop > 1;
      const T0 = now();
      const T = (s) => at(T0 + s);
      mark(0); pre(...OPENING.rodoviaria);
      yield* withAmbient(function* () {
        yield 1.8;
        // --- cabos eleitorais: primeiro só desfilam, depois começam a jogar santinho ---
        row('cabo', 5, -22, (i) => ({ vy: 62, fire: 0, v: i }), 60);
        yield T(5.5);
        yield* swarm('cabo', 6, 0.42, path('uL'), 6.5, (i) => ({ fire: 0.5, v: i }));
        yield T(10);
        yield* swarm('cabo', 6, 0.42, path('uL', true), 6.5, (i) => ({ fire: 0.5, v: i + 1 }));
        yield T(14);
        vee('cabo', 5, W() / 2, { vy: 72, fire: 0.7 });
        if (L2) vee('cabo', 4, W() / 2, { vy: 72 }, 60, 20);
        yield T(17);
        carrier('cabo', W() / 2, -22, 'power', { ty: 150, hold: 4.5, hp: 8, fire: 0.5, v: 0 });
        yield T(19.5);
        // emboscada pelas laterais
        yield* par(side('cabo', 4, true, 96, 0.5, { fire: 0.6 }), after(1.3, side('cabo', 4, false, 136, 0.5, { fire: 0.6 })));
        yield S.clear(6);
        // --- VEREADOR FANTASMA (sozinho, para ler) ---
        mark(0.15);
        yield 0.6;
        sp('fantasma', W() / 2, -30, { tx: W() / 2, ty: 140, delay: 0.6 });
        yield 4;
        yield* par(
          swarm('cabo', 5, 0.5, path('sL'), 7, { fire: 0.4 }),
          after(2.2, swarm('cabo', 5, 0.5, path('sL', true), 7, { fire: 0.4 })));
        yield T(36);
        pre('deputado', 'carro_som');
        sp('fantasma', 70, -30, { tx: 80, ty: 120 });
        sp('fantasma', W() - 70, -30, { tx: W() - 80, ty: 170, delay: 1.4 });
        row('cabo', 6, -22, { vy: 70, amp: 18, freq: 2.5, fire: 0.6 });
        yield T(41);
        carrier('cabo', 60, -22, 'power', { ty: 120, tx: 90, hold: 4, hp: 8 });
        yield* par(
          swarm('cabo', 6, 0.38, path('crossL'), 5.5, { fire: 0.6 }),
          after(1.6, swarm('cabo', 6, 0.38, path('crossL', true), 5.5, { fire: 0.6 })));
        yield S.clear(5);
        // --- DEPUTADO DO CENTRÃO ---
        mark(0.3);
        yield 0.6;
        sp('deputado', W() / 2, -30, { ty: 140, hold: 5.5 });
        yield 1.5;
        row('cabo', 4, -22, { vy: 70, fire: 0.5 }, 50);
        yield T(55);
        sp('deputado', 90, -30, { ty: 120 });
        sp('deputado', W() - 90, -30, { ty: 160 });
        if (L2) sp('deputado', W() / 2, -30, { ty: 100 });
        yield* swarm('cabo', 5, 0.45, path('uL'), 6, { fire: 0.6 });
        yield T(61);
        // respiro com cafezinho
        carrier('cabo', W() / 2, -22, 'cafe', { vy: 60, amp: 30, hp: 6, fire: 0 });
        yield T(64);
        carrier('deputado', W() * 0.3, -30, 'power', { ty: 130, hp: 16 });
        // crescendo
        yield* par(
          drizzle('cabo', 9, L2 ? 0.45 : 0.65, () => ({ vy: M.rand(70, 95), fire: 0.5 })),
          after(2, (function* () { sp('fantasma', W() * 0.7, -30, { ty: 150 }); })()),
          after(5, (function* () { sp('deputado', W() * 0.75, -30, { ty: 110 }); })()));
        yield S.clear(5);
        // --- CARRO DE SOM (ensina a brecha antes do trio) ---
        mark(0.45);
        yield 0.8;
        sp('carro_som', W() / 2, -36, { vy: 26 });
        yield 3;
        yield* par(side('cabo', 3, true, 110, 0.6, { fire: 0.5 }), after(2.5, side('cabo', 3, false, 150, 0.6, { fire: 0.5 })));
        yield T(85);
        pre('trio');
        yield* swarm('cabo', 6, 0.4, path('hookL'), 5.5, { fire: 0.5 });
        sp('deputado', W() * 0.7, -30, { ty: 120 });
        yield T(89);
        carrier('cabo', W() / 2, -22, 'power', { ty: 140, hold: 3.5, hp: 8, fire: 0 });
        yield S.clear(7);
        // --- CHEFE INTERMEDIÁRIO: TRIO ELÉTRICO DO CANDIDATO ---
        mark(0.6);
        yield 0.5;
        yield* midboss('trio', W() / 2, -110);
        const R = now();
        const Rt = (s) => at(R + s);
        // --- reta final ---
        mark(0.78);
        yield* par(side('cabo', 5, true, 90, 0.42, { fire: 0.7 }), side('cabo', 5, false, 130, 0.42, { fire: 0.7 }));
        sp('fantasma', W() / 2, -30, { ty: 150 });
        yield Rt(6);
        sp('carro_som', 90, -36, { vy: 24 });
        sp('deputado', W() - 80, -30, { ty: 130 });
        yield Rt(10);
        carrier('cabo', W() - 60, -22, 'shield', { vy: 65, hp: 7, fire: 0.5 });
        yield Rt(12);
        yield* par(
          swarm('cabo', 5, 0.4, path('uL'), 6, { fire: 0.7 }),
          swarm('cabo', 5, 0.4, path('uL', true), 6, { fire: 0.7 }));
        yield Rt(17);
        row('deputado', 3, -30, (i) => ({ ty: 110 + (i % 2) * 40, hold: 4.5 }), 70);
        yield* swarm('cabo', 6, 0.38, path('crossL'), 5.5, { fire: 0.7 });
        yield Rt(20);
        carrier('deputado', W() / 2, -30, 'power', { ty: 120, hp: 16 });
        sp('fantasma', 80, -30, { ty: 170 }); sp('fantasma', W() - 80, -30, { ty: 120, delay: 1.2 });
        vee('cabo', 7, W() / 2, { vy: 75, fire: 0.6 });
        yield Rt(25);
        mark(0.92);
        yield* par(
          drizzle('cabo', 6, L2 ? 0.38 : 0.55, () => ({ vy: M.rand(75, 100), fire: 0.6 })),
          after(1, (function* () { sp('carro_som', W() - 90, -36, { vy: 28 }); })()));
        yield S.clear(8);
      }, ['cabo'], 3.4, 24);
      carrier('cabo', W() / 2, -22, 'power', { ty: 150, hold: 3, hp: 8, fire: 0 });
      yield S.clear(6);
      yield 1;
      mark(1);
      yield S.boss('centrao');
    },
  });

  // ======================================================================
  // FASE 2 — ESPLANADA DOS MINISTÉRIOS
  // novos: assessor → sindicalista → lobista → marqueteiro; meio: Lobista-Mor
  // ======================================================================
  G.Stages.add({
    id: 'esplanada', name: 'Esplanada dos Ministérios', subtitle: 'Cada ministério, mil assessores',
    bg: 'esplanada', music: 'stage2', bossMusic: 'boss', boss: 'dilmae', scrollSpeed: 46,
    script: function* (S) {
      const L2 = S.g.loop > 1;
      const T0 = now();
      const T = (s) => at(T0 + s);
      mark(0); pre(...OPENING.esplanada);
      yield* withAmbient(function* () {
        yield 1.6;
        // aquecimento com velhos conhecidos
        sp('deputado', 90, -30, { ty: 120 }); sp('deputado', W() - 90, -30, { ty: 150 });
        yield* swarm('cabo', 6, 0.4, path('uL'), 6, { fire: 0.8 });
        yield T(8);
        yield* par(swarm('cabo', 6, 0.4, path('crossL', true), 5.5, { fire: 0.8 }), after(1, (function* () { sp('fantasma', W() / 2, -30, { ty: 130 }); })()));
        yield T(12.5);
        carrier('deputado', W() / 2, -30, 'power', { ty: 110, hp: 16 });
        yield S.clear(5);
        // --- ASSESSOR DA RACHADINHA ---
        mark(0.08);
        yield 0.5;
        sp('assessor', W() / 2, -24, { vy: 55, amp: 30 });
        yield 4.5;
        yield* par(
          (function* () { for (let i = 0; i < 4; i++) { sp('assessor', 70, -24, { vy: 72, amp: 40, phase: 0 }); yield 0.7; } })(),
          after(1.4, (function* () { for (let i = 0; i < 4; i++) { sp('assessor', W() - 70, -24, { vy: 72, amp: 40, phase: Math.PI }); yield 0.7; } })()));
        yield T(27);
        pre('sindicalista');
        row('assessor', 5, -24, { vy: 66, amp: 20, freq: 3 }, 50);
        if (L2) row('assessor', 4, -70, { vy: 66, amp: 20, freq: 3 }, 80);
        yield* swarm('cabo', 6, 0.38, path('crossL'), 5.5, { fire: 0.8 });
        yield S.clear(5);
        // --- SINDICALISTA ---
        mark(0.18);
        yield 0.4;
        sp('sindicalista', W() / 2, -30, { ty: 135, hold: 7 });
        yield 2;
        sp('assessor', 60, -24, { vy: 70, amp: 30 }); sp('assessor', W() - 60, -24, { vy: 70, amp: 30 });
        yield T(40);
        carrier('assessor', W() * 0.3, -24, 'power', { vy: 60, amp: 30, hp: 12 });
        yield T(43);
        sp('sindicalista', 80, -30, { ty: 120 }); sp('sindicalista', W() - 80, -30, { ty: 160 });
        yield* swarm('cabo', 7, 0.36, path('uL'), 6, { fire: 0.8 });
        yield T(50);
        pre('lobista');
        yield* par(
          (function* () { for (let i = 0; i < 6; i++) { sp('assessor', i % 2 ? W() * 0.3 : W() * 0.7, -24, { vy: 80, amp: 60, freq: 2 }); yield 0.6; } })(),
          after(1, (function* () { sp('fantasma', 80, -30, { ty: 160 }); sp('fantasma', W() - 80, -30, { ty: 120, delay: 1.5 }); })()));
        yield S.clear(5);
        carrier('assessor', W() / 2, -24, 'bomb', { vy: 60, hp: 10, amp: 40 });
        // --- LOBISTA ---
        mark(0.3);
        yield 1.2;
        sp('lobista', W() / 2, -34, { ty: 125 });
        yield 2;
        row('cabo', 4, -22, { vy: 75, fire: 0.6 }, 40);
        yield T(64);
        carrier('deputado', 70, -30, 'power', { ty: 150, hp: 16 });
        yield T(66);
        pre('marqueteiro');
        sp('lobista', W() * 0.7, -34, { ty: 115 });
        sp('deputado', W() * 0.25, -30, { ty: 160 });
        yield* par(
          (function* () { for (let i = 0; i < 4; i++) { sp('assessor', M.rand(50, W() - 50), -24, { vy: 75, amp: 40 }); yield 0.8; } })());
        yield S.clear(6);
        // --- MARQUETEIRO (blinda o grupo: derrube ele primeiro) ---
        mark(0.42);
        yield 0.4;
        row('deputado', 4, -30, (i) => ({ ty: 150 + (i % 2) * 22, hold: 7, inT: 1.6 }), 55);
        yield 1.4;
        sp('marqueteiro', W() / 2, -30, { ty: 92, hold: 9 });
        yield T(84);
        sp('sindicalista', W() / 2, -30, { ty: 120 });
        yield* par(swarm('assessor', 4, 0.6, path('sL'), 7), after(1.2, (function* () { sp('fantasma', W() * 0.25, -30, { ty: 160 }); })()));
        // corredor dos ministérios: emboscada dos dois lados
        yield T(90);
        pre('lobista_mor');
        yield* par(
          side('cabo', 5, true, 92, 0.4, { fire: 0.9, spd: 130 }),
          after(0.8, side('cabo', 5, false, 128, 0.4, { fire: 0.9, spd: 130 })),
          after(2.4, side('assessor', 3, true, 165, 0.7, { spd: 110 })),
          after(3.2, (function* () { sp('lobista', W() * 0.7, -34, { ty: 110, hold: 6 }); })()));
        yield T(97);
        carrier('cabo', W() * 0.3, -22, 'power', { ty: 140, hold: 3.5, hp: 9 });
        yield S.clear(7);
        // --- CHEFE INTERMEDIÁRIO: LOBISTA-MOR ---
        mark(0.55);
        yield 0.5;
        yield* midboss('lobista_mor', W() / 2, -100);
        const R = now();
        const Rt = (s) => at(R + s);
        mark(0.78, 'itamaraty'); // reta final: o Itamaraty passa antes do Congresso (chegada da Dilmãe)
        yield* par(
          (function* () { for (let i = 0; i < 6; i++) { sp('assessor', i % 2 ? 60 : W() - 60, -24, { vy: 80, amp: 40 }); yield 0.55; } })(),
          after(1, (function* () { sp('sindicalista', W() / 2, -30, { ty: 130 }); })()));
        yield Rt(7);
        sp('lobista', W() * 0.3, -34, { ty: 130 });
        sp('deputado', W() * 0.75, -30, { ty: 160 }); sp('deputado', W() * 0.55, -30, { ty: 175 });
        yield 1.2;
        sp('marqueteiro', W() * 0.55, -30, { ty: 95 });
        yield Rt(13);
        carrier('deputado', W() / 2, -30, 'life', { ty: 120, hp: 20, hold: 6 });
        yield Rt(15);
        pre('carro_som');
        row('assessor', 6, -24, { vy: 70, amp: 25, freq: 3 }, 40);
        sp('fantasma', 80, -30, { ty: 150 }); sp('fantasma', W() / 2, -30, { ty: 110, delay: 1 }); sp('fantasma', W() - 80, -30, { ty: 170, delay: 2 });
        yield Rt(21);
        carrier('assessor', W() * 0.7, -24, 'power', { vy: 60, amp: 30, hp: 12 });
        yield Rt(23);
        sp('carro_som', W() / 2, -36, { vy: 26 });
        sp('sindicalista', 70, -30, { ty: 150 }); sp('sindicalista', W() - 70, -30, { ty: 150 });
        yield Rt(30);
        mark(0.92);
        yield* par(
          drizzle('assessor', 7, L2 ? 0.55 : 0.8, () => ({ vy: 85, amp: 30 })),
          drizzle('cabo', 7, 0.6, () => ({ vy: 90, fire: 0.9 })),
          after(2, (function* () { sp('lobista', W() / 2, -34, { ty: 115, hold: 6 }); yield 1.2; sp('marqueteiro', W() * 0.3, -30, { ty: 88, hold: 6 }); })()));
        yield S.clear(8);
      }, ['cabo', 'cabo', 'assessor'], 3.2, 30);
      carrier('deputado', W() / 2, -30, 'power', { ty: 130, hp: 16, hold: 3.5 });
      yield S.clear(6);
      yield 1;
      mark(1);
      yield S.boss('dilmae');
    },
  });

  // ======================================================================
  // FASE 3 — LAGO PARANOÁ
  // novos: bot → motoqueiro (motoboy da picanha) → drone; meio: Ministério da Verdade
  // ======================================================================
  const once = (fn) => (function* () { fn(); })();
  G.Stages.add({
    id: 'paranoa', name: 'Lago Paranoá', subtitle: 'Lives, bots e trending topics',
    bg: 'paranoa', music: 'stage3', bossMusic: 'boss', boss: 'erika', scrollSpeed: 54,
    script: function* (S) {
      const L2 = S.g.loop > 1;
      const T0 = now();
      const T = (s) => at(T0 + s);
      mark(0); pre(...OPENING.paranoa);
      yield* withAmbient(function* () {
        yield 1.6;
        // aquecimento com a turma da Esplanada
        sp('sindicalista', W() / 2, -30, { ty: 130 });
        yield* par(
          (function* () { for (let i = 0; i < 4; i++) { sp('assessor', i % 2 ? 70 : W() - 70, -24, { vy: 75, amp: 40 }); yield 0.7; } })(),
          after(1.5, once(() => { sp('deputado', 80, -30, { ty: 160 }); sp('deputado', W() - 80, -30, { ty: 160 }); })),
          after(3, swarm('cabo', 6, 0.36, path('uL'), 6, { fire: 1 })));
        yield T(10);
        // --- BOT DE ENGAJAMENTO ---
        mark(0.08);
        yield* bots(8, true, 70);
        yield T(15);
        pre('lobista', 'motoqueiro');
        carrier('deputado', W() / 2, -30, 'power', { ty: 110, hp: 18 });
        yield* par(bots(8, false, 90), after(1.5, bots(8, true, 130, { dive: 0.3 })), after(3, swarm('cabo', 6, 0.35, path('crossL'), 5.5, { fire: 1 })));
        yield T(23);
        yield* par(botRain(10, W() * 0.3, { dive: 0.3 }), after(0.8, botRain(10, W() * 0.7, { dive: 0.3 })), after(1, once(() => sp('lobista', W() / 2, -34, { ty: 120 }))));
        yield T(30);
        yield S.clear(4);
        // --- MOTOBOYS DA PICANHA ---
        mark(0.18);
        yield* moto(3, true, 120, 40, 0.45);
        yield 2.4;
        yield* moto(3, false, 140, 40, 0.45);
        yield T(39);
        pre('fantasma', 'drone');
        carrier('cabo', W() / 2, -22, 'power', { ty: 150, hold: 3.5, hp: 10 });
        yield* par(moto(4, true, 100, 35, 0.4), after(1.5, bots(8, false, 70, { dive: 0.3 })), after(2, once(() => sp('sindicalista', W() / 2, -30, { ty: 120 }))));
        yield T(47);
        yield* par(moto(3, false, 110, 50, 0.5), after(1.8, moto(3, true, 135, 50, 0.5)),
          once(() => { sp('fantasma', 80, -30, { ty: 170 }); sp('fantasma', W() - 80, -30, { ty: 130, delay: 1.2 }); sp('sindicalista', W() / 2, -30, { ty: 125 }); }),
          after(3, (function* () { for (let i = 0; i < 4; i++) { sp('assessor', M.rand(60, W() - 60), -24, { vy: 80, amp: 35 }); yield 0.6; } })()));
        yield T(55);
        yield S.clear(4);
        carrier('assessor', W() / 2, -24, 'shield', { vy: 60, amp: 40, hp: 12 });
        // --- DRONE DA LIVE ---
        mark(0.3);
        yield 0.8;
        sp('drone', W() / 2, -24, { ty: 150, hold: 7 });
        yield 3;
        sp('drone', 80, -24, { ty: 110 }); sp('drone', W() - 80, -24, { ty: 130 });
        yield T(64);
        pre('carro_som', 'marqueteiro');
        carrier('deputado', W() * 0.3, -30, 'power', { ty: 140, hp: 18 });
        yield* par(
          once(() => { sp('drone', 70, -24, { ty: 100 }); sp('drone', W() / 2, -24, { ty: 160 }); sp('drone', W() - 70, -24, { ty: 120 }); }),
          after(1.5, moto(3, true, 200, -40, 0.45)),
          after(3, swarm('cabo', 6, 0.35, path('uL', true), 6, { fire: 1 })));
        yield T(72);
        sp('carro_som', W() / 2, -36, { vy: 26 });
        yield* par(bots(8, true, 80, { dive: 0.3 }), after(2, once(() => { sp('drone', 70, -24, { ty: 120 }); sp('drone', W() - 70, -24, { ty: 120 }); })),
          after(3.5, once(() => sp('lobista', W() * 0.3, -34, { ty: 110, hold: 6 }))));
        yield T(80);
        row('deputado', 3, -30, (i) => ({ ty: 150 + (i % 2) * 25, hold: 7 }), 70);
        yield 1.2;
        sp('marqueteiro', W() / 2, -30, { ty: 95 });
        sp('drone', 60, -24, { ty: 150 });
        // a Ponte JK entra na tela junto com o comboio da picanha (T 90)
        yield T(84);
        mark(0.42, 'jk');
        pre('servidor');
        yield T(87);
        carrier('cabo', W() * 0.7, -22, 'power', { ty: 140, hold: 3.5, hp: 10 });
        // --- A PICANHA TÁ CHEGANDO: o comboio ---
        yield T(90);
        S.text(W() / 2, H() * 0.3, 'A PICANHA TÁ CHEGANDO!', { color: G.C.yellow, size: 20, life: 1.6, vy: -10 });
        G.call(G.Audio, 'sfx', 'motor');
        yield* par(
          moto(4, true, 90, 30, 0.35),
          after(1.2, moto(4, false, 150, 30, 0.35)),
          after(2.6, moto(4, true, 215, -30, 0.35)),
          after(4.2, moto(4, false, 110, 35, 0.35)),
          after(5.4, botRain(10, W() / 2, { dive: 0.35 })),
          after(7, moto(5, true, 100, 28, 0.3)),
          after(8.5, moto(4, false, 180, -28, 0.3)));
        yield T(103);
        carrier('deputado', W() / 2, -30, 'power', { ty: 120, hp: 18, hold: 3.5 });
        yield S.clear(7);
        // --- CHEFE INTERMEDIÁRIO: MINISTÉRIO DA VERDADE ---
        mark(0.55);
        yield 0.5;
        yield* midboss('servidor', W() / 2, -100);
        const R = now();
        const Rt = (s) => at(R + s);
        mark(0.75);
        yield* par(moto(4, true, 100, 40, 0.4), after(1, moto(4, false, 130, 40, 0.4)), after(2, bots(10, true, 70, { dive: 0.3 })));
        yield Rt(8);
        sp('drone', 70, -24, { ty: 110 }); sp('drone', W() - 70, -24, { ty: 110 });
        sp('sindicalista', W() / 2, -30, { ty: 150 });
        sp('lobista', W() * 0.3, -34, { ty: 120 });
        yield Rt(13);
        carrier('assessor', W() * 0.7, -24, 'bomb', { vy: 60, amp: 30, hp: 12 });
        yield Rt(15);
        sp('carro_som', W() * 0.7, -36, { vy: 26 });
        yield* par(botRain(10, W() * 0.25, { dive: 0.4 }), after(1.2, botRain(10, W() * 0.75, { dive: 0.4 })));
        yield Rt(21);
        carrier('deputado', W() / 2, -30, 'power', { ty: 120, hp: 18 });
        yield Rt(23);
        yield* par(
          (function* () { for (let i = 0; i < 6; i++) { sp('assessor', i % 2 ? W() * 0.25 : W() * 0.75, -24, { vy: 85, amp: 40 }); yield 0.6; } })(),
          after(1, moto(3, true, 160, -30, 0.45)),
          after(2.5, once(() => { sp('drone', W() / 2, -24, { ty: 140 }); sp('drone', 60, -24, { ty: 100 }); sp('drone', W() - 60, -24, { ty: 100 }); })));
        yield Rt(32);
        sp('fantasma', 70, -30, { ty: 150 }); sp('fantasma', W() - 70, -30, { ty: 150, delay: 1 });
        yield* par(bots(8, false, 80, { dive: 0.4 }), after(1.5, moto(4, false, 110, 35, 0.4)));
        if (L2) yield* bots(8, true, 120, { dive: 0.4 });
        yield Rt(38);
        mark(0.92);
        // última leva: blindagem do marqueteiro em cima dos drones
        row('deputado', 3, -30, (i) => ({ ty: 160 + (i % 2) * 22, hold: 6 }), 70);
        sp('drone', W() * 0.3, -24, { ty: 120 }); sp('drone', W() * 0.7, -24, { ty: 120 });
        yield 1.2;
        sp('marqueteiro', W() / 2, -30, { ty: 88, hold: 7 });
        yield* after(2, par(moto(3, true, 230, -30, 0.4), after(1, moto(3, false, 230, -30, 0.4))));
        yield S.clear(8);
      }, ['cabo', 'bot', 'assessor'], 3.0, 16);
      carrier('cabo', W() / 2, -22, 'power', { ty: 150, hold: 3, hp: 10 });
      yield S.clear(6);
      yield 1;
      mark(1);
      yield S.boss('erika');
    },
  });

  // ======================================================================
  // FASE 4 — PALÁCIO DO PLANALTO (o teste de verdade)
  // novos: ministro → leão; meio: Comitiva dos 38 Ministros
  // ======================================================================
  G.Stages.add({
    id: 'planalto', name: 'Palácio do Planalto', subtitle: 'A conta chegou',
    bg: 'planalto', music: 'stage4', bossMusic: 'boss_final', boss: 'lule', scrollSpeed: 50,
    script: function* (S) {
      const L2 = S.g.loop > 1;
      const T0 = now();
      const T = (s) => at(T0 + s);
      mark(0); pre(...OPENING.planalto);
      yield* withAmbient(function* () {
        yield 1.6;
        // recepção oficial
        yield* par(
          // deputados blindados pelo marqueteiro: ficam menos tempo (a fase final não deve matar logo na entrada)
          once(() => { sp('lobista', W() / 2, -34, { ty: 130 }); sp('deputado', 80, -30, { ty: 160, hold: L2 ? 6 : 4.6 }); sp('deputado', W() - 80, -30, { ty: 160, hold: L2 ? 6 : 4.6 }); }),
          after(1.3, once(() => sp('marqueteiro', W() / 2, -30, { ty: 85, hold: 8 }))),
          after(3, swarm('cabo', 6, 0.34, path('uL'), 6, { fire: 0.7 })),
          after(7.5, swarm('cabo', 6, 0.34, path('uL', true), 6, { fire: 0.7 })));
        yield T(11);
        // --- MINISTROS em conga ---
        mark(0.06);
        pre('assessor', 'drone');
        yield* swarm('ministro', 8, 0.34, path('conga'), 10, (i) => ({ conga: true, v: i, fire: i % 2 ? 0.8 : 0.4 }));
        yield T(17);
        carrier('deputado', W() / 2, -30, 'power', { ty: 110, hp: 20 });
        yield* par(
          swarm('ministro', 8, 0.34, path('conga', true), 10, (i) => ({ conga: true, v: i + 3, fire: 0.6 })),
          after(2, (function* () { for (let i = 0; i < 4; i++) { sp('assessor', i % 2 ? 70 : W() - 70, -24, { vy: 80, amp: 40 }); yield 0.7; } })()),
          after(4, once(() => { sp('drone', 70, -24, { ty: 130 }); sp('drone', W() - 70, -24, { ty: 130 }); })));
        yield T(27);
        pre('sindicalista', 'leao', 'bot');
        vee('ministro', 7, W() / 2, (i) => ({ vy: 85, v: i }));
        yield* after(1.5, swarm('cabo', 6, 0.34, path('crossL'), 5.5, { fire: 1 }));
        yield T(32);
        vee('ministro', 5, W() * 0.28, (i) => ({ vy: 90, v: i }), 30, 22);
        vee('ministro', 5, W() * 0.72, (i) => ({ vy: 90, v: i + 2 }), 30, 22);
        sp('sindicalista', W() / 2, -30, { ty: 140 });
        yield T(37);
        yield S.clear(4);
        carrier('cabo', W() * 0.3, -22, 'power', { ty: 150, hold: 3.5, hp: 12 });
        // --- LEÃO DA RECEITA ---
        mark(0.2);
        yield 1.2;
        sp('leao', W() / 2, -30, { ty: H() * 0.2 });
        yield 4;
        yield* swarm('ministro', 6, 0.36, path('uL'), 6.5, (i) => ({ v: i }));
        yield T(49);
        pre('motoqueiro', 'carro_som', 'fantasma');
        sp('leao', 70, -30, { ty: H() * 0.18 });
        yield* par(bots(8, false, 80, { dive: 0.35 }), after(1.5, once(() => { sp('drone', W() * 0.65, -24, { ty: 120 }); sp('drone', W() * 0.35, -24, { ty: 160 }); })));
        yield T(56);
        carrier('deputado', W() * 0.7, -30, 'power', { ty: 130, hp: 20 });
        yield* par(moto(4, true, 110, 35, 0.4), after(1.5, once(() => vee('ministro', 7, W() / 2, (i) => ({ vy: 90, v: i })))));
        yield T(63);
        mark(0.33);
        carrier('deputado', W() / 2, -30, 'life', { ty: 115, hp: 24, hold: 6 });
        sp('carro_som', 80, -36, { vy: 26 });
        yield* par(
          once(() => { sp('fantasma', W() - 80, -30, { ty: 160 }); sp('fantasma', W() / 2, -30, { ty: 120, delay: 1.2 }); }),
          after(1, (function* () { for (let i = 0; i < 5; i++) { sp('assessor', M.rand(60, W() - 60), -24, { vy: 80, amp: 40 }); yield 0.7; } })()));
        yield T(72);
        sp('lobista', W() * 0.3, -34, { ty: 125 });
        sp('sindicalista', W() * 0.75, -30, { ty: 150 });
        yield 1.3;
        sp('marqueteiro', W() * 0.5, -30, { ty: 90 });
        yield* swarm('ministro', 8, 0.32, path('sL'), 8, (i) => ({ v: i }));
        yield T(79);
        carrier('cabo', W() / 2, -22, 'power', { ty: 150, hold: 3.5, hp: 12 });
        yield T(81);
        sp('leao', 70, -30, { ty: H() * 0.17 }); sp('leao', W() - 70, -30, { ty: H() * 0.24, pounces: 2 });
        yield* par(bots(8, true, 80, { dive: 0.4 }), after(2, bots(8, false, 110, { dive: 0.4 })));
        yield T(88);
        yield* par(
          once(() => { sp('drone', 70, -24, { ty: 120 }); sp('drone', W() - 70, -24, { ty: 120 }); sp('drone', W() / 2, -24, { ty: 170 }); }),
          after(2, swarm('ministro', 8, 0.32, path('conga'), 10, (i) => ({ conga: true, v: i, fire: 0.6 }))));
        // --- RAMPA DO PLANALTO: corredor polonês ---
        yield T(96);
        mark(0.5);
        pre('comitiva');
        yield* par(
          drizzle('ministro', 7, L2 ? 0.55 : 0.75, (i) => ({ vy: M.rand(80, 100), v: i })),
          after(1, once(() => { sp('sindicalista', W() / 2, -30, { ty: 140 }); if (L2) sp('sindicalista', W() - 70, -30, { ty: 175 }); })),
          after(3, once(() => sp('leao', W() / 2, -30, { ty: H() * 0.2, pounces: 1 }))),
          after(5, once(() => sp('carro_som', W() / 2, -36, { vy: 30 }))));
        yield T(103);
        carrier('deputado', W() * 0.3, -30, 'power', { ty: 130, hp: 20 });
        carrier('assessor', W() * 0.7, -24, 'bomb', { vy: 60, amp: 30, hp: 12 });
        yield* after(1.5, drizzle('assessor', 5, 0.8, () => ({ vy: 85, amp: 30 })));
        yield S.clear(8);
        // --- CHEFE INTERMEDIÁRIO: COMITIVA DOS 38 MINISTROS ---
        mark(0.58);
        yield 0.6;
        yield* midboss('comitiva', -40, 90);
        const R = now();
        const Rt = (s) => at(R + s);
        mark(0.78);
        sp('leao', W() / 2, -30, { ty: H() * 0.2 });
        yield* par(
          after(1, once(() => vee('ministro', 7, W() * 0.3, (i) => ({ vy: 90, v: i })))),
          after(3, once(() => vee('ministro', 7, W() * 0.7, (i) => ({ vy: 90, v: i + 1 })))));
        yield Rt(7);
        yield* par(moto(4, true, 100, 40, 0.4), after(1, moto(4, false, 120, 40, 0.4)),
          after(2, once(() => { sp('drone', 70, -24, { ty: 150 }); sp('drone', W() - 70, -24, { ty: 150 }); })));
        yield Rt(12);
        carrier('cabo', W() / 2, -22, 'shield', { vy: 65, hp: 10, fire: 0.5 });
        row('deputado', 3, -30, (i) => ({ ty: 160 + (i % 2) * 20, hold: 7 }), 70);
        sp('lobista', W() / 2, -34, { ty: 115 });
        yield 1.3;
        sp('marqueteiro', W() * 0.3, -30, { ty: 88 });
        yield Rt(18);
        carrier('deputado', W() * 0.75, -30, 'power', { ty: 140, hp: 20 });
        yield Rt(20);
        sp('carro_som', 80, -36, { vy: 26 }); sp('drone', W() - 80, -24, { ty: 120 }); sp('drone', W() - 150, -24, { ty: 170 });
        yield* par(botRain(10, W() / 2, { dive: 0.45 }), after(2, bots(8, true, 90, { dive: 0.45 })));
        yield Rt(25);
        sp('leao', 70, -30, { ty: H() * 0.18 }); sp('leao', W() - 70, -30, { ty: H() * 0.23, pounces: 2 });
        yield* par(
          swarm('ministro', 10, 0.3, path('conga'), 10, (i) => ({ conga: true, v: i, fire: 0.7 })),
          after(2, once(() => { sp('sindicalista', W() / 2, -30, { ty: 130 }); sp('fantasma', 70, -30, { ty: 170 }); sp('fantasma', W() - 70, -30, { ty: 170, delay: 1 }); })),
          after(4, moto(3, true, 200, -40, 0.45)));
        if (L2) yield* par(bots(10, false, 70, { dive: 0.5 }), after(1, once(() => vee('ministro', 9, W() / 2, (i) => ({ vy: 95, v: i })))));
        // --- ÚLTIMA BARREIRA antes do chefão ---
        yield Rt(34);
        mark(0.92);
        yield* par(
          once(() => vee('ministro', 9, W() / 2, (i) => ({ vy: 90, v: i }), 32, 22)),
          after(1, drizzle('cabo', 7, L2 ? 0.55 : 0.7, () => ({ vy: 95, fire: 1 }))),
          after(2, once(() => { sp('drone', 60, -24, { ty: 130 }); sp('drone', W() / 2, -24, { ty: 170 }); sp('drone', W() - 60, -24, { ty: 130 }); })),
          after(4, side('assessor', 4, true, 120, 0.6, { spd: 110 })),
          after(5, side('assessor', 4, false, 160, 0.6, { spd: 110 })));
        yield S.clear(9);
      }, ['cabo', 'ministro', 'bot', 'assessor'], 2.8, 15);
      carrier('deputado', W() / 2, -30, 'power', { ty: 130, hp: 20, hold: 3.5 });
      carrier('cabo', W() * 0.25, -22, 'bomb', { vy: 70, hp: 8, fire: 0 });
      yield S.clear(6);
      yield 1.2;
      mark(1);
      yield S.boss('lule');
    },
  });
})();
