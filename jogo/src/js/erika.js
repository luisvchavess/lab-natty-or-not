/* ============================================================
   FUSCA A JATO — erika.js
   Chefona 3: ERIKA VIRALTON, "A Deputada do Engajamento" (paródia da deputada Erika Hilton, PSOL-SP),
   no Lago Paranoá. Manha: CORTAR OS FIOS DA LIVE ("Segue o fio"): os celulares que transmitem a live
   dela ficam presos ao hub Wi-Fi da tribuna por fios; o Fusca passa por cima dos fios e corta.
   Todos cortados = "CAIU A LIVE!": ela fica tonta (×2,4). Fios no ar = "EM ALTA" (armadura) + VIRALIZOU.
   (+ retrato dos diálogos e estilos de tiro 'erk_'). Contrato: docs/ENGINE.md §5 e §5.1.
   Usa G.BossKit (bosses.js), obrigatório: sem ele o módulo avisa e não registra a chefona.

   Regras de conteúdo (docs/ENGINE.md §7) — valem para texto, arte, som e comentários deste arquivo:
   - A Erika é tratada como qualquer caricatura do jogo: a piada é só sobre atos públicos (lives,
     posts, fios, textão, trending, a PEC da 6x1, o PSOL no STF, discursos na tribuna), nunca sobre
     a pessoa. Sempre no feminino: "ela", "a deputada", "a Erika", "CANCELADA!".
   - 6x1: a piada é com o custo e com quem paga a conta, nunca com quem trabalha.
   - Desenho: o mesmo rosto chibi das outras caricaturas; o resto fica na roupa (amarelo e vermelho
     do PSOL), no cabelo, nas argolas, nos adereços (ring light, pau de selfie, tribuna, celular).
   - Dignidade de desenho animado, igual à Dilmãe e ao Lule: ninguém morre; ela é cancelada e sai
     voando carregada pelos drones da live, filmando.
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  if (!G || !G.Bosses) return;
  const K = G.BossKit;
  if (!K) { if (G.reportError) G.reportError('erika.js: G.BossKit ausente', 'erika'); return; }
  const M = G.m, PI = Math.PI;
  const { COL, INK, WHITE, TAU, DOWN, sfx, L2, decoK, clamp, pl, shoot, ring, fan, aimFrom, say, MECH } = K;

  // ======================================================================
  // Afinação (SPEC §7: HP → tempo de tonto → cadência → armadura)
  // ======================================================================
  // CUT_R = raio do corte no fio (px, do centro do carro), PHONE_R = encostar no celular, REGROW = segundos até
  // o fio voltar (por turno; 1º mandato ×REGROW_L1, 2º mandato ×REGROW_L2), CONNECT/LOAD = os celulares chegando /
  // carregando (sem corte), STUN = tonto "CAIU A LIVE!" (s), MUL = dano no tonto, ARMOR[n] = armadura com n fios no ar,
  // ENG_MAX = engajamento (fio·s) até o VIRALIZOU, VIRAL_N = corações do anel.
  // 1º mandato (o 2º mandato fica como na SPEC): rigs menores (PHONES_L1 celulares por turno) e PHONE_DY_L1·H mais
  // baixos, o fio cortado demora REGROW_L1× mais para voltar (quem corta devagar não perde o que já cortou), tonto
  // STUN_L1K× mais longo, LOAD_L1 s carregando e, depois do tonto, STUN_GAP_L1 s sem live (respiro; quem corta rápido
  // não emenda um tonto no outro). Celular que fica HOP_T s no ar sem ser cortado "muda de ângulo": voa HOP_DUR s para
  // mais perto do Zé (HOP_PULL do caminho na horizontal, metade do caminho até HOP_Y·H na vertical).
  const FI = {
    CUT_R: 10, PHONE_R: 12, REGROW: [11, 10, 6, 9], CONNECT: 1.4, CONNECT_P4: 1.2, LOAD: 2.0, STUN: 4.0, STUN_P4: 4.5, MUL: 2.4,
    ARMOR: [1, 0.9, 0.8, 0.75, 0.7], ENG_MAX: 20, VIRAL_N: 28,
    REGROW_L1: 2.5, REGROW_L2: 0.8, PHONES_L1: [2, 2, 3, 3], STUN_L1K: 1.25, LOAD_L1: 1.4,
    HOP_T: 4.5, HOP_DUR: 0.7, HOP_PULL: 0.55, HOP_Y: 0.76, STUN_GAP_L1: 3, PHONE_DY_L1: 0.05,
    REPLUG: 0.4, DEMO: 2.5, RIG_GAP: 1.0, JIT: 18, VIRAL_WARN: 1.2, GOAL_KEEP: 0.64,
  };
  // Padrões (SPEC §5.4; afinados com o humanbot para a escada de mortes Centrão < Dilmãe < Erika < Lule).
  // THREAD_* = fileiras de textão (DX = espaço entre tiras, GAP = fresta, WALK = quanto a fresta anda por fileira),
  // RAIN_* = chuva de carteiras da 6x1 (EVERY = s entre tiros de cada faixa, DBL = velocidade da 4x3; *_L2 = 2º mandato),
  // SAY_PRE = a fala da semana sai antes do aviso (a chuva não cobre o balão), SPIRAL_* = 4º turno.
  const PAT = {
    LIKE_N: 5, LIKE_N_L2: 7, LIKE_SPD: 108, LIKE_SPREAD: 0.62, NOTIF_P1: 2.2, NOTIF_P3: 2.4, NOTIF_SPD: 112, ADI_SPD: 100,
    THREAD_ROWS: 7, THREAD_DX: 32, THREAD_GAP: 80, THREAD_WALK: 24, THREAD_SPD: 92, THREAD_SPD_L2: 106, THREAD_EVERY: 0.66,
    RAIN_SPD: 150, RAIN_EVERY: 0.32, RAIN_EVERY_L2: 0.26, RAIN_DUR: 1.5, RAIN_WARN: 1.3, RAIN_GAP: 1.2, RAIN_DBL: 1.05, RAIN_DBL_L2: 1.15,
    RAIN_JIT: 3, RAIN_DBL_DX: 10, SAY_PRE: 0.3,
    SWAY: [45, 20, 60, 50], // balanço lateral por turno (px)
    SPIRAL_SPD: 95, SPIRAL_STEP: 0.13, SPIRAL_W: 0.9, P4_HEARTS: 3.0, P4_HEART_SPD: 112, P4_THREAD_EVERY: 8, P4_THREAD_ROWS: 1,
  };
  // HP (SPEC 4200) afinado com o humanbot (só o chefão, nv.3, 24 partidas por perfil, 1º mandato): casual cortando os
  // fios ~2,6 mortes / ~138 s e ignorando ~4 / ~170 s (a manha vale a pena); bom ~2 mortes / ~100 s (nv.5: ~73 s).
  // HP_L2 = base do 2º mandato (o core ainda põe ×1,25), a mesma de antes: o 2º mandato continua como estava.
  const HP = 4700, HP_L2 = 3400;

  // ======================================================================
  // Visual (SPEC §5.2). Tudo em px relativo ao centro do chefão (b.x, b.y).
  // ======================================================================
  const ERIKA = { skin: '#8d5a3b', face: 'oval', nose: 'small', hair: 'long', hairColor: '#17110f',
    browColor: '#17110f', body: 'suit', suit: '#ffc531', shirt: '#d7191c', tie: null, seed: 41 };
  const ERIKA_SWEAT = Object.assign({}, ERIKA, { sweat: true });
  const ERK_SIZE = 112, SC = ERK_SIZE / 100;
  const PY = -20;                          // a pessoa fica centrada em (0, PY): cabeça em -36, como ERK_HB
  const HY = PY - 14 * SC, HR = 27 * SC;   // centro e raio da cabeça (G.Art.personAnchors)
  const RING_R = 46;                       // ring light atrás da cabeça
  const TRY = PY + 44 * SC;                // topo da tribuna (como na prévia aprovada)
  const STUN_PILL_DY = TRY + 70;           // no tonto o '0 CURTIDAS' fica embaixo da tribuna (abaixo dos jatos)
  // hub Wi-Fi: no topo da tribuna (1º–3º turnos) / na borda de cima do celular-prancha (4º).
  // A SPEC pede b.y+40 / b.y+30; o hub desenhado (prévia aprovada) fica em b.y+30 nos dois casos.
  const HUB_DY = 30, HUB_DY_P4 = 30;
  const ERK_HB = [[0, 46, 30], [0, 2, 24], [0, -36, 28]];        // a tribuna vem primeiro (segura o tiro)
  const ERK_HB_SURF = [[0, 40, 30], [0, 0, 22], [0, -36, 26]];
  const HB_A = ERK_HB.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
  const HB_B = ERK_HB_SURF.map((h) => ({ dx: h[0], dy: h[1], r: h[2] }));
  const PINK = '#ff6fae', TAPE = '#ffd23f';

  const CHAT = ['SEGUE O FIO!', 'DÁ LIKE AÍ!', 'TÔ AO VIVO, GENTE!', 'ATIVA O SININHO!', 'LINK NA BIO!', 'PRINTA ESSA!',
    'FIM DA 6x1!', 'O PSOL VAI AO STF!', 'TÁ NOS TRENDING!', 'TEXTÃO NA TRIBUNA!', 'QUE FALA PROBLEMÁTICA!'];
  const CUT_TXT = ['CORTOU O FIO!', 'SEM SINAL!', 'DESCURTIU!'];
  const CUT_SAY = ['MEU FIO!', 'TRAVOU, GENTE!'];
  const STUN_SAY = ['GENTE, CAIU?!', 'CADÊ O WI-FI?', 'ALÔ? ALGUÉM?'];
  const DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

  // ---------- sprites na resolução do aparelho (partes paradas da chefona: baratas de desenhar) ----------
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
      try { paint(x); } catch (err) { G.reportError(err, 'erika sprite ' + key); }
    }
    s = { cv, box };
    if (SPR.size > 60) SPR.delete(SPR.keys().next().value);
    SPR.set(key, s);
    return s;
  }
  function blit(c, s, x, y) { const B = s.box; c.drawImage(s.cv, x + B[0], y + B[1], B[2], B[3]); }
  function stroke2(c, w1, c2, w2) { c.lineWidth = w1; c.strokeStyle = INK; c.stroke(); c.lineWidth = w2; c.strokeStyle = c2; c.stroke(); }
  function heart(c, x, y, s, fill) { c.beginPath(); K.heartPath(c, x, y, s); c.fillStyle = fill; c.fill(); }

  // ---------- pintores (vetor; os sprites e o retrato usam os mesmos) ----------
  const GLOW_BOX = [-74, HY - 74, 148, 148];
  function paintGlow(c) {
    const gr = c.createRadialGradient(0, HY, RING_R * 0.7, 0, HY, RING_R * 1.58);
    gr.addColorStop(0, 'rgba(255,250,235,0)'); gr.addColorStop(0.32, 'rgba(255,250,235,0.5)'); gr.addColorStop(1, 'rgba(255,250,235,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, HY, RING_R * 1.58, 0, TAU); c.fill();
  }
  // ring light (aceso ou escuro) + haste + o volume do cabelo (escova), tudo atrás da pessoa
  const RING_BOX = [-54, HY - 54, 108, (PY + 50) - (HY - 54)];
  function paintRing(c, lit) {
    c.beginPath(); c.moveTo(0, HY + RING_R); c.lineTo(0, PY + 45); stroke2(c, 4.5, '#c9d3e6', 2.4);
    c.beginPath(); c.arc(0, HY, RING_R, 0, TAU); stroke2(c, 9, lit ? '#fffdf4' : '#575e6e', 6);
    c.fillStyle = lit ? '#ffe9a8' : '#353a46';
    c.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; K.O(c, Math.cos(a) * RING_R, HY + Math.sin(a) * RING_R, 1.8); }
    c.fill();
    paintHair(c, false);
  }
  function paintHair(c, fl) {
    c.beginPath(); K.E(c, 0, HY + 6 * SC, HR * 1.28, HR * 1.38); K.inked(c, fl ? WHITE : ERIKA.hairColor, 3.2);
    if (fl) return;
    c.beginPath(); K.E(c, -HR * 0.62, HY - HR * 0.35, HR * 0.18, HR * 0.55, 0.5); c.fillStyle = 'rgba(255,255,255,0.16)'; c.fill();
  }
  // argolas douradas, broche do sol do PSOL e o crachá da Câmara (na frente da pessoa)
  const FRONT_BOX = [-34, HY + HR * 0.5 - 8, 68, (PY + 40 * SC) - (HY + HR * 0.5 - 8)];
  function paintFront(c) {
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * HR * 0.86, HY + HR * 0.5, 4, 0, TAU); stroke2(c, 3, '#ffcc33', 1.8); }
    // broche: disco vermelho com sol amarelo de 8 raios
    const px = -13 * SC, py = PY + 22 * SC;
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.moveTo(px + Math.cos(a) * 4.6, py + Math.sin(a) * 4.6); c.lineTo(px + Math.cos(a) * 7.2, py + Math.sin(a) * 7.2); }
    c.lineWidth = 1.7; c.strokeStyle = '#ffd23f'; c.stroke();
    c.beginPath(); K.O(c, px, py, 4); K.inked(c, '#e63946', 1.2);
    // cordão + crachá
    c.beginPath(); c.moveTo(-6 * SC, PY + 6 * SC); c.lineTo(2 * SC, PY + 30 * SC); c.lineTo(10 * SC, PY + 6 * SC);
    c.lineWidth = 1.4; c.strokeStyle = '#1d3fa0'; c.stroke();
    K.rr(c, -4 * SC, PY + 29 * SC, 12 * SC, 9 * SC, 1.5); K.inked(c, '#ffffff', 1.1);
    K.txt(c, 'CÂMARA', 2 * SC, PY + 33.6 * SC, 4, '#1d3fa0', { maxW: 11 * SC });
  }
  // tribuna da Câmara (com microfone e hub Wi-Fi) — 1º a 3º turnos
  const TRIB_BOX = [-42, TRY - 30, 84, 80];
  function paintTribuna(c, fl) {
    const ty = TRY, C = (col) => (fl ? WHITE : col);
    c.beginPath(); c.moveTo(-38, ty); c.lineTo(38, ty); c.lineTo(31, ty + 47); c.lineTo(-31, ty + 47); c.closePath(); K.inked(c, C('#8b5a2b'), 3.2);
    if (!fl) {
      c.beginPath(); c.moveTo(-34, ty + 10); c.lineTo(34, ty + 10); c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,0.25)'; c.stroke();
      c.beginPath(); c.moveTo(-26, ty + 40); c.lineTo(26, ty + 40); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,220,170,0.18)'; c.stroke();
      K.rr(c, -22, ty + 18, 44, 13, 2); K.inked(c, '#ffd23f', 1.6);
      K.txt(c, 'CÂMARA', 0, ty + 24.8, 7.5, INK, { maxW: 40 });
    }
    // microfone (pescoço de ganso)
    c.beginPath(); c.moveTo(20, ty); c.quadraticCurveTo(25, ty - 16, 13, ty - 22); stroke2(c, 3, C('#8b93a7'), 1.6);
    c.beginPath(); K.E(c, 12, ty - 23.5, 3.4, 4.5, -0.6); K.inked(c, C('#2a2f3d'), 1.2);
    paintHub(c, ty, fl);
  }
  function paintHub(c, ty, fl) {
    c.beginPath(); c.moveTo(-6.5, ty - 8); c.lineTo(-9.5, ty - 17); c.moveTo(6.5, ty - 8); c.lineTo(9.5, ty - 17); c.lineWidth = 1.7; c.strokeStyle = INK; c.stroke();
    c.beginPath(); K.O(c, -9.5, ty - 17, 1.4); K.O(c, 9.5, ty - 17, 1.4); c.fillStyle = INK; c.fill();
    K.rr(c, -10, ty - 8, 20, 9, 2); K.inked(c, '#ffffff', 1.4);
    if (fl) return;
    c.fillStyle = '#2ee6c8'; c.beginPath(); for (const lx of [-4.5, 0, 4.5]) K.O(c, lx, ty - 3.5, 1.2); c.fill();
  }
  // 4º turno: um celular gigante de prancha ("surfando no trending")
  const SURF_BOX = [-34, 14, 68, 42];
  function paintSurf(c, fl) {
    K.rr(c, -30, 29, 60, 22, 6); K.inked(c, fl ? WHITE : '#1b1f33', 2.4);
    if (!fl) {
      K.rr(c, -26, 32, 52, 16, 4); c.fillStyle = PINK; c.fill();
      heart(c, -19, 37.5, 6, '#ffffff'); heart(c, -12, 43, 5, '#ff3d7f'); heart(c, -20, 45, 4, '#ffffff');
      K.txt(c, '#TRENDING', 6, 40.5, 6.5, '#ffffff', { stroke: 2, maxW: 34 });
    }
    paintHub(c, 30, fl);
  }
  // celular do pau de selfie (14×24, capinha vermelha)
  const SELFIE_BOX = [-9, -14, 18, 28];
  function paintSelfie(c, kind) {
    const fl = kind === 'flash';
    K.rr(c, -7, -12, 14, 24, 2.8); K.inked(c, fl ? WHITE : '#d7191c', 1.8);
    if (fl) return;
    K.rr(c, -5.2, -9.8, 10.4, 19.6, 1.8); c.fillStyle = kind === 'static' ? '#80868f' : '#1b1f33'; c.fill();
    if (kind === 'static') {
      // chiado cinza (sem sinal)
      for (let i = 0; i < 14; i++) { const v = (i * 53) % 9; c.fillStyle = v % 2 ? '#c3c7cf' : '#5b6170'; c.fillRect(-4.6 + ((i * 37) % 8), -9 + ((i * 29) % 18), 2.4, 1.1); }
      return;
    }
    c.beginPath(); K.O(c, -2.8, -6.8, 1.3); c.fillStyle = '#ff2d55'; c.fill();
    K.txt(c, 'AO VIVO', 1.6, -6.7, 5, '#ffffff', { maxW: 6 });
    heart(c, 0, 2, 6, PINK);
  }
  // celular da live (tripé ou drone), 22×34
  const RP_BOX = [-26, -30, 52, 70];
  function paintRigPhone(c, mode, cut) {
    if (mode === 'tripod') {
      c.beginPath(); c.moveTo(0, 16); c.lineTo(-10, 37); c.moveTo(0, 16); c.lineTo(0, 37); c.moveTo(0, 16); c.lineTo(10, 37); stroke2(c, 3.2, '#9aa3b5', 1.6);
      // mini ring light (r 9) atrás do topo do celular
      c.beginPath(); c.arc(0, -17, 9, 0, TAU); stroke2(c, 4, cut ? '#6b7180' : '#ffffff', 2.4);
    } else {
      c.beginPath(); c.moveTo(-17, -15); c.lineTo(17, 15); c.moveTo(17, -15); c.lineTo(-17, 15); stroke2(c, 3.4, '#9aa3b5', 1.8);
      c.beginPath(); for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.O(c, sx * 17, sy * 15, 2.4); K.inked(c, '#3a3f4c', 1.2);
    }
    K.rr(c, -11, -17, 22, 34, 4); K.inked(c, '#f2f4f8', 2);
    K.rr(c, -8.5, -13.5, 17, 25, 2.5); c.fillStyle = cut ? '#3a3f4c' : '#1b1f33'; c.fill();
    c.beginPath(); K.O(c, 0, 14.4, 1.3); c.fillStyle = '#9aa3b5'; c.fill();
    if (cut) {
      K.txt(c, 'SEM', 0, -4, 5, '#ffffff', { maxW: 15 }); K.txt(c, 'SINAL', 0, 2, 5, '#ffffff', { maxW: 15 });
      return;
    }
    c.beginPath(); K.O(c, -4.6, -9.6, 1.8); c.fillStyle = '#ff2d55'; c.fill();
    K.txt(c, 'AO VIVO', 2.4, -9.5, 5, '#ffffff', { maxW: 9.5 });
    heart(c, 0, 1.5, 9, PINK);
  }
  const PLUS_BOX = [-7, -6, 14, 12];
  function paintPlus(c) { K.txt(c, '+1', 0, 0, 7, '#ffffff', { font: G.FONT_BODY, weight: 700, stroke: 2.4 }); }
  const CORTE_BOX = [-32, -8, 64, 16];
  function paintCorte(c) { K.txt(c, 'CORTE!', 0, 0, 9, '#ffffff', { stroke: 3, maxW: 58 }); }

  const glowSpr = () => sprite('glow', GLOW_BOX, paintGlow);
  const ringSpr = (lit) => sprite(lit ? 'ring1' : 'ring0', RING_BOX, (c) => paintRing(c, lit));
  const frontSpr = () => sprite('front|' + fontKey(), FRONT_BOX, paintFront);
  const tribSpr = (fl) => sprite('trib' + (fl ? 'F' : '') + '|' + fontKey(), TRIB_BOX, (c) => paintTribuna(c, fl));
  const surfSpr = (fl) => sprite('surf' + (fl ? 'F' : '') + '|' + fontKey(), SURF_BOX, (c) => paintSurf(c, fl));
  const selfieSpr = (kind) => sprite('selfie|' + kind + '|' + fontKey(), SELFIE_BOX, (c) => paintSelfie(c, kind));
  const rigSpr = (mode, cut) => sprite('rp|' + mode + (cut ? '|x' : '') + '|' + fontKey(), RP_BOX, (c) => paintRigPhone(c, mode, cut));
  const plusSpr = () => sprite('plus|' + fontKey(), PLUS_BOX, paintPlus);
  const corteSpr = () => sprite('corte|' + fontKey(), CORTE_BOX, paintCorte);
  // aquecimento: um sprite por quadro na entrada (nada de pintar canvas grande no 1º quadro da luta)
  const WARM = [glowSpr, () => ringSpr(true), () => ringSpr(false), frontSpr, () => tribSpr(false), () => tribSpr(true),
    () => selfieSpr('live'), () => selfieSpr('static'), () => selfieSpr('flash'), () => rigSpr('tripod', false), () => rigSpr('tripod', true),
    () => rigSpr('drone', false), () => rigSpr('drone', true), plusSpr, corteSpr, () => surfSpr(false), () => surfSpr(true)];

  // ---------- partes vivas ----------
  // ponta do pau de selfie por pose: [mão, dx, dy, giro do celular]
  const STICK = { hold: [29, -49, 0.25], idle: [24, -46, 0.22], point: [24, -42, 0.3], up: [14, -44, 0.15], fist: [20, -42, 0.22], shrug: [5, -60, 0.05], wave: [-26, -44, -0.25] };
  const STICK_OUT = { x0: 0, y0: 0, x: 0, y: 0, rot: 0 };
  function stickPos(pose, t, stun) {
    const st = STICK[pose] || STICK.hold;
    const h = K.hand(ERK_SIZE, pose, t, ERIKA.seed, pose !== 'wave', 1);
    const o = STICK_OUT;
    o.x0 = h.x; o.y0 = PY + h.y;
    const wob = stun ? Math.sin(t * 7) * 5 : 0;
    o.x = o.x0 + st[0] + wob; o.y = o.y0 + st[1]; o.rot = st[2] + (stun ? Math.sin(t * 7) * 0.12 : 0);
    return o;
  }
  // celular do pau de selfie em coordenadas de tela (de onde saem as curtidas)
  function phoneXY(b) {
    const d = b.data, o = stickPos(d.pose || 'hold', b.t, false);
    return [b.x + o.x, b.y + o.y];
  }
  function drawStick(c, S) {
    const o = stickPos(S.pose, S.t, S.stun);
    c.beginPath(); c.moveTo(o.x0, o.y0); c.lineTo(o.x, o.y); stroke2(c, 5, S.fl ? WHITE : '#c9d3e6', 2.7);
    c.save(); c.translate(o.x, o.y); c.rotate(o.rot);
    if (S.vec) { c.lineJoin = 'round'; paintSelfie(c, S.fl ? 'flash' : S.phone === 'live' ? 'live' : 'static'); }
    else blit(c, selfieSpr(S.fl ? 'flash' : S.phone === 'live' ? 'live' : 'static'), 0, 0);
    if (S.phone === 'nosignal') { spinner(c, 0, 2, 3.2, S.t, '#ffffff'); K.txt(c, 'SEM SINAL', 0, -5.5, 3.2, '#ffffff', { maxW: 9.5 }); }
    c.restore();
  }
  function jets(c, y, t) {
    for (const jx of [-19, 19]) {
      const L = 11 + Math.sin(t * 31 + jx) * 2.5 + Math.sin(t * 53) * 1.2;
      c.beginPath(); c.moveTo(jx - 5, y); c.lineTo(jx, y + L); c.lineTo(jx + 5, y); c.closePath(); c.fillStyle = '#ff9f1c'; c.fill();
      c.beginPath(); c.moveTo(jx - 2.5, y); c.lineTo(jx, y + L * 0.55); c.lineTo(jx + 2.5, y); c.closePath(); c.fillStyle = '#ffe08a'; c.fill();
    }
  }
  // 2º turno: calendário de mesa ('6x1' que vira '4x3'); 3º: pilha de envelopes 'AO STF'
  function deskProp(c, S) {
    if (S.prop === 'cal') {
      const fy = Math.abs(Math.cos(Math.min(1, S.flip || 0) * PI)), lab = (S.flip || 0) > 0.5 ? S.cal2 : S.cal;
      c.save(); c.translate(-27, TRY - 5); c.scale(1, Math.max(0.08, fy));
      K.rr(c, -8, -7, 16, 14, 2); K.inked(c, '#ffffff', 1.4);
      c.fillStyle = '#e63946'; c.fillRect(-7.2, -6.2, 14.4, 3.6);
      K.txt(c, lab, 0, 2.2, 6.5, INK, { maxW: 14 });
      c.restore();
    } else if (S.prop === 'stf') {
      for (let i = 0; i < 3; i++) { K.rr(c, -35 + i * 1.5, TRY - 6 - i * 4, 17, 9, 1.5); K.inked(c, i === 2 ? '#fff6e0' : '#e8dcc0', 1.2); }
      K.txt(c, 'AO STF', -26, TRY - 9.5, 4.6, '#e63946', { maxW: 15 });
    }
  }
  function countPill(c, x, y, label, t) {
    c.font = '9px ' + G.FONT_DISPLAY;
    const tw = Math.min(70, textW(c, label));
    K.rr(c, x - tw / 2 - 14, y - 7, tw + 24, 14, 7); c.fillStyle = 'rgba(20,18,26,0.85)'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke();
    heart(c, x - tw / 2 - 5, y + 0.3, 8, '#ff4d8d');
    K.txt(c, label, x + 5, y + 0.5, 9, '#ffffff', { stroke: 2, maxW: 70 });
  }
  const TW = new Map();
  function textW(c, s) { const k = s + '|' + c.font; let w = TW.get(k); if (w == null) { w = c.measureText(s).width; if (TW.size > 80) TW.clear(); TW.set(k, w); } return w; }
  function spinner(c, x, y, r, t, col) {
    const a0 = Math.floor(t * 10) % 8;
    c.fillStyle = col;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, k = ((i - a0 + 8) % 8) / 8;
      c.globalAlpha = 0.25 + 0.75 * k;
      c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(0.6, r * 0.24), 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }
  // ícone de Wi-Fi riscado
  function wifiX(c, x, y, k) {
    c.save(); c.lineCap = 'round';
    c.beginPath();
    for (const r of [3, 6, 9]) { c.moveTo(x + Math.cos(-PI * 0.75) * r * k, y + 4 * k + Math.sin(-PI * 0.75) * r * k); c.arc(x, y + 4 * k, r * k, -PI * 0.75, -PI * 0.25); }
    c.lineWidth = 1.8 * k; c.strokeStyle = '#ffffff'; c.stroke();
    c.beginPath(); c.moveTo(x - 6 * k, y - 4 * k); c.lineTo(x + 6 * k, y + 5 * k); c.lineWidth = 2 * k; c.strokeStyle = '#ff2a4a'; c.stroke();
    c.restore();
  }
  // selo "SEM SINAL" (tonto): Wi-Fi riscado + texto + spinner de carregando
  function noSignal(c, x, y, t) {
    K.rr(c, x - 48, y - 7, 96, 14, 7); c.fillStyle = 'rgba(20,18,26,0.88)'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke();
    wifiX(c, x - 35, y - 1, 0.85);
    K.txt(c, 'SEM SINAL', x - 1, y + 0.5, 8, '#ffffff', { maxW: 56 });
    spinner(c, x + 37, y, 4.2, t, '#ffffff');
  }
  function drone(c, x, y, t, k) {
    c.save(); c.translate(x, y); c.scale(k, k);
    c.beginPath(); c.moveTo(-11, -4); c.lineTo(11, 4); c.moveTo(11, -4); c.lineTo(-11, 4); stroke2(c, 3, '#9aa3b5', 1.5);
    K.rr(c, -6, -4, 12, 8, 2.5); K.inked(c, '#2a2f3d', 1.4);
    c.beginPath(); K.O(c, 0, 2.5, 2.2); c.fillStyle = '#7fb8ff'; c.fill();
    c.beginPath(); K.O(c, 4, -1.5, 1); c.fillStyle = '#ff2d55'; c.fill();
    c.fillStyle = 'rgba(225,232,245,0.6)';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { c.beginPath(); K.E(c, sx * 11, sy * 4 - 2, 6.5, 1.6 + Math.abs(Math.sin(t * 40 + sx + sy)) * 0.8); c.fill(); }
    c.restore();
  }

  /**
   * Desenha a Erika. S: { t, fl, pose, mood, mouth, look, lit, glowA, spec, surf, stun, likes, cal, cal2, flip, prop,
   *   phone: 'live'|'static'|'nosignal', vehicle, counter, vec (retrato: só vetor), tilt }
   */
  function drawErika(c, x, y, S) {
    const t = S.t, fl = S.fl;
    c.save(); c.translate(x, y);
    if (S.tilt) { c.translate(0, 40); c.rotate(S.tilt); c.translate(0, -40); }
    c.lineJoin = 'round'; c.lineCap = 'round';
    // 1) brilho do ring light, o anel e o volume do cabelo (atrás)
    if (S.lit && !fl && S.glowA > 0) {
      c.globalAlpha = Math.min(1, S.glowA);
      if (S.vec) paintGlow(c); else blit(c, glowSpr(), 0, 0);
      c.globalAlpha = 1;
    }
    if (S.vec) paintRing(c, S.lit); else blit(c, ringSpr(S.lit), 0, 0);
    if (fl) paintHair(c, true);
    // 2) a pessoa
    G.Art.person(c, 0, PY, ERK_SIZE, S.spec || ERIKA, { t, mood: S.mood, mouth: S.mouth, pose: S.pose, flash: fl, lookX: S.look[0], lookY: S.look[1], autoLook: false });
    // 3) argolas, broche e crachá
    if (!fl) { if (S.vec) paintFront(c); else blit(c, frontSpr(), 0, 0); }
    // 4) pau de selfie
    drawStick(c, S);
    // 5) tribuna (ou o celular-prancha)
    if (S.vehicle) {
      if (S.surf) { if (S.vec) paintSurf(c, fl); else blit(c, surfSpr(fl), 0, 0); if (!fl) jets(c, 51, t); }
      else {
        if (S.vec) paintTribuna(c, fl); else blit(c, tribSpr(fl), 0, 0);
        if (!fl) { jets(c, TRY + 47, t); deskProp(c, S); }
      }
    }
    c.restore();
    // 6) contador de curtidas acima do ring light (fica abaixo da barra do chefão)
    if (S.counter) countPill(c, x, S.pillY != null ? S.pillY : y + HY - RING_R - 10, S.likes, t);
  }

  // ======================================================================
  // Estilos de tiro (prefixo erk_; saturados, nunca verde-água)
  // ======================================================================
  const BS = G.BulletStyles, glowOn = K.glowOn;
  BS.define('erk_like', { r: 5, size: 18, paint(x, s, c) {
    glowOn(x, c, 7); x.beginPath(); K.heartPath(x, 0, 0.6, s * 0.9); x.fillStyle = c; x.fill();
    x.shadowBlur = 0; x.beginPath(); K.heartPath(x, 0, 0.2, s * 0.42); x.fillStyle = '#ffffff'; x.fill();
  } });
  BS.define('erk_hash', { r: 4.6, size: 17, spin: 3, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.46, 0, TAU); x.fill();
    x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.lineWidth = s * 0.1; x.lineCap = 'round';
    const a = s * 0.12, b = s * 0.25, sk = s * 0.05;
    x.beginPath();
    x.moveTo(-a + sk, -b); x.lineTo(-a - sk, b); x.moveTo(a + sk, -b); x.lineTo(a - sk, b);
    x.moveTo(-b, -a); x.lineTo(b, -a); x.moveTo(-b, a); x.lineTo(b, a);
    x.stroke();
  } });
  BS.define('erk_textao', { r: 4.2, size: 22, rotate: true, paint(x, s, c) {
    const w = 20, h = 8;
    glowOn(x, c, 5); x.fillStyle = c; x.fillRect(-w / 2 - 1.2, -h / 2 - 1.2, w + 2.4, h + 2.4);
    x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.fillRect(-w / 2 + 0.4, -h / 2 + 0.4, w - 0.8, h - 0.8);
    x.fillStyle = '#8d96a8';
    for (let i = 0; i < 3; i++) x.fillRect(-w / 2 + 2.4, -h / 2 + 1.5 + i * 1.95, i === 2 ? 9 : 15, 1.05);
  } });
  BS.define('erk_notif', { r: 4.4, size: 14, paint(x, s, c) {
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.44, 0, TAU); x.fill();
    x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.lineWidth = 1.3; x.beginPath(); x.arc(0, 0, s * 0.4, 0, TAU); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '900 ' + (s * 0.56) + 'px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('1', 0, s * 0.04);
  } });
  BS.define('erk_ctps', { r: 5, size: 20, paint(x, s, c) {
    const w = 14, h = 18;
    glowOn(x, c, 6); x.fillStyle = c; x.beginPath(); x.rect(-w / 2, -h / 2, w, h); x.fill();
    x.shadowBlur = 0; x.strokeStyle = 'rgba(60,0,10,0.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-w / 2 + 2, -h / 2); x.lineTo(-w / 2 + 2, h / 2); x.stroke();
    x.strokeStyle = '#ffffff'; x.lineWidth = 1; x.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    x.fillStyle = '#ffd23f'; x.font = '900 4px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('CTPS', 1, -h / 2 + 4.2, w - 3);
    x.beginPath(); x.arc(1, 2, 2.6, 0, TAU); x.strokeStyle = '#ffd23f'; x.lineWidth = 0.9; x.stroke();
  } });
  BS.define('erk_adi', { r: 5, size: 18, spin: 1.2, paint(x, s, c) {
    const w = 13, h = 16;
    glowOn(x, c, 7); x.fillStyle = '#fff1d6'; x.fillRect(-w / 2, -h / 2, w, h);
    x.shadowBlur = 0; x.strokeStyle = c; x.lineWidth = 1.4; x.strokeRect(-w / 2 + 0.7, -h / 2 + 0.7, w - 1.4, h - 1.4);
    x.fillStyle = '#9aa3b5'; for (let i = 0; i < 3; i++) x.fillRect(-4.5, -5.5 + i * 2.3, 9, 0.9);
    x.save(); x.translate(0, 3.2); x.rotate(-0.25);
    x.strokeStyle = c; x.lineWidth = 1; x.strokeRect(-5, -2.6, 10, 5.2);
    x.fillStyle = c; x.font = '900 4.4px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ADI', 0, 0.2, 9);
    x.restore();
  } });
  const ERK_SHOTS = [['erk_like', COL.pink], ['erk_like', COL.hot], ['erk_like', COL.red], ['erk_hash', COL.magenta], ['erk_hash', COL.orange],
    ['erk_textao', COL.red], ['erk_notif', COL.red], ['erk_ctps', COL.red], ['erk_adi', COL.red], ['bs_cedula', COL.orange]];
  const LIKE = { style: 'erk_like', color: COL.pink }, LIKE_H = { style: 'erk_like', color: COL.hot }, LIKE_R = { style: 'erk_like', color: COL.red };
  const TEXTAO = { style: 'erk_textao', color: COL.red }, NOTIF = { style: 'erk_notif', color: COL.red };
  const CTPS = { style: 'erk_ctps', color: COL.red }, CEDULA = { style: 'bs_cedula', color: COL.orange };
  const HASH_M = { style: 'erk_hash', color: COL.magenta }, HASH_O = { style: 'erk_hash', color: COL.orange };
  // multiplicador de velocidade que shoot()/G.fire aplicam (para quem muda a velocidade no meio do voo)
  const spdK = (b) => (b.def.spdK || 1) * ((G.game && G.game.diff) || 1);

  // ======================================================================
  // A manha: CORTAR OS FIOS DA LIVE (SPEC §5.5)
  // ======================================================================
  // rig d.live = { gen, st: null|'connecting'|'loading'|'on'|'down', t, dur, phones: [] }
  // phone = { i, x, y, bx, by, vx, cut, regrowT, mode, inT, ... + pts (11 pontos do fio), cum (comprimento) }
  // rig cheio (2º mandato, SPEC §5.5); no 1º mandato fica só o começo da lista (FI.PHONES_L1 por turno)
  function rigLayout(b) {
    const W = G.W, H = G.H, ph = b.phase, l2 = L2(), L = [];
    if (ph === 0) L.push([0.18 * W, 0.66 * H, 'tripod'], [0.82 * W, 0.62 * H, 'tripod'], [0.5 * W, 0.72 * H, 'tripod']);
    else if (ph === 1) {
      // nas faixas do calendário: DOM (a folga da 6x1) e QUA (o meio, dia de trampo: corte entre as chuvas);
      // no 2º mandato também SEG e SEX
      L.push([(6.5 * W) / 7, 0.62 * H, 'tripod'], [(3.5 * W) / 7, 0.72 * H, 'tripod'], [(0.5 * W) / 7, 0.66 * H, 'tripod'], [(4.5 * W) / 7, 0.68 * H, 'tripod']);
    } else if (ph === 2) L.push([0.15 * W, 0.58 * H, 'tripod', 'slide'], [0.85 * W, 0.58 * H, 'tripod', 'slide'], [W / 2, 0.5 * H, 'drone', 'live']);
    else if (l2 || FI.PHONES_L1[3] >= 4) for (let i = 0; i < 4; i++) L.push([[0.12, 0.38, 0.62, 0.88][i] * W, (i % 2 ? 0.68 : 0.58) * H, 'drone', 'bob']);
    else L.push([0.16 * W, 0.58 * H, 'drone', 'bob'], [0.5 * W, 0.68 * H, 'drone', 'bob'], [0.84 * W, 0.58 * H, 'drone', 'bob']);
    if (!l2) L.length = Math.min(L.length, FI.PHONES_L1[ph]);
    return L;
  }
  function rigStart(b) {
    const d = b.data, Lv = d.live, W = G.W, H = G.H;
    Lv.gen++; Lv.st = 'connecting'; Lv.t = 0; Lv.dur = b.phase === 3 ? FI.CONNECT_P4 : FI.CONNECT;
    Lv.phones.length = 0;
    const lay = rigLayout(b);
    for (let i = 0; i < lay.length; i++) {
      const [x0, y0, mode, mv] = lay[i];
      const jx = mv === 'live' ? 0 : M.rand(-FI.JIT, FI.JIT);
      const bx = clamp(x0 + jx, 36, W - 36), by = clamp(y0 + M.rand(-FI.JIT, FI.JIT) + (L2() ? 0 : FI.PHONE_DY_L1 * H), H * 0.5, H * 0.74);
      Lv.phones.push({
        i, x: bx < W / 2 ? -30 : W + 30, y: by - 40, bx, by, vx: (Math.random() < 0.5 ? -1 : 1) * 18, cut: false, regrowT: 0, regrow0: 1, mode, mv: mv || null, inT: 0,
        sx: bx < W / 2 ? -30 : W + 30, x0b: bx, side: bx >= W / 2 ? 1 : -1, ph: Math.random() * TAU, plugT: 0, cutT: 0, cutK: 0.5, tape: false, tilt: 0, onT: 0, hopT: 0, hox: 0, hoy: 0,
        pts: new Float32Array(22), cum: new Float32Array(11), hx: 0, hy: 0, cx: 0, cy: 0, px: 0, py: 0, mt: 0,
      });
    }
    d.firstRig = Lv.gen === 1 && !L2();
    d.armor = 1; d.armorTag = null;
    sfx('whoosh');
  }
  // sumiço dos celulares (troca de turno, fim do tonto, morte): uma fumacinha em cada um
  function rigClear(b, puff) {
    const Lv = b.data.live;
    if (puff) for (const ph of Lv.phones) { G.burst(ph.x, ph.y, 8, { colors: ['#c9d3e6', '#ffffff', PINK], speed: 120, life: 0.45 }); G.part({ x: ph.x, y: ph.y, type: 'smoke', size: 10, life: 0.6, color: 'rgba(200,206,220,0.5)', drag: 0.95 }); }
    Lv.phones.length = 0;
  }
  // posição do celular (anda até no tonto: os objetos da manha nunca congelam)
  function phoneMove(b, ph, dt, Lv) {
    const W = G.W, H = G.H;
    ph.mt += dt;
    let tx = ph.bx, ty = ph.by;
    if (ph.mv === 'slide') {
      ph.bx += ph.vx * dt;
      if (ph.bx < ph.x0b - 30) { ph.bx = ph.x0b - 30; ph.vx = Math.abs(ph.vx); }
      if (ph.bx > ph.x0b + 30) { ph.bx = ph.x0b + 30; ph.vx = -Math.abs(ph.vx); }
      tx = ph.bx;
    } else if (ph.mv === 'live') { tx = W / 2 + 90 * Math.sin(0.6 * ph.mt); ty = ph.by; }
    else if (ph.mv === 'bob') ty = ph.by + 12 * Math.sin(1.6 * ph.mt + ph.ph);
    tx = clamp(tx, 36, W - 36); ty = clamp(ty, H * 0.48, H * 0.76);
    if (Lv.st === 'connecting') {
      ph.inT = Math.min(1, Lv.t / Lv.dur);
      const u = M.easeOutCubic(ph.inT);
      ph.x = M.lerp(ph.sx, tx, u); ph.y = M.lerp(ty - 40, ty, u) - Math.sin(u * PI) * 26;
    } else if (ph.hopT > 0) {
      // mudando de ângulo: voa num arco curto até o lugar novo (o fio continua cortável)
      ph.hopT -= dt;
      const u = M.easeOutCubic(1 - Math.max(0, ph.hopT) / FI.HOP_DUR);
      ph.x = M.lerp(ph.hox, tx, u); ph.y = M.lerp(ph.hoy, ty, u) - Math.sin(u * PI) * 18;
    } else { ph.x = tx; ph.y = ty; }
    // cortado: o celular tomba 20° (vai e volta com mola)
    const want = ph.cut ? 0.35 * ph.side : 0;
    ph.tilt += (want - ph.tilt) * Math.min(1, dt * 10);
  }
  // 1º mandato: celular esquecido no ar muda de ângulo e chega mais perto do Zé (outro lugar = outro alvo)
  function phoneHop(b, ph, Lv) {
    const W = G.W, H = G.H, p = pl(), px = p && p.alive ? p.x : W / 2;
    ph.onT = 0; ph.hopT = FI.HOP_DUR; ph.hox = ph.x; ph.hoy = ph.y;
    let nx = clamp(M.lerp(ph.x, px, FI.HOP_PULL) + M.rand(-20, 20), 36, W - 36);
    const ny = clamp(M.lerp(ph.by, H * FI.HOP_Y, 0.5) + M.rand(-10, 10), H * 0.5, H * 0.74);
    for (const q of Lv.phones) if (q !== ph && Math.abs(q.bx - nx) < 56 && Math.abs(q.by - ny) < 64) nx = clamp(nx + (nx < q.bx ? -56 : 56), 36, W - 36);
    ph.bx = ph.x0b = nx; ph.by = ny; ph.side = nx >= W / 2 ? 1 : -1;
    ph.n = (ph.n || 0) + 1;
    sfx('whoosh');
    G.text(ph.hox, ph.hoy - 34, 'NOVO ÂNGULO!', { size: 9, color: MECH.TEAL_L, life: 0.8, stroke: true });
  }
  // fio = Bézier quadrática hub → topo do celular, controle abaixo (o fio faz barriga; nunca reto)
  function cableSample(ph, hx, hy) {
    // topo do celular (Pt): acompanha o tombo do celular cortado (tripé gira no pé do celular, drone no centro)
    const arm = ph.mode === 'tripod' ? 36 : 20, piv = ph.mode === 'tripod' ? 16 : 0;
    const px = ph.x + Math.sin(ph.tilt) * arm, py = ph.y + piv - Math.cos(ph.tilt) * arm;
    const dx = px - hx;
    let cx = (hx + px) / 2 + dx * 0.15;
    if (Math.abs(dx) < 60) cx += ph.side * (60 - Math.abs(dx)) * 0.9; // celular embaixo dela: o fio faz curva de lado
    const cy = Math.max(hy, py) + 34;
    ph.hx = hx; ph.hy = hy; ph.cx = cx; ph.cy = cy; ph.px = px; ph.py = py;
    const P = ph.pts, C = ph.cum;
    let lx = hx, ly = hy, acc = 0;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, u = 1 - t, a = u * u, bb = 2 * t * u, cc = t * t;
      const x = a * hx + bb * cx + cc * px, y = a * hy + bb * cy + cc * py;
      P[2 * i] = x; P[2 * i + 1] = y;
      if (i) acc += Math.hypot(x - lx, y - ly);
      C[i] = acc; lx = x; ly = y;
    }
  }
  const QP = [0, 0];
  function cablePt(ph, t) {
    const u = 1 - t, a = u * u, bb = 2 * t * u, cc = t * t;
    QP[0] = a * ph.hx + bb * ph.cx + cc * ph.px; QP[1] = a * ph.hy + bb * ph.cy + cc * ph.py;
    return QP;
  }
  const loadT = () => (L2() ? FI.LOAD : FI.LOAD_L1);
  function liveCount(Lv) { let n = 0; for (const ph of Lv.phones) if (!ph.cut) n++; return n; }
  // texto exato (×0,75 não vira ×0,8): 'EM ALTA ×0,9' / '×0,8' / '×0,75' / '×0,7'
  const ARMOR_TAG = FI.ARMOR.map((a) => ({ text: 'EM ALTA ×' + String(a).replace('.', ','), color: PINK }));
  // o rig liga (fio cortável). 1ª live da partida (1º mandato) = demonstração: 2,5 s sem tiro
  function rigOn(b) {
    const d = b.data;
    sfx('tink');
    if (d.demo && !d.demoOn) {
      d.demoOn = true; d.demoT = FI.DEMO;
      say(b, 'PERAÍ, TÔ GRAVANDO!', 2.2); d.pose = 'point'; d.poseT = FI.DEMO;
      K.mechHint('erk_fio', G.W / 2, G.H * 0.5, 'CORTE OS FIOS DA LIVE!');
    }
  }
  function cutPhone(b, ph, seg) {
    const d = b.data, P = ph.pts;
    let hx, hy;
    if (seg >= 10) { hx = ph.x; hy = ph.y - 20; ph.cutK = 0.94; }
    else { hx = (P[2 * seg] + P[2 * seg + 2]) / 2; hy = (P[2 * seg + 1] + P[2 * seg + 3]) / 2; ph.cutK = (seg + 0.5) / 10; }
    ph.cut = true; ph.cutT = 0; ph.tape = false; ph.onT = 0;
    ph.regrowT = ph.regrow0 = FI.REGROW[b.phase] * (L2() ? FI.REGROW_L2 : FI.REGROW_L1);
    sfx('snap');
    G.burst(hx, hy, 6, { colors: [MECH.TEAL, MECH.TEAL_L], speed: 190, life: 0.45 });
    G.burst(hx, hy, 4, { colors: ['#ffffff'], speed: 240, life: 0.35 });
    G.text(hx, hy - 12, M.pick(CUT_TXT), { size: 11, color: MECH.TEAL_L, stroke: true, life: 1.0 });
    if (d.cutSayT <= 0) { say(b, M.pick(CUT_SAY), 1.4); d.cutSayT = 2; }
    G.addScore(500, hx, hy + 2, true);
    G.count('fio'); K.mechOk(b);
    if (liveCount(d.live) === 0) erkStun(b);
  }
  // todos cortados: CAIU A LIVE! (tonto ×2,4)
  function erkStun(b) {
    const d = b.data;
    d.flopT = 0.9; // 'FLOPOU!' sai logo depois do 'CAIU A LIVE!' (não empilha com ele nem com o 'BRECHA!')
    K.stunStart(b, (b.phase < 3 ? FI.STUN : FI.STUN_P4) * (L2() ? 1 : FI.STUN_L1K), FI.MUL, { tag: 'BRECHA ×2,4', text: 'CAIU A LIVE!', say: M.pick(STUN_SAY), onEnd: erkStunEnd, sfx: 'mech_ok' });
    sfx('buffer');
    d.eng = 0; d.live.st = 'down'; d.armor = 1; d.armorTag = null;
    d.demo = false; d.flickT = 0.45; d.pose = 'hold'; d.poseT = 0;
    K.co(b, null, 2); d.viral = false; d.viralWarn = 0; // o VIRALIZOU que vinha cai junto com a live
  }
  function erkStunEnd(b) {
    const d = b.data;
    say(b, 'VOLTEI, GENTE!', 1.6);
    rigClear(b, true);
    // 1º mandato: a live demora STUN_GAP_L1 s para voltar (respiro; quem corta rápido não emenda um tonto no outro)
    if (!L2() && FI.STUN_GAP_L1 > 0) { d.live.st = null; d.rigT = FI.STUN_GAP_L1; } else rigStart(b);
  }
  // rig a cada quadro: posição, fio, estados, corte, volta do fio, armadura e engajamento
  function rigUpdate(b, dt, st) {
    const d = b.data, Lv = d.live;
    if (!Lv.st || !Lv.phones.length) { if (!st) { d.armor = 1; d.armorTag = null; } return; }
    Lv.t += dt;
    const hx = b.x, hy = b.y + (d.surf ? HUB_DY_P4 : HUB_DY);
    for (const ph of Lv.phones) {
      phoneMove(b, ph, dt, Lv);
      cableSample(ph, hx, hy);
      if (ph.cut) ph.cutT += dt;
      if (ph.plugT > 0) ph.plugT -= dt;
    }
    if (Lv.st === 'connecting') { if (Lv.t >= Lv.dur) { Lv.st = 'loading'; Lv.t = 0; } }
    else if (Lv.st === 'loading') { if (Lv.t >= loadT()) { Lv.st = 'on'; Lv.t = 0; rigOn(b); } }
    else if (Lv.st === 'on' && !st) {
      for (const ph of Lv.phones) {
        if (ph.cut) {
          if ((ph.regrowT -= dt) <= 0) {
            ph.cut = false; ph.plugT = FI.REPLUG; ph.cutT = 0; ph.n = (ph.n || 0) + 1; // fio novo (outro alvo)
            K.mechMiss(b); // o fio voltou antes de a live cair: corte desperdiçado
            G.text(ph.x, ph.y - 34, 'RECONECTOU!', { size: 10, color: PINK, life: 0.9, stroke: true });
            if (b.phase === 2) {
              ph.tape = true;
              const run = G.run || {};
              if (!run._erkLiminar) { run._erkLiminar = 1; G.text(G.W / 2, G.H * 0.5, 'LIMINAR DO STF!', { size: 14, color: '#ffd23f', stroke: true, life: 1.6 }); }
            }
          }
          continue;
        }
        if (ph.plugT > 0) continue;
        if (FI.HOP_T > 0 && !L2() && ph.mv !== 'live' && (ph.onT = (ph.onT || 0) + dt) >= FI.HOP_T + ph.i * 1.2 && !(ph.hopT > 0)) phoneHop(b, ph, Lv);
        let seg = K.carSwept(b, ph.pts, 11, FI.CUT_R, 3);
        if (seg < 0 && K.carNear(ph.x, ph.y, FI.PHONE_R)) seg = 10;
        if (seg >= 0) { cutPhone(b, ph, seg); if (Lv.st !== 'on') break; }
      }
    }
    if (st) return;
    const n = Lv.st === 'loading' || Lv.st === 'on' ? liveCount(Lv) : 0;
    if (n > 0) { d.armor = FI.ARMOR[Math.min(4, n)]; d.armorTag = ARMOR_TAG[Math.min(4, n)]; d.eng += dt * n; d.engTot += dt * n; }
    else { d.armor = 1; d.armorTag = null; }
  }
  // 2º turno: este ponto do fio está num dia de TRAMPO com a chuva de carteiras chegando (aviso ou carteira caindo acima)?
  function rained(b, x, y) {
    const wk = b.data.week;
    if (b.phase !== 1 || !wk.show || !G.game) return false;
    const lane = clamp(Math.floor(x / (G.W / 7)), 0, 6);
    if (wk.mode === 'warn' && wk.work[lane]) return true;
    for (const q of G.game.eb) if (!q.dead && q.style === 'erk_ctps' && !(q.delay > 0) && Math.abs(q.x - x) < 30 && q.y < y + 20 && q.y > y - 200) return true;
    return false;
  }
  // alvo do piloto automático / humanbot: o ponto do fio (t = 0,82) mais perto do carro; no tonto, embaixo dela.
  // 2º turno: fio com chuva chegando não é alvo (espera na FOLGA; corta entre as chuvas, como a Vó ensina)
  function erkGoal(b) {
    const d = b.data, Lv = d.live, p = pl();
    if (K.stunning(b)) { K.setGoal(b, clamp(b.x, 30, G.W - 30), G.H * 0.78, 'stun', 40, 'stun' + (b.mech ? b.mech.stuns : 0)); return; }
    if (Lv.st === 'connecting' || Lv.st === 'loading' || Lv.st === 'on') {
      // o fio mais perto; o escolhido fica até ser cortado (só troca se outro estiver bem mais perto: nada de vaivém)
      let best = null, bd = Infinity, cur = null, cd = Infinity, wet = false;
      for (const ph of Lv.phones) {
        if (ph.cut) continue;
        const q = cablePt(ph, 0.82);
        if (rained(b, q[0], q[1])) { wet = true; continue; }
        const dd = M.dist2(p.x, p.y, q[0], q[1]);
        if (dd < bd) { bd = dd; best = ph; }
        if (ph === d.goalPh) { cur = ph; cd = dd; }
      }
      if (cur && bd > cd * FI.GOAL_KEEP) best = cur;
      if (best) {
        d.goalPh = best;
        const q = cablePt(best, 0.82);
        K.setGoal(b, q[0], q[1], 'fio', 8, 'fio' + Lv.gen + '_' + best.i + (best.n ? '_' + best.n : ''));
        return;
      }
      // 2º turno: os fios que sobraram estão em dia de TRAMPO com chuva chegando: espera na FOLGA mais perto
      if (wet || (b.phase === 1 && rained(b, p.x, p.y + 60))) {
        const wk = d.week, lw = G.W / 7;
        let fx = -1, fd = Infinity;
        for (let i = 0; i < 7; i++) if (!wk.work[i]) { const x = (i + 0.5) * lw, dd = Math.abs(x - p.x); if (dd < fd) { fd = dd; fx = x; } }
        if (fx >= 0) { d.goalPh = null; K.setGoal(b, fx, G.H * 0.8, 'fio', 16, 'folga' + d.weekN); return; }
      }
    }
    d.goalPh = null;
    K.clearGoal(b);
  }

  // ---------- desenho da manha ----------
  // sub-curva [t0, t1] do fio como polilinha (para as metades cortadas)
  function subCable(c, ph, t0, t1) {
    const n = 6;
    for (let k = 0; k <= n; k++) { const q = cablePt(ph, t0 + ((t1 - t0) * k) / n); if (k) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }
  }
  function plugIcon(c, x, y, ang) {
    c.save(); c.translate(x, y); c.rotate(ang);
    K.rr(c, -3.2, -4, 6.4, 6.5, 1.2); K.inked(c, '#c9d3e6', 1.2);
    c.beginPath(); c.moveTo(-1.5, -4); c.lineTo(-1.5, -6.5); c.moveTo(1.5, -4); c.lineTo(1.5, -6.5); c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
    c.restore();
  }
  function drawRig(c, b, t) {
    const d = b.data, Lv = d.live;
    if (!Lv.phones.length) return;
    const ghost = Lv.st === 'connecting', loading = Lv.st === 'loading';
    // os celulares (aparelho + tripé/drone) e o halo verde-água dos cortáveis
    for (const ph of Lv.phones) {
      const live = Lv.st === 'on' && !ph.cut && ph.plugT <= 0;
      if (live) K.tealHalo(c, ph.x, ph.y - 2, 27, t + ph.i);
      c.save(); c.translate(ph.x, ph.y);
      if (ph.tilt) { const py = ph.mode === 'tripod' ? 16 : 0; c.translate(0, py); c.rotate(ph.tilt); c.translate(0, -py); }
      if (ghost) c.globalAlpha = 0.55 + 0.45 * ph.inT;
      blit(c, rigSpr(ph.mode, ph.cut), 0, 0);
      if (ph.mode === 'drone') {
        c.fillStyle = 'rgba(225,232,245,0.6)';
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) { c.beginPath(); K.E(c, sx * 17, sy * 15 - 2, 8, 1.8 + Math.abs(Math.sin(t * 38 + sx * 2 + sy)) * 1.1); c.fill(); }
      }
      if (loading) {
        K.rr(c, -8, 7, 16, 3.4, 1.5); c.fillStyle = '#3a3f4c'; c.fill();
        K.rr(c, -8, 7, 16 * Math.min(1, Lv.t / loadT()), 3.4, 1.5); c.fillStyle = MECH.TEAL_L; c.fill();
      }
      c.restore();
    }
    // fios
    for (const ph of Lv.phones) {
      if (ph.cut) {
        // as duas metades recuam com mola (0,4 s) e ficam penduradas
        const u = Math.min(1, ph.cutT / 0.4), r = 1 - 0.78 * M.easeOutBack(u);
        const ta = ph.cutK * r, tb = 1 - (1 - ph.cutK) * r;
        c.beginPath(); subCable(c, ph, 0, ta); subCable(c, ph, tb, 1); stroke2(c, 4.5, MECH.TEAL, 2.6);
        if (u < 1) { const q = cablePt(ph, ta); c.beginPath(); K.O(c, q[0], q[1], 2.4 * (1 - u)); const q2 = cablePt(ph, tb); K.O(c, q2[0], q2[1], 2.4 * (1 - u)); c.fillStyle = '#ffffff'; c.fill(); }
        continue;
      }
      const dashed = ghost || loading || ph.plugT > 0;
      c.save();
      if (dashed) { c.globalAlpha = ghost ? 0.4 + 0.3 * ph.inT : 0.85; c.setLineDash([7, 5]); c.lineDashOffset = -t * 30; }
      c.beginPath(); c.moveTo(ph.hx, ph.hy); c.quadraticCurveTo(ph.cx, ph.cy, ph.px, ph.py);
      stroke2(c, 4.5, MECH.TEAL, 2.6);
      c.restore();
      // fita amarela e preta da LIMINAR (3º turno, fio que voltou)
      if (ph.tape) {
        c.save();
        c.beginPath(); subCable(c, ph, 0.42, 0.68); c.lineWidth = 7.5; c.strokeStyle = INK; c.stroke();
        c.lineWidth = 5.5; c.strokeStyle = TAPE; c.stroke();
        c.setLineDash([3.5, 3.5]); c.strokeStyle = '#14121a'; c.stroke();
        c.restore();
      }
      plugIcon(c, ph.px, ph.py + 1, Math.atan2(ph.py - ph.cy, ph.px - ph.cx) - PI / 2);
    }
    // "+1" correndo do celular para o hub (engajamento), a cada 22 px a 60 px/s
    const dk = decoK();
    if (dk > 0 && (Lv.st === 'on' || loading)) {
      const spr = plusSpr(), off = (t * 60) % 22, step = dk >= 1 ? 22 : 44;
      for (const ph of Lv.phones) {
        if (ph.cut || ph.plugT > 0) continue;
        const C = ph.cum, P = ph.pts, tot = C[10];
        for (let s = off + 12; s < tot - 16; s += step) {
          const at = tot - s; // distância a partir do hub
          let i = 0; while (i < 9 && C[i + 1] < at) i++;
          const k = (at - C[i]) / Math.max(0.01, C[i + 1] - C[i]);
          blit(c, spr, P[2 * i] + (P[2 * i + 2] - P[2 * i]) * k, P[2 * i + 1] + (P[2 * i + 3] - P[2 * i + 1]) * k - 6);
        }
      }
    }
  }
  // por cima dos tiros: anel verde-água dos celulares cortáveis, rótulo CORTE!, contagem da volta e LIMINAR!
  function drawRigOver(c, b, t) {
    const d = b.data, Lv = d.live;
    if (!Lv.phones.length) return;
    for (const ph of Lv.phones) {
      const live = Lv.st === 'on' && !ph.cut && ph.plugT <= 0;
      if (live) K.mechRing(c, ph.x, ph.y, 22, t + ph.i * 0.3, { fill: false, alpha: 0.8 });
      // rótulo 'CORTE!' (regra do verde-água: todo tocável tem rótulo branco) em todo celular cortável;
      // na 1ª live da partida ele já aparece no carregando
      if (!ph.cut && (live || (d.firstRig && Lv.st === 'loading'))) {
        const sx = ph.x < G.W / 2 ? 1 : -1;
        blit(c, corteSpr(), ph.x + sx * 44, ph.y - 2 + Math.sin(t * 5 + ph.i) * 1.5);
      }
      if (ph.cut && Lv.st === 'on') {
        const k = clamp(ph.regrowT / ph.regrow0, 0, 1);
        c.beginPath(); c.arc(ph.x, ph.y, 20, -PI / 2, -PI / 2 + TAU * k); c.lineCap = 'round';
        stroke2(c, 5, MECH.TEAL, 2.8);
      }
      if (ph.tape && !ph.cut) { const q = cablePt(ph, 0.55); K.txt(c, 'LIMINAR!', q[0], q[1] - 11, 8, TAPE, { stroke: 3 }); }
    }
  }
  // bolha de corações da armadura EM ALTA
  function drawBubble(c, b, t) {
    const x = b.x, y = b.y - 8;
    c.save();
    c.beginPath(); c.arc(x, y, 62, 0, TAU);
    c.fillStyle = 'rgba(255,111,174,0.15)'; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.stroke();
    if (decoK() > 0) {
      // corações de enfeite só com contorno branco: coração rosa cheio é sempre tiro (erk_like)
      c.globalAlpha = 0.7; c.lineWidth = 1.5; c.strokeStyle = '#ffffff';
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = t * 0.9 + (i * TAU) / 6;
        K.heartPath(c, x + Math.cos(a) * 62, y + Math.sin(a) * 62, 9);
      }
      c.stroke();
    }
    c.restore();
  }

  // ======================================================================
  // Padrões (SPEC §5.4). Velocidades antes do spdK; todo tiro passa por K.shoot.
  // ======================================================================
  function* erkLikes(b, n0) {
    const d = b.data;
    say(b, 'DÁ LIKE AÍ!', 1.2);
    d.pose = 'point';
    const n = n0 || (L2() ? PAT.LIKE_N_L2 : PAT.LIKE_N), cols = [LIKE, LIKE_H, LIKE_R];
    for (let k = 0; k < 3; k++) {
      const q = phoneXY(b);
      fan(q[0], q[1], aimFrom(q[0], q[1]), n, PAT.LIKE_SPREAD, PAT.LIKE_SPD, cols[k]);
      sfx('enemy_shot');
      yield 0.35;
    }
    d.pose = 'hold';
  }
  // SEGUE O FIO: fileiras de textão com uma fresta de 56 px que anda ±40 px por fileira
  function* erkThread(b, rows, talk) {
    const d = b.data, W = G.W, spd = L2() ? PAT.THREAD_SPD_L2 : PAT.THREAD_SPD, half = PAT.THREAD_GAP / 2;
    if (talk !== false) { say(b, 'SEGUE O FIO!', 1.4); d.pose = 'up'; }
    let gx = clamp(pl().x + M.rand(-50, 50), 50, W - 50);
    d.threadOn = true;
    for (let r = 0; r < rows; r++) {
      const y = b.y + 50;
      G.text(30, y, 'FIO ' + (r + 1) + '/' + rows, { size: 8, color: '#ffffff', life: 0.8, vy: 24 });
      for (let x = 10; x <= W - 10; x += PAT.THREAD_DX) if (Math.abs(x - gx) > half) shoot(x, y, DOWN, spd, TEXTAO);
      sfx('enemy_shot');
      gx = clamp(gx + M.rand(-PAT.THREAD_WALK, PAT.THREAD_WALK), 50, W - 50);
      if (r < rows - 1) yield PAT.THREAD_EVERY;
    }
    d.threadOn = false;
    if (talk !== false) d.pose = 'hold';
  }
  // COMPARTILHA: anel de corações que freia, segura e depois mira no Zé, um por um
  function shareAim(q) {
    const D = q.data;
    if (q.t < D.go) return;
    const a = aimFrom(q.x, q.y);
    q.accel = 0; q.ang = a; q.spd = D.v; q.vx = Math.cos(a) * D.v; q.vy = Math.sin(a) * D.v;
    q.update = null;
  }
  function* erkShare(b) {
    const d = b.data;
    say(b, 'COMPARTILHA!', 1.4); d.pose = 'hold'; d.postT = 1.6;
    const n = L2() ? 20 : 16, kk = spdK(b), v0 = 90, a0 = Math.random() * TAU, x = b.x, y = b.y;
    for (let i = 0; i < n; i++) {
      shoot(x, y, a0 + (i * TAU) / n, v0, { style: 'erk_like', color: i % 2 ? COL.hot : COL.pink, accel: (-v0 * kk) / 0.7, minSpd: 0,
        data: { go: 1.1 + i * 0.06, v: 125 * kk }, update: shareAim });
    }
    sfx('enemy_shot2');
    yield 1.2;
  }
  // fundo: notificações miradas
  function* erkNotif(b, every) {
    const d = b.data;
    for (;;) {
      yield every * M.rand(0.9, 1.1);
      if (d.demo || d.threadOn) { yield () => !d.demo && !d.threadOn; continue; } // nada de notificação mirada no meio do fio
      const q = phoneXY(b);
      fan(q[0], q[1], aimFrom(q[0], q[1]), 2, 0.12, PAT.NOTIF_SPD, NOTIF);
      sfx('enemy_shot');
    }
  }
  function* erkP1(b) {
    const d = b.data;
    d.mv = (bb, dd) => { const t = K.clk(bb); dd.tx = bb.homeX + PAT.SWAY[0] * Math.sin(0.5 * t); dd.ty = bb.homeY + 8 * Math.sin(0.9 * t); };
    yield 0.5;
    if (d.demo) yield () => !d.demo;
    for (let loop = 0; ; loop++) {
      yield* erkLikes(b);
      yield 0.8;
      yield* erkThread(b, PAT.THREAD_ROWS);
      yield 1.0;
      if (loop % 2 === 1) { yield* erkShare(b); yield 1.2; }
    }
  }
  // ---------- 2º turno: FIM DA ESCALA 6x1 (a semana do calendário) ----------
  const P2_DY = 28; // ela desce um pouco: a faixa da semana fica livre lá em cima
  const SAY_RAIN = PAT.SAY_PRE + PAT.RAIN_WARN - 0.05; // fala da semana: some logo antes da 1ª carteira cair
  function lanesFolga(list) { const w = [1, 1, 1, 1, 1, 1, 1]; for (const i of list) w[i] = 0; return w; }
  function folga3() {
    // 3 folgas, pelo menos duas lado a lado
    const a = M.randi(0, 5), s = [a, a + 1];
    let c = M.randi(0, 6), g = 0;
    while ((s.indexOf(c) >= 0) && g++ < 20) c = M.randi(0, 6);
    s.push(c);
    return s;
  }
  function* erkWeek(b, folga, dbl) {
    const d = b.data, wk = d.week, W = G.W, lw = W / 7;
    wk.work = lanesFolga(folga); wk.mode = 'warn'; wk.warnT = PAT.RAIN_WARN; d.weekN = (d.weekN || 0) + 1;
    d.rainOn = true; sfx('charge');
    const l2 = L2(), spd = PAT.RAIN_SPD * (dbl ? (l2 ? PAT.RAIN_DBL_L2 : PAT.RAIN_DBL) : 1), every = l2 ? PAT.RAIN_EVERY_L2 : PAT.RAIN_EVERY;
    const row = (delay) => {
      const o = delay ? { style: CTPS.style, color: CTPS.color, delay } : CTPS;
      for (let i = 0; i < 7; i++) {
        if (!wk.work[i]) continue;
        const cx = (i + 0.5) * lw + M.rand(-PAT.RAIN_JIT, PAT.RAIN_JIT);
        if (dbl) { shoot(cx - PAT.RAIN_DBL_DX, RAIN_Y, DOWN, spd, o); shoot(cx + PAT.RAIN_DBL_DX, RAIN_Y, DOWN, spd, o); }
        else shoot(cx, RAIN_Y, DOWN, spd, o);
      }
    };
    // aviso: a 1ª carteira de cada dia de trampo já aparece (fantasma, sem colisão) embaixo do TRAMPO
    row(PAT.RAIN_WARN);
    yield PAT.RAIN_WARN;
    wk.mode = 'rain';
    const t0 = K.clk(b);
    let k = 0;
    yield every;
    while (K.clk(b) - t0 < PAT.RAIN_DUR) {
      row(0);
      if (k++ % 3 === 0) sfx('enemy_shot');
      yield every;
    }
    wk.mode = 'gap';
    yield PAT.RAIN_GAP;
    d.rainOn = false; wk.mode = 'idle';
  }
  // fala da semana: sai PAT.SAY_PRE s antes do aviso e some antes da 1ª carteira de verdade (a chuva não cobre o
  // balão); a semana já conta como chuva (nada de VIRALIZOU começando na fresta)
  function* weekSay(b, line) {
    b.data.rainOn = true;
    say(b, line, SAY_RAIN);
    yield PAT.SAY_PRE;
  }
  function* erkP2(b) {
    const d = b.data, W = G.W, H = G.H, wk = d.week;
    d.mv = (bb, dd) => { dd.tx = bb.homeX + PAT.SWAY[1] * Math.sin(0.4 * K.clk(bb)); dd.ty = bb.homeY + P2_DY; };
    d.prop = 'cal'; d.cal = '6x1'; d.cal2 = '6x1'; d.flip = 0;
    wk.show = true; wk.mode = 'idle';
    yield 1.0;
    for (;;) {
      // a) a escala 6x1 (folga no domingo; no 2º mandato a folga já muda)
      yield* weekSay(b, 'ESCALA 6x1? ABSURDO!');
      yield* erkWeek(b, [L2() ? M.randi(0, 6) : 6], false);
      // b) a folga muda de lugar
      yield* weekSay(b, 'FOLGA AGORA É POR DECRETO!');
      yield* erkWeek(b, [M.randi(0, 6)], false);
      // c) FIM DA 6x1 → 4x3: o mesmo trampo em 4 dias (chuva dupla, 1,25× mais rápida)
      yield* weekSay(b, 'FIM DA 6x1!');
      d.cal2 = '4x3'; d.flipTo = 1;
      G.text(W / 2, H * 0.46, 'MESMO TRAMPO EM 4 DIAS!', { size: 13, color: '#ffd23f', stroke: true, life: 1.8 });
      const run = G.run || {};
      if (!run._erk7x0) { run._erk7x0 = 1; const p = pl(); G.text(p.x, p.y - 40, 'E O ZÉ? 7x0.', { size: 12, color: '#ffffff', life: 1.8 }); }
      yield* erkWeek(b, folga3(), true);
      d.cal = '4x3'; d.cal2 = '6x1'; d.flip = 0; d.flipTo = 1;
      // d) SEXTOU TODO DIA: semana toda verde, respiro (ela bate palma)
      say(b, 'SEXTOU TODO DIA!', 1.6);
      wk.work = lanesFolga([0, 1, 2, 3, 4, 5, 6]); wk.mode = 'sextou'; d.pose = 'up';
      yield 1.2;
      wk.mode = 'idle'; d.pose = 'hold';
      d.cal = '6x1'; d.cal2 = '6x1'; d.flip = 0; d.flipTo = 0;
      // e) E A CONTA? → MANDA PRO ZÉ!
      say(b, 'E A CONTA?', 1.0);
      yield 0.5;
      say(b, 'MANDA PRO ZÉ!', 1.4); d.pose = 'point';
      for (let k = 0; k < 3; k++) {
        const q = phoneXY(b);
        fan(q[0], q[1], aimFrom(q[0], q[1]), 7, 0.9, 135, CEDULA);
        sfx('enemy_shot2');
        yield 0.4;
      }
      d.pose = 'hold';
      yield 0.5;
      // f) curtidas e repete
      yield* erkLikes(b);
      yield 0.8;
    }
  }
  // ---------- 3º turno: O PSOL VAI AO STF ----------
  function* erkCerco(b) {
    const d = b.data, H = G.H, W = G.W, p = pl(), cx = p.x, cy = p.y, R = 120;
    say(b, 'O PSOL VAI AO STF!', 1.6); d.pose = 'fist';
    const slots = [];
    for (let i = 0; i < 11; i++) {
      const a = ((-170 + i * 16) * PI) / 180, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      if (y > H * 0.78 || y < 70 || x < -10 || x > W + 10) continue;
      slots.push([x, y]);
    }
    if (slots.length >= 4) {
      // a brecha: duas vagas vizinhas (de preferência dentro da tela)
      let g = M.randi(1, slots.length - 3);
      for (let k = 0; k < 6 && (slots[g][0] < 24 || slots[g + 1][0] > W - 24 || slots[g][0] > W - 24 || slots[g + 1][0] < 24); k++) g = M.randi(0, slots.length - 2);
      const gx = (slots[g][0] + slots[g + 1][0]) / 2, gy = (slots[g][1] + slots[g + 1][1]) / 2;
      for (let i = 0; i < slots.length; i++) {
        if (i === g || i === g + 1) continue;
        const s = slots[i];
        shoot(s[0], s[1], Math.atan2(cy - s[1], cx - s[0]), 70, { style: 'erk_adi', color: COL.red, delay: 0.9 });
      }
      G.text(gx, gy, 'BRECHA NA LEI!', { size: 10, color: '#ffd23f', life: 1.4, vy: -6, stroke: true });
      sfx('charge');
    }
    yield 0.5;
    d.pose = 'hold';
  }
  function* erkADIfan(b) {
    const d = b.data;
    say(b, 'ADI NELES!', 1.2); d.pose = 'point';
    for (let k = 0; k < 3; k++) {
      const q = phoneXY(b);
      fan(q[0], q[1], aimFrom(q[0], q[1]), 3, 0.35, PAT.ADI_SPD, { style: 'erk_adi', color: COL.red });
      sfx('enemy_shot');
      yield 0.45;
    }
    d.pose = 'hold';
  }
  function arquiva(q) {
    if (q.t < q.data.split || q.dead) return;
    q.dead = true;
    G.text(q.x, q.y - 10, 'ARQUIVADO!', { size: 8, color: '#ffffff', life: 0.7, vy: -20 });
    ring(q.x, q.y, 8, 90, NOTIF, Math.random() * TAU);
    sfx('split');
  }
  function* erkArquivado(b) {
    const d = b.data, kk = spdK(b);
    say(b, 'PROTOCOLEI!', 1.3); d.pose = 'up';
    for (let k = 0; k < 3; k++) {
      shoot(b.x, b.y + 30, DOWN + (k - 1) * 0.3, 100, { style: 'erk_adi', color: COL.red, accel: -50 * kk, minSpd: 60 * kk, data: { split: 1.2 }, update: arquiva });
    }
    sfx('whoosh');
    yield 0.5;
    d.pose = 'hold';
  }
  function* erkP3(b) {
    const d = b.data;
    d.mv = (bb, dd) => { const t = K.clk(bb); dd.tx = bb.homeX + PAT.SWAY[2] * Math.sin(0.55 * t); dd.ty = bb.homeY + 6 * Math.sin(1.2 * t); };
    d.prop = 'stf';
    yield 1.0;
    for (;;) {
      yield* erkCerco(b); yield 1.2;
      yield* erkADIfan(b); yield 0.9;
      yield* erkArquivado(b); yield 1.4;
    }
  }
  // ---------- 4º turno: TRENDING TOPIC (no celular-prancha) ----------
  function* erkP4(b) {
    const d = b.data;
    say(b, 'TÁ NOS TRENDING!', 1.8);
    d.mv = (bb, dd) => { const t = K.clk(bb); dd.tx = bb.homeX + PAT.SWAY[3] * Math.sin(0.45 * t); dd.ty = bb.homeY + 4 + 6 * Math.sin(1.1 * t); };
    yield 0.9;
    const arms = L2() ? 5 : 4;
    let dir = 1, a = Math.random() * TAU;
    for (;;) {
      const t0 = K.clk(b);
      let k = 0;
      while (K.clk(b) - t0 < 4) {
        for (let i = 0; i < arms; i++) shoot(b.x, b.y + 4, a + (i * TAU) / arms, PAT.SPIRAL_SPD, k % 2 ? HASH_M : HASH_O);
        if (k % 4 === 0) sfx('enemy_shot');
        a += dir * PAT.SPIRAL_W * PAT.SPIRAL_STEP; k++;
        yield PAT.SPIRAL_STEP;
      }
      // vira o sentido: 0,6 s de aviso (a espiral para, o ring light pisca)
      d.ringFlashT = 0.6; sfx('charge');
      yield 0.6;
      dir = -dir;
    }
  }
  function* erkP4Hearts(b) {
    for (;;) {
      yield PAT.P4_HEARTS;
      const q = phoneXY(b);
      fan(q[0], q[1], aimFrom(q[0], q[1]), 5, 0.5, PAT.P4_HEART_SPD, LIKE_H);
      sfx('enemy_shot');
    }
  }
  function* erkP4Threads(b) { for (;;) { yield PAT.P4_THREAD_EVERY; yield* erkThread(b, PAT.P4_THREAD_ROWS, false); } }
  // ---------- VIRALIZOU (a pressão dos fios no ar) ----------
  function* erkViral(b) {
    const d = b.data;
    d.viralWarn = FI.VIRAL_WARN; sfx('charge'); say(b, 'VIRALIZOU!', 1.4); d.postT = 2.2;
    yield FI.VIRAL_WARN;
    d.viralWarn = 0;
    const x = b.x, y = b.y + 4, n = FI.VIRAL_N, cols = [LIKE, LIKE_H, LIKE_R];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU, s = Math.sin(t);
      const hx = 16 * s * s * s, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      const m = Math.hypot(hx, hy);
      if (m < 0.01) continue;
      shoot(x, y, Math.atan2(hy, hx), (100 * m) / 17, cols[i % 3]);
    }
    sfx('enemy_shot2');
    G.text(b.x, b.y + 70, '+20 MIL SEGUIDORES', { size: 12, color: PINK, life: 1.4, stroke: true });
    d.eng = 0; d.viral = false;
  }

  // ======================================================================
  // Desenhos de faixa: a semana do calendário (2º turno), o "AO VIVO" da entrada, corações do VIRALIZOU
  // ======================================================================
  const WK_Y = 74, WK_H = 12;
  const RAIN_Y = WK_Y + 2 * WK_H + 8; // as carteiras saem logo abaixo da faixa da semana (a SPEC diz y 96; a faixa vai até 98)
  const dayStrip = () => sprite('days|' + G.W + '|' + fontKey(), [0, WK_Y, G.W, WK_H], (c) => {
    const lw = G.W / 7;
    c.fillStyle = 'rgba(16,20,34,0.88)'; c.fillRect(0, WK_Y, G.W, WK_H);
    for (let i = 0; i < 7; i++) {
      if (i) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(i * lw - 0.5, WK_Y + 2, 1, WK_H - 4); }
      K.txt(c, DAYS[i], (i + 0.5) * lw, WK_Y + WK_H / 2 + 0.5, 8, i === 6 ? '#ffd23f' : '#ffffff', { maxW: lw - 6 });
    }
  });
  const statCell = (work) => sprite('cell' + (work ? 'W' : 'F') + '|' + G.W + '|' + fontKey(), [0, 0, G.W / 7, WK_H], (c) => {
    const lw = G.W / 7;
    c.fillStyle = work ? '#e63946' : '#2fbf6f'; c.fillRect(0.5, 0, lw - 1, WK_H);
    K.txt(c, work ? 'TRAMPO' : 'FOLGA', lw / 2, WK_H / 2 + 0.5, 7, '#ffffff', { maxW: lw - 5 });
  });
  function drawWeekOver(c, b, t) {
    const wk = b.data.week;
    blit(c, dayStrip(), 0, 0);
    const lw = G.W / 7, on = wk.mode !== 'idle';
    for (let i = 0; i < 7; i++) {
      if (!on) { c.fillStyle = 'rgba(16,20,34,0.7)'; c.fillRect(i * lw + 0.5, WK_Y + WK_H, lw - 1, WK_H); continue; }
      const work = !!wk.work[i];
      c.globalAlpha = wk.mode === 'warn' && work ? 0.55 + 0.45 * Math.abs(Math.sin(t * 12)) : 1;
      blit(c, statCell(work), i * lw, WK_Y + WK_H);
      c.globalAlpha = 1;
    }
  }
  function drawWeekTint(c, b, t) {
    const wk = b.data.week;
    if (wk.mode === 'idle') return;
    const lw = G.W / 7, y0 = WK_Y + 2 * WK_H, pulse = wk.mode === 'warn' ? 0.6 + 0.4 * Math.abs(Math.sin(t * 12)) : 1;
    for (let i = 0; i < 7; i++) {
      c.fillStyle = wk.work[i] ? 'rgba(230,57,70,' + (0.1 * pulse).toFixed(3) + ')' : 'rgba(61,220,132,0.12)';
      c.fillRect(i * lw, y0, lw, G.H - y0);
    }
  }
  const lowerThird = () => sprite('lower|' + G.W + '|' + fontKey(), [0, -12, G.W, 24], (c) => {
    const W = G.W;
    K.rr(c, 10, -10, W - 20, 20, 4); c.fillStyle = 'rgba(16,20,34,0.55)'; c.fill();
    K.rr(c, 12, -9, 66, 18, 3); K.inked(c, '#e63946', 1.6);
    c.beginPath(); K.O(c, 23, 0, 3.4); c.fillStyle = '#ffffff'; c.fill();
    K.txt(c, 'AO VIVO', 49, 0.5, 9, '#ffffff', { maxW: 46 });
    K.rr(c, 80, -9, W - 92, 18, 3); K.inked(c, '#ffd23f', 1.6);
    c.font = '10px ' + G.FONT_DISPLAY;
    const nw = Math.min(118, c.measureText('ERIKA VIRALTON').width);
    K.txt(c, 'ERIKA VIRALTON', 86, 0.5, 10, INK, { align: 'left', maxW: 118 });
    K.txt(c, '— Deputada do Engajamento', 92 + nw, 0.8, 9, '#3a2a0a', { align: 'left', font: G.FONT_BODY, weight: 700, maxW: W - 104 - nw - 6 });
  });
  function drawLowerThird(c, b, t) {
    const u = b.state === 'enter' ? M.easeOutCubic(clamp(b.t / 0.45, 0, 1)) : 1;
    // tela baixa (360x640): sobe a faixa para o PULAR do diálogo não cobrir o fim dela
    const ly = G.H < 700 ? G.H * 0.52 : G.H * 0.62;
    c.save(); c.globalAlpha = u; c.translate((1 - u) * -G.W * 0.6, 0);
    blit(c, lowerThird(), 0, ly);
    // o ponto do AO VIVO pisca
    if (((t * 2) | 0) % 2) { c.beginPath(); K.O(c, 23, ly, 3.4); c.fillStyle = '#ff9aa2'; c.fill(); }
    c.restore();
  }
  function drawViralWarn(c, b, t) {
    const k = 1 + 0.3 * Math.abs(Math.sin(t * 14)), H = G.H;
    c.save(); c.globalAlpha = 0.85; c.lineWidth = 1.6; c.strokeStyle = '#ffffff'; c.fillStyle = PINK;
    for (const y of [0.3, 0.5, 0.7]) for (const x of [14, G.W - 14]) { c.beginPath(); K.heartPath(c, x, H * y, 16 * k); c.fill(); c.stroke(); }
    c.restore();
  }

  // ======================================================================
  // A chefona
  // ======================================================================
  G.Bosses.define('erika', {
    name: 'ERIKA VIRALTON', title: 'A Deputada do Engajamento', fem: true, hp: HP, r: 40, homeY: 168, spdK: 1.15, fatStart: 90,
    score: 220000, pix: 180, music: 'boss', defeatText: 'CANCELADA!',
    phases: [
      { at: 1, name: 'Segue o Fio' },
      { at: 0.74, name: 'Fim da Escala 6x1' },
      { at: 0.48, name: 'O PSOL Vai ao STF' },
      { at: 0.22, name: 'Trending Topic' },
    ],
    init(b) {
      const d = b.data;
      d.fx = []; d.clk = 0; d.stunT = 0; d.mechCd = 0;
      d.pose = 'hold'; d.poseT = 0; d.postT = 0; d.mouth = 0; d.tx = b.homeX; d.ty = b.homeY; d.mv = null;
      d.live = { gen: 0, st: null, t: 0, dur: FI.CONNECT, phones: [] };
      d.rigT = 0; d.goalPh = null; d.firstRig = false; d.eng = 0; d.engTot = 0; d.viral = false; d.viralWarn = 0;
      d.armor = 1; d.armorTag = null; d.demo = false; d.demoOn = false; d.demoT = 0;
      d.week = { show: false, mode: 'idle', work: [1, 1, 1, 1, 1, 1, 0], warnT: 0 }; d.rainOn = false;
      d.prop = null; d.cal = '6x1'; d.cal2 = '6x1'; d.flip = 0; d.flipTo = 0; d.surf = false;
      d.chatT = M.rand(7, 10); d.cutSayT = 0; d.flopT = 0; d.flickT = 0; d.ringFlashT = 0; d.leaveSaid = false; d.lv = null;
      d.S = { look: [0, 0] }; d.warmI = 0;
      K.mechInit(b, 'fio');
      if (L2() && HP_L2 !== HP) b.hp = b.maxHp = b.maxHp * (HP_L2 / HP);
      b.hitboxes = HB_A;
      K.warmPeople(b, 'p1', K.poses(ERIKA, ERK_SIZE, ['idle', 'hold', 'point', 'up', 'shrug', 'wave']).concat(K.poses(ERIKA, ERK_SIZE, ['fist'])));
      K.warmShots(b, ERK_SHOTS);
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
      // 1ª live da partida (1º mandato): demonstração (ela segura o tiro 2,5 s quando os fios ligam)
      d.demo = !L2() && !run._erkSeen;
      run._erkSeen = 1;
      rigStart(b);
      K.co(b, erkP1(b)); K.co(b, erkNotif(b, PAT.NOTIF_P1), 1);
      say(b, 'OI, GENTE! TÔ AO VIVO!', 1.8);
    },
    update(b, dt, g) {
      const d = b.data;
      K.updFx(b, dt);
      // tonto = pausa: sem corrotina, relógio, movimento, conversa nem rig novo (os celulares continuam)
      const st = K.stunUpdate(b, dt);
      if (!st) {
        d.clk += dt;
        if (d.mechCd > 0) d.mechCd -= dt;
        if (d.demo && d.demoT > 0 && (d.demoT -= dt) <= 0) d.demo = false;
        K.runCo(b, dt);
        if (d.mv) { d.mv(b, d, dt); K.glide(b, dt, 2.4); }
        if ((d.chatT -= dt) <= 0) { if (!(b.sayT > 0)) say(b, M.pick(CHAT), 1.6); d.chatT = M.rand(7, 10); }
        if (d.rigT > 0 && (d.rigT -= dt) <= 0) rigStart(b);
        if (d.poseT > 0 && (d.poseT -= dt) <= 0) d.pose = 'hold';
      }
      rigUpdate(b, dt, K.stunning(b));
      // VIRALIZOU: muito engajamento com os fios no ar (fora da chuva da 6x1, do tonto e da demonstração)
      if (!K.stunning(b) && !d.viral && !d.rainOn && !d.demo && d.eng >= FI.ENG_MAX) { d.viral = true; K.co(b, erkViral(b), 2); }
      K.fatigue(b, 'VOU FAZER DETOX DIGITAL...');
      if (d.cutSayT > 0) d.cutSayT -= dt;
      // 'FLOPOU!' em 0,40H, mas sempre abaixo do '0 CURTIDAS' do tonto (tela baixa: 360x640) e subindo devagar
      if (d.flopT > 0 && (d.flopT -= dt) <= 0) G.text(G.W / 2, Math.max(G.H * 0.4, b.y + STUN_PILL_DY + 34), 'FLOPOU!', { size: 20, color: PINK, stroke: true, life: 1.4, vy: -12 });
      if (d.flickT > 0) d.flickT -= dt;
      if (d.ringFlashT > 0) d.ringFlashT -= dt;
      if (d.postT > 0) d.postT -= dt;
      if (d.viralWarn > 0) d.viralWarn -= dt;
      d.flip = M.approach(d.flip, d.flipTo, dt * 4);
      d.mouth = M.approach(d.mouth, b.sayT > 0 ? 0.5 + 0.4 * Math.sin(b.ft * 16) : 0, dt * 4);
      b.hitboxes = d.surf ? HB_B : HB_A;
      if (b.hp / b.maxHp < 0.25 && Math.random() < dt * 4 * decoK()) G.part({ x: b.x + M.rand(-24, 24), y: b.y + 60, vx: M.rand(-10, 10), vy: -30, type: 'smoke', size: 4, life: 0.7, color: 'rgba(80,80,90,0.4)', drag: 0.95 });
      erkGoal(b);
      K.trackCar(b);
    },
    onPhase(b, idx) {
      const d = b.data;
      d.pose = 'hold'; d.poseT = 0; d.postT = 0;
      if (idx === 1) K.warmPeople(b, 'p2', K.poses(ERIKA_SWEAT, ERK_SIZE, ['hold', 'point', 'shrug']));
      if (idx === 2) K.warmPeople(b, 'p3', K.poses(ERIKA_SWEAT, ERK_SIZE, ['fist', 'up', 'wave']));
      // a manha: os celulares somem numa fumacinha; um rig novo do turno entra 1 s depois (ou no fim do tonto)
      rigClear(b, true);
      if (K.stunning(b)) { d.stunT = Math.min(d.stunT, 2.0); d.live.st = 'down'; }
      else { d.live.st = null; d.rigT = FI.RIG_GAP; d.armor = 1; d.armorTag = null; }
      K.co(b, null, 2); d.viral = false; d.viralWarn = 0; d.threadOn = false;
      d.week.show = false; d.week.mode = 'idle'; d.rainOn = false; d.demo = false;
      d.prop = null; d.flip = 0; d.flipTo = 0; d.cal = '6x1'; d.cal2 = '6x1';
      if (idx === 1) { K.co(b, erkP2(b)); K.co(b, null, 1); }
      else if (idx === 2) { K.co(b, erkP3(b)); K.co(b, erkNotif(b, PAT.NOTIF_P3), 1); }
      else if (idx === 3) {
        // a tribuna fica para trás: ela sobe num celular gigante
        d.surf = true;
        G.burst(b.x, b.y + TRY + 20, 14, { colors: ['#8b5a2b', '#ffd23f', '#ffffff'], speed: 200, life: 0.6 });
        sfx('whoosh');
        K.co(b, erkP4(b)); K.co(b, erkP4Hearts(b), 1); K.co(b, erkP4Threads(b), 3);
      }
    },
    onDeath(b) {
      const d = b.data;
      K.stopCo(b); d.fx.length = 0;
      rigClear(b, true); d.live.st = null; d.rigT = 0; d.goalPh = null; d.flopT = 0;
      d.stunT = 0; d.stunOnEnd = null; d.viral = false; d.viralWarn = 0; d.demo = false;
      d.week.show = false; d.week.mode = 'idle'; d.rainOn = false; d.armor = 1; d.armorTag = null;
      K.clearGoal(b); b.hudTag = null;
      say(b, 'ATAQUE À DEMOCRACIA!', 2.2);
      if (b.x < 40 || b.x > G.W - 40) b.x = clamp(b.x, 60, G.W - 60);
    },
    draw(ctx, b, g) {
      const d = b.data, t = b.t, fight = b.state === 'fight', st = fight && K.stunning(b);
      const dying = b.state === 'dying', leaving = b.state === 'leaving', hpF = b.hp / b.maxHp;
      K.bubbleAt(b, 66);
      if (fight && d.week.show && !st) drawWeekTint(ctx, b, t);
      if (fight) drawRig(ctx, b, t);
      K.drawFx(ctx, b, 'under');
      const S = d.S;
      S.t = t; S.fl = G.isFlash(b); S.vec = false;
      S.spec = hpF < 0.6 || dying || leaving ? ERIKA_SWEAT : ERIKA;
      S.mood = dying ? 'hurt' : leaving ? 'laugh' : st ? 'shock' : d.postT > 0 ? 'laugh' : b.phase === 2 && fight ? 'angry' : d.fat > 0 ? 'tired' : 'smug';
      S.mouth = b.state === 'talk' ? 0.3 + 0.3 * Math.sin(t * 10) : d.mouth;
      S.pose = dying || st ? 'shrug' : leaving ? 'wave' : b.state === 'fight' ? d.pose : 'hold';
      const lk = K.lookAt(b.x, b.y + PY); S.look[0] = lk[0]; S.look[1] = lk[1];
      S.stun = st;
      // ring light: aceso ao vivo; pisca ao cair e fica escuro no tonto (e na queda)
      S.lit = !(dying || st) || (st && d.flickT > 0 && ((t * 14) | 0) % 2 === 0);
      S.glowA = d.ringFlashT > 0 ? 0.75 + 0.25 * Math.abs(Math.sin(t * 22)) : 0.62;
      S.phone = st || dying ? 'static' : 'live';
      S.surf = d.surf; S.vehicle = !leaving; S.counter = !dying;
      S.likes = st ? '0 CURTIDAS' : (Math.round((12.4 + 0.1 * d.engTot) * 10) / 10).toFixed(1).replace('.', ',') + ' MIL';
      S.prop = d.prop; S.cal = d.cal; S.cal2 = d.cal2; S.flip = d.flip;
      S.tilt = d.surf && fight && !st ? 0.07 * Math.cos(0.45 * K.clk(b)) : 0;
      // no tonto o balão de fala ocupa o alto da cabeça: o '0 CURTIDAS' desce para baixo da tribuna (fica à vista)
      S.pillY = st ? b.y + STUN_PILL_DY : Math.max(76, b.y + HY - RING_R - 10);
      let x = b.x, y = b.y;
      if (st) x += Math.sin(t * 15) * 1.6;
      if (leaving) {
        // a tribuna cai e os drones da live levam a deputada embora (ainda filmando e acenando)
        if (!d.lv) d.lv = { x: b.x, y: b.y };
        if (!d.leaveSaid && t > 1.2) { d.leaveSaid = true; say(b, 'VOU POSTAR QUE GANHEI!', 2); }
        const ft = t, fy = d.lv.y + 0.5 * 700 * ft * ft;
        if (fy < G.H + 80) {
          ctx.save(); ctx.globalAlpha = clamp(1.4 - ft, 0, 1); ctx.translate(d.lv.x, fy); ctx.rotate(ft * 1.4);
          blit(ctx, d.surf ? surfSpr(false) : tribSpr(false), 0, -TRY - 20);
          ctx.restore();
        }
        S.counter = false;
        drawErika(ctx, x, y, S);
        const u = M.easeOutCubic(clamp(t / 0.7, 0, 1));
        for (const sx of [-1, 1]) {
          for (const [dx, dy, ph] of [[44, -46, 0], [52, -10, 1]]) {
            const qx = x + sx * dx, qy = y + PY + dy - (1 - u) * 260;
            ctx.beginPath(); ctx.moveTo(qx, qy + 4); ctx.lineTo(x + sx * 19, y + PY + 12); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(16,20,24,0.8)'; ctx.stroke();
            drone(ctx, qx, qy + Math.sin(t * 6 + ph + sx) * 2, t, 1);
          }
        }
      } else {
        if (fight && d.armor < 1 && !st) drawBubble(ctx, b, t);
        drawErika(ctx, x, y, S);
      }
      if (st) {
        // selo SEM SINAL logo acima dos olhos, sempre abaixo da ponta do balão (o balão fica em y >= 104,
        // ponta em b.y - b.bubbleY - 1); as estrelinhas giram em volta do selo
        const ny = Math.max(y + HY - HR + 12, 111);
        K.dizzy(ctx, x, ny, t, 58);
        noSignal(ctx, x, ny, t);
      }
      K.drawFx(ctx, b, 'top');
      if (!(G.coreHooks && G.coreHooks.drawOver)) { ctx.save(); b.def.drawOver(ctx, b, g); ctx.restore(); }
    },
    // por cima dos tiros: anéis/rótulos dos celulares, a semana da 6x1, o aviso do VIRALIZOU e o "AO VIVO" da entrada
    drawOver(ctx, b) {
      const d = b.data, t = b.t;
      if (b.state === 'enter' || b.state === 'talk') { drawLowerThird(ctx, b, t); return; }
      if (b.state !== 'fight') return;
      drawRigOver(ctx, b, t);
      if (d.week.show && !K.stunning(b)) drawWeekOver(ctx, b, t);
      if (d.viralWarn > 0) drawViralWarn(ctx, b, t);
    },
  });

  // ======================================================================
  // Retrato (diálogos, seleção de fases, cartão da fase, silhueta): busto filmando, com o ring light atrás
  // ======================================================================
  G.Portraits.define('erika', function (ctx, x, y, size, o) {
    o = o || {};
    const t = o.t || 0, mood = o.mood || 'smug', hurt = mood === 'hurt', k = size / 100;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size / 2, y - size / 2, size, size); ctx.clip();
    ctx.translate(x, y + size * 0.33); ctx.scale(k, k);
    const S = {
      t, fl: false, vec: true, pose: 'hold', mood: hurt ? 'shock' : mood, mouth: o.mouth || 0, look: [o.lookX != null ? o.lookX : -0.3, 0.12],
      lit: !hurt, glowA: 0.8, spec: hurt ? ERIKA_SWEAT : ERIKA, phone: hurt ? 'nosignal' : 'live', vehicle: false, counter: false,
      stun: false, surf: false, likes: '', tilt: 0,
    };
    drawErika(ctx, 0, 0, S);
    if (hurt) noSignal(ctx, 0, HY - RING_R + 8, t);
    ctx.restore();
  });
})();
