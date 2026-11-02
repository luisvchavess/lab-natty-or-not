# Fusca a Jato: Guerra em Brasília

Shoot'em up vertical para celular, de paródia política. A eleição acabou, a picanha não chegou e o governo achou a solução de sempre: imposto novo. Zé Contribuinte, motorista de aplicativo, cansou de pagar a conta: instalou um motor a jato no Fusca 78 da Vó Dirce e voou até o Palácio do Planalto para entregar a fatura ao chefão de todos, **Lule**.

## Como jogar

- **Arraste o dedo em qualquer lugar** da tela: o Fusca acompanha o movimento do dedo, sem ficar escondido embaixo dele.
- **O tiro é automático.** O pontinho branco no meio do Fusca é o único lugar onde você leva dano.
- **Raspão:** passar bem perto dos tiros dá pontos, sobe a aprovação e carrega uma Delação extra.
- **Item P:** todo P deixa a arma mais forte (2, 3, 4 e 4 P para subir do nível 1 ao 5). Ele muda de cor a cada 3 segundos: a cor escolhe a arma. No nível máximo, cada P vale pontos, R$ 5 e mais PRESSÃO. Morreu? A arma perde um nível e a barra de força zera; o nível perdido cai na tela como um P "de volta": pegue antes que ele suma (7 segundos, pisca no fim).
  - **VOTO** (verde): tiro reto e forte; cada nível põe mais um tiro.
  - **BOCA DE URNA** (amarelo): leque largo com um feixe reto no meio que engrossa a cada nível.
  - **PANELAÇO** (prata): panelas teleguiadas.
  - **LAVA-JATO** (azul): jato d'água que atravessa tudo e acerta na hora.
- **Chefões:** cada um tem uma manha além do tiro: pegar a emenda (Centrão), ficar na meta (Dilmãe), cortar os fios da live (Erika), achar o cofre do seu dinheiro depois do embaralhado (Taxad) e o olé no Leão (Lule). Fazendo a manha, ele fica tonto e leva dano dobrado. Cada chefão tem cinco turnos, e o último é o **ÚLTIMO RECURSO**: desesperado, ele joga tudo.
- **PRESSÃO:** quanto mais forte e mais tempo vivo, mais PRESSÃO (de CALMARIA a CPI!, no medidor do alto da tela): tiros mais rápidos e mais densos, inimigos e chefões mais duros, mas pontos e Pix rendem mais e o chefão tonto leva ainda mais dano. Morrer ou usar a Delação alivia.
- **Delação Premiada** (botão redondo): um toque limpa os tiros da tela, transforma em Pix e acerta todo mundo. Se o dedão cair em cima do botão e arrastar, ele só volta a pilotar (não gasta a Delação).
- **Aprovação:** derrubar políticos em sequência sobe o multiplicador de votos (placar). Levar tiro derruba.
- **Pix:** o dinheiro que cai dos políticos fica com você entre partidas (é gravado também quando o app vai para o fundo). Gaste na **Lojinha do Zé** em melhorias permanentes (o Gatilho Turbinado, por exemplo, dá +10% de cadência por nível em todas as armas). O que você compra na parada entre fases já vale na partida em andamento.
- **Nota da fase:** S (sem morrer, no máximo 1 Delação), A (sem morrer, ou só 1 vida perdida com no máximo 1 Delação), B (poucas mortes; a régua sobe a cada fase) ou C. Nota boa paga mais Pix, as fases finais pagam mais e a PRESSÃO média multiplica o prêmio. Nota S com PRESSÃO alta ganha o **CARIMBO DE OURO** (Pix extra).
- **Vidas extras** aos 1,5 milhão, 4,5 milhões e 9 milhões de pontos.
- **Recurso:** perdeu todas as vidas? Entre com recurso e continue de onde parou (o placar zera e as vidas extras por pontos não se repetem). São 2 recursos por partida, +1 por nível dos Embargos de Declaração da Lojinha.
- **Pausa:** ao voltar, o jogo espera um segundo ("PRONTO? VAI!") para você pôr o dedo na tela. Com o celular deitado, o jogo fica pausado e pede para girar.

No computador: setas/WASD movem, Shift deixa lento, X ou espaço solta a Delação, P ou Esc pausa.

## Fases

