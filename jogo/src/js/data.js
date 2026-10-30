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
  // As 4 armas. O item "P" alterna entre elas a cada 3 s: pegue na cor certa.
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
    power:  { name: 'Arma',              desc: 'Mesma cor: sobe o nível. Outra cor: troca de arma.' },
    bomb:   { name: 'Delação Premiada',  desc: 'Bomba: limpa os tiros da tela e acerta todo mundo.' },
    shield: { name: 'Habeas Corpus',     desc: 'Escudo que aguenta um tiro.' },
    life:   { name: '13º Salário',       desc: 'Vida extra.' },
    cafe:   { name: 'Cafezinho',         desc: 'Tiro 50% mais rápido por 10 s.' },
  };

  // ---------- Lojinha do Zé (melhorias permanentes, pagas com Pix) ----------
  G.UPGRADES = [
    { id: 'vida',   name: 'Plano de Saúde',          desc: '+1 vida no começo da partida',          costs: [400, 1200] },
    { id: 'bomba',  name: 'Arquivo de Delações',     desc: '+1 Delação Premiada no começo',          costs: [300, 900] },
    { id: 'turbo',  name: 'Motor Turbinado',         desc: 'Tiro 10% mais rápido por nível',          costs: [250, 700, 1500] },
    { id: 'ima',    name: 'Chave Pix Aleatória',     desc: 'Puxa Pix e itens de mais longe',          costs: [150, 450, 900] },
    { id: 'arma',   name: 'Emenda Bélica',           desc: 'Começa com a arma um nível acima',        costs: [500, 1400] },
    { id: 'habeas', name: 'Habeas Corpus Preventivo', desc: 'Começa cada fase com escudo',            costs: [800] },
  ];

  // ---------- Conquistas ----------
  // counter/goal: liberada automaticamente quando G.count(counter) chega na meta.
  G.ACHIEVEMENTS = [
    { id: 'primeiro_voto', name: 'Primeiro Voto',    desc: 'Derrube seu primeiro político',               counter: 'kills', goal: 1 },
    { id: 'ficha_limpa',   name: 'Ficha Limpa',      desc: 'Termine uma fase sem levar nenhum tiro' },
    { id: 'bico_calado',   name: 'Bico Calado',      desc: 'Vença um chefão sem usar Delação' },
    { id: 'rachou',        name: 'Rachou!',          desc: 'Divida 30 Assessores da Rachadinha',            counter: 'rachadinha', goal: 30 },
    { id: 'por_um_fio',    name: 'Por um Fio',       desc: 'Faça 300 raspões numa partida' },
    { id: 'arsenal',       name: 'Arsenal Completo', desc: 'Chegue ao nível máximo de uma arma' },
    { id: 'centrao',       name: 'Fora, Centrão',    desc: 'Derrote O Centrão' },
    { id: 'dilmae',        name: 'Meta Dobrada',     desc: 'Derrote Dilmãe' },
    { id: 'bolsonario',    name: 'Fim da Motociata', desc: 'Derrote o Capitão Bolsonário' },
    { id: 'lule',          name: 'A Conta Chegou',   desc: 'Derrote Lule (as duas vezes)' },
    { id: 'reeleito',      name: 'Reeleito',         desc: 'Vença o 2º Mandato' },
    { id: 'cacador',       name: 'Caçador de Marajá', desc: 'Derrube 1.000 políticos no total',            counter: 'kills', goal: 1000 },
    { id: 'magnata',       name: 'Magnata do Pix',   desc: 'Junte R$ 10.000 no total',                       counter: 'pixTotal', goal: 10000 },
  ];

  // ---------- Elenco (para retratos e textos) ----------
  G.CAST = {
    ze:         { name: 'Zé Contribuinte', color: '#3ddc84' },
    vo:         { name: 'Vó Dirce',        color: '#ff9ecb' },
    radio:      { name: 'Rádio Planalto',  color: '#ffd23f' },
    centrao:    { name: 'O Centrão',       color: '#9aa5b8' },
    dilmae:     { name: 'Dilmãe',          color: '#e63946' },
    bolsonario: { name: 'Capitão Bolsonário', color: '#2bb24c' },
    lule:       { name: 'Lule',            color: '#e63946' },
  };

  // ---------- História ----------
  // Painéis da abertura: {scene, text}. scene é só uma dica de ilustração para a UI.
  G.STORY = {
    intro: [
      { scene: 'urna',     text: 'Brasil, outubro de 2026. A eleição acabou. O problema é que ninguém aceitou o resultado.' },
      { scene: 'briga',    text: 'Os políticos cansaram de debater na TV e partiram pra briga. Imposto virou munição. Santinho virou míssil.' },
      { scene: 'brasilia', text: 'Brasília virou zona de guerra. E adivinha quem está pagando a munição? Você.' },
      { scene: 'ze',       text: 'Zé Contribuinte é motorista de aplicativo e paga imposto até no cafezinho. Hoje ele cansou.' },
      { scene: 'fusca',    text: 'Ele pegou o Fusca 78 da Vó Dirce, instalou um motor a jato e encheu o porta-malas de votos.' },
      { scene: 'planalto', text: 'Destino: o Palácio do Planalto. Missão: entregar a fatura pessoalmente ao chefão de todos. LULE.' },
    ],
    ending: [
      { scene: 'planalto', text: 'Com a fatura entregue, os políticos assinaram um acordo histórico: nunca mais usar o dinheiro do povo como munição.' },
      { scene: 'brasilia', text: 'Ninguém acreditou, claro. Mas por uma semana inteira Brasília ficou em silêncio.' },
      { scene: 'fusca',    text: 'Zé devolveu o Fusca para a Vó Dirce e foi dormir. Segunda-feira tem corrida às seis da manhã.' },
      { scene: 'urna',     text: 'Vó Dirce: "Zezinho, o rádio disse que daqui a quatro anos tem eleição de novo." Zé: "Liga o motor, vó."' },
    ],
    // Diálogos por fase (id da fase). intro: antes da fase. Os diálogos de chefão ficam em STORY.boss.
    stages: {
      rodoviaria: {
        intro: [
          { who: 'vo', text: 'Zezinho, cuidado com o carro do seu avô! E leva um casaquinho, que em Brasília venta.' },
          { who: 'ze', text: 'Pode deixar, vó. Rodoviária do Plano à vista. Tá lotada de cabo eleitoral.' },
          { who: 'vo', text: 'Arraste o dedo para pilotar. O Fusca atira sozinho. Pegue o "P" na cor da arma que você quiser.' },
          { who: 'vo', text: 'Se apertar, aperta o botão da Delação Premiada: todo mundo entrega todo mundo e a tela fica limpa.' },
        ],
      },
      esplanada: {
        intro: [
          { who: 'vo', text: 'Esplanada dos Ministérios. Dizem que são 38 ministérios, Zezinho.' },
          { who: 'ze', text: 'E pelo jeito cada um tem uns mil assessores atirando em mim.' },
          { who: 'vo', text: 'Cuidado com o Assessor da Rachadinha. Quando você acerta, ele se divide!' },
        ],
      },
      paranoa: {
        intro: [
          { who: 'vo', text: 'Lago Paranoá. Que barulho é esse? Parece um enxame de moto.' },
          { who: 'ze', text: 'É motociata, vó. Segura o crochê que vai tremer.' },
          { who: 'vo', text: 'Os drones do Gabinete não param de atirar. Derrube o servidor deles!' },
        ],
      },
      planalto: {
        intro: [
          { who: 'vo', text: 'Zezinho... é ali. O Palácio do Planalto. Tá vindo um cheiro de churrasco.' },
          { who: 'ze', text: 'Chegou a hora de entregar a fatura. Com juros e correção monetária.' },
          { who: 'vo', text: 'O Leão da Receita está solto. Se ele te morder, leva parte do seu Pix!' },
        ],
      },
    },
    // Diálogos de chefão: pre = quando ele chega, post = depois de derrotado.
    boss: {
      centrao: {
        pre: [
          { who: 'centrao', text: 'Calma, calma! A gente pode conversar. Quanto vale o seu voto?' },
          { who: 'ze', text: 'Meu voto não está à venda!' },
          { who: 'centrao', text: 'Tudo está à venda, meu filho. TOMA LÁ, DÁ CÁ!' },
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
        ],
        post: [
          { who: 'dilmae', text: 'Eu não perdi. Eu só ganhei de uma forma diferente, entende?' },
          { who: 'ze', text: 'Ela saudou a mandioca e foi embora.' },
        ],
      },
      bolsonario: {
        pre: [
          { who: 'bolsonario', text: 'Aqui é motociata, talkey? Quem não está de moto está de mimimi!' },
          { who: 'ze', text: 'Capitão, cadê a nota fiscal do leite condensado?' },
          { who: 'bolsonario', text: 'Isso aí é sigilo de 100 anos, talkey?!' },
        ],
        post: [
          { who: 'bolsonario', text: 'Isso foi fraude! Eu quero voto impresso! Vou pra Disney... digo, vou pra base!' },
          { who: 'ze', text: 'Foi embora de jet ski. Claro.' },
        ],
      },
      lule: {
        pre: [
          { who: 'lule', text: 'Companheiro! Que bom que você veio. Senta aí, tem picanha e cervejinha pra todo mundo!' },
          { who: 'ze', text: 'Cadê a picanha que foi prometida, hein?' },
          { who: 'lule', text: 'Tá chegando, companheiro. Tá chegando... NA SUA CARA!' },
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
  ];
})();
