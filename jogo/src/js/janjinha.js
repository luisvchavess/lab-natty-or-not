/* ============================================================
   FUSCA A JATO — janjinha.js
   Co-chefona da luta final: JANJINHA, "A Ministra Sem Pasta" (paródia da First Lady do governo, figura
   pública com papel público). Ela entra na 2ª vida do Lule (LULE 4.0): um jatinho VIP da FAB larga o
   SOFÁ DO ALVORADA voador com ela em cima, e ela segura o CERIMONIAL — enquanto ela está na luta, o Lule fica
   atrás do cordão de veludo (×0,3 de dano e um piso de HP). Tirar ela da luta = "EMBARCOU PRO EXTERIOR!"
   (ninguém morre: ela embarca numa viagem oficial). Rota exclusiva: o Leão da Receita morde o CARTÃO
   CORPORATIVO dela ("CARTÃO BLOQUEADO!"). Ela vai embora sozinha aos 75 s ("HORA DO EMBARQUE!").
   Inimigo 'janjinha' (G.Enemies) + a API G.Janjinha (SPEC5 §2.4), chamada pelo lule.js (sempre com guarda).
   Não depende do G.BossKit (o Lule roda sozinho com mods=lule). Contrato: docs/ENGINE.md §4/§5, SPEC5 §8.

   Regras de conteúdo (SPEC5 §1.1 e ENGINE §7) — valem para texto, arte, som e comentários deste arquivo:
   - Só a conduta PÚBLICA dela: viagens oficiais (jatinho da FAB, malas com adesivos G20 / ONU / COP / FAB);
     gasto público como exagero de desenho animado (o cartão corporativo "SEM LIMITE", o sofá voador com a
     etiqueta "MÓVEL NOVO"), nunca como crime provado e nunca com valores; a influência no governo ("A Ministra
     Sem Pasta", "O CERIMONIAL É COMIGO!"); a frase do G20, SEMPRE censurada ('F*CK YOU, ELON!', com o bipe);
     selfies, lives e militância ("É AGENDA DE TRABALHO!", "VOU REPRESENTAR O BRASIL!").
   - Nunca: corpo, idade, aparência, jeito de falar, a vida a dois com o Lule (nada de romance nem piada de
     casal; o termo de camarada do PT nunca é dito a ela nem sobre ela), sexualidade, clichês de gênero (nada
     de interesse por dinheiro, de loja ou de bolsas de loja, de patroa mandona, de cozinha). Nunca o nome real
     dela nem o apelido curto sozinho em texto; o id é 'janjinha' em tudo, no código também. Ela não tem
     mandato: a derrota é "EMBARCOU PRO EXTERIOR!" (nunca a palavra de cassação no feminino).
   - Desenho: chibi padrão com dignidade de desenho animado, como a Dilmãe e a Erika (blazer vermelho, blusa
     branca, cabelo longo escuro, rosto padrão); a caricatura fica nos adereços (celular de selfie dourado,
     cartão gigante, malas, sofá). O foguete da resposta é genérico: corpo branco, aletas cinza, chama
     laranja, sem logo, sem marca, sem nome.
   - Nada de acusação de crime: o cartão e o sofá são piada de gasto, não de ilegalidade.
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Enemies) return;
  const M = G.m, TAU = Math.PI * 2, PI = Math.PI, DOWN = Math.PI / 2;
  const INK = '#101418', WHITE = '#ffffff';
  const sfx = (n) => G.call(G.Audio, 'sfx', n);
  const L2 = () => !!(G.game && G.game.loop > 1);
  // partículas puramente decorativas: 'high' tudo, 'mid' metade, 'low' nada (ENGINE §10)
  const decoK = () => (G.quality === 'low' ? 0 : G.quality === 'mid' ? 0.5 : 1);
  // MODO CPI / NORMAL (core: G.tune): os números do JN e do JX são os do MODO CPI; o NORMAL só muda o que estiver em
  // G.TUNE_NORMAL['janjinha.JN'] / ['janjinha.JX']. Tudo é lido na hora (nada copiado no carregamento).
  const tune = G.tune || ((id, o) => o);

  // ======================================================================
  // Afinação (SPEC5 §8.1). Os números ficam aqui (passe de balanço: só este bloco e o JX).
  // HP × o d.hpMul do Lule (2º mandato e PRESSÃO já entram por ele). SHIELD = dano no Lule com o cordão;
  // STOPS/DWELL = paradas (fração de W) e tempo parada; OUT/OFF/IN = a "VIAGEM OFICIAL" (sai, fica fora, entra);
  // FAT..FAT_FULL = cansaço dela (×1 → ×2 de dano dos 40 aos 70 s do relógio dela); LEAVE_T = vai embora sozinha;
  // STUN_K = dano extra com o Lule tonto; CARD_* = leque de cartões (TELL = brilho de aviso); MALA_* = malas que
  // estouram em carimbos a MALA_Y·H; GRAWLIX/ROCKET = o grito censurado e a resposta em foguete (colunas avisadas);
  // SOFA_* = sofazinhos (abaixo de SOFA_AT do HP); GAP = intervalo entre ataques; LION_DMG = mordida no cartão
  // (fração do HP dela); CARD_BACK = s até a segunda via; SCORE/PIX = prêmio do EMBARCOU PRO EXTERIOR!
  // ======================================================================
  const JN = tune('janjinha.JN', {
    HP: 3000, SHIELD: 0.3, Y: 112, STOPS: [0.18, 0.82], DWELL: [4.0, 5.0], OUT: 0.7, OFF: 0.3, IN: 0.7, R: 26, ENTER: 1.6,
    FAT: 40, FAT_FULL: 30, LEAVE_T: 75, STUN_K: 1.5,
    CARD_N: 5, CARD_N_L2: 7, CARD_SPD: 150, CARD_SPREAD: 0.9, CARD_TELL: 0.45,
    MALA_N: 3, MALA_SPD: 72, MALA_Y: 0.52, MALA_RING: 8, MALA_RING_SPD: 105,
    GRAWLIX_N: 9, GRAWLIX_SPD: 130, ROCKET_WARN: 1.1, ROCKET_WARN_L2: 0.9, ROCKET_SPD: 330, ROCKET_SEP: 70,
    SOFA_AT: 0.5, SOFA_N: 3, SOFA_SPD: 110,
    GAP: 1.6, GAP_L2: 1.3, LION_DMG: 0.2, CARD_BACK: 12, SCORE: 150000, PIX: 60,
  }, ['HP', 'SHIELD', 'DWELL', 'OUT', 'OFF', 'IN', 'ENTER', 'FAT', 'FAT_FULL', 'LEAVE_T', 'STUN_K',
    'CARD_N', 'CARD_N_L2', 'CARD_SPD', 'CARD_SPREAD', 'CARD_TELL', 'MALA_N', 'MALA_SPD', 'MALA_Y', 'MALA_RING', 'MALA_RING_SPD',
    'GRAWLIX_N', 'GRAWLIX_SPD', 'ROCKET_WARN', 'ROCKET_WARN_L2', 'ROCKET_SPD', 'ROCKET_SEP', 'SOFA_N', 'SOFA_SPD',
    'GAP', 'GAP_L2', 'LION_DMG', 'CARD_BACK']);
  // (fora do modo: Y/STOPS/R = lugar e caixa de acerto, SOFA_AT = degrau da escada de ataques, SCORE/PIX = prêmio)
  // Afinação de apoio (não está na SPEC; mesma regra do JN): JET_* = o jatinho da entrada (y, s até largar o sofá),
  // DROP = o sofá caindo do jatinho, DLG_AT = s depois de largar até o diálogo, SKIP_WAIT = espera sem diálogo,
  // EXIT = o embarque (KO ou saída), GRAWLIX_SPREAD / SOFA_SPREAD = abertura dos leques (rad), SOFA_GAP = s entre
  // os 3 leques de sofá, MALA_X = faixa (fração de W) para onde as malas descem, ROCKET_Y = y de saída do foguete,
  // ROCKET_SEP2 = folga extra aleatória da 2ª coluna, CHAT = intervalo das falas soltas, FIRST = 1º ataque depois de
  // entrar, ARRIVE = espera mínima ao chegar numa parada, ROPE_IN / ROPE_FALL = cordão subindo / caindo.
  // GAP_LOW = fator do GAP abaixo de SOFA_AT, ROCKET_AT / ROCKET_END = s do grito até o foguete sair / até o fim do
  // ataque, SOFA_FANS = leques de sofá, PN3 / PN5 = tiros a mais por leque com o Lule travado em lv ≥ 3 / lv 5.
  const JX = tune('janjinha.JX', {
    JET_Y: 100, JET_IN: 1.4, DROP: 0.4, DLG_AT: 0.6, SKIP_WAIT: 1.6, EXIT: 2.2,
    GRAWLIX_SPREAD: 1.3, SOFA_SPREAD: 0.5, SOFA_GAP: 0.4, MALA_X: [0.2, 0.8], ROCKET_Y: 56, ROCKET_SEP2: 40,
    CHAT: [6, 9], FIRST: 1.0, ARRIVE: 0.5, ROPE_IN: 0.6, ROPE_FALL: 1.0,
    GAP_LOW: 0.85, ROCKET_AT: 0.6, ROCKET_END: 0.8, SOFA_FANS: 3, PN3: 1, PN5: 1,
  }, ['GRAWLIX_SPREAD', 'SOFA_SPREAD', 'SOFA_GAP', 'MALA_X', 'ROCKET_SEP2', 'CHAT', 'FIRST', 'ARRIVE',
    'GAP_LOW', 'ROCKET_AT', 'ROCKET_END', 'SOFA_FANS', 'PN3', 'PN5']);
  // (fora do modo: JET_* / DROP / DLG_AT / SKIP_WAIT / EXIT = cena de entrada e saída, ROCKET_Y e ROPE_* = desenho)
  // desenho: tamanho dela (Lule 136 continua a estrela), âncora da pessoa (y relativo a e.y), barra de HP
  const PS = 100, PY = -8, SY = 16, BAR_W = 64, BAR_H = 5, BAR_DY = 66, OFFX = 64; // SY: o sofá abaixo da âncora (o blazer aparece)
  const FLASH = 0.034, FLASH_CD = 0.35; // ≤ 3 flashes brancos por segundo (ela não é 'big')
  const PINK = '#ff3d7f', GOLD = '#ffd23f';
  const COL = { pink: '#ff3d7f', hot: '#ff4fa3', magenta: '#ff3dd8', red: '#ff2a4a', violet: '#c86bff', orange: '#ff8c1a' };
  // símbolos do palavrão censurado (um sprite por cor: cada tom de magenta/rosa leva um símbolo)
  const GRAWLIX = [['#ff3dd8', '#'], ['#ff3d7f', '@'], ['#ff4fa3', '$'], ['#e83cff', '%'], ['#ff5cc8', '!']];
  const GLYPH = {}; for (const g of GRAWLIX) GLYPH[g[0]] = g[1];

  // Chibi padrão (SPEC5 §8.3): blazer vermelho, blusa branca, cabelo longo escuro.
  const JANJ = {
    skin: '#e8b48f', face: 'oval', nose: 'small', hair: 'long', hairColor: '#2a1a12', browColor: '#2a1a12',
    glasses: null, body: 'suit', suit: '#d7191c', shirt: '#ffffff', tie: null, seed: 23,
  };

  // Falas (≤ 28 caracteres)
  const CHAT = ['O CERIMONIAL É COMIGO!', 'SORRI PRA SELFIE!', 'TEM MÓVEL NOVO NO ALVORADA!', 'É AGENDA DE TRABALHO!',
    'VOU REPRESENTAR O BRASIL!', 'MINISTRA SEM PASTA? EU?'];
  const CHAT_LOW = 'REMARCA O MEU VOO!';
  const CARD_SAY = ['PASSA O CARTÃO!', 'SEM LIMITE!'];
  const MALA_SAY = ['BAGAGEM OFICIAL!', 'MISSÃO OFICIAL!'];
  const CYCLE = ['cartao', 'malas', 'cartao', 'elon'];
  const CYCLE_LOW = ['cartao', 'sofa', 'malas', 'elon']; // abaixo de SOFA_AT

  let FLOOR_AT = 0.62; // lule.js: J.setFloorAt(PH2[1].at)

  // ======================================================================
  // Utilidades
  // ======================================================================
  const NOP_P = { x: 180, y: 500, alive: false };
  function pl() { const p = G.game && G.game.player; return p || NOP_P; }
  function jjOf(b) { return (b && b.data && b.data.jj) || null; }
  // o Lule lutando "de verdade" (não na cena da volta)
  function fighting(b) { return !!(b && b.state === 'fight' && !(b.data && b.data.reviving) && G.game && G.game.boss === b); }
  function stunned(b) { return !!(b && b.data && b.data.stunT > 0); }
  function canShoot(b) {
    const g = G.game; if (!g) return false;
    const p = g.player;
    return !!(p && p.alive && !p.entering) && fighting(b) && g.eb.length < 430;
  }
  function shoot(b, x, y, ang, spd, o) { return canShoot(b) ? G.fire(x, y, ang, spd, o) : null; }
  function fan(b, x, y, ang, n, spread, spd, o) {
    if (n <= 1) { shoot(b, x, y, ang, spd, o); return; }
    for (let i = 0; i < n; i++) shoot(b, x, y, ang - spread / 2 + (spread * i) / (n - 1), spd, o);
  }
  // variantes da PRESSÃO (cópia local da fórmula do BossKit, com o nível travado do Lule, d.pl)
  function lvOf(b) { const d = b && b.data; if (d && d.pl != null) return d.pl; const pr = G.press; return (pr && pr.lv) || 0; }
  const pN = (n, lv) => n + (lv >= 3 ? JX.PN3 : 0) + (lv >= 5 ? JX.PN5 : 0);
  function say(e, s, dur) { G.say(e, s, dur || 2); }
  function pose(jj, name, dur) { jj.pose = name; jj.poseT = dur || 0.8; }
  function mood(jj, name, dur) { jj.mood = name; jj.moodT = dur || 0.8; }
  const stopX = (i) => G.W * JN.STOPS[i];
  const edgeX = (i) => (i === 0 ? -OFFX : G.W + OFFX); // a borda mais perto da parada i
  const facingOf = (jj) => (jj.stop === 0 ? 1 : -1);   // a mão direita (a que aponta) sempre para o meio da tela
  const onScreen = (e) => e.x > -JN.R && e.x < G.W + JN.R;
  function fatK(jj) { return M.clamp((jj.t - JN.FAT) / JN.FAT_FULL, 0, 1); }

  // ======================================================================
  // Sprites (partes paradas: sofá, malas, cartão, celular, jatinho, poste do cordão), na resolução do aparelho
  // ======================================================================
  const SPR = new Map();
  let sprRes = 0;
  const devRes = () => (G.canvas && G.W ? G.canvas.width / G.W : 1);
  const fontKey = () => (document.fonts ? document.fonts.status : '');
  function sprite(key, box, paint) {
    const r = devRes();
    if (r !== sprRes) { SPR.clear(); sprRes = r; }
    let s = SPR.get(key);
    if (s) return s;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(box[2] * r)); cv.height = Math.max(1, Math.ceil(box[3] * r));
    const x = cv.getContext('2d');
    if (x) {
      x.scale(r, r); x.translate(-box[0], -box[1]); x.lineJoin = 'round'; x.lineCap = 'round';
      try { paint(x); } catch (err) { G.reportError(err, 'janjinha sprite ' + key); }
    }
    s = { cv, box };
    if (SPR.size > 48) SPR.delete(SPR.keys().next().value);
    SPR.set(key, s);
    return s;
  }
  function blit(c, s, x, y) { const B = s.box; c.drawImage(s.cv, x + B[0], y + B[1], B[2], B[3]); }
  function RR(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function inked(c, fill, lw) { c.lineWidth = (lw || 1.4) * 2; c.strokeStyle = INK; c.stroke(); c.fillStyle = fill; c.fill(); }
  function txt(c, s, x, y, size, color, o) {
    o = o || {};
    c.font = (o.weight || '800') + ' ' + size + 'px ' + (o.font || G.FONT_BODY);
    c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.stroke; c.strokeStyle = o.strokeColor || INK; c.strokeText(s, x, y); }
    c.fillStyle = color; c.fillText(s, x, y, o.max || 999);
  }
  const fc = (fl, col) => (fl ? WHITE : col);

  // ---------- pintores (vetor; os sprites e o retrato usam os mesmos) ----------
  // Cartão corporativo gigante (28×18): dourado, chip, faixa vermelha e as duas inscrições a 4 px
  function paintCard(c, fl) {
    c.beginPath(); RR(c, -14, -9, 28, 18, 2.6); inked(c, fc(fl, '#ffcf3a'), 1.1);
    if (fl) return;
    c.fillStyle = '#fff1b0'; c.beginPath(); RR(c, -12.5, -7.6, 25, 3.2, 1.2); c.fill();
    c.fillStyle = '#d7191c'; c.fillRect(-14, -1.2, 28, 2.4);
    c.beginPath(); RR(c, -11.5, 1.8, 6, 4.6, 1); c.fillStyle = '#e9e3c9'; c.fill(); c.lineWidth = 0.5; c.strokeStyle = '#8a6a12'; c.stroke();
    c.beginPath(); c.moveTo(-8.5, 1.8); c.lineTo(-8.5, 6.4); c.moveTo(-11.5, 4.1); c.lineTo(-5.5, 4.1); c.stroke();
    txt(c, 'CARTÃO CORPORATIVO', 0, -5.9, 4, '#7a4f00', { weight: '900', max: 24 });
    txt(c, 'SEM LIMITE', 4, 4.4, 4, '#7a1010', { weight: '900', max: 16 });
  }
  // Celular de selfie com capinha dourada (visto por trás: a câmera aponta para ela)
  function paintPhone(c, fl) {
    c.beginPath(); RR(c, -4.6, -7.6, 9.2, 15.2, 2.2); inked(c, fc(fl, '#e9b730'), 1);
    if (fl) return;
    c.fillStyle = '#fff1b0'; c.fillRect(-3.4, -6.4, 1.4, 12.4);
    c.beginPath(); RR(c, -0.5, -6.2, 4.2, 4.2, 1.2); c.fillStyle = '#3a2a10'; c.fill();
    c.fillStyle = '#9fd6ff'; c.beginPath(); c.arc(1.6, -4.1, 1.1, 0, TAU); c.fill();
  }
  // Malas (14×18): k 0 = rosa (G20, ONU), 1 = dourada (COP, FAB). Origem: base da mala.
  function sticker(c, x, y, w, h, bg, fg, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); RR(c, -w / 2, -h / 2, w, h, 1); c.fillStyle = bg; c.fill(); c.lineWidth = 0.6; c.strokeStyle = 'rgba(16,20,24,0.6)'; c.stroke();
    txt(c, s, 0, 0.3, 3.6, fg, { weight: '900', max: w - 0.8 });
    c.restore();
  }
  function paintMala(c, k, fl) {
    const body = k ? '#f2b632' : '#ff6fae', dark = k ? '#b97f12' : '#d94a8b';
    c.beginPath(); RR(c, -3.8, -22, 7.6, 5, 2); c.lineWidth = 3.2; c.strokeStyle = INK; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = fc(fl, '#4a4f5c'); c.stroke();
    c.beginPath(); RR(c, -7, -18, 14, 17, 2.6); inked(c, fc(fl, body), 1.1);
    if (fl) return;
    c.fillStyle = dark; c.fillRect(-7, -12.5, 14, 1.4); c.fillRect(-7, -6.6, 14, 1.4);
    c.fillStyle = INK; c.beginPath(); c.arc(-4.4, -0.2, 1.3, 0, TAU); c.arc(4.4, -0.2, 1.3, 0, TAU); c.fill();
    if (k) { sticker(c, -2.4, -15.2, 8.4, 4.2, '#2f9e44', WHITE, 'COP', -0.15); sticker(c, 2.6, -9.6, 8.4, 4.2, '#1d3557', WHITE, 'FAB', 0.12); }
    else { sticker(c, 2.2, -15.2, 8.4, 4.2, '#1b4fa0', WHITE, 'G20', 0.14); sticker(c, -2.2, -9.6, 8.4, 4.2, '#4aa3df', WHITE, 'ONU', -0.12); }
  }
  // SOFÁ DO ALVORADA (veludo vermelho, 3 lugares, 74 px; pés dourados; dois bocais de jato embaixo).
  // Origem = (e.x, e.y). Costas atrás dela (y 0..24); assento e braços na frente dela (y 16..40).
  function paintSofaBack(c, fl) {
    c.beginPath();
    c.moveTo(-33, 24); c.lineTo(-33, 6); c.quadraticCurveTo(-33, -2, -24, -2);
    c.quadraticCurveTo(-12, -6, 0, -2); c.quadraticCurveTo(12, -6, 24, -2);
    c.quadraticCurveTo(33, -2, 33, 6); c.lineTo(33, 24); c.closePath();
    inked(c, fc(fl, '#6e0a22'), 1.3);
    if (fl) return;
    c.strokeStyle = '#4a0616'; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(-11, 1); c.lineTo(-11, 22); c.moveTo(11, 1); c.lineTo(11, 22); c.stroke();
    c.fillStyle = '#ffd23f';
    for (const bx of [-22, 0, 22]) for (const by of [6, 14]) { c.beginPath(); c.arc(bx + (by === 14 ? 0 : 0), by, 1.1, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(255,120,150,0.4)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-26, 1.4); c.quadraticCurveTo(-12, -2.6, 0, 1); c.stroke();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 1; c.beginPath(); c.moveTo(-32, 23); c.lineTo(32, 23); c.stroke();
  }
  function paintSofaFront(c, fl) {
    // bocais de jato (cinza) embaixo do assento
    for (const nx of [-18, 18]) { c.beginPath(); RR(c, nx - 4.5, 36, 9, 8, 2); inked(c, fc(fl, '#8c95a6'), 1); }
    // assento
    c.beginPath(); RR(c, -31, 17, 62, 13, 5); inked(c, fc(fl, '#94122f'), 1.2);
    // saia da frente
    c.beginPath(); RR(c, -33, 27, 66, 11, 3.5); inked(c, fc(fl, '#6e0a22'), 1.2);
    // braços (rolinhos)
    c.beginPath(); RR(c, -40, 10, 12, 28, 6); inked(c, fc(fl, '#7f0d28'), 1.2);
    c.beginPath(); RR(c, 28, 10, 12, 28, 6); inked(c, fc(fl, '#7f0d28'), 1.2);
    // pés dourados
    for (const fx of [-34, 34]) { c.beginPath(); RR(c, fx - 3, 37, 6, 6, 1.6); inked(c, fc(fl, '#ffcf3a'), 0.9); }
    if (fl) return;
    c.strokeStyle = '#ffd23f'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-31, 28.5); c.lineTo(31, 28.5); c.stroke();
    c.strokeStyle = 'rgba(255,150,170,0.5)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-26, 19.6); c.lineTo(-6, 19.6); c.moveTo(6, 19.6); c.lineTo(26, 19.6); c.stroke();
    c.beginPath(); c.arc(-34, 14.5, 2.4, PI, TAU); c.moveTo(36.4, 14.5); c.arc(34, 14.5, 2.4, PI, TAU); c.stroke();
    c.strokeStyle = '#4a0616'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 27); c.stroke();
  }
  // etiqueta pendurada "MÓVEL NOVO" (sem preço). Origem = o furo do barbante.
  function paintTag(c, fl) {
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 5); c.lineWidth = 1; c.strokeStyle = fc(fl, '#e9e3c9'); c.stroke();
    c.beginPath(); c.moveTo(-9, 7); c.lineTo(7, 7); c.lineTo(10, 10.5); c.lineTo(7, 14); c.lineTo(-9, 14); c.closePath();
    inked(c, fc(fl, '#fffdf2'), 0.7);
    if (fl) return;
    c.fillStyle = INK; c.beginPath(); c.arc(7, 10.5, 0.8, 0, TAU); c.fill();
    txt(c, 'MÓVEL NOVO', -1.2, 10.7, 4.2, '#d7191c', { weight: '900', max: 15 });
  }
  // jatinho VIP da FAB (de lado, bico para +x): branco, faixa azul, 'FAB' na deriva e uma bandeirinha
  function paintJet(c) {
    // asa de trás (do outro lado)
    c.beginPath(); c.moveTo(-2, -1); c.lineTo(-14, -9); c.lineTo(-9, -9); c.lineTo(8, -1); c.closePath(); inked(c, '#c9d2e0', 1);
    // deriva
    c.beginPath(); c.moveTo(-20, -5); c.lineTo(-31, -19); c.lineTo(-24, -19.5); c.lineTo(-10, -5.5); c.closePath(); inked(c, '#f4f6fa', 1.1);
    // fuselagem
    c.beginPath();
    c.moveTo(-31, -2); c.quadraticCurveTo(-29, -7, -18, -7); c.lineTo(16, -7); c.quadraticCurveTo(31, -6.5, 34, 0.5);
    c.quadraticCurveTo(31, 6, 16, 6); c.lineTo(-20, 6); c.quadraticCurveTo(-30, 5, -31, -2); c.closePath();
    inked(c, '#f4f6fa', 1.2);
    // faixa azul
    c.fillStyle = '#1d4fbf'; c.beginPath(); c.moveTo(-28, 1); c.lineTo(30, 1); c.lineTo(32.5, 2.6); c.lineTo(-28, 2.6); c.closePath(); c.fill();
    // janelinhas e cabine
    c.fillStyle = '#1d3557';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(-12 + i * 5.2, -3, 1.3, 1.6, 0, 0, TAU); c.fill(); }
    c.beginPath(); c.moveTo(24, -5); c.quadraticCurveTo(29, -4.6, 31, -1.6); c.lineTo(24, -1.6); c.closePath(); c.fill();
    // motor
    c.beginPath(); RR(c, -24, -11, 13, 5.5, 2.6); inked(c, '#dfe5ee', 1);
    // asa da frente
    c.beginPath(); c.moveTo(-4, 4); c.lineTo(-16, 13); c.lineTo(-10, 13); c.lineTo(8, 4); c.closePath(); inked(c, '#e8edf4', 1);
    // 'FAB' e a bandeirinha na deriva
    txt(c, 'FAB', -24.6, -12.6, 4.6, '#1d4fbf', { weight: '900', max: 10 });
    c.save(); c.translate(-17.5, -0.6);
    c.fillStyle = '#009c3b'; c.fillRect(-3.4, -2.3, 6.8, 4.6);
    c.fillStyle = '#ffdf00'; c.beginPath(); c.moveTo(0, -1.9); c.lineTo(3, 0); c.lineTo(0, 1.9); c.lineTo(-3, 0); c.closePath(); c.fill();
    c.fillStyle = '#002776'; c.beginPath(); c.arc(0, 0, 1.05, 0, TAU); c.fill();
    c.restore();
  }
  // poste dourado do cordão (origem = base; 34 px de altura)
  function paintPost(c) {
    c.beginPath(); c.ellipse(0, -1.5, 7, 2.6, 0, 0, TAU); inked(c, '#e3a91c', 1);
    c.beginPath(); RR(c, -2, -31, 4, 30, 1.4); inked(c, '#ffcf3a', 1);
    c.beginPath(); c.arc(0, -33, 3.6, 0, TAU); inked(c, '#ffd23f', 1);
    c.fillStyle = '#fff1b0'; c.fillRect(-1, -29, 1, 26);
    c.beginPath(); c.arc(-1.1, -34.2, 1.1, 0, TAU); c.fill();
  }

  // caixas dos sprites (px lógicos relativos à âncora)
  const B_CARD = [-16, -11, 32, 22], B_PHONE = [-6.5, -9.5, 13, 19], B_MALA = [-9, -25, 18, 27];
  const B_BACK = [-36, -8, 72, 35], B_FRONT = [-43, 8, 86, 39], B_TAG = [-11, -1, 23, 17];
  const B_JET = [-36, -23, 74, 40], B_POST = [-9, -39, 18, 42];
  const sCard = (fl) => sprite('card' + (fl ? 'F' : '') + fontKey(), B_CARD, (x) => paintCard(x, fl));
  const sPhone = (fl) => sprite('phone' + (fl ? 'F' : ''), B_PHONE, (x) => paintPhone(x, fl));
  const sMala = (k, fl) => sprite('mala' + k + (fl ? 'F' : '') + fontKey(), B_MALA, (x) => paintMala(x, k, fl));
  const sBack = (fl) => sprite('back' + (fl ? 'F' : ''), B_BACK, (x) => paintSofaBack(x, fl));
  const sFront = (fl) => sprite('front' + (fl ? 'F' : ''), B_FRONT, (x) => paintSofaFront(x, fl));
  const sTag = (fl) => sprite('tag' + (fl ? 'F' : '') + fontKey(), B_TAG, (x) => paintTag(x, fl));
  const sJet = () => sprite('jet' + fontKey(), B_JET, paintJet);
  const sPost = () => sprite('post', B_POST, paintPost);

  // ======================================================================
  // Estilos de tiro 'jan_' (saturados, nunca teal)
  // ======================================================================
  const BS = G.BulletStyles;
  function glowOn(x, c, b) { x.shadowColor = c; x.shadowBlur = b; }
  // cartão dourado com faixa vermelha e chip (gira na direção do voo)
  BS.define('jan_cartao', { r: 5, size: 18, rotate: true, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); RR(x, -8.6, -5.8, 17.2, 11.6, 2); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#ffd23f'; x.beginPath(); RR(x, -7.4, -4.6, 14.8, 9.2, 1.6); x.fill();
    x.fillStyle = c; x.fillRect(-7.4, -1.6, 14.8, 2.2);
    x.fillStyle = '#fff1b0'; x.fillRect(-6.4, -3.8, 9, 1);
    x.fillStyle = '#c9a227'; x.fillRect(-6, 1.4, 3.6, 2.6);
  } });
  // mala rosa com alça e adesivo (cai devagar e estoura em carimbos)
  BS.define('jan_mala', { r: 9, size: 26, paint(x, s, c) {
    glowOn(x, c, 8);
    x.strokeStyle = c; x.lineWidth = 2.4; x.beginPath(); RR(x, -3.6, -11, 7.2, 5, 2); x.stroke();
    x.fillStyle = c; x.beginPath(); RR(x, -9, -7, 18, 16, 3); x.fill();
    x.shadowBlur = 0; x.lineWidth = 1.4; x.strokeStyle = '#ffffff'; x.beginPath(); RR(x, -8.2, -6.2, 16.4, 14.4, 2.6); x.stroke();
    x.fillStyle = 'rgba(80,0,40,0.35)'; x.fillRect(-9, -2.4, 18, 1.3); x.fillRect(-9, 3, 18, 1.3);
    x.fillStyle = '#1b4fa0'; x.beginPath(); RR(x, -1, -5.4, 7.6, 4.2, 1); x.fill();
    x.fillStyle = '#ffffff'; x.font = '900 3.4px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('G20', 2.8, -3.2, 7);
  } });
  // carimbo redondo de passaporte (violeta ou vermelho)
  BS.define('jan_carimbo', { r: 4.4, size: 14, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.44, 0, TAU); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, s * 0.34, 0, TAU); x.fill();
    x.strokeStyle = c; x.lineWidth = 1.1; x.beginPath(); x.arc(0, 0, s * 0.25, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(-2.4, -0.6); x.lineTo(2.4, -0.6); x.moveTo(-1.8, 1.3); x.lineTo(1.8, 1.3); x.lineWidth = 0.9; x.stroke();
  } });
  // disco magenta com um símbolo branco do palavrão censurado (#, @, $, %, ! — um por cor)
  BS.define('jan_grawlix', { r: 4.6, size: 16, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.46, 0, TAU); x.fill();
    x.shadowBlur = 0; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, s * 0.4, 0, TAU); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '900 ' + (s * 0.6) + 'px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(GLYPH[c] || '#', 0, s * 0.04);
  } });
  // foguete GENÉRICO (corpo branco, aletas cinza, chama laranja; sem logo nem nome). Bico para +x.
  BS.define('jan_foguete', { r: 8, size: 24, rotate: true, paint(x, s, c) {
    glowOn(x, c, 8);
    x.fillStyle = c; x.beginPath(); x.moveTo(-6, -2.8); x.quadraticCurveTo(-13, -1.4, -12, 0); x.quadraticCurveTo(-13, 1.4, -6, 2.8); x.closePath(); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#ffe28a'; x.beginPath(); x.moveTo(-6, -1.5); x.quadraticCurveTo(-10, 0, -6, 1.5); x.closePath(); x.fill();
    x.fillStyle = '#9aa3b2'; x.strokeStyle = INK; x.lineWidth = 0.9;
    x.beginPath(); x.moveTo(-5, -3); x.lineTo(-8, -7); x.lineTo(-2, -3.2); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-5, 3); x.lineTo(-8, 7); x.lineTo(-2, 3.2); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-6, -3.4); x.lineTo(5, -3.4); x.quadraticCurveTo(10.5, -2.4, 11.5, 0); x.quadraticCurveTo(10.5, 2.4, 5, 3.4);
    x.lineTo(-6, 3.4); x.closePath(); x.fillStyle = '#ffffff'; x.fill(); x.stroke();
    x.fillStyle = '#cfd6e2'; x.fillRect(-5.4, 1.2, 10, 1.4);
    x.fillStyle = '#5b6474'; x.beginPath(); x.arc(3, -0.4, 1.3, 0, TAU); x.fill();
  } });
  // sofazinho violeta (as costas para −x: voando para baixo, fica de pé)
  BS.define('jan_sofa', { r: 8, size: 18, rotate: true, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c;
    x.beginPath(); RR(x, -7.5, -8, 6, 16, 2.4); x.fill();      // costas
    x.beginPath(); RR(x, -3, -7.4, 7, 14.8, 2); x.fill();      // assento
    x.beginPath(); RR(x, -4, -9, 9, 4, 2); RR(x, -4, 5, 9, 4, 2); x.fill(); // braços
    x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(-1.5, -5); x.lineTo(-1.5, 5); x.stroke();
    x.fillStyle = '#ffd23f'; x.fillRect(4.5, -7.6, 2, 2.4); x.fillRect(4.5, 5.2, 2, 2.4);
  } });

  // ======================================================================
  // Estado (b.data.jj) e mãos
  // ======================================================================
  function newState(b, done) {
    return {
      b, e: null, st: 'jet', it: 0, done: done || null, dlg: false, skipT: 0,
      t: 0, ko: false, left: false, gone: false,
      stop: 1, mv: 'dwell', mvT: 0, dwell: JN.DWELL[0], x0: 0, x1: 0, bobT: 0, rot: 0, thrust: 0,
      atk: null, atkObj: { kind: '', t: 0, step: 0, n: 0, next: 0, end: 0 }, atkI: 0, atkT: JX.FIRST,
      chatT: M.rand(JX.CHAT[0], JX.CHAT[1]), said25: false,
      pose: 'idle', poseT: 0, mood: 'normal', moodT: 0, shrugT: 0, cardT: 0, glintT: 0, flashT: 0,
      fl: 0, flCd: 0, rk: [], ropeIn: 0, ropeOut: -1, exit: null, exitT: 0, kx: 0, ky: 0,
      jet: { on: true, x: -90, y: JX.JET_Y, vx: 0, a: 0 },
      warm: null,
      box: { x: 0, y: 0, r: JN.R }, goal: { x: 0, y: 0 },
      stats: { up: false, ko: false, left: false, t: 0, hp: 0, maxHp: 0 }, mj: { up: false, ko: false, left: false, t: 0 },
    };
  }
  // em luta (a entrada invulnerável conta; o embarque, a saída e o sumiço não)
  function isUp(jj) {
    if (!jj || !jj.e || jj.e.dead) return false;
    const s = jj.st;
    return s === 'drop' || s === 'wait' || s === 'enter' || s === 'fight';
  }
  // pose atual (o tonto do Lule congela ela encolhendo os ombros)
  function curPose(jj) {
    if (jj.st === 'ko' || jj.st === 'leave') return 'wave';
    if (jj.st === 'fight' && (stunned(jj.b) || jj.shrugT > 0)) return 'shrug';
    if (jj.poseT > 0) return jj.pose;
    return 'idle'; // em repouso: mãos do lado (o blazer aparece); 'hold' é a selfie
  }
  const HANDS = { idle: [-24, 33, 24, 33], hold: [-9, 30, 9, 30], point: [-24, 33, 36, 12], up: [-28, -7, 28, -7], shrug: [-34, 15, 34, 15], wave: [-24, 33, 27, -6] };
  const HP_TMP = { lx: 0, ly: 0, rx: 0, ry: 0 };
  // mãos relativas a (e.x, e.y): l = esquerda (cartão), r = direita (celular; aponta o cartão no 'point')
  function hands(ps, t, facing) {
    const o = HP_TMP;
    if (G.Art.personAnchors) {
      const A = G.Art.personAnchors(PS, { pose: ps, t, seed: JANJ.seed, facing });
      o.lx = A.handL.x; o.ly = A.handL.y + PY; o.rx = A.handR.x; o.ry = A.handR.y + PY;
    } else {
      const h = HANDS[ps] || HANDS.idle, s = PS / 100;
      o.lx = h[0] * s * facing; o.ly = h[1] * s + PY; o.rx = h[2] * s * facing; o.ry = h[3] * s + PY;
    }
    return o;
  }
  // posição (mundo) do cartão e do celular agora
  const PT = { x: 0, y: 0 };
  function cardPos(e, jj) {
    const ps = curPose(jj), f = facingOf(jj), h = hands(ps, e.t, f);
    if (ps === 'point') { PT.x = e.x + h.rx + 3 * f; PT.y = e.y + h.ry - 3; }
    else if (ps === 'hold') { PT.x = e.x + h.lx - 17 * f; PT.y = e.y + h.ly + 1; }
    else { PT.x = e.x + h.lx - 4 * f; PT.y = e.y + h.ly - 4; }
    return PT;
  }
  function phonePos(e, jj) {
    const ps = curPose(jj), f = facingOf(jj), h = hands(ps, e.t, f);
    if (ps === 'point') { PT.x = e.x + h.lx; PT.y = e.y + h.ly - 5; }
    else { PT.x = e.x + h.rx + 1 * f; PT.y = e.y + h.ry - 6; }
    return PT;
  }

  // ======================================================================
  // Ataques
  // ======================================================================
  function gapOf(e) { return (L2() ? JN.GAP_L2 : JN.GAP) * (e.hp / e.maxHp < JN.SOFA_AT ? JX.GAP_LOW : 1); }
  function nextKind(e, jj) {
    const cyc = e.hp / e.maxHp < JN.SOFA_AT ? CYCLE_LOW : CYCLE;
    let k = cyc[jj.atkI % cyc.length];
    jj.atkI++;
    if (k === 'cartao' && jj.cardT > 0) k = 'malas'; // cartão apreendido: vira mala
    return k;
  }
  function beginAttack(e, jj) {
    const a = jj.atkObj;
    a.kind = nextKind(e, jj); a.t = 0; a.step = 0; a.n = 0; a.next = 0; a.end = 0;
    jj.atk = a;
  }
  function endAttack(e, jj) { jj.atk = null; jj.atkT = gapOf(e); }
  // o cartão bate UMA vez numa parede lateral
  function cardUpd(bl) {
    if (bl.data.bn) return;
    if ((bl.x < 8 && bl.vx < 0) || (bl.x > G.W - 8 && bl.vx > 0)) { bl.vx = -bl.vx; bl.data.bn = 1; bl.ang = Math.atan2(bl.vy, bl.vx); }
  }
  // a mala desce devagar e, na altura MALA_Y·H, estoura num anel de carimbos ("ESCALA!")
  function malaUpd(bl, dt, g) {
    if (bl.y < G.H * JN.MALA_Y) return;
    bl.dead = true;
    G.burst(bl.x, bl.y, 8, { colors: [bl.color, '#ffffff'], speed: 90, life: 0.3, size: 2.2 });
    G.text(bl.x, bl.y, 'ESCALA!', { size: 8 });
    sfx('split');
    const b = g && g.boss;
    if (!canShoot(b)) return;
    const n = JN.MALA_RING, off = Math.random() * TAU;
    for (let i = 0; i < n; i++) G.fire(bl.x, bl.y, off + (i * TAU) / n, JN.MALA_RING_SPD, { style: 'jan_carimbo', color: bl.data.c || COL.violet });
  }
  // o foguete: som e o letreiro no instante em que sai (uma vez por resposta; o letreiro desce: subindo, a barra do
  // chefão o cobria); rastro de fumaça
  function rocketUpd(bl) {
    const d = bl.data;
    if (!d.go) {
      d.go = 1;
      sfx('rocket');
      if (d.vol && !d.vol.said) { d.vol.said = 1; G.text(G.W - 90, 74, 'O FOGUETE RESPONDEU!', { size: 10, color: '#ffffff', vy: 14, life: 1.2, stroke: true }); }
    }
    if (Math.random() < 0.5 * decoK()) G.part({ x: bl.x + M.rand(-2, 2), y: bl.y - 12, vx: M.rand(-12, 12), vy: -40, type: 'smoke', size: 4, life: 0.4, color: 'rgba(235,235,240,0.4)' });
  }
  // a resposta: 2 colunas avisadas (uma no x do Fusca, outra a ≥ ROCKET_SEP px), foguete parado e translúcido no aviso
  function rocketReply(b, jj) {
    if (!canShoot(b)) return;
    const W = G.W, p = pl(), warn = L2() ? JN.ROCKET_WARN_L2 : JN.ROCKET_WARN;
    const x1 = M.clamp(p.x, 24, W - 24);
    let side = Math.random() < 0.5 ? -1 : 1;
    let x2 = x1 + side * (JN.ROCKET_SEP + M.rand(0, JX.ROCKET_SEP2));
    if (x2 < 24 || x2 > W - 24) { side = -side; x2 = x1 + side * (JN.ROCKET_SEP + M.rand(0, JX.ROCKET_SEP2)); }
    x2 = M.clamp(x2, 24, W - 24);
    const vol = { said: 0 };
    for (let i = 0; i < 2; i++) {
      const x = i ? x2 : x1;
      const bl = G.fire(x, JX.ROCKET_Y, DOWN, JN.ROCKET_SPD, { style: 'jan_foguete', color: COL.orange, delay: warn, update: rocketUpd, data: { vol } });
      if (bl) jj.rk.push({ x, warn, bl });
    }
    sfx('laser_warn');
  }
  function updAttack(e, jj, b, dt) {
    const a = jj.atk, lv = lvOf(b);
    a.t += dt;
    switch (a.kind) {
      case 'cartao': {
        if (a.step === 0) {
          a.step = 1;
          say(e, M.pick(CARD_SAY), 1.4);
          pose(jj, 'point', JN.CARD_TELL + 0.45);
          jj.glintT = JN.CARD_TELL;
          sfx('tink');
        } else if (a.step === 1 && a.t >= JN.CARD_TELL) {
          a.step = 2;
          const h = cardPos(e, jj), n = pN(L2() ? JN.CARD_N_L2 : JN.CARD_N, lv);
          fan(b, h.x, h.y, G.aim(h.x, h.y), n, JN.CARD_SPREAD, JN.CARD_SPD, { style: 'jan_cartao', color: COL.red, update: cardUpd });
          sfx('enemy_shot');
        } else if (a.step === 2 && a.t >= JN.CARD_TELL + 0.3) endAttack(e, jj);
        break;
      }
      case 'malas': {
        if (a.step === 0) {
          a.step = 1;
          say(e, M.pick(MALA_SAY), 1.5);
          pose(jj, 'up', 0.7);
          const W = G.W, ty = G.H * JN.MALA_Y, x0 = e.x, y0 = e.y + 14, n = JN.MALA_N;
          for (let i = 0; i < n; i++) {
            const tx = W * M.lerp(JX.MALA_X[0], JX.MALA_X[1], n > 1 ? i / (n - 1) : 0.5) + M.rand(-14, 14);
            shoot(b, x0, y0, Math.atan2(ty - y0, tx - x0), JN.MALA_SPD, { style: 'jan_mala', color: i % 2 ? COL.hot : COL.pink, delay: 0.4, update: malaUpd, data: { c: i % 2 ? COL.red : COL.violet } });
          }
          sfx('whoosh');
        } else if (a.t >= 0.5) endAttack(e, jj);
        break;
      }
      case 'elon': {
        if (a.step === 0) {
          a.step = 1;
          pose(jj, 'up', 1.3); mood(jj, 'angry', 1.3);
          say(e, 'F*CK YOU, ELON!', 1.7);
          sfx('bleep');
          const h = phonePos(e, jj), n = pN(JN.GRAWLIX_N, lv), sp = JX.GRAWLIX_SPREAD, ang = G.aim(h.x, h.y);
          for (let i = 0; i < n; i++) {
            shoot(b, h.x, h.y, n > 1 ? ang - sp / 2 + (sp * i) / (n - 1) : ang, JN.GRAWLIX_SPD, { style: 'jan_grawlix', color: GRAWLIX[i % GRAWLIX.length][0] });
          }
          sfx('enemy_shot2');
        } else if (a.step === 1 && a.t >= JX.ROCKET_AT) {
          a.step = 2;
          rocketReply(b, jj);
        } else if (a.step === 2 && a.t >= JX.ROCKET_END) endAttack(e, jj);
        break;
      }
      case 'sofa': {
        if (a.step === 0) {
          a.step = 1; a.next = 0.3;
          say(e, 'TEM MÓVEL NOVO NO ALVORADA!', 2.0);
          pose(jj, 'point', 1.5);
        } else if (a.step === 1 && a.t >= a.next) {
          const h = cardPos(e, jj); // a mão que aponta
          fan(b, h.x, h.y, G.aim(h.x, h.y), pN(JN.SOFA_N, lv), JX.SOFA_SPREAD, JN.SOFA_SPD, { style: 'jan_sofa', color: COL.violet });
          sfx('enemy_shot');
          a.n++; a.next += JX.SOFA_GAP;
          if (a.n >= JX.SOFA_FANS) { a.step = 2; a.end = a.t + 0.3; }
        } else if (a.step === 2 && a.t >= a.end) endAttack(e, jj);
        break;
      }
      default: endAttack(e, jj);
    }
  }
  // colunas de aviso: só enquanto o foguete existe e ainda espera (limpeza de tiros, tonto e bomba apagam junto)
  function pruneRockets(jj) {
    const L = jj.rk;
    for (let i = L.length - 1; i >= 0; i--) { const bl = L[i].bl; if (!bl || bl.dead || !(bl.delay > 0)) L.splice(i, 1); }
  }

  // ======================================================================
  // Movimento: parada (balança ±3 px) → "VIAGEM OFICIAL" (sai pela borda mais perto, fica fora, entra pela outra)
  // ======================================================================
  function updMove(e, jj, dt, frozen) {
    switch (jj.mv) {
      case 'dwell': {
        if (!frozen) { jj.mvT += dt; jj.bobT += dt; }
        e.x = stopX(jj.stop); e.y = JN.Y + Math.sin(jj.bobT * 2.2) * 3;
        jj.rot = M.approach(jj.rot, 0, dt * 1.5); jj.thrust = M.approach(jj.thrust, 0, dt * 3);
        if (!frozen && jj.mvT >= jj.dwell && !jj.atk && !(jj.shrugT > 0)) {
          jj.mv = 'out'; jj.mvT = 0; jj.x0 = e.x; jj.x1 = edgeX(jj.stop);
          if (Math.random() < 0.5) say(e, 'VIAGEM OFICIAL!', 1.5);
          sfx('whoosh');
        }
        break;
      }
      case 'out': {
        if (frozen) { jj.mv = 'in'; jj.mvT = 0; jj.x0 = e.x; jj.x1 = stopX(jj.stop); break; } // o Lule tonto: ela volta
        jj.mvT += dt;
        const k = M.clamp(jj.mvT / JN.OUT, 0, 1), dir = jj.x1 > jj.x0 ? 1 : -1;
        e.x = M.lerp(jj.x0, jj.x1, M.easeInCubic(k)); e.y = JN.Y - Math.sin(k * PI) * 6;
        jj.rot = dir * 0.2 * Math.min(1, k * 3); jj.thrust = 1;
        if (k >= 1) { jj.mv = 'off'; jj.mvT = 0; }
        break;
      }
      case 'off': {
        jj.mvT += dt;
        if (frozen || jj.mvT >= JN.OFF) {
          jj.stop = 1 - jj.stop; jj.mv = 'in'; jj.mvT = 0;
          jj.x0 = edgeX(jj.stop); jj.x1 = stopX(jj.stop); e.x = jj.x0;
        }
        break;
      }
      case 'in': {
        jj.mvT += dt;
        const k = M.clamp(jj.mvT / JN.IN, 0, 1), dir = jj.x1 > jj.x0 ? 1 : -1;
        e.x = M.lerp(jj.x0, jj.x1, M.easeOutCubic(k)); e.y = JN.Y - Math.sin(k * PI) * 6;
        jj.rot = dir * 0.2 * (1 - k); jj.thrust = 1 - k * 0.6;
        if (k >= 1) { jj.mv = 'dwell'; jj.mvT = 0; jj.dwell = M.rand(JN.DWELL[0], JN.DWELL[1]); jj.atkT = Math.max(jj.atkT, JX.ARRIVE); }
        break;
      }
    }
    // rastro dos bocais na viagem
    if (jj.thrust > 0.5 && Math.random() < 0.6 * decoK()) {
      G.part({ x: e.x + M.rand(-20, 20), y: e.y + 46 + SY, vx: -Math.sign(jj.rot || 1) * 40, vy: 30, type: 'smoke', size: 4, life: 0.4, color: 'rgba(240,240,245,0.4)' });
    }
  }

  // ======================================================================
  // Entrada (jatinho + sofá), luta, embarque
  // ======================================================================
  function warmStep(jj) {
    if (!jj.warm) {
      jj.warm = [['jan_cartao', COL.red], ['jan_mala', COL.pink], ['jan_mala', COL.hot], ['jan_carimbo', COL.violet], ['jan_carimbo', COL.red],
        ['jan_foguete', COL.orange], ['jan_sofa', COL.violet]];
      for (const g of GRAWLIX) jj.warm.push(['jan_grawlix', g[0]]);
      if (G.Art && G.Art.prewarm) {
        G.call(G.Art, 'prewarm', [['idle', 'normal'], ['hold', 'laugh'], ['point', 'normal'], ['up', 'angry'], ['up', 'normal'], ['shrug', 'shock'], ['wave', 'laugh']]
          .map((q) => ({ spec: JANJ, size: PS, pose: q[0], mood: q[1] })));
      }
    }
    const q = jj.warm.shift();
    if (q) G.call(G.BulletStyles, 'sprite', q[0], q[1]);
  }
  function introDone(jj) {
    const f = jj.done;
    jj.done = null;
    if (f) { try { f(); } catch (err) { G.reportError(err, 'janjinha intro done'); } }
  }
  function updIntro(e, jj, b, dt) {
    jj.it += dt;
    const t = jj.it, J = jj.jet, W = G.W;
    warmStep(jj);
    if (J.on) {
      if (t < JX.JET_IN) {
        const k = t / JX.JET_IN;
        J.x = M.lerp(-90, stopX(1), M.easeOutCubic(k)); J.y = JX.JET_Y + Math.sin(k * PI) * 4;
      } else {
        J.vx = Math.max(J.vx, 80) + 900 * dt; J.x += J.vx * dt; J.y -= 70 * dt; J.a = -0.12;
        if (J.x > W + 110) J.on = false;
      }
      if (Math.random() < 0.7 * decoK()) G.part({ x: J.x - 34, y: J.y - 6, vx: -60, vy: M.rand(-8, 8), type: 'smoke', size: 4, life: 0.5, color: 'rgba(240,240,250,0.45)' });
    }
    e.x = stopX(1); e.y = JN.Y;
    if (jj.st === 'jet' && t >= JX.JET_IN) {
      // o jatinho larga o sofá
      jj.st = 'drop'; jj.exitT = 0;
      G.say(b, 'CHEGOU O REFORÇO!', 2.2);
      sfx('whoosh');
      G.burst(e.x, JX.JET_Y + 14, 10, { colors: ['#ffffff', '#ffd23f'], speed: 110, life: 0.4, size: 2.4 });
    }
    if (jj.st === 'drop') { jj.exitT += dt; if (jj.exitT >= JX.DROP) { jj.st = 'wait'; G.burst(e.x, e.y + 44 + SY, 8, { colors: ['#e8e8f0'], speed: 70, life: 0.4, type: 'smoke', size: 4 }); } }
    if (jj.st !== 'jet') jj.ropeIn = Math.min(1, jj.ropeIn + dt / JX.ROPE_IN);
    if (!jj.dlg && t >= JX.JET_IN + JX.DLG_AT) {
      jj.dlg = true;
      const S = G.STORY && G.STORY.boss && G.STORY.boss.lule, lines = S && S.janjinha;
      if (lines && lines.length && !G.debug.skipDialogue) G.dialogue(lines, () => introDone(jj));
      else jj.skipT = t + JX.SKIP_WAIT;
    }
    if (jj.skipT > 0 && t >= jj.skipT) { jj.skipT = 0; introDone(jj); }
  }
  function updEnter(e, jj, b, dt) {
    jj.it += dt; jj.bobT += dt;
    warmStep(jj);
    e.x = stopX(jj.stop); e.y = JN.Y + Math.sin(jj.bobT * 2.2) * 3;
    jj.ropeIn = Math.min(1, jj.ropeIn + dt / JX.ROPE_IN);
    e.invuln = true;
    if (jj.it >= JN.ENTER) {
      jj.st = 'fight'; e.invuln = false;
      jj.t = 0; jj.mv = 'dwell'; jj.mvT = 0; jj.dwell = M.rand(JN.DWELL[0], JN.DWELL[1]); jj.atkT = JX.FIRST;
    }
  }
  function updFight(e, jj, b, dt, g) {
    const frozen = stunned(b) || !fighting(b);
    if (fighting(b)) jj.t += dt; // relógio dela: tempo de luta (o tonto do Lule não para)
    if (jj.cardT > 0) {
      jj.cardT -= dt;
      if (jj.cardT <= 0) { jj.cardT = 0; say(e, 'SEGUNDA VIA!', 1.8); jj.glintT = 0.6; sfx('item'); }
    }
    if (jj.shrugT > 0) jj.shrugT -= dt;
    if (jj.glintT > 0) jj.glintT -= dt;
    // aos 75 s ela embarca sozinha (sem prêmio); espera chegar na parada e o Lule sair do tonto
    if (jj.t >= JN.LEAVE_T && !frozen && jj.mv === 'dwell' && !jj.atk) { startExit(e, jj, b, 'leave'); return; }
    updMove(e, jj, dt, frozen);
    e.invuln = !onScreen(e);
    // ataques: só parada, fora do tonto do Lule, fora do ombro encolhido; o Zé vivo
    if (!frozen && jj.mv === 'dwell' && !(jj.shrugT > 0)) {
      if (jj.atk) updAttack(e, jj, b, dt);
      else if (canShoot(b)) { jj.atkT -= dt; if (jj.atkT <= 0) beginAttack(e, jj); }
    }
    pruneRockets(jj);
    // falas soltas a cada 6–9 s; abaixo de 25% ela pede para remarcar o voo
    const frac = e.hp / e.maxHp;
    if (!frozen) {
      if (!jj.said25 && frac <= 0.25 && !(e.sayT > 0) && !jj.atk) { jj.said25 = true; say(e, CHAT_LOW, 2); jj.chatT = Math.max(jj.chatT, 3); }
      jj.chatT -= dt;
      if (jj.chatT <= 0) {
        if (!(e.sayT > 0) && !jj.atk) {
          const line = jj.said25 && Math.random() < 0.35 ? CHAT_LOW : M.pick(CHAT);
          say(e, line, 2);
          if (line === 'SORRI PRA SELFIE!') { pose(jj, 'hold', 1.4); mood(jj, 'laugh', 1.4); jj.flashT = 0.25; sfx('tink'); }
          jj.chatT = M.rand(JX.CHAT[0], JX.CHAT[1]);
        } else jj.chatT = 0.7;
      }
    }
  }
  // embarque: 'ko' (EMBARCOU PRO EXTERIOR!, com prêmio) ou 'leave' (HORA DO EMBARQUE!, sem prêmio)
  function startExit(e, jj, b, kind) {
    const g = G.game;
    jj.st = kind; jj.exit = kind; jj.exitT = 0; jj.atk = null;
    e.invuln = true; e.hp = Math.max(1, e.hp);
    jj.kx = e.x; jj.ky = e.y;
    jj.ropeOut = 0;
    jj.jet.on = true; jj.jet.x = -90; jj.jet.y = 80; jj.jet.vx = 0; jj.jet.a = 0; jj.jet.boarded = false;
    pose(jj, 'wave', JX.EXIT); mood(jj, 'laugh', JX.EXIT);
    if (kind === 'ko') {
      jj.ko = true;
      if (g) g.stamp = { text: 'EMBARCOU PRO EXTERIOR!', t: 0, x: e.x, y: e.y };
      say(e, 'TENHO VIAGEM OFICIAL!', 1.3);
      G.hitstop(0.1); G.shake(6); G.flash(0.3, '#ffffff');
      G.confetti(e.x, e.y, 14);
      sfx('stamp'); sfx('boss_hit');
      if (b) {
        G.say(b, 'VOLTA, JANJINHA!', 2.2);
        G.text(b.x, b.y + 90, 'CERIMONIAL DESFEITO!', { size: 13, color: '#ffd23f', stroke: true });
      }
    } else {
      jj.left = true;
      G.text(e.x, e.y + 30, 'HORA DO EMBARQUE!', { size: 13, color: '#ff3d7f', stroke: true });
      sfx('whoosh');
    }
    mirror(jj);
  }
  function updExit(e, jj, b, dt, g) {
    jj.exitT += dt;
    const t = jj.exitT, J = jj.jet, W = G.W;
    // o jatinho mergulha da esquerda e para na frente dela (0,3 → 1,1 s; mais alto, a barra do chefão o cobriria)
    if (t < 0.3) { J.x = -90; J.y = 80; }
    else if (t < 1.1) { const k = (t - 0.3) / 0.8; J.x = M.lerp(-90, jj.kx - 2, M.easeOutCubic(k)); J.y = M.lerp(80, jj.ky - 14, M.easeOutCubic(k)); J.a = 0.12 * (1 - k); }
    else {
      if (!J.boarded) { J.boarded = true; sfx('whoosh'); G.burst(jj.kx, jj.ky - 30, 8, { colors: ['#ffffff', '#ff3d7f'], speed: 80, life: 0.35, size: 2 }); }
      J.vx = Math.max(J.vx, 60) + 950 * dt; J.x += J.vx * dt; J.y -= 50 * dt; J.a = -0.1;
    }
    if (J.on && Math.random() < 0.7 * decoK()) G.part({ x: J.x - 34, y: J.y - 6, vx: -60, vy: M.rand(-8, 8), type: 'smoke', size: 4, life: 0.5, color: 'rgba(240,240,250,0.45)' });
    // o sofá vai atrás do jatinho, com rastro
    if (t > 1.25) {
      const tx = J.x - 70;
      e.x = M.approach(e.x, Math.max(e.x, tx), (300 + 700 * (t - 1.25)) * dt);
      e.y = M.approach(e.y, J.y + 40, 140 * dt);
      jj.rot = 0.18; jj.thrust = 1;
      if (Math.random() < 0.8 * decoK()) G.part({ x: e.x - 30, y: e.y + 38 + SY, vx: -50, vy: 10, type: 'smoke', size: 5, life: 0.5, color: 'rgba(240,240,245,0.45)' });
    }
    if (t >= JX.EXIT) finishExit(e, jj);
  }
  function finishExit(e, jj) {
    const ko = jj.exit === 'ko', x = jj.kx, y = jj.ky;
    jj.st = 'gone'; jj.gone = true; jj.jet.on = false;
    if (!e.dead) G.killEnemy(e, { silent: true });
    if (ko) {
      // prêmio do EMBARQUE IMEDIATO (no lugar onde ela foi derrotada, dentro da tela)
      G.addScore(JN.SCORE, x, y, true);
      G.dropPix(x, y, JN.PIX);
      G.drop('bomb', x, y, { vy: -60 });
      G.addApproval(10);
      G.unlock('embarcou');
    }
    mirror(jj);
  }
  // b.mech.janj = { up, ko, left, t } (um objeto reaproveitado)
  function mirror(jj) {
    const m = jj.mj, b = jj.b;
    m.up = isUp(jj); m.ko = jj.ko; m.left = jj.left; m.t = Math.round(jj.t * 10) / 10;
    if (b && b.mech) b.mech.janj = m;
  }

  // ======================================================================
  // Desenho
  // ======================================================================
  const FIG = { t: 0, pose: 'idle', mood: 'smug', mouth: 0, facing: 1, fl: false, card: true, glint: 0, flashT: 0, rot: 0, sc: 1, fig: 1, thrust: 0, lookX: 0, lookY: 0, tagA: 0 };
  function flames(c, t, k) {
    const L = 5 + 4 * k + Math.sin(t * 40) * 1.5;
    for (const nx of [-18, 18]) {
      c.beginPath(); c.moveTo(nx - 3.6, 44 + SY); c.quadraticCurveTo(nx, 44 + SY + L * 1.6, nx + 3.6, 44 + SY); c.closePath();
      c.fillStyle = '#ff8c1a'; c.fill();
      c.beginPath(); c.moveTo(nx - 1.8, 44 + SY); c.quadraticCurveTo(nx, 44 + SY + L, nx + 1.8, 44 + SY); c.closePath();
      c.fillStyle = '#fff1b0'; c.fill();
    }
  }
  function sparkle(c, x, y, r, a) {
    c.save(); c.globalAlpha *= a; c.translate(x, y);
    c.beginPath();
    for (let i = 0; i < 8; i++) { const q = i % 2 ? r * 0.28 : r, an = (i * PI) / 4; c.lineTo(Math.cos(an) * q, Math.sin(an) * q); }
    c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#ffd23f'; c.stroke();
    c.restore();
  }
  // ela no sofá (origem = e.x, e.y): costas → malas → pessoa → frente do sofá → etiqueta → cartão e celular
  function drawFigure(c, x, y, F) {
    c.save();
    c.translate(x, y);
    if (F.rot) c.rotate(F.rot);
    if (F.sc !== 1) c.scale(F.sc, F.sc);
    flames(c, F.t, F.thrust);
    blit(c, sBack(F.fl), 0, SY);
    if (F.fig > 0) {
      const a0 = c.globalAlpha;
      c.globalAlpha = a0 * F.fig;
      G.Art.person(c, 0, PY, PS, JANJ, { t: F.t, mood: F.mood, mouth: F.mouth, flash: F.fl, pose: F.pose, facing: F.facing, lookX: F.lookX, lookY: F.lookY, autoLook: false });
      c.globalAlpha = a0;
    }
    blit(c, sFront(F.fl), 0, SY);
    // etiqueta "MÓVEL NOVO" balançando no braço do sofá (lado de fora)
    c.save(); c.translate(34 * -F.facing, 37 + SY); c.rotate(Math.sin(F.t * 3.1) * 0.22 + F.tagA); blit(c, sTag(F.fl), 0, 0); c.restore();
    if (F.fig > 0) {
      const a0 = c.globalAlpha;
      c.globalAlpha = a0 * F.fig;
      // as duas malas em pé nos braços do sofá (embarcam com ela)
      blit(c, sMala(0, F.fl), -35 * F.facing, 22 + SY - 10);
      blit(c, sMala(1, F.fl), 35 * F.facing, 22 + SY - 10);
      const h = hands(F.pose, F.t, F.facing), f = F.facing;
      let cx, cy, px, py, crot, prot;
      if (F.pose === 'point') { cx = h.rx + 3 * f; cy = h.ry - 3; crot = -0.3 * f; px = h.lx; py = h.ly - 5; prot = 0; }
      else if (F.pose === 'hold') { cx = h.lx - 17 * f; cy = h.ly + 1; crot = 0.22 * f; px = h.rx + 2 * f; py = h.ry - 7; prot = 0.12 * f; }
      else { cx = h.lx - 4 * f; cy = h.ly - 4; crot = (F.pose === 'up' ? -0.35 : 0.12) * f; px = h.rx + 1 * f; py = h.ry - 6; prot = F.pose === 'up' ? -0.25 * f : 0.1 * f; }
      if (F.card) { c.save(); c.translate(cx, cy); c.rotate(crot); blit(c, sCard(F.fl), 0, 0); c.restore(); if (F.glint > 0 && !F.fl) sparkle(c, cx + 8 * f, cy - 5, 7 + 3 * Math.sin(F.t * 30), 1); }
      c.save(); c.translate(px, py); c.rotate(prot); blit(c, sPhone(F.fl), 0, 0); c.restore();
      if (F.flashT > 0 && !F.fl) sparkle(c, px, py - 6, 12, Math.min(1, F.flashT * 5));
      c.globalAlpha = a0;
    }
    c.restore();
  }
  function drawJet(c, J) {
    c.save(); c.translate(J.x, J.y); if (J.a) c.rotate(J.a); blit(c, sJet(), 0, 0); c.restore();
  }
  function draw(ctx, e, g) {
    const jj = e.data.jj; if (!jj || jj.st === 'gone') return;
    const F = FIG, p = pl(), t = e.t, st = jj.st;
    F.t = t; F.facing = facingOf(jj); F.fl = jj.fl > 0; F.card = !(jj.cardT > 0); F.glint = jj.glintT; F.flashT = jj.flashT;
    F.rot = jj.rot; F.sc = 1; F.fig = 1; F.thrust = jj.thrust; F.tagA = jj.rot * -1.5;
    F.pose = curPose(jj);
    let md = jj.moodT > 0 ? jj.mood : 'normal';
    if (st === 'fight' && (stunned(jj.b) || jj.shrugT > 0)) md = 'shock';
    F.mood = md;
    F.mouth = e.sayT > 0 ? 0.25 + 0.5 * Math.abs(Math.sin(t * 15)) : 0;
    F.lookX = M.clamp((p.x - e.x) / 120, -1, 1) * F.facing; F.lookY = M.clamp((p.y - e.y) / 220, -1, 1) * 0.7;
    let x = e.x, y = e.y;
    if (st === 'jet') { if (jj.jet.on) drawJet(ctx, jj.jet); return; } // ela ainda está no jatinho
    if (st === 'drop') {
      const k = M.clamp(jj.exitT / JX.DROP, 0, 1);
      F.sc = 0.45 + 0.55 * M.easeOutBack(k); y = M.lerp(JX.JET_Y + 4, JN.Y, M.easeOutCubic(k)); F.thrust = 1;
    }
    if (st === 'ko' || st === 'leave') {
      const tt = jj.exitT;
      F.flashT = 0;
      if (tt > 1.1) F.fig = M.clamp(1 - (tt - 1.1) / 0.18, 0, 1); // embarcou (com as duas malas)
      if (tt > 0.95 && tt < 1.3) { y -= (tt - 0.95) * 30; }
    }
    drawFigure(ctx, x, y, F);
    if (jj.jet.on) drawJet(ctx, jj.jet);
  }

  // ---------- o cordão do CERIMONIAL (na frente da churrasqueira do Lule) ----------
  const POSTS = [-92, -34, 34, 92];
  // o lule.js pode chamar em coordenadas do mundo ou ainda transladado no corpo dele: volta para o mundo
  function worldBegin(c) {
    c.save();
    if (!c.getTransform || !G.canvas || !G.W) return;
    const m = c.getTransform(), k = G.canvas.width / G.W;
    if (!(k > 0)) return;
    if (Math.abs(m.b) > 1e-4 || Math.abs(m.c) > 1e-4 || Math.abs(m.e / k) > 40 || Math.abs(m.f / k) > 40) c.setTransform(k, 0, 0, k, 0, 0);
  }
  function rope(c, x0, y0, x1, y1, sag) {
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
    c.lineWidth = 6; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 3.6; c.strokeStyle = '#b3122b'; c.stroke();
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,120,140,0.7)'; c.stroke();
  }
  function drawShield(ctx, b) {
    const jj = jjOf(b); if (!jj || !b) return;
    let fall = -1;
    if (jj.ropeOut >= 0) {
      // o cordão desaba (KO ou embarque) e some
      const e = jj.e;
      if (!e || e.dead) jj.ropeOut += 1 / 60; // (sem o update dela: anda pelo desenho)
      fall = jj.ropeOut;
      if (fall > JX.ROPE_FALL) return;
    } else if (!isUp(jj)) return;
    const up = M.clamp(jj.ropeIn, 0, 1);
    if (up <= 0) return;
    const c = ctx, bob = Math.sin(b.t * 2.4) * 3, by = b.y + bob + 76, t = b.t;
    worldBegin(c);
    const open = stunned(b) && fall < 0; // o Leão fura o cordão: o do meio solta
    const rise = (1 - M.easeOutBack(up)) * 24;
    const S = sPost();
    const a = fall >= 0 ? M.clamp(1 - fall / JX.ROPE_FALL, 0, 1) : 1;
    c.globalAlpha = a;
    // pontas de cima dos postes (com a queda: giram para fora e caem)
    let x0 = 0, y0 = 0;
    for (let i = 0; i < 4; i++) {
      const s = i < 2 ? -1 : 1, px = b.x + POSTS[i], k = fall >= 0 ? M.easeInCubic(M.clamp(fall / 0.6, 0, 1)) : 0;
      const ang = s * 1.4 * k, py = by + rise + 30 * k * k;
      const tx = px + Math.sin(ang) * 33, ty = py - Math.cos(ang) * 33;
      if (i > 0) {
        const sag = 12 + Math.sin(t * 2 + i) * 1.5 + 20 * (fall >= 0 ? M.clamp(fall / 0.6, 0, 1) : 0);
        if (i === 2 && open) {
          rope(c, x0, y0, x0 + 6, y0 + 22, 4); rope(c, tx, ty, tx - 6, ty + 22, 4);
        } else rope(c, x0, y0, tx, ty, sag);
      }
      c.save(); c.translate(px, py); c.rotate(ang); blit(c, S, 0, 0); c.restore();
      x0 = tx; y0 = ty;
    }
    c.restore();
  }
  // ---------- por cima dos tiros: colunas do foguete e a barra de HP dela ----------
  function drawRocketWarn(c, r, t) {
    const x = r.x, bl = r.bl, k = M.clamp(1 - bl.delay / r.warn, 0, 1);
    const a = 0.55 + 0.35 * Math.sin(t * 22);
    c.globalAlpha = a;
    c.lineCap = 'butt';
    c.setLineDash([10, 10]); c.lineDashOffset = -t * 120;
    c.beginPath(); c.moveTo(x, JX.ROCKET_Y + 12); c.lineTo(x, G.H);
    c.lineWidth = 6; c.strokeStyle = 'rgba(16,20,24,0.55)'; c.stroke();
    c.lineWidth = 3; c.strokeStyle = '#ff2a4a'; c.stroke();
    c.lineDashOffset = -t * 120 + 10; c.strokeStyle = '#ffffff'; c.stroke();
    c.setLineDash([]); c.lineDashOffset = 0;
    // a coluna "enche" de cima para baixo até o foguete sair
    c.globalAlpha = 0.18 + 0.12 * k;
    c.fillStyle = '#ff2a4a'; c.fillRect(x - 11, JX.ROCKET_Y + 12, 22, (G.H - JX.ROCKET_Y - 12) * k);
    c.globalAlpha = 1;
    txt(c, '!', x, JX.ROCKET_Y + 26, 11, '#ffffff', { font: G.FONT_DISPLAY, weight: '400', stroke: 3 });
  }
  function drawBar(c, e, jj, t) {
    const x = Math.round(M.clamp(e.x, BAR_W / 2 + 4, G.W - BAR_W / 2 - 4) - BAR_W / 2), y = Math.round(e.y + BAR_DY);
    const frac = M.clamp(e.hp / e.maxHp, 0, 1);
    c.fillStyle = 'rgba(8,12,22,0.75)'; c.fillRect(x - 2, y - 2, BAR_W + 4, BAR_H + 4);
    c.fillStyle = '#3a0d20'; c.fillRect(x, y, BAR_W, BAR_H);
    const boost = jj.st === 'fight' && stunned(jj.b);
    c.fillStyle = e.invuln ? '#9aa5b8' : boost ? (Math.sin(t * 20) > 0 ? '#ffd23f' : PINK) : PINK;
    c.fillRect(x, y, BAR_W * frac, BAR_H);
    c.font = '7px ' + G.FONT_DISPLAY; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = 2.5; c.strokeStyle = 'rgba(8,12,22,0.9)';
    c.strokeText('JANJINHA', x + BAR_W / 2, y + BAR_H + 7);
    c.fillStyle = '#ffffff'; c.fillText('JANJINHA', x + BAR_W / 2, y + BAR_H + 7);
  }
  function drawOver(ctx, b, g) {
    const jj = jjOf(b); if (!jj) return;
    const c = ctx, t = (g && g.t) || 0, e = jj.e;
    worldBegin(c);
    for (const r of jj.rk) if (r.bl && !r.bl.dead && r.bl.delay > 0) drawRocketWarn(c, r, t);
    c.globalAlpha = 1;
    if (e && !e.dead && (jj.st === 'wait' || jj.st === 'enter' || jj.st === 'fight') && onScreen(e)) {
      drawBar(c, e, jj, t); // (a mira "CARTÃO" do Leão nela é do lule.js, no J.box)
    }
    c.restore();
  }

  // ======================================================================
  // Inimigo 'janjinha' (o HP, o dano extra e o KO são dela; o core nunca a mata pelo dano)
  // ======================================================================
  function init(e, o, g) {
    const b = g && g.boss, jj = jjOf(b);
    e.data.jj = jj;
    if (jj) jj.e = e;
    const hpMul = (b && b.data && b.data.hpMul) || 1;
    e.hp = e.maxHp = JN.HP * hpMul;   // por cima dos multiplicadores do core (o 2º mandato e a PRESSÃO vêm do Lule)
    e.invuln = true; e.harmless = true;
    e.bubbleY = -(BAR_DY + 50);       // balão embaixo da barra de HP (em cima dela fica a barra do chefão)
  }
  function update(e, dt, g) {
    const jj = e.data.jj, b = g && g.boss;
    if (!jj || jj.e !== e || !b || jjOf(b) !== jj || jj.st === 'gone') { jj && (jj.st = 'gone'); G.killEnemy(e, { silent: true }); return; }
    if (jj.fl > 0) jj.fl -= dt;
    if (jj.flCd > 0) jj.flCd -= dt;
    if (jj.poseT > 0) jj.poseT -= dt;
    if (jj.moodT > 0) jj.moodT -= dt;
    if (jj.flashT > 0) jj.flashT -= dt;
    if (jj.ropeOut >= 0) jj.ropeOut += dt;
    switch (jj.st) {
      case 'jet': case 'drop': case 'wait': updIntro(e, jj, b, dt); break;
      case 'enter': updEnter(e, jj, b, dt); break;
      case 'fight': updFight(e, jj, b, dt, g); break;
      case 'ko': case 'leave': updExit(e, jj, b, dt, g); break;
    }
    mirror(jj);
  }
  function onHit(e, dmg) {
    const jj = e.data.jj;
    if (!jj || jj.st !== 'fight') return;
    // dano extra dela (inimigo não tem dmgMul): Lule tonto ×STUN_K, cansaço ×(1 + f)
    const mul = (stunned(jj.b) ? JN.STUN_K : 1) * (1 + fatK(jj));
    if (mul > 1) e.hp -= dmg * (mul - 1);
    e.flash = 0; // o flash dela é próprio (≤ 3 por segundo)
    if (!(jj.flCd > 0)) { jj.fl = FLASH; jj.flCd = FLASH_CD; }
    if (e.hp <= 0) { e.hp = 1; e.invuln = true; startExit(e, jj, jj.b, 'ko'); }
  }
  function onDeath(e) {
    const jj = e.data.jj;
    if (!jj || jj.e !== e) return;
    if (jj.st === 'gone') return; // fim do próprio embarque ou J.clear: nada a fazer
    // morta por fora (fim da luta do Lule, troca de fase): sem prêmio, só some
    jj.st = 'gone'; jj.gone = true; jj.jet.on = false; jj.atk = null; jj.rk.length = 0;
    if (jj.ropeOut < 0) jj.ropeOut = JX.ROPE_FALL; // cordão some junto
    G.burst(e.x, e.y, 10, { colors: ['#e8e8f0', '#ff3d7f'], speed: 90, life: 0.4, type: 'smoke', size: 4 });
    mirror(jj);
    // (segurança) sumiu no meio da entrada: o Lule não fica esperando o diálogo
    const b = jj.b;
    if (jj.done && b && b.state === 'fight' && b.data && b.data.reviving) introDone(jj); else jj.done = null;
  }
  G.Enemies.define('janjinha', {
    hp: 1, r: JN.R, score: 0, pix: 0, big: false, harmless: true, keepOffscreen: true,
    ignoreClear: true, noPress: true, init, update, draw, onHit, onDeath,
  });

  // ======================================================================
  // API G.Janjinha (SPEC5 §2.4) — o lule.js chama tudo com guarda: const J = G.Janjinha;
  // ======================================================================
  const STATS0 = { up: false, ko: false, left: false, t: 0, hp: 0, maxHp: 0 };
  G.Janjinha = {
    JN,
    // na 2ª vida do Lule, uma vez por luta (nunca no Quinto Mandato)
    enabled(b) { return !!(b && b.id === 'lule' && b.data && b.data.life === 2 && !b.data.jj && b.data.revTo !== 3); },
    intro(b, done) {
      const g = G.game, fin = typeof done === 'function' ? done : null;
      if (!g || !b || !b.data || b.data.jj) { if (fin) fin(); return; }
      const jj = b.data.jj = newState(b, fin);
      G.banner('E NÃO VEIO SOZINHO!', 'JANJINHA — A MINISTRA SEM PASTA', { color: '#ff3d7f', dur: 2.4 });
      sfx('whoosh'); sfx('rocket');
      const e = G.spawnEnemy('janjinha', stopX(1), JN.Y, {});
      if (!e || jj.e !== e) { jj.st = 'gone'; jj.gone = true; jj.jet.on = false; if (e && !e.dead) G.killEnemy(e, { silent: true }); introDone(jj); return; }
      mirror(jj);
    },
    start(b) {
      const jj = jjOf(b); if (!jj || !jj.e || jj.e.dead) return;
      if (!(jj.st === 'jet' || jj.st === 'drop' || jj.st === 'wait')) return;
      const e = jj.e;
      jj.st = 'enter'; jj.it = 0; jj.jet.on = false; jj.ropeIn = Math.max(jj.ropeIn, 0.01);
      e.x = stopX(jj.stop); e.y = JN.Y; e.invuln = true;
      say(e, 'O CERIMONIAL É COMIGO!', 2.4);
      pose(jj, 'up', 1.0);
      sfx('stamp');
      mirror(jj);
    },
    up(b) { return isUp(jjOf(b)); },
    shieldMul(b) { return isUp(jjOf(b)) ? JN.SHIELD : 1; },
    setFloorAt(at) { if (typeof at === 'number' && at > 0 && at < 1) FLOOR_AT = at; },
    floor(b) { return b ? b.maxHp * (FLOOR_AT + 0.03) : 0; },
    // alvo do raio do Leão: ela inteira (o Leão morde o cartão); null fora da tela, invulnerável ou sem cartão
    box(b) {
      const jj = jjOf(b); if (!jj || jj.st !== 'fight' || jj.cardT > 0) return null;
      const e = jj.e; if (!e || e.dead || e.invuln || e.x < 30 || e.x > G.W - 30) return null;
      const o = jj.box; o.x = e.x; o.y = e.y; o.r = JN.R;
      return o;
    },
    // CARTÃO BLOQUEADO (SPEC5 §8.7): o Leão morde o CARTÃO, nunca ela
    lionBite(b, L) {
      const jj = jjOf(b); if (!jj || jj.st !== 'fight') return;
      const e = jj.e; if (!e || e.dead) return;
      const P = cardPos(e, jj), x = P.x, y = P.y;
      G.text(x, y + 40, 'CARTÃO BLOQUEADO!', { size: 15, color: '#ffd23f', stroke: true });
      say(e, 'MEU CARTÃO!', 1.8);
      jj.shrugT = 1.6; jj.cardT = JN.CARD_BACK; jj.glintT = 0; mood(jj, 'shock', 1.6);
      if (jj.atk && jj.atk.kind === 'cartao') endAttack(e, jj); // o leque que ia sair fica sem cartão
      G.count('cartao'); G.unlock('cartao');
      if (b.mech) b.mech.ok++;
      G.burst(x, y, 12, { colors: ['#ffd23f', '#ffffff'], speed: 140, life: 0.4, size: 2.4 });
      G.hitstop(0.06); G.shake(5); sfx('bite'); sfx('stamp');
      // 20% do HP dela (o cansaço e o tonto do Lule ainda multiplicam, no onHit)
      if (!e.invuln) G.hitEnemy(e, e.maxHp * JN.LION_DMG);
      mirror(jj);
    },
    goal(b) {
      const jj = jjOf(b); if (!jj || !(jj.st === 'enter' || jj.st === 'fight')) return null;
      const e = jj.e; if (!e || e.dead || !onScreen(e)) return null;
      const o = jj.goal; o.x = e.x; o.y = e.y;
      return o;
    },
    drawShield,
    drawOver,
    // remoção silenciosa (revive / fim da luta / Quinto Mandato): um puf, sem prêmio
    clear(b, why) {
      const jj = jjOf(b); if (!jj || jj.st === 'gone') return;
      const e = jj.e;
      jj.st = 'gone'; jj.gone = true; jj.done = null; jj.jet.on = false; jj.atk = null;
      for (const r of jj.rk) if (r.bl && r.bl.delay > 0) r.bl.dead = true;
      jj.rk.length = 0;
      if (jj.ropeOut < 0) jj.ropeOut = JX.ROPE_FALL;
      if (e && !e.dead) {
        G.burst(e.x, e.y, 12, { colors: ['#e8e8f0', '#ff3d7f'], speed: 100, life: 0.45, type: 'smoke', size: 5 });
        G.killEnemy(e, { silent: true });
      }
      jj.why = why || '';
      mirror(jj);
    },
    stats(b) {
      const jj = jjOf(b); if (!jj) return STATS0;
      const o = jj.stats, e = jj.e;
      o.up = isUp(jj); o.ko = jj.ko; o.left = jj.left; o.t = jj.t;
      o.hp = e && !e.dead ? e.hp : 0; o.maxHp = e ? e.maxHp : 0;
      return o;
    },
  };

  // ======================================================================
  // Retrato (diálogos): busto com o celular erguido e o cartão à mostra
  // ======================================================================
  G.Portraits.define('janjinha', function (ctx, x, y, size, o) {
    o = o || {};
    const t = o.t || 0, md = o.mood || 'normal', s = size / 100;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.clip();
    const sp = size * 1.2, py = y + size * 0.16, k = sp / 100;
    G.Art.person(ctx, x, py, sp, JANJ, { t, mood: md, mouth: o.mouth, pose: 'up', facing: 1, lookX: o.lookX != null ? o.lookX : 0.3, lookY: 0.1, autoLook: false });
    let hl = { x: -28 * k, y: -7 * k }, hr = { x: 28 * k, y: -7 * k };
    if (G.Art.personAnchors) { const A = G.Art.personAnchors(sp, { pose: 'up', t, seed: JANJ.seed, facing: 1 }); hl = A.handL; hr = A.handR; }
    ctx.save(); ctx.translate(x + hr.x + 1 * k, py + hr.y - 6 * k); ctx.rotate(-0.2); ctx.scale(k * 1.1, k * 1.1); paintPhone(ctx, false); ctx.restore();
    ctx.save(); ctx.translate(x + hl.x + 2 * k, py + hl.y + 4 * k); ctx.rotate(-0.24); ctx.scale(k * 0.95, k * 0.95); paintCard(ctx, false); ctx.restore();
    if (md === 'laugh' || md === 'smug' || md === 'normal') sparkle(ctx, x + hr.x + 4 * k, py + hr.y - 16 * k, 6 * s, 0.6 + 0.4 * Math.sin(t * 6));
    ctx.restore();
  });
})();
