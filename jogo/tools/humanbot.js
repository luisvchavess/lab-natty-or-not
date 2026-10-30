#!/usr/bin/env node
/* ============================================================
   humanbot.js — bot "humano" para medir DIFICULDADE de verdade.
   O autopiloto do core (auto=1) é um desviador sobre-humano; este aqui
   joga como gente: tempo de reação, visão limitada, dedo com velocidade
   máxima, tremor, erro de leitura das balas, preguiça de subir na tela,
   bomba só às vezes. Ele dirige o Fusca pelo mesmo caminho de um dedo
   (define p.tx/p.ty a cada passo da simulação, como o pointermove faz).

   Modos:
     run   (padrão) joga uma fase (ou a partida toda com --through 1) e conta
                    mortes por trecho/fase do chefão, bombas, tempo de chefão,
                    Pix, placar, nota. Classifica cada morte com um "oráculo"
                    (dava para escapar com um dedo perfeito a 600 px/s?).
     ttk           tempo para matar cada chefão por arma/nível, atirando do
                    terço de baixo (god, seguindo o chefão com atraso humano)
     mid           idem para os 4 chefes intermediários
     dps           dano por segundo de cada arma/nível em alvo único e em grupo

   Exemplos:
     node tools/humanbot.js --profile casual --stage 0 --runs 4
     node tools/humanbot.js --profile good --stage 0 --through 1 --runs 3 --weapon voto
     node tools/humanbot.js --mode ttk --bosses centrao,dilmae,erika,lule --weapons voto,boca,panela,jato --levels 1,3,5
     node tools/humanbot.js --mode ttk --bosses centrao,dilmae --weapons voto --levels 3 --mech 0
     node tools/humanbot.js --mode dps
     node tools/humanbot.js --mode mid --levels 1,3,5
   Opções gerais: --page dev|index  --ts 12 (escala de tempo; passo fixo de 1/60, não muda o resultado)
     --seed N  --parallel 3  --out DIR  --fast 1 (desliga a rasterização do canvas: bem mais rápido)
     --upg "vida:1,bomba:1,turbo:2"  --loop 2 (2º Mandato)  --continues 99  --timeout 1200 (s reais por partida)
     --weapon voto|boca|panela|jato|any (arma preferida do perfil good; casual pega qualquer cor)
     --bossOnly 1 --startLv 4 --startW voto (pula direto ao chefão com essa arma)
     --shots 1 (salva desenho da cena 0,3 s antes de cada morte, em PNG; precisa --fast 0 para o print real)
     --mech 1|0 (padrão 1) faz a "manha" de cada chefão seguindo b.autoGoal (pegar a emenda, ficar na meta,
       cortar os fios, olé no Leão) com reação humana: o perfil nota cada objeto novo com chance mechNotice e
       vai até ele mechDelay s depois. --mech 0 ignora a manha e põe mech=0 na URL (o autopiloto também ignora).
       As tabelas e o summary.json trazem a manha do chefão: ok/miss/stuns (+ objetos vistos/notados no modo run).
   Saída: <out>/summary.json, uma linha por partida e uma tabela agregada no stdout.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const argv = process.argv.slice(2);
const opt = {
  mode: 'run', profile: 'casual', stage: 0, through: 0, runs: 1, seed: 1, ts: 12, page: 'dev', out: '/tmp/humanbot',
  fast: 1, weapon: 'any', upg: '', continues: 99, timeout: 1200, w: 195, h: 422, loop: 1, parallel: 3, shots: 0,
  bosses: 'centrao,dilmae,erika,lule', weapons: 'voto,boca,panela,jato', levels: '1,3,5', maxgt: 2400, ty: 0.8, mech: 1,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const v = argv[i + 1];
  opt[a.slice(2)] = v === undefined || v.startsWith('--') ? 1 : isNaN(+v) || v === '' ? v : +v;
  if (!(v === undefined || v.startsWith('--'))) i++;
}

// ------------------------------------------------------------------
// Perfis humanos
// ------------------------------------------------------------------
const PROFILES = {
  // jogador casual no celular: reage em ~230 ms, olha uns 115 px em volta do carro, deixa passar
  // ~5% das balas quando a tela enche, dedo até 480 px/s, prefere ficar embaixo, segue os inimigos pela metade
  casual: {
    delay: 0.235, delayJit: 0.03, perceive: 115, notice: 0.965, noticeFloor: 0.8, clutter0: 12, clutterK: 0.006, reroll: 0.18,
    margin: 5, marginJit: 2.2, velNoise: 0.1, spdNoise: 0.12, vmax: 480, amax: 3200, planEvery: 6, dirs: 10, dists: [16, 34, 60],
    horizon: 0.45, samples: 7, evalNoise: 6, jitter: 2.2, goalY: 0.83, follow: 0.7, followLag: 1.1, wGoal: 1.0, wMove: 0.45,
    itemGreed: 0.6, itemRange: 110, bombTrap: 0.35, bombLast: 0.6, bombWorry: 0.35, worryN: 7, colorPicky: false, upper: 0.55,
    lapseRate: 0.2, lapseMin: 0.25, lapseMax: 0.5, endErr: 0.1,
    stratEvery: 0.4, stratLook: 1.2, stratNotice: 0.8, stratW: 0.8,
    // manha do chefão: nota 60% dos objetos novos (emenda, meta, fio, Leão) e vai até eles 0,45 s depois;
    // aí o dedo vai direto (mechLag s, em vez do followLag) e, numa zona para ficar (META), o objetivo pesa mechHoldW×
    mechNotice: 0.6, mechDelay: 0.45, mechLag: 0.2, mechHoldW: 4,
  },
  // jogador bom (já jogou umas vezes): ~190 ms, olha 165 px, raramente deixa passar bala, dedo 700 px/s,
  // fica embaixo do alvo, espera o "P" virar a cor da arma dele, solta bomba quando vê que não tem saída
  good: {
    delay: 0.19, delayJit: 0.025, perceive: 165, notice: 0.995, noticeFloor: 0.92, clutter0: 24, clutterK: 0.003, reroll: 0.12,
    margin: 3.4, marginJit: 1.0, velNoise: 0.045, spdNoise: 0.05, vmax: 700, amax: 5200, planEvery: 3, dirs: 16, dists: [10, 22, 40, 70],
    horizon: 0.6, samples: 8, evalNoise: 1.5, jitter: 1.3, goalY: 0.78, follow: 1.0, followLag: 0.45, wGoal: 1.5, wMove: 0.25,
    itemGreed: 0.95, itemRange: 170, bombTrap: 0.8, bombLast: 0.95, bombWorry: 0.9, worryN: 5, colorPicky: true, upper: 0.45,
    lapseRate: 0.06, lapseMin: 0.15, lapseMax: 0.3, endErr: 0.05,
    stratEvery: 0.25, stratLook: 1.8, stratNotice: 0.95, stratW: 1.0,
    mechNotice: 0.92, mechDelay: 0.25, mechLag: 0.12, mechHoldW: 3,
  },
};

// ------------------------------------------------------------------
// Código injetado na página (antes de qualquer script do jogo)
// ------------------------------------------------------------------
function pageMain(cfg) {
  'use strict';
  function mul(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  if (cfg.seed) Math.random = mul(cfg.seed * 7919 + 13);
  const rnd = mul((cfg.seed || 1) * 104729 + 7);
  const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * rnd()); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  if (cfg.fast) {
    const CP = CanvasRenderingContext2D.prototype;
    window.__origCP = {}; for (const k of ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'drawImage']) window.__origCP[k] = CP[k];
    for (const k of ['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage', 'fillText', 'strokeText', 'clip', 'putImageData']) CP[k] = function () {};
  }
  const G = (window.G = window.G || {});
  // áudio desligado (economiza CPU; não muda nada na simulação)
  const mkAudio = () => ({ init() {}, unlock() {}, sfx() {}, music() {}, stopMusic() {}, setMusicOn() {}, setSfxOn() {} });
  Object.defineProperty(G, 'Audio', { configurable: true, get() { return mkAudio(); }, set() {} });

  const P = cfg.prof;
  const HB = (window.__hb = {
    cfg: { profile: cfg.profile, seed: cfg.seed, stage: cfg.stage, mode: cfg.mode, weapon: cfg.weapon, upgrades: cfg.upgrades, loop: cfg.loop, mech: cfg.mech },
    stages: [], deaths: [], bombs: [], continues: [], levels: [], cheap: { near: 0, nearList: [], low: 0, lowList: [], offscreen: 0, enemyLow: [] },
    ttk: [], mids: [], dps: null, done: false, err: null, steps: 0, gtTotal: 0, snaps: [],
  });
  const curStage = () => HB.stages[HB.stages.length - 1];
  const gtNow = () => HB.gtTotal + (G.game ? G.game.t : 0);
  function section(g) {
    const b = g.boss;
    if (b) return b.state === 'fight' || b.state === 'dying' ? 'boss:P' + (b.phase + 1) + (b.id === 'lule' && b.data && b.data.life === 2 ? 'b' : '') : 'boss:' + b.state;
    const st = curStage();
    if (st && st.mid && st.mid.alive) return 'mid';
    const after = st && st.mid && st.mid.end != null;
    return (after ? 'post-mid ' : 'pre-mid ') + Math.floor(g.t / 30) * 30 + 's';
  }

  // ---------------- entrada: o "dedo" ----------------
  const myKeys = {};
  Object.defineProperty(myKeys, 'right', { get() { try { tick(); } catch (e) { if (!HB.err) HB.err = String(e && e.stack || e); } return false; }, set() {} });
  for (const k of ['left', 'up', 'down', 'slow']) Object.defineProperty(myKeys, k, { get() { return false; }, set() {} });
  let inputObj = null;
  Object.defineProperty(G, 'input', {
    configurable: true, get() { return inputObj; },
    set(v) {
      inputObj = v;
      Object.defineProperty(v, 'keys', { get() { return myKeys; }, set() {} });
      if (G.save) {
        G.save.upgrades = Object.assign({}, cfg.upgrades || {});
        G.save.unlocked = 4;
        Object.assign(G.save.settings, { shake: false, vibrate: false, music: false, sfx: false, hitbox: true });
      }
    },
  });
  let bootFn = null;
  Object.defineProperty(G, 'boot', { configurable: true, get() { return bootFn ? wrappedBoot : undefined; }, set(f) { bootFn = f; } });
  function wrappedBoot() {
    try { installWraps(); } catch (e) { HB.err = 'wraps: ' + (e.stack || e); }
    const r = bootFn.apply(G, arguments);
    try { afterBoot(); } catch (e) { HB.err = 'afterBoot: ' + (e.stack || e); }
    return r;
  }

  // ---------------- instrumentação ----------------
  function installWraps() {
    const wrap = (name, fn) => { const orig = G[name]; if (typeof orig !== 'function') return; G[name] = function () { return fn(orig, this, arguments); }; };
    wrap('count', (orig, th, a) => { if (a[0] === 'deaths') { try { onDeath(); } catch (e) { HB.err = 'onDeath: ' + (e.stack || e); } } return orig.apply(th, a); });
    wrap('fire', (orig, th, a) => { const b = orig.apply(th, a); if (b) noteBullet(b); return b; });
    wrap('spawnEnemy', (orig, th, a) => { const e = orig.apply(th, a); if (e) noteEnemy(e); return e; });
    wrap('drop', (orig, th, a) => {
      const it = orig.apply(th, a);
      const st = curStage();
      if (it && st) {
        st.drops[a[0]] = (st.drops[a[0]] || 0) + 1;
        if (a[0] !== 'pix' && a[0] !== 'pix5' && a[0] !== 'mala') { it._rec = { type: a[0], t: G.game.t, src: G.game.player.alive ? 'enemy' : 'death' }; st.items.push(it._rec); }
      }
      return it;
    });
    wrap('bomb', (orig, th, a) => {
      const g = G.game, run = G.run, before = run ? run.bombs : 0;
      const ok = orig.apply(th, a);
      if (ok) {
        const rec = { t: +g.t.toFixed(2), gt: +gtNow().toFixed(1), stage: g.stageIdx, sec: section(g), reason: S.bombReason || 'manual', lives: run.lives, left: before - 1 };
        S.bombReason = null;
        HB.bombs.push(rec);
        const st = curStage(); if (st) { st.bombs++; if (g.boss) st.bossBombs++; }
      }
      return ok;
    });
    wrap('startStage', (orig, th, a) => {
      const prev = curStage();
      if (prev && G.game) HB.gtTotal += G.game.t;
      const r = orig.apply(th, a);
      const g = G.game, run = G.run;
      HB.stages.push({
        idx: a[0], id: g && g.stage && g.stage.id, deaths: 0, deathsBy: {}, bombs: 0, bossBombs: 0, drops: {}, items: [],
        lvStart: run.level, wStart: run.weapon, livesStart: run.lives, bombsStart: run.bombs, contStart: run.continues, gtStart: +HB.gtTotal.toFixed(1),
        mid: null, boss: null, clear: null, levelEvents: [], pixStolen: 0,
      });
      S.g = null;
      return r;
    });
    wrap('stageClear', (orig, th, a) => {
      const g = G.game, run = G.run, st = curStage();
      const hits = g.hits, bombs = g.bombsUsed, grazes = g.grazes;
      const scoreBefore = run.score, pixBefore = g.pixStage, approval = g.approval;
      const lv = run.level, w = run.weapon;
      const r = orig.apply(th, a);
      // a nota vem do core (G.rankFor / g.rank), para o relatório nunca divergir das regras do jogo
      const rank = g.rank || (G.rankFor ? G.rankFor(hits, bombs, g.stageIdx) : '?');
      if (st) st.clear = { t: +g.t.toFixed(1), rank, hits, bombs, grazes, approval: Math.round(approval), pixStage: g.pixStage, pixPickups: pixBefore,
        score: run.score, scoreBefore, bonus: run.score - scoreBefore, level: lv, weapon: w, lives: run.lives, continues: run.continues };
      return r;
    });
    wrap('continueRun', (orig, th, a) => {
      const g = G.game, run = G.run, lost = run ? run.score : 0;
      const ok = orig.apply(th, a);
      if (ok) HB.continues.push({ stage: g.stageIdx, t: +g.t.toFixed(1), sec: section(g), scoreLost: lost });
      return ok;
    });
    wrap('startRun', (orig, th, a) => { const r = orig.apply(th, a); if (G.run) G.run.maxContinues = cfg.continues; return r; });
    wrap('finishGame', (orig, th, a) => { if (G.game) HB.gtTotal += G.game.t; HB.finalScore = G.run && G.run.score; HB.done = 'ending'; const r = orig.apply(th, a); return r; });
    wrap('setBossPhases', (orig, th, a) => {
      const st = curStage(), g = G.game;
      if (st && st.boss) st.boss.revivedAt = +g.boss.ft.toFixed(1);
      return orig.apply(th, a);
    });
    for (const id in G.Bosses.defs) {
      const def = G.Bosses.defs[id];
      const w2 = (name, fn) => { const orig = def[name]; def[name] = function () { const r = orig ? orig.apply(this, arguments) : undefined; try { fn.apply(this, arguments); } catch (e) { HB.err = 'bosswrap: ' + e.stack; } return r; }; };
      w2('start', (b) => { const st = curStage(); if (!st) return; st.boss = { id, start: +G.game.t.toFixed(1), lv: G.run.level, w: G.run.weapon, lives: G.run.lives, bombs: G.run.bombs, phases: [{ idx: 0, ft: 0 }], deaths: 0, deathsBy: {}, end: null, fat: 0, cont0: G.run.continues, mech: null, goals: 0, noticed: 0, takeT: 0, inT: 0 }; snapMech(st.boss, b); });
      w2('onPhase', (b, idx) => { const st = curStage(); if (st && st.boss) st.boss.phases.push({ idx, ft: +b.ft.toFixed(1), life: b.data && b.data.life }); });
      w2('onDeath', (b) => { const st = curStage(); if (st && st.boss) { snapMech(st.boss, b); st.boss.end = +b.ft.toFixed(1); st.boss.fat = +((b.data && b.data.fat) || 0).toFixed(2); st.boss.contUsed = G.run.continues - st.boss.cont0; } });
    }
  }
  // cópia de b.mech ({ kind, ok, miss, stuns }) no registro (sem alocar a cada quadro)
  function snapMech(rec, b) {
    const m = b && b.mech; if (!rec || !m) return;
    const o = rec.mech || (rec.mech = { kind: m.kind, ok: 0, miss: 0, stuns: 0 });
    o.kind = m.kind; o.ok = m.ok | 0; o.miss = m.miss | 0; o.stuns = m.stuns | 0;
  }
  function noteBullet(b) {
    const g = G.game; if (!g) return;
    const p = g.player;
    b._ox = b.x; b._oy = b.y; b._sec = null;
    if (b.x < -12 || b.x > G.W + 12 || b.y > G.H + 12) HB.cheap.offscreen++;
    if (p && p.alive && !p.entering) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      b._pd = d;
      if (d < 60 && !(b.delay > 0.3)) {
        HB.cheap.near++;
        if (HB.cheap.nearList.length < 60) HB.cheap.nearList.push({ stage: g.stageIdx, t: +g.t.toFixed(1), sec: section(g), style: b.style, d: Math.round(d), spd: Math.round(b.spd), delay: +(b.delay || 0).toFixed(2), boss: g.boss && g.boss.id });
      }
      if (b.y > G.H * 0.7 && b.vy <= 0 && Math.abs(b.y - p.y) < 160) {
        HB.cheap.low++;
        if (HB.cheap.lowList.length < 40) HB.cheap.lowList.push({ stage: g.stageIdx, t: +g.t.toFixed(1), sec: section(g), style: b.style, x: Math.round(b.x), y: Math.round(b.y), vy: Math.round(b.vy) });
      }
    }
  }
  const MIDS = { trio: 1, lobista_mor: 1, servidor: 1, comitiva: 1 };
  function noteEnemy(e) {
    const g = G.game; if (!g) return;
    if (MIDS[e.kind]) { const st = curStage(); if (st) st.mid = { kind: e.kind, t0: +g.t.toFixed(1), alive: true, end: null, fled: null, hp: e.maxHp, ref: e, deaths: 0, lv: G.run.level, w: G.run.weapon }; }
    if (!e.harmless && e.y > G.H * 0.65 && HB.cheap.enemyLow.length < 40) HB.cheap.enemyLow.push({ stage: g.stageIdx, t: +g.t.toFixed(1), kind: e.kind, x: Math.round(e.x), y: Math.round(e.y) });
  }

  // ---------------- histórico de posições (para o atraso de reação) ----------------
  const HN = 28;
  function hist(o) { let h = o._h; if (!h) { h = o._h = new Float32Array(HN * 2); o._hn = 0; } const i = (o._hn % HN) * 2; h[i] = o.x; h[i + 1] = o.y; o._hn++; }
  let HX = 0, HY = 0, HA = 0;
  function histL(l) { let h = l._h; if (!h) { h = l._h = new Float32Array(HN * 3); l._hn = 0; } const i = (l._hn % HN) * 3; h[i] = l.x; h[i + 1] = l.y; h[i + 2] = l.ang; l._hn++; }
  function lasAt(l, back) { const n = l._hn | 0; if (!n || back >= n || back >= HN) return false; const i = ((n - 1 - back) % HN) * 3; HX = l._h[i]; HY = l._h[i + 1]; HA = l._h[i + 2]; return true; }
  function posAt(o, back) { const n = o._hn | 0; if (!n || back >= n || back >= HN) return false; const i = ((n - 1 - back) % HN) * 2; HX = o._h[i]; HY = o._h[i + 1]; return true; }

  // ---------------- anel de cenas para o oráculo ----------------
  const RING = 40, ring = [];
  function recordSnap(g, p) {
    const bl = [], bo = [], la = [];
    for (const b of g.eb) {
      if (b.dead || b.delay > 0) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < 240 * 240) bl.push(b.x, b.y, 3.2 + b.r * 0.8);
    }
    for (const e of g.enemies) {
      if (e.dead || e.harmless || e.invuln) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < 260 * 260) bo.push(e.x, e.y, e.r * 0.75 + 3.2);
    }
    const B = g.boss;
    if (B && B.state === 'fight' && !B.harmless) for (const hb of B.hitboxes || [{ dx: 0, dy: 0, r: B.r }]) bo.push(B.x + hb.dx, B.y + hb.dy, hb.r * 0.7 + 3.2);
    for (const l of g.lasers) {
      if (l.dead) continue;
      const on = l.t >= l.warn && l.t < l.warn + l.life - 0.1;
      la.push(l.x, l.y, l.x + Math.cos(l.ang) * l.len, l.y + Math.sin(l.ang) * l.len, l.width * 0.38 + 3.2, on ? 1 : 0);
    }
    ring.push({ px: p.x, py: p.y, bl, bo, la, f: g.frame });
    if (ring.length > RING) ring.shift();
  }
  // Dava para escapar? Conjunto alcançável numa grade de 3 px, dedo perfeito a vmax, reação a partir de 'back' passos atrás.
  function oracle(back, vmax) {
    const n = ring.length; if (n < back + 1) return null;
    const k0 = n - 1 - back, s0 = ring[k0];
    const C = 3, half = 210, N = Math.ceil((half * 2) / C);
    const ox = s0.px - half, oy = s0.py - half;
    let cur = new Uint8Array(N * N), nxt = new Uint8Array(N * N), blk = new Uint8Array(N * N);
    const ci = (x) => Math.round((x - ox) / C), cj = (y) => Math.round((y - oy) / C);
    cur[cj(s0.py) * N + ci(s0.px)] = 1;
    const step = (vmax / 60) / C; const rr = Math.max(1, Math.floor(step));
    const x0c = Math.max(0, ci(12)), x1c = Math.min(N - 1, ci(G.W - 12)), y0c = Math.max(0, cj(50)), y1c = Math.min(N - 1, cj(G.H - 24));
    for (let k = k0 + 1; k < n; k++) {
      const s = ring[k];
      // dilata (quadrado de raio rr, aproximação generosa do disco)
      nxt.fill(0);
      for (let y = y0c; y <= y1c; y++) for (let x = x0c; x <= x1c; x++) {
        if (!cur[y * N + x]) continue;
        for (let yy = Math.max(y0c, y - rr); yy <= Math.min(y1c, y + rr); yy++) for (let xx = Math.max(x0c, x - rr); xx <= Math.min(x1c, x + rr); xx++) nxt[yy * N + xx] = 1;
      }
      blk.fill(0);
      const mark = (bx, by, R) => {
        const a0 = Math.max(x0c, Math.floor((bx - R - ox) / C)), a1 = Math.min(x1c, Math.ceil((bx + R - ox) / C));
        const b0 = Math.max(y0c, Math.floor((by - R - oy) / C)), b1 = Math.min(y1c, Math.ceil((by + R - oy) / C));
        for (let y = b0; y <= b1; y++) for (let x = a0; x <= a1; x++) { const cx = ox + x * C - bx, cy = oy + y * C - by; if (cx * cx + cy * cy < R * R) blk[y * N + x] = 1; }
      };
      for (let i = 0; i < s.bl.length; i += 3) mark(s.bl[i], s.bl[i + 1], s.bl[i + 2]);
      for (let i = 0; i < s.bo.length; i += 3) mark(s.bo[i], s.bo[i + 1], s.bo[i + 2]);
      for (let i = 0; i < s.la.length; i += 6) {
        if (!s.la[i + 5]) continue;
        const ax = s.la[i], ay = s.la[i + 1], bx = s.la[i + 2], by = s.la[i + 3], R = s.la[i + 4];
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        for (let y = y0c; y <= y1c; y++) for (let x = x0c; x <= x1c; x++) {
          const px = ox + x * C, py = oy + y * C; let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t - px, qy = ay + dy * t - py; if (qx * qx + qy * qy < R * R) blk[y * N + x] = 1;
        }
      }
      let any = 0;
      for (let i = 0; i < nxt.length; i++) { if (nxt[i] && blk[i]) nxt[i] = 0; any |= nxt[i]; }
      const tmp = cur; cur = nxt; nxt = tmp;
      if (!any) return { ok: false, survived: k - k0 };
    }
    return { ok: true };
  }

  window.__oracle = (b, v) => oracle(b, v); window.__ring = () => ring;
  // ---------------- morte ----------------
  function onDeath() {
    const g = G.game, p = g.player, run = G.run, st = curStage();
    const rec = { stage: g.stageIdx, t: +g.t.toFixed(2), gt: +gtNow().toFixed(1), sec: section(g), lvBefore: run.level, w: run.weapon, livesLeft: run.lives - 1, bombsHeld: run.bombs, x: Math.round(p.x), y: Math.round(p.y) };
    // quem matou?
    let killer = null;
    for (const b of g.eb) {
      if (!b.dead) continue;
      const hr = p.r + b.r * 0.8 + 1.5;
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < hr * hr) {
        killer = { type: 'bullet', style: b.style, color: b.color, age: +b.t.toFixed(2), spd: Math.round(Math.hypot(b.vx, b.vy)), spawnD: b._pd != null ? Math.round(b._pd) : null,
          from: [Math.round(b._ox), Math.round(b._oy)], noticed: !!b._ok, accel: !!(b.accel || b.ax || b.ay || b.turn || b.update) };
        break;
      }
    }
    if (!killer) for (const l of g.lasers) {
      if (l.dead || l.t < l.warn) continue;
      const ex = l.x + Math.cos(l.ang) * l.len, ey = l.y + Math.sin(l.ang) * l.len, hr = p.r + l.width * 0.38 + 1;
      if (G.m.segDist2(p.x, p.y, l.x, l.y, ex, ey) < hr * hr) { killer = { type: 'laser', warn: l.warn, age: +l.t.toFixed(2), sweep: l.sweep }; break; }
    }
    if (!killer) for (const e of g.enemies) {
      if (e.dead || e.harmless || e.invuln) continue;
      const rr = e.r * 0.75 + p.r + 1;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) { killer = { type: 'body', kind: e.kind, vy: Math.round(e.vy || 0), vx: Math.round(e.vx || 0), y: Math.round(e.y) }; break; }
    }
    if (!killer && g.boss) killer = { type: 'boss-body', id: g.boss.id };
    rec.killer = killer || { type: '?' };
    let dens = 0; for (const b of g.eb) if (!b.dead && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 60 * 60) dens++;
    rec.dens60 = dens;
    rec.botTrapped = S.lastTrapT != null && g.t - S.lastTrapT < 0.5;
    const o1 = oracle(18, 600), o2 = oracle(30, 600), o3 = oracle(12, 900);
    rec.oracle = { r300_600: o1 && o1.ok, r500_600: o2 && o2.ok, r200_900: o3 && o3.ok };
    rec.unavoidable = o1 && !o1.ok && o3 && !o3.ok;
    if (cfg.shots && HB.snaps.length < 30) HB.snaps.push({ stage: g.stageIdx, t: rec.t, sec: rec.sec, killer: rec.killer, frames: [ring[Math.max(0, ring.length - 19)], ring[ring.length - 1]], W: G.W, H: G.H });
    HB.deaths.push(rec);
    if (st) {
      st.deaths++; const k = rec.killer.type === 'bullet' ? rec.killer.style : rec.killer.type === 'body' ? 'body:' + rec.killer.kind : rec.killer.type;
      st.deathsBy[k] = (st.deathsBy[k] || 0) + 1;
      if (st.boss && g.boss && g.boss.state === 'fight') { st.boss.deaths++; st.boss.deathsBy[rec.sec] = (st.boss.deathsBy[rec.sec] || 0) + 1; }
      if (st.mid && st.mid.alive) st.mid.deaths++;
    }
  }

  // ---------------- estado (níveis, itens, chefe intermediário) ----------------
  let lastLv = null, lastW = null, lastPix = 0;
  const tracked = new Set();
  function trackState(g, p, run) {
    if (lastLv !== run.level || lastW !== run.weapon) {
      const st = curStage();
      const ev = { gt: +gtNow().toFixed(1), stage: g.stageIdx, t: +g.t.toFixed(1), lv: run.level, w: run.weapon };
      HB.levels.push(ev); if (st) st.levelEvents.push(ev);
      lastLv = run.level; lastW = run.weapon;
    }
    if (run.pix < lastPix) { const st = curStage(); if (st) st.pixStolen += lastPix - run.pix; }
    lastPix = run.pix;
    // itens: coletado se sumiu perto do carro
    const live = new Set();
    for (const it of g.pickups) {
      if (it.dead || !it._rec) continue;
      live.add(it);
      tracked.add(it);
      it._ld = Math.hypot(it.x - p.x, it.y - p.y);
    }
    for (const it of tracked) {
      if (live.has(it)) continue;
      tracked.delete(it);
      it._rec.got = it._ld != null && it._ld < it.r + 30;
      if (it.type === 'power') it._rec.color = it.wtype;
    }
    const st = curStage();
    if (st && st.boss && g.boss && g.boss.id === st.boss.id) snapMech(st.boss, g.boss);
    if (st && st.mid && st.mid.alive && st.mid.ref.dead) {
      st.mid.alive = false; st.mid.end = +g.t.toFixed(1); st.mid.fled = !!st.mid.ref.escaped || st.mid.ref.hp > 0; st.mid.dur = +(st.mid.end - st.mid.t0).toFixed(1); delete st.mid.ref;
      if (cfg.mode === 'mid') HB.done = 'mid';
    }
  }

  // ---------------- o cérebro ----------------
  const S = { g: null, fx: 0, fy: 0, vx: 0, vy: 0, tgtX: 0, tgtY: 0, goalX: 180, goalY: 600, planLeft: 0, lastFrame: -9, lastSetX: null, lastSetY: null, jx: 0, jy: 0, lastTrapT: null, trapCd: -9, threats: [], lasers: [], cands: [], bombReason: null };
  function tick() {
    const g = G.game; if (!g) return;
    const p = g.player, run = G.run;
    HB.steps++;
    trackState(g, p, run);
    recordSnap(g, p);
    if (cfg.mode === 'run') brain(g, p, run);
    else tracker(g, p, run);
  }
  function resync(g, p) { S.g = g; S.fx = p.x; S.fy = p.y; S.vx = 0; S.vy = 0; S.tgtX = p.x; S.tgtY = p.y; S.planLeft = 0; S.goalX = p.x; S.goalY = p.y; S.lastSetX = null; }
  function moveFinger(g, p, vmax, amax, jitter) {
    const dt = 1 / 60, W = G.W, H = G.H;
    // empurrões externos (vento da Dilmãe mexe em p.tx e na âncora do dedo)
    if (S.lastSetX != null) { const ex = p.tx - S.lastSetX, ey = p.ty - S.lastSetY; if (ex || ey) { S.fx += ex; S.fy += ey; S.tgtX += ex; } }
    const dx = S.tgtX - S.fx, dy = S.tgtY - S.fy, d = Math.hypot(dx, dy);
    const want = Math.min(vmax, d / 0.07);
    const wvx = d > 0.01 ? (dx / d) * want : 0, wvy = d > 0.01 ? (dy / d) * want : 0;
    const ax = wvx - S.vx, ay = wvy - S.vy, al = Math.hypot(ax, ay), am = amax * dt;
    if (al > am) { S.vx += (ax / al) * am; S.vy += (ay / al) * am; } else { S.vx = wvx; S.vy = wvy; }
    S.fx = clamp(S.fx + S.vx * dt, 12, W - 12); S.fy = clamp(S.fy + S.vy * dt, 50, H - 24);
    S.jx = S.jx * 0.85 + gauss() * jitter * 0.55; S.jy = S.jy * 0.85 + gauss() * jitter * 0.55;
    p.tx = clamp(S.fx + S.jx, 12, W - 12); p.ty = clamp(S.fy + S.jy, 50, H - 24);
    S.lastSetX = p.tx; S.lastSetY = p.ty;
  }
  function brain(g, p, run) {
    if (S.g !== g || g.frame - S.lastFrame > 1) resync(g, p);
    S.lastFrame = g.frame;
    for (const b of g.eb) if (!b.dead) hist(b);
    for (const e of g.enemies) if (!e.dead) hist(e);
    if (g.boss) hist(g.boss);
    for (const l of g.lasers) if (!l.dead) histL(l);
    // lapsos de atenção (olhou o placar, o item, o chefão...): não replaneja por um instante
    if (S.lapseT > 0) S.lapseT -= 1 / 60;
    else if (rnd() < (P.lapseRate || 0) / 60) { S.lapseT = P.lapseMin + rnd() * (P.lapseMax - P.lapseMin); HB.lapses = (HB.lapses || 0) + 1; }
    if (--S.planLeft <= 0 && !(S.lapseT > 0)) { plan(g, p, run); S.planLeft = P.planEvery; }
    moveFinger(g, p, P.vmax, P.amax, P.jitter);
    // tempo fazendo a manha / dentro do raio do objetivo (diagnóstico da manha no modo run)
    const B = g.boss, AG = S.take && B && B.state === 'fight' ? B.autoGoal : null, st = curStage();
    if (AG && st && st.boss && AG.why !== 'stun') { st.boss.takeT += 1 / 60; if ((p.x - AG.x) ** 2 + (p.y - AG.y) ** 2 < Math.max(8, AG.r) ** 2) st.boss.inT += 1 / 60; }
  }
  function wantWeapon(run) { return cfg.weapon && cfg.weapon !== 'any' ? cfg.weapon : run.weapon; }
  function computeGoal(g, p, run) {
    const W = G.W, H = G.H;
    let gx = W / 2, gy = H * P.goalY;
    const B = g.boss;
    if (B && B.state === 'fight') {
      gx = B.x;
      if (run.weapon === 'boca' && cfg.profile === 'good') gy = H * 0.7;
    } else {
      let best = null, bs = 0;
      for (const e of g.enemies) {
        if (e.dead || e.kind === 'mb_hit' || e.y < 20 || e.y > p.y - 50 || e.x < 0 || e.x > W) continue;
        let s = (e.drop ? 3 : 1) * (e.big ? 2.5 : 1) / (1 + Math.abs(e.x - p.x) / 70) / (1 + Math.max(0, p.y - e.y - 250) / 200);
        if (s > bs) { bs = s; best = e; }
      }
      if (best) gx = best.x;
    }
    // manha do chefão (b.autoGoal): cada objeto novo (id novo) é notado com chance mechNotice e,
    // se notado, vira o objetivo mechDelay s depois (tempo de "entender" o que é); o desvio continua valendo
    const AG = cfg.mech !== 0 && B && B.state === 'fight' ? B.autoGoal : null;
    if (AG) {
      const key = B.id + ':' + AG.id;
      if (S.mechKey !== key) {
        S.mechKey = key; S.mechTake = rnd() < P.mechNotice; S.mechAt = g.t + P.mechDelay;
        const st = curStage();
        if (st && st.boss && AG.why !== 'stun') { st.boss.goals++; if (S.mechTake) st.boss.noticed++; }
      }
    }
    const take = (S.take = !!(AG && S.mechTake && g.t >= S.mechAt));
    S.takeR = take ? AG.r || 0 : 0;
    if (take) { gx = AG.x; gy = clamp(AG.y, H * 0.42, H - 40); }
    else gx = W / 2 + (gx - W / 2) * P.follow;
    // camada estratégica: "procurar a brecha" — olha a tela inteira (cortinas, colunas, o L girando)
    // e puxa o objetivo para a faixa da linha do carro que vai ficar livre nos próximos ~1,5 s
    // (fazendo a manha, só larga o objetivo quando a faixa está bem pior)
    if (g.t >= (S.stratT || 0)) { S.stratT = g.t + P.stratEvery; S.strat = strategy(g, p); }
    const dz = take ? 2.2 : 1.2;
    if (S.strat && S.strat.danger > dz) gx = M_lerp(gx, S.strat.x, Math.min(1, P.stratW * (S.strat.danger - dz) / 2 + 0.5));
    // itens (não durante a manha)
    const it = take ? null : pickItem(g, p, run);
    if (it) { gx = it.x; gy = clamp(it.y + 26, H * P.upper, H - 40); }
    // fazendo a manha o dedo vai direto (mechLag): seguir o chefão "pela metade" (followLag) não vale para um alvo que se mexe
    const k = 1 - Math.exp(-(P.planEvery / 60) / (take ? Math.min(P.followLag, P.mechLag != null ? P.mechLag : P.followLag) : P.followLag));
    S.goalX += (gx - S.goalX) * k; S.goalY += (gy - S.goalY) * k;
  }
  const M_lerp = (a, b, t) => a + (b - a) * t;
  const LANES = new Float32Array(37);
  function strategy(g, p) {
    const W = G.W, py = p.y, look = P.stratLook;
    LANES.fill(0);
    for (const b of g.eb) {
      if (b.dead || b.y > py - 20) continue;
      if (b._sn == null) b._sn = rnd() < P.stratNotice;
      if (!b._sn) continue;
      const vy = Math.max(b.vy, b.ay ? Math.min(b.vy + b.ay * 0.6, (b.data && b.data.vmax) || 200) : b.vy);
      if (vy < 25) continue;
      const tc = (py - b.y) / vy;
      if (tc < 0.25 || tc > look) continue;
      const xc = b.x + b.vx * tc, R = 3.2 + b.r * 0.8 + 6, wgt = 1 / (tc + 0.4);
      for (let k = 0; k < 37; k++) { const lx = k * 10; if (Math.abs(lx - xc) < R) LANES[k] += wgt; }
    }
    for (const l of g.lasers) {
      if (l.dead || l.t < 0.2) continue;
      let w = 0; if (l._h && l._hn > 6 && lasAt(l, 5)) w = (l.ang - HA) / (5 / 60);
      for (const tt of [0.3, 0.7, 1.1, 1.5]) {
        if (tt > look) break;
        const lt = l.t + tt; if (lt < l.warn - 0.2 || lt > l.warn + l.life) continue;
        const a = l.ang + w * tt, c = Math.cos(a), s2 = Math.sin(a);
        if (Math.abs(s2) < 0.05) continue;
        const u = (py - l.y) / s2; if (u < 0 || u > l.len) continue;
        const xc = l.x + c * u, R = l.width * 0.38 + 10 + Math.abs(c / s2) * 4;
        for (let k = 0; k < 37; k++) if (Math.abs(k * 10 - xc) < R) LANES[k] += 2.5 / (tt + 0.4);
      }
    }
    let best = p.x, bc = 1e9, here = 0;
    const pk = Math.round(clamp(p.x, 0, 360) / 10);
    for (let k = 1; k < 36; k++) {
      const d = (LANES[k - 1] + 2 * LANES[k] + LANES[k + 1]) / 4;
      if (k === pk) here = d;
      const c = d + Math.abs(k * 10 - p.x) / 160;
      if (c < bc) { bc = c; best = k * 10; }
    }
    return { x: clamp(best, 16, W - 16), danger: here };
  }
  const PRI = { life: 6, bomb: 5, power: 4, shield: 3.5, cafe: 2, mala: 1.5, pix5: 0.6 };
  function pickItem(g, p, run) {
    const H = G.H;
    let best = null, bs = 0;
    for (const it of g.pickups) {
      if (it.dead || !PRI[it.type]) continue;
      if (it._want == null) it._want = rnd() < P.itemGreed * (it.type === 'pix5' ? 0.5 : 1);
      if (!it._want) continue;
      if (Math.abs(it.x - p.x) > P.itemRange || it.y < H * 0.22 || it.y > p.y + 12) continue;
      if (it.type === 'power' && P.colorPicky && !powerOk(it, run)) continue;
      const s = PRI[it.type] / (1 + Math.abs(it.x - p.x) / 60);
      if (s > bs) { bs = s; best = it; }
    }
    return best;
  }
  function powerOk(it, run) {
    if (it.restore) return run.level < 5; // P "de volta" (morte): devolve o nível, qualquer cor
    const want = wantWeapon(run);
    if (it.wtype === want) return !(run.weapon === want && run.level >= 5);
    return false;
  }
  // quantas balas percebidas estão a menos de 44 px (sensação de "apertou")
  function nClose(T, p) { let n = 0; for (const th of T) if (th.w > 0.5 && (th.x - p.x) ** 2 + (th.y - p.y) ** 2 < 44 * 44) n++; return n; }
  function plan(g, p, run) {
    const W = G.W, H = G.H, dt = 1 / 60, t = g.t;
    const D = Math.max(1, Math.round((P.delay + (rnd() * 2 - 1) * P.delayJit) / dt));
    const lead = D * dt;
    const T = S.threats; T.length = 0;
    const R0 = P.perceive, R02 = R0 * R0;
    let nNear = 0;
    for (const b of g.eb) { if (b.dead) continue; const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < R02) nNear++; }
    const pNotice = clamp(P.notice - P.clutterK * Math.max(0, nNear - P.clutter0), P.noticeFloor, 1);
    for (const b of g.eb) {
      if (b.dead || !b._h || b._hn <= D) continue; // nasceu há menos que o tempo de reação: ainda não "viu"
      if (!posAt(b, D)) continue;
      const x0 = HX, y0 = HY;
      let vx, vy;
      if (posAt(b, D + 3)) { vx = (x0 - HX) / (3 * dt); vy = (y0 - HY) / (3 * dt); } else if (b.delay > 0) { vx = 0; vy = 0; } else { vx = b.vx; vy = b.vy; }
      if (b._nt == null) { b._nt = 0; b._ok = false; b._ve = gauss() * P.velNoise; b._sf = 1 + gauss() * P.spdNoise; b._mj = gauss() * P.marginJit; }
      const ca = Math.cos(b._ve), sa = Math.sin(b._ve);
      const pvx = (vx * ca - vy * sa) * b._sf, pvy = (vx * sa + vy * ca) * b._sf;
      const ex = x0 + pvx * lead, ey = y0 + pvy * lead;
      const dx = ex - p.x, dy = ey - p.y;
      if (dx * dx + dy * dy > R02) continue;
      if (!b._ok) { if (t >= b._nt) { if (rnd() < pNotice) b._ok = true; else b._nt = t + P.reroll; } if (!b._ok) continue; }
      T.push({ x: ex, y: ey, vx: pvx, vy: pvy, R: 3.2 + b.r * 0.8 + Math.max(1, P.margin + b._mj), w: 1 });
    }
    for (const e of g.enemies) {
      if (e.dead || !e._h || e._hn <= D) continue;
      const lion = e.kind === 'leao' && e.data && (e.data.st === 'aim' || e.data.st === 'pounce');
      if ((e.harmless && !lion) || e.invuln) continue;
      if (!posAt(e, D)) continue;
      const x0 = HX, y0 = HY; let vx = 0, vy = 0;
      if (posAt(e, D + 3)) { vx = (x0 - HX) / (3 * dt); vy = (y0 - HY) / (3 * dt); }
      const ex = x0 + vx * lead, ey = y0 + vy * lead;
      if ((ex - p.x) ** 2 + (ey - p.y) ** 2 > (R0 + 50) ** 2) continue;
      T.push({ x: ex, y: ey, vx, vy, R: e.r * 0.75 + 3.2 + P.margin + 3, w: lion ? 0.15 : 1 });
    }
    const B = g.boss;
    if (B && B.state === 'fight' && !B.harmless && posAt(B, D)) {
      const x0 = HX, y0 = HY; let vx = 0, vy = 0;
      if (posAt(B, D + 3)) { vx = (x0 - HX) / (3 * dt); vy = (y0 - HY) / (3 * dt); }
      for (const hb of B.hitboxes || [{ dx: 0, dy: 0, r: B.r }]) T.push({ x: x0 + hb.dx + vx * lead, y: y0 + hb.dy + vy * lead, vx, vy, R: hb.r * 0.7 + 3.2 + P.margin + 4, w: 1 });
    }
    // itens de cor errada: o "good" desvia para não trocar de arma sem querer
    if (P.colorPicky) {
      const magR = 30; // o ímã não puxa o P (só encostando, a 30 px)
      for (const it of g.pickups) {
        if (it.dead || it.type !== 'power' || powerOk(it, run)) continue;
        if ((it.x - p.x) ** 2 + (it.y - p.y) ** 2 > 160 * 160) continue;
        T.push({ x: it.x, y: it.y, vx: it.vx * 0.3, vy: Math.min(60, it.vy), R: Math.max(it.r + 14, magR - 4), w: 0.05 });
      }
    }
    const L = S.lasers; L.length = 0;
    for (const l of g.lasers) {
      if (l.dead || l.t < P.delay * 0.8) continue;
      // vê o laser com atraso e estima giro/deslocamento (o "L" do Lule gira por update, sem 'sweep')
      let x0 = l.x, y0 = l.y, a0 = l.ang, w = l.sweep || 0, vx = 0, vy = 0;
      if (lasAt(l, D)) { x0 = HX; y0 = HY; a0 = HA; if (lasAt(l, D + 4)) { w = (a0 - HA) / (4 * dt) + (l.sweep || 0) * 0; vx = (x0 - HX) / (4 * dt); vy = (y0 - HY) / (4 * dt); } }
      L.push({ l, x: x0 + vx * lead, y: y0 + vy * lead, a: a0 + w * lead, w, vx, vy, warn: l.warn, life: l.life, t: l.t, len: l.len, R: l.width * 0.38 + 3.2 + P.margin });
    }
    computeGoal(g, p, run);
    // candidatos
    const C = S.cands; C.length = 0;
    C.push(p.x, p.y, S.tgtX, S.tgtY, S.goalX, S.goalY);
    const off = rnd() * TAU / P.dirs;
    for (let i = 0; i < P.dirs; i++) { const a = off + (i * TAU) / P.dirs, ca = Math.cos(a), sa = Math.sin(a); for (const r of P.dists) C.push(p.x + ca * r, p.y + sa * r); }
    const Hh = P.horizon, K = P.samples, vmax = P.vmax;
    // manha de FICAR numa zona (objetivo com r >= 20: a META, embaixo do chefão tonto): o objetivo pesa mechHoldW
    // vezes mais ("fico dentro do anel"), senão o ruído de avaliação do casual o tira do anel; o desvio continua valendo.
    // Alvos de passagem (emenda, fio, Leão: r < 20) mantêm o peso normal.
    const wG = P.wGoal * (S.take && S.takeR >= 20 ? P.mechHoldW || 1 : 1);
    let bx = p.x, by = p.y, bc = 1e18, bHit = 9;
    for (let c = 0; c < C.length; c += 2) {
      const cx = clamp(C[c], 12, W - 12), cy = clamp(C[c + 1], 50, H - 24);
      const dx = cx - p.x, dy = cy - p.y, dist = Math.hypot(dx, dy);
      let cost = 0, first = 9;
      for (let k = 1; k <= K; k++) {
        const tau = (k / K) * Hh;
        const reach = Math.min(dist, vmax * Math.max(0, tau - 0.04));
        const qx = dist > 0 ? p.x + (dx / dist) * reach : p.x, qy = dist > 0 ? p.y + (dy / dist) * reach : p.y;
        for (let i = 0; i < T.length; i++) {
          const th = T[i];
          const ddx = th.x + th.vx * tau - qx, ddy = th.y + th.vy * tau - qy, d2 = ddx * ddx + ddy * ddy, R = th.R;
          if (d2 < R * R) { cost += 1000 * th.w * (1.3 - tau / Hh); if (th.w > 0.5 && tau < first) first = tau; }
          else if (d2 < (R + 14) * (R + 14)) cost += 2.5 * th.w * (1 - (Math.sqrt(d2) - R) / 14);
        }
        for (let i = 0; i < L.length; i++) {
          const l = L[i], lt = l.t + tau;
          if (lt < l.warn - 0.12 || lt > l.warn + l.life - 0.1) continue;
          const lx = l.x + l.vx * tau, ly = l.y + l.vy * tau, ang = l.a + l.w * tau, ex = lx + Math.cos(ang) * l.len, ey = ly + Math.sin(ang) * l.len;
          const R = l.R;
          if (G.m.segDist2(qx, qy, lx, ly, ex, ey) < R * R) { cost += 1000 * (1.3 - tau / Hh); if (tau < first) first = tau; }
        }
      }
      cost += wG * Math.hypot(cx - S.goalX, (cy - S.goalY) * 0.7) / 40;
      cost += P.wMove * dist / 40;
      if (cx < 22 || cx > W - 22) cost += 3;
      if (cy > H - 34) cost += 3;
      cost += P.evalNoise * rnd();
      if (cost < bc) { bc = cost; bx = cx; by = cy; bHit = first; }
    }
    // erro de ponto final proporcional à distância do movimento (lei de Fitts)
    const md = Math.hypot(bx - S.tgtX, by - S.tgtY);
    if (md > 6 && P.endErr) { const e = P.endErr * Math.hypot(bx - p.x, by - p.y); bx += gauss() * e; by += gauss() * e; }
    S.tgtX = clamp(bx, 12, W - 12); S.tgtY = clamp(by, 50, H - 24);
    // bomba: "sem saída" (acerto previsto em <= 0,25 s) com chance fixa; "preocupado" (acerto previsto
    // dentro do horizonte) com taxa por segundo — gente aperta DELAÇÃO quando a coisa aperta, mais ainda na última vida
    const canB = run.bombs > 0 && !p.entering && p.inv <= 0 && p.bombT <= 0;
    if (bHit <= 0.25) {
      S.lastTrapT = t;
      if (canB && t - S.trapCd > 0.8) {
        S.trapCd = t;
        const pb = run.lives <= 1 ? P.bombLast : P.bombTrap;
        if (rnd() < pb) { S.bombReason = 'trap'; G.bomb(); }
      }
    } else if (canB && (bHit < 0.42 || nClose(T, p) >= P.worryN)) {
      const lam = (P.bombWorry || 0) * (run.lives <= 1 ? 2 : 1) * (run.bombs >= 3 ? 1.5 : 1);
      if (rnd() < 1 - Math.exp(-lam * P.planEvery / 60)) { S.bombReason = 'worry'; G.bomb(); }
    }
  }

  // ---------------- modos de medição (god): seguidor simples ----------------
  function tracker(g, p, run) {
    if (S.g !== g || g.frame - S.lastFrame > 1) resync(g, p);
    S.lastFrame = g.frame;
    if (cfg.forceWeapon) { run.weapon = cfg.forceWeapon; run.level = cfg.forceLevel; }
    const W = G.W, H = G.H;
    let gx = W / 2;
    let gy = H * cfg.ty;
    if (cfg.mode === 'ttk' && g.boss && g.boss.state === 'fight') {
      gx = g.boss.x;
      // manha do chefão: vai no b.autoGoal (emenda, meta, fio, Leão, embaixo do chefão tonto)
      const goal = cfg.mech !== 0 ? g.boss.autoGoal : null;
      if (goal && goal.x != null) { gx = goal.x; if (goal.y != null) gy = goal.y; }
    }
    if (cfg.mode === 'mid') { const st = curStage(); const e = st && st.mid && st.mid.ref; if (e && !e.dead) gx = e.x; }
    if (cfg.mode === 'dps') gx = W / 2;
    const k = 1 - Math.exp(-(1 / 60) / (cfg.mode === 'dps' ? 0.01 : 0.25));
    S.goalX += (gx - S.goalX) * k;
    S.tgtX = S.goalX; S.tgtY = gy;
    moveFinger(g, p, cfg.mode === 'dps' ? 2000 : 350, 4000, 0);
    if (cfg.mode === 'ttk') ttkTrack(g);
    if (cfg.mode === 'dps') dpsTrack(g);
  }
  let ttkRec = null;
  function ttkTrack(g) {
    const b = g.boss;
    if (b && b.state === 'fight' && !ttkRec) ttkRec = { id: b.id, w: cfg.forceWeapon, lv: cfg.forceLevel, start: g.t, phases: [], hp: b.maxHp };
    if (ttkRec && !ttkRec.done && b && b.mech) snapMech(ttkRec, b);
    if (ttkRec && b && b.state === 'fight') { if (ttkRec.lastPh !== b.phase + '/' + (b.data && b.data.life)) { ttkRec.lastPh = b.phase + '/' + (b.data && b.data.life); ttkRec.phases.push(+b.ft.toFixed(1)); } ttkRec.ft = b.ft; ttkRec.fat = (b.data && b.data.fat) || 0; }
    if (ttkRec && !ttkRec.done && (!b || b.state === 'dying' || b.state === 'leaving')) { ttkRec.done = true; ttkRec.time = +((ttkRec.ft || 0)).toFixed(1); HB.ttk.push(ttkRec); HB.done = 'ttk'; }
    if (ttkRec && !ttkRec.done && b && b.ft > cfg.maxFight) { ttkRec.done = true; ttkRec.time = null; ttkRec.hpLeft = +(b.hp / b.maxHp).toFixed(2); HB.ttk.push(ttkRec); HB.done = 'ttk-timeout'; }
  }
  function dpsTrack(g) {
    const D = HB.dps; if (!D) return;
    if (g.t >= D.t0 + 2.5 && D.start == null) { D.start = g.t; D.dmg = 0; }
    if (D.start != null && g.t >= D.start + 10 && !D.done) { D.done = true; D.dps = +(D.dmg / (g.t - D.start)).toFixed(1); HB.done = 'dps'; }
  }

  function afterBoot() {
    const g = G.game;
    if (!g) return;
    if (cfg.startLv) G.run.level = cfg.startLv;
    if (cfg.startW) G.run.weapon = cfg.startW;
    if (cfg.startBombs != null) G.run.bombs = cfg.startBombs;
    if (cfg.mode === 'mid' || cfg.mode === 'dps') {
      G.Enemies.define('hb_dummy', { hp: 1e9, r: cfg.dummyR || 15, score: 0, pix: 0, harmless: true, keepOffscreen: true, ignoreClear: true,
        update(e) { e.x = e.o.x0; e.y = e.o.y0; }, draw() {}, onHit(e, dmg) { if (HB.dps && HB.dps.start != null) HB.dps.dmg += dmg; e.hp = 1e9; } });
      const kind = cfg.midKind;
      g.script = { gen: (function* () {
        yield 1.0;
        if (cfg.mode === 'mid') { const pos = { trio: [180, -110], lobista_mor: [180, -100], servidor: [180, -100], comitiva: [-40, 90] }[kind]; G.spawnEnemy(kind, pos[0], pos[1]); }
        else {
          HB.dps = { t0: G.game.t, dmg: 0, layout: cfg.layout };
          const H = G.H;
          if (cfg.layout === 'single') G.spawnEnemy('hb_dummy', 180, H * cfg.ty - 300, { x0: 180, y0: H * cfg.ty - 300 });
          else if (cfg.layout === 'offset') G.spawnEnemy('hb_dummy', 212, H * cfg.ty - 300, { x0: 212, y0: H * cfg.ty - 300 });
          else if (cfg.layout === 'near') G.spawnEnemy('hb_dummy', 180, H * cfg.ty - 140, { x0: 180, y0: H * cfg.ty - 140 });
          else for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { const x = 40 + i * 70, y = 150 + r * 80; G.spawnEnemy('hb_dummy', x, y, { x0: x, y0: y }); }
        }
        for (;;) yield 1000;
      })(), wait: null, done: false };
    }
  }
}

// ------------------------------------------------------------------
// Runner
// ------------------------------------------------------------------
const STAGE_OF = { centrao: 0, dilmae: 1, erika: 2, lule: 3 };
const MECH = opt.mech === 0 || opt.mech === '0' || opt.mech === 'false' ? 0 : 1;
const MID_STAGE = { trio: 0, lobista_mor: 1, servidor: 2, comitiva: 3 };
function parseUpg(s) { const o = {}; if (!s) return o; for (const kv of String(s).split(',')) { const [k, v] = kv.split(':'); if (k) o[k.trim()] = +v || 1; } return o; }

async function runOne(browser, job) {
  const ctx = await browser.newContext({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.stack || e.message).slice(0, 400)));
  const cfg = Object.assign({ prof: PROFILES[job.profile] || PROFILES.casual, fast: opt.fast, shots: opt.shots, continues: opt.continues, ty: opt.ty, maxFight: 300, mech: MECH }, job);
  await page.addInitScript({ content: '(' + pageMain.toString() + ')(' + JSON.stringify(cfg) + ');' });
  const q = new URLSearchParams({ stage: String(job.stage), loop: String(job.loop || 1), skipui: '1', autocontinue: '1', ts: String(opt.ts), quality: String(opt.quality || 'high') });
  if (job.mode !== 'run') q.set('god', '1');
  if (job.mode === 'ttk' || job.bossOnly) q.set('boss', '1');
  if (cfg.mech === 0) q.set('mech', '0'); // o autopiloto do core também ignora a manha
  const file = path.resolve(__dirname, '..', (opt.page === 'index' ? 'index' : 'dev') + '.html');
  await page.goto('file://' + file + '?' + q.toString());
  const t0 = Date.now();
  let res = null, lastGt = -1, stall = 0;
  while (Date.now() - t0 < opt.timeout * 1000) {
    await page.waitForTimeout(700);
    let s;
    try {
      s = await page.evaluate(() => ({ done: __hb.done, err: __hb.err, state: window.G && G.state, gt: __hb.gtTotal + (G.game ? G.game.t : 0), stage: G.game && G.game.stageIdx,
        through: true }));
    } catch (e) { s = { err: 'eval: ' + e.message }; }
    if (s.err && !res) { res = { err: s.err }; }
    if (s.done) break;
    if (job.mode === 'run' && !job.through && s.stage != null && s.stage !== job.stage) break; // terminou a fase pedida
    if (s.state === 'over' || s.state === 'menu') break;
    if (s.gt > opt.maxgt) break;
    if (Math.abs(s.gt - lastGt) < 0.01) { if (++stall > 20) break; } else stall = 0;
    lastGt = s.gt;
  }
  const data = await page.evaluate(() => { const g = window.G; return JSON.stringify({ hb: __hb, gErrors: g ? g.errors.slice(0, 10) : [], state: g && g.state, score: g && g.run && g.run.score, pix: g && g.run && g.run.pix, lives: g && g.run && g.run.lives, continues: g && g.run && g.run.continues, level: g && g.run && g.run.level, weapon: g && g.run && g.run.weapon, gt: __hb.gtTotal + (g && g.game ? g.game.t : 0) }); });
  const out = JSON.parse(data);
  out.pageErrors = pageErrors;
  out.real = Math.round((Date.now() - t0) / 1000);
  out.job = job;
  if (opt.shots && out.hb.snaps && out.hb.snaps.length) out.snapFiles = await drawSnaps(page, out.hb.snaps, job);
  delete out.hb.snaps;
  await ctx.close();
  return out;
}
// desenha as cenas gravadas antes das mortes (geometria exata das hitboxes)
async function drawSnaps(page, snaps, job) {
  const files = [];
  for (let i = 0; i < snaps.length; i++) {
    const url = await page.evaluate((s) => {
      const c = document.createElement('canvas'); c.width = s.W * 2; c.height = s.H; const x = c.getContext('2d');
      const P = Object.getPrototypeOf(x);
      // a página pode ter as primitivas desligadas (--fast): usa as originais de um iframe
      const RP = window.__origCP || P;
      for (const k of ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText']) x[k] = RP[k].bind(x);
      x.fillStyle = '#10141c'; x.fillRect(0, 0, c.width, c.height);
      s.frames.forEach((f, k) => {
        if (!f) return;
        x.save(); x.translate(k * s.W, 0);
        x.strokeStyle = '#333'; x.strokeRect(0, 0, s.W, s.H);
        for (let i = 0; i < f.la.length; i += 6) { x.strokeStyle = f.la[i + 5] ? '#ff2a4a' : 'rgba(255,42,74,0.35)'; x.lineWidth = f.la[i + 5] ? f.la[i + 4] * 2 : 1; x.beginPath(); x.moveTo(f.la[i], f.la[i + 1]); x.lineTo(f.la[i + 2], f.la[i + 3]); x.stroke(); }
        x.lineWidth = 1;
        for (let i = 0; i < f.bo.length; i += 3) { x.strokeStyle = '#ffd23f'; x.beginPath(); x.arc(f.bo[i], f.bo[i + 1], f.bo[i + 2], 0, 6.29); x.stroke(); }
        for (let i = 0; i < f.bl.length; i += 3) { x.fillStyle = '#ff3d7f'; x.beginPath(); x.arc(f.bl[i], f.bl[i + 1], f.bl[i + 2], 0, 6.29); x.fill(); }
        x.fillStyle = '#4cc9f0'; x.beginPath(); x.arc(f.px, f.py, 4, 0, 6.29); x.fill();
        x.strokeStyle = 'rgba(76,201,240,0.4)'; x.beginPath(); x.arc(f.px, f.py, 60, 0, 6.29); x.stroke();
        x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText((k ? 'morte' : '-0,3 s') + '  ' + s.sec, 6, s.H - 8);
        x.restore();
      });
      return c.toDataURL('image/png');
    }, snaps[i]);
    const f = path.join(opt.out, 'death-' + job.profile + '-s' + job.stage + '-seed' + job.seed + '-' + i + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    files.push(f);
  }
  return files;
}

async function pool(jobs, n, fn) {
  const results = new Array(jobs.length);
  let next = 0;
  async function worker() { while (next < jobs.length) { const i = next++; results[i] = await fn(jobs[i], i); } }
  await Promise.all(Array.from({ length: Math.max(1, n) }, worker));
  return results;
}

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const f1 = (v) => (v == null || isNaN(v) ? '-' : (+v).toFixed(1));

function summarizeRuns(results) {
  const byStage = {};
  for (const r of results) {
    if (!r || !r.hb) continue;
    for (const st of r.hb.stages) {
      if (!r.job.through && st.idx !== r.job.stage) continue;
      const k = st.idx;
      const S = byStage[k] || (byStage[k] = { runs: 0, deaths: [], bossDeaths: [], midDeaths: [], bombs: [], bossTime: [], midTime: [], midFled: 0, cleared: 0, pix: [], score: [], ranks: {}, lvBoss: [], lvStart: [], cont: [], killers: {}, bossSecs: {}, unavoidable: 0, deathsTotal: 0, pDrops: [], pGot: [], lifeDrops: 0, bombDrops: 0, stolen: [], mOk: [], mMiss: [], mStuns: [], mGoals: [], mNoticed: [], mTake: [], mIn: [], mKind: null });
      S.runs++;
      S.deaths.push(st.deaths); S.bombs.push(st.bombs);
      S.lvStart.push(st.lvStart);
      if (st.boss && st.boss.mech) { S.mKind = st.boss.mech.kind; S.mOk.push(st.boss.mech.ok); S.mMiss.push(st.boss.mech.miss); S.mStuns.push(st.boss.mech.stuns); S.mGoals.push(st.boss.goals || 0); S.mNoticed.push(st.boss.noticed || 0); S.mTake.push(st.boss.takeT || 0); S.mIn.push(st.boss.inT || 0); }
      if (st.boss) { S.bossDeaths.push(st.boss.deaths); if (st.boss.end != null) S.bossTime.push(st.boss.end); S.lvBoss.push(st.boss.lv); for (const k2 in st.boss.deathsBy) S.bossSecs[k2] = (S.bossSecs[k2] || 0) + st.boss.deathsBy[k2]; }
      if (st.mid) { S.midDeaths.push(st.mid.deaths); if (st.mid.dur != null) S.midTime.push(st.mid.dur); if (st.mid.fled) S.midFled++; }
      if (st.clear) { S.cleared++; S.pix.push(st.clear.pixStage); S.score.push(st.clear.score); S.ranks[st.clear.rank] = (S.ranks[st.clear.rank] || 0) + 1; S.cont.push(st.clear.continues - st.contStart); }
      for (const k2 in st.deathsBy) S.killers[k2] = (S.killers[k2] || 0) + st.deathsBy[k2];
      const pw = st.items.filter((i) => i.type === 'power' && i.src === 'enemy');
      S.pDrops.push(pw.length); S.pGot.push(pw.filter((i) => i.got).length);
      S.lifeDrops += st.items.filter((i) => i.type === 'life').length; S.bombDrops += st.items.filter((i) => i.type === 'bomb').length;
      S.stolen.push(st.pixStolen);
    }
    for (const d of r.hb.deaths) { const S = byStage[d.stage]; if (S) { S.deathsTotal++; if (d.unavoidable) S.unavoidable++; } }
  }
  // manha: acerto = ok / (ok + miss) somando as partidas
  for (const k in byStage) {
    const S = byStage[k], ok = S.mOk.reduce((a, v) => a + v, 0), miss = S.mMiss.reduce((a, v) => a + v, 0);
    S.mechRate = ok + miss ? +(ok / (ok + miss)).toFixed(2) : null;
  }
  return byStage;
}
function printRunTable(byStage, label) {
  console.log('\n=== ' + label + ' ===');
  console.log('fase | partidas | mortes méd (min-max) | no chefe | no meio | bombas | t chefe (s) | t meio (s) fugiu | nv início/chefe | Pix fase | placar | notas | recont. | P dropados/pegos | inevitáveis');
  for (const k of Object.keys(byStage).sort()) {
    const S = byStage[k];
    console.log([k, S.runs, f1(mean(S.deaths)) + ' (' + Math.min(...S.deaths) + '-' + Math.max(...S.deaths) + ')', f1(mean(S.bossDeaths)), f1(mean(S.midDeaths)), f1(mean(S.bombs)),
      f1(mean(S.bossTime)), f1(mean(S.midTime)) + ' ' + S.midFled, f1(mean(S.lvStart)) + '/' + f1(mean(S.lvBoss)), f1(mean(S.pix)), Math.round(mean(S.score)) || '-', JSON.stringify(S.ranks), f1(mean(S.cont)),
      f1(mean(S.pDrops)) + '/' + f1(mean(S.pGot)), S.unavoidable + '/' + S.deathsTotal].join(' | '));
    console.log('     mortes por causa: ' + JSON.stringify(S.killers) + '  | chefe por fase: ' + JSON.stringify(S.bossSecs));
    if (S.mOk.length) {
      console.log('     manha ' + S.mKind + ': ok/miss/stuns méd ' + f1(mean(S.mOk)) + '/' + f1(mean(S.mMiss)) + '/' + f1(mean(S.mStuns)) +
        ' | acerto ' + (S.mechRate != null ? Math.round(S.mechRate * 100) + '%' : '-') + ' | objetos vistos/notados méd ' + f1(mean(S.mGoals)) + '/' + f1(mean(S.mNoticed)) + ' | s na manha/no alvo ' + f1(mean(S.mTake)) + '/' + f1(mean(S.mIn)) +
        ' | por partida ' + S.mOk.map((v, i) => v + '/' + S.mMiss[i] + '/' + S.mStuns[i]).join(' '));
    }
  }
}

(async () => {
  fs.mkdirSync(opt.out, { recursive: true });
  const browser = await chromium.launch();
  const t0 = Date.now();
  let jobs = [], results;
  const upgrades = parseUpg(opt.upg);
  if (opt.mode === 'run') {
    const profs = String(opt.profile).split(',');
    for (const pf of profs) for (let r = 0; r < opt.runs; r++) jobs.push({ mode: 'run', profile: pf, stage: +opt.stage, through: +opt.through, seed: opt.seed + r, weapon: opt.weapon, upgrades, loop: opt.loop,
      bossOnly: +opt.bossOnly || 0, startLv: +opt.startLv || 0, startW: opt.startW || null });
  } else if (opt.mode === 'ttk') {
    for (const id of String(opt.bosses).split(',')) for (const w of String(opt.weapons).split(',')) for (const lv of String(opt.levels).split(',').map(Number))
      jobs.push({ mode: 'ttk', profile: 'good', stage: STAGE_OF[id], seed: opt.seed, forceWeapon: w, forceLevel: lv, upgrades, loop: opt.loop, bossId: id });
  } else if (opt.mode === 'mid') {
    for (const kind of Object.keys(MID_STAGE)) for (const w of String(opt.weapons).split(',')) for (const lv of String(opt.levels).split(',').map(Number))
      jobs.push({ mode: 'mid', profile: 'good', stage: MID_STAGE[kind], seed: opt.seed, forceWeapon: w, forceLevel: lv, midKind: kind, upgrades, loop: opt.loop });
  } else if (opt.mode === 'dps') {
    for (const layout of ['single', 'offset', 'near', 'crowd']) for (const w of String(opt.weapons).split(',')) for (const lv of [1, 2, 3, 4, 5])
      jobs.push({ mode: 'dps', profile: 'good', stage: 0, seed: opt.seed, forceWeapon: w, forceLevel: lv, layout, upgrades, loop: 1, dummyR: layout === 'crowd' ? 13 : 15 });
  }
  results = await pool(jobs, opt.parallel, async (job, i) => {
    let r;
    try { r = await runOne(browser, job); } catch (e) { r = { job, err: String(e.stack || e) }; }
    const tag = job.mode + ' ' + (job.profile || '') + ' s' + job.stage + ' seed' + job.seed + (job.forceWeapon ? ' ' + job.forceWeapon + job.forceLevel : '') + (job.midKind ? ' ' + job.midKind : '') + (job.layout ? ' ' + job.layout : '');
    if (job.mode === 'run' && r.hb) {
      const st = r.hb.stages.map((s) => 'F' + (s.idx + 1) + ':' + s.deaths + 'm' + (s.boss ? '/chefe ' + s.boss.deaths + 'm ' + (s.boss.end != null ? s.boss.end + 's' : 'x') : '') + (s.clear ? ' ' + s.clear.rank + ' R$' + s.clear.pixStage : ''));
      console.log('[' + (i + 1) + '/' + jobs.length + '] ' + tag + ' -> ' + st.join(' | ') + ' | recont ' + r.continues + ' | ' + r.real + 's real | err ' + (r.hb.err || r.gErrors.length || r.pageErrors.length ? JSON.stringify([r.hb.err, r.gErrors[0], r.pageErrors[0]]) : 0));
    } else if (r.hb) {
      const v = job.mode === 'ttk' ? JSON.stringify(r.hb.ttk[0] || null) : job.mode === 'dps' ? JSON.stringify(r.hb.dps && r.hb.dps.dps) : JSON.stringify(r.hb.stages[0] && r.hb.stages[0].mid);
      console.log('[' + (i + 1) + '/' + jobs.length + '] ' + tag + ' -> ' + v + (r.hb.err ? ' ERR ' + r.hb.err.slice(0, 200) : ''));
    } else console.log('[' + (i + 1) + '/' + jobs.length + '] ' + tag + ' FAILED ' + (r.err || '').slice(0, 300));
    return r;
  });
  await browser.close();
  const summary = { opt, real: Math.round((Date.now() - t0) / 1000), results };
  if (opt.mode === 'run') {
    const profs = String(opt.profile).split(',');
    summary.byProfile = {};
    for (const pf of profs) { const bs = summarizeRuns(results.filter((r) => r && r.job && r.job.profile === pf)); summary.byProfile[pf] = bs; printRunTable(bs, pf); }
  } else if (opt.mode === 'ttk') {
    summary.ttk = results.map((r) => { const t = r.hb && r.hb.ttk[0]; return { boss: r.job.bossId, w: r.job.forceWeapon, lv: r.job.forceLevel, mech: MECH, time: t ? t.time : null, hpLeft: t && t.hpLeft, fat: t && t.fat, phases: t && t.phases, ok: t && t.mech ? t.mech.ok : null, miss: t && t.mech ? t.mech.miss : null, stuns: t && t.mech ? t.mech.stuns : null, errors: r.gErrors ? r.gErrors.length : null, pageErrors: r.pageErrors ? r.pageErrors.length : null }; });
    console.log('\nmanha: ' + (MECH ? 'faz (--mech 1)' : 'ignora (--mech 0, mech=0 na URL)'));
    console.log('chefe | arma | nv | tempo (s) | fases (ft) | cansaço | manha ok/miss/stuns');
    for (const r of results) {
      const t = r.hb && r.hb.ttk[0], m = t && t.mech;
      console.log([r.job.bossId, r.job.forceWeapon, r.job.forceLevel, t ? (t.time != null ? t.time : '>' + 300 + ' (sobra ' + t.hpLeft + ')') : 'ERR', t ? t.phases.join(',') : '', t ? t.fat.toFixed(2) : '',
        m ? m.kind + ' ' + m.ok + '/' + m.miss + '/' + m.stuns : '-'].join(' | '));
    }
  } else if (opt.mode === 'dps') {
    console.log('\nlayout | arma | nv | dps');
    for (const r of results) console.log([r.job.layout, r.job.forceWeapon, r.job.forceLevel, r.hb && r.hb.dps ? r.hb.dps.dps : 'ERR'].join(' | '));
  } else if (opt.mode === 'mid') {
    console.log('\nmeio | arma | nv | tempo (s) | fugiu');
    for (const r of results) { const m = r.hb && r.hb.stages[0] && r.hb.stages[0].mid; console.log([r.job.midKind, r.job.forceWeapon, r.job.forceLevel, m ? m.dur : 'ERR', m ? m.fled : ''].join(' | ')); }
  }
  fs.writeFileSync(path.join(opt.out, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log('\nsalvo em ' + path.join(opt.out, 'summary.json') + ' (' + summary.real + ' s)');
})().catch((e) => { console.error(e); process.exit(1); });
