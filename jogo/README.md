# Fusca a Jato: Guerra em Brasília

Shoot'em up vertical para celular, de paródia política. A eleição acabou, ninguém aceitou o resultado e os políticos partiram para a briga. Zé Contribuinte, motorista de aplicativo, cansou de pagar a conta: instalou um motor a jato no Fusca 78 da Vó Dirce e voou até o Palácio do Planalto para entregar a fatura ao chefão de todos, **Lule**.

## Como jogar

- **Arraste o dedo em qualquer lugar** da tela: o Fusca acompanha o movimento do dedo, sem ficar escondido embaixo dele.
- **O tiro é automático.** O pontinho branco no meio do Fusca é o único lugar onde você leva dano.
- **Raspão:** passar bem perto dos tiros dá pontos, sobe a aprovação e carrega uma Delação extra.
- **Item P:** todo P deixa a arma mais forte (1, 2, 3 e 3 P para subir do nível 1 ao 5). Ele muda de cor a cada 3 segundos: a cor escolhe a arma. Morreu? A arma perde um nível, que cai na tela como um P "de volta": pegou, recuperou.
  - **VOTO** (verde): tiro reto e forte.
  - **BOCA DE URNA** (amarelo): leque largo.
  - **PANELAÇO** (prata): panelas teleguiadas.
  - **LAVA-JATO** (azul): jato d'água que atravessa tudo.
- **Delação Premiada** (botão redondo): um toque limpa os tiros da tela, transforma em Pix e acerta todo mundo. Se o dedão cair em cima do botão e arrastar, ele só volta a pilotar (não gasta a Delação).
- **Aprovação:** derrubar políticos em sequência sobe o multiplicador de votos (placar). Levar tiro derruba.
- **Pix:** o dinheiro que cai dos políticos fica com você entre partidas (é gravado também quando o app vai para o fundo). Gaste na **Lojinha do Zé** em melhorias permanentes. O que você compra na parada entre fases já vale na partida em andamento.
- **Nota da fase:** S (sem morrer, no máximo 1 Delação), A (sem morrer), B (poucas mortes; a régua sobe a cada fase) ou C. Nota boa paga mais Pix, e as fases finais pagam mais.
- **Recontagem:** perdeu todas as vidas? Peça recontagem e continue de onde parou (o placar zera e as vidas extras por pontos não se repetem).
- **Pausa:** ao voltar, o jogo espera um segundo ("PRONTO? VAI!") para você pôr o dedo na tela. Com o celular deitado, o jogo pausa e pede para girar.

No computador: setas/WASD movem, Shift deixa lento, X ou espaço solta a Delação, P ou Esc pausa.

## Fases

1. **Rodoviária do Plano** — chefão: O Centrão
2. **Esplanada dos Ministérios** — chefão: Dilmãe
3. **Lago Paranoá** — chefão: Capitão Bolsonário
4. **Palácio do Planalto** — chefão final: Lule

Venceu? Libera o **2º Mandato**, uma volta mais difícil que paga mais Pix.

## Rodando

O jogo é um único arquivo: abra `index.html` no navegador do celular ou do computador. Não precisa de servidor nem de internet (só as fontes vêm do Google Fonts, sem travar a abertura; sem elas o jogo usa fontes do sistema). Em celular mais fraco o jogo baixa a qualidade gráfica sozinho para não travar.

Para desenvolver:

```bash
cd jogo
node build.js          # junta src/ em index.html e dist/artifact.html
# dev.html carrega os arquivos de src/ separados (bom para editar)
node tools/play.js --q "stage=0&god=1&auto=1&ts=4&skipui=1" --seconds 30 --shots 5   # teste automático com Chromium
node tools/fullrun.js --god 1 --ts 6                                                    # partida inteira no piloto automático
node tools/humanbot.js --profile casual --stage 0 --runs 3                              # bot "humano": mede a dificuldade
```

Estrutura:

| arquivo | conteúdo |
|---|---|
| `src/js/data.js` | história, diálogos, armas, itens, lojinha, conquistas |
| `src/js/core.js` | motor: loop, toque, tiros, colisões, jogador, chefões, roteiro das fases, HUD, save |
| `src/js/art.js` | Fusca, itens, ícones, ilustrações da história, retratos |
| `src/js/bg.js` | cenários de Brasília |
| `src/js/audio.js` | efeitos e músicas sintetizados (WebAudio) |
| `src/js/enemies.js`, `stages.js` | inimigos, chefes intermediários e as ondas de cada fase |
| `src/js/bosses.js`, `lule.js` | os quatro chefões |
| `src/js/ui.js`, `src/css/ui.css` | telas no estilo urna eletrônica |
| `docs/ENGINE.md` | contrato técnico entre os módulos |

## Aviso

É um jogo de humor. Todos os personagens são caricaturas e qualquer semelhança com políticos reais é pura sátira. Ninguém morre: político derrotado é "cassado", vira santinho e foge. Vote consciente e guarde a nota fiscal.
