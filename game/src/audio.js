// Synthesized sound for VOID BLOOM: every effect and the music loop are WebAudio oscillators and
// filtered noise, made in code — the game ships no audio files. The context opens on the first
// user gesture (a browser rule), and every call is safe before that: it simply stays silent.

/** Note frequencies (Hz) for the music sequencer, one octave of a minor scale plus its roots. */
const NOTES = { A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, G2: 98, A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220, C4: 261.63, E4: 329.63 };

/** The bass line, one bar of eighth notes, and the sparse arpeggio over it. */
const BASS_BAR = ['A1', 'A1', 'C2', 'A1', 'A1', 'A1', 'G2', 'E2'];
const ARP_BAR = ['A3', null, 'C4', null, 'E4', null, 'C4', 'G3'];

/** Make the sound engine: play(name) for effects, setMusic(on) for the loop, toggleMute(). */
export function makeAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicOn = false;
  let musicTimer = null;
  let step = 0;

  /** Open the context (first gesture only) and build the two gain buses. */
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.34;
    musicGain.connect(master);
    return true;
  }

  /** One oscillator blip: type, from-to frequency, length, loudness, destination bus. */
  function blip(type, from, to, seconds, loud, bus) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + seconds);
    gain.gain.setValueAtTime(loud, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(bus || master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  /** One burst of filtered noise (explosions, hits): length and loudness. */
  function noise(seconds, loud, cutoff) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(loud, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  /** The effect recipes, by the names world.js and main.js call. */
  const EFFECTS = {
    shoot() { blip('square', 880, 320, 0.07, 0.10); },
    hit() { blip('triangle', 300, 140, 0.05, 0.12); },
    kill() { noise(0.22, 0.30, 900); blip('sawtooth', 220, 40, 0.22, 0.16); },
    splitter() { noise(0.16, 0.22, 1400); blip('triangle', 520, 180, 0.14, 0.14); },
    spore() { blip('sine', 990, 1560, 0.08, 0.12); },
    heart() { blip('sine', 620, 930, 0.14, 0.16); },
    hurt() { noise(0.18, 0.32, 700); blip('sawtooth', 160, 60, 0.2, 0.2); },
    dash() { noise(0.14, 0.16, 2600); blip('sine', 340, 720, 0.12, 0.08); },
    levelup() { blip('sine', 523, 523, 0.1, 0.16); setTimeout(() => blip('sine', 659, 659, 0.1, 0.16), 70); setTimeout(() => blip('sine', 784, 784, 0.16, 0.18), 140); },
    pick() { blip('triangle', 440, 660, 0.09, 0.16); },
    wave() { blip('triangle', 196, 392, 0.3, 0.18); },
    boss() { blip('sawtooth', 82, 55, 0.7, 0.26); noise(0.6, 0.14, 300); },
    bosshit() { blip('square', 190, 120, 0.05, 0.10); },
    win() { blip('sine', 523, 523, 0.12, 0.18); setTimeout(() => blip('sine', 659, 659, 0.12, 0.18), 110); setTimeout(() => blip('sine', 784, 784, 0.12, 0.18), 220); setTimeout(() => blip('sine', 1046, 1046, 0.3, 0.2), 330); },
    lose() { blip('sawtooth', 220, 55, 0.8, 0.22); },
  };

  /** Schedule one eighth-note step of the music loop. */
  function scheduleStep() {
    if (!ctx || !musicOn) return;
    const i = step % 8;
    const bass = BASS_BAR[i];
    if (bass) blip('triangle', NOTES[bass], NOTES[bass], 0.21, 0.5, musicGain);
    const arp = ARP_BAR[i];
    if (arp) blip('sine', NOTES[arp], NOTES[arp], 0.18, 0.20, musicGain);
    step += 1;
  }

  return {
    /** Call from any user gesture: opens the context so later calls can sound. */
    unlock() { ensure(); },

    /** Play a named effect; silent until unlocked or while muted. */
    play(name) {
      if (!ctx || muted) return;
      const effect = EFFECTS[name];
      if (effect) effect();
    },

    /** Start or stop the music loop (it needs the context, so call after unlock). */
    setMusic(on) {
      musicOn = on;
      if (on && ensure() && !musicTimer) {
        scheduleStep();
        musicTimer = setInterval(scheduleStep, 214);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },

    /** Flip the mute: returns the new muted state. M also silences the music bus via master. */
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.01);
      return muted;
    },

    /** Whether sound is currently muted. */
    isMuted() { return muted; },
  };
}
