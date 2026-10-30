# Fusca a Jato — engine contract (for module authors)

Vertical shoot'em up for phones. Plain JavaScript, canvas 2D, no libraries, no build tooling beyond `node build.js`
(which inlines everything into one HTML). All game text is **Brazilian Portuguese**.

## 1. Files, ownership, load order

Load order (see `build.js`): `data.js → core.js → art.js → bg.js → audio.js → enemies.js → stages.js → bosses.js → lule.js → ui.js → main.js`.
CSS: `src/css/base.css` (core) then `src/css/ui.css` (UI module).

| file | owner | what |
|---|---|---|
| `src/js/data.js` | core (read-only for you) | weapons, pickups, upgrades, achievements, cast, story/dialogue text, credits |
| `src/js/core.js` | core (read-only for you) | loop, input, entities, bullets, collisions, player, pickups, boss framework, stage runner, HUD, save, flow, debug |
| `src/js/art.js` | **art** | player Fusca, pickups, HUD icons, story scene illustrations, title key art, Zé/Vó/Rádio portraits, upgrade of `G.Art.person` |
| `src/js/bg.js` | **bg** | scrolling backgrounds per stage + menu |
| `src/js/audio.js` | **audio** | WebAudio synth: all SFX + procedural music |
| `src/js/enemies.js` | **enemies** | every regular enemy + 4 mid-bosses |
| `src/js/stages.js` | **enemies** | the 4 stage definitions and wave scripts |
| `src/js/bosses.js` | **bosses** | bosses `centrao`, `dilmae`, `bolsonario` (+ their portraits & bullet styles) |
| `src/js/lule.js` | **lule** | final boss `lule` (+ portrait & bullet styles) |
| `src/js/ui.js`, `src/css/ui.css` | **ui** | every DOM screen: title/menu, story, dialogue, stage intro, results, shop, game over, pause, ending, settings, achievements, toasts |

**Never edit a file you do not own.** If you need something from core, work around it inside your own file
(wrap/extend, never monkey-patch core internals) and list it under `core_requests` in your final report.
A syntax error in your file only disables your module (separate `<script>` tags in dev), but keep it clean.

## 2. Coordinates, time, units

- Logical canvas: `G.W = 360` wide, `G.H` = 600..780 tall (depends on phone aspect; read `G.H` every frame, never cache it).
- Origin top-left, y grows down. Angles in radians: `0` = right, `Math.PI/2` = **down** (toward the player), `-Math.PI/2` = up.
- Speeds in px/s, time in seconds. Fixed step `G.DT = 1/60`.
- The player lives in the bottom area (~`G.H*0.8`). Bosses sit near the top (`homeY` ≈ 130–170). HUD occupies y 0–48 (top) and the bottom-left corner (weapon), plus a 74 px round bomb button bottom-right. Keep important things out of y<50.
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
G.run          // current run: { loop, score, lives, bombs, weapon, level, pix, grazes, continues, maxContinues, ... }
G.save         // persisted: { pix, upgrades, unlocked, best, cleared, cleared2, seenIntro, qualityTier, achievements, counters,
               //              settings{music,sfx,sens,vibrate,shake,hitbox,quality} }
G.saveGame()   // persist G.save (localStorage, wrapped in try/catch)
G.state        // 'menu'|'intro'|'play'|'dialogue'|'pause'|'clear'|'over'|'ending'
G.fmt(n)       // 1234567 -> "1.234.567"     G.fmtMoney(n) -> "R$ 1.234"
G.call(obj, 'method', ...args)  // safe call (errors are logged into G.errors, never thrown). No allocation for ≤ 6 args.
G.quality      // 'high' | 'mid' | 'low' — current graphics tier (read it while drawing, see §10)
G.setQuality(q)// 'auto' | 'high' | 'mid' | 'low' (UI setting "Qualidade"). Persists in G.save.settings.quality.
G.bossBoxes(b) // b.hitboxes, or a reused default [{dx:0,dy:0,r:b.r}] (never allocate one per bullet)
G.rankFor(hits, bombs, stageIdx)  // stage rank 'S'|'A'|'B'|'C' (see §9)
G.powerNeed(lv)                   // how many P items to go from level lv to lv+1 (1, 2, 3, 3)
G.fontsReady() // main.js calls it if the web fonts arrive after boot; core then calls the OPTIONAL hooks
               // G.BG.fontsReady(), G.Art.fontsReady(), G.UI.fontsReady() so text baked into caches can be redrawn
