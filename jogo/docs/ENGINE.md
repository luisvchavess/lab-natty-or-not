# Fusca a Jato — engine contract (for module authors)

Vertical shoot'em up for phones. Plain JavaScript, canvas 2D, no libraries, no build tooling beyond `node build.js`
(which inlines everything into one HTML). All game text is **Brazilian Portuguese**.

## 1. Files, ownership, load order

Load order (see `build.js`): `data.js → core.js → art.js → bg.js → audio.js → enemies.js → stages.js → bosses.js → erika.js → lule.js → ui.js → main.js`.
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
| `src/js/bosses.js` | **bosses** | bosses `centrao`, `dilmae` (+ G.BossKit, portraits, bs_ styles) |
| `src/js/erika.js` | **erika** | boss `erika` (+ portrait & erk_ bullet styles) |
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
G.errors, G.errorCount          // the last 50 error messages ('[bg.draw] ...', '[enemy:cabo.update] ...') / count of ALL errors
G.quality      // 'high' | 'mid' | 'low' — current graphics tier (read it while drawing, see §10)
G.setQuality(q)// 'auto' | 'high' | 'mid' | 'low' (UI setting "Qualidade"). Persists in G.save.settings.quality.
G.bossBoxes(b) // b.hitboxes, or a reused default [{dx:0,dy:0,r:b.r}] (never allocate one per bullet)
G.rankFor(hits, bombs, stageIdx)  // stage rank 'S'|'A'|'B'|'C' (see §9); ui.js builds its boletim tips from it
G.powerNeed(lv)                   // how many P items to go from level lv to lv+1 (1, 2, 3, 3)
G.fontsReady() // main.js calls it if the web fonts arrive after boot; core then calls the OPTIONAL hooks
               // G.BG.fontsReady(), G.Art.fontsReady(), G.UI.fontsReady() so text baked into caches can be redrawn
               // (all three are implemented: bg rebuilds its billboards, ui re-runs the fit-to-width of the open screen)
G.coreHooks    // { autoGoal: true, hudTag: true, drawOver: true, mech: true }, set once at core load: feature-detect
               // the boss-mechanic hooks of §5.1 (a boss module draws its own overlay when drawOver is missing)
G.debug.noMech // true with the URL param mech=0: the autopilot ignores b.autoGoal (A/B the "ignore the mechanic" path)
G.debug.mech() // g.boss ? { id, state, phase, goal: b.autoGoal, mech: b.mech, hudTag: b.hudTag, stunT } : null
               // (G.debug.stats() also carries `mech`)
G.EnemyArt.lion(ctx, x, y, o)     // the Leão da Receita drawing (enemies.js), o: { t, flash, sx, sy, pounce, bristle,
                                  //   eyesRed, lookX, mouth }; lule.js draws its Leão with it (local fallback if missing)
G.EnemyArt.taxBite(x, y)          // -> stolen. The lion's bite on Zé's Pix: steal = clamp(round(g.pixStage × 0.15), 5, 40),
                                  //   at most run.pix, taken from run.pix and from the uncommitted g.pixStage; text
                                  //   'MORDIDA DO LEÃO -R$ n' (or 'MORDIDA DO LEÃO: ISENTO!'), burst, shake, sfx 'bite'.
                                  //   Never costs a life. The stage enemy 'leao' and Lule's Leão both call it.
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
- Boss-mechanic SFX (§5.1): `snap` (a live cable is cut: short noise burst + bright pluck, 0,15 s), `roar` (the Leão:
  low saw growl 90→60 Hz + noise, 0,5 s), `meta` (a META ring appears: two sines 880/1320 Hz, 0,25 s), `mech_ok` (stun
  reward: rising 3-note arpeggio + coin, 0,5 s, priority 4), `buffer` (the live drops: sad descending 3 blips, 0,4 s).
  Unknown names are ignored, so a boss may call them before audio.js has them.
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
- `G.buyUpgrade(id)` during the between-stages shop (`G.state === 'clear'`) also applies vida/bomba/arma to the current run.
- `G.resume()` freezes the world for 1 s ("PRONTO? VAI!", `G.game.resumeT`) so the thumb can get back to the screen.
- UI keys and 'toque para continuar' areas act on pointerup (moved < 14 px, < 500 ms), so a second finger works while the
  thumb steers; the click that follows a normal tap is swallowed (same pointerId or within 24 px, 600 ms). Keyboard and
  mouse still go through click. Achievement toasts on the pause and boletim screens sit next to the key row, one at a time.
