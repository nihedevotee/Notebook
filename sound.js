// sound.js — synthesized UI + natural Apple Pencil-style writing sounds
// No audio files, no dependencies.
// Auto-connects itself to canvas drawing/writing.

const SOUND_KEY = "simple-notebook-sound-v1";

let audioCtx = null;
let muted = false;

let strokeActive = false;
let activePointerId = null;
let lastMoveTime = 0;
let lastX = 0;
let lastY = 0;

let ambienceNoise = null;
let ambienceGain = null;
let ambienceFilter = null;

try {
  muted = localStorage.getItem(SOUND_KEY) === "off";
} catch {
  muted = false;
}

function getContext() {
  if (audioCtx) return audioCtx;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  audioCtx = new Ctx();
  return audioCtx;
}

function resumeAudio() {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

["pointerdown", "mousedown", "touchstart", "keydown"].forEach((eventName) => {
  window.addEventListener(eventName, resumeAudio, {
    once: true,
    passive: true,
  });
});

function createNoiseBuffer(ctx, seconds = 0.25) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function playTone({
  freq = 1200,
  duration = 0.04,
  type = "sine",
  gain = 0.04,
  glideTo = null,
}) {
  if (muted) return;

  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (glideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, glideTo),
        now + duration
      );
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // cosmetic only
  }
}

// Normal button click sound
export function playClick() {
  playTone({
    freq: 1450,
    duration: 0.035,
    type: "sine",
    gain: 0.045,
    glideTo: 950,
  });
}

// Selection sound
export function playSelect() {
  playTone({
    freq: 1750,
    duration: 0.03,
    type: "sine",
    gain: 0.035,
    glideTo: 1250,
  });
}

// Very soft pencil-touch sound
export function playStrokeStart() {
  playPencilTick(0.018);
}

// Small natural glass-pencil tick
function playPencilTick(volume = 0.018) {
  if (muted) return;

  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.04);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";

    // Higher frequency = more iPad/glass-like
    filter.frequency.setValueAtTime(2600 + Math.random() * 1200, now);
    filter.Q.setValueAtTime(5.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.035);

    setTimeout(() => {
      try {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    }, 80);
  } catch {
    // ignore
  }
}

// Very quiet background friction.
// This is intentionally very low so it does not sound like rough paper.
export function startStrokeSound() {
  if (muted) return;

  const ctx = getContext();
  if (!ctx) return;

  try {
    resumeAudio();

    if (ambienceNoise || ambienceGain) return;

    const now = ctx.currentTime;

    ambienceNoise = ctx.createBufferSource();
    ambienceNoise.buffer = createNoiseBuffer(ctx, 1);
    ambienceNoise.loop = true;

    ambienceFilter = ctx.createBiquadFilter();
    ambienceFilter.type = "highpass";
    ambienceFilter.frequency.setValueAtTime(1800, now);

    ambienceGain = ctx.createGain();

    // Lower this if still too noticeable.
    ambienceGain.gain.setValueAtTime(0.0001, now);
    ambienceGain.gain.exponentialRampToValueAtTime(0.003, now + 0.03);

    ambienceNoise.connect(ambienceFilter);
    ambienceFilter.connect(ambienceGain);
    ambienceGain.connect(ctx.destination);

    ambienceNoise.start(now);
  } catch {
    stopStrokeSound();
  }
}

// Called while the pointer is moving on the canvas.
// This gives the realistic writing feel.
function updateStrokeSound(event) {
  if (!strokeActive || muted) return;

  if (activePointerId !== null && event.pointerId !== activePointerId) return;

  const nowMs = performance.now();

  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // No movement, no writing sound.
  if (distance < 1.5) return;

  // Throttle the sound so it does not become noisy.
  if (nowMs - lastMoveTime < 22) return;

  lastMoveTime = nowMs;
  lastX = event.clientX;
  lastY = event.clientY;

  const pressure =
    typeof event.pressure === "number" && event.pressure > 0
      ? event.pressure
      : 0.45;

  // Faster movement = slightly more sound.
  const movementVolume = Math.min(0.028, 0.008 + distance * 0.0015);
  const pressureVolume = movementVolume * (0.7 + pressure * 0.8);

  playPencilTick(pressureVolume);

  // Smoothly change the tiny background friction.
  if (ambienceGain && audioCtx) {
    const t = audioCtx.currentTime;
    const softGain = Math.min(0.012, 0.004 + distance * 0.0005);
    ambienceGain.gain.setTargetAtTime(softGain, t, 0.025);
  }

  if (ambienceFilter && audioCtx) {
    const t = audioCtx.currentTime;
    const freq = 1800 + Math.min(1800, distance * 45);
    ambienceFilter.frequency.setTargetAtTime(freq, t, 0.025);
  }
}

export function stopStrokeSound() {
  const ctx = audioCtx;
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (ambienceGain) {
      ambienceGain.gain.cancelScheduledValues(now);
      ambienceGain.gain.setValueAtTime(
        Math.max(0.0001, ambienceGain.gain.value),
        now
      );
      ambienceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    }

    if (ambienceNoise) {
      try {
        ambienceNoise.stop(now + 0.08);
      } catch {}
    }

    setTimeout(() => {
      try {
        if (ambienceNoise) ambienceNoise.disconnect();
        if (ambienceFilter) ambienceFilter.disconnect();
        if (ambienceGain) ambienceGain.disconnect();
      } catch {}

      ambienceNoise = null;
      ambienceFilter = null;
      ambienceGain = null;
    }, 130);
  } catch {
    ambienceNoise = null;
    ambienceFilter = null;
    ambienceGain = null;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);

  if (muted) {
    stopStrokeSound();
  }

  try {
    localStorage.setItem(SOUND_KEY, muted ? "off" : "on");
  } catch {}
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

// Auto-connect writing sound to canvas
document.addEventListener(
  "pointerdown",
  (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const canvas = target.closest("canvas");

    if (canvas) {
      strokeActive = true;
      activePointerId = event.pointerId;
      lastMoveTime = 0;
      lastX = event.clientX;
      lastY = event.clientY;

      playStrokeStart();
      startStrokeSound();
    }
  },
  true
);

document.addEventListener(
  "pointermove",
  (event) => {
    updateStrokeSound(event);
  },
  true
);

document.addEventListener(
  "pointerup",
  () => {
    strokeActive = false;
    activePointerId = null;
    stopStrokeSound();
  },
  true
);

document.addEventListener(
  "pointercancel",
  () => {
    strokeActive = false;
    activePointerId = null;
    stopStrokeSound();
  },
  true
);

window.addEventListener("blur", () => {
  strokeActive = false;
  activePointerId = null;
  stopStrokeSound();
});

// Auto click sounds for buttons/tools
document.addEventListener(
  "click",
  (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const clickable = target.closest(
      "button, .tool, .toolbar button, .sidebar button, [role='button']"
    );

    if (clickable) {
      playClick();
    }
  },
  true
);