```

### Spawning & bullets
```js
G.spawnEnemy(kind, x, y, opts)       // -> enemy (see §4). opts.hp/r/score/pix/drop/vx/vy/big override the def
G.fire(x, y, ang, spd, o)             // enemy bullet. o: { style, color, r, accel, minSpd, maxSpd, turn (rad/s),
                                      //   ax, ay (px/s²), life (s), delay (s, frozen+harmless+translucent),
                                      //   spin (rad/s, sprite spin), update(b, dt, g), data, keep (survive offscreen) }
                                      // speeds are auto-multiplied by g.diff (1.15 on 2nd loop)
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
                          //   power + restore:true = the level lost on death (gives +1 level directly, any colour)
G.dropPix(x, y, amount)   // spreads coins worth `amount` reais
G.addScore(base, x, y, showText)   // base × approval multiplier
G.addApproval(v)
G.part({x,y,vx,vy,life,size,color,type:'dot'|'spark'|'ring'|'flash'|'smoke'|'paper',drag,grav,rot,vr})
G.burst(x, y, n, {colors, speed, speedMin, size, life, type, angle, spread, grav, drag})
G.explode(x, y, size 1..4, {colors, ring, confetti})
G.confetti(x, y, n)       // flying santinhos/bills – the visual signature of a politician being "cassado"
G.text(x, y, str, {color, size, life, vy, font, stroke})
G.shake(mag) G.flash(alpha, color) G.hitstop(seconds)
G.banner(title, sub, {dur, color, small})
G.say(entity, 'Talkey?', dur)       // speech bubble drawn above the entity (enemy or boss). Short lines (≤ 28 chars)!
G.count(counterName, n)  G.unlock(achievementId)    // e.g. G.count('rachadinha') – see data.js ACHIEVEMENTS
G.isFlash(entity)          // true while it should be drawn white (hit flash). Pass as `flash` to G.Art.person.
```

### Audio (implemented by audio.js; safe to call from anywhere through `G.call(G.Audio,'sfx',name)` or directly)
`G.Audio.init()`, `unlock()` (called on first touch), `sfx(name)`, `music(name)`, `stopMusic()`,
`setMusicOn(bool)`, `setSfxOn(bool)`. Unknown names must be ignored silently.
- SFX names the core uses: `shot_voto shot_boca shot_panela shot_jato hit tink pan_hit graze explode_s explode_m explode_l
  player_die shield_break bomb denied pix pix_big powerup item extend warning phase boss_down laser_warn laser pause buy achievement`.
- SFX names for other modules (implement all): `enemy_shot enemy_shot2 split ghost dash bite siren motor splash wind
  stamp laugh shout boss_hit charge whoosh spawn ui_click ui_back ui_confirm ui_type urna_fim`.
- Music names: `menu story stage1 stage2 stage3 stage4 boss boss_final clear gameover victory`.

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
```

### UI (implemented by ui.js) – the core calls these
`G.UI.title()`, `story(panels, done)`, `stageIntro(info, done)`, `dialogue(lines, done)`, `stageClear(stats, done)`,
`shop(opts, done)`, `gameOver(info, {onContinue, onQuit})`, `pause({onResume, onQuit})`, `hidePause()`,
`ending(info, done)`, `toast({title, text, kind})`. Flow functions UI calls: `G.startRun(stageIdx, loop)`, `G.toMenu()`,
`G.resume()`, `G.buyUpgrade(id)`, `G.upgradeCost(id)`, `G.upg(id)`, `G.resetSave()`, `G.setQuality(q)`.
- `G.startRun(0, 1)` plays the 6-panel intro story only while `G.save.seenIntro` is false. To rewatch it, the UI calls
  `G.UI.story(G.STORY.intro, done)` itself.
- `G.buyUpgrade(id)` during the between-stages shop (`G.state === 'clear'`) also applies vida/bomba/arma to the current run.
- `G.resume()` freezes the world for 1 s ("PRONTO? VAI!", `G.game.resumeT`) so the thumb can get back to the screen.
- The core toggles `body.rotate-hint` when a touch device is in landscape (base.css shows the hint) and pauses the
  game once when a phone (viewport height < 560) turns sideways.

### Background (implemented by bg.js)
`G.BG.draw(ctx, id, scrollY, t, W, H)` must paint the **entire** canvas every frame. ids: `menu rodoviaria esplanada paranoa planalto`.

## 4. Enemies

