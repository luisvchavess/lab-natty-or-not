/* ============================================================
   FUSCA A JATO — main.js
   Inicializa o jogo quando as fontes carregam (ou depois de 0,6 s, com as fontes do sistema).
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
    // ok = false: o CSS das fontes ainda não chegou; espera o 'loadingdone' ou o tempo limite
    fontsReady.then((ok) => { if (ok) onFonts(); });
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
