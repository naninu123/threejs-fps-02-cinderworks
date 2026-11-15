// Sound, synthesized with WebAudio — no audio files, no network. A short
// noise burst is a gunshot, a filtered click is a reload, a low sine thump is
// a grenade, a beep is the bomb. All sounds are created lazily on first user
// gesture so the browser's autoplay policy never blocks the game.
export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, filterFreq, gainValue, type = 'lowpass') {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  function tone(freq, duration, gainValue, type = 'sine', slideTo = 0) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    shot() { noiseBurst(0.09, 1800, 0.9); tone(160, 0.07, 0.25, 'square', 60); },
    distantShot() { noiseBurst(0.12, 700, 0.25); },
    hit() { tone(1200, 0.05, 0.3, 'sine'); },
    kill() { tone(900, 0.08, 0.35, 'sine', 500); tone(1400, 0.06, 0.25, 'sine'); },
    reload() { tone(500, 0.05, 0.2, 'square'); setTimeout(() => tone(700, 0.05, 0.2, 'square'), 350); },
    dryFire() { tone(300, 0.04, 0.15, 'square'); },
    explosion() { noiseBurst(0.7, 300, 1.0); tone(70, 0.6, 0.6, 'sine', 30); },
    plantBeep() { tone(1000, 0.12, 0.3, 'sine'); },
    defuseBeep() { tone(1500, 0.1, 0.3, 'sine'); },
    roundWin() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 0.3, 'sine'), i * 120)); },
    roundLose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, 0.3, 'sine'), i * 130)); },
    buy() { tone(880, 0.08, 0.25, 'sine'); tone(1174, 0.1, 0.25, 'sine'); },
  };
}
