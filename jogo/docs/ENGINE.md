# Fusca a Jato — engine contract (for module authors)

Vertical shoot'em up for phones. Plain JavaScript, canvas 2D, no libraries, no build tooling beyond `node build.js`
(which inlines everything into one HTML). All game text is **Brazilian Portuguese**.

## 1. Files, ownership, load order

Load order (see `build.js`): `data.js → core.js → art.js → bg.js → audio.js → enemies.js → stages.js → bosses.js → erika.js → taxad.js → lule.js → janjinha.js → ui.js → main.js`.
CSS: `src/css/base.css` (core) then `src/css/ui.css` (UI module).

| file | owner | what |
|---|---|---|
| `src/js/data.js` | core (read-only for you) | weapons, pickups, upgrades, achievements, cast, story/dialogue text, credits |
| `src/js/core.js` | core (read-only for you) | loop, input, entities, bullets, collisions, player, pickups, boss framework, stage runner, HUD, save, flow, debug |
| `src/js/art.js` | **art** | player Fusca, pickups, HUD icons, story scene illustrations, title key art, Zé/Vó/Rádio portraits, upgrade of `G.Art.person` |
| `src/js/bg.js` | **bg** | scrolling backgrounds per stage + menu |
| `src/js/audio.js` | **audio** | WebAudio synth: all SFX + procedural music |
| `src/js/enemies.js` | **enemies** | every regular enemy + 5 mid-bosses |
| `src/js/stages.js` | **enemies** | the 5 stage definitions and wave scripts |
| `src/js/bosses.js` | **bosses** | bosses `centrao`, `dilmae` (+ G.BossKit, portraits, bs_ styles) |
| `src/js/erika.js` | **erika** | boss `erika` (+ portrait & erk_ bullet styles) |
| `src/js/taxad.js` | **taxad** | boss `taxad` (+ portrait & tx_ bullet styles); requires `G.BossKit` |
| `src/js/lule.js` | **lule** | final boss `lule` (+ portrait & bullet styles, LULE 5.0) |
| `src/js/janjinha.js` | **janjinha** | the co-boss `janjinha` of Lule's 2nd life (enemy kind, `G.Janjinha` API, jan_ styles); never requires `G.BossKit` |
| `src/js/ui.js`, `src/css/ui.css` | **ui** | every DOM screen: title/menu, story, dialogue, stage intro, results, shop, game over, pause, ending, settings, achievements, toasts |

**Never edit a file you do not own.** If you need something from core, work around it inside your own file
(wrap/extend, never monkey-patch core internals) and list it under `core_requests` in your final report.
A syntax error in your file only disables your module (separate `<script>` tags in dev), but keep it clean.

## 2. Coordinates, time, units

- Logical canvas: `G.W = 360` wide, `G.H` = 600..780 tall (depends on phone aspect; read `G.H` every frame, never cache it).
- Origin top-left, y grows down. Angles in radians: `0` = right, `Math.PI/2` = **down** (toward the player), `-Math.PI/2` = up.
- Speeds in px/s, time in seconds. Fixed step `G.DT = 1/60`.
- The player lives in the bottom area (~`G.H*0.8`). Bosses sit near the top (`homeY` ≈ 130–170). HUD occupies y 0–48 (top; the band also carries the PRESSÃO label and 5 pips at x W−86…W−50, baseline y 45) and the bottom-left corner (weapon), plus a 74 px round bomb button bottom-right. Keep important things out of y<50.
  The bomb button fires on a quick tap (or at once when another finger is already steering); a touch that lands on it and drags
  or holds becomes steering. Both the button and the weapon label fade when the car passes under them.

## 3. Globals you can use

```js
G.m            // math: clamp, lerp, dist, dist2, angle, rand, randi, pick, chance, sign, approach, wrapAngle,
               //       easeOutCubic, easeInCubic, easeInOutSine, easeOutBack, segDist2
G.TAU, G.C     // G.C = palette { green, greenL, yellow, blue, blueL, red, white, ink, pix, paper, orange, pink, purple, gray }
G.FONT_DISPLAY // '"Bungee", ...'  (loud headings, numbers)
G.FONT_BODY    // '"Barlow Semi Condensed", ...' (dialogue, labels; use weight 700/800 on canvas)
G.game         // current stage state (see §6) or null
G.run          // current run: { loop, score, lives, bombs, weapon, level, pix, grazes, continues, maxContinues, startStage,
               //   heat (PRESSÃO heat, §9.1), gold (Carimbos de Ouro this run), secret (null | 'on' | 'won' | 'lost': the
               //   LULE 5.0 fight, set by lule.js), ... }   maxContinues = 2 + G.upg('recurso')
G.save         // persisted: { saveV (5), pix, upgrades, unlocked (stages 1..5), best, cleared, cleared2, seenIntro, qualityTier,
               //              achievements, counters, settings{music,sfx,sens,vibrate,shake,hitbox,quality,skin ('azul'|'ouro')} }
               // loadSave migrates a 4-stage save (saveV < 5): the Fazenda is inserted before the Planalto, nobody loses a stage
G.saveGame()   // persist G.save (localStorage, wrapped in try/catch)
G.state        // 'menu'|'intro'|'play'|'dialogue'|'pause'|'clear'|'over'|'ending'
G.fmt(n)       // 1234567 -> "1.234.567"     G.fmtMoney(n) -> "R$ 1.234"
G.call(obj, 'method', ...args)  // safe call (errors are logged into G.errors, never thrown). No allocation for ≤ 6 args.
G.errors, G.errorCount          // the last 50 error messages ('[bg.draw] ...', '[enemy:cabo.update] ...') / count of ALL errors
G.quality      // 'high' | 'mid' | 'low' — current graphics tier (read it while drawing, see §10)
G.setQuality(q)// 'auto' | 'high' | 'mid' | 'low' (UI setting "Qualidade"). Persists in G.save.settings.quality.
G.bossBoxes(b) // b.hitboxes, or a reused default [{dx:0,dy:0,r:b.r}] (never allocate one per bullet)
G.rankFor(hits, bombs, stageIdx)  // stage rank 'S'|'A'|'B'|'C' (see §9); ui.js builds its boletim tips from it
G.powerNeed(lv)                   // how many P items to go from level lv to lv+1 (2, 3, 4, 4: 13 P to reach L5)
G.fontsReady() // main.js calls it if the web fonts arrive after boot; core then calls the OPTIONAL hooks
               // G.BG.fontsReady(), G.Art.fontsReady(), G.UI.fontsReady() so text baked into caches can be redrawn
               // (all three are implemented: bg rebuilds its billboards, ui re-runs the fit-to-width of the open screen)
G.coreHooks    // { autoGoal, hudTag, drawOver, mech, postLines, press, lastPhase, defeatText } (all true), set once at core
               // load: feature-detect the boss-mechanic hooks of §5.1 (a boss module draws its own overlay when drawOver is
               // missing), g.postLines (§5), PRESSÃO (§9.1), the `last: true` phase banner and b.defeatText (§5)
G.debug.noMech // true with the URL param mech=0: the autopilot ignores b.autoGoal (A/B the "ignore the mechanic" path)
G.debug.mech() // g.boss ? { id, state, phase, goal: b.autoGoal, mech: b.mech, hudTag: b.hudTag, stunT } : null
               // (G.debug.stats() also carries `mech` and `press`)
G.PRESS        // PRESSÃO constants (§9.1; the balance block of core.js). Replace it whole to tune: missing keys fall back
G.press        // { R 0..1, lv 0..5, name, color, tgt }: ONE reused object, updated every play frame. Modules read it
               //   with a default: `G.press || { R: 0, lv: 0 }` (BossKit `press()` does that)
G.pressK(k)    // 1 + k × G.press.R
G.debug.press()// { R, lv, name, heat, tgt, avg }   (avg = time-average R of the stage: g.pressSum / g.pressT)
G.debug.pressFix / heat0 / forceQuinto   // URL press=R (R pinned) / heat=H (initial run.heat) / quinto=1 (§11)
G.quintoOk()   // true when the run started at stage 1 and never used a recurso (or URL quinto=1): lule.js asks it
               //   before LULE 5.0 — QUINTO MANDATO (§8)
G.EnemyArt.lion(ctx, x, y, o)     // the Leão da Receita drawing (enemies.js), o: { t, flash, sx, sy, pounce, bristle,
                                  //   eyesRed, lookX, mouth }; lule.js draws its Leão with it (local fallback if missing)
G.EnemyArt.taxBite(x, y)          // -> stolen. The lion's bite on Zé's Pix: steal = clamp(round(g.pixStage × 0.15), 5, 40),
                                  //   at most run.pix, taken from run.pix and from the uncommitted g.pixStage; text
                                  //   'MORDIDA DO LEÃO -R$ n' (or 'MORDIDA DO LEÃO: ISENTO!'), burst, shake, sfx 'bite'.
                                  //   Never costs a life. The stage enemy 'leao' and Lule's Leão both call it.
G.EnemyArt.prewarm([kinds])       // queues the cached sprites of those enemy kinds ahead of time (repeat calls are free;
                                  //   knows every kind, fiscal / maquininha / impostometro included)
```

### Spawning & bullets
```js
G.spawnEnemy(kind, x, y, opts)       // -> enemy (see §4). opts.hp/r/score/pix/drop/vx/vy/big override the def.
                                      //   PRESSÃO: hp ×(1 + 0,35 R) (big ×(1 + 0,5 R)) unless opts.noPress / def.noPress
G.fire(x, y, ang, spd, o)             // enemy bullet. o: { style, color, r, accel, minSpd, maxSpd, turn (rad/s),
                                      //   ax, ay (px/s²), life (s), delay (s, frozen+harmless+translucent),
                                      //   spin (rad/s, sprite spin), update(b, dt, g), data, keep (survive offscreen),
                                      //   noPress (PRESSÃO does not speed it up: timed walls whose fairness is the spacing) }
                                      // speeds are auto-multiplied by g.diff (1.15 on 2nd loop), then by PRESSÃO
                                      //   ×(1 + 0,22 R), never past 250 px/s (a bullet already ≥ 250 is untouched);
                                      //   lasers are never affected. K.shoot and G.pat.* pass `noPress` through
G.aim(x, y)                           // angle from (x,y) to the player
G.pat.ring(x, y, n, spd, o, offAngle)
G.pat.fan(x, y, ang, n, spread, spd, o)
G.pat.aimed(x, y, spd, o, offset)
G.pat.aimedFan(x, y, n, spread, spd, o)
G.pat.stream(x, y, ang, n, spd0, spd1, o)
G.laser({ x, y, ang, len, width, warn, life, color, sweep, owner, ox, oy, update(l, dt, g) })
                                      // telegraphed laser: dashed warning line for `warn` s, then deadly beam for `life` s.
                                      // owner: entity it follows (x = owner.x + ox ...). Collides as a segment.
G.clearBullets(toPix)                 // cancel all enemy bullets (optionally into Pix coins)
G.BulletStyles.define(name, { r, size, rotate, spin, paint(ctx, size, color) })
                                      // sprites are pre-rendered once per (style,color) – paint may use shadowBlur.
                                      // paint draws centered at (0,0) within a size×size box.
                                      // built-in styles: orb, small, big, needle, rice, star, bill, santinho, coin
                                      // Use unique prefixes for your own styles: 'boss_picanha', 'en_maleta', ...
```
Bullet colors: enemy bullets must read clearly against the background and against player shots
(player shots are green/yellow/silver/cyan and translucent). Prefer saturated pink/red/orange/magenta/white cores.

