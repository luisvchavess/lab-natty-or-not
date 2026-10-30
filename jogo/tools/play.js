#!/usr/bin/env node
/* Testador automático (Playwright/Chromium).
   Abre o jogo num celular simulado, roda por N segundos e tira prints.
   Exemplos:
     node tools/play.js --q "stage=0&god=1&auto=1&ts=4&skipui=1" --seconds 30 --shots 6 --out /tmp/x
     node tools/play.js --page index --seconds 5 --shots 1            (tela de título)
     node tools/play.js --q "stage=3&boss=1&god=1&auto=1&ts=3&skipui=1" --eval "G.debug.hurtBoss(0.5)" --at 8
   Opções:
     --page dev|index      (padrão dev: carrega src/ separado)
     --q "..."             parâmetros de URL (stage, loop, boss, bossid, god, auto, ts, skipui, hitboxes, autocontinue, mods, quality)
                           quality=high é o padrão aqui (prints nítidos e iguais entre rodadas; o Chromium do sandbox
                           rasteriza na CPU e o modo automático baixaria a resolução). Use --q "...&quality=auto" para
                           testar o modo automático.
     --seconds N           quanto tempo rodar (tempo real)
     --shots N             quantos prints ao longo do tempo
     --out DIR             pasta dos prints (padrão /tmp/fusca-shots)
     --w 390 --h 844       tamanho da tela (CSS px)
     --dpr 2               devicePixelRatio
     --eval "js" --at S    executa JS na página no segundo S (pode repetir pares --eval/--at)
     --tap "x,y"           toque em coordenadas CSS ao carregar (repete)
   Saída: JSON com erros, estatísticas ao longo do tempo e caminhos dos prints. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = { page: 'dev', q: '', seconds: 10, shots: 3, out: '/tmp/fusca-shots', w: 390, h: 844, dpr: 2, evals: [], taps: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i], v = args[i + 1];
  if (a === '--eval') { opt.evals.push({ code: v, at: 0 }); i++; }
  else if (a === '--at') { if (opt.evals.length) opt.evals[opt.evals.length - 1].at = +v; i++; }
  else if (a === '--tap') { opt.taps.push(v.split(',').map(Number)); i++; }
  else if (a.startsWith('--')) { opt[a.slice(2)] = isNaN(+v) || v === '' ? v : +v; i++; }
}
(async () => {
  fs.mkdirSync(opt.out, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: opt.dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  // fontes do Google podem não carregar no sandbox; bloqueia para não atrasar
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + (e.stack || e.message)));
  const file = path.resolve(__dirname, '..', (opt.page === 'index' ? 'index' : 'dev') + '.html');
  let q = opt.q || '';
  if (!/(^|&)quality=/.test(q)) q += (q ? '&' : '') + 'quality=high';
  const url = 'file://' + file + '?' + q;
  await page.goto(url);
  await page.waitForTimeout(400);
  for (const [x, y] of opt.taps) { await page.touchscreen.tap(x, y); await page.waitForTimeout(250); }
  const shots = [], stats = [];
  const total = opt.seconds * 1000;
  const shotEvery = opt.shots > 0 ? total / opt.shots : Infinity;
  const evals = opt.evals.slice().sort((a, b) => a.at - b.at);
  let t = 0, nextShot = shotEvery, nextStat = 0, n = 0;
  while (t <= total) {
    while (evals.length && evals[0].at * 1000 <= t) {
      const ev = evals.shift();
      try { const r = await page.evaluate(ev.code); stats.push({ t: t / 1000, eval: ev.code, result: r === undefined ? null : r }); }
      catch (e) { consoleErrors.push('eval error: ' + e.message); }
    }
    if (t >= nextStat) {
      try { stats.push(Object.assign({ t: +(t / 1000).toFixed(1) }, await page.evaluate(() => (window.G && G.debug ? G.debug.stats() : { noG: true })))); } catch (e) { /* nada */ }
      nextStat += 2000;
    }
    if (t >= nextShot) {
      const p = path.join(opt.out, 'shot-' + String(++n).padStart(2, '0') + '.png');
      await page.screenshot({ path: p });
      shots.push(p);
      nextShot += shotEvery;
    }
    await page.waitForTimeout(250);
    t += 250;
  }
  let gErrors = [];
  try { gErrors = await page.evaluate(() => (window.G ? G.errors.slice() : ['G ausente'])); } catch (e) { gErrors = ['erro lendo G.errors: ' + e.message]; }
  console.log(JSON.stringify({ url, gErrors, consoleErrors: consoleErrors.slice(0, 40), stats, shots }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