- The core toggles `body.rotate-hint` when a touch device is in landscape (base.css shows the hint). While a phone
  (viewport height < 560) is sideways, `'play'` is never kept: the core pauses as soon as it sees it (turning during play,
  or a stage starting under the hint after the auto-advancing stage card). The pause screen waits under the hint.

### Background (implemented by bg.js)
`G.BG.draw(ctx, id, scrollY, t, W, H)` must paint the **entire** canvas every frame. ids: `menu rodoviaria esplanada paranoa planalto`.
If it throws, the core unwinds the ctx (`restore()` until the save stack is empty) and paints a flat `#0d1b3d` fill for
**that frame only**; the next frame calls `draw` again as usual.
- Optional `G.BG.landmark(id, g)`: stages.js calls it (through `G.call`) at the moment a mid-stage postcard must scroll in
  (`'itamaraty'` on the Esplanada, `'jk'` on the Paranoá), together with setting `g.landmark = id`.
- Mid-stage landmark order in bg.js: `g.landmark` / `G.BG.landmark` first; else `g.progress ≥ prog` (Esplanada 0.75,
  Paranoá 0.45); else the scroll distance when the stage sends no signal; and if the boss comes first, the landmark is
  inserted during the boss warning/entrance.

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
  name: 'DILMÃE', title: 'A Estocadora de Vento', hp: 3900, r: 40, homeY: 168,
  score: 160000, pix: 150, music: 'boss', defeatText: 'IMPEACHMENT!',
  phases: [ { at: 1, name: 'Saudação à Mandioca' }, { at: 0.72, name: 'Vento Estocado' }, { at: 0.45, name: 'Meta Dobrada' },
            { at: 0.18, name: 'Pedalada Fiscal' } ],
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
- `G.bomb()` is refused (sfx `denied`, no bomb spent) while the boss is `dying`/`leaving`, after the stage script ended,
  and during a cinematic where the boss is in `fight` with `b.invuln && b.harmless` (or `b.data.reviving`), e.g. Lule's revival.
