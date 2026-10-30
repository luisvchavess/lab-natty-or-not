/* ============================================================
   FUSCA A JATO — audio.js
   Som 100% sintetizado com WebAudio: todos os efeitos (SFX) e a
   trilha procedural (bossa, valsinha, baião, samba, rock-sertanejo,
   frevo, funk carioca e marchinha). Nenhum arquivo de áudio.

   - O AudioContext só nasce no primeiro toque/tecla (unlock()); o motor
     é montado logo depois em fatias curtas e o reverb ≥ 1,5 s depois.
   - Barramentos: master -> limitador -> saída; música (0,32) e SFX (0,55).
   - Sequenciador "look-ahead": setInterval de 40 ms agenda 0,18 s à
     frente no relógio do áudio (aguenta quedas de frame).
   - O motor (Engine) funciona com qualquer BaseAudioContext, então
     dá para renderizar tudo num OfflineAudioContext nos testes.
   - SFX frequentes e golpes de bateria são pré-renderizados (Offline-
     AudioContext) e tocados como buffer; o sintetizador fica de reserva.
   - Todas as melodias são originais.
   ============================================================ */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const AC = window.AudioContext || window.webkitAudioContext || null;

  const LOOKAHEAD = 0.18;   // s agendados à frente
  const TICK_MS = 40;       // intervalo do sequenciador (menos acordadas do relógio que os 25 ms de antes)
  const XFADE = 0.4;        // crossfade entre faixas (s)
  const MAX_SFX = 24;       // vozes simultâneas de SFX
  const MAX_MUSIC = 160;    // trava de segurança para notas da trilha

  // qualidade gráfica baixa (G.quality === 'low'): sem reverb, sem camadas extras na trilha,
  // golpes repetidos ('hit', 'tink', 'pan_hit', tiros) no máximo a cada 60 ms. Atualizado no tick.
  let LOWQ = false;
  const LOW_RATE = { hit: 0.06, tink: 0.06, pan_hit: 0.06, boss_hit: 0.06, shot_voto: 0.07, shot_boca: 0.07, shot_panela: 0.07, shot_jato: 0.07, enemy_shot: 0.07, enemy_shot2: 0.08, graze: 0.07, pix: 0.045 };

  // ===================== Utilidades =====================
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // FIX >= 0 fixa o sorteio de rnd()/pick() (variações pré-renderizadas, ver "Sons pré-renderizados")
  let FIX = -1;
  const R = () => (FIX >= 0 ? FIX : Math.random());
  const rnd = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[(R() * arr.length) | 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // 'C#5' -> 73 (C4 = 60). Retorna null se não for nota.
  function nm(s) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
    if (!m) return null;
    return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  }
  // padrão de bateria com um único golpe no início de N compassos
  const once = (ch, steps) => ch + '.'.repeat(steps - 1);

  // ---------- acordes ----------
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
    9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], '7b9': [0, 4, 7, 10, 13], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], 5: [0, 7], aug: [0, 4, 8], add9: [0, 4, 7, 14], 69: [0, 4, 7, 9, 14],
  };
  const chordCache = {};
  function parseChord(sym) {
    if (chordCache[sym]) return chordCache[sym];
    const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym);
    if (!m || !(m[2] in QUAL)) return null;
    const pc = (s) => ((nm(s + '4') % 12) + 12) % 12;
    return (chordCache[sym] = { sym, root: pc(m[1]), iv: QUAL[m[2]], bass: m[3] ? pc(m[3]) : null });
  }
  // ---------- escalas ----------
  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11],
    mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  };
  function parseScale(s) {
    const p = String(s || 'C major').split(' ');
    return { root: ((nm(p[0] + '4') % 12) + 12) % 12, iv: MODES[p[1]] || MODES.major };
  }
  // anda `steps` graus na escala (harmonia em terças paralelas: steps = ±2)
  function scaleShift(m, steps, sc) {
    const rel = (((m - sc.root) % 12) + 12) % 12;
    let idx = sc.iv.indexOf(rel), adj = 0;
    if (idx < 0) for (let d = 1; d < 12; d++) { idx = sc.iv.indexOf((rel - d + 12) % 12); if (idx >= 0) { adj = d; break; } }
    const n = sc.iv.length, tgt = idx + steps, oct = Math.floor(tgt / n), j = tgt - oct * n;
    return m - adj + (sc.iv[j] - sc.iv[idx]) + oct * 12;
  }
  // nota do acorde logo abaixo (3 a 9 semitons): segunda voz sempre consonante
  function chordBelow(m, ch) {
    for (let d = 3; d <= 9; d++) {
      const pc = (((m - d) % 12) + 12) % 12;
      for (let i = 0; i < ch.iv.length; i++) if ((ch.root + ch.iv[i]) % 12 === pc) return m - d;
    }
    return null;
  }
  const place = (pc, low) => low + ((((pc - low) % 12) + 12) % 12);

  // ---------- curvas de distorção (compartilhadas) ----------
  function curve(k, n) {
    n = n || 1024;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / (n - 1) - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
  }
  const DIST_HARD = curve(26);
  const DIST_SOFT = curve(3, 512);

  // ===================== Motor (qualquer BaseAudioContext) =====================
  // opts: reverb:false (sem reverb), lazyReverb (reverb só com addReverb()), lazy (ruído preenchido aos
  // poucos com fillWhite(); implica lazyReverb), white (reusa um buffer de ruído), bare (sem barramentos:
  // pré-renderização), meter (ensaio: anota em tEnd/types até quando o som toca e os osciladores usados)
  function Engine(ac, opts) {
    opts = opts || {};
    const sr = ac.sampleRate;
    const E = { ac, mv: 0, cur: null, voices: [], dying: [], tEnd: 0, types: {}, bank: null, hit: null };
    const METER = !!opts.meter;

    // ---- primitivas ----
    E.gain = function (v, dest) { const g = ac.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
    // k-rate: varreduras de envelope não precisam de coeficientes recalculados a cada amostra (bem mais leve)
    const KR = 'k-rate';
    const krate = (p) => { try { p.automationRate = KR; } catch (e) { /* navegador sem automationRate */ } };
    E.filt = function (type, f, q, dest) {
      const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f;
      krate(n.frequency); krate(n.Q);
      if (q != null) n.Q.value = q;
      if (dest) n.connect(dest);
      return n;
    };
    E.osc = function (type, f, t0, t1, dest) {
      const o = ac.createOscillator();
      if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
      krate(o.frequency); krate(o.detune);
      o.frequency.setValueAtTime(f, t0);
      if (dest) o.connect(dest);
      o.start(t0); o.stop(t1);
      if (E.cur) E.cur.srcs.push(o);
      if (METER) { if (t1 > E.tEnd) E.tEnd = t1; E.types[typeof type === 'string' ? type : 'pulse'] = 1; }
      return o;
    };
    E.noise = function (t0, t1, dest) {
      const s = ac.createBufferSource();
      s.buffer = E.white; s.loop = true;
      if (dest) s.connect(dest);
      s.start(t0, Math.random() * E.white.duration * 0.95); s.stop(t1);
      if (E.cur) E.cur.srcs.push(s);
      if (METER && t1 > E.tEnd) E.tEnd = t1;
      return s;
    };
    // envelope percussivo
    E.perc = function (g, t, a, peak, dec) {
      const p = g.gain;
      p.setValueAtTime(0.0001, t);
      p.linearRampToValueAtTime(peak, t + a);
      p.exponentialRampToValueAtTime(0.0001, t + a + dec);
      return t + a + dec;
    };
    // ataque, decai até sus*peak, segura até t+dur, solta em rel. Retorna o fim.
    E.adsr = function (g, t, a, peak, dec, sus, dur, rel) {
      const p = g.gain, s = Math.max(0.0002, peak * sus);
      const td = t + a + dec, te = t + Math.max(dur, a + 0.005);
      p.setValueAtTime(0.0001, t);
      p.linearRampToValueAtTime(peak, t + a);
      if (te > td) { p.linearRampToValueAtTime(s, td); p.setValueAtTime(s, te); }
      else p.linearRampToValueAtTime(Math.max(0.0002, peak + (s - peak) * ((te - t - a) / dec)), te);
      p.exponentialRampToValueAtTime(0.0001, te + rel);
      return te + rel;
    };
    // tom com varredura de frequência (f1 = 0: sem varredura; sw = tempo da varredura)
    E.tone = function (type, f0, f1, t, dur, peak, dest, a, sw) {
      a = a || 0.003;
      const g = E.gain(0, dest);
      const o = E.osc(type, f0, t, t + a + dur + 0.03, g);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + (sw || a + dur));
      E.perc(g, t, a, peak, dur);
      return o;
    };
    // ruído filtrado com varredura do filtro. Retorna a fonte (filtro em .f)
    E.hiss = function (t, dur, peak, dest, type, f0, f1, q, a) {
      a = a || 0.002;
      const g = E.gain(0, dest), f = E.filt(type || 'bandpass', f0, q == null ? 1 : q, g);
      f.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
      const s = E.noise(t, t + a + dur + 0.03, f);
      E.perc(g, t, a, peak, dur);
      s.f = f;
      return s;
    };
    // voz de nota musical (conta vozes e desconecta no fim)
    E.nv = function (dest, v) { const g = ac.createGain(); g.gain.value = v || 0; g.connect(dest); E.mv++; return g; };
    E.fin = function (src, g) { src.onended = function () { E.mv--; try { g.disconnect(); } catch (e) { /* nada */ } }; };

    // ---- buffers e formas de onda (criados uma vez) ----
    // ruído branco de 1 s, tocado em loop a partir de um ponto sorteado (os chiados longos dão a volta).
    // fillWhite(n) preenche n amostras por chamada: o motor ao vivo faz isso em fatias depois do toque.
    E.white = opts.white || null;
    let wBuf = null, wFill = 0;
    E.fillWhite = function (n) {
      if (E.white) return true;
      const len = Math.floor(sr * 1.0);
      if (!wBuf) wBuf = ac.createBuffer(1, len, sr);
      const d = wBuf.getChannelData(0), end = Math.min(len, wFill + n);
      for (let i = wFill; i < end; i++) d[i] = Math.random() * 2 - 1;
      wFill = end;
      if (end >= len) E.white = wBuf;
      return !!E.white;
    };
    if (!opts.lazy) E.fillWhite(Infinity);
    function pulseWave(duty) {
      const N = 40, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      return ac.createPeriodicWave(re, im);
    }
    let p25 = null;
    Object.defineProperty(E, 'pulse25', { get() { return p25 || (p25 = pulseWave(0.25)); } });
    // cada contexto monta a tabela de onda de um tipo de oscilador no 1º uso (5–10 ms a 4×):
    // warm() faz isso fora da hora de tocar
    E.warm = function (type) {
      if (type === 'pulse') return E.pulse25;
      const o = ac.createOscillator();
      if (type !== 'sine') o.type = type;
      return o;
    };
    if (opts.bare) return E;

    // ---- barramentos ----
    const master = E.gain(0.9, null);
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -9; lim.knee.value = 6; lim.ratio.value = 14; lim.attack.value = 0.002; lim.release.value = 0.2;
    master.connect(lim); lim.connect(ac.destination);
    E.sfxOn = E.gain(1, master);
    E.sfxBus = E.gain(0.55, E.sfxOn);
    E.duckG = E.gain(1, master);
    E.duckF = E.filt('lowpass', 20000, 0.5, E.duckG);
    E.musicOn = E.gain(1, E.duckF);
    E.musicBus = E.gain(0.32, E.musicOn);
    // reverb global da música (só médios/agudos, para não embolar o grave).
    // Resposta ao impulso mono de 1 s com decaimento cúbico SEM Math.pow (antes: 1,5 s estéreo
    // com pow por amostra — e o ConvolverNode prepara a FFT da resposta na thread principal).
    // Ao vivo é criada ≥ 1,5 s depois do motor (ver applyQuality/tick) e fica desligada na qualidade baixa.
    E.rev = null;
    E.addReverb = function () {
      if (E.rev) return E.rev;
      try {
        const len = Math.floor(sr * 1.0), ir = ac.createBuffer(1, len, sr), inv = 1 / len;
        const d = ir.getChannelData(0);
        for (let i = 0; i < len; i++) { const u = 1 - i * inv; d[i] = (Math.random() * 2 - 1) * u * u * u; }
        const hp = E.filt('highpass', 320, 0.7, null), cv = ac.createConvolver();
        cv.buffer = ir;
        hp.connect(cv); cv.connect(E.gain(0.2, E.musicOn));
        E.rev = { hp, cv, on: false };
        E.setReverb(true);
      } catch (e) { E.rev = null; /* sem reverb */ }
      return E.rev;
    };
    E.setReverb = function (on) {
      const R = E.rev;
      if (!R || R.on === !!on) return;
      try { if (on) E.musicBus.connect(R.hp); else E.musicBus.disconnect(R.hp); R.on = !!on; } catch (e) { /* nada */ }
    };
    if (opts.reverb !== false && !opts.lazyReverb && !opts.lazy) E.addReverb();

    // ---- SFX: vozes com teto e "roubo" da mais antiga de prioridade <= ----
    E.playSfx = function (name, t, p) {
      const d = SFX[name];
      if (!d) return false;
      E.prune(t);
      if (E.voices.length >= MAX_SFX && !E.steal(d.pri, t)) return false;
      // versão pré-renderizada (ao vivo): só 1 fonte direto no barramento, sem ganho nem envelope
      const bk = E.bank && E.bank(name, p);
      if (bk) {
        const s = playBaked(E, bk, t, E.sfxBus);
        E.voices.push({ out: null, end: t + s.buffer.duration + 0.02, pri: d.pri, srcs: null, name });
        return true;
      }
      const out = E.gain(1, E.sfxBus);
      const v = { out, end: t + 0.5, pri: d.pri, srcs: [], name };
      E.cur = v;
      let dur = 0.5;
      try { dur = d.fn(E, t, out, p) || 0.5; } finally { E.cur = null; }
      v.end = t + dur + 0.08;
      E.voices.push(v);
      return true;
    };
    E.steal = function (pri, now) {
      let k = -1;
      for (let i = 0; i < E.voices.length; i++) if (E.voices[i].pri <= pri) { k = i; break; } // lista em ordem de início
      if (k < 0) return false;
      const v = E.voices.splice(k, 1)[0];
      if (!v.out) return true; // pré-renderizada: curta, termina sozinha (cortar daria estalo)
      const g = v.out.gain;
      try { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.025); } catch (e) { /* nada */ }
      for (const s of v.srcs) { try { s.stop(now + 0.03); } catch (e) { /* já parou */ } }
      v.end = now + 0.06;
      E.dying.push(v);
      return true;
    };
    E.prune = function (now) {
      for (const L of [E.voices, E.dying]) {
        let j = 0;
        for (let i = 0; i < L.length; i++) {
          const v = L[i];
          if (v.end < now) { if (v.out) try { v.out.disconnect(); } catch (e) { /* nada */ } } else L[j++] = v;
        }
        L.length = j;
      }
    };

    // ---- trilha ----
    E.track = function (name, t0, fadeIn) {
      const song = SONGS[name], C = compile(song), now = ac.currentTime;
      const out = ac.createGain();
      out.gain.setValueAtTime(0, Math.min(now, t0));
      out.gain.linearRampToValueAtTime(song.gain || 1, t0 + (fadeIn || 0.02));
      out.connect(E.musicBus);
      const ins = { main: out };
      for (const k of song.ins || []) ins[k] = makeDist(E, out, k);
      return { name, song, C, out, ins, step: 0, next: t0, sd: 60 / song.bpm / 4, ended: false, stopping: false, hi: false };
    };
    // avança um passo da faixa (testes offline com suspend/resume)
    E.step = function (tr) { playStep(E, tr, tr.next); tr.step++; tr.next += tr.sd; };
    // agenda N compassos de uma vez (testes offline curtos)
    E.renderSong = function (name, t0, nbars, hi) {
      const tr = E.track(name, t0, 0.01);
      tr.hi = !!hi;
      E.offline = true; // tudo agendado de uma vez: a trava de vozes não se aplica
      const total = nbars * tr.C.spb;
      while (tr.step < total && !tr.ended) { playStep(E, tr, tr.next); tr.step++; tr.next += tr.sd; }
      return tr;
    };
    return E;
  }

  // pedal de distorção por faixa (guitarras do rock-sertanejo)
  function makeDist(E, out, kind) {
    const lead = kind === 'lead';
    const pre = E.gain(lead ? 2.2 : 2.2, null), hp = E.filt('highpass', 110, 0.7, null);
    const sh = E.ac.createWaveShaper(); sh.curve = DIST_HARD;
    try { sh.oversample = '2x'; } catch (e) { /* nada */ }
    const pk = E.filt('peaking', lead ? 1800 : 1300, 1.1, null); pk.gain.value = 4;
    const lp = E.filt('lowpass', lead ? 4800 : 3000, 0.7, null), post = E.gain(lead ? 0.3 : 0.14, out);
    pre.connect(hp); hp.connect(sh); sh.connect(pk); pk.connect(lp); lp.connect(post);
    return pre;
  }

  // ===================== Sintetizadores especiais (SFX e trilha) =====================
  function motorSynth(E, t, dest, amp, dur) {
    const g = E.gain(0, dest), lp = E.filt('lowpass', 1500, 2, g);
    const sh = E.ac.createWaveShaper(); sh.curve = DIST_SOFT; sh.connect(lp);
    const am = E.gain(0.6, sh), end = t + dur + 0.06;
    const o1 = E.osc('sawtooth', 46, t, end, am), o2 = E.osc('square', 23, t, end, E.gain(0.6, am));
    const lfo = E.osc('square', 20, t, end, E.gain(0.25, am.gain));
    const pts = [[0.3, 128], [0.5, 90], [0.78, 146], [1, 112]];
    for (const [k, f] of pts) {
      o1.frequency.linearRampToValueAtTime(f, t + k * dur);
      o2.frequency.linearRampToValueAtTime(f / 2, t + k * dur);
      lfo.frequency.linearRampToValueAtTime(f / 2.2, t + k * dur);
    }
    E.adsr(g, t, 0.03, amp, 0.1, 0.85, dur - 0.15, 0.15);
    return dur + 0.05;
  }
  function shoutSynth(E, t, dest, amp) {
    const dur = 0.36, end = t + dur + 0.08, f0 = rnd(170, 200);
    const ag = E.gain(0, dest), sh = E.ac.createWaveShaper(); sh.curve = DIST_SOFT;
    const src = E.osc('sawtooth', f0, t, end, sh);
    src.frequency.linearRampToValueAtTime(f0 * 1.35, t + 0.1);
    src.frequency.linearRampToValueAtTime(f0 * 1.08, t + dur);
    for (const [f, q, a] of [[480, 5, 1], [1850, 9, 0.7], [2650, 10, 0.35]]) sh.connect(E.filt('bandpass', f, q, E.gain(a * 3.2, ag)));
    E.adsr(ag, t, 0.03, amp, 0.1, 0.8, dur - 0.1, 0.1);
    E.hiss(t, 0.06, 0.12 * amp, dest, 'bandpass', 2000, 0, 1.5);
    return dur + 0.1;
  }
  // "ha-ha-ha": pulsos de uma fonte glotal passando por formantes de "a"
  function laughSynth(E, t, dest, amp) {
    const n = 5, sp = 0.155, f0 = rnd(135, 165), end = t + n * sp + 0.15;
    const ag = E.gain(0, dest), src = E.osc('sawtooth', f0, t, end, null);
    for (const [f, q, a] of [[730, 6, 1], [1150, 8, 0.6], [2500, 10, 0.3]]) src.connect(E.filt('bandpass', f, q, E.gain(a * 3.4, ag)));
    const hg = E.gain(0, dest);
    E.noise(t, end, E.filt('bandpass', 1700, 1.2, hg));
    for (let i = 0; i < n; i++) {
      const ti = t + i * sp, k = 1 - i * 0.12, fi = f0 * (1.3 - i * 0.07);
      src.frequency.setValueAtTime(fi, ti);
      src.frequency.exponentialRampToValueAtTime(fi * 0.8, ti + sp * 0.85);
      ag.gain.setValueAtTime(0.0001, ti + 0.02);
      ag.gain.linearRampToValueAtTime(amp * k, ti + 0.045);
      ag.gain.exponentialRampToValueAtTime(0.0001, ti + sp * 0.8);
      hg.gain.setValueAtTime(0.0001, ti);
      hg.gain.linearRampToValueAtTime(0.2 * amp * k, ti + 0.012);
      hg.gain.exponentialRampToValueAtTime(0.0001, ti + 0.05);
    }
    return n * sp + 0.15;
  }
  // bipes da urna eletrônica: rajada curta + bipe longo
  function urnaSynth(E, t, dest, n, long, amp) {
    const g = E.gain(0, E.filt('lowpass', 3800, 0.7, dest)), p = g.gain;
    let tt = t;
    p.setValueAtTime(0.0001, t);
    for (let i = 0; i < n; i++) {
      p.setValueAtTime(0.0001, tt); p.linearRampToValueAtTime(amp, tt + 0.004);
      p.setValueAtTime(amp, tt + 0.04); p.linearRampToValueAtTime(0.0001, tt + 0.046);
      tt += 0.07;
    }
    p.setValueAtTime(0.0001, tt); p.linearRampToValueAtTime(amp, tt + 0.005);
    p.setValueAtTime(amp, tt + long); p.linearRampToValueAtTime(0.0001, tt + long + 0.03);
    const end = tt + long + 0.06;
    E.osc('square', 1975, t, end, g);
    E.osc('sine', 3950, t, end, E.gain(0.25, g));
    return end - t;
  }
  // arpejo rápido (power-up, vida extra, conquistas)
  function arp(E, t, dest, notes, gap, dur, peak, type, lastDur) {
    notes.forEach((m, i) => {
      const last = i === notes.length - 1, ti = t + i * gap, d = last ? lastDur || dur * 3 : dur;
      E.tone(type || 'square', mtof(m), 0, ti, d, peak, dest, 0.003);
      E.tone('sine', mtof(m) * 2, 0, ti, d * 0.6, peak * 0.25, dest, 0.003);
    });
    return notes.length * gap + (lastDur || dur * 3);
  }

  // ===================== Efeitos sonoros =====================
  // S(nome, prioridade 1..5, intervalo mínimo entre disparos (s), fn(E, t, out, p) -> duração)
  const SFX = {};
  function S(name, pri, rate, fn) { SFX[name] = { pri, rate, fn }; }

  // --- tiros do jogador: suaves e curtos (tocam o tempo todo) ---
  S('shot_voto', 1, 0.06, (E, t, o) => {
    E.tone('triangle', 1500 * rnd(0.96, 1.04), 640, t, 0.045, 0.13, o, 0.002);
    E.hiss(t, 0.012, 0.05, o, 'highpass', 6000, 0, 0.7);
    return 0.06;
  });
  S('shot_boca', 1, 0.06, (E, t, o) => {
    E.hiss(t, 0.05, 0.14, o, 'bandpass', 2600 * rnd(0.9, 1.1), 1400, 1.2);
    E.tone('triangle', 900, 480, t, 0.04, 0.07, o);
    return 0.07;
  });
  S('shot_panela', 1, 0.06, (E, t, o) => {
    E.tone('sine', 300 * rnd(0.95, 1.05), 640, t, 0.07, 0.13, o, 0.004);
    E.tone('sine', 1900, 0, t, 0.03, 0.04, o);
    return 0.09;
  });
  S('shot_jato', 1, 0.06, (E, t, o) => {
    E.hiss(t, 0.09, 0.14, o, 'bandpass', 3200 * rnd(0.85, 1.15), 2200, 1.3, 0.01);
    return 0.11;
  });
  // --- impactos ---
  S('hit', 1, 0.035, (E, t, o) => {
    E.tone('triangle', 1700 * rnd(0.9, 1.1), 700, t, 0.03, 0.15, o);
    E.hiss(t, 0.012, 0.08, o, 'highpass', 4000, 0, 0.7);
    return 0.05;
  });
  S('tink', 1, 0.035, (E, t, o) => {
    E.tone('sine', 2900, 0, t, 0.09, 0.09, o);
    E.tone('sine', 4310, 0, t, 0.06, 0.06, o);
    return 0.11;
  });
  S('boss_hit', 1, 0.045, (E, t, o) => {
    E.tone('triangle', 420 * rnd(0.95, 1.05), 150, t, 0.05, 0.2, o);
    E.hiss(t, 0.025, 0.13, o, 'bandpass', 1600, 900, 1);
    return 0.07;
  });
  S('pan_hit', 2, 0.04, (E, t, o) => { // "PLÉM!" frigideira: parciais inarmônicos
    const k = rnd(0.94, 1.06);
    for (const [f, d, p] of [[523, 0.35, 0.1], [1182, 0.25, 0.07], [1846, 0.18, 0.05], [2655, 0.12, 0.04]]) E.tone('sine', f * k, 0, t, d, p, o);
    E.hiss(t, 0.02, 0.09, o, 'highpass', 3000, 0, 0.7);
    return 0.38;
  });
  S('graze', 1, 0.05, (E, t, o) => {
    E.tone('sine', 2600, 3500, t, 0.035, 0.07, o);
    E.hiss(t, 0.03, 0.05, o, 'highpass', 7000, 0, 0.7);
    return 0.05;
  });
  // --- explosões ---
  S('explode_s', 2, 0.035, (E, t, o) => {
    const k = rnd(0.88, 1.12);
    E.hiss(t, 0.24, 0.7, o, 'lowpass', 3000 * k, 260, 0.8);
    E.tone('sine', 190 * k, 55, t, 0.14, 0.65, o, 0.002);
    return 0.28;
  });
  S('explode_m', 3, 0.06, (E, t, o) => {
    const k = rnd(0.9, 1.1);
    E.hiss(t, 0.5, 0.8, o, 'lowpass', 2400 * k, 180, 0.8);
    E.tone('sine', 150 * k, 40, t, 0.32, 0.8, o, 0.002);
    E.tone('triangle', 300 * k, 90, t, 0.08, 0.2, o);
    return 0.55;
  });
  S('explode_l', 4, 0.12, (E, t, o) => {
    const k = rnd(0.92, 1.08);
    E.hiss(t, 1.2, 0.8, o, 'lowpass', 1900 * k, 80, 0.8);
    E.tone('sine', 110 * k, 30, t, 0.75, 0.95, o, 0.003);
    E.tone('triangle', 220 * k, 60, t, 0.12, 0.25, o);
    for (let i = 0; i < 4; i++) E.hiss(t + rnd(0.05, 0.55), 0.05, 0.25, o, 'bandpass', rnd(800, 2400), 0, 2);
    return 1.25;
  });
  // --- jogador ---
  S('player_die', 5, 0.3, (E, t, o) => {
    E.hiss(t, 0.9, 0.6, o, 'lowpass', 2800, 140, 0.8);
    E.tone('sine', 140, 35, t, 0.5, 0.7, o);
    const g = E.gain(0, E.filt('lowpass', 2000, 3, o));
    const s = E.osc('sawtooth', 620, t, t + 1.05, g);
    s.frequency.exponentialRampToValueAtTime(70, t + 0.9);
    E.osc('sine', 9, t, t + 1.05, E.gain(60, s.detune));
    E.adsr(g, t, 0.01, 0.26, 0.1, 0.8, 0.75, 0.15);
    return 1.05;
  });
  S('shield_break', 4, 0.1, (E, t, o) => { // vidro estilhaçando
    for (let i = 0; i < 9; i++) E.tone('sine', rnd(2200, 7000), 0, t + rnd(0, 0.18), rnd(0.04, 0.12), rnd(0.05, 0.1), o);
    E.hiss(t, 0.18, 0.35, o, 'highpass', 3500, 0, 0.7);
    E.tone('triangle', 900, 300, t, 0.12, 0.22, o);
    return 0.36;
  });
  S('bomb', 5, 0.25, (E, t, o) => { // Delação Premiada: puxada + estrondo + chiado
    E.hiss(t, 0.06, 0.35, o, 'bandpass', 300, 3500, 1.5, 0.15);
    const tb = t + 0.16;
    E.tone('sine', 85, 26, tb, 1.0, 1.0, o, 0.003);
    E.tone('triangle', 170, 50, tb, 0.4, 0.4, o);
    E.hiss(tb, 1.5, 0.7, o, 'lowpass', 2200, 90, 0.7);
    E.hiss(tb, 1.1, 0.18, o, 'highpass', 5000, 0, 0.7, 0.05);
    return 1.75;
  });
  S('denied', 3, 0.15, (E, t, o) => {
    const lp = E.filt('lowpass', 1300, 1, o);
    E.tone('square', 150, 140, t, 0.09, 0.2, lp, 0.005);
    E.tone('square', 150, 135, t + 0.13, 0.09, 0.2, lp, 0.005);
    return 0.25;
  });
  // --- itens ---
  S('pix', 2, 0.03, (E, t, o, p) => { // "plim" brilhante, sobe de tom em sequência
    const k = Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][clamp(p | 0, 0, 10)] / 12);
    E.tone('sine', 1046.5 * k, 0, t, 0.05, 0.16, o, 0.002);
    E.tone('sine', 1568 * k, 0, t + 0.045, 0.22, 0.17, o, 0.002);
    E.tone('triangle', 3136 * k, 0, t + 0.045, 0.08, 0.04, o);
    return 0.3;
  });
  S('pix_big', 3, 0.05, (E, t, o) => { // ka-ching
    E.hiss(t, 0.02, 0.2, o, 'highpass', 4000, 0, 0.7);
    [84, 88, 91, 96].forEach((m, i) => {
      E.tone('sine', mtof(m), 0, t + 0.02 + i * 0.035, 0.2, 0.15, o, 0.002);
      E.tone('triangle', mtof(m) * 2, 0, t + 0.02 + i * 0.035, 0.06, 0.04, o);
    });
    return 0.4;
  });
  S('powerup', 4, 0.1, (E, t, o) => {
    const lp = E.filt('lowpass', 4000, 0.7, o);
    const d = arp(E, t, lp, [60, 64, 67, 72, 76, 79, 84], 0.032, 0.07, 0.17, 'square', 0.28);
    E.hiss(t, 0.35, 0.05, o, 'highpass', 8000, 0, 0.7, 0.1);
    return d;
  });
  S('item', 3, 0.06, (E, t, o) => {
    E.tone('triangle', 784, 0, t, 0.05, 0.25, o);
    E.tone('triangle', 1175, 0, t + 0.06, 0.13, 0.25, o);
    E.tone('sine', 2350, 0, t + 0.06, 0.08, 0.05, o);
    return 0.22;
  });
  S('extend', 5, 0.3, (E, t, o) => { // vida extra: arpejo + trinado
    const lp = E.filt('lowpass', 5000, 0.7, o);
    arp(E, t, lp, [72, 76, 79, 84], 0.06, 0.08, 0.2, 'square', 0.08);
    arp(E, t + 0.26, lp, [88, 91, 88, 91, 96], 0.05, 0.06, 0.2, 'triangle', 0.4);
    return 0.95;
  });
  // --- chefões e eventos ---
  S('warning', 5, 1.5, (E, t, o) => { // alarme de chefão (≈2,4 s, casa com o banner)
    const lp = E.filt('lowpass', 2200, 1, o);
    for (let i = 0; i < 3; i++) {
      const ti = t + i * 0.78, g = E.gain(0, lp);
      for (const det of [-12, 12]) {
        const s = E.osc('sawtooth', 300, ti, ti + 0.72, g);
        s.detune.setValueAtTime(det, ti);
        s.frequency.linearRampToValueAtTime(620, ti + 0.55);
      }
      E.adsr(g, ti, 0.02, 0.24, 0.05, 0.9, 0.55, 0.1);
      E.tone('square', 1320, 0, ti, 0.08, 0.05, lp);
    }
    const dg = E.gain(0, o);
    E.osc('sine', 55, t, t + 2.55, dg);
    E.osc('triangle', 110, t, t + 2.55, E.gain(0.3, dg));
    E.adsr(dg, t, 0.1, 0.3, 0.1, 0.9, 2.2, 0.2);
    return 2.5;
  });
  S('phase', 4, 0.3, (E, t, o) => { // virada de fase do chefão: gongo + escalada
    E.tone('sine', 110, 35, t, 0.5, 0.8, o);
    E.hiss(t, 0.6, 0.45, o, 'lowpass', 3000, 150, 0.8);
    const lp = E.filt('lowpass', 3000, 1, o);
    [55, 62, 67, 74].forEach((m, i) => E.tone('square', mtof(m), 0, t + 0.08 + i * 0.07, 0.12, 0.09, lp));
    E.hiss(t, 0.5, 0.12, o, 'highpass', 6000, 0, 0.7, 0.2);
    return 0.72;
  });
  S('boss_down', 5, 1, (E, t, o) => { // explosão longa + tom descendo
    E.hiss(t, 2.6, 0.75, o, 'lowpass', 3200, 70, 0.8, 0.01);
    E.tone('sine', 90, 24, t, 1.6, 0.9, o, 0.005);
    const lp = E.filt('lowpass', 3000, 2, o), g = E.gain(0, lp);
    lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 2.4);
    const s1 = E.osc('sawtooth', 880, t, t + 2.7, g), s2 = E.osc('square', 440, t, t + 2.7, E.gain(0.5, g));
    s1.frequency.exponentialRampToValueAtTime(50, t + 2.4);
    s2.frequency.exponentialRampToValueAtTime(26, t + 2.4);
    const vg = E.gain(40, null); E.osc('sine', 7, t, t + 2.7, vg); vg.connect(s1.detune); vg.connect(s2.detune);
    E.adsr(g, t, 0.02, 0.22, 0.2, 0.8, 2.0, 0.4);
    let ti = t + 0.15;
    for (let i = 0; i < 6; i++) { E.hiss(ti, 0.25, 0.4, o, 'lowpass', 2200, 200, 0.7); E.tone('sine', 120, 40, ti, 0.2, 0.4, o); ti += rnd(0.18, 0.3); }
    return 2.8;
  });
  S('laser_warn', 2, 0.15, (E, t, o) => { // zumbido carregando
    const am = E.gain(0.55, o), g = E.gain(0, am);
    const s = E.osc('sine', 220, t, t + 0.72, g);
    s.frequency.exponentialRampToValueAtTime(1100, t + 0.6);
    const s2 = E.osc('triangle', 110, t, t + 0.72, E.gain(0.35, g));
    s2.frequency.exponentialRampToValueAtTime(550, t + 0.6);
    const lfo = E.osc('sine', 16, t, t + 0.72, E.gain(0.45, am.gain));
    lfo.frequency.linearRampToValueAtTime(34, t + 0.6);
    E.adsr(g, t, 0.05, 0.2, 0.1, 0.9, 0.55, 0.1);
    return 0.72;
  });
  S('laser', 3, 0.12, (E, t, o) => { // BWAAAM
    const lp = E.filt('lowpass', 300, 8, o), g = E.gain(0, lp);
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.12); lp.frequency.exponentialRampToValueAtTime(700, t + 0.7);
    E.osc('sawtooth', 92, t, t + 0.9, g); E.osc('sawtooth', 93.5, t, t + 0.9, g); E.osc('square', 184, t, t + 0.9, E.gain(0.5, g));
    E.adsr(g, t, 0.01, 0.3, 0.1, 0.7, 0.55, 0.2);
    E.hiss(t, 0.5, 0.06, o, 'highpass', 6000, 0, 0.7, 0.02);
    return 0.85;
  });
  S('charge', 3, 0.3, (E, t, o) => { // carregando um golpe
    const lp = E.filt('lowpass', 400, 2, o), am = E.gain(0.6, lp), g = E.gain(0, am);
    lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(5000, t + 0.9);
    const s = E.osc('sawtooth', 150, t, t + 1, g), s2 = E.osc('sine', 300, t, t + 1, E.gain(0.4, g));
    s.frequency.exponentialRampToValueAtTime(1200, t + 0.9); s2.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
    const lfo = E.osc('sine', 6, t, t + 1, E.gain(0.4, am.gain)); lfo.frequency.linearRampToValueAtTime(30, t + 0.9);
    E.adsr(g, t, 0.05, 0.16, 0.1, 0.9, 0.85, 0.08);
    return 0.95;
  });
  S('stamp', 4, 0.15, (E, t, o) => { // carimbo "CASSADO!": baque pesado
    E.tone('sine', 125, 38, t, 0.38, 1.0, o, 0.002, 0.12);
    E.hiss(t, 0.07, 0.6, o, 'lowpass', 700, 0, 0.7);
    E.hiss(t, 0.015, 0.3, o, 'highpass', 2500, 0, 0.7);
    E.tone('triangle', 240, 110, t, 0.06, 0.35, o);
    return 0.45;
  });
  S('pause', 3, 0.1, (E, t, o) => {
    E.tone('sine', 880, 0, t, 0.06, 0.13, o);
    E.tone('sine', 660, 0, t + 0.07, 0.1, 0.13, o);
    return 0.2;
  });
  S('buy', 4, 0.1, (E, t, o) => { // caixa registradora
    E.hiss(t, 0.015, 0.4, o, 'highpass', 3000, 0, 0.7);
    E.tone('sine', 160, 90, t, 0.1, 0.25, o);
    E.tone('sine', 2093, 0, t + 0.03, 0.6, 0.14, o);
    E.tone('sine', 2637, 0, t + 0.03, 0.5, 0.1, o);
    E.tone('sine', 3136, 0, t + 0.09, 0.45, 0.08, o);
    return 0.65;
  });
  S('achievement', 4, 0.3, (E, t, o) => { // fanfarrinha
    [67, 72, 76].forEach((m, i) => INST.brass(E, t + i * 0.09, m, 0.08, 0.65, o));
    INST.brass(E, t + 0.27, 79, 0.5, 0.7, o);
    for (const m of [60, 64, 67]) INST.brassLow(E, t + 0.27, m, 0.5, 0.42, o);
    E.hiss(t + 0.27, 0.6, 0.06, o, 'highpass', 7000, 0, 0.7, 0.05);
    return 0.95;
  });
  // --- inimigos ---
  S('enemy_shot', 1, 0.05, (E, t, o) => {
    E.tone('square', 720 * rnd(0.92, 1.08), 360, t, 0.06, 0.075, E.filt('lowpass', 2500, 0.7, o));
    return 0.08;
  });
  S('enemy_shot2', 1, 0.07, (E, t, o) => {
    E.tone('triangle', 330, 95, t, 0.14, 0.18, o);
    E.hiss(t, 0.06, 0.08, o, 'lowpass', 900, 0, 0.7);
    return 0.16;
  });
  S('split', 2, 0.05, (E, t, o) => { // rachadinha se dividindo
    E.tone('sine', 520, 1050, t, 0.11, 0.13, o);
    E.tone('sine', 520, 260, t, 0.11, 0.13, o);
    return 0.13;
  });
  S('ghost', 2, 0.2, (E, t, o) => { // vereador fantasma: "uuuuu"
    const g = E.gain(0, o), s = E.osc('sine', 600, t, t + 0.8, g);
    s.frequency.exponentialRampToValueAtTime(380, t + 0.7);
    E.osc('sine', 7, t, t + 0.8, E.gain(25, s.frequency));
    E.adsr(g, t, 0.12, 0.17, 0.1, 0.8, 0.55, 0.2);
    E.hiss(t, 0.6, 0.04, o, 'bandpass', 1200, 0, 2, 0.15);
    return 0.8;
  });
  S('dash', 2, 0.08, (E, t, o) => { E.hiss(t, 0.18, 0.55, o, 'bandpass', 500, 4200, 2, 0.03); return 0.22; });
  S('whoosh', 2, 0.08, (E, t, o) => { E.hiss(t, 0.36, 0.35, o, 'bandpass', 3000, 380, 1.8, 0.06); return 0.42; });
  S('wind', 2, 0.3, (E, t, o) => { // vento estocado
    const g = E.gain(0, o), bp = E.filt('bandpass', 300, 3, g);
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1300, t + 0.5); bp.frequency.exponentialRampToValueAtTime(350, t + 1.2);
    E.noise(t, t + 1.4, bp);
    E.adsr(g, t, 0.3, 0.55, 0.2, 0.7, 0.9, 0.35);
    E.hiss(t + 0.2, 0.7, 0.05, o, 'bandpass', 2400, 1800, 6, 0.3);
    return 1.3;
  });
  S('bite', 3, 0.2, (E, t, o) => { // Leão da Receita: rosnado + nhac-nhac
    const g = E.gain(0, E.filt('lowpass', 520, 1.5, o)), am = E.gain(0.55, g);
    E.osc('sawtooth', 72, t, t + 0.42, am); E.osc('sawtooth', 75.5, t, t + 0.42, am);
    E.osc('sine', 26, t, t + 0.42, E.gain(0.45, am.gain));
    E.adsr(g, t, 0.03, 0.4, 0.1, 0.8, 0.28, 0.08);
    E.hiss(t, 0.3, 0.1, o, 'bandpass', 600, 0, 1.5, 0.05);
    for (const [dt, k] of [[0.3, 1], [0.43, 0.8]]) {
      E.hiss(t + dt, 0.04, 0.4 * k, o, 'lowpass', 2200, 600, 0.8);
      E.tone('sine', 230, 80, t + dt, 0.07, 0.38 * k, o);
      E.tone('square', 1400, 900, t + dt, 0.012, 0.05 * k, o);
    }
    return 0.55;
  });
  S('siren', 3, 0.5, (E, t, o) => { // carro de som / sirene
    const g = E.gain(0, E.filt('lowpass', 3200, 0.7, o));
    const s = E.osc('triangle', 760, t, t + 1.05, g), s2 = E.osc('square', 760, t, t + 1.05, E.gain(0.2, g));
    let prev = 760;
    for (let i = 0; i < 4; i++) { // fi-fó: 760 / 1010 Hz com deslizes de 30 ms
      const f = i % 2 ? 1010 : 760, ti = t + i * 0.25;
      for (const x of [s, s2]) { x.frequency.setValueAtTime(prev, ti); x.frequency.linearRampToValueAtTime(f, ti + 0.03); }
      prev = f;
    }
    E.adsr(g, t, 0.02, 0.18, 0.05, 1, 0.95, 0.05);
    return 1.05;
  });
  S('motor', 3, 0.3, (E, t, o) => motorSynth(E, t, o, 0.3, 1.0));
  S('splash', 2, 0.08, (E, t, o) => {
    E.hiss(t, 0.38, 0.45, o, 'bandpass', 1300, 700, 0.7, 0.005);
    E.hiss(t, 0.15, 0.25, o, 'highpass', 3500, 0, 0.7);
    for (let i = 0; i < 5; i++) { const f = rnd(1200, 2400); E.tone('sine', f, f * 1.6, t + rnd(0.04, 0.32), 0.035, 0.08, o, 0.002); }
    return 0.42;
  });
  S('laugh', 3, 0.6, (E, t, o) => laughSynth(E, t, o, 0.5));
  S('shout', 3, 0.3, (E, t, o) => shoutSynth(E, t, o, 0.4));
  S('spawn', 1, 0.06, (E, t, o) => { E.tone('sine', 260, 720, t, 0.08, 0.12, o, 0.003, 0.06); return 0.1; });
  // --- interface ---
  S('ui_click', 3, 0.03, (E, t, o) => {
    E.tone('square', 1250, 950, t, 0.018, 0.12, E.filt('lowpass', 4000, 0.7, o), 0.001);
    E.tone('sine', 2500, 0, t, 0.01, 0.06, o, 0.001);
    return 0.04;
  });
  S('ui_back', 3, 0.05, (E, t, o) => {
    E.tone('triangle', 700, 0, t, 0.05, 0.15, o);
    E.tone('triangle', 470, 0, t + 0.055, 0.07, 0.15, o);
    return 0.14;
  });
  S('ui_confirm', 3, 0.12, (E, t, o) => urnaSynth(E, t, o, 4, 0.3, 0.12));
  S('urna_fim', 5, 0.5, (E, t, o) => urnaSynth(E, t, o, 7, 0.95, 0.14));
  S('ui_type', 1, 0.035, (E, t, o) => { E.tone('triangle', pick([880, 988, 1175, 1319, 1480]), 0, t, 0.02, 0.1, o, 0.002); return 0.03; });

  // ===================== Instrumentos da trilha =====================
  // fn(E, t, midi, dur, vel, dest)
  function brassCore(E, t, m, d, v, dest, bright, lvl) {
    const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 500, 1.4, g);
    const end = E.adsr(g, t, 0.018, lvl * v, 0.12, 0.75, d, 0.07) + 0.02;
    const top = bright * (0.55 + 0.45 * v);
    lp.frequency.setValueAtTime(450, t);
    lp.frequency.exponentialRampToValueAtTime(top, t + 0.035);
    lp.frequency.exponentialRampToValueAtTime(top * 0.55, t + 0.22);
    let o;
    for (const det of [-7, 7]) { o = E.osc('sawtooth', f, t, end, lp); o.detune.setValueAtTime(det - 45, t); o.detune.linearRampToValueAtTime(det, t + 0.04); }
    E.fin(o, g);
  }
  const INST = {
    // violão de nylon
    pluck(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 3000, 0.8, g);
      lp.frequency.setValueAtTime(1500 + 2500 * v, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.35);
      const end = E.perc(g, t, 0.003, 0.4 * v, clamp(d * 1.5, 0.3, 1.4)) + 0.02;
      const o = E.osc('triangle', f, t, end, lp);
      E.osc('sawtooth', f * 1.003, t, end, E.gain(0.2, lp));
      E.fin(o, g);
    },
    // harpa / dedilhado
    harp(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 3500, 0.7, g);
      const end = E.perc(g, t, 0.004, 0.38 * v, clamp(d * 2, 0.5, 1.6)) + 0.02;
      const o = E.osc('triangle', f, t, end, lp);
      E.osc('sine', f * 2, t, end, E.gain(0.25, lp));
      E.fin(o, g);
    },
    // cavaquinho: brilhante e seco
    cavaco(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 5000, 1.2, g);
      lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.15);
      const end = E.perc(g, t, 0.002, 0.4 * v, clamp(d * 1.2, 0.12, 0.35)) + 0.02;
      const o = E.osc('sawtooth', f, t, end, lp);
      E.osc('square', f * 1.004, t, end, E.gain(0.5, lp));
      E.fin(o, g);
    },
    // viola caipira: cordas duplas (oitava) metálicas
    viola(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 4200, 0.7, g);
      const end = E.perc(g, t, 0.003, 0.52 * v, clamp(d * 1.5, 0.25, 0.9)) + 0.02;
      const o = E.osc('triangle', f, t, end, lp);
      E.osc('sawtooth', f * 2.003, t, end, E.gain(0.15, lp));
      E.osc('sawtooth', f * 0.998, t, end, E.gain(0.25, lp));
      E.fin(o, g);
    },
    // piano elétrico (FM 1:1)
    rhodes(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest);
      const end = E.adsr(g, t, 0.004, 0.3 * v, 0.5, 0.45, d, 0.35) + 0.02;
      const c = E.osc('sine', f, t, end, g);
      try { c.frequency.automationRate = 'a-rate'; } catch (e) { /* nada */ } // FM em taxa de áudio
      const ig = E.gain(0, c.frequency);
      ig.gain.setValueAtTime(f * 1.4 * v, t); ig.gain.exponentialRampToValueAtTime(f * 0.15 + 1, t + 0.6);
      E.osc('sine', f, t, end, ig);
      E.fin(c, g);
    },
    vibes(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), tr = E.gain(0.8, g);
      const end = E.perc(g, t, 0.002, 0.32 * v, clamp(d * 2.5, 0.6, 1.8)) + 0.02;
      const o = E.osc('sine', f, t, end, tr), hg = E.gain(0, tr);
      E.osc('sine', f * 4, t, t + 0.25, hg); E.perc(hg, t, 0.001, 0.12, 0.2);
      E.osc('sine', 5.2, t, end, E.gain(0.2, tr.gain));
      E.fin(o, g);
    },
    musicbox(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest);
      const end = E.perc(g, t, 0.002, 0.3 * v, clamp(d * 3, 0.5, 1.4)) + 0.02;
      const o = E.osc('sine', f, t, end, g), hg = E.gain(0, g);
      E.osc('sine', f * 3.01, t, t + 0.3, hg); E.perc(hg, t, 0.001, 0.35, 0.25);
      E.fin(o, g);
    },
    flute(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest);
      const end = E.adsr(g, t, 0.045, 0.4 * v, 0.1, 0.85, d, 0.09) + 0.02;
      const o = E.osc('sine', f, t, end, g), o2 = E.osc('triangle', f * 2, t, end, E.gain(0.07, g));
      const vg = E.gain(0, null);
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(14, t + 0.3);
      vg.connect(o.detune); vg.connect(o2.detune);
      E.osc('sine', 5.3, t, end, vg);
      const ng = E.gain(0, g);
      E.noise(t, end, E.filt('bandpass', f * 2, 1.5, ng));
      E.adsr(ng, t, 0.02, 0.1, 0.06, 0.25, d, 0.05);
      E.fin(o, g);
    },
    // sanfona: 3 pulsos (musette) + vibrato
    accordion(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 3200, 0.5, g);
      const end = E.adsr(g, t, 0.014, 0.17 * v, 0.08, 0.85, d, 0.06) + 0.02;
      const vg = E.gain(7, null);
      E.osc('sine', 5.6, t, end, vg);
      let o;
      for (const det of [-8, 0, 8]) { o = E.osc(E.pulse25, f, t, end, lp); o.detune.setValueAtTime(det, t); vg.connect(o.detune); }
      E.fin(o, g);
    },
    // baixos da sanfona (acordes curtos)
    accChord(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 1800, 0.5, g);
      const end = E.adsr(g, t, 0.008, 0.18 * v, 0.05, 0.7, d, 0.04) + 0.02;
      const o = E.osc(E.pulse25, f, t, end, lp);
      E.fin(o, g);
    },
    brass(E, t, m, d, v, dest) { brassCore(E, t, m, d, v, dest, 3600, 0.26); },
    brassLow(E, t, m, d, v, dest) { brassCore(E, t, m, d, v, dest, 2000, 0.2); },
    // lead de onda quadrada (funk)
    lead(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 2600, 4, g);
      lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(1500, t + 0.18);
      const end = E.adsr(g, t, 0.004, 0.2 * v, 0.12, 0.7, d, 0.06) + 0.02;
      const o = E.osc('square', f, t, end, lp);
      o.detune.setValueAtTime(-120, t); o.detune.linearRampToValueAtTime(0, t + 0.035);
      if (d > 0.25) { const vg = E.gain(0, o.detune); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(18, t + 0.3); E.osc('sine', 6, t, end, vg); }
      E.fin(o, g);
    },
    // guitarra solo (vai para o pedal 'lead')
    distLead(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest);
      const end = E.adsr(g, t, 0.005, 0.22 * v, 0.1, 0.85, d, 0.07) + 0.02;
      const o = E.osc('sawtooth', f, t, end, g), o2 = E.osc('square', f * 0.5, t, end, E.gain(0.35, g));
      if (d > 0.25) {
        const vg = E.gain(0, null); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(22, t + 0.25);
        E.osc('sine', 5.8, t, end, vg); vg.connect(o.detune); vg.connect(o2.detune);
      }
      E.fin(o, g);
    },
    // corda de power chord (vai para o pedal 'gtr'); nota curta = abafada
    gtr(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), mute = d < 0.16;
      const lp = E.filt('lowpass', mute ? 800 : 6000, 0.8, g);
      const end = E.adsr(g, t, 0.003, 0.2 * v, mute ? 0.06 : 0.15, mute ? 0.4 : 0.8, d, 0.05) + 0.02;
      const o = E.osc('sawtooth', f, t, end, lp);
      E.osc('sawtooth', f * 1.004, t, end, lp);
      E.fin(o, g);
    },
    // contrabaixo (com harmônicos para aparecer no alto-falante do celular)
    bass(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 900, 1, g);
      lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.15);
      const end = E.adsr(g, t, 0.005, 0.5 * v, 0.18, 0.55, d, 0.06) + 0.02;
      const o = E.osc('triangle', f, t, end, lp);
      E.osc('sawtooth', f, t, end, E.gain(0.3, lp));
      E.fin(o, g);
    },
    // baixo "motor" do rock: cada nota dá uma acelerada
    motorBass(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 1100, 3, g);
      lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.09);
      const end = E.adsr(g, t, 0.003, 0.42 * v, 0.06, 0.6, d, 0.03) + 0.02;
      const o = E.osc('sawtooth', f, t, end, lp);
      o.detune.setValueAtTime(-30, t); o.detune.linearRampToValueAtTime(10, t + d);
      E.osc('square', f * 0.5, t, end, E.gain(0.3, lp));
      E.fin(o, g);
    },
    tuba(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 750, 0.8, g);
      const end = E.adsr(g, t, 0.025, 0.5 * v, 0.1, 0.7, d, 0.06) + 0.02;
      const o = E.osc('triangle', f, t, end, lp);
      o.detune.setValueAtTime(-35, t); o.detune.linearRampToValueAtTime(0, t + 0.05);
      E.osc('sawtooth', f, t, end, E.gain(0.35, lp));
      E.fin(o, g);
    },
    // 808 do funk: seno com queda de pitch + saturação (harmônicos audíveis)
    sub(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), sh = E.ac.createWaveShaper();
      sh.curve = DIST_SOFT; sh.connect(g);
      const end = E.perc(g, t, 0.003, 0.5 * v, clamp(d * 1.1, 0.3, 0.9)) + 0.02;
      const o = E.osc('sine', f * 3, t, end, E.gain(2.2, sh));
      o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
      E.fin(o, g);
    },
    // cordas (pad)
    pad(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 1500, 0.4, g);
      const end = E.adsr(g, t, Math.min(0.35, d * 0.4), 0.09 * v, 0.2, 0.85, d, 0.5) + 0.02;
      let o;
      for (const det of [-11, 0, 11]) { o = E.osc('sawtooth', f, t, end, lp); o.detune.setValueAtTime(det, t); }
      E.fin(o, g);
    },
    // coro "aah": serras passando por formantes
    choir(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), mix = E.gain(1, null);
      const end = E.adsr(g, t, Math.min(0.3, d * 0.4), 0.5 * v, 0.2, 0.85, d, 0.45) + 0.02;
      for (const [ff, q, a] of [[800, 6, 1], [1150, 7, 0.55], [2700, 9, 0.3]]) mix.connect(E.filt('bandpass', ff, q, E.gain(a, g)));
      const vg = E.gain(9, null);
      E.osc('sine', 4.7 + Math.random(), t, end, vg);
      let o;
      for (const det of [-9, 9]) { o = E.osc('sawtooth', f, t, end, mix); o.detune.setValueAtTime(det, t); vg.connect(o.detune); }
      E.fin(o, g);
    },
    // "orchestra hit" (marca registrada do funk/miami bass)
    orch(E, t, m, d, v, dest) {
      const f = mtof(m), g = E.nv(dest), lp = E.filt('lowpass', 6000, 1, g);
      lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
      const end = E.perc(g, t, 0.003, 0.28 * v, 0.45) + 0.02;
      const o = E.osc('sawtooth', f, t, end, lp);
      E.osc('sawtooth', f * 2.004, t, end, lp);
      E.fin(o, g);
    },
  };

  // ===================== Percussão =====================
  // fn(E, t, char, vel, dest, stepDur). Maiúscula = acento.
  const DRUM = {
    kick(E, t, c, v, dest) {
      const g = E.nv(dest, 1);
      const o = E.tone('sine', 165, 48, t, 0.32, 0.95 * v, g, 0.002, 0.1);
      E.tone('triangle', 330, 90, t, 0.05, 0.25 * v, g, 0.001);
      E.hiss(t, 0.008, 0.25 * v, g, 'highpass', 3500, 0, 0.7);
      E.fin(o, g);
    },
    snare(E, t, c, v, dest, sd) {
      if (c === 'r') { DRUM.snare(E, t, 'x', v * 0.75, dest); DRUM.snare(E, t + sd / 2, 'x', v * 0.85, dest); return; }
      const g = E.nv(dest, 1);
      const s = E.hiss(t, 0.17, 0.85 * v, g, 'bandpass', 2400, 1700, 0.6);
      E.tone('triangle', 200, 160, t, 0.08, 0.5 * v, g);
      E.fin(s, g);
    },
    // caixa de samba/frevo: seca e chiada
    caixa(E, t, c, v, dest, sd) {
      if (c === 'r') { DRUM.caixa(E, t, 'x', v * 0.8, dest); DRUM.caixa(E, t + sd / 2, 'x', v * 0.9, dest); return; }
      const g = E.nv(dest, 1);
      const s = E.hiss(t, c === 'X' ? 0.1 : 0.06, 0.6 * v, g, 'highpass', 2400, 0, 0.7);
      E.tone('sine', 340, 300, t, 0.03, 0.1 * v, g);
      E.fin(s, g);
    },
    rim(E, t, c, v, dest) {
      const g = E.nv(dest, 1);
      const o = E.tone('triangle', 1750, 0, t, 0.03, 0.3 * v, g, 0.001);
      E.tone('square', 820, 0, t, 0.02, 0.06 * v, g, 0.001);
      E.fin(o, g);
    },
    hat(E, t, c, v, dest) {
      const g = E.nv(dest, 1);
      E.fin(E.hiss(t, c === 'o' ? 0.24 : 0.035, 0.34 * v, g, 'highpass', 7500, 0, 0.7), g);
    },
    shaker(E, t, c, v, dest) {
      const g = E.nv(dest, 1);
      E.fin(E.hiss(t, 0.05, 0.18 * v, g, 'bandpass', 5500, 0, 0.9, 0.012), g);
    },
    clap(E, t, c, v, dest) {
      const g = E.nv(dest, 1), cg = E.gain(0, g), p = cg.gain;
      const s = E.noise(t, t + 0.3, E.filt('bandpass', 1150, 1.1, cg));
      p.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) {
        const ti = t + i * 0.011;
        p.setValueAtTime(0.0001, ti); p.linearRampToValueAtTime(0.9 * v, ti + 0.001); p.exponentialRampToValueAtTime(0.08 * v, ti + 0.009);
      }
      p.setValueAtTime(0.75 * v, t + 0.034); p.exponentialRampToValueAtTime(0.0001, t + 0.22);
      E.fin(s, g);
    },
    crash(E, t, c, v, dest) {
      const g = E.nv(dest, 1), d = c === 'c' ? 0.2 : 1.4;
      const s = E.hiss(t, d, 0.3 * v, g, 'highpass', 3800, 0, 0.7);
      E.hiss(t, d * 0.6, 0.12 * v, g, 'bandpass', 9000, 0, 1);
      E.fin(s, g);
    },
    // pratos de frevo/marcha (batidos)
    prato(E, t, c, v, dest) {
      const g = E.nv(dest, 1);
      E.fin(E.hiss(t, c === 'X' ? 0.55 : 0.22, 0.3 * v, g, 'bandpass', 6000, 0, 0.5), g);
    },
    tom(E, t, c, v, dest) {
      const f = { h: 220, m: 165, l: 118 }[c.toLowerCase()] || 165, g = E.nv(dest, 1);
      const o = E.tone('sine', f * 1.5, f, t, 0.3, 0.7 * v, g, 0.002, 0.05);
      E.tone('triangle', f * 3, f * 2, t, 0.12, 0.15 * v, g);
      E.fin(o, g);
    },
    // zabumba: O = aberta, x = abafada, b = bacalhau (baqueta fina por baixo)
    zab(E, t, c, v, dest) {
      const g = E.nv(dest, 1);
      let o;
      if (c === 'b' || c === 'B') {
        o = E.tone('triangle', 1200, 0, t, 0.02, 0.15 * v, g);
        E.hiss(t, 0.035, 0.5 * v, g, 'bandpass', 3500, 0, 1.5);
      } else if (c === 'O') {
        o = E.tone('sine', 100, 62, t, 0.42, 0.9 * v, g, 0.002, 0.08);
        E.tone('triangle', 200, 124, t, 0.15, 0.3 * v, g, 0.002, 0.08);
        E.hiss(t, 0.05, 0.3 * v, g, 'lowpass', 600, 0, 0.7);
      } else {
        o = E.tone('sine', 90, 65, t, 0.12, 0.7 * v, g, 0.002);
        E.tone('triangle', 180, 130, t, 0.06, 0.2 * v, g);
        E.hiss(t, 0.03, 0.2 * v, g, 'lowpass', 600, 0, 0.7);
      }
      E.fin(o, g);
    },
    // triângulo: x = abafado, o = aberto
    tri(E, t, c, v, dest) {
      const g = E.nv(dest, 1), d = c === 'o' || c === 'O' ? 0.32 : 0.035, k = rnd(0.995, 1.005);
      let o;
      for (const f of [5100, 6750, 8300]) o = E.tone('sine', f * k, 0, t, d, 0.1 * v, g, 0.001);
      E.fin(o, g);
    },
    // surdo: O = de primeira (grave), h = de segunda, x = abafado
    surdo(E, t, c, v, dest) {
      const g = E.nv(dest, 1), lc = c.toLowerCase();
      let o;
      if (lc === 'x') o = E.tone('sine', 88, 62, t, 0.1, 0.75 * v, g);
      else {
        const hi = lc === 'h', f0 = hi ? 98 : 78, f1 = hi ? 74 : 54;
        o = E.tone('sine', f0 * 1.1, f1, t, hi ? 0.45 : 0.65, v, g, 0.002, 0.12);
        E.tone('triangle', f0 * 2, f1 * 2, t, 0.2, 0.25 * v, g, 0.002, 0.12);
        E.hiss(t, 0.04, 0.3 * v, g, 'lowpass', 400, 0, 0.7);
      }
      E.fin(o, g);
    },
    tamb(E, t, c, v, dest) {
      const g = E.nv(dest, 1);
      const o = E.tone('sine', 780, 690, t, 0.05, 0.4 * v, g, 0.001);
      E.hiss(t, 0.03, 0.35 * v, g, 'bandpass', 4200, 0, 2);
      E.fin(o, g);
    },
    // agogô: h = campana aguda, l = grave
    agogo(E, t, c, v, dest) {
      const f = c === 'l' || c === 'L' ? 880 : 1245, g = E.nv(dest, 1);
      const o = E.tone('sine', f, 0, t, 0.3, 0.3 * v, g, 0.001);
      E.tone('sine', f * 2.68, 0, t, 0.12, 0.14 * v, g, 0.001);
      E.fin(o, g);
    },
    // cuíca: u/d = sobe/desce, U/D = longo
    cuica(E, t, c, v, dest) {
      const up = c === 'u' || c === 'U', dur = c === 'U' || c === 'D' ? 0.28 : 0.13;
      const g = E.nv(dest, 1), g2 = E.gain(0, g);
      const o = E.osc('sawtooth', up ? 400 : 760, t, t + dur + 0.05, E.filt('bandpass', 950, 2.2, g2));
      o.frequency.exponentialRampToValueAtTime(up ? 820 : 360, t + dur * 0.8);
      E.adsr(g2, t, 0.015, 0.65 * v, 0.05, 0.8, dur - 0.04, 0.04);
      E.fin(o, g);
    },
    // apito do mestre de bateria: w = curto, W = longo
    apito(E, t, c, v, dest) {
      const dur = c === 'W' ? 0.6 : 0.22, g = E.nv(dest, 1), g2 = E.gain(0, g);
      const o = E.osc('sine', 2950, t, t + dur + 0.05, g2);
      E.osc('square', 26, t, t + dur + 0.05, E.gain(160, o.frequency));
      E.adsr(g2, t, 0.01, 0.16 * v, 0.05, 0.85, dur, 0.03);
      E.fin(o, g);
    },
    // tambor do tamborzão: x = grave, h = agudo
    tambor(E, t, c, v, dest) {
      const hi = c === 'h' || c === 'H', f0 = hi ? 300 : 215, f1 = hi ? 225 : 160, g = E.nv(dest, 1);
      const o = E.tone('sine', f0, f1, t, 0.16, 0.6 * v, g, 0.002, 0.05);
      E.tone('triangle', f0 * 2, f1 * 2, t, 0.06, 0.12 * v, g);
      E.hiss(t, 0.02, 0.3 * v, g, 'bandpass', 1800, 0, 1.5);
      E.fin(o, g);
    },
    // virada de ruído: u = sobe por 1 compasso, d = desce
    sweep(E, t, c, v, dest, sd) {
      const up = c === 'u' || c === 'U', dur = (up ? 16 : 8) * sd, g = E.nv(dest, 1), g2 = E.gain(0, g);
      const bp = E.filt('bandpass', up ? 400 : 6000, 3, g2);
      bp.frequency.setValueAtTime(up ? 400 : 6000, t);
      bp.frequency.exponentialRampToValueAtTime(up ? 6500 : 300, t + dur);
      const s = E.noise(t, t + dur + 0.05, bp);
      g2.gain.setValueAtTime(0.0001, t);
      if (up) { g2.gain.linearRampToValueAtTime(0.3 * v, t + dur - 0.01); g2.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02); }
      else { g2.gain.linearRampToValueAtTime(0.3 * v, t + 0.02); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
      E.fin(s, g);
    },
    // acelerada de moto (motociata)
    rev(E, t, c, v, dest) { const g = E.nv(dest, 1); motorSynth(E, t, g, 0.35 * v, 0.9); endMarker(E, g, t + 1.1); },
    // grito "ê!" (vocal chop)
    vox(E, t, c, v, dest) { const g = E.nv(dest, 1); shoutSynth(E, t, g, 0.4 * v); endMarker(E, g, t + 0.5); },
  };
  // para vozes compostas sem uma fonte "principal": uma fonte silenciosa marca o fim
  function endMarker(E, g, tEnd) {
    const s = E.ac.createConstantSource ? E.ac.createConstantSource() : E.ac.createOscillator();
    const z = E.gain(0, g);
    s.connect(z); s.start(tEnd - 0.01); s.stop(tEnd);
    E.fin(s, g);
  }

  // ===================== Composições (todas originais) =====================
  // Notas: um token por semicolcheia. "-" segura, "." pausa, "C5+E5" empilha.
  // Baixo: graus do acorde (1 3 5 7 8 -5 a=aproximação cromática) ou notas.
  // Bateria: um caractere por semicolcheia (maiúscula = acento). "+chave" = só no clímax.
  const SONGS = {};

  // ---------- MENU — "Tema do Fusca" (bossa nova) ----------
  const MENU_A = [
    'C5 . A4 . C5 - E5 - - - . D5 C5 - . .',
    'D5 - - - . . . . . . Bb4 . A4 - G4 -',
    'A4 - - - . C5 . A4 . C5 . F5 - - - -',
    'E5 - - - . . . . . D5 . C5 . A4 - -',
    'Bb4 . D5 . F5 - - - . G5 - - F5 - D5 -',
    'F5 - - - . . . . Db5 - - - C5 - - -',
    'C5 - - - . A4 . C5 . Eb5 - - D5 - C5 -',
    'Bb4 - - - . . . . . . . G4 A4 . Bb4 .',
  ];
  const MENU_B = [
    'F5 - - D5 - - A5 - - - - - G5 - F5 -',
    'F5 - - - - - Db5 - - - - - C5 - Bb4 -',
    'C5 - - - - - E5 - - - G5 - - - E5 -',
    'F#5 - - - - - Eb5 - - - D5 - - - C5 -',
    'Bb4 - - D5 - - F5 - - - A5 - - - G5 -',
    'E5 - - - - - D5 - - - - - Bb4 - - -',
    'A4 - - C5 - - E5 - - - - - - - - -',
    '. . . . . . . . G4 . A4 . Bb4 . . .',
  ];
  SONGS.menu = {
    bpm: 112, swing: 0.08, scale: 'F major', gain: 0.88,
    def: {
      bars: 8,
      chords: ['Fmaj7', 'Gm7 C7', 'Fmaj7', 'Am7 D7', 'Gm7', 'Bbm6', 'Am7 D7b9', 'Gm7 C7'],
      bass: { inst: 'bass', pat: '1 - - - - - 5 - 1 - - - - - 5 -', low: 36, vel: 0.8 },
      comp: { inst: 'pluck', pat: 'x..x..x...x..x..', low: 53, v: 'rootless', vel: 0.55, len: 3, strum: 0.011 },
      drums: { kick: 'x.....x.x.....x.', rim: 'x.....x.....x.......x.....x.....', shaker: 'X.x.X.xxX.x.X.xx' },
      dv: { kick: 0.55, rim: 0.9, shaker: 0.7 },
      fill: { rim: '..x..x..x.x.x.x.', shaker: 'X.x.X.x.X.x.XxXx', kick: 'x.....x.x.......' },
    },
    sec: {
      A: { parts: [{ inst: 'flute', notes: MENU_A, vel: 0.72 }] },
      A2: {
        parts: [{ inst: 'flute', notes: MENU_A, vel: 0.72, harm: 'c', hinst: 'vibes', hvel: 0.6 }],
        pad: { inst: 'rhodes', low: 57, vel: 0.32, v: 'rootless' },
      },
      B: {
        chords: ['Bbmaj7', 'Bbm6', 'Am7', 'D7b9', 'Gm7', 'C9', 'Fmaj7', 'C7'],
        parts: [{ inst: 'vibes', notes: MENU_B, vel: 0.85 }],
        pad: { inst: 'rhodes', low: 57, vel: 0.36, v: 'rootless' },
        comp: { inst: 'pluck', pat: 'x.....x.....x.......x.....x.....', low: 53, v: 'rootless', vel: 0.36, len: 4, strum: 0.012 },
      },
      A3: { parts: [{ inst: 'flute', notes: MENU_A, vel: 0.72 }, { inst: 'vibes', notes: MENU_A, vel: 0.5, oct: -12 }] },
    },
    order: ['A', 'A2', 'B', 'A3'],
  };

  // ---------- HISTÓRIA — valsinha (3/4): brincalhona e um pouco melancólica ----------
  const STORY_A = [
    'E5 - - - - - - - A5 - B5 -',
    'C6 - - - - - B5 - A5 - - -',
    'B5 - - - - - A5 - G5 - - -',
    'G5 - - - - - - - E5 - - -',
    'A5 - - - - - G5 - F5 - - -',
    'F5 - - - - - E5 - D5 - - -',
    'E5 - - - G#5 - - - B5 - D6 -',
    'C6 - - - B5 - G#5 - - - B5 -',
  ];
  const STORY_A2 = STORY_A.slice(0, 6).concat(['D6 - - - - - C6 - B5 - G#5 -', 'A5 - - - - - - - - - - -']);
  const STORY_B = [
    'A5 - C6 - A5 - F5 - - - A5 -',
    'B5 - D6 - B5 - G5 - - - B5 -',
    'G5 - - - E5 - - - D5 - E5 -',
    'C6 - - - - - - - . . . .',
    'F5 - A5 - D6 - - - C6 - A5 -',
    'B5 - - - G5 - - - F5 - D5 -',
    'E5 - G5 - B5 - - - C6 - - -',
    'B5 - - - - - G#5 - - - E5 -',
  ];
  SONGS.story = {
    bpm: 100, spb: 12, scale: 'A minor', gain: 1.14,
    def: {
      bars: 8, chords: ['Am', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Bm7b5', 'E7', 'Am E7'],
      bass: { inst: 'bass', pat: '1 - - - . . . . . . . . 5 - - - . . . . . . . .', low: 36, vel: 0.6 },
      comp: { inst: 'harp', pat: '....x...x...', low: 55, vel: 0.33, len: 3, v: 'triad' },
      drums: { shaker: '....x...x...' }, dv: { shaker: 0.25 },
    },
    sec: {
      A: { parts: [{ inst: 'musicbox', notes: STORY_A, vel: 0.75 }] },
      A2: { parts: [{ inst: 'musicbox', notes: STORY_A2, vel: 0.75 }, { inst: 'flute', notes: STORY_A2, vel: 0.35, oct: -12 }] },
      B: {
        chords: ['F', 'G', 'Em7', 'Am', 'Dm7', 'G7', 'Cmaj7', 'E7'],
        parts: [{ inst: 'harp', notes: STORY_B, vel: 0.7 }, { inst: 'musicbox', notes: STORY_B, vel: 0.25, oct: 12 }],
        pad: { inst: 'pad', low: 52, vel: 0.25 },
        drums: { shaker: 'x.x.x.x.x.x.', rim: '....x.......' }, dv: { shaker: 0.22, rim: 0.3 },
      },
    },
    order: ['A', 'A2', 'B', 'A2'],
  };

  // ---------- FASE 1 — Rodoviária: forró/baião (zabumba, triângulo, sanfona) ----------
  const FORRO_A = [
    'F#5 - - A5 - - F#5 - D5 - - E5 - - F#5 -',
    'E5 - - D5 - - C5 - - . A4 - B4 - C5 -',
    'D5 - - - - - B4 - D5 - - G5 - - - -',
    'G5 - F#5 - E5 - D5 - B4 - - - . . . .',
    'E5 - - G5 - - E5 - C#5 - - E5 - - A5 -',
    'G5 - F#5 - E5 - D5 - B4 - - D5 - - - -',
    'F#5 - - A5 - - D6 - - - C6 - B5 - A5 -',
    'G5 - E5 - C#5 - A4 - D5 - - - . . . .',
  ];
  const FORRO_B = [
    'D5 - - - F#5 - - - B5 - - - - - A5 -',
    'B5 - - - - - - - . . F#5 - G5 - A5 -',
    'B5 - - - A5 - G5 - - - F#5 - G5 - - -',
    'E5 - - - - - - - . . C#5 - D5 - E5 -',
    'F#5 - - - D5 - - - B4 - - - D5 - F#5 -',
    'G5 - - - - - E5 - - - B4 - E5 - G5 -',
    'A5 - G5 - F#5 - E5 - C#5 - E5 - G5 - A5 -',
    'F#5 - - - D5 - - - . . . . . . . .',
  ];
  const FORRO_C = [
    'A5 - A5 - A5 - F#5 - A5 - - - . . . .',
    '. . . . . . . . G5 - F#5 - E5 - D5 -',
    'B5 - B5 - B5 - G5 - B5 - - - . . . .',
    '. . . . . . . . A5 - G5 - F#5 - E5 -',
    'D6 - - C6 - - A5 - F#5 - - A5 - - C6 -',
    'D6 - - - - - - - . . . . . . . .',
    'C#6 - - A5 - - G5 - E5 - - G5 - - A5 -',
    'G5 - - - E5 - - - C#5 - - - A4 - - -',
  ];
  SONGS.stage1 = {
    bpm: 136, swing: 0.04, scale: 'D mixo', gain: 0.885,
    def: {
      bars: 8, chords: ['D', 'D7', 'G', 'G', 'A7', 'G', 'D', 'A7 D'],
      bass: { inst: 'bass', pat: '1 - - 1 - - 5 - 1 - - 1 - - 5 -', low: 38, vel: 0.8 },
      comp: { inst: 'accChord', pat: '..x...x...x...x.', low: 57, vel: 0.4, len: 1.5, v: 'triad' },
      drums: { zab: 'O..O..x.O..O..x.', zab_b: '..b...b...b...b.', tri: 'xxoxxxoxxxoxxxox' },
      dv: { zab: 0.95, zab_b: 0.65, tri: 0.85 },
      fill: { zab: 'O.OO.OO.O.OOO.O.', tri: 'xxoxxxoxxxoxoooo' },
    },
    sec: {
      A: { parts: [{ inst: 'accordion', notes: FORRO_A, vel: 0.85 }] },
      A2: { parts: [{ inst: 'accordion', notes: FORRO_A, vel: 0.85, harm: -2, hvel: 0.55 }] },
      B: {
        chords: ['Bm', 'Bm', 'G', 'A7', 'Bm', 'Em', 'A7', 'D'],
        parts: [{ inst: 'accordion', notes: FORRO_B, vel: 0.85, harm: 'c', hvel: 0.45 }],
      },
      C: {
        chords: ['D', 'D', 'G', 'G', 'D', 'D', 'A7', 'A7'],
        parts: [{ inst: 'accordion', notes: FORRO_C, vel: 0.9 }],
        comp: { inst: 'accChord', pat: 'x..x..x.x..x..x.', low: 57, vel: 0.35, len: 1.5, v: 'triad' },
        drums2: { shaker: 'x.x.x.x.x.x.x.x.' }, dv2: { shaker: 0.3 },
      },
    },
    order: ['A', 'A2', 'B', 'C'],
  };

  // ---------- FASE 2 — Esplanada: samba batucada ----------
  const SAMBA_A = [
    'D5 . G5 . B5 - - A5 - - G5 - - - . D5',
    'E5 - - G#5 - - B5 - D6 - - B5 - - G#5 -',
    'A5 - - - - - G5 - E5 - - C5 - - E5 -',
    'F#5 - - - - - . . . . A5 - C6 - B5 A5',
    'B5 - - D6 - - B5 - G#5 - - B5 - - E5 -',
    'C6 - - A5 - - E5 - F#5 - - A5 - - C6 -',
    'B5 - - - - - - - - - . D5 G5 . B5 .',
    'A5 - - - - - F#5 - D5 - - - . . . .',
  ];
  const SAMBA_B = [
    'E5 . E5 . G5 . B5 - - - G5 - E5 - - -',
    'D#5 . D#5 . F#5 . A5 - - - F#5 - D#5 - - -',
    'E5 . G5 . B5 . E6 - - - D6 - B5 - - -',
    'G#5 - - - - - - - E5 - G#5 - B5 - D6 -',
    'C6 - - - B5 - A5 - - - E5 - - - A5 -',
    'F#5 - - - E5 - D5 - - - F#5 - A5 - C6 -',
    'B5 - - - - - - - G#5 - - - - - - -',
    'A5 - - - - - C6 - - - B5 - A5 - - -',
  ];
  const SAMBA_C = [
    'G5 - . G5 - . B5 - . . D6 - B5 - G5 -',
    '. . . . . . . . . . . . . . . .',
    'A5 - . A5 - . C6 - . . D6 - C6 - A5 -',
    'F#5 - - - - - - - D5 - . . . . . .',
  ];
  SONGS.stage2 = {
    bpm: 142, swing: 0.12, scale: 'G major', gain: 0.81,
    def: {
      bars: 8, chords: ['G', 'E7', 'Am7', 'D7', 'Bm7 E7', 'Am7 D7', 'G', 'D7'],
      bass: { inst: 'bass', pat: '1 - - 1 5 - - 5 1 - - 1 5 - - a', low: 36, vel: 0.8 },
      comp: { inst: 'cavaco', pat: 'x.xx.x.x.xx.x.x.', low: 62, vel: 0.32, len: 1, v: 'triad' },
      drums: {
        surdo: 'h...O...h...O...', surdo_3: '......x.......x.', caixa: 'xxXxxXxXxxXxxXxX',
        tamb: 'X.X..X.X.X..X.X.', agogo: 'h.hl.lh.h.hl.l..', shaker: 'x.X.x.X.x.X.x.X.',
      },
      dv: { surdo: 1, surdo_3: 0.6, caixa: 0.7, tamb: 0.8, agogo: 0.55, shaker: 0.3 },
      fill: { caixa: 'xxXxxXxXrrrrrrrr', surdo: 'h...O...O.O.O.O.' },
    },
    sec: {
      A: { parts: [{ inst: 'brass', notes: SAMBA_A, vel: 0.75 }], drums2: { apito: once('W', 128) } },
      B: {
        chords: ['Em', 'B7', 'Em', 'E7', 'Am', 'D7', 'G E7', 'Am7 D7'],
        parts: [{ inst: 'brass', notes: SAMBA_B, vel: 0.75 }],
        drums2: { cuica: '....u.d.....u..d' }, dv2: { cuica: 0.6 },
      },
      A2: {
        parts: [{ inst: 'brass', notes: SAMBA_A, vel: 0.75, harm: 'c', hinst: 'brassLow', hvel: 0.55 }],
        drums2: { cuica: '..u...d...u.d...' }, dv2: { cuica: 0.5 },
      },
      C: {
        bars: 4, chords: ['G', 'G', 'D7', 'D7'],
        parts: [{ inst: 'brass', notes: SAMBA_C, vel: 0.9, harm: 'c', hinst: 'brassLow', hvel: 0.5 }],
        drums2: { apito: 'W...w...........' + '.'.repeat(48) },
        fill: { surdo: 'O..O..O.O.O.O.O.', caixa: 'X..X..X.rrrrrrrr', tamb: 'X..X..X.........', agogo: 'h..h..h.........' },
        fillOnly: true,
      },
    },
    order: ['A', 'B', 'A2', 'C'],
  };

  // ---------- FASE 3 — Lago Paranoá/motociata: rock-sertanejo ----------
  const ROCK_A = [
    'B4 - E5 - - - G5 - - - F#5 - E5 - D5 -',
    'E5 - - - - - - - . . G4 - A4 - B4 -',
    'D5 - - - B4 - D5 - G5 - - - F#5 - D5 -',
    'F#5 - - - - - E5 - D5 - - - . . . .',
    'B4 - E5 - - - G5 - - - B5 - - - A5 G5',
    'G5 - - - E5 - C5 - - - E5 - G5 - A5 -',
    'A5 - - - F#5 - D5 - - - E5 - F#5 - A5 -',
    'F#5 - - - - - D#5 - - - - - B4 - - -',
  ];
  const ROCK_B = [
    'G5 - - - - - - - E5 - - - G5 - - -',
    'F#5 - - - - - - - A5 - - - - - - -',
    'B5 - - - A5 - G5 - - - D5 - - - - -',
    'E5 - - - G5 - - - B5 - - - - - - -',
    'C6 - - - B5 - A5 - - - E5 - - - A5 -',
    'F#5 - - - - - E5 - D5 - - - A5 - - -',
    'D#5 - - - F#5 - - - A5 - - - B5 - - -',
    'B5 - - - - - - - - - - - . . . .',
  ];
  const ROCK_R = [
    'E4 . E4 . G4 . E4 . A4 - G4 - E4 . D4 .',
    'E4 . E4 . G4 . E4 . B4 - - - A4 - G4 -',
    'G4 . G4 . B4 . G4 . D5 - B4 - G4 . F#4 .',
    'A4 . A4 . C#5 . A4 . E5 - - - D5 - C#5 -',
    'E4 . E4 . G4 . E4 . A4 - G4 - E4 . D4 .',
    'E4 . G4 . B4 . E5 . G5 - - - F#5 - E5 -',
    'E5 - - - G5 - - - C6 - - - B5 - - -',
    'B5 - - - A5 - - - F#5 - - - D#5 - - -',
  ];
  SONGS.stage3 = {
    bpm: 152, scale: 'E minor', gain: 0.38, ins: ['gtr', 'lead'],
    def: {
      bars: 8, chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'B7'],
      bass: { inst: 'motorBass', pat: '1 . 1 1 1 . 1 1 1 . 1 1 1 . 1 1', low: 33, vel: 0.75 },
      comp: { inst: 'gtr', pat: 'x-------x-------', low: 40, vel: 0.5, v: 'power', dest: 'gtr' },
      drums: { kick: 'x.....x.x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.o.', crash: once('X', 128) },
      dv: { kick: 1.1, snare: 1.6, hat: 0.8, crash: 0.6 },
      fill: { snare: '....x...x.x.rrrr', kick: 'x.....x.x.x.x...', tom: '........hhmmll..' },
    },
    sec: {
      A: { parts: [{ inst: 'distLead', notes: ROCK_A, vel: 0.8, dest: 'lead', harm: 2, hinst: 'viola', hvel: 0.75, hdest: 'main' }] },
      B: {
        chords: ['C', 'D', 'G', 'Em', 'Am', 'D', 'B7', 'B7'],
        parts: [{ inst: 'distLead', notes: ROCK_B, vel: 0.8, dest: 'lead', harm: 2, hinst: 'viola', hvel: 0.75, hdest: 'main' }],
        comp: { inst: 'gtr', pat: 'x.xx.xx.x.xx.xx.', low: 40, vel: 0.45, v: 'power', dest: 'gtr', len: 0.8 },
      },
      R: {
        chords: ['Em', 'Em', 'G', 'A', 'Em', 'Em', 'C', 'B7'],
        parts: [{ inst: 'distLead', notes: ROCK_R, vel: 0.75, dest: 'lead' }],
        comp: { inst: 'gtr', pat: 'x.xxx.xxx.xxx.xx', low: 40, vel: 0.42, v: 'power', dest: 'gtr', len: 0.8 },
        drums: { kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', rev: once('m', 64), crash: once('X', 128) },
        dv: { kick: 1, snare: 1.6, hat: 0.5, rev: 1, crash: 0.6 },
      },
      A2: {
        parts: [{ inst: 'distLead', notes: ROCK_A, vel: 0.85, dest: 'lead', harm: 2, hinst: 'distLead', hvel: 0.7 },
          { inst: 'viola', notes: ROCK_A, vel: 0.5 }],
        drums2: { hat: 'xxXxxxXxxxXxxxXx' },
      },
    },
    order: ['A', 'B', 'R', 'A2'],
  };

  // ---------- FASE 4 — Planalto: frevo (rápido, metais, tensão) ----------
  const FREVO_A = [
    'G4 Bb4 D5 G5 - - F#5 G5 A5 G5 F#5 G5 D5 - Bb4 -',
    'A4 C5 D5 F#5 - - E5 F#5 G5 F#5 E5 F#5 D5 - A4 -',
    'Bb4 D5 G5 Bb5 - - A5 Bb5 C6 Bb5 A5 G5 F#5 - D5 -',
    'C6 - Bb5 - A5 - F#5 - D5 - . D5 Eb5 D5 C5 Bb4',
    'C5 Eb5 G5 C6 - - Bb5 C6 D6 C6 Bb5 Ab5 G5 - Eb5 -',
    'D5 G5 Bb5 D6 - - C6 Bb5 A5 G5 F#5 G5 Bb5 - G5 -',
    'F#5 - A5 - C6 - Eb6 - D6 - C6 - Bb5 - A5 -',
    'G5 - - - D5 - - - G4 - - - . . . .',
  ];
  const FREVO_B = [
    'G5 - - - Bb5 - - - Eb6 - - - D6 - C6 -',
    'D6 - - - - - - - Bb5 - C6 - D6 - F6 -',
    'Eb6 - - - D6 - C6 - - - G5 - - - Eb5 -',
    'F#5 - - - A5 - - - C6 - - - D6 - - -',
    'G5 - Bb5 - Eb6 - - - G5 - Bb5 - Eb6 - - -',
    'F5 - Bb5 - D6 - - - F5 - Bb5 - D6 - - -',
    'Eb6 - D6 - C6 - Bb5 - A5 - F#5 - D5 - C5 -',
    'Bb4 - - - G4 - - - . . . . . . . .',
  ];
  SONGS.stage4 = {
    bpm: 160, scale: 'G harm', gain: 0.8,
    def: {
      bars: 8, chords: ['Gm', 'D7', 'Gm', 'D7', 'Cm', 'Gm', 'D7', 'Gm'],
      bass: { inst: 'tuba', pat: '1 - . . 5 - . . 1 - . . 5 - 3 -', low: 31, vel: 0.85 },
      comp: { inst: 'brassLow', pat: '..x..x....x..x..', low: 55, vel: 0.42, len: 1.5, v: 'triad' },
      drums: { caixa: 'xxXxxrXxxxXxxrXx', surdo: 'O...x...O...x.x.', prato: '..x...x...x...x.' },
      dv: { caixa: 0.6, surdo: 1, prato: 0.6 },
      fill: { caixa: 'X.X.X.X.rrrrrrrr', surdo: 'O...O...O.O.O.O.', prato: 'X...............' },
    },
    sec: {
      A: { parts: [{ inst: 'brass', notes: FREVO_A, vel: 0.78 }] },
      A2: {
        parts: [{ inst: 'brass', notes: FREVO_A, vel: 0.78, harm: 'c', hinst: 'brassLow', hvel: 0.55 }],
        drums2: { crash: once('X', 128) }, dv2: { crash: 0.5 },
      },
      B: {
        chords: ['Eb', 'Bb', 'Cm', 'D7', 'Eb', 'Bb', 'Cm7 D7', 'Gm'],
        parts: [{ inst: 'brass', notes: FREVO_B, vel: 0.78, harm: 'c', hinst: 'brassLow', hvel: 0.55 }],
        drums2: { sweep: '.'.repeat(112) + once('u', 16) },
      },
    },
    order: ['A', 'A2', 'B', 'A2'],
  };

  // ---------- CHEFÃO — funk carioca "tamborzão" ----------
  const FUNK_A = [
    'E5 . . E5 . . G5 . . E5 . . F5 . E5 .',
    'D5 . . D5 . . E5 . . B4 . . C5 - B4 -',
    'F5 . . F5 . . A5 . . F5 . . G5 . F5 .',
    'E5 - - - - - - - . . . . B4 . D5 .',
    'E5 . . E5 . . G5 . . E5 . . F5 . E5 .',
    'D5 . . D5 . . E5 . . B4 . . C5 - B4 -',
    'C5 . . E5 . . G5 . . E5 . . G5 . A5 .',
    'B4 - - - - - D#5 - - - F#5 - - - B5 -',
  ];
  const FUNK_B = [
    'E4 - F4 - E4 - D#4 - E4 - . . B3 - C4 -',
    'B3 - - - - - - - . . . . . . . .',
    'E4 - F4 - E4 - D#4 - E4 - . . G4 - F4 -',
    'E4 - - - - - - - . . . . . . . .',
    'F4 - G4 - F4 - E4 - F4 - . . C4 - D4 -',
    'C4 - - - - - - - . . . . . . . .',
    'B3 - C4 - B3 - A#3 - B3 - D#4 - F#4 - A4 -',
    'B4 - - - - - - - . . . . . . . .',
  ];
  SONGS.boss = {
    bpm: 130, scale: 'E phryg', gain: 1.02,
    def: {
      bars: 8, chords: ['Em', 'Em', 'F', 'Em', 'Em', 'Em', 'C', 'B'],
      bass: { inst: 'sub', pat: '1 . . 1 . . 1 . . . 1 . . 1 . .', low: 31, vel: 0.9 },
      comp: { inst: 'orch', pat: once('X', 32), low: 52, vel: 0.6, len: 3, v: 'triad' },
      drums: {
        kick: 'X..x..X...x..x..', clap: '....x.......x...', tambor: 'x.h..hx.h.x..hx.', hat: 'x.x.x.x.x.x.x.xo',
        '+crash': once('X', 64), '+hat_2': '.x.x.x.x.x.x.x.x', '+apito': once('w', 128),
      },
      dv: { kick: 0.7, clap: 1.2, tambor: 0.7, hat: 0.45, '+crash': 0.5, '+hat_2': 0.35, '+apito': 0.6 },
      fill: { clap: '....x.......x.xx', tambor: 'x.h.x.h.xhxhxhxh' },
    },
    sec: {
      A: { parts: [{ inst: 'lead', notes: FUNK_A, vel: 0.8 }, { inst: 'brassLow', notes: FUNK_A, vel: 0.45, oct: -12, hi: true }] },
      B: {
        chords: ['Em', 'Em', 'Em', 'Em', 'F', 'F', 'B', 'B'],
        parts: [{ inst: 'lead', notes: FUNK_B, vel: 0.85 }, { inst: 'lead', notes: FUNK_B, vel: 0.4, oct: 12 }],
        comp: { inst: 'orch', pat: 'X.....X.........', low: 52, vel: 0.5, len: 3, v: 'triad' },
        pad: { inst: 'pad', low: 52, vel: 0.3 },
        drums2: { sweep: '.'.repeat(112) + once('u', 16) },
      },
      A2: {
        parts: [{ inst: 'lead', notes: FUNK_A, vel: 0.85, harm: 'c', hinst: 'brass', hvel: 0.5 }, { inst: 'brassLow', notes: FUNK_A, vel: 0.45, oct: -12, hi: true }],
        comp: { inst: 'orch', pat: once('X', 16), low: 52, vel: 0.55, len: 3, v: 'triad' },
        drums2: { vox: once('e', 32) }, dv2: { vox: 0.8 },
      },
    },
    order: ['A', 'B', 'A2'],
  };

  // ---------- CHEFÃO FINAL (Lule) — tamborzão + frevo + coro épico ----------
  const FINAL_A = [
    'D5 - - - - - A4 - D5 - F5 - A5 - - -',
    'G5 - F5 - E5 - F5 - - - D5 - - - - -',
    'F5 - - - - - D5 - F5 - Bb5 - D6 - - -',
    'C6 - Bb5 - A5 - Bb5 - - - F5 - - - - -',
    'G5 - - - - - D5 - G5 - Bb5 - D6 - - -',
    'C6 - Bb5 - A5 - G5 - - - D5 - - - - -',
    'C#6 - - - - - A5 - E5 - G5 - A5 - - -',
    'Bb5 - A5 - G5 - F5 - E5 - - - C#5 - - -',
  ];
  const FINAL_B = [
    'D5 F5 A5 D6 - - C#6 D6 E6 D6 C#6 D6 A5 - F5 -',
    'E5 G5 A5 C#6 - - B5 C#6 D6 C#6 B5 C#6 A5 - E5 -',
    'F5 A5 D6 F6 - - E6 F6 G6 F6 E6 D6 C#6 - A5 -',
    'G6 - F6 - E6 - C#6 - A5 - . A5 Bb5 A5 G5 F5',
    'G5 Bb5 D6 G6 - - F6 G6 A6 G6 F6 E6 D6 - Bb5 -',
    'A5 D6 F6 A6 - - G6 F6 E6 D6 C#6 D6 F6 - D6 -',
    'C#6 - E6 - G6 - Bb6 - A6 - G6 - F6 - E6 -',
    'D6 - - - A5 - - - D5 - - - . . . .',
  ];
  const FINAL_C = [
    'A5 - - - - - - - - - - - - - - -',
    'G5 - - - - - - - E5 - - - - - - -',
    'F5 - - - - - - - D5 - - - - - - -',
    'E5 - - - - - - - C#5 - - - - - - -',
    'D5 - - - G5 - - - Bb5 - - - D6 - - -',
    'C6 - - - A5 - - - F5 - - - A5 - - -',
    'G#5 - - - B5 - - - D6 - - - E6 - - -',
    'C#6 - - - - - - - E6 - - - - - - -',
  ];
  SONGS.boss_final = {
    bpm: 140, scale: 'D harm', gain: 0.8,
    def: {
      bars: 8, chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A7', 'A7'],
      bass: { inst: 'sub', pat: '1 . . 1 . . 1 . . . 1 . . 1 . .', low: 31, vel: 0.9 },
      pad: { inst: 'choir', low: 57, vel: 0.4 },
      comp: { inst: 'orch', pat: once('X', 32), low: 50, vel: 0.7, len: 3, v: 'triad' },
      drums: {
        kick: 'X..x..X...x..x..', clap: '....x.......x...', tambor: 'x.h..hx.h.x..hx.', caixa: 'xxXxxxXxxxXxxxXx',
        '+crash': once('X', 32), '+hat': 'xxxxxxxxxxxxxxxx', '+apito': once('W', 128),
      },
      dv: { kick: 0.75, clap: 1.2, tambor: 0.65, caixa: 0.55, '+crash': 0.5, '+hat': 0.3, '+apito': 0.6 },
      fill: { caixa: 'xxXxxxXxrrrrrrrr', tambor: 'x.h.x.h.xhxhxhxh', clap: '....x.......x.xx' },
    },
    sec: {
      A: { parts: [{ inst: 'brass', notes: FINAL_A, vel: 0.9, harm: 'c', hinst: 'brassLow', hvel: 0.5 }] },
      B: {
        chords: ['Dm', 'A7', 'Dm', 'A7', 'Gm', 'Dm', 'A7', 'Dm'],
        parts: [{ inst: 'brass', notes: FINAL_B, vel: 0.85, oct: -12 }, { inst: 'lead', notes: FINAL_B, vel: 0.3, oct: -12, hi: true }],
        drums2: { prato: '..x...x...x...x.' }, dv2: { prato: 0.3 },
      },
      C: {
        chords: ['Dm', 'C', 'Bb', 'A7', 'Gm', 'F', 'E7', 'A7'],
        parts: [{ inst: 'brass', notes: FINAL_C, vel: 0.8 }],
        pad: { inst: 'choir', low: 60, vel: 0.5 },
        comp: { inst: 'orch', pat: once('X', 16), low: 50, vel: 0.45, len: 3, v: 'triad' },
        drums: { kick: 'X.......X.......', clap: '........x.......', tambor: '....h.......h.h.', caixa: '................', '+crash': once('X', 32), sweep: '.'.repeat(112) + once('u', 16) },
        dv: { kick: 0.8, clap: 0.8, tambor: 0.6, '+crash': 0.5, sweep: 1 },
        fill: { caixa: 'x.x.x.x.rrrrrrrr', tambor: 'x.h.x.h.xhxhxhxh' },
      },
      A2: {
        parts: [{ inst: 'brass', notes: FINAL_A, vel: 0.9, harm: 'c', hinst: 'brassLow', hvel: 0.55 }, { inst: 'brass', notes: FINAL_A, vel: 0.4, oct: -12 }],
        comp: { inst: 'orch', pat: once('X', 16), low: 50, vel: 0.5, len: 3, v: 'triad' },
        drums2: { vox: once('e', 64) }, dv2: { vox: 0.7 },
      },
    },
    order: ['A', 'B', 'C', 'A2'],
  };

  // ---------- FASE CONCLUÍDA — fanfarra curta (toca uma vez) ----------
  SONGS.clear = {
    bpm: 140, once: true, tail: 1.8, scale: 'G major', gain: 1.03,
    def: {
      bars: 3, chords: ['G', 'D7', 'G'],
      parts: [{
        inst: 'brass', vel: 0.9, harm: 'c', hinst: 'brassLow', hvel: 0.6,
        notes: ['G4 . B4 . D5 . G5 - - - . . F#5 - G5 -', 'A5 - - - F#5 - - - D5 - E5 - F#5 - A5 -', 'G5 - - - - - - - - - - - - - - -'],
      }],
      bass: { inst: 'tuba', pat: '1 . . . 1 . . . 1 . . . 5 . . . 1 . . . 5 . . . 1 . . . 5 . . . 1 - - - - - - - - - - - - - - -', low: 31, vel: 0.8 },
      comp: { inst: 'brassLow', pat: 'x...x...x...x...x...x...x...x...l---------------', low: 55, vel: 0.4, len: 2, v: 'triad' },
      drums: { snare: '............rrrr' + '............rrrr' + '................', crash: '.'.repeat(32) + once('X', 16), tom: 'l.......l.......' + 'l.......l.......' + once('l', 16) },
      dv: { snare: 0.6, crash: 0.7, tom: 0.7 },
    },
    sec: { A: {} },
    order: ['A'],
  };

  // ---------- GAME OVER — curtinha e triste (toca uma vez) ----------
  SONGS.gameover = {
    bpm: 84, once: true, tail: 2.2, scale: 'A minor', gain: 0.62,
    def: {
      bars: 3, chords: ['Am Dm6 C E7', 'Dm6 E7', 'Am'], // linha descendente harmonizada nota a nota
      parts: [{ inst: 'flute', vel: 0.8, notes: ['E5 - - - D5 - - - C5 - - - B4 - - -', 'A4 - - - - - B4 - G#4 - - - - - - -', 'A4 - - - - - - - - - - - - - - -'] }],
      bass: { inst: 'bass', pat: '1 - - - 1 - - - 1 - - - 1 - - - 1 - - - - - - - 1 - - - - - - - 1 - - - - - - - - - - - - - - -', low: 33, vel: 0.7 },
      comp: { inst: 'pluck', pat: 'x---x---x---x---x-------x-------x---------------', low: 52, vel: 0.4, strum: 0.03 },
      pad: { inst: 'pad', low: 52, vel: 0.22 },
      drums: { surdo: 'x.......x.......' }, dv: { surdo: 0.45 },
    },
    sec: { A: {} },
    order: ['A'],
  };

  // ---------- SUSPENSE — chefão chegando/falando (o core silencia a música no alarme) ----------
  SONGS.suspense = {
    bpm: 96, scale: 'E phryg', gain: 1.5,
    def: {
      bars: 4, chords: ['Em', 'Em', 'F', 'Em'],
      pad: { inst: 'pad', low: 52, vel: 0.55 },
      bass: { inst: 'sub', pat: '1 . . . . . . . . . . . . . . .', low: 28, vel: 0.45 },
      parts: [{ inst: 'vibes', vel: 0.35, notes: ['B5 - - - - - - - . . . . . . . .', '. . . . . . . . C6 - - - - - - -', 'A5 - - - - - - - . . . . . . . .', 'B5 - - - - - - - . . . . . . . .'] }],
      drums: { surdo: 'O..x............', rim: '..x...x...x...x.', sweep: '.'.repeat(48) + once('u', 16) },
      dv: { surdo: 0.75, rim: 0.3, sweep: 0.45 },
    },
    sec: { A: {} },
    order: ['A'],
  };

  // ---------- VITÓRIA — marchinha de carnaval ----------
  const MARCH_A = [
    'G4 - - C5 E5 - - - G5 - - - E5 - - -',
    'C#5 - - E5 G5 - - - A5 - - - G5 - - -',
    'F5 - - - E5 - - - D5 - - - A4 - - -',
    'B4 - - - D5 - - - G5 - - - F5 - - -',
    'E5 - - G5 C6 - - - E6 - - - C6 - - -',
    'C#6 - - - A5 - - - E5 - - - G5 - - -',
    'F#5 - - - A5 - - - F5 - - - D5 - - -',
    'C5 - - - - - - - G4 - - - C5 - - -',
  ];
  const MARCH_B = [
    'A5 - A5 - A5 - G5 - A5 - - - C6 - - -',
    'A5 - - - F5 - - - C5 - - - F5 - - -',
    'G5 - G5 - G5 - F5 - G5 - - - C6 - - -',
    'G5 - - - E5 - - - C5 - - - E5 - - -',
    'F#5 - F#5 - F#5 - E5 - F#5 - - - A5 - - -',
    'C6 - - - A5 - - - F#5 - - - D5 - - -',
    'G5 - - - A5 - - - B5 - - - D6 - - -',
    'F5 - - - D5 - - - B4 - - - G4 - - -',
  ];
  SONGS.victory = {
    bpm: 128, scale: 'C major', gain: 0.875,
    def: {
      bars: 8, chords: ['C', 'A7', 'Dm', 'G7', 'C', 'A7', 'D7 G7', 'C'],
      bass: { inst: 'tuba', pat: '1 - . . 5 - . . 1 - . . 5 - . .', low: 31, vel: 0.85 },
      comp: { inst: 'brassLow', pat: '..x...x...x...x.', low: 55, vel: 0.38, len: 1.5, v: 'triad' },
      drums: { kick: 'x...x...x...x...', snare: 'x.xxx.x.x.xxx.x.', prato: '....x.......x...', surdo: 'O.......O.......' },
      dv: { kick: 0.6, snare: 0.6, prato: 0.5, surdo: 0.7 },
      fill: { snare: 'x.x.x.x.rrrrrrrr', prato: '............X...' },
    },
    sec: {
      A: { parts: [{ inst: 'brass', notes: MARCH_A, vel: 0.78 }], drums2: { crash: once('X', 128), apito: 'w...w...' + '.'.repeat(120) } },
      B: {
        chords: ['F', 'F', 'C', 'C', 'D7', 'D7', 'G7', 'G7'],
        parts: [{ inst: 'brass', notes: MARCH_B, vel: 0.78 }, { inst: 'flute', notes: MARCH_B, vel: 0.22, oct: 12 }],
      },
      A2: { parts: [{ inst: 'brass', notes: MARCH_A, vel: 0.85, harm: 'c', hinst: 'brassLow', hvel: 0.55 }], drums2: { crash: once('X', 128) } },
      B2: {
        from: 'B',
        parts: [{ inst: 'brass', notes: MARCH_B, vel: 0.85, harm: 'c', hinst: 'brass', hvel: 0.5 }, { inst: 'flute', notes: MARCH_B, vel: 0.25, oct: 12 }],
        drums2: { tamb: 'x.xx.x.x' }, dv2: { tamb: 0.5 },
      },
    },
    order: ['A', 'B', 'A2', 'B2'],
  };

  // ===================== Compilador de músicas =====================
  const strip = (p) => String(p || '').replace(/\s+/g, '');
  function parseTokens(src) {
    const str = Array.isArray(src) ? src.join(' ') : String(src || '');
    const toks = str.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
    const at = new Array(toks.length).fill(null);
    let cur = null;
    for (let i = 0; i < toks.length; i++) {
      let tk = toks[i];
      if (tk === '-') { if (cur) cur.len++; continue; }
      cur = null;
      if (tk === '.') continue;
      let acc = false;
      if (tk[tk.length - 1] === '!') { acc = true; tk = tk.slice(0, -1); }
      const n = tk.split('+').map((x) => { const v = nm(x); return v == null ? x : v; });
      at[i] = cur = { n, len: 1, acc };
    }
    return { len: toks.length || 1, at };
  }
  // duração de cada golpe do acompanhamento: 1 + "-" seguintes, senão `def`
  function compLens(pat, def) {
    const L = new Array(pat.length).fill(0);
    for (let i = 0; i < pat.length; i++) {
      if (pat[i] === '.' || pat[i] === '-') continue;
      let k = i + 1;
      while (k < pat.length && pat[k] === '-') k++;
      L[i] = k - i > 1 ? k - i : def;
    }
    return L;
  }
  function compile(song) {
    if (song._c) return song._c;
    const spb = song.spb || 16;
    song.sc = parseScale(song.scale);
    const raw = (name) => {
      const r = song.sec[name];
      if (!r) throw new Error('audio: seção inexistente ' + name);
      return r.from ? Object.assign({}, raw(r.from), r) : Object.assign({}, song.def || {}, r);
    };
    const secs = {};
    const getSec = (name) => {
      if (secs[name]) return secs[name];
      const r = raw(name), bars = r.bars || 8;
      const sec = { name, bars, fillOnly: !!r.fillOnly, fill: !!r.fill, parts: [], dk: [], chordBars: [], bass: null, comp: null, arp: null, pad: null, hook: r.hook || null };
      const cl = r.chords || ['C'];
      for (let b = 0; b < bars; b++) {
        const syms = String(cl[b % cl.length]).trim().split(/\s+/);
        sec.chordBars.push(syms.map((s, i) => ({ at: Math.round((i * spb) / syms.length), c: parseChord(s) || parseChord('C') })));
      }
      const drums = Object.assign({}, r.drums, r.drums2), fill = r.fill || null, dv = Object.assign({}, r.dv, r.dv2);
      const keys = Object.keys(drums);
      if (fill) for (const k in fill) if (keys.indexOf(k) < 0) keys.push(k);
      for (const k of keys) {
        const hi = k[0] === '+', nmD = (hi ? k.slice(1) : k).split('_')[0], fn = DRUM[nmD];
        if (!fn) continue;
        sec.dk.push({ key: k, nm: nmD, fn, hi, pat: drums[k] ? strip(drums[k]) : null, fill: fill && fill[k] != null ? strip(fill[k]) : null, vol: dv[k] != null ? dv[k] : 1 });
      }
      for (const p of r.parts || []) {
        const P = Object.assign({ vel: 0.8, oct: 0, gate: 0.95, hvel: 0.6 }, p), q = parseTokens(p.notes);
        P.len = q.len; P.at = q.at; P.fn = INST[P.inst] || INST.pluck; P.hfn = INST[P.hinst] || P.fn;
        sec.parts.push(P);
      }
      if (r.bass) {
        const B = Object.assign({ inst: 'bass', low: 36, vel: 0.8, gate: 0.9 }, r.bass), q = parseTokens(B.pat);
        B.len = q.len; B.at = q.at; B.fn = INST[B.inst] || INST.bass; sec.bass = B;
      }
      if (r.comp) {
        const K = Object.assign({ inst: 'pluck', low: 52, vel: 0.5, len: 1 }, r.comp);
        K.pat = strip(K.pat); K.lens = compLens(K.pat, K.len); K.fn = INST[K.inst] || INST.pluck; sec.comp = K;
      }
      if (r.arp) {
        const A = Object.assign({ inst: 'harp', low: 60, vel: 0.5, gate: 1 }, r.arp), q = parseTokens(A.pat);
        A.len = q.len; A.at = q.at; A.fn = INST[A.inst] || INST.harp; sec.arp = A;
      }
      if (r.pad) { const P = Object.assign({ inst: 'pad', low: 55, vel: 0.4 }, r.pad); P.fn = INST[P.inst] || INST.pad; sec.pad = P; }
      return (secs[name] = sec);
    };
    const bars = [];
    song.order.forEach((name, occ) => {
      const sec = getSec(name);
      for (let b = 0; b < sec.bars; b++) bars.push({ sec, b, occ, chords: sec.chordBars[b].map((e) => ({ at: e.at, c: e.c, pad: 0 })) });
    });
    // duração dos pads: junta acordes iguais seguidos (máx. 4 compassos) dentro da mesma seção
    let head = null, run = 0, occ = -1;
    const close = () => { if (head) head.pad = run; };
    for (const bar of bars) {
      for (let i = 0; i < bar.chords.length; i++) {
        const e = bar.chords[i], end = i + 1 < bar.chords.length ? bar.chords[i + 1].at : spb, len = end - e.at;
        if (head && bar.occ === occ && e.c.sym === head.c.sym && run + len <= spb * 4) run += len;
        else { close(); head = e; run = len; occ = bar.occ; }
      }
    }
    close();
    return (song._c = { spb, bars, total: bars.length * spb, secs });
  }
  function chordEntry(bar, st) {
    let e = bar.chords[0];
    for (let i = 1; i < bar.chords.length; i++) if (bar.chords[i].at <= st) e = bar.chords[i];
    return e;
  }
  function nextChord(C, bi, st) {
    const bar = C.bars[bi];
    for (const e of bar.chords) if (e.at > st) return e.c;
    return C.bars[(bi + 1) % C.bars.length].chords[0].c;
  }
  function bassNote(tok, ch, low, C, bi, st) {
    if (typeof tok === 'number') return tok;
    let pc = ch.root, iv = 0, x;
    switch (tok) {
      case '1': if (ch.bass != null) pc = ch.bass; break;
      case '3': x = ch.iv.find((i) => i === 3 || i === 4); iv = x === undefined ? 5 : x; break;
      case '5': x = ch.iv.find((i) => i >= 6 && i <= 8); iv = x === undefined ? 7 : x; break;
      case '7': x = ch.iv.find((i) => i >= 9 && i <= 11); iv = x === undefined ? 10 : x; break;
      case '8': iv = 12; break;
      case '-5': x = ch.iv.find((i) => i >= 6 && i <= 8); iv = (x === undefined ? 7 : x) - 12; break;
      case '6': iv = 9; break;
      case '2': iv = 2; break;
      case '4': iv = 5; break;
      case 'a': return place(nextChord(C, bi, st).root, low) - 1;
      default: return null;
    }
    return place(pc, low) + iv;
  }
  function voicing(ch, K) {
    const cache = K._vc || (K._vc = {});
    let ns = cache[ch.sym];
    if (ns) return ns;
    if (K.v === 'power') { const r = place(ch.root, K.low); ns = [r, r + 7, r + 12]; }
    else {
      let iv = ch.iv;
      if (K.v === 'rootless' && iv.length >= 4) iv = iv.filter((i) => i !== 0);
      else if (K.v === 'triad') iv = iv.slice(0, 3);
      ns = [];
      for (const i of iv) { const m = place((ch.root + i) % 12, K.low); if (ns.indexOf(m) < 0) ns.push(m); }
      ns.sort((a, b) => a - b);
    }
    return (cache[ch.sym] = ns);
  }

  // ===================== Sequenciador: agenda um passo (semicolcheia) =====================
  function playStep(E, tr, t) {
    const C = tr.C, song = tr.song, spb = C.spb;
    let s = tr.step;
    if (s >= C.total) {
      if (song.once) { tr.ended = true; tr.endAt = t + (song.tail || 1.5); return; }
      s %= C.total;
    }
    if (E.mv > MAX_MUSIC && !E.offline) return; // trava de segurança (ao vivo nunca deveria acontecer)
    const bi = (s / spb) | 0, st = s - bi * spb, bar = C.bars[bi], sec = bar.sec, ss = bar.b * spb + st;
    const sd = tr.sd, out = tr.out, ins = tr.ins;
    const tt = t + (st & 1 ? sd * (song.swing || 0) : 0);
    const ce = chordEntry(bar, st), ch = ce.c;
    const fillBar = sec.fill && bar.b === sec.bars - 1;
    // bateria
    for (let i = 0; i < sec.dk.length; i++) {
      const D = sec.dk[i];
      if (D.hi && (!tr.hi || (LOWQ && !E.offline))) continue;
      let pat, idx;
      if (fillBar && D.fill) { pat = D.fill; idx = st; } else if (fillBar && sec.fillOnly) continue;
      else if (D.pat) { pat = D.pat; idx = ss; } else continue;
      const c = pat[idx % pat.length];
      if (c === '.' || c === undefined) continue;
      const vn = (c >= 'A' && c <= 'Z' ? 1 : 0.68) * D.vol, vr = 0.92 + Math.random() * 0.12, td = tt + Math.random() * 0.004;
      // golpe pré-renderizado (ao vivo) ou sintetizado
      if (!(E.hit && E.hit(E, D.nm, c, vn, vr, td, out))) D.fn(E, td, c, vn * vr, out, sd);
    }
    // baixo
    const B = sec.bass;
    if (B) {
      const ev = B.at[ss % B.len];
      if (ev) {
        const d = ev.len * sd * B.gate, v = B.vel * (ev.acc ? 1.2 : 1), dest = ins[B.dest] || out;
        for (const tok of ev.n) { const m = bassNote(tok, ch, B.low, C, bi, st); if (m != null) B.fn(E, tt, m, d, v, dest); }
      }
    }
    // acompanhamento (acordes)
    const K = sec.comp;
    if (K) {
      const i = ss % K.pat.length, c = K.pat[i];
      if (c !== '.' && c !== '-') {
        const ns = voicing(ch, K), d = K.lens[i] * sd, v = K.vel * (c === 'X' ? 1.2 : 1), dest = ins[K.dest] || out;
        for (let j = 0; j < ns.length; j++) K.fn(E, tt + j * (K.strum || 0), ns[j], d, v, dest);
      }
    }
    // arpejo (fica de fora na qualidade baixa)
    const A = LOWQ && !E.offline ? null : sec.arp;
    if (A) {
      const ev = A.at[ss % A.len];
      if (ev) {
        const ns = voicing(ch, A);
        for (const tok of ev.n) {
          const k = +tok;
          if (!(k >= 0)) continue;
          A.fn(E, tt, ns[k % ns.length] + 12 * Math.floor(k / ns.length), ev.len * sd * A.gate, A.vel, ins[A.dest] || out);
        }
      }
    }
    // pad (acorde sustentado)
    const P = sec.pad;
    if (P && ce.at === st && ce.pad > 0) { const ns = voicing(ch, P); for (const m of ns) P.fn(E, tt, m, ce.pad * sd, P.vel, ins[P.dest] || out); }
    // melodias (+ segunda voz)
    for (const Pt of sec.parts) {
      if (Pt.hi && !tr.hi) continue;
      const ev = Pt.at[ss % Pt.len];
      if (!ev) continue;
      const d = ev.len * sd * Pt.gate, v = Pt.vel * (ev.acc ? 1.2 : 1), dest = ins[Pt.dest] || out;
      for (const n of ev.n) {
        if (typeof n !== 'number') continue;
        const m = n + Pt.oct;
        Pt.fn(E, tt, m, d, v, dest);
        if (Pt.harm) {
          const hm = Pt.harm === 'c' ? chordBelow(m, ch) : scaleShift(m, Pt.harm, song.sc);
          if (hm != null) Pt.hfn(E, tt, hm, d, v * Pt.hvel, ins[Pt.hdest] || dest);
        }
      }
    }
    if (sec.hook) sec.hook(E, tr, bar.b, st, tt, sd);
  }

  // Verificação das partituras (usada nos testes): cada compasso com o nº certo de passos
  function checkSongs() {
    const probs = [];
    for (const name in SONGS) {
      const song = SONGS[name], spb = song.spb || 16;
      let C;
      try { C = compile(song); } catch (err) { probs.push(name + ': ' + err.message); continue; }
      for (const sn in C.secs) {
        const sec = C.secs[sn], n = sec.bars * spb, where = name + '.' + sn;
        for (const P of sec.parts) {
          if (!INST[P.inst]) probs.push(where + ': instrumento ' + P.inst);
          if (P.hinst && !INST[P.hinst]) probs.push(where + ': instrumento ' + P.hinst);
          if (Array.isArray(P.notes)) P.notes.forEach((bs, i) => { const k = bs.trim().split(/\s+/).length; if (k !== spb) probs.push(where + ' compasso ' + (i + 1) + ': ' + k + ' passos'); });
          if (P.len % spb || n % P.len) probs.push(where + ': melodia com ' + P.len + ' passos');
          for (const ev of P.at) if (ev) for (const x of ev.n) if (typeof x !== 'number') probs.push(where + ': nota inválida ' + x);
        }
        if (sec.bass && (sec.bass.len % spb && spb % sec.bass.len)) probs.push(where + ': baixo com ' + sec.bass.len + ' passos');
        if (sec.comp && (sec.comp.pat.length % spb && spb % sec.comp.pat.length)) probs.push(where + ': comp com ' + sec.comp.pat.length);
        for (const D of sec.dk) {
          if (D.pat && D.pat.length % spb && spb % D.pat.length) probs.push(where + ': bateria ' + D.key + ' com ' + D.pat.length);
          if (D.fill && D.fill.length !== spb) probs.push(where + ': virada ' + D.key + ' com ' + D.fill.length);
        }
        for (const cb of sec.chordBars) for (const e of cb) if (!e.c) probs.push(where + ': acorde inválido');
      }
      for (const sn in song.sec) {
        const r = song.sec[sn];
        for (const cs of r.chords || []) for (const sym of String(cs).trim().split(/\s+/)) if (!parseChord(sym)) probs.push(name + '.' + sn + ': acorde ' + sym);
      }
      for (const cs of (song.def && song.def.chords) || []) for (const sym of String(cs).trim().split(/\s+/)) if (!parseChord(sym)) probs.push(name + ': acorde ' + sym);
    }
    return probs;
  }

  // ===================== Sons pré-renderizados =====================
  // Os SFX que tocam o tempo todo e os golpes de bateria da trilha são renderizados uma vez num
  // OfflineAudioContext (em outra thread) e depois tocam como 1 BufferSource + 1 ganho: 2 nós e
  // nenhuma automação, contra 5–10 nós com envelopes por disparo. Até o buffer ficar pronto (ou se
  // o navegador não tiver OfflineAudioContext), toca o sintetizador de sempre.
  // nº de variações: a variação i fixa o rnd() em (i + 0,5) / n da faixa original (os tons sorteados
  // viram n tons espalhados pela mesma faixa, tocados em ordem aleatória); o ruído de cada uma é outro.
  // (Mexer no playbackRate a cada disparo custaria quase o mesmo que um nó a mais.)
  const BAKE_SFX = {
    shot_voto: 4, shot_boca: 4, shot_panela: 4, shot_jato: 4, hit: 4, tink: 1, boss_hit: 4, pan_hit: 4, graze: 2,
    explode_s: 4, explode_m: 4, enemy_shot: 4, enemy_shot2: 2, split: 1, spawn: 1, pix: 1, ui_type: 5, ui_click: 1,
  };
  // renderizados logo que o motor nasce (os outros da lista: no 1º disparo)
  const BAKE_FIRST = ['shot_voto', 'shot_boca', 'shot_panela', 'shot_jato', 'hit', 'tink', 'graze', 'enemy_shot', 'explode_s', 'ui_click', 'ui_type'];
  const DRUM_SYNTH = { sweep: 1, rev: 1, vox: 1 }; // dependem do andamento ou são raros: sempre sintetizados
  const ROLL = { snare: [0.75, 0.85], caixa: [0.8, 0.9] }; // rufo 'r' = 2 golpes (ver DRUM.snare/caixa)
  const OAC = typeof window !== 'undefined' ? window.OfflineAudioContext || window.webkitOfflineAudioContext || null : null;

  // toca uma variação pré-renderizada em dest
  function playBaked(E, ent, t, dest) {
    const s = E.ac.createBufferSource(), b = ent.bufs;
    s.buffer = b[b.length > 1 ? (Math.random() * b.length) | 0 : 0];
    s.connect(dest);
    s.start(t);
    ent.used = t;
    return s;
  }
  // contexto de ensaio: roda um som sem criar nós de verdade, só para saber até quando ele toca
  function dryCtx(sr) {
    const P = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} };
    const node = () => ({ gain: P, frequency: P, detune: P, Q: P, playbackRate: P, offset: P, connect() {}, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {} });
    return { sampleRate: sr, currentTime: 0, destination: node(), createGain: node, createOscillator: node, createBiquadFilter: node, createBufferSource: node, createWaveShaper: node, createConstantSource: node, createPeriodicWave: node };
  }

  // ===================== Controle ao vivo (G.Audio) =====================
  const L = { E: null, ac: null, building: false, pend: [], cur: null, wanted: null, fading: [], last: {}, timer: 0, mOn: null, sOn: null, duck: false, susByUs: false, first: true, pixStreak: 0, pixT: -9, inited: false, errs: 0,
    musicOk: false, bank: {}, bq: [], bqKeys: {}, bakeT: 0, baking: false, bakeOff: !OAC, bakeKB: 0, revWant: false, revAt: 0 };
  const musicOn = () => { const s = G.save && G.save.settings; return !s || s.music !== false; };
  const sfxOn = () => { const s = G.save && G.save.settings; return !s || s.sfx !== false; };
  function report(err, where) {
    if (L.errs++ > 5) return; // não inunda G.errors
    if (G.reportError) G.reportError(err, 'audio.' + where); else try { console.error(err); } catch (e) { /* nada */ }
  }
  // O toque só precisa criar/retomar o AudioContext e tocar 1 amostra de silêncio (iOS).
  // O motor (barramentos, ruído, ondas) nasce logo depois, fora do gesto, e o reverb depois
  // dele: o 1º toque (quase sempre o JOGAR) não trava mais ~250 ms a 4x.
  function ensureCtx() {
    if (L.ac) return L.ac;
    if (!AC) return null;
    let ac = null;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ac = new AC(); } catch (e2) { ac = null; } }
    L.ac = ac;
    return ac;
  }
  // O motor nasce em fatias curtas, cada uma uma tarefa própria: barramentos, ruído (em blocos, até
  // ~4 ms por fatia) e as tabelas de onda dos sons de interface -> SFX prontos (tocam os sons pedidos
  // no meio tempo, como o clique do próprio toque); depois as outras tabelas e a partitura pedida ->
  // trilha pronta. A pré-renderização começa aí e o reverb vem ≥ 1,5 s depois (ver tick).
  // Uma fatia só emenda o passo seguinte se ainda não gastou 2 ms (aparelho rápido: menos fatias;
  // lento: 1 passo de ≤ ~10 ms a 4× por fatia). Passo que devolve false continua na próxima fatia.
  const BOOT = [
    () => { L.E0 = Engine(L.ac, { lazy: true }); },
    () => { const t = performance.now(); while (!L.E0.fillWhite(2048)) if (performance.now() - t > 4) return false; return true; },
    () => { L.E0.warm('sine'); },
    () => { L.E0.warm('square'); },
    sfxReady,
    () => { L.E.warm('triangle'); },
    () => { L.E.warm('sawtooth'); },
    () => { L.E.warm('pulse'); },
    () => { const s = L.wanted && SONGS[L.wanted]; if (s) compile(s); },
    musicReady,
  ];
  const SFX_READY = 4; // índice de sfxReady em BOOT
  function bootStep(i) {
    if (!L.ac || (i <= SFX_READY && L.E)) { L.building = false; return; }
    const t0 = performance.now();
    try {
      do { if (BOOT[i]() !== false) i++; } while (i < BOOT.length && performance.now() - t0 < 2);
    } catch (err) {
      report(err, 'engine');
      L.building = false; L.E0 = null; L.pend.length = 0;
      if (L.E) { clearInterval(L.timer); L.E = null; }
      try { L.ac.close(); } catch (e) { /* nada */ }
      L.ac = null;
      return;
    }
    if (i < BOOT.length) setTimeout(bootStep, 0, i);
  }
  function sfxReady() {
    const E = L.E0;
    L.E0 = null; L.building = false;
    E.bank = bakedSfx; E.hit = bakedDrum;
    L.E = E;
    L.mOn = L.sOn = null;
    LOWQ = G.quality === 'low';
    applySettings(true);
    L.timer = setInterval(tick, TICK_MS);
    // sons pedidos enquanto o motor nascia (ex.: o clique do próprio toque)
    const pend = L.pend.splice(0);
    for (const nm of pend) api.sfx(nm);
  }
  function musicReady() {
    const E = L.E;
    L.musicOk = true;
    L.revWant = !LOWQ; L.revAt = E.ac.currentTime + 1.5;
    for (const nm of BAKE_FIRST) bakedSfx(nm);
    if (L.wanted && musicOn() && !L.cur) startTrack(L.wanted);
  }
  function buildReverb() {
    const E = L.E;
    if (!E || LOWQ) return;
    try { if (!E.rev) E.addReverb(); else E.setReverb(true); } catch (err) { report(err, 'reverb'); }
  }

  // ---- fila de pré-renderização ----
  // entrada do banco para um SFX (null: ainda não existe; pede a renderização)
  function bakedSfx(name, p) {
    const n = BAKE_SFX[name];
    if (!n || L.bakeOff) return null;
    const key = p == null ? name : name + ':' + p;
    const ent = L.bank[key];
    if (ent) return ent;
    if (!L.bqKeys[key]) wantBake({ key, n, run: (E, t, o) => SFX[name].fn(E, t, o, p) });
    return null;
  }
  // entrada do banco para um golpe de bateria na velocidade nominal vn (lane × acento); a variação
  // humana de ±6% de cada golpe continua no ganho do golpe (bakedHit)
  function drumEntry(nm, c, vn) {
    const vq = Math.round(vn * 100) / 100, key = '#' + nm + c + vq, ent = L.bank[key];
    if (ent) return ent;
    if (!L.bqKeys[key] && vq > 0) wantBake({ key, n: 1, v: vq, run: (E, t, o) => DRUM[nm](E, t, c, vq, o, 0.1) });
    return null;
  }
  function bakedDrum(E, nm, c, vn, vr, t, dest) {
    if (DRUM_SYNTH[nm] || L.bakeOff) return false;
    const roll = c === 'r' && ROLL[nm];
    if (roll) {
      const a = drumEntry(nm, 'x', vn * roll[0]), b = drumEntry(nm, 'x', vn * roll[1]);
      if (!a || !b) return false;
      const sd = L.cur ? L.cur.sd : 0.11;
      bakedHit(E, a, vn * roll[0] * vr, t, dest);
      bakedHit(E, b, vn * roll[1] * vr, t + sd / 2, dest);
      return true;
    }
    const ent = drumEntry(nm, c, vn);
    if (!ent) return false;
    bakedHit(E, ent, vn * vr, t, dest);
    return true;
  }
  function bakedHit(E, ent, vel, t, dest) {
    const g = E.nv(dest, vel / ent.v);
    E.fin(playBaked(E, ent, t, g), g);
  }
  // todos os golpes que uma faixa pode tocar (pedidos quando ela começa)
  function wantSongDrums(song) {
    const C = compile(song);
    for (const sn in C.secs) {
      for (const D of C.secs[sn].dk) {
        if (DRUM_SYNTH[D.nm]) continue;
        const seen = {};
        for (const c of (D.pat || '') + (D.fill || '')) {
          if (c === '.' || c === '-' || seen[c]) continue;
          seen[c] = 1;
          const vn = (c >= 'A' && c <= 'Z' ? 1 : 0.68) * D.vol, roll = c === 'r' && ROLL[D.nm];
          if (roll) { drumEntry(D.nm, 'x', vn * roll[0]); drumEntry(D.nm, 'x', vn * roll[1]); } else drumEntry(D.nm, c, vn);
        }
      }
    }
  }
  // golpes de faixas que não tocam há 20 s saem do banco (voltam a ser renderizados se preciso)
  function evictDrums(now) {
    for (const k in L.bank) {
      const e = L.bank[k];
      if (e.v && e.used < now - 20) { L.bakeKB -= e.kb; delete L.bank[k]; }
    }
  }
  function wantBake(job) {
    L.bqKeys[job.key] = 1;
    L.bq.push(job);
    if (!L.baking && !L.bakeT) L.bakeT = setTimeout(bakeStart, 250);
  }
  function bakeFail(err) {
    L.bakeOff = true; L.baking = false; L.bq.length = 0; L.bqKeys = {};
    report(err, 'bake');
  }
  // Um lote: ensaio sem nós (duração exata e osciladores usados) -> OfflineAudioContext do tamanho
  // certo -> 1 tabela de onda por fatia -> nós em fatias de ~4 ms -> render (fora da thread
  // principal) -> recorte em buffers, também em fatias.
  function bakeStart() {
    L.bakeT = 0;
    const E = L.E;
    if (!E || L.baking || L.bakeOff || !L.bq.length) return;
    L.baking = true;
    let parts, oac, B, types, k = 0, off = 0;
    const jobs = L.bq.splice(0, 64), sr = E.ac.sampleRate;
    try {
      const D = Engine(dryCtx(sr), { bare: true, white: E.white, meter: true });
      parts = [];
      for (const j of jobs) {
        for (let i = 0; i < j.n; i++) {
          D.tEnd = 0;
          FIX = (i + 0.5) / j.n;
          try { j.run(D, 0, D.ac.destination); } finally { FIX = -1; }
          const len = Math.ceil(D.tEnd * sr) + 128;
          parts.push({ j, i, off, len });
          off += len + 128;
        }
      }
      // o 1º oscilador de um contexto já monta a tabela do seno: ela vem sozinha, antes das outras
      types = Object.keys(D.types).filter((ty) => ty !== 'sine').concat('sine');
      oac = new OAC(1, off, sr);
      B = Engine(oac, { bare: true, white: E.white });
    } catch (err) { bakeFail(err); return; }
    const next = (fn) => setTimeout(() => { try { fn(); } catch (err) { bakeFail(err); } }, 0);
    const build = () => {
      if (types.length) { B.warm(types.pop()); next(build); return; }
      const t0 = performance.now();
      while (k < parts.length && (performance.now() - t0 < 4 || k === 0)) {
        const p = parts[k++];
        FIX = (p.i + 0.5) / p.j.n;
        try { p.j.run(B, p.off / sr, oac.destination); } finally { FIX = -1; }
      }
      if (k < parts.length) { next(build); return; }
      let fin = false;
      const done = (buf) => { if (fin) return; fin = true; k = 0; next(() => cut(buf)); };
      oac.oncomplete = (e) => done(e.renderedBuffer);
      const pr = oac.startRendering();
      if (pr && pr.then) pr.then(done, (err) => { if (!fin) { fin = true; bakeFail(err); } });
    };
    const cut = (buf) => {
      const data = buf.getChannelData(0), ac = L.E ? L.E.ac : null, t0 = performance.now();
      if (!ac) { L.baking = false; return; }
      while (k < parts.length && performance.now() - t0 < 4) {
        const p = parts[k++], j = p.j, b = ac.createBuffer(1, p.len, sr), seg = data.subarray(p.off, p.off + p.len);
        if (b.copyToChannel) b.copyToChannel(seg, 0); else b.getChannelData(0).set(seg);
        (j.bufs || (j.bufs = [])).push(b);
        if (j.bufs.length === j.n) {
          const kb = (j.n * p.len * 4) / 1024;
          L.bank[j.key] = { bufs: j.bufs, v: j.v || 0, used: ac.currentTime, kb };
          L.bakeKB += kb;
          delete L.bqKeys[j.key];
        }
      }
      if (k < parts.length) { next(() => cut(buf)); return; }
      L.baking = false;
      if (L.bq.length && !L.bakeT) L.bakeT = setTimeout(bakeStart, 100);
    };
    next(build);
  }
  function fadeOut(tr, dur) {
    if (!tr || tr.stopping) return;
    tr.stopping = true;
    const now = L.E.ac.currentTime, g = tr.out.gain;
    try { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + dur); } catch (e) { /* nada */ }
    tr.killAt = now + dur + 0.2;
    L.fading.push(tr);
  }
  function startTrack(name) {
    const E = L.E;
    if (!E || !SONGS[name] || !L.musicOk) return; // antes do "trilha pronta": fica em L.wanted
    const had = !!L.cur;
    if (L.cur) fadeOut(L.cur, XFADE);
    L.cur = E.track(name, E.ac.currentTime + 0.06, had ? XFADE : 0.05);
    if (!L.bakeOff) { evictDrums(E.ac.currentTime); wantSongDrums(SONGS[name]); }
  }
  function applySettings(force) {
    const E = L.E;
    if (!E) return;
    const m = musicOn(), s = sfxOn(), now = E.ac.currentTime;
    if (force || m !== L.mOn) {
      L.mOn = m;
      E.musicOn.gain.setTargetAtTime(m ? 1 : 0, now, 0.03);
      if (!m) { if (L.cur) { L.wanted = L.cur.ended ? null : L.cur.name; fadeOut(L.cur, 0.25); L.cur = null; } }
      else if (L.wanted && !L.cur) startTrack(L.wanted); // faixa pedida com a música desligada
    }
    if (force || s !== L.sOn) { L.sOn = s; E.sfxOn.gain.setTargetAtTime(s ? 1 : 0, now, 0.02); }
  }
  function applyQuality() {
    const E = L.E;
    LOWQ = G.quality === 'low';
    if (!E) return;
    // montar o convolver custa ~60 ms a 4× (FFT da resposta na thread principal): fica para o tick
    // escolher a hora (≥ 1,5 s depois e de preferência fora do 'play')
    if (!LOWQ) { if (!E.rev) { if (!L.revWant) { L.revWant = true; L.revAt = E.ac.currentTime + 1.5; } } else E.setReverb(true); }
    else { L.revWant = false; E.setReverb(false); }
  }
  // chefão nos últimos 34% de vida = trilha no clímax (camadas extras)
  function bossCritical() {
    const g = G.game, b = g && g.boss;
    return !!(b && b.state === 'fight' && b.maxHp > 0 && b.hp / b.maxHp < 0.34);
  }
  function pump(tr, now) {
    if (tr.next < now - 0.08) { // ficou para trás (aba em segundo plano/travada): pula sem despejar notas
      const miss = Math.ceil((now - tr.next) / tr.sd);
      tr.step += miss; tr.next += miss * tr.sd;
    }
    while (tr.next < now + LOOKAHEAD && !tr.ended) {
      playStep(L.E, tr, tr.next);
      if (tr.ended) break;
      tr.step++; tr.next += tr.sd;
    }
  }
  function tick() {
    const E = L.E;
    if (!E) return;
    try {
      applySettings(false);
      if ((G.quality === 'low') !== LOWQ) applyQuality();
      const ac = E.ac, now = ac.currentTime;
      const duck = G.state === 'pause'; // pausa: música abafada e mais baixa
      if (duck !== L.duck) {
        L.duck = duck;
        E.duckF.frequency.setTargetAtTime(duck ? 1000 : 20000, now, 0.08);
        E.duckG.gain.setTargetAtTime(duck ? 0.5 : 1, now, 0.08);
      }
      if (ac.state !== 'running') return;
      if (L.revWant && now >= L.revAt && (G.state !== 'play' || now >= L.revAt + 4.5)) { L.revWant = false; setTimeout(buildReverb, 0); }
      // chefão entrando/falando com a música parada: toca o "suspense" (vira a trilha do chefão no começo da luta)
      if (!L.cur && !L.wanted && L.mOn) {
        const b = G.game && G.game.boss;
        if (b && (b.state === 'enter' || b.state === 'talk')) startTrack('suspense');
      }
      const tr = L.cur;
      if (tr) {
        tr.hi = bossCritical();
        pump(tr, now);
        if (tr.ended && now > tr.endAt) { fadeOut(tr, 0.3); if (L.cur === tr) L.cur = null; if (L.wanted === tr.name) L.wanted = null; }
      }
      if (L.fading.length) {
        L.fading = L.fading.filter((f) => { if (now > f.killAt) { try { f.out.disconnect(); } catch (e) { /* nada */ } return false; } return true; });
      }
      E.prune(now);
    } catch (err) { report(err, 'tick'); }
  }
  function onVis() {
    const E = L.E;
    if (!E) return;
    const ac = E.ac;
    try {
      if (document.hidden) {
        if (ac.state === 'running') { L.susByUs = true; const p = ac.suspend(); if (p && p.catch) p.catch(() => {}); }
      } else if (L.susByUs) { L.susByUs = false; const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* nada */ }
  }

  const api = {
    __tag: 'audio',
    // Prepara ouvintes de destravamento. NÃO cria o AudioContext.
    init() {
      if (L.inited) return;
      L.inited = true;
      if (!AC || typeof document === 'undefined') return;
      const u = () => { try { api.unlock(); } catch (err) { report(err, 'unlock'); } };
      for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) document.addEventListener(ev, u, { capture: true, passive: true });
      document.addEventListener('visibilitychange', onVis);
    },
    // Chamado no primeiro toque/tecla (e depois, sempre que preciso): cria/retoma o contexto.
    unlock() {
      if (!AC) return;
      const ac = ensureCtx();
      if (!ac) return;
      if (!L.E && !L.building) { L.building = true; setTimeout(bootStep, 0, 0); }
      if (ac.state !== 'running' || L.first) {
        L.first = false;
        if (!(typeof document !== 'undefined' && document.hidden)) {
          try { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* nada */ }
        }
        // iOS: tocar 1 amostra de silêncio dentro do gesto libera a saída de áudio
        try { const b = ac.createBuffer(1, 1, ac.sampleRate), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) { /* nada */ }
      }
      L.susByUs = false;
      if (L.E && L.wanted && musicOn() && !L.cur) startTrack(L.wanted);
    },
    sfx(name) {
      const E = L.E;
      if (!E) { if (L.building && SFX[name] && L.pend.length < 3 && L.pend.indexOf(name) < 0) L.pend.push(name); return; }
      if (!sfxOn()) return;
      const d = SFX[name];
      if (!d) return; // nome desconhecido: ignora
      const ac = E.ac;
      if (ac.state !== 'running') return;
      const now = ac.currentTime, lt = L.last[name];
      const rate = LOWQ && LOW_RATE[name] ? Math.max(d.rate, LOW_RATE[name]) : d.rate;
      if (lt !== undefined && now >= lt && now - lt < rate) return; // limite por nome
      L.last[name] = now;
      let p;
      if (name === 'pix') { L.pixStreak = now - L.pixT < 0.35 ? Math.min(L.pixStreak + 1, 10) : 0; L.pixT = now; p = L.pixStreak; }
      E.playSfx(name, now + 0.004, p);
    },
    music(name) {
      if (!SONGS[name]) return;
      L.wanted = name;
      if (!L.E || !musicOn()) return; // lembra e toca quando der
      if (L.cur && L.cur.name === name && !L.cur.ended && !L.cur.stopping) return;
      startTrack(name);
    },
    stopMusic() {
      L.wanted = null;
      if (L.cur && L.E) fadeOut(L.cur, 0.6);
      L.cur = null;
    },
    setMusicOn(on) { if (G.save && G.save.settings) G.save.settings.music = !!on; applySettings(false); },
    setSfxOn(on) { if (G.save && G.save.settings) G.save.settings.sfx = !!on; applySettings(false); },
    debugInfo() {
      const E = L.E;
      return {
        ctxState: E ? E.ac.state : AC ? 'none' : 'unsupported',
        track: L.cur ? L.cur.name : null, wanted: L.wanted,
        voices: E ? E.voices.length : 0, musicVoices: E ? E.mv : 0, reverb: !!(E && E.rev && E.rev.on), low: LOWQ,
        music: musicOn(), sfx: sfxOn(), climax: !!(L.cur && L.cur.hi), ducked: L.duck,
        time: E ? +E.ac.currentTime.toFixed(2) : 0,
        baked: Object.keys(L.bank).length, bakeKB: Math.round(L.bakeKB), bakeQueue: L.bq.length, bakeOff: L.bakeOff,
      };
    },
    names: { sfx: Object.keys(SFX), music: Object.keys(SONGS) },
    // ---- para testes (OfflineAudioContext) ----
    _Engine: Engine,
    _check: checkSongs,
    _songs: SONGS,
    _inst: INST,
    _drum: DRUM,
    _sfx: SFX,
    _bank: () => L.bank,
    _fix(v) { FIX = v; }, // fixa o sorteio (comparar sintetizado x pré-renderizado)
    _ctxSuspendForTest() { if (L.E) L.E.ac.suspend(); },
  };
  G.Audio = Object.assign(G.Audio || {}, api);
})();
