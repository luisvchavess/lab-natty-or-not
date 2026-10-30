/* ============================================================
   FUSCA A JATO — main.js
   Inicializa o jogo depois que as fontes carregam (ou 1,5 s).
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  let started = false;
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
      ]).catch(() => null)
      : Promise.resolve();
    fontsReady.then(start);
    setTimeout(start, 1500);
  }
  // Atualizações ao vivo do visualizador de artifacts: o progresso fica no localStorage.
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    try { hot.snapshot(() => ({ v: 1 })); } catch (e) { /* nada */ }
  }
  const go = () => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', whenReady) : whenReady());
  if (hot && typeof hot.ready === 'function') { try { hot.ready(go); } catch (e) { go(); } } else go();
})();
