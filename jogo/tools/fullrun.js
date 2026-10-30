#!/usr/bin/env node
/* Partida completa automática: joga todas as fases (piloto automático) e mede tempos.
   node tools/fullrun.js [--page dev|index] [--god 1] [--ts 6] [--loop 1] [--timeout 600] [--out DIR] [--shotsEvery 0] [--quality high]
   Sem --god (--god 0), usa autocontinue (recontagens) para seguir adiante e conta mortes por fase.
   --quality high|mid|low|auto (padrão high: o sandbox rasteriza na CPU e o modo auto baixaria a resolução). */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const a = process.argv.slice(2), o = { page: 'dev', god: 1, ts: 6, loop: 1, timeout: 600, out: '/tmp/fusca-fullrun', shotsEvery: 0, w: 390, h: 844, quality: 'high' };
for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = isNaN(+a[i + 1]) ? a[i + 1] : +a[i + 1];
(async () => {
  fs.mkdirSync(o.out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.stack || e.message));
  const q = `stage=0&loop=${o.loop}&auto=1&ts=${o.ts}&skipui=1${o.god ? '&god=1' : '&autocontinue=1'}&quality=${o.quality}`;
  await page.goto('file://' + path.resolve(__dirname, '..', o.page + '.html') + '?' + q);
  // continues infinitos para medir o jogo inteiro sem god
  if (!o.god) await page.evaluate(() => { const f = () => { if (G.run) G.run.maxContinues = 999; }; setInterval(f, 200); });
  const t0 = Date.now();
  const timeline = [];
  let last = {}, shotN = 0, lastShot = 0;
  while (Date.now() - t0 < o.timeout * 1000) {
    const s = await page.evaluate(() => {
      const g = G.game;
      return { state: G.state, stage: g && g.stage && g.stage.id, gt: g ? +g.t.toFixed(1) : 0, boss: g && g.boss ? g.boss.state : null,
        bossId: g && g.boss ? g.boss.id : null, ft: g && g.boss ? +(g.boss.ft || 0).toFixed(1) : 0, phase: g && g.boss ? g.boss.phase : null,
        lives: G.run && G.run.lives, cont: G.run && G.run.continues, eb: g ? g.eb.length : 0, en: g ? g.enemies.length : 0, errors: G.errors.length,
        score: G.run && G.run.score, pix: G.run && G.run.pix, level: G.run && G.run.level, weapon: G.run && G.run.weapon, rank: g && g.rank, quality: G.quality };
    });
    const key = s.state + '|' + s.stage + '|' + s.boss + '|' + s.phase;
    if (key !== last.key) { timeline.push(Object.assign({ real: ((Date.now() - t0) / 1000).toFixed(0) }, s)); last.key = key; }
    last.maxEb = Math.max(last.maxEb || 0, s.eb); last.maxEn = Math.max(last.maxEn || 0, s.en);
    if (o.shotsEvery && Date.now() - lastShot > o.shotsEvery * 1000) { lastShot = Date.now(); await page.screenshot({ path: path.join(o.out, 'run-' + String(++shotN).padStart(3, '0') + '.png') }); }
    if (s.state === 'ending' || s.state === 'menu') break;
    await page.waitForTimeout(500);
  }
  const errors = await page.evaluate(() => G.errors.slice(0, 30));
  const report = { q, finished: timeline.length && timeline[timeline.length - 1].state, maxEnemyBullets: last.maxEb, maxEnemies: last.maxEn, errors, pageErrors: pageErrors.slice(0, 10), timeline };
  fs.writeFileSync(path.join(o.out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ q, finished: timeline.length && timeline[timeline.length - 1].state, maxEnemyBullets: last.maxEb, maxEnemies: last.maxEn, errors, pageErrors: pageErrors.slice(0, 10), timeline }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