### Items, score, effects
```js
G.drop(type, x, y, o)     // type: pix|pix5|mala|power|bomb|shield|life|cafe ; o: {vx, vy, magnet, wtype, cycle, restore}
                          //   power + restore:true = the level lost on death (gives +1 level directly, any colour);
                          //   it lasts 7 s (it.life) and blinks for its last 2 s
G.dropPix(x, y, amount, o)// spreads coins worth `amount` reais; PRESSÃO ×(1 + 0,6 R) (stochastic rounding) unless o.noPress
G.addScore(base, x, y, showText)   // base × approval multiplier × (1 + R) (PRESSÃO pays back; the HUD shows the product)
G.addApproval(v)
G.part({x,y,vx,vy,life,size,color,type:'dot'|'spark'|'ring'|'flash'|'smoke'|'paper',drag,grav,rot,vr})
G.burst(x, y, n, {colors, speed, speedMin, size, life, type, angle, spread, grav, drag})
G.explode(x, y, size 1..4, {colors, ring, confetti})
G.confetti(x, y, n)       // flying santinhos/bills – the visual signature of a politician being "cassado"
G.text(x, y, str, {color, size, life, vy, font, stroke})   // x is clamped so the whole text stays on screen
G.shake(mag) G.flash(alpha, color) G.hitstop(seconds)
G.banner(title, sub, {dur, color, small})
G.say(entity, 'Companheiro!', dur)  // speech bubble drawn above the entity (enemy or boss). Short lines (≤ 28 chars)!
G.count(counterName, n)  G.unlock(achievementId)    // e.g. G.count('rachadinha') – see data.js ACHIEVEMENTS
G.isFlash(entity)          // true while it should be drawn white (hit flash). Pass as `flash` to G.Art.person.
                           // Core sets it on hit: small enemies 0.05 s at most every 0.13 s; `big` enemies and bosses
                           // 0.034 s (2–3 frames) at most every 0.35 s (≤ 3 white flashes per second on big sprites).
```

### Audio (implemented by audio.js; safe to call from anywhere through `G.call(G.Audio,'sfx',name)` or directly)
`G.Audio.init()`, `unlock()` (called on first touch), `sfx(name)`, `music(name)`, `stopMusic()`,
`setMusicOn(bool)`, `setSfxOn(bool)`. Unknown names must be ignored silently.
- SFX names the core uses: `shot_voto shot_boca shot_panela shot_jato hit tink pan_hit graze explode_s explode_m explode_l
  player_die shield_break bomb denied pix pix_big powerup item extend warning phase boss_down laser_warn laser pause buy achievement`.
- SFX names for other modules (implement all): `enemy_shot enemy_shot2 split ghost dash bite siren motor splash wind
  stamp laugh shout boss_hit charge whoosh spawn ui_click ui_back ui_confirm ui_type urna_fim`.
