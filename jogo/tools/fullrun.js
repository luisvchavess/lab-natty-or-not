#!/usr/bin/env node
/* Partida completa automática: joga as 5 fases (piloto automático) e mede tempos.
   Rodoviária (Centrão) → Esplanada (Dilmãe) → Paranoá (Erika) → Fazenda (Taxad) → Planalto (Lule + Janjinha).
   node tools/fullrun.js [--page dev|index] [--god 1] [--ts 6] [--loop 1] [--timeout 1200] [--out DIR] [--shotsEvery 0]
                         [--quality high] [--press R] [--heat H] [--quinto 0|1] [--stage 0]
   Sem --god (--god 0), usa autocontinue (recontagens) para seguir adiante e conta mortes por fase.
   --quality high|mid|low|auto (padrão high: o sandbox rasteriza na CPU e o modo auto baixaria a resolução).
   --press R / --heat H: PRESSÃO fixa em R / calor inicial (URL press= / heat=).
   Luta secreta (LULE 5.0 — QUINTO MANDATO): começa sozinha quando a partida vem da fase 1 sem nenhum recurso
   (com --god 1 é o caso normal); --quinto 1 força (URL quinto=1), --quinto 0 só registra o que acontecer.
   O relatório traz, por fase, o tempo de fase, de chefão e as mortes/recursos; do Lule, as vidas (1, 2 e a 3ª
   secreta), a Janjinha (entrou, nocaute ou embarcou) e o run.secret final ('won' | 'lost' | null). */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const a = process.argv.slice(2), o = { page: 'dev', god: 1, ts: 6, loop: 1, timeout: 1200, out: '/tmp/fusca-fullrun', shotsEvery: 0, w: 390, h: 844, quality: 'high',
  press: '', heat: '', quinto: 0, stage: 0 };