- `G.setBossPhases(b, phases, hpFrac)` replaces phases and sets hp (for revivals). `b.dmgMul` = armor. `b.invuln` for invulnerable moments (shots "tink").
- Player damage reference, single target from the bottom of the screen (dps, L1–L5): VOTO 22/33/44/56/67 (every level adds
  one straight shot; L4–L5 add an angled pair for waves); BOCA DE URNA 25/34/43/52/61 (a straight centre stream of 2–6 shots
  + a fan of 0.7 pellets for crowds, 28°/46°/46°/66°/84°); PANELAÇO 18/29/35/60/74 homing; LAVA-JATO beam 26/38/50/62/74
  (`14 + 12 × level`, no travel time; pierces the column: the nearest target takes full damage, the ones behind 60%,
  `big` enemies always full). Bomb = 4.5% boss hp (max 220). `G.upg('turbo')` adds +10% fire rate per level for every
  weapon (interval ÷ (1 + 0.1 × level); the beam's dps × the same factor), cafezinho ×1.5.
- Lule (final boss): HP 4400 (1st life) + 2850 (2nd life) (`HP1`/`HP2` in lule.js; balance range 4400–4800 / 2850–3100).
  Anti-stalemate fatigue per life: starts at 75 s (1st) / 50 s (2nd) of fight and reaches 2× damage taken 35 s later.
  In the Companheirada phase each companheiro the player knocks down passes 11 HP to Lule (G.hitBoss, so fatigue applies).
  The other bosses also tire after a long fight (bosses.js `fatigue()`, from `def.fatStart`, default 95 s, up to 2× 60 s
  later). Bosses with costly vector bodies (Centrão) paint their sprites ahead of time in small slices during the
  warning/entrance and the previous turn; never build a big offscreen canvas in the frame that first draws it.

### 5.1 Boss mechanics ("cada chefão tem uma manha")

Every boss has one verb beyond shooting. Doing it **stuns** the boss (it takes much more damage for a few seconds);
ignoring it has a cost. It is strongly rewarded, **never a hard lock**: fatigue still ends every fight.

| boss | verb | the car must | stun (payoff) | ignoring it |
|---|---|---|---|---|
| `centrao` | **PEGAR** | touch the parachuting EMENDA briefcase | "BASE DO ZÉ", ×2,2 for 3–4 s | the emenda lands: +2% HP |
| `dilmae` | **FICAR** | keep the white dot inside the drifting META ring until it fills | "RECALCULANDO...", ×2,2 for 3 s | "META ABERTA" armour ×0,8 |
| `erika` | **CORTAR** | fly through every cable ("fio") of her live before it regrows | "CAIU A LIVE! FLOPOU!", ×2,4 for 4–4,5 s (1º Mandato: rigs of 2/2/3/3 phones, regrow ×2,5, stun 5–5,6 s, 3 s pause after a stun, an uncut phone hops toward Zé after 4,5 s with "NOVO ÂNGULO!", HP 4700; 2º Mandato keeps 3/4/3/4, HP 3400 base) | "EM ALTA" armour ×0,7–0,9 + VIRALIZOU heart bursts |
| `lule` | **OLÉ** | stay under Lule while the Leão da Receita aims, then sidestep | "TAXARAM O TAXADOR!", ×2,3 for 3,4 s (2,8 s in life 2); the Leão stays at x ≤ W−110, left of the DELAÇÃO button | the lion bites Zé's Pix (never a life) |

**Boss fields (set by the boss module every frame):**
- `b.autoGoal = { x, y, r, why, id } | null` — where the car should be for the mechanic right now. Clamped to
  x ∈ [16, W-16], y ∈ [0.42H, H-30]; one reused object per boss. `why` ∈ `'emenda' | 'meta' | 'fio' | 'leao-alinha' |
  'leao-sai' | 'stun'`; `id` changes when the target object changes (the humanbot uses it to "notice" a new object).
  While stunned: `why:'stun'` at `(clamp(b.x, 30, W-30), 0.78H)`, r 40 (under the boss, shooting). Null in `onDeath`,
  at Lule's revive and whenever nothing is available. The core autopilot (`auto=1`) follows it unless `mech=0`
  (`G.debug.noMech`); `hitboxes=1` draws it as a cyan cross + circle of radius `r`.
- `b.mech = { kind, ok, miss, stuns }` — kind ∈ `'pegar' | 'meta' | 'fio' | 'ole'`; `ok` = successful actions (catch,
  fill, cut, bite), `miss` = missed opportunities, `stuns` = stuns granted. Set in `init`. Read by `G.debug.mech()`,
  `G.debug.stats()` and the humanbot.
- `b.hudTag = { text, color } | null` (≤ 14 chars): drawn by the core centred in the boss bar (pulsing, dark stroke),
  e.g. `'BRECHA ×2,2'` during a stun, the armour tag (`'META ABERTA'`, `'EM ALTA ×0,8'`) otherwise.
- `def.drawOver(ctx, b, g)` (optional): the core calls it after the lasers and before the floating texts, with the same
  shaken transform, in every state but `warning`. Rings, labels, progress arcs, aim lines and the 6x1 strip go here, so
  bullets never hide them; bodies stay in `def.draw` (under the car and the bullets). If `!(G.coreHooks &&
  G.coreHooks.drawOver)`, the module calls its own drawOver at the end of `def.draw`.

**`G.BossKit`** (exported at the end of bosses.js; erika.js requires it, lule.js uses it with local fallbacks):
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
stunStart(b, dur, mul, o)     // o = { tag, color, text, textColor, say, clear = true, onEnd, sfx = 'mech_ok' }; dur × 0,85
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
```

**Stun = pause.** While `d.stunT > 0` the boss does **not** run its coroutines, does not advance its clock `d.clk`, does not
move (`d.mv`), and its spawn timers, wind and chatter stand still: it wobbles in place with stun visuals (no restart, no
replayed intro, no duplicated adds). Mechanic objects keep updating. Coroutine time-waits use `clk(b)`, never `b.ft`
(`tween`, `dilGust`, lule.js `lSweep`/`ciranda`); fatigue keeps using `b.ft` (wall-clock fight time).

**Damage multiplier**, every frame (bosses.js `fatigue()` / lule.js):
```js
base = d.stunT > 0 ? d.stunMul : (d.armor != null ? d.armor : (d.dmgBase != null ? d.dmgBase : 1));
b.dmgMul = Math.min(4, base * (1 + fatigue));
b.hudTag = d.stunT > 0 ? d.stunTag : (d.armorTag || null);
```
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
(Lule) is a character, not a touchable: its aim line is white dashed and turns **gold** when it will hit Lule.

**Counters and achievements** (data.js): `G.count('emenda')` (Centrão catches), `'meta_ok'` (Dilmãe metas filled),
`'fio'` (Erika cables cut); lule.js unlocks `'ole'` after 3 lion bites in one fight. The core unlocks the boss id on death.

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
Stage ids, order and bosses are fixed: `rodoviaria → centrao`, `esplanada → dilmae`, `paranoa → erika`, `planalto → lule`.
Dialogue text for stage intros / boss pre/post lives in `data.js` (`G.STORY`) and is played by the core automatically.
`g.loop` is 2 on the "2º Mandato" (new game+): add density there.

`G.game` fields of interest: `t frame stageIdx stage loop diff player{x,y,r,alive,inv,...} enemies eb pb pickups parts texts lasers boss scrollY approval resumeT rank`.
Stage-progress signals set by stages.js for bg.js: `g.progress` (0..1, only goes up at script milestones; ≈ 0.55–0.6 when
the mid-boss arrives, 1 when the boss arrives) and `g.landmark` (`'itamaraty'` right after the Lobista-Mor fight, about
35–40 s before Dilmãe; `'jk'` at stage time 84 s, so the bridge scrolls in during the T90 comboio da picanha, `'A PICANHA TÁ CHEGANDO!'`). The same
moment also calls the optional `G.BG.landmark(id, g)`.
`G.run` also has `pp` (P items collected toward the next level), `total` (points of the whole run, not reset by a continue)
and `extGiven` (score extends already given: 500k / 1,5M / 3M / 6M, once per run).

## 7. Tone & content rules (important; reviewers reject on any breach)

- It is **political satire / parody aimed at the LEFT government and its allies** (PT government, ministers, PSOL, the
  base aliada bought with emendas, government programs, unions, party machinery), Brazilian internet-humor style. The
  player is Zé Contribuinte, the fed-up taxpayer who pays the bill (taxes, the picanha that never came, the "fatura").
  Characters are caricatures with parody names: **Lule, Dilmãe, Erika Viralton, O Centrão** + invented generic archetypes.
- Satire targets **public actions, statements, slogans, parties, policies, programs and persona**. Never protected
  characteristics: gender, gender identity, sexuality, race, religion, region, body, voice, disability, age.
  No slurs, political slurs included ("petralha", "mortadela", "gado"). Do not mock voters or supporters as people.
  No family members (no First Lady jokes). No sexual content. No claims of specific crimes as fact ("ladrão",
  "presidiário", "descondenado", "L de ladrão"). No election-fraud insinuation. No "nove dedos" jokes: Lule's hands are
  always drawn normally.
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
- **Nobody dies. No blood, no gore.** Player shots are votes, flyers, pans and water. Defeated politicians get "CASSADO!"
  (or their own `defeatText`), burst into santinhos/money and flee (parachute, bicycle, live drones, helicopter…).
  Bosses get the stamp and fly off. The Leão bites Lule's **pocket** (coins fly), never his body.
- MST, unions and movements may only be mocked through slogans and actions, never poverty.
- Speech bubbles (`G.say`) ≤ 28 characters; `b.hudTag` ≤ 14 characters.
- Glyphs: do **not** rely on `♥`, `●` or `✓` in canvas text; draw hearts, dots and checks as paths (`G.BossKit.heartPath`).
  `×`, `º`, `Nº` and accents are fine.
- Every enemy politician's "número" on flyers is **171** (Brazilian slang for con artist) — a running gag.
- Meme list (joke with these well-known memes and slogans): picanha e cervejinha, faz o L, o amor venceu, taxa das
  blusinhas, Taxad, herança maldita, companheiro, nunca antes na história deste país, estocar vento, dobrar a meta,
  saudar a mandioca, pedalada, toma lá dá cá, emenda Pix, 38 ministérios, jatinho da FAB, segue o fio, fim da 6x1,
  PSOL vai ao STF, Ministério da Verdade, rachadinha (generic), mensalão, Pix.
- **Grep gates** (run from the repo root; both must print nothing before ship). The `[x]` brackets are the same regex,
  they only keep this file from matching itself:
  ```
  # retired jokes (allowlist: the CSS/HTML class name "sigilo" in ui.css/ui.js)
  grep -rniE "b[o]lson|m[o]tociat|t[a]lkey|j[e]t ?ski|l[e]ite condensado|s[i]gilo de|i[n]eleg|m[i]mimi|g[a]binete|v[o]to impresso" \
    jogo/src jogo/docs jogo/README.md jogo/tools
  # Erika (allowlist: enemies.js MKT_LINES 'Bora lacrar!')
  grep -rniE "\bt[r]ans\b|t[r]ansg|t[r]ansex|t[r]avest|p[e]ruca|\bv[o]z\b|m[a]cho|l[a]cr|\b(o|do|no|pelo) e[r]ika\b" \
    jogo/src/js/erika.js jogo/src/js/data.js jogo/src/js/ui.js jogo/src/js/stages.js jogo/src/js/enemies.js
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
  natural skin tone `#8d5a3b`, long dark hair (`hair: 'long'`, `#17110f`) with a glossy blow-dry volume layer, PSOL-yellow
  blazer `#ffc531` over a red blouse `#d7191c`, gold hoop earrings, a PSOL-sun lapel pin and a Câmara crachá. Props: a ring
  light behind her head (dark while the live is down), a selfie stick with a red-case phone showing `'AO VIVO'`, a like
  counter (drawn heart + `'12,4 MIL'`), a floating wooden TRIBUNA (`'CÂMARA'` plate, gooseneck mic) with a Wi-Fi hub where
  every live cable plugs in; P2 a `'6x1'` desk calendar, P3 an envelope stack `'AO STF'`, P4 she surfs a giant phone
  (`'#TRENDING'`). Stunned: shrug + shock, phone held up looking for signal, a crossed Wi-Fi icon, `'SEM SINAL'` and a
  buffering spinner. Leaving: 4 camera drones lift her while she keeps filming and waving. Bullets `erk_like`, `erk_hash`,
  `erk_textao`, `erk_notif`, `erk_ctps`, `erk_adi` (saturated, never teal). The content rules of §7 apply in full.
- **Lule** (final boss): grey/white full beard, grey receding hair, bushy brows, round face, dark suit, red tie, small red star pin,
  raspy friendly-scheming smile; props: picanha on a skewer, beer cans, a giant "L" hand sign (hands always drawn normally — use an
  L made of light / a foam hand). His fight brings the **Leão da Receita** (`G.EnemyArt.lion`), which bites his pocket on an olé.
- Generic enemies (archetypes, invented): Cabo Eleitoral, Vereador Fantasma, Deputado do Centrão, Assessor da Rachadinha, Lobista,
  Marqueteiro, Bot de Engajamento, Carro de Som, Sindicalista, Leão da Receita, Ministro, Motoboy da Picanha (red/white
  delivery jacket and a `'PICANHA'` thermal box), Drone da Live. Mid-bosses: Trio Elétrico, Lobista-Mor, Ministério da
  Verdade, Comitiva dos 38 Ministros.
- **Touchables follow the TEAL rule** (§5.1): a teal `#32bcad` dashed ring or halo, a white outline, a PT-BR label and a
  physical cue; bullets are never teal and never carry a ring or label.

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
- Stage rank (`G.rankFor`): S = no lives lost and ≤ 1 Delação (bomb); A = no lives lost (any number of bombs) OR exactly
  1 life lost with ≤ 1 Delação; B = lives lost ≤ 1 / 2 / 4 / 6 (stages 1..4); C = the rest.
  Rank Pix = {S 250, A 160, B 90, C 40} × (1 + 0,25 × stage index), ×2 on the 2º Mandato.
- Campaign targets (measured with `tools/humanbot.js`, 3 recontagens per run):
  - **1º Mandato**: the first run (no upgrades) clears within the 3 recontagens using 1–3 continues, for casual and good
    players alike; upgrades remove the need for continues (≈ R$ 6.8k bought: ~0.7 continues; everything: none).
  - **2º Mandato** is the upgrade-gated test: bot clears within the limit with no upgrades 0/8, with ≈ R$ 6.8k 1/8,
    fully upgraded (R$ 22.7k) 6/6.
  - Lule is the hardest fight (several deaths per fight).
- Boss balance (each boss tunes only through the tunables block at the top of its section, in this order: HP → stun
  length → object cadence → armour):

  | boss | HP | spdK | stun (s) | mul | stun cap | ignore cost |
  |---|---|---|---|---|---|---|
  | Centrão | 3600 | — | 3,0–4,0 | 2,2 | 5 (P4 extend) | +2% HP per missed emenda |
  | Dilmãe | 3900 | 1,12 | 3,0 (P3 L3 4,0; flinch 1,2 ×1,6) | 2,2 / 2,3 | 4 | META ABERTA ×0,8 |
  | Erika | 4200 | 1,15 | 4,0 (P4 4,5) | 2,4 | 4,5 | armour ×0,7–0,9 + VIRALIZOU |
  | Lule | 4400 + 2850 | — | 4,0 / 3,2 | 2,3 | 4 | −R$ 5–40 Pix per bite |

  2º Mandato: every stun ×0,85, objects faster, no hints or demos, boss HP ×1,25 (core). `b.dmgMul` is capped at 4;
  stuns never re-trigger within 2 s of ending.
- Fight-length targets (humanbot `--mode ttk`, level 3, no shop upgrades):
  - with the mechanic (`--mech 1`): Centrão 55–70 s · Dilmãe 60–75 · Erika 70–85 · Lule 110–140 (plus the revive scene).
  - ignoring it (`--mech 0`): Centrão 80–95 · Dilmãe 90–105 · Erika 105–120 · Lule ≤ 180.
  - The order must hold in median time and in run-mode deaths: Centrão < Dilmãe < Erika < Lule. Mechanic success
    (humanbot run mode, `ok / (ok + miss)`) ≥ 50% for casual and ≥ 80% for good players.
- Economy: the Lojinha costs R$ 22.700 in total; a run earns ~R$ 3–5k, so everything is bought after ~6 runs, for casual
  and good players alike.

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
node tools/play.js --q "stage=2&bossid=erika&god=1&auto=1&ts=3&skipui=1&mods=bosses,erika" --seconds 70 --shots 12 --out /tmp/<you>/erika
node tools/play.js --q "stage=0&bossid=lule&god=1&auto=1&ts=3&skipui=1&mods=lule" --seconds 30 --shots 6 --out /tmp/<you>/lule
node tools/play.js --page index --seconds 4 --shots 1 --out /tmp/<you>/title    # full build, title screen
```
URL params: `stage` (0-3), `loop`, `boss` (jump to the stage's boss), `bossid` (spawn that boss now, works without stages.js), `god`, `auto` (autopilot), `ts` (time scale), `skipui`
(skip all screens/dialogue), `hitboxes` (also draws `b.autoGoal`), `autocontinue`, `mods` (comma list of modules to load in dev.html, e.g. `mods=art,bg`;
erika.js needs `G.BossKit`, so isolate it with `mods=bosses,erika`; lule.js has local fallbacks and runs alone with `mods=lule`),
`quality` (`high|mid|low`: force a tier and disable auto), `mech=0` (`G.debug.noMech`: the autopilot ignores the boss mechanic,
to measure the "ignore it" path; the fight must still end through fatigue). Flags accept `0`/`false` to stay off (`god=0`).
`tools/play.js`, `tools/fullrun.js` and `tools/humanbot.js` add `quality=high` unless you pass one (this sandbox rasters on the CPU,
so `auto` would drop the resolution); pass `quality=auto` to test the automatic tier.
`G.debug.qualityMeter()` shows the auto-quality meter (`{ quality, ema, slowMs, stageMax, n, failed }`; `failed` = tiers that
dropped this session). `tools/humanbot.js` plays like a human (reaction time, limited view) to measure difficulty:
`--mode run|ttk|mid|dps`, see the header of the file. `--mech 1` (default) makes it do each boss mechanic through
`b.autoGoal` with a human reaction (the profile's `mechNotice` chance to notice each new object, after `mechDelay` s);
`--mech 0` ignores it and adds `mech=0` to the URL. The ttk table, the run table and `summary.json` carry the boss's
`mech ok/miss/stuns`:
```
node tools/humanbot.js --mode ttk --bosses centrao,dilmae,erika,lule --weapons voto --levels 3 --mech 1   # then --mech 0
node tools/humanbot.js --profile casual --stage 2 --bossOnly 1 --startLv 3 --runs 6
```
`--eval "G.debug.hurtBoss(0.4)" --at 10` runs JS at second 10. `G.debug` has `toBoss() killBoss() hurtBoss(frac) spawnBoss(id)
stage(i, loop) give(type, wtype) weapon(w, lv) stats() mech() qualityMeter()`; `G.debug.mech()` returns
`{ id, state, phase, goal, mech, hudTag, stunT }` for the current boss (null without one). Read the PNGs you produce to check
your visuals. Your module must finish with **zero entries in `G.errors`** and no page errors. Other modules may be
half-written while you work: test with `mods=` to isolate.
