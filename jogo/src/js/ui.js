/* ============================================================
   FUSCA A JATO — ui.js
   Todas as telas em DOM: título/menu, fases, história, diálogos,
   abertura de fase, boletim de urna, lojinha, game over, pausa,
   final + créditos, ajustes, conquistas, como jogar e toasts.
   Identidade: urna eletrônica (teclas CONFIRMA / CORRIGE / BRANCO,
   telinha de LCD) + santinho de campanha (todo político é nº 171).
   Medidas em rem: 1rem = 10 px lógicos do jogo (ui.css escala o
   html com --gs, que o core atualiza no resize).
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G) return;
  const TAU = Math.PI * 2;

  // ==================================================================
  // Textos da UI (piadas, slogans) — PT-BR
  // ==================================================================
  const TICKER = [
    'URGENTE: Centrão anuncia apoio a quem estiver ganhando',
    'Dilmãe promete dobrar a meta assim que encontrar a meta',
    'Capitão Bolsonário decreta sigilo de 100 anos sobre o próprio sigilo',
    'Lule garante que a picanha está chegando. De novo',
    'Leão da Receita é visto rondando a Esplanada. Está com fome',
    'Fusca 78 com motor a jato é multado por excesso de patriotismo',
    'Vó Dirce termina o terceiro cachecol da semana',
    'Taxa das blusinhas agora também vale para santinho',
    'Deputado jura que a mala era de roupa suja',
    'Plenário aprova recesso para descansar do recesso',
    'Pesquisa: 171% dos políticos dizem que vão baixar impostos',
  ];
  const STICKERS = ['NÃO É FAKE NEWS!', 'SEM SIGILO DE 100 ANOS', 'PICANHA NÃO INCLUSA', 'CONTÉM IMPOSTO', 'APROVADO PELO POVO'];
  const SHOP_QUIPS = [
    'Tudo no Pix. Fiado só pra político.',
    'Preço com imposto incluso. Metade é do governo.',
    'Melhoria de verdade, não promessa de campanha.',
    'Nota fiscal? Aqui tem, viu, Capitão?',
    'Parcelo em 12x sem juros. Mentira: é à vista.',
  ];
  const BUY_QUIPS = [
    'Negócio fechado! Sem toma lá, dá cá.',
    'Investimento aprovado pela comissão (o Zé).',
    'Isso sim é dinheiro público bem gasto.',
    'Comprou! A Vó Dirce aprova.',
    'Emenda aprovada em tempo recorde.',
  ];
  const BROKE_QUIPS = [
    'Saldo insuficiente. Igual ao orçamento.',
    'Faltou Pix. Vai lá derrubar mais político.',
    'Sem dinheiro, sem emenda.',
  ];
  const OVER_JOKES = [
    'Faltaram votos. Sobrou santinho.',
    'Até o Centrão mudou de lado.',
    'O Leão da Receita mandou lembranças.',
    'Não foi derrota. Foi "vitória adiada".',
    'Calma: em Brasília ninguém perde de verdade.',
    'Pede recontagem. Todo mundo pede.',
  ];
  const PAUSE_JOKES = [
    'Os deputados foram tomar um cafezinho.',
    'Recesso parlamentar. Com auxílio-paletó.',
    'Ninguém trabalha, mas o salário cai.',
    'A sessão volta assim que alguém achar o quórum.',
  ];
  const RANKS = {
    S: { label: 'ELEITO NO 1º TURNO', line: 'Ficha limpa e sem delação. O povo agradece.' },
    A: { label: 'ELEITO', line: 'Nenhum arranhão. Quase um santo.' },
    B: { label: '2º TURNO', line: 'Uns arranhões, mas passou.' },
    C: { label: 'SUPLENTE', line: 'Passou raspando. Igual orçamento.' },
  };
  const RANK_ORDER = { S: 4, A: 3, B: 2, C: 1 };
  // Dados das fases (fallback quando stages.js ainda não carregou)
  const STAGE_FALLBACK = [
    { id: 'rodoviaria', name: 'Rodoviária do Plano', subtitle: 'A campanha começou', boss: 'centrao' },
    { id: 'esplanada', name: 'Esplanada dos Ministérios', subtitle: 'Cada ministério, mil assessores', boss: 'dilmae' },
    { id: 'paranoa', name: 'Lago Paranoá', subtitle: 'Motociata, drones e fake news', boss: 'bolsonario' },
    { id: 'planalto', name: 'Palácio do Planalto', subtitle: 'A conta chegou', boss: 'lule' },
  ];
  const STAGE_LOOK = {
    rodoviaria: { c: '#1b3fa0', c2: '#4cc9f0' },
    esplanada: { c: '#00a651', c2: '#ffd23f' },
    paranoa: { c: '#0b7f95', c2: '#7be0f2' },
    planalto: { c: '#d62f3c', c2: '#ffd23f' },
  };
  const BOSS_FALLBACK_NAME = { centrao: 'O Centrão', dilmae: 'Dilmãe', bolsonario: 'Capitão Bolsonário', lule: 'Lule' };
  const BOSS_SLOGAN = {
    centrao: 'Apoio quem estiver ganhando',
    dilmae: 'Atingiu a meta? Dobra a meta',
    bolsonario: 'Sigilo de 100 anos, talkey?',
    lule: 'A picanha tá chegando',
  };
  const STAGE_GAG = {
    rodoviaria: 'Todo candidato desta fase é o nº 171. Coincidência?',
    esplanada: '38 ministérios. Um número só: 171.',
    paranoa: 'Na motociata, até a placa da moto é 171.',
    planalto: 'Para Presidente da Conta, digite 171 e CONFIRMA.',
  };
  const ALLIES = { ze: 1, vo: 1, radio: 1 };
  const UPGRADE_ICON = {
    vida: ['life'], bomba: ['bomb'], turbo: ['cafe'], ima: ['pix5'], arma: ['power', 'voto'], habeas: ['shield'],
  };
  const CAST_CREDITS = [
    ['Zé Contribuinte', 'ele mesmo, pagando tudo'],
    ['Vó Dirce', 'no rádio e no crochê'],
    ['Rádio Planalto', 'notícias de procedência duvidosa'],
    ['O Centrão', 'todos os partidos ao mesmo tempo'],
    ['Dilmãe', 'estocando vento'],
    ['Capitão Bolsonário', 'de moto e de jet ski'],
    ['Lule', 'com picanha (prometida)'],
    ['Leão da Receita', 'mordendo a sua parte'],
    ['Fusca 78', 'motor a jato, freio na fé'],
  ];

  // ==================================================================
  // Utilitários
  // ==================================================================
  const sfx = (name) => { if (name) G.call(G.Audio, 'sfx', name); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => G.fmt(Math.max(0, Math.round(+n || 0)));
  const money = (n) => 'R$ ' + fmt(n);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const castName = (who) => (G.CAST && G.CAST[who] && G.CAST[who].name) || BOSS_FALLBACK_NAME[who] || String(who || '');
  const castColor = (who) => (G.CAST && G.CAST[who] && G.CAST[who].color) || '#9aa5b8';
  const settings = () => G.save.settings;
  const q = (root, sel) => root.querySelector(sel);
  const qa = (root, sel) => Array.prototype.slice.call(root.querySelectorAll(sel));
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function once(fn) { let used = false; return function () { if (used) return; used = true; if (typeof fn === 'function') G.safe(fn, 'ui.done'); }; }
  function uiSave() { if (!G.save.ui || typeof G.save.ui !== 'object') G.save.ui = {}; return G.save.ui; }
  function achCount() { const list = G.ACHIEVEMENTS || []; return { got: list.filter((a) => G.save.achievements[a.id]).length, total: list.length }; }
  // cor de texto legível sobre um fundo
  function inkOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#121519';
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#121519' : '#ffffff';
  }
  function stageInfo(i, st) {
    st = st || G.Stages.list[i] || {};
    const fb = STAGE_FALLBACK[i] || STAGE_FALLBACK[0];
    const canon = STAGE_FALLBACK.some((s) => s.id === st.id);
    const src = canon ? st : fb; // fase de teste (módulos isolados) usa os dados oficiais
    const id = src.id || fb.id;
    return { id, name: src.name || fb.name, subtitle: src.subtitle || fb.subtitle, boss: src.boss || fb.boss, look: STAGE_LOOK[id] || STAGE_LOOK.rodoviaria };
  }
  function bossTitle(id) { const d = G.Bosses.defs[id]; return (d && d.title) || BOSS_SLOGAN[id] || ''; }

  // ==================================================================
  // Gerenciador de telas
  // ==================================================================
  let cur = null;          // tela atual { root, kind, alive, timers, cleanups, onKey }
  let kbdMode = false;     // true quando o jogador está usando teclado (mostra foco)
  let downEl = null, downT = 0;
  const uiRoot = () => document.getElementById('ui');

  function open(kind, extra) {
    close();
    installGlobal();
    const u = uiRoot();
    const root = document.createElement('div');
    root.className = 'scr scr-' + kind + (extra ? ' ' + extra : '');
    if (reducedMotion()) root.classList.add('rm');
    if (G.H < 700) root.classList.add('short');
    // telas com texto animado (máquina de escrever, letreiro, contadores) não devem
    // disparar o aria-live do #ui a cada quadro; o texto completo continua no DOM
    if (/^(title|story|dlg|clear|roll|howto)$/.test(kind)) root.setAttribute('aria-live', 'off');
    if (u) { u.appendChild(root); u.classList.add('open'); u.setAttribute('data-screen', kind); }
    cur = { root, kind, alive: true, timers: [], cleanups: [], onKey: null, born: performance.now() };
    return cur;
  }
  function close() {
    const s = cur;
    cur = null;
    if (s) {
      s.alive = false;
      s.timers.forEach(clearTimeout);
      for (const f of s.cleanups) { try { f(); } catch (e) { G.reportError(e, 'ui.cleanup'); } }
    }
    const u = uiRoot();
    if (u) { u.innerHTML = ''; u.classList.remove('open'); u.removeAttribute('data-screen'); }
  }
  function later(scr, ms, fn) {
    const id = setTimeout(() => { if (scr.alive) G.safe(fn, 'ui.timer ' + scr.kind); }, ms);
    scr.timers.push(id);
    return id;
  }
  // laço de animação enquanto a tela estiver viva. fn(dt, tempoTotal) → false para parar
  function loop(scr, fn) {
    let id = 0, last = performance.now(), total = 0;
    const tick = (now) => {
      if (!scr.alive) return;
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now; total += dt;
      let r;
      try { r = fn(dt, total); } catch (err) { G.reportError(err, 'ui.loop ' + scr.kind); return; }
      if (r === false) return;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    scr.cleanups.push(() => cancelAnimationFrame(id));
  }
  // mantém a classe 'short' da tela atual em dia quando o celular gira/redimensiona
  // (adiado um quadro: o core recalcula G.H e o tamanho do #ui no próprio listener de resize)
  window.addEventListener('resize', () => requestAnimationFrame(() => { if (cur) cur.root.classList.toggle('short', G.H < 700); }));
  function onResize(scr, fn) {
    const h = () => requestAnimationFrame(() => { if (scr.alive) G.safe(fn, 'ui.resize'); });
    window.addEventListener('resize', h);
    scr.cleanups.push(() => window.removeEventListener('resize', h));
  }
  // Ajusta a resolução do canvas ao tamanho na tela; desenha em px CSS
  function fitCanvas(cv) {
    const w = cv.clientWidth || 1, h = cv.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }
  function soundFor(el) {
    if (el.classList.contains('key-confirma')) return 'ui_confirm';
    if (el.classList.contains('key-corrige')) return 'ui_back';
    return 'ui_click';
  }
  // Liga um botão: som + ação. sound=false → sem som automático
  function onTap(el, fn, sound) {
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (el.disabled) return; // .off é só visual (ex.: sem saldo ainda dá o aviso)
      if (sound !== false) sfx(sound || soundFor(el));
      G.safe(fn, 'ui.tap', e);
    });
  }
  function focusEl(el) { if (el && kbdMode) { try { el.focus({ preventScroll: true }); } catch (e) { /* nada */ } } }
  function installGlobal() {
    const u = uiRoot();
    if (!u || u.__uiBound) return;
    u.__uiBound = true;
    u.addEventListener('pointerdown', (e) => {
      kbdMode = false;
      G.call(G.Audio, 'unlock');
      const k = e.target && e.target.closest ? e.target.closest('.key, .sant, .tog, .press') : null;
      if (k && !k.disabled) { if (downEl && downEl !== k) downEl.classList.remove('is-down'); k.classList.add('is-down'); downEl = k; downT = performance.now(); }
    });
    const up = () => {
      if (!downEl) return;
      const el = downEl; downEl = null;
      setTimeout(() => el.classList.remove('is-down'), Math.max(0, 110 - (performance.now() - downT)));
    };
    u.addEventListener('pointerup', up);
    u.addEventListener('pointercancel', up);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' || e.key.indexOf('Arrow') === 0) kbdMode = true;
      const s = cur;
      if (!s || !s.alive) return;
      const ae = document.activeElement;
      const btnFocused = ae && ae.tagName === 'BUTTON' && u.contains(ae);
      // setas: navega entre as teclas da tela
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !(ae && ae.type === 'range'))) {
        const list = qa(s.root, 'button:not([disabled]), input[type=range]').filter((b) => b.offsetParent !== null);
        if (list.length) {
          const i = list.indexOf(ae);
          const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
          const nx = list[(i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length)];
          try { nx.focus({ preventScroll: false }); } catch (err) { /* nada */ }
          e.preventDefault();
        }
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && btnFocused) return; // ativação nativa do botão
      if (s.onKey) {
        kbdMode = kbdMode || e.key === 'Enter';
        G.safe(s.onKey, 'ui.key', e, e.key);
        // tecla consumida pela UI: não deixa o core reagir a ela (ex.: Esc fecha o diálogo
        // e o jogo volta a 'play' — sem isso o core pausaria; Espaço soltaria uma delação)
        if (!s.alive || cur !== s || e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); }
      }
    });
  }

  // Máquina de escrever: mantém o texto inteiro no layout (sem pulos)
  function Typer(onEl, offEl, cps) {
    this.on = onEl; this.off = offEl; this.cps = cps || 45;
    this.text = ''; this.n = 0; this.acc = 0; this.done = true; this.shown = -1;
  }
  Typer.prototype.set = function (text) { this.text = String(text || ''); this.n = 0; this.acc = 0; this.done = !this.text.length; this.render(); };
  Typer.prototype.update = function (dt) {
    if (this.done) return;
    this.acc += dt * this.cps;
    let blip = false;
    while (this.acc >= 1 && this.n < this.text.length) {
      this.acc -= 1;
      const ch = this.text[this.n++];
      if (ch === ',' || ch === ';') this.acc -= 4;
      else if (ch === '.' || ch === '!' || ch === '?' || ch === ':') this.acc -= 7;
      if (ch !== ' ' && this.n % 2 === 0) blip = true;
    }
    if (this.n >= this.text.length) this.done = true;
    this.render();
    if (blip) sfx('ui_type');
  };
  Typer.prototype.finish = function () { this.n = this.text.length; this.done = true; this.render(); };
  Typer.prototype.render = function () {
    if (this.shown === this.n) return;
    this.shown = this.n;
    this.on.textContent = this.text.slice(0, this.n);
    this.off.textContent = this.text.slice(this.n);
  };

  // ------------------------------------------------------------------
  // Pedaços de HTML reaproveitados
  // ------------------------------------------------------------------
  const BRAND = '<div class="urna-head"><span class="brand"><i class="flag"></i>JUSTIÇA ELEITORAL DO POVO</span><span class="model">URNA MOD. 171</span></div>';
  function keyHTML(kind, label, small, cls, attrs) {
    return '<button type="button" class="key key-' + kind + (cls ? ' ' + cls : '') + '"' + (attrs || '') + '><span class="kl">' + label + '</span>' + (small ? '<small class="ks">' + small + '</small>' : '') + '</button>';
  }
  const backKey = (label) => keyHTML('corrige', label || 'VOLTAR', 'CORRIGE', 'k-back');
  function lcdFoot(conf, corr) {
    return '<span class="af">Aperte a tecla:</span>' +
      (conf ? '<span><b class="t-conf">CONFIRMA</b> para ' + conf + '</span>' : '') +
      (corr ? '<span><b class="t-corr">CORRIGE</b> para ' + corr + '</span>' : '');
  }
  // Moldura de página: urna com telinha (LCD) e teclas embaixo
  function pageShell(kind, o) {
    const scr = open(kind, 'scr-page' + (o.cls ? ' ' + o.cls : ''));
    scr.root.innerHTML =
      '<div class="urna urna-page">' + BRAND +
      '<div class="bezel"><div class="lcd">' +
      '<div class="lcd-head"><div class="lcd-titles">' + (o.kicker ? '<small>' + o.kicker + '</small>' : '') + '<h2>' + o.title + '</h2></div>' +
      (o.right ? '<div class="lcd-right">' + o.right + '</div>' : '') + '</div>' +
      '<div class="lcd-body scroll">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="lcd-foot">' + o.foot + '</div>' : '') +
      '</div></div>' +
      '<div class="keyrow">' + (o.keys || '') + '</div></div>';
    return scr;
  }
  // Pix: ícone (losango) em HTML
  const PIX_ICO = '<i class="pix-ico" aria-hidden="true"></i>';

  // ------------------------------------------------------------------
  // Desenhos em canvas usados pela UI
  // ------------------------------------------------------------------
  function drawBullet(ctx, style, color, x, y, scale) {
    let spr = null;
    try { spr = G.BulletStyles.sprite(style, color); } catch (e) { spr = null; }
    if (!spr || !spr._s) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 4 * (scale || 1), 0, TAU); ctx.fill(); return; }
    const s = spr._s * (scale || 1);
    ctx.drawImage(spr, x - s / 2, y - s / 2, s, s);
  }
  // Retrato com fundo de "foto de santinho"
  function drawPhoto(ctx, w, h, who, t, o) {
    o = o || {};
    const col = o.color || castColor(who);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, o.light || '#ffffff');
    g.addColorStop(0.55, col);
    g.addColorStop(1, o.dark || '#101418');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // raios de fundo
    ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = '#ffffff';
    ctx.translate(w / 2, h * 0.55); ctx.rotate(t * 0.15);
    for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(w, h), -Math.max(w, h) * 0.16); ctx.lineTo(Math.max(w, h), Math.max(w, h) * 0.16); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    const size = o.size || Math.min(w, h * 1.05);
    G.drawPortrait(ctx, who, w / 2, o.cy != null ? o.cy : h - size / 2, size, { t, mouth: o.mouth || 0, mood: o.mood });
  }
  // silhueta (fases sob sigilo): desenha num canvas à parte e pinta de preto
  function drawSilhouette(ctx, w, h, who) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w * dpr)); off.height = Math.max(1, Math.round(h * dpr));
    const o = off.getContext('2d');
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = Math.min(w, h * 1.05);
    G.drawPortrait(o, who, w / 2, h - size / 2, size, { t: 0.4 });
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = '#20242b'; o.fillRect(0, 0, off.width, off.height);
    ctx.fillStyle = '#5b6170'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 3);
    ctx.restore();
    ctx.drawImage(off, 0, 0, w, h);
    ctx.fillStyle = '#ffd23f'; ctx.font = Math.round(h * 0.42) + 'px ' + G.FONT_DISPLAY;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', w / 2, h * 0.5);
  }
  // Leão da Receita: tenta usar o desenho do inimigo (num canvas separado), senão um leão simples
  let leaoBroken = false, leaoCanvas = null;
  function drawLeao(ctx, x, y, t, k) {
    const def = G.Enemies && G.Enemies.defs && G.Enemies.defs.leao;
    if (def && typeof def.draw === 'function' && !leaoBroken) {
      try {
        if (!leaoCanvas) { leaoCanvas = document.createElement('canvas'); leaoCanvas.width = 160; leaoCanvas.height = 160; }
        const c = leaoCanvas.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 160, 160);
        c.setTransform(2, 0, 0, 2, 0, 0);
        const e = { x: 40, y: 42, r: 17, t, flash: 0, hp: 30, maxHp: 30, vx: 0, vy: 0, data: { st: 'prowl', stT: 0, mouth: (Math.sin(t * 4) + 1) / 2, dir: 1 }, o: {}, def };
        def.draw(c, e, { t, loop: 1, diff: 1 });
        ctx.drawImage(leaoCanvas, x - 40 * k, y - 42 * k, 80 * k, 80 * k);
        return;
      } catch (err) { leaoBroken = true; }
    }
    // fallback: carinha de leão
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = '#c96a12';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 15, Math.sin(a) * 15, 8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#f2b13a'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#121519'; ctx.beginPath(); ctx.arc(-5, -3, 2.2, 0, TAU); ctx.arc(5, -3, 2.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 7, 5, 2 + Math.abs(Math.sin(t * 4)) * 3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawPlayer(ctx, x, y, k, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    G.call(G.Art, 'player', ctx, 0, 0, o || {});
    ctx.restore();
  }
  function hitDot(ctx, x, y, t, big) {
    const r = big ? 4.2 : 3.2;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.35 * Math.sin(t * 6)) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r + 4 + Math.sin(t * 6) * 1.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#121519'; ctx.beginPath(); ctx.arc(x, y, r + 1.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function tileBG(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#16224a'); g.addColorStop(1, '#0b1022');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) ctx.fillRect(x, y, 1.5, 1.5);
  }

  // ==================================================================
  // TELA DE TÍTULO
  // ==================================================================
  let artT = Math.random() * 20;
  let tickerI = (Math.random() * TICKER.length) | 0;
  let stickerI = (Math.random() * STICKERS.length) | 0;

  function fallbackTitleArt(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1022'); g.addColorStop(0.6, '#3a1a5c'); g.addColorStop(1, '#e2553a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h * 0.62); ctx.globalAlpha = 0.12; ctx.fillStyle = '#ffd23f';
    ctx.rotate(t * 0.1);
    for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(h, -h * 0.12); ctx.lineTo(h, h * 0.12); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    drawPlayer(ctx, w / 2, h * 0.62 + Math.sin(t * 2) * 5, 2.2, { t, weapon: 'voto', level: 3 });
  }

  function showTitle(quick) {
    const scr = open('title', quick ? 'quick' : '');
    const S = G.save;
    const ac = achCount();
    const canBuy = (G.UPGRADES || []).some((u) => { const c = G.upgradeCost(u.id); return c != null && S.pix >= c; });
    const sticker = STICKERS[stickerI++ % STICKERS.length];
    scr.root.innerHTML =
      '<canvas class="t-art" aria-hidden="true"></canvas>' +
      '<div class="t-top">' +
      '<div class="chip chip-pix">' + PIX_ICO + '<span><small>SALDO PIX</small><b>' + money(S.pix) + '</b></span></div>' +
      '<div class="chip chip-best"><span><small>RECORDE</small><b>' + fmt(S.best) + '</b></span></div>' +
      '</div>' +
      '<header class="logo">' +
      '<h1 class="logo-main" aria-label="Fusca a Jato"><span class="l1">FUSCA</span><span class="l2">A JATO</span></h1>' +
      '<div class="logo-sub"><span>GUERRA EM BRASÍLIA</span></div>' +
      '<div class="sticker" aria-hidden="true"><span>' + esc(sticker) + '</span></div>' +
      '</header>' +
      '<div class="t-spacer"></div>' +
      '<div class="urna urna-title">' + BRAND +
      '<div class="bezel bezel-tick"><div class="lcd lcd-tick"><span class="tick-lbl">RÁDIO<br>PLANALTO</span><div class="tick-win"><span class="tick-txt"></span></div></div></div>' +
      '<div class="keypad">' +
      '<button type="button" class="key key-num" data-go="fases"><i>1</i><span>FASES</span></button>' +
      '<button type="button" class="key key-num" data-go="loja"><i>2</i><span>LOJINHA</span>' + (canBuy ? '<b class="badge">R$</b>' : '') + '</button>' +
      '<button type="button" class="key key-num" data-go="conq"><i>3</i><span>CONQUISTAS<em>' + ac.got + '/' + ac.total + '</em></span></button>' +
      '<button type="button" class="key key-num" data-go="como"><i>4</i><span>COMO JOGAR</span></button>' +
      '<button type="button" class="key key-num" data-go="ajustes"><i>5</i><span>AJUSTES</span></button>' +
      '<button type="button" class="key key-num" data-go="creditos"><i>6</i><span>CRÉDITOS</span></button>' +
      '</div>' +
      '<div class="keyrow">' +
      (S.cleared ? keyHTML('branco', '2º MANDATO', 'mais difícil · mais Pix', 'k-mandato', ' data-go="mandato"') : '') +
      keyHTML('confirma', 'JOGAR', 'CONFIRMA', 'k-play', ' data-go="jogar"') +
      '</div></div>';

    const go = {
      jogar() {
        if ((G.save.unlocked || 1) > 1) showStages();
        else { close(); G.startRun(0); }
      },
      mandato() { close(); G.startRun(0, 2); },
      fases: () => showStages(),
      loja: () => showShop({}, () => showTitle(true)),
      conq: () => showAchievements(),
      como: () => showHowTo(),
      ajustes: () => showSettings(),
      creditos: () => showCredits(),
    };
    qa(scr.root, '[data-go]').forEach((b) => onTap(b, () => go[b.getAttribute('data-go')]()));
    scr.onKey = (e, k) => {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); sfx('ui_confirm'); go.jogar(); }
      const n = +k;
      const order = ['fases', 'loja', 'conq', 'como', 'ajustes', 'creditos'];
      if (n >= 1 && n <= 6) { sfx('ui_click'); go[order[n - 1]](); }
    };
    focusEl(q(scr.root, '.k-play'));

    // letreiro da Rádio Planalto
    const win = q(scr.root, '.tick-win'), txt = q(scr.root, '.tick-txt');
    const nextNews = () => {
      txt.textContent = TICKER[tickerI++ % TICKER.length];
      if (reducedMotion()) { later(scr, 4500, nextNews); return; }
      txt.classList.remove('run');
      txt.style.setProperty('--from', win.clientWidth + 'px');
      txt.style.animationDuration = Math.max(6, (win.clientWidth + txt.offsetWidth) / 55) + 's';
      void txt.offsetWidth;
      txt.classList.add('run');
    };
    txt.addEventListener('animationend', nextNews);
    nextNews();

    // arte animada (G.Art.titleArt) ocupando a área acima da urna
    const cv = q(scr.root, '.t-art'), urna = q(scr.root, '.urna-title');
    loop(scr, (dt) => {
      artT += dt;
      const f = fitCanvas(cv);
      const ah = clamp(urna.offsetTop + 26, 160, f.h);
      f.ctx.clearRect(0, 0, f.w, f.h);
      if (G.Art && typeof G.Art.titleArt === 'function') G.call(G.Art, 'titleArt', f.ctx, f.w, ah, artT);
      else fallbackTitleArt(f.ctx, f.w, ah, artT);
      f.ctx.fillStyle = '#150a24';
      f.ctx.fillRect(0, ah - 1, f.w, f.h - ah + 1);
    });
  }

  // ==================================================================
  // SELEÇÃO DE FASES (santinhos)
  // ==================================================================
  function showStages() {
    const unlocked = G.save.unlocked || 1;
    const ranks = uiSave().ranks || {};
    let cards = '';
    for (let i = 0; i < 4; i++) {
      const s = stageInfo(i);
      const open_ = i < unlocked;
      const r = ranks[i];
      cards +=
        '<button type="button" class="sant' + (open_ ? '' : ' locked') + '" data-i="' + i + '" style="--c:' + s.look.c + ';--c2:' + s.look.c2 + ';--i:' + i + '">' +
        '<span class="sant-band"><b>FASE ' + (i + 1) + '</b>' + (r ? '<i class="mini-rank r-' + r + '">' + r + '</i>' : !open_ ? '<i class="lock-ico"></i>' : i === unlocked - 1 ? '<i class="mini-new">NOVA!</i>' : '') + '</span>' +
        '<span class="sant-photo"><canvas data-boss="' + s.boss + '"></canvas><span class="sant-num"><small>Nº</small>171</span></span>' +
        '<span class="sant-boss">' + esc(castName(s.boss)) + '</span>' +
        '<span class="sant-name">' + esc(s.name) + '</span>' +
        '<span class="sant-sub">' + esc(open_ ? s.subtitle : 'Vença a fase anterior') + '</span>' +
        (open_ ? '' : '<span class="sigilo">SIGILO DE 100 ANOS</span>') +
        '</button>';
    }
    const scr = pageShell('stages', {
      kicker: 'SEU VOTO PARA', title: 'FASES',
      right: '<span class="lcd-chip">' + Math.min(unlocked, 4) + '/4 LIBERADAS</span>',
      body: '<div class="sant-grid">' + cards + '</div>',
      foot: lcdFoot('', 'VOLTAR') + '<span class="foot-msg">Escolha um santinho. Todos são nº 171.</span>',
      keys: backKey(),
    });
    const msg = q(scr.root, '.foot-msg');
    qa(scr.root, '.sant').forEach((b) => onTap(b, () => {
      const i = +b.getAttribute('data-i');
      if (b.classList.contains('locked')) {
        sfx('denied');
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        msg.textContent = 'Fase sob sigilo de 100 anos. Vença a anterior para liberar.';
        msg.classList.add('alert');
        return;
      }
      sfx('ui_confirm');
      close();
      G.startRun(i);
    }, false));
    onTap(q(scr.root, '.k-back'), () => showTitle(true));
    scr.onKey = (e, k) => { if (k === 'Escape' || k === 'Backspace') { sfx('ui_back'); showTitle(true); } };
    const paint = () => qa(scr.root, '.sant canvas').forEach((cv) => {
      const f = fitCanvas(cv);
      const who = cv.getAttribute('data-boss');
      const card = cv.closest('.sant');
      f.ctx.clearRect(0, 0, f.w, f.h);
      if (card.classList.contains('locked')) drawSilhouette(f.ctx, f.w, f.h, who);
      else drawPhoto(f.ctx, f.w, f.h, who, 0.4, { color: getComputedStyle(card).getPropertyValue('--c2').trim() || '#ffd23f', dark: getComputedStyle(card).getPropertyValue('--c').trim() || '#1b3fa0' });
    });
    requestAnimationFrame(() => { if (scr.alive) G.safe(paint, 'ui.stages.paint'); });
    onResize(scr, paint);
    focusEl(q(scr.root, '.sant:not(.locked)'));
  }

  // ==================================================================
  // HISTÓRIA (quadrinhos) — usada na abertura e no final
  // ==================================================================
  function storyScreen(panels, opt, done) {
    const fin = once(done);
    panels = (panels || []).filter(Boolean);
    if (!panels.length) { close(); fin(); return; }
    const scr = open('story', opt && opt.cls);
    scr.root.innerHTML =
      '<div class="st-top"><div class="st-dots">' + panels.map(() => '<i></i>').join('') + '</div>' +
      keyHTML('branco', 'PULAR', '', 'key-sm st-skip') + '</div>' +
      '<div class="st-mid">' +
      '<div class="st-panel"><canvas aria-hidden="true"></canvas><b class="st-num"></b></div>' +
      '<div class="st-cap"><p class="tw"><span class="tw-on"></span><span class="tw-off"></span></p><i class="nxt"></i></div>' +
      '</div>' +
      '<div class="st-hint">TOQUE PARA CONTINUAR</div>';
    const panel = q(scr.root, '.st-panel'), cv = q(panel, 'canvas'), num = q(scr.root, '.st-num');
    const cap = q(scr.root, '.st-cap'), dots = qa(scr.root, '.st-dots i');
    const typer = new Typer(q(scr.root, '.tw-on'), q(scr.root, '.tw-off'), 45);
    let idx = 0, pt = 0, ending = false;
    const show = (i) => {
      idx = i; pt = 0;
      typer.set(panels[i].text || '');
      num.textContent = (i + 1) + '/' + panels.length;
      dots.forEach((d, j) => { d.className = j < i ? 'seen' : j === i ? 'on' : ''; });
      panel.classList.toggle('tilt-r', i % 2 === 1);
      for (const el of [panel, cap]) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }
      scr.root.classList.remove('typed');
    };
    const finish = () => {
      if (ending) return;
      ending = true;
      close();
      fin();
    };
    const advance = () => {
      if (ending || performance.now() - scr.born < 250) return;
      if (!typer.done) { typer.finish(); return; }
      if (idx < panels.length - 1) { sfx('ui_click'); show(idx + 1); }
      else { sfx('ui_confirm'); finish(); }
    };
    scr.root.addEventListener('click', advance);
    onTap(q(scr.root, '.st-skip'), finish);
    scr.onKey = (e, k) => {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); advance(); }
      else if (k === 'Escape') { sfx('ui_back'); finish(); }
    };
    const mid = q(scr.root, '.st-mid');
    const layout = () => {
      const w = panel.clientWidth;
      if (!w) return;
      const gap = parseFloat(getComputedStyle(mid).rowGap) || 0;
      const free = mid.clientHeight - cap.offsetHeight - gap - parseFloat(getComputedStyle(mid).paddingTop || 0) - 8;
      panel.style.height = Math.round(clamp(free, w * 0.62, w * 1.18)) + "px";
    };
    show(0);
    layout();
    onResize(scr, layout);
    loop(scr, (dt) => {
      pt += dt;
      typer.update(dt);
      if (typer.done) scr.root.classList.add('typed');
      const f = fitCanvas(cv);
      if (G.Art && typeof G.Art.scene === 'function') G.call(G.Art, 'scene', f.ctx, panels[idx].scene || 'urna', f.w, f.h, pt);
    });
  }

  // ==================================================================
  // DIÁLOGO (caixa embaixo, por cima do jogo)
  // ==================================================================
  function moodFor(line) {
    if (line.mood) return line.mood;
    const t = String(line.text || '');
    if (/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\b.*!/.test(t) || /\?!/.test(t)) return 'angry';
    if (/^h[ãa]\?$/i.test(t.trim())) return 'hurt';
    return undefined;
  }
  function showDialogue(lines, done) {
    const fin = once(done);
    lines = (lines || []).filter((l) => l && l.text);
    if (!lines.length) { close(); fin(); return; }
    const scr = open('dlg');
    scr.root.innerHTML =
      '<div class="dlg">' +
      keyHTML('branco', 'PULAR', '', 'key-sm dlg-skip') +
      '<div class="dlg-box">' +
      '<div class="dlg-name"></div>' +
      '<div class="dlg-frame"><canvas aria-hidden="true"></canvas></div>' +
      '<p class="dlg-text tw"><span class="tw-on"></span><span class="tw-off"></span></p>' +
      '<i class="nxt"></i>' +
      '</div></div>';
    const box = q(scr.root, '.dlg-box'), name = q(scr.root, '.dlg-name'), frame = q(scr.root, '.dlg-frame');
    const cv = q(frame, 'canvas');
    const typer = new Typer(q(scr.root, '.tw-on'), q(scr.root, '.tw-off'), 45);
    let i = 0, lt = 0, who = '', mood, ending = false;
    const show = (n) => {
      i = n; lt = 0;
      const l = lines[n];
      const changed = l.who !== who;
      who = l.who; mood = moodFor(l);
      const col = castColor(who);
      box.style.setProperty('--who', col);
      box.style.setProperty('--who-ink', inkOn(col));
      box.classList.toggle('right', !ALLIES[who]);
      name.textContent = castName(who);
      typer.set(l.text);
      scr.root.classList.remove('typed');
      if (changed) { frame.classList.remove('pop'); void frame.offsetWidth; frame.classList.add('pop'); }
    };
    const finish = () => { if (ending) return; ending = true; close(); fin(); };
    const advance = () => {
      if (ending || performance.now() - scr.born < 320) return; // evita pular sem querer (dedo ainda na tela)
      if (!typer.done) { typer.finish(); return; }
      if (i < lines.length - 1) { sfx('ui_click'); show(i + 1); }
      else { sfx('ui_click'); finish(); }
    };
    scr.root.addEventListener('click', advance);
    onTap(q(scr.root, '.dlg-skip'), finish);
    scr.onKey = (e, k) => {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); advance(); }
      else if (k === 'Escape') { sfx('ui_back'); finish(); }
    };
    show(0);
    loop(scr, (dt) => {
      lt += dt;
      typer.update(dt);
      if (typer.done) scr.root.classList.add('typed');
      const f = fitCanvas(cv);
      const mouth = typer.done ? 0 : Math.round(Math.abs(Math.sin(lt * 13)) * 4) / 4;
      f.ctx.clearRect(0, 0, f.w, f.h);
      drawPhoto(f.ctx, f.w, f.h, who, lt + 0.3, { mouth, mood, size: f.w * 1.02, cy: f.h * 0.52, light: '#fff7d6' });
    });
  }

  // ==================================================================
  // ABERTURA DE FASE (santinho que entra deslizando)
  // ==================================================================
  function showStageIntro(info, done) {
    info = info || {};
    const fin = once(done);
    const i = info.index | 0;
    const s = stageInfo(i, info.stage);
    const loopN = info.loop || 1, total = info.total || 4;
    const scr = open('intro');
    scr.root.innerHTML =
      '<div class="in-card" style="--c:' + s.look.c + ';--c2:' + s.look.c2 + '">' +
      '<div class="in-band"><b>FASE ' + (i + 1) + '</b><span>DE ' + total + '</span></div>' +
      (loopN > 1 ? '<div class="in-ribbon">2º MANDATO</div>' : '') +
      '<div class="in-photo"><canvas aria-hidden="true"></canvas><div class="in-num"><small>Nº</small>171</div></div>' +
      '<h2 class="in-name">' + esc(s.name) + '</h2>' +
      '<p class="in-sub">' + esc(s.subtitle) + '</p>' +
      '<div class="in-boss"><small>CHEFÃO</small><b>' + esc(castName(s.boss)) + '</b><em>“' + esc(bossTitle(s.boss)) + '”</em></div>' +
      '<p class="in-gag">' + esc(STAGE_GAG[s.id] || 'Todo político aqui é o nº 171.') + '</p>' +
      '</div>' +
      '<div class="in-hint">toque para começar</div>';
    const card = q(scr.root, '.in-card'), cv = q(scr.root, 'canvas');
    sfx('whoosh');
    let leaving = false;
    const leave = () => {
      if (leaving) return;
      leaving = true;
      card.classList.add('out');
      sfx('whoosh');
      later(scr, reducedMotion() ? 0 : 360, () => { close(); fin(); });
    };
    scr.root.addEventListener('click', () => { if (performance.now() - scr.born > 300) leave(); });
    scr.onKey = (e, k) => { if (k === 'Enter' || k === ' ' || k === 'Escape') { e.preventDefault(); leave(); } };
    later(scr, 2500, leave);
    later(scr, 420, () => sfx('stamp'));
    loop(scr, (dt, t) => {
      const f = fitCanvas(cv);
      f.ctx.clearRect(0, 0, f.w, f.h);
      drawPhoto(f.ctx, f.w, f.h, s.boss, t + 0.4, { color: s.look.c2, dark: s.look.c, size: Math.min(f.w, f.h * 1.08) });
    });
  }

  // ==================================================================
  // BOLETIM DE URNA (resultado da fase)
  // ==================================================================
  function recordRank(stats) {
    const u = uiSave();
    u.ranks = u.ranks || {};
    const k = String(stats.index | 0), prev = u.ranks[k];
    if (!prev || (RANK_ORDER[stats.rank] || 0) > (RANK_ORDER[prev] || 0)) { u.ranks[k] = stats.rank; G.saveGame(); }
  }
  function fmtTime(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function showStageClear(stats, done) {
    stats = stats || {};
    const fin = once(done);
    G.safe(recordRank, 'ui.recordRank', stats);
    const b = stats.bonus || {};
    const loopN = stats.loop || 1;
    const s = stageInfo(stats.index | 0, stats.stage);
    const rank = RANKS[stats.rank] ? stats.rank : 'C';
    const rows = [
      { k: 'VOTOS', v: stats.score, cls: 'big' },
      { k: 'POLÍTICOS CASSADOS', v: stats.kills },
      { k: 'RASPÕES', v: stats.grazes },
      { k: 'DELAÇÕES USADAS', v: stats.bombsUsed },
      { k: 'TIROS LEVADOS', v: stats.hits },
      { k: 'TEMPO DE SESSÃO', txt: fmtTime(stats.time) },
      { sep: 'BÔNUS' + (loopN > 1 ? ' (2º MANDATO ×1,5)' : '') },
      { k: 'FICHA LIMPA', v: b.fichaLimpa, plus: 1 },
      { k: 'SEM DELAÇÃO', v: b.semDelacao, plus: 1 },
      { k: 'RASPÃO', v: b.raspao, plus: 1 },
      { k: 'APROVAÇÃO', v: b.aprovacao, plus: 1 },
      { k: 'TOTAL DE BÔNUS', v: stats.bonusTotal, plus: 1, cls: 'strong' },
      { sep: 'PIX' },
      { k: 'PIX GANHO NA FASE', v: stats.pixStage, money: 1, cls: 'strong pix' },
      { k: '(bônus da nota ' + rank + ')', v: stats.pixBonus, money: 1, cls: 'small' },
    ];
    let html = '';
    for (const r of rows) {
      if (r.sep != null) { html += '<div class="rc-sep"><span>' + esc(r.sep) + '</span></div>'; continue; }
      const val = r.txt != null ? esc(r.txt) : r.money ? 'R$ 0' : (r.plus ? '+' : '') + '0';
      html += '<div class="rc-row ' + (r.cls || '') + '"><span class="k">' + esc(r.k) + '</span><i class="dots"></i><span class="v"' +
        (r.txt == null ? ' data-v="' + Math.max(0, Math.round(+r.v || 0)) + '" data-fmt="' + (r.money ? 'm' : r.plus ? 'p' : 'n') + '"' : '') + '>' + val + '</span></div>';
    }
    const scr = open('clear');
    scr.root.innerHTML =
      '<div class="cl-wrap">' +
      '<div class="cl-printer"><span class="slot"></span><span class="led"></span><span class="pl">IMPRIMINDO BOLETIM…</span></div>' +
      '<div class="cl-paper-win scroll"><div class="rc-shadow"><div class="receipt">' +
      '<div class="rc-head"><small>JUSTIÇA ELEITORAL DO POVO</small><h2>BOLETIM DE URNA</h2>' +
      '<p>FASE ' + ((stats.index | 0) + 1) + ' · ' + esc(s.name.toUpperCase()) + (loopN > 1 ? '<br>2º MANDATO' : '') + '</p></div>' +
      html +
      '<div class="rc-stamp-area"><div class="stamp r-' + rank + '"><b>' + rank + '</b><span>' + RANKS[rank].label + '</span></div>' +
      '<p class="rc-line">' + esc(RANKS[rank].line) + '</p></div>' +
      '<div class="rc-foot"><i class="barcode"></i><span>CÓD. VERIFICAÇÃO 171-' + String(((stats.score || 0) % 9973) + 1000).slice(0, 4) + '-ZÉ</span><b>FIM</b></div>' +
      '</div></div></div>' +
      '<div class="cl-keys">' + keyHTML('confirma', 'CONTINUAR', 'CONFIRMA', 'k-next key-wide') + '</div>' +
      '</div>';
    const receipt = q(scr.root, '.receipt'), printer = q(scr.root, '.cl-printer');
    const items = qa(receipt, '.rc-row, .rc-sep');
    const counters = [];
    let phase = 'print', reveal = 0, revealT = 0, ended = false;
    const nextKey = q(scr.root, '.k-next');
    const fmtV = (el, v) => { const f = el.getAttribute('data-fmt'); el.textContent = f === 'm' ? money(v) : (f === 'p' ? '+' : '') + fmt(v); };
    const stamp = () => {
      if (phase === 'done') return;
      phase = 'done';
      items.forEach((el) => el.classList.add('on'));
      qa(receipt, '.v[data-v]').forEach((el) => fmtV(el, +el.getAttribute('data-v')));
      counters.length = 0;
      receipt.classList.add('printed');
      printer.classList.add('done');
      q(printer, '.pl').textContent = 'BOLETIM IMPRESSO';
      sfx('urna_fim');
      later(scr, reducedMotion() ? 0 : 380, () => {
        scr.root.classList.add('stamped');
        sfx('stamp');
        G.vibrate && G.vibrate(30);
        later(scr, 260, () => { scr.root.classList.add('ready'); focusEl(nextKey); });
      });
    };
    const finish = () => { if (ended || !scr.root.classList.contains('ready')) return; ended = true; close(); fin(); };
    onTap(nextKey, finish);
    scr.root.addEventListener('click', () => {
      if (performance.now() - scr.born < 450) return;
      if (phase !== 'done') stamp();
      else if (scr.root.classList.contains('ready')) { sfx('ui_confirm'); finish(); }
    });
    scr.onKey = (e, k) => {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); if (phase !== 'done') stamp(); else if (scr.root.classList.contains('ready')) { sfx('ui_confirm'); finish(); } }
    };
    if (reducedMotion()) { later(scr, 50, stamp); return; }
    // impressão: papel sai da fenda, linhas aparecem uma a uma e os números sobem
    later(scr, 650, () => { phase = 'rows'; });
    loop(scr, (dt) => {
      if (phase === 'rows') {
        revealT -= dt;
        if (revealT <= 0 && reveal < items.length) {
          const el = items[reveal++];
          el.classList.add('on');
          const v = el.querySelector('.v[data-v]');
          if (v) counters.push({ el: v, to: +v.getAttribute('data-v'), t: 0 });
          sfx('ui_type');
          revealT = el.classList.contains('rc-sep') ? 0.08 : 0.13;
          // mantém a linha nova à vista em telas baixas
          const win = q(scr.root, '.cl-paper-win');
          const bottom = el.offsetTop + el.offsetHeight + 40 - win.clientHeight;
          if (bottom > win.scrollTop) win.scrollTop = bottom;
        }
        if (reveal >= items.length && !counters.length) { phase = 'wait'; later(scr, 200, stamp); }
      }
      for (let n = counters.length - 1; n >= 0; n--) {
        const c = counters[n];
        c.t += dt / 0.45;
        const k = Math.min(1, c.t);
        fmtV(c.el, c.to * (1 - Math.pow(1 - k, 3)));
        if (k >= 1) counters.splice(n, 1);
      }
      return phase !== 'done';
    });
  }

  // ==================================================================
  // LOJINHA DO ZÉ
  // ==================================================================
  function showShop(opts, done) {
    opts = opts || {};
    const fin = once(done);
    const fromRun = !!opts.fromRun;
    const nextInfo = fromRun && opts.next != null ? stageInfo(opts.next) : null;
    let rows = '';
    for (const u of G.UPGRADES || []) {
      rows +=
        '<div class="up" data-id="' + esc(u.id) + '">' +
        '<span class="up-ico"><canvas aria-hidden="true"></canvas></span>' +
        '<span class="up-info"><b class="up-name">' + esc(u.name) + '</b><span class="up-desc">' + esc(u.desc) + '</span>' +
        '<span class="up-pips">' + u.costs.map(() => '<i></i>').join('') + '</span></span>' +
        '<button type="button" class="key key-confirma key-buy"><small class="ks"></small><span class="kl"></span></button>' +
        '</div>';
    }
    const scr = pageShell('shop', {
      kicker: fromRun ? 'PARADA NA ESTRADA' : 'MELHORIAS PERMANENTES',
      title: 'LOJINHA<br>DO ZÉ',
      right: '<div class="saldo">' + PIX_ICO + '<span><small>SALDO</small><b class="saldo-v">' + money(G.save.pix) + '</b></span></div>',
      body: '<p class="quip"><b>Zé:</b> <span class="quip-t">' + esc(pick(SHOP_QUIPS)) + '</span></p><div class="up-list">' + rows + '</div>',
      foot: fromRun
        ? lcdFoot('SEGUIR VIAGEM', '') + (nextInfo ? '<span class="foot-msg">Próxima parada: <b>' + esc(nextInfo.name) + '</b></span>' : '')
        : lcdFoot('COMPRAR', 'VOLTAR'),
      keys: fromRun ? keyHTML('confirma', 'SEGUIR VIAGEM', 'CONFIRMA', 'k-go key-wide') : backKey(),
      cls: fromRun ? 'from-run' : '',
    });
    const saldo = q(scr.root, '.saldo-v'), quip = q(scr.root, '.quip-t');
    let shownPix = G.save.pix;
    const refresh = () => {
      for (const row of qa(scr.root, '.up')) {
        const id = row.getAttribute('data-id');
        const lv = G.upg(id), cost = G.upgradeCost(id);
        qa(row, '.up-pips i').forEach((p, j) => p.classList.toggle('on', j < lv));
        const btn = q(row, '.key-buy');
        const maxed = cost == null, broke = !maxed && G.save.pix < cost;
        row.classList.toggle('maxed', maxed);
        btn.classList.toggle('off', maxed || broke);
        btn.classList.toggle('broke', broke);
        btn.disabled = maxed;
        q(btn, '.ks').textContent = maxed ? 'NO MÁXIMO' : broke ? 'FALTA ' + money(cost - G.save.pix) : 'COMPRAR';
        q(btn, '.kl').textContent = maxed ? 'COMPLETO' : money(cost);
        btn.setAttribute('aria-label', maxed ? u0(id) + ': completo' : 'Comprar ' + u0(id) + ' por ' + money(cost));
      }
    };
    const u0 = (id) => { const u = (G.UPGRADES || []).find((x) => x.id === id); return u ? u.name : id; };
    const tweenPix = () => {
      const from = shownPix, to = G.save.pix;
      shownPix = to;
      let t = 0;
      saldo.parentNode.parentNode.classList.remove('bump'); void saldo.offsetWidth; saldo.parentNode.parentNode.classList.add('bump');
      loop(scr, (dt) => { t = Math.min(1, t + dt / 0.5); saldo.textContent = money(from + (to - from) * (1 - Math.pow(1 - t, 3))); return t < 1; });
    };
    qa(scr.root, '.up').forEach((row) => {
      const id = row.getAttribute('data-id'), btn = q(row, '.key-buy');
      onTap(btn, () => {
        const cost = G.upgradeCost(id);
        if (cost == null) return;
        if (G.save.pix < cost) {
          sfx('denied');
          row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
          quip.textContent = pick(BROKE_QUIPS);
          return;
        }
        if (G.buyUpgrade(id)) { // core toca o som 'buy'
          row.classList.remove('bought'); void row.offsetWidth; row.classList.add('bought');
          const fl = document.createElement('span');
          fl.className = 'float-cost'; fl.textContent = '−' + money(cost);
          row.appendChild(fl);
          later(scr, 900, () => fl.remove());
          quip.textContent = pick(BUY_QUIPS);
          tweenPix();
          refresh();
          const lv = G.upg(id);
          const pip = qa(row, '.up-pips i')[lv - 1];
          if (pip) { pip.classList.remove('pop'); void pip.offsetWidth; pip.classList.add('pop'); }
        }
      }, false);
    });
    refresh();
    const leave = () => { close(); fin(); };
    if (fromRun) onTap(q(scr.root, '.k-go'), leave);
    else onTap(q(scr.root, '.k-back'), leave);
    scr.onKey = (e, k) => {
      if (fromRun && (k === 'Enter')) { e.preventDefault(); sfx('ui_confirm'); leave(); }
      if (!fromRun && (k === 'Escape' || k === 'Backspace')) { sfx('ui_back'); leave(); }
    };
    focusEl(q(scr.root, fromRun ? '.k-go' : '.key-buy:not(.off)') || q(scr.root, '.k-back'));
    // ícones animados (itens do jogo)
    const icons = qa(scr.root, '.up').map((row) => ({ cv: q(row, 'canvas'), ic: UPGRADE_ICON[row.getAttribute('data-id')] || ['pix'] }));
    loop(scr, (dt, t) => {
      for (const it of icons) {
        const f = fitCanvas(it.cv);
        f.ctx.clearRect(0, 0, f.w, f.h);
        const k = f.w / (it.ic[0] === 'power' ? 46 : 34);
        f.ctx.save(); f.ctx.translate(f.w / 2, f.h / 2); f.ctx.scale(k, k);
        G.call(G.Art, 'pickup', f.ctx, it.ic[0], 0, 0, t, it.ic[1] ? { wtype: it.ic[1] } : {});
        f.ctx.restore();
      }
    });
  }

  // ==================================================================
  // GAME OVER
  // ==================================================================
  function showGameOver(info, h) {
    info = info || {};
    h = h || {};
    let used = false;
    const choose = (fn, where) => { if (used) return; used = true; close(); G.safe(fn, where); };
    const scr = open('over');
    const left = Math.max(0, info.continuesLeft | 0);
    const record = info.score > 0 && info.score >= (info.best || 0);
    scr.root.innerHTML =
      '<div class="go-wrap">' +
      '<div class="go-title" aria-label="Derrotado nas urnas"><span>DERROTADO</span><span>NAS URNAS</span></div>' +
      '<p class="go-joke">' + esc(pick(OVER_JOKES)) + '</p>' +
      '<div class="urna urna-compact">' + BRAND +
      '<div class="bezel"><div class="lcd lcd-stats">' +
      '<div class="lrow big"><span>VOTOS</span><b>' + fmt(info.score) + '</b></div>' +
      '<div class="lrow"><span>RECORDE</span><b>' + fmt(info.best) + (record ? ' <em class="new">NOVO!</em>' : '') + '</b></div>' +
      '<div class="lrow pix"><span>PIX NA CONTA</span><b>' + money(info.pix) + '</b></div>' +
      '<small class="lnote">Seu Pix ficou guardado. Gaste na Lojinha do Zé.</small>' +
      '</div></div>' +
      '<div class="go-keys">' +
      (left > 0
        ? '<button type="button" class="key key-confirma key-wide k-cont"><span class="kl">PEDIR RECONTAGEM</span><b class="kbadge">' + left + '</b><small class="ks">CONFIRMA</small></button>' +
          '<p class="go-explain">Continua daqui, com vidas e delações cheias. <b>O placar volta a zero.</b></p>'
        : '<p class="go-explain">Acabaram os pedidos de recontagem. A urna é soberana.</p>') +
      keyHTML('corrige', 'VOLTAR AO MENU', 'CORRIGE', 'key-wide k-quit') +
      '</div></div></div>';
    const cont = q(scr.root, '.k-cont'), quit = q(scr.root, '.k-quit');
    onTap(cont, () => choose(h.onContinue, 'ui.gameOver.onContinue'));
    onTap(quit, () => choose(h.onQuit, 'ui.gameOver.onQuit'));
    // trava curta: o dedo ainda estava pilotando quando o Fusca caiu
    scr.root.classList.add('arming');
    later(scr, 600, () => { scr.root.classList.remove('arming'); focusEl(cont || quit); });
    scr.onKey = (e, k) => {
      if (scr.root.classList.contains('arming')) return;
      if (k === 'Enter' && cont) { sfx('ui_confirm'); choose(h.onContinue, 'ui.gameOver.onContinue'); }
      if (k === 'Escape' || k === 'Backspace') { sfx('ui_back'); choose(h.onQuit, 'ui.gameOver.onQuit'); }
    };
  }

  // ==================================================================
  // AJUSTES (toggles + sensibilidade) — usados na pausa e no menu
  // ==================================================================
  function togHTML(key, label, hint) {
    const on = !!settings()[key];
    return '<div class="set-row"><div class="set-lbl"><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</div>' +
      '<button type="button" class="tog' + (on ? ' on' : '') + '" data-set="' + key + '" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '">' +
      '<span class="tog-t">' + (on ? 'SIM' : 'NÃO') + '</span><span class="tog-k"></span></button></div>';
  }
  const fmtSens = (v) => (+v).toFixed(2).replace('.', ',') + '×';
  function sensHTML() {
    const v = clamp(+settings().sens || 1.25, 0.8, 2);
    return '<div class="set-row set-col"><div class="set-lbl"><b>SENSIBILIDADE DO TOQUE</b><small>Quanto o Fusca anda para cada movimento do dedo</small></div>' +
      '<div class="sens"><span class="sens-end">0,8×</span><input type="range" min="0.8" max="2" step="0.05" value="' + v + '" aria-label="Sensibilidade do toque">' +
      '<output>' + fmtSens(v) + '</output></div></div>';
  }
  function bindSettings(root) {
    qa(root, '.tog').forEach((b) => onTap(b, () => {
      const k = b.getAttribute('data-set');
      const v = !settings()[k];
      settings()[k] = v;
      if (k === 'music') G.call(G.Audio, 'setMusicOn', v);
      if (k === 'sfx') G.call(G.Audio, 'setSfxOn', v);
      if (k === 'vibrate' && v && G.vibrate) G.vibrate(40);
      G.saveGame();
      b.classList.toggle('on', v);
      b.setAttribute('aria-checked', String(v));
      q(b, '.tog-t').textContent = v ? 'SIM' : 'NÃO';
      sfx('ui_click');
    }, false));
    const r = q(root, '.sens input'), out = q(root, '.sens output');
    if (r) {
      const paintFill = () => r.style.setProperty('--p', ((r.value - 0.8) / 1.2 * 100).toFixed(1) + '%');
      paintFill();
      let lastV = r.value;
      r.addEventListener('input', () => {
        settings().sens = clamp(+r.value, 0.8, 2);
        out.textContent = fmtSens(r.value);
        paintFill();
        if (r.value !== lastV) { lastV = r.value; sfx('ui_type'); }
      });
      r.addEventListener('change', () => { G.saveGame(); });
      // o slider não deve virar "toque para avançar"
      r.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  // ==================================================================
  // PAUSA — "SESSÃO SUSPENSA"
  // ==================================================================
  function showPause(h) {
    h = h || {};
    let used = false;
    const choose = (fn, where) => { if (used) return; used = true; close(); G.safe(fn, where); };
    const scr = open('pause');
    const g = G.game, run = G.run;
    const where = g && g.stage ? 'FASE ' + ((g.stageIdx | 0) + 1) + ' · ' + esc(stageInfo(g.stageIdx | 0, g.stage).name) : '';
    scr.root.innerHTML =
      '<div class="pz-wrap"><div class="urna urna-compact">' + BRAND +
      '<div class="bezel"><div class="lcd">' +
      '<div class="lcd-head"><div class="lcd-titles"><small>' + where + '</small><h2>SESSÃO SUSPENSA</h2></div>' +
      '<div class="lcd-right"><span class="lcd-chip">' + (run ? fmt(run.score) : '0') + ' VOTOS</span></div></div>' +
      '<div class="lcd-body"><p class="pz-joke">' + esc(pick(PAUSE_JOKES)) + '</p>' +
      '<div class="pz-togs">' + togHTML('music', 'MÚSICA') + togHTML('sfx', 'EFEITOS') + togHTML('vibrate', 'VIBRAÇÃO') + '</div>' +
      sensHTML() + '</div>' +
      '</div></div>' +
      '<div class="pz-keys">' +
      keyHTML('confirma', 'CONTINUAR', 'CONFIRMA', 'key-wide k-res') +
      '<div class="pz-quit">' + keyHTML('corrige', 'SAIR DA PARTIDA', 'CORRIGE', 'key-wide k-quit') + '</div>' +
      '<div class="pz-confirm" hidden><p>Sair da partida? <b>O Pix desta fase fica guardado</b>, mas o placar se perde.</p>' +
      '<div class="row">' + keyHTML('branco', 'FICAR', '', 'k-no') + keyHTML('corrige', 'SIM, SAIR', '', 'k-yes') + '</div></div>' +
      '</div></div></div>';
    bindSettings(scr.root);
    const conf = q(scr.root, '.pz-confirm'), quitRow = q(scr.root, '.pz-quit');
    onTap(q(scr.root, '.k-res'), () => choose(h.onResume, 'ui.pause.onResume'));
    onTap(q(scr.root, '.k-quit'), () => { quitRow.hidden = true; conf.hidden = false; focusEl(q(conf, '.k-no')); });
    onTap(q(scr.root, '.k-no'), () => { conf.hidden = true; quitRow.hidden = false; focusEl(q(scr.root, '.k-quit')); });
    onTap(q(scr.root, '.k-yes'), () => choose(h.onQuit, 'ui.pause.onQuit'));
    // Esc/P: o core já chama G.resume() → hidePause()
    scr.onKey = (e, k) => { if (k === 'Enter') { sfx('ui_confirm'); choose(h.onResume, 'ui.pause.onResume'); } };
    focusEl(q(scr.root, '.k-res'));
  }

  // ==================================================================
  // FINAL + CRÉDITOS
  // ==================================================================
  function showEnding(info, done) {
    info = info || {};
    const fin = once(done);
    storyScreen((G.STORY && G.STORY.ending) || [], { cls: 'ending' }, () => creditsRoll(info, fin));
  }
  function creditsHTML(roll) {
    const lines = (G.CREDITS || []).slice();
    const title = lines.shift() || 'FUSCA A JATO';
    let h = '<div class="cr-title">' + esc(title) + '</div>';
    h += '<div class="cr-sec">ELENCO</div>';
    for (const [n, r] of CAST_CREDITS) h += '<div class="cr-cast"><b>' + esc(n) + '</b><span>' + esc(r) + '</span></div>';
    h += '<div class="cr-sec">PARTICIPAÇÃO ESPECIAL</div><div class="cr-cast"><b>O seu imposto</b><span>financiando tudo isso</span></div>';
    h += '<div class="cr-sec">AVISO</div>';
    for (const l of lines) h += '<p class="cr-line">' + esc(l) + '</p>';
    if (roll) h += '<div class="cr-171">Nº 171</div>';
    return h;
  }
  function creditsRoll(info, fin) {
    const scr = open('roll');
    const loopN = info.loop || 1;
    scr.root.innerHTML =
      '<canvas class="roll-bg" aria-hidden="true"></canvas>' +
      '<div class="roll-win"><div class="roll">' + creditsHTML(true) + '</div></div>' +
      keyHTML('branco', 'PULAR', '', 'key-sm roll-skip') +
      '<div class="fin" hidden>' +
      '<div class="bezel fin-bezel"><div class="lcd fin-lcd"><b class="fim">FIM</b></div></div>' +
      '<div class="fin-title">' + (loopN > 1 ? 'REELEITO!' : '2º MANDATO<br>DESBLOQUEADO') + '</div>' +
      '<p class="fin-sub">' + (loopN > 1 ? 'Você venceu o 2º Mandato. Brasília nunca mais será a mesma. (Mentira.)' : 'Mais difícil, mais Pix. Já está no menu, esperando seu voto.') + '</p>' +
      '<div class="fin-score"><span>VOTOS FINAIS</span><b>' + fmt(info.score) + '</b><small>RECORDE ' + fmt(Math.max(info.best || 0, info.score || 0)) + '</small></div>' +
      keyHTML('confirma', 'VOLTAR AO MENU', 'CONFIRMA', 'key-wide k-menu') +
      '</div>';
    const roll = q(scr.root, '.roll'), finEl = q(scr.root, '.fin'), win = q(scr.root, '.roll-win');
    let shown = false, ended = false, y = -1;
    const showFinal = () => {
      if (shown) return;
      shown = true;
      win.classList.add('gone');
      q(scr.root, '.roll-skip').hidden = true;
      finEl.hidden = false;
      later(scr, 150, () => sfx('urna_fim'));
      later(scr, 700, () => focusEl(q(scr.root, '.k-menu')));
    };
    const finish = () => { if (ended) return; ended = true; close(); fin(); };
    onTap(q(scr.root, '.roll-skip'), showFinal);
    onTap(q(scr.root, '.k-menu'), finish);
    scr.root.addEventListener('click', () => { if (!shown && performance.now() - scr.born > 400) showFinal(); });
    scr.onKey = (e, k) => {
      if (k === 'Enter' || k === ' ' || k === 'Escape') { e.preventDefault(); if (!shown) showFinal(); else if (k !== 'Escape') { sfx('ui_confirm'); finish(); } }
    };
    if (reducedMotion()) showFinal();
    // fundo: chuva de santinhos e notas
    const cv = q(scr.root, '.roll-bg');
    const bits = [];
    for (let i = 0; i < 26; i++) bits.push({ x: Math.random(), y: Math.random(), s: 10 + Math.random() * 14, v: 30 + Math.random() * 40, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 3, c: ['#e63946', '#1b3fa0', '#00a651', '#8e5cf7', '#ffd23f'][i % 5], bill: i % 4 === 0 });
    loop(scr, (dt, t) => {
      const f = fitCanvas(cv);
      const c = f.ctx;
      const g = c.createLinearGradient(0, 0, 0, f.h);
      g.addColorStop(0, '#0b1022'); g.addColorStop(1, '#1b2a5c');
      c.fillStyle = g; c.fillRect(0, 0, f.w, f.h);
      for (const b of bits) {
        b.y += (b.v * dt) / f.h; b.r += b.vr * dt;
        if (b.y > 1.1) { b.y = -0.1; b.x = Math.random(); }
        const x = b.x * f.w + Math.sin(t + b.r) * 10, yy = b.y * f.h;
        c.globalAlpha = shown ? 0.28 : 0.55;
        if (b.bill && G.Art.bill) G.call(G.Art, 'bill', c, x, yy, b.s * 1.4, b.r, Math.cos(t * 3 + b.r));
        else if (G.Art.santinho) G.call(G.Art, 'santinho', c, x, yy, b.s, b.r, b.c, Math.cos(t * 3 + b.r));
        else { c.fillStyle = b.c; c.fillRect(x - 4, yy - 6, 8, 12); }
      }
      c.globalAlpha = 1;
      if (!shown) {
        if (y < 0) y = win.clientHeight * 0.4;
        y += dt * 52;
        const total = roll.offsetHeight + win.clientHeight;
        roll.style.transform = 'translateY(' + (win.clientHeight - y).toFixed(1) + 'px)';
        if (y > total) showFinal();
      }
    });
  }

  // ==================================================================
  // PÁGINAS DO MENU: AJUSTES, CONQUISTAS, COMO JOGAR, CRÉDITOS
  // ==================================================================
  function showSettings() {
    const scr = pageShell('settings', {
      kicker: 'PAINEL DE CONTROLE', title: 'AJUSTES',
      body:
        '<div class="set-list">' +
        togHTML('music', 'MÚSICA', 'Trilha de campanha') +
        togHTML('sfx', 'EFEITOS SONOROS', 'Tiros, bipes da urna, panelaço') +
        togHTML('vibrate', 'VIBRAÇÃO', 'Treme o celular quando você apanha') +
        togHTML('shake', 'TREMOR DE TELA', 'Explosões sacodem a tela') +
        togHTML('hitbox', 'MOSTRAR PONTO BRANCO', 'O único ponto vulnerável do Fusca') +
        sensHTML() +
        '<div class="set-danger">' +
        '<button type="button" class="key key-danger k-wipe"><span class="kl">APAGAR PROGRESSO</span></button>' +
        '<div class="wipe-confirm" hidden><p><b>Tem certeza?</b> Some tudo: Pix, melhorias, fases liberadas, recorde e conquistas. Não tem recontagem.</p>' +
        '<div class="row">' + keyHTML('branco', 'NÃO', '', 'k-no') + '<button type="button" class="key key-danger k-yes"><span class="kl">SIM, APAGAR</span></button></div></div>' +
        '</div></div>',
      foot: lcdFoot('', 'VOLTAR') + '<span class="foot-msg">Tudo é salvo na hora.</span>',
      keys: backKey(),
    });
    bindSettings(scr.root);
    const wipe = q(scr.root, '.k-wipe'), conf = q(scr.root, '.wipe-confirm');
    onTap(wipe, () => { wipe.hidden = true; conf.hidden = false; focusEl(q(conf, '.k-no')); });
    onTap(q(scr.root, '.k-no'), () => { conf.hidden = true; wipe.hidden = false; });
    onTap(q(scr.root, '.k-yes'), () => {
      G.resetSave();
      G.call(G.Audio, 'setMusicOn', G.save.settings.music);
      G.call(G.Audio, 'setSfxOn', G.save.settings.sfx);
      UI.toast({ title: 'Progresso apagado', text: 'Ficha limpa. Literalmente.', kind: 'info' });
      showSettings();
    }, 'ui_back');
    onTap(q(scr.root, '.k-back'), () => showTitle(true));
    scr.onKey = (e, k) => { if (k === 'Escape' || k === 'Backspace') { sfx('ui_back'); showTitle(true); } };
  }

  function showAchievements() {
    const ac = achCount();
    let list = '';
    for (const a of G.ACHIEVEMENTS || []) {
      const got = !!G.save.achievements[a.id];
      let prog = '';
      if (!got && a.counter && a.goal) {
        const v = Math.min(a.goal, G.save.counters[a.counter] || 0);
        prog = '<span class="ach-bar"><i style="width:' + ((v / a.goal) * 100).toFixed(1) + '%"></i></span><span class="ach-num">' + fmt(v) + ' / ' + fmt(a.goal) + '</span>';
      }
      list += '<div class="ach' + (got ? ' got' : '') + '"><i class="seal" aria-hidden="true"></i><span class="ach-txt"><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + '</small>' + prog + '</span>' +
        (got ? '<em class="ach-ok">ELEITA</em>' : '') + '</div>';
    }
    const scr = pageShell('ach', {
      kicker: 'APURAÇÃO', title: 'CONQUISTAS',
      right: '<span class="lcd-chip">' + ac.got + '/' + ac.total + '</span>',
      body: '<div class="ach-top"><span class="ach-bar big"><i style="width:' + (ac.total ? (ac.got / ac.total) * 100 : 0).toFixed(1) + '%"></i></span><small>' + (ac.got === ac.total ? 'Apuração encerrada: você levou todas!' : Math.round(ac.total ? (ac.got / ac.total) * 100 : 0) + '% das urnas apuradas') + '</small></div><div class="ach-list">' + list + '</div>',
      foot: lcdFoot('', 'VOLTAR'),
      keys: backKey(),
    });
    onTap(q(scr.root, '.k-back'), () => showTitle(true));
    scr.onKey = (e, k) => { if (k === 'Escape' || k === 'Backspace') { sfx('ui_back'); showTitle(true); } };
  }

  // Cartões ilustrados do "Como jogar"
  const HOWTO = [
    { t: 'ARRASTE EM QUALQUER LUGAR', d: 'O Fusca segue o <b>movimento</b> do dedo, sem ficar embaixo dele. Dá pra pilotar com o dedão lá embaixo.', draw: 'drag' },
    { t: 'TIRO AUTOMÁTICO', d: 'O Fusca atira sozinho. Sua única preocupação é desviar.', draw: 'fire' },
    { t: 'SÓ O PONTO BRANCO CONTA', d: 'O <b>ponto branco</b> no meio do Fusca é o único ponto vulnerável. O resto é lataria: o tiro passa.', draw: 'hitbox' },
    { t: 'RASPÃO DÁ VOTO', d: 'Passar <b>raspando</b> nos tiros dá pontos e carrega a Delação Premiada. Cheio = delação de graça.', draw: 'graze' },
    { t: 'O ITEM P MUDA DE COR', d: 'Ele troca de arma a cada instante. Pegue na <b>cor da arma que você quer</b>. Mesma cor: sobe o nível.', draw: 'power', weapons: true },
    { t: 'DELAÇÃO PREMIADA', d: 'O botão redondo: todo mundo entrega todo mundo e a <b>tela fica limpa</b>. Use quando apertar.', draw: 'bomb' },
    { t: 'APROVAÇÃO', d: 'Derrube políticos sem parar e a aprovação sobe, <b>multiplicando os votos</b> (até ×5). Levar tiro derruba ela.', draw: 'approval' },
    { t: 'PIX E LOJINHA', d: 'Político derrubado solta <b>Pix</b>. Junte e gaste em melhorias permanentes na Lojinha do Zé.', draw: 'pix' },
    { t: 'O LEÃO DA RECEITA', d: 'Ele dá o bote no Fusca e <b>morde parte do seu Pix</b>. Fique de olho na linha laranja e derrube-o antes.', draw: 'leao' },
  ];
  const HOWTO_DRAW = {
    drag(c, w, h, t) {
      tileBG(c, w, h);
      const fx = w / 2 + Math.sin(t * 1.7) * w * 0.28;
      const fy = h * 0.27 + Math.cos(t * 1.1) * 3;
      const px = fx, py = h * 0.83 + Math.cos(t * 1.1) * 3;
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.setLineDash([3, 4]); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(fx, fy + 16); c.lineTo(px, py - 9); c.stroke(); c.setLineDash([]);
      drawPlayer(c, fx, fy, 0.78, { t, tilt: Math.cos(t * 1.7), weapon: 'voto', level: 1 });
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(px, py, 11 + Math.sin(t * 5) * 1.5, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(px, py, 6, 0, TAU); c.fill();
      c.fillStyle = '#ffd23f';
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(px + sd * 17, py); c.lineTo(px + sd * 12, py - 4); c.lineTo(px + sd * 12, py + 4); c.closePath(); c.fill(); }
    },
    fire(c, w, h, t) {
      tileBG(c, w, h);
      const tx = w / 2 + Math.sin(t * 0.9) * 10;
      const hit = (t * 3) % 1 < 0.1;
      G.call(G.Art, 'person', c, tx, h * 0.24, 30, { suit: '#5b2a86', tie: '#ffd23f', hair: 'side', hairColor: '#3b2a1a' }, { t, flash: hit, mood: hit ? 'hurt' : 'normal' });
      c.fillStyle = '#3ddc84';
      for (let i = 0; i < 6; i++) {
        const y = h * 0.66 - ((t * 150 + i * 16) % (h * 0.5));
        c.fillRect(w / 2 - 6, y, 3, 8); c.fillRect(w / 2 + 3, y, 3, 8);
      }
      drawPlayer(c, w / 2, h * 0.78, 0.95, { t, weapon: 'voto', level: 2 });
    },
    hitbox(c, w, h, t) {
      tileBG(c, w, h);
      const cx = w / 2, cy = h * 0.55;
      drawPlayer(c, cx, cy, 1.45, { t, weapon: 'voto', level: 1 });
      hitDot(c, cx, cy, t, true);
      const ph = (t * 0.6) % 1;
      drawBullet(c, 'orb', '#ff5d8f', -10 + ph * (w + 20), cy - 13, 1);
      drawBullet(c, 'orb', '#ff5d8f', w + 10 - ((ph + 0.5) % 1) * (w + 20), cy + 15, 1);
    },
    graze(c, w, h, t) {
      tileBG(c, w, h);
      const cx = w / 2, cy = h * 0.58;
      drawPlayer(c, cx, cy, 1.0, { t, weapon: 'voto', level: 1 });
      hitDot(c, cx, cy, t);
      const ph = (t * 0.7) % 1, by = -10 + ph * (h + 20), bx = cx + 12;
      const near = Math.abs(by - cy) < 16;
      if (near) {
        c.strokeStyle = '#ffd23f'; c.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) { const a = t * 20 + i * 1.6; c.beginPath(); c.moveTo(bx - 4, by); c.lineTo(bx - 4 + Math.cos(a) * 7, by + Math.sin(a) * 7); c.stroke(); }
        c.fillStyle = '#ffd23f'; c.font = '9px ' + G.FONT_DISPLAY; c.textAlign = 'center'; c.fillText('RASPÃO!', cx, h * 0.24);
      }
      drawBullet(c, 'needle', '#ff8c1a', bx, by, 0.9);
      const fill = (t * 0.25) % 1;
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(8, h - 10, w - 16, 4);
      c.fillStyle = '#ffd23f'; c.fillRect(8, h - 10, (w - 16) * fill, 4);
    },
    power(c, w, h, t) {
      tileBG(c, w, h);
      const order = G.WEAPON_ORDER || ['voto', 'boca', 'panela', 'jato'];
      const wt = order[Math.floor(t / 1.1) % order.length];
      // o próprio item já mostra o nome curto da arma embaixo
      c.save(); c.translate(w / 2, h * 0.44); c.scale(1.45, 1.45);
      G.call(G.Art, 'pickup', c, 'power', 0, 0, t, { wtype: wt });
      c.restore();
    },
    bomb(c, w, h, t) {
      tileBG(c, w, h);
      const ph = (t * 0.55) % 1, cx = w / 2, cy = h / 2;
      const R = ph * w * 0.75;
      for (let i = 0; i < 12; i++) {
        const a = i * (TAU / 12) + 0.3, rr = 22 + (i % 3) * 9;
        if (rr > R) drawBullet(c, 'small', '#ff5d8f', cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr * 0.8, 1);
      }
      c.strokeStyle = 'rgba(255,210,63,' + (1 - ph) + ')'; c.lineWidth = 4;
      c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
      G.call(G.Art, 'bombIcon', c, cx, cy, 26);
    },
    approval(c, w, h, t) {
      tileBG(c, w, h);
      const ph = (t * 0.22) % 1, ap = Math.min(1, ph * 1.25);
      const mult = 1 + ap * 4;
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(10, h * 0.66, w - 20, 7);
      const g = c.createLinearGradient(10, 0, w - 10, 0); g.addColorStop(0, '#3ddc84'); g.addColorStop(1, '#ffd23f');
      c.fillStyle = g; c.fillRect(10, h * 0.66, (w - 20) * ap, 7);
      c.fillStyle = '#fff'; c.font = '20px ' + G.FONT_DISPLAY; c.textAlign = 'center';
      c.fillText('×' + mult.toFixed(1).replace('.', ','), w / 2, h * 0.5);
      c.font = '8px ' + G.FONT_DISPLAY; c.fillStyle = '#ffd23f'; c.fillText('APROVAÇÃO', w / 2, h * 0.88);
    },
    pix(c, w, h, t) {
      tileBG(c, w, h);
      const px = w / 2, py = h * 0.78;
      drawPlayer(c, px, py, 0.9, { t, weapon: 'voto', level: 1 });
      for (let i = 0; i < 6; i++) {
        const ph = (t * 0.6 + i / 6) % 1;
        const sx = w * (0.12 + (i % 3) * 0.38), sy = h * 0.12;
        const x = sx + (px - sx) * ph * ph, y = sy + (py - sy) * ph;
        G.call(G.Art, 'pickup', c, i % 3 ? 'pix' : 'pix5', x, y, t + i, {});
      }
    },
    leao(c, w, h, t) {
      tileBG(c, w, h);
      const ph = (t * 0.5) % 1;
      const lx = w / 2 + Math.sin(t * 1.3) * 18, ly = h * 0.38 + (ph > 0.6 ? (ph - 0.6) * 60 : 0);
      if (ph > 0.3 && ph < 0.6) {
        c.strokeStyle = 'rgba(255,140,26,0.8)'; c.setLineDash([5, 4]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(w / 2, h * 0.88); c.stroke(); c.setLineDash([]);
      }
      drawLeao(c, lx, ly, t, 1.05);
      c.fillStyle = '#ff8c1a'; c.font = '10px ' + G.FONT_DISPLAY; c.textAlign = 'center';
      if (ph > 0.75) c.fillText('NHAC! −15%', w / 2, h * 0.92);
    },
  };
  function showHowTo() {
    let cards = '';
    HOWTO.forEach((it, i) => {
      cards += '<div class="how' + (i % 2 ? ' alt' : '') + '"><span class="how-cv"><canvas data-draw="' + it.draw + '" aria-hidden="true"></canvas></span>' +
        '<span class="how-txt"><b><i>' + (i + 1) + '</i>' + it.t + '</b><small>' + it.d + '</small></span>' +
        (it.weapons ? '<span class="how-weap">' + (G.WEAPON_ORDER || []).map((w) => '<span><canvas data-weapon="' + w + '"></canvas><em style="color:' + (G.WEAPONS[w] || {}).color + '">' + esc((G.WEAPONS[w] || {}).name || w) + '</em></span>').join('') + '</span>' : '') +
        '</div>';
    });
    const scr = pageShell('howto', {
      kicker: 'MANUAL DO ELEITOR', title: 'COMO JOGAR',
      body: '<div class="how-list">' + cards + '</div>',
      foot: lcdFoot('', 'VOLTAR') + '<span class="foot-msg">Difícil? É Brasília. Mas dá pra vencer.</span>',
      keys: backKey(),
    });
    onTap(q(scr.root, '.k-back'), () => showTitle(true));
    scr.onKey = (e, k) => { if (k === 'Escape' || k === 'Backspace') { sfx('ui_back'); showTitle(true); } };
    const body = q(scr.root, '.lcd-body');
    const canv = qa(scr.root, 'canvas[data-draw]');
    // ícones das armas (estáticos)
    const paintWeapons = () => qa(scr.root, 'canvas[data-weapon]').forEach((cv) => {
      const f = fitCanvas(cv);
      f.ctx.clearRect(0, 0, f.w, f.h);
      G.call(G.Art, 'weaponIcon', f.ctx, cv.getAttribute('data-weapon'), f.w / 2, f.h / 2, f.w * 0.9);
    });
    requestAnimationFrame(() => { if (scr.alive) G.safe(paintWeapons, 'ui.howto.weapons'); });
    onResize(scr, paintWeapons);
    loop(scr, (dt, t) => {
      const br = body.getBoundingClientRect();
      for (const cv of canv) {
        const r = cv.getBoundingClientRect();
        if (r.bottom < br.top || r.top > br.bottom) continue; // fora da vista
        const f = fitCanvas(cv);
        f.ctx.clearRect(0, 0, f.w, f.h);
        f.ctx.save();
        f.ctx.scale(f.w / 96, f.w / 96); // desenhos pensados para 96 px de largura
        HOWTO_DRAW[cv.getAttribute('data-draw')](f.ctx, 96, f.h * (96 / f.w), t);
        f.ctx.restore();
      }
    });
  }

  function showCredits() {
    const scr = pageShell('credits', {
      kicker: 'FICHA TÉCNICA', title: 'CRÉDITOS',
      body: '<div class="cr-page">' + creditsHTML(false) + '</div>',
      foot: lcdFoot('', 'VOLTAR'),
      keys: backKey(),
    });
    onTap(q(scr.root, '.k-back'), () => showTitle(true));
    scr.onKey = (e, k) => { if (k === 'Escape' || k === 'Backspace') { sfx('ui_back'); showTitle(true); } };
  }

  // ==================================================================
  // TOASTS (conquistas)
  // ==================================================================
  function showToast(o) {
    o = o || {};
    const host = document.getElementById('toasts');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast kind-' + (o.kind || 'info');
    t.setAttribute('role', 'status');
    t.innerHTML = '<i class="toast-ico" aria-hidden="true"></i><span class="toast-txt"><small>' + esc(o.title || '') + '</small><b>' + esc(o.text || '') + '</b></span>';
    host.appendChild(t);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    setTimeout(() => t.classList.add('out'), 2900);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 3400);
  }

  // ==================================================================
  // API pública (o core chama estas funções)
  // ==================================================================
  const UI = {
    __tag: 'ui',
    title() { showTitle(false); },
    story(panels, done) { storyScreen(panels, null, done); },
    stageIntro(info, done) { showStageIntro(info, done); },
    dialogue(lines, done) { showDialogue(lines, done); },
    stageClear(stats, done) { showStageClear(stats, done); },
    shop(opts, done) { showShop(opts, done); },
    gameOver(info, handlers) { showGameOver(info, handlers); },
    pause(handlers) { showPause(handlers); },
    hidePause() { if (cur && cur.kind === 'pause') close(); },
    ending(info, done) { showEnding(info, done); },
    toast(o) { showToast(o); },
    // extras (debug/integração)
    close() { close(); },
    current() { return cur ? cur.kind : null; },
    show(name) { const f = { stages: showStages, settings: showSettings, achievements: showAchievements, howto: showHowTo, credits: showCredits }[name]; if (f) f(); },
  };
  G.UI = UI;
})();
