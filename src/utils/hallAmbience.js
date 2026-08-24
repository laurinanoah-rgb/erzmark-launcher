let audioContext = null;
let ambienceNodes = null;
let enabled = false;
let volume = 0.32;
let muted = false;

function context() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function stopAmbience() {
  if (!ambienceNodes) return;
  ambienceNodes.sources.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
  ambienceNodes.master.disconnect();
  ambienceNodes = null;
}

function startAmbience() {
  if (!enabled || muted || ambienceNodes) return;
  const ctx = context();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = Math.max(0.0001, volume * 0.045);
  master.connect(ctx.destination);

  const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const crackle = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.9 : 0;
    data[i] = (Math.random() * 2 - 1) * 0.11 + crackle;
  }
  const fire = ctx.createBufferSource();
  fire.buffer = buffer;
  fire.loop = true;
  const fireFilter = ctx.createBiquadFilter();
  fireFilter.type = "lowpass";
  fireFilter.frequency.value = 950;
  fire.connect(fireFilter).connect(master);

  const drone = ctx.createOscillator();
  const droneGain = ctx.createGain();
  drone.type = "sine";
  drone.frequency.value = 52;
  droneGain.gain.value = 0.13;
  drone.connect(droneGain).connect(master);
  fire.start();
  drone.start();
  ambienceNodes = { master, sources: [fire, drone] };
}

export function configureHallAmbience(settings = {}) {
  enabled = Boolean(settings.ambient_sound);
  muted = Boolean(settings.mute_ui_sounds);
  volume = Math.max(0, Math.min(1, Number(settings.ambient_volume ?? 32) / 100));
  if (!enabled || muted) stopAmbience();
  else {
    if (ambienceNodes) ambienceNodes.master.gain.value = Math.max(0.0001, volume * 0.045);
    startAmbience();
  }
}

function ritualTone(frequency, target, duration, gain = 0.045) {
  if (muted) return;
  const ctx = context();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const output = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(target, ctx.currentTime + duration);
  output.gain.setValueAtTime(gain, ctx.currentTime);
  output.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.connect(output).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export function playGateIgnition() {
  ritualTone(110, 330, 0.72, 0.055);
  window.setTimeout(() => ritualTone(220, 880, 0.48, 0.032), 180);
}

export function playGateFailure() {
  ritualTone(180, 74, 0.42, 0.05);
}
