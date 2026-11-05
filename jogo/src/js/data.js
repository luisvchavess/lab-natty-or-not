/* ============================================================
   FUSCA A JATO — data.js
   Textos da história, armas, melhorias (lojinha), conquistas e os
   ajustes do modo NORMAL sobre o MODO CPI (G.TUNE_NORMAL).
   Carregado ANTES do core.js.
   ============================================================ */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  G.TITLE = 'Fusca a Jato';
  G.SUBTITLE = 'Guerra em Brasília';

  // ---------- Armas do Zé ----------
  // As 4 armas. O item "P" alterna entre elas a cada 3 s: a cor escolhe a arma.
  // Todo P (de qualquer cor) enche a barra de força: 2, 3, 4 e 4 P para subir do nível 1 ao 5.
  G.WEAPONS = {
    voto:   { id: 'voto',   name: 'VOTO',         color: '#3ddc84', desc: 'Tiro reto. Simples e honesto.' },
    boca:   { id: 'boca',   name: 'BOCA DE URNA', color: '#ffd23f', desc: 'Leque largo. Pega todo mundo.' },
    panela: { id: 'panela', name: 'PANELAÇO',     color: '#c9d3e6', desc: 'Panelas teleguiadas. Plém!' },
    jato:   { id: 'jato',   name: 'LAVA-JATO',    color: '#4cc9f0', desc: 'Jato d\'água que atravessa tudo.' },
  };
  G.WEAPON_ORDER = ['voto', 'boca', 'panela', 'jato'];
  G.MAX_LEVEL = 5;

  // ---------- Itens ----------
  G.PICKUPS = {
    pix:    { name: 'Pix',               desc: 'Dinheiro do povo de volta. Gaste na Lojinha.' },
    pix5:   { name: 'Pix gordo',         desc: 'R$ 5 de uma vez.' },
    mala:   { name: 'Mala de dinheiro',  desc: 'R$ 25. Alguém vai sentir falta.' },
    power:  { name: 'Arma',              desc: 'Todo P fortalece a arma. A cor escolhe qual arma você usa.' },
    bomb:   { name: 'Delação Premiada',  desc: 'Bomba: limpa os tiros da tela e acerta todo mundo.' },
    shield: { name: 'Habeas Corpus',     desc: 'Escudo que aguenta um tiro.' },
    life:   { name: '13º Salário',       desc: 'Vida extra.' },
    cafe:   { name: 'Cafezinho',         desc: 'Tiro 50% mais rápido por 10 s.' },
  };

  // ---------- Lojinha do Zé (melhorias permanentes, pagas com Pix) ----------
  G.UPGRADES = [
    // Custos pensados para ~6 partidas (jogador bom) a ~8 (casual) até comprar tudo (total R$ 44.200).
    // A compra vale na hora: na parada entre fases a vida, a delação, o nível e o recurso entram na partida em andamento.
    { id: 'vida',    name: 'Plano de Saúde',           desc: '+1 vida em toda partida',                    costs: [1500, 4200] },
    { id: 'bomba',   name: 'Arquivo de Delações',      desc: '+1 Delação em toda partida',                 costs: [1100, 3300] },
    { id: 'turbo',   name: 'Gatilho Turbinado',        desc: 'Atira 10% mais rápido por nível',            costs: [1000, 2800, 5600] },
    { id: 'ima',     name: 'Chave Pix Aleatória',      desc: 'Puxa Pix e itens (menos o P) de mais longe', costs: [800, 1600, 3200] },
    { id: 'arma',    name: 'Emenda Bélica',            desc: '+1 nível de arma em toda partida',           costs: [2000, 5600] },
    { id: 'habeas',  name: 'Habeas Corpus Preventivo', desc: 'Começa cada fase com escudo',                costs: [3000] },
    { id: 'recurso', name: 'Embargos de Declaração',   desc: '+1 recurso em toda partida',                 costs: [2500, 6000] },
  ];

  // ---------- Modos de dificuldade: o que o NORMAL muda em relação ao MODO CPI ----------
  // Os números escritos nos módulos (registrados com G.tune('<modulo>.<BLOCO>', obj), veja docs/ENGINE.md
  // "Modos") são os do MODO CPI, a dificuldade bônus, e nunca são mexidos para facilitar. O modo NORMAL é o
  // mesmo jogo depois do balanço: TODA mudança que deixa o jogo mais FÁCIL entra só aqui, por bloco e campo:
  //   G.TUNE_NORMAL = { 'taxad.TX': { ARC_SPD: 26 }, 'erika.T': { HP: 7600 }, 'core.T': { EXTENDS: [1500000, 4000000, 8000000] } };
  // (array ou objeto entra inteiro no lugar do valor do CPI, no mesmo objeto). Mudança que deixa o jogo mais
  // DIFÍCIL ou mais JUSTO para os dois (ex.: abrir um vão de uma parede de tiros) vai direto no valor do módulo.
  // Preços da Lojinha (G.UPGRADES), recursos, fases e padrões são iguais nos dois modos.
  // Campo que não bate com nada registrado aparece em G.tuneCheck().bad (os testes exigem []).
  // Preenchido no balanço da rodada 5 (SPEC5 §18.4: "Difícil, mas justo"); o que deixou os DOIS modos mais
  // difíceis foi escrito direto nos módulos (vida dos chefões, cansaço da Dilmãe/Erika, cofre do Taxad, extends).
  G.TUNE_NORMAL = {
    // ---- core.js ----
    // NORMAL: chefão com vida mais "elástica" pela PRESSÃO: ×0,50 (R 0) … ×1,00 (R 0,75) … ×1,17 (R 1).
    // A arma no máximo não corta mais a luta pela metade (L5/L3 ≥ 0,75) e quem está apanhando pega chefão mais curto.
    // (o MODO CPI fica em ×0,95 + 0,22·R, nunca abaixo desta curva)
    // Os tiros não aceleram com a PRESSÃO (CPI: até ×1,22 em R 1): no NORMAL ela pesa na vida do chefão e no prêmio
    'core.PRESS': { BHP0: 0.5, BHP1: 0.67, SPD: 0 },
    // NORMAL: 7 P do nível 1 ao 5 (CPI: 13) — com a morte zerando a barra, o bom jogador ficava no nível 3;
    // 5 vidas por crédito (CPI: 3; com 4 o bom jogador entrava com 2 recursos por partida e o casual com 4,3)
    // e 4 s de invencibilidade na volta (mortes em cadeia logo depois de voltar)
    'core.T': { POWER_NEED: [0, 1, 2, 2, 2], START_LIVES: 5, RESPAWN_INV: 4 },

    // ---- enemies.js ----
    // NORMAL: fases 2–5 mais calmas (nível da tabela menor: tiro, intervalo, vida dos comuns; a Esplanada matava
    // o bom jogador 1,6 vez antes da Dilmãe), PRESSÃO quase não adensa (intervalo/1º tiro, sem o tiro a mais no
    // leque em CRISE) e a revanche vem menos
    'enemies.T': { LVL: [0, 0.5, 1.2, 1.5, 1.8], P_IVL: 0.05, P_FIRST: 0.05, P_FAN3: 0, PREV_CHANCE: 0.35 },

    // ---- bosses.js ----
    // NORMAL: em CRISE/CAOS os chefões 1–4 não ganham tiro a mais nem esperas menores (como o Lule, lule.PV)
    'bosses.KIT': { PN3: 0, PW3: 1 },
    // NORMAL: Centrão cansa antes (o casual chegava ao cansaço em 0/6 lutas) e atira um pouco mais devagar (CPI ×1,15)
    'bosses.centrao': { fatStart: 110, spdK: 1.05 },
    // NORMAL: Dilmãe atira na velocidade escrita (CPI ×1,12: a Esplanada era a fase que mais matava o bom jogador
    // depois do Planalto) e cansa antes (casual)
    'bosses.dilmae': { spdK: 1, fatStart: 150 },
    // NORMAL: as sementinhas miradas do 3º turno saem a cada 1,8 s a 130 px/s (CPI 1,45 s a 150): eram o que mais
    // matava na Dilmãe (bom jogador 2 mortes por luta, casual 4)
    'bosses.MT': { P3_SEED_EVERY: 1.8, P3_SEED_SPD: 130 },

    // ---- erika.js ----
    // NORMAL: tiros da Erika na velocidade escrita (CPI ×1,15), cansa antes (o casual cansava a Erika em 1 de 4 lutas;
    // CPI 205 s) e a armadura EM ALTA mais fraca
    'erika.T': { SPD_K: 1, FAT_START: 160 },
    'erika.FI': { ARMOR: [1, 0.95, 0.93, 0.9, 0.86] },

    // ---- taxad.js ----
    // NORMAL: tiros do Taxad na velocidade escrita, cansa antes (o casual cansava o Taxad em 1 de 6 lutas; CPI 190 s);
    // cofres embaralham mais devagar (casual achava pouco)
    'taxad.T': { SPD_K: 1, FAT_START: 160 },
    'taxad.CF': { SW: [0.66, 0.6, 0.54, 0.5, 0.46] },
    // NORMAL: teclas/arcabouço com mais respiro (a régua matava muito na P2), '00' mais lento e espaçado,
    // descanso maior no 5º turno
    'taxad.TX': { KEY_EVERY: 2.3, KEY_ARC_K: 3, KEY_SPD: 130, P2_GAP1: 2.8, P2_GAP2: 2, ARC_TELE: 1.2,
      ZERO_SPD: 65, ZERO_EVERY: 3.5, ZERO_DELAY: 1, P5_REST: 0.9 },

    // ---- lule.js / janjinha.js ----
    // NORMAL: cansaço da 2ª vida mais cedo (o casual quase nunca chegava nele) e o tonto passa um pouco da troca de turno
    'lule.T': { FAT2: 105, PHASE_STUN: 2.6 },
    // NORMAL: o carimbo TAXADO! trava antes e bate depois (0,8–0,85 s para sair da sombra; CPI 0,5–0,55 s), persegue
    // mais devagar e só machuca na hora da batida (0,15 s; CPI 0,32 s) — era o que mais matava o bom jogador no Lule
    'lule.STAMP': { TRACK: 0.6, WARN: 1.4, TRACK2: 0.4, WARN2: 1.25, SPD: 220, LIFE: 0.15 },
    // NORMAL: o laser de trás do L gigante para 20 px ANTES do centro (CPI: passa 12 px): quem fica no meio,
    // embaixo do Lule, não é mais pego no fim da varredura
    'lule.LSW': { END_DX: -20 },
    // NORMAL: o OLÉ paga mais (1º tonto mais longo, multiplicador maior)
    'lule.LEAO': { STUN: [4.4, 2.8, 2.8], MUL: 3.15 },
    // NORMAL: sem o tiro a mais / esperas menores em CRISE (lv 3–4)
    'lule.PV': { N3: 0, W3: 1 },
    // NORMAL: Janjinha com metade da vida, fica mais tempo parada e vai embora antes (a panela não a derruba)
    'janjinha.JN': { HP: 1500, DWELL: [5, 6], LEAVE_T: 60, STUN_K: 2.5 },
  };

  // ---------- Conquistas ----------
  // counter/goal: liberada automaticamente quando G.count(counter) chega na meta.
  G.ACHIEVEMENTS = [
    { id: 'primeiro_voto', name: 'Primeiro Voto',    desc: 'Derrube seu primeiro político',               counter: 'kills', goal: 1 },
    { id: 'ficha_limpa',   name: 'Ficha Limpa',      desc: 'Termine uma fase sem perder vida' },
    { id: 'bico_calado',   name: 'Bico Calado',      desc: 'Vença um chefão sem usar Delação' },
    { id: 'rachou',        name: 'Rachou!',          desc: 'Divida 30 Assessores do Loteamento',            counter: 'rachadinha', goal: 30 },
    { id: 'por_um_fio',    name: 'Por um Fio',       desc: 'Faça 300 raspões numa partida' },
    { id: 'arsenal',       name: 'Arsenal Completo', desc: 'Chegue ao nível máximo de uma arma' },
    { id: 'centrao',       name: 'Fora, Centrão',    desc: 'Derrote O Centrão' },
    { id: 'dilmae',        name: 'Meta Dobrada',     desc: 'Derrote Dilmãe' },
    { id: 'erika',         name: 'Caiu a Live',      desc: 'Derrote a Erika Viralton' },
    { id: 'lule',          name: 'A Conta Chegou',   desc: 'Derrote Lule (as duas vezes)' },
    // manhas dos chefões: os contadores são somados pelos módulos dos chefões (G.count); 'ole' é liberada pelo lule.js
    { id: 'confisco',      name: 'Confisco Popular', desc: 'Pegue 15 emendas do Centrão com o Fusca', counter: 'emenda',  goal: 15 },
    { id: 'meta_batida',   name: 'Meta Atingida',    desc: 'Encha 10 metas da Dilmãe',              counter: 'meta_ok', goal: 10 },
    { id: 'corta_fio',     name: 'Segue o Fio',      desc: 'Corte 25 fios da live da Erika',        counter: 'fio',     goal: 25 },
    { id: 'ole',           name: 'Olé!',             desc: 'Faça o Leão morder o Lule 3 vezes na mesma luta' },
    { id: 'reeleito',      name: 'Reeleito',         desc: 'Vença o 2º Mandato' },
    { id: 'cacador',       name: 'Caçador de Marajás', desc: 'Derrube 1.000 políticos no total',            counter: 'kills', goal: 1000 },
    { id: 'magnata',       name: 'Magnata do Pix',   desc: 'Junte R$ 10.000 no total',                       counter: 'pixTotal', goal: 10000 },
    // Rodada 5: Fazenda, Janjinha, PRESSÃO e o mandato sem recurso ('cofre' e 'cartao' são contadores dos módulos)
    { id: 'taxad',        name: 'Taxa Zero',            desc: 'Derrote Fernando Taxad' },
    { id: 'restituicao',  name: 'Restituição na Conta', desc: 'Ache o seu dinheiro em 10 cofres do Taxad', counter: 'cofre', goal: 10 },
    { id: 'isento',       name: 'Isento!',              desc: 'Vença o Taxad acertando todos os cofres (no mínimo 4)' },
    { id: 'embarcou',     name: 'Embarque Imediato',    desc: 'Mande a Janjinha para uma viagem oficial' },
    { id: 'cartao',       name: 'Cartão Bloqueado',     desc: 'Faça o Leão bloquear o cartão corporativo' },
    { id: 'carimbo_ouro', name: 'Nota de Ouro',         desc: 'Ganhe 3 Carimbos de Ouro na mesma partida' },
    { id: 'cpi',          name: 'Instalaram a CPI',     desc: 'Derrote um chefão com a PRESSÃO em CPI!' },
    { id: 'transito',     name: 'Trânsito em Julgado',  desc: 'Vença um mandato inteiro sem entrar com recurso (libera o Fusca Dourado)' },
    // MODO CPI (a dificuldade bônus): liberada pelo core no fim do 1º Mandato jogado inteiro no MODO CPI
    { id: 'cpi_mandato',  name: 'CPI Encerrada',        desc: 'Vença o 1º Mandato no MODO CPI.' },
    { id: 'quinto',       name: 'Quinto Mandato? Não!', desc: 'Derrote o Lule 5.0' },
  ];

  // ---------- Elenco (para retratos e textos) ----------
  G.CAST = {
    ze:         { name: 'Zé Contribuinte', color: '#3ddc84' },
    vo:         { name: 'Vó Dirce',        color: '#ff9ecb' },
    radio:      { name: 'Rádio Planalto',  color: '#ffd23f' },
    centrao:    { name: 'O Centrão',       color: '#9aa5b8' },
    dilmae:     { name: 'Dilmãe',          color: '#e63946' },
    erika:      { name: 'Erika Viralton',  color: '#ffc531' },
    pavanatto:  { name: 'Lucas Pavanatto', color: '#2f6fd6' },
    lule:       { name: 'Lule',            color: '#e63946' },
    taxad:      { name: 'Fernando Taxad',  color: '#ffb02e' },
    janjinha:   { name: 'Janjinha',        color: '#ff3d7f' },
  };

  // ---------- História ----------
  // Painéis da abertura: {scene, text}. scene é só uma dica de ilustração para a UI.
  G.STORY = {
    intro: [
      { scene: 'urna',     text: 'Brasil, 2026. Acabou mais uma eleição. A picanha prometida na anterior? Ainda está chegando.' },
      { scene: 'briga',    text: 'Pra fechar o rombo, o governo teve a ideia de sempre: imposto novo. Imposto virou munição. Santinho virou míssil.' },
      { scene: 'brasilia', text: 'Taxa aqui, emenda ali, live acolá. Brasília virou zona de guerra. E adivinha quem paga a munição? Você.' },
      { scene: 'ze',       text: 'Zé Contribuinte é motorista de aplicativo, trabalha de domingo a domingo e paga imposto até no cafezinho. Hoje ele cansou.' },
      { scene: 'fusca',    text: 'Ele pegou o Fusca 78 da Vó Dirce, instalou um motor a jato e encheu o porta-malas de votos.' },
      { scene: 'planalto', text: 'Destino: o Palácio do Planalto. Missão: entregar a fatura pessoalmente ao chefão de todos. LULE.' },
    ],
    ending: [
      { scene: 'planalto', text: 'Fatura entregue em mãos, com juros e correção monetária. Nunca antes na história deste país um governo leu a conta até o fim.' },
      { scene: 'brasilia', text: 'No dia seguinte criaram o 40º ministério: o da Fatura. O Taxad já criou uma taxa pra ele, o Centrão pediu três cargos e a deputada abriu um fio.' },
      { scene: 'fusca',    text: 'Zé devolveu o Fusca para a Vó Dirce e foi dormir. Segunda-feira tem corrida às seis da manhã. Escala 7x0, como sempre.' },
      { scene: 'urna',     text: 'Vó Dirce: "Zezinho, o rádio disse que o Lule já tá falando em quinto mandato." Zé: "Liga o motor, vó."' },
    ],
    // Painel extra do final (ui.js mostra logo depois do 1º painel quando info.secret === 'won': venceu o Lule 5.0)
    endingQuinto: [
      { scene: 'planalto', text: 'Quinto mandato? Não desta vez. O Zé entregou a fatura, o recibo e a segunda via, tudo com firma reconhecida. O Lule 5.0 saiu prometendo picanha pro sexto.' },
    ],
    // Último painel quando venceu o Lule 5.0 (no lugar do último do ending: o quinto já foi barrado)
    endingQuintoLast: [
      { scene: 'urna',     text: 'Vó Dirce: "Zezinho, o rádio disse que o Lule já tá falando em sexto mandato." Zé: "Liga o motor, vó."' },
    ],
    // Diálogos por fase (id da fase). intro: antes da fase. Os diálogos de chefão ficam em STORY.boss.
    stages: {
      rodoviaria: {
        intro: [
          { who: 'vo', text: 'Zezinho, cuidado com o meu Fusca, que era do seu avô! E leva um casaquinho, que em Brasília venta.' },
          { who: 'ze', text: 'Pode deixar, vó. Rodoviária do Plano à vista. Tá lotada de cabo eleitoral.' },
          { who: 'vo', text: 'Arraste o dedo em qualquer lugar da tela. O Fusca copia o movimento: não precisa encostar nele.' },
          { who: 'vo', text: 'Ele atira sozinho. Todo "P" deixa a arma mais forte, e a cor dele escolhe qual arma você usa.' },
          { who: 'vo', text: 'Apertou? Dê um toque rápido no botão da Delação Premiada: todo mundo entrega todo mundo e a tela fica limpa.' },
          { who: 'vo', text: 'E presta atenção no chefão: cada um tem uma manha. Só atirar não resolve!' },
        ],
      },
      esplanada: {
        intro: [
          { who: 'vo', text: 'Esplanada dos Ministérios. Dizem que são 38 ministérios, Zezinho.' },
          { who: 'ze', text: 'E pelo jeito cada um tem uns mil assessores atirando em mim.' },
          { who: 'vo', text: 'Cuidado com o Assessor do Loteamento. Quando você acerta, ele se divide!' },
          { who: 'vo', text: 'A Dilmãe tá lá no fim. Diz que vai dobrar a meta. Ninguém sabe qual.' },
        ],
      },
      paranoa: {
        intro: [
          { who: 'vo', text: 'Lago Paranoá, Zezinho. Que monte de drone é esse filmando tudo?' },
          { who: 'ze', text: 'É live, vó. Tem uma deputada filmando tudo ao vivo da beira do lago.' },
          { who: 'vo', text: 'Dizem que essa deputada quer acabar com a escala 6x1.' },
          { who: 'ze', text: 'Ótimo, vó. Eu trabalho 7x0.' },
          { who: 'vo', text: 'E esses motoboys da picanha? Passam, atiram e não entregam nada!' },
          { who: 'vo', text: 'Cuidado com o servidor do Ministério da Verdade. O que ele não gosta, ele apaga!' },
        ],
      },
      fazenda: {
        intro: [
          { who: 'vo', text: 'Ministério da Fazenda, Zezinho. Olha aquele placar enorme: é o Impostômetro.' },
          { who: 'ze', text: 'Vó, esse número sobe mais rápido que taxímetro de aeroporto.' },
          { who: 'vo', text: 'Cuidado com o Fiscal da Receita. Ele joga a malha fina, mas a malha sempre tem um furo!' },
          { who: 'vo', text: 'E o chefe daqui? Dizem que ele já saiu, mas a calculadora ficou ligada.' },
        ],
      },
      planalto: {
        intro: [
          { who: 'vo', text: 'Zezinho... é ali. O Palácio do Planalto. Tá vindo um cheiro de churrasco.' },
          { who: 'ze', text: 'Chegou a hora de entregar a fatura. Com juros e correção monetária.' },
          { who: 'vo', text: 'O Leão da Receita está solto. Se ele te morder, leva parte do seu Pix!' },
          { who: 'ze', text: 'Se o Leão gosta tanto de imposto, vou apresentar ele pro Lule.' },
          { who: 'vo', text: 'E dizem que a Ministra Sem Pasta voltou de viagem. De mala pronta pra próxima.' },
        ],
      },
    },
    // Diálogos de chefão: pre = quando ele chega, post = depois de derrotado.
    boss: {
      centrao: {
        pre: [
          { who: 'centrao', text: 'Calma, calma! O governo já fechou com a gente. Agora... quanto vale o SEU voto?' },
          { who: 'ze', text: 'Meu voto não está à venda! E essa emenda é dinheiro meu!' },
          { who: 'centrao', text: 'Tudo está à venda, meu filho. Olha a emenda chegando: TOMA LÁ, DÁ CÁ!' },
          { who: 'vo', text: 'Zezinho, encosta o Fusca na mala da EMENDA! Quem tem a verba manda no Centrão!' },
        ],
        post: [
          { who: 'centrao', text: 'Tá bom, tá bom! A partir de agora a gente apoia você. Somos governo, sempre!' },
          { who: 'ze', text: 'Esse aí muda de lado mais que ventilador.' },
        ],
      },
      dilmae: {
        pre: [
          { who: 'dilmae', text: 'Não vamos colocar meta. Vamos deixar a meta aberta. Quando atingir a meta, nós dobramos a meta.' },
          { who: 'ze', text: 'Hã?' },
          { who: 'dilmae', text: 'E eu estoquei o vento, querido. Agora ele é todo seu!' },
          { who: 'vo', text: 'Zezinho, estaciona o Fusca dentro do círculo da META até encher. Ela não sabe o que fazer quando alguém bate a meta!' },
        ],
        post: [
          { who: 'dilmae', text: 'Eu não perdi. Eu só ganhei de uma forma diferente, entende?' },
          { who: 'ze', text: 'Ela saudou a mandioca e foi embora.' },
        ],
      },
      erika: {
        pre: [
          { who: 'erika', mood: 'laugh', text: 'Oi, gente! Tô AO VIVO do Lago Paranoá. E olha quem apareceu: um Fusca a jato atrapalhando a minha live!' },
          { who: 'ze', text: 'Deputada, eu só quero passar. Amanhã é sábado e tenho corrida às seis da manhã.' },
          { who: 'erika', text: 'Às seis? Num sábado?! Isso é escala 6x1! Vou protocolar o fim dela agora, ao vivo!' },
          { who: 'ze', text: 'Sou motorista de aplicativo, deputada. Minha escala é 7x0. Quem paga a minha folga?' },
          { who: 'erika', text: 'Que fala problemática! Vou abrir um fio sobre você. SEGUE O FIO, gente!' },
          { who: 'vo', text: 'Zezinho, a live dela vem pelos fios dos celulares. Passa com o Fusca nos fios que cai o sinal!' },
        ],
        post: [
          { who: 'erika', text: 'Gente, caiu a live! Mas não acabou: vou postar um textão, abrir um fio e o PSOL vai ao STF!' },
          { who: 'ze', text: 'Saiu voando, carregada pelos drones. Ainda filmando, claro.' },
        ],
      },
      taxad: {
        pre: [
          { who: 'taxad', text: 'Boa noite, contribuinte. Meu nome é Taxad. Fernando Taxad.' },
          { who: 'ze', text: 'Seu Taxad, eu só tô de passagem. Vou pro Planalto.' },
          { who: 'taxad', text: 'Passagem? Isso é uma operação. E toda operação tem uma taxinha.' },
          { who: 'ze', text: 'Taxa de quê?!' },
          { who: 'taxad', mood: 'smug', text: 'Calma! Não vou taxar o Pix... ainda. Agora me diz: cadê o seu dinheiro?' },
          { who: 'vo', text: 'Zezinho, ele esconde o seu dinheiro num dos cofres e embaralha. Não tira o olho do cofre certo e encosta o Fusca nele!' },
        ],
        post: [
          { who: 'taxad', text: 'Tá bom, você ganhou. Mas a restituição só cai no ano que vem, viu?' },
          { who: 'ze', text: 'Pegou um táxi e foi embora. Com a bandeira 2 ligada. Por nossa conta.' },
        ],
        // ISENTO! (nenhum cofre errado): o taxad.js troca as falas do fim por estas (G.game.postLines)
        postIsento: [
          { who: 'taxad', text: 'Nenhum cofre errado? Isso é... isenção total! Vou criar uma taxa pra isso.' },
          { who: 'ze', text: 'Isento, vó! Pela primeira vez na vida.' },
        ],
      },
      lule: {
        pre: [
          { who: 'lule', text: 'Companheiro! Que bom que você veio. Senta aí, tem picanha e cervejinha pra todo mundo!' },
          { who: 'ze', text: 'Vim entregar a fatura, Lule. E cadê a picanha que foi prometida, hein?' },
          { who: 'lule', text: 'Tá chegando, companheiro. Tá chegando... NA SUA CARA!' },
          { who: 'vo', text: 'Zezinho, o Leão da Receita tá solto! Quando ele mirar, fica na frente do Lule... e sai na hora. Olé!' },
        ],
        // Fala quando ele "volta" depois da primeira derrota (o módulo do chefão chama G.STORY.boss.lule.voltou)
        voltou: [
          { who: 'lule', text: 'Achou que tinha acabado, companheiro? Eu SEMPRE volto!' },
          { who: 'ze', text: 'Ah, não. De novo não.' },
        ],
        // Na 2ª vida a Janjinha entra na luta (janjinha.js chama G.STORY.boss.lule.janjinha)
        janjinha: [
          { who: 'janjinha', text: 'Pode deixar comigo. Agora o cerimonial é meu!' },
          { who: 'ze', text: 'Pronto. Virou comitiva oficial.' },
          { who: 'janjinha', text: 'Sorri pra selfie, contribuinte! A viagem é de trabalho e o cartão é da União.' },
          { who: 'vo', text: 'Zezinho, enquanto ela tá ali, o Lule fica atrás do cordão do cerimonial. Tira ela da luta primeiro!' },
        ],
        // LULE 5.0 (luta secreta: venceu a 2ª vida sem entrar com recurso)
        quinto: [
          { who: 'lule', text: 'Calma, companheiro! Ninguém sai do Planalto sem o quinto mandato!' },
          { who: 'ze', text: 'Vó, ele voltou DE NOVO.' },
          { who: 'vo', text: 'Zezinho, você não entrou com recurso nenhuma vez. Ele tá desesperado! Termina isso!' },
        ],
        postQuinto: [
          { who: 'lule', text: 'Tá bom, tá bom! Sem quinto mandato. Mas do sexto eu não prometo nada.' },
          { who: 'ze', text: 'Vó, liga o motor. Antes que ele volte.' },
        ],
        post: [
          { who: 'lule', text: 'Tá bom, tá bom... eu pago a conta. Mas parcelado em 12 vezes no carnê, viu?' },
          { who: 'ze', text: 'Aceito Pix.' },
        ],
      },
    },
  };

  G.CREDITS = [
    'FUSCA A JATO: GUERRA EM BRASÍLIA',
    'Um jogo de humor e paródia política.',
    'Todos os personagens são caricaturas. Qualquer semelhança com políticos reais é pura sátira.',
    'Nenhum político foi ferido na produção deste jogo. Só a reputação.',
    'Vote consciente. E guarde a nota fiscal.',
    'Nenhum fio foi cortado na produção deste jogo. Só os da live.',
    'Nenhuma blusinha foi taxada na produção deste jogo. Só a paciência do Zé.',
    'O cartão corporativo deste jogo é de mentira. O sofá também.',
  ];
})();