```js
G.Enemies.define('cabo', {
  hp: 4, r: 13, score: 120, pix: 2,          // defaults (opts can override)
  big: false,                                 // big = mid-boss style death ("CASSADO!" text, big explosion)
  harmless: false, keepOffscreen: false, ignoreClear: false,
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

## 5. Bosses

```js
G.Bosses.define('dilmae', {
  name: 'DILMÃE', title: 'A Estocadora de Vento', hp: 3200, r: 40, homeY: 150,
  score: 150000, pix: 150, music: 'boss', defeatText: 'CASSADA!',
  phases: [ { at: 1, name: 'Saudação à Mandioca' }, { at: 0.66, name: 'Vento Estocado' }, { at: 0.33, name: 'Meta Dobrada' } ],
  init(b, g) {}, start(b, g) {},             // start = after the pre-fight dialogue, fight begins
  update(b, dt, g) {},                        // only during 'fight'. b.ft = fight time. Move b.x/b.y yourself.
  onPhase(b, idx, g) {},                      // core already cleared bullets, gave 1 s invuln and showed a banner
  onHit(b, dmg, g) {}, onDefeat(b, g) { return false },  // return true to cancel defeat (e.g. revive)
  onDeath(b, g) {},
  draw(ctx, b, g) {},                         // called in every visible state (enter/talk/fight/dying/leaving)
});
```
Boss fields: `x y homeX homeY r hitboxes([{dx,dy,r}] optional) hp maxHp t ft state('warning'|'enter'|'talk'|'fight'|'dying'|'leaving')
flash invuln invulnT phase phases dmgMul data mood mouth sayText bubbleY`.
- Core: warning banner → slides boss from y=-160 to homeY → pre-fight dialogue from `G.STORY.boss[id].pre` → `start()` → `update()`.
- Phase = highest index whose `at` ≥ current hp fraction (list `at` in descending order). HP bar shows phase ticks.
- On death core does the explosion sequence, the "CASSADO!" stamp (`defeatText`, auto-scaled to fit the screen), drops Pix, unlocks the achievement with the boss id, then the boss flies away.
- Phase change banner: `"2º TURNO"`, `"3º TURNO"`… + the phase name (stages are called "FASE", so phases are "turnos").
- `G.bomb()` is refused (sfx `denied`, no bomb spent) while the boss is `dying`/`leaving`, after the stage script ended,
  and during a cinematic where the boss is in `fight` with `b.invuln && b.harmless` (or `b.data.reviving`), e.g. Lule's revival.
- `G.setBossPhases(b, phases, hpFrac)` replaces phases and sets hp (for revivals). `b.dmgMul` = armor. `b.invuln` for invulnerable moments (shots "tink").
- Player damage reference, single target from the bottom of the screen (dps, L1/L3/L5): VOTO 22/44/56; BOCA DE URNA ≈24/33/42
  (a straight centre stream + a wide fan of 0.7 pellets for crowds); PANELAÇO 18/35/74 homing; LAVA-JATO beam 31/53/75
  (pierces the column: the nearest target takes full damage, the ones behind 60%, `big` enemies always full).
  Bomb = 4.5% boss hp (max 220). `G.upg('turbo')` adds +10% fire rate per level, cafezinho ×1.5.

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
Stage ids, order and bosses are fixed: `rodoviaria → centrao`, `esplanada → dilmae`, `paranoa → bolsonario`, `planalto → lule`.
Dialogue text for stage intros / boss pre/post lives in `data.js` (`G.STORY`) and is played by the core automatically.
`g.loop` is 2 on the "2º Mandato" (new game+): add density there.

`G.game` fields of interest: `t frame stageIdx stage loop diff player{x,y,r,alive,inv,...} enemies eb pb pickups parts texts lasers boss scrollY approval resumeT rank`.
`G.run` also has `pp` (P items collected toward the next level), `total` (points of the whole run, not reset by a continue)
and `extGiven` (score extends already given: 500k / 1,5M / 3M / 6M, once per run).

## 7. Tone & content rules (important)

- It is **political satire / parody**, Brazilian internet-humor style. Characters are caricatures with parody names
  (Lule, Capitão Bolsonário, Dilmãe, O Centrão + generic archetypes). Mock *public behaviour, slogans, memes and policies*
  of every side — the player is a fed-up taxpayer vs. the whole political class.
- **No blood, no death, no gore.** Player shots are votes, flyers, pans and water. Defeated politicians get "CASSADO!",
  burst into santinhos/money and flee (parachute, jet ski, helicopter…). Bosses get the stamp and fly off.
- No slurs, no mocking disabilities, illnesses, religion, ethnicity, family members, voters or supporters.
  No sexual content. No claims of specific crimes as fact — joke with well-known memes and slogans
  (picanha e cervejinha, faz o L, taxa das blusinhas, companheiro, estocar vento, dobrar a meta, saudar a mandioca,
  talkey, motociata, jet ski, leite condensado, sigilo de 100 anos, toma lá dá cá, rachadinha, mensalão, emendas, Pix…).
- Every enemy politician's "número" on flyers is **171** (Brazilian slang for con artist) — a running gag.

## 8. Visual bible

Look: bright, bold "santinho"/campaign-flyer pop on a darker game field. Thick shapes, chunky outlines optional,
readable at 30–60 px. Brazilian palette accents (green/yellow/blue) + red. Chibi caricatures with big heads (`G.Art.person`).

`G.Art.person(ctx, x, y, size, spec, o)` spec keys: `skin, hair ('side'|'slick'|'bob'|'bald'|'gray'|'curly'|'none'), hairColor,
beard (null|'full'|'stubble'|'goatee'), beardColor, mustache, glasses (null|'round'|'square'|'dark'), brows ('normal'|'angry'|'worried'|'bushy'),
browColor, body ('suit'|'tank'|'tshirt'|'none'), suit, shirt, tie, sash ([c1,c2]), hat (null|'cap'|'military'|'helmet'), hatColor, pin, seed`.
`o`: `{ t, mood ('normal'|'angry'|'laugh'|'hurt'|'smug'), mouth 0..1, flash, alpha, facing (1|-1), bust, lookX -1..1 }`.

Cast (keep these traits consistent everywhere — in-game sprite, portrait, story art):
- **Zé Contribuinte** (hero): ~30, tan skin, blue cap, stubble, white tank top, sweaty, determined. Car: **sky-blue 1978 Fusca (VW Beetle)
  with white roof stripe, seen from above, rocket nozzle at the back with orange/blue flame, chrome bumpers**.
- **Vó Dirce** (radio sidekick): sweet grandma, white curly hair, round glasses, pink cardigan, crochet, headset.
- **O Centrão** (boss 1): an amorphous grey blob made of many fused suits and heads (5–9 small heads), giant grin, briefcases and
  "TOMA LÁ DÁ CÁ" sign, changes colour/side when hit (it supports whoever is winning).
- **Dilmãe** (boss 2): short dark-brown bob haircut, strong jaw, red blazer, holds a mandioca (cassava) and glass jars of "vento estocado".
- **Capitão Bolsonário** (boss 3): dark side-parted hair with grey temples, square face, angry brows, green-yellow presidential sash over white shirt,
  rides a motorcycle (motociata) and later a jet ski on Lago Paranoá; finger-gun gesture; a black "SIGILO 100 ANOS" box.
- **Lule** (final boss): grey/white full beard, grey receding hair, bushy brows, round face, dark suit, red tie, small red star pin,
  raspy friendly-scheming smile; props: picanha on a skewer, beer cans, a giant "L" hand sign (never draw fingers missing — use an L made of light / a foam hand).
- Generic enemies (archetypes, invented): Cabo Eleitoral, Vereador Fantasma, Deputado do Centrão, Assessor da Rachadinha, Lobista,
  Marqueteiro, Bot de Fake News, Carro de Som, Sindicalista, Leão da Receita, Ministro, Motoqueiro da Motociata, Drone do Gabinete.

## 9. Difficulty & feel targets

"Difícil, divertido e recompensador": a bullet-hell-lite. Tiny player hitbox (r=3.2, drawn as a white dot), generous graze radius
(grazing bullets gives score, approval and charges a free bomb). Patterns must be **dodgeable on a phone with a thumb**:
- Telegraph big attacks (warning lines, wind-up animation, sound). Avoid instant aimed bullets spawned close to the player.
- Never fill the screen with unavoidable walls; leave readable gaps ≥ 28 px. Enemy bullet speed mostly 80–220 px/s.
- Don't fire from below y = G.H*0.7 toward the player, don't spawn enemies on top of the player.
- Bullet count on screen: usually < 250, peaks < 450 (performance on mid-range phones).
- Escalation: stage 1 teaches, stage 4 is a real test. Bosses have 3–5 phases, each with a distinct idea.
- Reward: Pix drops everywhere, carriers drop power items regularly (≈ 1 per 20–25 s in stages, plus before bosses),
  occasional bomb/shield/cafe/life items.
- Power: EVERY P item adds progress (1, 2, 3, 3 items for levels 2..5); its colour picks the weapon. A death costs 1 level,
  which drops as a non-cycling "restore" P (+1 level when caught). The magnet upgrade and the top-of-screen auto-collect
  never pull P items (the colour is the player's choice); at stage clear leftover P items count for the current weapon.
- Stage rank: S = no deaths and ≤ 1 bomb; A = no deaths; B = deaths ≤ 1 / 2 / 4 / 6 (stages 1..4); C = the rest.
  Rank Pix = {S 250, A 160, B 90, C 40} × (1 + 0,25 × stage index), ×2 on the 2º Mandato.
- Economy: the Lojinha costs R$ 22.700 in total (target: fully upgraded after ~6 runs for a good player, ~9 casual).

## 10. Performance

Target 60 fps on a mid phone at devicePixelRatio 2. Avoid `shadowBlur` and `ctx.filter` in per-frame drawing (fine inside
`BulletStyles.paint` or your own pre-rendered offscreen canvases). Cache gradients/patterns. Avoid allocating in hot loops.

Quality tiers (`G.quality`). In `auto` mode (default) the core measures the real rAF interval (which includes raster and
compositing) during play and steps down one tier after 2,5 s with a smoothed interval > 22 ms; it steps back up only at a
stage start, after a whole stage under 12 ms (90/120 Hz screens). The chosen tier is remembered in `G.save.qualityTier`.
When the tier changes the core calls `resize()` (canvas resolution changes: re-key caches by resolution).
| tier | core does | modules should |
|---|---|---|
| `high` | canvas dpr ≤ 2, ≤ 600 particles | everything |
| `mid` | canvas dpr ≤ 1,5, ≤ 450 particles | skip purely decorative extras (ghost copies, extra glows) |
| `low` | canvas dpr 1, ≤ 300 particles, half bursts/confetti, no stroke on small floating texts | bg: drop cloud/tint layers; art: no glow halos; bosses: no decorative particles; audio: no convolver; ui: 30 fps title loop |
Other core rules: a frame with no simulation step is not redrawn (90/120 Hz screens); while paused the canvas is drawn once.

## 11. Testing

```
# dev.html already loads every src/ file directly (no build needed while you work). Do NOT run build.js —
# the integrator runs it at the end. (It regenerates dev.html / index.html / dist/artifact.html.)
node tools/play.js --q "stage=0&god=1&auto=1&ts=4&skipui=1" --seconds 40 --shots 8 --out /tmp/<you>/s0
node tools/play.js --q "stage=0&bossid=lule&god=1&auto=1&ts=3&skipui=1&mods=lule" --seconds 30 --shots 6 --out /tmp/<you>/lule
node tools/play.js --page index --seconds 4 --shots 1 --out /tmp/<you>/title    # full build, title screen
```
URL params: `stage` (0-3), `loop`, `boss` (jump to the stage's boss), `bossid` (spawn that boss now, works without stages.js), `god`, `auto` (autopilot), `ts` (time scale), `skipui`
(skip all screens/dialogue), `hitboxes`, `autocontinue`, `mods` (comma list of modules to load in dev.html, e.g. `mods=art,bg`),
`quality` (`high|mid|low`: force a tier and disable auto). Flags accept `0`/`false` to stay off (`god=0`).
`tools/play.js`, `tools/fullrun.js` and `tools/humanbot.js` add `quality=high` unless you pass one (this sandbox rasters on the CPU,
so `auto` would drop the resolution); pass `quality=auto` to test the automatic tier.
`G.debug.qualityMeter()` shows the auto-quality meter. `tools/humanbot.js` plays like a human (reaction time, limited view)
to measure difficulty: `--mode run|ttk|mid|dps`, see the header of the file.
`--eval "G.debug.hurtBoss(0.4)" --at 10` runs JS at second 10. `G.debug` has `toBoss() killBoss() hurtBoss(frac) spawnBoss(id)
stage(i, loop) give(type, wtype) weapon(w, lv) stats() qualityMeter()`. Read the PNGs you produce to check your visuals. Your module must finish with
**zero entries in `G.errors`** and no page errors. Other modules may be half-written while you work: test with `mods=` to isolate.
