/* ============================================================
   FUSCA A JATO — data.js
   Textos da história, armas, melhorias (lojinha) e conquistas.
   Carregado ANTES do core.js.
   ============================================================ */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  G.TITLE = 'Fusca a Jato';
  G.SUBTITLE = 'Guerra em Brasília';

  // ---------- Armas do Zé ----------
  // As 4 armas. O item "P" alterna entre elas a cada 3 s: a cor escolhe a arma.
  // Todo P (de qualquer cor) enche a barra de força: 1, 2, 3 e 3 P para subir do nível 1 ao 5.
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
    // Custos pensados para ~6 partidas (jogador bom) a ~9 (casual) até comprar tudo (total R$ 22.700).
    // A compra vale na hora: na parada entre fases a vida, a delação e o nível entram na partida em andamento.
    { id: 'vida',   name: 'Plano de Saúde',          desc: '+1 vida em toda partida',                  costs: [900, 2700] },
    { id: 'bomba',  name: 'Arquivo de Delações',     desc: '+1 Delação em toda partida',                costs: [700, 2100] },
    { id: 'turbo',  name: 'Gatilho Turbinado',       desc: 'Atira 10% mais rápido por nível',           costs: [600, 1700, 3600] },
    { id: 'ima',    name: 'Chave Pix Aleatória',     desc: 'Puxa Pix e itens (menos o P) de mais longe', costs: [600, 1100, 2200] },
    { id: 'arma',   name: 'Emenda Bélica',           desc: '+1 nível de arma em toda partida',           costs: [1200, 3400] },
    { id: 'habeas', name: 'Habeas Corpus Preventivo', desc: 'Começa cada fase com escudo',               costs: [1900] },
  ];

  // ---------- Conquistas ----------
  // counter/goal: liberada automaticamente quando G.count(counter) chega na meta.
  G.ACHIEVEMENTS = [
    { id: 'primeiro_voto', name: 'Primeiro Voto',    desc: 'Derrube seu primeiro político',               counter: 'kills', goal: 1 },
    { id: 'ficha_limpa',   name: 'Ficha Limpa',      desc: 'Termine uma fase sem perder vida' },
    { id: 'bico_calado',   name: 'Bico Calado',      desc: 'Vença um chefão sem usar Delação' },
    { id: 'rachou',        name: 'Rachou!',          desc: 'Divida 30 Assessores da Rachadinha',            counter: 'rachadinha', goal: 30 },
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
  ];

  // ---------- Elenco (para retratos e textos) ----------
  G.CAST = {
    ze:         { name: 'Zé Contribuinte', color: '#3ddc84' },
    vo:         { name: 'Vó Dirce',        color: '#ff9ecb' },
    radio:      { name: 'Rádio Planalto',  color: '#ffd23f' },
    centrao:    { name: 'O Centrão',       color: '#9aa5b8' },
    dilmae:     { name: 'Dilmãe',          color: '#e63946' },
    erika:      { name: 'Erika Viralton',  color: '#ffc531' },
    lule:       { name: 'Lule',            color: '#e63946' },
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
      { scene: 'brasilia', text: 'No dia seguinte criaram o Ministério do Compromisso Histórico. O Centrão já pediu três cargos e a deputada abriu um fio sobre ele.' },
      { scene: 'fusca',    text: 'Zé devolveu o Fusca para a Vó Dirce e foi dormir. Segunda-feira tem corrida às seis da manhã. Escala 7x0, como sempre.' },
      { scene: 'urna',     text: 'Vó Dirce: "Zezinho, o rádio disse que o Lule já tá falando em quinto mandato." Zé: "Liga o motor, vó."' },
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
          { who: 'vo', text: 'Cuidado com o Assessor da Rachadinha. Quando você acerta, ele se divide!' },
          { who: 'vo', text: 'A Dilmãe tá lá no fim. Diz que vai dobrar a meta. Ninguém sabe qual.' },
        ],
      },
      paranoa: {
        intro: [
          { who: 'vo', text: 'Lago Paranoá, Zezinho. Que monte de drone é esse filmando tudo?' },
          { who: 'ze', text: 'É live, vó. Tem uma deputada filmando tudo ao vivo da beira do lago.' },
          { who: 'vo', text: 'E esses motoboys da picanha? Passam, atiram e não entregam nada!' },
          { who: 'vo', text: 'Cuidado com o servidor do Ministério da Verdade. O que ele não gosta, ele apaga!' },
        ],
      },
      planalto: {
        intro: [
          { who: 'vo', text: 'Zezinho... é ali. O Palácio do Planalto. Tá vindo um cheiro de churrasco.' },
          { who: 'ze', text: 'Chegou a hora de entregar a fatura. Com juros e correção monetária.' },
          { who: 'vo', text: 'O Leão da Receita está solto. Se ele te morder, leva parte do seu Pix!' },
          { who: 'ze', text: 'Se o Leão gosta tanto de imposto, vou apresentar ele pro Lule.' },
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
          { who: 'vo', text: 'Zezinho, para o Fusca dentro do círculo da META até encher. Ela não sabe o que fazer quando alguém bate a meta!' },
        ],
        post: [
          { who: 'dilmae', text: 'Eu não perdi. Eu só ganhei de uma forma diferente, entende?' },
          { who: 'ze', text: 'Ela saudou a mandioca e foi embora.' },
        ],
      },
      erika: {
        pre: [
          { who: 'erika', text: 'Oi, gente! Tô AO VIVO do Lago Paranoá. E olha quem apareceu: um Fusca a jato atrapalhando a minha live!' },
          { who: 'ze', text: 'Deputada, eu só quero passar. Tenho corrida às seis da manhã.' },
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
    'Nenhuma live foi interrompida na produção deste jogo. Só o sinal.',
  ];
})();