1. **Rodoviária do Plano** — chefão: O Centrão
2. **Esplanada dos Ministérios** — chefona: Dilmãe
3. **Lago Paranoá** — chefona: Erika Viralton (com participação especial do Pavanatto, ao vivo)
4. **Ministério da Fazenda** — chefão: **Fernando Taxad, o Taxador-Geral**. O Impostômetro não para: Fiscais da Receita jogam a malha fina, maquininhas cobram taxinha de cada Pix e, no fim, ele esconde o seu dinheiro num de três cofres e embaralha. "CADÊ O SEU DINHEIRO?" Encoste o Fusca no cofre certo; errou, sobe a alíquota.
5. **Palácio do Planalto** — chefão final: Lule. Na segunda vida dele chega a **Janjinha, a Ministra Sem Pasta**, num sofá voador do Alvorada: enquanto ela está na luta, o Lule fica atrás do cordão do cerimonial. Tire ela da luta primeiro (ela embarca para o exterior).

Venceu? Libera o **2º Mandato**, uma volta mais difícil que paga mais Pix.

**Segredo:** vença a segunda vida do Lule sem ter entrado com nenhum recurso desde a fase 1 e ele volta mais uma vez: **LULE 5.0 — QUINTO MANDATO**.

**Mais exclusivo:** ISENTO! (vença o Taxad sem errar nenhum cofre), CARTÃO BLOQUEADO (faça o Leão morder o cartão corporativo), EMBARQUE IMEDIATO (tire a Janjinha da luta antes do voo dela), CARIMBO DE OURO, CPI! (vença um chefão com a PRESSÃO no máximo), SEM ARRANHÃO! (um chefão sem morrer) e o **Fusca Dourado**, para quem vence o mandato inteiro sem entrar com recurso.

## Rodando

O jogo é um único arquivo: abra `index.html` no navegador do celular ou do computador. Não precisa de servidor nem de internet (só as fontes vêm do Google Fonts, sem travar a abertura; sem elas o jogo usa fontes do sistema). Em celular mais fraco o jogo baixa a qualidade gráfica sozinho para não travar (e sobe de novo no começo de uma fase se a anterior rodou lisa).

Para desenvolver:

```bash
cd jogo
node build.js          # junta src/ em index.html e dist/artifact.html
# dev.html carrega os arquivos de src/ separados (bom para editar)
node tools/play.js --q "stage=0&god=1&auto=1&ts=4&skipui=1" --seconds 30 --shots 5   # teste automático com Chromium
node tools/fullrun.js --god 1 --ts 8                                                    # as 5 fases no piloto automático (e o LULE 5.0)
node tools/humanbot.js --profile casual --stage 0 --runs 3                              # bot "humano": mede a dificuldade
node tools/humanbot.js --mode ttk --bosses centrao,taxad --levels 5                     # tempo de chefão (PRESSÃO fixa em 0,75)
node tools/humanbot.js --mode ttk --bosses taxad --levels 3 --press 0.4 --mech 0        # sem fazer a manha
node tools/humanbot.js --profile good --stage 0 --through 1 --runs 8                    # mandato inteiro: withinLimit, oneCC, quinto
```

Estrutura:

| arquivo | conteúdo |
|---|---|
| `src/js/data.js` | história, diálogos, armas, itens, lojinha, conquistas |
| `src/js/core.js` | motor: loop, toque, tiros, colisões, jogador, chefões, roteiro das fases, HUD, save |
| `src/js/art.js` | Fusca, itens, ícones, ilustrações da história, retratos |
| `src/js/bg.js` | cenários de Brasília |
| `src/js/audio.js` | efeitos e músicas sintetizados (WebAudio) |
| `src/js/enemies.js`, `stages.js` | inimigos, chefes intermediários e as ondas das 5 fases |
| `src/js/bosses.js`, `erika.js`, `taxad.js`, `lule.js`, `janjinha.js` | os cinco chefões (Centrão e Dilmãe, Erika Viralton, Fernando Taxad, Lule) e a Janjinha |
| `src/js/ui.js`, `src/css/ui.css` | telas no estilo urna eletrônica |
| `docs/ENGINE.md` | contrato técnico entre os módulos |

## Aviso

É um jogo de humor. Todos os personagens são caricaturas e qualquer semelhança com políticos reais é pura sátira. Ninguém morre: político derrotado é "cassado", vira santinho e foge (o Taxad pega um táxi com a bandeira 2 ligada, a Janjinha embarca em missão oficial). Vote consciente e guarde a nota fiscal.
