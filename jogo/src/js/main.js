/* ============================================================
   FUSCA A JATO — main.js
   Inicializa o jogo quando as fontes carregam (ou depois de 0,6 s, com as fontes do sistema;
   na hora, se o CSS das fontes já falhou ou foi bloqueado).
   O CSS das fontes do Google não bloqueia mais a página (shell.html injeta o <link>);
   se elas chegarem depois do boot, G.fontsReady() avisa os módulos para redesenhar o que
   tinha texto guardado em cache.
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  let started = false, fontsOk = false, notified = false;
  function notifyFonts() {
    if (!started || !fontsOk || notified) return;
    notified = true;
    try { if (G.fontsReady) G.fontsReady(); } catch (err) { G.reportError(err, 'fontsReady'); }
  }
  function start() {
    if (started) return;
    started = true;
    try { G.boot(); } catch (err) { G.reportError(err, 'boot'); }
  }
  // As fontes da web já falharam? (Google Fonts bloqueado no iframe do artifact, sem rede, CSS
  // vazio, arquivos .woff2 recusados.) Então não há o que esperar: o jogo começa na hora com as
  // fontes do sistema, sem gastar os 0,6 s do tempo limite.
  // Sinais: o <link> do CSS já terminou (link.sheet existe, com erro ou não) e nenhuma @font-face
  // do Bungee chegou; o 'error' do <link>; ou todas as faces do Bungee deram erro. (O CSS é de
  // outra origem: as regras não podem ser lidas, e o responseStatus do Resource Timing é 0 mesmo
  // quando dá certo; a entrada aparece antes de o CSS ser lido, então ela sozinha não basta.)
  const fontLink = () => { try { return document.querySelector('link[rel=stylesheet][href*="fonts.googleapis"]'); } catch (e) { return null; } };
  function bungeeFaces() {
    const out = [];
    try { document.fonts.forEach((f) => { if (/bungee/i.test(f.family)) out.push(f.status); }); } catch (e) { return null; }
    return out;
  }
  function fontsFailed() {
    const faces = bungeeFaces();
    if (!faces) return false; // sem FontFaceSet: fica no tempo limite
    if (faces.length) return faces.every((s) => s === 'error');
    const l = fontLink();
    return !l || !!l.sheet; // sem <link> (nada a esperar) ou CSS já terminado sem @font-face
  }
  function whenReady() {
    const fontsReady = document.fonts && document.fonts.load
      ? Promise.all([
        document.fonts.load('20px "Bungee"'),
        document.fonts.load('700 14px "Barlow Semi Condensed"'),
        document.fonts.load('400 14px "Barlow Semi Condensed"'),
      ]).then((r) => r.every((list) => list && list.length > 0)).catch(() => false)
      : Promise.resolve(false);
    const onFonts = () => {
      fontsOk = true;
      if (!started) { start(); notified = true; } // já começou com as fontes certas
      else notifyFonts(); // chegaram depois do boot
    };
    const ifFailed = () => { if (!started && fontsFailed()) start(); };
    ifFailed();
    // ok = false: o CSS das fontes ainda não chegou (espera o 'loadingdone' ou o tempo limite) ou já falhou
    fontsReady.then((ok) => { if (ok) onFonts(); else ifFailed(); });
    const l = fontLink();
    if (l) {
      l.addEventListener('error', () => { if (!started) start(); }, { once: true });
      l.addEventListener('load', ifFailed, { once: true }); // CSS chegou vazio (sem @font-face)
    }
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingerror', ifFailed);
    setTimeout(start, 600);
    // o CSS das fontes pode chegar bem depois (rede lenta): quando as fontes terminarem, avisa
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', () => {
        try { if (document.fonts.check('20px "Bungee"') && document.fonts.check('700 14px "Barlow Semi Condensed"')) onFonts(); } catch (e) { /* nada */ }
      });
    }
  }
  // Atualizações ao vivo do visualizador de artifacts: o progresso fica no localStorage.
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    try { hot.snapshot(() => ({ v: 1 })); } catch (e) { /* nada */ }
  }
  const go = () => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', whenReady) : whenReady());
  if (hot && typeof hot.ready === 'function') { try { hot.ready(go); } catch (e) { go(); } } else go();
})();
