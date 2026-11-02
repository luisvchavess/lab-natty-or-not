/* ============================================================
   FUSCA A JATO — taxad.js
   Chefão 4: FERNANDO TAXAD, "O Taxador-Geral" (paródia de Fernando Haddad, ex-titular da Fazenda, e do meme
   "Taxad"), no Ministério da Fazenda. Manha: ACHAR — "CADÊ O SEU DINHEIRO?": ele esconde o dinheiro do Zé (o saco
   'SEU PIX') num de 3 cofres, embaralha e o Fusca encosta no cofre certo. Acertou = "RESTITUIÇÃO!" (tonto ×2,3);
   errou ou demorou = ALÍQUOTA, uma armadura que acumula (×0,9 / ×0,8 / ×0,7). Cansaço sempre termina a luta.
   (+ retrato dos diálogos e estilos de tiro 'tx_'). Contrato: docs/ENGINE.md §5 e §5.1, SPEC5 §6.
   Usa G.BossKit (bosses.js), obrigatório: sem ele o módulo avisa e não registra o chefão.

   Regras de conteúdo (ENGINE §7 + SPEC5 §1.2) — valem para texto, arte, som e comentários deste arquivo:
   - Material: impostos, a taxa das blusinhas, o arcabouço fiscal, o déficit zero, o IOF, o boato da taxa do Pix
     como sátira ("NÃO VAI TAXAR O PIX... AINDA!"), calculadora, a Receita e o Leão, o Impostômetro e a opacidade
     fiscal ("mudei só o nome").
   - Nenhuma palavra de crime (nem em comentário): o jogo dos cofres é sobre imposto que some no gasto público e
     nunca vira acusação.
   - Ele já saiu da Fazenda: todo texto é atemporal (nunca o cargo no presente) e nada sobre a eleição de 2026.
   - Desenho: o rosto chibi padrão, sem traço exagerado e sem óculos; o resto fica no terno, na calculadora, na
     caixa registradora voadora e no taxímetro. Dignidade de desenho animado: ninguém se machuca; ele perde e vai
     embora de táxi, com a bandeira 2 ligada.
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Bosses) return;
  const K = G.BossKit;
  if (!K) { if (G.reportError) G.reportError('taxad.js: G.BossKit ausente', 'taxad'); return; }
  const M = G.m, PI = Math.PI;
  const { COL, INK, WHITE, TAU, DOWN, sfx, L2, decoK, clamp, pl, say, MECH } = K;
  const sfxP = (n, a) => G.call(G.Audio, 'sfx', n, a); // som com parâmetro (o 'swap' sobe o tom a cada troca)

  // ---------- PRESSÃO e 5º turno (SPEC5 §2.2): do BossKit, com cópia local se o bosses.js ainda não tiver ----------
  const PRESS0 = { R: 0, lv: 0 };
  const press = K.press || (() => G.press || PRESS0);
  const pN = K.pN || function (n, lv) { if (lv == null) lv = press().lv; return n + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0); };
  const pRing = K.pRing || function (n, R) { if (R == null) R = press().R; return Math.round(n * (1 + 0.25 * (R || 0))); };
  const pW = K.pW || function (s, lv) { if (lv == null) lv = press().lv; return s * (lv >= 5 ? 0.82 : lv >= 3 ? 0.9 : 1); };
  const pLatch = K.pLatch || function (b) { const p = press(), d = b.data; d.pl = p.lv | 0; d.pR = p.R || 0; };
  const P5 = K.P5 || { LIMIT: 30, MUL: 1.5, TAG: { text: 'ÚLTIMO RECURSO', color: '#ff2a4a' }, TAG2: { text: 'SEM SAÍDA ×1,5', color: '#ff2a4a' } };
  const lastStand = K.lastStand || function (b) { const d = b.data; d.p5 = true; d.p5T0 = b.ft; d.p5Mul = 1; d.mechCd = 0; };
  const cpiCo = K.cpiCo || function* (b) {
    const d = b.data;
    for (;;) {
      yield () => d.pl === 5;
      yield pW(3.2, 5);
      if (d.pl !== 5 || d.stunT > 0 || d.hold) continue;
      const x = b.x, y = b.y + 40;
      K.fan(x, y, G.aim(x, y), 3, 0.4, 130, { style: 'small', color: '#ff2a4a' });
    }
  };
  const KIT_P5 = !!K.p5Update; // o fatigue() do BossKit já multiplica o SEM SAÍDA

  // ======================================================================
  // Afinação (SPEC5 §17, passe de balanço: HP → fatStart → tonto → cadência)
  // ======================================================================
  // HP a R = 0,75 (o core trava ×0,80…×1,07 pela PRESSÃO na chegada); HP_L2 = base do 2º mandato (o core põe ×1,25).
  const HP = 9000, HP_L2 = 7200;
  // Padrões (velocidades antes do spdK 1,15; esperas por pW, contagens por pN / pRing).
  // SWAY/OMEGA = balanço por turno; TELL = gaveta abrindo antes do tiro da gaveta; BOX_* = caixas da blusinha
  // (BOX_STEP rad entre caixas; ALF_Y·H = alfândega, onde cada caixa vira 3 blusinhas ±SPLIT_A rad a ×SPLIT_K:
  // com 0,45 / 0,24 as 3n blusinhas chegam no Zé como um pente com ≥ 42 px entre centros, ou seja ≥ 28 px livres
  // em qualquer pN; os 5 / 0,75 / ±0,32 do rascunho davam 4–12 px: parede); IMP_* = anel de DARFs;
  // KEY_* = teclas miradas da calculadora (KEY_ARC_K = intervalo com o arcabouço no ar); ARC_* = arcabouço
  // (moldura W×H, régua a cada STEP px andando para dentro, FURO px de saída); ZERO_* = o "00" (elipses RX×RY a
  // ±DX do meio, DY abaixo dele, bala a cada STEP px de contorno, ROMBO px sem bala a ±ROMBO_DX do centro de cada
  // zero); PIX_* = trens da maquininha (N balas a GAP px, DOWN rad para baixo); IOF_* = laser no x do carro.
  const TX = {
    SWAY: [50, 25, 60, 30, 70], OMEGA: [0.5, 0.45, 0.5, 0.45, 0.8], BOB: 6, GLIDE: 2.4,
    TELL: 0.45, BOX_N: 3, BOX_N_L2: 4, BOX_STEP: 0.45, BOX_SPD: 115, ALF_Y: 0.50, SPLIT_A: 0.24, SPLIT_K: 1.15,
    IMP_N: 16, IMP_SPD: 90, IMP_DELAY: 0.5, P1_WAIT: 2.6,
    KEY_EVERY: 1.8, KEY_N: 3, KEY_STEP: 0.09, KEY_SPD: 145, KEY_ARC_K: 1.5,
    ARC_W: 220, ARC_H: 150, ARC_TELE: 1.0, ARC_STEP: 12, ARC_SPD: 30, ARC_SPD_L2: 34, ARC_LIFE: 2.6, FURO: 50,
    P2_GAP1: 1.4, P2_GAP2: 1.0, P2_BOX_K: 0.7,
    ZERO_RX: 84, ZERO_RY: 66, ZERO_DX: 88, ZERO_DY: 90, ZERO_STEP: 13, ROMBO: 44, ROMBO_DX: 36, ZERO_DELAY: 0.8,
    ZERO_SPD: 70, ZERO_SPD_L2: 78, ZERO_EVERY: 3.2, ZERO_EVERY_L2: 2.8,
    PIX_EVERY: 0.9, PIX_EVERY_L2: 0.8, PIX_N: 5, PIX_GAP: 24, PIX_DELAY: 0.6, PIX_DOWN: 0.22, PIX_SPD: 120, PIX_SPD_L2: 135,
    PIX_Y0: 0.40, PIX_Y1: 0.62, PIX_ROW_MIN: 34, PIX_GLIDE: 0.4, MQ_X: 14,
    IOF_EVERY: 5, IOF_WARN: 1.0, IOF_LIFE: 0.5, IOF_W: 22,
    P5_SPD: 1.12, P5_REST: 0.6, P5_TRAINS: 3, P5_ZERO_WAIT: 2.5, CHAT: [7, 10],
  };
  // A manha ACHAR (SPEC5 §6.5). Por turno (índice 0..4): SW s por troca, SWAPS trocas, GAP s entre trocas, FEINT trocas
  // que voltam a 40%, RELABEL plaquinhas voando no meio, ROT uma troca vira rodízio dos 3, DRIFT ±px no "escolha",
  // PICK s para escolher, STUN/MUL o tonto, NEXT s (relógio, fora do tonto) até a próxima rodada.
  // ALIQ = armadura por ALÍQUOTA 0..3; REFUND = Pix do saco; SW_MIN / PICK_MIN = pisos com 2º mandato e PRESSÃO.
  const CF = {
    ROW_Y: 0.46, PICK_Y: 0.64, X: [0.25, 0.5, 0.75], W: 40, H: 36, TOUCH_R: 18, ARC: 28, FIRST: 5.0,
    SHOW: 1.2, DROP: 0.5,
    SW: [0.62, 0.56, 0.50, 0.46, 0.42],
    SWAPS: [3, 4, 5, 5, 6],
    GAP: [0.14, 0.12, 0.10, 0.10, 0.08],
    FEINT: [0, 0, 0, 1, 1],
    RELABEL: [0, 0, 1, 1, 1],
    ROT: [0, 0, 0, 0, 1],
    DRIFT: [0, 0, 0, 0, 18],
    PICK: [3.2, 3.0, 2.8, 2.6, 2.4],
    STUN: [3.5, 3.5, 4.0, 4.0, 5.0],
    MUL: [2.3, 2.3, 2.3, 2.3, 2.5],
    NEXT: [10, 9, 9, 8, 6],
    ALIQ: [1, 0.9, 0.8, 0.7], REFUND: 14, SW_MIN: 0.30, PICK_MIN: 2.0,
    DEMO_SW: 0.9, DEMO_SWAPS: 2,
    REL_DUR: 0.5, REL_FLY: 0.35, CANCEL_NEXT: 2.5, DEATH_NEXT: 3.0,
  };
  // Tiros durante a rodada (d.hold: as corrotinas param; nunca laser, moldura nem "00").
  const ROUND = {
    FIRST: 0.9, KEY: 1.6, KEY_N: 3, KEY_SPREAD: 0.18, KEY_SPD: 145,
    RING_P2: 2.4, RING_P2_N: 8, RING_SPD: 90,
    FAN_P3: 1.5, FAN_SPREAD: 0.3,
    SPIRAL: 0.25, SPIRAL_ARMS: 2, SPIRAL_SPD: 90, SPIRAL_W: 0.42,
    P5: 1.6, RING_P5_N: 10,
  };

  // ======================================================================
  // Visual (SPEC5 §6.2). Tudo em px relativo ao centro do chefão (b.x, b.y).
  // ======================================================================
  const TAXAD = { skin: '#e9b896', face: 'oval', nose: 'small', hair: 'short', hairColor: '#9aa0a8', templeColor: '#c9cdd3',
    glasses: null, brows: 'normal', browColor: '#6b7079', body: 'suit', suit: '#2a3346', shirt: '#eef2f7', tie: '#c8102e', seed: 57 };
  const TAXAD_SWEAT = Object.assign({}, TAXAD, { sweat: true });
  const TX_SIZE = 116, SC = TX_SIZE / 100;
  const PY = -22;                          // a pessoa fica centrada em (0, PY)
  const HY = PY - 14 * SC, HR = 27 * SC;   // centro e raio da cabeça
  const TX_HB = [[0, 50, 34], [0, 6, 24], [0, -36, 28]]; // a caixa registradora primeiro (segura o jato d'água)
  const HB = TX_HB.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
  const LCD = ['+20%', 'TETO', '0,00', 'IOF', 'TUDO'];
  const PLATES = ['IMPOSTO', 'TAXA', 'CONTRIB.'];
  const ALIQ_TAG = [null, { text: 'ALÍQUOTA 10%', color: '#ff8c1a' }, { text: 'ALÍQUOTA 20%', color: '#ff8c1a' }, { text: 'ALÍQUOTA 30%', color: '#ff8c1a' }];
  const LED_AMBER = '#ffcf40', LED_ORANGE = '#ff8c1a', LED_RED = '#ff2a4a';

  const CHAT = ['É SÓ UMA TAXINHA!', 'CPF NA NOTA?', 'É RECOMPOSIÇÃO DA BASE!', 'FAZ O CÁLCULO, ZÉ!', 'QUEM TEM MAIS, PAGA MAIS!',
    'TEM TAXA PRA ISSO!', 'ARRECADAR É AMAR!', 'TÁ AQUI... OU AQUI?', 'QUAL É O COFRE?'];
  const STUN_SAY = ['DEVOLVEU?! COMO ASSIM?', 'ISSO NÃO TAVA NA CONTA!', 'ERRO DE ARREDONDAMENTO!'];
  const MISS_TXT = ['SÓ TEM DÉFICIT!', 'VIROU GASTO!', 'FOI PRO ARCABOUÇO!'];

  // ---------- sprites na resolução do aparelho (partes paradas: baratas de desenhar; mesmo esquema da erika.js) ----------
  const SPR = new Map();
  let sprRes = 0;
  const devRes = () => (G.canvas && G.W ? G.canvas.width / G.W : 1);
  const fontKey = () => (document.fonts ? document.fonts.status : '');
  // box = [x, y, w, h] (px lógicos, relativo à âncora)
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
      try { paint(x); } catch (err) { G.reportError(err, 'taxad sprite ' + key); }
    }
    s = { cv, box };
    if (SPR.size > 90) SPR.delete(SPR.keys().next().value);
    SPR.set(key, s);
    return s;
  }
  function blit(c, s, x, y) { const B = s.box; c.drawImage(s.cv, x + B[0], y + B[1], B[2], B[3]); }
  function stroke2(c, w1, c2, w2) { c.lineWidth = w1; c.strokeStyle = INK; c.stroke(); c.lineWidth = w2; c.strokeStyle = c2; c.stroke(); }

  // ---------- pintores (vetor; os sprites e o retrato usam os mesmos) ----------
  // '%' em caminho (dois círculos; o traço é feito à parte), nunca glifo de texto no jogo
  function pctRings(c, x, y, s) {
    c.moveTo(x - 0.3 * s + 0.2 * s, y - 0.3 * s); c.arc(x - 0.3 * s, y - 0.3 * s, 0.2 * s, 0, TAU);
    c.moveTo(x + 0.3 * s + 0.2 * s, y + 0.3 * s); c.arc(x + 0.3 * s, y + 0.3 * s, 0.2 * s, 0, TAU);
  }
  function pctSlash(c, x, y, s) { c.moveTo(x + 0.36 * s, y - 0.48 * s); c.lineTo(x - 0.36 * s, y + 0.48 * s); }
  // broche dourado '%' na lapela
  function pctPin(c, x, y) {
    c.beginPath(); K.O(c, x, y, 3.9); K.inked(c, '#ffd23f', 1);
    c.beginPath(); pctRings(c, x, y, 4.6); pctSlash(c, x, y, 4.6); c.lineWidth = 0.85; c.strokeStyle = '#6b4c00'; c.stroke();
  }
  // CAIXA DA UNIÃO: a caixa registradora voadora embaixo dele (72×46: y 28..74)
  const REG_BOX = [-40, 24, 90, 56];
  function paintRegister(c, fl) {
    const C = (col) => (fl ? WHITE : col);
    // manivela do lado direito
    c.beginPath(); c.moveTo(35, 46); c.lineTo(44, 46); c.lineTo(44, 37); stroke2(c, 3.4, C('#8b93a7'), 1.7);
    c.beginPath(); K.O(c, 44, 35.5, 2.8); K.inked(c, C('#e63946'), 1.1);
    // caixa da gaveta e o painel inclinado das teclas
    K.rr(c, -36, 50, 72, 24, 3); K.inked(c, C('#d9d2c3'), 2.6);
    c.beginPath(); c.moveTo(-29, 28.5); c.lineTo(29, 28.5); c.lineTo(35, 51); c.lineTo(-35, 51); c.closePath(); K.inked(c, C('#e8e1d1'), 2.4);
    if (fl) return;
    K.rr(c, -24, 30.6, 48, 6.2, 1.5); c.fillStyle = '#22304a'; c.fill();
    K.txt(c, 'CAIXA DA UNIÃO', 0, 33.8, 4.6, '#ffd23f', { maxW: 45 });
    // teclas vermelhas 3×5 (as de baixo mais abertas: o painel é inclinado)
    for (let r = 0; r < 3; r++) {
      const ky = 40 + r * 3.9, sp = 9 + r * 0.6;
      for (let k = 0; k < 5; k++) {
        K.rr(c, (k - 2) * sp - 3.2, ky - 1.5, 6.4, 3.1, 1); c.fillStyle = '#e63946'; c.fill();
        c.lineWidth = 0.7; c.strokeStyle = INK; c.stroke();
      }
    }
    // vão escuro da gaveta e o brilho da lataria
    K.rr(c, -31, 56.5, 62, 15, 2); c.fillStyle = '#23262f'; c.fill();
    c.beginPath(); c.moveTo(-32, 52.6); c.lineTo(32, 52.6); c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.stroke();
  }
  // frente da gaveta (desliza para fora no aviso): placa 'FAZENDA' dourada
  const DRW_BOX = [-32, -1, 64, 17];
  function paintDrawer(c, fl) {
    K.rr(c, -30, 0, 60, 14, 2); K.inked(c, fl ? WHITE : '#22304a', 1.6);
    if (fl) return;
    K.txt(c, 'FAZENDA', 0, 6.2, 7, '#ffd23f', { maxW: 44 });
    c.beginPath(); c.moveTo(-6, 11.6); c.lineTo(6, 11.6); c.lineWidth = 1.5; c.strokeStyle = '#8b93a7'; c.stroke();
  }
  // TAXÍMETRO em cima da caixa (o visor de LED é desenhado por cima)
  const TXM_BOX = [-18, 13, 36, 17];
  function paintTaximetro(c) {
    K.rr(c, -16, 14.5, 32, 13.5, 2); K.inked(c, '#15171c', 1.4);
    K.rr(c, -14.2, 16.2, 28.4, 7.2, 1); c.fillStyle = '#2a0b0b'; c.fill();
    K.txt(c, 'TAXÍMETRO', 0, 25.9, 3.6, '#c9cdd3', { maxW: 26 });
  }
  // LED: 'R$ 1.171.171.' (sprite por cor) + os 3 últimos dígitos em 7 segmentos (traços: nada de texto por quadro)
  const LEDP_BOX = [-14.2, 16, 21, 7.6];
  function paintLedPrefix(c, col) { K.txt(c, 'R$ 1.171.171.', -13.7, 19.9, 4.6, col, { align: 'left', maxW: 19.6 }); }
  const LEDT_BOX = [-14.2, 16, 28.4, 7.6];
  function paintLedText(c, s, col) { K.txt(c, s, 0, 19.9, 4.6, col, { maxW: 27.4 }); }
  const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
  function seg7(c, x, y, w, h, n) {
    const m = SEG[n] || 0, hh = h / 2;
    if (m & 1) { c.moveTo(x, y); c.lineTo(x + w, y); }
    if (m & 2) { c.moveTo(x + w, y); c.lineTo(x + w, y + hh); }
    if (m & 4) { c.moveTo(x + w, y + hh); c.lineTo(x + w, y + h); }
    if (m & 8) { c.moveTo(x, y + h); c.lineTo(x + w, y + h); }
    if (m & 16) { c.moveTo(x, y + hh); c.lineTo(x, y + h); }
    if (m & 32) { c.moveTo(x, y); c.lineTo(x, y + hh); }
    if (m & 64) { c.moveTo(x, y + hh); c.lineTo(x + w, y + hh); }
  }
  // bandeirinha do taxímetro ('1' → 'BANDEIRA 2' no 5º turno), pendurada à esquerda do mastro
  const FLAG_BOX = [-28, -1, 29, 8];
  function paintFlag(c, two) {
    const w = two ? 26 : 9;
    K.rr(c, -w, 0, w, 6, 1.2); K.inked(c, two ? '#e63946' : '#ffd23f', 0.9);
    K.txt(c, two ? 'BANDEIRA 2' : '1', -w / 2, 3.2, two ? 3.8 : 4.6, two ? '#ffffff' : INK, { maxW: w - 2 });
  }
  // calculadora gigante (16×22, visor verde-limão: nunca verde-água)
  const CALC_BOX = [-10, -13, 20, 26];
  function paintCalc(c, lab, fl) {
    K.rr(c, -8, -11.5, 16, 23, 2.6); K.inked(c, fl ? WHITE : '#a3aab5', 1.6);
    if (fl) return;
    K.rr(c, -6.2, -9.4, 12.4, 6.4, 1.2); c.fillStyle = '#a9dc7e'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#3b5a2a'; c.stroke();
    if (lab) K.txt(c, lab, 0, -6.1, lab.length > 4 ? 3.5 : 4.6, '#1d3a12', { maxW: 11.4 });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      K.rr(c, -5.6 + k * 4, -1 + r * 3.6, 3.2, 2.6, 0.8); c.fillStyle = r === 2 && k === 2 ? '#e63946' : '#f1f3f6'; c.fill();
    }
  }
  // o saco verde 'R$' com a etiqueta 'SEU PIX' (verde de dinheiro, nunca verde-água)
  const BAG_BOX = [-13, -16, 39, 31];
  function paintBag(c) {
    c.beginPath();
    c.moveTo(-4, -10); c.quadraticCurveTo(-12, -2, -10.5, 6); c.quadraticCurveTo(-9, 13, 0, 13);
    c.quadraticCurveTo(9, 13, 10.5, 6); c.quadraticCurveTo(12, -2, 4, -10); c.closePath();
    K.inked(c, '#2f9e44', 1.8);
    c.beginPath(); c.moveTo(-4, -10); c.lineTo(-6.5, -14); c.lineTo(0, -12); c.lineTo(6.5, -14); c.lineTo(4, -10); c.closePath(); K.inked(c, '#38b04f', 1.3);
    c.beginPath(); c.moveTo(-5, -10); c.lineTo(5, -10); c.lineWidth = 2.2; c.strokeStyle = '#ffd23f'; c.stroke();
    K.txt(c, 'R$', 0, 3, 8, '#ffffff', { stroke: 2 });
    c.beginPath(); c.moveTo(4.5, -10); c.lineTo(9, -8.5); c.lineWidth = 0.8; c.strokeStyle = INK; c.stroke();
    K.rr(c, 8.5, -12, 16.5, 7, 1.2); K.inked(c, '#fff6e0', 0.9);
    K.txt(c, 'SEU PIX', 16.75, -8.4, 4.2, INK, { maxW: 15.2 });
  }
  // cofre de aço (40×36: y -18..18) com tampa de cima, segredo dourado e contorno branco; open = tampa levantada
  const COF_BOX = [-24, -36, 48, 60];
  function paintCofre(c, open, fl) {
    const C = (col) => (fl ? WHITE : col);
    if (open && !fl) { c.beginPath(); c.moveTo(-17, -18); c.lineTo(17, -18); c.lineTo(14, -33); c.lineTo(-14, -33); c.closePath(); K.inked(c, '#4f5b6e', 1.6); }
    K.rr(c, -21.8, -19.8, 43.6, 40.6, 5); c.lineWidth = 1.4; c.strokeStyle = '#ffffff'; c.stroke();
    c.beginPath(); c.moveTo(-17, -18); c.lineTo(17, -18); c.lineTo(20, -12); c.lineTo(-20, -12); c.closePath(); K.inked(c, C(open ? '#14171d' : '#7a879b'), 1.6);
    K.rr(c, -20, -12, 40, 30, 3.5); K.inked(c, C('#5d6b80'), 2);
    if (fl) return;
    K.rr(c, -16.5, -9.5, 33, 25, 2.5); c.lineWidth = 1; c.strokeStyle = 'rgba(16,20,24,0.55)'; c.stroke();
    K.rr(c, -13.4, -9.2, 26.8, 7.4, 1.5); c.fillStyle = '#3f4a5b'; c.fill();
    c.beginPath(); K.O(c, 6, 7, 5.6); K.inked(c, '#ffd23f', 1.2);
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.moveTo(6 + Math.cos(a) * 3.5, 7 + Math.sin(a) * 3.5); c.lineTo(6 + Math.cos(a) * 5, 7 + Math.sin(a) * 5); }
    c.lineWidth = 0.7; c.strokeStyle = '#8a6a10'; c.stroke();
    c.beginPath(); K.O(c, 6, 7, 1.6); c.fillStyle = INK; c.fill();
    c.beginPath(); c.moveTo(-10, 3); c.lineTo(-10, 11); c.lineWidth = 2.4; c.strokeStyle = '#c9cdd3'; c.stroke();
    c.fillStyle = INK; c.fillRect(-16, 18, 6, 2.6); c.fillRect(10, 18, 6, 2.6);
  }
  // plaquinha do cofre (enfeite: o dinheiro nunca anda com ela)
  const PLATE_BOX = [-14, -4.6, 28, 9.2];
  function paintPlate(c, s) {
    K.rr(c, -12.5, -3.4, 25, 6.8, 1.4); K.inked(c, '#f4f1e8', 0.9);
    K.txt(c, s, 0, 0.3, 5.6, INK, { maxW: 23 });
  }
  // guarita da ALFÂNDEGA na borda da tela (enfeite; right = borda direita, âncora em x = G.W)
  function boothBox(right) { return right ? [-74, -18, 74, 30] : [0, -18, 74, 30]; }
  function paintBooth(c, right) {
    const bx = right ? -20 : 4;
    c.beginPath(); c.moveTo(bx - 1.5, -9); c.lineTo(bx + 8, -16); c.lineTo(bx + 17.5, -9); c.closePath(); K.inked(c, '#e63946', 1.2);
    K.rr(c, bx, -9, 16, 17, 1.5); K.inked(c, '#f4f1e8', 1.4);
    K.rr(c, bx + 3, -6, 10, 6, 1); c.fillStyle = '#8fc1ff'; c.fill();
    const a0 = right ? bx : bx + 16, a1 = right ? bx - 16 : bx + 32;
    c.beginPath(); c.moveTo(a0, 3); c.lineTo(a1, 3); c.lineWidth = 3.4; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.stroke(); c.setLineDash([3, 3]); c.strokeStyle = '#e63946'; c.stroke(); c.setLineDash([]);
    K.txt(c, 'ALFÂNDEGA', right ? bx - 26 : bx + 42, -4, 7, '#ffffff', { stroke: 2.4, maxW: 48 });
  }
  // maquininha de cartão (enfeite do 4º/5º turno: nunca acerta, nunca se toca)
  const MQ_BOX = [-12, -18, 24, 35];
  function paintMaquininha(c) {
    K.rr(c, -5.5, -17, 11, 7, 1); K.inked(c, '#e63946', 1);
    K.rr(c, -9, -12, 18, 27, 3.5); K.inked(c, '#2b2f3a', 1.6);
    K.rr(c, -6.5, -9, 13, 8, 1.2); c.fillStyle = '#ffd23f'; c.fill();
    K.txt(c, '+%', 0, -4.8, 5, INK, { maxW: 11 });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { K.rr(c, -6 + k * 4.4, 1.5 + r * 3.8, 3.4, 2.8, 0.8); c.fillStyle = '#c9cdd3'; c.fill(); }
  }
  // o TÁXI voador da saída (de lado, virado para a esquerda; sem capota: ele vai sentado e acenando)
  const TAXI_BOX = [-64, -44, 128, 74];
  function paintTaxi(c) {
    c.beginPath(); K.O(c, -36, 19, 7.5); K.O(c, 36, 19, 7.5); K.inked(c, '#2b2f3a', 1.6);
    c.beginPath(); K.O(c, -36, 19, 3); K.O(c, 36, 19, 3); c.fillStyle = '#c9cdd3'; c.fill();
    c.beginPath(); c.moveTo(24, -9); c.lineTo(28, -24); c.lineTo(36, -24); c.lineTo(36, -9); c.closePath(); K.inked(c, '#e8b830', 1.6); // encosto
    c.beginPath();
    c.moveTo(-60, 6); c.quadraticCurveTo(-60, -6, -46, -7); c.lineTo(-30, -9); c.lineTo(30, -9); c.lineTo(52, -7);
    c.quadraticCurveTo(60, -5, 60, 6); c.lineTo(60, 13); c.quadraticCurveTo(60, 18, 55, 18); c.lineTo(-55, 18);
    c.quadraticCurveTo(-60, 18, -60, 13); c.closePath();
    K.inked(c, '#ffd23f', 2.4);
    for (let i = 0; i < 22; i++) {
      c.fillStyle = i % 2 ? '#ffffff' : INK; c.fillRect(-55 + i * 5, 4, 5, 2.4);
      c.fillStyle = i % 2 ? INK : '#ffffff'; c.fillRect(-55 + i * 5, 6.4, 5, 2.4);
    }
    c.beginPath(); c.moveTo(-31, -9); c.lineTo(-23, -27); c.lineTo(-17, -27); c.lineTo(-23, -9); c.closePath(); K.inked(c, '#8fc1ff', 1.4);
    c.beginPath(); c.moveTo(-20, -27); c.lineTo(-20, -31); c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke();
    K.rr(c, -35, -41, 30, 10.5, 2); K.inked(c, '#ffffff', 1.4);
    K.txt(c, 'TÁXI', -20, -35.4, 7.5, INK, { maxW: 27 });
    K.rr(c, 2, -6.6, 32, 9, 1.6); K.inked(c, '#15171c', 1);
    K.txt(c, 'BANDEIRA 2', 18, -2.1, 4.6, '#ff4040', { maxW: 29 });
    c.beginPath(); K.E(c, -58, 10, 2.4, 3); c.fillStyle = '#fff6c2'; c.fill();
  }
  const regSpr = (fl) => sprite('reg' + (fl ? 'F' : '') + '|' + fontKey(), REG_BOX, (c) => paintRegister(c, fl));
  const drwSpr = (fl) => sprite('drw' + (fl ? 'F' : '') + '|' + fontKey(), DRW_BOX, (c) => paintDrawer(c, fl));
  const txmSpr = () => sprite('txm|' + fontKey(), TXM_BOX, paintTaximetro);
  const ledPreSpr = (col) => sprite('ledp|' + col + '|' + fontKey(), LEDP_BOX, (c) => paintLedPrefix(c, col));
  const ledTxtSpr = (s, col) => sprite('ledt|' + s + '|' + col + '|' + fontKey(), LEDT_BOX, (c) => paintLedText(c, s, col));
  const flagSpr = (two) => sprite('flag' + (two ? 2 : 1) + '|' + fontKey(), FLAG_BOX, (c) => paintFlag(c, two));
  const calcSpr = (lab, fl) => sprite('calc|' + (fl ? 'F' : lab) + '|' + fontKey(), CALC_BOX, (c) => paintCalc(c, lab, fl));
  const bagSpr = () => sprite('bag|' + fontKey(), BAG_BOX, paintBag);
  const cofreSpr = (open, fl) => sprite('cof' + (fl ? 'F' : open ? 'O' : 'C'), COF_BOX, (c) => paintCofre(c, open, fl));
  const plateSpr = (i) => sprite('plate|' + i + '|' + fontKey(), PLATE_BOX, (c) => paintPlate(c, PLATES[i]));
  const boothSpr = (right) => sprite('booth' + (right ? 'R' : 'L') + '|' + fontKey(), boothBox(right), (c) => paintBooth(c, right));
  const mqSpr = () => sprite('mq|' + fontKey(), MQ_BOX, paintMaquininha);
  const taxiSpr = () => sprite('taxi|' + fontKey(), TAXI_BOX, paintTaxi);
  const BI_TXT = []; // 'R$ n BI' (o déficit subindo no 3º turno): uma string por n, sem montar texto a cada quadro
  const biTxt = (n) => BI_TXT[n] || (BI_TXT[n] = 'R$ ' + n + ' BI');
  // aquecimento: um sprite por quadro na entrada (nada de pintar canvas novo no 1º quadro da luta)
  const WARM = [() => regSpr(false), () => regSpr(true), () => drwSpr(false), () => drwSpr(true), txmSpr,
    () => ledPreSpr(LED_AMBER), () => ledPreSpr(LED_ORANGE), () => ledPreSpr(LED_RED), () => ledPreSpr('#ffffff'),
    () => ledTxtSpr('DÉFICIT R$ 0', LED_RED), () => ledTxtSpr('DEVOLVENDO...', '#ffffff'), () => flagSpr(false), () => flagSpr(true),
    () => calcSpr('%', false), () => calcSpr('', false), () => calcSpr('', true), () => calcSpr('ISENTO', false),
    () => calcSpr(LCD[0], false), () => calcSpr(LCD[1], false), () => calcSpr(LCD[2], false), () => calcSpr(LCD[3], false), () => calcSpr(LCD[4], false),
    bagSpr, () => cofreSpr(false, false), () => cofreSpr(true, false), () => cofreSpr(false, true),
    () => plateSpr(0), () => plateSpr(1), () => plateSpr(2), () => boothSpr(false), () => boothSpr(true), mqSpr, taxiSpr];

  // ---------- partes vivas ----------
  function jets(c, y, t) {
    for (const jx of [-20, 20]) {
      const L = 11 + Math.sin(t * 31 + jx) * 2.5 + Math.sin(t * 53) * 1.2;
      c.beginPath(); c.moveTo(jx - 5, y); c.lineTo(jx, y + L); c.lineTo(jx + 5, y); c.closePath(); c.fillStyle = '#ff9f1c'; c.fill();
      c.beginPath(); c.moveTo(jx - 2.6, y); c.lineTo(jx, y + L * 0.6); c.lineTo(jx + 2.6, y); c.closePath(); c.fillStyle = '#7fd4ff'; c.fill();
    }
  }
  // posição da calculadora por pose: [dx, dy, giro] a partir da mão direita
  const CALC_OFF = { hold: [6, -8, -0.12], idle: [4, -9, -0.1], point: [6, -6, 0.35], up: [3, -10, 0.12], shrug: [3, -11, 0.18], wave: [2, -10, 0], fist: [2, -8, 0] };
  function calcLocal(pose, t, py) {
    const o = CALC_OFF[pose] || CALC_OFF.hold, h = K.hand(TX_SIZE, pose, t, TAXAD.seed, true, 1);
    CL[0] = h.x + o[0]; CL[1] = py + h.y + o[1]; CL[2] = o[2];
    return CL;
  }
  const CL = [0, 0, 0];
  // calculadora em coordenadas de tela (de onde saem as teclas)
  function calcXY(b) {
    const q = calcLocal(b.data.pose || 'hold', b.t, PY);
    return [b.x + q[0], b.y + q[1] - 6];
  }
  function bagHand(pose, t, py) { const h = K.hand(TX_SIZE, pose, t, TAXAD.seed, false, 1); return [h.x - 4, py + h.y + 3]; }
  function drawCalc(c, S, py) {
    const q = calcLocal(S.pose || 'hold', S.t, py), wob = S.stun ? Math.sin(S.t * 7) * 0.12 : 0;
    const lab = S.lcdOn === false ? '' : S.lcd;
    c.save(); c.translate(q[0], q[1]); c.rotate(q[2] + wob);
    if (S.vec) { c.lineJoin = 'round'; paintCalc(c, lab, S.fl); } else blit(c, calcSpr(lab, S.fl), 0, 0);
    c.restore();
  }
  // taxímetro: caixa + LED (texto do estado ou prefixo + 3 dígitos em 7 segmentos) + bandeirinha
  function drawTaximetro(c, S) {
    if (S.vec) paintTaximetro(c); else blit(c, txmSpr(), 0, 0);
    const col = S.ledCol || LED_AMBER;
    if (S.ledTxt) { if (S.vec) paintLedText(c, S.ledTxt, col); else blit(c, ledTxtSpr(S.ledTxt, col), 0, 0); }
    else {
      if (S.vec) paintLedPrefix(c, col); else blit(c, ledPreSpr(col), 0, 0);
      const v = (S.digits | 0) % 1000;
      c.beginPath();
      seg7(c, 6.4, 17.8, 1.9, 4.2, ((v / 100) | 0) % 10);
      seg7(c, 9.1, 17.8, 1.9, 4.2, ((v / 10) | 0) % 10);
      seg7(c, 11.8, 17.8, 1.9, 4.2, v % 10);
      c.lineWidth = 0.8; c.lineCap = 'round'; c.strokeStyle = col; c.stroke();
    }
    if (S.alarm) { K.rr(c, -16.6, 13.9, 33.2, 14.7, 2.4); c.lineWidth = 1.3; c.strokeStyle = LED_RED; c.stroke(); }
    const f = clamp(S.flag || 0, 0, 1), fk = Math.max(0.12, Math.abs(Math.cos(PI * f)));
    c.beginPath(); c.moveTo(-16, 15); c.lineTo(-16, 4.5); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke();
    c.save(); c.translate(-16, 4.5); c.scale(fk, 1);
    if (S.vec) paintFlag(c, f > 0.5); else blit(c, flagSpr(f > 0.5), 0, 0);
    c.restore();
  }
  function drawRegister(c, S) {
    const fl = S.fl, o = clamp(S.drawer || 0, 0, 1);
    if (S.vec) paintRegister(c, fl); else blit(c, regSpr(fl), 0, 0);
    // bandeja de moedas no vão (aparece quando a gaveta sai)
    if (o > 0.02 && !fl) {
      c.beginPath(); for (let i = 0; i < 5; i++) K.O(c, -20 + i * 10, 58 + 5.5 * o, 2.6);
      c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#8a6a10'; c.stroke();
    }
    if (S.vec) { c.save(); c.translate(0, 57 + 8 * o); paintDrawer(c, fl); c.restore(); } else blit(c, drwSpr(fl), 0, 57 + 8 * o);
    if (!fl) drawTaximetro(c, S);
  }
  /**
   * Desenha o Taxad. S: { t, fl, pose, mood, mouth, look, spec, reg (caixa registradora), drawer 0..1, lcd, lcdOn,
   *   ledTxt, ledCol, digits, alarm, flag 0..1, bag (saco na mão esquerda), stun, dy (pulo), vec (retrato: só vetor) }
   */
  function drawTaxad(c, x, y, S) {
    const t = S.t, fl = S.fl, py = PY + (S.dy || 0);
    c.save(); c.translate(x, y);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (S.reg && !fl) jets(c, 74, t);
    G.Art.person(c, 0, py, TX_SIZE, S.spec || TAXAD, { t, mood: S.mood, mouth: S.mouth, pose: S.pose, flash: fl, lookX: S.look[0], lookY: S.look[1], autoLook: false });
    if (!fl) pctPin(c, -13 * SC, py + 23 * SC);
    if (S.bag && !fl) { const q = bagHand(S.pose, t, py); if (S.vec) { c.save(); c.translate(q[0], q[1]); c.scale(0.85, 0.85); paintBag(c); c.restore(); } else { c.save(); c.translate(q[0], q[1]); c.scale(0.85, 0.85); blit(c, bagSpr(), 0, 0); c.restore(); } }
    drawCalc(c, S, py);
    if (S.reg) drawRegister(c, S);
    c.restore();
  }

  // ======================================================================
  // Estilos de tiro (prefixo tx_; saturados, nunca verde-água)
  // ======================================================================
  const BS = G.BulletStyles, glowOn = K.glowOn;
  // caixa da encomenda (laranja, fita branca em cruz, adesivo '%')
  BS.define('tx_caixa', { r: 6, size: 20, spin: 2, paint(x, s, c) {
    const w = 12.5;
    glowOn(x, c, 6); x.fillStyle = c; x.fillRect(-w / 2, -w / 2, w, w);
    x.shadowBlur = 0; x.strokeStyle = 'rgba(70,25,0,0.6)'; x.lineWidth = 1; x.strokeRect(-w / 2 + 0.5, -w / 2 + 0.5, w - 1, w - 1);
    x.fillStyle = '#ffffff'; x.fillRect(-1.2, -w / 2, 2.4, w); x.fillRect(-w / 2, -1.2, w, 2.4);
    x.beginPath(); x.arc(3.5, 3.5, 2.7, 0, TAU); x.fillStyle = '#ffffff'; x.fill();
    x.fillStyle = '#e63946'; x.font = '900 3.8px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('%', 3.5, 3.7);
  } });
  // blusinha (camiseta na cor, gola branca); a barra aponta para onde ela vai
  BS.define('tx_blusa', { r: 4.5, size: 16, rotate: true, paint(x, s, c) {
    x.rotate(-PI / 2);
    x.beginPath();
    x.moveTo(-2.4, -5); x.lineTo(-6, -3.6); x.lineTo(-7.6, -0.6); x.lineTo(-4.6, 0.7); x.lineTo(-4.4, 5.6); x.lineTo(4.4, 5.6);
    x.lineTo(4.6, 0.7); x.lineTo(7.6, -0.6); x.lineTo(6, -3.6); x.lineTo(2.4, -5); x.quadraticCurveTo(0, -2.4, -2.4, -5); x.closePath();
    glowOn(x, c, 6); x.fillStyle = c; x.fill();
    x.shadowBlur = 0; x.lineWidth = 0.8; x.strokeStyle = 'rgba(60,0,30,0.5)'; x.stroke();
    x.beginPath(); x.moveTo(-2.4, -5); x.quadraticCurveTo(0, -2.4, 2.4, -5); x.lineWidth = 1.4; x.strokeStyle = '#ffffff'; x.stroke();
  } });
  // tecla da calculadora (quadradinho arredondado, '%' branco)
  BS.define('tx_tecla', { r: 4.5, size: 15, paint(x, s, c) {
    glowOn(x, c, 6); K.rr(x, -5.5, -5.5, 11, 11, 2.6); x.fillStyle = c; x.fill();
    x.shadowBlur = 0; K.rr(x, -4.4, -4.6, 8.8, 3, 1.4); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fill();
    x.fillStyle = '#ffffff'; x.font = '900 6.4px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('%', 0, 0.6);
  } });
  // DARF (guia creme com código de barras e aro colorido)
  BS.define('tx_darf', { r: 4.2, size: 20, rotate: true, paint(x, s, c) {
    const w = 15, h = 9;
    glowOn(x, c, 6); x.fillStyle = c; x.fillRect(-w / 2 - 1.3, -h / 2 - 1.3, w + 2.6, h + 2.6);
    x.shadowBlur = 0; x.fillStyle = '#fff1d6'; x.fillRect(-w / 2, -h / 2, w, h);
    x.fillStyle = '#14121a';
    const bars = [0.8, 0.5, 1.1, 0.5, 0.5, 1.2, 0.6, 0.9, 0.5, 1.1];
    let bx = -w / 2 + 1.4;
    for (let i = 0; i < bars.length && bx < w / 2 - 1.4; i++) { x.fillRect(bx, -h / 2 + 1.4, bars[i], h - 2.8); bx += bars[i] + 0.65; }
  } });
  // régua da viga do arcabouço (dourada com marquinhas; deitada no sentido da parede)
  BS.define('tx_regua', { r: 4.5, size: 18, rotate: true, paint(x, s, c) {
    glowOn(x, c, 5); x.fillStyle = c; x.fillRect(-2.7, -8.6, 5.4, 17.2);
    x.shadowBlur = 0; x.strokeStyle = 'rgba(40,20,0,0.85)'; x.lineWidth = 0.8; x.strokeRect(-2.3, -8.2, 4.6, 16.4);
    x.beginPath(); for (let i = -6; i <= 6; i += 3) { x.moveTo(-2.3, i); x.lineTo(0.4, i); } x.stroke();
  } });
  // losango de canto cortado (a "taxa do Pix") com 'IOF' branco — laranja/magenta, nunca verde-água
  BS.define('tx_pix', { r: 5, size: 18, spin: 2.5, paint(x, s, c) {
    const R = 7.6, k = 2.2;
    x.beginPath();
    x.moveTo(-k, -R + k); x.lineTo(k, -R + k); x.lineTo(R - k, -k); x.lineTo(R - k, k); x.lineTo(k, R - k); x.lineTo(-k, R - k); x.lineTo(-R + k, k); x.lineTo(-R + k, -k); x.closePath();
    glowOn(x, c, 7); x.fillStyle = c; x.fill();
    x.shadowBlur = 0; x.lineWidth = 0.9; x.strokeStyle = '#ffffff'; x.stroke();
    x.fillStyle = '#ffffff'; x.font = '900 4px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('IOF', 0, 0.3, 9);
  } });
  const TX_SHOTS = [['tx_caixa', COL.orange], ['tx_blusa', COL.pink], ['tx_blusa', COL.magenta], ['tx_tecla', COL.red], ['tx_darf', COL.orange],
    ['tx_regua', '#ffb02e'], ['tx_pix', COL.orange], ['tx_pix', COL.magenta], ['small', COL.red]];
  const BLUSA_P = { style: 'tx_blusa', color: COL.pink }, BLUSA_M = { style: 'tx_blusa', color: COL.magenta };
  const KEY = { style: 'tx_tecla', color: COL.red }, DARF = { style: 'tx_darf', color: COL.orange };
  const PIXB = { style: 'tx_pix', color: COL.orange };
  const REGUA = { style: 'tx_regua', color: '#ffb02e', life: TX.ARC_LIFE, noPress: true };
  const ZERO = { style: 'small', color: COL.red, delay: TX.ZERO_DELAY, noPress: true };

  // todo tiro do Taxad passa por aqui (o 5º turno acelera tudo: d.spdMul)
  function txShoot(x, y, a, spd, o) {
    const g = G.game, b = g && g.boss;
    return K.shoot(x, y, a, spd * (b && b.id === 'taxad' ? b.data.spdMul || 1 : 1), o);
  }
  function txFan(x, y, ang, n, spread, spd, o) {
    if (n <= 1) { txShoot(x, y, ang, spd, o); return; }
    for (let i = 0; i < n; i++) txShoot(x, y, ang - spread / 2 + (spread * i) / (n - 1), spd, o);
  }
  function txRing(x, y, n, spd, o, off) { for (let i = 0; i < n; i++) txShoot(x, y, (off || 0) + (i * TAU) / n, spd, o); }
  // velocidade real de um tiro do Taxad (para os desenhos que acompanham uma parede)
  function realSpd(b, v) { return v * (b.def.spdK || 1) * ((G.game && G.game.diff) || 1) * (b.data.spdMul || 1); }

  // ======================================================================
  // Padrões (SPEC5 §6.4). Esperas no relógio do chefão (param no tonto e na rodada dos cofres).
  // ======================================================================
  function swayMv(i) {
    return (bb, dd) => { const t = K.clk(bb); dd.tx = bb.homeX + TX.SWAY[i] * Math.sin(TX.OMEGA[i] * t); dd.ty = bb.homeY + TX.BOB * Math.sin(1.2 * t); };
  }
  // aviso: a gaveta da caixa sai 8 px com as moedas à vista antes de todo tiro da gaveta
  function* txTell(b) {
    const d = b.data;
    d.drawerTo = 1; sfx('caixa');
    yield TX.TELL;
  }
  // TAXA DAS BLUSINHAS: caixas miradas que viram 3 blusinhas na alfândega
  function boxSplit(q) {
    const g = G.game, b = g && g.boss;
    if (b && b.id === 'taxad') b.data.alfT = Math.max(b.data.alfT, 0.3);
    if (q.y < TX.ALF_Y * G.H) return;
    q.dead = true;
    const a = Math.atan2(q.vy, q.vx), v = q.data.v * TX.SPLIT_K, vol = q.data.vol;
    txShoot(q.x, q.y, a - TX.SPLIT_A, v, BLUSA_M); txShoot(q.x, q.y, a, v, BLUSA_P); txShoot(q.x, q.y, a + TX.SPLIT_A, v, BLUSA_M);
    if (decoK() > 0) G.burst(q.x, q.y, 4, { colors: ['#ffffff', '#ff8c1a'], speed: 90, life: 0.3 });
    if (vol && !vol.split) {
      vol.split = 1; sfx('split');
      G.text(q.x, q.y, '+20%!', { size: 9, color: '#ffd23f' });
      const run = G.run;
      if (run && !run._txBlusa) { run._txBlusa = 1; G.text(G.W / 2, G.H * 0.46, 'TAXOU A BLUSINHA!', { size: 13, color: '#ffd23f', stroke: true }); }
    }
  }
  function* txBlusinhas(b, k) {
    const d = b.data;
    yield* txTell(b);
    if (!d.saidBlusa) { d.saidBlusa = 1; say(b, 'TAXA DAS BLUSINHAS!', 1.4); }
    d.pose = 'point'; d.poseT = 0.6;
    let n = pN(L2() ? TX.BOX_N_L2 : TX.BOX_N, d.pl);
    if (k) n = Math.max(2, Math.round(n * k));
    const x = b.x, y = b.y + 50, a = G.aim(x, y), vol = { split: 0 }, spread = TX.BOX_STEP * (n - 1);
    for (let i = 0; i < n; i++) {
      const ang = n > 1 ? a - spread / 2 + (spread * i) / (n - 1) : a;
      txShoot(x, y, ang, TX.BOX_SPD, { style: 'tx_caixa', color: COL.orange, update: boxSplit, data: { v: TX.BOX_SPD, vol } });
    }
    sfx('enemy_shot2');
    d.alfT = 1.2; d.drawerTo = 0;
  }
  // IMPOSTÔMETRO: anel de DARFs saindo da gaveta
  function* txImpostometro(b) {
    const d = b.data;
    yield* txTell(b);
    txRing(b.x, b.y + 50, pRing(TX.IMP_N, d.pR), TX.IMP_SPD, { style: 'tx_darf', color: COL.orange, delay: TX.IMP_DELAY }, Math.random() * TAU);
    sfx('enemy_shot'); d.drawerTo = 0;
  }
  // fundo (todos os turnos, menos na rodada dos cofres): teclas miradas da calculadora; +1 na ALÍQUOTA 3
  function* txTeclas(b) {
    const d = b.data;
    for (;;) {
      yield pW(TX.KEY_EVERY, d.pl) * (d.arc ? TX.KEY_ARC_K : 1) * M.rand(0.92, 1.08);
      if (d.hold) continue;
      const q = calcXY(b), n = pN(TX.KEY_N, d.pl) + (d.aliq >= 3 ? 1 : 0);
      txFan(q[0], q[1], G.aim(q[0], q[1]), n, TX.KEY_STEP * (n - 1), TX.KEY_SPD, KEY);
      sfx('enemy_shot');
    }
  }
  function* txP1(b) {
    const d = b.data;
    d.mv = swayMv(0);
    yield 1.0;
    for (let loop = 0; ; loop++) {
      yield* txBlusinhas(b);
      if (loop % 2 === 1) { yield 0.6; yield* txImpostometro(b); }
      yield pW(TX.P1_WAIT, d.pl);
    }
  }
  // ---------- 2º turno: ARCABOUÇO FISCAL (moldura em volta do carro, com um FURO) ----------
  function* txArcabouco(b) {
    const d = b.data, W = G.W, H = G.H, p = pl(), run = G.run || {};
    say(b, 'O ARCABOUÇO É SÓLIDO!', 1.6); d.pose = 'up'; d.poseT = 1.0;
    const hw = TX.ARC_W / 2, hh = TX.ARC_H / 2;
    const cx = clamp(p.x, hw, W - hw), cy = clamp(p.y, 0.55 * H, H - 95);
    const A = { gen: ++d.arcGen, st: 'tele', t: 0, x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh, side: 't', f: 0, v: 0, list: [], probe: null };
    // o furo: nunca num lado encostado na borda da tela
    const sides = ['t'];
    if (A.x0 >= 16) sides.push('l');
    if (A.x1 <= W - 16) sides.push('r');
    if (A.y1 <= H - 30) sides.push('b');
    A.side = M.pick(sides);
    const len = A.side === 't' || A.side === 'b' ? TX.ARC_W : TX.ARC_H;
    A.f = M.rand(36, len - 36);
    d.arc = A;
    sfx('charge');
    yield TX.ARC_TELE;
    if (d.arc !== A) return; // a rodada dos cofres (ou o tonto) desfez a moldura
    const v = L2() ? TX.ARC_SPD_L2 : TX.ARC_SPD, h = TX.FURO / 2, st = TX.ARC_STEP;
    A.v = realSpd(b, v);
    const add = (q) => { if (q) { A.list.push(q); if (!A.probe) A.probe = q; } };
    for (let x = A.x0; x <= A.x1 + 0.01; x += st) {
      if (!(A.side === 't' && Math.abs(x - (A.x0 + A.f)) < h)) add(txShoot(x, A.y0, DOWN, v, REGUA));
      if (!(A.side === 'b' && Math.abs(x - (A.x0 + A.f)) < h)) add(txShoot(x, A.y1, -DOWN, v, REGUA));
    }
    for (let y = A.y0 + st; y <= A.y1 - st + 0.01; y += st) {
      if (!(A.side === 'l' && Math.abs(y - (A.y0 + A.f)) < h)) add(txShoot(A.x0, y, 0, v, REGUA));
      if (!(A.side === 'r' && Math.abs(y - (A.y0 + A.f)) < h)) add(txShoot(A.x1, y, PI, v, REGUA));
    }
    A.st = 'live'; A.t = 0;
    sfx('enemy_shot2');
    if (!run._txFuro) {
      run._txFuro = 1;
      const q = arcFuroXY(A, 0);
      G.text(clamp(q[0] + q[2] * 44, 50, W - 50), q[1] + q[3] * 30, 'TEM FURO!', { size: 12, color: '#ffffff', stroke: true });
    }
    yield TX.ARC_LIFE;
    if (d.arc === A) d.arc = null;
  }
  const ARC_XY = [0, 0, 0, 0];
  // centro do furo com o lado já andando 'off' px para dentro: [x, y, ox, oy] (ox/oy = para fora)
  function arcFuroXY(A, off) {
    const o = ARC_XY;
    if (A.side === 't') { o[0] = A.x0 + A.f; o[1] = A.y0 + off; o[2] = 0; o[3] = -1; }
    else if (A.side === 'b') { o[0] = A.x0 + A.f; o[1] = A.y1 - off; o[2] = 0; o[3] = 1; }
    else if (A.side === 'l') { o[0] = A.x0 + off; o[1] = A.y0 + A.f; o[2] = -1; o[3] = 0; }
    else { o[0] = A.x1 - off; o[1] = A.y0 + A.f; o[2] = 1; o[3] = 0; }
    return o;
  }
  function* txP2(b) {
    const d = b.data;
    d.mv = swayMv(1);
    yield 0.8;
    for (;;) {
      yield* txArcabouco(b);
      yield pW(TX.P2_GAP1, d.pl);
      yield* txBlusinhas(b, TX.P2_BOX_K);
      yield pW(TX.P2_GAP2, d.pl);
    }
  }
  // ---------- 3º turno: DÉFICIT ZERO (o "00" rígido caindo, com rombos embaixo e em cima) ----------
  // pontos do contorno de uma elipse RX×RY a cada ~STEP px (calculado uma vez): [cos, sen, arco] × N, P = perímetro
  let ZPTS = null;
  function zeroPts() {
    if (ZPTS) return ZPTS;
    const a = TX.ZERO_RX, bb = TX.ZERO_RY, S = 720, cum = new Float32Array(S + 1);
    let px = a, py = 0;
    for (let i = 1; i <= S; i++) { const th = (i / S) * TAU, x = a * Math.cos(th), y = bb * Math.sin(th); cum[i] = cum[i - 1] + Math.hypot(x - px, y - py); px = x; py = y; }
    const P = cum[S], N = Math.max(8, Math.round(P / TX.ZERO_STEP)), pts = [];
    let j = 0;
    for (let k = 0; k < N; k++) {
      const s = (k * P) / N;
      while (j < S - 1 && cum[j + 1] < s) j++;
      const th = ((j + (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j])) / S) * TAU;
      pts.push([Math.cos(th), Math.sin(th), s]);
    }
    const arcAt = (th) => { const f = (((th % TAU) + TAU) % TAU) / TAU * S, i = Math.min(S - 1, f | 0); return cum[i] + (cum[i + 1] - cum[i]) * (f - i); };
    ZPTS = { pts, P, arcAt };
    return ZPTS;
  }
  function spawnZeros(b) {
    const d = b.data, W = G.W, cy = b.y + TX.ZERO_DY, rx = TX.ZERO_RX, ry = TX.ZERO_RY, Z0 = zeroPts(), half = TX.ROMBO / 2;
    const v = L2() ? TX.ZERO_SPD_L2 : TX.ZERO_SPD;
    const Z = { t: 0, list: [], lab: [], ry };
    const add = (q) => { if (q) Z.list.push(q); };
    for (const cx of [W / 2 - TX.ZERO_DX, W / 2 + TX.ZERO_DX]) {
      // rombo de baixo a cx + s·DX e o de cima do outro lado (sorteado por zero)
      const s = Math.random() < 0.5 ? 1 : -1, kx = clamp((s * TX.ROMBO_DX) / rx, -1, 1);
      const thB = Math.acos(kx), thT = TAU - Math.acos(-kx);
      const aB = Z0.arcAt(thB), aT = Z0.arcAt(thT), P = Z0.P;
      const far = (a, r) => { const dd = Math.abs(a - r); return Math.min(dd, P - dd) >= half; };
      for (const q of Z0.pts) if (far(q[2], aB) && far(q[2], aT)) add(txShoot(cx + rx * q[0], cy + ry * q[1], DOWN, v, ZERO));
      Z.lab.push(cx + s * TX.ROMBO_DX, cy + ry * Math.sin(thB) + 11, cx - s * TX.ROMBO_DX, cy + ry * Math.sin(thT) - 11);
    }
    // costura no meio: o vão entre os dois zeros fica fechado
    const n = Math.round((2 * ry) / TX.ZERO_STEP);
    for (let k = 0; k <= n; k++) add(txShoot(W / 2, cy - ry + (2 * ry * k) / n, DOWN, v, ZERO));
    if (Z.list.length) d.zf.push(Z);
    sfx('charge');
    const run = G.run;
    if (run && !run._txRombo) { run._txRombo = 1; G.text(W / 2, G.H * 0.44, 'TEM ROMBO NO ZERO!', { size: 13, color: '#ffd23f', stroke: true }); }
  }
  function* txZeros(b) {
    const d = b.data;
    say(b, 'DÉFICIT ZERO!', 1.4); d.pose = 'point'; d.poseT = 0.6;
    spawnZeros(b);
    yield 0.05;
  }
  // algum "00" ainda na tela?
  function zerosOn(b) {
    const L = b.data.zf;
    for (const Z of L) for (let i = 0; i < Z.list.length; i += 7) { const q = Z.list[i]; if (!q.dead && q.y - 2 * Z.ry < G.H) return true; }
    return false;
  }
  function* txP3(b) {
    const d = b.data;
    d.mv = swayMv(2);
    yield 0.8;
    for (;;) {
      yield* txZeros(b);
      yield pW(L2() ? TX.ZERO_EVERY_L2 : TX.ZERO_EVERY, d.pl);
    }
  }
  // ---------- 4º turno: NÃO VAI TAXAR O PIX (trens das maquininhas + IOF) ----------
  function mqOn(b) { const d = b.data; d.mq[0].tx = TX.MQ_X; d.mq[1].tx = G.W - TX.MQ_X; d.mq[0].on = d.mq[1].on = true; }
  function mqOff(b) { const d = b.data; d.mq[0].tx = -34; d.mq[1].tx = G.W + 34; d.mq[0].on = d.mq[1].on = false; }
  function* txPixTrain(b) {
    const d = b.data, H = G.H;
    if (!d.mq[0].on) { mqOn(b); sfx('whoosh'); }
    d.mqSide = -d.mqSide;
    const m = d.mq[d.mqSide < 0 ? 0 : 1];
    let y = M.rand(TX.PIX_Y0, TX.PIX_Y1) * H;
    for (let g = 0; g < 10 && Math.abs(y - d.mqLastY) < TX.PIX_ROW_MIN; g++) y = M.rand(TX.PIX_Y0, TX.PIX_Y1) * H;
    d.mqLastY = y;
    m.y0 = m.y; m.ty = y; m.gt = 0;
    yield TX.PIX_GLIDE;
    const side = d.mqSide, x0 = side < 0 ? TX.MQ_X + 10 : G.W - TX.MQ_X - 10, ang = side < 0 ? TX.PIX_DOWN : PI - TX.PIX_DOWN;
    const spd = L2() ? TX.PIX_SPD_L2 : TX.PIX_SPD, n = pN(TX.PIX_N, d.pl);
    for (let k = 0; k < n; k++) {
      txShoot(x0 + Math.cos(ang) * k * TX.PIX_GAP, m.ty + Math.sin(ang) * k * TX.PIX_GAP, ang, spd,
        { style: 'tx_pix', color: k % 2 ? COL.magenta : COL.orange, delay: TX.PIX_DELAY });
    }
    m.fl = 0.3;
    sfx('enemy_shot');
  }
  function* txIOF(b) {
    const d = b.data;
    for (;;) {
      yield TX.IOF_EVERY;
      const p = pl();
      if (!p.alive || p.entering || d.hold) continue;
      d.iof = G.laser({ x: p.x, y: 60, ang: DOWN, warn: TX.IOF_WARN, life: TX.IOF_LIFE, width: TX.IOF_W });
      K.hint('iof', G.W / 2, G.H * 0.5, 'IOF: SAIA DA LINHA!');
    }
  }
  function* txP4(b) {
    const d = b.data;
    d.mv = swayMv(3);
    d.pose = 'up'; d.poseT = 2.6;
    say(b, 'NÃO VAI TAXAR O PIX...', 1.4);
    yield 1.4;
    say(b, '...AINDA!', 1.2);
    mqOn(b); sfx('whoosh');
    yield 1.2;
    for (;;) {
      yield* txPixTrain(b);
      yield Math.max(0.1, pW(L2() ? TX.PIX_EVERY_L2 : TX.PIX_EVERY, d.pl) - TX.PIX_GLIDE);
    }
  }
  // ---------- 5º turno: IMPOSTO SOBRE TUDO (remix com descansos curtos) ----------
  function* txP5(b) {
    const d = b.data;
    d.mv = swayMv(4);
    yield 1.0;
    for (;;) {
      yield* txBlusinhas(b); yield TX.P5_REST;
      yield* txZeros(b); yield TX.P5_REST;
      for (let i = 0; i < TX.P5_TRAINS; i++) { yield* txPixTrain(b); yield Math.max(0.1, pW(L2() ? TX.PIX_EVERY_L2 : TX.PIX_EVERY, d.pl) - TX.PIX_GLIDE); }
      yield TX.P5_REST;
      // a moldura nunca cai em cima de um "00" ainda descendo
      const t0 = K.clk(b);
      yield () => !zerosOn(b) || K.clk(b) - t0 > TX.P5_ZERO_WAIT;
      yield* txArcabouco(b); yield TX.P5_REST;
    }
  }
  // paredes cronometradas (moldura, "00") e o laser ainda avisando somem quando começa uma rodada dos cofres
  function wallsClear(b) {
    const d = b.data;
    let n = 0;
    const kill = (L) => { for (const q of L) if (!q.dead) { q.dead = true; if (n++ < 60) G.part({ x: q.x, y: q.y, type: 'dot', size: 2.2, life: 0.3, color: q.color, vy: -20 }); } };
    if (d.arc) { kill(d.arc.list); d.arc = null; }
    for (const Z of d.zf) kill(Z.list);
    d.zf.length = 0;
    if (d.iof && !d.iof.dead && d.iof.t < d.iof.warn) d.iof.dead = true;
  }

  // ======================================================================
  // A manha ACHAR — "CADÊ O SEU DINHEIRO?" (SPEC5 §6.5). Agendador no update (não é corrotina).
  // d.cf = { n, st: 'show'|'shuffle'|'drop'|'pick'|'reveal'|'gone', t, right, list[3], swaps, si, bag, ... }
  // ======================================================================
  const PAIRS = [[0, 1], [1, 2], [0, 2]];
  const slotX = (i) => CF.X[i] * G.W;
  const cfPh = (b) => clamp(b.phase | 0, 0, 4);
  function cfPlan(n, ph, demo) {
    const L = [];
    let p1 = -1, p2 = -1;
    for (let i = 0; i < n; i++) {
      let k = M.randi(0, 2);
      for (let g = 0; g < 12 && k === p1 && k === p2; g++) k = M.randi(0, 2); // nunca o mesmo par 3 vezes seguidas
      p2 = p1; p1 = k;
      L.push({ kind: 'swap', a: PAIRS[k][0], b: PAIRS[k][1] });
    }
    if (!demo && n >= 2) {
      for (let f = 0; f < CF.FEINT[ph]; f++) for (let g = 0; g < 8; g++) { const i = M.randi(1, n - 1); if (L[i].kind === 'swap') { L[i].kind = 'feint'; break; } }
      if (CF.ROT[ph]) for (let g = 0; g < 8; g++) { const i = M.randi(1, n - 1); if (L[i].kind === 'swap') { L[i].kind = 'rot'; break; } }
      if (CF.RELABEL[ph]) L.splice(Math.ceil(L.length / 2), 0, { kind: 'relabel', a: 0, b: 0 });
    }
    return L;
  }
  function cfStart(b) {
    const d = b.data, run = G.run || {}, ph = cfPh(b), l2 = L2(), lv = d.pl | 0;
    const demo = !l2 && !run._txSeen;
    run._txSeen = 1;
    let sw, n, pick = CF.PICK[ph] - (l2 ? 0.3 : 0) - 0.05 * lv;
    if (demo) { sw = CF.DEMO_SW; n = CF.DEMO_SWAPS; }
    else { sw = Math.max(CF.SW_MIN, CF.SW[ph] * (l2 ? 0.85 : 1) * (1 - 0.04 * lv)); n = CF.SWAPS[ph] + (l2 ? 1 : 0) + (lv >= 4 ? 1 : 0); }
    pick = Math.max(CF.PICK_MIN, pick);
    const plates = [0, 1, 2];
    for (let i = 2; i > 0; i--) { const j = M.randi(0, i), t = plates[i]; plates[i] = plates[j]; plates[j] = t; }
    const list = [];
    for (let i = 0; i < 3; i++) list.push({ i, slot: i, x: b.x, y: b.y + 52, by: b.y + 52, yo: 0, bob: 0, sc: 0.6, fx: 0, tx: 0, dir: 0, ak: 1, to: i,
      plate: plates[i], plN: plates[i], pf: -1, open: 0, flash: 0, fx0: 0, fy0: 0 });
    const C = d.cf = {
      n: ++d.cfN, st: 'show', t: 0, right: M.randi(0, 2), demo, ph, sw, gap: CF.GAP[ph], swaps: cfPlan(n, ph, demo), si: 0, stT: 0, inGap: false,
      pickT: pick, k: clamp((n * (0.62 / sw) - 3) / 7, 0, 1), list, sx: b.x, sy: b.y + 52, glT: 0, res: null, rel: 0,
      bag: { st: 'hand', x: 0, y: 0, sx: 0, sy: 0, sc: 1 }, shown: false, taken: false, smoke: false,
    };
    d.hold = true; d.drawerTo = 1; d.pose = 'hold'; d.poseT = 0;
    wallsClear(b);
    if (demo) G.clearBullets(false); // demonstração: tela limpa (nem as caixas que já voavam viram blusinha)
    say(b, ph === 4 ? 'TUDO OU NADA, ZÉ!' : 'CADÊ O SEU DINHEIRO?', 1.8);
    sfx('cofre');
    if (demo) K.mechHint('tx_cofre', G.W / 2, G.H * 0.56, 'SIGA O COFRE DO SEU DINHEIRO!');
    d.rp.a = ROUND.FIRST; d.rp.b = ROUND.FIRST + 0.8; d.rp.ang = Math.random() * TAU;
    return C;
  }
  // começo de uma troca: de onde / para onde vai cada cofre (por cima = indo para a direita)
  function cfStepBegin(b, C) {
    const s = C.swaps[C.si];
    for (const q of C.list) { q.fx = q.x; q.tx = q.x; q.dir = 0; q.ak = 1; q.to = q.slot; }
    if (s.kind === 'relabel') { cfRelBegin(b, C); return; }
    if (s.kind === 'rot') for (const q of C.list) q.to = (q.slot + 1) % 3;
    else for (const q of C.list) { if (q.slot === s.a) q.to = s.b; else if (q.slot === s.b) q.to = s.a; }
    for (const q of C.list) if (q.to !== q.slot) { q.tx = slotX(q.to); q.dir = q.tx > q.fx ? 1 : -1; q.ak = Math.abs(q.to - q.slot) === 2 ? 1.4 : 1; }
    sfxP('swap', C.swaps.length > 1 ? C.si / (C.swaps.length - 1) : 0);
  }
  function cfStepPose(C, u, feint) {
    const p = feint ? 0.4 * Math.sin(PI * u) : M.easeInOutSine(u), s = Math.sin(PI * p);
    for (const q of C.list) {
      if (!q.dir) { q.yo = 0; q.sc = 1; continue; }
      q.x = M.lerp(q.fx, q.tx, p);
      q.yo = -q.dir * CF.ARC * q.ak * s;
      q.sc = 1 - q.dir * 0.08 * s;
    }
  }
  function cfStepEnd(C, feint) {
    for (const q of C.list) {
      if (q.dir) { if (feint) q.x = q.fx; else { q.slot = q.to; q.x = q.tx; } }
      q.yo = 0; q.sc = 1; q.dir = 0;
    }
  }
  // MUDEI SÓ O NOME!: as plaquinhas trocam de cofre (o dinheiro fica onde está)
  function cfRelBegin(b, C) {
    const sh = M.randi(1, 2);
    for (const q of C.list) { q.pf = (q.i + 3 - sh) % 3; q.plN = C.list[q.pf].plate; }
    C.rel = 0;
    say(b, 'MUDEI SÓ O NOME!', 1.6);
    G.text(G.W / 2, G.H * 0.40, 'NÃO É IMPOSTO, É CONTRIBUIÇÃO!', { size: 12, color: '#ffffff', stroke: true });
    sfx('whoosh');
  }
  function cfRelEnd(C) { for (const q of C.list) { q.plate = q.plN; q.pf = -1; } C.rel = 0; }
  function cfShow(b, C) {
    const d = b.data, row = CF.ROW_Y * G.H, R = C.list[C.right], bag = C.bag;
    for (const q of C.list) {
      const u = clamp((C.t - q.i * 0.06) / 0.5, 0, 1);
      q.x = M.lerp(C.sx, slotX(q.slot), M.easeOutCubic(u)); q.by = M.lerp(C.sy, row, M.easeOutBack(u)); q.sc = 0.6 + 0.4 * M.easeOutCubic(u);
    }
    if (bag.st === 'hand' && C.t >= 0.5) {
      const h = bagHand('hold', b.t, PY);
      bag.st = 'fly'; bag.sx = b.x + h[0]; bag.sy = b.y + h[1]; R.open = 1; d.pose = 'point'; d.poseT = 0.45;
      sfx('whoosh');
    }
    if (bag.st === 'fly') {
      const u = clamp((C.t - 0.5) / 0.5, 0, 1);
      bag.x = M.lerp(bag.sx, R.x, u); bag.y = M.lerp(bag.sy, R.by - 6, u) - Math.sin(u * PI) * 42; bag.sc = 1;
      if (u >= 1) { bag.st = 'in'; R.open = 0; R.flash = 0.15; sfx('cofre'); }
    }
    if (C.t >= CF.SHOW) { C.st = 'shuffle'; C.t = 0; C.si = 0; C.stT = 0; C.inGap = false; for (const q of C.list) { q.sc = 1; q.x = slotX(q.slot); q.by = row; } cfStepBegin(b, C); }
  }
  function cfShuffle(b, C, dt) {
    C.stT += dt;
    const s = C.swaps[C.si];
    if (!C.inGap) {
      const rel = s.kind === 'relabel', dur = rel ? CF.REL_DUR : C.sw, u = clamp(C.stT / dur, 0, 1);
      if (rel) C.rel = clamp(C.stT / CF.REL_FLY, 0, 1); else cfStepPose(C, u, s.kind === 'feint');
      if (u >= 1) { if (rel) cfRelEnd(C); else cfStepEnd(C, s.kind === 'feint'); C.inGap = true; C.stT = 0; }
    } else if (C.stT >= C.gap) {
      C.si++; C.stT = 0; C.inGap = false;
      if (C.si >= C.swaps.length) { C.st = 'drop'; C.t = 0; return; }
      cfStepBegin(b, C);
    }
  }
  function cfPickStart(b, C) {
    const d = b.data;
    C.st = 'pick'; C.t = 0;
    sfx('meta');
    if (!d.escolha) { d.escolha = 1; G.text(G.W / 2, G.H * 0.56, 'ESCOLHA!', { size: 14, color: MECH.TEAL_L, stroke: true, vy: 0, life: 1.0 }); } // parado: não sobe na dica
    if (C.demo) K.mechHint('tx_pick', G.W / 2, G.H * 0.52, 'ENCOSTE NO COFRE CERTO!');
  }
  function cfPick(b, C) {
    const dr = CF.DRIFT[C.ph] || 0, p = pl();
    for (const q of C.list) {
      q.bob = 6 * Math.sin(3 * C.t) * (q.i === 1 ? -1 : 1);
      if (dr) q.x = slotX(q.slot) + dr * Math.sin(1.3 * C.t); // a fileira toda anda junta (o espaço entre eles fica)
    }
    let best = -1, bd = Infinity;
    for (const q of C.list) if (K.carNear(q.x, q.y, CF.TOUCH_R)) { const dd = M.dist2(p.x, p.y, q.x, q.y); if (dd < bd) { bd = dd; best = q.i; } }
    if (best >= 0) cfResult(b, C, best);
    else if (C.t >= C.pickT) cfResult(b, C, -1);
  }
  function moth(b, x, y) {
    const L = b.data.moths;
    if (L.length < 8) L.push({ x, y, vx: M.rand(-30, 30), vy: M.rand(-70, -45), t: 0, life: 1.5, ph: Math.random() * TAU });
  }
  function txStunEnd(b) { say(b, 'ISSO VAI TER COMPENSAÇÃO!', 1.6); }
  // escolha feita (idx = o cofre encostado; -1 = acabou o tempo)
  function cfResult(b, C, idx) {
    const d = b.data, ph = cfPh(b), R = C.list[C.right], ok = idx === C.right;
    C.st = 'reveal'; C.t = 0; C.res = idx < 0 ? 'late' : ok ? 'ok' : 'miss';
    d.hold = false; d.drawerTo = 0;
    for (const q of C.list) q.bob = 0;
    if (ok) {
      R.open = 1; C.bag.st = 'pop'; C.bag.x = R.x; C.bag.y = R.y - 10;
      G.dropPix(R.x, R.y, CF.REFUND);
      G.burst(R.x, R.y - 16, 14, { colors: ['#ffd23f', '#3ddc84', '#ffffff'], speed: 200, life: 0.6 });
      G.text(R.x, R.y - 22, 'ACHOU O SEU DINHEIRO!', { color: '#ffd23f', size: 15, stroke: true });
      G.count('cofre'); K.mechOk(b); d.cfOk++;
      if (d.aliq > 0) { d.aliq = 0; G.text(b.x, b.y + 96, 'ALÍQUOTA ZERADA!', { size: 12, color: '#7ff0e2', stroke: true }); }
      for (const q of C.list) if (q !== R) { q.open = 1; moth(b, q.x, q.y - 18); }
      d.arc = null; d.zf.length = 0; // o tonto limpa os tiros (as paredes vão junto)
      K.stunStart(b, CF.STUN[ph], CF.MUL[ph], { text: ph < 4 ? 'RESTITUIÇÃO!' : 'RESTITUIÇÃO EM DOBRO!', say: M.pick(STUN_SAY), onEnd: txStunEnd });
    } else {
      if (idx >= 0) {
        const P = C.list[idx];
        P.open = 1; moth(b, P.x, P.y - 18); moth(b, P.x + 6, P.y - 14);
        G.text(P.x, P.y - 22, M.pick(MISS_TXT), { size: 12, color: '#c9cdd3', stroke: true });
        say(b, 'ERROU! SOBE A ALÍQUOTA!', 1.8); d.laughT = 1.6;
        sfx('laugh');
      } else { say(b, 'VIROU ARRECADAÇÃO!', 1.8); d.laughT = 1.2; sfx('buffer'); }
      K.mechMiss(b); d.cfMiss++;
      d.aliq = Math.min(3, d.aliq + 1);
    }
    d.cfT = CF.NEXT[ph] * (L2() ? 0.9 : 1);
  }
  function cfReveal(b, C) {
    const d = b.data, R = C.list[C.right], bag = C.bag;
    if (C.res === 'ok') {
      if (bag.st === 'pop') { const u = clamp(C.t / 0.3, 0, 1); bag.x = R.x; bag.y = R.y - 10 - 26 * M.easeOutCubic(u); bag.sc = 1 + 0.4 * u; if (u >= 1) { bag.st = 'gone'; G.burst(bag.x, bag.y, 10, { colors: ['#ffd23f', '#3ddc84'], speed: 160, life: 0.45 }); } }
      if (!C.smoke && C.t > 0.6) { C.smoke = true; cfPuff(C); }
      if (C.t > 0.75) d.cf = null;
      return;
    }
    if (!C.shown && C.t >= 0.25) {
      C.shown = true; R.open = 1; bag.st = 'peek'; bag.x = R.x; bag.y = R.y - 8; bag.sc = 1;
      G.text(R.x, R.y - 20, 'TAVA AQUI!', { size: 12, color: '#ffffff', stroke: true });
    }
    if (bag.st === 'peek') { bag.x = R.x; bag.y = R.y - 8 - 12 * M.easeOutCubic(clamp((C.t - 0.25) / 0.25, 0, 1)); }
    if (!C.taken && C.t >= 0.85) {
      C.taken = true; d.drawerTo = 1;
      G.text(b.x, b.y + 60, 'ARRECADADO!', { size: 13, color: '#ff8c1a', stroke: true });
      for (const q of C.list) { q.fx0 = q.x; q.fy0 = q.y; }
      bag.sx = bag.x; bag.sy = bag.y; bag.st = 'take';
      sfx('whoosh');
    }
    if (C.taken) {
      const u = clamp((C.t - 0.85) / 0.5, 0, 1), e = M.easeInCubic(u), tx = b.x, ty = b.y + 62;
      for (const q of C.list) { q.x = M.lerp(q.fx0, tx, e); q.by = M.lerp(q.fy0, ty, e); q.yo = 0; q.bob = 0; q.sc = 1 - 0.75 * e; }
      bag.x = M.lerp(bag.sx, tx, e); bag.y = M.lerp(bag.sy, ty, e); bag.sc = 1 - 0.75 * e;
      if (u >= 1) { sfx('caixa'); d.cf = null; d.drawerTo = 0; }
    }
  }
  function cfPuff(C) {
    for (const q of C.list) {
      G.part({ x: q.x, y: q.y, type: 'ring', size: 20, life: 0.32, color: '#ffffff' });
      G.part({ x: q.x, y: q.y - 4, vy: -24, type: 'smoke', size: 7, life: 0.45, color: 'rgba(225,230,240,0.35)', drag: 0.95 });
      G.burst(q.x, q.y, 8, { colors: ['#c9d3e6', '#ffffff', '#8b93a7'], speed: 130, life: 0.4 });
    }
  }
  // rodada cancelada sem custo (troca de turno antes do "escolha", Zé caiu): os cofres somem e o saco volta pra mão
  function cfCancel(b, next) {
    const d = b.data, C = d.cf;
    if (!C || C.st === 'reveal' || C.st === 'gone') return;
    cfPuff(C);
    const bag = C.bag;
    if (bag.st !== 'hand') { const R = C.list[C.right]; bag.sx = bag.st === 'in' ? R.x : bag.x; bag.sy = bag.st === 'in' ? R.y - 6 : bag.y; bag.st = 'home'; bag.sc = 1; }
    if (C.demo && G.run) G.run._txSeen = 0; // a demonstração volta na próxima rodada
    C.st = 'gone'; C.t = 0;
    d.hold = false; d.drawerTo = 0;
    d.cfT = next != null ? next : CF.CANCEL_NEXT;
  }
  function cfUpdate(b, dt) {
    const d = b.data, C = d.cf;
    if (!C) return;
    const p = pl();
    C.t += dt;
    for (const q of C.list) if (q.flash > 0) q.flash -= dt;
    if (C.st !== 'reveal' && C.st !== 'gone' && !p.alive) { cfCancel(b, CF.DEATH_NEXT); return; }
    if (C.st === 'show') cfShow(b, C);
    else if (C.st === 'shuffle') cfShuffle(b, C, dt);
    else if (C.st === 'drop') {
      const e = M.easeInOutSine(clamp(C.t / CF.DROP, 0, 1));
      for (const q of C.list) q.by = M.lerp(CF.ROW_Y, CF.PICK_Y, e) * G.H;
      if (C.t >= CF.DROP) cfPickStart(b, C);
    } else if (C.st === 'pick') cfPick(b, C);
    else if (C.st === 'reveal') cfReveal(b, C);
    else if (C.st === 'gone') {
      const bag = C.bag;
      if (bag.st === 'home') { const u = clamp(C.t / 0.4, 0, 1), h = bagHand('hold', b.t, PY); bag.x = M.lerp(bag.sx, b.x + h[0], u); bag.y = M.lerp(bag.sy, b.y + h[1], u) - Math.sin(u * PI) * 30; if (u >= 1) bag.st = 'gone'; }
      if (C.t > 0.45) { d.cf = null; return; }
    }
    if (d.cf !== C) return;
    for (const q of C.list) q.y = q.by + q.yo + q.bob;
    if (C.demo && (C.st === 'shuffle' || C.st === 'drop' || C.st === 'pick') && (C.glT -= dt) <= 0) C.glT = 0.5;
  }
  // a rodada só começa com o Zé na tela, fora do tonto, da carência e da invulnerabilidade da troca de turno
  function cfSchedule(b, dt) {
    const d = b.data, p = pl();
    if (d.cf || K.stunning(b) || d.mechCd > 0 || b.invulnT > 0 || !p.alive || p.entering) return;
    if (d.cfT > 0) { d.cfT -= dt; return; }
    cfStart(b);
  }
  // tiros da rodada (relógio próprio; a demonstração não atira)
  function roundPat(b, dt) {
    const d = b.data, C = d.cf, rp = d.rp;
    if (!C || C.demo || C.st === 'reveal' || C.st === 'gone') return;
    const ph = cfPh(b);
    rp.a -= dt; rp.b -= dt;
    if (ph <= 1) {
      if (rp.a <= 0) { rp.a = ROUND.KEY; const q = calcXY(b); txFan(q[0], q[1], G.aim(q[0], q[1]), ROUND.KEY_N, ROUND.KEY_SPREAD, ROUND.KEY_SPD, KEY); sfx('enemy_shot'); }
      if (ph === 1 && rp.b <= 0) { rp.b = ROUND.RING_P2; txRing(b.x, b.y + 50, ROUND.RING_P2_N, ROUND.RING_SPD, DARF, Math.random() * TAU); }
    } else if (ph === 2) {
      if (rp.a <= 0) { rp.a = ROUND.FAN_P3; const q = calcXY(b); txFan(q[0], q[1], G.aim(q[0], q[1]), 3, ROUND.FAN_SPREAD, ROUND.KEY_SPD, KEY); sfx('enemy_shot'); }
    } else if (ph === 3) {
      if (rp.a <= 0) { rp.a = ROUND.SPIRAL; txRing(b.x, b.y + 30, ROUND.SPIRAL_ARMS, ROUND.SPIRAL_SPD, PIXB, rp.ang); rp.ang += ROUND.SPIRAL_W; }
    } else {
      if (rp.a <= 0) { rp.a = ROUND.P5; txRing(b.x, b.y + 50, ROUND.RING_P5_N, ROUND.RING_SPD, DARF, Math.random() * TAU); }
      if (rp.b <= 0) { rp.b = ROUND.P5; const q = calcXY(b); txFan(q[0], q[1], G.aim(q[0], q[1]), 3, ROUND.FAN_SPREAD, ROUND.KEY_SPD, KEY); sfx('enemy_shot'); }
    }
  }
  // alvo do piloto automático / humanbot (uma rodada = um id: o humanbot guarda a decisão)
  function txGoal(b) {
    const d = b.data, C = d.cf, H = G.H;
    if (K.stunning(b)) { K.setGoal(b, clamp(b.x, 30, G.W - 30), H * 0.78, 'stun', 40, 'stun' + d.cfN); return; }
    if (C && (C.st === 'show' || C.st === 'shuffle' || C.st === 'drop' || C.st === 'pick')) {
      const R = C.list[C.right];
      if (C.st === 'pick') K.setGoal(b, R.x, R.y, 'cofre', 12, 'cf' + C.n);
      else K.setGoal(b, R.x, H * 0.74, 'cofre', 18, 'cf' + C.n);
      const o = b.autoGoal;
      if (o) {
        if (!o.alt) o.alt = [0, 0, 0, 0];
        let j = 0;
        for (const q of C.list) if (q !== R) { o.alt[j++] = clamp(q.x, 16, G.W - 16); o.alt[j++] = o.y; }
        o.k = C.k;
      }
      return;
    }
    K.clearGoal(b);
  }

  // ---------- desenho da manha ----------
  function drawBag(c, x, y, sc) { c.save(); c.translate(x, y); if (sc !== 1) c.scale(sc, sc); blit(c, bagSpr(), 0, 0); c.restore(); }
  function glint(c, x, y, k) {
    const r = 7 * k;
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.22, y - r * 0.22); c.lineTo(x + r, y); c.lineTo(x + r * 0.22, y + r * 0.22);
    c.lineTo(x, y + r); c.lineTo(x - r * 0.22, y + r * 0.22); c.lineTo(x - r, y); c.lineTo(x - r * 0.22, y - r * 0.22); c.closePath();
    c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#ffffff'; c.stroke();
  }
  // corpos dos cofres (embaixo dos tiros: nunca escondem uma bala), plaquinhas e o saco
  function drawCofres(c, b, t) {
    const C = b.data.cf;
    if (!C) return;
    const bag = C.bag, R = C.list[C.right];
    if (C.st !== 'gone' && !C.smoke) {
      for (const q of C.list) {
        c.save(); c.translate(q.x, q.y); if (q.sc !== 1) c.scale(q.sc, q.sc);
        blit(c, cofreSpr(!!q.open, false), 0, 0);
        if (q.flash > 0) { c.globalAlpha = clamp(q.flash / 0.15, 0, 1); blit(c, cofreSpr(false, true), 0, 0); c.globalAlpha = 1; }
        if (!(C.rel > 0 && q.pf >= 0)) blit(c, plateSpr(q.plate), 0, -5.5);
        c.restore();
      }
      // plaquinhas voando de um cofre para outro (MUDEI SÓ O NOME!)
      if (C.rel > 0) {
        const u = M.easeInOutSine(C.rel);
        for (const q of C.list) {
          if (q.pf < 0) continue;
          const s = C.list[q.pf];
          blit(c, plateSpr(q.plN), M.lerp(s.x, q.x, u), M.lerp(s.y, q.y, u) - 5.5 - Math.sin(u * PI) * 22);
        }
      }
      // demonstração: brilho dourado no cofre do dinheiro a cada 0,5 s
      if (C.demo && C.glT > 0.3) glint(c, R.x + 14 * R.sc, R.y - 16 * R.sc, (C.glT - 0.3) / 0.2);
    }
    // o saco: voando (entra pela tampa: só a parte acima da frente do cofre aparece), espiando, indo pra gaveta ou pra mão
    if (bag.st === 'fly' || bag.st === 'peek' || bag.st === 'pop') {
      const clip = bag.st !== 'pop' || C.t < 0.12;
      c.save();
      if (clip) { c.beginPath(); c.rect(R.x - 40, 0, 80, R.y - 12 * R.sc); c.clip(); }
      drawBag(c, bag.x, bag.y, bag.sc);
      c.restore();
    } else if (bag.st === 'take' || bag.st === 'home') drawBag(c, bag.x, bag.y, bag.sc);
  }
  // por cima dos tiros: contorno branco fino (troca) ou o anel verde-água 'QUAL?' (só na hora de escolher)
  function drawCofresOver(c, b, t) {
    const C = b.data.cf;
    if (!C || C.st === 'reveal' || C.st === 'gone') return;
    if (C.st === 'pick') {
      const blink = C.pickT - C.t < 0.8;
      for (const q of C.list) {
        K.tealHalo(c, q.x, q.y, 34, t + q.i);
        K.mechRing(c, q.x, q.y, 24, t + q.i * 0.3, { label: 'QUAL?', blink });
      }
      return;
    }
    c.save(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.9)';
    for (const q of C.list) { const s = q.sc; K.rr(c, q.x - 20 * s, q.y - 18 * s, 40 * s, 36 * s, 4 * s); c.stroke(); }
    c.restore();
  }
  function drawMoths(c, b, t) {
    for (const m of b.data.moths) {
      const a = clamp((m.life - m.t) / 0.4, 0, 1), f = 0.35 + 0.65 * Math.abs(Math.sin(m.t * 22 + m.ph));
      c.save(); c.globalAlpha = a; c.translate(m.x, m.y);
      c.fillStyle = '#b8ab92'; c.strokeStyle = INK; c.lineWidth = 0.9;
      for (const sx of [-1, 1]) {
        c.beginPath(); K.E(c, sx * 4.6, -1, 4.6, 3.6 * f, sx * 0.4); c.fill(); c.stroke();
        c.beginPath(); K.E(c, sx * 3.4, 2.6, 3, 2.2 * f, -sx * 0.3); c.fill(); c.stroke();
      }
      c.beginPath(); K.E(c, 0, 0.6, 1.4, 4.2); c.fillStyle = '#5a4b38'; c.fill();
      c.restore();
    }
  }
  // ALÍQUOTA 3: '%' girando em volta dele (traço; enfeite)
  function drawPctOrbit(c, b, t) {
    c.save(); c.lineWidth = 1.6; c.strokeStyle = '#ff8c1a';
    c.beginPath();
    for (let i = 0; i < 3; i++) { const a = t * 1.3 + (i * TAU) / 3, x = b.x + Math.cos(a) * 66, y = b.y - 6 + Math.sin(a) * 40; pctRings(c, x, y, 10); pctSlash(c, x, y, 10); }
    c.stroke();
    c.restore();
  }
  function drawMachines(c, b) {
    for (const m of b.data.mq) {
      if (m.x < -24 || m.x > G.W + 24) continue;
      blit(c, mqSpr(), m.x, m.y);
      if (m.fl > 0) { c.save(); c.globalAlpha = m.fl / 0.3 * 0.6; c.fillStyle = '#ffffff'; K.rr(c, m.x - 6.5, m.y - 9, 13, 8, 1.2); c.fill(); c.restore(); }
    }
  }
  // alfândega: guaritas nas bordas e a linha pontilhada fraquinha (só com caixas no ar)
  function drawAlf(c, b) {
    const d = b.data;
    if (!(d.alfT > 0)) return;
    const y = TX.ALF_Y * G.H, a = Math.min(1, d.alfT * 4);
    c.save();
    c.globalAlpha = 0.25 * a; c.setLineDash([3, 6]); c.lineWidth = 1.5; c.strokeStyle = '#ffffff';
    c.beginPath(); c.moveTo(26, y); c.lineTo(G.W - 26, y); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 0.85 * a; blit(c, boothSpr(false), 0, y); blit(c, boothSpr(true), G.W, y);
    c.restore();
  }
  function arrow(c, x, y, ox, oy) {
    const L = 14, ex = x + ox * L, ey = y + oy * L, px = -oy, py = ox;
    c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey);
    c.moveTo(ex - ox * 5 + px * 4.5, ey - oy * 5 + py * 4.5); c.lineTo(ex, ey); c.lineTo(ex - ox * 5 - px * 4.5, ey - oy * 5 - py * 4.5);
    c.lineWidth = 4.2; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = '#ffffff'; c.stroke();
  }
  // arcabouço: aviso tracejado amarelo (com o vão do furo) e depois o 'FURO!' andando com o lado
  function drawArcOver(c, b, t) {
    const A = b.data.arc;
    if (!A) return;
    if (A.st === 'tele') {
      const h = TX.FURO / 2, x0 = A.x0, x1 = A.x1, y0 = A.y0, y1 = A.y1, fx = x0 + A.f, fy = y0 + A.f;
      c.save();
      c.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 9));
      c.setLineDash([8, 6]); c.lineDashOffset = -t * 40; c.lineWidth = 2.2; c.strokeStyle = '#ffd23f';
      c.beginPath();
      if (A.side === 't') { c.moveTo(x0, y0); c.lineTo(fx - h, y0); c.moveTo(fx + h, y0); c.lineTo(x1, y0); } else { c.moveTo(x0, y0); c.lineTo(x1, y0); }
      if (A.side === 'r') { c.moveTo(x1, y0); c.lineTo(x1, fy - h); c.moveTo(x1, fy + h); c.lineTo(x1, y1); } else { c.moveTo(x1, y0); c.lineTo(x1, y1); }
      if (A.side === 'b') { c.moveTo(x1, y1); c.lineTo(fx + h, y1); c.moveTo(fx - h, y1); c.lineTo(x0, y1); } else { c.moveTo(x1, y1); c.lineTo(x0, y1); }
      if (A.side === 'l') { c.moveTo(x0, y1); c.lineTo(x0, fy + h); c.moveTo(x0, fy - h); c.lineTo(x0, y0); } else { c.moveTo(x0, y1); c.lineTo(x0, y0); }
      c.stroke();
      c.restore();
      K.txt(c, 'ARCABOUÇO', (x0 + x1) / 2, A.side === 't' ? y1 + 11 : y0 - 11, 10, '#ffd23f', { stroke: 3 });
    }
    const q = arcFuroXY(A, A.st === 'live' ? Math.min(A.t * A.v, 70) : 0);
    arrow(c, q[0] - q[2] * 6, q[1] - q[3] * 6, q[2], q[3]);
    K.txt(c, 'FURO!', clamp(q[0] + q[2] * 32, 24, G.W - 24), clamp(q[1] + q[3] * 24, 60, G.H - 10), 10, '#ffffff', { stroke: 3 });
  }
  function drawZerosOver(c, b, t) {
    if (((t * 8) | 0) % 2) return;
    for (const Z of b.data.zf) {
      if (Z.t >= TX.ZERO_DELAY) continue;
      for (let i = 0; i < Z.lab.length; i += 2) K.txt(c, 'ROMBO', Z.lab[i], Z.lab[i + 1], 8, '#ffffff', { stroke: 3 });
    }
  }
  function drawIofOver(c, b) {
    const l = b.data.iof;
    if (!l || l.dead || l.t >= l.warn + l.life) return;
    K.rr(c, l.x - 14, 67, 28, 14, 3); c.fillStyle = 'rgba(16,20,24,0.8)'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = '#ff2a4a'; c.stroke();
    K.txt(c, 'IOF', l.x, 74.5, 10, '#ffffff', { stroke: 2.4 });
  }
  // faixa de TV da entrada ('CADEIA NACIONAL')
  const lowerThird = () => sprite('lower|' + G.W + '|' + fontKey(), [0, -12, G.W, 24], (c) => {
    const W = G.W;
    K.rr(c, 10, -10, W - 20, 20, 4); c.fillStyle = 'rgba(16,20,34,0.55)'; c.fill();
    K.rr(c, 12, -9, 98, 18, 3); K.inked(c, '#e63946', 1.6);
    K.txt(c, 'CADEIA NACIONAL', 61, 0.5, 8.5, '#ffffff', { maxW: 90 });
    K.rr(c, 112, -9, W - 124, 18, 3); K.inked(c, '#ffd23f', 1.6);
    c.font = '9.5px ' + G.FONT_DISPLAY;
    const nw = Math.min(104, c.measureText('FERNANDO TAXAD').width);
    K.txt(c, 'FERNANDO TAXAD', 118, 0.5, 9.5, INK, { align: 'left', maxW: 104 });
    K.txt(c, '— O Taxador-Geral', 122 + nw, 0.8, 8.5, '#3a2a0a', { align: 'left', font: G.FONT_BODY, weight: 700, maxW: Math.max(20, W - 136 - nw) });
  });
  function drawLowerThird(c, b, t) {
    const u = b.state === 'enter' ? M.easeOutCubic(clamp(b.t / 0.45, 0, 1)) : 1;
    const ly = G.H < 700 ? G.H * 0.52 : G.H * 0.62;
    c.save(); c.globalAlpha = u; c.translate((1 - u) * -G.W * 0.6, 0);
    blit(c, lowerThird(), 0, ly);
    c.restore();
  }
  // LED do taxímetro conforme o estado
  function ledState(b, S, st) {
    const d = b.data;
    S.alarm = false; S.ledTxt = null; S.digits = d.meter;
    if (st) { S.ledCol = '#ffffff'; if (((b.t * 2) | 0) % 2 === 0) S.ledTxt = 'DEVOLVENDO...'; return; }
    if (b.state === 'fight' && b.phase === 2) {
      const k = K.clk(b) - d.defT0;
      S.ledCol = LED_RED; S.ledTxt = k < 2 ? 'DÉFICIT R$ 0' : biTxt(Math.min(99, ((k - 2) / 1.5 | 0) + 1));
      return;
    }
    S.ledCol = d.aliq >= 3 ? LED_RED : d.aliq === 2 ? LED_ORANGE : LED_AMBER;
    S.alarm = d.aliq >= 3 && ((b.t * 3) | 0) % 2 === 0;
  }
  // saída: um TÁXI amarelo chega pela direita, ele pula dentro acenando e o táxi sobe para a esquerda
  function drawLeaving(c, b, S, t) {
    const d = b.data;
    if (!d.lv) d.lv = { x: b.x, y: b.y };
    if (!d.leaveSaid && t > 1.2) { d.leaveSaid = true; say(b, 'PÕE NA CONTA DA UNIÃO!', 2); }
    // o core sobe o b.y; o táxi também puxa para a esquerda (função do tempo: igual em qualquer velocidade de jogo)
    const u = clamp((t - 1.2) / 2, 0, 1);
    b.x = d.lv.x - 170 * u * u;
    const x = b.x, y = b.y, ft = t - 0.75;
    // a caixa registradora fica para trás e cai girando
    if (ft > 0) {
      const fy = d.lv.y + 0.5 * 700 * ft * ft;
      if (fy < G.H + 90) {
        c.save(); c.globalAlpha = clamp(1.4 - ft, 0, 1); c.translate(d.lv.x, fy); c.rotate(ft * 1.6);
        blit(c, regSpr(false), 0, -50); blit(c, drwSpr(false), 0, 7);
        c.restore();
      }
    }
    const tin = M.easeOutCubic(clamp(t / 0.7, 0, 1));
    const tx = M.lerp(G.W + 90, x - 4, tin), ty = y + 32 - Math.sin(tin * PI) * 30;
    const hop = clamp((t - 0.7) / 0.4, 0, 1);
    S.dy = -18 * Math.sin(hop * PI) + 8 * hop;
    S.reg = ft <= 0;
    S.pose = t < 0.7 ? 'hold' : 'wave';
    drawTaxad(c, x, y, S);
    for (const jy of [2, 12]) {
      const L = 12 + Math.sin(t * 33 + jy) * 3;
      c.beginPath(); c.moveTo(tx + 58, ty + jy - 3); c.lineTo(tx + 58 + L, ty + jy); c.lineTo(tx + 58, ty + jy + 3); c.closePath(); c.fillStyle = '#ff9f1c'; c.fill();
    }
    blit(c, taxiSpr(), tx, ty);
  }

  // ======================================================================
  // O chefão
  // ======================================================================
  G.Bosses.define('taxad', {
    name: 'FERNANDO TAXAD', title: 'O Taxador-Geral', hp: HP, r: 42, homeY: 165, spdK: 1.15, fatStart: 190,
    score: 300000, pix: 260, music: 'boss', defeatText: 'TAXA ZERO!',
    phases: [
      { at: 1, name: 'Taxa das Blusinhas' },
      { at: 0.76, name: 'Arcabouço Fiscal' },
      { at: 0.52, name: 'Déficit Zero' },
      { at: 0.30, name: 'Não Vai Taxar o Pix' },
      { at: 0.13, name: 'Imposto Sobre Tudo', last: true },
    ],
    init(b) {
      const d = b.data;
      if (L2() && HP_L2 !== HP) b.hp = b.maxHp = b.maxHp * (HP_L2 / HP);
      K.mechInit(b, 'cofre'); b.mech.aliq = 0;
      d.fx = []; d.clk = 0; d.stunT = 0; d.mechCd = 0; d.spdMul = 1; d.aliq = 0; d.armor = 1; d.armorTag = null;
      d.cf = null; d.cfT = CF.FIRST; d.cfN = 0; d.cfOk = 0; d.cfMiss = 0; d.hold = false;
      d.pose = 'hold'; d.poseT = 0; d.mouth = 0; d.tx = b.homeX; d.ty = b.homeY; d.mv = null;
      d.chatT = M.rand(TX.CHAT[0], TX.CHAT[1]); d.laughT = 0; d.sayQ = null; d.saidBlusa = 0; d.escolha = 0;
      d.drawer = 0; d.drawerTo = 0; d.meter = 171; d.defT0 = 0; d.flag = 0; d.flagTo = 0; d.alfT = 0;
      d.arc = null; d.arcGen = 0; d.zf = []; d.iof = null; d.moths = []; d.rp = { a: 0, b: 0, ang: 0 };
      const my = G.H * 0.5;
      d.mq = [{ x: -34, y: my, tx: -34, ty: my, y0: my, gt: 9, on: false, fl: 0 }, { x: G.W + 34, y: my, tx: G.W + 34, ty: my, y0: my, gt: 9, on: false, fl: 0 }];
      d.mqSide = 1; d.mqLastY = -999;
      d.lv = null; d.leaveSaid = false;
      d.S = { look: [0, 0] }; d.warmI = 0;
      b.hitboxes = HB;
      K.warmPeople(b, 'p1', K.poses(TAXAD, TX_SIZE, ['idle', 'hold', 'point', 'up', 'shrug', 'wave']));
      K.warmShots(b, TX_SHOTS);
    },
    updateEnter(b) {
      const d = b.data;
      K.warmShotsStep(b, 1);
      if (d.warmI < WARM.length) WARM[d.warmI++]();
    },
    start(b) {
      const d = b.data, run = G.run || {};
      K.warmShotsStep(b, 99);
      while (d.warmI < WARM.length) WARM[d.warmI++]();
      pLatch(b);
      // IMPOSTO PROGRESSIVO: com PRESSÃO alta (≥ CRISE), uma vez por partida
      if (press().lv >= 3 && !run._txProg) {
        run._txProg = 1;
        G.text(G.W / 2, G.H * 0.50, 'IMPOSTO PROGRESSIVO!', { size: 16, color: '#ffd23f', stroke: true });
        d.sayQ = { t: 1.9, s: 'QUEM TEM MAIS, PAGA MAIS!', dur: 1.8 };
      }
      say(b, 'MEU NOME É TAXAD.', 1.8);
      K.co(b, txP1(b)); K.co(b, txTeclas(b), 1); K.co(b, cpiCo(b), 3);
    },
    update(b, dt) {
      const d = b.data;
      K.updFx(b, dt);
      // tonto = pausa: sem corrotina, relógio, movimento, conversa nem rodada nova (os cofres continuam)
      const st0 = K.stunUpdate(b, dt);
      cfUpdate(b, dt);
      const st = st0 || K.stunning(b); // o cofre certo começa o tonto neste mesmo quadro
      if (!st) {
        if (!d.hold) {
          d.clk += dt;
          K.runCo(b, dt);
          if (d.mv) { d.mv(b, d, dt); K.glide(b, dt, TX.GLIDE); }
          if ((d.chatT -= dt) <= 0) { if (!(b.sayT > 0) && !d.cf) say(b, M.pick(CHAT), 1.6); d.chatT = M.rand(TX.CHAT[0], TX.CHAT[1]); }
          if (d.poseT > 0 && (d.poseT -= dt) <= 0) d.pose = 'hold';
          d.meter += dt * 3.3;
        } else roundPat(b, dt);
        if (d.mechCd > 0) d.mechCd -= dt;
        cfSchedule(b, dt);
      } else {
        d.meter = Math.max(0, d.meter - dt * 60); // DEVOLVENDO...: o taxímetro volta
        if (Math.random() < dt * 10 * decoK()) G.part({ x: b.x + M.rand(-22, 22), y: b.y + 70, vx: M.rand(-25, 25), vy: M.rand(10, 40), type: 'dot', size: 2.6, life: 0.8, color: '#ffd23f', drag: 0.98, grav: 260 });
      }
      if (d.sayQ && (d.sayQ.t -= dt) <= 0) { say(b, d.sayQ.s, d.sayQ.dur); d.sayQ = null; }
      if (d.laughT > 0) d.laughT -= dt;
      if (d.alfT > 0) d.alfT -= dt;
      d.drawer = M.approach(d.drawer, st || d.hold ? 1 : d.drawerTo, dt * 7);
      d.flag = M.approach(d.flag, d.flagTo, dt * 2.5);
      d.mouth = M.approach(d.mouth, b.sayT > 0 ? 0.5 + 0.4 * Math.sin(b.ft * 16) : 0, dt * 4);
      // paredes: a moldura acaba quando as réguas somem (vida, tonto, morte do Zé); "00" fora da tela sai da lista
      const A = d.arc;
      if (A) { A.t += dt; if (A.st === 'live' && (!A.probe || A.probe.dead)) d.arc = null; }
      for (let i = d.zf.length - 1; i >= 0; i--) {
        const Z = d.zf[i];
        Z.t += dt;
        let on = false;
        for (let j = 0; j < Z.list.length; j += 5) { const q = Z.list[j]; if (!q.dead) { on = true; break; } }
        if (!on) d.zf.splice(i, 1);
      }
      if (d.iof && d.iof.dead) d.iof = null;
      for (const m of d.mq) {
        m.x += (m.tx - m.x) * Math.min(1, dt * 6);
        if (m.gt < TX.PIX_GLIDE) { m.gt += dt; m.y = M.lerp(m.y0, m.ty, M.easeInOutSine(clamp(m.gt / TX.PIX_GLIDE, 0, 1))); }
        if (m.fl > 0) m.fl -= dt;
      }
      for (let i = d.moths.length - 1; i >= 0; i--) {
        const m = d.moths[i];
        m.t += dt; m.x += (m.vx + Math.sin(m.t * 9 + m.ph) * 40) * dt; m.y += m.vy * dt;
        if (m.t > m.life) d.moths.splice(i, 1);
      }
      // ALÍQUOTA: armadura que acumula (zera no cofre certo); o fatigue() monta dmgMul e hudTag
      d.armor = CF.ALIQ[d.aliq]; d.armorTag = ALIQ_TAG[d.aliq];
      if (b.mech) b.mech.aliq = d.aliq;
      K.fatigue(b, 'HORA DO AJUSTE FISCAL...');
      if (!KIT_P5 && d.p5) {
        if (b.ft - d.p5T0 > P5.LIMIT) d.p5Mul = P5.MUL;
        b.dmgMul = Math.min(4, b.dmgMul * (d.p5Mul || 1));
        if (!st && !d.armorTag) b.hudTag = d.p5Mul > 1 ? P5.TAG2 : P5.TAG;
      }
      b.hitboxes = HB;
      if (b.hp / b.maxHp < 0.25 && Math.random() < dt * 4 * decoK()) G.part({ x: b.x + M.rand(-24, 24), y: b.y + 62, vx: M.rand(-10, 10), vy: -30, type: 'smoke', size: 4, life: 0.7, color: 'rgba(80,80,90,0.4)', drag: 0.95 });
      txGoal(b);
      K.trackCar(b);
    },
    onPhase(b, idx) {
      const d = b.data;
      pLatch(b);
      if (idx >= 1) K.warmPeople(b, 'p3', K.poses(TAXAD_SWEAT, TX_SIZE, ['hold', 'point', 'shrug']));
      // mudou de turno no meio do tonto: as corrotinas novas esperam o fim dele (≤ 2 s)
      if (K.stunning(b)) d.stunT = Math.min(d.stunT, 2.0);
      // rodada no meio da troca: cancela sem custo; já no "escolha": termina normal
      if (d.cf && (d.cf.st === 'show' || d.cf.st === 'shuffle' || d.cf.st === 'drop')) cfCancel(b, CF.CANCEL_NEXT);
      d.arc = null; d.zf.length = 0; d.iof = null; // o core já limpou os tiros e os lasers do aviso
      d.saidBlusa = 0; d.pose = 'hold'; d.poseT = 0; d.drawerTo = 0;
      K.co(b, null, 2);
      if (idx === 1) K.co(b, txP2(b));
      else if (idx === 2) { K.co(b, txP3(b)); d.defT0 = K.clk(b); }
      else if (idx === 3) { K.co(b, txP4(b)); K.co(b, txIOF(b), 2); }
      else if (idx === 4) {
        lastStand(b);
        G.text(G.W / 2, G.H * 0.42, 'BANDEIRA 2!', { size: 18, color: '#ffd23f', stroke: true });
        sfx('caixa'); sfx('charge');
        d.flagTo = 1; d.spdMul = TX.P5_SPD;
        say(b, 'TAXA TUDO!', 1.6);
        K.co(b, txP5(b));
        d.cfT = Math.min(d.cfT, 1.5);
      }
      if (idx < 3) mqOff(b);
      K.co(b, txTeclas(b), 1);
      K.co(b, cpiCo(b), 3);
    },
    // todo tiro que acerta também passa no taxímetro
    onHit(b) { b.data.meter += 0.4; },
    onDeath(b) {
      const d = b.data;
      K.stopCo(b); d.fx.length = 0;
      if (d.cf) { if (d.cf.st !== 'gone') cfPuff(d.cf); d.cf = null; }
      d.hold = false; d.arc = null; d.zf.length = 0; d.iof = null; d.moths.length = 0; d.alfT = 0; d.drawerTo = 0; d.sayQ = null;
      mqOff(b);
      d.stunT = 0; d.stunOnEnd = null; d.armor = 1; d.armorTag = null;
      K.clearGoal(b); b.hudTag = null;
      say(b, 'VOU REVER A ALÍQUOTA!', 2.2);
      // ISENTO!: pelo menos 4 cofres certos e nenhum errado
      if (d.cfOk >= 4 && d.cfMiss === 0) {
        G.unlock('isento');
        G.text(b.x, b.y + 60, 'ISENTO! +R$ 200', { size: 16, color: '#ffd23f', stroke: true });
        G.dropPix(b.x, b.y, 200, { noPress: true });
        const post = G.STORY && G.STORY.boss && G.STORY.boss.taxad && G.STORY.boss.taxad.postIsento;
        if (post && G.game) G.game.postLines = post;
      }
      if (b.x < 40 || b.x > G.W - 40) b.x = clamp(b.x, 60, G.W - 60);
    },
    draw(ctx, b, g) {
      const d = b.data, t = b.t, fight = b.state === 'fight', st = fight && K.stunning(b);
      const dying = b.state === 'dying', leaving = b.state === 'leaving';
      K.bubbleAt(b, 74);
      if (fight || dying) drawMachines(ctx, b);
      K.drawFx(ctx, b, 'under');
      const S = d.S;
      S.t = t; S.fl = G.isFlash(b) && !leaving; S.vec = false;
      S.spec = b.phase >= 2 || dying || leaving ? TAXAD_SWEAT : TAXAD;
      S.mood = dying ? 'hurt' : leaving ? 'laugh' : st ? 'shock' : d.laughT > 0 ? 'laugh' : b.phase === 4 && fight ? 'angry' : d.fat > 0 ? 'tired' : 'smug';
      S.mouth = b.state === 'talk' ? 0.3 + 0.3 * Math.sin(t * 10) : d.mouth;
      const bagHand0 = fight && d.cf && d.cf.st === 'show' && d.cf.bag.st === 'hand';
      S.pose = dying || st ? 'shrug' : leaving ? 'wave' : fight && !bagHand0 ? d.pose : 'hold';
      const lk = K.lookAt(b.x, b.y + PY); S.look[0] = lk[0]; S.look[1] = lk[1];
      S.stun = st; S.reg = true; S.drawer = d.drawer; S.dy = 0; S.bag = bagHand0;
      S.lcd = st ? 'ISENTO' : !fight || d.hold ? '%' : LCD[b.phase] || '%';
      S.lcdOn = !st || ((t * 4) | 0) % 2 === 0;
      ledState(b, S, st);
      S.flag = d.flag;
      if (leaving) drawLeaving(ctx, b, S, t);
      else {
        let x = b.x, y = b.y;
        if (st) x += Math.sin(t * 15) * 1.6;
        if (fight && d.hold) y += Math.sin(t * 2.2) * 2;
        drawTaxad(ctx, x, y, S);
        if (fight && d.aliq >= 3 && decoK() > 0) drawPctOrbit(ctx, b, t);
        if (st) {
          const sy = Math.max(y + HY - HR + 6, 112);
          K.dizzy(ctx, x, sy, t, 46);
          K.sweatDrop(ctx, x + 27, y + HY - 4, t, 0); K.sweatDrop(ctx, x - 29, y + HY + 2, t, 0.5);
        }
      }
      if (fight) { drawCofres(ctx, b, t); drawMoths(ctx, b, t); }
      K.drawFx(ctx, b, 'top');
      if (!(G.coreHooks && G.coreHooks.drawOver)) { ctx.save(); b.def.drawOver(ctx, b, g); ctx.restore(); }
    },
    // por cima dos tiros: alfândega, aviso do arcabouço e o furo, rombos, IOF, contornos e anéis dos cofres, faixa da TV
    drawOver(ctx, b) {
      const t = b.t;
      if (b.state === 'enter' || b.state === 'talk') { drawLowerThird(ctx, b, t); return; }
      if (b.state !== 'fight') return;
      drawAlf(ctx, b);
      drawArcOver(ctx, b, t);
      drawZerosOver(ctx, b, t);
      drawIofOver(ctx, b);
      drawCofresOver(ctx, b, t);
    },
  });

  // ======================================================================
  // Retrato (diálogos, seleção de fases, cartão da fase): busto segurando a calculadora '%'
  // ======================================================================
  if (G.Portraits && G.Portraits.define) G.Portraits.define('taxad', function (ctx, x, y, size, o) {
    o = o || {};
    const t = o.t || 0, mood = o.mood || 'smug', hurt = mood === 'hurt', k = size / 100;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.clip();
    ctx.translate(x, y + size * 0.31); ctx.scale(k, k);
    const S = {
      t, fl: false, vec: true, pose: 'hold', mood: hurt ? 'shock' : mood, mouth: o.mouth || 0, look: [o.lookX != null ? o.lookX : -0.3, 0.12],
      spec: hurt ? TAXAD_SWEAT : TAXAD, reg: false, lcd: hurt ? 'ISENTO' : '%', lcdOn: true, stun: false, dy: 0, bag: false,
    };
    drawTaxad(ctx, 0, 0, S);
    ctx.restore();
  });
})();