for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = isNaN(+a[i + 1]) ? a[i + 1] : +a[i + 1];
(async () => {
  fs.mkdirSync(o.out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.stack || e.message));
  let q = `stage=${o.stage}&loop=${o.loop}&auto=1&ts=${o.ts}&skipui=1${o.god ? '&god=1' : '&autocontinue=1'}&quality=${o.quality}`;
  if (o.press !== '' && isFinite(+o.press)) q += '&press=' + o.press;
  if (o.heat !== '' && isFinite(+o.heat)) q += '&heat=' + o.heat;
  if (+o.quinto === 1) q += '&quinto=1';
  await page.goto('file://' + path.resolve(__dirname, '..', o.page + '.html') + '?' + q);
  // continues infinitos para medir o jogo inteiro sem god
  if (!o.god) await page.evaluate(() => { const f = () => { if (G.run) G.run.maxContinues = 999; }; setInterval(f, 200); });
  const t0 = Date.now();
  const timeline = [];
  let last = {}, shotN = 0, lastShot = 0, s = null;
  const stages = {}; // por fase: { id, t (tempo de fase), boss, bossFt, deaths, cont, phases }
  while (Date.now() - t0 < o.timeout * 1000) {
    s = await page.evaluate(() => {
      const g = G.game, b = g && g.boss, d = b && b.data, mj = b && b.mech && b.mech.janj;
      return { state: G.state, stage: g && g.stage && g.stage.id, idx: g ? g.stageIdx : null, nStages: G.Stages.list.length, gt: g ? +g.t.toFixed(1) : 0, boss: b ? b.state : null,
        bossId: b ? b.id : null, bossName: b ? b.name : null, ft: b ? +(b.ft || 0).toFixed(1) : 0, phase: b ? b.phase : null, life: d && d.life ? d.life : null, reviving: !!(d && d.reviving),
        janj: mj ? (mj.ko ? 'ko' : mj.left ? 'left' : mj.up ? 'up' : 'off') : null, hp: b ? +(b.hp / b.maxHp).toFixed(3) : null,
        lives: G.run && G.run.lives, cont: G.run && G.run.continues, deaths: G.save && G.save.counters ? G.save.counters.deaths || 0 : 0,
        eb: g ? g.eb.length : 0, en: g ? g.enemies.length : 0, errors: G.errors.length,
        score: G.run && G.run.score, pix: G.run && G.run.pix, level: G.run && G.run.level, weapon: G.run && G.run.weapon, rank: g && g.rank, quality: G.quality,
        R: G.press ? +G.press.R.toFixed(2) : null, plv: G.press ? G.press.lv : null, secret: G.run ? G.run.secret : null, mech: b && b.mech ? { ok: b.mech.ok, miss: b.mech.miss, stuns: b.mech.stuns, pav: b.mech.pav } : null };
    });
    const key = s.state + '|' + s.stage + '|' + s.boss + '|' + s.phase + '|' + s.life + '|' + s.reviving + '|' + s.janj + '|' + s.secret;
    if (key !== last.key) { const row = Object.assign({ real: ((Date.now() - t0) / 1000).toFixed(0) }, s); delete row.mech; timeline.push(row); last.key = key; }
    last.maxEb = Math.max(last.maxEb || 0, s.eb); last.maxEn = Math.max(last.maxEn || 0, s.en);
    if (s.idx != null) {
      const S = stages[s.idx] || (stages[s.idx] = { idx: s.idx, id: s.stage, t: 0, boss: null, bossFt: 0, deaths0: s.deaths, deaths: 0, cont0: s.cont, cont: 0, maxEb: 0, lives: [], janj: null, R: [], plvMax: 0, mech: null });
      S.t = Math.max(S.t, s.gt); S.deaths = s.deaths - S.deaths0; S.cont = s.cont - S.cont0; S.maxEb = Math.max(S.maxEb, s.eb);
      if (s.R != null) S.R.push(s.R); if (s.plv != null) S.plvMax = Math.max(S.plvMax, s.plv);
      if (s.bossId) { S.boss = s.bossId; if (s.boss === 'fight' || s.boss === 'dying') S.bossFt = Math.max(S.bossFt, s.ft); if (s.mech) S.mech = s.mech; }
      if (s.life && S.lives.indexOf(s.life) < 0) S.lives.push(s.life);
      if (s.janj && s.janj !== 'off') S.janj = s.janj === 'up' && S.janj ? S.janj : s.janj;
    }
    if (o.shotsEvery && Date.now() - lastShot > o.shotsEvery * 1000) { lastShot = Date.now(); await page.screenshot({ path: path.join(o.out, 'run-' + String(++shotN).padStart(3, '0') + '.png') }); }
    if (s.state === 'ending' || s.state === 'menu') break;
    await page.waitForTimeout(500);
  }
  if (s && s.state === 'ending') await page.screenshot({ path: path.join(o.out, 'ending.png') });
  const end = await page.evaluate(() => ({ errors: G.errors.slice(0, 30), secret: G.run ? G.run.secret : null, continues: G.run ? G.run.continues : null, startStage: G.run ? G.run.startStage : null,
    achievements: Object.keys((G.save && G.save.achievements) || {}), nStages: G.Stages.list.length, score: G.run && G.run.score, pix: G.run && G.run.pix }));
  const stageList = Object.keys(stages).sort((x, y) => x - y).map((k) => {
    const S = stages[k]; const Rm = S.R.length ? +(S.R.reduce((p, v) => p + v, 0) / S.R.length).toFixed(2) : null;
    return { idx: S.idx, id: S.id, t: S.t, boss: S.boss, bossFt: S.bossFt, deaths: S.deaths, cont: S.cont, maxEb: S.maxEb, R: Rm, plvMax: S.plvMax, mech: S.mech,
      lives: S.lives.length ? S.lives : undefined, janj: S.janj || undefined };
  });
  const lastRow = timeline.length ? timeline[timeline.length - 1] : null;
  const report = { q, finished: lastRow && lastRow.state, nStages: end.nStages, stagesPlayed: stageList.length, allStages: stageList.length >= end.nStages,
    secret: end.secret, quintoReached: end.secret === 'won' || end.secret === 'lost' || end.secret === 'on', oneCC: end.startStage === 0 && end.continues === 0,
    score: end.score, pix: end.pix, maxEnemyBullets: last.maxEb, maxEnemies: last.maxEn, stages: stageList,
    errors: end.errors, pageErrors: pageErrors.slice(0, 10), achievements: end.achievements, timeline };
  fs.writeFileSync(path.join(o.out, 'report.json'), JSON.stringify(report, null, 1));
  const short = Object.assign({}, report); delete short.timeline; delete short.achievements;
  console.log(JSON.stringify(short, null, 1));
  console.log('fase | chefão | t fase (s) | t chefão (s) | mortes | recursos | R méd | PRESSÃO máx | manha ok/miss/stuns | vidas | Janjinha');
  for (const S of stageList) console.log([S.idx + ' ' + S.id, S.boss || '-', S.t, S.bossFt, S.deaths, S.cont, S.R, S.plvMax, S.mech ? S.mech.ok + '/' + S.mech.miss + '/' + S.mech.stuns + (S.mech.pav != null ? ' pav ' + S.mech.pav : '') : '-',
    S.lives ? S.lives.join(',') : '-', S.janj || '-'].join(' | '));
  console.log('luta secreta (LULE 5.0): ' + (report.quintoReached ? end.secret : 'não') + ' | timeline completa em ' + path.join(o.out, 'report.json'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
