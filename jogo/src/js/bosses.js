/* ============================================================
   FUSCA A JATO — bosses.js
   Chefões 1–2: O CENTRÃO e DILMÃE (+ G.BossKit). A ERIKA VIRALTON fica em erika.js
   (+ retratos dos diálogos, estilos de tiro 'bs_' e o sub-inimigo
   'bs_apoio'). Contrato: docs/ENGINE.md §5 (manhas: §5.1).
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
  // cansa e passa a levar mais dano (até 2× 60 s depois). Usa b.ft (tempo de luta de relógio, corre até no tonto).
  // Multiplicador de dano (todo quadro, teto 4): base × (1 + cansaço), base = tonto (d.stunMul) →
  // armadura da manha (d.armor) → armadura antiga da fase (d.dmgBase) → 1. Escreve também b.hudTag.
  const FAT_START = 95, FAT_FULL = 60, MUL_CAP = 4;
  function fatigue(b, line) {
    const d = b.data, f = clamp((b.ft - (b.def.fatStart || FAT_START)) / FAT_FULL, 0, 1);
    if (f > 0 && !d.fatSaid) { d.fatSaid = 1; say(b, line || 'CANSEI...', 2); G.text(b.x, b.y + 60, 'CANSOU!', { color: G.C.yellow, size: 14, life: 1.4 }); }
    d.fat = f;
    applyMul(b);
  }
  function applyMul(b) {
    const d = b.data, st = d.stunT > 0;
    const base = st ? d.stunMul : (d.armor != null ? d.armor : (d.dmgBase != null ? d.dmgBase : 1));
    b.dmgMul = Math.min(MUL_CAP, base * (1 + (d.fat || 0)));
    b.hudTag = st ? d.stunTag : (d.armorTag || null);
  }

  // ---------- manhas (mecânica de cada chefão além do tiro; ENGINE §5.1) ----------
  // Regra do VERDE-ÁGUA: tudo que o Fusca deve encostar tem anel/halo verde-água tracejado, contorno branco,
  // rótulo em PT-BR e um apoio físico (paraquedas, anel no chão, fio, celular). Tiro nunca é verde-água.
  const MECH = { TEAL: '#32bcad', TEAL_L: '#7ff0e2', CAR_R: 14, GOLD: '#ffd23f' };
  // relógio do chefão: só anda fora do tonto (as corrotinas esperam por ele, nunca por b.ft)
  const clk = (b) => b.data.clk || 0;
  function carOk() { const p = G.game && G.game.player; return p && p.alive && !p.entering ? p : null; }
  // o corpo do Fusca (raio 14) encosta no círculo (x, y, r)
  function carNear(x, y, r) {
    const p = carOk(); if (!p) return false;
    const k = r + MECH.CAR_R;
    return M.dist2(p.x, p.y, x, y) < k * k;
  }
  // última linha do def.update: posição anterior do carro (para o teste de varredura)
  function trackCar(b) { const p = pl(); b.data.cpx = p.x; b.data.cpy = p.y; }
  // os segmentos [a,b] e [c,d] se cruzam de verdade (sem contar só encostar na ponta)
  function crossSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  // pts = [x0,y0,x1,y1,…] (n pontos). Testa os segmentos from..n-2: devolve o 1º acertado ou -1.
  // Acerto = o carro a menos de r do segmento OU o movimento do carro neste quadro cruzando o segmento (sem túnel).
  function carSwept(b, pts, n, r, from) {
    const p = carOk(); if (!p) return -1;
    const d = b.data, r2 = r * r, mv = d.cpx != null && (d.cpx !== p.x || d.cpy !== p.y);
    for (let i = from || 0; i <= n - 2; i++) {
      const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * i + 2], by = pts[2 * i + 3];
      if (M.segDist2(p.x, p.y, ax, ay, bx, by) < r2) return i;
      if (mv && crossSeg(d.cpx, d.cpy, p.x, p.y, ax, ay, bx, by)) return i;
    }
    return -1;
  }
  // alvo do piloto automático / humanbot (um objeto reaproveitado por chefão)
  function setGoal(b, x, y, why, r, id) {
    const d = b.data, o = d._goal || (d._goal = { x: 0, y: 0, r: 0, why: '', id: '' });
    o.x = clamp(x, 16, G.W - 16); o.y = clamp(y, G.H * 0.42, G.H - 30); o.r = r || 0; o.why = why; o.id = id != null ? id : why;
    b.autoGoal = o;
    return o;
  }
  function clearGoal(b) { b.autoGoal = null; }
  function mechInit(b, kind) { b.mech = { kind, ok: 0, miss: 0, stuns: 0 }; }
  function mechOk(b) { if (b.mech) b.mech.ok++; }
  function mechMiss(b) { if (b.mech) b.mech.miss++; }
  // ×2,2 / ×2 (uma casa, vírgula)
  function fmtMul(m) { const v = Math.round(m * 10) / 10; return v % 1 === 0 ? String(v) : v.toFixed(1).replace('.', ','); }
  // TONTO = PAUSA: nada de corrotina, relógio, movimento nem cronômetro do chefão; objetos da manha continuam.
  // o = { tag, color, text, textColor, say, clear = true, onEnd, sfx = 'mech_ok' }
  function stunStart(b, dur, mul, o) {
    o = o || {};
    const d = b.data;
    if (L2()) dur *= 0.85;
    d.stunT = d.stunT0 = dur; d.stunMul = mul;
    d.stunTag = { text: o.tag || 'BRECHA ×' + fmtMul(mul), color: o.color || '#ffd23f' };
    d.stunOnEnd = o.onEnd || null;
    if (o.clear !== false) G.clearBullets(true); // os tiros viram Pix
    G.hitstop(0.06); G.shake(5); sfx('stamp'); sfx(o.sfx || 'mech_ok');
    if (b.mech) b.mech.stuns++;
    const run = G.run;
    if (run && !(run.loop > 1) && !run._brecha) {
      run._brecha = 1;
      G.text(G.W / 2, G.H * 0.42, 'BRECHA! DANO DOBRADO!', { color: '#ffd23f', size: 16, life: 2.0, stroke: true });
    }
    if (o.text) G.text(b.x, b.y + 74, o.text, { color: o.textColor || MECH.TEAL_L, size: 16, life: 1.6, stroke: true });
    if (o.say) say(b, o.say, 2);
    applyMul(b);
  }
  function stunExtend(b, add, cap) { const d = b.data; d.stunT = Math.min(cap, d.stunT + add); }
  const stunning = (b) => b.data.stunT > 0;
  function stunEnd(b) {
    const d = b.data, f = d.stunOnEnd;
    d.stunT = 0; d.stunOnEnd = null;
    if (f) f(b);
    d.mechCd = 2.0; // o chefão desconta isso fora do tonto: 2 s até a próxima manha
    applyMul(b);
  }
  // true enquanto tonto (chama stunEnd quando acaba)
  function stunUpdate(b, dt) {
    const d = b.data;
    if (d.stunT > 0) { d.stunT -= dt; if (d.stunT <= 0) stunEnd(b); }
    return d.stunT > 0;
  }
  // dica da manha (só no 1º mandato, uma vez por partida): maior e mais demorada que hint()
  function mechHint(key, x, y, str, color) {
    const run = G.run; if (!run || run.loop > 1) return;
    const h = run._bsHints || (run._bsHints = {});
    if (h[key]) return;
    h[key] = 1;
    G.text(x, y, str, { size: 14, life: 3.0, vy: -8, stroke: true, color: color || MECH.TEAL_L });
  }
  // anel de encostar: 12% de preenchimento + contorno de 2,5 px tracejado andando (ou cheio pulsando)
  // o = { label, prog, solid, blink, alpha = 1, fill = true, color = MECH.TEAL }. Só traços, sem shadowBlur.
  function mechRing(c, x, y, r, t, o) {
    o = o || {};
    if (o.blink && ((t * 16) | 0) % 2) return;
    const col = o.color || MECH.TEAL, a0 = c.globalAlpha * (o.alpha != null ? o.alpha : 1);
    c.save();
    if (o.fill !== false) { c.globalAlpha = a0 * 0.12; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    // contorno branco fino por fora (lê em qualquer fundo)
    c.globalAlpha = a0 * 0.6; c.strokeStyle = '#ffffff'; c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, r + 2.2, 0, TAU); c.stroke();
    c.globalAlpha = a0 * (o.solid ? 0.75 + 0.25 * Math.sin(t * 10) : 1);
    c.strokeStyle = col; c.lineWidth = 2.5;
    if (!o.solid) { c.setLineDash([8, 6]); c.lineDashOffset = -t * 20; }
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    c.setLineDash([]); c.lineDashOffset = 0;
    if (o.prog > 0) {
      c.globalAlpha = a0; c.strokeStyle = '#ffd23f'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y, r, -PI / 2, -PI / 2 + TAU * Math.min(1, o.prog)); c.stroke();
    }
    if (o.label) { c.globalAlpha = a0; txt(c, o.label, x, y - r - 9, 10, '#ffffff', { stroke: 3 }); }
    c.restore();
  }
  // halo verde-água (gradiente radial num canvas pequeno, um por raio inteiro e resolução)
  const HALO = new Map();
  function haloSprite(r) {
    const res = devRes() || 1, key = r + '|' + res;
    let cv = HALO.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    const px = Math.max(2, Math.ceil(2 * r * res));
    cv.width = cv.height = px;
    const x = cv.getContext('2d');
    if (x) {
      const h = px / 2, gr = x.createRadialGradient(h, h, 0, h, h, h);
      gr.addColorStop(0, 'rgba(127,240,226,0)'); gr.addColorStop(0.45, 'rgba(127,240,226,0.22)');
      gr.addColorStop(0.72, 'rgba(50,188,173,0.5)'); gr.addColorStop(1, 'rgba(50,188,173,0)');
      x.fillStyle = gr; x.fillRect(0, 0, px, px);
    }
    if (HALO.size > 24) HALO.delete(HALO.keys().next().value);
    HALO.set(key, cv);
    return cv;
  }
  function tealHalo(c, x, y, r, t) {
    r = Math.max(2, Math.round(r));
    const cv = haloSprite(r);
    c.save(); c.globalAlpha *= 0.45 + 0.2 * Math.sin(t * 6);
    c.drawImage(cv, x - r, y - r, 2 * r, 2 * r);
    c.restore();
  }
  // coração (ícone desenhado, nada de glifo ♥). Só ACRESCENTA o subcaminho (como E/O): chame beginPath antes.
  function heartPath(c, x, y, s) {
    const k = s / 2;
    c.moveTo(x, y + k * 0.85);
    c.bezierCurveTo(x - k * 1.25, y + k * 0.05, x - k * 1.05, y - k * 1.05, x, y - k * 0.38);
    c.bezierCurveTo(x + k * 1.05, y - k * 1.05, x + k * 1.25, y + k * 0.05, x, y + k * 0.85);
    c.closePath();
  }
  // chama o drawOver do próprio módulo no fim do def.draw quando o core não tem a camada (embaixo dos tiros)
  function drawOverFallback(def, ctx, b, g) {
    if (!(G.coreHooks && G.coreHooks.drawOver) && def.drawOver) { ctx.save(); def.drawOver(ctx, b, g); ctx.restore(); }
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
  // espera s segundos (relógio do chefão: para no tonto) chamando fn(u 0..1) a cada quadro
  function* tween(b, s, fn) {
    const t0 = clk(b);
    for (;;) {
      const u = Math.min(1, (clk(b) - t0) / s);
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
        // faixa horizontal de aviso com setas (pedalada)
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
  // Manha PEGAR A EMENDA (afinação: HP → tempo de tonto → cadência → armadura). Velocidades em px/s, tempos em s.
  // APEX_Y = altura do paraquedas (× H); STUN = tonto por turno; HEAL = cura de emenda perdida (× HP máx).
  const EM = {
    APEX_Y: 0.28, FALL: 50, FALL_L2: 62, FALL_TUT: 40, CATCH_R: 13, SWAY: 18, SWAY_HZ: 0.45,
    STUN: [3.0, 3.5, 4.0, 3.0], MUL: 2.2, HEAL: 0.02, CD: 2.0, TRAITOR_DMG: 25,
    FALL_P4: 60, FALL_P4_L2: 70, TUT_MAX: 9,
  };
  const SIDE = [
    { main: '#e63946', dark: '#9e1b28', acc: '#ffffff', name: 'vermelho' },
    { main: '#c9b48a', dark: '#8f7a52', acc: '#f2e6c4', name: 'em cima do muro' },
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
    const cv = sprCache.get(key);
    if (cv) return cv;
    const old = sprStale.get(key);
    if (!old) return null;
    if (!old._rq) { // o que está na tela é repintado primeiro
      old._rq = 1;
      const k = sprQ.findIndex((j) => j.key === key);
      if (k > 0) { const j = sprQ.splice(k, 1)[0]; sprQ.splice(sprQ[0].i > 0 ? 1 : 0, 0, j); }
    }
    return old;
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

  // ---------- sub-inimigo: deputadinho puxa-saco (cura o Centrão se chegar) ----------
  // Fase 3: os 2 mais perto correm atrás da EMENDA que cai (d.chase) e levam ela pro chefão (d.carry).
  // BASE DO ZÉ (Centrão tonto): vira TRAÍRA (inofensivo e invulnerável, plaquinha "NÃO") e voa de volta no Centrão.
  const APOIO_SPECS = [
    { skin: '#e8b48a', hair: 'slick', hairColor: '#3a3a3a', body: 'suit', suit: '#6b7384', tie: '#e63946', face: 'jowl', seed: 51 },
    { skin: '#c68a5e', hair: 'bald', hairColor: '#444444', body: 'suit', suit: '#5d6575', tie: '#e63946', face: 'round', mustache: true, seed: 52 },
    { skin: '#f0c49c', hair: 'combover', hairColor: '#7a6a5a', body: 'suit', suit: '#737b8c', tie: '#e63946', glasses: 'square', seed: 53 },
  ];
  // 'G' = muro: gravata bege do lado 1 ('em cima do muro')
  const APOIO_SPECS_G = APOIO_SPECS.map((s) => Object.assign({}, s, { tie: '#8f7a52' }));
  function apoioTraitor(e, first) {
    const d = e.data;
    if (d.traitor) return;
    d.traitor = { t: 0, x0: e.x, y0: e.y };
    e.invuln = true; d.chase = null;
    if (first) G.say(e, 'QUEM PAGA MAIS LEVA!', 1.6);
  }
  G.Enemies.define('bs_apoio', {
    hp: 6, r: 11, score: 220, pix: 2, harmless: true, keepOffscreen: true,
    init(e, o) {
      const d = e.data;
      d.spd = o.spd || 48; d.side = o.side || (e.x < G.W / 2 ? -1 : 1); d.v = M.randi(0, 2); d.ph = Math.random() * TAU;
      d.chase = null; d.carry = null; d.traitor = null;
    },
    update(e, dt, g) {
      const d = e.data, b = g.boss;
      if (!b || b.state !== 'fight') return;
      if (d.traitor) {
        // arco de 0,8 s até o Centrão; na batida: dano e some
        const T = d.traitor, u = Math.min(1, (T.t += dt) / 0.8), tx = b.x, ty = b.y + 10;
        e.x = M.lerp(T.x0, tx, u); e.y = M.lerp(T.y0, ty, u) - Math.sin(u * PI) * 60;
        d.face = tx < T.x0 ? -1 : 1;
        if (u >= 1) {
          G.hitBoss(b, EM.TRAITOR_DMG);
          G.text(b.x, b.y + 40, 'TRAÍRA!', { color: MECH.TEAL_L, size: 13, life: 0.9, stroke: true });
          G.burst(e.x, e.y, 8, { colors: [MECH.TEAL_L, '#ffffff'], speed: 140 });
          sfx('hit');
          G.killEnemy(e, { silent: true });
        }
        return;
      }
      // corrida pela emenda (o Centrão escolhe quem corre: cenRace)
      const em = d.chase;
      if (em && em.st === 'para' && !d.carry) {
        const a = Math.atan2(em.y - e.y, em.x - e.x);
        e.x += Math.cos(a) * d.spd * dt; e.y += Math.sin(a) * d.spd * dt;
        d.face = Math.cos(a) < 0 ? -1 : 1;
        if (M.dist2(e.x, e.y, em.x, em.y) < 16 * 16) cenGrab(em, e);
        return;
      }
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
      const muro = b && b.id === 'centrao' && b.data.side === 1;
      const spec = (muro ? APOIO_SPECS_G : APOIO_SPECS)[d.v];
      const hop = Math.abs(Math.sin(e.t * 11 + d.ph)) * 3;
      ctx.save();
      ctx.translate(e.x, e.y - hop);
      ctx.rotate(0.12 * (d.face || 1));
      G.Art.person(ctx, 0, 0, 28, spec, { t: e.t, mood: 'laugh', pose: 'up', flash: fl, facing: d.face || 1, lookX: 0.8, lookY: -0.6, autoLook: false });
      // plaquinha "SIM" (traíra: "NÃO"); com a mala na cabeça a placa fica de lado
      const sx = d.carry ? 13 : 0;
      rr(ctx, sx - 10, -27, 20, 9, 2); inked(ctx, fl ? WHITE : '#ffffff', 1.2);
      if (!fl) txt(ctx, d.traitor ? 'NÃO' : 'SIM', sx, -22.3, 6.5, d.traitor ? MECH.TEAL : muro ? SIDE[1].dark : '#e63946');
      ctx.restore();
    },
    onDeath(e, g, opts) {
      // derrubou quem carregava: a mala volta a cair de paraquedas
      const em = e.data.carry;
      if (em && em.st === 'carried' && em.carrier === e) cenDrop(em);
      e.data.carry = null;
      if (opts && opts.silent) return;
      if (Math.random() < 0.5) G.text(e.x, e.y - 14, 'NÃO!', { color: '#ffffff', size: 9, life: 0.6 });
    },
  });

  // ---------- ataques do Centrão ----------
  const CEN_SWAP_LINES = ['MUDEI DE LADO!', 'TÔ EM CIMA DO MURO!', 'APOIO QUEM PAGA!', 'AGORA SOMOS GOVERNO!'];
  function cenSway(b, d) {
    const t = clk(b);
    d.tx = b.homeX + Math.sin(t * 0.55) * 62;
    d.ty = b.homeY + Math.sin(t * 1.1) * 8;
  }
  function cenHover(b, d) { d.ty = b.homeY + Math.sin(clk(b) * 1.6) * 6; }
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
  // ---------- a manha do Centrão: PEGAR A EMENDA ("quem tem a verba manda no Centrão") ----------
  // A mala cai de paraquedas (d.emendas; tiro e bomba não mexem nela). Encostou o Fusca: BASE DO ZÉ (tonto ×2,2).
  // Chegou embaixo (ou um deputadinho entregou): LIBERADA!, volta pra mão dele e cura 2%.
  // emenda = { id, real, st: 'toss'|'para'|'carried'|'back'|'done', x, y, sx, sy, ax, ay, t, tp, ph, vy, rot, carrier }
  function cenHandXY(b) { return [b.x - 88, b.y + 43]; } // a mala na mão esquerda (ver cenArms)
  function cenRealLive(b) { let n = 0; for (const e of b.data.emendas) if (e.real && (e.st === 'toss' || e.st === 'para' || e.st === 'carried')) n++; return n; }
  function cenEm(d, real, sx, sy, ax, ay, vy) {
    d.emN = (d.emN || 0) + 1;
    return { id: d.emN, real, st: 'toss', x: sx, y: sy, sx, sy, ax, ay, t: 0, tp: 0, ph: Math.random() * TAU, vy, rot: 0, carrier: null, arrow: false, bt: 0, bx: 0, by: 0 };
  }
  // joga n emendas de verdade (e, com o.ghost, as falsas do reflexo, espelhadas). Sem espera: a P4 usa na pausa do giro.
  function cenThrow(b, n, o) {
    o = o || {};
    const d = b.data, W = G.W, H = G.H, p = pl(), run = G.run || {}, ay = H * (L2() ? 0.30 : EM.APEX_Y);
    const xs = d._xs || (d._xs = []);
    xs.length = 0;
    if (n === 1) {
      // longe do carro (≥ 70 px): ele tem que ir buscar. Com o reflexo, longe do meio (a falsa cai espelhada)
      let best = W / 2, bestD = -1;
      for (let k = 0; k < 6; k++) {
        let x = M.rand(0.22 * W, 0.78 * W);
        if (o.ghost && Math.abs(x - W / 2) < 0.14 * W) x = W / 2 + (x < W / 2 ? -1 : 1) * M.rand(0.14 * W, 0.28 * W);
        const dd = Math.abs(x - p.x);
        if (dd >= 70) { best = x; break; }
        if (dd > bestD) { bestD = dd; best = x; }
      }
      xs.push(best);
    } else xs.push(M.rand(0.18 * W, 0.45 * W), M.rand(0.55 * W, 0.82 * W));
    for (const ax of xs) {
      let vy = o.fall || (L2() ? EM.FALL_L2 : EM.FALL);
      if (!L2() && !run._emSeen) vy = Math.min(vy, EM.FALL_TUT); // a 1ª da partida cai devagar
      run._emSeen = 1;
      const e = cenEm(d, true, b.x - 84, b.y + 30, ax, ay, vy);
      if (!L2() && (run._emArrow || 0) < 2) { run._emArrow = (run._emArrow || 0) + 1; e.arrow = true; }
      d.emendas.push(e);
      if (o.ghost && d.ghost) d.emendas.push(cenEm(d, false, d.ghost.x + 84, d.ghost.y + 30, W - ax, ay, vy));
    }
    sfx('whoosh');
    d.holdCase = false; d.caseT = 1.2; d.armLT = 0;
  }
  // arremesso com preparo (uma emenda de verdade por vez; nada logo depois do tonto)
  function* cenEmendaDrop(b, n, o) {
    const d = b.data;
    yield () => !(d.mechCd > 0);
    if (cenRealLive(b) > 0) return;
    d.armLT = 1; sfx('charge');
    if (!(b.sayT > 0)) say(b, M.pick(['EMENDA PIX!', 'VERBA LIBERADA!', 'É PRA BASE!']), 1.4);
    yield 0.45;
    cenThrow(b, n, o);
  }
  function cenDrop(e) { e.st = 'para'; e.carrier = null; e.ax = e.x; e.tp = 0; e.ph = 0; } // volta a cair de onde está
  function cenGrab(e, a) {
    e.st = 'carried'; e.carrier = a; a.data.carry = e; a.data.chase = null;
    G.text(a.x, a.y - 22, 'É MINHA!', { color: '#ffffff', size: 10, life: 0.8 });
  }
  function cenMiss(b, e) {
    G.text(e.x, Math.min(e.y - 14, G.H - 40), 'LIBERADA!', { color: COL.orange, size: 11, life: 0.9 });
    e.st = 'back'; e.bt = e.t; e.bx = e.x; e.by = e.y; e.carrier = null;
    b.data.emTut = false;
    mechMiss(b);
  }
  function cenCatch(b, e) {
    const d = b.data;
    e.st = 'done';
    G.text(e.x, e.y - 18, 'EMENDA CONFISCADA!', { color: MECH.TEAL_L, size: 12, life: 1.2, stroke: true });
    sfx('item'); sfx('powerup');
    G.addScore(3000, e.x, e.y, true);
    G.dropPix(e.x, e.y, 8);
    G.burst(e.x, e.y, 12, { colors: [MECH.TEAL_L, '#ffffff', MECH.GOLD], speed: 170 });
    G.count('emenda'); mechOk(b);
    const c = e.carrier; e.carrier = null;
    if (c && !c.dead) { c.data.carry = null; apoioTraitor(c, false); }
    d.emTut = false;
    if (stunning(b)) {
      // P4: a 2ª mala no mesmo tonto estica a brecha
      if (b.phase === 3) { stunExtend(b, 2, 5); G.text(G.W / 2, G.H * 0.5, 'MAIS VERBA, MAIS BASE!', { color: MECH.GOLD, size: 13, life: 1.4, stroke: true }); }
      return;
    }
    cenStun(b);
  }
  // BASE DO ZÉ: o Centrão vira base de quem tem a verba (você). Pausa tudo; os deputadinhos viram traíras.
  function cenStun(b) {
    const d = b.data, ph = b.phase;
    d.orbitW = d.orbit ? d.orbit.w : null;
    if (d.orbit) d.orbit.w = 0;
    stunStart(b, EM.STUN[ph] || EM.STUN[0], EM.MUL, {
      tag: 'BRECHA ×2,2', text: 'BASE DO ZÉ!', say: M.pick(['TÔ CONTIGO, ZÉ!', 'QUEM PAGA MANDA!', 'AGORA SOU BASE DO ZÉ!']), onEnd: cenStunEnd,
    });
    if (ph === 3) G.text(G.W / 2, G.H * 0.5, 'A BASE PAROU PRA CONTAR!', { color: MECH.GOLD, size: 13, life: 1.6, stroke: true });
    let first = true;
    for (const e of G.game.enemies) if (!e.dead && e.kind === 'bs_apoio' && !e.data.traitor) { apoioTraitor(e, first); first = false; }
    d.laughT = d.stunT;
  }
  function cenStunEnd(b) {
    const d = b.data;
    say(b, 'ACABOU A VERBA! VOLTEI!', 1.8);
    G.text(b.x, b.y + 60, 'VOLTOU PRO GOVERNO', { size: 11, color: '#ffffff' });
    if (d.orbit && d.orbitW != null) d.orbit.w = d.orbitW;
    d.orbitW = null;
  }
  // as malas no ar (rodam até com o chefão tonto)
  function cenEmUpdate(b, dt) {
    const d = b.data, L = d.emendas, W = G.W, H = G.H;
    for (let i = L.length - 1; i >= 0; i--) {
      const e = L[i];
      e.t += dt;
      if (e.st === 'toss') {
        const u = Math.min(1, e.t / 0.8);
        e.x = M.lerp(e.sx, e.ax, u); e.y = M.lerp(e.sy, e.ay, u) - Math.sin(u * PI) * 50;
        e.rot += dt * 11;
        if (u >= 1) {
          e.st = 'para'; e.tp = 0;
          sfx('whoosh');
          G.text(e.x, e.y - 26, 'POC!', { color: '#ffffff', size: 9, life: 0.5 });
          if (e.real) mechHint('cen_pega', W / 2, H * 0.56, 'PEGUE A EMENDA COM O FUSCA!');
          else mechHint('cen_reflexo', W / 2, H * 0.5, 'A EMENDA DO REFLEXO É FALSA!', COL.violet);
        }
      } else if (e.st === 'para') {
        e.tp += dt;
        e.rot = M.approach(M.wrapAngle(e.rot), 0, dt * 8);
        e.y += e.vy * dt;
        e.x = clamp(e.ax + EM.SWAY * Math.sin(TAU * EM.SWAY_HZ * e.tp + e.ph), 24, W - 24);
        if (e.real) {
          if (carNear(e.x, e.y + 4, EM.CATCH_R)) cenCatch(b, e);
          else if (e.y > H - 26) cenMiss(b, e);
        } else if (e.y > H - 26) {
          G.text(e.x, H - 40, 'PUF', { size: 9 });
          G.burst(e.x, e.y, 6, { colors: [COL.violet, '#ffffff'], speed: 90, life: 0.35 });
          e.st = 'done';
        }
      } else if (e.st === 'carried') {
        const c = e.carrier;
        if (!c || c.dead) cenDrop(e);
        else {
          e.x = c.x; e.y = c.y - 32; e.rot = Math.sin(e.t * 7) * 0.12;
          if (carNear(e.x, e.y + 4, EM.CATCH_R)) cenCatch(b, e);
        }
      } else if (e.st === 'back') {
        const u = Math.min(1, (e.t - e.bt) / 0.5), h = cenHandXY(b), k = M.easeInCubic(u);
        e.x = M.lerp(e.bx, h[0], k); e.y = M.lerp(e.by, h[1], k); e.rot += dt * 9;
        if (u >= 1) { e.st = 'done'; b.def.heal(b, e, EM.HEAL); }
      }
      if (e.st === 'done') L.splice(i, 1);
    }
  }
  // fase 3: os 2 deputadinhos mais perto correm atrás da emenda de verdade que está caindo
  function cenRace(b, g) {
    const d = b.data, ap = d._ap || (d._ap = []);
    ap.length = 0;
    let em = null;
    if (b.phase === 2 && !stunning(b)) for (const e of d.emendas) if (e.real && e.st === 'para' && (!em || e.y > em.y)) em = e;
    for (const e of g.enemies) {
      if (e.dead || e.kind !== 'bs_apoio' || e.data.traitor || e.data.carry) continue;
      e.data.chase = null;
      if (em) { e.data._d2 = M.dist2(e.x, e.y, em.x, em.y); ap.push(e); }
    }
    if (!em || !ap.length) return;
    ap.sort(byD2);
    for (let i = 0; i < Math.min(2, ap.length); i++) ap[i].data.chase = em;
  }
  function byD2(a, c) { return a.data._d2 - c.data._d2; }
  // alvo do piloto: a emenda que chega antes na altura do carro (espera embaixo enquanto ela está alta)
  function cenGoal(b) {
    const d = b.data, H = G.H;
    if (stunning(b)) { setGoal(b, clamp(b.x, 30, G.W - 30), H * 0.78, 'stun', 40, 'stun' + (b.mech ? b.mech.stuns : 0)); return; }
    let best = null, bt = Infinity;
    for (const e of d.emendas) {
      if (!e.real || (e.st !== 'para' && e.st !== 'carried')) continue;
      const tt = (H * 0.82 - e.y) / Math.max(1, e.vy);
      if (tt < bt) { bt = tt; best = e; }
    }
    if (!best) { clearGoal(b); return; }
    setGoal(b, best.x, best.y < H * 0.55 ? H * 0.6 : clamp(best.y + 10, H * 0.55, H * 0.86), 'emenda', 14, 'em' + best.id);
  }
  // paraquedas: cúpula de 30 px, 4 gomos vermelho/branco, 4 cordinhas até os cantos da mala
  function parachute(c, x, y, fake, t) {
    const R = 15, cy = y - 31 + Math.sin(t * 3) * 0.6, A = fake ? COL.violet : '#e63946';
    c.lineWidth = 1; c.strokeStyle = fake ? 'rgba(255,255,255,0.7)' : 'rgba(16,20,24,0.75)';
    c.beginPath();
    c.moveTo(x - R + 1, cy + 1); c.lineTo(x - 11, y - 8); c.moveTo(x - R * 0.4, cy + 2); c.lineTo(x - 9, y - 8);
    c.moveTo(x + R * 0.4, cy + 2); c.lineTo(x + 9, y - 8); c.moveTo(x + R - 1, cy + 1); c.lineTo(x + 11, y - 8);
    c.stroke();
    for (let k = 0; k < 4; k++) {
      const a0 = PI + (k * PI) / 4;
      c.beginPath(); c.moveTo(x, cy); c.arc(x, cy, R, a0, a0 + PI / 4); c.closePath();
      c.fillStyle = k % 2 ? '#ffffff' : A; c.fill();
    }
    c.beginPath(); c.arc(x, cy, R, PI, TAU);
    for (let k = 3; k >= 0; k--) { const x1 = x - R + (k * R) / 2; c.quadraticCurveTo(x1 + R / 4, cy + 3.5, x1, cy); }
    c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke();
  }
  // corpo das malas (embaixo do carro e dos tiros): paraquedas, mala, reflexo violeta e rastro dourado da volta
  function cenEmDraw(c, b, t) {
    for (const e of b.data.emendas) {
      if (e.st === 'done') continue;
      if (e.st === 'back') {
        const h = cenHandXY(b), u = Math.min(1, (e.t - e.bt) / 0.5);
        c.fillStyle = MECH.GOLD;
        for (let k = 1; k <= 3; k++) {
          const uu = Math.max(0, u - k * 0.08), kk = M.easeInCubic(uu);
          c.beginPath(); O(c, M.lerp(e.bx, h[0], kk), M.lerp(e.by, h[1], kk), 3.4 - k * 0.7); c.fill();
        }
        c.save(); c.translate(e.x, e.y); c.scale(0.7, 0.7); briefcase(c, 0, 0, 24, e.rot, false, 'EMENDA'); c.restore();
        continue;
      }
      const fake = !e.real;
      c.save();
      if (fake) c.globalAlpha *= 0.4;
      if (e.st === 'para') parachute(c, e.x, e.y, fake, t + e.id);
      briefcase(c, e.x, e.y, 24, e.rot, false, 'EMENDA');
      if (fake) {
        // reflexo: tinta violeta + contorno violeta tracejado (sem anel verde-água: não é pra pegar)
        c.fillStyle = 'rgba(200,107,255,0.45)'; rr(c, e.x - 13, e.y - 9, 26, 18, 3); c.fill();
        c.globalAlpha = 0.8; c.strokeStyle = COL.violet; c.lineWidth = 1.6; c.setLineDash([4, 3]);
        rr(c, e.x - 16, e.y - 13, 32, 26, 5); c.stroke(); c.setLineDash([]);
      }
      c.restore();
    }
  }
  // seta ▼ desenhada (as 2 primeiras emendas da partida)
  function pegueArrow(c, x, y, t) {
    const yy = y + Math.abs(Math.sin(t * 5)) * 5;
    c.beginPath(); c.moveTo(x - 8, yy - 7); c.lineTo(x + 8, yy - 7); c.lineTo(x, yy + 4); c.closePath();
    c.lineWidth = 3; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); c.fillStyle = '#ffffff'; c.fill();
    txt(c, 'PEGUE!', x, yy - 15, 10, '#ffffff', { stroke: 3 });
  }
  // placa "TÔ COM O ZÉ" erguida acima das cabecinhas durante o tonto (desenho ao vivo, sem sprite novo).
  // Fica de lado (na mão erguida), porque o balão de fala ocupa o meio logo acima dele.
  function cenPlacard(c, b, t) {
    const sd = b.x > G.W * 0.6 ? -1 : 1, hx = b.x + sd * 80, hy = b.y - 18;
    const x = clamp(b.x + sd * 74 + Math.sin(t * 2) * 1.5, 42, G.W - 42), y = b.y - 66;
    c.save();
    c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath(); c.moveTo(x - 20, y + 8); c.lineTo(hx - 3, hy); c.moveTo(x + 20, y + 8); c.lineTo(hx + 3, hy); c.stroke();
    c.strokeStyle = '#c9a36a'; c.lineWidth = 1.8; c.stroke();
    rr(c, x - 37, y - 9, 74, 18, 3); inked(c, '#f7f3e8', 2);
    c.strokeStyle = 'rgba(140,100,60,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 34, y + 4.5); c.lineTo(x + 34, y + 4.5); c.stroke();
    txt(c, 'TÔ COM O ZÉ', x, y + 0.5, 10, INK, { maxW: 68 });
    // bandeirinha verde-água com um Fusquinha
    const px = x + 24, py = y - 22, w = Math.sin(t * 8) * 1.5;
    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px, py + 13); c.lineTo(px, py - 6); c.stroke();
    c.beginPath(); c.moveTo(px, py - 6); c.lineTo(px + 18, py - 1 + w); c.lineTo(px, py + 4); c.closePath(); inked(c, MECH.TEAL, 1.2);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(px + 2.5, py + 0.8); c.quadraticCurveTo(px + 6, py - 4.5, px + 9.5, py + 0.8); c.closePath(); c.fill();
    c.restore();
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
    yield 1.55; // a 1ª emenda sai aos 2,0 s de luta (0,45 s de preparo)
    // 1ª emenda da partida (1º mandato) = carência: só a pressão de fundo até ela se resolver (ou 9 s)
    const run = G.run || {};
    if (!L2() && !run._emSeen) { d.emTut = true; d.emTutT = EM.TUT_MAX; }
    yield* cenEmendaDrop(b, 1);
    if (d.emTut) yield () => !d.emTut;
    yield 0.8;
    let loop = 0;
    for (;;) {
      yield* cenHeads(b, 3);
      yield 0.7;
      yield* cenTomaLa(b);
      yield 0.9;
      yield* cenEmendaDrop(b, 1);
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
      yield* cenEmendaDrop(b, 1, { ghost: true });
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
      // uma emenda por volta (os deputadinhos correm atrás dela); o TOMA LÁ continua em volta sim, volta não
      yield* cenEmendaDrop(b, 1);
      yield 1.2;
      if (loop++ % 2 === 1) { yield* cenTomaLa(b); yield 0.9; }
    }
  }
  function* cenP4(b) {
    const d = b.data;
    d.depOn = false; d.banner = 'BASE ALIADA';
    say(b, 'O CENTRÃO NUNCA CAI!', 2.4);
    d.mv = null; d.tx = b.homeX; d.ty = b.homeY + 10;
    d.mv = (bb, dd) => { dd.tx = bb.homeX + Math.sin(clk(bb) * 0.4) * 30; dd.ty = bb.homeY + 12; };
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
      // inverte o giro (com aviso); uma inversão sim, outra não: 2 emendas de verdade (terços da tela)
      flipT++;
      for (let i = 0; i < 8; i++) d.warn[i] = 0.6;
      d.orbit.w = 0;
      sfx('charge');
      if (flipT % 2 === 1 && !(d.mechCd > 0) && cenRealLive(b) === 0) cenThrow(b, 2, { fall: L2() ? EM.FALL_P4_L2 : EM.FALL_P4 });
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
  // todo (estilo, cor) que o Centrão atira (o reflexo usa violeta)
  const CEN_SHOTS = [['bs_171', COL.pink], ['bs_171', COL.violet], ['bs_171', COL.magenta], ['bs_moeda', COL.gold]];
  G.Bosses.define('centrao', {
    // fatStart menor: é o 1º chefão (ensina); com arma forte a luta acaba antes de ele cansar
    name: 'O CENTRÃO', title: 'Toma Lá, Dá Cá', hp: 3600, r: 46, homeY: 165, fatStart: 85,
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
      // manha: malas da emenda, relógio (para no tonto) e o tonto
      d.emendas = []; d.emN = 0; d.emTut = false; d.emTutT = 0; d.clk = 0; d.stunT = 0; d.mechCd = 0;
      mechInit(b, 'pegar');
      d.p3Side = Math.random() < 0.75 ? 0 : 1; // cor do 3º turno em diante (decidida já: os sprites saem antes)
      b.bubbleY = 72;
      b.hitboxes = CEN_HB.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      // sprites do 1º turno e do começo do 2º: pintados durante o aviso e a entrada
      sprReset(); cenPlan(b); sprWarm(b);
      haloSprite(26); // halo da emenda (pronto antes do 1º quadro que o usa)
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
      // tonto = pausa: sem corrotina, relógio, movimento, deputadinho novo nem carência correndo
      const st = stunUpdate(b, dt);
      if (!st) {
        d.clk += dt;
        if (d.mechCd > 0) d.mechCd -= dt;
        if (d.emTut && (d.emTutT -= dt) <= 0) d.emTut = false;
        runCo(b, dt);
        if (d.mv) { d.mv(b, d, dt); glide(b, dt, 2.6); }
      }
      cenEmUpdate(b, dt);
      cenRace(b, g);
      if (stunning(b)) d.laughT = d.stunT; // feliz da vida: agora é base do Zé
      cenAnim(b, dt);
      fatigue(b, 'CANSEI DE APANHAR!');
      if ((d.planT -= dt) <= 0) { d.planT = 0.4; cenPlan(b); }
      // deputadinhos (fase 3)
      if (d.depOn && !stunning(b)) {
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
      cenGoal(b);
      trackCar(b);
    },
    onPhase(b, idx) {
      const d = b.data;
      // letreiro novo já no 1º quadro do turno; libera os sprites do turno que passou e pede os que faltam
      d.banner = CEN_BAN[idx] || d.banner;
      if (idx === 2) d.side = d.p3Side;
      if (idx === 3) d.ghost = null;
      cenEvict(b); cenPlan(b); d.planT = 0.4;
      // próximas fases: cabecinhas suadas (HP < 66%) e os deputadinhos do apoio (fase 3, de gravata vermelha ou bege)
      if (idx === 1) {
        warmPeople(b, 'headsSw', CEN_HEADS_SW.map((spec) => ({ spec, size: 34, mood: 'smug' })));
        warmPeople(b, 'apoio', APOIO_SPECS.concat(APOIO_SPECS_G).map((spec) => ({ spec, size: 28, mood: 'laugh', pose: 'up' })));
      }
      for (let i = 0; i < 8; i++) { d.warn[i] = 0; d.hold[i] = 0; }
      d.armLT = 0; d.armRT = 0; d.flipX = 1; d.swapWarn = 0;
      // manha: as emendas de verdade no ar continuam valendo; o reflexo some com as falsas (3º turno)
      d.emTut = false;
      if (idx >= 2) for (let i = d.emendas.length - 1; i >= 0; i--) if (!d.emendas[i].real) { const e = d.emendas[i]; G.burst(e.x, e.y, 5, { colors: [COL.violet, '#ffffff'], speed: 80, life: 0.3 }); d.emendas.splice(i, 1); }
      // mudou de turno no meio do tonto: as corrotinas novas esperam o fim dele (que fica ≤ 2 s)
      if (stunning(b)) d.stunT = Math.min(d.stunT, 2.0);
      if (idx === 1) { co(b, cenP2(b)); co(b, cenBg(b, 1.9), 1); }
      else if (idx === 2) { co(b, cenP3(b)); co(b, cenBg(b, 1.3), 1); }
      else if (idx === 3) { d.flipX = 1; d.orbitW = null; co(b, cenP4(b)); co(b, null, 1); }
    },
    onHit(b) { b.data.sq = Math.max(b.data.sq, 0.02); },
    // chamado pelo deputadinho quando chega (e, com frac, pela emenda que voltou pra mão: e = a mala)
    heal(b, e, frac) {
      const d = b.data;
      // entregou a mala: ela volta pra mão do Centrão (cura 2% quando chega) + a cura normal do apoio
      if (frac == null && e.data && e.data.carry) { const em = e.data.carry; e.data.carry = null; if (em.st === 'carried') cenMiss(b, em); }
      const cap = b.maxHp * (b.phases[b.phase] ? b.phases[b.phase].at : 1);
      // cura pequena (≈ 40 HP no 1º mandato, 63 no 2º): não cresce junto com o HP do chefão, senão
      // ganharia da arma fraca (o jogador tem que derrubar o apoio, mas não precisa ser perfeito)
      const amt = b.maxHp * (frac != null ? frac * (L2() ? 1.2 : 1) : L2() ? 0.014 : 0.011);
      b.hp = Math.min(cap, b.hp + amt);
      G.text(e.x, e.y - 18, frac != null ? '+EMENDA' : '+APOIO', { color: G.C.greenL, size: 13, life: 1.1, vy: -30 });
      G.burst(e.x, e.y, 8, { colors: [G.C.greenL, '#ffffff'], speed: 120 });
      d.mouthT = 0.6; d.laughT = Math.max(d.laughT || 0, 0.8);
      sfx('item');
    },
    onDeath(b) {
      const d = b.data;
      stopCo(b); d.depOn = false; d.ghost = null; d.fx.length = 0;
      if (d.orbit) d.orbit.w = 0;
      // manha: some tudo (malas, alvo e tonto)
      d.emendas.length = 0; d.stunT = 0; d.stunOnEnd = null; d.emTut = false;
      clearGoal(b); b.hudTag = null;
      // na queda e na fuga só aparece o corpo com o letreiro de agora (e o flash): o resto da memória já volta
      sprDrop((k) => !(k === 'cenF' || k.startsWith('case|') || (k.startsWith('cen|') && k.split('|')[3] === d.banner)));
    },
    draw(ctx, b, g) {
      const d = b.data, st = b.state === 'fight' && stunning(b);
      sprPump(b, g);
      bubbleAt(b, 72);
      drawFx(ctx, b, 'under');
      const S = d.S, hpF = b.hp / b.maxHp;
      S.t = b.t; S.flash = G.isFlash(b); S.side = d.side; S.flipX = st ? 1 : d.flipX; S.pops = d.pops; S.hmood = d.hmood; S.warn = d.warn;
      S.hp = b.state === 'dying' || b.state === 'leaving' ? 0.1 : hpF;
      S.mood = b.state === 'dying' ? 'hurt' : d.laughT > 0 || b.state === 'leaving' ? 'laugh' : b.invulnT > 0 ? 'angry' : 'smug';
      S.mouth = b.state === 'talk' ? 0.25 + 0.25 * Math.sin(b.t * 9) : st ? 0.4 + 0.3 * Math.sin(b.t * 14) : d.mouth;
      S.look = lookAt(b.x, b.y); S.banner = d.banner; S.armL = st ? 0.85 : d.armL; S.armR = st ? 0.85 : d.armR; S.holdCase = d.holdCase; S.sq = d.sq;
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
      // tonto: balança no lugar, braços pra cima e a placa TÔ COM O ZÉ
      drawCentrao(ctx, st ? b.x + Math.sin(b.t * 16) * 1.8 : b.x, b.y, 1, S);
      if (st) cenPlacard(ctx, b, b.t);
      if (b.state === 'fight') cenEmDraw(ctx, b, b.t);
      drawFx(ctx, b, 'top');
      drawOverFallback(b.def, ctx, b, g);
    },
    // por cima dos tiros: anel + halo verde-água das emendas de verdade, a seta PEGUE! e o rótulo do reflexo
    drawOver(ctx, b) {
      if (b.state !== 'fight') return;
      const t = b.t;
      for (const e of b.data.emendas) {
        if (e.st !== 'para' && e.st !== 'carried') continue;
        if (!e.real) { ctx.save(); ctx.globalAlpha = 0.9; txt(ctx, 'REFLEXO', e.x, e.y + 21, 9, COL.violet, { stroke: 3 }); ctx.restore(); continue; }
        tealHalo(ctx, e.x, e.y + 2, 26, t);
        mechRing(ctx, e.x, e.y + 2, 20, t, {});
        if (e.arrow) pegueArrow(ctx, e.x, e.y - (e.st === 'para' ? 58 : 26), t);
      }
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
  // Manha FICAR NA META (afinação: HP → tempo de tonto → cadência → armadura). R = raio (px), NEED = segundos
  // dentro para encher, LIFE = prazo (s), OPEN = armadura da META ABERTA, GAP_* = espera até a próxima meta.
  const MT = {
    R0: 38, R_MIN: 28, R_K: 0.9, NEED: 2.2, NEED_L2: 2.5, LIFE: 10, STUN: 3.0, MUL: 2.2, OPEN: 0.8, GAP_OK: 3.0, GAP_FAIL: 2.5,
    FIRST: 3.0, P4_SPD: 55, P4_JUMP: 120, P4_EVERY: 3.0,
    R0_L2: 35, DEMO: 2, P2_R: 36, P2_NEED: 2.4, STUN_L3: 4.0, MUL_L3: 2.3, P4_R: 40, P4_LIFE: 9,
    // 3º turno (META DOBRADA): nível 1 / 2 / 3
    LVL: [{ r: 38, need: 1.6, life: 8, ax: 46, ay: 18 }, { r: 32, need: 1.2, life: 8, ax: 24, ay: 10, gap: 120 }, { r: 28, need: 0.8, life: 9, ax: 12, ay: 6 }],
  };
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
   * Desenha Dilmãe. S: {t, flash, pose, mood, mouth, look, hp, jar[2], jarGlow, board, bike, parked, calc, dir, raise, glowT, k, alpha, noProps}
   * parked = em pé ao lado da bicicleta (tonta na pedalada); calc = calculadora do RECALCULANDO... no lugar da mandioca
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
      if (S.parked) {
        // bicicleta encostada do lado (rodas paradas)
        const bd = S.dir || 1;
        c.save(); c.translate(-bd * 50, 10);
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(0, 54, 40, 5, 0, 0, TAU); c.fill();
        bikeProp(c, bd, 0, fl, 'back'); bikeProp(c, bd, 0, fl, 'front');
        c.restore();
      }
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
        if (S.calc && !fl) calcProp(c, h.x, h.y - 6, t);
        else mandiocaProp(c, h.x, h.y, 40, rot, fl, S.glowT || 0);
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
      let side = Math.random() < 0.5 ? 0 : 1;
      if (d.jarT[side] > 0.6) side ^= 1; // o pote da rajada já está aberto: usa o outro
      d.jarT[side] = 0.6;
      yield 0.32;
      const jx = b.x + (side ? 66 : -66), jy = b.y + 16;
      fan(jx, jy, aimFrom(jx, jy), 3, 0.32, 120, { style: 'bs_vento', color: COL.magenta });
      sfx('enemy_shot');
      yield 0.3;
      if (d.jarT[side] === 0.6) d.jarT[side] = 0;
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
    dilMetaReq(b, dir); // a meta nasce do lado de onde vem o vento
    d.jarT[jar] = 1; d.pose = 'shrug';
    say(b, M.pick(['ESTOQUEI O VENTO!', 'É O VENTO, QUERIDO!', 'SEGURA ESSE VENTO!']), 1.6);
    sfx('wind');
    yield 1.0;
    W.target = L2() ? 72 : 60; // empurrão suave: dá pra segurar com o dedão
    sfx('wind');
    const t0 = clk(b), jy = b.y + 16;
    let i = 0;
    while (clk(b) - t0 < dur) {
      W.target = L2() ? 72 : 60; // (o tonto zera o vento; ele volta junto com a corrotina)
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
    // bateu a meta enquanto ela pedalava: para no MEIO e fica tonta ao lado da bicicleta (sem as 3 mandiocas)
    const park = d.pendingStun;
    const tx = park ? G.W / 2 : dir > 0 ? G.W * 0.28 : G.W * 0.72, sx = b.x, sy = b.y;
    yield* tween(b, 0.6, (u) => { const e = M.easeOutCubic(u); b.x = M.lerp(sx, tx, e); b.y = M.lerp(sy, b.homeY, e); });
    d.inPausa = true; d.pausaStun = false;
    if (d.pendingStun) {
      d.pendingStun = false; d.pausaStun = true;
      say(b, 'PEDALEI NA META!', 1.6);
      dilStun(b, MT.STUN, MT.MUL, { tag: 'BRECHA ×2,2', text: 'RECALCULANDO...', onEnd: dilStunEnd });
      yield null;
    } else say(b, M.pick(['NÃO FOI PEDALADA!', 'É CONTABILIDADE CRIATIVA!', 'PEDALEI NA META!']), 1.6);
    for (let k = 0; k < 3 && !d.pausaStun; k++) {
      d.glowT = 0.4; sfx('charge');
      yield 0.45;
      if (d.pausaStun) break; // encheu a meta aqui: tonto na hora, sem as mandiocas que faltam
      const a = aimFrom(b.x, b.y);
      fan(b.x + 20 * dir, b.y - 4, a, L2() ? 3 : 2, 0.5, 130, { style: 'bs_mandioca', color: COL.orange, accel: -55, minSpd: 50, data: { split: 0.9, n: 7 }, update: splitMandioca });
      sfx('whoosh');
      yield 0.6;
    }
    yield 0.4;
    d.inPausa = false; d.pausaStun = false;
    // sai pelo outro lado
    const x0 = b.x, x1 = dir > 0 ? G.W + 60 : -60;
    d.dir = dir;
    yield* tween(b, 0.55, (u) => { b.x = M.lerp(x0, x1, M.easeInCubic(u)); });
    b.x = dir > 0 ? -60 : G.W + 60;
  }

  // ---------- a manha da Dilmãe: FICAR NA META ("quando atingir a meta, dobramos a meta") ----------
  // Anel verde-água que deriva na metade de baixo (d.metas; agendado no update, não em corrotina). Com o ponto
  // branco do Fusca dentro ele enche (fora esvazia devagar). Encheu: RECALCULANDO... (tonto ×2,2) e ela dobra a
  // meta. Venceu o tempo: META ADIADA! e META ABERTA (armadura ×0,8) até a próxima meta batida.
  // meta = { id, x, y, x0, y0, r, need, ch, life, t, ph, ax, ay, grp, done, ghost }
  function dilActive(b) { for (const m of b.data.metas) if (!m.done && !m.gone) return true; return false; }
  function dilMetaPos(m) {
    const H = G.H;
    if (m.mv === 'p4') { m.x = m.x0; m.y = m.y0; return; }
    m.x = clamp(m.x0 + m.ax * Math.sin(0.9 * m.t + m.ph), m.r + 12, G.W - m.r - 12);
    m.y = clamp(m.y0 + m.ay * Math.sin(1.55 * m.t), H * 0.56, Math.min(H * 0.8, H - 60 - m.r));
  }
  // o = { r, need, life, ax, ay, ph, grp, lab, mv, x0, y0, xa, xb } (sem x0: sorteia longe do carro)
  function dilMeta(b, o) {
    const d = b.data, H = G.H, p = pl(), r = o.r;
    const m = {
      id: ++d.metaId, x: 0, y: 0, x0: 0, y0: 0, r, need: o.need, ch: 0, life: o.life || MT.LIFE, t: 0,
      ph: o.ph != null ? o.ph : Math.random() * TAU, ax: o.ax != null ? o.ax : 46 * d.metaDrift, ay: o.ay != null ? o.ay : 18 * d.metaDrift,
      grp: o.grp || 0, done: false, ghost: null, lab: o.lab || 'META', mv: o.mv || null, q: 0, inside: false, vx: 0, jumpT: 0, doneT: 0,
    };
    if (o.x0 != null) { m.x0 = o.x0; m.y0 = o.y0; }
    else {
      const xa = o.xa != null ? o.xa : r + 60, xb = o.xb != null ? o.xb : G.W - r - 60;
      let bx = (xa + xb) / 2, by = H * 0.69, bd = -1;
      for (let k = 0; k < 6; k++) {
        const x = M.rand(xa, Math.max(xa, xb)), y = o.y0 != null ? o.y0 : M.rand(H * 0.62, H * 0.76), dd = M.dist2(x, y, p.x, p.y);
        if (dd >= 90 * 90) { bx = x; by = y; break; }
        if (dd > bd) { bd = dd; bx = x; by = y; }
      }
      m.x0 = bx; m.y0 = by;
    }
    dilMetaPos(m);
    d.metas.push(m);
    return m;
  }
  // 1º/2º turno: uma meta (o 2º turno nasce do lado de onde vem o vento: a rajada empurra o carro pra fora dela)
  function dilMetaP12(b) {
    const d = b.data, W = G.W, run = G.run || {};
    let m;
    if (b.phase === 1) {
      const r = Math.min(d.metaR, MT.P2_R), xa = d.gustDir > 0 ? r + 30 : W * 0.58, xb = d.gustDir > 0 ? W * 0.42 : W - r - 30;
      m = dilMeta(b, { r, need: Math.max(d.metaNeed, MT.P2_NEED), ax: 20 * d.metaDrift, ay: 10 * d.metaDrift, xa, xb });
    } else m = dilMeta(b, { r: d.metaR, need: d.metaNeed });
    sfx('meta');
    // 1ª meta da partida (1º mandato): 2 s de demonstração sem ataque, com a dica
    if (d.demo) d.demoT = MT.DEMO;
    if (!L2() && !run._metaSeen) { run._metaSeen = 1; mechHint('dil_meta', W / 2, G.H * 0.5, 'FIQUE DENTRO DA META ATÉ ENCHER!'); }
    return m;
  }
  // pedido da rajada (2º turno): no aviso do vento, uma meta contra o vento, na hora (se não tiver outra)
  function dilMetaReq(b, dir) {
    const d = b.data;
    d.gustDir = dir;
    if (b.phase !== 1 || stunning(b) || d.mechCd > 0 || dilActive(b)) return;
    dilMetaP12(b);
  }
  // 3º turno: META DOBRADA de verdade. Nível 1 = 1 meta, 2 = 2 metas, 3 = 4 metas (todas têm que encher)
  function dilLevel(b, lv) {
    const d = b.data, W = G.W, H = G.H, grp = ++d.lvlGrp, ph = Math.random() * TAU, L = MT.LVL[lv - 1];
    for (const o of d.metas) if (o.grp) o.gone = true; // as verdes do nível anterior
    d.lvl = lv;
    const o = { r: L.r, need: L.need, life: L.life, grp, ph, ax: L.ax, ay: L.ay };
    if (lv === 1) dilMeta(b, Object.assign(o, { lab: 'META' }));
    else if (lv === 2) {
      const xa = L.r + 40 + M.rand(0, W - 2 * L.r - 80 - L.gap - 40), xb = Math.min(W - L.r - 40, xa + M.rand(L.gap, L.gap + 40));
      const ya = M.rand(H * 0.62, H * 0.74), yb = clamp(ya + M.rand(-30, 30), H * 0.62, H * 0.76);
      const swap = Math.random() < 0.5;
      dilMeta(b, Object.assign({}, o, { lab: 'META 1/2', x0: swap ? xb : xa, y0: swap ? yb : ya }));
      dilMeta(b, Object.assign({}, o, { lab: 'META 2/2', x0: swap ? xa : xb, y0: swap ? ya : yb }));
    } else {
      let k = 0;
      for (const y of [0.62, 0.76]) for (const x of [0.3, 0.7]) dilMeta(b, Object.assign({}, o, { lab: 'META ' + (++k) + '/4', x0: W * x + M.rand(-10, 10), y0: H * y + M.rand(-8, 8) }));
    }
    sfx('meta');
  }
  // 4º turno: a trave anda (desliza de lado e pula pro meio a cada 3 s, com o fantasma 0,6 s antes)
  function dilMetaReqP4(b) {
    const d = b.data, W = G.W, H = G.H;
    if (stunning(b) || d.mechCd > 0 || d.pendingStun || dilActive(b)) return;
    const m = dilMeta(b, { r: MT.P4_R, need: MT.NEED, life: MT.P4_LIFE, x0: M.rand(80, W - 80), y0: M.rand(H * 0.64, H * 0.74), ax: 0, ay: 0, mv: 'p4' });
    m.vx = (m.x0 < W / 2 ? 1 : -1) * MT.P4_SPD; m.jumpT = MT.P4_EVERY - 0.6;
    sfx('meta');
  }
  function dilMetaP4(m, dt) {
    const W = G.W;
    if (m.ghost) {
      if ((m.ghost.t += dt) >= 0.6) {
        m.x0 = m.ghost.x; m.ghost = null; m.jumpT = MT.P4_EVERY - 0.6;
        const run = G.run || {};
        if (!run._metaJump) { run._metaJump = 1; G.text(W / 2, G.H * 0.52, 'A META MUDOU DE LUGAR!', { color: '#ffd23f', size: 13, life: 1.6, stroke: true }); }
        sfx('whoosh');
      }
    } else {
      m.x0 += m.vx * dt;
      if (m.x0 < 60) { m.x0 = 60; m.vx = Math.abs(m.vx); }
      if (m.x0 > W - 60) { m.x0 = W - 60; m.vx = -Math.abs(m.vx); }
      if (!m.done && (m.jumpT -= dt) <= 0) m.ghost = { x: clamp(m.x0 + (m.x0 < W / 2 ? 1 : -1) * MT.P4_JUMP, 60, W - 60), t: 0 };
    }
    m.x = m.x0; m.y = m.y0;
  }
  // as metas (rodam até no tonto): posição, carga, sucesso e prazo
  function dilMetaUpdate(b, dt) {
    const d = b.data, p = carOk(), L = d.metas;
    for (let i = 0; i < L.length; i++) {
      const m = L[i];
      if (m.gone) continue;
      m.t += dt;
      if (m.mv === 'p4') dilMetaP4(m, dt); else dilMetaPos(m);
      if (m.done) { if (!m.grp && (m.doneT -= dt) <= 0) m.gone = true; continue; }
      const rr2 = (m.r - 2) * (m.r - 2);
      m.inside = !!(p && m.t > 0.3 && M.dist2(p.x, p.y, m.x, m.y) < rr2);
      if (m.inside) {
        m.ch += dt / m.need;
        const q = Math.min(3, Math.floor(m.ch * 4));
        if (q > m.q) { m.q = q; sfx('tink'); }
      } else if (p) m.ch = Math.max(0, m.ch - dt / (3 * m.need)); // morreu: a carga fica
      if (m.ch >= 1) { dilMetaFill(b, m); continue; }
      if ((m.life -= dt) <= 0) dilMetaFail(b, m);
    }
    // tira as que saíram (marcadas: uma falha no 3º turno derruba o nível inteiro no meio da volta)
    let n = 0;
    for (let i = 0; i < L.length; i++) if (!L[i].gone) L[n++] = L[i];
    L.length = n;
  }
  // tonto da Dilmãe: o vento para na hora (a rajada volta quando a corrotina voltar)
  function dilStun(b, dur, mul, o) {
    const W = b.data.wind;
    W.target = 0; W.str = 0;
    stunStart(b, dur, mul, o);
  }
  function dilStunEnd(b) {
    const d = b.data;
    say(b, 'ENTÃO DOBRAMOS A META!', 2);
    d.metaN *= 2;
    d.metaR = Math.max(MT.R_MIN, d.metaR * MT.R_K);
    d.metaDrift = Math.min(1.5, d.metaDrift * 1.12);
    d.metaNeed = Math.min(2.8, d.metaNeed + 0.1);
    d.metaT = MT.GAP_OK;
    d.sayQ = null;
  }
  const DIL_STUN_LINES = ['PERAÍ, VOU RECALCULAR.', 'É CONTABILIDADE CRIATIVA!', 'A META É ABERTA!'];
  function dilMetaFill(b, m) {
    const d = b.data;
    m.done = true; m.ch = 1; m.doneT = 0.5;
    G.count('meta_ok'); mechOk(b);
    d.metaOpen = false; d.armor = null; d.armorTag = null;
    if (m.grp) { dilLevelFill(b, m); return; }
    G.text(m.x, m.y - m.r - 14, 'META ATINGIDA!', { color: '#ffd23f', size: 15, life: 1.4, stroke: true });
    G.dropPix(m.x, m.y, 10);
    G.burst(m.x, m.y, 14, { colors: [MECH.TEAL_L, '#ffd23f', '#ffffff'], speed: 160 });
    if (b.phase === 3) {
      // pedalada: bateu a meta com ela correndo/fora da tela → o tonto fica pra pausa (ela para no meio)
      if (!d.inPausa) { d.pendingStun = true; return; }
      say(b, 'PEDALEI NA META!', 1.6);
      d.pausaStun = true;
      dilStun(b, MT.STUN, MT.MUL, { tag: 'BRECHA ×2,2', text: 'RECALCULANDO...', onEnd: dilStunEnd });
      return;
    }
    say(b, 'ATINGIU?!', 1.2);
    dilStun(b, MT.STUN, MT.MUL, { tag: 'BRECHA ×2,2', text: 'RECALCULANDO...', onEnd: dilStunEnd });
    d.sayQ = { t: 1.2, s: M.pick(DIL_STUN_LINES) }; // fala do tonto depois do "ATINGIU?!"
  }
  // 3º turno: cada meta do nível fica verde; com todas cheias, ela se assusta (nível 1-2) ou trava (nível 3)
  function dilLevelFill(b, m) {
    const d = b.data, W = G.W, H = G.H;
    G.text(m.x, m.y - m.r - 12, 'META ATINGIDA!', { color: '#ffd23f', size: 11, life: 1.0, stroke: true });
    G.dropPix(m.x, m.y, 5);
    for (const o of d.metas) if (o.grp === m.grp && !o.done) return;
    if (d.lvl < 3) {
      const nx = d.lvl + 1;
      say(b, 'ATINGIU? DOBRA A META!', 1.6);
      stunStart(b, 1.2, 1.6, { tag: 'BRECHA ×1,6', clear: false, onEnd: () => { d.lvlNext = nx; d.metaT = 0.8; } });
    } else {
      G.text(W / 2, H * 0.5, 'ERRO NA META!', { color: '#ffd23f', size: 15, life: 1.4, stroke: true });
      dilStun(b, MT.STUN_L3, MT.MUL_L3, { tag: 'BRECHA ×2,3', text: 'RECALCULANDO...', onEnd: () => { d.lvlNext = 1; d.metaT = MT.GAP_OK; d.metaN *= 2; } });
      d.sayQ = { t: 1.0, s: M.pick(DIL_STUN_LINES) };
    }
  }
  function dilMetaFail(b, m) {
    const d = b.data;
    if (m.grp) { for (const o of d.metas) if (o.grp === m.grp) o.gone = true; d.lvlNext = 1; }
    else m.gone = true;
    G.text(m.x, m.y, 'META ADIADA!', { color: COL.orange, size: 13, life: 1.2 });
    say(b, 'DEIXAMOS A META ABERTA!', 2);
    mechMiss(b);
    d.metaOpen = true; d.armor = MT.OPEN; d.armorTag = { text: 'META ABERTA', color: '#9aa5b8' };
    d.metaT = MT.GAP_FAIL;
  }
  // agenda (fora de corrotina): nada no tonto, nos 2 s depois dele, nem com outra meta ativa
  function dilMetaSched(b, dt) {
    const d = b.data, ph = b.phase;
    if (stunning(b) || dilActive(b)) return;
    if (ph === 2) {
      // subir de nível ignora o respiro de 2 s (o próximo nível sai 0,8 s depois do susto)
      if (!(d.lvlNext > 1) && d.mechCd > 0) return;
      if ((d.metaT -= dt) > 0) return;
      const lv = d.lvlNext || 1;
      d.lvlNext = 0;
      dilLevel(b, lv);
      if (lv > 1) G.text(G.W / 2, G.H * 0.5, lv === 2 ? 'AGORA SÃO 2 METAS!' : 'AGORA SÃO 4 METAS!', { size: 14, color: '#ffd23f', stroke: true, life: 1.4 });
      return;
    }
    if (ph === 3 || d.mechCd > 0) return; // 4º turno: a meta sai no começo de cada par de pedaladas
    if ((d.metaT -= dt) <= 0) dilMetaP12(b);
  }
  // alvo do piloto: a meta ativa mais perto; no 4º turno com o tonto marcado, embaixo do meio (onde ela para)
  function dilGoal(b) {
    const d = b.data, p = pl(), H = G.H;
    if (stunning(b) || d.pendingStun) {
      const x = stunning(b) ? clamp(b.x, 30, G.W - 30) : G.W / 2;
      setGoal(b, x, H * 0.78, 'stun', 40, 'stun' + (b.mech ? b.mech.stuns : 0) + (d.pendingStun ? 'p' : ''));
      return;
    }
    let best = null, bd = Infinity;
    for (const m of d.metas) {
      if (m.done || m.gone) continue;
      const dd = M.dist2(p.x, p.y, m.x, m.y);
      if (dd < bd) { bd = dd; best = m; }
    }
    if (best) setGoal(b, best.x, best.y, 'meta', best.r - 8, 'meta' + best.id);
    else clearGoal(b);
  }
  // os anéis: no def.draw (embaixo do carro) inteiros; no drawOver (por cima dos tiros) contorno a 55% + carga
  function dilMetaDraw(c, b, over) {
    const d = b.data, t = b.t, nPlus = decoK() >= 1 ? 3 : decoK() > 0 ? 2 : 0;
    for (const m of d.metas) {
      if (m.gone) continue;
      if (m.done) {
        if (m.grp) {
          mechRing(c, m.x, m.y, m.r, t, { solid: true, color: '#3ddc84', fill: !over, alpha: over ? 0.7 : 1, label: m.lab });
          c.save(); c.globalAlpha *= over ? 0.8 : 1; c.lineCap = 'round'; c.lineJoin = 'round';
          c.beginPath(); c.moveTo(m.x - 10, m.y); c.lineTo(m.x - 3, m.y + 8); c.lineTo(m.x + 11, m.y - 8);
          c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#3ddc84'; c.lineWidth = 3.4; c.stroke();
          c.restore();
        } else if (!over) {
          // cheia: o anel estoura em dourado
          const k = 1 - Math.max(0, m.doneT) / 0.5;
          mechRing(c, m.x, m.y, m.r * (1 + 0.5 * k), t, { solid: true, color: '#ffd23f', fill: false, alpha: 1 - k });
        }
        continue;
      }
      const grow = Math.min(1, m.t / 0.6), r = m.r * (1.6 - 0.6 * grow), blink = m.life < 2;
      if (m.ghost) mechRing(c, m.ghost.x, m.y, m.r, t, { color: '#ffffff', fill: false, alpha: (over ? 0.45 : 0.7) * (0.6 + 0.4 * Math.sin(t * 20)) });
      mechRing(c, m.x, m.y, r, t, { label: m.lab, prog: m.ch, solid: m.inside, blink, alpha: (over ? 0.55 : 1) * grow, fill: !over });
      if (over || blink) continue;
      if (d.metaN >= 2 && !m.grp) txt(c, 'x' + d.metaN, m.x + r + 11, m.y - r * 0.55, 9, '#ffd23f', { stroke: 3 });
      if (m.inside && nPlus) {
        // "+" subindo dentro do anel
        c.save(); c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.lineCap = 'round';
        for (let k = 0; k < nPlus; k++) {
          const u = (t * 1.3 + k / nPlus) % 1, n = Math.floor(t * 1.3 + k / nPlus);
          const px = m.x + Math.sin(k * 2.1 + n * 1.7) * m.r * 0.5, py = m.y + m.r * 0.35 - u * m.r * 0.9;
          c.globalAlpha = 1 - u;
          c.beginPath(); c.moveTo(px - 3.5, py); c.lineTo(px + 3.5, py); c.moveTo(px, py - 3.5); c.lineTo(px, py + 3.5); c.stroke();
        }
        c.restore();
      }
    }
  }
  // calculadora do RECALCULANDO... (cinza, tela verde piscando ERRO) e duas interrogações
  function calcProp(c, x, y, t) {
    c.save(); c.translate(x, y); c.rotate(-0.18);
    rr(c, -9, -12, 18, 24, 3); inked(c, '#8d96a8', 1.6);
    c.fillStyle = '#9be7a3'; c.fillRect(-7, -10, 14, 7);
    if (((t * 4) | 0) % 2) txt(c, 'ERRO', 0, -6.4, 6, '#14381e', { maxW: 13 });
    c.fillStyle = '#e8ecf2';
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) c.fillRect(-6.5 + i * 4.6, -1 + j * 3.8, 3.4, 2.6);
    c.restore();
    for (let k = 0; k < 2; k++) {
      const u = (t * 0.8 + k * 0.5) % 1;
      c.save(); c.globalAlpha *= 1 - u;
      txt(c, '?', x + (k ? -14 : 14) + Math.sin(t * 3 + k) * 3, y - 20 - u * 18, 11, '#ffffff', { stroke: 3 });
      c.restore();
    }
  }
  // planilha: META ABERTA (6 linhas cinza finas por cima dela)
  function sheetGrid(c, x, y) {
    c.save(); c.globalAlpha *= 0.4; c.strokeStyle = '#9aa5b8'; c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 3; i++) { c.moveTo(x - 28, y - 4 + i * 16); c.lineTo(x + 28, y - 4 + i * 16); }
    for (let i = 0; i < 3; i++) { c.moveTo(x - 18 + i * 18, y - 14); c.lineTo(x - 18 + i * 18, y + 42); }
    c.stroke(); c.restore();
  }

  function* dilP1(b) {
    const d = b.data;
    d.mv = (bb, dd) => { const t = clk(bb); dd.tx = bb.homeX + Math.sin(t * 0.5) * 70; dd.ty = bb.homeY + Math.sin(t * 0.9) * 10; };
    yield 0.7;
    // 1ª meta da partida: só os potes atiram até 2 s depois de ela aparecer
    if (d.demo) yield () => !d.demo;
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
    d.mv = (bb, dd) => { dd.tx = bb.homeX + Math.sin(clk(bb) * 0.35) * 40; dd.ty = bb.homeY; };
    hint('vento', G.W / 2, G.H * 0.66, 'ARRASTE CONTRA O VENTO!', '#ffffff');
    let dir = pl().x < G.W / 2 ? -1 : 1; // empurra pro lado mais perto da parede
    d.gustDir = dir;
    yield 1.0;
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
    d.mv = (bb, dd) => { dd.tx = bb.homeX + Math.sin(clk(bb) * 0.3) * 30; dd.ty = bb.homeY; };
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
      dilMetaReqP4(b); // uma meta no começo de cada par de pedaladas
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
    name: 'DILMÃE', title: 'A Estocadora de Vento', hp: 3900, r: 40, homeY: 168, spdK: 1.12,
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
      // manha: metas, relógio (para no tonto) e o tonto
      d.metas = []; d.metaId = 0; d.metaN = 1; d.metaR = L2() ? MT.R0_L2 : MT.R0; d.metaNeed = L2() ? MT.NEED_L2 : MT.NEED; d.metaDrift = 1;
      d.metaT = MT.FIRST; d.metaOpen = false; d.armor = null; d.armorTag = null;
      d.lvl = 0; d.lvlNext = 0; d.lvlGrp = 0; d.pendingStun = false; d.inPausa = false; d.pausaStun = false;
      d.demo = false; d.demoT = 0; d.sayQ = null; d.gustDir = 1; d.clk = 0; d.stunT = 0; d.mechCd = 0;
      mechInit(b, 'meta');
      b.hitboxes = DIL_HB.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      // o tonto (encolhe os ombros, assustada) já vem pintado
      warmPeople(b, 'p1', poses(DILMA, DIL_SIZE, ['idle', 'up', 'point', 'fist', 'shrug']).concat([{ spec: DILMA, size: DIL_SIZE, mood: 'shock', pose: 'shrug' }]));
      warmShots(b, DIL_SHOTS);
    },
    updateEnter(b) { warmShotsStep(b, 1); },
    start(b) {
      const d = b.data, run = G.run || {};
      warmShotsStep(b, 99);
      // 1ª meta da partida (1º mandato): ela só ataca 2 s depois de a meta aparecer
      d.demo = !L2() && !run._metaSeen;
      co(b, dilP1(b)); co(b, dilBgJars(b, 1.7), 1); say(b, 'SAÚDO A MANDIOCA!', 1.8);
    },
    update(b, dt, g) {
      const d = b.data;
      updFx(b, dt);
      // tonto = pausa: sem corrotina, relógio, movimento, vento nem conversa
      const st = stunUpdate(b, dt);
      if (!st) {
        d.clk += dt;
        if (d.mechCd > 0) d.mechCd -= dt;
        if (d.demo && d.demoT > 0 && (d.demoT -= dt) <= 0) d.demo = false;
        runCo(b, dt);
        if (d.mv) { d.mv(b, d, dt); glide(b, dt, 2.4); }
      }
      dilMetaUpdate(b, dt);
      dilMetaSched(b, dt);
      if (d.sayQ && (d.sayQ.t -= dt) <= 0) { if (stunning(b)) say(b, d.sayQ.s, 2); d.sayQ = null; }
      fatigue(b, 'CANSEI. VOU ESTOCAR AR.');
      if (d.glowT > 0) d.glowT -= dt;
      if (d.mouthT > 0) { d.mouthT -= dt; d.mouth = 0.5 + 0.4 * Math.sin(b.ft * 18); } else d.mouth = M.approach(d.mouth, b.sayT > 0 ? 0.5 + 0.4 * Math.sin(b.ft * 16) : 0, dt * 4);
      for (let i = 0; i < 2; i++) d.jar[i] = M.approach(d.jar[i], d.jarT[i], dt * 3);
      if (d.board) d.board.pop = M.approach(d.board.pop, 0, dt * 3), d.board.side = b.x > G.W / 2 ? -1 : 1;
      // vento: empurra o Zé (e o ponto de ancoragem do dedo) e entorta os tiros marcados (parado no tonto)
      const W = d.wind;
      if (st) W.str = 0;
      else {
        if (W.warn > 0) W.warn -= dt;
        W.str = M.approach(W.str, W.target, dt * 110);
      }
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
      // hitboxes por pose (tonta na pedalada: em pé ao lado da bicicleta)
      const hb = d.bike && !st ? DIL_HB_BIKE : DIL_HB;
      if (b.hitboxes.length !== hb.length) b.hitboxes = hb.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
      if (b.hp / b.maxHp < 0.2 && Math.random() < dt * 5 * decoK()) G.part({ x: b.x + M.rand(-20, 20), y: b.y - 40, vx: M.rand(-10, 10), vy: -35, type: 'smoke', size: 4, life: 0.7, color: 'rgba(80,80,90,0.4)', drag: 0.95 });
      dilGoal(b);
      trackCar(b);
    },
    onPhase(b, idx) {
      const d = b.data;
      d.pose = 'idle'; d.glowT = 0;
      // o que vem a seguir: suada (HP < 60%) e, na pedalada, de bicicleta
      if (idx === 1) warmPeople(b, 'p2', poses(DILMA, DIL_SIZE, ['shrug']).concat(poses(DILMA_SW, DIL_SIZE, ['idle', 'up', 'point', 'shrug']), [{ spec: DILMA_SW, size: DIL_SIZE, mood: 'shock', pose: 'shrug' }]));
      if (idx === 2) warmPeople(b, 'p4', poses(DILMA_SW, DIL_BIKE, ['drive']));
      if (idx >= 2) { d.wind.target = 0; d.windy = false; }
      d.jarT[0] = d.jarT[1] = 0;
      // manha: troca de turno limpa as metas (sem castigo) e zera os níveis do 3º turno; a META ABERTA continua
      d.metas.length = 0; d.lvl = 0; d.lvlNext = 0; d.pendingStun = false; d.inPausa = false; d.pausaStun = false; d.demo = false;
      d.metaT = idx === 2 ? 2.0 : 1.5;
      if (idx === 1) { d.metaR = Math.min(d.metaR, MT.P2_R); d.metaNeed = Math.max(d.metaNeed, MT.P2_NEED); }
      // mudou de turno no meio do tonto: as corrotinas novas esperam o fim dele (que fica ≤ 2 s)
      if (stunning(b)) d.stunT = Math.min(d.stunT, 2.0);
      // pressão de fundo: os potes também arrotam vento mirado durante as rajadas (o 2º turno era o mais calmo)
      if (idx === 1) { co(b, dilP2(b)); co(b, dilBgJars(b, L2() ? 2.2 : 2.6), 1); }
      else if (idx === 2) { co(b, dilP3(b)); co(b, dilBgSeeds(b, 1.45), 1); }
      else if (idx === 3) { co(b, dilP4(b)); co(b, null, 1); }
    },
    onDeath(b) {
      const d = b.data;
      stopCo(b); d.wind.target = 0; d.wind.str = 0; d.fx.length = 0;
      // manha: some tudo (metas, alvo e tonto)
      d.metas.length = 0; d.stunT = 0; d.stunOnEnd = null; d.pendingStun = false; d.sayQ = null;
      clearGoal(b); b.hudTag = null;
      if (b.x < 30 || b.x > G.W - 30) b.x = clamp(b.x, 60, G.W - 60);
      if (b.y < 90) b.y = 120;
    },
    draw(ctx, b, g) {
      const d = b.data, st = b.state === 'fight' && stunning(b);
      bubbleAt(b, 66);
      if (b.state === 'fight') dilMetaDraw(ctx, b, false);
      drawFx(ctx, b, 'under');
      // aviso e rastros do vento
      const W = d.wind;
      if (W.warn > 0 && !st) windArrow(ctx, W.dir, b.t);
      if (W.str > 1) windStreaks(ctx, W.dir, W.str, b.t);
      const S = d.S, hpF = b.hp / b.maxHp;
      const dying = b.state === 'dying', leaving = b.state === 'leaving';
      S.t = b.t; S.flash = G.isFlash(b); S.hp = dying || leaving ? 0.15 : hpF;
      S.mood = dying ? 'hurt' : leaving ? 'laugh' : st ? 'shock' : b.invulnT > 0 ? 'angry' : d.pose === 'up' ? 'laugh' : hpF < 0.3 ? 'angry' : 'smug';
      S.mouth = b.state === 'talk' ? 0.3 + 0.3 * Math.sin(b.t * 10) : d.mouth;
      S.pose = dying || st ? 'shrug' : d.pose; S.look = lookAt(b.x, b.y);
      S.jar = b.phase <= 1 && !d.bike ? d.jar : null; S.jarGlow = d.jarGlow; S.board = dying || leaving ? null : d.board;
      S.bike = (d.bike && !st) || leaving; S.parked = d.bike && st; S.dir = leaving ? 1 : d.dir; S.glowT = d.glowT; S.k = 1; S.calc = st;
      if (leaving) {
        // foge voando de bicicleta (como no filme)
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-0.25);
        drawDilmae(ctx, 0, 0, S);
        ctx.restore();
      } else drawDilmae(ctx, st ? b.x + Math.sin(b.t * 15) * 1.6 : b.x, b.y, S);
      if (b.state === 'fight') {
        if (d.metaOpen && !st) sheetGrid(ctx, b.x, b.y);
        if (st) dizzy(ctx, b.x, b.y - 64, b.t, 24);
      }
      drawFx(ctx, b, 'top');
      drawOverFallback(b.def, ctx, b, g);
    },
    // por cima dos tiros: o contorno das metas (55%) e a carga
    drawOver(ctx, b) { if (b.state === 'fight') dilMetaDraw(ctx, b, true); },
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
  // G.BossKit — utilidades dos chefões para os outros módulos (erika.js exige; lule.js usa se tiver).
  // Contrato: docs/ENGINE.md §5.1. Mesmo comportamento das funções daqui de cima.
  // Lembretes: fx() precisa de b.data.fx = [] no init; E/O/heartPath só acrescentam subcaminhos (beginPath antes);
  // stunUpdate NÃO desconta d.mechCd (o chefão desconta fora do tonto); trackCar é a última linha do def.update.
  // ======================================================================
  G.BossKit = {
    // reexportações (mesmo comportamento)
    COL, INK, WHITE, TAU, DOWN, sfx, L2, decoK, clamp,
    pl, canShoot, shoot, ring, fan, aimFrom, hint, say, fatigue, bubbleAt,
    warmPeople, poses, warmShots, warmShotsStep,
    co, stopCo, runCo, tween, glide, fx, updFx, drawFx,
    E, O, inked, outl, txt, rr, glowOn, sweatDrop, dizzy, lookAt, hand,
    // novas
    MECH, clk, carNear, carSwept, trackCar, setGoal, clearGoal, mechInit, mechOk, mechMiss,
    stunStart, stunExtend, stunUpdate, stunning, stunEnd, mechHint, mechRing, tealHalo, heartPath, fmtMul,
  };
})();