- Round 5 SFX: `cofre` (low thump + short metal noise, Taxad's safes), `caixa` (cash-register bell + coin jingle), `swap`
  (soft swish; optional pitch 0..1 rising per swap), `rocket` (noise sweep + rumble), `bleep` (the TV censor beep),
  `press_up` (PRESSÃO level up), `last_stand` (the ÚLTIMO RECURSO stab, priority 4).
- Boss-mechanic SFX (§5.1): `snap` (a live cable is cut: short noise burst + bright pluck, 0,15 s), `roar` (the Leão:
  low saw growl 90→60 Hz + noise, 0,5 s), `meta` (a META ring appears: two sines 880/1320 Hz, 0,25 s), `mech_ok` (stun
  reward: rising 3-note arpeggio + coin, 0,5 s, priority 4), `buffer` (the live drops: sad descending 3 blips, 0,4 s).
  Unknown names are ignored, so a boss may call them before audio.js has them.
- Music names: `menu story stage1 stage2 stage3 fazenda stage4 boss boss_final clear gameover victory` (`fazenda` =
  "funk de repartição", stage 4; `music()` falls back `fazenda → stage2` if the song is missing). Every stage sets `music`.

### Art (implemented by art.js; core has simple fallbacks with the same signatures)
```js
G.Art.person(ctx, x, y, size, spec, o)   // shared caricature ("cabeção" chibi) – see §8. size = total height in px.
G.Art.col(color, o)                      // returns '#fff' when o.flash, else color
G.Art.player(ctx, x, y, o)               // o: {t, tilt -1..1, shield, weapon, level, cafe, bomb}
G.Art.pickup(ctx, type, x, y, t, item)   // item.wtype for 'power'
G.Art.lifeIcon(ctx, x, y, s) / bombIcon(ctx, x, y, s) / weaponIcon(ctx, wtype, x, y, s)
G.Art.scene(ctx, sceneId, w, h, t)       // story panel illustration: urna|briga|brasilia|ze|fusca|planalto
G.Art.titleArt(ctx, w, h, t)             // optional title key art (UI may use it)
G.Portraits.define(id, fn(ctx, x, y, size, o))  // portrait bust for dialogue, centered, size×size box, o: {t, mood, mouth}
G.drawPortrait(ctx, id, x, y, size, o)          // what UI calls
G.Art.cacheStats()                       // { sprites, pixels, pending, warmQueue, warmQueue2, items, specs, exact, stale, stalePixels, framed } (tests/profiling; stale = sprites of the previous canvas resolution still drawn scaled, framed = sprites painted inside frames)
G.Art._exact(bool)                       // TEST ONLY: A/B switch for the exact-copy sprite path
```

### UI (implemented by ui.js) – the core calls these
`G.UI.title()`, `story(panels, done)`, `stageIntro(info, done)`, `dialogue(lines, done)`, `stageClear(stats, done)`,
`shop(opts, done)`, `gameOver(info, {onContinue, onQuit})`, `pause({onResume, onQuit})`, `hidePause()`,
`ending(info, done)`, `toast({title, text, kind})`. Flow functions UI calls: `G.startRun(stageIdx, loop)`, `G.toMenu()`,
`G.resume()`, `G.buyUpgrade(id)`, `G.upgradeCost(id)`, `G.upg(id)`, `G.resetSave()`, `G.setQuality(q)`.
- `G.startRun(0, 1)` plays the 6-panel intro story only while `G.save.seenIntro` is false. To rewatch it, the UI calls
  `G.UI.story(G.STORY.intro, done)` itself: `G.UI.show('story')` does that (also offered in CRÉDITOS → HISTÓRIA).
- `G.resetSave()` (APAGAR PROGRESSO) also puts the quality back to `auto` from `high` and restarts the auto meter.
- `G.buyUpgrade(id)` during the between-stages shop (`G.state === 'clear'`) also applies vida/bomba/arma/recurso to the
  current run (`recurso`: +1 `run.maxContinues`).
- `stageClear(stats)`: `stats` also carries `press { avg, lv, name, color, mul }` (the boletim's `'PRESSÃO MÉDIA'`), `gold`,
  `goldPix` (CARIMBO DE OURO) and `continued` (`'COM RECURSO'`). `ending(info)`: `{ loop, score, best, oneCC, secret }` —
  `secret === 'won'` inserts `G.STORY.endingQuinto` before the last panel, `oneCC` shows a `'SEM RECURSO!'` stamp.
- The FUSCA DOURADO skin (`G.save.settings.skin === 'ouro'`, only once `G.save.achievements.transito`) is an AJUSTES toggle;
  `G.Art.player` keys its sprite cache by skin.
- `G.resume()` freezes the world for 1 s ("PRONTO? VAI!", `G.game.resumeT`) so the thumb can get back to the screen.
- UI keys and 'toque para continuar' areas act on pointerup (moved < 14 px, < 500 ms), so a second finger works while the
  thumb steers; the click that follows a normal tap is swallowed (same pointerId or within 24 px, 600 ms). Keyboard and
  mouse still go through click. Achievement toasts on the pause and boletim screens sit next to the key row, one at a time.
- The core toggles `body.rotate-hint` when a touch device is in landscape (base.css shows the hint). While a phone
  (viewport height < 560) is sideways, `'play'` is never kept: the core pauses as soon as it sees it (turning during play,
  or a stage starting under the hint after the auto-advancing stage card). The pause screen waits under the hint.

### Background (implemented by bg.js)
`G.BG.draw(ctx, id, scrollY, t, W, H)` must paint the **entire** canvas every frame. ids: `menu rodoviaria esplanada paranoa fazenda planalto`.
If it throws, the core unwinds the ctx (`restore()` until the save stack is empty) and paints a flat `#0d1b3d` fill for
**that frame only**; the next frame calls `draw` again as usual.
- Optional `G.BG.landmark(id, g)`: stages.js calls it (through `G.call`) at the moment a mid-stage postcard must scroll in
  (`'itamaraty'` on the Esplanada, `'jk'` on the Paranoá, `'impostometro'` on the Fazenda), together with setting
  `g.landmark = id`. The Fazenda's landmark is the Impostômetro LED board (it may show `0` after `g.impZero`, set when
  the mid-boss O IMPOSTÔMETRO is beaten); its boss park is the Ministério block (`'fazenda'`).
- Mid-stage landmark order in bg.js: `g.landmark` / `G.BG.landmark` first; else `g.progress ≥ prog` (Esplanada 0.75,
  Paranoá 0.45, Fazenda 0.55); else the scroll distance when the stage sends no signal; and if the boss comes first, the
  landmark is inserted during the boss warning/entrance.

## 4. Enemies

```js
G.Enemies.define('cabo', {
  hp: 4, r: 13, score: 120, pix: 2,          // defaults (opts can override)
  big: false,                                 // big = mid-boss style death ("CASSADO!" text, big explosion)
  harmless: false, keepOffscreen: false, ignoreClear: false,
  noPress: false,                             // true = PRESSÃO never raises its HP (boss sub-entities)
  init(e, opts, g) {},                        // e.data is yours
  update(e, dt, g) {},                        // YOU move it (e.x/e.y). If omitted, x += vx*dt, y += vy*dt
  draw(ctx, e, g) {},                         // draw centered at e.x, e.y. Use G.isFlash(e) for hit flash.
  onHit(e, dmg, g) {}, onDeath(e, g, opts) {}
});
```
Enemy fields: `x y vx vy r hp maxHp t flash dead score pix drop big data invuln shieldT harmless o (spawn opts)`.
- `e.invuln = true` → shots pass through (ghost phase). `e.shieldT = 0.2` → takes 25% damage + yellow ring (set every frame to keep it).
- Core removes enemies that leave the screen (after 1.5 s alive) unless `keepOffscreen`.
- Contact with the player hurts the player (unless `harmless`).
- Kill rewards (score, pix coins, approval, explosion, `drop` items) are automatic. `opts.drop = 'power'` makes a carrier.
- PRESSÃO (§9.1) raises regular enemies' HP ×(1 + 0,35 R) and `big` ones ×(1 + 0,5 R) on top of the stage scale. Boss
  sub-entities set `def.noPress = true`: `bs_apoio` (bosses.js), `lule_companheiro` (lule.js), `janjinha` (janjinha.js),
  `mb_hit` (enemies.js). enemies.js also scales fire rate, fan density and (lv ≥ 3) a generic revenge bullet by PRESSÃO.

## 5. Bosses

```js
G.Bosses.define('dilmae', {
  name: 'DILMÃE', title: 'A Estocadora de Vento', hp: 6000, r: 40, homeY: 168, spdK: 1.12, fatStart: 155,
  score: 160000, pix: 150, music: 'boss', defeatText: 'IMPEACHMENT!',
  phases: [ { at: 1, name: 'Saudação à Mandioca' }, { at: 0.76, name: 'Vento Estocado' }, { at: 0.52, name: 'Meta Dobrada' },
            { at: 0.30, name: 'Pedalada Fiscal' }, { at: 0.13, name: 'Meta Infinita', last: true } ],
  init(b, g) {}, start(b, g) {},             // start = after the pre-fight dialogue, fight begins
  update(b, dt, g) {},                        // only during 'fight'. b.ft = fight time. Move b.x/b.y yourself.
  onPhase(b, idx, g) {},                      // core already cleared bullets, gave 1 s invuln and showed a banner
  onHit(b, dmg, g) {}, onDefeat(b, g) { return false },  // return true to cancel defeat (e.g. revive)
  onDeath(b, g) {},
  draw(ctx, b, g) {},                         // called in every visible state (enter/talk/fight/dying/leaving)
  drawOver(ctx, b, g) {},                     // optional, over bullets and lasers (§5.1): rings, labels, aim lines
});
```
Boss fields: `x y homeX homeY r hitboxes([{dx,dy,r}] optional) hp maxHp t ft state('warning'|'enter'|'talk'|'fight'|'dying'|'leaving')
flash invuln invulnT phase phases dmgMul data mood mouth sayText bubbleY autoGoal hudTag mech` (the last three start `null`;
see §5.1).
- Core: warning banner → slides boss from y=-160 to homeY → pre-fight dialogue from `G.STORY.boss[id].pre` → `start()` → `update()`.
- Phase = highest index whose `at` ≥ current hp fraction (list `at` in descending order). HP bar shows phase ticks.
- On death core does the explosion sequence, the "CASSADO!" stamp (`defeatText`, auto-scaled to fit the screen), drops Pix, unlocks the achievement with the boss id, then the boss flies away.
- Phase change banner: `"2º TURNO"`, `"3º TURNO"`… + the phase name (stages are called "FASE", so phases are "turnos").
  Lule's 2nd life starts with the banner `"NOVO MANDATO"` + its first phase name; after that the core numbers its phases
  `"2º TURNO"`, `"3º TURNO"` again (new mandate, new count).
- **The desperation turno**: every boss has 5 turnos (Lule 5 + 4, plus the secret 1), the last one with `last: true`.
  For it the core shows `G.banner('ÚLTIMO RECURSO', ph.name, { color: G.C.red, dur: 2.0, small: true })` + sfx
  `'last_stand'` instead of `'Nº TURNO'`; the module calls `K.lastStand(b)` in `onPhase` (lule.js: its own copy) and sets
  its next mechanic object to ≤ 1,5 s. After 30 s in it (`P5.LIMIT`) the damage taken is ×1,5 (`'SEM SAÍDA ×1,5'`).
  Every phase change also adds PRESSÃO heat (`HEAT_PHASE`).
- `b.defeatText` (set by the module, e.g. `'SEM QUINTO MANDATO!'`) beats `def.defeatText` beats `'CASSADO!'` for the stamp.
- `G.game.postLines` (set by a boss module in `onDeath`) replaces `G.STORY.boss[id].post` at stage clear (Taxad's ISENTO!,
  Lule 5.0).
- `g.bossHits`: real deaths (not shield breaks) during the current boss fight. 0 at the boss's death → **SEM ARRANHÃO!**
  (+100.000 × mult, R$ 100). A boss beaten while PRESSÃO is CPI! unlocks `'cpi'`. Boss HP is latched at spawn with
  PRESSÃO: `def.hp × (loop > 1 ? 1,25 : 1) × (0,80 + 0,27 R)` (×1,00 at R = 0,75; `b.press0` = that R).
- `G.bomb()` is refused (sfx `denied`, no bomb spent) while the boss is `dying`/`leaving`, after the stage script ended,
  and during a cinematic where the boss is in `fight` with `b.invuln && b.harmless` (or `b.data.reviving`), e.g. Lule's revival.
- `G.setBossPhases(b, phases, hpFrac)` replaces phases and sets hp (for revivals). `b.dmgMul` = armor. `b.invuln` for invulnerable moments (shots "tink").
- Player damage reference, single target from the bottom of the screen (dps, L1–L5): VOTO 22/33/44/56/67 (every level adds
  one straight shot; L4–L5 add an angled pair for waves); BOCA DE URNA 25/34/43/52/61 (a straight centre stream of 2–6 shots
  + a fan of 0.7 pellets for crowds, 28°/46°/46°/66°/84°); PANELAÇO 18/29/35/60/74 homing; LAVA-JATO beam 26/38/50/62/74
  (`14 + 12 × level`, no travel time; pierces the column: the nearest target takes full damage, the ones behind 60%,
  `big` enemies always full). Bomb = 4.5% boss hp (max 220). `G.upg('turbo')` adds +10% fire rate per level for every
  weapon (interval ÷ (1 + 0.1 × level); the beam's dps × the same factor), cafezinho ×1.5.
- Lule (final boss): HP 7200 (1st life) + 5200 (2nd life) + 3200 (LULE 5.0, the secret 3rd life) (`HP1`/`HP2`/`HP3` in
  lule.js). Anti-stalemate fatigue per life: starts at `FAT1` 140 s / `FAT2` 170 s (from the start of life 2) / `FAT3` 60 s
  and ramps to ×1,75 damage taken over `FAT_RAMP` 90 s. In the Companheirada phase each companheiro the player knocks
  down passes 11 HP to Lule (G.hitBoss, so fatigue applies). The other bosses also tire after a long fight (bosses.js
  `fatigue()`, from `def.fatStart`, `FAT_FULL` 90 s to the maximum `FAT_MAX` 0,75, i.e. ×1,75). Bosses with costly vector
  bodies (Centrão) paint their sprites ahead of time in small slices during the warning/entrance and the previous turn;
  never build a big offscreen canvas in the frame that first draws it.

### 5.1 Boss mechanics ("cada chefão tem uma manha")

Every boss has one verb beyond shooting. Doing it **stuns** the boss (it takes much more damage for a few seconds);
ignoring it has a cost. It is strongly rewarded, **never a hard lock**: fatigue still ends every fight.

| boss | verb | the car must | stun (payoff) | ignoring it |
|---|---|---|---|---|
| `centrao` | **PEGAR** | touch the parachuting EMENDA briefcase | "BASE DO ZÉ", ×2,2 for 3,5–4 s | the emenda lands: +2% HP |
| `dilmae` | **FICAR** | keep the white dot inside the drifting META ring until it fills | "RECALCULANDO...", ×2,2 for 3 s (3,5 s in the last turno) | "META ABERTA" armour ×0,8 |
| `erika` | **CORTAR** | fly through every cable ("fio") of her live before it regrows | "CAIU A LIVE! FLOPOU!", ×2,4 for 4–4,5 s (1º Mandato: rigs of 2/2/3/3/3 phones, regrow ×2,5, stun 5–5,6 s, 3 s pause after a stun, an uncut phone hops toward Zé after 4,5 s with "NOVO ÂNGULO!", HP 8400; 2º Mandato keeps the full rigs (4 phones in the last turno), HP 6100 base) | "EM ALTA" armour ×0,7–0,9 + VIRALIZOU heart bursts |
| `taxad` | **ACHAR** | touch the cofre that holds Zé's money after the shuffle | "RESTITUIÇÃO!", ×2,3 for 3,5–5 s ("RESTITUIÇÃO EM DOBRO!" ×2,5 in the last turno) | ALÍQUOTA armour ×0,9/0,8/0,7 (a right pick resets it) |
| `lule` | **OLÉ** | stay under Lule while the Leão da Receita aims, then sidestep | "TAXARAM O TAXADOR!", ×2,3 for 3,4 s (2,8 s in life 2); the Leão stays at x ≤ W−110, left of the DELAÇÃO button | the lion bites Zé's Pix (never a life) |

Verb ramp: a slow object falls to you (PEGAR) < hold a spot (FICAR) < cross moving cables (CORTAR) < track a shuffle and
touch the right box (ACHAR) < time a charger from behind under the densest patterns (OLÉ). Every stun multiplier gets
`+ 0,3 R` from PRESSÃO (cap 4), and the tag shows the final value (`'BRECHA ×2,5'`).

**Taxad's ACHAR** ("CADÊ O SEU DINHEIRO?", taxad.js `CF`): a scheduler (not a coroutine) in `update`. `show` (the
`'SEU PIX'` bag goes into one of 3 identical steel cofres) → `shuffle` (3–6 swaps on opposite half-ellipses; feints,
flying plates that mislead from P3, a 3-cofre rotation and drift in P5) → `drop` → `pick` (rings, `'QUAL?'`; the first
cofre the car touches is the pick, no take-backs) → reveal. Right: Pix refund, `'ACHOU O SEU DINHEIRO!'`, stun, ALÍQUOTA
back to 0. Wrong or timeout: the right cofre is shown (`'TAVA AQUI!'`), `'ARRECADADO!'`, ALÍQUOTA +1 (max 3). From `show`
to the end of `pick` he holds his phase patterns (`d.hold`) and fires only a light round pattern (never lasers, frames or
zeros); the first round of a 1º Mandato run is a bullet-free demo with hints. A phase change mid-shuffle cancels the
round with no penalty; one in `pick` lets it finish. ISENTO! = ≥ 4 right cofres and 0 misses in the fight.

**Lule's 2nd life brings JANJINHA** (janjinha.js, §6 `G.Janjinha`): while she is up, Lule stands behind the CERIMONIAL rope
(×0,3 damage, HP floor at 0,65 of the bar, hudTag `'CERIMONIAL'`); an olé still stuns him through the rope. Knock her out
(own HP bar) → `'EMBARCOU PRO EXTERIOR!'`; she leaves on her own after 75 s of her clock. The Leão's bite can land on her
card (CARTÃO BLOQUEADO: 20% of her HP, no stun) — an exclusive route, not a mechanic success of Lule.

**Boss fields (set by the boss module every frame):**
- `b.autoGoal = { x, y, r, why, id } | null` — where the car should be for the mechanic right now. Clamped to
  x ∈ [16, W-16], y ∈ [0.42H, H-30]; one reused object per boss. `why` ∈ `'emenda' | 'meta' | 'fio' | 'cofre' |
  'leao-alinha' | 'leao-sai' | 'alvo' | 'stun'`; `id` changes when the target object changes (the humanbot uses it to
  "notice" a new object).
  - `'cofre'` (Taxad): one id per round (`'cf' + n`). During show/shuffle/drop the goal is under the right cofre at 0,74H
    (r 18, eye-tracking); in `pick` it is the cofre itself (r 12). The goal object also carries `alt = [x0, y0, x1, y1]`
    (the two wrong cofres, same y as the goal) and `k` (0..1, the round's shuffle difficulty), for the humanbot's
    "lost the cofre" model.
  - `'alvo'` (Janjinha, set by lule.js while she is up): a target to shoot from below at (her x, 0,80H), r 30. Always
    followed, never counted as a mechanic. Priority in lule.js: stun > Leão > alvo.
  While stunned: `why:'stun'` at `(clamp(b.x, 30, W-30), 0.78H)`, r 40 (under the boss, shooting). Null in `onDeath`,
  at Lule's revive and whenever nothing is available. The core autopilot (`auto=1`) follows it unless `mech=0`
  (`G.debug.noMech`); `hitboxes=1` draws it as a cyan cross + circle of radius `r`.
- `b.mech = { kind, ok, miss, stuns }` — kind ∈ `'pegar' | 'meta' | 'fio' | 'cofre' | 'ole'`; `ok` = successful actions
  (catch, fill, cut, right cofre, bite), `miss` = missed opportunities (a wrong cofre or a timeout counts), `stuns` =
  stuns granted. Set in `init`. Read by `G.debug.mech()`, `G.debug.stats()` and the humanbot. Extra fields:
  `pav` (Erika: 0/1, set when the Pavanatto scene completes), `aliq` (Taxad: ALÍQUOTA 0..3), `life` (Lule: 1..3) and
  `janj = { up, ko, left, t }` (Lule: filled by janjinha.js every frame; `t` = her fight clock).
- `b.hudTag = { text, color } | null` (≤ 14 chars): drawn by the core centred in the boss bar (pulsing, dark stroke),
  e.g. `'BRECHA ×2,2'` during a stun, the armour tag (`'META ABERTA'`, `'EM ALTA ×0,8'`, `'ALÍQUOTA 20%'`, `'CERIMONIAL'`,
  `'AO VIVO'`) otherwise, and in the last turno `'ÚLTIMO RECURSO'` / `'SEM SAÍDA ×1,5'`.
- `def.drawOver(ctx, b, g)` (optional): the core calls it after the lasers and before the floating texts, with the same
  shaken transform, in every state but `warning`. Rings, labels, progress arcs, aim lines and the 6x1 strip go here, so
  bullets never hide them; bodies stay in `def.draw` (under the car and the bullets). If `!(G.coreHooks &&
  G.coreHooks.drawOver)`, the module calls its own drawOver at the end of `def.draw`.

**`G.BossKit`** (exported at the end of bosses.js; erika.js and taxad.js require it, lule.js uses it with local fallbacks,
janjinha.js never needs it):
```js
// re-exports of the bosses.js helpers (same behaviour)
COL, INK, WHITE, TAU, DOWN, sfx, L2, decoK, clamp, pl, canShoot, shoot, ring, fan, aimFrom, hint, say, fatigue, bubbleAt,
warmPeople, poses, warmShots, warmShotsStep, co, stopCo, runCo, tween, glide, fx, updFx, drawFx,
E, O, inked, outl, txt, rr, glowOn, sweatDrop, dizzy, lookAt, hand,
// mechanics
MECH                          // { TEAL: '#32bcad', TEAL_L: '#7ff0e2', CAR_R: 14, GOLD: '#ffd23f' }
clk(b)                        // b.data.clk || 0: the boss clock (stops while stunned)
carNear(x, y, r)              // the car BODY (r 14) touches the circle: alive, not entering, dist < r + 14
trackCar(b)                   // LAST line of def.update: stores d.cpx/d.cpy (previous car position)
carSwept(b, pts, n, r, from)  // pts = flat [x0,y0,x1,y1,…] polyline of n points; tests segments from..n-2 and returns
                              //   the first hit (dist < r, or the car's motion this frame crosses it: no tunnelling) or -1
setGoal(b, x, y, why, r, id)  clearGoal(b)
mechInit(b, kind)  mechOk(b)  mechMiss(b)
stunStart(b, dur, mul, o)     // o = { tagWord = 'BRECHA', color, text, textColor, say, clear = true, onEnd, sfx = 'mech_ok' };
                              //   mul = min(4, mul + 0,3 R) (PRESSÃO) BEFORE the tag, which is always generated:
                              //   tagWord + ' ×' + fmtMul(mul) (o.tag is no longer read); dur × 0,85
                              //   on the 2º Mandato; clears bullets into Pix unless clear:false; hitstop, shake, sfx
                              //   'stamp' + o.sfx; mech.stuns++; first stun of a 1º Mandato run: 'BRECHA! DANO DOBRADO!'
stunExtend(b, add, cap)       // d.stunT = min(cap, d.stunT + add)
stunUpdate(b, dt)             // counts d.stunT down, calls stunEnd at 0; returns true while stunned
stunning(b)  stunEnd(b)       // stunEnd: d.stunT = 0, calls and clears d.stunOnEnd, d.mechCd = 2
mechHint(key, x, y, str, color)   // like hint() (1º Mandato, once per run) but bigger and longer (14 px, 3 s)
mechRing(ctx, x, y, r, t, o)  // o = { label, prog, solid, blink, alpha = 1, fill = true, color = TEAL }: 12% fill,
                              //   2,5 px dashed outline walking (solid = pulsing), 4 px yellow progress arc, label above
tealHalo(ctx, x, y, r, t)     // cached radial halo sprite (one per integer r), alpha 0,45 + 0,2 sin(6t)
heartPath(ctx, x, y, s)       // adds a heart sub-path (beginPath first): hearts are paths, never the ♥ glyph
fmtMul(m)                     // 2.2 -> '2,2', 2 -> '2'
// PRESSÃO pattern variants (Round 5): latch the level per phase, never touch telegraphs/warnings/delays/laser warn/
// wall gaps/mechanic timings
press()                       // G.press || { R: 0, lv: 0 } (never null)
pN(n, lv)                     // n + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0)        aimed fans, streams, spiral arms
pRing(n, R)                   // Math.round(n * (1 + 0.25 * R))                    rings (keep ≥ 28 px gaps)
pW(s, lv)                     // s * (lv >= 5 ? 0.82 : lv >= 3 ? 0.9 : 1)          waits BETWEEN attacks only
pLatch(b)                     // b.data.pl = press().lv; call in start() and onPhase(); pass b.data.pl as the lv override
cpiCo(b)                      // coroutine: while b.data.pl === 5, every pW(3.2) s an aimed 3-fan of 'small' '#ff2a4a' at
                              //   130 px/s (skipped while stunned, in a demo, or d.hold); K.co(b, K.cpiCo(b), <free slot>)
                              //   in start and after each onPhase
P5                            // { LIMIT: 30, MUL: 1.5, TAG: 'ÚLTIMO RECURSO', TAG2: 'SEM SAÍDA ×1,5' } (as { text, color })
lastStand(b)                  // d.p5 = true; d.p5T0 = b.ft; d.p5Mul = 1; d.mechCd = 0   (onPhase of the `last: true` turno)
p5Update(b)                   // after P5.LIMIT s in the last turno: d.p5Mul = P5.MUL (called inside fatigue())
applyMul(b)                   // the damage formula below
FAT_FULL, FAT_MAX             // 90 s, 0,75: fatigue = FAT_MAX × clamp((b.ft − fatStart) / FAT_FULL, 0, 1) (max ×1,75)
```

**Stun = pause.** While `d.stunT > 0` the boss does **not** run its coroutines, does not advance its clock `d.clk`, does not
move (`d.mv`), and its spawn timers, wind and chatter stand still: it wobbles in place with stun visuals (no restart, no
replayed intro, no duplicated adds). Mechanic objects keep updating. Coroutine time-waits use `clk(b)`, never `b.ft`
(`tween`, `dilGust`, lule.js `lSweep`/`ciranda`); fatigue keeps using `b.ft` (wall-clock fight time).

**Damage multiplier**, every frame (bosses.js `fatigue()` / lule.js):
```js
base = d.stunT > 0 ? d.stunMul : (d.armor != null ? d.armor : (d.dmgBase != null ? d.dmgBase : 1));
b.dmgMul = Math.min(4, base * (1 + fatigue) * (d.p5Mul || 1));
b.hudTag = d.stunT > 0 ? d.stunTag : (d.armorTag || (d.p5 ? (d.p5Mul > 1 ? P5.TAG2 : P5.TAG) : null));
```
lule.js uses the same formula with the Janjinha rope as the base while she is up
(`d.stunT > 0 ? d.stunMul : (J.up(b) ? J.shieldMul(b) : 1)`, tag `'CERIMONIAL'`; the HP floor holds even during a stun).
- Never start a stun while one is running (except the explicit "extend" rules, e.g. Centrão P4 with cap 5). After a stun
  ends the boss waits `d.mechCd` (2 s, counted down only while not stunned) before it offers the next mechanic object.
- A phase change during a stun: the core does its normal work (1 s invuln, banner); `onPhase` installs the new phase's
  coroutines (they start when the stun ends) and clamps `d.stunT = min(d.stunT, 2)`.
- Cleanup: `onPhase` removes or re-creates the phase's mechanic objects; `onDeath` clears every object and the goal;
  Lule's `startRevive` / `finishRevive` clear the lion, the stun and the goal.
- 2º Mandato: every stun ×0,85, objects faster, no hints or demos. 1º Mandato: the first object of a run comes with a
  grace/demo (the boss holds the dense patterns) and a `mechHint`.

**The TEAL rule (touchable visual language):** anything the car should touch has a **teal `#32bcad` dashed ring or
halo**, a white outline, a PT-BR label (FONT_DISPLAY 9–11 px, white with a 3 px ink stroke) and a physical cue
(parachute, ring zone, cable, phone); it is ≥ 24 px across. Never pink/red/orange/magenta glow, never a small glowing
round dot. Bullets stay saturated pink, red, orange, magenta or violet with r 3–10, and are never teal. Pix coins are teal
but tiny (r ≈ 7) with no ring or label. Erika's fight has no lasers, so a line on screen there is never lethal. The Leão
(Lule) is a character, not a touchable: its aim line is white dashed and turns **gold** when it will hit Lule (or
Janjinha's card).
**The TEAL exception (Taxad):** a choice among touchables — all three cofres get rings; only one is right; a wrong pick
costs armour, never a life. TEAL appears only in the `pick` state; the cofres are drawn in `def.draw` (under the bullets)
and their outline is repeated in `drawOver` as a thin white stroke during the shuffle, so bullets never hide it.

**Counters and achievements** (data.js): `G.count('emenda')` (Centrão catches), `'meta_ok'` (Dilmãe metas filled),
`'fio'` (Erika cables cut), `'cofre'` (Taxad: right cofres; `'restituicao'` at 10), `'cartao'` (the Leão bit Janjinha's
card); lule.js unlocks `'ole'` after 3 lion bites in one fight. The core unlocks the boss id on death (so `'taxad'` is
automatic). Round 5 achievements (26 in total): `taxad`, `restituicao`, `isento`, `embarcou`, `cartao`, `carimbo_ouro`,
`cpi`, `transito` (unlocks the FUSCA DOURADO skin), `quinto`.

## 6. Stages

```js
G.Stages.add({
  id: 'rodoviaria', name: 'Rodoviária do Plano', subtitle: 'A campanha começou',
  bg: 'rodoviaria', music: 'stage1', bossMusic: 'boss', boss: 'centrao', scrollSpeed: 42,
  script: function* (S) {
    yield 1.5;                                  // wait seconds
    yield* S.repeat(5, 0.35, (i) => S.spawn('cabo', 40 + i * 70, -20, { vy: 90 }));
    yield 'clear';                              // wait until no enemies (25 s timeout)  — or yield S.clear(10)
    yield () => G.game.t > 30;                  // wait until a condition
    yield S.boss('centrao');                    // spawns boss, waits until it is gone. Script end = stage clear.
  },
});
```
`S` = `{ g, W, H, m, spawn, wait, clear(timeout), boss(id), banner, music, dialogue(lines), repeat, drop, text }`.
Stage ids, order and bosses are fixed (5 stages; list order = `G.Stages.add` order): `rodoviaria → centrao`,
`esplanada → dilmae`, `paranoa → erika`, `fazenda → taxad` (Ministério da Fazenda, "O Impostômetro não para"; new
enemies `fiscal` and `maquininha`, mid-boss `impostometro`), `planalto → lule`. The stage count always comes from
`G.Stages.list.length` (never hard-code 4 or 5); 2 life items per run (Esplanada and Fazenda carriers).
Dialogue text for stage intros / boss pre/post lives in `data.js` (`G.STORY`) and is played by the core automatically.
`g.loop` is 2 on the "2º Mandato" (new game+): add density there.

`G.game` fields of interest: `t frame stageIdx stage loop diff player{x,y,r,alive,inv,...} enemies eb pb pickups parts texts lasers boss scrollY approval resumeT rank`.
Stage-progress signals set by stages.js for bg.js: `g.progress` (0..1, only goes up at script milestones; ≈ 0.55–0.6 when
the mid-boss arrives, 1 when the boss arrives) and `g.landmark` (`'itamaraty'` right after the Lobista-Mor fight, about
35–40 s before Dilmãe; `'jk'` at stage time 84 s, so the bridge scrolls in during the T90 comboio da picanha, `'A PICANHA TÁ CHEGANDO!'`;
`'impostometro'` on the Fazenda with `mark(0.55, 'impostometro')`, when the Impostômetro mid-boss arrives). The same
moment also calls the optional `G.BG.landmark(id, g)`. `g.impZero = true` after the Impostômetro mid-boss is beaten.
`G.run` also has `pp` (P items collected toward the next level; a death resets it to 0), `total` (points of the whole
run, not reset by a continue) and `extGiven` (score extends already given: 1,5M / 4,5M / 9M, once per run).
PRESSÃO per stage: `g.pressSum` / `g.pressT` (R̄ = time-average of R over the stage's active play frames; it pays the
grade Pix and decides the CARIMBO DE OURO).

### `G.Janjinha` (janjinha.js ↔ lule.js)
janjinha.js loads after lule.js and never requires `G.BossKit` (lule runs alone with `mods=lule`). Without it
`G.Janjinha` is undefined and Lule plays his 2nd life alone (every lule.js call is guarded `const J = G.Janjinha;`).
```js
G.Janjinha = {
  JN,                        // tunables (read-only for lule.js)
  enabled(b),                // b && b.id === 'lule' && b.data.life === 2 && !b.data.jj    (once per fight; never in LULE 5.0)
  intro(b, done),            // banner + FAB jet + spawn (invuln) + G.STORY.boss.lule.janjinha dialogue, then done()
  start(b),                  // called by lule.js finishRevive: she starts fighting (1,6 s entrance invuln first)
  up(b),                     // true while she is in the fight (entering-invuln counts as up; KO exit / gone / left = false)
  shieldMul(b),              // JN.SHIELD (0,3) while up, else 1
  setFloorAt(at),            // lule.js init passes PH2[1].at (0.62)
  floor(b),                  // b.maxHp × (floorAt + 0.03): Lule's HP never drops below it while she is up
  box(b),                    // reused { x, y, r } while she is on screen and hittable, else null (lion ray)
  lionBite(b, L),            // CARTÃO BLOQUEADO: 20% of her max HP, she shrugs 1,6 s, the card is gone for 12 s
  goal(b),                   // reused { x, y } while she is on screen, else null (lule.js sets autoGoal 'alvo')
  drawShield(ctx, b),        // the CERIMONIAL rope (lule.js drawLule, in front of the grill)
  drawOver(ctx, b, g),       // her HP bar, rocket warnings, card reticle label (lule.js drawOver)
  clear(b, why),             // why ∈ 'revive' | 'boss' | 'quinto': silent removal with a puff, no reward
  stats(b),                  // { up, ko, left, t, hp, maxHp } — also mirrored into b.mech.janj every frame
};
```
State lives in `b.data.jj` (owned by janjinha.js; lule.js only reads it through the API). She is the enemy kind
`'janjinha'` (`noPress`, `harmless`, `keepOffscreen`, `ignoreClear`); her own `update` reads `G.game.boss` to follow
Lule's stun (she freezes and takes ×1,5 while he is stunned). Her knockout never runs `killEnemy` from damage: the module
plays the exit, then kills her silently and pays score, Pix, a bomb and +10 approval by hand.

## 7. Tone & content rules (important; reviewers reject on any breach)

- It is **political satire / parody aimed at the LEFT government and its allies** (PT government, ministers, PSOL, the
  base aliada bought with emendas, government programs, unions, party machinery), Brazilian internet-humor style. The
  player is Zé Contribuinte, the fed-up taxpayer who pays the bill (taxes, the picanha that never came, the "fatura").
  Characters are caricatures with parody names: **Lule, Dilmãe, Erika Viralton, O Centrão** + invented generic archetypes.
- Satire targets **public actions, statements, slogans, parties, policies, programs and persona**. Never protected
  characteristics: gender, gender identity, sexuality, race, religion, region, body, voice, disability, age.
  No slurs, political slurs included ("petralha", "mortadela", "gado"). Do not mock voters or supporters as people.
  No family members, with **one exception: JANJINHA** (below). No sexual content. No claims of specific crimes as fact
  (no thief/convict words, no "L de" + crime). No election-fraud insinuation (no recount, no rigged-machine gags). No
  "nove dedos" jokes: Lule's hands are always drawn normally.
- **Erika Viralton** is always feminine: "ela", "a deputada", "a Erika", "Derrote a Erika Viralton", "CANCELADA!".
  - Nothing (text, art, sfx, comments) about her being trans, her gender, body, voice, past, birth name or transition.
    No wig/hair-is-fake gag, no diva/drag/queer coding ("rainha", "mona", "arrasou", "close", "lacrou", hair flips).
  - Natural skin tone and the standard chibi face of every other caricature, with no exaggerated facial features. The
    caricature lives only in the outfit (PSOL yellow/red), hair volume, gold hoops, props (ring light, selfie stick,
    tribuna, phone) and political trademarks.
  - Her material: PSOL, the PEC to end the 6x1 schedule (jokes about cost and who pays, never about workers), lives,
    posts, threads ("fio"), textão, trending, engagement, "o PSOL vai ao STF / ADI" against *policies*, and speeches at
    the tribuna.
  - Not used: "vou te processar"-type gags (her real complaints are mostly about attacks on her identity, so it would
    read as an identity jab), and the word "lacração" / "lacrou" / "lacrar" in anything new tied to her or stage 3 (the
    one old generic Marqueteiro line `'Bora lacrar!'` in enemies.js may stay).
  - She is treated exactly like Dilmãe and Lule: cartoon dignity, and she flies away filming.
- **JANJINHA, "A Ministra Sem Pasta"** (janjinha.js): the parody of the First Lady, a public figure with a public role.
  Only her **public conduct** is material:
  - official trips (FAB jet, suitcases with `'G20'` / `'ONU'` / `'COP'` / `'FAB'` stickers);
  - public spending as **cartoon exaggeration**, never as a proven crime and never with price figures: the giant
    `'CARTÃO CORPORATIVO'` `'SEM LIMITE'`, the flying `'SOFÁ DO ALVORADA'` with a `'MÓVEL NOVO'` tag;
  - her influence in the government ("A Ministra Sem Pasta", "O CERIMONIAL É COMIGO!");
  - the G20 remark, **always censored**: `'F*CK YOU, ELON!'` (+ the TV censor `bleep`);
  - selfies, lives, activism ("É AGENDA DE TRABALHO!", "VOU REPRESENTAR O BRASIL!").
  **Never:** her body, age, looks, voice, marriage or relationship (no romance or couple gags with Lule; the PT comrade
  term is never said to or about her, because in PT-BR it can mean partner), sexuality, or gendered tropes (gold
  digger, shopaholic, shopping bags, the nagging or bossy wife, cooking). Never her real name and never the bare short
  nickname in any string: the id is `janjinha` everywhere, in code too. She holds no office, so her defeat is never the
  feminine of "cassado": it is `'EMBARCOU PRO EXTERIOR!'`. Standard chibi with cartoon dignity, like Dilmãe and Erika.
- **FERNANDO TAXAD, "O Taxador-Geral"** (taxad.js; the "Taxad" meme): taxes, the "taxa das blusinhas", the arcabouço
  fiscal, déficit zero, IOF, the Pix-tax rumour as satire ("NÃO VAI TAXAR O PIX... AINDA!"), calculators, the Receita
  and the Leão, the Impostômetro, fiscal opacity ("mudei só o nome"). **No crime words** (theft, bribery, diversion,
  fraud, coup); the shell game is about taxes vanishing into spending and is never called a scam. He left the Ministério
  da Fazenda in March 2026: all his text is timeless — never "ministro" in the present tense, never the 2026 São Paulo
  race. Standard chibi face, no exaggerated features, no glasses.
- **The rocket in the Elon gag** is generic: white body, grey fins, orange flame, **no logo, no brand, no name**.
- The content-checklist headers of taxad.js and janjinha.js (and this section) describe the rules without spelling any
  gated word ("no crime words", "no romance or couple gags", "the PT comrade term").
- **Nobody dies. No blood, no gore.** Player shots are votes, flyers, pans and water. Defeated politicians get "CASSADO!"
  (or their own `defeatText`: `'TAXA ZERO!'`, `'SEM QUINTO MANDATO!'`…), burst into santinhos/money and flee (parachute,
  bicycle, live drones, helicopter, Taxad's flying TÁXI with the `'BANDEIRA 2'` meter; Janjinha boards the FAB jet).
  Bosses get the stamp and fly off. The Leão bites Lule's **pocket** (coins fly), never his body.
- MST, unions and movements may only be mocked through slogans and actions, never poverty.
- Speech bubbles (`G.say`) ≤ 28 characters; `b.hudTag` (and every `armorTag` / `stunTag` text) ≤ 14 characters. The
  integrator checks every literal passed to `G.say` / `say(` / `K.say` / `pavSay` in the boss files, enemies.js and
  janjinha.js.
- Glyphs: do **not** rely on `♥`, `●` or `✓` in canvas text; draw hearts, dots and checks as paths (`G.BossKit.heartPath`).
  `×`, `º`, `Nº` and accents are fine.
- Every enemy politician's "número" on flyers is **171** (Brazilian slang for con artist) — a running gag.
- Meme list (joke with these well-known memes and slogans): picanha e cervejinha, faz o L, o amor venceu, taxa das
  blusinhas, Taxad, herança maldita, companheiro, nunca antes na história deste país, estocar vento, dobrar a meta,
  saudar a mandioca, pedalada, toma lá dá cá, emenda Pix, 38 ministérios, jatinho da FAB, segue o fio, fim da 6x1,
  PSOL vai ao STF, Ministério da Verdade, rachadinha (generic), mensalão, Pix; Round 5: não vai taxar o Pix... ainda,
  arcabouço fiscal, déficit zero, IOF, CPF na nota, malha fina, o Impostômetro, a Receita e o Leão, "mudei só o nome",
  a Ministra Sem Pasta, o cartão corporativo, o sofá do Alvorada, missão oficial, quinto mandato.
- **Grep gates** (run from the repo root; all must print nothing before ship). The `[x]` brackets are the same regex,
  they only keep this file from matching itself:
  ```
  # retired jokes (allowlist: the CSS/HTML class name "sigilo" in ui.css/ui.js)
  grep -rniE "b[o]lson|m[o]tociat|t[a]lkey|j[e]t ?ski|l[e]ite condensado|s[i]gilo de|i[n]eleg|m[i]mimi|g[a]binete|v[o]to impresso" \
    jogo/src jogo/docs jogo/README.md jogo/tools
  # Erika (allowlist: enemies.js MKT_LINES 'Bora lacrar!')
  grep -rniE "\bt[r]ans\b|t[r]ansg|t[r]ansex|t[r]avest|p[e]ruca|\bv[o]z\b|m[a]cho|l[a]cr|\b(o|do|no|pelo) e[r]ika\b" \
    jogo/src/js/erika.js jogo/src/js/data.js jogo/src/js/ui.js jogo/src/js/stages.js jogo/src/js/enemies.js
  # Janjinha
  grep -rniE "i[n]teresseir|p[e]rua\b|b[o]tox|p[l]ástica|c[a]sament|m[a]rid[oa]|e[s]posa|a[m]ante|n[a]morad|s[e]xy|g[o]stos|p[e]rigueta|d[o]ndoca|c[o]nsumista|g[a]stadeir|r[o]sângela|\bj[a]nja\b|c[a]ssada|p[r]imeira.dama" \
    jogo/src/js/janjinha.js jogo/src/js/lule.js jogo/src/js/data.js jogo/src/js/ui.js
  grep -niE "\ba[m]or\b|v[e]lh|f[e]ia|b[o]nit|c[o]mpanheir|s[a]colas?|c[o]mpras" jogo/src/js/janjinha.js
  # censored remark only
  grep -rniE "f[u]ck" jogo/src jogo/docs | grep -v "F\*CK"
  # Taxad / Janjinha: no crime claims ('CADEIA NACIONAL' is allowed: the pattern is "c[a]deia de")
  grep -rniE "l[a]drão|r[o]ub[oa]|c[o]rrupt|p[r]opina|p[r]eso\b|c[a]deia de|d[e]svio|f[r]aude|g[o]lpe" \
    jogo/src/js/taxad.js jogo/src/js/janjinha.js
  # Haddad is no longer minister
  grep -rniE "m[i]nistro (da fazenda )?t[a]xad|t[a]xad,? o m[i]nistro" jogo/src jogo/docs jogo/README.md
  ```

## 8. Visual bible

Look: bright, bold "santinho"/campaign-flyer pop on a darker game field. Thick shapes, chunky outlines optional,
readable at 30–60 px. Brazilian palette accents (green/yellow/blue) + red. Chibi caricatures with big heads (`G.Art.person`).

`G.Art.person(ctx, x, y, size, spec, o)` spec keys: `skin, face ('oval'|'round'|'long'|'square'|'jowl'), nose ('small'|'big'),
hair ('side'|'short'|'slick'|'bob'|'long'|'bald'|'gray'|'combover'|'curly'|'bun'|'spiky'|'none'), hairColor, templeColor,
beard (null|'full'|'stubble'|'goatee'), beardColor, mustache, glasses (null|'round'|'square'|'dark'), brows ('normal'|'angry'|'worried'|'bushy'),
browColor, body ('suit'|'tank'|'tshirt'|'none'), suit, shirt, tie, sash ([c1,c2]), hat (null|'cap'|'military'|'helmet'), hatColor, pin, sweat, seed`.
`o`: `{ t, mood ('normal'|'angry'|'laugh'|'hurt'|'smug'|'sad'|'shock'|'tired'), pose ('hold'|'point'|'up'|'wave'|'fist'|'shrug'|'cross'|'drive'|'knit'),
mouth 0..1, flash, alpha, facing (1|-1), bust, lookX -1..1 }`.

Cast (keep these traits consistent everywhere — in-game sprite, portrait, story art):
- **Zé Contribuinte** (hero): ~30, tan skin, blue cap, stubble, white tank top, sweaty, determined. Car: **sky-blue 1978 Fusca (VW Beetle)
  with white roof stripe, seen from above, rocket nozzle at the back with orange/blue flame, chrome bumpers**.
- **Vó Dirce** (radio sidekick): sweet grandma, white curly hair, round glasses, pink cardigan, crochet, headset.
- **O Centrão** (boss 1): the government's base aliada. An amorphous grey blob made of many fused suits and heads (5–9 small
  heads), giant grin, briefcases and "TOMA LÁ DÁ CÁ" sign; changes colour/side when hit (red, and the beige "em cima do muro"
  `#c9b48a`): it supports whoever pays. Its EMENDA briefcase falls under a red/white parachute; caught, it turns "BASE DO ZÉ"
  and holds up a `'TÔ COM O ZÉ'` placard.
- **Dilmãe** (boss 2): short dark-brown bob haircut, strong jaw, red blazer, holds a mandioca (cassava) and glass jars of
  "vento estocado"; stunned, she holds a calculator blinking `'ERRO'` ("RECALCULANDO...").
- **Erika Viralton** (boss 3, "A Deputada do Engajamento", erika.js): `G.Art.person` size 112 with the standard chibi face,
  natural skin tone `#8d5a3b`, long blonde hair (`hair: 'long'`, `#f2d98e`, back volume `#d9b65f`), as in real life, with a glossy blow-dry volume layer, PSOL-yellow
  blazer `#ffc531` over a red blouse `#d7191c`, gold hoop earrings, a PSOL-sun lapel pin and a Câmara crachá. Props: a ring
  light behind her head (dark while the live is down), a selfie stick with a red-case phone showing `'AO VIVO'`, a like
  counter (drawn heart + `'12,4 MIL'`), a floating wooden TRIBUNA (`'CÂMARA'` plate, gooseneck mic) with a Wi-Fi hub where
  every live cable plugs in; P2 a `'6x1'` desk calendar, P3 an envelope stack `'AO STF'`, P4 she surfs a giant phone
  (`'#TRENDING'`). Stunned: shrug + shock, phone held up looking for signal, a crossed Wi-Fi icon, `'SEM SINAL'` and a
  buffering spinner. Leaving: 4 camera drones lift her while she keeps filming and waving. Bullets `erk_like`, `erk_hash`,
  `erk_textao`, `erk_notif`, `erk_ctps`, `erk_adi` (saturated, never teal). The content rules of §7 apply in full.
- **Participação especial in Erika's fight** (erika.js, tunables `PV` / `PAV_TXT`): LUCAS PAVANATTO (parody of the
  most-voted federal deputy of SP) flies in once per fight on a blue palanque-drone labelled `'PAVANATTO'`, holding a
  `'3 MILHÕES DE VOTOS'` placard. **It starts at Erika's first turno change, always** (whatever turno it lands on, both
  mandatos, `PV.FORCE_DELAY` 1,2 s after the change so the turno banner reads): an invulnerable TV segment **'AO VIVO'**.
  The screen is cleared, she is `invuln` + `harmless` (shots "tink", the Delação is refused), the lower third reads
  `'AO VIVO'` / `'PARTICIPAÇÃO ESPECIAL — PAVANATTO'`, her hudTag is `'AO VIVO'`, the goal is cleared and the rig timer is
  held. Damage output can no longer skip it, and nothing cuts it (stun, phase change, Zé's death). Script: `'CHEGOU O
  PAVANATTO!'` → she says "1,6 MILHÃO É POUCO?!" and fires `PV.N` textões at him (own list, never `g.eb`, never hit Zé);
  he raises the placard and they bounce back into her (`PV.DMG` = 2,5% max HP in total through `G.hitBoss`, a 0,8 s
  flinch, not a stun; from 0,76 it cannot cross 0,52) → "ZÉ, CORTA OS FIOS DELA!" → "FIM DA 6x1? VIRA 0x7!" → he leaves
  and she resumes with "VOU ABRIR UM FIO SOBRE ELE!" (`b.invulnT = 0.5`, `b.mech.pav = 1`, the new turno's rig 1 s later).
  `fatStart` 175 already includes the scene (≈ 6,5 s). State: `d.pav` (scene object | null), `d.pavForce`, `d.pavForceT`,
  `d.pavDone`, `d.pavFlinchT`, `d.pavHoldT`, `d.pavDmg`, `d.rigHold`; `drawErika`'s state gets `S.face` (1, or −1 when she
  turns left to point her phone at him). The joke is only about votes (pride and jealousy, never doubts about the
  election) and the 6x1 policy; nothing from the two deputies' personal dispute. He is a standard chibi (young man,
  short dark hair, short beard, navy suit, white shirt, small blue-and-yellow pin) with no exaggerated features.
- **FERNANDO TAXAD, "O Taxador-Geral"** (boss 4, taxad.js; HP 9000, 2º Mandato base 7200, spdK 1,15, fatStart 190,
  score 300.000, Pix 260, `defeatText` `'TAXA ZERO!'`): `G.Art.person` size 116, standard chibi, **no glasses**, short
  salt-and-pepper grey hair, calm professor smile, navy suit, red tie, a gold `'%'` lapel pin. Props: the flying cash
  register `'CAIXA DA UNIÃO'` (drawer plate `'FAZENDA'`; the drawer slides out 0,45 s before every drawer volley), the
  `'TAXÍMETRO'` LED (`'R$ 1.171.171.171'`, `'DÉFICIT R$ 0'` in P3, `'BANDEIRA 2'` in P5, `'DEVOLVENDO...'` stunned), a
  giant calculator (LCD `'%'`, `'+20%'`, `'TETO'`, `'0,00'`, `'IOF'`, `'TUDO'`, `'ISENTO'` while stunned — never `'ERRO'`,
  that is Dilmãe's), the `'SEU PIX'` money bag during a cofre round. Lower third `'CADEIA NACIONAL'` /
  `'FERNANDO TAXAD — O Taxador-Geral'`. Turnos: Taxa das Blusinhas (boxes split into T-shirts at the `'ALFÂNDEGA'`
  line) · Arcabouço Fiscal (a girder frame closing in, with one `'FURO!'`) · Déficit Zero (a falling "00" formation with
  `'ROMBO'` gaps) · Não Vai Taxar o Pix (card-machine Pix trains + the `'IOF'` laser) · **Imposto Sobre Tudo** (the
  remix, `'BANDEIRA 2!'`). Bullets `tx_caixa`, `tx_blusa`, `tx_tecla`, `tx_darf`, `tx_regua`, `tx_pix` (saturated,
  never teal). Leaving: a yellow flying `'TÁXI'` with the `'BANDEIRA 2'` meter ("PÕE NA CONTA DA UNIÃO!").
- **JANJINHA, "A Ministra Sem Pasta"** (co-boss of Lule's 2nd life, janjinha.js; HP 3000 × Lule's `d.hpMul`): standard
  chibi size 100 (Lule 136 stays the star), red blazer, white blouse, long dark hair, a selfie phone in a gold case, the
  giant gold `'CARTÃO CORPORATIVO'` (`'SEM LIMITE'`), two suitcases (`'G20'`, `'ONU'`, `'COP'`, `'FAB'`), on the flying red
  velvet `'SOFÁ DO ALVORADA'` with a `'MÓVEL NOVO'` tag (no price). She arrives with the banner `'E NÃO VEIO SOZINHO!'` /
  `'JANJINHA — A MINISTRA SEM PASTA'` from a small white FAB VIP jet; she dwells at 0,18W / 0,82W and flies "VIAGEM
  OFICIAL" between them through the screen edges. Attacks (`jan_` styles): card fans that bounce once off a wall,
  suitcases that burst into passport-stamp rings (`'ESCALA!'`), the censored `'F*CK YOU, ELON!'` grawlix fan and the
  generic rocket reply in two warned columns (`'O FOGUETE RESPONDEU!'`), and below 50% mini-sofas. Her own HP bar
  (`'JANJINHA'`, pink). Content rules: §7.
- Fazenda enemies: **FISCAL DA RECEITA** (`'fiscal'`: grey suit, blue tie, an `'IRPF'` clipboard and a rubber stamp; MALHA
  FINA nets of `en_darf` slips with one missing slot; "CPF NA NOTA?") and **MAQUININHA DA TAXA** (`'maquininha'`: a flying
  POS card machine, green `'+%'` screen; rings of `en_pixtax`; `'ESTORNO!'`). Mid-boss **O IMPOSTÔMETRO**
  (`'impostometro'`: a hovering black LED panel `'R$ 1.171.171.171'` whose digits drop as 7-segment bullet formations;
  `'MAIS UM DÍGITO!'` below 50%; `'ZEROU O IMPOSTÔMETRO!'`).
- **Lule** (final boss): grey/white full beard, grey receding hair, bushy brows, round face, dark suit, red tie, small red star pin,
  raspy friendly-scheming smile; props: picanha on a skewer, beer cans, a giant "L" hand sign (hands always drawn normally — use an
  L made of light / a foam hand). His fight brings the **Leão da Receita** (`G.EnemyArt.lion`), which bites his pocket on an olé.
  Lives: 1st (5 turnos, the last `'Discurso Sem Fim'`), the revive, the 2nd ("LULE 4.0", 4 turnos, the first with Janjinha,
  the last `'Fim de Mandato'`). **LULE 5.0 — QUINTO MANDATO** (the secret 3rd life, HP 3200, one `last: true` turno
  `'Quinto Mandato'`, a 4-segment medley of his patterns one PRESSÃO level up): it plays when the player beats the 2nd
  life without any recurso in a run started at stage 1 (`G.quintoOk()`; URL `quinto=1` forces it). Stamp at the revive
  `'CASSADO DE NOVO!'`, banner `'ELE VOLTOU DE NOVO!'` / `'LULE 5.0 — QUINTO MANDATO'`, `G.run.secret = 'on'`; losing
  every life in it ends the game as a clear (no continue screen); beating him (`'SEM QUINTO MANDATO!'`) sets
  `run.secret = 'won'`, unlocks `quinto` and adds the extra ending panel `G.STORY.endingQuinto`.
- Generic enemies (archetypes, invented): Cabo Eleitoral, Vereador Fantasma, Deputado do Centrão, Assessor da Rachadinha, Lobista,
  Marqueteiro, Bot de Engajamento, Carro de Som, Sindicalista, Leão da Receita, Ministro, Motoboy da Picanha (red/white
  delivery jacket and a `'PICANHA'` thermal box), Drone da Live, Fiscal da Receita, Maquininha da Taxa. Mid-bosses: Trio
  Elétrico, Lobista-Mor, Ministério da Verdade, O Impostômetro, Comitiva dos 38 Ministros.
- **Touchables follow the TEAL rule** (§5.1): a teal `#32bcad` dashed ring or halo, a white outline, a PT-BR label and a
  physical cue; bullets are never teal and never carry a ring or label.

## 9. Difficulty & feel targets

"Difícil, divertido e recompensador": a bullet-hell-lite. Tiny player hitbox (r=3.2, drawn as a white dot), generous graze radius
(grazing bullets gives score, approval and charges a free bomb). Patterns must be **dodgeable on a phone with a thumb**:
- Telegraph big attacks (warning lines, wind-up animation, sound). Avoid instant aimed bullets spawned close to the player.
- Never fill the screen with unavoidable walls; leave readable gaps ≥ 28 px. Enemy bullet speed mostly 80–220 px/s.
- Don't fire from below y = G.H*0.7 toward the player, don't spawn enemies on top of the player.
- Bullet count on screen: usually < 250, peaks < 450 (performance on mid-range phones).
- Escalation: stage 1 teaches, stage 5 is a real test. Bosses have 5 turnos (Lule 5 + 4), each with a distinct idea; the
  last is the desperation turno (ÚLTIMO RECURSO, §5).
- Reward: Pix drops everywhere, carriers drop power items regularly (≈ 1 per 20–25 s in stages, plus before bosses),
  occasional bomb/shield/cafe/life items (2 life items per run: Esplanada and Fazenda).
- Power: EVERY P item adds progress (2, 3, 4 and 4 items for levels 2..5: 13 P to L5, which arrives during stage 3); its
  colour picks the weapon. A death costs 1 level and resets the P progress (`run.pp = 0`); the lost level drops as a
  non-cycling "restore" P (+1 level when caught) that vanishes after 7 s (it blinks for its last 2 s). At L5 every
  normal P pays 5000 × mult, R$ 5 and +0,03 PRESSÃO heat (`'MÁXIMO! +PRESSÃO'`). The magnet upgrade and the
  top-of-screen auto-collect never pull P items (the colour is the player's choice); at stage clear leftover P items
  count for the current weapon. L5 DPS is unchanged from round 4: PRESSÃO is what keeps the maxed weapon honest.
- Lives: 3 + Plano de Saúde (max +2), max 9; score extends at 1,5M / 4,5M / 9M. Bombs: base 2 + upgrade, carry up to 6,
  a respawn refills to base; graze charges 1,0 per graze (100 grazes per free bomb); boss damage `min(220, 4,5% maxHp)`.
- Continues ("Entrar com recurso"): `maxContinues = 2 + G.upg('recurso')` (Embargos de Declaração, max 4). A continue
  resets heat and score (`run.total` stays, so extends never repeat); the boletim marks `'COM RECURSO'`.
- Stage rank (`G.rankFor`): S = no lives lost and ≤ 1 Delação (bomb); A = no lives lost (any number of bombs) OR exactly
  1 life lost with ≤ 1 Delação; B = lives lost ≤ 1 / 2 / 3 / 4 / 6 (`RANK_B`, stages 1..5); C = the rest.
  Rank Pix = {S 250, A 160, B 90, C 40} × (1 + 0,25 × stage index) × (1 + R̄) × (2 on the 2º Mandato).
  **CARIMBO DE OURO**: rank S with R̄ ≥ 0,5 adds R$ 400 × (1 + 0,25 × idx) (×2 on the 2º Mandato), the boletim badge
  `'NOTA S · CARIMBO DE OURO'`; 3 in one run unlock `carimbo_ouro`.

### 9.1 PRESSÃO (core.js `G.PRESS`, dynamic difficulty)

A visible rank `G.press.R` 0..1 (`g.rank` stays the S/A/B/C letter; in code the new rank is called *press*). It rises
with the weapon level (heavily at L4–L5) and with time alive, falls on a death or a Delação, and **pays back**.
```js
const PRESS = {
  W: [0, 0.04, 0.10, 0.20, 0.35],       // weight by run.level 1..5
  TURBO: 0.02,                          // per G.upg('turbo') level
  HEAT_T: 0.0015, HEAT_KILL: 0.0005, HEAT_BIG: 0.02, HEAT_PHASE: 0.015, HEAT_MAXP: 0.03, HEAT_MAX: 0.5,
  DEATH_KEEP: 0.5, BOMB: 0.05,
  UP: 0.04, DOWN: 0.3,                  // R per second toward the target
  L2_BASE: 0.15, L2_FLOOR: 0.25,        // 2º Mandato
  LV: [0.15, 0.30, 0.50, 0.70, 0.85],   // level thresholds → lv 0..5
  NAMES: ['CALMARIA', 'BURBURINHO', 'TENSÃO', 'CRISE', 'CAOS', 'CPI!'],
  SPD: 0.22, SPD_CAP: 250, EHP: 0.35, BIGHP: 0.5, BHP0: 0.80, BHP1: 0.27,
  SCORE: 1, PIX: 0.6, BOSSPIX: 1, CLEARPIX: 1, STUN: 0.3, GOLD_AVG: 0.5, GOLD_PIX: 400,
};
```
- `run.heat` grows while Zé is alive and fighting (no boss, or the boss in `fight` and not reviving; never in dialogue,
  after the clear or in the resume freeze): `+HEAT_T × dt`, `+HEAT_KILL` per regular kill, `+HEAT_BIG` per big kill,
  `+HEAT_PHASE` per boss turno, `+HEAT_MAXP` per P at L5; capped at `HEAT_MAX`. A death keeps `DEATH_KEEP` of it (R snaps
  down at once, `'PRESSÃO ALIVIOU'`), a Delação costs `BOMB`, a continue zeroes it.
- Target `tgt = clamp(W[level − 1] + TURBO × upg('turbo') + heat + base, floor, 1)` (2º Mandato: base 0,15, floor 0,25);
  R moves toward it at `UP`/s up and `DOWN`/s down. In the 1º Mandato without turbo the maximum is 0,35 + 0,5 = 0,85:
  CPI! needs L5 and full heat (~4–5 min alive). `lv` = thresholds ≤ R (0,02 hysteresis on the way down).
- What it scales: bullet speed ×(1 + 0,22 R) (cap 250 px/s, `noPress` opts out); enemy fire rate and fan/ring density
  (enemies.js); a generic revenge bullet at lv ≥ 3 (a 3-fan at lv 5); enemy HP ×(1 + 0,35 R) / big ×(1 + 0,5 R); boss HP
  latched at spawn ×0,80…×1,07; boss pattern variants latched per turno (lv ≥ 3: +1 bullet per aimed fan/stream/arm and
  waits ×0,9; lv 5: +1 more, waits ×0,82 and `cpiCo`) — telegraphs and warnings are never shortened; stage pacing
  (drizzles faster, swarms +1 at lv ≥ 4).
- What it pays: score ×(1 + R); kill Pix ×(1 + 0,6 R); boss Pix ×(1 + R); grade Pix ×(1 + R̄); stuns +0,3 R; the L5
  extra P; the CARIMBO DE OURO; `cpi` (beat a boss at CPI!).
- HUD: the label `'PRESSÃO'` + 5 pips in the top band (level colours, the next pip fills partially); at CPI! a pulsing
  `'CPI!'`; level up (to lv ≥ 2, at most every 3 s, never in dialogue) `'PRESSÃO: <NOME>!'` + sfx `press_up`. Boletim
  `'PRESSÃO MÉDIA: <NOME> ×<1 + R̄>'`.
- Debug: URL `press=R` pins R (heat still tracked), `heat=H` sets the initial heat; `G.debug.press()`.

### 9.2 Boss balance

Each boss tunes only through the tunables block at the top of its section, in this order: boss HP → fatStart → stun →
cadence → PRESS weights → prices. HP is quoted at R = 0,75 (latch ×1,00); the 2º Mandato keeps the core ×1,25 on top.

| boss | HP | fatStart (s) | turnos (`at` → name; last = ÚLTIMO RECURSO) | stun (s) × mul | ignore cost |
|---|---|---|---|---|---|
| Centrão | 5600 | 140 | 1 Toma Lá, Dá Cá · 0.76 Muda de Lado · 0.52 Fisiologismo · 0.30 Base Aliada · 0.13 Fundão Eleitoral | 3,5–4,0 × 2,2 (cap 5, P4/P5 extend) | +2% HP per missed emenda |
| Dilmãe | 6000 (spdK 1,12) | 155 | 1 Saudação à Mandioca · 0.76 Vento Estocado · 0.52 Meta Dobrada · 0.30 Pedalada Fiscal · 0.13 Meta Infinita | 3,0 (P3 L3 4,0; P5 3,5; flinch 1,2 ×1,6) × 2,2 / 2,3 | META ABERTA ×0,8 |
| Erika | 8400 (L2 base 6100, spdK 1,15) | 175 (incl. the 6,5 s Pavanatto scene) | 1 Segue o Fio · 0.76 Fim da Escala 6x1 · 0.52 O PSOL Vai ao STF · 0.30 Trending Topic · 0.13 Live de 24 Horas | 4,0–4,5 × 2,4 | EM ALTA ×0,7–0,9 + VIRALIZOU |
| Taxad | 9000 (L2 base 7200, spdK 1,15) | 190 | 1 Taxa das Blusinhas · 0.76 Arcabouço Fiscal · 0.52 Déficit Zero · 0.30 Não Vai Taxar o Pix · 0.13 Imposto Sobre Tudo | 3,5–5,0 × 2,3 / 2,5 | ALÍQUOTA ×0,9/0,8/0,7 |
| Lule, life 1 | 7200 | 140 | 1 Picanha e Cervejinha · 0.74 Tudo Taxado · 0.48 Faz o L · 0.22 Companheirada · 0.12 Discurso Sem Fim | 3,4 × 2,3 | −R$ 5–40 Pix per bite |
| Janjinha (co-boss) | 3000 × Lule's `d.hpMul` | own clock: tires 40→70 s, leaves at 75 s | (no core turnos) | freezes ×1,5 while Lule is stunned | the CERIMONIAL rope on Lule |
| Lule, life 2 | 5200 | 170 (from the start of life 2) | 1 Volta por Cima (with Janjinha) · 0.62 Picanha Infinita · 0.32 A Última Picanha · 0.12 Fim de Mandato | 2,8 × 2,3 | −R$ 5–40 Pix per bite |
| LULE 5.0 (secret) | 3200 | 60 | 1 Quinto Mandato | 2,8 × 2,3 | — |

Fatigue everywhere reaches ×1,75 damage taken 90 s after fatStart. Anti-stall in the last turno: after 30 s, ×1,5
(`'SEM SAÍDA ×1,5'`). `b.dmgMul` is capped at 4; stuns never re-trigger within 2 s of ending. 2º Mandato: every stun
×0,85, objects faster, no hints or demos.

### 9.3 Targets (measured with `tools/humanbot.js`; `--fast 1`, 3 seeds unless stated, 0 errors)

- **TTK** (god, `--mode ttk --bosses centrao,dilmae,erika,taxad,lule --weapons voto,boca,panela,jato --mech 1`), median of
  the 4 weapons:

  | boss | L5, `--press 0.75` (the ttk default) | L3, `--press 0.4` |
  |---|---|---|
  | Centrão | 70–90 s | ≤ 170 |
  | Dilmãe | 90–115 | ≤ 185 |
  | Erika (incl. scene) | 100–130 | ≤ 205 |
  | Taxad | 115–150 | ≤ 220 |
  | Lule life 1 | 80–105 | ≤ 170 |
  | Janjinha | 30–50 | — |
  | Lule life 2 (rest; revive and dialogue excluded) | 50–75 | — |

  `--mech 0` at L5: 25–45% slower than mech 1 and always < fatStart + 60 s. L5 TTK ≥ 0,75 × L3 TTK for every boss (the
  maxed weapon no longer halves the fight). Median-time order: Centrão < Dilmãe < Erika < Taxad < finale.
- **Boss-only run mode**, 12 runs per boss: GOOD (`--profile good --bossOnly 1 --startLv 5 --heat 0.4`) median time
  Centrão 95–125 s · Dilmãe 105–140 · Erika 120–155 · Taxad 130–170 · Lule + Janjinha (incl. revive) 220–290; median
  deaths ≈ 1 / 1 / 2 / 2 / 4 (order C ≤ D < E ≤ T < L); fatigue in ≤ 2/12 fights per boss; the last turno reached 12/12;
  mechanic success ≥ 80% (Taxad cofres ≥ 80%). CASUAL (`--profile casual --bossOnly 1 --startLv 4 --heat 0.2`): median
  time ≤ fatStart + 45 s; median deaths ≈ 2 / 3 / 4 / 4 / 7; fatigue in 30–70% of fights; mechanic success ≥ 50% (Lule
  ≥ 40%, Taxad ≥ 50%).
- **Full 1º Mandato, no upgrades** (`--through 1 --runs 8 --continues 99`; `withinLimit` uses the real limit 2): GOOD
  withinLimit 5/8–7/8, oneCC 1/8–3/8, mean continues 0,8–1,5, deaths per run 11–17 rising by stage (S1 0,5–1,5 · S2 1–2 ·
  S3 2–3,5 · S4 2,5–4 · S5 4–7), mean R at boss start ≥ 0,5 from stage 3 on, ≥ 2 extends (median), CPI! in ≥ 1/8 runs.
  CASUAL withinLimit 2/8–4/8, mean continues 2,5–4, deaths 18–28, mean R 0,25–0,45, 1 extend, every boss fight ≤ 6 min.
- **Upgrades**: with ~R$ 12k (vida 1, bomba 1, turbo 1, recurso 1) casual withinLimit ≥ 5/8. Fully upgraded (R$ 44,2k):
  casual 7/8; good oneCC 4/8–6/8, Quinto Mandato reached ≥ 3/8, CPI! in ≥ 4/8 good runs. 2º Mandato fully upgraded: good
  within its limit (4) ≥ 5/8, casual ≥ 3/8.
- **Fairness and performance** (`--press 1` pinned, both profiles, all stages): 0 deaths judged unavoidable by the oracle;
  enemy bullets on screen peak < 450, p95 < 300; JS ms per frame within 15% of the round-4 build at 4× CPU
  (tools/play.js); stun-start `clearBullets(true)` frames ≤ 120 ms.
- **Must-always**: the Pavanatto scene plays in 100% of Erika kills (`b.mech.pav === 1`); Janjinha appears in 100% of
  finales (unless the module is absent).
- **Tuning rules if a target misses**: fight too long → lower that boss's HP (±15% max) before touching fatStart; casual
  withinLimit < 2/8 even with R$ 12k of upgrades → lower `recurso`'s first cost to 1800 before touching boss HP; Pix per
  run > R$ 10k → lower `PRESS.PIX` then `CLEARPIX`; good players get all 3 extends → raise `EXTENDS[1]` to 5M; Taxad
  casual cofre success < 50% → raise SW by 0,05 and ARC by 4 px; Lule not the hardest in median deaths → raise HP2
  before Janjinha's HP.
- **Economy**: the Lojinha costs R$ 44.200 in total (prices ≈ ×1,6 of round 4, plus `recurso` [2500, 6000]); a run earns
  casual R$ 5–7k, good R$ 7–10k (5 stages, longer bosses, PRESSÃO multipliers), so it is bought out after ~6 good / ~8
  casual runs. Tune `PRESS.PIX` / `CLEARPIX` first, then prices.

## 10. Performance

Target 60 fps on a mid phone at devicePixelRatio 2. Avoid `shadowBlur` and `ctx.filter` in per-frame drawing (fine inside
`BulletStyles.paint` or your own pre-rendered offscreen canvases). Cache gradients/patterns. Avoid allocating in hot loops.

Quality tiers (`G.quality`). In `auto` mode (default) the core measures the real rAF interval (which includes raster and
compositing) during play (from 3 s into the stage; frames over 500 ms, hidden tabs and pauses are skipped, long frames
count clamped to 120 ms). It steps down after 2,5 s with a smoothed interval > 22 ms (or 1,5 s > 32 ms): one tier, or
straight from `high` to `low` when the smoothed interval is > 32 ms at that moment (`mid` only saves ~20–25% of the frame,
so a phone that slow pays one rebuild, not two).
It steps back up one tier only at a stage start, after a whole stage (≥ 1200 measured frames) whose smoothed interval never
went over 18 ms (a solid 60 Hz, or headroom on 90/120 Hz), and never into a tier it dropped from in this session (a `mid`
skipped by the high → low jump may still be tried).
The chosen tier is remembered in `G.save.qualityTier`. When the tier changes the core calls `resize()` (canvas resolution
changes: re-key caches by resolution). bg.js keeps the previous-resolution set as a fallback, drawn scaled without
smoothing, while the new set builds at most one item per frame (during play ≥250 ms apart and ≤~12% of the time), and
frees it when the new set is complete; `G.BG.debugState().fb` names the fallback set and `G.BG.builds()` entries carry
`at` (performance.now() at build start). art.js keeps the previous person sprites as a stale set: they are drawn scaled
and repainted in the background (front of the warm queue); after 10 s the unused ones are released and the rest are
replaced under the per-frame cap; the set is gone by 20 s.

| tier | core does | modules should |
|---|---|---|
| `high` | canvas dpr ≤ 2, ≤ 600 particles | everything |
| `mid` | canvas dpr ≤ 1,5, ≤ 450 particles | skip purely decorative extras (ghost copies, extra glows) |
| `low` | canvas dpr 1, ≤ 300 particles, half bursts/confetti, no stroke on small floating texts | bg: drop cloud/tint layers; art: no glow halos; bosses: no decorative particles; audio: no convolver; ui: 30 fps title loop |

ui.js: the title loop is capped at 60 fps on 90/120 Hz screens (30 fps on `low`), and the title canvas DPR follows the tier
(`low` 1, `mid` 1,5).

Other core rules: a frame with no simulation step is not redrawn (90/120 Hz screens); while paused the canvas is drawn once.

## 11. Testing

```
# dev.html already loads every src/ file directly (no build needed while you work). Do NOT run build.js —
# the integrator runs it at the end. (It regenerates dev.html / index.html / dist/artifact.html.)
node tools/play.js --q "stage=0&god=1&auto=1&ts=4&skipui=1" --seconds 40 --shots 8 --out /tmp/<you>/s0
node tools/play.js --q "stage=0&bossid=centrao&god=1&auto=1&ts=3&skipui=1" --w 360 --h 640 --seconds 60 --shots 10 \
  --out /tmp/<you>/centrao --eval "JSON.stringify(G.debug.mech())" --at 55       # mechanic counters at second 55
node tools/play.js --q "stage=2&bossid=erika&god=1&auto=1&ts=3&skipui=1&mods=bosses,erika" --seconds 100 --shots 12 --out /tmp/<you>/erika
node tools/play.js --q "stage=3&bossid=taxad&god=1&auto=1&ts=3&skipui=1&mods=bosses,taxad" --w 360 --h 640 --seconds 120 --shots 14 \
  --out /tmp/<you>/taxad --eval "JSON.stringify(G.debug.mech())" --at 110            # cofres: mech.ok / miss, mech.aliq
node tools/play.js --q "stage=4&bossid=lule&god=1&auto=1&ts=3&skipui=1&mods=lule,janjinha" --w 360 --h 640 --seconds 120 --shots 14 \
  --out /tmp/<you>/lule --eval "G.debug.hurtBoss(1)" --at 8 --eval "JSON.stringify(G.debug.mech())" --at 100   # life 2 + Janjinha
node tools/play.js --q "stage=4&bossid=lule&quinto=1&god=1&auto=1&ts=3&skipui=1" --seconds 150 --shots 10 --out /tmp/<you>/quinto  # LULE 5.0
node tools/play.js --q "stage=3&god=1&auto=1&ts=4&skipui=1&press=1" --seconds 110 --shots 14 --out /tmp/<you>/s4    # whole Fazenda, PRESSÃO pinned at 1
node tools/play.js --page index --seconds 4 --shots 1 --out /tmp/<you>/title    # full build, title screen
```
URL params: `stage` (0-4: 0 Rodoviária, 1 Esplanada, 2 Paranoá, 3 Fazenda, 4 Planalto), `loop`, `boss` (jump to the stage's boss), `bossid` (spawn that boss now, works without stages.js), `god`, `auto` (autopilot), `ts` (time scale), `skipui`
(skip all screens/dialogue), `hitboxes` (also draws `b.autoGoal`), `autocontinue`, `mods` (comma list of modules to load in dev.html, e.g. `mods=art,bg`;
erika.js needs `G.BossKit`, so isolate it with `mods=bosses,erika`; lule.js has local fallbacks and runs alone with `mods=lule`),
`quality` (`high|mid|low`: force a tier and disable auto), `mech=0` (`G.debug.noMech`: the autopilot ignores the boss mechanic,
to measure the "ignore it" path; the fight must still end through fatigue), `press=R` (PRESSÃO pinned at R 0..1: lv/name
follow it, heat is still tracked), `heat=H` (initial `run.heat`), `quinto=1` (`G.debug.forceQuinto`: LULE 5.0 plays after
Lule's 2nd life even without the one-credit condition). Flags accept `0`/`false` to stay off (`god=0`).
taxad.js needs `G.BossKit` (`mods=bosses,taxad`); janjinha.js never does (`mods=lule,janjinha`; without it Lule's 2nd life
plays alone).
`tools/play.js`, `tools/fullrun.js` and `tools/humanbot.js` add `quality=high` unless you pass one (this sandbox rasters on the CPU,
so `auto` would drop the resolution); pass `quality=auto` to test the automatic tier.
`G.debug.qualityMeter()` shows the auto-quality meter (`{ quality, ema, slowMs, stageMax, n, failed }`; `failed` = tiers that
dropped this session). `tools/humanbot.js` plays like a human (reaction time, limited view) to measure difficulty:
`--mode run|ttk|mid|dps`, see the header of the file. `--mech 1` (default) makes it do each boss mechanic through
`b.autoGoal` with a human reaction (the profile's `mechNotice` chance to notice each new object, after `mechDelay` s);
`--mech 0` ignores it and adds `mech=0` to the URL. The ttk table, the run table and `summary.json` carry the boss's
`mech ok/miss/stuns`. Round 5 options: `--press R` / `--heat H` / `--quinto 1` (the URL params above; `--mode ttk`
pins `press=0.75` unless `--press` is given, `--press off` leaves it free), `--stage` takes a list (`--stage 0,1,2,3,4`),
`--maxFight S` (ttk give-up time; default 480 s, Lule 900 s). Taxad's cofres (`why: 'cofre'`): the profile notices a
round with chance `min(0,97, mechNotice + 0,3)` and loses the right cofre with chance `shellErr × (0,6 + 0,8 k)` (casual
0,35, good 0,12), then follows one of the wrong ones (`alt`); Janjinha (`why: 'alvo'`) is always followed and never
counted as a mechanic. Death sections are labelled `boss:P<n>` + `b` (Lule's 2nd life), `bj` (2nd life with Janjinha
up), `c` (LULE 5.0), `boss:rev` (the revive). Summaries: per stage R mean (and the core's R̄), R at boss start, % of
time at CPI!, extends; per boss the ÚLTIMO RECURSO start, `pav` (Erika), Taxad's rounds/noticed/lost cofres and max
ALÍQUOTA, `janj { ko, left, t }` and Lule's `life1End / reviveT / janjEnd / life2End` (+ LULE 5.0); per run
`withinLimit` (cleared with continues ≤ 2 + upg 'recurso'), `oneCC`, `quinto { reached, won }` and Pix.
`tools/fullrun.js` plays all 5 stages on the autopilot (`--god 1` is a one-credit run, so the secret fight plays) and
reports per-stage times, Lule's lives, Janjinha's outcome and `run.secret`.
```
node tools/humanbot.js --mode ttk --bosses centrao,dilmae,erika,taxad,lule --weapons voto,boca,panela,jato --levels 5   # press 0.75
node tools/humanbot.js --mode ttk --bosses taxad --weapons voto --levels 3 --press 0.4 --mech 0
node tools/humanbot.js --profile good --stage 0,1,2,3,4 --bossOnly 1 --startLv 5 --heat 0.4 --runs 12
node tools/humanbot.js --profile casual,good --stage 0 --through 1 --runs 8 --continues 99            # withinLimit / oneCC
node tools/fullrun.js --god 1 --ts 8                                                                   # 5 stages + LULE 5.0
```
`--eval "G.debug.hurtBoss(0.4)" --at 10` runs JS at second 10. `G.debug` has `toBoss() killBoss() hurtBoss(frac) spawnBoss(id)
stage(i, loop) give(type, wtype) weapon(w, lv) stats() mech() qualityMeter()`; `G.debug.mech()` returns
`{ id, state, phase, goal, mech, hudTag, stunT }` for the current boss (null without one). Read the PNGs you produce to check
your visuals. Your module must finish with **zero entries in `G.errors`** and no page errors. Other modules may be
half-written while you work: test with `mods=` to isolate.
